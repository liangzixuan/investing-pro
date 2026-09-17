import {
  PERSONAL_FINANCIAL_REVENUE_BASES,
  type PersonalFinancialRevenueBasisDto,
  type PersonalFinancialScreenAnnualCellDto,
  type PersonalFinancialScreenInstantCellDto,
  type PersonalFinancialScreenInstantSourceRefDto,
  type PersonalFinancialScreenGrowthCellDto,
  type PersonalFinancialScreenGrowthSourceRefDto,
  type PersonalSecInstantConceptDto,
  type PersonalSecInstantFrameDto,
  type PersonalFinancialScreenCriteriaDto,
  type PersonalFinancialScreenMetricDto,
  type PersonalFinancialScreenResponseDto,
  type PersonalFinancialScreenRowDto,
  type PersonalFinancialScreenSourceRefDto,
  type PersonalSecAnnualConceptDto,
  type PersonalSecFinancialSnapshotDto,
  type PersonalSecAnnualFrameDto,
  type PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";

import {
  PERSONAL_FINANCIAL_ANALYTICS_FORMULAS,
  PERSONAL_FINANCIAL_ANALYTICS_ROUNDING,
} from "./personal-financial-analytics";

export const PERSONAL_FINANCIAL_SCREEN_LIMITS = Object.freeze({
  clauses: 7,
  identities: 10_000,
  identityTextCodePoints: 120,
  pageLimit: 250,
  pageOffset: 10_000,
  minimumCalendarYear: 2009,
  maximumCalendarYear: 2100,
});

export const PERSONAL_FINANCIAL_SCREEN_FORMULA_SET_VERSION = "1.7.0" as const;

export const PERSONAL_FINANCIAL_SCREEN_FORMULAS = Object.freeze({
  currentRatio: Object.freeze({
    formulaId: "current_assets_to_current_liabilities",
    formulaVersion: "1.0.0",
    expression: "current_assets / current_liabilities",
  }),
  currentAssetsLessCurrentLiabilities: Object.freeze({
    formulaId: "current_assets_less_current_liabilities",
    formulaVersion: "1.0.0",
    expression: "current_assets - current_liabilities",
  }),
  netMargin: PERSONAL_FINANCIAL_ANALYTICS_FORMULAS.netMargin,
  operatingMargin: PERSONAL_FINANCIAL_ANALYTICS_FORMULAS.operatingMargin,
  operatingCashFlowMargin:
    PERSONAL_FINANCIAL_ANALYTICS_FORMULAS.operatingCashFlowMargin,
  operatingCashFlowLessPpePurchases: Object.freeze({
    formulaId: "operating_cash_flow_less_ppe_purchases",
    formulaVersion: "1.1.0",
    expression: "operating_cash_flow - ppe_purchases",
  }),
  grossMargin: PERSONAL_FINANCIAL_ANALYTICS_FORMULAS.grossMargin,
  operatingCashFlowToNetIncome: Object.freeze({
    formulaId: "operating_cash_flow_to_net_income_percent",
    formulaVersion: "1.0.0",
    expression: "operating_cash_flow / net_income * 100",
  }),
  operatingCashFlowLessPpePurchasesMargin: Object.freeze({
    formulaId: "operating_cash_flow_less_ppe_purchases_to_revenue_percent",
    formulaVersion: "1.0.0",
    expression:
      "(operating_cash_flow - ppe_purchases) / selected_revenue * 100",
  }),
  revenueGrowth: PERSONAL_FINANCIAL_ANALYTICS_FORMULAS.revenueGrowth,
});

const METRICS = [
  "revenue",
  "grossProfit",
  "netIncome",
  "operatingIncome",
  "operatingCashFlow",
  "investingCashFlow",
  "financingCashFlow",
  "commonDividendsPaid",
  "commonStockRepurchases",
  "interestPaidNet",
  "incomeTaxesPaidNet",
  "netMargin",
  "operatingMargin",
  "operatingCashFlowMargin",
  "ppePurchases",
  "operatingCashFlowLessPpePurchases",
  "grossMargin",
  "operatingCashFlowToNetIncome",
  "operatingCashFlowLessPpePurchasesMargin",
  "currentAssets",
  "currentLiabilities",
  "currentRatio",
  "currentAssetsLessCurrentLiabilities",
  "totalAssets",
  "totalLiabilities",
  "cashAndCashEquivalents",
  "stockholdersEquity",
  "revenueGrowth",
] as const satisfies readonly PersonalFinancialScreenMetricDto[];

const REVENUE_CONCEPTS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
] as const;
const CONCEPTS = [
  ...REVENUE_CONCEPTS,
  "NetIncomeLoss",
  "OperatingIncomeLoss",
  "NetCashProvidedByUsedInOperatingActivities",
  "NetCashProvidedByUsedInInvestingActivities",
  "NetCashProvidedByUsedInFinancingActivities",
  "PaymentsOfDividendsCommonStock",
  "PaymentsForRepurchaseOfCommonStock",
  "InterestPaidNet",
  "IncomeTaxesPaidNet",
  "GrossProfit",
  "PaymentsToAcquirePropertyPlantAndEquipment",
] as const satisfies readonly PersonalSecAnnualConceptDto[];
const INSTANT_CONCEPTS = [
  "AssetsCurrent",
  "LiabilitiesCurrent",
  "Assets",
  "Liabilities",
  "CashAndCashEquivalentsAtCarryingValue",
  "StockholdersEquity",
] as const satisfies readonly PersonalSecInstantConceptDto[];
const FAILED_SOURCE_STATUSES = new Set([
  "rate_limited",
  "upstream_unavailable",
  "invalid_response",
]);
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const CIK = /^\d{10}$/u;
const ACCESSION = /^\d{10}-\d{2}-\d{6}$/u;
const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const INVALID_TEXT = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const ScreenDecimal = Decimal.clone({
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -256,
  toExpPos: 256,
});

type UnavailableReason = Extract<
  PersonalFinancialScreenAnnualCellDto,
  { status: "unavailable" }
