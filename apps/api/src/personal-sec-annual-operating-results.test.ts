import { createHash } from "node:crypto";

import { PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS } from "@research-cockpit/contracts";
import { describe, expect, it, vi } from "vitest";

import { normalizePersonalSecAnnualCompanyFacts } from "./personal-sec-annual-company-facts";
import { createSecPersonalAnnualEvidenceProvider } from "./personal-sec-annual-evidence-provider";
import { parsePersonalSecSourceJson } from "./personal-sec-quarterly-evidence-provider";

const CIK = "0000000042";
const ACCESSION = "0000999999-26-000001";
const OLDER = "0000999999-25-000001";
const CONCEPT = "OperatingIncomeLoss";
const NOW = "2026-09-20T12:00:00.000Z";
const URLS = [
  `https://data.sec.gov/submissions/CIK${CIK}.json`,
  `https://data.sec.gov/api/xbrl/companyfacts/CIK${CIK}.json`,
];
function fact(overrides: Record<string, unknown> = {}) {
  return {
    start: "2025-01-01",
    end: "2025-12-31",
    val: 120,
    accn: ACCESSION,
    fy: 2025,
    fp: "FY",
    form: "10-K",
    filed: "2026-02-01",
    ...overrides,
  };
}
function usd(rows: readonly unknown[]) {
  return { units: { USD: rows } };
}
function facts(overrides: Record<string, unknown> = {}) {
  return {
    cik: 42,
    facts: {
      "us-gaap": {
        Revenues: usd([fact()]),
        NetIncomeLoss: usd([fact({ val: -30 })]),
        OperatingIncomeLoss: usd([fact({ val: 42 })]),
        NetCashProvidedByUsedInOperatingActivities: usd([fact({ val: 90 })]),
        PaymentsToAcquirePropertyPlantAndEquipment: usd([fact({ val: 20 })]),
        AssetsCurrent: usd([fact({ start: undefined, val: 200 })]),
        LiabilitiesCurrent: usd([fact({ start: undefined, val: 50 })]),
        ...overrides,
      },
    },
  };
}
function normalize(
  overrides: Record<string, unknown> = {},
  accession: string | null = ACCESSION,
) {
  return normalizePersonalSecAnnualCompanyFacts(
    parsePersonalSecSourceJson(JSON.stringify(facts(overrides))),
    CIK,
    accession,
  );
}
function submissions() {
  return {
    cik: CIK,
    filings: {
      recent: {
        accessionNumber: [ACCESSION],
        form: ["10-K"],
        filingDate: ["2026-02-01"],
        reportDate: ["2025-12-31"],
        acceptanceDateTime: ["2026-02-01T12:00:00.000Z"],
      },
      files: [],
    },
  };
}
function providerFixture(
  body = JSON.stringify(facts()),
  now = () => new Date(NOW),
  submissionsResponse = () => Response.json(submissions()),
) {
  const fetch = vi.fn<typeof globalThis.fetch>((input) => {
    if (input === URLS[0]) return Promise.resolve(submissionsResponse());
    if (input === URLS[1]) return Promise.resolve(new Response(body));
    throw new Error("Unexpected synthetic source request");
  });
  const provider = createSecPersonalAnnualEvidenceProvider(
    "Annual operating fixture fixture@example.test",
    { fetch, now, scheduler: { wait: () => Promise.resolve() } },
  );
  return {
    fetch,
    async load() {
      try {
        return await provider.loadEvidence(CIK);
      } finally {
        provider.close();
      }
    },
  };
}

