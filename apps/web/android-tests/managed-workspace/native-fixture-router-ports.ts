import {
  nativeReport,
  nativeExport,
  nativePortfolioReviewReport,
  nativeFollowupsReviewReport,
  nativeScreenComparisonReport,
} from "./native-fixture-environment";
export function nativeFixtureRouterPorts() {
  return {
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
