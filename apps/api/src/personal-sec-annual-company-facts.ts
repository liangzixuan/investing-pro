import { createHash } from "node:crypto";

import {
  PERSONAL_SEC_ANNUAL_CASH_LIMITS,
  PERSONAL_SEC_ANNUAL_LIQUIDITY_LIMITS,
  type PersonalSecAnnualCashAbsence,
  type PersonalSecAnnualCashObservationDto,
  type PersonalSecAnnualCashScanDto,
  type PersonalSecAnnualLiquidityObservationDto,
  type PersonalSecAnnualScanStatus,
} from "@research-cockpit/contracts";

import {
  isPersonalSecSourceRecord as isRecord,
  normalizePersonalSecCompanyFacts,
  normalizePersonalSecSourceCik,
  normalizePersonalSecSourceFactFields,
  PersonalSecSourceError,
} from "./personal-sec-quarterly-evidence-provider";

type WithoutFiling<T> = T extends unknown ? Omit<T, "filing"> : never;
type CashRow = WithoutFiling<PersonalSecAnnualCashObservationDto>;
type LiquidityRow = WithoutFiling<PersonalSecAnnualLiquidityObservationDto>;
type AnnualRow = CashRow | LiquidityRow;
interface AnnualSourceMetric<Row> {
  readonly scan: PersonalSecAnnualCashScanDto;
  readonly observations: readonly Row[];
}
export type PersonalSecAnnualCashSourceMetric = AnnualSourceMetric<CashRow>;
export type PersonalSecAnnualLiquiditySourceMetric =
  AnnualSourceMetric<LiquidityRow>;
type MetricIdentity = (typeof IDENTITIES)[keyof typeof IDENTITIES];
type CashIdentity = Extract<MetricIdentity, { metric: CashRow["metric"] }>;
type LiquidityIdentity = Extract<
  MetricIdentity,
  { metric: LiquidityRow["metric"] }
>;
type MetricLimits = Readonly<{
  candidateRowsPerMetric: number;
  observationsPerMetric: number;
}>;

const IDENTITIES = {
  operatingCashFlow: {
    metric: "operating_cash_flow",
    taxonomy: "us-gaap",
    concept: "NetCashProvidedByUsedInOperatingActivities",
  },
  ppePurchases: {
    metric: "ppe_purchases",
    taxonomy: "us-gaap",
    concept: "PaymentsToAcquirePropertyPlantAndEquipment",
  },
  currentAssets: {
    metric: "current_assets",
    taxonomy: "us-gaap",
    concept: "AssetsCurrent",
  },
  currentLiabilities: {
    metric: "current_liabilities",
    taxonomy: "us-gaap",
    concept: "LiabilitiesCurrent",
  },
} as const;

/** The complete parsed issuer envelope is shared; fixed concept scans are not. */
export function normalizePersonalSecAnnualCompanyFacts(
  value: unknown,
  cik: string,
  accession: string | null,
) {
  if (
    !isRecord(value) ||
    normalizePersonalSecSourceCik(value.cik) !== cik ||
    !isRecord(value.facts)
  )
    throw new PersonalSecSourceError("invalid_response");
  const taxonomy = value.facts["us-gaap"];
  if (taxonomy !== undefined && !isRecord(taxonomy))
    throw new PersonalSecSourceError("invalid_response");
  const income = scanIncome(value, cik);
  return Object.freeze({
    ...income,
    operatingCashFlow: scanMetric(
      taxonomy,
      IDENTITIES.operatingCashFlow,
      PERSONAL_SEC_ANNUAL_CASH_LIMITS,
      accession,
    ),
    ppePurchases: scanMetric(
      taxonomy,
      IDENTITIES.ppePurchases,
      PERSONAL_SEC_ANNUAL_CASH_LIMITS,
      accession,
    ),
    currentAssets: scanMetric(
      taxonomy,
      IDENTITIES.currentAssets,
      PERSONAL_SEC_ANNUAL_LIQUIDITY_LIMITS,
      accession,
    ),
    currentLiabilities: scanMetric(
      taxonomy,
      IDENTITIES.currentLiabilities,
      PERSONAL_SEC_ANNUAL_LIQUIDITY_LIMITS,
      accession,
    ),
  });
}

function scanIncome(value: unknown, cik: string) {
  try {
    return Object.freeze({
      incomeScanStatus: "available" as const,
      income: normalizePersonalSecCompanyFacts(value, cik),
    });
  } catch (error) {
    return Object.freeze({
      incomeScanStatus: scanFailure(error),
      income: undefined,
    });
  }
}

export function unavailablePersonalSecAnnualCashMetric(
  status: Exclude<PersonalSecAnnualScanStatus, "available">,
): PersonalSecAnnualCashSourceMetric {
  return unavailableMetric(status);
}

export function unavailablePersonalSecAnnualLiquidityMetric(
  status: Exclude<PersonalSecAnnualScanStatus, "available">,
): PersonalSecAnnualLiquiditySourceMetric {
  return unavailableMetric(status);
}