describe("fixed Annual operating-income CompanyFacts scan", () => {
  it("preserves signed source precision, semantic hashes and the first duplicate locator", () => {
    const decimal = "-123456789012345678901234567890.000000000000000001";
    const body = JSON.stringify(
      facts({ [CONCEPT]: usd([fact({ val: 42 }), fact({ val: 42 })]) }),
    ).replaceAll('"val":42', `"val":${decimal}`);
    const metric = normalizePersonalSecAnnualCompanyFacts(
      parsePersonalSecSourceJson(body),
      CIK,
      ACCESSION,
    ).operatingIncome;
    expect(metric.observations).toHaveLength(1);
    const row = metric.observations[0]!;
    expect(row).toMatchObject({
      metric: "operating_income",
      taxonomy: "us-gaap",
      concept: CONCEPT,
      unit: "USD",
      value: decimal,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      durationDays: 365,
      accessionNumber: ACCESSION,
    });
    const { id, sourceLocator, ...fields } = row;
    expect(sourceLocator).toBe(`/facts/us-gaap/${CONCEPT}/units/USD/0`);
    expect(id).toBe(
      `sec-fact:${createHash("sha256").update(JSON.stringify(fields)).digest("hex")}`,
    );
    expect(metric.scan).toMatchObject({
      coverage: {
        full: {
          candidateRows: 2,
          inspectedRows: 2,
          duplicateRows: 1,
          invalidRows: 0,
          uniqueObservations: 1,
        },
        selected: 1,
        returned: 1,
        omittedSelected: 0,
      },
    });
    expect(Object.isFrozen(metric)).toBe(true);
    expect(Object.isFrozen(row)).toBe(true);
  });

  it.each([
    [undefined, "concept_missing"],
    [{ units: { EUR: [fact()] } }, "usd_missing"],
    [usd([]), "empty_usd"],
  ] as const)("reports absence %s without inventing zero", (entry, absence) => {
    const result = normalize({ [CONCEPT]: entry });
    expect(result.operatingIncome).toMatchObject({
      scan: {
        status: "available",
        absence,
        coverage: { full: { candidateRows: 0 }, selected: 0, returned: 0 },
      },
      observations: [],
    });
    expect(result.income?.observations).toHaveLength(2);
    expect(result.operatingCashFlow.observations).toHaveLength(1);
  });

  it.each([null, [], { units: null }, { units: { USD: {} } }])(
    "isolates malformed operating concept %j",
    (entry) => {
      const result = normalize({ [CONCEPT]: entry });
      expect(result.operatingIncome).toEqual({
        scan: { status: "invalid_response", absence: null, coverage: null },
        observations: [],
      });
      expect(result.incomeScanStatus).toBe("available");
      expect(result.currentAssets.observations).toHaveLength(1);
      expect(result.ppePurchases.observations).toHaveLength(1);
    },
  );

  it.each(["9".repeat(64), "9".repeat(65), `0.${"0".repeat(61)}1`])(
    "enforces the unchanged source decimal bound for %s",
    (decimal) => {
      const body = JSON.stringify(facts()).replace(
        '"val":42',
        `"val":${decimal}`,
      );
      const result = normalizePersonalSecAnnualCompanyFacts(
        parsePersonalSecSourceJson(body),
        CIK,
        ACCESSION,
      ).operatingIncome;
      expect(result.observations.map((row) => row.value)).toEqual(
        decimal.length > 64 ? [] : [decimal],
      );
      expect(result.scan).toMatchObject({
        coverage: { full: { invalidRows: decimal.length > 64 ? 1 : 0 } },
      });
    },
  );

  it("counts malformed, duplicate and other-accession rows before period filtering", () => {
    const result = normalize({
      [CONCEPT]: usd([
        fact(),
        fact(),
        fact({ val: "120" }),
        fact({ start: undefined }),
        fact({ end: "2024-12-31", start: "2024-01-01" }),
        fact({ accn: OLDER }),
      ]),
    }).operatingIncome;
    expect(result.scan).toMatchObject({
      coverage: {
        full: {
          candidateRows: 6,
          inspectedRows: 6,
          invalidRows: 1,
          duplicateRows: 1,
          uniqueObservations: 4,
        },
        selected: 3,
        otherAccessions: 1,
        returned: 3,
        omittedSelected: 0,
      },
    });
    expect(result.observations.some((row) => row.startDate === null)).toBe(
      true,
    );
    expect(
      result.observations.some((row) => row.endDate === "2024-12-31"),
    ).toBe(true);
  });

  it("retains all 100 selected rows or refuses all 101, including comparative periods", () => {
    const rows = Array.from({ length: 101 }, (_, val) =>
      fact({ val, start: "2024-01-01", end: "2024-12-31" }),
    );
    expect(
      normalize({ [CONCEPT]: usd(rows.slice(0, 100)) }).operatingIncome
        .observations,
    ).toHaveLength(100);
    const result = normalize({ [CONCEPT]: usd(rows) });
    expect(result.operatingIncome).toMatchObject({
      scan: {
        status: "available",
        coverage: { selected: 101, returned: 0, omittedSelected: 101 },
      },
      observations: [],
    });
    expect(result.income?.observations).toHaveLength(2);
  });

  it("bounds all 10,000 candidates independently and keeps unresolved counts unknown", () => {
    const rows = Array.from({ length: 10_000 }, () => fact());
    const at = normalize({ [CONCEPT]: usd(rows) }, null).operatingIncome;
    expect(at).toMatchObject({
      scan: {
        status: "available",
        coverage: {
          full: {
            candidateRows: 10_000,
            inspectedRows: 10_000,
            duplicateRows: 9_999,
          },
          selected: null,
          returned: 0,
          otherAccessions: null,
          omittedSelected: null,
        },
      },
      observations: [],
    });
    const over = normalize({ [CONCEPT]: usd([...rows, fact()]) });
    expect(over.operatingIncome).toEqual({
      scan: { status: "candidate_limit", absence: null, coverage: null },
      observations: [],
    });
    expect(over.incomeScanStatus).toBe("available");
    expect(over.currentLiabilities.observations).toHaveLength(1);
  });
});