>["reason"];
type FrameIndex = ReadonlyMap<
  PersonalSecAnnualConceptDto,
  {
    readonly status: PersonalSecAnnualFrameDto["status"];
    readonly facts: ReadonlyMap<
      string,
      readonly PersonalFinancialScreenSourceRefDto[]
    >;
    readonly unknownCiks: ReadonlySet<string>;
  }
>;

type InstantFrameIndex = ReadonlyMap<
  PersonalSecInstantConceptDto,
  {
    readonly status: PersonalSecInstantFrameDto["status"];
    readonly facts: ReadonlyMap<
      string,
      readonly PersonalFinancialScreenInstantSourceRefDto[]
    >;
    readonly unknownCiks: ReadonlySet<string>;
  }
>;
type InstantUnavailableReason = Extract<
  PersonalFinancialScreenInstantCellDto,
  { status: "unavailable" }
>["reason"];

/** The saved-definition and HTTP boundaries share this closed criteria grammar. */
export function validatePersonalFinancialScreenCriteria(
  value: unknown,
): value is PersonalFinancialScreenCriteriaDto {
  try {
    if (
      !exactRecord(value, [
        "calendarYear",
        "identityText",
        "clauses",
        "sort",
      ]) &&
      !exactRecord(value, [
        "calendarYear",
        "identityText",
        "clauses",
        "sort",
        "revenueBasis",
      ])
    )
      return false;
    if (
      !isCalendarYear(value.calendarYear) ||
      (Object.hasOwn(value, "revenueBasis") &&
        !PERSONAL_FINANCIAL_REVENUE_BASES.some(
          (basis) => basis === value.revenueBasis,
        )) ||
      typeof value.identityText !== "string" ||
      [...value.identityText].length >
        PERSONAL_FINANCIAL_SCREEN_LIMITS.identityTextCodePoints ||
      INVALID_TEXT.test(value.identityText) ||
      !Array.isArray(value.clauses) ||
      value.clauses.length > PERSONAL_FINANCIAL_SCREEN_LIMITS.clauses ||
      !exactRecord(value.sort, ["field", "direction"]) ||
      !(value.sort.field === "symbol" || isMetric(value.sort.field)) ||
      !(value.sort.direction === "asc" || value.sort.direction === "desc")
    )
      return false;
    return value.clauses.every(
      (clause: unknown) =>
        exactRecord(clause, ["field", "operator", "value"]) &&
        isMetric(clause.field) &&
        (clause.operator === "gte" || clause.operator === "lte") &&
        isDecimal(clause.value),
    );
  } catch {
    return false;
  }
}

/** Evaluates annual flows and fixed-Q4 balances; the selected year is not a fiscal-year label. */
export function evaluatePersonalFinancialScreen(
  identities: readonly PersonalSecurityMasterScreenRowDto[],
  snapshot: PersonalSecFinancialSnapshotDto,
  criteria: PersonalFinancialScreenCriteriaDto,
  page: Readonly<{ offset: number; limit: number }>,
  catalogSnapshotSha256: `sha256:${string}`,
): PersonalFinancialScreenResponseDto {
  try {
    if (
      !validatePersonalFinancialScreenCriteria(criteria) ||
      !exactRecord(page, ["offset", "limit"]) ||
      !boundedInteger(
        page.offset,
        0,
        PERSONAL_FINANCIAL_SCREEN_LIMITS.pageOffset,
      ) ||
      !boundedInteger(
        page.limit,
        1,
        PERSONAL_FINANCIAL_SCREEN_LIMITS.pageLimit,
      ) ||
      typeof catalogSnapshotSha256 !== "string" ||
      !DIGEST.test(catalogSnapshotSha256) ||
      !Array.isArray(identities) ||
      identities.length > PERSONAL_FINANCIAL_SCREEN_LIMITS.identities ||
      !identities.every(isIdentity) ||
      new Set(identities.map((identity) => identity.listingId)).size !==
        identities.length ||
      !isSnapshot(snapshot) ||
      criteria.calendarYear !== snapshot.calendarYear
    )
      fail();

    const index = indexFrames(snapshot.frames);
    const priorIndex = indexFrames(snapshot.priorRevenueFrames);
    const instantIndex = indexInstantFrames(snapshot.instantFrames);
    const tokens = normalizeText(criteria.identityText)
      .split(" ")
      .filter(Boolean);
    const coverage = Object.fromEntries(
      METRICS.map((metric) => [metric, { known: 0, unknown: 0 }]),
    ) as Record<
      PersonalFinancialScreenMetricDto,
      { known: number; unknown: number }
    >;
    const matches: PersonalFinancialScreenRowDto[] = [];
    const metricsByCik = new Map<
      string,
      PersonalFinancialScreenRowDto["metrics"]
    >();
    let identityMatches = 0;
    let totalNonMatches = 0;
    let totalUnknown = 0;
    for (const identity of identities) {
      if (!matchesIdentity(identity, tokens)) continue;
      identityMatches += 1;
      let metrics = metricsByCik.get(identity.cik);
      if (metrics === undefined) {
        metrics = buildMetrics(
          identity.cik,
          index,
          instantIndex,
          priorIndex,
          snapshot.calendarYear,
          criteria.revenueBasis ?? "agreement",
        );
        metricsByCik.set(identity.cik, metrics);
      }
      for (const metric of METRICS) {
        coverage[metric][
          metrics[metric].status === "available" ? "known" : "unknown"
        ] += 1;
      }
      const outcome = evaluateClauses(metrics, criteria);
      if (outcome === "false") totalNonMatches += 1;
      else if (outcome === "unknown") totalUnknown += 1;
      else matches.push({ identity: { ...identity }, metrics });
    }
    matches.sort((left, right) => compareRows(left, right, criteria.sort));
    return {
      schemaVersion: "14.0.0",
      instantQuarter: 4,
      catalogSnapshotSha256,
      financialSnapshotSha256: snapshot.snapshotSha256,
      calendarYear: snapshot.calendarYear,
      priorCalendarYear: snapshot.priorCalendarYear,
      ...(criteria.revenueBasis === undefined
        ? {}
        : { revenueBasis: criteria.revenueBasis }),
      fetchedAt: snapshot.fetchedAt,
      expiresAt: snapshot.expiresAt,
      sources: [...CONCEPTS, ...INSTANT_CONCEPTS].map((concept) => {
        const frame = [...snapshot.frames, ...snapshot.instantFrames].find(
          (candidate) => candidate.concept === concept,
        )!;
        return { concept, status: frame.status, sourceUrl: frame.sourceUrl };
      }),
      priorRevenueSources: REVENUE_CONCEPTS.map((concept) => {
        const frame = snapshot.priorRevenueFrames.find(
          (candidate) => candidate.concept === concept,
        )!;
        return { concept, status: frame.status, sourceUrl: frame.sourceUrl };
      }),
      rows: matches.slice(page.offset, page.offset + page.limit),
      totalUniverse: identities.length,
      identityMatches,
      totalMatches: matches.length,
      totalNonMatches,
      totalUnknown,
      metricCoverage: coverage,
      offset: page.offset,
      limitApplied: page.limit,
      hasMore: page.offset + page.limit < matches.length,
      formulaVersion: PERSONAL_FINANCIAL_SCREEN_FORMULA_SET_VERSION,
    };
  } catch {
    return fail();
  }
}

