import { createHash } from "node:crypto";

import {
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS as LIMITS,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  serializePersonalSecAnnualStatementObservation,
  type PersonalSecAnnualCanonicalEvidenceDto,
  type PersonalSecAnnualStatementConcept,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  derivePersonalSecAnnualCanonicalView,
  derivePersonalSecAnnualFinancialInputs,
  serializePersonalSecAnnualCanonicalGeneration,
} from "@research-cockpit/personal-financial-analytics";

import {
  createSecPersonalAnnualEvidenceProvider,
  PersonalSecAnnualEvidenceProviderError,
} from "./personal-sec-annual-evidence-provider";
import {
  createPersonalSecRequestScheduler,
  PersonalSecRequestSchedulerError,
  type PersonalSecRequestScheduler,
} from "./personal-sec-request-scheduler";

const sourceCache = new WeakMap<
  PersonalSecAnnualCanonicalEvidenceDto,
  ReturnType<typeof derivePersonalSecAnnualFinancialInputs>
>();
const viewCache = new WeakMap<
  PersonalSecAnnualCanonicalEvidenceDto,
  ReturnType<typeof derivePersonalSecAnnualCanonicalView>
>();
function source(value: PersonalSecAnnualCanonicalEvidenceDto) {
  let result = sourceCache.get(value);
  if (result === undefined) {
    result = derivePersonalSecAnnualFinancialInputs(value);
    sourceCache.set(value, result);
  }
  return result;
}
function view(value: PersonalSecAnnualCanonicalEvidenceDto) {
  let result = viewCache.get(value);
  if (result === undefined) {
    result = derivePersonalSecAnnualCanonicalView(value);
    viewCache.set(value, result);
  }
  return result;
}
const NOW = new Date("2026-09-20T12:00:00.000Z");
const USER_AGENT = "Research/1.0 owner@example.test";
const CIK = "0000000042";
const ACCESSION = "0000999999-26-000001";
const OLDER = "0000999999-25-000001";
const FACTS_URL = `https://data.sec.gov/api/xbrl/companyfacts/CIK${CIK}.json`;
const SUBMISSIONS_URL = `https://data.sec.gov/submissions/CIK${CIK}.json`;

function fact(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
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

function companyFacts(
  revenue: readonly unknown[] = [fact()],
  income: readonly unknown[] = [fact({ val: -30 })],
  extras: Partial<Record<PersonalSecAnnualStatementConcept, unknown>> = {},
): Record<string, unknown> {
  return {
    cik: 42,
    facts: {
      "us-gaap": {
        Revenues: { units: { USD: revenue } },
        NetIncomeLoss: { units: { USD: income } },
        ...extras,
      },
    },
  };
}

function submissions(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    cik: CIK,
    filings: {
      recent: {
        accessionNumber: [ACCESSION],
        form: ["10-K"],
        filingDate: ["2026-02-01"],
        reportDate: ["2025-12-31"],
        acceptanceDateTime: ["2026-02-01T12:00:00.000Z"],
        primaryDocument: ["https://attacker.invalid/not-followed"],
        ...overrides,
      },
      files: [{ name: "https://attacker.invalid/older-not-followed" }],
    },
  };
}

