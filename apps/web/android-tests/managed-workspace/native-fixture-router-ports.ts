import {
  nativeReport,
  nativeDueCheckEvidenceReport,
  nativeWatchlistDailyReport,
  nativeExport,
  nativePortfolioReviewReport,
  nativePortfolioComparisonReport,
  nativeFollowupsReviewReport,
  nativeScreenComparisonReport,
  nativeScreenResearchReport,
} from "./native-fixture-environment";
export function nativeFixtureRouterPorts() {
  return {
    ...(nativeDueCheckEvidenceReport
      ? {
          dueCheckEvidenceReportDelivery: nativeDueCheckEvidenceReport.delivery,
        }
      : {}),
    ...(nativeWatchlistDailyReport
      ? { watchlistDailyReportDelivery: nativeWatchlistDailyReport.delivery }
      : {}),
    ...(nativeScreenResearchReport
      ? { screenResearchReportDelivery: nativeScreenResearchReport.delivery }
      : {}),
    ...(nativePortfolioComparisonReport
      ? {
          portfolioComparisonReportDelivery:
            nativePortfolioComparisonReport.delivery,
        }
      : {}),
    ...(nativeScreenComparisonReport
      ? {
          screenComparisonReportDelivery: nativeScreenComparisonReport.delivery,
        }
      : {}),
    ...(nativeReport ? { reportDelivery: nativeReport.delivery } : {}),
    ...(nativeExport ? { exportDelivery: nativeExport.delivery } : {}),
    ...(nativePortfolioReviewReport
      ? { portfolioReviewReportDelivery: nativePortfolioReviewReport.delivery }
      : {}),
    ...(nativeFollowupsReviewReport
      ? { followupsReviewReportDelivery: nativeFollowupsReviewReport.delivery }
      : {}),
  };
}