function buildMetrics(
  cik: string,
  frames: FrameIndex,
  instantFrames: InstantFrameIndex,
  priorFrames: FrameIndex,
  calendarYear: number,
  revenueBasis: PersonalFinancialRevenueBasisDto,
): PersonalFinancialScreenRowDto["metrics"] {
  const revenue = resolveReported(
    cik,
    revenueBasis === "agreement" ? REVENUE_CONCEPTS : [revenueBasis],
    frames,
  );
  const netIncome = resolveReported(cik, ["NetIncomeLoss"], frames);
  const priorRevenue = resolveReported(
    cik,
    revenueBasis === "agreement" ? REVENUE_CONCEPTS : [revenueBasis],
    priorFrames,
  );
  const grossProfit = resolveReported(cik, ["GrossProfit"], frames);
  const operatingIncome = resolveReported(cik, ["OperatingIncomeLoss"], frames);
  const operatingCashFlow = resolveReported(
    cik,
    ["NetCashProvidedByUsedInOperatingActivities"],
    frames,
  );
  const ppePurchases = resolveReported(
    cik,
    ["PaymentsToAcquirePropertyPlantAndEquipment"],
    frames,
  );
  const currentAssets = resolveInstant(
    cik,
    "AssetsCurrent",
    instantFrames,
    calendarYear,
  );
  const currentLiabilities = resolveInstant(
    cik,
    "LiabilitiesCurrent",
    instantFrames,
    calendarYear,
  );
  return {
    revenue,
    grossProfit,
    netIncome,
    operatingIncome,
    operatingCashFlow,
    investingCashFlow: resolveReported(
      cik,
      ["NetCashProvidedByUsedInInvestingActivities"],
      frames,
    ),
    financingCashFlow: resolveReported(
      cik,
      ["NetCashProvidedByUsedInFinancingActivities"],
      frames,
    ),
    commonDividendsPaid: resolveReported(
      cik,
      ["PaymentsOfDividendsCommonStock"],
      frames,
    ),
    commonStockRepurchases: resolveReported(
      cik,
      ["PaymentsForRepurchaseOfCommonStock"],
      frames,
    ),
    interestPaidNet: resolveReported(cik, ["InterestPaidNet"], frames),
    incomeTaxesPaidNet: resolveReported(cik, ["IncomeTaxesPaidNet"], frames),
    netMargin: margin(netIncome, revenue),
    operatingMargin: margin(operatingIncome, revenue),
    operatingCashFlowMargin: margin(operatingCashFlow, revenue),
    ppePurchases,
    operatingCashFlowLessPpePurchases: cashFlowLessPpePurchases(
      operatingCashFlow,
      ppePurchases,
    ),
    grossMargin: grossProfitMargin(grossProfit, revenue),
    operatingCashFlowToNetIncome: cashFlowToNetIncome(
      operatingCashFlow,
      netIncome,
    ),
    operatingCashFlowLessPpePurchasesMargin: cashFlowLessPpePurchasesMargin(
      operatingCashFlow,
      ppePurchases,
      revenue,
    ),
    currentAssets,
    currentLiabilities,
    currentRatio: currentAssetsToLiabilities(currentAssets, currentLiabilities),
    currentAssetsLessCurrentLiabilities: currentAssetsLessCurrentLiabilities(
      currentAssets,
      currentLiabilities,
    ),
    totalAssets: resolveInstant(cik, "Assets", instantFrames, calendarYear),
    totalLiabilities: resolveInstant(
      cik,
      "Liabilities",
      instantFrames,
      calendarYear,
    ),
    cashAndCashEquivalents: resolveInstant(
      cik,
      "CashAndCashEquivalentsAtCarryingValue",
      instantFrames,
      calendarYear,
    ),
    stockholdersEquity: resolveInstant(
      cik,
      "StockholdersEquity",
      instantFrames,
      calendarYear,
    ),
    revenueGrowth: revenueYearOverYear(revenue, priorRevenue, calendarYear),
  };
}

