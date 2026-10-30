import type { SharedNativeFixture } from "./fixture";
import {
  companyChecksData,
  companyCheckNote,
  companyCheckIndependentResult,
} from "./company-research-checks-fixture-data";
export {
  companyCheckNote as reportCheckNote,
  companyCheckIndependentResult as reportCheckIndependentResult,
} from "./company-research-checks-fixture-data";
export const reportCheckQuestion =
  "What changed since the archived capacity report? Café 東京 📈";
export const reportCheckOriginalResult =
  "Prior assessed capacity remains unresolved · Café 東京 📈";
export const reportCheckAssessment =
  "Archived assumptions need a capacity recheck. <script>literal</script> & Café 東京 📈";
export function reportComparisonCheckData(base: SharedNativeFixture) {
  const data = companyChecksData(base);
  return {
    ...data,
    followups: {
      ...data.followups,
      entries: data.followups.entries.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              check: reportCheckQuestion,
              result: reportCheckOriginalResult,
            }
          : entry,
      ),
    },
  };
}
export function reportComparisonCheckExpected(
  base: SharedNativeFixture,
  result: string,
  completedOn: string,
) {
  const data = reportComparisonCheckData(base);
  return {
    ...data.followups,
    entries: data.followups.entries.map((entry, index) =>
      index === 0
        ? { ...entry, result, status: "completed" as const, completedOn }
        : { ...entry, result: companyCheckIndependentResult },
    ),
  };
}
export const reportCheckIndependentNote = companyCheckNote;

/** Literal fixture expectation independent of the production excerpt formatter. */
export function reportCheckExpectedResult(
  base: SharedNativeFixture,
  assessedAt: string,
  currentPreparedAt: string,
) {
  const generation = base.generations.initial;
  const dates = `price not loaded; annual completed ${generation.completedAt}; interim not loaded; filings not loaded`;
  const references = [
    generation.sources.companyFacts.sourceUrl,
    generation.sources.submissions.sourceUrl,
  ].join("; ");
  return `${reportCheckOriginalResult} ZERO XNAS report revisit assessed ${assessedAt}: archived report prepared 2026-10-15T00:00:00.000Z; current report prepared ${currentPreparedAt}. Archived source dates: ${dates}. Current source dates: ${dates}. Authored assessment: ${reportCheckAssessment} Archived source references (unverified file claims): ${references}. Current source references: ${references}. The file is not authenticated; reopening renews no source dates. Imported calculations are unverified and were not used as current evidence.`;
}
export function reportCheckResultIsExpected(
  base: SharedNativeFixture,
  result: string,
) {
  const times = result.match(
    /report revisit assessed (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z): archived report prepared 2026-10-15T00:00:00\.000Z; current report prepared (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\./,
  );
  if (!times) return false;
  const assessed = times[1]!,
    prepared = times[2]!;
  return (
    new Date(assessed).toISOString() === assessed &&
    new Date(prepared).toISOString() === prepared &&
    result === reportCheckExpectedResult(base, assessed, prepared)
  );
}
