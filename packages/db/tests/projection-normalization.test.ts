import { describe, expect, it } from "vitest";

import { GetOperationProjection } from "../../../modules/research-core/src/index";

import {
  normalizePostgresFinancialFactRows,
  PostgresProjectionNormalizationError,
} from "../src/projection-normalization";

const NOW = "2026-08-15T21:00:00.000Z";
const INSTRUMENT_ID = "listing-syn1";
const OBJECT_PROTOTYPE_TO_STRING: unknown = Reflect.get(
  Object.prototype,
  "toString",
);
const BASE_QUERY = {
  scope: {
    instrumentId: INSTRUMENT_ID,
    publicKnownAt: NOW,
    systemRecordedAt: NOW,
  },
  operation: "display_api",
  context: {
    territory: "demo_only",
    evaluatedAt: NOW,
  },
} as const;

type QueryInput = Parameters<typeof normalizePostgresFinancialFactRows>[0];

function query(): QueryInput {
  return structuredClone(BASE_QUERY);
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    row_id: "fact-revenue-2025-restated",
    instrument_id: INSTRUMENT_ID,
    security_id: "security-syn1",
    concept_key: "revenue",
    value_numeric: "116.400000000000",
    value_scale: 3,
    unit_code: "USD_MILLIONS",
    currency_code: "USD",
    dimensions_json: "{}",
    period_start: "2025-01-01",
    period_end: "2025-12-31",
    known_from: "2026-05-10T07:00:00-05:00",
    known_to: null,
    system_from: "2026-05-10T12:00:00.000000Z",
    system_to: null,
    available_at: "2026-05-10T12:00:00Z",
    evidence_id: "evidence-synthetic-2025-restated",
    rights_policy_id: "rights.synthetic.display.v1",
    rights_policy_version: "1.0.0",
    quality_state: "restated_fixture",
    classification: "synthetic",
    policy_id: "rights.synthetic.display.v1",
    policy_version: "1.0.0",
    policy_classification: "synthetic",
    policy_territory: "demo_only",
    policy_expires_at: null,
    grant_policy_id: "rights.synthetic.display.v1",
    grant_policy_version: "1.0.0",
    grant_purpose: "display",
    grant_channel: "api",
    grant_allowed: true,
    ...overrides,
  };
}

function captureNormalizationError(run: () => unknown) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(PostgresProjectionNormalizationError);
  if (!(caught instanceof PostgresProjectionNormalizationError)) {
    throw new Error("expected PostgresProjectionNormalizationError");
  }
  expect(caught).toMatchObject({
    name: "PostgresProjectionNormalizationError",
    code: "INVALID_POSTGRES_PROJECTION_ROWS",
  });
  expect(caught.message.length).toBeGreaterThan(0);
  expect(caught.message.length).toBeLessThan(200);
  expect(caught).not.toHaveProperty("row");
  expect(caught).not.toHaveProperty("rows");
  expect(caught).not.toHaveProperty("field");
  expect(caught).not.toHaveProperty("value");
  expect(caught).not.toHaveProperty("details");
  expect(caught).not.toHaveProperty("cause");
  return caught;
}

function normalizeOne(overrides: Record<string, unknown> = {}) {
  return normalizePostgresFinancialFactRows(query(), [row(overrides)]);
}

