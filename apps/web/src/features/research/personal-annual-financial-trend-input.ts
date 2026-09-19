import type {
  PersonalAnnualFinancialReportedCellDto,
  PersonalAnnualFinancialsDto,
} from "@research-cockpit/contracts";
import type { PersonalFinancialAnalyticsResult } from "@research-cockpit/personal-financial-analytics";

import type { PersonalMarketSelection } from "./PersonalMarketOverview";

export const PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS = Object.freeze([
  "revenue",
  "net_income",
  "operating_cash_flow",
  "free_cash_flow",
] as const);

export type PersonalAnnualFinancialTrendField =
  (typeof PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS)[number];

export type PersonalAnnualFinancialTrendSlot =
  | Readonly<{
      status: "missing_year";
      fiscalYear: number;
      statementDate: null;
      cells: null;
    }>
  | Readonly<{
      status: "reported";
      fiscalYear: number;
      statementDate: string;
      cells: Readonly<
        Record<
          PersonalAnnualFinancialTrendField,
          PersonalAnnualFinancialReportedCellDto
        >
      >;
    }>;

export type PersonalAnnualFinancialTrendPlot =
  | Readonly<{ status: "ready"; values: readonly (number | null)[] }>
  | Readonly<{
      status: "unavailable";
      reason: "no_known_values" | "unsafe_plot_value";
    }>;

export type PersonalAnnualFinancialTrendProjection =
  | Readonly<{
      status: "unavailable";
      reason: "quarantined" | "identity_mismatch" | "invalid_input";
    }>
  | Readonly<{
      status: "ready";
      identity: Readonly<PersonalMarketSelection>;
      selectionKey: string;
      contentKey: string;
      asOf: string;
      unit: "USD";
      slots: readonly PersonalAnnualFinancialTrendSlot[];
      plots: Readonly<
        Record<
          PersonalAnnualFinancialTrendField,
          PersonalAnnualFinancialTrendPlot
        >
      >;
    }>;

