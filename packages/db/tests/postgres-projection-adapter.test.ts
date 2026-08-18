import { readFile } from "node:fs/promises";

import type { OperationProjectionQuery } from "@research-cockpit/research-core";
import { describe, expect, it, vi } from "vitest";

import {
  PostgresFinancialFactProjectionSource,
  type PostgresProjectionActorContext,
  type PostgresProjectionActorContextProvider,
  PostgresProjectionAdapterError,
  type PostgresProjectionClient,
} from "../src/postgres-projection-adapter";

const PRINCIPAL_ALPHA = "20000000-0000-4000-8000-000000000001";
const PRINCIPAL_BETA = "20000000-0000-4000-8000-000000000002";
const ORGANIZATION_ALPHA = "10000000-0000-4000-8000-000000000001";
const LISTING_ID = "listing-syn1";
const NOW = "2026-08-17T12:00:00.000Z";
const OPERATION_GRANT = {
  display_api: ["display", "api"],
  derive_api: ["derive", "api"],
  alert_local_alert: ["alert", "local_alert"],
} as const;

interface QueryInvocation {
  readonly text: string;
  readonly values?: readonly unknown[];
  readonly rowMode?: string;
  readonly name?: string;
}

function query(
  operation: OperationProjectionQuery["operation"] = "display_api",
): OperationProjectionQuery {
  return {
    scope: {
      instrumentId: LISTING_ID,
      publicKnownAt: NOW,
      systemRecordedAt: NOW,
    },
    operation,
    context: { territory: "demo_only", evaluatedAt: NOW },
  };
}

