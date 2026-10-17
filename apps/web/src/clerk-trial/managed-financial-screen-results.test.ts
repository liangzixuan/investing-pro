import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import { parseSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../lib/test-personal-sec-annual-api-fixture";
import { getManagedAnnualView } from "./managed-annual-view";
import { reportFinancialReviewPacket } from "./managed-annual-statements-report-fixture";
import {
  DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA,
  MANAGED_FINANCIAL_SCREEN_FIELDS,
  compareManagedFinancialScreenRows,
  evaluateManagedFinancialScreenRow,
  validateManagedFinancialScreenCriteria,
  type ManagedFinancialScreenCriteria,
} from "./managed-financial-screen-results";

function criteria(clauses: ManagedFinancialScreenCriteria["clauses"]) {
  const result = validateManagedFinancialScreenCriteria({
    clauses,
    sort: { field: "symbol", direction: "asc" },
  });
  if (!result) throw new Error("Expected valid screen criteria");
  return result;
}

async function changed(
  source: PersonalSecAnnualCanonicalResponseDto,
  change: (packet: TestAnnualPacket) => void,
) {
  const packet = structuredClone(source) as TestAnnualPacket;
  change(packet);
  const bound = await bindAnnualPacket(packet);
  const admitted = await parseSecAnnualCanonicalResponse(
    bound,
    {
      schemaVersion: "6.0.0",
      catalogSnapshotSha256: bound.catalogSnapshotSha256,
      listingId: bound.security.listingId,
      symbol: bound.security.symbol,
    },
    new AbortController().signal,
  );
  if (!admitted) throw new Error("Expected genuine decoder admission");
  return admitted;
}

function result(
  source: PersonalSecAnnualCanonicalResponseDto,
  filter = DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA,
) {
  const row = evaluateManagedFinancialScreenRow(source, filter);
  if (!row) throw new Error("Expected owned screen result");
  return row;
}

describe("managed financial screen criteria", () => {
  it("owns closed criteria without changing exact decimals or caller objects", () => {
    const input = {
      clauses: [
        {
          field: "workingCapital",
          operator: "gte",
          value: "-0.000000000000000001",
        },
      ],
      sort: { field: "symbol", direction: "desc" },
    };
    const validated = validateManagedFinancialScreenCriteria(input);
    expect(validated).toEqual(input);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated?.clauses)).toBe(true);
    expect(Object.isFrozen(validated?.clauses[0])).toBe(true);
    expect(Object.isFrozen(validated?.sort)).toBe(true);
    input.clauses[0]!.value = "999";
    input.sort.direction = "asc";
    expect(validated?.clauses[0]?.value).toBe("-0.000000000000000001");
    expect(validated?.sort.direction).toBe("desc");
    expect(Object.isFrozen(input)).toBe(false);
    expect(
      validateManagedFinancialScreenCriteria(
        DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA,
      ),
    ).toEqual(DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA);
    expect(
      MANAGED_FINANCIAL_SCREEN_FIELDS.map(({ key, unit }) => [key, unit]),
    ).toEqual([
      ["operatingIncome", "USD"],
      ["operatingCashFlow", "USD"],
      ["operatingCashFlowLessPpePurchases", "USD"],
      ["workingCapital", "USD"],
      ["shareholdersEquity", "USD"],
      ["currentRatio", "multiple"],
    ]);
  });

  it("refuses unknown fields, malformed shapes, excess clauses and invalid thresholds", () => {
    const clause = { field: "workingCapital", operator: "gte", value: "0" };
    const base = {
      clauses: [clause],
      sort: { field: "symbol", direction: "asc" },
    };
    const invalid: unknown[] = [
      null,
      [],
      {},
      { ...base, extra: true },
      { ...base, sort: { field: "symbol", direction: "descending" } },
      { ...base, sort: { ...base.sort, extra: true } },
      { ...base, clauses: Array.from({ length: 8 }, () => clause) },
      { ...base, clauses: [{ ...clause, field: "revenue" }] },
      { ...base, clauses: [{ ...clause, operator: "eq" }] },
      { ...base, clauses: [{ ...clause, extra: true }] },
    ];
    for (const value of [
      0,
      "",
      "+1",
      "01",
      ".5",
      "1.",
      "1e2",
      "Infinity",
      "NaN",
      " 1",
      "1".repeat(65),
    ])
      invalid.push({ ...base, clauses: [{ ...clause, value }] });
    for (const input of invalid)
      expect(validateManagedFinancialScreenCriteria(input)).toBeNull();
    expect(
      validateManagedFinancialScreenCriteria({
        ...base,
        clauses: Array.from({ length: 7 }, () => clause),
      })?.clauses,
    ).toHaveLength(7);
    expect(
      validateManagedFinancialScreenCriteria({
        ...base,
        clauses: [{ ...clause, value: "1".repeat(64) }],
      }),
    ).not.toBeNull();
  });

  it("rejects accessors, symbols, hidden fields and sparse/custom arrays without invoking accessors", () => {
    let reads = 0;
    const get = () => {
      reads++;
      return [];
    };
    const base = { clauses: [], sort: { field: "symbol", direction: "asc" } };
    const clause = { field: "workingCapital", operator: "gte", value: "0" };
    const inputs = [
      Object.defineProperty({ sort: base.sort }, "clauses", {
        enumerable: true,
        get,
      }),
      {
        ...base,
        sort: Object.defineProperty({ field: "symbol" }, "direction", {
          enumerable: true,
          get,
        }),
      },
      Object.defineProperty({ ...base }, "hidden", { value: true }),
      { ...base, [Symbol("extra")]: true },
      { ...base, clauses: new Array(1) },
      {
        ...base,
        clauses: Object.defineProperty([clause], "0", {
          enumerable: true,
          get,
        }),
      },
      { ...base, clauses: Object.defineProperty([], Symbol.iterator, { get }) },
    ];
    for (const input of inputs)
      expect(validateManagedFinancialScreenCriteria(input)).toBeNull();
    expect(reads).toBe(0);
  });
});

