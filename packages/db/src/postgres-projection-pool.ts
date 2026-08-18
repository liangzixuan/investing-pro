import type {
  FinancialFact,
  OperationProjectionQuery,
  OperationProjectionSourceResult,
  OperationScopedProjectionSource,
} from "@research-cockpit/research-core";
import type { Pool, PoolClient } from "pg";

import {
  type PostgresProjectionActorContext,
  type PostgresProjectionActorContextProvider,
} from "./postgres-projection-adapter";
import {
  MAX_POSTGRES_PROJECTION_ROWS,
  normalizePostgresFinancialFactProjectionRows,
  postgresProjectionOperationContext,
  renderPostgresFinancialFactProjectionQuery,
} from "./postgres-projection-query";
import { normalizePostgresFinancialFactProjectionQuery } from "./projection-normalization";

const EXPECTED_POOL_SIZE = 2;
const MAX_CONNECTION_TIMEOUT_MILLISECONDS = 30_000;
const MAX_STATEMENT_TIMEOUT_MILLISECONDS = 60_000;
const ROLLBACK_SQL = "ROLLBACK";
const DISCARD_ALL_SQL = "DISCARD ALL";
const BEGIN_READ_ONLY_SQL = "BEGIN READ ONLY";
const RUNTIME_ROLE_SQL = "SET LOCAL ROLE research_cockpit_runtime";
const COMMIT_SQL = "COMMIT";
const SET_STATEMENT_TIMEOUT_SQL = `SELECT pg_catalog.set_config(
  'statement_timeout',
  $1::text,
  true
) AS statement_timeout`;
const RESTORE_POOL_SESSION_CONFIGURATION_SQL = `SELECT
  pg_catalog.set_config('application_name', $1::text, false),
  pg_catalog.set_config('statement_timeout', $2::text, false)`;
const SET_REQUEST_CONTEXT_SQL = `CALL private_data.set_request_context(
  $1::uuid,
  $2::uuid,
  $3::text,
  $4::text,
  $5::text,
  $6::text
)`;
const SYNTHETIC_TERRITORY = "demo_only";
const SYNTHETIC_CLASSIFICATION = "synthetic";
const POSTGRES_TEXT_OID = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ABORT_SIGNAL_PROTOTYPE: object = AbortSignal.prototype;
const EVENT_TARGET_ADD_EVENT_LISTENER: unknown =
  Object.getOwnPropertyDescriptor(
    EventTarget.prototype,
    "addEventListener",
  )?.value;
const EVENT_TARGET_REMOVE_EVENT_LISTENER: unknown =
  Object.getOwnPropertyDescriptor(
    EventTarget.prototype,
    "removeEventListener",
  )?.value;
const FORBIDDEN_PREEXISTING_POOL_LISTENERS = [
  "acquire",
  "connect",
  "error",
  "newListener",
  "release",
  "remove",
  "removeListener",
] as const;

export interface PostgresProjectionPoolLoadOptions {
  readonly signal?: AbortSignal;
}

export type PostgresProjectionPoolErrorCode =
  | "POSTGRES_PROJECTION_POOL_FAILURE"
  | "POSTGRES_PROJECTION_POOL_ABORTED"
  | "POSTGRES_PROJECTION_POOL_TIMEOUT";

/** A stable, value-free failure for the complete pooled adapter boundary. */
export class PostgresProjectionPoolError extends Error {
  public readonly code: PostgresProjectionPoolErrorCode;

  public constructor(code: PostgresProjectionPoolErrorCode) {
    super("PostgreSQL projection pool failed.");
    this.name = "PostgresProjectionPoolError";
    this.code = code;
  }
}

type PoolLifecycle = "open" | "closing" | "closed";
type ClientDisposition =
  "absent" | "held" | "destroyed" | "released" | "release_failed";

interface PoolConfiguration {
  readonly applicationName: string;
  readonly connectionTimeoutMilliseconds: number;
  readonly statementTimeoutMilliseconds: number;
}

interface ProjectionLoadSnapshot {
  readonly query: OperationProjectionQuery;
  readonly actor: PostgresProjectionActorContext;
  readonly signal?: AbortSignal;
}

/**
 * An owning, bounded adapter over one exclusively transferred PostgreSQL pool.
 * It supports two simultaneous loads, but no caller may use the pool after a
 * successful construction. Every reusable checkout is reset outside a
 * transaction before and after one read-only operation. Any ambiguous or
 * failed checkout is destroyed instead of being returned to the pool.
 */
