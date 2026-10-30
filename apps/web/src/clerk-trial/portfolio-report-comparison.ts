import type { PersonalPortfolioPayload } from "@research-cockpit/contracts";
import type { AuthoredPortfolioCloseReviewResult } from "@research-cockpit/personal-market-analytics";
import type { PortfolioCloseRow } from "./managed-portfolio-close-review";
import { isPortfolioReportArchive } from "./portfolio-report-archive";
import {
  isPreparedPortfolioReviewReport,
  type PreparedPortfolioReviewReport,
} from "./portfolio-review-report";
import {
  freezePortfolioReportData,
  samePortfolioReportData,
} from "./portfolio-review-report-data";

export interface PortfolioReportComparisonSide {
  readonly holding: PersonalPortfolioPayload["holdings"][number];
  readonly sourceRow: PortfolioCloseRow;
  readonly line: AuthoredPortfolioCloseReviewResult["holdings"][number];
  readonly composition: AuthoredPortfolioCloseReviewResult["composition"]["holdings"][number];
}
export interface PortfolioReportComparisonRow {
  readonly listingId: string;
  readonly status: "saved-only" | "current-only" | "both" | "identity-conflict";
  readonly saved: PortfolioReportComparisonSide | null;
  readonly current: PortfolioReportComparisonSide | null;
  readonly changedFields: readonly string[];
  readonly conflictsWith: readonly string[];
}
export interface PortfolioReportComparison {
  readonly saved: PreparedPortfolioReviewReport;
  readonly current: PreparedPortfolioReviewReport;
  readonly rows: readonly PortfolioReportComparisonRow[];
  readonly changedFields: readonly string[];
}
function sides(report: PreparedPortfolioReviewReport) {
  return new Map(
    report.sourceRows.map((sourceRow) => {
      const holding = sourceRow.holding;
      const id = holding.identity.listingId;
      const line = report.review.holdings.find(
        (entry) => entry.listingId === id,
      );
      const composition = report.review.composition.holdings.find(
        (entry) => entry.listingId === id,
      );
      if (!line || !composition)
        throw new TypeError("Portfolio comparison evidence is incomplete.");
      return [id, { holding, sourceRow, line, composition }] as const;
    }),
  );
}
function differences(
  a: PortfolioReportComparisonSide,
  b: PortfolioReportComparisonSide,
) {
  const fields = {
    identity: [a.holding.identity, b.holding.identity],
    shares: [a.line.shares, b.line.shares],
    confirmedOn: [a.line.confirmedOn, b.line.confirmedOn],
    holding: [a.holding, b.holding],
    close: [a.line.close, b.line.close],
    valueUsd: [a.line.valueUsd, b.line.valueUsd],
    qualification: [
      [a.line.status, a.line.reason],
      [b.line.status, b.line.reason],
    ],
    composition: [a.composition, b.composition],
    source: [a.sourceRow, b.sourceRow],
  };
  return Object.entries(fields)
    .filter(([, [left, right]]) => !samePortfolioReportData(left, right))
    .map(([key]) => key);
}
function reportDifferences(
  saved: PreparedPortfolioReviewReport,
  current: PreparedPortfolioReviewReport,
) {
  return (
    [
      "preparedAt",
      "selectedDate",
      "dates",
      "ledger",
      "portfolio",
      "review",
      "sourceRows",
      "message",
    ] as const
  ).filter((key) => !samePortfolioReportData(saved[key], current[key]));
}
/** Compare raw captured observations; do not infer returns, date order or replacement identities. */
export function comparePortfolioReports(
  saved: PreparedPortfolioReviewReport,
  current: PreparedPortfolioReviewReport,
): PortfolioReportComparison {
  if (
    !isPortfolioReportArchive(saved) ||
    !isPreparedPortfolioReviewReport(current)
  )
    throw new TypeError(
      "Compare an admitted archive with a current owned Portfolio capture.",
    );
  const old = sides(saved),
    fresh = sides(current);
  const ids = [...new Set([...old.keys(), ...fresh.keys()])];
  const rows = ids.map((listingId): PortfolioReportComparisonRow => {
    const before = old.get(listingId) ?? null,
      after = fresh.get(listingId) ?? null;
    const identities = [
      before?.holding.identity,
      after?.holding.identity,
    ].filter((value) => value !== undefined);
    const conflictsWith = ids.filter(
      (id) =>
        id !== listingId &&
        [old.get(id), fresh.get(id)].some(
          (side) =>
            side &&
            identities.some(
              (identity) =>
                identity.symbol === side.holding.identity.symbol &&
                identity.exchangeMic === side.holding.identity.exchangeMic,
            ),
        ),
    );
    const conflict =
      conflictsWith.length > 0 ||
      (before &&
        after &&
        !samePortfolioReportData(
          before.holding.identity,
          after.holding.identity,
        ));
    return {
      listingId,
      saved: before,
      current: after,
      conflictsWith,
      status: conflict
        ? "identity-conflict"
        : before
          ? after
            ? "both"
            : "saved-only"
          : "current-only",
      changedFields: before && after ? differences(before, after) : [],
    };
  });
  const result = {
    saved,
    current,
    rows,
    changedFields: reportDifferences(saved, current),
  };
  freezePortfolioReportData(result);
  return result;
}
