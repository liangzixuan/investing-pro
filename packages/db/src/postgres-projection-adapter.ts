import type {
  FinancialFact,
  OperationProjectionQuery,
  OperationProjectionSourceResult,
  OperationScopedProjectionSource,
} from "@research-cockpit/research-core";
import type { Client } from "pg";

import {
  MAX_POSTGRES_PROJECTION_ROWS,
  normalizePostgresFinancialFactProjectionRows,
  postgresProjectionOperationContext,
  renderPostgresFinancialFactProjectionQuery,
} from "./postgres-projection-query";
import { normalizePostgresFinancialFactProjectionQuery } from "./projection-normalization";

const RUNTIME_ROLE_SQL = "SET LOCAL ROLE research_cockpit_runtime";
const BEGIN_READ_ONLY_SQL = "BEGIN READ ONLY";
const COMMIT_SQL = "COMMIT";
const ROLLBACK_SQL = "ROLLBACK";
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

export type PostgresProjectionClient = Pick<Client, "query">;

export interface PostgresProjectionActorContext {
  readonly principalId: string;
  readonly organizationId: string;
}

export interface PostgresProjectionActorContextProvider {
  current(): PostgresProjectionActorContext;
}

/** A stable, value-free failure for the complete adapter boundary. */
export class PostgresProjectionAdapterError extends Error {
  public readonly code = "POSTGRES_PROJECTION_ADAPTER_FAILURE" as const;

  public constructor() {
    super("PostgreSQL projection adapter failed.");
    this.name = "PostgresProjectionAdapterError";
  }
}

/**
 * A non-owning, sequential adapter over one exclusively leased,
 * already-authenticated PostgreSQL client. The caller owns the client's
 * lifecycle but must not use it concurrently or retain an open transaction.
 * Each load resets transaction state before using one transaction-local role
 * and actor context and exposes no arbitrary SQL path.
 */
export class PostgresFinancialFactProjectionSource implements OperationScopedProjectionSource<FinancialFact> {
  readonly #client: PostgresProjectionClient;
  readonly #currentActorContext: () => PostgresProjectionActorContext;
  #state: "ready" | "busy" | "poisoned" = "ready";

  public constructor(
    client: PostgresProjectionClient,
    actorContextProvider: PostgresProjectionActorContextProvider,
  ) {
    let currentActorContext: () => PostgresProjectionActorContext;
    try {
      if (typeof client.query !== "function") invalid();
      const current: unknown = Reflect.get(actorContextProvider, "current");
      if (typeof current !== "function") invalid();
      currentActorContext = () => {
        const value: unknown = Reflect.apply(current, actorContextProvider, []);
        return value as PostgresProjectionActorContext;
      };
    } catch {
      invalid();
    }
    this.#client = client;
    this.#currentActorContext = currentActorContext;
  }

  public async load(
    queryValue: OperationProjectionQuery,
  ): Promise<OperationProjectionSourceResult<FinancialFact> | null> {
    if (this.#state !== "ready") invalid();
    this.#state = "busy";

    let rollbackRequired = false;
    let resetInProgress = false;
    try {
      const query = normalizePostgresFinancialFactProjectionQuery(queryValue);
      if (query.context.territory !== SYNTHETIC_TERRITORY) invalid();
      const actor = actorContext(this.#currentActorContext);
      const operationContext = postgresProjectionOperationContext(
        query.operation,
      );

      resetInProgress = true;
      await this.#client.query(ROLLBACK_SQL);
      resetInProgress = false;
      rollbackRequired = true;
      await this.#client.query(BEGIN_READ_ONLY_SQL);
      await this.#client.query(RUNTIME_ROLE_SQL);
      await this.#client.query({
        text: SET_REQUEST_CONTEXT_SQL,
        values: [
          actor.principalId,
          actor.organizationId,
          operationContext.purpose,
          operationContext.channel,
          query.context.territory,
          SYNTHETIC_CLASSIFICATION,
        ],
      });
      const result = await this.#client.query<
        [unknown],
        [string, string, string]
      >({
        text: renderPostgresFinancialFactProjectionQuery(query.operation),
        values: [
          query.scope.instrumentId,
          query.scope.publicKnownAt,
          query.scope.systemRecordedAt,
        ],
        rowMode: "array",
      });
      const rows = postgresProjectionRows(result);
      const normalized = normalizePostgresFinancialFactProjectionRows(
        query,
        rows,
      );
      await this.#client.query(COMMIT_SQL);
      rollbackRequired = false;
      this.#state = "ready";
      return normalized;
    } catch {
      let rollbackFailed = resetInProgress;
      if (rollbackRequired) {
        try {
          await this.#client.query(ROLLBACK_SQL);
        } catch {
          rollbackFailed = true;
        }
      }
      this.#state = rollbackFailed ? "poisoned" : "ready";
      invalid();
    } finally {
      if (this.#state === "busy") this.#state = "ready";
    }
    return invalid();
  }
}

function actorContext(
  current: () => PostgresProjectionActorContext,
): PostgresProjectionActorContext {
  let value: unknown;
  try {
    value = current();
  } catch {
    invalid();
  }
  const record = exactDataRecord(value, ["principalId", "organizationId"]);
  const principalId = uuid(record.principalId);
  const organizationId = uuid(record.organizationId);
  return { principalId, organizationId };
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
    invalid();
  }

  const field = fields[0];
  if (
    ownDataField(field, "name") !== "row_to_json" ||
    ownDataField(field, "dataTypeID") !== POSTGRES_TEXT_OID
  ) {
    invalid();
  }

  return rows.map((row) => {
    const columns = denseArray(row);
    if (columns.length !== 1 || typeof columns[0] !== "string") invalid();
    try {
      return JSON.parse(columns[0]) as unknown;
    } catch {
      invalid();
    }
  });
}

function exactDataRecord<const TKeys extends readonly string[]>(
  value: unknown,
  expectedKeys: TKeys,
): Readonly<Record<TKeys[number], unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid();
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    invalid();
  }
  const output: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    output[key] = ownDataField(value, key);
  }
  return output as Readonly<Record<TKeys[number], unknown>>;
}

function denseArray(value: unknown): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    invalid();
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor)) invalid();
  const length: unknown = lengthDescriptor.value;
  if (!Number.isSafeInteger(length) || (length as number) < 0) invalid();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== (length as number) + 1) invalid();
  const output: unknown[] = [];
  for (let index = 0; index < (length as number); index += 1) {
    output.push(ownDataField(value, String(index)));
  }
  return output;
}

function ownDataField(value: unknown, key: PropertyKey): unknown {
  if (
    (typeof value !== "object" && typeof value !== "function") ||
    value === null
  ) {
    invalid();
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
    invalid();
  }
  return descriptor.value;
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) invalid();
  return value;
}

function invalid(): never {
  throw new PostgresProjectionAdapterError();
}