export class PooledPostgresFinancialFactProjectionSource implements OperationScopedProjectionSource<FinancialFact> {
  readonly #pool: Pool;
  readonly #currentActorContext: () => PostgresProjectionActorContext;
  readonly #applicationName: string;
  readonly #statementTimeoutMilliseconds: number;
  #lifecycle: PoolLifecycle = "open";
  #idlePoolFailed = false;
  #activeLoads = 0;
  #resolveDrain: (() => void) | null = null;
  #closePromise: Promise<void> | null = null;

  readonly #recordIdlePoolError = () => {
    this.#idlePoolFailed = true;
  };

  public constructor(
    pool: Pool,
    actorContextProvider: PostgresProjectionActorContextProvider,
  ) {
    let currentActorContext: () => PostgresProjectionActorContext;
    let configuration: PoolConfiguration;
    try {
      if (
        typeof pool.connect !== "function" ||
        typeof pool.end !== "function" ||
        typeof pool.on !== "function" ||
        typeof pool.removeListener !== "function" ||
        typeof pool.listenerCount !== "function" ||
        FORBIDDEN_PREEXISTING_POOL_LISTENERS.some(
          (event) => pool.listenerCount(event) !== 0,
        )
      ) {
        invalid("POSTGRES_PROJECTION_POOL_FAILURE");
      }
      configuration = poolConfiguration(pool);
      const current: unknown = Reflect.get(actorContextProvider, "current");
      if (typeof current !== "function") {
        invalid("POSTGRES_PROJECTION_POOL_FAILURE");
      }
      currentActorContext = () => {
        const value: unknown = Reflect.apply(current, actorContextProvider, []);
        return value as PostgresProjectionActorContext;
      };
      pool.on("error", this.#recordIdlePoolError);
    } catch (error) {
      if (error instanceof PostgresProjectionPoolError) throw error;
      invalid("POSTGRES_PROJECTION_POOL_FAILURE");
    }
    this.#pool = pool;
    this.#currentActorContext = currentActorContext;
    this.#applicationName = configuration.applicationName;
    this.#statementTimeoutMilliseconds =
      configuration.statementTimeoutMilliseconds;
  }

  public async load(
    queryValue: OperationProjectionQuery,
    options?: PostgresProjectionPoolLoadOptions,
  ): Promise<OperationProjectionSourceResult<FinancialFact> | null> {
    if (this.#lifecycle !== "open" || this.#idlePoolFailed) {
      invalid("POSTGRES_PROJECTION_POOL_FAILURE");
    }

    const snapshot = projectionLoadSnapshot(
      queryValue,
      options,
      this.#currentActorContext,
    );
    if (
      snapshot.signal !== undefined &&
      abortSignalIsAborted(snapshot.signal)
    ) {
      invalid("POSTGRES_PROJECTION_POOL_ABORTED");
    }

    this.#activeLoads += 1;
    try {
      return await this.#loadSnapshot(snapshot);
    } finally {
      this.#activeLoads -= 1;
      if (this.#activeLoads === 0 && this.#resolveDrain !== null) {
        const resolve = this.#resolveDrain;
        this.#resolveDrain = null;
        resolve();
      }
    }
  }

  public close(): Promise<void> {
    if (this.#closePromise !== null) return this.#closePromise;
    this.#lifecycle = "closing";
    this.#closePromise = Promise.resolve().then(() => this.#closeAfterDrain());
    return this.#closePromise;
  }

  async #loadSnapshot(
    snapshot: ProjectionLoadSnapshot,
  ): Promise<OperationProjectionSourceResult<FinancialFact> | null> {
    let client: PoolClient | null = null;
    let disposition: ClientDisposition = "absent";
    let abortRequested = false;
    let abortListenerRegistered = false;

    const destroyClient = () => {
      if (client === null || disposition !== "held") return;
      disposition = "destroyed";
      try {
        client.release(true);
      } catch {
        disposition = "release_failed";
      }
    };
    const requestAbort = () => {
      abortRequested = true;
    };
    const abortWasRequested = () => {
      if (
        !abortRequested &&
        snapshot.signal !== undefined &&
        abortSignalIsAborted(snapshot.signal)
      ) {
        abortRequested = true;
      }
      return abortRequested;
    };
    const failIfAbortWasRequested = () => {
      if (!abortWasRequested()) return;
      destroyClient();
      invalid("POSTGRES_PROJECTION_POOL_ABORTED");
    };
    const detachAbortListener = () => {
      if (snapshot.signal === undefined || !abortListenerRegistered) return;
      abortListenerRegistered = false;
      removeAbortSignalListener(snapshot.signal, requestAbort);
    };
    const settle = async <T>(run: () => Promise<T>): Promise<T> => {
      failIfAbortWasRequested();
      const value = await run();
      failIfAbortWasRequested();
      return value;
    };

    try {
      if (snapshot.signal !== undefined) {
        addAbortSignalListener(snapshot.signal, requestAbort);
        abortListenerRegistered = true;
        if (abortSignalIsAborted(snapshot.signal)) requestAbort();
      }
      failIfAbortWasRequested();
      client = await this.#pool.connect();
      disposition = "held";
      failIfAbortWasRequested();
      if (this.#idlePoolFailed) {
        invalid("POSTGRES_PROJECTION_POOL_FAILURE");
      }
      const checkedOutClient = client;

      await settle(() => checkedOutClient.query(ROLLBACK_SQL));
      await settle(() => checkedOutClient.query(DISCARD_ALL_SQL));
      await settle(() =>
        this.#restorePoolSessionConfiguration(checkedOutClient),
      );
      await settle(() => checkedOutClient.query(BEGIN_READ_ONLY_SQL));
      await settle(() =>
        checkedOutClient.query({
          text: SET_STATEMENT_TIMEOUT_SQL,
          values: [`${this.#statementTimeoutMilliseconds}ms`],
        }),
      );
      await settle(() => checkedOutClient.query(RUNTIME_ROLE_SQL));

      const operationContext = postgresProjectionOperationContext(
        snapshot.query.operation,
      );
      await settle(() =>
        checkedOutClient.query({
          text: SET_REQUEST_CONTEXT_SQL,
          values: [
            snapshot.actor.principalId,
            snapshot.actor.organizationId,
            operationContext.purpose,
            operationContext.channel,
            snapshot.query.context.territory,
            SYNTHETIC_CLASSIFICATION,
          ],
        }),
      );
      const result = await settle(() =>
        checkedOutClient.query<[unknown], [string, string, string]>({
          text: renderPostgresFinancialFactProjectionQuery(
            snapshot.query.operation,
          ),
          values: [
            snapshot.query.scope.instrumentId,
            snapshot.query.scope.publicKnownAt,
            snapshot.query.scope.systemRecordedAt,
          ],
          rowMode: "array",
        }),
      );
      const rows = postgresProjectionRows(result);
      const normalized = normalizePostgresFinancialFactProjectionRows(
        snapshot.query,
        rows,
      );
      await settle(() => checkedOutClient.query(COMMIT_SQL));

      await settle(() => checkedOutClient.query(ROLLBACK_SQL));
      await settle(() => checkedOutClient.query(DISCARD_ALL_SQL));
      await settle(() =>
        this.#restorePoolSessionConfiguration(checkedOutClient),
      );
      failIfAbortWasRequested();
      detachAbortListener();
      failIfAbortWasRequested();

      try {
        checkedOutClient.release();
        disposition = "released";
      } catch {
        // A fresh pg-pool 3.14.0 release can throw only on double release or
        // through a user event listener. This class owns the pool, guards its
        // one release, and rejects all pre-existing pool listeners.
        disposition = "release_failed";
        invalid("POSTGRES_PROJECTION_POOL_FAILURE");
      }
      return normalized;
    } catch (error) {
      destroyClient();
      if (abortWasRequested()) {
        invalid("POSTGRES_PROJECTION_POOL_ABORTED");
      }
      if (
        error instanceof PostgresProjectionPoolError ||
        postgresErrorCode(error) === "57014" ||
        isPoolCheckoutTimeout(error)
      ) {
        invalid(
          error instanceof PostgresProjectionPoolError
            ? error.code
            : "POSTGRES_PROJECTION_POOL_TIMEOUT",
        );
      }
      invalid("POSTGRES_PROJECTION_POOL_FAILURE");
    } finally {
      let signalCleanupFailed = false;
      try {
        detachAbortListener();
      } catch {
        signalCleanupFailed = true;
      }
      if (disposition === "held") destroyClient();
      if (signalCleanupFailed) {
        invalid("POSTGRES_PROJECTION_POOL_FAILURE");
      }
    }
    return invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }

  async #closeAfterDrain(): Promise<void> {
    let failed = false;
    if (this.#activeLoads > 0) {
      await new Promise<void>((resolve) => {
        this.#resolveDrain = resolve;
      });
    }
    try {
      await this.#pool.end();
    } catch {
      failed = true;
    }
    try {
      this.#pool.removeListener("error", this.#recordIdlePoolError);
    } catch {
      failed = true;
    }
    this.#lifecycle = "closed";
    if (failed) invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }

  async #restorePoolSessionConfiguration(client: PoolClient): Promise<void> {
    await client.query({
      text: RESTORE_POOL_SESSION_CONFIGURATION_SQL,
      values: [
        this.#applicationName,
        `${this.#statementTimeoutMilliseconds}ms`,
      ],
    });
  }
}