describe("PostgreSQL financial-fact projection normalization", () => {
  it("normalizes an exact flat join row into the core projection contract", () => {
    const result = normalizeOne();

    expect(result).toEqual({
      scope: BASE_QUERY.scope,
      operation: "display_api",
      candidates: [
        {
          rowId: "fact-revenue-2025-restated",
          instrumentId: INSTRUMENT_ID,
          value: {
            id: "fact-revenue-2025-restated",
            instrumentId: INSTRUMENT_ID,
            key: "revenue",
            value: "116.400",
            unit: "USD_MILLIONS",
            reportingPeriodEnd: "2025-12-31",
            publicKnownFrom: "2026-05-10T12:00:00.000Z",
            publicKnownTo: null,
            systemRecordedFrom: "2026-05-10T12:00:00.000Z",
            systemRecordedTo: null,
            sourceAvailableAt: "2026-05-10T12:00:00.000Z",
            evidenceId: "evidence-synthetic-2025-restated",
            rightsPolicyId: "rights.synthetic.display.v1",
            rightsPolicyVersion: "1.0.0",
            qualityState: "restated_fixture",
          },
          rightsPolicyId: "rights.synthetic.display.v1",
          rightsPolicyVersion: "1.0.0",
        },
      ],
      policies: [
        {
          id: "rights.synthetic.display.v1",
          version: "1.0.0",
          classification: "synthetic",
          grants: [{ purpose: "display", channel: "api", allowed: true }],
          territory: "demo_only",
          expiresAt: null,
        },
      ],
      completeness: { state: "unknown", reason: "rls_filtered" },
    });
  });

  it("returns a conservative, non-counting result for an empty RLS view", () => {
    expect(normalizePostgresFinancialFactRows(query(), [])).toEqual({
      scope: BASE_QUERY.scope,
      operation: "display_api",
      candidates: [],
      policies: [],
      completeness: { state: "unknown", reason: "rls_filtered" },
    });
  });

  it("feeds only normalized candidates through the core-owned projection use case", async () => {
    const useCase = new GetOperationProjection(
      {
        load: (trustedQuery) =>
          Promise.resolve(
            normalizePostgresFinancialFactRows(trustedQuery, [row()]),
          ),
      },
      { current: () => structuredClone(BASE_QUERY.context) },
    );

    const projected = await useCase.execute({
      scope: structuredClone(BASE_QUERY.scope),
      operation: "display_api",
    });

    expect(projected?.rows).toHaveLength(1);
    expect(projected?.rows[0]).toMatchObject({
      id: "fact-revenue-2025-restated",
      instrumentId: INSTRUMENT_ID,
      key: "revenue",
      value: "116.400",
    });
    expect(projected?.omissions).toEqual({
      hasOmissions: true,
      count: null,
      reason: "source_completeness_unknown",
    });
  });

  it.each([
    ["display_api", "display", "api"],
    ["derive_api", "derive", "api"],
    ["alert_local_alert", "alert", "local_alert"],
  ] as const)(
    "accepts the one exact true grant for %s",
    (operation, purpose, channel) => {
      const requested = query();
      requested.operation = operation;
      const result = normalizePostgresFinancialFactRows(requested, [
        row({ grant_purpose: purpose, grant_channel: channel }),
      ]);

      expect(result.operation).toBe(operation);
      expect(result.policies[0]?.grants).toEqual([
        { purpose, channel, allowed: true },
      ]);
    },
  );

  it.each([
    ["USD_MILLIONS", "USD", "USD_MILLIONS"],
    ["USD_PER_SHARE", "USD", "USD_PER_SHARE"],
    ["MILLIONS_SHARES", null, "MILLIONS_SHARES"],
    ["PERCENT", null, "PERCENT"],
    ["RATIO", null, "RATIO"],
  ] as const)(
    "maps only the reviewed unit/currency pair %s + %s",
    (unitCode, currencyCode, expectedUnit) => {
      const result = normalizeOne({
        unit_code: unitCode,
        currency_code: currencyCode,
      });

      expect(result.candidates[0]?.value.unit).toBe(expectedUnit);
    },
  );

  it.each([
    ["USD_MILLIONS", null],
    ["USD_MILLIONS", "EUR"],
    ["USD_PER_SHARE", null],
    ["MILLIONS_SHARES", "USD"],
    ["PERCENT", "USD"],
    ["RATIO", "USD"],
    ["USD", "USD"],
    ["usd_millions", "USD"],
    ["toString", OBJECT_PROTOTYPE_TO_STRING],
    ["constructor", Object],
    ["__proto__", Object.prototype],
  ])("rejects an unreviewed unit/currency pair %s + %s", (unit, currency) => {
    captureNormalizationError(() =>
      normalizeOne({ unit_code: unit, currency_code: currency }),
    );
  });

  it.each(["verified_fixture", "restated_fixture"])(
    "accepts the exact core quality state %s",
    (qualityState) => {
      expect(
        normalizeOne({ quality_state: qualityState }).candidates[0]?.value
          .qualityState,
      ).toBe(qualityState);
    },
  );

  it.each(["quarantined_fixture", "verified", "RESTATED_FIXTURE"])(
    "rejects source-only or inexact quality state %s",
    (qualityState) => {
      captureNormalizationError(() =>
        normalizeOne({ quality_state: qualityState }),
      );
    },
  );

  it("canonicalizes valid RFC 3339 offsets and zero-only sub-milliseconds", () => {
    const result = normalizeOne({
      known_from: "2026-05-10T14:30:00+02:30",
      system_from: "2026-05-10T12:00:00.123000Z",
      available_at: "2026-05-10T07:00:00-05:00",
      policy_expires_at: "2027-08-15T16:00:00-05:00",
    });

    expect(result.candidates[0]?.value).toMatchObject({
      publicKnownFrom: "2026-05-10T12:00:00.000Z",
      systemRecordedFrom: "2026-05-10T12:00:00.123Z",
      sourceAvailableAt: "2026-05-10T12:00:00.000Z",
    });
    expect(result.policies[0]?.expiresAt).toBe("2027-08-15T21:00:00.000Z");
  });

  it.each([
    "2026-05-10 12:00:00Z",
    "2026-05-10T12:00:00",
    "2026-05-10T12:00:00+24:00",
    "2026-05-10T12:00:00+14:01",
    "2026-05-10T12:00:00-00:00",
    "2026-02-29T12:00:00Z",
    "2026-04-31T12:00:00Z",
    "2026-05-10T24:00:00Z",
    "2026-05-10T12:60:00Z",
    "2026-05-10T12:00:60Z",
    "2026-05-10T12:00:00.000001Z",
    " 2026-05-10T12:00:00Z",
  ])("rejects invalid or millisecond-lossy timestamp %s", (timestamp) => {
    captureNormalizationError(() => normalizeOne({ known_from: timestamp }));
  });

  it("rejects Date objects so the driver cannot silently erase timestamp precision", () => {
    captureNormalizationError(() =>
      normalizeOne({ known_from: new Date("2026-05-10T12:00:00Z") }),
    );
  });

  it.each([
    ["2024-02-29", "2024-12-31"],
    [null, "2025-12-31"],
  ])("accepts exact ordered reporting dates %s to %s", (start, end) => {
    const result = normalizeOne({ period_start: start, period_end: end });
    expect(result.candidates[0]?.value.reportingPeriodEnd).toBe(end);
  });

  it.each([
    ["2025-02-30", "2025-12-31"],
    ["2025-01-01", "2025-13-01"],
    ["2026-01-01", "2025-12-31"],
    ["2025-1-01", "2025-12-31"],
  ])("rejects invalid or reversed reporting dates %s to %s", (start, end) => {
    captureNormalizationError(() =>
      normalizeOne({ period_start: start, period_end: end }),
    );
  });

  it.each([
    ["12", 2, "12.00"],
    ["12.3", 3, "12.300"],
    ["116.400000000000", 3, "116.400"],
    ["12.000000000000", 0, "12"],
    ["-0.000000000000", 2, "0.00"],
    [
      "99999999999999999999999999.999999999999",
      12,
      "99999999999999999999999999.999999999999",
    ],
  ])("normalizes fixed decimal %s at scale %i", (value, scale, canonical) => {
    expect(
      normalizeOne({ value_numeric: value, value_scale: scale }).candidates[0]
        ?.value.value,
    ).toBe(canonical);
  });

  it.each([
    ["1e3", 2],
    ["NaN", 2],
    ["Infinity", 2],
    ["+1.00", 2],
    ["001.00", 2],
    [" 1.00", 2],
    ["1.001", 2],
    ["100000000000000000000000000.00", 2],
    ["0.0000000000001", 12],
    ["1.00", -1],
    ["1.00", 13],
    ["1.00", 1.5],
    [1.25, 2],
    ["1.00", "2"],
  ])("rejects unsafe fixed decimal %s / %s", (value, scale) => {
    captureNormalizationError(() =>
      normalizeOne({ value_numeric: value, value_scale: scale }),
    );
  });

  it.each([
    ["known_to", "2026-05-10T12:00:00Z"],
    ["known_to", "2026-05-10T11:59:59Z"],
    ["system_to", "2026-05-10T12:00:00Z"],
    ["system_to", "2026-05-10T11:59:59Z"],
  ])("rejects an empty or reversed half-open %s interval", (field, value) => {
    captureNormalizationError(() => normalizeOne({ [field]: value }));
  });

  it.each([
    {
      available_at: "2026-05-10T12:00:00.001Z",
      known_from: "2026-05-10T12:00:00Z",
    },
    {
      known_from: "2026-05-10T12:00:00.001Z",
      system_from: "2026-05-10T12:00:00Z",
    },
  ])("rejects an impossible available/known/system time chain", (overrides) => {
    captureNormalizationError(() => normalizeOne(overrides));
  });

  it("enforces both half-open as-of cutoffs on every returned row", () => {
    const cases = [
      { known_to: NOW },
      { system_to: NOW },
      {
        known_from: "2026-08-15T21:00:00.001Z",
        system_from: "2026-08-15T21:00:00.001Z",
      },
    ];

    for (const overrides of cases) {
      captureNormalizationError(() => normalizeOne(overrides));
    }
  });

  it("treats both half-open interval starts as inclusive", () => {
    const requested = query();
    requested.scope.publicKnownAt = "2026-05-10T12:00:00.000Z";
    requested.scope.systemRecordedAt = "2026-05-10T12:00:00.000Z";
    requested.context.evaluatedAt = "2026-05-10T12:00:00.000Z";

    expect(
      normalizePostgresFinancialFactRows(requested, [row()]).candidates,
    ).toHaveLength(1);
  });

  it("rejects rows whose listing identity does not equal the requested instrument", () => {
    captureNormalizationError(() =>
      normalizeOne({ instrument_id: "listing-other" }),
    );
  });

  it("validates security identity as nonempty without conflating it with listing identity", () => {
    expect(
      normalizeOne({ security_id: "security-distinct-from-listing" })
        .candidates[0]?.instrumentId,
    ).toBe(INSTRUMENT_ID);
    captureNormalizationError(() => normalizeOne({ security_id: "   " }));
  });

  it.each([
    ["row_id", ""],
    ["concept_key", "Revenue"],
    ["concept_key", "revenue-hyphen"],
    ["concept_key", "a\u0000b"],
    ["evidence_id", "   "],
    ["evidence_id", "a\u0085b"],
    ["rights_policy_id", ""],
    ["rights_policy_version", "v1"],
  ])("rejects invalid canonical text in %s", (field, value) => {
    captureNormalizationError(() => normalizeOne({ [field]: value }));
  });

  it("accepts only an empty dimensions object until dimensions have a core mapping", () => {
    for (const dimensions of [
      '{"segment":"enterprise"}',
      { segment: "enterprise" },
      [],
      null,
      1,
    ]) {
      captureNormalizationError(() =>
        normalizeOne({ dimensions_json: dimensions }),
      );
    }
  });

  it.each([
    ["classification", "live"],
    ["policy_classification", "live"],
    ["policy_territory", "other"],
    ["policy_id", "rights.other"],
    ["policy_version", "2.0.0"],
    ["grant_policy_id", "rights.other"],
    ["grant_policy_version", "2.0.0"],
    ["grant_purpose", "derive"],
    ["grant_channel", "web"],
    ["grant_allowed", false],
  ])("rejects a mismatched or unauthorized joined %s", (field, value) => {
    captureNormalizationError(() => normalizeOne({ [field]: value }));
  });

  it("rejects unexpected and missing columns instead of silently projecting them", () => {
    captureNormalizationError(() =>
      normalizePostgresFinancialFactRows(query(), [
        { ...row(), unexpected_column: "ignored" },
      ]),
    );

    const missingColumn = { ...row() };
    Reflect.deleteProperty(missingColumn, "dimensions_json");
    captureNormalizationError(() =>
      normalizePostgresFinancialFactRows(query(), [missingColumn]),
    );
  });

  it("requires a dense plain row array and rejects array metadata", () => {
    captureNormalizationError(() =>
      normalizePostgresFinancialFactRows(query(), { 0: row(), length: 1 }),
    );

    const sparse = new Array<unknown>(1);
    captureNormalizationError(() =>
      normalizePostgresFinancialFactRows(query(), sparse),
    );

    const decorated: unknown[] & { metadata?: string } = [row()];
    decorated.metadata = "untrusted";
    captureNormalizationError(() =>
      normalizePostgresFinancialFactRows(query(), decorated),
    );

    class RowArray extends Array<unknown> {}
    captureNormalizationError(() =>
      normalizePostgresFinancialFactRows(query(), new RowArray(row())),
    );
  });

  it("rejects accessors and non-data row prototypes without invoking them", () => {
    let calls = 0;
    const accessorRow = row();
    Object.defineProperty(accessorRow, "unit_code", {
      enumerable: true,
      get: () => {
        calls += 1;
        throw new Error("must not run");
      },
    });
    captureNormalizationError(() =>
      normalizePostgresFinancialFactRows(query(), [accessorRow]),
    );

    const inheritedRow = row();
    Object.setPrototypeOf(inheritedRow, { inherited: "untrusted" });
    captureNormalizationError(() =>
      normalizePostgresFinancialFactRows(query(), [inheritedRow]),
    );
    expect(calls).toBe(0);
  });

  it("rejects duplicate row IDs", () => {
    captureNormalizationError(() =>
      normalizePostgresFinancialFactRows(query(), [row(), row()]),
    );
  });

  it("rejects duplicate concept identities even when row IDs differ", () => {
    captureNormalizationError(() =>
      normalizePostgresFinancialFactRows(query(), [
        row(),
        row({
          row_id: "fact-revenue-duplicate",
          evidence_id: "evidence-revenue-duplicate",
        }),
      ]),
    );
  });

  it("deduplicates one exact policy across distinct fact rows", () => {
    const second = row({
      row_id: "fact-ebitda-2025-restated",
      concept_key: "ebitda",
      value_numeric: "18.624000000000",
      evidence_id: "evidence-synthetic-2025-restated-ebitda",
    });
    const result = normalizePostgresFinancialFactRows(query(), [row(), second]);

    expect(result.candidates.map(({ rowId }) => rowId)).toEqual([
      "fact-ebitda-2025-restated",
      "fact-revenue-2025-restated",
    ]);
    expect(result.policies).toHaveLength(1);
  });

  it("rejects inconsistent joined policy material for one exact reference", () => {
    captureNormalizationError(() =>
      normalizePostgresFinancialFactRows(query(), [
        row(),
        row({
          row_id: "fact-ebitda-2025-restated",
          concept_key: "ebitda",
          value_numeric: "18.624000000000",
          evidence_id: "evidence-ebitda-restated",
          policy_expires_at: "2027-01-01T00:00:00Z",
        }),
      ]),
    );
  });

  it("does not invoke coercion hooks on hostile driver values", () => {
    let calls = 0;
    const hostile = {
      toString: () => {
        calls += 1;
        throw new Error("must not run");
      },
    };

    const error = captureNormalizationError(() =>
      normalizeOne({ unit_code: hostile }),
    );
    expect(error.message).not.toContain("must not run");
    expect(calls).toBe(0);
  });

  it("rejects the whole batch with one generic value-free error", () => {
    const secret = "raw-secret-that-must-not-escape";
    const valid = row();
    const invalid = row({
      row_id: "fact-invalid-secret",
      concept_key: "invalid_secret",
      value_numeric: secret,
    });
    const error = captureNormalizationError(() =>
      normalizePostgresFinancialFactRows(query(), [valid, invalid]),
    );
    const secondError = captureNormalizationError(() =>
      normalizeOne({ value_numeric: "a-different-secret" }),
    );

    expect(error.message).toBe(secondError.message);
    expect(JSON.stringify(error)).not.toContain(secret);
    expect(error.message).not.toContain(secret);
    expect(error.stack).not.toContain(secret);
    expect(error.message).not.toContain(valid.row_id);
  });

  it("returns defensive copies with no caller-owned nested references", () => {
    const requested = query();
    const sourceRow = row();
    const result = normalizePostgresFinancialFactRows(requested, [sourceRow]);

    requested.scope.instrumentId = "listing-mutated";
    sourceRow.concept_key = "mutated_source_key";
    sourceRow.dimensions_json = '{"mutated":true}';

    expect(result.scope.instrumentId).toBe(INSTRUMENT_ID);
    expect(result.candidates[0]?.value.key).toBe("revenue");
    expect(result.policies[0]?.grants[0]?.allowed).toBe(true);

    result.candidates[0]!.value.key = "mutated_output_key";
    result.policies[0]!.grants[0]!.allowed = false;
    expect(sourceRow.concept_key).toBe("mutated_source_key");
    expect(sourceRow.grant_allowed).toBe(true);
  });

  it("fails closed for malformed query scope, operation, or trusted context", () => {
    const malformedQueries = [
      { ...query(), unexpected: true },
      { ...query(), operation: "export_api" },
      {
        ...query(),
        scope: { ...query().scope, publicKnownAt: "not-a-time" },
      },
      {
        ...query(),
        scope: {
          ...query().scope,
          publicKnownAt: "2026-08-15T16:00:00-05:00",
        },
      },
      {
        ...query(),
        scope: {
          ...query().scope,
          publicKnownAt: "2026-08-15T21:00:00.000000Z",
        },
      },
      {
        ...query(),
        context: { ...query().context, territory: "" },
      },
      {
        ...query(),
        context: {
          ...query().context,
          evaluatedAt: "2026-08-15T20:59:59Z",
        },
      },
    ];

    for (const malformed of malformedQueries) {
      captureNormalizationError(() =>
        normalizePostgresFinancialFactRows(malformed as QueryInput, [row()]),
      );
    }
  });
});