describe("Annual operating evidence from the existing two sources", () => {
  it("uses all three raw revenue bases even when no net-income pair is eligible", async () => {
    const fixture = providerFixture(
      JSON.stringify(
        facts({
          NetIncomeLoss: undefined,
          RevenueFromContractWithCustomerExcludingAssessedTax: usd([
            fact({ val: 200 }),
          ]),
          SalesRevenueNet: usd([fact({ val: 300 })]),
        }),
      ),
    );
    expect(fixture.fetch).not.toHaveBeenCalled();
    const result = await fixture.load();
    expect(fixture.fetch.mock.calls.map(([url]) => url)).toEqual(URLS);
    expect(result.generation.definitionVersion).toBe("4.0.0");
    expect(result.resolution.selectedReportPairEligible).toBe(false);
    expect(
      result.resolution.pairs.every((pair) => pair.status !== "eligible"),
    ).toBe(true);
    expect(result.operatingResults.resolution.operatingIncome).toMatchObject({
      status: "available",
      unit: "USD",
      value: "42",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      accessionNumber: ACCESSION,
      currentUseEligible: true,
    });
    expect(
      result.operatingResults.resolution.margins.map((basis) => basis.concept),
    ).toEqual(PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS);
    expect(
      result.operatingResults.resolution.margins.map(
        (basis) => basis.operatingMargin,
      ),
    ).toMatchObject(
      ["21", "35", "14"].map((value) => ({
        status: "available",
        unit: "percent",
        value,
      })),
    );
    const row = result.operatingResults.operatingIncome.observations[0]!;
    expect(row.filing).toMatchObject({
      status: "matched",
      reportDate: "2025-12-31",
      acceptedAt: "2026-02-01T12:00:00.000Z",
      sourceUrl:
        "https://www.sec.gov/Archives/edgar/data/42/0000999999-26-000001-index.htm",
    });
    for (const basis of result.operatingResults.resolution.margins)
      expect(basis.operatingMargin.observationIds).toEqual([
        row.id,
        ...basis.revenue.observationIds,
      ]);
    expect(
      result.cashGeneration.resolution.operatingCashFlowLessPpePurchases,
    ).toMatchObject({ status: "available", value: "70" });
    expect(result.liquidity.resolution.workingCapital).toMatchObject({
      status: "available",
      value: "150",
    });
  });

  it.each([-30, 0, 30])(
    "keeps signed operating income %s independent of net income",
    async (value) => {
      const fixture = providerFixture(
        JSON.stringify(facts({ [CONCEPT]: usd([fact({ val: value })]) })),
      );
      const result = await fixture.load();
      expect(result.operatingResults.resolution.operatingIncome).toMatchObject({
        status: "available",
        value: String(value),
      });
      expect(
        result.operatingResults.resolution.margins[1]!.operatingMargin,
      ).toMatchObject({ status: "available", value: String(value / 1.2) });
      expect(fixture.fetch).toHaveBeenCalledTimes(2);
    },
  );

  it.each([0, -120])(
    "retains nonpositive revenue %s but withholds its operating margin",
    async (value) => {
      const fixture = providerFixture(
        JSON.stringify(facts({ Revenues: usd([fact({ val: value })]) })),
      );
      const result = await fixture.load();
      expect(result.operatingResults.resolution.operatingIncome.status).toBe(
        "available",
      );
      expect(result.operatingResults.resolution.margins[1]).toMatchObject({
        revenue: { status: "available", value: String(value) },
        operatingMargin: {
          status: "unavailable",
          reason: "nonpositive_revenue",
        },
      });
    },
  );

  it.each([
    [null, "invalid_response"],
    [usd([fact({ val: "42" }), fact({ val: 42 })]), "invalid_source_rows"],
    [
      usd(Array.from({ length: 101 }, (_, val) => fact({ val }))),
      "selected_report_overflow",
    ],
    [usd(Array.from({ length: 10_001 }, () => fact())), "candidate_limit"],
  ] as const)(
    "isolates refused operating input %s from revenue, income, cash and liquidity",
    async (entry, reason) => {
      const fixture = providerFixture(
        JSON.stringify(facts({ [CONCEPT]: entry })),
      );
      const result = await fixture.load();
      expect(result.operatingResults.resolution.operatingIncome).toMatchObject({
        status: "unavailable",
        reason,
      });
      expect(result.operatingResults.resolution.margins[1]).toMatchObject({
        revenue: { status: "available", value: "120" },
        operatingMargin: { status: "unavailable", reason },
      });
      expect(result.resolution.currentTargetEligible).toBe(true);
      expect(
        result.cashGeneration.resolution.operatingCashFlowLessPpePurchases,
      ).toMatchObject({ status: "available", value: "70" });
      expect(result.liquidity.resolution.currentRatio).toMatchObject({
        status: "available",
        value: "4.00",
      });
      expect(fixture.fetch).toHaveBeenCalledTimes(2);
    },
  );

  it.each([null, usd(Array.from({ length: 20_001 }, () => fact()))])(
    "retains the operating amount when the combined income scan fails",
    async (revenue) => {
      const result = await providerFixture(
        JSON.stringify(facts({ Revenues: revenue })),
      ).load();
      expect(result.incomeScanStatus).not.toBe("available");
      expect(result.operatingResults.resolution.operatingIncome).toMatchObject({
        status: "available",
        value: "42",
      });
      expect(
        result.operatingResults.resolution.margins.every(
          (basis) => basis.operatingMargin.status === "unavailable",
        ),
      ).toBe(true);
    },
  );

  it.each([
    [[fact({ val: 42 }), fact({ val: 43 })], "ambiguous_value"],
    [
      [fact({ val: 42 }), fact({ val: 42, start: "2024-12-15" })],
      "ambiguous_period",
    ],
    [
      [fact({ val: 42, filed: "2026-02-02" })],
      "filing_unmatched_or_conflicted",
    ],
  ] as const)(
    "preserves refused source references for conflicting operating observations",
    async (rows, reason) => {
      const result = await providerFixture(
        JSON.stringify(facts({ [CONCEPT]: usd(rows) })),
      ).load();
      expect(result.operatingResults.resolution.operatingIncome).toMatchObject({
        status: "unavailable",
        reason,
        observationIds:
          result.operatingResults.operatingIncome.observations.map(
            (row) => row.id,
          ),
      });
      expect(
        result.operatingResults.resolution.margins[1]!.revenue.status,
      ).toBe("available");
    },
  );

  it("retains agreeing distinct references but deduplicates the same source fact", async () => {
    const result = await providerFixture(
      JSON.stringify(
        facts({
          [CONCEPT]: usd([
            fact({ val: 42 }),
            fact({ val: 42 }),
            fact({ val: 42, frame: "CY2025" }),
          ]),
        }),
      ),
    ).load();
    const operating = result.operatingResults;
    expect(operating.operatingIncome.observations).toHaveLength(2);
    expect(operating.resolution.operatingIncome).toMatchObject({
      status: "available",
      value: "42",
      observationIds: operating.operatingIncome.observations.map(
        (row) => row.id,
      ),
    });
  });

  it("does not replace the selected filing with an older convenient operating amount", async () => {
    const result = await providerFixture(
      JSON.stringify(
        facts({ [CONCEPT]: usd([fact({ val: 42, accn: OLDER })]) }),
      ),
    ).load();
    expect(result.operatingResults.operatingIncome).toMatchObject({
      scan: { coverage: { selected: 0, otherAccessions: 1, returned: 0 } },
      observations: [],
    });
    expect(result.operatingResults.resolution.operatingIncome).toMatchObject({
      status: "unavailable",
      reason: "no_report_period",
    });
  });

  it("preserves an old annual amount while making its current-use limit explicit", async () => {
    const result = await providerFixture(
      JSON.stringify(facts()),
      () => new Date("2028-09-20T12:00:00.000Z"),
    ).load();
    expect(result.operatingResults.resolution.operatingIncome).toMatchObject({
      status: "available",
      value: "42",
      currentUseEligible: false,
    });
    expect(
      result.operatingResults.resolution.margins[1]!.operatingMargin,
    ).toMatchObject({ status: "available", currentUseEligible: false });
    expect(result.operatingResults.resolution.utilityAge?.withinWindow).toBe(
      false,
    );
  });

  it.each(["{", JSON.stringify({ cik: 7, facts: {} })])(
    "refuses an invalid shared CompanyFacts envelope",
    async (body) => {
      const fixture = providerFixture(body);
      const result = await fixture.load();
      expect(result.generation.sources.companyFacts.status).toBe(
        "invalid_response",
      );
      expect(result.operatingResults.operatingIncome).toEqual({
        scan: { status: "source_unavailable", absence: null, coverage: null },
        observations: [],
      });
      expect(result.operatingResults.resolution.operatingIncome).toMatchObject({
        status: "unavailable",
        reason: "source_unavailable",
      });
      expect(fixture.fetch).toHaveBeenCalledTimes(2);
    },
  );

  it("keeps full scan counts but no selected amount when Submissions is unavailable", async () => {
    const result = await providerFixture(
      JSON.stringify(facts()),
      undefined,
      () => new Response("", { status: 503 }),
    ).load();
    expect(result.operatingResults.operatingIncome).toMatchObject({
      scan: {
        status: "available",
        coverage: { full: { candidateRows: 1 }, selected: null, returned: 0 },
      },
      observations: [],
    });
    expect(result.operatingResults.resolution.operatingIncome.status).toBe(
      "unavailable",
    );
  });
});