function poolConfiguration(pool: Pool): PoolConfiguration {
  const options = ownDataField(pool, "options");
  const max = ownDataField(options, "max");
  const applicationName = ownDataField(options, "application_name");
  const connectionTimeoutMilliseconds = ownDataField(
    options,
    "connectionTimeoutMillis",
  );
  const statementTimeoutMilliseconds = ownDataField(
    options,
    "statement_timeout",
  );
  const queryTimeout = optionalOwnDataField(options, "query_timeout");
  if (
    max !== EXPECTED_POOL_SIZE ||
    typeof applicationName !== "string" ||
    !/^[a-z0-9_-]{1,63}$/.test(applicationName) ||
    !boundedMilliseconds(
      connectionTimeoutMilliseconds,
      MAX_CONNECTION_TIMEOUT_MILLISECONDS,
    ) ||
    !boundedMilliseconds(
      statementTimeoutMilliseconds,
      MAX_STATEMENT_TIMEOUT_MILLISECONDS,
    ) ||
    (connectionTimeoutMilliseconds as number) >=
      (statementTimeoutMilliseconds as number) ||
    (queryTimeout !== undefined && queryTimeout !== 0 && queryTimeout !== false)
  ) {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  return {
    applicationName,
    connectionTimeoutMilliseconds: connectionTimeoutMilliseconds as number,
    statementTimeoutMilliseconds: statementTimeoutMilliseconds as number,
  };
}

function projectionLoadSnapshot(
  queryValue: OperationProjectionQuery,
  options: PostgresProjectionPoolLoadOptions | undefined,
  currentActorContext: () => PostgresProjectionActorContext,
): ProjectionLoadSnapshot {
  try {
    const query = normalizePostgresFinancialFactProjectionQuery(queryValue);
    if (query.context.territory !== SYNTHETIC_TERRITORY) {
      invalid("POSTGRES_PROJECTION_POOL_FAILURE");
    }
    const actor = actorContext(currentActorContext);
    let signal: AbortSignal | undefined;
    if (options !== undefined) {
      const record = exactDataRecord(options, ["signal"], true);
      const value = record.signal;
      if (value !== undefined && !(value instanceof AbortSignal)) {
        invalid("POSTGRES_PROJECTION_POOL_FAILURE");
      }
      signal = value;
    }
    return signal === undefined
      ? Object.freeze({ query, actor })
      : Object.freeze({ query, actor, signal });
  } catch (error) {
    if (error instanceof PostgresProjectionPoolError) throw error;
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
}

function actorContext(
  current: () => PostgresProjectionActorContext,
): PostgresProjectionActorContext {
  let value: unknown;
  try {
    value = current();
  } catch {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  const record = exactDataRecord(value, ["principalId", "organizationId"]);
  const principalId = uuid(record.principalId);
  const organizationId = uuid(record.organizationId);
  return Object.freeze({ principalId, organizationId });
}

function postgresProjectionRows(result: unknown): unknown[] {
  const command = ownDataField(result, "command");
  const rowCount = ownDataField(result, "rowCount");
  const fields = denseArray(ownDataField(result, "fields"));
  const rows = denseArray(ownDataField(result, "rows"));
  if (
    command !== "SELECT" ||
    rowCount !== rows.length ||
    fields.length !== 1 ||
    rows.length > MAX_POSTGRES_PROJECTION_ROWS
  ) {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }

  const field = fields[0];
  if (
    ownDataField(field, "name") !== "row_to_json" ||
    ownDataField(field, "dataTypeID") !== POSTGRES_TEXT_OID
  ) {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }

  return rows.map((row) => {
    const columns = denseArray(row);
    if (columns.length !== 1 || typeof columns[0] !== "string") {
      invalid("POSTGRES_PROJECTION_POOL_FAILURE");
    }
    try {
      return JSON.parse(columns[0]) as unknown;
    } catch {
      invalid("POSTGRES_PROJECTION_POOL_FAILURE");
    }
  });
}

function exactDataRecord<const TKeys extends readonly string[]>(
  value: unknown,
  expectedKeys: TKeys,
  allowMissing = false,
): Readonly<Record<TKeys[number], unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.some(
      (key) => typeof key !== "string" || !expectedKeys.includes(key),
    ) ||
    (!allowMissing && keys.length !== expectedKeys.length)
  ) {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  const output: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    output[key] = optionalOwnDataField(value, key);
    if (!allowMissing && output[key] === undefined) {
      invalid("POSTGRES_PROJECTION_POOL_FAILURE");
    }
  }
  return output as Readonly<Record<TKeys[number], unknown>>;
}

function denseArray(value: unknown): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor)) {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  const length: unknown = lengthDescriptor.value;
  if (!Number.isSafeInteger(length) || (length as number) < 0) {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== (length as number) + 1) {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  const output: unknown[] = [];
  for (let index = 0; index < (length as number); index += 1) {
    output.push(ownDataField(value, String(index)));
  }
  return output;
}

function ownDataField(value: unknown, key: PropertyKey): unknown {
  const field = optionalOwnDataField(value, key);
  if (field === undefined) invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  return field;
}

function optionalOwnDataField(value: unknown, key: PropertyKey): unknown {
  if (
    (typeof value !== "object" && typeof value !== "function") ||
    value === null
  ) {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) return undefined;
  if (!("value" in descriptor) || !descriptor.enumerable) {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  return descriptor.value;
}

function boundedMilliseconds(value: unknown, maximum: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    (value as number) > 0 &&
    (value as number) <= maximum
  );
}

function abortSignalIsAborted(signal: AbortSignal): boolean {
  try {
    const value: unknown = Reflect.get(
      ABORT_SIGNAL_PROTOTYPE,
      "aborted",
      signal,
    );
    if (typeof value !== "boolean") {
      invalid("POSTGRES_PROJECTION_POOL_FAILURE");
    }
    return value;
  } catch (error) {
    if (error instanceof PostgresProjectionPoolError) throw error;
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
}

function addAbortSignalListener(
  signal: AbortSignal,
  listener: () => void,
): void {
  try {
    if (typeof EVENT_TARGET_ADD_EVENT_LISTENER !== "function") {
      invalid("POSTGRES_PROJECTION_POOL_FAILURE");
    }
    Reflect.apply(EVENT_TARGET_ADD_EVENT_LISTENER, signal, [
      "abort",
      listener,
      { once: true },
    ]);
  } catch {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
}

function removeAbortSignalListener(
  signal: AbortSignal,
  listener: () => void,
): void {
  try {
    if (typeof EVENT_TARGET_REMOVE_EVENT_LISTENER !== "function") {
      invalid("POSTGRES_PROJECTION_POOL_FAILURE");
    }
    Reflect.apply(EVENT_TARGET_REMOVE_EVENT_LISTENER, signal, [
      "abort",
      listener,
    ]);
  } catch {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    invalid("POSTGRES_PROJECTION_POOL_FAILURE");
  }
  return value;
}

function postgresErrorCode(error: unknown): string | null {
  try {
    const code = optionalOwnDataField(error, "code");
    return typeof code === "string" ? code : null;
  } catch {
    return null;
  }
}

function isPoolCheckoutTimeout(error: unknown): boolean {
  try {
    return (
      error instanceof Error &&
      (error.message === "timeout exceeded when trying to connect" ||
        error.message === "Connection terminated due to connection timeout")
    );
  } catch {
    return false;
  }
}

function invalid(code: PostgresProjectionPoolErrorCode): never {
  throw new PostgresProjectionPoolError(code);
}
