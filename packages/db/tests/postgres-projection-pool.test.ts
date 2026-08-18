import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";

import type { OperationProjectionQuery } from "@research-cockpit/research-core";
import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  PooledPostgresFinancialFactProjectionSource,
  PostgresProjectionPoolError,
  type PostgresProjectionPoolErrorCode,
} from "../src/postgres-projection-pool";

const PRINCIPAL_ALPHA = "20000000-0000-4000-8000-000000000001";
const PRINCIPAL_BETA = "20000000-0000-4000-8000-000000000002";
const ORGANIZATION_ALPHA = "10000000-0000-4000-8000-000000000001";
const LISTING_ID = "listing-syn1";
const NOW = "2026-08-18T12:00:00.000Z";
const APPLICATION_NAME = "research-cockpit-b10-pool";
const STATEMENT_TIMEOUT_MILLISECONDS = 2_000;

interface QueryInvocation {
  readonly text: string;
  readonly values?: readonly unknown[];
  readonly rowMode?: string;
  readonly name?: string;
}

function query(): OperationProjectionQuery {
  return {
    scope: {
      instrumentId: LISTING_ID,
      publicKnownAt: NOW,
      systemRecordedAt: NOW,
    },
    operation: "display_api",
    context: { territory: "demo_only", evaluatedAt: NOW },
  };
}

function row(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    row_id: "fact-full-v1",
    instrument_id: LISTING_ID,
    security_id: "security-syn1",
    concept_key: "synthetic_full_v1",
    value_numeric: "100.000000000000",
    value_scale: 2,
    unit_code: "USD_MILLIONS",
    currency_code: "USD",
    dimensions_json: "{}",
    period_start: "2024-01-01",
    period_end: "2024-12-31",
    known_from: "2025-01-01T00:00:01.000000Z",
    known_to: null,
    system_from: "2025-01-01T00:00:02.000000Z",
    system_to: null,
    available_at: "2025-01-01T00:00:00.000000Z",
    evidence_id: "evidence-full-v1",
    rights_policy_id: "synthetic.full",
    rights_policy_version: "1.0.0",
    quality_state: "verified_fixture",
    classification: "synthetic",
    policy_id: "synthetic.full",
    policy_version: "1.0.0",
    policy_classification: "synthetic",
    policy_territory: "demo_only",
    policy_expires_at: null,
    grant_policy_id: "synthetic.full",
    grant_policy_version: "1.0.0",
    grant_purpose: "display",
    grant_channel: "api",
    grant_allowed: true,
    ...overrides,
  };
}

function selectResult(rows: readonly unknown[]) {
  return {
    command: "SELECT",
    rowCount: rows.length,
    fields: [{ name: "row_to_json", dataTypeID: 25 }],
    rows: rows.map((value) => [JSON.stringify(value)]),
  };
}

function invocation(value: unknown): QueryInvocation {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof Reflect.get(value, "text") !== "string"
  ) {
    throw new Error("Expected a query invocation");
  }
  return value as QueryInvocation;
}

function isProjectionInvocation(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "text") === "string" &&
    (Reflect.get(value, "text") as string).startsWith(
      "WITH bounded_projection AS",
    )
  );
}

function fakeClient(
  run: (input: string | QueryInvocation) => unknown = (input) =>
    isProjectionInvocation(input) ? selectResult([row()]) : {},
  onRelease?: (destroy: boolean | Error | undefined) => void,
) {
  const queryMock = vi.fn(run);
  const releaseMock = vi.fn((destroy?: boolean | Error) => {
    onRelease?.(destroy);
  });
  return {
    client: {
      query: queryMock,
      release: releaseMock,
    } as unknown as PoolClient,
    queryMock,
    releaseMock,
  };
}

class FakePool extends EventEmitter {
  public readonly options: Record<string, unknown>;
  public readonly connect = vi.fn<() => Promise<PoolClient>>();
  public readonly end = vi.fn(() => Promise.resolve());

