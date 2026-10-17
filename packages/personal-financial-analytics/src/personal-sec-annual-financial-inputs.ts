import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  type PersonalSecAnnualCanonicalEvidenceDto,
  type PersonalSecAnnualScanStatus,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecAnnualStatementConceptScanDto,
  type PersonalSecAnnualStatementCoverageDto,
  type PersonalSecAnnualStatementObservationDto,
  type PersonalSecAnnualStatementScanDto,
} from "@research-cockpit/contracts";
import {
  getPersonalSecAnnualFilingReason,
  getPersonalSecAnnualSourceClockReason,
  getPersonalSecAnnualSourceUtilityAge,
} from "./personal-sec-annual-evidence";
import { assertPersonalSecAnnualCanonicalEvidence } from "./personal-sec-annual-statement-facts";

type Canonical = PersonalSecAnnualCanonicalEvidenceDto;
type Row = PersonalSecAnnualStatementObservationDto;
type IncomeConcept =
  (typeof PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS)[number] | "NetIncomeLoss";
type IncomeRow = Row & Readonly<{ concept: IncomeConcept }>;
type IncomeScan = PersonalSecAnnualStatementConceptScanDto &
  Readonly<{ concept: IncomeConcept }>;
type ContextReason =
  | "invalid_clock"
  | "source_unavailable"
  | "source_stale"
  | "target_unresolved"
  | "report_date_missing"
  | "filed_date_missing"
  | "future_or_inconsistent_dates"
  | "cutoff_time_unresolved";
type IncomeReason =
  | ContextReason
  | "invalid_response"
  | "candidate_limit"
  | "invalid_source_rows"
  | "selected_report_overflow";

export interface PersonalSecAnnualFinancialMetricInput<
  Concept extends PersonalSecAnnualStatementConcept,
> {
  readonly scan: PersonalSecAnnualStatementScanDto;
  /** Original canonical rows, with no added metric tag or source-field copy. */
  readonly observations: readonly (Row & Readonly<{ concept: Concept }>)[];
}
export interface PersonalSecAnnualFinancialIncomeCounts {
  readonly observations: number;
  readonly revenue: number;
  readonly netIncome: number;
}
export interface PersonalSecAnnualFinancialIncomeCoverage {
  readonly full: Readonly<{
    candidateRows: number;
    inspectedRows: number;
    invalidRows: number;
    duplicateRows: number;
    uniqueObservations: number;
    /** Unique normalized source rows across all accessions, known from scans. */
    observations: number;
    revenue: number;
    netIncome: number;
    conceptsWithoutUsd: readonly IncomeConcept[];
  }>;
  readonly selected: PersonalSecAnnualFinancialIncomeCounts | null;
  readonly otherAccessions: PersonalSecAnnualFinancialIncomeCounts | null;
  /** Sum of canonical scan retention, not the number of eligible summary inputs. */
  readonly returned: PersonalSecAnnualFinancialIncomeCounts;
  readonly omittedSelected: PersonalSecAnnualFinancialIncomeCounts | null;
}
export interface PersonalSecAnnualFinancialIncomeInput {
  /** Original fixed four concept scans, in registry order. */
  readonly scans: readonly IncomeScan[];
  /** Effective aggregate scan; does not overwrite any canonical concept status. */
  readonly scanStatus: PersonalSecAnnualScanStatus;
  readonly reason: IncomeReason | null;
  /** Null if any constituent scan failed; partial totals cannot prove completeness. */
  readonly coverage: PersonalSecAnnualFinancialIncomeCoverage | null;
  /** Empty on summary refusal. Complete canonical evidence remains in canonical.facts. */
  readonly observations: readonly IncomeRow[];
  /** Actual retained summary-input counts, distinct from original graph retention. */
  readonly summaryReturned: PersonalSecAnnualFinancialIncomeCounts;
}
export interface PersonalSecAnnualCanonicalFinancialInputs {
  /** The exact canonical object, including its original v6 generation, target and graph. */
  readonly canonical: Canonical;
  readonly contextReason: ContextReason | null;
  readonly utilityAge: ReturnType<typeof getPersonalSecAnnualSourceUtilityAge>;
  readonly income: PersonalSecAnnualFinancialIncomeInput;
  readonly cashGeneration: Readonly<{
    operatingCashFlow: PersonalSecAnnualFinancialMetricInput<"NetCashProvidedByUsedInOperatingActivities">;
    ppePurchases: PersonalSecAnnualFinancialMetricInput<"PaymentsToAcquirePropertyPlantAndEquipment">;
  }>;
  readonly liquidity: Readonly<{
    currentAssets: PersonalSecAnnualFinancialMetricInput<"AssetsCurrent">;
    currentLiabilities: PersonalSecAnnualFinancialMetricInput<"LiabilitiesCurrent">;
  }>;
  readonly operatingResults: Readonly<{
    operatingIncome: PersonalSecAnnualFinancialMetricInput<"OperatingIncomeLoss">;
  }>;
  readonly balanceSheet: Readonly<{
    totalAssets: PersonalSecAnnualFinancialMetricInput<"Assets">;
    totalLiabilities: PersonalSecAnnualFinancialMetricInput<"Liabilities">;
    shareholdersEquity: PersonalSecAnnualFinancialMetricInput<"StockholdersEquity">;
  }>;
}

