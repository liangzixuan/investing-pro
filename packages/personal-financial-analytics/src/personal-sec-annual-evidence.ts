import {
  getPersonalSecAnnualFilingReason as filingReason,
  getPersonalSecAnnualSourceClockReason,
  getPersonalSecAnnualSourceUtilityAge,
  personalSecAnnualInstant as instant,
  personalSecAnnualDay as day,
} from "./personal-sec-annual-source-context";
import { resolvePersonalSecAnnualIncomeCore } from "./personal-sec-annual-income-core";
export {
  getPersonalSecAnnualFilingReason,
  getPersonalSecAnnualRowReason,
  getPersonalSecAnnualSourceClockReason,
  getPersonalSecAnnualSourceUtilityAge,
} from "./personal-sec-annual-source-context";
export { calculatePersonalSecAnnualNetMargin } from "./personal-sec-annual-income-core";
import {
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  type PersonalSecAnnualFilingDto,
  type PersonalSecAnnualGenerationDto,
  type PersonalSecAnnualRefusalReason,
  type PersonalSecAnnualResolutionDto,
  type PersonalSecAnnualResolutionInput,
  type PersonalSecAnnualSourceDto,
  type PersonalSecAnnualTargetDto,
  type PersonalSecAnnualTargetReason,
} from "@research-cockpit/contracts";
const DAY = 86_400_000;
function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new TypeError("Invalid annual SEC evidence input.");
}
/** Select metadata before looking at financial values. No older passing fallback. */
export function selectPersonalSecAnnualTarget(
  filings: readonly PersonalSecAnnualFilingDto[] | null,
  cutoffAt: string,
  fetchedAt: string,
): PersonalSecAnnualTargetDto {
  const unresolved = (
    reason: PersonalSecAnnualTargetReason,
  ): PersonalSecAnnualTargetDto =>
    Object.freeze({ status: "unresolved", reason });
  if (filings === null) return unresolved("submissions_unavailable");
  const cutoff = instant(cutoffAt),
    capture = instant(fetchedAt);
  if (cutoff === null || capture === null || capture < cutoff)
    return unresolved("invalid_clock");
  const arrayShape: unknown = filings;
  if (
    !Array.isArray(arrayShape) ||
    filings.length > PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.submissionRows
  )
    return unresolved("invalid_submissions");
  const seen = new Set<string>();
  for (const filing of filings) {
    if (
      filing === null ||
      typeof filing !== "object" ||
      !/^\d{10}-\d{2}-\d{6}$/u.test(filing.accessionNumber) ||
      typeof filing.form !== "string" ||
      seen.has(filing.accessionNumber) ||
      (filing.filedDate !== null && day(filing.filedDate) === null) ||
      (filing.reportDate !== null && day(filing.reportDate) === null) ||
      (filing.acceptedAt !== null && instant(filing.acceptedAt) === null)
    )
      return unresolved("invalid_submissions");
    seen.add(filing.accessionNumber);
  }
  const annual = filings.filter(
    (f) =>
      (f.form === "10-K" || f.form === "20-F") &&
      f.filedDate !== null &&
      f.filedDate <= cutoffAt.slice(0, 10),
  );
  if (annual.some((f) => f.reportDate === null))
    return unresolved("target_missing_report_date");
  const candidates = annual
    .filter(
      (f) =>
        f.reportDate! <= cutoffAt.slice(0, 10) &&
        (f.acceptedAt === null || instant(f.acceptedAt)! <= cutoff),
    )
    .sort(
      (a, b) =>
        b.reportDate!.localeCompare(a.reportDate!) ||
        b.filedDate!.localeCompare(a.filedDate!),
    );
  const first = candidates[0];
  if (first === undefined) return unresolved("no_observed_annual_target");
  const reason = filingReason(first, cutoffAt, fetchedAt);
  if (reason !== null) return unresolved(reason);
  if (
    candidates.filter(
      (f) =>
        f.reportDate === first.reportDate && f.filedDate === first.filedDate,
    ).length !== 1
  )
    return unresolved("target_ambiguous");
  return Object.freeze({
    status: "target",
    accessionNumber: first.accessionNumber,
    form: first.form as "10-K" | "20-F",
    filedDate: first.filedDate!,
    reportDate: first.reportDate!,
    acceptedAt: first.acceptedAt,
  });
}

/** Canonical UTF-8 input for SHA-256 in the server or WebCrypto client.
 * This binds returned capture identity; it cannot prove absent source candidates.
 */