  public constructor(overrides: Readonly<Record<string, unknown>> = {}) {
    super();
    this.options = {
      max: 2,
      connectionTimeoutMillis: 250,
      statement_timeout: STATEMENT_TIMEOUT_MILLISECONDS,
      application_name: APPLICATION_NAME,
      ...overrides,
    };
  }

  public asPool(): Pool {
    return this as unknown as Pool;
  }
}

function provider() {
  const value = {
    actor: {
      principalId: PRINCIPAL_ALPHA,
      organizationId: ORGANIZATION_ALPHA,
    },
    current: vi.fn(),
  };
  value.current.mockImplementation(() => value.actor);
  return value;
}

async function capturePoolError(
  promise: Promise<unknown>,
  code: PostgresProjectionPoolErrorCode,
) {
  let error: unknown;
  try {
    await promise;
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(PostgresProjectionPoolError);
  expect(error).toMatchObject({
    code,
    message: "PostgreSQL projection pool failed.",
  });
  expect(error).not.toHaveProperty("cause");
  return error;
}

describe("bounded PostgreSQL financial-fact projection pool", () => {
  it("resets, restores, executes, cleans, and releases one healthy checkout", async () => {
    const pool = new FakePool();
    const { client, queryMock, releaseMock } = fakeClient();
    pool.connect.mockResolvedValue(client);
    const actorProvider = provider();
    const source = new PooledPostgresFinancialFactProjectionSource(
      pool.asPool(),
      actorProvider,
    );

    const result = await source.load(query());

    expect(result).toMatchObject({
      scope: query().scope,
      operation: "display_api",
      completeness: { state: "unknown", reason: "rls_filtered" },
    });
    expect(result?.candidates).toHaveLength(1);
    expect(actorProvider.current).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls.map(([input]) => input)).toMatchObject([
      "ROLLBACK",
      "DISCARD ALL",
      expect.objectContaining({
        values: [APPLICATION_NAME, `${STATEMENT_TIMEOUT_MILLISECONDS}ms`],
      }),
      "BEGIN READ ONLY",
      expect.objectContaining({
        values: [`${STATEMENT_TIMEOUT_MILLISECONDS}ms`],
      }),
      "SET LOCAL ROLE research_cockpit_runtime",
      expect.objectContaining({
        values: [
          PRINCIPAL_ALPHA,
          ORGANIZATION_ALPHA,
          "display",
          "api",
          "demo_only",
          "synthetic",
        ],
      }),
      expect.objectContaining({
        values: [LISTING_ID, NOW, NOW],
        rowMode: "array",
      }),
      "COMMIT",
      "ROLLBACK",
      "DISCARD ALL",
      expect.objectContaining({
        values: [APPLICATION_NAME, `${STATEMENT_TIMEOUT_MILLISECONDS}ms`],
      }),
    ]);
    expect(releaseMock).toHaveBeenCalledExactlyOnceWith();
    await source.close();
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it("snapshots the exact query and actor before awaiting checkout", async () => {
    let resolveCheckout!: (client: PoolClient) => void;
    const checkout = new Promise<PoolClient>((resolve) => {
      resolveCheckout = resolve;
    });
    const pool = new FakePool();
    const { client, queryMock } = fakeClient();
    pool.connect.mockReturnValue(checkout);
    const actorProvider = provider();
    const requested = query();
    const source = new PooledPostgresFinancialFactProjectionSource(
      pool.asPool(),
      actorProvider,
    );

    const loading = source.load(requested);
    requested.scope.instrumentId = "mutated-listing";
    requested.context.territory = "mutated-territory";
    actorProvider.actor.principalId = PRINCIPAL_BETA;
    resolveCheckout(client);
    await loading;

    const context = invocation(queryMock.mock.calls[6]?.[0]);
    const projection = invocation(queryMock.mock.calls[7]?.[0]);
    expect(context.values?.[0]).toBe(PRINCIPAL_ALPHA);
    expect(projection.values).toEqual([LISTING_ID, NOW, NOW]);
    await source.close();
  });

  it("supports simultaneous loads with independently captured actors", async () => {
    const pool = new FakePool();
    const first = fakeClient();
    const second = fakeClient();
    pool.connect
      .mockResolvedValueOnce(first.client)
      .mockResolvedValueOnce(second.client);
    const actorProvider = provider();
    const source = new PooledPostgresFinancialFactProjectionSource(
      pool.asPool(),
      actorProvider,
    );

    const alpha = source.load(query());
    actorProvider.actor = {
      principalId: PRINCIPAL_BETA,
      organizationId: ORGANIZATION_ALPHA,
    };
    const beta = source.load(query());
    await Promise.all([alpha, beta]);

    expect(invocation(first.queryMock.mock.calls[6]?.[0]).values?.[0]).toBe(
      PRINCIPAL_ALPHA,
    );
    expect(invocation(second.queryMock.mock.calls[6]?.[0]).values?.[0]).toBe(
      PRINCIPAL_BETA,
    );
    expect(first.releaseMock).toHaveBeenCalledExactlyOnceWith();
    expect(second.releaseMock).toHaveBeenCalledExactlyOnceWith();
    await source.close();
  });

  it("rejects malformed input and a pre-aborted signal before checkout", async () => {
    const pool = new FakePool();
    const actorProvider = provider();
    const source = new PooledPostgresFinancialFactProjectionSource(
      pool.asPool(),
      actorProvider,
    );
    const malformed = query();
    malformed.context.territory = "external";
    await capturePoolError(
      source.load(malformed),
      "POSTGRES_PROJECTION_POOL_FAILURE",
    );

    const controller = new AbortController();
    controller.abort();
    await capturePoolError(
      source.load(query(), { signal: controller.signal }),
      "POSTGRES_PROJECTION_POOL_ABORTED",
    );

    expect(pool.connect).not.toHaveBeenCalled();
    expect(actorProvider.current).toHaveBeenCalledOnce();
    await source.close();
  });

  it("destroys an actively aborted backend once and waits for query settlement", async () => {
    let rejectProjection!: (error: Error & { code?: string }) => void;
    let projectionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      projectionStarted = resolve;
    });
    const projection = new Promise<never>((_resolve, reject) => {
      rejectProjection = reject;
    });
    const pool = new FakePool();
    const { client, releaseMock } = fakeClient((input) => {
      if (isProjectionInvocation(input)) {
        projectionStarted();
        return projection;
      }
      return {};
    });
    pool.connect.mockResolvedValue(client);
    const source = new PooledPostgresFinancialFactProjectionSource(
      pool.asPool(),
      provider(),
    );
    const controller = new AbortController();

    const loading = source.load(query(), { signal: controller.signal });
    let settled = false;
    void loading.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await started;
    controller.abort();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(releaseMock).not.toHaveBeenCalled();
    rejectProjection(
      Object.assign(new Error("secret server statement timeout"), {
        code: "57014",
      }),
    );
    const error = await capturePoolError(
      loading,
      "POSTGRES_PROJECTION_POOL_ABORTED",
    );

    expect(String(error)).not.toContain("secret server statement timeout");
    expect(releaseMock).toHaveBeenCalledExactlyOnceWith(true);
    await source.close();
  });

  it("bypasses shadowed AbortSignal accessors and rejects forged signals stably", async () => {
    const pool = new FakePool();
    const { client } = fakeClient();
    pool.connect.mockResolvedValue(client);
    const source = new PooledPostgresFinancialFactProjectionSource(
      pool.asPool(),
      provider(),
    );
    const controller = new AbortController();
    const secret = "secret hostile AbortSignal trap";
    const shadowedAdd = vi.fn(() => {
      throw new Error(secret);
    });
    const shadowedRemove = vi.fn(() => {
      throw new Error(secret);
    });
    Object.defineProperties(controller.signal, {
      aborted: {
        configurable: true,
        get: () => {
          throw new Error(secret);
        },
      },
      addEventListener: {
        configurable: true,
        value: shadowedAdd,
      },
      removeEventListener: {
        configurable: true,
        value: shadowedRemove,
      },
    });

    await expect(
      source.load(query(), { signal: controller.signal }),
    ).resolves.toBeTruthy();
    expect(shadowedAdd).not.toHaveBeenCalled();
    expect(shadowedRemove).not.toHaveBeenCalled();

    const forgedSignal = Object.create(AbortSignal.prototype) as AbortSignal;
    Object.defineProperty(forgedSignal, "aborted", {
      configurable: true,
      get: () => {
        throw new Error(secret);
      },
    });
    const error = await capturePoolError(
      source.load(query(), { signal: forgedSignal }),
      "POSTGRES_PROJECTION_POOL_FAILURE",
    );
    expect(String(error)).not.toContain(secret);
    expect(pool.connect).toHaveBeenCalledOnce();
    await source.close();
  });

  it("does not orphan an acquisition when abort is requested in the pool queue", async () => {
    let resolveCheckout!: (client: PoolClient) => void;
    const checkout = new Promise<PoolClient>((resolve) => {
      resolveCheckout = resolve;
    });
    const pool = new FakePool();
    const { client, queryMock, releaseMock } = fakeClient();
    pool.connect.mockReturnValue(checkout);
    const source = new PooledPostgresFinancialFactProjectionSource(
      pool.asPool(),
      provider(),
    );
    const controller = new AbortController();
    let settled = false;

    const loading = source
      .load(query(), { signal: controller.signal })
      .finally(() => {
        settled = true;
      });
    controller.abort();
    await Promise.resolve();
    expect(settled).toBe(false);
    resolveCheckout(client);
    await capturePoolError(loading, "POSTGRES_PROJECTION_POOL_ABORTED");

    expect(queryMock).not.toHaveBeenCalled();
    expect(releaseMock).toHaveBeenCalledExactlyOnceWith(true);
    await source.close();
  });

  it("maps a server timeout to a stable timeout and destroys the transaction", async () => {
    const pool = new FakePool();
    const secret = "locked tenant row";
    const { client, releaseMock } = fakeClient((input) => {
      if (isProjectionInvocation(input)) {
        throw Object.assign(new Error(secret), { code: "57014" });
      }
      return {};
    });
    pool.connect.mockResolvedValue(client);
    const source = new PooledPostgresFinancialFactProjectionSource(
      pool.asPool(),
      provider(),
    );

    const error = await capturePoolError(
      source.load(query()),
      "POSTGRES_PROJECTION_POOL_TIMEOUT",
    );

    expect(String(error)).not.toContain(secret);
    expect(releaseMock).toHaveBeenCalledExactlyOnceWith(true);
    await source.close();
  });

  it.each([
    "timeout exceeded when trying to connect",
    "Connection terminated due to connection timeout",
  ])(
    "maps the pinned checkout timeout without a client leak: %s",
    async (message) => {
      const pool = new FakePool();
      pool.connect.mockRejectedValue(new Error(message));
      const source = new PooledPostgresFinancialFactProjectionSource(
        pool.asPool(),
        provider(),
      );

      await capturePoolError(
        source.load(query()),
        "POSTGRES_PROJECTION_POOL_TIMEOUT",
      );
      await source.close();
    },
  );

  it("destroys a client when postflight cleanup is ambiguous", async () => {
    let calls = 0;
    const pool = new FakePool();
    const { client, releaseMock } = fakeClient((input) => {
      const current = calls++;
      if (current === 11) throw new Error("secret cleanup failure");
      return isProjectionInvocation(input) ? selectResult([row()]) : {};
    });
    pool.connect.mockResolvedValue(client);
    const source = new PooledPostgresFinancialFactProjectionSource(
      pool.asPool(),
      provider(),
    );

    await capturePoolError(
      source.load(query()),
      "POSTGRES_PROJECTION_POOL_FAILURE",
    );

    expect(releaseMock).toHaveBeenCalledExactlyOnceWith(true);
    await source.close();
  });

  it("waits for active loads, rejects new work, and ends the owned pool once", async () => {
    let resolveProjection!: (value: ReturnType<typeof selectResult>) => void;
    let projectionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      projectionStarted = resolve;
    });
    const projection = new Promise<ReturnType<typeof selectResult>>(
      (resolve) => {
        resolveProjection = resolve;
      },
    );
    const pool = new FakePool();
    const { client } = fakeClient((input) => {
      if (isProjectionInvocation(input)) {
        projectionStarted();
        return projection;
      }
      return {};
    });
    pool.connect.mockResolvedValue(client);
    const source = new PooledPostgresFinancialFactProjectionSource(
      pool.asPool(),
      provider(),
    );

    const loading = source.load(query());
    await started;
    const closing = source.close();
    expect(source.close()).toBe(closing);
    expect(pool.end).not.toHaveBeenCalled();
    await capturePoolError(
      source.load(query()),
      "POSTGRES_PROJECTION_POOL_FAILURE",
    );
    resolveProjection(selectResult([row()]));
    await loading;
    await closing;

    expect(pool.connect).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
    expect(pool.listenerCount("error")).toBe(0);
  });

  it("fails closed after an idle pool error while still allowing shutdown", async () => {
    const pool = new FakePool();
    const { client } = fakeClient();
    pool.connect.mockResolvedValue(client);
    const source = new PooledPostgresFinancialFactProjectionSource(
      pool.asPool(),
      provider(),
    );
    expect(pool.listenerCount("error")).toBe(1);

    pool.emit("error", new Error("secret idle error"), client);
    await capturePoolError(
      source.load(query()),
      "POSTGRES_PROJECTION_POOL_FAILURE",
    );
    expect(pool.connect).not.toHaveBeenCalled();
    await source.close();
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it.each([
    ["pool size", { max: 3 }],
    ["zero checkout timeout", { connectionTimeoutMillis: 0 }],
    ["unbounded checkout timeout", { connectionTimeoutMillis: 30_001 }],
    ["zero server timeout", { statement_timeout: 0 }],
    ["unbounded server timeout", { statement_timeout: 60_001 }],
    ["timeout ordering", { statement_timeout: 250 }],
    ["client callback timeout", { query_timeout: 50 }],
    ["missing application name", { application_name: undefined }],
    ["unsafe application name", { application_name: "unsafe name" }],
  ])("rejects an invalid %s configuration", (_label, override) => {
    const pool = new FakePool(override);
    expect(
      () =>
        new PooledPostgresFinancialFactProjectionSource(
          pool.asPool(),
          provider(),
        ),
    ).toThrowError(
      expect.objectContaining({
        code: "POSTGRES_PROJECTION_POOL_FAILURE",
        message: "PostgreSQL projection pool failed.",
      }),
    );
    expect(pool.listenerCount("error")).toBe(0);
  });

  it("rejects a pre-existing listener that could throw during release", () => {
    const pool = new FakePool();
    pool.on("release", () => {
      throw new Error("must never run");
    });

    expect(
      () =>
        new PooledPostgresFinancialFactProjectionSource(
          pool.asPool(),
          provider(),
        ),
    ).toThrowError(
      expect.objectContaining({ code: "POSTGRES_PROJECTION_POOL_FAILURE" }),
    );
    expect(pool.listenerCount("error")).toBe(0);
  });

  it("keeps the implementation free of unsafe callback timeout and cancel internals", async () => {
    const source = await readFile(
      new URL("../src/postgres-projection-pool.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("Promise.race");
    expect(source).not.toContain("activeQuery");
    expect(source).not.toMatch(/\.cancel\s*\(/);
    expect(source).not.toContain("connection.stream");
    expect(source).toContain("client.release(true)");
    expect(source).toContain("checkedOutClient.query(DISCARD_ALL_SQL)");
  });
});
