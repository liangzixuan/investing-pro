import { describe, expect, it } from "vitest";

import type {
  OperationProjectionQuery,
  ProjectionOperation,
} from "../../../modules/research-core/src/index";

import {
  MAX_POSTGRES_PROJECTION_ROWS,
  normalizePostgresFinancialFactProjectionRows,
  parsePostgresFinancialFactProjectionRows,
  postgresProjectionOperationContext,
  PostgresProjectionQueryError,
  renderPostgresFinancialFactProjectionQuery,
} from "../src/postgres-projection-query";
import { PostgresProjectionNormalizationError } from "../src/projection-normalization";

const NOW = "2026-08-17T12:00:00.000Z";
const LISTING_ID = "listing-syn1";

const QUERY: OperationProjectionQuery = {
  scope: {
    instrumentId: LISTING_ID,
    publicKnownAt: NOW,
    systemRecordedAt: NOW,
  },
  operation: "display_api",
  context: {
    territory: "demo_only",
    evaluatedAt: NOW,
  },
};

const A2_ROW_KEYS = [
  "row_id",
  "instrument_id",
  "security_id",
  "concept_key",
  "value_numeric",
  "value_scale",
  "unit_code",
  "currency_code",
  "dimensions_json",
  "period_start",
  "period_end",
  "known_from",
  "known_to",
  "system_from",
  "system_to",
  "available_at",
  "evidence_id",
  "rights_policy_id",
  "rights_policy_version",
  "quality_state",
  "classification",
  "policy_id",
  "policy_version",
  "policy_classification",
  "policy_territory",
  "policy_expires_at",
  "grant_policy_id",
  "grant_policy_version",
  "grant_purpose",
  "grant_channel",
  "grant_allowed",
] as const;

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