function unavailableMetric<Row>(
  status: Exclude<PersonalSecAnnualScanStatus, "available">,
): AnnualSourceMetric<Row> {
  return Object.freeze({
    scan: Object.freeze({ status, absence: null, coverage: null }),
    observations: Object.freeze([]),
  });
}

function scanMetric(
  taxonomy: Record<string, unknown> | undefined,
  identity: CashIdentity,
  limits: MetricLimits,
  accession: string | null,
): PersonalSecAnnualCashSourceMetric;
function scanMetric(
  taxonomy: Record<string, unknown> | undefined,
  identity: LiquidityIdentity,
  limits: MetricLimits,
  accession: string | null,
): PersonalSecAnnualLiquiditySourceMetric;
function scanMetric(
  taxonomy: Record<string, unknown> | undefined,
  identity: MetricIdentity,
  limits: MetricLimits,
  accession: string | null,
): AnnualSourceMetric<AnnualRow> {
  try {
    const { rows, absence } = metricCandidates(taxonomy?.[identity.concept]);
    if (rows.length > limits.candidateRowsPerMetric)
      throw new PersonalSecSourceError("candidate_limit");
    const normalized = normalizeRows(rows, identity);
    return selectMetric(normalized, rows.length, absence, accession, limits);
  } catch (error) {
    return unavailableMetric(scanFailure(error));
  }
}

function metricCandidates(entry: unknown): {
  rows: readonly unknown[];
  absence: PersonalSecAnnualCashAbsence | null;
} {
  if (entry === undefined) return { rows: [], absence: "concept_missing" };
  if (!isRecord(entry) || !isRecord(entry.units))
    throw new PersonalSecSourceError("invalid_response");
  const rows = entry.units.USD;
  if (rows === undefined) return { rows: [], absence: "usd_missing" };
  if (!Array.isArray(rows))
    throw new PersonalSecSourceError("invalid_response");
  return { rows, absence: rows.length === 0 ? "empty_usd" : null };
}

function normalizeRows(rows: readonly unknown[], identity: MetricIdentity) {
  const unique = new Map<string, AnnualRow>();
  let invalidRows = 0;
  let duplicateRows = 0;
  for (const [index, value] of rows.entries()) {
    const row = metricRow(value, identity, index);
    if (row === null) invalidRows += 1;
    else if (unique.has(row.id)) duplicateRows += 1;
    else unique.set(row.id, row);
  }
  return {
    observations: [...unique.values()].sort(compareRows),
    invalidRows,
    duplicateRows,
  };
}

function metricRow(
  value: unknown,
  identity: MetricIdentity,
  index: number,
): AnnualRow | null {
  const source = normalizePersonalSecSourceFactFields(value);
  if (source === null) return null;
  const fields = { ...identity, unit: "USD" as const, ...source };
  return Object.freeze({
    id: `sec-fact:${createHash("sha256").update(JSON.stringify(fields)).digest("hex")}`,
    ...fields,
    sourceLocator: `/facts/us-gaap/${identity.concept}/units/USD/${index}`,
  });
}

function compareRows(a: AnnualRow, b: AnnualRow): number {
  return (
    b.endDate.localeCompare(a.endDate) ||
    (b.startDate ?? "").localeCompare(a.startDate ?? "") ||
    b.filedDate.localeCompare(a.filedDate) ||
    a.accessionNumber.localeCompare(b.accessionNumber) ||
    a.concept.localeCompare(b.concept) ||
    a.id.localeCompare(b.id)
  );
}

function selectMetric(
  normalized: {
    observations: AnnualRow[];
    invalidRows: number;
    duplicateRows: number;
  },
  candidateRows: number,
  absence: PersonalSecAnnualCashAbsence | null,
  accession: string | null,
  limits: MetricLimits,
): AnnualSourceMetric<AnnualRow> {
  const selected =
    accession === null
      ? null
      : normalized.observations.filter(
          (row) => row.accessionNumber === accession,
        );
  const observations =
    selected !== null && selected.length <= limits.observationsPerMetric
      ? selected
      : [];
  return Object.freeze({
    scan: Object.freeze({
      status: "available",
      absence,
      coverage: Object.freeze({
        full: Object.freeze({
          candidateRows,
          inspectedRows: candidateRows,
          invalidRows: normalized.invalidRows,
          duplicateRows: normalized.duplicateRows,
          uniqueObservations: normalized.observations.length,
        }),
        selected: selected?.length ?? null,
        otherAccessions:
          selected === null
            ? null
            : normalized.observations.length - selected.length,
        returned: observations.length,
        omittedSelected:
          selected === null ? null : selected.length - observations.length,
      }),
    }),
    observations: Object.freeze(observations),
  });
}

function scanFailure(error: unknown): "invalid_response" | "candidate_limit" {
  if (
    error instanceof PersonalSecSourceError &&
    (error.status === "invalid_response" || error.status === "candidate_limit")
  )
    return error.status;
  throw error;
}
