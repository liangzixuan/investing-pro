import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  getManagedResearchCoverageCik,
  type ManagedResearchCoverage,
} from "./managed-research-eligibility";
/** Explicit managed interim route cohort. It does not establish a filing or value's availability. */
export const MANAGED_INTERIM_ISSUERS: readonly string[] = Object.freeze([
  "0000320193",
  "0001652044",
  "0000789019",
  "0000002186",
  "0000002488",
  "0000003453",
  "0000003545",
  "0000003570",
  "0000004127",
  "0000004281",
  "0000004457",
  "0000004962",
  "0000004977",
  "0000005272",
  "0000005513",
  "0000005981",
  "0000006176",
]);
export function hasManagedInterimCoverage(
  selection: ManagedResearchSelection,
  coverage: ManagedResearchCoverage,
  issuers: readonly string[],
) {
  const cik = getManagedResearchCoverageCik(selection, coverage);
  return (
    cik !== null &&
    (selection.cik === null || selection.cik === cik) &&
    issuers.includes(cik)
  );
}