function revenueYearOverYear(
  currentRevenue: PersonalFinancialScreenAnnualCellDto,
  priorRevenue: PersonalFinancialScreenAnnualCellDto,
  calendarYear: number,
): PersonalFinancialScreenGrowthCellDto {
  const roleSources = (
    cell: PersonalFinancialScreenAnnualCellDto,
    role: PersonalFinancialScreenGrowthSourceRefDto["role"],
    year: number,
  ): PersonalFinancialScreenGrowthSourceRefDto[] =>
    cell.sources.map((source) => {
      const concept = REVENUE_CONCEPTS.find((item) => item === source.concept);
      if (concept === undefined) fail();
      return { ...source, concept, role, calendarYear: year };
    });
  const common = {
    unit: "percent" as const,
    currentRevenue,
    priorRevenue,
    sources: [
      ...roleSources(currentRevenue, "current_revenue", calendarYear),
      ...roleSources(priorRevenue, "prior_revenue", calendarYear - 1),
    ],
  };
  const unknown = (
    reason: Extract<
      PersonalFinancialScreenGrowthCellDto,
      { status: "unavailable" }
    >["reason"],
  ): PersonalFinancialScreenGrowthCellDto => ({
    ...common,
    status: "unavailable",
    reason,
  });
  if (priorRevenue.status === "unavailable")
    return unknown("prior_unavailable");
  if (currentRevenue.status === "unavailable")
    return unknown("current_unavailable");
  // Both operands resolve from the same CIK. Every reference must describe
  // one supported annual period within its own requested Frame year.
  const annual = (cell: typeof currentRevenue, year: number) => {
    const first = cell.sources[0];
    return (
      first !== undefined &&
      cell.sources.every((source) => {
        const days =
          (Date.parse(source.endDate) - Date.parse(source.startDate)) /
            86_400_000 +
          1;
        return (
          source.startDate === first.startDate &&
          source.endDate === first.endDate &&
          new ScreenDecimal(source.value).eq(cell.value) &&
          days >= 335 &&
          days <= 395 &&
          Math.abs(Number(source.endDate.slice(0, 4)) - year) <= 1
        );
      })
    );
  };
  if (
    !annual(currentRevenue, calendarYear) ||
    !annual(priorRevenue, calendarYear - 1)
  )
    return unknown("period_mismatch");
  const conceptSet = (cell: PersonalFinancialScreenAnnualCellDto) =>
    [...new Set(cell.sources.map((source) => source.concept))].sort().join("|");
  if (conceptSet(currentRevenue) !== conceptSet(priorRevenue))
    return unknown("concept_set_changed");
  // The all-reference check above established one exact period per operand.
  if (
    Date.parse(currentRevenue.sources[0]!.startDate) -
      Date.parse(priorRevenue.sources[0]!.endDate) !==
    86_400_000
  )
    return unknown("nonadjacent_periods");
  const denominator = new ScreenDecimal(priorRevenue.value);
  if (!denominator.gt(0)) return unknown("nonpositive_prior_revenue");
  // Different filings across years are expected; require agreement only
  // within each year's retained observations, after the other pair checks.
  if (
    [currentRevenue, priorRevenue].some(
      (cell) =>
        new Set(cell.sources.map((source) => source.accessionNumber)).size !==
        1,
    )
  )
    return unknown("filing_mismatch");
  const rounded = new ScreenDecimal(currentRevenue.value)
    .minus(denominator)
    .times(100)
    .div(denominator)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return {
    ...common,
    status: "available",
    value: rounded.isZero() ? "0.00" : rounded.toFixed(2),
  };
}

function indexInstantFrames(
  frames: readonly PersonalSecInstantFrameDto[],
): InstantFrameIndex {
  return new Map(
    frames.map((frame) => {
      const facts = new Map<
        string,
        PersonalFinancialScreenInstantSourceRefDto[]
      >();
      for (const fact of frame.facts) {
        const refs = facts.get(fact.cik) ?? [];
        refs.push({
          concept: frame.concept,
          accessionNumber: fact.accessionNumber,
          asOfDate: fact.asOfDate,
          value: fact.value,
        });
        facts.set(fact.cik, refs);
      }
      for (const refs of facts.values())
        refs.sort(
          (a, b) =>
            compareText(a.asOfDate, b.asOfDate) ||
            compareText(a.accessionNumber, b.accessionNumber) ||
            compareText(a.value, b.value),
        );
      return [
        frame.concept,
        {
          status: frame.status,
          facts,
          unknownCiks: new Set(frame.unknownCiks),
        },
      ] as const;
    }),
  );
}

function instantUnavailable(
  unit: "USD" | "multiple",
  reason: InstantUnavailableReason,
  sources: readonly PersonalFinancialScreenInstantSourceRefDto[],
): PersonalFinancialScreenInstantCellDto {
  return { status: "unavailable", unit, reason, sources };
}

function resolveInstant(
  cik: string,
  concept: PersonalSecInstantConceptDto,
  frames: InstantFrameIndex,
  calendarYear: number,
): PersonalFinancialScreenInstantCellDto {
  const frame = frames.get(concept);
  const sources =
    frame?.status === "available" ? (frame.facts.get(cik) ?? []) : [];
  if (frame === undefined || FAILED_SOURCE_STATUSES.has(frame.status))
    return instantUnavailable("USD", "source_unavailable", sources);
  if (frame.unknownCiks.has(cik))
    return instantUnavailable("USD", "conflicting", sources);
  if (sources.length === 0)
    return instantUnavailable("USD", "missing", sources);
  if (sources.some((ref) => !isDecimal(ref.value)))
    return instantUnavailable("USD", "invalid_value", sources);
  const first = sources[0]!;
  const value = new ScreenDecimal(first.value);
  if (
    sources.some(
      (ref) =>
        ref.asOfDate !== first.asOfDate ||
        !new ScreenDecimal(ref.value).eq(value),
    )
  )
    return instantUnavailable("USD", "conflicting", sources);
  // This conservative application window is not an SEC-published date tolerance.
  if (
    sources.some(
      (ref) =>
        ref.asOfDate < `${String(calendarYear)}-10-01` ||
        ref.asOfDate > `${String(calendarYear)}-12-31`,
    )
  )
    return instantUnavailable("USD", "unsupported_balance_date", sources);
  return {
    status: "available",
    unit: "USD",
    value: canonicalDecimal(value),
    sources,
  };
}