function row(
  operation: OperationProjectionQuery["operation"] = "display_api",
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const grant = OPERATION_GRANT[operation];
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
    grant_purpose: grant[0],
    grant_channel: grant[1],
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

function fakeClient(run: (invocation: string | QueryInvocation) => unknown) {
  const queryMock = vi.fn(run);
  return {
    client: { query: queryMock } as unknown as PostgresProjectionClient,
    queryMock,
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

function actorProvider(
  actor: PostgresProjectionActorContext = {
    principalId: PRINCIPAL_ALPHA,
    organizationId: ORGANIZATION_ALPHA,
  },
) {
  return { current: vi.fn(() => actor) };
}

async function captureAdapterError(run: () => Promise<unknown>) {
  let error: unknown;
  try {
    await run();
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(PostgresProjectionAdapterError);
  expect(error).toMatchObject({
    code: "POSTGRES_PROJECTION_ADAPTER_FAILURE",
    message: "PostgreSQL projection adapter failed.",
  });
  expect(error).not.toHaveProperty("cause");
  return error;
}

describe("single-client PostgreSQL financial-fact projection adapter", () => {
  it.each([
    ["display_api", "display", "api"],
    ["derive_api", "derive", "api"],
    ["alert_local_alert", "alert", "local_alert"],
  ] as const)(
    "resets caller transaction state before one exact read-only %s transaction",
    async (operation, purpose, channel) => {
      const requested = query(operation);
      let callerTransactionOpen = true;
      let callerTransactionCommitted = false;
      const { client, queryMock } = fakeClient((input) => {
        if (input === "ROLLBACK") {
          callerTransactionOpen = false;
          return {};
        }
        if (input === "COMMIT" && callerTransactionOpen) {
          callerTransactionCommitted = true;
        }
        if (typeof input === "object" && input.rowMode === "array") {
          return selectResult([row(operation)]);
        }
        return {};
      });
      const provider = actorProvider();
      const source = new PostgresFinancialFactProjectionSource(
        client,
        provider,
      );

      const result = await source.load(requested);

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        scope: requested.scope,
        operation,
        completeness: { state: "unknown", reason: "rls_filtered" },
      });
      expect(result?.candidates).toHaveLength(1);
      expect(provider.current).toHaveBeenCalledTimes(1);
      expect(callerTransactionOpen).toBe(false);
      expect(callerTransactionCommitted).toBe(false);
      expect(queryMock).toHaveBeenCalledTimes(6);
      expect(queryMock.mock.calls[0]?.[0]).toBe("ROLLBACK");
      expect(queryMock.mock.calls[1]?.[0]).toBe("BEGIN READ ONLY");
      expect(queryMock.mock.calls[2]?.[0]).toBe(
        "SET LOCAL ROLE research_cockpit_runtime",
      );
      const context = invocation(queryMock.mock.calls[3]?.[0]);
      expect(context.text).toContain("CALL private_data.set_request_context(");
      expect(context.values).toEqual([
        PRINCIPAL_ALPHA,
        ORGANIZATION_ALPHA,
        purpose,
        channel,
        "demo_only",
        "synthetic",
      ]);
      const projection = invocation(queryMock.mock.calls[4]?.[0]);
      expect(projection).toMatchObject({
        values: [LISTING_ID, NOW, NOW],
        rowMode: "array",
      });
      expect(projection).not.toHaveProperty("name");
      expect(projection.text).toContain("LIMIT 101");
      expect(projection.text).toContain(
        `operation_grant.purpose = '${purpose}'`,
      );
      expect(queryMock.mock.calls[5]?.[0]).toBe("COMMIT");
    },
  );

  it("returns a conservative non-null empty result", async () => {
    const { client } = fakeClient((input) =>
      typeof input === "object" && input.rowMode === "array"
        ? selectResult([])
        : {},
    );
    const source = new PostgresFinancialFactProjectionSource(
      client,
      actorProvider(),
    );

    await expect(source.load(query())).resolves.toMatchObject({
      candidates: [],
      policies: [],
      completeness: { state: "unknown", reason: "rls_filtered" },
    });
  });

  it("binds the provider method but snapshots its current actor once per load", async () => {
    const provider = {
      actor: {
        principalId: PRINCIPAL_ALPHA,
        organizationId: ORGANIZATION_ALPHA,
      },
      calls: 0,
      current() {
        this.calls += 1;
        return this.actor;
      },
    };
    const { client, queryMock } = fakeClient((input) =>
      typeof input === "object" && input.rowMode === "array"
        ? selectResult([row()])
        : {},
    );
    const source = new PostgresFinancialFactProjectionSource(client, provider);
    provider.current = () => {
      throw new Error("replacement provider must not run");
    };

    await source.load(query());
    provider.actor = {
      principalId: PRINCIPAL_BETA,
      organizationId: ORGANIZATION_ALPHA,
    };
    await source.load(query());

    expect(provider.calls).toBe(2);
    expect(invocation(queryMock.mock.calls[3]?.[0]).values?.[0]).toBe(
      PRINCIPAL_ALPHA,
    );
    expect(invocation(queryMock.mock.calls[9]?.[0]).values?.[0]).toBe(
      PRINCIPAL_BETA,
    );
  });

  it("reads an actor-provider method accessor once at construction", async () => {
    let reads = 0;
    const provider = Object.defineProperty({}, "current", {
      get() {
        reads += 1;
        return () => ({
          principalId: PRINCIPAL_ALPHA,
          organizationId: ORGANIZATION_ALPHA,
        });
      },
    });
    const { client } = fakeClient((input) =>
      typeof input === "object" && input.rowMode === "array"
        ? selectResult([row()])
        : {},
    );
    const source = new PostgresFinancialFactProjectionSource(
      client,
      provider as PostgresProjectionActorContextProvider,
    );

    await source.load(query());
    expect(reads).toBe(1);
  });

  it("snapshots query and actor values before its first await", async () => {
    let releaseBegin!: () => void;
    const begin = new Promise<void>((resolve) => {
      releaseBegin = resolve;
    });
    const requested = query();
    const actor = {
      principalId: PRINCIPAL_ALPHA,
      organizationId: ORGANIZATION_ALPHA,
    };
    const { client, queryMock } = fakeClient((input) => {
      if (input === "BEGIN READ ONLY") return begin;
      if (typeof input === "object" && input.rowMode === "array") {
        return selectResult([row()]);
      }
      return {};
    });
    const source = new PostgresFinancialFactProjectionSource(client, {
      current: () => actor,
    });

    const loading = source.load(requested);
    requested.scope.instrumentId = "mutated-listing";
    requested.context.territory = "mutated-territory";
    actor.principalId = PRINCIPAL_BETA;
    releaseBegin();
    await loading;

    expect(invocation(queryMock.mock.calls[3]?.[0]).values?.[0]).toBe(
      PRINCIPAL_ALPHA,
    );
    expect(invocation(queryMock.mock.calls[4]?.[0]).values).toEqual([
      LISTING_ID,
      NOW,
      NOW,
    ]);
  });

  it("rejects an overlapping load without interleaving client calls", async () => {
    let releaseBegin!: () => void;
    const begin = new Promise<void>((resolve) => {
      releaseBegin = resolve;
    });
    const { client, queryMock } = fakeClient((input) => {
      if (input === "BEGIN READ ONLY") return begin;
      if (typeof input === "object" && input.rowMode === "array") {
        return selectResult([row()]);
      }
      return {};
    });
    const source = new PostgresFinancialFactProjectionSource(
      client,
      actorProvider(),
    );

    const first = source.load(query());
    await captureAdapterError(() => source.load(query("derive_api")));
    expect(queryMock).toHaveBeenCalledTimes(2);
    releaseBegin();
    await first;
    await source.load(query());
    expect(queryMock).toHaveBeenCalledTimes(12);
  });

  it("rolls back a rejected BEGIN before permitting later sequential use", async () => {
    let beginCalls = 0;
    const { client, queryMock } = fakeClient((input) => {
      if (input === "BEGIN READ ONLY" && beginCalls++ === 0) {
        throw new Error("secret-begin-detail");
      }
      if (typeof input === "object" && input.rowMode === "array") {
        return selectResult([row()]);
      }
      return {};
    });
    const source = new PostgresFinancialFactProjectionSource(
      client,
      actorProvider(),
    );

    const error = await captureAdapterError(() => source.load(query()));
    expect(JSON.stringify(error)).not.toContain("secret-begin-detail");
    expect(queryMock.mock.calls.map(([input]) => input)).toEqual([
      "ROLLBACK",
      "BEGIN READ ONLY",
      "ROLLBACK",
    ]);
    await expect(source.load(query())).resolves.not.toBeNull();
    expect(queryMock.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });

  it.each([
    ["role selection", 2],
    ["context setup", 3],
    ["commit", 5],
  ] as const)(
    "rolls back exactly once after a %s failure",
    async (_label, failingCall) => {
      let call = 0;
      const { client, queryMock } = fakeClient((input) => {
        const currentCall = call++;
        if (currentCall === failingCall) throw new Error("secret-driver-value");
        if (typeof input === "object" && input.rowMode === "array") {
          return selectResult([row()]);
        }
        return {};
      });
      const source = new PostgresFinancialFactProjectionSource(
        client,
        actorProvider(),
      );

      await captureAdapterError(() => source.load(query()));

      const statements = queryMock.mock.calls.map(([input]) =>
        typeof input === "string" ? input : invocation(input).text,
      );
      expect(statements.filter((value) => value === "ROLLBACK")).toHaveLength(
        2,
      );
      expect(statements[0]).toBe("ROLLBACK");
      expect(statements.at(-1)).toBe("ROLLBACK");
      expect(statements.filter((value) => value === "COMMIT")).toHaveLength(
        failingCall === 5 ? 1 : 0,
      );
    },
  );

  it("rolls back an in-transaction failure and permits later sequential use", async () => {
    let selectCalls = 0;
    const { client, queryMock } = fakeClient((input) => {
      if (typeof input === "object" && input.rowMode === "array") {
        if (selectCalls++ === 0) throw new Error("secret-select-detail");
        return selectResult([row()]);
      }
      return {};
    });
    const source = new PostgresFinancialFactProjectionSource(
      client,
      actorProvider(),
    );

    const error = await captureAdapterError(() => source.load(query()));
    expect(String(error)).not.toContain("secret-select-detail");
    expect(queryMock.mock.calls[5]?.[0]).toBe("ROLLBACK");
    await expect(source.load(query())).resolves.not.toBeNull();
    expect(queryMock.mock.calls[11]?.[0]).toBe("COMMIT");
  });

  it("poisons the adapter when rollback fails", async () => {
    let rollbackCalls = 0;
    const { client, queryMock } = fakeClient((input) => {
      if (typeof input === "object" && input.rowMode === "array") {
        throw new Error("select failed");
      }
      if (input === "ROLLBACK" && rollbackCalls++ > 0) {
        throw new Error("rollback failed");
      }
      return {};
    });
    const source = new PostgresFinancialFactProjectionSource(
      client,
      actorProvider(),
    );

    await captureAdapterError(() => source.load(query()));
    expect(queryMock).toHaveBeenCalledTimes(6);
    await captureAdapterError(() => source.load(query()));
    expect(queryMock).toHaveBeenCalledTimes(6);
  });

  it.each([
    ["object row", { ...selectResult([]), rowCount: 1, rows: [{}] }],
    [
      "extra column",
      {
        ...selectResult([]),
        rowCount: 1,
        rows: [[JSON.stringify(row()), "extra"]],
      },
    ],
    [
      "invalid JSON",
      { ...selectResult([]), rowCount: 1, rows: [["not-json"]] },
    ],
    [
      "wrong field",
      {
        ...selectResult([row()]),
        fields: [{ name: "projection", dataTypeID: 25 }],
      },
    ],
    [
      "sparse rows",
      {
        ...selectResult([]),
        rowCount: 1,
        rows: new Array<unknown>(1),
      },
    ],
    ["oversized", selectResult(Array.from({ length: 101 }, () => row()))],
    [
      "invalid semantic row",
      selectResult([row("display_api", { unit_code: "USD" })]),
    ],
  ])("rejects the complete %s batch and rolls back", async (_label, result) => {
    const { client, queryMock } = fakeClient((input) =>
      typeof input === "object" && input.rowMode === "array" ? result : {},
    );
    const source = new PostgresFinancialFactProjectionSource(
      client,
      actorProvider(),
    );

    await captureAdapterError(() => source.load(query()));
    expect(queryMock.mock.calls[5]?.[0]).toBe("ROLLBACK");
    expect(queryMock.mock.calls.flat()).not.toContain("COMMIT");
  });

  it("fails a malformed query with a valid actor before entering a transaction", async () => {
    const { client, queryMock } = fakeClient(() => ({}));
    const source = new PostgresFinancialFactProjectionSource(
      client,
      actorProvider(),
    );
    const malformed = {
      ...query(),
      context: { ...query().context, territory: "external" },
    };

    await captureAdapterError(() => source.load(malformed));
    expect(queryMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "extra key",
      {
        principalId: PRINCIPAL_ALPHA,
        organizationId: ORGANIZATION_ALPHA,
        extra: true,
      },
    ],
    [
      "wrong prototype",
      Object.create({
        principalId: PRINCIPAL_ALPHA,
        organizationId: ORGANIZATION_ALPHA,
      }) as PostgresProjectionActorContext,
    ],
    [
      "getter",
      Object.defineProperties(
        {},
        {
          principalId: {
            enumerable: true,
            get: () => PRINCIPAL_ALPHA,
          },
          organizationId: {
            enumerable: true,
            value: ORGANIZATION_ALPHA,
          },
        },
      ) as PostgresProjectionActorContext,
    ],
  ])("rejects an actor snapshot with an %s", async (_label, actor) => {
    const { client, queryMock } = fakeClient(() => ({}));
    const source = new PostgresFinancialFactProjectionSource(client, {
      current: () => actor,
    });

    await captureAdapterError(() => source.load(query()));
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("maps a provider failure to the value-free error before SQL", async () => {
    const { client, queryMock } = fakeClient(() => ({}));
    const source = new PostgresFinancialFactProjectionSource(client, {
      current: () => {
        throw new Error("secret-provider-value");
      },
    });

    const error = await captureAdapterError(() => source.load(query()));
    expect(String(error)).not.toContain("secret-provider-value");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("keeps SQL-looking listing text only in the bound value", async () => {
    const hostileListing = "listing-syn1' OR true; SELECT pg_sleep(9); --";
    const requested = query();
    requested.scope.instrumentId = hostileListing;
    const { client, queryMock } = fakeClient((input) =>
      typeof input === "object" && input.rowMode === "array"
        ? selectResult([row("display_api", { instrument_id: hostileListing })])
        : {},
    );
    const source = new PostgresFinancialFactProjectionSource(
      client,
      actorProvider(),
    );

    await source.load(requested);

    const projection = invocation(queryMock.mock.calls[4]?.[0]);
    expect(projection.values?.[0]).toBe(hostileListing);
    expect(projection.text).not.toContain(hostileListing);
  });

  it("keeps the source free of wider client and composition behavior", async () => {
    const source = await readFile(
      new URL("../src/postgres-projection-adapter.ts", import.meta.url),
      "utf8",
    );

    for (const forbidden of [
      /\bPool\b/,
      /process\.env/,
      /DATABASE_URL/,
      /\bconnect\b/,
      /\bend\b/,
      /connectionString/,
      /\blog\b/,
      /\bretry\b/,
      /\btimeout\b/,
      /\bcancel\b/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });
});
