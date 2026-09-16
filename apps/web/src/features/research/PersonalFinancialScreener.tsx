"use client";

import {
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_FINANCIAL_REVENUE_BASES,
  type PersonalFinancialRevenueBasisDto,
  type PersonalFinancialScreenCellDto,
  type PersonalFinancialScreenGrowthCellDto,
  type PersonalFinancialScreenClauseDto,
  type PersonalFinancialScreenCriteriaDto,
  type PersonalFinancialScreenMetricDto,
  type PersonalFinancialScreenResponseDto,
  type PersonalFinancialScreenRowDto,
  type PersonalFinancialSavedViewsPayloadDto,
  type PersonalSecurityMasterScreenRowDto,
  type PersonalSecurityMasterSnapshotReceiptDto,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

import {
  fetchPersonalFinancialSavedViews,
  isPersonalFinancialScreenCriteria,
  isPersonalFinancialInstantSource,
  personalFinancialSourceUrl,
  savePersonalFinancialSavedViews,
  screenPersonalFinancials,
} from "@/lib/personal-financial-screen-api";
import {
  normalizePersonalScreenerSavedViewName,
  PersonalWorkspaceApiError,
} from "@/lib/personal-workspace-api";
import type { OwnerSessionActivityStart } from "./owner-session-lifecycle";

export const PERSONAL_FINANCIAL_SCREENER_PAGE_SIZE = 25;
const metrics = PERSONAL_FINANCIAL_SCREEN_METRICS;
const columnViews = {
  overview: {
    label: "Overview",
    metrics: [
      "revenue",
      "netIncome",
      "operatingCashFlow",
      "netMargin",
      "currentRatio",
    ],
  },
  profitability: {
    label: "Profitability",
    metrics: [
      "revenue",
      "grossProfit",
      "netIncome",
      "operatingIncome",
      "grossMargin",
      "netMargin",
      "operatingMargin",
    ],
  },
  cashFlow: {
    label: "Cash flow",
    metrics: [
      "operatingCashFlow",
      "ppePurchases",
      "operatingCashFlowLessPpePurchases",
      "operatingCashFlowMargin",
      "operatingCashFlowToNetIncome",
      "operatingCashFlowLessPpePurchasesMargin",
    ],
  },
  q4Balances: {
    label: "Q4 balances",
    metrics: [
      "currentAssets",
      "currentLiabilities",
      "currentRatio",
      "currentAssetsLessCurrentLiabilities",
    ],
  },
  all: { label: "All metrics", metrics },
} as const satisfies Record<
  string,
  { label: string; metrics: readonly PersonalFinancialScreenMetricDto[] }
>;
function orderedMetrics(selected: readonly PersonalFinancialScreenMetricDto[]) {
  return metrics.filter((metric) => selected.includes(metric));
}
const starterScreens = [
  {
    name: "Growth with cash after PP&E",
    description:
      "Selected revenue YoY change ≥ 5% and operating cash flow less PP&E purchases ≥ 0 USD. Growth uses the selected revenue basis and requires positive prior revenue. The cash measure subtracts only reported PP&E purchases.",
    clauses: [
      { field: "revenueGrowth", operator: "gte", value: "5" },
      {
        field: "operatingCashFlowLessPpePurchases",
        operator: "gte",
        value: "0",
      },
    ],
    sort: { field: "revenueGrowth", direction: "desc" },
    metrics: [
      "revenue",
      "operatingCashFlow",
      "ppePurchases",
      "operatingCashFlowLessPpePurchases",
      "revenueGrowth",
    ],
  },
  {
    name: "Cash flow relative to income",
    description:
      "Operating cash flow / net income ≥ 100%. Requires positive net income and matching source periods and filing. Independent of the revenue basis; a higher ratio is not a quality score.",
    clauses: [
      { field: "operatingCashFlowToNetIncome", operator: "gte", value: "100" },
    ],
    sort: { field: "operatingCashFlowToNetIncome", direction: "desc" },
    metrics: ["netIncome", "operatingCashFlow", "operatingCashFlowToNetIncome"],
  },
  {
    name: "Q4 liquidity cover",
    description:
      "Current assets / current liabilities ≥ 1.00×. Requires nonnegative assets, positive liabilities, and matching actual Q4 balance dates and filing. Independent of the revenue basis.",
    clauses: [{ field: "currentRatio", operator: "gte", value: "1" }],
    sort: { field: "currentRatio", direction: "desc" },
    metrics: ["currentAssets", "currentLiabilities", "currentRatio"],
  },
] as const satisfies readonly {
  readonly name: string;
  readonly description: string;
  readonly clauses: readonly PersonalFinancialScreenClauseDto[];
  readonly sort: PersonalFinancialScreenCriteriaDto["sort"];
  readonly metrics: readonly PersonalFinancialScreenMetricDto[];
}[];
interface FinancialSourceSelection {
  readonly response: PersonalFinancialScreenResponseDto;
  readonly row: PersonalFinancialScreenRowDto;
  readonly metric: PersonalFinancialScreenMetricDto;
  readonly comparison: FinancialComparisonSelection | null;
}
interface FinancialComparisonSelection {
  readonly key: string;
  readonly rows: readonly PersonalFinancialScreenRowDto[];
  readonly open: boolean;
}
function comparisonKey(
  response: PersonalFinancialScreenResponseDto,
  criteria: PersonalFinancialScreenCriteriaDto,
): string {
  return JSON.stringify([
    response.schemaVersion,
    response.catalogSnapshotSha256,
    response.financialSnapshotSha256,
    response.calendarYear,
    response.priorCalendarYear,
    response.instantQuarter,
    response.revenueBasis ?? "agreement",
    response.formulaVersion,
    response.fetchedAt,
    response.expiresAt,
    criteria.calendarYear,
    criteria.revenueBasis ?? "agreement",
    criteria.identityText.trim().normalize("NFC"),
    criteria.clauses.map(({ field, operator, value }) => [
      field,
      operator,
      value,
    ]),
    [criteria.sort.field, criteria.sort.direction],
  ]);
}
function sameComparisonIssuer(
  first: PersonalFinancialScreenRowDto,
  second: PersonalFinancialScreenRowDto,
): boolean {
  return (
    first.identity.issuerId === second.identity.issuerId ||
    first.identity.cik === second.identity.cik
  );
}
const revenueBasisLabels: Readonly<
  Record<PersonalFinancialRevenueBasisDto, string>
> = {
  agreement: "Require agreement",
  Revenues: "Revenues (broad concept)",
  RevenueFromContractWithCustomerExcludingAssessedTax:
    "Customer-contract revenue, excluding tax",
  SalesRevenueNet: "Net sales and services (legacy)",
};
const labels: Readonly<Record<PersonalFinancialScreenMetricDto, string>> = {
  revenue: "Revenue",
  grossProfit: "Gross profit",
  netIncome: "Net income",
  operatingIncome: "Operating income",
  operatingCashFlow: "Operating cash flow",
  netMargin: "Net margin",
  operatingMargin: "Operating margin",
  operatingCashFlowMargin: "Operating cash flow margin",
  ppePurchases: "PP&E purchases",
  operatingCashFlowLessPpePurchases: "Operating cash flow less PP&E purchases",
  grossMargin: "Gross profit / selected revenue (%)",
  operatingCashFlowToNetIncome: "Operating cash flow / net income (%)",
  operatingCashFlowLessPpePurchasesMargin:
    "Operating cash flow less PP&E purchases / selected revenue (%)",
  currentAssets: "Current assets",
  currentLiabilities: "Current liabilities",
  currentRatio: "Current assets / current liabilities (×)",
  currentAssetsLessCurrentLiabilities:
    "Current assets less current liabilities (USD)",
  revenueGrowth: "Selected revenue YoY change (%)",
};
const formulas: Readonly<Record<PersonalFinancialScreenMetricDto, string>> = {
  revenue:
    "Reported revenue. Available revenue concepts must agree on value and reporting period.",
  grossProfit:
    "Reported GrossProfit in USD, independent of the revenue basis. Missing or unresolved reported amounts stay unknown.",
  netIncome: "Reported net income (loss).",
  operatingIncome: "Reported operating income (loss).",
  operatingCashFlow:
    "Reported net cash provided by (used in) operating activities.",
  netMargin:
    "Net income / revenue × 100. Requires positive revenue and identical source periods.",
  operatingMargin:
    "Operating income / revenue × 100. Requires positive revenue and identical source periods.",
  operatingCashFlowMargin:
    "Operating cash flow / revenue × 100. Requires positive revenue and identical source periods.",
  ppePurchases:
    "Reported cash payments to acquire property, plant and equipment in USD. Independent of the revenue basis; includes only this reported purchase concept.",
  operatingCashFlowLessPpePurchases:
    "Operating cash flow − PP&E purchases. Exact subtraction requires the same supported annual period and filing accession, with nonnegative PP&E purchases. Independent of the revenue basis; this measure does not include every investing cash flow.",
  grossMargin:
    "Reported GrossProfit / selected revenue × 100. Requires positive selected revenue and every input reference to share the same supported annual period (335–395 inclusive days) and filing accession. Rounded half-up to two decimal places; negative results and results above 100% are retained.",
  operatingCashFlowToNetIncome:
    "Operating cash flow / net income × 100. Requires positive reported net income and every input reference to share the same supported annual period (335–395 inclusive days) and filing accession. Rounded half-up to two decimal places; zero, negative and above-100% results are retained. Independent of the revenue basis.",
  operatingCashFlowLessPpePurchasesMargin:
    "(Operating cash flow − PP&E purchases) / selected revenue × 100. Requires nonnegative PP&E purchases, positive selected revenue, and every retained reference from all three inputs to share the same supported annual period (335–395 inclusive days) and filing accession. Subtracted and divided exactly, then rounded half-up once to two decimal places; zero, negative and above-100% results are retained. Filters compare the displayed rounded percentage.",
  currentAssets:
    "Reported AssetsCurrent in USD. The screen uses balances dated October 1 through December 31 of the selected year, inclusive. Negative reported balances remain visible. Independent of the revenue basis.",
  currentLiabilities:
    "Reported LiabilitiesCurrent in USD. The screen uses balances dated October 1 through December 31 of the selected year, inclusive. Negative reported balances remain visible. Independent of the revenue basis.",
  currentRatio:
    "Current assets / current liabilities, in multiples. Requires nonnegative assets, positive liabilities, and every reference to share the same actual balance date within Q4 and filing accession. Rounded half-up to two decimal places; inclusive filters compare the displayed rounded multiple. Independent of the revenue basis.",
  currentAssetsLessCurrentLiabilities:
    "Current assets − current liabilities, in USD. Exact subtraction requires nonnegative reported balances and every reference to share the same actual balance date within Q4 and filing accession. Zero liabilities and a negative difference are valid. Independent of the revenue basis; this measure is not cash available to spend.",
  revenueGrowth:
    "(Current selected revenue − prior selected revenue) / prior selected revenue × 100. Requires positive prior revenue, adjacent supported annual periods, unchanged revenue concepts and agreeing facts from one filing within each year. The two years may use different filings. Rounded half-up once to two decimal places; zero and negative current revenue are retained.",
};
function revenueExplanation(basis: PersonalFinancialRevenueBasisDto): string {
  return basis === "agreement"
    ? "All available revenue concepts must agree on value and reporting period. Different definitions can produce different amounts."
    : "Uses this one concept for every company and all revenue-based percentage calculations, without substituting another revenue concept.";
}
function formulaFor(
  metric: PersonalFinancialScreenMetricDto,
  basis: PersonalFinancialRevenueBasisDto,
): string {
  return metric === "revenue" && basis !== "agreement"
    ? `Reported ${revenueBasisLabels[basis]}. Missing or unresolved selected facts stay unknown.`
    : formulas[metric];
}
function metricOptionLabel(metric: PersonalFinancialScreenMetricDto): string {
  return [
    "grossProfit",
    "ppePurchases",
    "operatingCashFlowLessPpePurchases",
    "currentAssets",
    "currentLiabilities",
  ].includes(metric)
    ? `${labels[metric]} (USD)`
    : labels[metric];
}

function isPercentageMetric(metric: PersonalFinancialScreenMetricDto): boolean {
  return (
    metric === "revenueGrowth" ||
    metric === "operatingCashFlowToNetIncome" ||
    metric.endsWith("Margin")
  );
}

function revenueGrowthUnknownExplanation(
  cell: PersonalFinancialScreenGrowthCellDto,
): string | null {
  if (cell.status === "available") return null;
  if (
    cell.reason === "prior_unavailable" ||
    cell.reason === "current_unavailable"
  ) {
    const prior = cell.reason === "prior_unavailable";
    const operand = prior ? cell.priorRevenue : cell.currentRevenue;
    return `${prior ? "Prior" : "Current"} selected revenue is unresolved${operand.status === "unavailable" ? ` (${operand.reason.replaceAll("_", " ")})` : ""}. Missing or failed revenue is never treated as zero; retained references remain visible.`;
  }
  if (cell.reason === "concept_set_changed")
    return "The retained revenue concepts changed between years. The comparison remains unknown to avoid silently switching the revenue measure.";
  if (cell.reason === "nonadjacent_periods")
    return "The actual annual periods overlap or leave a gap. The current period must begin the day after the prior period ends; their durations can differ.";
  if (cell.reason === "nonpositive_prior_revenue")
    return "Prior selected revenue is zero or negative. A positive prior amount is required; both reported amounts retain their signs.";
  if (cell.reason === "filing_mismatch")
    return "Agreeing revenue references within one year come from different filings. Each year must use one filing; different filings across the two years are allowed.";
  return "The retained references do not establish consistent supported annual periods (335–395 inclusive days). Compare the actual source dates below.";
}

function metricUnitLabel(metric: PersonalFinancialScreenMetricDto): string {
  return metric === "currentRatio"
    ? "×"
    : isPercentageMetric(metric)
      ? "%"
      : "USD";
}

function currentRatioUnknownExplanation(
  cell: PersonalFinancialScreenCellDto,
): string | null {
  if (cell.status === "available") return null;
  if (cell.reason === "unsupported_balance_date")
    return "A reported balance date falls outside October 1–December 31 of the selected year. This is the app’s Q4 date rule, not an SEC-published date tolerance; retained actual dates remain visible.";
  if (cell.reason === "balance_date_mismatch")
    return "The current asset and liability references have different actual balance dates. The Q4 frame label alone does not make them compatible.";
  if (cell.reason === "filing_mismatch")
    return "The current asset and liability references come from different filing accessions. The ratio remains unknown to avoid mixing filing versions.";
  if (cell.reason === "nonpositive_current_liabilities")
    return "Reported current liabilities are zero or negative. The ratio requires a positive denominator; both reported balances remain visible.";
  if (cell.reason === "unsupported_sign")
    return "Reported current assets are negative. Their sign is preserved; this ratio requires nonnegative assets and does not take an absolute value.";
  return "A current asset or liability input is unresolved. The ratio remains unknown; retained reported references are shown below.";
}

function currentBalanceDifferenceUnknownExplanation(
  cell: PersonalFinancialScreenCellDto,
): string | null {
  if (cell.status === "available") return null;
  if (cell.reason === "unsupported_balance_date")
    return "A reported balance date falls outside October 1–December 31 of the selected year. The subtraction remains unknown; retained actual dates remain visible.";
  if (cell.reason === "balance_date_mismatch")
    return "The current asset and liability references have different actual balance dates. The Q4 frame label alone does not make them compatible.";
  if (cell.reason === "filing_mismatch")
    return "The current asset and liability references come from different filing accessions. The subtraction remains unknown to avoid mixing filing versions.";
  if (cell.reason === "unsupported_sign")
    return "Reported current assets or current liabilities are negative. Their signs are preserved; this subtraction requires nonnegative operands and does not take an absolute value. A negative difference between nonnegative balances is valid.";
  return "A current asset or liability input is unresolved. The subtraction remains unknown; missing or failed inputs are never treated as zero, and retained reported references are shown below.";
}

function cashFlowUnknownExplanation(
  cell: PersonalFinancialScreenCellDto,
): string | null {
  if (cell.status === "available") return null;
  if (cell.reason === "period_mismatch")
    return "The inputs do not share the same supported annual period (335–395 inclusive days). Compare the source dates below.";
  if (cell.reason === "filing_mismatch")
    return "The inputs come from different filing accessions. Combining those filing versions could mix restated and earlier amounts.";
  if (cell.reason === "unsupported_sign")
    return "Reported PP&E purchases are negative. The reported sign is preserved; the subtraction remains unknown instead of reversing the sign.";
  return "An operating cash flow or PP&E purchase input is unresolved. The subtraction remains unknown; retained source references are shown below.";
}

type CashMarginInputs = Pick<
  PersonalFinancialScreenRowDto["metrics"],
  "revenue" | "operatingCashFlow" | "ppePurchases"
>;

function cashMarginUnknownExplanation(
  cell: PersonalFinancialScreenCellDto,
  inputs: CashMarginInputs,
): string | null {
  if (cell.status === "available") return null;
  for (const [label, operand] of [
    ["Selected revenue", inputs.revenue],
    ["Operating cash flow", inputs.operatingCashFlow],
    ["PP&E purchases", inputs.ppePurchases],
  ] as const) {
    if (operand.status === "unavailable")
      return `${label} ${label === "PP&E purchases" ? "are" : "is"} unresolved (${operand.reason.replaceAll("_", " ")}). The ratio remains unknown; missing or failed inputs are never treated as zero, and retained references remain visible.`;
  }
  if (cell.reason === "period_mismatch")
    return "The three inputs do not share the same supported annual period (335–395 inclusive days). Compare every retained source date below; one calendar frame alone does not make them compatible.";
  if (cell.reason === "filing_mismatch")
    return "The three inputs come from different filing accessions. The ratio remains unknown to avoid mixing filing versions, even when reported amounts agree.";
  if (cell.reason === "unsupported_sign")
    return "Reported PP&E purchases are negative. Their sign is preserved; this ratio requires nonnegative purchases and does not reverse the sign or take an absolute value.";
  if (cell.reason === "nonpositive_revenue")
    return "Selected revenue is zero or negative. The ratio requires a positive denominator; all reported operands remain visible below.";
  return "The ratio remains unknown; inspect all three reported inputs and their retained references below.";
}

function grossMarginUnknownExplanation(
  cell: PersonalFinancialScreenCellDto,
): string | null {
  if (cell.status === "available") return null;
  if (cell.reason === "period_mismatch")
    return "The numerator and denominator references do not share the same supported annual period (335–395 inclusive days). Compare every source date below.";
  if (cell.reason === "filing_mismatch")
    return "The numerator and denominator references come from different filing accessions. The ratio remains unknown to avoid mixing filing versions.";
  if (cell.reason === "nonpositive_revenue")
    return "Selected revenue is zero or negative. A positive denominator is required; the reported operands keep their values below.";
  return "Reported gross profit or selected revenue is unresolved. The ratio remains unknown; retained source references are shown below.";
}

function cashFlowToIncomeUnknownExplanation(
  cell: PersonalFinancialScreenCellDto,
): string | null {
  if (cell.status === "available") return null;
  if (cell.reason === "period_mismatch")
    return "The operating cash flow and net income references do not share the same supported annual period (335–395 inclusive days). Compare every source date below.";
  if (cell.reason === "filing_mismatch")
    return "The operating cash flow and net income references come from different filing accessions. The ratio remains unknown to avoid mixing filing versions.";
  if (cell.reason === "nonpositive_net_income")
    return "Reported net income is zero or negative. A positive net income denominator is required; the reported operands keep their values below.";
  return "Reported net income or operating cash flow is unresolved. The ratio remains unknown; retained source references are shown below.";
}

function exactPercentage(value: string): string {
  return `${exactDecimalDisplay(value)}%`;
}
function exactDecimalDisplay(value: string): string {
  const [integer = "", fraction] = value.split(".");
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}${fraction === undefined ? "" : `.${fraction}`}`;
}
const emptySaved: PersonalFinancialSavedViewsPayloadDto = {
  schemaVersion: 1,
  views: [],
};
function defaultCriteria(): PersonalFinancialScreenCriteriaDto {
  return {
    calendarYear: new Date().getUTCFullYear() - 1,
    identityText: "",
    clauses: [],
    sort: { field: "symbol", direction: "asc" },
  };
}

export interface PersonalFinancialScreenerProps {
  readonly snapshot: PersonalSecurityMasterSnapshotReceiptDto;
  readonly canAddToWatchlist: boolean;
  readonly onAddToWatchlist: (row: PersonalSecurityMasterScreenRowDto) => void;
  readonly onOpenResearch: (row: PersonalSecurityMasterScreenRowDto) => void;
  readonly onSessionUnavailable: () => void;
  readonly onActivityStart: OwnerSessionActivityStart;
  readonly savedListingIds: ReadonlySet<string>;
  readonly disabled?: boolean;
  readonly workspaceReady?: boolean;
}

export function PersonalFinancialScreener({
  snapshot,
  canAddToWatchlist,
  onAddToWatchlist,
  onOpenResearch,
  onSessionUnavailable,
  onActivityStart,
  savedListingIds,
  disabled = false,
  workspaceReady = true,
}: PersonalFinancialScreenerProps) {
  const [criteria, setCriteria] =
    useState<PersonalFinancialScreenCriteriaDto>(defaultCriteria());
  const [response, setResponse] =
    useState<PersonalFinancialScreenResponseDto | null>(null);
  const [visibleMetrics, setVisibleMetrics] = useState<
    readonly PersonalFinancialScreenMetricDto[]
  >(orderedMetrics(columnViews.overview.metrics));
  const currentVisibleMetrics = useRef(visibleMetrics);
  currentVisibleMetrics.current = visibleMetrics;
  const [inspection, setInspection] = useState<FinancialSourceSelection | null>(
    null,
  );
  const currentInspection = useRef(inspection);
  currentInspection.current = inspection;
  const inspectionTrigger = useRef<HTMLButtonElement | null>(null);
  const inspectionHeading = useRef<HTMLHeadingElement | null>(null);
  const resultsHeading = useRef<HTMLHeadingElement | null>(null);
  const [comparison, setComparison] =
    useState<FinancialComparisonSelection | null>(null);
  const currentComparison = useRef(comparison);
  currentComparison.current = comparison;
  const comparisonHeading = useRef<HTMLHeadingElement | null>(null);
  const shortlistHeading = useRef<HTMLHeadingElement | null>(null);
  const comparisonButton = useRef<HTMLButtonElement | null>(null);
  const currentResponse = useRef(response);
  currentResponse.current = response;
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(
    "Choose financial criteria, then run the screen.",
  );
  const [savedPayload, setSavedPayload] =
    useState<PersonalFinancialSavedViewsPayloadDto>(emptySaved);
  const [savedVersion, setSavedVersion] = useState(0);
  const [savedBusy, setSavedBusy] = useState(false);
  const [savedAvailable, setSavedAvailable] = useState(false);
  const [savedMessage, setSavedMessage] = useState(
    "Loading saved financial screens…",
  );
  const [selectedId, setSelectedId] = useState("");
  const [savedName, setSavedName] = useState("");
  const epoch = useRef(0);
  const screenEpoch = useRef(0);
  const screenController = useRef<AbortController | null>(null);
  const savedController = useRef<AbortController | null>(null);
  const sessionCallback = useRef(onSessionUnavailable);
  sessionCallback.current = onSessionUnavailable;
  const enabled = !disabled && workspaceReady;

  useEffect(() => {
    epoch.current += 1;
    screenEpoch.current += 1;
    screenController.current?.abort();
    savedController.current?.abort();
    setCriteria(defaultCriteria());
    setVisibleMetrics(orderedMetrics(columnViews.overview.metrics));
    clearInspection();
    clearComparison();
    currentResponse.current = null;
    setResponse(null);
    setRunning(false);
    setSavedPayload(emptySaved);
    setSavedVersion(0);
    setSavedAvailable(false);
    setSelectedId("");
    setSavedName("");
    setMessage("Choose financial criteria, then run the screen.");
    if (enabled) void reloadSaved();
    else {
      setSavedBusy(false);
      setSavedMessage(
        "Validate the owner session to load saved financial screens.",
      );
    }
    return () => {
      epoch.current += 1;
      screenEpoch.current += 1;
      screenController.current?.abort();
      savedController.current?.abort();
      inspectionTrigger.current = null;
      currentInspection.current = null;
      currentResponse.current = null;
      currentComparison.current = null;
    };
    // The snapshot/session boundary owns all in-memory results and pending operations.
  }, [snapshot.snapshotSha256, enabled]);

  useEffect(() => {
    if (inspection !== null && inspection.response === currentResponse.current)
      focusFinancialControl(inspectionHeading.current);
  }, [inspection]);

  useEffect(() => {
    if (comparison?.open) focusFinancialControl(comparisonHeading.current);
  }, [comparison?.open]);

  function updateComparison(next: FinancialComparisonSelection | null) {
    currentComparison.current = next;
    setComparison(next);
  }

  function clearComparison() {
    updateComparison(null);
  }

  function comparisonIsCurrent(
    selectedResponse: PersonalFinancialScreenResponseDto,
    selectedComparison: FinancialComparisonSelection | null,
  ) {
    return (
      enabled &&
      selectedResponse === currentResponse.current &&
      selectedComparison === currentComparison.current &&
      (selectedComparison === null ||
        selectedComparison.key === comparisonKey(selectedResponse, criteria))
    );
  }

  function selectForComparison(
    selectedResponse: PersonalFinancialScreenResponseDto,
    selectedComparison: FinancialComparisonSelection | null,
    listingId: string,
  ) {
    if (!comparisonIsCurrent(selectedResponse, selectedComparison)) return;
    const row = selectedResponse.rows.find(
      (item) => item.identity.listingId === listingId,
    );
    const rows = selectedComparison?.rows ?? [];
    if (
      row === undefined ||
      rows.length >= 3 ||
      rows.some(
        (item) =>
          item.identity.listingId === listingId ||
          sameComparisonIssuer(item, row),
      )
    )
      return;
    clearInspection();
    updateComparison({
      key: comparisonKey(selectedResponse, criteria),
      rows: [...rows, row],
      open: selectedComparison?.open ?? false,
    });
  }

  function changeComparison(
    selectedResponse: PersonalFinancialScreenResponseDto,
    selectedComparison: FinancialComparisonSelection | null,
    action: "open" | "close" | "clear" | "remove",
    listingId?: string,
  ) {
    if (
      !comparisonIsCurrent(selectedResponse, selectedComparison) ||
      selectedComparison === null
    )
      return;
    if (action === "open" && selectedComparison.rows.length < 2) return;
    if (
      action === "remove" &&
      !selectedComparison.rows.some(
        (row) => row.identity.listingId === listingId,
      )
    )
      return;
    const rows =
      action === "clear"
        ? []
        : action === "remove"
          ? selectedComparison.rows.filter(
              (row) => row.identity.listingId !== listingId,
            )
          : selectedComparison.rows;
    // Commit removals before restoring focus into the resulting layout.
    flushSync(() => {
      clearInspection();
      updateComparison({
        ...selectedComparison,
        rows,
        open:
          rows.length >= 2 &&
          (action === "open" ||
            (action === "remove" && selectedComparison.open)),
      });
    });
    if (action === "close") focusFinancialControl(comparisonButton.current);
    else if (action === "remove" || action === "clear")
      focusFinancialControl(shortlistHeading.current);
    else if (action === "open" && selectedComparison.open)
      focusFinancialControl(comparisonHeading.current);
  }

  function clearInspection() {
    currentInspection.current = null;
    setInspection(null);
    inspectionTrigger.current = null;
  }

  function changeVisibleMetrics(
    next: readonly PersonalFinancialScreenMetricDto[],
  ) {
    const ordered = orderedMetrics(next);
    if (ordered.length === 0) return;
    clearInspection();
    currentVisibleMetrics.current = ordered;
    setVisibleMetrics(ordered);
  }

  function openInspection(
    selectedResponse: PersonalFinancialScreenResponseDto,
    listingId: string,
    metric: PersonalFinancialScreenMetricDto,
    trigger: HTMLButtonElement | null,
    selectedComparison: FinancialComparisonSelection | null = null,
  ) {
    const row =
      selectedComparison === null
        ? selectedResponse.rows.find(
            (item) => item.identity.listingId === listingId,
          )
        : selectedComparison.rows.find(
            (item) => item.identity.listingId === listingId,
          );
    if (
      !enabled ||
      selectedResponse !== currentResponse.current ||
      !currentVisibleMetrics.current.includes(metric) ||
      row === undefined ||
      (selectedComparison !== null &&
        (!comparisonIsCurrent(selectedResponse, selectedComparison) ||
          !selectedComparison.open))
    )
      return;
    inspectionTrigger.current = trigger;
    const nextInspection = {
      response: selectedResponse,
      row,
      metric,
      comparison: selectedComparison,
    };
    currentInspection.current = nextInspection;
    setInspection(nextInspection);
  }

  function closeInspection() {
    if (inspection === null || inspection !== currentInspection.current) return;
    const trigger = inspectionTrigger.current;
    const selectedResponse = inspection?.response;
    // Remove the panel before focus scrolls the value into its final position.
    flushSync(() => clearInspection());
    const restoreTrigger =
      selectedResponse === currentResponse.current && trigger?.isConnected;
    if (restoreTrigger) trigger.focus({ preventScroll: true });
    else focusFinancialControl(resultsHeading.current);
  }

  function clearSession() {
    epoch.current += 1;
    screenEpoch.current += 1;
    screenController.current?.abort();
    savedController.current?.abort();
    setVisibleMetrics(orderedMetrics(columnViews.overview.metrics));
    clearInspection();
    clearComparison();
    currentResponse.current = null;
    setResponse(null);
    setCriteria(defaultCriteria());
    setSavedPayload(emptySaved);
    setSavedAvailable(false);
    setSavedVersion(0);
    setSelectedId("");
    setSavedName("");
    setRunning(false);
    setSavedBusy(false);
    setMessage(
      "The owner session expired. Revalidate it to run another screen.",
    );
    setSavedMessage("Saved financial screens were cleared from this session.");
    sessionCallback.current();
  }

  function changeCriteria(next: PersonalFinancialScreenCriteriaDto) {
    screenEpoch.current += 1;
    screenController.current?.abort();
    screenController.current = null;
    setRunning(false);
    clearInspection();
    clearComparison();
    currentResponse.current = null;
    setResponse(null);
    setCriteria(next);
    setMessage("Criteria changed. Run screen to load matching annual data.");
  }

  function changeClause(
    index: number,
    update: Partial<PersonalFinancialScreenClauseDto>,
  ) {
    changeCriteria({
      ...criteria,
      clauses: criteria.clauses.map((clause, position) =>
        position === index ? { ...clause, ...update } : clause,
      ),
    });
  }

  function applyStarter(starter: (typeof starterScreens)[number]) {
    if (!enabled || savedBusy) return;
    changeCriteria({
      ...criteria,
      clauses: starter.clauses.map((clause) => ({ ...clause })),
      sort: { ...starter.sort },
    });
    setVisibleMetrics(orderedMetrics(starter.metrics));
    setSelectedId("");
    setSavedName("");
    setMessage(
      `${starter.name} applied. Edit the criteria, then Run financial screen.`,
    );
    setSavedMessage(
      "New financial screen selected; draft name cleared. Existing saved screens are unchanged. Name and save after running.",
    );
  }

  async function runScreen(offset = 0, refresh = false, paginate = false) {
    if (!enabled) return;
    if (!paginate || refresh) clearComparison();
    const normalized = {
      ...criteria,
      identityText: criteria.identityText.trim().normalize("NFC"),
    };
    if (!isPersonalFinancialScreenCriteria(normalized)) {
      setMessage(
        "Use a completed calendar year since 2009, up to seven filters, and plain decimal thresholds (USD, percentage points or multiples). Blank thresholds are invalid.",
      );
      return;
    }
    if (paginate && (response === null || response !== currentResponse.current))
      return;
    screenController.current?.abort();
    const controller = new AbortController();
    screenController.current = controller;
    const operation = ++screenEpoch.current;
    const session = epoch.current;
    const financialSnapshotSha256 =
      paginate && !refresh ? (response?.financialSnapshotSha256 ?? null) : null;
    const retainedComparison = paginate ? currentComparison.current : null;
    clearInspection();
    currentResponse.current = null;
    setResponse(null);
    setRunning(true);
    setMessage(
      refresh ? "Refreshing SEC annual data…" : "Screening SEC financials…",
    );
    try {
      const completeActivity = onActivityStart();
      if (completeActivity === undefined) {
        clearSession();
        return;
      }
      const result = await screenPersonalFinancials(
        {
          schemaVersion: "9.0.0",
          catalogSnapshotSha256: snapshot.snapshotSha256,
          financialSnapshotSha256,
          criteria: normalized,
          page: { offset, limit: PERSONAL_FINANCIAL_SCREENER_PAGE_SIZE },
          refresh,
        },
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        session !== epoch.current ||
        operation !== screenEpoch.current
      )
        return;
      if (!completeActivity()) {
        clearSession();
        return;
      }
      if (
        retainedComparison !== null &&
        retainedComparison.key !== comparisonKey(result, normalized)
      )
        clearComparison();
      setCriteria(normalized);
      currentResponse.current = result;
      setResponse(result);
      setMessage(
        result.totalMatches === 0
          ? "No listings satisfy every selected criterion. Review unknown coverage or broaden the filters."
          : `${String(result.totalMatches)} listings satisfy every selected criterion.`,
      );
    } catch (error) {
      if (
        controller.signal.aborted ||
        session !== epoch.current ||
        operation !== screenEpoch.current
      )
        return;
      if (isSessionError(error)) {
        clearSession();
        return;
      }
      clearInspection();
      clearComparison();
      currentResponse.current = null;
      setResponse(null);
      setMessage(screenErrorMessage(error));
    } finally {
      if (session === epoch.current && operation === screenEpoch.current) {
        screenController.current = null;
        setRunning(false);
      }
    }
  }

  async function reloadSaved() {
    if (!enabled) return;
    savedController.current?.abort();
    const controller = new AbortController();
    savedController.current = controller;
    const session = epoch.current;
    setSavedBusy(true);
    setSavedAvailable(false);
    try {
      const record = await fetchPersonalFinancialSavedViews(controller.signal);
      if (controller.signal.aborted || session !== epoch.current) return;
      setSavedPayload(record?.payload ?? emptySaved);
      setSavedVersion(record?.version ?? 0);
      setSavedAvailable(true);
      setSavedMessage(
        `${String(record?.payload.views.length ?? 0)} saved financial screens. Save criteria after running a screen.`,
      );
    } catch (error) {
      if (controller.signal.aborted || session !== epoch.current) return;
      if (isSessionError(error)) {
        clearSession();
        return;
      }
      setSavedPayload(emptySaved);
      setSavedVersion(0);
      setSavedMessage(
        "Saved financial screens are unavailable. Reload them to save changes.",
      );
    } finally {
      if (session === epoch.current && !controller.signal.aborted) {
        savedController.current = null;
        setSavedBusy(false);
      }
    }
  }

  function loadSaved() {
    const view = savedPayload.views.find((item) => item.id === selectedId);
    if (view === undefined) return;
    changeCriteria(structuredClone(view.criteria));
    setSavedName(view.name);
    setMessage(
      "Saved criteria loaded. Run screen against the current catalog and SEC data.",
    );
  }

  async function mutateSaved(action: "save" | "saveAs" | "delete") {
    if (!enabled || !savedAvailable || savedBusy) return;
    const selected = savedPayload.views.find((view) => view.id === selectedId);
    let next: PersonalFinancialSavedViewsPayloadDto;
    let nextId: string;
    if (action === "delete") {
      if (selected === undefined) return;
      next = {
        schemaVersion: 1,
        views: savedPayload.views.filter((view) => view.id !== selected.id),
      };
      nextId = "";
    } else {
      if (response === null || running) return;
      const name = normalizePersonalScreenerSavedViewName(savedName);
      if (name === null) {
        setSavedMessage("Give the financial screen a name of 1–80 characters.");
        return;
      }
      const replacing = action === "save" && selected !== undefined;
      if (
        (!replacing && savedPayload.views.length >= 20) ||
        savedPayload.views.some(
          (view) =>
            view.name.toLocaleLowerCase("en-US") ===
              name.toLocaleLowerCase("en-US") &&
            (!replacing || view.id !== selected.id),
        )
      ) {
        setSavedMessage(
          "Use a unique screen name. Up to 20 financial screens can be saved.",
        );
        return;
      }
      try {
        nextId = replacing
          ? selected.id
          : `financial-screen-${globalThis.crypto.randomUUID()}`;
      } catch {
        setSavedMessage("The saved-screen change could not be prepared.");
        return;
      }
      const view = {
        id: nextId,
        name,
        criteria: structuredClone(criteria),
        createdAgainstCatalogSnapshotSha256: response.catalogSnapshotSha256,
        createdAgainstFinancialSnapshotSha256: response.financialSnapshotSha256,
      };
      next = {
        schemaVersion: 1,
        views: replacing
          ? savedPayload.views.map((item) =>
              item.id === selected.id ? view : item,
            )
          : [...savedPayload.views, view],
      };
    }
    savedController.current?.abort();
    const controller = new AbortController();
    savedController.current = controller;
    const session = epoch.current;
    setSavedBusy(true);
    try {
      const saved = await savePersonalFinancialSavedViews(
        savedVersion,
        next,
        controller.signal,
      );
      if (controller.signal.aborted || session !== epoch.current) return;
      setSavedPayload(saved.payload);
      setSavedVersion(saved.version);
      setSelectedId(nextId);
      if (action === "delete") setSavedName("");
      setSavedMessage(
        action === "delete"
          ? "Financial screen deleted."
          : "Financial screen criteria saved. Result rows are not stored in saved views.",
      );
    } catch (error) {
      if (controller.signal.aborted || session !== epoch.current) return;
      if (isSessionError(error)) {
        clearSession();
        return;
      }
      if (
        error instanceof PersonalWorkspaceApiError &&
        error.code === "conflict"
      ) {
        setSavedAvailable(false);
        setSelectedId("");
        setSavedMessage(
          "Saved financial screens changed elsewhere. Reload saved screens, review the latest definitions, then save again.",
        );
      } else
        setSavedMessage(
          "The financial screen could not be saved. Reload saved screens before retrying.",
        );
    } finally {
      if (session === epoch.current && !controller.signal.aborted) {
        savedController.current = null;
        setSavedBusy(false);
      }
    }
  }

  const selected = savedPayload.views.find((view) => view.id === selectedId);
  const columnView =
    Object.entries(columnViews).find(([, view]) => {
      const ordered = orderedMetrics(view.metrics);
      return (
        ordered.length === visibleMetrics.length &&
        ordered.every((metric, index) => metric === visibleMetrics[index])
      );
    })?.[0] ?? "custom";
  return (
    <section
      className="security-search-panel personal-financial-screener"
      aria-labelledby="personal-financial-screener-title"
      aria-busy={running || savedBusy}
    >
      <div className="discovery-section-heading">
        <div>
          <p className="eyebrow">SEC financials</p>
          <h2 id="personal-financial-screener-title">Financial screen</h2>
        </div>
        <span>Annual flows · Q4 balances · USD, percentages and multiples</span>
      </div>
      <p className="market-scope-note">
        Compare annual SEC flows and Q4 balance-sheet facts across the current
        local catalog. Actual company reporting periods and balance dates can
        differ; inspect each value before comparing companies. All numeric
        filters must pass. Missing or conflicting facts stay unknown.
      </p>
      <p className="market-scope-note">
        {`Balance sheet: CY${String(criteria.calendarYear)} Q4 instant frame; inspect actual balance date.`}{" "}
        The screen uses balances dated October 1–December 31 of that year.
      </p>
      <fieldset
        className="financial-screen-controls"
        disabled={!enabled || savedBusy}
      >
        <legend>Editable starter screens</legend>
        <p className="market-scope-note">
          Sparse, illustrative starting points, not recommendations. You can
          edit every threshold. Each metric retains its own actual source
          periods; combining filters does not establish a common period.
        </p>
        <div className="personal-stock-screener-filters">
          {starterScreens.map((starter, index) => (
            <div key={starter.name}>
              <button
                className="secondary-action compact-action"
                type="button"
                disabled={!enabled || savedBusy}
                aria-describedby={`financial-starter-description-${String(index)}`}
                onClick={() => applyStarter(starter)}
              >
                Apply {starter.name}
              </button>
              <p
                className="market-scope-note"
                id={`financial-starter-description-${String(index)}`}
              >
                {starter.description}
              </p>
            </div>
          ))}
        </div>
        <p className="market-scope-note">
          Applying replaces numeric filters, sort and visible columns, while
          keeping the year, revenue basis and company filter. It selects New
          financial screen and clears the draft name to protect saved screens.
          No data is fetched or saved until you explicitly run or save.
        </p>
      </fieldset>
      <form
        className="personal-stock-screener-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runScreen();
        }}
      >
        <fieldset disabled={!enabled} className="financial-screen-controls">
          <legend>Financial screen criteria</legend>
          <div className="personal-stock-screener-filters">
            <label>
              <span>Calendar year</span>
              <input
                aria-label="Financial calendar year"
                type="number"
                min={2009}
                max={new Date().getUTCFullYear() - 1}
                step={1}
                value={criteria.calendarYear}
                onChange={(event) =>
                  changeCriteria({
                    ...criteria,
                    calendarYear: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              <span>Symbol or company</span>
              <input
                aria-label="Financial company filter"
                maxLength={120}
                value={criteria.identityText}
                onChange={(event) =>
                  changeCriteria({
                    ...criteria,
                    identityText: event.target.value,
                  })
                }
                placeholder="All listed companies"
              />
            </label>
            <label>
              <span>Revenue basis</span>
              <select
                aria-label="Revenue basis"
                aria-describedby="financial-revenue-basis-help"
                value={criteria.revenueBasis ?? "agreement"}
                onChange={(event) =>
                  changeCriteria({
                    ...criteria,
                    revenueBasis: event.target
                      .value as PersonalFinancialRevenueBasisDto,
                  })
                }
              >
                {PERSONAL_FINANCIAL_REVENUE_BASES.map((basis) => (
                  <option key={basis} value={basis}>
                    {revenueBasisLabels[basis]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort financial results by</span>
              <select
                aria-label="Financial sort field"
                value={criteria.sort.field}
                onChange={(event) =>
                  changeCriteria({
                    ...criteria,
                    sort: {
                      ...criteria.sort,
                      field: event.target
                        .value as PersonalFinancialScreenCriteriaDto["sort"]["field"],
                    },
                  })
                }
              >
                <option value="symbol">Symbol</option>
                {metrics.map((metric) => (
                  <option value={metric} key={metric}>
                    {metricOptionLabel(metric)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Direction</span>
              <select
                aria-label="Financial sort direction"
                value={criteria.sort.direction}
                onChange={(event) =>
                  changeCriteria({
                    ...criteria,
                    sort: {
                      ...criteria.sort,
                      direction: event.target.value as "asc" | "desc",
                    },
                  })
                }
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
          </div>
          <p id="financial-revenue-basis-help" className="market-scope-note">
            {revenueExplanation(criteria.revenueBasis ?? "agreement")} Revenue
            definitions are not interchangeable. This choice applies to revenue
            and all revenue-based percentage calculations. Run the screen to
            apply it.
          </p>
          <div className="financial-screen-clauses">
            {criteria.clauses.map((clause, index) => (
              <div className="financial-screen-clause" key={index}>
                <label>
                  <span>Metric {index + 1}</span>
                  <select
                    aria-label={`Financial metric ${String(index + 1)}`}
                    value={clause.field}
                    onChange={(event) =>
                      changeClause(index, {
                        field: event.target
                          .value as PersonalFinancialScreenMetricDto,
                      })
                    }
                  >
                    {metrics.map((metric) => (
                      <option value={metric} key={metric}>
                        {metricOptionLabel(metric)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Comparison</span>
                  <select
                    aria-label={`Financial comparison ${String(index + 1)}`}
                    value={clause.operator}
                    onChange={(event) =>
                      changeClause(index, {
                        operator: event.target.value as "gte" | "lte",
                      })
                    }
                  >
                    <option value="gte">At least (≥)</option>
                    <option value="lte">At most (≤)</option>
                  </select>
                </label>
                <label>
                  <span>Threshold ({metricUnitLabel(clause.field)})</span>
                  <input
                    aria-label={`Financial threshold ${String(index + 1)}`}
                    inputMode="decimal"
                    maxLength={64}
                    value={clause.value}
                    onChange={(event) =>
                      changeClause(index, { value: event.target.value })
                    }
                    placeholder={
                      clause.field === "currentRatio"
                        ? "1 = 1.00×"
                        : isPercentageMetric(clause.field)
                          ? "15 = 15%"
                          : "1000000000 = $1 billion"
                    }
                  />
                </label>
                <button
                  className="secondary-action compact-action"
                  type="button"
                  aria-label={`Remove financial filter ${String(index + 1)}`}
                  onClick={() =>
                    changeCriteria({
                      ...criteria,
                      clauses: criteria.clauses.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="personal-stock-screener-run-actions">
            <button
              className="secondary-action compact-action"
              type="button"
              disabled={criteria.clauses.length >= 7}
              onClick={() =>
                changeCriteria({
                  ...criteria,
                  clauses: [
                    ...criteria.clauses,
                    { field: "revenue", operator: "gte", value: "" },
                  ],
                })
              }
            >
              Add financial filter
            </button>
            <button
              className="primary-action compact-action"
              type="submit"
              disabled={running}
            >
              {running ? "Running financial screen…" : "Run financial screen"}
            </button>
            <button
              className="secondary-action compact-action"
              type="button"
              disabled={running}
              onClick={() => void runScreen(0, true)}
            >
              Refresh SEC data
            </button>
            <button
              className="secondary-action compact-action"
              type="button"
              onClick={() => changeCriteria(defaultCriteria())}
            >
              Reset financial criteria
            </button>
          </div>
        </fieldset>
      </form>
      <p className="discovery-status" aria-live="polite">
        {message}
      </p>
      <fieldset className="financial-screen-view-controls" disabled={!enabled}>
        <legend>Display columns</legend>
        <label>
          <span>Financial column view</span>
          <select
            aria-label="Financial column view"
            aria-describedby="financial-column-view-help"
            value={columnView}
            onChange={(event) => {
              const view = Object.entries(columnViews).find(
                ([key]) => key === event.target.value,
              )?.[1];
              if (view) changeVisibleMetrics(view.metrics);
            }}
          >
            {Object.entries(columnViews).map(([key, view]) => (
              <option key={key} value={key}>
                {view.label}
              </option>
            ))}
            {columnView === "custom" && <option value="custom">Custom</option>}
          </select>
        </label>
        <details className="financial-screen-column-picker">
          <summary>Choose columns</summary>
          <div className="financial-screen-column-options">
            {metrics.map((metric) => (
              <label key={metric}>
                <input
                  type="checkbox"
                  aria-label={`Show ${labels[metric]} column`}
                  checked={visibleMetrics.includes(metric)}
                  disabled={
                    visibleMetrics.length === 1 &&
                    visibleMetrics.includes(metric)
                  }
                  onChange={(event) =>
                    changeVisibleMetrics(
                      event.target.checked
                        ? [...visibleMetrics, metric]
                        : visibleMetrics.filter((item) => item !== metric),
                    )
                  }
                />
                <span>{metricOptionLabel(metric)}</span>
              </label>
            ))}
          </div>
        </details>
        <p id="financial-column-view-help" className="market-scope-note">
          Columns affect display only. All criteria and the selected sort still
          apply, including fields hidden from the table. Choose at least one
          metric.
        </p>
      </fieldset>
      {response === null ? (
        <div className="discovery-empty-state">
          <strong>
            {running
              ? "Loading financial results…"
              : "Run a financial screen to see results."}
          </strong>
          <span>
            Amounts use USD; a percentage threshold of 15 means 15%, and a
            current-ratio threshold of 1 means 1.00×. Negative reported amounts
            keep their sign.
          </span>
        </div>
      ) : (
        <FinancialResults
          response={response}
          running={running}
          canAddToWatchlist={canAddToWatchlist && enabled}
          onAddToWatchlist={onAddToWatchlist}
          onOpenResearch={onOpenResearch}
          savedListingIds={savedListingIds}
          onPage={(offset) => void runScreen(offset, false, true)}
          criteria={criteria}
          visibleMetrics={visibleMetrics}
          inspection={inspection}
          inspectionHeading={inspectionHeading}
          resultsHeading={resultsHeading}
          onInspect={(listingId, metric, trigger) =>
            openInspection(response, listingId, metric, trigger)
          }
          onCloseInspection={closeInspection}
          comparison={comparison}
          comparisonHeading={comparisonHeading}
          shortlistHeading={shortlistHeading}
          comparisonButton={comparisonButton}
          onSelectForComparison={(listingId) =>
            selectForComparison(response, comparison, listingId)
          }
          onChangeComparison={(action, listingId) =>
            changeComparison(response, comparison, action, listingId)
          }
          onInspectComparison={(listingId, metric, trigger) =>
            openInspection(response, listingId, metric, trigger, comparison)
          }
        />
      )}
      <fieldset
        className="financial-screen-saved"
        disabled={!enabled || savedBusy}
      >
        <legend>Saved financial screens</legend>
        <p className="market-scope-note">
          Store up to 20 named criteria definitions. Loading one requires an
          explicit run against current data.
        </p>
        <div className="personal-stock-screener-filters">
          <label>
            <span>Choose a financial screen</span>
            <select
              aria-label="Saved financial screen"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="">New financial screen</option>
              {savedPayload.views.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Financial screen name</span>
            <input
              aria-label="Financial screen name"
              maxLength={80}
              value={savedName}
              onChange={(event) => setSavedName(event.target.value)}
            />
          </label>
        </div>
        <div className="personal-stock-screener-run-actions">
          <button
            className="secondary-action compact-action"
            type="button"
            disabled={!selected || !savedAvailable}
            onClick={loadSaved}
          >
            Load financial criteria
          </button>
          <button
            className="secondary-action compact-action"
            type="button"
            disabled={!savedAvailable || response === null || running}
            onClick={() => void mutateSaved("save")}
          >
            Save financial screen
          </button>
          <button
            className="secondary-action compact-action"
            type="button"
            disabled={
              !savedAvailable ||
              response === null ||
              running ||
              savedPayload.views.length >= 20
            }
            onClick={() => void mutateSaved("saveAs")}
          >
            Save financial screen as new
          </button>
          <button
            className="secondary-action compact-action"
            type="button"
            disabled={!selected || !savedAvailable}
            onClick={() => void mutateSaved("delete")}
          >
            Delete financial screen
          </button>
          <button
            className="secondary-action compact-action"
            type="button"
            onClick={() => void reloadSaved()}
          >
            Reload saved screens
          </button>
        </div>
        {selected &&
          selected.createdAgainstCatalogSnapshotSha256 !==
            snapshot.snapshotSha256 && (
            <p className="market-scope-note">
              This definition was created against an older catalog. Running it
              uses the current catalog.
            </p>
          )}
      </fieldset>
      <p className="discovery-status" aria-live="polite">
        {savedMessage}
      </p>
      <p className="fcff-dcf-caveat">
        SEC annual frames select facts aligned to a calendar year; the two
        balance-sheet sources use its Q4 instant frame. These are historical
        reported values, with no prices, trailing-twelve-month estimates, growth
        forecasts, or historical universe reconstruction. Sources can be
        amended; the fetch time describes the current SEC snapshot. Result rows
        remain in this active session.
      </p>
    </section>
  );
}

function FinancialResults({
  response,
  running,
  canAddToWatchlist,
  onAddToWatchlist,
  onOpenResearch,
  savedListingIds,
  onPage,
  criteria,
  visibleMetrics,
  inspection,
  inspectionHeading,
  resultsHeading,
  onInspect,
  onCloseInspection,
  comparison,
  comparisonHeading,
  shortlistHeading,
  comparisonButton,
  onSelectForComparison,
  onChangeComparison,
  onInspectComparison,
}: Pick<
  PersonalFinancialScreenerProps,
  | "canAddToWatchlist"
  | "onAddToWatchlist"
  | "onOpenResearch"
  | "savedListingIds"
> & {
  readonly response: PersonalFinancialScreenResponseDto;
  readonly running: boolean;
  readonly onPage: (offset: number) => void;
  readonly criteria: PersonalFinancialScreenCriteriaDto;
  readonly visibleMetrics: readonly PersonalFinancialScreenMetricDto[];
  readonly inspection: FinancialSourceSelection | null;
  readonly inspectionHeading: RefObject<HTMLHeadingElement | null>;
  readonly resultsHeading: RefObject<HTMLHeadingElement | null>;
  readonly onInspect: (
    listingId: string,
    metric: PersonalFinancialScreenMetricDto,
    trigger: HTMLButtonElement | null,
  ) => void;
  readonly onCloseInspection: () => void;
  readonly comparison: FinancialComparisonSelection | null;
  readonly comparisonHeading: RefObject<HTMLHeadingElement | null>;
  readonly shortlistHeading: RefObject<HTMLHeadingElement | null>;
  readonly comparisonButton: RefObject<HTMLButtonElement | null>;
  readonly onSelectForComparison: (listingId: string) => void;
  readonly onChangeComparison: (
    action: "open" | "close" | "clear" | "remove",
    listingId?: string,
  ) => void;
  readonly onInspectComparison: (
    listingId: string,
    metric: PersonalFinancialScreenMetricDto,
    trigger: HTMLButtonElement | null,
  ) => void;
}) {
  const revenueBasis = response.revenueBasis ?? "agreement";
  const sourceStatuses = [...response.sources, ...response.priorRevenueSources];
  const selectedRow =
    inspection?.response === response &&
    visibleMetrics.includes(inspection.metric) &&
    (inspection.comparison === null || inspection.comparison === comparison)
      ? inspection.row
      : undefined;
  const comparedRows = comparison?.rows ?? [];
  return (
    <div className="financial-screen-results">
      <h3 ref={resultsHeading} tabIndex={-1}>
        Financial results
      </h3>
      <p className="financial-screen-applied-criteria">
        <strong>Applied filters:</strong>{" "}
        {criteria.clauses.length === 0
          ? "No numeric filters."
          : criteria.clauses
              .map(
                (clause) =>
                  `${labels[clause.field]} ${clause.operator === "gte" ? "≥" : "≤"} ${clause.value} ${metricUnitLabel(clause.field)}`,
              )
              .join("; ") + "."}{" "}
        <strong>Sort:</strong>{" "}
        {criteria.sort.field === "symbol"
          ? "Symbol"
          : labels[criteria.sort.field]}
        , {criteria.sort.direction === "asc" ? "ascending" : "descending"}.
      </p>
      <p className="market-scope-note">
        <strong>Revenue basis: {revenueBasisLabels[revenueBasis]}.</strong>{" "}
        {revenueExplanation(revenueBasis)}
      </p>
      <dl className="financial-screen-counts">
        <div>
          <dt>Matches · all filters pass</dt>
          <dd>{response.totalMatches.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>Excluded · a filter fails</dt>
          <dd>{response.totalNonMatches.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>Unknown · unresolved criteria</dt>
          <dd>{response.totalUnknown.toLocaleString("en-US")}</dd>
        </div>
      </dl>
      <p className="market-scope-note">
        {response.identityMatches.toLocaleString("en-US")} identity matches of{" "}
        {response.totalUniverse.toLocaleString("en-US")} current listed
        identities. With no numeric filters, all identity matches pass. A known
        failing filter excludes a listing even if another fact is unknown.
      </p>
      <details className="financial-screen-source-details">
        <summary>Coverage, sources, and calculation details</summary>
        <p>
          Calendar-aligned year {response.calendarYear}. Fetched{" "}
          {response.fetchedAt}; cache expires {response.expiresAt}. Formula
          version {response.formulaVersion}. Coverage is measured across
          identity matches, before numeric filters.
        </p>
        <p>
          {`Balance sheet: CY${String(response.calendarYear)} Q${String(response.instantQuarter)} instant frame; inspect actual balance date.`}{" "}
          The screen uses balances dated October 1–December 31 inclusive. SEC
          frame alignment can include other dates; this app rule can exclude
          otherwise matching balances. These balances need not coincide with the
          annual flow period or the company’s fiscal year-end.
        </p>
        <ul>
          {metrics.map((metric) => (
            <li key={metric}>
              {labels[metric]}:{" "}
              {response.metricCoverage[metric].known.toLocaleString("en-US")}{" "}
              known /{" "}
              {response.metricCoverage[metric].unknown.toLocaleString("en-US")}{" "}
              unknown. {formulaFor(metric, revenueBasis)}
            </li>
          ))}
        </ul>
        <ul>
          {response.sources.map((source) => (
            <li key={source.concept}>
              <a
                href={personalFinancialSourceUrl(
                  source.concept,
                  response.calendarYear,
                )}
                target="_blank"
                rel="noreferrer noopener"
              >
                SEC {source.concept}
              </a>
              : {source.status.replaceAll("_", " ")}
            </li>
          ))}
        </ul>
        <p>
          Revenue comparison: CY{response.calendarYear} and CY
          {response.priorCalendarYear}. Inspect both actual annual periods; the
          calendar labels alone do not establish comparability.
        </p>
        <ul>
          {response.priorRevenueSources.map((source) => (
            <li key={source.concept}>
              <a
                href={personalFinancialSourceUrl(
                  source.concept,
                  response.priorCalendarYear,
                )}
                target="_blank"
                rel="noreferrer noopener"
              >
                Prior revenue · CY{response.priorCalendarYear} · SEC{" "}
                {source.concept}
              </a>
              : {source.status.replaceAll("_", " ")}
            </li>
          ))}
        </ul>
        <p>
          {revenueBasis === "agreement"
            ? "Revenue considers customer-contract revenue excluding tax, Revenues, and SalesRevenueNet. All available concepts must agree on value and period; a failed concept request leaves agreement unresolved."
            : `Revenue uses only ${revenueBasis}. Other concept statuses remain visible here; they do not replace missing or unresolved selected facts.`}{" "}
          Unresolved facts and mismatched periods do not become zero. Source
          signs are preserved; positive cash flow is provided by operations and
          negative cash flow is used in operations.
        </p>
        <p className="financial-screen-digests">
          Catalog: {response.catalogSnapshotSha256}
          <br />
          Financial data: {response.financialSnapshotSha256}
        </p>
      </details>
      {sourceStatuses.some((source) => source.status !== "available") && (
        <p className="market-scope-note" role="status">
          {sourceStatuses.every(
            (source) =>
              source.status !== "available" && source.status !== "not_covered",
          )
            ? "SEC source data is unavailable. All concept requests failed; inspect source statuses and try refreshing later."
            : "SEC source coverage is partial. Some concepts were unavailable; inspect source statuses and unknown counts before using these results."}
        </p>
      )}
      <section
        className="financial-screen-shortlist"
        aria-labelledby="financial-screen-shortlist-title"
      >
        <h3
          id="financial-screen-shortlist-title"
          ref={shortlistHeading}
          tabIndex={-1}
        >
          Comparison shortlist
        </h3>
        <p aria-live="polite">{comparedRows.length} of 3 companies selected</p>
        <p className="market-scope-note">
          Select two or three distinct issuers from these results. Selections
          follow this query across pages and clear when criteria or data
          changes.
        </p>
        {comparedRows.length > 0 && (
          <ul className="financial-screen-shortlist-items">
            {comparedRows.map((row) => (
              <li key={row.identity.listingId}>
                <span>
                  <strong>{row.identity.symbol}</strong> ·{" "}
                  {row.identity.issuerName}
                </span>
                <button
                  className="secondary-action compact-action"
                  type="button"
                  onClick={() =>
                    onChangeComparison("remove", row.identity.listingId)
                  }
                >
                  Remove {row.identity.symbol} from comparison
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="personal-stock-screener-run-actions">
          <button
            ref={comparisonButton}
            className="primary-action compact-action"
            type="button"
            disabled={comparedRows.length < 2}
            aria-expanded={comparison?.open ?? false}
            aria-controls={
              comparison?.open ? "financial-screen-comparison" : undefined
            }
            onClick={() => onChangeComparison("open")}
          >
            Compare companies
          </button>
          <button
            className="secondary-action compact-action"
            type="button"
            disabled={comparedRows.length === 0}
            onClick={() => onChangeComparison("clear")}
          >
            Clear comparison
          </button>
        </div>
        {comparedRows.length === 3 && (
          <p className="market-scope-note">
            Compare up to three companies. Remove one to add another.
          </p>
        )}
      </section>
      {selectedRow !== undefined && inspection !== null && (
        <section
          id="financial-screen-source-inspector"
          className="financial-screen-source-inspector"
          aria-labelledby="financial-screen-inspector-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onCloseInspection();
            }
          }}
        >
          <header className="financial-screen-inspector-header">
            <div>
              <h3
                id="financial-screen-inspector-title"
                ref={inspectionHeading}
                tabIndex={-1}
              >
                {selectedRow.identity.symbol} · {labels[inspection.metric]}
              </h3>
              <p>
                {selectedRow.identity.issuerName} ·{" "}
                {selectedRow.identity.exchangeMic} · {selectedRow.identity.cik}
              </p>
            </div>
            <button
              className="secondary-action compact-action"
              type="button"
              onClick={onCloseInspection}
            >
              Close details
            </button>
          </header>
          <FinancialCellDetails
            cell={selectedRow.metrics[inspection.metric]}
            metric={inspection.metric}
            cik={selectedRow.identity.cik}
            revenueBasis={revenueBasis}
            revenueUnresolved={
              selectedRow.metrics.revenue.status === "unavailable"
            }
            cashMarginInputs={selectedRow.metrics}
          />
        </section>
      )}
      {comparison?.open && comparedRows.length >= 2 && (
        <section
          id="financial-screen-comparison"
          className="financial-screen-comparison"
          aria-labelledby="financial-screen-comparison-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onChangeComparison("close");
            }
          }}
        >
          <header className="financial-screen-inspector-header">
            <h3
              id="financial-screen-comparison-title"
              ref={comparisonHeading}
              tabIndex={-1}
            >
              Company comparison
            </h3>
            <button
              className="secondary-action compact-action"
              type="button"
              onClick={() => onChangeComparison("close")}
            >
              Close comparison
            </button>
          </header>
          <p className="market-scope-note">
            Calendar selection {response.calendarYear}; prior revenue{" "}
            {response.priorCalendarYear}. Revenue basis:{" "}
            {revenueBasisLabels[revenueBasis]}. Fetched {response.fetchedAt};
            cache expires {response.expiresAt}. Display columns also control
            these comparison rows.
          </p>
          <p className="market-scope-note">
            Each value retains its actual source dates below. A common calendar
            selection or date does not establish comparable businesses,
            accounting or investment quality. Select any value or Unknown for
            the exact inputs, reasons and filings.
          </p>
          <details className="financial-screen-source-details">
            <summary>Shared comparison snapshot</summary>
            <p>Formula version {response.formulaVersion}.</p>
            <p className="financial-screen-digests">
              Catalog: {response.catalogSnapshotSha256}
              <br />
              Financial data: {response.financialSnapshotSha256}
            </p>
          </details>
          <div
            className="personal-stock-screener-table-wrap financial-screen-comparison-scroll"
            role="region"
            aria-label="Company comparison table"
            tabIndex={0}
          >
            <table className="financial-screen-table financial-screen-comparison-table">
              <caption>
                Selected companies · {visibleMetrics.length} financial metrics.
                Scroll sideways to compare all selected companies.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  {comparedRows.map((row) => (
                    <th scope="col" key={row.identity.listingId}>
                      <strong>{row.identity.symbol}</strong>
                      <br />
                      {row.identity.issuerName}
                      <br />
                      <small>
                        {row.identity.exchangeMic} · {row.identity.cik}
                        <br />
                        {row.identity.securityName} ·{" "}
                        {row.identity.shareClassName}
                      </small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleMetrics.map((metric) => (
                  <tr key={metric}>
                    <th scope="row">
                      {labels[metric]}
                      <br />
                      <small>{metricUnitLabel(metric)}</small>
                    </th>
                    {comparedRows.map((row) => (
                      <td key={row.identity.listingId}>
                        <FinancialCell
                          cell={row.metrics[metric]}
                          metric={metric}
                          symbol={row.identity.symbol}
                          expanded={
                            selectedRow === row &&
                            inspection?.metric === metric &&
                            inspection.comparison !== null
                          }
                          onInspect={(trigger) =>
                            onInspectComparison(
                              row.identity.listingId,
                              metric,
                              trigger,
                            )
                          }
                        />
                        <FinancialCellDates cell={row.metrics[metric]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div
        className="personal-stock-screener-table-wrap"
        role="region"
        aria-label="Financial results table"
        tabIndex={0}
      >
        <table className="personal-stock-screener-table financial-screen-table">
          <caption>
            Matching financials for calendar-aligned {response.calendarYear}:
            annual flows and Q4 instant balances. Select a value to inspect its
            actual period or balance date and sources.
          </caption>
          <thead>
            <tr>
              <th scope="col">Company</th>
              {visibleMetrics.map((metric) => (
                <th scope="col" key={metric}>
                  {labels[metric]}
                  {metric !== "grossMargin" &&
                    metric !== "operatingCashFlowToNetIncome" &&
                    metric !== "operatingCashFlowLessPpePurchasesMargin" &&
                    metric !== "revenueGrowth" &&
                    metric !== "currentRatio" &&
                    metric !== "currentAssetsLessCurrentLiabilities" && (
                      <>
                        <br />
                        <small>{metricUnitLabel(metric)}</small>
                      </>
                    )}
                </th>
              ))}
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {response.rows.map((row) => (
              <tr key={row.identity.listingId}>
                <th scope="row">
                  <strong>{row.identity.symbol}</strong>
                  <br />
                  {row.identity.issuerName}
                  <br />
                  <small>
                    {row.identity.exchangeMic} · {row.identity.cik}
                  </small>
                </th>
                {visibleMetrics.map((metric) => (
                  <td key={metric}>
                    <FinancialCell
                      cell={row.metrics[metric]}
                      metric={metric}
                      symbol={row.identity.symbol}
                      expanded={
                        selectedRow === row &&
                        inspection?.metric === metric &&
                        inspection.comparison === null
                      }
                      onInspect={(trigger) =>
                        onInspect(row.identity.listingId, metric, trigger)
                      }
                    />
                  </td>
                ))}
                <td>
                  <div className="financial-screen-row-actions">
                    <button
                      className="secondary-action compact-action"
                      type="button"
                      disabled={
                        running ||
                        comparedRows.length >= 3 ||
                        comparedRows.some(
                          (selected) =>
                            selected.identity.listingId ===
                              row.identity.listingId ||
                            sameComparisonIssuer(selected, row),
                        )
                      }
                      onClick={() =>
                        onSelectForComparison(row.identity.listingId)
                      }
                    >
                      {comparedRows.some(
                        (selected) =>
                          selected.identity.listingId ===
                          row.identity.listingId,
                      )
                        ? `Selected ${row.identity.symbol} for comparison`
                        : `Select ${row.identity.symbol} for comparison`}
                    </button>
                    {comparedRows.some(
                      (selected) =>
                        selected.identity.listingId !==
                          row.identity.listingId &&
                        sameComparisonIssuer(selected, row),
                    ) && (
                      <small>Another listing of this issuer is selected.</small>
                    )}
                    <button
                      className="secondary-action compact-action"
                      type="button"
                      disabled={running}
                      onClick={() => onOpenResearch(row.identity)}
                    >
                      Open {row.identity.symbol}
                    </button>
                    <button
                      className="secondary-action compact-action"
                      type="button"
                      disabled={
                        running ||
                        !canAddToWatchlist ||
                        savedListingIds.has(row.identity.listingId)
                      }
                      onClick={() => onAddToWatchlist(row.identity)}
                    >
                      {savedListingIds.has(row.identity.listingId)
                        ? "In watchlist"
                        : `Add ${row.identity.symbol}`}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {response.rows.length === 0 && (
              <tr>
                <td colSpan={visibleMetrics.length + 2}>
                  No matching financial results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="personal-stock-screener-run-actions">
        <button
          className="secondary-action compact-action"
          type="button"
          disabled={running || response.offset === 0}
          onClick={() =>
            onPage(
              Math.max(
                0,
                response.offset - PERSONAL_FINANCIAL_SCREENER_PAGE_SIZE,
              ),
            )
          }
        >
          Previous financial page
        </button>
        <span>
          Showing {response.rows.length === 0 ? 0 : response.offset + 1}–
          {response.offset + response.rows.length} of {response.totalMatches}
        </span>
        <button
          className="secondary-action compact-action"
          type="button"
          disabled={running || !response.hasMore}
          onClick={() => onPage(response.offset + response.limitApplied)}
        >
          Next financial page
        </button>
      </div>
    </div>
  );
}

function focusFinancialControl(control: HTMLElement | null) {
  if (control === null) return;
  control.focus({ preventScroll: true });
  control.scrollIntoView({
    behavior: "instant",
    block: "nearest",
    inline: "nearest",
  });
}

function scrollFinancialValueIntoView(button: HTMLButtonElement) {
  // Root smooth scrolling must not leave a restored value moving out of view
  // after a panel changes the document's height. Measure the final position.
  button.scrollIntoView({
    behavior: "instant",
    block: "nearest",
    inline: "nearest",
  });
  const company = button
    .closest("tr")
    ?.querySelector<HTMLElement>('th[scope="row"]');
  const scroller = button.closest<HTMLElement>(
    ".personal-stock-screener-table-wrap",
  );
  if (!company || !scroller) return;
  const valueBounds = button.getBoundingClientRect();
  const leftClearance = company.getBoundingClientRect().right + 8;
  const rightClearance = scroller.getBoundingClientRect().right - 8;
  if (valueBounds.left < leftClearance)
    scroller.scrollLeft += valueBounds.left - leftClearance;
  else if (valueBounds.right > rightClearance)
    scroller.scrollLeft += valueBounds.right - rightClearance;
}

function FinancialCell({
  cell,
  metric,
  symbol,
  expanded,
  onInspect,
}: {
  readonly cell: PersonalFinancialScreenCellDto;
  readonly metric: PersonalFinancialScreenMetricDto;
  readonly symbol: string;
  readonly expanded: boolean;
  readonly onInspect: (trigger: HTMLButtonElement | null) => void;
}) {
  const display =
    cell.status === "available"
      ? cell.unit === "percent"
        ? metric === "grossMargin" ||
          metric === "operatingCashFlowToNetIncome" ||
          metric === "operatingCashFlowLessPpePurchasesMargin" ||
          metric === "revenueGrowth"
          ? exactPercentage(cell.value)
          : `${Number(cell.value).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`
        : cell.unit === "multiple"
          ? `${exactDecimalDisplay(cell.value)} ×`
          : Number(cell.value).toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              notation: "compact",
              maximumFractionDigits: 2,
            })
      : "Unknown";
  return (
    <button
      className="financial-screen-value-button"
      type="button"
      aria-label={`${symbol} ${labels[metric]}: ${display}. Show source details`}
      aria-expanded={expanded}
      aria-controls={expanded ? "financial-screen-source-inspector" : undefined}
      onFocus={(event) => scrollFinancialValueIntoView(event.currentTarget)}
      onClick={(event) => onInspect(event?.currentTarget ?? null)}
    >
      {display}
    </button>
  );
}

function FinancialCellDates({
  cell,
}: {
  readonly cell: PersonalFinancialScreenCellDto;
}) {
  const dates = [
    ...new Set(
      cell.sources.map((source) => {
        if (isPersonalFinancialInstantSource(source))
          return `Balance date: ${source.asOfDate}`;
        const role =
          "role" in source
            ? source.role === "prior_revenue"
              ? "Prior revenue: "
              : "Current revenue: "
            : "Annual period: ";
        return `${role}${source.startDate} – ${source.endDate}`;
      }),
    ),
  ];
  return (
    <div className="financial-screen-comparison-dates">
      {dates.length === 0 ? (
        <span>No source dates retained.</span>
      ) : (
        dates.map((date) => <span key={date}>{date}</span>)
      )}
    </div>
  );
}

function FinancialCellDetails({
  cell,
  metric,
  cik,
  revenueBasis,
  revenueUnresolved,
  cashMarginInputs,
}: {
  readonly cell: PersonalFinancialScreenCellDto;
  readonly metric: PersonalFinancialScreenMetricDto;
  readonly cik: string;
  readonly revenueBasis: PersonalFinancialRevenueBasisDto;
  readonly revenueUnresolved: boolean;
  readonly cashMarginInputs: CashMarginInputs;
}) {
  const currentAssets = cell.sources.find(
    (source) => source.concept === "AssetsCurrent",
  );
  const currentLiabilities = cell.sources.find(
    (source) => source.concept === "LiabilitiesCurrent",
  );
  return (
    <div>
      <p className="financial-screen-inspector-value">
        {cell.status === "available"
          ? `Exact value: ${cell.value} ${cell.unit === "multiple" ? "×" : cell.unit}`
          : `Unavailable: ${cell.reason.replaceAll("_", " ")}.`}
      </p>
      <p>{formulaFor(metric, revenueBasis)}</p>
      {metric === "revenueGrowth" && "currentRevenue" in cell && (
        <>
          <p>
            Revenue basis: {revenueBasisLabels[revenueBasis]}. This is reported
            change from currently extracted filings. It does not measure organic
            growth or establish unchanged business scope, accounting policies or
            restatement history. Adjacent 52- and 53-week years can differ in
            length.
          </p>
          <p>
            Current selected revenue:{" "}
            {cell.currentRevenue.status === "available"
              ? `${cell.currentRevenue.value} USD`
              : `Unknown (${cell.currentRevenue.reason.replaceAll("_", " ")})`}
            . Prior selected revenue:{" "}
            {cell.priorRevenue.status === "available"
              ? `${cell.priorRevenue.value} USD`
              : `Unknown (${cell.priorRevenue.reason.replaceAll("_", " ")})`}
            .
          </p>
          {cell.status === "unavailable" && (
            <p>{revenueGrowthUnknownExplanation(cell)}</p>
          )}
        </>
      )}
      {[
        "currentAssets",
        "currentLiabilities",
        "currentRatio",
        "currentAssetsLessCurrentLiabilities",
      ].includes(metric) && (
        <>
          <p>
            The Q4 frame selection is separate from annual flow periods. Inspect
            each actual balance date. The October–December window is an app
            rule, not an SEC-published date tolerance.
          </p>
          {(metric === "currentRatio" ||
            metric === "currentAssetsLessCurrentLiabilities") && (
            <p>
              Calculated by this app from reported current balances. Current
              classifications and industry differences affect comparability.
            </p>
          )}
          {cell.status === "unavailable" && (
            <p>
              {metric === "currentAssetsLessCurrentLiabilities"
                ? currentBalanceDifferenceUnknownExplanation(cell)
                : currentRatioUnknownExplanation(cell)}
            </p>
          )}
        </>
      )}
      {metric === "currentAssetsLessCurrentLiabilities" &&
        cell.status === "available" &&
        currentAssets !== undefined &&
        currentLiabilities !== undefined && (
          <p>
            Exact subtraction: {currentAssets.value} USD −{" "}
            {currentLiabilities.value} USD = {cell.value} USD.
          </p>
        )}
      {metric === "grossMargin" && (
        <>
          <p>
            This app ratio uses the selected revenue definition. Matching dates
            and filing accessions establish period and filing vintage; they do
            not establish that the company defines gross profit using this
            revenue concept. Comparability depends on the company’s accounting
            and the chosen denominator.
          </p>
          {cell.status === "unavailable" && (
            <p>{grossMarginUnknownExplanation(cell)}</p>
          )}
        </>
      )}
      {metric === "operatingCashFlowToNetIncome" && (
        <>
          <p>
            This app calculation compares reported operating cash flow with
            reported net income. It is not a company-reported cash-conversion
            measure or a quality score. Working-capital timing and noncash items
            affect the comparison.
          </p>
          {cell.status === "unavailable" && (
            <p>{cashFlowToIncomeUnknownExplanation(cell)}</p>
          )}
        </>
      )}
      {metric === "operatingCashFlowLessPpePurchases" &&
        cell.status === "unavailable" && (
          <p>{cashFlowUnknownExplanation(cell)}</p>
        )}
      {metric === "operatingCashFlowLessPpePurchasesMargin" && (
        <>
          <p>
            This app-defined historical cash measure subtracts only reported
            PP&E purchases. It excludes other investing cash flows and does not
            establish cash available to shareholders, comparable accounting or
            business scope, investment quality, or a buy/sell rule.
          </p>
          <p>
            {(
              [
                ["Operating cash flow", cashMarginInputs.operatingCashFlow],
                ["PP&E purchases", cashMarginInputs.ppePurchases],
                ["Selected revenue", cashMarginInputs.revenue],
              ] as const
            ).map(([label, operand]) => (
              <span key={label}>
                {label}:{" "}
                {operand.status === "available"
                  ? `${operand.value} USD`
                  : `Unknown (${operand.reason.replaceAll("_", " ")})`}
                .{" "}
              </span>
            ))}
          </p>
          {cell.status === "available" &&
            cashMarginInputs.operatingCashFlow.status === "available" &&
            cashMarginInputs.ppePurchases.status === "available" &&
            cashMarginInputs.revenue.status === "available" && (
              <p>
                Exact operands: ({cashMarginInputs.operatingCashFlow.value} USD
                − {cashMarginInputs.ppePurchases.value} USD) /{" "}
                {cashMarginInputs.revenue.value} USD × 100. Rounded once:{" "}
                {cell.value}%.
              </p>
            )}
          {cell.status === "unavailable" && (
            <p>{cashMarginUnknownExplanation(cell, cashMarginInputs)}</p>
          )}
        </>
      )}
      {metric === "revenue" &&
        cell.status === "unavailable" &&
        cell.reason === "conflicting" && (
          <p>
            {revenueBasis === "agreement" &&
            new Set(cell.sources.map((source) => source.concept)).size > 1
              ? "Revenue inputs remain unresolved. Retained concepts can describe different definitions; compare their amounts and reporting periods below. This screen does not select a value from conflicting inputs."
              : "Revenue inputs remain unresolved. Any retained source references are shown below; this screen does not select a value from ambiguous or conflicting inputs."}
          </p>
        )}
      {metric.endsWith("Margin") && (
        <p>
          Revenue denominator: {revenueBasisLabels[revenueBasis]}.
          {revenueUnresolved &&
            (metric === "grossMargin"
              ? " This ratio remains unknown because selected revenue is unresolved."
              : " This margin remains unknown because revenue is unresolved.")}
        </p>
      )}
      {cell.sources.length === 0 && (
        <p>No source references were retained for this value.</p>
      )}
      <div className="financial-screen-source-cards">
        {cell.sources.map((source, index) => (
          <article
            className="financial-screen-source-card"
            key={`${source.concept}-${String(index)}`}
          >
            {"role" in source && (
              <>
                {source.role === "current_revenue"
                  ? "Current selected revenue"
                  : "Prior selected revenue"}{" "}
                · CY{source.calendarYear}
                <br />
              </>
            )}
            {metric === "operatingCashFlowLessPpePurchases" && (
              <>
                {source.concept === "NetCashProvidedByUsedInOperatingActivities"
                  ? "Operating cash flow input"
                  : "PP&E purchases input (subtracted)"}
                <br />
              </>
            )}
            {metric === "operatingCashFlowLessPpePurchasesMargin" && (
              <>
                {source.concept === "NetCashProvidedByUsedInOperatingActivities"
                  ? "Operating cash flow input"
                  : source.concept ===
                      "PaymentsToAcquirePropertyPlantAndEquipment"
                    ? "PP&E purchases input (subtracted)"
                    : "Selected revenue denominator"}
                <br />
              </>
            )}
            {metric === "grossMargin" && (
              <>
                {source.concept === "GrossProfit"
                  ? "Gross profit numerator"
                  : "Selected revenue denominator"}
                <br />
              </>
            )}
            {metric === "operatingCashFlowToNetIncome" && (
              <>
                {source.concept === "NetCashProvidedByUsedInOperatingActivities"
                  ? "Operating cash flow numerator"
                  : "Net income denominator"}
                <br />
              </>
            )}
            {metric === "currentRatio" && (
              <>
                {source.concept === "AssetsCurrent"
                  ? "Current assets numerator"
                  : "Current liabilities denominator"}
                <br />
              </>
            )}
            {metric === "currentAssetsLessCurrentLiabilities" && (
              <>
                {source.concept === "AssetsCurrent"
                  ? "Current assets input"
                  : "Current liabilities input (subtracted)"}
                <br />
              </>
            )}
            {source.concept}
            <br />
            {isPersonalFinancialInstantSource(source)
              ? `Actual balance date: ${source.asOfDate}`
              : `${source.startDate} through ${source.endDate}`}
            <br />
            Reported: {source.value} USD
            <br />
            <a
              href={`https://www.sec.gov/Archives/edgar/data/${String(Number(cik))}/${source.accessionNumber.replaceAll("-", "")}/${source.accessionNumber}-index.html`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Filing {source.accessionNumber}
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}

function isSessionError(error: unknown) {
  return (
    error instanceof PersonalWorkspaceApiError &&
    error.code === "session_unavailable"
  );
}
function screenErrorMessage(error: unknown): string {
  if (error instanceof PersonalWorkspaceApiError) {
    if (error.code === "conflict")
      return "The catalog or SEC snapshot changed or expired. Results were cleared. Run financial screen again to use current data; revalidate the owner session if the catalog changed.";
    if (error.code === "not_configured")
      return "SEC financial screening is not configured. Configure the SEC contact identity in the local API, then run again.";
    if (error.code === "rate_limited")
      return "Another SEC screen is running. Try again shortly.";
    if (error.code === "invalid_request")
      return "The financial criteria were not accepted. Check the calendar year and decimal thresholds.";
    if (error.code === "invalid_response")
      return "The financial response failed validation. Results were cleared; run the screen again.";
  }
  return "SEC financial screening is temporarily unavailable. Run the screen again later.";
}