export function serializePersonalSecAnnualGeneration(input: {
  readonly cik: string;
  readonly generation: Omit<PersonalSecAnnualGenerationDto, "sha256">;
  readonly target: PersonalSecAnnualTargetDto;
  readonly targetScan: PersonalSecAnnualResolutionInput["targetScan"];
}): string {
  const source = (s: PersonalSecAnnualSourceDto) => [
    s.status,
    s.sourceUrl,
    s.fetchedAt,
    s.sha256,
    s.bytes,
  ];
  const target =
    input.target.status === "target"
      ? [
          "target",
          input.target.accessionNumber,
          input.target.form,
          input.target.filedDate,
          input.target.reportDate,
          input.target.acceptedAt,
        ]
      : ["unresolved", input.target.reason];
  const scan =
    input.targetScan === null
      ? null
      : [
          input.targetScan.currentFilings,
          input.targetScan.annualFilings,
          input.targetScan.olderHistoryAvailable,
        ];
  return JSON.stringify([
    "personal-sec-annual-evidence",
    input.generation.definitionVersion,
    input.cik,
    input.generation.cutoffAt,
    input.generation.completedAt,
    source(input.generation.sources.companyFacts),
    source(input.generation.sources.submissions),
    target,
    scan,
  ]);
}

/** Shared source/clock admission, independent of any financial concept scan. */
export function getPersonalSecAnnualSourceReason(
  generation: PersonalSecAnnualGenerationDto,
): "invalid_clock" | "source_unavailable" | null {
  if (generation.definitionVersion !== PERSONAL_SEC_ANNUAL_DEFINITION_VERSION)
    return "invalid_clock";
  return getPersonalSecAnnualSourceClockReason(generation);
}

export function getPersonalSecAnnualUtilityAge(
  generation: PersonalSecAnnualGenerationDto,
  target: PersonalSecAnnualTargetDto,
): PersonalSecAnnualResolutionDto["utilityAge"] {
  if (getPersonalSecAnnualSourceReason(generation) !== null) return null;
  return getPersonalSecAnnualSourceUtilityAge(generation, target);
}

/** Deterministic revenue/income refusal precedence shared by provider and decoder. */
export function getPersonalSecAnnualRefusalReason(
  input: Pick<
    PersonalSecAnnualResolutionInput,
    "generation" | "target" | "coverage" | "incomeScanStatus"
  >,
): PersonalSecAnnualRefusalReason | null {
  const { generation, target, coverage } = input;
  const sourceReason = getPersonalSecAnnualSourceReason(generation);
  if (sourceReason !== null) return sourceReason;
  if (input.incomeScanStatus !== "available" || coverage === null)
    return "source_unavailable";
  if (coverage.full.invalidRows > 0) return "invalid_source_rows";
  if (target.status === "unresolved") return "target_unresolved";
  requireValid(coverage.selected !== null);
  if (
    coverage.selected.revenue >
      PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.observationsPerMetric ||
    coverage.selected.netIncome >
      PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.observationsPerMetric
  )
    return "selected_report_overflow";
  if (
    [generation.sources.companyFacts, generation.sources.submissions].some(
      (source) =>
        (instant(generation.completedAt)! - instant(source.fetchedAt!)!) / DAY >
        7,
    )
  )
    return "source_stale";
  return null;
}

/** Pure recomputation over the already validated bounded response.
 * Structural wire validation, raw-source parsing and SHA verification are separate.
 */
export function resolvePersonalSecAnnualEvidence(
  input: PersonalSecAnnualResolutionInput,
): PersonalSecAnnualResolutionDto {
  const refusal = getPersonalSecAnnualRefusalReason(input);
  if (refusal !== null) {
    requireValid(
      input.completeness.status === "refused" &&
        input.completeness.reason === refusal &&
        input.observations.length === 0,
    );
    return resolvePersonalSecAnnualIncomeCore(input, true);
  }
  requireValid(
    input.completeness.status === "complete" &&
      input.completeness.reason === null &&
      input.target.status === "target" &&
      input.coverage !== null &&
      input.coverage.selected !== null,
  );
  const { target, generation, observations, coverage } = input;
  const selectedCounts = coverage.selected;
  requireValid(selectedCounts !== null);
  requireValid(
    observations.length <=
      PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.observations &&
      observations.length === selectedCounts.observations &&
      observations.length === coverage.returned.observations,
  );
  requireValid(
    observations.filter((r) => r.metric === "revenue").length ===
      selectedCounts.revenue &&
      observations.filter((r) => r.metric === "net_income").length ===
        selectedCounts.netIncome &&
      new Set(observations.map((r) => r.id)).size === observations.length,
  );
  requireValid(
    observations.every((r) => r.accessionNumber === target.accessionNumber),
  );
  requireValid(target.form === "10-K" || target.form === "20-F");
  requireValid(
    filingReason(
      target,
      generation.cutoffAt,
      generation.sources.submissions.fetchedAt!,
    ) === null,
  );
  requireValid(
    observations.every(
      (row) =>
        (row.metric === "net_income" && row.concept === "NetIncomeLoss") ||
        (row.metric === "revenue" &&
          PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.some(
            (concept) => concept === row.concept,
          )),
    ),
  );
  return resolvePersonalSecAnnualIncomeCore(input);
}