function currentAssetsToLiabilities(
  assets: PersonalFinancialScreenInstantCellDto,
  liabilities: PersonalFinancialScreenInstantCellDto,
): PersonalFinancialScreenInstantCellDto {
  const sources = [...assets.sources, ...liabilities.sources];
  if (liabilities.status === "unavailable")
    return instantUnavailable("multiple", liabilities.reason, sources);
  if (assets.status === "unavailable")
    return instantUnavailable("multiple", assets.reason, sources);
  const first = sources[0]!;
  // Both operands resolve by the row's CIK; every observation must also agree on date and filing.
  if (sources.some((ref) => ref.asOfDate !== first.asOfDate))
    return instantUnavailable("multiple", "balance_date_mismatch", sources);
  if (sources.some((ref) => ref.accessionNumber !== first.accessionNumber))
    return instantUnavailable("multiple", "filing_mismatch", sources);
  const denominator = new ScreenDecimal(liabilities.value);
  if (!denominator.gt(0))
    return instantUnavailable(
      "multiple",
      "nonpositive_current_liabilities",
      sources,
    );
  if (new ScreenDecimal(assets.value).lt(0))
    return instantUnavailable("multiple", "unsupported_sign", sources);
  const rounded = new ScreenDecimal(assets.value)
    .div(denominator)
    .toDecimalPlaces(
      PERSONAL_FINANCIAL_ANALYTICS_ROUNDING.decimalPlaces,
      Decimal.ROUND_HALF_UP,
    );
  return {
    status: "available",
    unit: "multiple",
    value: rounded.isZero()
      ? "0.00"
      : rounded.toFixed(PERSONAL_FINANCIAL_ANALYTICS_ROUNDING.decimalPlaces),
    sources,
  };
}

function currentAssetsLessCurrentLiabilities(
  assets: PersonalFinancialScreenInstantCellDto,
  liabilities: PersonalFinancialScreenInstantCellDto,
): PersonalFinancialScreenInstantCellDto {
  const sources = [...assets.sources, ...liabilities.sources];
  if (assets.status === "unavailable")
    return instantUnavailable("USD", assets.reason, sources);
  if (liabilities.status === "unavailable")
    return instantUnavailable("USD", liabilities.reason, sources);
  const first = sources[0]!;
  // Resolved inputs already satisfy the Q4 window; every reference must share date and filing.
  if (sources.some((ref) => ref.asOfDate !== first.asOfDate))
    return instantUnavailable("USD", "balance_date_mismatch", sources);
  if (sources.some((ref) => ref.accessionNumber !== first.accessionNumber))
    return instantUnavailable("USD", "filing_mismatch", sources);
  const assetValue = new ScreenDecimal(assets.value);
  const liabilityValue = new ScreenDecimal(liabilities.value);
  if (assetValue.lt(0) || liabilityValue.lt(0))
    return instantUnavailable("USD", "unsupported_sign", sources);
  return {
    status: "available",
    unit: "USD",
    value: canonicalDecimal(assetValue.minus(liabilityValue)),
    sources,
  };
}

function grossProfitMargin(
  grossProfit: PersonalFinancialScreenAnnualCellDto,
  revenue: PersonalFinancialScreenAnnualCellDto,
): PersonalFinancialScreenAnnualCellDto {
  const sources = [...grossProfit.sources, ...revenue.sources];
  if (revenue.status === "unavailable")
    return unavailable("percent", revenue.reason, sources);
  if (grossProfit.status === "unavailable")
    return unavailable("percent", grossProfit.reason, sources);
  const first = sources[0]!;
  // Reported operands are indexed by the same CIK. Every retained reference,
  // including agreeing revenue concepts, must match actual period and filing.
  if (
    sources.some((source) => {
      const days =
        (Date.parse(source.endDate) - Date.parse(source.startDate)) /
          86_400_000 +
        1;
      return (
        source.startDate !== first.startDate ||
        source.endDate !== first.endDate ||
        days < 335 ||
        days > 395
      );
    })
  )
    return unavailable("percent", "period_mismatch", sources);
  if (
    sources.some((source) => source.accessionNumber !== first.accessionNumber)
  )
    return unavailable("percent", "filing_mismatch", sources);
  return margin(grossProfit, revenue);
}

function cashFlowToNetIncome(
  operatingCashFlow: PersonalFinancialScreenAnnualCellDto,
  netIncome: PersonalFinancialScreenAnnualCellDto,
): PersonalFinancialScreenAnnualCellDto {
  const sources = [...operatingCashFlow.sources, ...netIncome.sources];
  if (netIncome.status === "unavailable")
    return unavailable("percent", netIncome.reason, sources);
  if (operatingCashFlow.status === "unavailable")
    return unavailable("percent", operatingCashFlow.reason, sources);
  const first = sources[0]!;
  // Both operands resolve by CIK; every retained observation must also share
  // one supported annual period and accession before the ratio is applicable.
  if (
    sources.some((source) => {
      const days =
        (Date.parse(source.endDate) - Date.parse(source.startDate)) /
          86_400_000 +
        1;
      return (
        source.startDate !== first.startDate ||
        source.endDate !== first.endDate ||
        days < 335 ||
        days > 395
      );
    })
  )
    return unavailable("percent", "period_mismatch", sources);
  if (
    sources.some((source) => source.accessionNumber !== first.accessionNumber)
  )
    return unavailable("percent", "filing_mismatch", sources);
  const denominator = new ScreenDecimal(netIncome.value);
  if (!denominator.gt(0))
    return unavailable("percent", "nonpositive_net_income", sources);
  const rounded = new ScreenDecimal(operatingCashFlow.value)
    .div(denominator)
    .times(100)
    .toDecimalPlaces(
      PERSONAL_FINANCIAL_ANALYTICS_ROUNDING.decimalPlaces,
      Decimal.ROUND_HALF_UP,
    );
  return {
    status: "available",
    unit: "percent",
    value: rounded.isZero()
      ? "0.00"
      : rounded.toFixed(PERSONAL_FINANCIAL_ANALYTICS_ROUNDING.decimalPlaces),
    sources,
  };
}