const sourceIdentityFields = [
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;
const maximumPlotInteger = "9007199254740991";

export function projectPersonalAnnualFinancialTrend(
  input: Readonly<{
    financials: PersonalAnnualFinancialsDto;
    selection: PersonalMarketSelection;
    analyticsStatus: PersonalFinancialAnalyticsResult["status"];
  }>,
): PersonalAnnualFinancialTrendProjection {
  if (input.analyticsStatus === "quarantined") {
    return unavailable("quarantined");
  }
  const { financials, selection } = input;
  if (
    input.analyticsStatus !== "ready" ||
    !isRecord(financials) ||
    !isRecord(selection) ||
    !isRecord(financials.security) ||
    typeof selection.issuerId !== "string" ||
    selection.issuerId.length === 0
  ) {
    return unavailable("invalid_input");
  }
  if (
    sourceIdentityFields.some(
      (field) =>
        typeof selection[field] !== "string" ||
        financials.security[field] !== selection[field],
    )
  ) {
    return unavailable("identity_mismatch");
  }
  if (
    !isInstant(financials.asOf) ||
    !isRecord(financials.provider) ||
    financials.provider.valueCurrency !== "USD" ||
    !isRecord(financials.coverage) ||
    !Array.isArray(financials.years) ||
    financials.years.length < 1 ||
    financials.years.length > 10
  ) {
    return unavailable("invalid_input");
  }

  const coverage = financials.coverage;
  const latest = coverage.latestFiscalYear;
  if (
    !isFiscalYear(latest) ||
    latest - 9 < 1900 ||
    coverage.requestedAnnualYears !== 10 ||
    coverage.returnedAnnualYears !== financials.years.length ||
    !Array.isArray(coverage.missingFiscalYears)
  ) {
    return unavailable("invalid_input");
  }

  const reported = new Map<number, PersonalAnnualFinancialTrendSlot>();
  let previous = latest + 1;
  for (const year of financials.years) {
    if (
      !isRecord(year) ||
      !isFiscalYear(year.fiscalYear) ||
      year.fiscalYear >= previous ||
      year.fiscalYear < latest - 9 ||
      year.fiscalYear > latest ||
      !isDate(year.statementDate) ||
      !isRecord(year.reported)
    ) {
      return unavailable("invalid_input");
    }
    const { revenue, net_income, operating_cash_flow, free_cash_flow } =
      year.reported;
    if (
      !isCell(revenue) ||
      !isCell(net_income) ||
      !isCell(operating_cash_flow) ||
      !isCell(free_cash_flow)
    )
      return unavailable("invalid_input");
    const cells = Object.freeze({
      revenue: copyCell(revenue),
      net_income: copyCell(net_income),
      operating_cash_flow: copyCell(operating_cash_flow),
      free_cash_flow: copyCell(free_cash_flow),
    });
    reported.set(
      year.fiscalYear,
      Object.freeze({
        status: "reported",
        fiscalYear: year.fiscalYear,
        statementDate: year.statementDate,
        cells,
      }),
    );
    previous = year.fiscalYear;
  }
  const missing = Array.from(
    { length: 10 },
    (_, index) => latest - index,
  ).filter((fiscalYear) => !reported.has(fiscalYear));
  if (
    !reported.has(latest) ||
    coverage.earliestFiscalYear !== previous ||
    coverage.missingFiscalYears.length !== missing.length ||
    missing.some(
      (fiscalYear, index) => coverage.missingFiscalYears[index] !== fiscalYear,
    )
  ) {
    return unavailable("invalid_input");
  }

  const slots = Object.freeze(
    Array.from({ length: 10 }, (_, index) => {
      const fiscalYear = latest - 9 + index;
      return (
        reported.get(fiscalYear) ??
        Object.freeze({
          status: "missing_year" as const,
          fiscalYear,
          statementDate: null,
          cells: null,
        })
      );
    }),
  );
  const identity = Object.freeze({
    country: selection.country,
    exchangeMic: selection.exchangeMic,
    issuerId: selection.issuerId,
    issuerName: selection.issuerName,
    listingId: selection.listingId,
    securityName: selection.securityName,
    symbol: selection.symbol,
  });
  const selectionTuple = [
    identity.country,
    identity.exchangeMic,
    identity.issuerId,
    identity.issuerName,
    identity.listingId,
    identity.securityName,
    identity.symbol,
  ];
  const selectionKey = JSON.stringify(selectionTuple);
  const contentKey = JSON.stringify([
    selectionTuple,
    financials.asOf,
    "USD",
    slots.map((slot) => [
      slot.fiscalYear,
      slot.statementDate,
      slot.status,
      slot.cells === null
        ? null
        : PERSONAL_ANNUAL_FINANCIAL_TREND_FIELDS.map((field) => {
            const cell = slot.cells[field];
            return cell.status === "known"
              ? [cell.status, cell.value]
              : [cell.status, cell.value, cell.reason];
          }),
    ]),
  ]);
  return Object.freeze({
    status: "ready",
    identity,
    selectionKey,
    contentKey,
    asOf: financials.asOf,
    unit: "USD",
    slots,
    plots: Object.freeze({
      revenue: projectPlot(slots, "revenue"),
      net_income: projectPlot(slots, "net_income"),
      operating_cash_flow: projectPlot(slots, "operating_cash_flow"),
      free_cash_flow: projectPlot(slots, "free_cash_flow"),
    }),
  });
}

function projectPlot(
  slots: readonly PersonalAnnualFinancialTrendSlot[],
  field: PersonalAnnualFinancialTrendField,
): PersonalAnnualFinancialTrendPlot {
  const values: (number | null)[] = [];
  let hasKnown = false;
  for (const slot of slots) {
    const cell = slot.cells?.[field];
    if (cell === undefined || cell.status === "unknown") {
      values.push(null);
      continue;
    }
    hasKnown = true;
    const unsigned = cell.value.startsWith("-")
      ? cell.value.slice(1)
      : cell.value;
    const [integer = "", fraction] = unsigned.split(".");
    if (
      integer.length > maximumPlotInteger.length ||
      (integer.length === maximumPlotInteger.length &&
        (integer > maximumPlotInteger ||
          (integer === maximumPlotInteger && fraction !== undefined)))
    ) {
      return Object.freeze({
        status: "unavailable",
        reason: "unsafe_plot_value",
      });
    }
    const value = Number(cell.value);
    if (
      !Number.isFinite(value) ||
      (cell.value !== "0" && value === 0) ||
      value < 0 !== cell.value.startsWith("-")
    ) {
      return Object.freeze({
        status: "unavailable",
        reason: "unsafe_plot_value",
      });
    }
    values.push(value);
  }
  return hasKnown
    ? Object.freeze({ status: "ready", values: Object.freeze(values) })
    : Object.freeze({ status: "unavailable", reason: "no_known_values" });
}

function copyCell(cell: PersonalAnnualFinancialReportedCellDto) {
  return cell.status === "known"
    ? Object.freeze({ status: cell.status, value: cell.value })
    : Object.freeze({ status: cell.status, value: null, reason: cell.reason });
}

function isCell(
  value: unknown,
): value is PersonalAnnualFinancialReportedCellDto {
  if (
    !isRecord(value) ||
    (!hasDataKeys(value, ["status", "value"]) &&
      !hasDataKeys(value, ["status", "value", "reason"]))
  )
    return false;
  if (value.status === "known") {
    return (
      hasDataKeys(value, ["status", "value"]) &&
      typeof value.value === "string" &&
      value.value.length <= 64 &&
      value.value !== "-0" &&
      /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/u.test(value.value)
    );
  }
  return (
    hasDataKeys(value, ["status", "value", "reason"]) &&
    value.status === "unknown" &&
    value.value === null &&
    value.reason === "not_supplied_by_provider"
  );
}

function hasDataKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const own = Reflect.ownKeys(value);
  return (
    own.length === keys.length &&
    keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        descriptor !== undefined &&
        "value" in descriptor &&
        descriptor.enumerable
      );
    })
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiscalYear(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    typeof value === "number" &&
    value >= 1900 &&
    value <= 9999
  );
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
}

function isInstant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  )
    return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function unavailable(
  reason: "quarantined" | "identity_mismatch" | "invalid_input",
): PersonalAnnualFinancialTrendProjection {
  return Object.freeze({ status: "unavailable", reason });
}