describe("owned canonical financial screen results", () => {
  it("retains all six independent exact values, periods and original observation references without an income pair", async () => {
    const response = await reportFinancialReviewPacket();
    const row = result(response);
    const view = getManagedAnnualView(response)!;
    expect(row.response).toBe(response);
    expect(row.match).toBe("match");
    expect(view.income.resolution.selectedReportPairEligible).toBe(false);
    expect(view.income.resolution.pairs).toHaveLength(0);
    const expected = {
      operatingIncome: "250.125",
      operatingCashFlow: "120.125",
      operatingCashFlowLessPpePurchases: "-80.125",
      workingCapital: "0",
      shareholdersEquity: "-7.5",
      currentRatio: "1.00",
    };
    for (const field of MANAGED_FINANCIAL_SCREEN_FIELDS) {
      const metric = row.metrics[field.key];
      expect(metric).toMatchObject({
        status: "available",
        unit: field.unit,
        value: expected[field.key],
        currentUseEligible: true,
      });
      expect(metric.observationIds.length).toBeGreaterThan(0);
      expect(
        metric.observationIds.every((id) =>
          response.evidence.facts.observations.some(
            (observation) => observation.id === id,
          ),
        ),
      ).toBe(true);
      expect(Object.isFrozen(metric)).toBe(true);
      expect(Object.isFrozen(metric.observationIds)).toBe(true);
    }
    for (const source of view.financialReview) {
      expect(row.metrics[source.key]).toMatchObject(source.value);
      expect(row.metrics[source.key].observationIds).toBe(
        source.value.observationIds,
      );
    }
    expect(row.metrics.currentRatio).toBe(
      view.liquidity.resolution.currentRatio,
    );
    expect(row.metrics.operatingCashFlow).toHaveProperty(
      "startDate",
      "2025-01-01",
    );
    expect(row.metrics.operatingCashFlow).toHaveProperty(
      "endDate",
      "2025-12-31",
    );
    expect(row.metrics.workingCapital).toHaveProperty("asOfDate", "2025-12-31");
    expect(Object.isFrozen(row)).toBe(true);
    expect(Object.isFrozen(row.metrics)).toBe(true);
  });

  it("preserves independent source refusals and false-over-unknown conjunction semantics", async () => {
    const source = await reportFinancialReviewPacket({ operatingIncome: null });
    const unknown = {
      field: "operatingIncome",
      operator: "gte",
      value: "0",
    } as const;
    const falseClause = {
      field: "shareholdersEquity",
      operator: "gte",
      value: "0",
    } as const;
    const row = result(source, criteria([unknown]));
    expect(row.match).toBe("unknown");
    expect(row.metrics.operatingIncome).toMatchObject({
      status: "unavailable",
      reason: "concept_missing",
    });
    expect(row.metrics.operatingCashFlow).toMatchObject({
      status: "available",
      value: "120.125",
    });
    expect(result(source, criteria([unknown, falseClause])).match).toBe(
      "nonmatch",
    );
    expect(result(source, criteria([falseClause, unknown])).match).toBe(
      "nonmatch",
    );
    expect(
      result(
        source,
        criteria([
          { field: "operatingCashFlow", operator: "gte", value: "120.125" },
        ]),
      ).match,
    ).toBe("match");
  });

  it("withholds only a failed concept and preserves the sibling fields", async () => {
    const source = await changed(
      await reportFinancialReviewPacket(),
      (packet) => {
        packet.evidence.facts.observations =
          packet.evidence.facts.observations.filter(
            (row) => row.concept !== "OperatingIncomeLoss",
          );
        packet.evidence.facts.scans.find(
          (entry) => entry.concept === "OperatingIncomeLoss",
        )!.scan = { status: "candidate_limit", absence: null, coverage: null };
      },
    );
    const row = result(
      source,
      criteria([{ field: "operatingIncome", operator: "gte", value: "0" }]),
    );
    expect(row.match).toBe("unknown");
    expect(row.metrics.operatingIncome).toMatchObject({
      status: "unavailable",
      reason: "candidate_limit",
    });
    expect(row.metrics.currentRatio).toMatchObject({
      status: "available",
      value: "1.00",
    });
    expect(row.metrics.shareholdersEquity).toMatchObject({
      status: "available",
      value: "-7.5",
    });
  });

  it("uses exact unsafe and signed thresholds without rounding or Number conversion", async () => {
    const source = await reportFinancialReviewPacket({
      operatingIncome: "9007199254740993.000000000000000001",
      operatingCashFlow: "-0.000000000000000001",
      shareholdersEquity: "0",
    });
    expect(
      result(
        source,
        criteria([
          {
            field: "operatingIncome",
            operator: "gte",
            value: "9007199254740993.000000000000000002",
          },
        ]),
      ).match,
    ).toBe("nonmatch");
    expect(
      result(
        source,
        criteria([
          {
            field: "operatingIncome",
            operator: "gte",
            value: "9007199254740993.000000000000000001",
          },
          { field: "operatingCashFlow", operator: "lte", value: "0" },
          { field: "shareholdersEquity", operator: "gte", value: "-0" },
        ]),
      ).match,
    ).toBe("match");
    expect(result(source).metrics.operatingCashFlow).toMatchObject({
      value: "-0.000000000000000001",
    });
  });

  it("keeps historical amounts inspectable while numerical screening treats them as unknown", async () => {
    const source = await reportFinancialReviewPacket({
      cutoffAt: "2027-10-17T00:00:00.000Z",
    });
    const row = result(
      source,
      criteria([{ field: "operatingCashFlow", operator: "gte", value: "0" }]),
    );
    expect(row.match).toBe("unknown");
    expect(row.metrics.operatingCashFlow).toMatchObject({
      status: "available",
      value: "120.125",
      currentUseEligible: false,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });
    expect(result(source).match).toBe("match");
    const current = result(await reportFinancialReviewPacket());
    for (const direction of ["asc", "desc"] as const)
      expect(
        compareManagedFinancialScreenRows(current, row, {
          field: "operatingCashFlow",
          direction,
        }),
      ).toBeLessThan(0);
  });

  it("sorts exact numeric values and unknowns last with stable symbol/listing ties", async () => {
    const base = await reportFinancialReviewPacket({
      operatingIncome: "9007199254740993.000000000000000001",
    });
    const lower = result(base);
    const upper = result(
      await reportFinancialReviewPacket({
        operatingIncome: "9007199254740993.000000000000000002",
      }),
    );
    expect(
      compareManagedFinancialScreenRows(lower, upper, {
        field: "operatingIncome",
        direction: "asc",
      }),
    ).toBeLessThan(0);
    expect(
      compareManagedFinancialScreenRows(lower, upper, {
        field: "operatingIncome",
        direction: "desc",
      }),
    ).toBeGreaterThan(0);
    const missing = result(
      await reportFinancialReviewPacket({ operatingIncome: null }),
    );
    for (const direction of ["asc", "desc"] as const)
      expect(
        compareManagedFinancialScreenRows(lower, missing, {
          field: "operatingIncome",
          direction,
        }),
      ).toBeLessThan(0);
    const alpha = result(
      await changed(base, (packet) => {
        packet.security.symbol = "ALFA";
        packet.security.listingId = "listing-alpha";
      }),
    );
    const sameSymbol = result(
      await changed(base, (packet) => {
        packet.security.symbol = "ALFA";
        packet.security.listingId = "listing-zulu";
      }),
    );
    for (const direction of ["asc", "desc"] as const) {
      expect(
        compareManagedFinancialScreenRows(alpha, sameSymbol, {
          field: "operatingIncome",
          direction,
        }),
      ).toBeLessThan(0);
      expect(
        compareManagedFinancialScreenRows(alpha, lower, {
          field: "operatingIncome",
          direction,
        }),
      ).toBeLessThan(0);
    }
    expect(
      compareManagedFinancialScreenRows(alpha, lower, {
        field: "symbol",
        direction: "desc",
      }),
    ).toBeGreaterThan(0);
    expect(
      compareManagedFinancialScreenRows(alpha, alpha, {
        field: "symbol",
        direction: "asc",
      }),
    ).toBe(0);
  });

  it("rejects plain/cloned/replaced responses and forged derived rows without reading hostile fields", async () => {
    const source = await reportFinancialReviewPacket();
    const row = result(source);
    let reads = 0;
    const hostile = new Proxy(
      {},
      {
        get() {
          reads++;
          throw new Error();
        },
        ownKeys() {
          reads++;
          throw new Error();
        },
      },
    );
    for (const input of [
      null,
      {},
      hostile,
      structuredClone(source),
      { ...source },
      { ...source, calculation: row.metrics },
      { ...source, evidence: { ...source.evidence } },
    ])
      expect(
        evaluateManagedFinancialScreenRow(
          input,
          DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA,
        ),
      ).toBeNull();
    expect(reads).toBe(0);
    expect(
      evaluateManagedFinancialScreenRow(source, {
        ...DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA,
        clauses: [
          { field: "operatingCashFlow", operator: "gte", value: "NaN" },
        ],
      }),
    ).toBeNull();
    expect(() =>
      compareManagedFinancialScreenRows(
        { ...row },
        row,
        DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA.sort,
      ),
    ).toThrow(TypeError);
    expect(() =>
      compareManagedFinancialScreenRows(
        { ...row, metrics: { ...row.metrics } },
        row,
        DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA.sort,
      ),
    ).toThrow(TypeError);
    expect(() =>
      Object.assign(row.metrics.operatingIncome, { value: "999" }),
    ).toThrow(TypeError);
  });
});