function cashFlowLessPpePurchases(
  operatingCashFlow: PersonalFinancialScreenAnnualCellDto,
  ppePurchases: PersonalFinancialScreenAnnualCellDto,
): PersonalFinancialScreenAnnualCellDto {
  const sources = [...operatingCashFlow.sources, ...ppePurchases.sources];
  if (operatingCashFlow.status === "unavailable")
    return unavailable("USD", operatingCashFlow.reason, sources);
  if (ppePurchases.status === "unavailable")
    return unavailable("USD", ppePurchases.reason, sources);
  const first = sources[0]!;
  // Each Frame chooses its own latest fitting observation. Inspect every
  // retained reference before combining the reported amounts.
  if (
    sources.some((source) => {
      const days =
        (Date.parse(source.endDate) - Date.parse(source.startDate)) /
          86_400_000 +
        1;
      return (
        source.startDate !== first.startDate ||
        source.endDate !== first.endDate ||
        days < 335 ||
        days > 395
      );
    })
  )
    return unavailable("USD", "period_mismatch", sources);
  if (
    sources.some((source) => source.accessionNumber !== first.accessionNumber)
  )
    return unavailable("USD", "filing_mismatch", sources);
  if (new ScreenDecimal(ppePurchases.value).lt(0))
    return unavailable("USD", "unsupported_sign", sources);
  return {
    status: "available",
    unit: "USD",
    value: canonicalDecimal(
      new ScreenDecimal(operatingCashFlow.value).minus(ppePurchases.value),
    ),
    sources,
  };
}

function cashFlowLessPpePurchasesMargin(
  operatingCashFlow: PersonalFinancialScreenAnnualCellDto,
  ppePurchases: PersonalFinancialScreenAnnualCellDto,
  revenue: PersonalFinancialScreenAnnualCellDto,
): PersonalFinancialScreenAnnualCellDto {
  const sources = [
    ...operatingCashFlow.sources,
    ...ppePurchases.sources,
    ...revenue.sources,
  ];
  if (revenue.status === "unavailable")
    return unavailable("percent", revenue.reason, sources);
  if (operatingCashFlow.status === "unavailable")
    return unavailable("percent", operatingCashFlow.reason, sources);
  if (ppePurchases.status === "unavailable")
    return unavailable("percent", ppePurchases.reason, sources);
  const first = sources[0]!;
  // Validate the original three operands, including every agreeing reference;
  // the displayed cash difference is never reused as an intermediate input.
  if (
    sources.some((source) => {
      const days =
        (Date.parse(source.endDate) - Date.parse(source.startDate)) /
          86_400_000 +
        1;
      return (
        source.startDate !== first.startDate ||
        source.endDate !== first.endDate ||
        days < 335 ||
        days > 395
      );
    })
  )
    return unavailable("percent", "period_mismatch", sources);
  if (
    sources.some((source) => source.accessionNumber !== first.accessionNumber)
  )
    return unavailable("percent", "filing_mismatch", sources);
  const purchases = new ScreenDecimal(ppePurchases.value);
  if (purchases.lt(0))
    return unavailable("percent", "unsupported_sign", sources);
  const denominator = new ScreenDecimal(revenue.value);
  if (!denominator.gt(0))
    return unavailable("percent", "nonpositive_revenue", sources);
  const rounded = new ScreenDecimal(operatingCashFlow.value)
    .minus(purchases)
    .div(denominator)
    .times(100)
    .toDecimalPlaces(
      PERSONAL_FINANCIAL_ANALYTICS_ROUNDING.decimalPlaces,
      Decimal.ROUND_HALF_UP,
    );
  return {
    status: "available",
    unit: "percent",
    value: rounded.isZero()
      ? "0.00"
      : rounded.toFixed(PERSONAL_FINANCIAL_ANALYTICS_ROUNDING.decimalPlaces),
    sources,
  };
}

function resolveReported(
  cik: string,
  concepts: readonly PersonalSecAnnualConceptDto[],
  frames: FrameIndex,
): PersonalFinancialScreenAnnualCellDto {
  const sources: PersonalFinancialScreenSourceRefDto[] = [];
  let sourceUnavailable = false;
  let conflicting = false;
  for (const concept of concepts) {
    const frame = frames.get(concept);
    if (frame === undefined || FAILED_SOURCE_STATUSES.has(frame.status)) {
      sourceUnavailable = true;
      continue;
    }
    if (frame.status === "not_covered") continue;
    if (frame.unknownCiks.has(cik)) conflicting = true;
    sources.push(...(frame.facts.get(cik) ?? []));
  }
  if (sourceUnavailable)
    return unavailable("USD", "source_unavailable", sources);
  if (conflicting) return unavailable("USD", "conflicting", sources);
  if (sources.length === 0) return unavailable("USD", "missing", sources);
  if (sources.some((source) => !isDecimal(source.value)))
    return unavailable("USD", "invalid_value", sources);
  const first = sources[0]!;
  const value = new ScreenDecimal(first.value);
  if (
    sources.some(
      (source) =>
        source.startDate !== first.startDate ||
        source.endDate !== first.endDate ||
        !new ScreenDecimal(source.value).eq(value),
    )
  )
    return unavailable("USD", "conflicting", sources);
  return {
    status: "available",
    unit: "USD",
    value: canonicalDecimal(value),
    sources,
  };
}