function url(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

function setup(
  factsResponse = () => Response.json(companyFacts()),
  submissionsResponse = () => Response.json(submissions()),
  now = () => NOW,
  scheduler: PersonalSecRequestScheduler = createPersonalSecRequestScheduler({
    now: () => Date.now(),
  }),
) {
  const starts: number[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>((input) => {
    starts.push(Date.now());
    return Promise.resolve(
      url(input) === FACTS_URL ? factsResponse() : submissionsResponse(),
    );
  });
  const provider = createSecPersonalAnnualEvidenceProvider(USER_AGENT, {
    fetch,
    now,
    scheduler,
  });
  return { provider, fetch, starts };
}

function balanceSheetFacts(extras: Parameters<typeof companyFacts>[2] = {}) {
  const instant = (val: number) => ({
    units: { USD: [fact({ start: undefined, val, fy: 2026 })] },
  });
  return companyFacts(undefined, undefined, {
    Assets: instant(500),
    Liabilities: instant(0),
    StockholdersEquity: instant(-100),
    ...extras,
  });
}

async function finish<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

describe("independent reported Annual balance-sheet totals", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const instant = (patch: Record<string, unknown> = {}) =>
    fact({ start: undefined, ...patch });
  const usd = (rows: readonly unknown[]) => ({ units: { USD: rows } });
  const identities = [
    ["Assets", "totalAssets", "total_assets"],
    ["Liabilities", "totalLiabilities", "total_liabilities"],
    ["StockholdersEquity", "shareholdersEquity", "shareholders_equity"],
  ] as const;

  it("joins three exact independent totals without income, changing neither request nor fiscal-focus policy", async () => {
    const { provider, fetch } = setup(() =>
      Response.json(balanceSheetFacts({ Revenues: null, NetIncomeLoss: null })),
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(view(result).income.scanStatus).toBe("invalid_response");
    expect(view(result).income.resolution.currentTargetEligible).toBe(false);
    expect(result.generation.definitionVersion).toBe("6.0.0");
    for (const [index, [concept, key]] of identities.entries()) {
      const row = source(result).balanceSheet[key].observations[0]!;
      expect(Object.hasOwn(row, "metric")).toBe(false);
      expect(result.facts.observations).toContain(row);
      expect(row).toMatchObject({
        concept,
        taxonomy: "us-gaap",
        unit: "USD",
        startDate: null,
        durationDays: null,
        filingFocusPeriod: "FY",
        filingFocusYear: 2026,
        endDate: "2025-12-31",
        sourceLocator: `/facts/us-gaap/${concept}/units/USD/0`,
        filing: {
          status: "matched",
          form: "10-K",
          reportDate: "2025-12-31",
          filedDate: "2026-02-01",
          acceptedAt: "2026-02-01T12:00:00.000Z",
          sourceUrl: `https://www.sec.gov/Archives/edgar/data/42/${ACCESSION}-index.htm`,
        },
      });
      expect(view(result).balanceSheet.resolution[key]).toEqual({
        status: "available",
        unit: "USD",
        value: ["500", "0", "-100"][index],
        asOfDate: "2025-12-31",
        accessionNumber: ACCESSION,
        observationIds: [row.id],
        currentUseEligible: true,
      });
      expect(Object.isFrozen(source(result).balanceSheet[key])).toBe(true);
      expect(
        Object.isFrozen(source(result).balanceSheet[key].observations),
      ).toBe(true);
      expect(Object.isFrozen(row.filing)).toBe(true);
    }
    expect(Object.keys(view(result).balanceSheet.resolution).sort()).toEqual([
      "shareholdersEquity",
      "totalAssets",
      "totalLiabilities",
      "utilityAge",
    ]);
    expect(Object.isFrozen(view(result).balanceSheet.resolution)).toBe(true);
    expect(fetch.mock.calls.map(([input]) => url(input))).toEqual([
      SUBMISSIONS_URL,
      FACTS_URL,
    ]);
  });

  describe.each(identities)("%s source admission", (concept, key) => {
    it.each([
      ["absent", undefined, "concept_missing"],
      ["other unit", { units: { EUR: [instant()] } }, "usd_missing"],
      ["empty", usd([]), "empty_usd"],
      ["malformed", null, "invalid_response"],
      [
        "invalid decimal",
        usd([instant({ val: "120" })]),
        "invalid_source_rows",
      ],
      [
        "selected overflow",
        usd(Array.from({ length: 101 }, (_, val) => instant({ val }))),
        "selected_report_overflow",
      ],
      [
        "candidate overflow",
        usd(Array.from({ length: 10_001 }, () => instant())),
        "candidate_limit",
      ],
      ["duration", usd([fact()]), "invalid_instant_period"],
      ["non-FY", usd([instant({ fp: "Q4" })]), "missing_or_non_FY_focus"],
      ["amended form", usd([instant({ form: "10-K/A" })]), "unsupported_form"],
      [
        "filing conflict",
        usd([instant({ filed: "2026-02-02" })]),
        "filing_unmatched_or_conflicted",
      ],
      [
        "another report date",
        usd([instant({ end: "2024-12-31" })]),
        "no_report_date",
      ],
      [
        "conflicting values",
        usd([instant(), instant({ val: 121 })]),
        "ambiguous_value",
      ],
    ] as const)(
      "refuses %s only for that metric",
      async (_name, entry, reason) => {
        const { provider, fetch } = setup(() =>
          Response.json(balanceSheetFacts({ [concept]: entry })),
        );
        const result = await finish(provider.loadEvidence(CIK));
        expect(view(result).balanceSheet.resolution[key]).toMatchObject({
          status: "unavailable",
          unit: "USD",
          reason,
        });
        for (const [, sibling] of identities)
          if (sibling !== key)
            expect(view(result).balanceSheet.resolution[sibling].status).toBe(
              "available",
            );
        expect(result.generation.sources.companyFacts.status).toBe("available");
        expect(view(result).income.resolution.currentTargetEligible).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(2);
      },
    );

    it("retains every agreeing current reference and comparative row, with exact 64-character amount", async () => {
      const decimal = "9".repeat(64);
      const text = JSON.stringify(
        balanceSheetFacts({
          [concept]: usd([
            instant({ val: 42, frame: "CY2025Q4I" }),
            instant({ val: 42, frame: "CY2025Q4I" }),
            instant({ val: 42, frame: "CY2025" }),
            instant({ val: 9, end: "2024-12-31" }),
            instant({ val: 9, accn: OLDER }),
          ]),
        }),
      ).replaceAll('"val":42', `"val":${decimal}`);
      const { provider } = setup(() => new Response(text));
      const result = await finish(provider.loadEvidence(CIK));
      const metric = source(result).balanceSheet[key];
      expect(metric.scan).toMatchObject({
        coverage: {
          full: {
            candidateRows: 5,
            inspectedRows: 5,
            duplicateRows: 1,
            uniqueObservations: 4,
          },
          selected: 3,
          otherAccessions: 1,
          returned: 3,
          omittedSelected: 0,
        },
      });
      expect(metric.observations).toHaveLength(3);
      expect(view(result).balanceSheet.resolution[key]).toMatchObject({
        status: "available",
        value: decimal,
        observationIds: metric.observations
          .filter((row) => row.endDate === "2025-12-31")
          .map((row) => row.id),
      });
    });
  });

  it("does not substitute current totals, liabilities-and-equity, noncontrolling equity, IFRS or derived values", async () => {
    const packet = {
      cik: 42,
      facts: {
        "us-gaap": {
          AssetsCurrent: usd([instant()]),
          LiabilitiesCurrent: usd([instant()]),
          LiabilitiesAndStockholdersEquity: usd([instant()]),
          StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest:
            usd([instant()]),
        },
        "ifrs-full": {
          Assets: usd([instant()]),
          Liabilities: usd([instant()]),
          Equity: usd([instant()]),
        },
      },
    };
    const { provider, fetch } = setup(() => Response.json(packet));
    const result = await finish(provider.loadEvidence(CIK));
    for (const [, key] of identities)
      expect(view(result).balanceSheet.resolution[key]).toMatchObject({
        status: "unavailable",
        reason: "concept_missing",
        observationIds: [],
      });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("preserves the required closed graph when facts are unavailable", async () => {
    const { provider, fetch } = setup(
      () => new Response("unavailable", { status: 503 }),
    );
    const result = await finish(provider.loadEvidence(CIK));
    for (const [, key] of identities) {
      expect(source(result).balanceSheet[key]).toEqual({
        scan: { status: "source_unavailable", absence: null, coverage: null },
        observations: [],
      });
      expect(view(result).balanceSheet.resolution[key]).toMatchObject({
        status: "unavailable",
        reason: "source_unavailable",
      });
    }
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("explicit observed annual SEC evidence provider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("requires the existing SEC contact policy and performs no implicit reads", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    for (const contact of [
      undefined,
      "",
      "Mozilla/5.0",
      "Research a@example.test\r\nSecret: value",
    ]) {
      const provider = createSecPersonalAnnualEvidenceProvider(contact, {
        fetch,
      });
      expect(provider.status()).toEqual({ configured: false });
      await expect(provider.loadEvidence(CIK)).rejects.toMatchObject({
        code: "not_configured",
      });
    }
    expect(
      createSecPersonalAnnualEvidenceProvider(USER_AGENT, { fetch }).status(),
    ).toEqual({ configured: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    "42",
    "0000000000",
    "0000000042/evil",
    " 0000000042",
    "0000000042.0",
  ])("rejects noncanonical CIK %s before IO", async (cik) => {
    const { provider, fetch } = setup();
    await expect(provider.loadEvidence(cik)).rejects.toMatchObject({
      code: "invalid_request",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads only the two fixed sources in metadata-first order, preserves exact signed values and binds captured bytes", async () => {
    const factsText = JSON.stringify(companyFacts()).replace(
      '"val":120',
      '"val":1.20e2',
    );
    const submissionsText = JSON.stringify(submissions());
    const moments = [0, 100, 300, 400].map(
      (offset) => new Date(NOW.getTime() + offset),
    );
    const { provider, fetch, starts } = setup(
      () => new Response(factsText),
      () => new Response(submissionsText),
      () => moments.shift()!,
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(fetch.mock.calls.map(([input]) => url(input))).toEqual([
      SUBMISSIONS_URL,
      FACTS_URL,
    ]);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(220);
    for (const [, options] of fetch.mock.calls)
      expect(options).toMatchObject({
        method: "GET",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      });
    expect(result.target).toMatchObject({
      status: "target",
      accessionNumber: ACCESSION,
      reportDate: "2025-12-31",
    });
    expect(result.targetScan).toEqual({
      currentFilings: 1,
      annualFilings: 1,
      olderHistoryAvailable: true,
    });
    expect(result.generation).toMatchObject({
      cutoffAt: NOW.toISOString(),
      completedAt: "2026-09-20T12:00:00.400Z",
      sources: {
        companyFacts: {
          status: "available",
          fetchedAt: "2026-09-20T12:00:00.300Z",
          sha256: `sha256:${createHash("sha256").update(factsText).digest("hex")}`,
          bytes: Buffer.byteLength(factsText),
        },
        submissions: {
          status: "available",
          fetchedAt: "2026-09-20T12:00:00.100Z",
          sha256: `sha256:${createHash("sha256").update(submissionsText).digest("hex")}`,
        },
      },
    });
    expect(result.generation.sha256).toBe(
      `sha256:${createHash("sha256").update(serializePersonalSecAnnualCanonicalGeneration(result)).digest("hex")}`,
    );
    expect(view(result).income.reason).toBeNull();
    expect(
      view(result).income.resolution.bases.find(
        (basis) => basis.concept === "Revenues",
      ),
    ).toMatchObject({
      status: "eligible",
      pairs: [{ revenue: "120", netIncome: "-30", netMarginPercent: "-25" }],
    });
    expect(view(result).income.resolution.currentTargetEligible).toBe(true);
  });

  it("has no raw cache: each explicit refresh rereads both sources and binds new bytes", async () => {
    let amount = 120;
    const { provider, fetch } = setup(() =>
      Response.json(companyFacts([fact({ val: amount })])),
    );
    const first = await finish(provider.loadEvidence(CIK));
    amount = 150;
    const second = await finish(provider.loadEvidence(CIK));
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(second.generation.sha256).not.toBe(first.generation.sha256);
    expect(view(second).income.resolution.pairs[0]?.netMarginPercent).toBe(
      "-20",
    );
  });

  it("retains the complete selected graph beyond other-accession scans without claiming an all-accessions history", async () => {
    const history = Array.from({ length: 103 }, (_, index) =>
      fact({
        accn: `0000999999-26-${String(index + 100).padStart(6, "0")}`,
        end: "2026-01-01",
        filed: "2026-02-02",
      }),
    );
    const selected = [
      fact(),
      fact({ start: "2024-01-01", end: "2024-12-31" }),
      fact({ start: "2025-10-01", fp: "Q4" }),
      fact({ filed: "2026-02-02", val: 121 }),
    ];
    const { provider } = setup(() =>
      Response.json(companyFacts([...history, ...selected])),
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(view(result).income.coverage).toMatchObject({
      full: { inspectedRows: 108, uniqueObservations: 108 },
      selected: { observations: 5, revenue: 4, netIncome: 1 },
      otherAccessions: { observations: 103 },
      returned: { observations: 5 },
    });
    expect(Object.hasOwn(view(result).income.coverage!, "history")).toBe(false);
    expect(result.facts.observations).toHaveLength(5);
    expect(source(result).income.observations).toHaveLength(5);
    expect(
      source(result).income.observations.every(
        (row) => row.accessionNumber === ACCESSION,
      ),
    ).toBe(true);
    expect(
      source(result).income.observations.some(
        (row) => row.filing.status === "metadata_conflict",
      ),
    ).toBe(true);
    expect(
      source(result).income.observations.some(
        (row) => row.filingFocusPeriod === "Q4",
      ),
    ).toBe(true);
    expect(
      view(result).income.resolution.pairs.some(
        (pair) => pair.endDate === "2024-12-31",
      ),
    ).toBe(true);
    expect(view(result).income.resolution.selectedReportPairEligible).toBe(
      false,
    );
  });

  it("counts identical raw duplicates separately while retaining distinct agreeing references and their original first locators", async () => {
    const row = fact();
    const { provider } = setup(() =>
      Response.json(companyFacts([row, row, fact({ frame: "CY2025" })])),
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(view(result).income.coverage?.full).toMatchObject({
      inspectedRows: 4,
      invalidRows: 0,
      duplicateRows: 1,
      uniqueObservations: 3,
    });
    const revenues = source(result).income.observations.filter(
      (row) => row.concept !== "NetIncomeLoss",
    );
    expect(revenues).toHaveLength(2);
    expect(revenues.map((row) => row.sourceLocator)).toEqual(
      expect.arrayContaining([
        "/facts/us-gaap/Revenues/units/USD/0",
        "/facts/us-gaap/Revenues/units/USD/2",
      ]),
    );
    expect(view(result).income.resolution.pairs[0]).toMatchObject({
      status: "eligible",
      revenueObservationIds: revenues.map((row) => row.id),
    });
  });

  it("refuses numeric admission for any invalid raw row, including another accession after an otherwise eligible target", async () => {
    const { provider } = setup(() =>
      Response.json(companyFacts([fact(), fact({ accn: OLDER, val: "120" })])),
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(view(result).income.reason).toBe("invalid_source_rows");
    expect(result.facts.observations).toHaveLength(2);
    expect(source(result).income.summaryReturned.observations).toBe(0);
    expect(view(result).income.coverage).toMatchObject({
      full: { inspectedRows: 3, invalidRows: 1, uniqueObservations: 2 },
      selected: { observations: 2 },
      returned: { observations: 2 },
      omittedSelected: { observations: 0 },
    });
    expect(source(result).income.observations).toEqual([]);
    expect(
      view(result).income.resolution.bases.every(
        (basis) => basis.status === "withheld",
      ),
    ).toBe(true);
  });

  it.each([100, 101])(
    "enforces the collective revenue selected bound at %i without hiding rows through history capping",
    async (count) => {
      const rows = Array.from({ length: count }, (_, index) =>
        fact({ val: index + 1 }),
      );
      const { provider } = setup(() =>
        Response.json(
          companyFacts(rows.slice(0, 50), [fact({ val: -1 })], {
            SalesRevenueNet: { units: { USD: rows.slice(50) } },
          }),
        ),
      );
      const result = await finish(provider.loadEvidence(CIK));
      expect(view(result).income.coverage?.selected?.revenue).toBe(count);
      expect(result.facts.observations).toHaveLength(count + 1);
      expect(view(result).income.coverage?.returned.observations).toBe(
        count + 1,
      );
      expect(view(result).income.coverage?.omittedSelected?.observations).toBe(
        0,
      );
      expect(view(result).income.reason).toBe(
        count === 100 ? null : "selected_report_overflow",
      );
      expect(source(result).income.observations).toHaveLength(
        count === 100 ? 101 : 0,
      );
      if (count === 101)
        expect(view(result).income.reason).toBe("selected_report_overflow");
    },
  );

  it.each([100, 101])(
    "enforces the independent income selected bound at %i",
    async (count) => {
      const rows = Array.from({ length: count }, (_, index) =>
        fact({ val: -index }),
      );
      const { provider } = setup(() =>
        Response.json(companyFacts([fact()], rows)),
      );
      const result = await finish(provider.loadEvidence(CIK));
      expect(view(result).income.coverage?.selected?.netIncome).toBe(count);
      expect(result.facts.observations).toHaveLength(count === 100 ? 101 : 1);
      expect(view(result).income.coverage?.returned.observations).toBe(
        count === 100 ? 101 : 1,
      );
      expect(view(result).income.coverage?.omittedSelected?.netIncome).toBe(
        count === 100 ? 0 : 101,
      );
      expect(source(result).income.observations).toHaveLength(
        count === 100 ? 101 : 0,
      );
      expect(view(result).income.reason).toBe(
        count === 100 ? null : "selected_report_overflow",
      );
    },
  );

  it("selects the newest observed report before values and never substitutes an older eligible filing", async () => {
    const { provider } = setup(
      () =>
        Response.json(
          companyFacts(
            [
              fact(),
              fact({
                accn: OLDER,
                start: "2024-01-01",
                end: "2024-12-31",
                filed: "2025-02-01",
                fy: 2024,
              }),
            ],
            [
              fact({
                accn: OLDER,
                start: "2024-01-01",
                end: "2024-12-31",
                filed: "2025-02-01",
                fy: 2024,
                val: 30,
              }),
            ],
          ),
        ),
      () =>
        Response.json(
          submissions({
            accessionNumber: [OLDER, ACCESSION],
            form: ["10-K", "10-K"],
            filingDate: ["2025-02-01", "2026-02-01"],
            reportDate: ["2024-12-31", "2025-12-31"],
            acceptanceDateTime: [
              "2025-02-01T12:00:00.000Z",
              "2026-02-01T12:00:00.000Z",
            ],
          }),
        ),
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(result.target).toMatchObject({ accessionNumber: ACCESSION });
    expect(source(result).income.observations).toHaveLength(1);
    expect(view(result).income.resolution.pairs[0]?.status).toBe(
      "income_missing_same_filing_period",
    );
    expect(view(result).income.resolution.selectedReportPairEligible).toBe(
      false,
    );
  });

  it("reports a complete empty selected set as missing bases rather than manufacturing financial data", async () => {
    const { provider } = setup(() => Response.json(companyFacts([], [])));
    const result = await finish(provider.loadEvidence(CIK));
    expect(view(result).income.reason).toBeNull();
    expect(view(result).income.coverage?.selected).toEqual({
      observations: 0,
      revenue: 0,
      netIncome: 0,
    });
    expect(
      view(result).income.resolution.bases.map((basis) => basis.status),
    ).toEqual(["missing", "missing", "missing"]);
  });

  it("reports unresolved current Submissions without inferring an empty target selection, while truthfully scanning both sources", async () => {
    const { provider, fetch } = setup(undefined, () =>
      Response.json(
        submissions({
          accessionNumber: [],
          form: [],
          filingDate: [],
          reportDate: [],
          acceptanceDateTime: [],
        }),
      ),
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(view(result).income.reason).toBe("target_unresolved");
    expect(view(result).income.coverage).toMatchObject({
      full: { inspectedRows: 2 },
      selected: null,
      otherAccessions: null,
      omittedSelected: null,
    });
    expect(source(result).income.observations).toEqual([]);
  });

  it.each([
    [
      "same-day missing acceptance",
      { filingDate: ["2026-09-20"], acceptanceDateTime: [""] },
      "cutoff_time_unresolved",
    ],
    [
      "after cutoff",
      {
        filingDate: ["2026-09-20"],
        acceptanceDateTime: ["2026-09-20T12:00:00.001Z"],
      },
      "no_observed_annual_target",
    ],
    ["missing report date", { reportDate: [""] }, "target_missing_report_date"],
    [
      "unsupported amendment",
      { form: ["10-K/A"] },
      "no_observed_annual_target",
    ],
  ] as const)(
    "keeps metadata refusal for %s",
    async (_name, overrides, reason) => {
      const { provider } = setup(undefined, () =>
        Response.json(submissions(overrides)),
      );
      const result = await finish(provider.loadEvidence(CIK));
      expect(result.target).toEqual({ status: "unresolved", reason });
      expect(view(result).income.resolution.currentTargetEligible).toBe(false);
    },
  );

  it("refuses tied current annual targets instead of choosing by values or response order", async () => {
    const { provider } = setup(undefined, () =>
      Response.json(
        submissions({
          accessionNumber: [ACCESSION, "0000999999-26-000002"],
          form: ["10-K", "10-K"],
          filingDate: ["2026-02-01", "2026-02-01"],
          reportDate: ["2025-12-31", "2025-12-31"],
          acceptanceDateTime: ["2026-02-01T12:00:00Z", "2026-02-01T13:00:00Z"],
        }),
      ),
    );
    expect((await finish(provider.loadEvidence(CIK))).target).toEqual({
      status: "unresolved",
      reason: "target_ambiguous",
    });
  });

  it.each([
    [
      "malformed JSON",
      () => new Response('{"private-canary"'),
      "invalid_response",
      true,
    ],
    [
      "wrong CIK",
      () => Response.json({ ...companyFacts(), cik: 43 }),
      "invalid_response",
      true,
    ],
    [
      "invalid UTF8",
      () => new Response(new Uint8Array([0xc3, 0x28])),
      "invalid_response",
      true,
    ],
    [
      "404",
      () => new Response("private-canary", { status: 404 }),
      "not_covered",
      false,
    ],
    [
      "429",
      () => new Response("private-canary", { status: 429 }),
      "rate_limited",
      false,
    ],
    [
      "503",
      () => new Response("private-canary", { status: 503 }),
      "upstream_unavailable",
      false,
    ],
    [
      "body cap",
      () => new Response(" ".repeat(LIMITS.responseBytes + 1)),
      "response_too_large",
      false,
    ],
  ] as const)(
    "retains truthful source failure metadata for %s",
    async (_name, response, status, captured) => {
      const { provider, fetch } = setup(response);
      const result = await finish(provider.loadEvidence(CIK));
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result.generation.sources.companyFacts.status).toBe(status);
      expect(result.generation.sources.companyFacts.sha256 === null).toBe(
        !captured,
      );
      expect(result.generation.sources.companyFacts.fetchedAt === null).toBe(
        !captured,
      );
      expect(view(result).income.coverage).toBeNull();
      expect(view(result).income.reason).toBe("source_unavailable");
      expect(source(result).income.observations).toEqual([]);
      expect(view(result).income.scanStatus).toBe("source_unavailable");
      expect(result.facts.scans).toHaveLength(32);
      expect(
        result.facts.scans.every(
          ({ scan }) =>
            scan.status === "source_unavailable" && scan.coverage === null,
        ),
      ).toBe(true);
      expect(source(result).cashGeneration.operatingCashFlow.scan.status).toBe(
        "source_unavailable",
      );
      expect(
        view(result).cashGeneration.resolution
          .operatingCashFlowLessPpePurchases,
      ).toMatchObject({ status: "unavailable", reason: "source_unavailable" });
      expect(JSON.stringify(result)).not.toContain("private-canary");
    },
  );

  it("joins independent exact cash rows to the selected filing without adding source reads", async () => {
    const text = JSON.stringify(
      companyFacts(undefined, undefined, {
        NetCashProvidedByUsedInOperatingActivities: {
          units: { USD: [fact({ val: 42 }), fact({ accn: OLDER, val: 500 })] },
        },
        PaymentsToAcquirePropertyPlantAndEquipment: {
          units: { USD: [fact({ val: 41 })] },
        },
      }),
    )
      .replace('"val":42', '"val":-0.000000000000000002')
      .replace('"val":41', '"val":1.000000000000000001');
    const { provider, fetch } = setup(() => new Response(text));
    const result = await finish(provider.loadEvidence(CIK));
    const cash = source(result).cashGeneration;
    expect(fetch.mock.calls.map(([input]) => url(input))).toEqual([
      SUBMISSIONS_URL,
      FACTS_URL,
    ]);
    expect(result.generation.definitionVersion).toBe("6.0.0");
    expect(view(result).income.scanStatus).toBe("available");
    expect(cash.operatingCashFlow.scan).toMatchObject({
      coverage: {
        full: { candidateRows: 2 },
        selected: 1,
        otherAccessions: 1,
        returned: 1,
        omittedSelected: 0,
      },
    });
    expect(cash.operatingCashFlow.observations[0]).toMatchObject({
      value: "-0.000000000000000002",
      filing: {
        status: "matched",
        reportDate: "2025-12-31",
        acceptedAt: "2026-02-01T12:00:00.000Z",
      },
    });
    expect(
      view(result).cashGeneration.resolution.operatingCashFlowLessPpePurchases,
    ).toEqual({
      status: "available",
      value: "-1.000000000000000003",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      accessionNumber: ACCESSION,
      observationIds: [
        cash.operatingCashFlow.observations[0]!.id,
        cash.ppePurchases.observations[0]!.id,
      ],
      currentUseEligible: true,
    });
    expect(view(result).income.resolution.currentTargetEligible).toBe(true);
  });

  it.each(["invalid_response", "candidate_limit"] as const)(
    "retains cash evidence when the income scan has %s",
    async (status) => {
      const extras = {
        Revenues:
          status === "invalid_response"
            ? null
            : {
                units: {
                  USD: Array.from({ length: LIMITS.candidateRows + 1 }, () =>
                    fact(),
                  ),
                },
              },
        NetCashProvidedByUsedInOperatingActivities: {
          units: { USD: [fact({ val: 9 })] },
        },
        PaymentsToAcquirePropertyPlantAndEquipment: {
          units: { USD: [fact({ val: 4 })] },
        },
      };
      const { provider } = setup(() =>
        Response.json(companyFacts([], [], extras)),
      );
      const result = await finish(provider.loadEvidence(CIK));
      expect(result.generation.sources.companyFacts.status).toBe("available");
      expect(result.generation.sources.companyFacts.sha256).toMatch(
        /^sha256:/u,
      );
      expect(view(result).income.scanStatus).toBe(status);
      expect(view(result).income.coverage).toBeNull();
      expect(view(result).income.reason).toBe(status);
      expect(
        view(result).cashGeneration.resolution
          .operatingCashFlowLessPpePurchases,
      ).toMatchObject({ status: "available", value: "5" });
    },
  );

  it("retains income and PP&E when operating cash flow is malformed, without accepting an invalid cash value", async () => {
    const { provider } = setup(() =>
      Response.json(
        companyFacts(undefined, undefined, {
          NetCashProvidedByUsedInOperatingActivities: {
            units: { USD: [fact({ val: "120" }), fact({ val: 9 })] },
          },
          PaymentsToAcquirePropertyPlantAndEquipment: {
            units: { USD: [fact({ val: 4 })] },
          },
        }),
      ),
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(view(result).income.resolution.currentTargetEligible).toBe(true);
    expect(source(result).cashGeneration.operatingCashFlow.scan).toMatchObject({
      coverage: { full: { invalidRows: 1 }, returned: 1 },
    });
    expect(
      source(result).cashGeneration.operatingCashFlow.observations,
    ).toHaveLength(1);
    expect(
      view(result).cashGeneration.resolution.operatingCashFlow,
    ).toMatchObject({
      status: "unavailable",
      reason: "invalid_source_rows",
    });
    expect(view(result).cashGeneration.resolution.ppePurchases).toMatchObject({
      status: "available",
      value: "4",
    });
  });

  it("rejects over-cap or conflicting Submissions before selecting a target", async () => {
    for (const packet of [
      submissions({
        accessionNumber: Array.from(
          { length: LIMITS.submissionRows + 1 },
          () => ACCESSION,
        ),
      }),
      submissions({
        accessionNumber: [ACCESSION, ACCESSION],
        form: ["10-K", "10-K"],
        filingDate: ["2026-02-01", "2026-02-02"],
        reportDate: ["2025-12-31", "2025-12-31"],
        acceptanceDateTime: ["2026-02-01T12:00:00Z", "2026-02-02T12:00:00Z"],
      }),
    ]) {
      const { provider } = setup(undefined, () => Response.json(packet));
      const result = await finish(provider.loadEvidence(CIK));
      expect(result.generation.sources.submissions.status).not.toBe(
        "available",
      );
      expect(result.targetScan).toBeNull();
      expect(view(result).income.reason).toBe("source_unavailable");
    }
  });

  it.each([
    [101, "selected_report_overflow"],
    [10_001, "candidate_limit"],
  ] as const)(
    "refuses %i operating cash-flow rows without clipping, losing income or PP&E",
    async (length, reason) => {
      const { provider } = setup(() =>
        Response.json(
          companyFacts(undefined, undefined, {
            NetCashProvidedByUsedInOperatingActivities: {
              units: { USD: Array.from({ length }, (_, val) => fact({ val })) },
            },
            PaymentsToAcquirePropertyPlantAndEquipment: {
              units: { USD: [fact({ val: 4 })] },
            },
          }),
        ),
      );
      const result = await finish(provider.loadEvidence(CIK));
      expect(result.generation.sources.companyFacts.status).toBe("available");
      expect(view(result).income.resolution.currentTargetEligible).toBe(true);
      expect(
        source(result).cashGeneration.operatingCashFlow.observations,
      ).toEqual([]);
      expect(
        view(result).cashGeneration.resolution.operatingCashFlow,
      ).toMatchObject({
        status: "unavailable",
        reason,
      });
      expect(view(result).cashGeneration.resolution.ppePurchases).toMatchObject(
        {
          status: "available",
          value: "4",
        },
      );
    },
  );

  it.each([0, 1, 2, 3])(
    "rejects an invalid operation clock at capture %i without emitting annual data",
    async (index) => {
      let calls = 0;
      const { provider } = setup(undefined, undefined, () =>
        calls++ === index ? new Date(NaN) : NOW,
      );
      const pending = provider.loadEvidence(CIK);
      const assertion = expect(pending).rejects.toMatchObject({
        code: "invalid_request",
      });
      await vi.runAllTimersAsync();
      await assertion;
    },
  );

  it.each([1, 2, 3])(
    "rejects a backwards clock at capture %i",
    async (index) => {
      let calls = 0;
      const { provider } = setup(
        undefined,
        undefined,
        () => new Date(NOW.getTime() + (calls++ === index ? -1 : 0)),
      );
      const assertion = expect(
        provider.loadEvidence(CIK),
      ).rejects.toMatchObject({ code: "invalid_request" });
      await vi.runAllTimersAsync();
      await assertion;
    },
  );

  it("keeps complete source counts but withholds stale capture numeric output", async () => {
    const moments = [NOW, NOW, NOW, new Date(NOW.getTime() + 8 * 86_400_000)];
    const { provider } = setup(undefined, undefined, () => moments.shift()!);
    const result = await finish(provider.loadEvidence(CIK));
    expect(view(result).income.reason).toBe("source_stale");
    expect(result.facts.observations).toHaveLength(2);
    expect(view(result).income.coverage?.selected?.observations).toBe(2);
    expect(source(result).income.observations).toEqual([]);
  });

  it("rejects concurrent work, aborts an uncooperative held fetch, then permits a new explicit load", async () => {
    let release!: (response: Response) => void;
    const { provider, fetch } = setup();
    fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const controller = new AbortController();
    const pending = provider.loadEvidence(CIK, controller.signal);
    await vi.advanceTimersByTimeAsync(0);
    await expect(provider.loadEvidence(CIK)).rejects.toMatchObject({
      code: "busy",
    });
    const assertion = expect(pending).rejects.toMatchObject({
      code: "aborted",
    });
    controller.abort();
    await assertion;
    release(Response.json(submissions()));
    const next = await finish(provider.loadEvidence(CIK));
    expect(view(next).income.reason).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("bounds a stalled transport at ten seconds without retrying or applying its later response", async () => {
    const { provider, fetch } = setup();
    fetch.mockImplementationOnce(() => new Promise<Response>(() => undefined));
    const result = await finish(provider.loadEvidence(CIK));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.generation.sources.submissions).toMatchObject({
      status: "upstream_unavailable",
      fetchedAt: null,
      sha256: null,
      bytes: null,
    });
    expect(result.target.status).toBe("unresolved");
  });

  it("closes and cancels queued work without dispatching a source request", async () => {
    const scheduler: PersonalSecRequestScheduler = {
      wait: (signal) =>
        new Promise<void>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new PersonalSecRequestSchedulerError("aborted")),
            { once: true },
          );
        }),
    };
    const { provider, fetch } = setup(
      undefined,
      undefined,
      undefined,
      scheduler,
    );
    const assertion = expect(provider.loadEvidence(CIK)).rejects.toBeInstanceOf(
      PersonalSecAnnualEvidenceProviderError,
    );
    provider.close();
    await assertion;
    expect(provider.status()).toEqual({ configured: false });
    await expect(provider.loadEvidence(CIK)).rejects.toMatchObject({
      code: "aborted",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  const instant = (overrides: Record<string, unknown> = {}) =>
    fact({ start: undefined, ...overrides });
  const liquidityFacts = (extras: Parameters<typeof companyFacts>[2] = {}) =>
    companyFacts(undefined, undefined, {
      AssetsCurrent: { units: { USD: [instant({ val: 120 })] } },
      LiabilitiesCurrent: { units: { USD: [instant({ val: 80 })] } },
      NetCashProvidedByUsedInOperatingActivities: {
        units: { USD: [fact({ val: 9 })] },
      },
      PaymentsToAcquirePropertyPlantAndEquipment: {
        units: { USD: [fact({ val: 4 })] },
      },
      ...extras,
    });

  it("joins exact instant filing evidence and calculates liquidity from the same two source packets", async () => {
    const { provider, fetch } = setup(() => Response.json(liquidityFacts()));
    const result = await finish(provider.loadEvidence(CIK));
    expect(fetch.mock.calls.map(([input]) => url(input))).toEqual([
      SUBMISSIONS_URL,
      FACTS_URL,
    ]);
    expect(
      source(result).liquidity.currentAssets.observations[0],
    ).toMatchObject({
      concept: "AssetsCurrent",
      startDate: null,
      durationDays: null,
      endDate: "2025-12-31",
      value: "120",
      sourceLocator: "/facts/us-gaap/AssetsCurrent/units/USD/0",
      filing: {
        status: "matched",
        reportDate: "2025-12-31",
        filedDate: "2026-02-01",
        acceptedAt: "2026-02-01T12:00:00.000Z",
        sourceUrl:
          "https://www.sec.gov/Archives/edgar/data/42/0000999999-26-000001-index.htm",
      },
    });
    expect(view(result).liquidity.resolution).toMatchObject({
      currentAssets: {
        status: "available",
        unit: "USD",
        value: "120",
        asOfDate: "2025-12-31",
        accessionNumber: ACCESSION,
      },
      currentLiabilities: {
        status: "available",
        value: "80",
        asOfDate: "2025-12-31",
      },
      workingCapital: {
        status: "available",
        unit: "USD",
        value: "40",
        currentUseEligible: true,
      },
      currentRatio: {
        status: "available",
        unit: "multiple",
        value: "1.50",
        currentUseEligible: true,
      },
    });
    expect(view(result).income.resolution.currentTargetEligible).toBe(true);
    expect(
      view(result).cashGeneration.resolution.operatingCashFlowLessPpePurchases,
    ).toMatchObject({ status: "available", value: "5" });
  });

  it.each([
    ["missing", undefined, "concept_missing"],
    ["malformed", null, "invalid_response"],
    [
      "invalid row",
      { units: { USD: [instant({ val: "120" }), instant()] } },
      "invalid_source_rows",
    ],
    [
      "selected cap",
      {
        units: {
          USD: Array.from({ length: 101 }, (_, val) => instant({ val })),
        },
      },
      "selected_report_overflow",
    ],
    [
      "candidate cap",
      { units: { USD: Array.from({ length: 10_001 }, () => instant()) } },
      "candidate_limit",
    ],
    [
      "comparative only",
      { units: { USD: [instant({ end: "2024-12-31" })] } },
      "no_report_date",
    ],
    ["duration shaped", { units: { USD: [fact()] } }, "invalid_instant_period"],
    [
      "filing conflict",
      { units: { USD: [instant({ filed: "2026-02-02" })] } },
      "filing_unmatched_or_conflicted",
    ],
    [
      "conflicting values",
      { units: { USD: [instant(), instant({ val: 121 })] } },
      "ambiguous_value",
    ],
  ] as const)(
    "isolates %s assets without losing liabilities, income or cash",
    async (_label, entry, reason) => {
      const { provider, fetch } = setup(() =>
        Response.json(liquidityFacts({ AssetsCurrent: entry })),
      );
      const result = await finish(provider.loadEvidence(CIK));
      expect(result.generation.sources.companyFacts.status).toBe("available");
      expect(view(result).liquidity.resolution.currentAssets).toMatchObject({
        status: "unavailable",
        reason,
      });
      expect(
        view(result).liquidity.resolution.currentLiabilities,
      ).toMatchObject({
        status: "available",
        value: "80",
      });
      expect(view(result).liquidity.resolution.workingCapital.status).toBe(
        "unavailable",
      );
      expect(view(result).income.resolution.currentTargetEligible).toBe(true);
      expect(
        view(result).cashGeneration.resolution
          .operatingCashFlowLessPpePurchases,
      ).toMatchObject({ status: "available", value: "5" });
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it("admits instant balances when income and cash scans independently fail", async () => {
    const { provider } = setup(() =>
      Response.json(
        liquidityFacts({
          Revenues: null,
          NetCashProvidedByUsedInOperatingActivities: null,
        }),
      ),
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(view(result).income.scanStatus).toBe("invalid_response");
    expect(source(result).cashGeneration.operatingCashFlow.scan.status).toBe(
      "invalid_response",
    );
    expect(view(result).liquidity.resolution.workingCapital).toMatchObject({
      status: "available",
      value: "40",
    });
    expect(view(result).liquidity.resolution.currentRatio).toMatchObject({
      status: "available",
      value: "1.50",
    });
  });

  it("retains all selected comparative evidence but resolves only the target date", async () => {
    const { provider } = setup(() =>
      Response.json(
        liquidityFacts({
          AssetsCurrent: {
            units: {
              USD: [
                instant({ end: "2024-12-31", val: 5 }),
                instant({ val: 120 }),
                instant({ val: 120 }),
                instant({ accn: OLDER, val: 999 }),
              ],
            },
          },
        }),
      ),
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(source(result).liquidity.currentAssets.scan).toMatchObject({
      coverage: {
        full: { candidateRows: 4, duplicateRows: 1 },
        selected: 2,
        otherAccessions: 1,
        returned: 2,
      },
    });
    expect(
      source(result).liquidity.currentAssets.observations.map(
        (row) => row.endDate,
      ),
    ).toEqual(["2025-12-31", "2024-12-31"]);
    expect(view(result).liquidity.resolution.currentAssets).toMatchObject({
      status: "available",
      value: "120",
      observationIds: [
        source(result).liquidity.currentAssets.observations[0]!.id,
      ],
    });
  });

  it("preserves three exact reported balance dates independently of refused income evidence in the same two reads", async () => {
    const dates = ["2025-12-31", "2024-12-28", "2023-12-30"];
    const { provider, fetch } = setup(() =>
      Response.json(
        companyFacts([fact({ val: "invalid" })], [], {
          AssetsCurrent: {
            units: {
              USD: dates.map((end, index) =>
                instant({ end, val: [120.125, -5, 0][index] }),
              ),
            },
          },
          LiabilitiesCurrent: {
            units: {
              USD: dates.map((end, index) =>
                instant({ end, val: [180.025, 2, 0][index] }),
              ),
            },
          },
        }),
      ),
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(fetch.mock.calls.map(([input]) => url(input))).toEqual([
      SUBMISSIONS_URL,
      FACTS_URL,
    ]);
    expect(view(result).income.coverage?.full.invalidRows).toBe(1);
    expect(
      source(result).liquidity.currentAssets.observations.map(
        (row) => row.endDate,
      ),
    ).toEqual(dates);
    expect(
      source(result).liquidity.currentLiabilities.observations.map(
        (row) => row.endDate,
      ),
    ).toEqual(dates);
    expect(
      source(result).liquidity.currentAssets.observations.every(
        (row) => row.filing.reportDate === "2025-12-31",
      ),
    ).toBe(true);
    expect(view(result).liquidity.resolution.currentAssets).toMatchObject({
      status: "available",
      value: "120.125",
    });
    expect(view(result).liquidity.history).toMatchObject({
      status: "available",
      balances: [
        {
          asOfDate: dates[0],
          currentAssets: "120.125",
          workingCapital: { status: "available", value: "-59.9" },
          currentRatio: { status: "available", value: "0.67" },
        },
        {
          asOfDate: dates[1],
          currentAssets: "-5",
          workingCapital: { status: "unavailable", reason: "unsupported_sign" },
        },
        {
          asOfDate: dates[2],
          currentAssets: "0",
          workingCapital: { status: "available", value: "0" },
          currentRatio: {
            status: "unavailable",
            reason: "nonpositive_current_liabilities",
          },
        },
      ],
      stopped: null,
    });
    expect(result.generation.cutoffAt).toBe(NOW.toISOString());
  });

  it("preserves lossless operands and long derived values without the source-input length cap", async () => {
    const integer = "9".repeat(64),
      tiny = `0.${"0".repeat(61)}1`;
    const text = JSON.stringify(
      liquidityFacts({
        AssetsCurrent: { units: { USD: [instant({ val: 42 })] } },
        LiabilitiesCurrent: { units: { USD: [instant({ val: 43 })] } },
      }),
    )
      .replace('"val":42', `"val":${integer}`)
      .replace('"val":43', `"val":${tiny}`);
    const { provider } = setup(() => new Response(text));
    const result = await finish(provider.loadEvidence(CIK));
    expect(view(result).liquidity.resolution.currentAssets).toMatchObject({
      status: "available",
      value: integer,
    });
    expect(view(result).liquidity.resolution.currentLiabilities).toMatchObject({
      status: "available",
      value: tiny,
    });
    expect(view(result).liquidity.resolution.workingCapital).toMatchObject({
      status: "available",
      value: `${"9".repeat(63)}8.${"9".repeat(62)}`,
    });
    expect(view(result).liquidity.resolution.currentRatio).toMatchObject({
      status: "available",
      value: `${integer}${"0".repeat(62)}.00`,
    });
  });

  it("retains negative reported balances and independently refuses dependent calculations", async () => {
    const { provider } = setup(() =>
      Response.json(
        liquidityFacts({
          AssetsCurrent: { units: { USD: [instant({ val: -1 })] } },
        }),
      ),
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(view(result).liquidity.resolution.currentAssets).toMatchObject({
      status: "available",
      value: "-1",
    });
    expect(view(result).liquidity.resolution.currentLiabilities).toMatchObject({
      status: "available",
      value: "80",
    });
    expect(view(result).liquidity.resolution.workingCapital).toMatchObject({
      status: "unavailable",
      reason: "unsupported_sign",
    });
    expect(view(result).liquidity.resolution.currentRatio).toMatchObject({
      status: "unavailable",
      reason: "unsupported_sign",
    });
  });

  it("retains historical instant balances with captured age and refuses stale source use", async () => {
    const historical = setup(
      () => Response.json(liquidityFacts()),
      undefined,
      () => new Date("2027-06-01T12:00:00.000Z"),
    );
    const old = await finish(historical.provider.loadEvidence(CIK));
    expect(view(old).liquidity.resolution.currentAssets).toMatchObject({
      status: "available",
      asOfDate: "2025-12-31",
      currentUseEligible: false,
    });
    const moments = [NOW, NOW, NOW, new Date(NOW.getTime() + 8 * 86_400_000)];
    const stale = setup(
      () => Response.json(liquidityFacts()),
      undefined,
      () => moments.shift()!,
    );
    const result = await finish(stale.provider.loadEvidence(CIK));
    expect(source(result).liquidity.currentAssets.observations).toHaveLength(1);
    expect(view(result).liquidity.resolution.currentAssets).toMatchObject({
      status: "unavailable",
      reason: "source_stale",
    });
  });

  it("does not manufacture balances when the shared source envelope or Submissions fails", async () => {
    const invalid = setup(() => Response.json({ cik: 7, facts: {} }));
    const result = await finish(invalid.provider.loadEvidence(CIK));
    expect(result.generation.sources.companyFacts.status).toBe(
      "invalid_response",
    );
    expect(source(result).liquidity.currentAssets).toMatchObject({
      scan: { status: "source_unavailable", coverage: null },
      observations: [],
    });
    expect(view(result).liquidity.resolution.currentRatio).toMatchObject({
      status: "unavailable",
      reason: "source_unavailable",
    });
    const noTarget = setup(
      () => Response.json(liquidityFacts()),
      () => new Response("{invalid"),
    );
    const failed = await finish(noTarget.provider.loadEvidence(CIK));
    expect(source(failed).liquidity.currentAssets).toMatchObject({
      scan: { coverage: { selected: null, returned: 0 } },
      observations: [],
    });
    expect(noTarget.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("canonical annual statement provider graph", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures all 32 concepts once and resolves three flow years and two balance dates from exact signed source values", async () => {
    const positive = "9007199254740993.000000000000000001";
    const negative = "-9007199254740993.000000000000000003";
    const negativeConcepts = new Set<PersonalSecAnnualStatementConcept>([
      "NetIncomeLoss",
      "StockholdersEquity",
      "NetCashProvidedByUsedInInvestingActivities",
    ]);
    const taxonomy = Object.fromEntries(
      PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map((entry) => [
        entry.concept,
        {
          units: {
            USD: (entry.periodType === "duration"
              ? [2025, 2024, 2023]
              : [2025, 2024]
            ).map((year) =>
              fact({
                start:
                  entry.periodType === "duration" ? year + "-01-01" : undefined,
                end: year + "-12-31",
                val: negativeConcepts.has(entry.concept) ? negative : positive,
              }),
            ),
          },
        },
      ]),
    );
    const body = JSON.stringify({ cik: 42, facts: { "us-gaap": taxonomy } })
      .replaceAll('"' + positive + '"', positive)
      .replaceAll('"' + negative + '"', negative);
    const { provider, fetch, starts } = setup(
      () =>
        new Response(body, { headers: { "content-type": "application/json" } }),
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(fetch.mock.calls.map(([input]) => url(input))).toEqual([
      SUBMISSIONS_URL,
      FACTS_URL,
    ]);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(220);
    expect(Object.keys(result)).toEqual([
      "cik",
      "generation",
      "target",
      "targetScan",
      "facts",
    ]);
    expect(result.generation.definitionVersion).toBe("6.0.0");
    expect(result.generation.sources.companyFacts).toMatchObject({
      status: "available",
      bytes: Buffer.byteLength(body),
      sha256: digest(body),
    });
    expect(result.generation.sha256).toBe(
      digest(serializePersonalSecAnnualCanonicalGeneration(result)),
    );
    expect(result.facts.scans.map(({ concept }) => concept)).toEqual(
      PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map((entry) => entry.concept),
    );
    expect(result.facts.scans).toHaveLength(32);
    expect(result.facts.observations).toHaveLength(
      PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.reduce(
        (count, entry) => count + (entry.periodType === "duration" ? 3 : 2),
        0,
      ),
    );
    expect(new Set(result.facts.observations.map((row) => row.id)).size).toBe(
      result.facts.observations.length,
    );
    for (const row of result.facts.observations) {
      expect(row.value).toBe(
        negativeConcepts.has(row.concept) ? negative : positive,
      );
      expect(row.id).toBe(
        digest(serializePersonalSecAnnualStatementObservation(row)).replace(
          "sha256:",
          "sec-fact:",
        ),
      );
      expect(row.filing.status).toBe("matched");
      expect(Object.hasOwn(row, "metric")).toBe(false);
      expect(Object.isFrozen(row)).toBe(true);
      expect(Object.isFrozen(row.filing)).toBe(true);
    }
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.facts)).toBe(true);
    expect(Object.isFrozen(result.facts.observations)).toBe(true);
    expect(Object.isFrozen(result.facts.scans)).toBe(true);
    for (const { scan } of result.facts.scans) {
      expect(scan.status).toBe("available");
      expect(Object.isFrozen(scan)).toBe(true);
      expect(Object.isFrozen(scan.coverage)).toBe(true);
    }
    const statements = view(result).statements;
    expect(statements.contextReason).toBeNull();
    expect(statements.statements.map((statement) => statement.id)).toEqual([
      "income_statement",
      "balance_sheet",
      "cash_flow",
    ]);
    for (const statement of statements.statements) {
      expect(statement.columns.map((column) => column.endDate)).toEqual(
        statement.id === "balance_sheet"
          ? ["2025-12-31", "2024-12-31"]
          : ["2025-12-31", "2024-12-31", "2023-12-31"],
      );
      for (const row of statement.rows)
        for (const [index, cell] of row.cells.entries()) {
          expect(cell).toMatchObject({
            status: "available",
            value: negativeConcepts.has(row.concept) ? negative : positive,
            currentUseEligible: index === 0,
            startDate:
              statement.id === "balance_sheet"
                ? null
                : cell.endDate.slice(0, 4) + "-01-01",
          });
          expect(cell.observationIds).toHaveLength(1);
          expect(
            result.facts.observations.find(
              (observation) => observation.id === cell.observationIds[0],
            )?.concept,
          ).toBe(row.concept);
        }
    }
    const revenues = statements.statements[0]!.rows.filter(
      (row) => row.lineId === "income.revenue",
    );
    expect(revenues.map((row) => row.concept)).toEqual([
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ]);
    expect(
      new Set(revenues.map((row) => row.cells[0]!.observationIds[0])).size,
    ).toBe(3);
    expect(
      source(result).cashGeneration.operatingCashFlow.observations[0],
    ).toBe(
      result.facts.observations.find(
        (row) => row.concept === "NetCashProvidedByUsedInOperatingActivities",
      ),
    );
  });

  it.each([101, 10001])(
    "withholds an entire added statement concept at %i rows while keeping independent cells and the original source hash",
    async (count) => {
      const body = JSON.stringify(
        companyFacts(undefined, undefined, {
          GrossProfit: {
            units: {
              USD: Array.from({ length: count }, (_, index) =>
                fact({ val: index + 1 }),
              ),
            },
          },
          CostOfRevenue: { units: { USD: [fact({ val: 0 })] } },
          NetCashProvidedByUsedInOperatingActivities: {
            units: { USD: [fact({ val: 9 })] },
          },
          PaymentsToAcquirePropertyPlantAndEquipment: {
            units: { USD: [fact({ val: 4 })] },
          },
        }),
      );
      const { provider, fetch } = setup(() => new Response(body));
      const result = await finish(provider.loadEvidence(CIK));
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result.generation.sources.companyFacts).toMatchObject({
        status: "available",
        bytes: Buffer.byteLength(body),
        sha256: digest(body),
      });
      expect(
        result.facts.observations.some((row) => row.concept === "GrossProfit"),
      ).toBe(false);
      const scan = result.facts.scans.find(
        (entry) => entry.concept === "GrossProfit",
      )!.scan;
      expect(scan).toEqual(
        count === 101
          ? {
              status: "available",
              absence: null,
              coverage: {
                full: {
                  candidateRows: 101,
                  inspectedRows: 101,
                  invalidRows: 0,
                  duplicateRows: 0,
                  uniqueObservations: 101,
                },
                selected: 101,
                otherAccessions: 0,
                returned: 0,
                omittedSelected: 101,
              },
            }
          : { status: "candidate_limit", absence: null, coverage: null },
      );
      const income = view(result).statements.statements.find(
        (statement) => statement.id === "income_statement",
      )!;
      expect(
        income.rows.find((row) => row.concept === "GrossProfit")!.cells[0],
      ).toMatchObject({
        status: "unavailable",
        reason: count === 101 ? "selected_report_overflow" : "candidate_limit",
        observationIds: [],
      });
      expect(
        income.rows.find((row) => row.concept === "CostOfRevenue")!.cells[0],
      ).toMatchObject({ status: "available", value: "0" });
      expect(view(result).income.reason).toBeNull();
      expect(
        view(result).cashGeneration.resolution
          .operatingCashFlowLessPpePurchases,
      ).toMatchObject({ status: "available", value: "5" });
    },
  );

  it("retains independent concept counts and cash when the effective income scan exceeds the unchanged 20000-row ceiling", async () => {
    const other = Array.from({ length: 10000 }, (_, index) =>
      fact({ accn: OLDER, val: index + 1 }),
    );
    const body = JSON.stringify(
      companyFacts(other, [fact({ val: -1 })], {
        SalesRevenueNet: { units: { USD: other } },
        NetCashProvidedByUsedInOperatingActivities: {
          units: { USD: [fact({ val: 9 })] },
        },
        PaymentsToAcquirePropertyPlantAndEquipment: {
          units: { USD: [fact({ val: 4 })] },
        },
      }),
    );
    const { provider, fetch } = setup(() => new Response(body));
    const result = await finish(provider.loadEvidence(CIK));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(view(result).income.reason).toBe("candidate_limit");
    expect(view(result).income.coverage).toMatchObject({
      full: {
        candidateRows: 20001,
        inspectedRows: 20001,
        invalidRows: 0,
        uniqueObservations: 20001,
      },
      selected: { observations: 1 },
      otherAccessions: { observations: 20000 },
      returned: { observations: 1 },
    });
    expect(source(result).income.observations).toEqual([]);
    expect(
      result.facts.observations.find((row) => row.concept === "NetIncomeLoss")
        ?.value,
    ).toBe("-1");
    expect(
      result.facts.scans.every(({ scan }) => scan.status === "available"),
    ).toBe(true);
    expect(
      view(result).cashGeneration.resolution.operatingCashFlowLessPpePurchases,
    ).toMatchObject({ status: "available", value: "5" });
    expect(
      view(result).statements.statements[0]!.rows.find(
        (row) => row.concept === "NetIncomeLoss",
      )!.cells[0],
    ).toMatchObject({ status: "available", value: "-1" });
  });
});

function digest(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