/**
 * Project source inputs from an admitted v6 graph without deriving financial values.
 * Shape admission does not replace the API/browser caller's SHA verification.
 * Only owned containers are frozen; referenced source objects are left unchanged.
 */
export function derivePersonalSecAnnualFinancialInputs(
  canonical: Canonical,
): PersonalSecAnnualCanonicalFinancialInputs {
  assertPersonalSecAnnualCanonicalEvidence(canonical);
  const contextReason = contextRefusal(canonical);
  const age = getPersonalSecAnnualSourceUtilityAge(
    canonical.generation,
    canonical.target,
  );
  const utilityAge =
    age === null
      ? null
      : Object.freeze({
          ...age,
          sourceAgeDays: Object.freeze([
            age.sourceAgeDays[0],
            age.sourceAgeDays[1],
          ] as const),
        });
  const scans = new Map(
    canonical.facts.scans.map((item) => [item.concept, item.scan]),
  );
  const metric = <C extends PersonalSecAnnualStatementConcept>(
    concept: C,
  ): PersonalSecAnnualFinancialMetricInput<C> =>
    Object.freeze({
      scan: scans.get(concept)!,
      observations: Object.freeze(
        canonical.facts.observations.filter(
          (row): row is Row & Readonly<{ concept: C }> =>
            row.concept === concept,
        ),
      ),
    });
  const incomeScans = Object.freeze(
    canonical.facts.scans.filter((item): item is IncomeScan =>
      isIncome(item.concept),
    ),
  );
  const coverage = sumIncomeCoverage(incomeScans);
  // Failure precedence is the fixed registry order; no failed scan becomes a zero.
  const failed = incomeScans.find((item) => item.scan.status !== "available");
  let scanStatus: PersonalSecAnnualScanStatus = "available";
  let scanReason: IncomeReason | null = null;
  if (failed && failed.scan.status !== "available") {
    scanStatus = failed.scan.status;
    scanReason = failed.scan.status;
  } else if (coverage !== null) {
    if (
      coverage.full.candidateRows >
      PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.candidateRows
    ) {
      scanStatus = "candidate_limit";
      scanReason = "candidate_limit";
    } else if (coverage.full.invalidRows > 0)
      scanReason = "invalid_source_rows";
    else if (
      coverage.selected !== null &&
      (coverage.selected.revenue >
        PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.observationsPerMetric ||
        coverage.selected.netIncome >
          PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.observationsPerMetric)
    )
      scanReason = "selected_report_overflow";
  } else throw new TypeError("Invalid canonical income scan coverage.");
  const reason = contextReason ?? scanReason;
  const observations = Object.freeze(
    reason === null
      ? canonical.facts.observations.filter((row): row is IncomeRow =>
          isIncome(row.concept),
        )
      : [],
  );
  const income = Object.freeze({
    scans: incomeScans,
    scanStatus,
    reason,
    coverage,
    observations,
    summaryReturned: rowCounts(observations),
  });
  return Object.freeze({
    canonical,
    contextReason,
    utilityAge,
    income,
    cashGeneration: Object.freeze({
      operatingCashFlow: metric("NetCashProvidedByUsedInOperatingActivities"),
      ppePurchases: metric("PaymentsToAcquirePropertyPlantAndEquipment"),
    }),
    liquidity: Object.freeze({
      currentAssets: metric("AssetsCurrent"),
      currentLiabilities: metric("LiabilitiesCurrent"),
    }),
    operatingResults: Object.freeze({
      operatingIncome: metric("OperatingIncomeLoss"),
    }),
    balanceSheet: Object.freeze({
      totalAssets: metric("Assets"),
      totalLiabilities: metric("Liabilities"),
      shareholdersEquity: metric("StockholdersEquity"),
    }),
  });
}
function isIncome(
  concept: PersonalSecAnnualStatementConcept,
): concept is IncomeConcept {
  return (
    concept === "NetIncomeLoss" ||
    PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.some((value) => value === concept)
  );
}
function rowCounts(
  rows: readonly IncomeRow[],
): PersonalSecAnnualFinancialIncomeCounts {
  const netIncome = rows.filter(
    (row) => row.concept === "NetIncomeLoss",
  ).length;
  return Object.freeze({
    observations: rows.length,
    revenue: rows.length - netIncome,
    netIncome,
  });
}
function sumIncomeCoverage(
  scans: readonly IncomeScan[],
): PersonalSecAnnualFinancialIncomeCoverage | null {
  const coverages: {
    concept: IncomeConcept;
    coverage: PersonalSecAnnualStatementCoverageDto;
  }[] = [];
  for (const item of scans) {
    if (item.scan.status !== "available") return null;
    coverages.push({ concept: item.concept, coverage: item.scan.coverage });
  }
  const full = (key: keyof PersonalSecAnnualStatementCoverageDto["full"]) =>
    coverages.reduce((sum, item) => sum + item.coverage.full[key], 0);
  const counts = (
    read: (coverage: PersonalSecAnnualStatementCoverageDto) => number | null,
  ): PersonalSecAnnualFinancialIncomeCounts | null => {
    let revenue = 0,
      netIncome = 0;
    for (const item of coverages) {
      const count = read(item.coverage);
      if (count === null) return null;
      if (item.concept === "NetIncomeLoss") netIncome += count;
      else revenue += count;
    }
    return Object.freeze({
      observations: revenue + netIncome,
      revenue,
      netIncome,
    });
  };
  const unique = counts((coverage) => coverage.full.uniqueObservations)!;
  return Object.freeze({
    full: Object.freeze({
      candidateRows: full("candidateRows"),
      inspectedRows: full("inspectedRows"),
      invalidRows: full("invalidRows"),
      duplicateRows: full("duplicateRows"),
      uniqueObservations: full("uniqueObservations"),
      ...unique,
      conceptsWithoutUsd: Object.freeze(
        scans
          .filter(
            (item) =>
              item.scan.status === "available" && item.scan.absence !== null,
          )
          .map((item) => item.concept),
      ),
    }),
    selected: counts((coverage) => coverage.selected),
    otherAccessions: counts((coverage) => coverage.otherAccessions),
    returned: counts((coverage) => coverage.returned)!,
    omittedSelected: counts((coverage) => coverage.omittedSelected),
  });
}
function contextRefusal(canonical: Canonical): ContextReason | null {
  const source = getPersonalSecAnnualSourceClockReason(canonical.generation);
  if (source !== null) return source;
  if (canonical.target.status !== "target") return "target_unresolved";
  const filing = getPersonalSecAnnualFilingReason(
    canonical.target,
    canonical.generation.cutoffAt,
    canonical.generation.sources.submissions.fetchedAt!,
  );
  if (filing !== null) {
    if (
      filing !== "invalid_clock" &&
      filing !== "report_date_missing" &&
      filing !== "filed_date_missing" &&
      filing !== "future_or_inconsistent_dates" &&
      filing !== "cutoff_time_unresolved"
    )
      throw new TypeError("Invalid canonical financial filing context.");
    return filing;
  }
  return getPersonalSecAnnualSourceUtilityAge(
    canonical.generation,
    canonical.target,
  )!.sourceAgeDays.some((age) => age > 7)
    ? "source_stale"
    : null;
}
