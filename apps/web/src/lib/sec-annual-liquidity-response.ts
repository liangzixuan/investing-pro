import {
  PERSONAL_SEC_ANNUAL_LIQUIDITY_ABSENCES,
  PERSONAL_SEC_ANNUAL_LIQUIDITY_LIMITS,
  PERSONAL_SEC_ANNUAL_SCAN_STATUSES,
  type PersonalSecAnnualLiquidityDto,
  type PersonalSecAnnualLiquidityMetric,
  type PersonalSecAnnualLiquidityMetricEvidenceDto,
  type PersonalSecAnnualLiquidityObservationDto,
  type PersonalSecAnnualEvidenceDto,
} from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualLiquidity } from "@research-cockpit/personal-financial-analytics";
import {
  liquidityObservation,
  compareObservations,
  equal,
  integer,
  keys,
  member,
} from "./sec-annual-response-validation";

type Context = Pick<
  PersonalSecAnnualEvidenceDto,
  "cik" | "generation" | "target"
>;
const limits = PERSONAL_SEC_ANNUAL_LIQUIDITY_LIMITS;

/** Validates the independent liquidity scans before recomputing their reported values. */
export function annualLiquidity(
  value: unknown,
  context: Context,
  observationIds: Set<string>,
): value is PersonalSecAnnualLiquidityDto {
  if (
    !keys(value, ["currentAssets", "currentLiabilities", "resolution"]) ||
    !liquidityMetric(
      value.currentAssets,
      "current_assets",
      context,
      observationIds,
    ) ||
    !liquidityMetric(
      value.currentLiabilities,
      "current_liabilities",
      context,
      observationIds,
    )
  )
    return false;
  return equal(
    value.resolution,
    resolvePersonalSecAnnualLiquidity({
      ...context,
      liquidity: {
        currentAssets: value.currentAssets,
        currentLiabilities: value.currentLiabilities,
      },
    }),
  );
}

function liquidityMetric(
  value: unknown,
  metric: PersonalSecAnnualLiquidityMetric,
  context: Context,
  ids: Set<string>,
): value is PersonalSecAnnualLiquidityMetricEvidenceDto {
  if (
    !keys(value, ["scan", "observations"]) ||
    !keys(value.scan, ["status", "absence", "coverage"]) ||
    !member(PERSONAL_SEC_ANNUAL_SCAN_STATUSES, value.scan.status) ||
    !Array.isArray(value.observations) ||
    value.observations.length > limits.observationsPerMetric
  )
    return false;
  const sourceAvailable =
    context.generation.sources.companyFacts.status === "available";
  if ((value.scan.status === "source_unavailable") === sourceAvailable)
    return false;
  if (value.scan.status !== "available")
    return (
      value.scan.absence === null &&
      value.scan.coverage === null &&
      value.observations.length === 0
    );
  if (
    !(
      value.scan.absence === null ||
      member(PERSONAL_SEC_ANNUAL_LIQUIDITY_ABSENCES, value.scan.absence)
    ) ||
    !liquidityCoverage(
      value.scan.coverage,
      context.target.status === "target",
      value.observations.length,
    )
  )
    return false;
  if (
    (value.scan.absence !== null) !==
    (value.scan.coverage.full.candidateRows === 0)
  )
    return false;
  let previous: PersonalSecAnnualLiquidityObservationDto | undefined;
  const locators = new Set<string>();
  for (const row of value.observations) {
    if (
      !liquidityObservation(row, context.cik, metric) ||
      ids.has(row.id) ||
      locators.has(row.sourceLocator) ||
      Number(row.sourceLocator.split("/").at(-1)) >=
        value.scan.coverage.full.candidateRows ||
      context.target.status !== "target" ||
      row.accessionNumber !== context.target.accessionNumber ||
      (previous !== undefined && compareObservations(previous, row) > 0) ||
      !["matched", "metadata_conflict"].includes(row.filing.status) ||
      row.filing.form !== context.target.form ||
      row.filing.filedDate !== context.target.filedDate ||
      row.filing.reportDate !== context.target.reportDate ||
      row.filing.acceptedAt !== context.target.acceptedAt
    )
      return false;
    ids.add(row.id);
    locators.add(row.sourceLocator);
    previous = row;
  }
  return true;
}

function liquidityCoverage(
  value: unknown,
  hasTarget: boolean,
  returned: number,
): value is Extract<
  PersonalSecAnnualLiquidityMetricEvidenceDto["scan"],
  { status: "available" }
>["coverage"] {
  if (
    !keys(value, [
      "full",
      "selected",
      "otherAccessions",
      "returned",
      "omittedSelected",
    ]) ||
    !keys(value.full, [
      "candidateRows",
      "inspectedRows",
      "invalidRows",
      "duplicateRows",
      "uniqueObservations",
    ]) ||
    !integer(value.full.candidateRows, 0, limits.candidateRowsPerMetric) ||
    value.full.inspectedRows !== value.full.candidateRows ||
    !integer(value.full.invalidRows, 0, value.full.inspectedRows) ||
    !integer(value.full.duplicateRows, 0, value.full.inspectedRows) ||
    !integer(value.full.uniqueObservations, 0, value.full.inspectedRows) ||
    value.full.invalidRows +
      value.full.duplicateRows +
      value.full.uniqueObservations !==
      value.full.inspectedRows ||
    value.returned !== returned
  )
    return false;
  if (!hasTarget)
    return (
      value.selected === null &&
      value.otherAccessions === null &&
      value.omittedSelected === null &&
      returned === 0
    );
  return (
    integer(value.selected, 0, value.full.uniqueObservations) &&
    integer(value.otherAccessions, 0, value.full.uniqueObservations) &&
    value.selected + value.otherAccessions === value.full.uniqueObservations &&
    integer(value.omittedSelected, 0, value.selected) &&
    returned + value.omittedSelected === value.selected &&
    (value.selected > limits.observationsPerMetric
      ? returned === 0
      : value.omittedSelected === 0)
  );
}
