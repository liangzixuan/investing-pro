import type { PersonalPortfolioIdentity } from "@research-cockpit/contracts";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import {
  archiveBytes,
  archiveHtmlFixture,
} from "./portfolio-report-archive-fixture";
import { parsePortfolioReportArchive } from "./portfolio-report-archive";
import { comparePortfolioReports } from "./portfolio-report-comparison";
import { preparePortfolioReviewReport } from "./portfolio-review-report";
import {
  portfolioReviewReportFixture,
  portfolioReviewReportInput,
} from "./portfolio-review-report-fixture";
import { preparePortfolioComparisonReport } from "./portfolio-comparison-report";

const identity = (id: string): PersonalPortfolioIdentity => ({
  ...eodSelection.listing,
  listingId: `invented-${id}`,
  securityId: `security-${id}`,
  shareClassId: `class-${id}`,
  shareClassName: `Class ${id}`,
  symbol: id.toUpperCase(),
});
export function portfolioComparisonFixture() {
  const shared = identity("shared"),
    savedOnly = identity("saved"),
    currentOnly = identity("current"),
    conflict = identity("conflict"),
    goog = identity("goog"),
    googl = identity("googl");
  function capture(identities: PersonalPortfolioIdentity[], saved: boolean) {
    const base = portfolioReviewReportFixture().ledger;
    const ledger = {
      ...base,
      identities,
      opening: {
        ...base.opening,
        cashUsd: saved ? null : "123.45",
        holdings: identities.map((member) => ({
          ...base.opening.holdings[0]!,
          listingId: member.listingId,
          shares: saved ? "2.0000" : "3.0000",
        })),
      },
    };
    const responses = identities
      .slice(0, -1)
      .map((member) => ({ ...eodResponse(), security: member }));
    const input = portfolioReviewReportInput(ledger, "2026-09-19", responses);
    input.preparedAt = saved
      ? "2026-10-28T01:02:03.004Z"
      : "2026-10-29T04:05:06.007Z";
    const report = preparePortfolioReviewReport({
      ...input,
      state: {
        ...input.state,
        message:
          "Invented full evidence · Café 東京 📈 <script>literal</script>",
        rows: input.state.rows.map((row, index) =>
          index === 0
            ? {
                ...row,
                showingPrevious: true,
                message:
                  "Previous history retained after an invented failed refresh.",
              }
            : row,
        ),
      },
    });
    if (!report) throw new Error("Invalid invented Portfolio report");
    return report;
  }
  const saved = parsePortfolioReportArchive(
    archiveBytes(
      archiveHtmlFixture(
        capture([shared, savedOnly, conflict, goog, googl], true),
      ),
    ),
  );
  const current = capture(
    [
      currentOnly,
      shared,
      { ...conflict, issuerName: "Other invented issuer identity" },
      goog,
      googl,
    ],
    false,
  );
  return comparePortfolioReports(saved, current);
}
export function portfolioComparisonReportFixture() {
  const report = preparePortfolioComparisonReport(
    portfolioComparisonFixture(),
    "Saved Café 東京 📈 <report>.html",
    "2026-10-30T07:08:09.123Z",
  );
  if (!report) throw new Error("Invalid invented Portfolio comparison report");
  return report;
}