function margin(
  numerator: PersonalFinancialScreenAnnualCellDto,
  revenue: PersonalFinancialScreenAnnualCellDto,
): PersonalFinancialScreenAnnualCellDto {
  const sources = [...numerator.sources, ...revenue.sources];
  if (revenue.status === "unavailable")
    return unavailable("percent", revenue.reason, sources);
  if (numerator.status === "unavailable")
    return unavailable("percent", numerator.reason, sources);
  if (
    numerator.sources[0]!.startDate !== revenue.sources[0]!.startDate ||
    numerator.sources[0]!.endDate !== revenue.sources[0]!.endDate
  )
    return unavailable("percent", "period_mismatch", sources);
  const denominator = new ScreenDecimal(revenue.value);
  if (!denominator.gt(0))
    return unavailable("percent", "nonpositive_revenue", sources);
  const rounded = new ScreenDecimal(numerator.value)
    .div(denominator)
    .times(100)
    .toDecimalPlaces(
      PERSONAL_FINANCIAL_ANALYTICS_ROUNDING.decimalPlaces,
      Decimal.ROUND_HALF_UP,
    );
  return {
    status: "available",
    unit: "percent",
    value: rounded.isZero()
      ? "0.00"
      : rounded.toFixed(PERSONAL_FINANCIAL_ANALYTICS_ROUNDING.decimalPlaces),
    sources,
  };
}

function evaluateClauses(
  metrics: PersonalFinancialScreenRowDto["metrics"],
  criteria: PersonalFinancialScreenCriteriaDto,
): "true" | "false" | "unknown" {
  let unknown = false;
  for (const clause of criteria.clauses) {
    const metric = metrics[clause.field];
    if (metric.status === "unavailable") {
      unknown = true;
      continue;
    }
    const value = new ScreenDecimal(metric.value);
    if (
      clause.operator === "gte"
        ? value.lt(clause.value)
        : value.gt(clause.value)
    )
      return "false";
  }
  return unknown ? "unknown" : "true";
}

function compareRows(
  left: PersonalFinancialScreenRowDto,
  right: PersonalFinancialScreenRowDto,
  sort: PersonalFinancialScreenCriteriaDto["sort"],
): number {
  const direction = sort.direction === "asc" ? 1 : -1;
  let comparison = 0;
  if (sort.field === "symbol")
    comparison =
      compareText(left.identity.symbol, right.identity.symbol) * direction;
  else {
    const leftCell = left.metrics[sort.field];
    const rightCell = right.metrics[sort.field];
    if (leftCell.status !== rightCell.status)
      return leftCell.status === "available" ? -1 : 1;
    if (leftCell.status === "available" && rightCell.status === "available") {
      comparison =
        new ScreenDecimal(leftCell.value).cmp(rightCell.value) * direction;
    }
  }
  return (
    comparison ||
    compareText(left.identity.symbol, right.identity.symbol) ||
    compareText(left.identity.listingId, right.identity.listingId)
  );
}

function indexFrames(frames: readonly PersonalSecAnnualFrameDto[]): FrameIndex {
  return new Map(
    frames.map((frame) => {
      const facts = new Map<string, PersonalFinancialScreenSourceRefDto[]>();
      for (const fact of frame.facts) {
        const existing = facts.get(fact.cik) ?? [];
        existing.push({
          concept: frame.concept,
          accessionNumber: fact.accessionNumber,
          startDate: fact.startDate,
          endDate: fact.endDate,
          value: fact.value,
        });
        facts.set(fact.cik, existing);
      }
      for (const entries of facts.values())
        entries.sort(
          (left, right) =>
            compareText(left.startDate, right.startDate) ||
            compareText(left.endDate, right.endDate) ||
            compareText(left.accessionNumber, right.accessionNumber) ||
            compareText(left.value, right.value),
        );
      return [
        frame.concept,
        {
          status: frame.status,
          facts,
          unknownCiks: new Set(frame.unknownCiks),
        },
      ] as const;
    }),
  );
}

function unavailable(
  unit: "USD" | "percent",
  reason: UnavailableReason,
  sources: readonly PersonalFinancialScreenSourceRefDto[],
): PersonalFinancialScreenAnnualCellDto {
  return { status: "unavailable", unit, reason, sources };
}

