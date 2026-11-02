import {
  nativeReport,
  nativeExport,
  nativePortfolioReviewReport,
  nativePortfolioComparisonReport,
  nativeFollowupsReviewReport,
  nativeScreenComparisonReport,
  nativeScreenResearchReport,
} from "./native-fixture-environment";
export function nativeFixtureRouterPorts() {
  return {
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
