import { validateManagedFinancialScreenCriteria } from "./managed-financial-screen-results";
import { captureScreenComparisonCompany } from "./screen-comparison-report-source-admission";
import type {
  PreparedScreenComparisonReport,
  ScreenComparisonReportInput,
} from "./screen-comparison-report";

function preparationTimeIsCanonical(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value))
    return false;
  return new Date(value).toISOString() === value;
}
/** Preserve exact row membership and listing distinction independently of the run metadata. */
function pairBelongsToRun(input: ScreenComparisonReportInput) {
  if (input.left === input.right) return false;
  for (const row of [input.left, input.right])
    if (!input.run.rows.includes(row)) return false;
  return (
    input.left.member.listing.listingId !== input.right.member.listing.listingId
  );
}
function captureRun(input: ScreenComparisonReportInput) {
  if (input.run.status === "running") return null;
  if (!pairBelongsToRun(input)) return null;
  const criteria = validateManagedFinancialScreenCriteria(input.run.criteria);
  if (!criteria) return null;
  return {
    criteria,
    run: {
      startedAt: input.run.startedAt,
      completedAt: input.run.completedAt,
      status: input.run.status,
    },
  };
}
export function admitScreenComparisonReport(
  input: ScreenComparisonReportInput,
): PreparedScreenComparisonReport | null {
  if (!preparationTimeIsCanonical(input.preparedAt)) return null;
  const run = captureRun(input);
  if (!run) return null;
  const left = captureScreenComparisonCompany(
    input.left,
    input.catalogSnapshotSha256,
  );
  if (!left) return null;
  const right = captureScreenComparisonCompany(
    input.right,
    input.catalogSnapshotSha256,
  );
  if (!right) return null;
  return {
    kind: "screen_comparison",
    preparedAt: input.preparedAt,
    catalogSnapshotSha256: input.catalogSnapshotSha256,
    ...run,
    left,
    right,
  };
}