function projectionSelectAliases(sql: string): string[] {
  const startMarker = "  SELECT\n";
  const endMarker = "\n  FROM shared_data.listings AS listing";
  const start = sql.indexOf(startMarker);
  const end = sql.indexOf(endMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const selectList = sql.slice(start + startMarker.length, end);
  return [...selectList.matchAll(/\sAS ([a-z_]+)(?:,|\n|$)/g)].map(
    (match) => match[1] ?? "",
  );
}

function expectNormalizationFailure(run: () => unknown) {
  let error: unknown;
  try {
    run();
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(PostgresProjectionNormalizationError);
  expect(error).toMatchObject({
    code: "INVALID_POSTGRES_PROJECTION_ROWS",
    name: "PostgresProjectionNormalizationError",
  });
  expect(error).not.toHaveProperty("row");
  expect(error).not.toHaveProperty("rows");
  expect(error).not.toHaveProperty("value");
}

describe("driverless PostgreSQL projection query contract", () => {
  it("uses only three typed positional SQL inputs", () => {
    const sql = renderPostgresFinancialFactProjectionQuery("display_api");
    const parameters = [...sql.matchAll(/\$(\d+)/g)].map((match) => match[1]);

    expect(new Set(parameters)).toEqual(new Set(["1", "2", "3"]));
    expect(sql).toContain("listing.id = $1::text");
    expect(sql).toContain("listing.effective_from <= $2::timestamptz");
    expect(sql).toContain("listing.system_from <= $3::timestamptz");
    expect(sql).not.toContain("$4");
  });

  it.each([
    ["display_api", "display", "api"],
    ["derive_api", "derive", "api"],
    ["alert_local_alert", "alert", "local_alert"],
  ] as const)(
    "maps %s to exactly one closed purpose/channel pair",
    (operation, purpose, channel) => {
      const sql = renderPostgresFinancialFactProjectionQuery(operation);

      expect(postgresProjectionOperationContext(operation)).toEqual({
        purpose,
        channel,
      });
      expect(
        Object.isFrozen(postgresProjectionOperationContext(operation)),
      ).toBe(true);
      expect(sql).toContain(`operation_grant.purpose = '${purpose}'`);
      expect(sql).toContain(`operation_grant.channel = '${channel}'`);
      expect(sql).not.toContain(operation);
    },
  );

  it("rejects an unsupported runtime operation without rendering it", () => {
    const render = renderPostgresFinancialFactProjectionQuery as (
      operation: string,
    ) => string;
    const hostile = "display_api'; DROP TABLE shared_data.financial_facts; --";

    expect(() => render(hostile)).toThrowError(PostgresProjectionQueryError);
    try {
      render(hostile);
    } catch (error) {
      expect(error).toMatchObject({
        code: "INVALID_POSTGRES_PROJECTION_QUERY",
      });
      expect(String(error)).not.toContain(hostile);
    }
  });

  it("uses explicit identity, evidence, policy, and grant joins", () => {
    const sql = renderPostgresFinancialFactProjectionQuery("display_api");

    expect(sql).toContain(
      "JOIN shared_data.share_classes AS share_class\n    ON share_class.id = listing.share_class_id",
    );
    expect(sql).toContain(
      "JOIN shared_data.securities AS security\n    ON security.id = share_class.security_id",
    );
    expect(sql).toContain(
      "JOIN shared_data.financial_facts AS fact\n    ON fact.security_id = security.id",
    );
    expect(sql).toContain(
      "JOIN shared_data.evidence AS evidence\n    ON evidence.id = fact.evidence_id",
    );
    expect(sql).toContain("evidence.rights_policy_id = fact.rights_policy_id");
    expect(sql).toContain(
      "evidence.rights_policy_version = fact.rights_policy_version",
    );
    expect(sql).toContain("policy.policy_id = fact.rights_policy_id");
    expect(sql).toContain(
      "operation_grant.policy_version = policy.policy_version",
    );
    expect(sql).toContain("operation_grant.allowed");
  });

  it("filters listing, fact, and evidence time with half-open predicates", () => {
    const sql = renderPostgresFinancialFactProjectionQuery("display_api");

    for (const predicate of [
      "listing.effective_from <= $2::timestamptz",
      "$2::timestamptz < listing.effective_to",
      "listing.system_from <= $3::timestamptz",
      "$3::timestamptz < listing.system_to",
      "fact.known_from <= $2::timestamptz",
      "$2::timestamptz < fact.known_to",
      "fact.system_from <= $3::timestamptz",
      "$3::timestamptz < fact.system_to",
      "fact.available_at <= $2::timestamptz",
      "evidence.known_from <= $2::timestamptz",
      "$2::timestamptz < evidence.known_to",
      "evidence.available_at <= $2::timestamptz",
    ]) {
      expect(sql).toContain(predicate);
    }
  });

  it("emits the exact a2 aliases with deterministic text encodings", () => {
    const sql = renderPostgresFinancialFactProjectionQuery("display_api");

    expect(projectionSelectAliases(sql)).toEqual(A2_ROW_KEYS);
    expect(sql).toContain("fact.value_numeric::text AS value_numeric");
    expect(sql).toContain("fact.value_scale::integer AS value_scale");
    expect(sql).toContain("fact.dimensions::text AS dimensions_json");
    expect(sql).toContain("AT TIME ZONE 'UTC'");
    expect(sql).toContain(`'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`);
    expect(sql).toContain("pg_catalog.row_to_json(projection_row)::text");
    expect(sql).not.toMatch(/SELECT\s+\*/i);
    expect(sql).not.toMatch(/\bcount\s*\(/i);
    expect(sql).not.toMatch(/completeness|denied_id|row_decision/i);
  });

  it("orders deterministically and requests one overflow sentinel row", () => {
    const sql = renderPostgresFinancialFactProjectionQuery("display_api");

    expect(MAX_POSTGRES_PROJECTION_ROWS).toBe(100);
    expect(sql).toContain('ORDER BY fact.id COLLATE "C"');
    expect(sql).toContain("LIMIT 101");
    expect(sql).toContain('ORDER BY projection_row.row_id COLLATE "C"');
  });
});

describe("driverless PostgreSQL projection result boundary", () => {
  it("parses empty and JSON-lines psql output without coercion", () => {
    expect(parsePostgresFinancialFactProjectionRows("")).toEqual([]);

    const first = row();
    const second = row({
      row_id: "fact-display-only",
      concept_key: "synthetic_display_only",
    });
    const stdout = `${JSON.stringify(first)}\r\n${JSON.stringify(second)}\r\n`;

    expect(parsePostgresFinancialFactProjectionRows(stdout)).toEqual([
      first,
      second,
    ]);
  });

  it("rejects malformed or unexpectedly long psql output with no values", () => {
    expectNormalizationFailure(() =>
      parsePostgresFinancialFactProjectionRows("not-json\n"),
    );
    expectNormalizationFailure(() =>
      parsePostgresFinancialFactProjectionRows(
        Array.from({ length: 102 }, () => "not-json").join("\n"),
      ),
    );
  });

  it("accepts exactly 100 valid rows and normalizes them", () => {
    const rows = Array.from({ length: MAX_POSTGRES_PROJECTION_ROWS }, (_, i) =>
      row({
        row_id: `fact-${i.toString().padStart(3, "0")}`,
        concept_key: `synthetic_concept_${i}`,
      }),
    );

    const normalized = normalizePostgresFinancialFactProjectionRows(
      QUERY,
      rows,
    );
    expect(normalized.candidates).toHaveLength(MAX_POSTGRES_PROJECTION_ROWS);
    expect(normalized.completeness).toEqual({
      state: "unknown",
      reason: "rls_filtered",
    });
  });

  it("rejects row 101 before inspecting any row", () => {
    let inspected = false;
    const hostileRow = Object.defineProperty({}, "row_id", {
      enumerable: true,
      get: () => {
        inspected = true;
        throw new Error("must not inspect overflow rows");
      },
    });
    const rows = Array.from(
      { length: MAX_POSTGRES_PROJECTION_ROWS + 1 },
      () => hostileRow,
    );

    expectNormalizationFailure(() =>
      normalizePostgresFinancialFactProjectionRows(QUERY, rows),
    );
    expect(inspected).toBe(false);
  });

  it("parses exactly 101 JSON rows, then rejects before row inspection", () => {
    const stdout = Array.from(
      { length: MAX_POSTGRES_PROJECTION_ROWS + 1 },
      (_, i) =>
        JSON.stringify(
          row({
            row_id: `fact-${i.toString().padStart(3, "0")}`,
            concept_key: `synthetic_concept_${i}`,
          }),
        ),
    ).join("\n");
    const parsed = parsePostgresFinancialFactProjectionRows(stdout);
    expect(parsed).toHaveLength(MAX_POSTGRES_PROJECTION_ROWS + 1);

    let inspected = false;
    const first = parsed[0];
    if (typeof first !== "object" || first === null) {
      throw new Error("expected parsed object row");
    }
    Object.defineProperty(first, "row_id", {
      enumerable: true,
      get: () => {
        inspected = true;
        throw new Error("must not inspect overflow rows");
      },
    });

    expectNormalizationFailure(() =>
      normalizePostgresFinancialFactProjectionRows(QUERY, parsed),
    );
    expect(inspected).toBe(false);
  });

  it.each([
    ["USD_MILLIONS", "USD"],
    ["USD_PER_SHARE", "USD"],
    ["MILLIONS_SHARES", null],
    ["PERCENT", null],
    ["RATIO", null],
  ] as const)("accepts the closed pair %s / %s", (unitCode, currencyCode) => {
    const normalized = normalizePostgresFinancialFactProjectionRows(QUERY, [
      row({ unit_code: unitCode, currency_code: currencyCode }),
    ]);

    expect(normalized.candidates[0]?.value.unit).toBe(unitCode);
  });

  it.each([
    ["USD", "USD"],
    ["usd_millions", "USD"],
    ["USD_MILLIONS", null],
    ["USD_MILLIONS", "EUR"],
    ["RATIO", "USD"],
    ["UNKNOWN", null],
  ] as const)(
    "rejects the unreviewed pair %s / %s",
    (unitCode, currencyCode) => {
      expectNormalizationFailure(() =>
        normalizePostgresFinancialFactProjectionRows(QUERY, [
          row({ unit_code: unitCode, currency_code: currencyCode }),
        ]),
      );
    },
  );

  it("keeps operation-specific normalizer expectations closed", () => {
    for (const [operation, purpose, channel] of [
      ["display_api", "display", "api"],
      ["derive_api", "derive", "api"],
      ["alert_local_alert", "alert", "local_alert"],
    ] as const satisfies readonly (readonly [
      ProjectionOperation,
      string,
      string,
    ])[]) {
      const query = structuredClone(QUERY);
      query.operation = operation;
      const normalized = normalizePostgresFinancialFactProjectionRows(query, [
        row({ grant_purpose: purpose, grant_channel: channel }),
      ]);
      expect(normalized.operation).toBe(operation);
    }
  });
});