function matchesIdentity(
  identity: PersonalSecurityMasterScreenRowDto,
  tokens: readonly string[],
): boolean {
  const text = normalizeText(
    [
      identity.symbol,
      identity.issuerName,
      identity.securityName,
      identity.shareClassName,
      identity.cik,
      identity.exchangeMic,
      identity.instrumentType,
    ].join(" "),
  );
  return tokens.every((token) => text.includes(token));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isSnapshot(value: unknown): value is PersonalSecFinancialSnapshotDto {
  if (
    !exactRecord(value, [
      "calendarYear",
      "fetchedAt",
      "expiresAt",
      "snapshotSha256",
      "frames",
      "instantQuarter",
      "instantFrames",
      "priorCalendarYear",
      "priorRevenueFrames",
    ])
  )
    return false;
  if (
    !isCalendarYear(value.calendarYear) ||
    !isInstant(value.fetchedAt) ||
    !isInstant(value.expiresAt) ||
    Date.parse(value.expiresAt) <= Date.parse(value.fetchedAt) ||
    typeof value.snapshotSha256 !== "string" ||
    !DIGEST.test(value.snapshotSha256) ||
    !Array.isArray(value.frames) ||
    value.frames.length !== CONCEPTS.length ||
    value.instantQuarter !== 4 ||
    !Array.isArray(value.instantFrames) ||
    value.instantFrames.length !== INSTANT_CONCEPTS.length ||
    value.priorCalendarYear !== value.calendarYear - 1 ||
    !Array.isArray(value.priorRevenueFrames) ||
    value.priorRevenueFrames.length !== REVENUE_CONCEPTS.length
  )
    return false;
  for (const collection of [
    { frames: value.frames, concepts: CONCEPTS, year: value.calendarYear },
    {
      frames: value.priorRevenueFrames,
      concepts: REVENUE_CONCEPTS,
      year: value.priorCalendarYear,
    },
  ]) {
    const seenConcepts = new Set<string>();
    for (const frame of collection.frames as unknown[]) {
      if (
        !exactRecord(frame, [
          "concept",
          "status",
          "sourceUrl",
          "facts",
          "unknownCiks",
        ]) ||
        !collection.concepts.some((concept) => concept === frame.concept) ||
        typeof frame.concept !== "string" ||
        seenConcepts.has(frame.concept) ||
        typeof frame.status !== "string" ||
        !["available", "not_covered", ...FAILED_SOURCE_STATUSES].includes(
          frame.status,
        ) ||
        frame.sourceUrl !==
          `https://data.sec.gov/api/xbrl/frames/us-gaap/${frame.concept}/USD/CY${String(collection.year)}.json` ||
        !Array.isArray(frame.facts) ||
        frame.facts.length > 50_000 ||
        !Array.isArray(frame.unknownCiks) ||
        frame.unknownCiks.length > 50_000 ||
        !frame.unknownCiks.every(
          (cik: unknown) => typeof cik === "string" && CIK.test(cik),
        ) ||
        (frame.status !== "available" &&
          (frame.facts.length !== 0 || frame.unknownCiks.length !== 0))
      )
        return false;
      seenConcepts.add(frame.concept);
      for (const fact of frame.facts as unknown[]) {
        if (
          !exactRecord(fact, [
            "cik",
            "accessionNumber",
            "startDate",
            "endDate",
            "value",
          ]) ||
          typeof fact.cik !== "string" ||
          !CIK.test(fact.cik) ||
          typeof fact.accessionNumber !== "string" ||
          !ACCESSION.test(fact.accessionNumber) ||
          !isDate(fact.startDate) ||
          !isDate(fact.endDate) ||
          fact.startDate > fact.endDate ||
          typeof fact.value !== "string" ||
          fact.value.length > 64
        )
          return false;
      }
    }
  }
  const seenInstantConcepts = new Set<string>();
  for (const frame of value.instantFrames as unknown[]) {
    if (
      !exactRecord(frame, [
        "concept",
        "status",
        "sourceUrl",
        "facts",
        "unknownCiks",
      ]) ||
      !INSTANT_CONCEPTS.some((concept) => concept === frame.concept) ||
      typeof frame.concept !== "string" ||
      seenInstantConcepts.has(frame.concept) ||
      typeof frame.status !== "string" ||
      !["available", "not_covered", ...FAILED_SOURCE_STATUSES].includes(
        frame.status,
      ) ||
      frame.sourceUrl !==
        `https://data.sec.gov/api/xbrl/frames/us-gaap/${frame.concept}/USD/CY${String(value.calendarYear)}Q4I.json` ||
      !Array.isArray(frame.facts) ||
      frame.facts.length > 50_000 ||
      !Array.isArray(frame.unknownCiks) ||
      frame.unknownCiks.length > 50_000 ||
      !frame.unknownCiks.every(
        (cik: unknown) => typeof cik === "string" && CIK.test(cik),
      ) ||
      (frame.status !== "available" &&
        (frame.facts.length !== 0 || frame.unknownCiks.length !== 0))
    )
      return false;
    seenInstantConcepts.add(frame.concept);
    for (const fact of frame.facts as unknown[]) {
      if (
        !exactRecord(fact, ["cik", "accessionNumber", "asOfDate", "value"]) ||
        typeof fact.cik !== "string" ||
        !CIK.test(fact.cik) ||
        typeof fact.accessionNumber !== "string" ||
        !ACCESSION.test(fact.accessionNumber) ||
        !isDate(fact.asOfDate) ||
        Number(fact.asOfDate.slice(0, 4)) < value.calendarYear - 1 ||
        Number(fact.asOfDate.slice(0, 4)) > value.calendarYear + 1 ||
        typeof fact.value !== "string" ||
        fact.value.length > 64
      )
        return false;
    }
  }
  return true;
}

function isIdentity(
  value: unknown,
): value is PersonalSecurityMasterScreenRowDto {
  if (
    !exactRecord(value, [
      "cik",
      "country",
      "exchangeMic",
      "instrumentType",
      "issuerId",
      "issuerName",
      "listingId",
      "securityId",
      "securityName",
      "shareClassId",
      "shareClassName",
      "symbol",
    ])
  )
    return false;
  return (
    typeof value.cik === "string" &&
    CIK.test(value.cik) &&
    value.country === "US" &&
    typeof value.exchangeMic === "string" &&
    /^[A-Z0-9]{4}$/u.test(value.exchangeMic) &&
    (value.instrumentType === "common_stock" ||
      value.instrumentType === "adr") &&
    [
      value.issuerId,
      value.listingId,
      value.securityId,
      value.shareClassId,
    ].every(
      (id) =>
        typeof id === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(id),
    ) &&
    [value.issuerName, value.securityName, value.shareClassName].every(
      (name) =>
        typeof name === "string" &&
        name.length > 0 &&
        [...name].length <= 500 &&
        !INVALID_TEXT.test(name),
    ) &&
    typeof value.symbol === "string" &&
    /^[A-Z0-9][A-Z0-9.-]{0,31}$/u.test(value.symbol)
  );
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) return false;
  const names = Reflect.ownKeys(value);
  if (
    names.length !== keys.length ||
    !names.every((key) => typeof key === "string" && keys.includes(key))
  )
    return false;
  return names.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      descriptor !== undefined && "value" in descriptor && descriptor.enumerable
    );
  });
}

function isMetric(value: unknown): value is PersonalFinancialScreenMetricDto {
  return METRICS.some((metric) => metric === value);
}
function isCalendarYear(value: unknown): value is number {
  return boundedInteger(
    value,
    PERSONAL_FINANCIAL_SCREEN_LIMITS.minimumCalendarYear,
    PERSONAL_FINANCIAL_SCREEN_LIMITS.maximumCalendarYear,
  );
}
function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}
function isDecimal(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    DECIMAL.test(value) &&
    new ScreenDecimal(value).isFinite()
  );
}
function canonicalDecimal(value: Decimal): string {
  return value.isZero() ? "0" : value.toFixed();
}
function isDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}
function isInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().replace(".000Z", "Z") ===
      value.replace(".000Z", "Z")
  );
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function fail(): never {
  throw new TypeError("Personal financial screen request is invalid.");
}
