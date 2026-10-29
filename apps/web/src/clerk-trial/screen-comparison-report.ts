import { admitScreenComparisonReport } from "./screen-comparison-report-admission";
import type {
  ManagedEodIdentity,
  PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import type { ManagedFinancialScreenCriteria } from "./managed-financial-screen-results";
import type {
  ManagedFinancialScreenResultRow,
  ManagedFinancialScreenRun,
} from "./managed-financial-screen";

export interface ScreenComparisonReportCompany {
  readonly listing: ManagedEodIdentity;
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly view: PersonalSecAnnualCanonicalView;
  readonly showingPrevious: boolean;
  readonly responseOrigin:
    "request" | "watchlist-comparison" | "financial-screen" | null;
  readonly message: string;
  readonly error: boolean;
  readonly failure: string | null;
}
export interface PreparedScreenComparisonReport {
  readonly kind: "screen_comparison";
  readonly preparedAt: string;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly criteria: ManagedFinancialScreenCriteria;
  readonly run: Readonly<
    Pick<ManagedFinancialScreenRun, "startedAt" | "completedAt" | "status">
  >;
  readonly left: ScreenComparisonReportCompany;
  readonly right: ScreenComparisonReportCompany;
}
const owned = new WeakSet<object>();
export function isPreparedScreenComparisonReport(
  value: unknown,
): value is PreparedScreenComparisonReport {
  return typeof value === "object" && value !== null && owned.has(value);
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export interface ScreenComparisonReportInput {
  readonly preparedAt: string;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly run: ManagedFinancialScreenRun;
  readonly left: ManagedFinancialScreenResultRow;
  readonly right: ManagedFinancialScreenResultRow;
}
/** Own one bounded immutable reading copy after exact screen admission. */
export function prepareScreenComparisonReport(
  input: ScreenComparisonReportInput,
): PreparedScreenComparisonReport | null {
  try {
    const report = admitScreenComparisonReport(input);
    if (
      new TextEncoder().encode(JSON.stringify(report)).byteLength >
      8 * 1024 * 1024
    )
      return null;
    freeze(report);
    owned.add(report);
    return report;
  } catch {
    return null;
  }
}
