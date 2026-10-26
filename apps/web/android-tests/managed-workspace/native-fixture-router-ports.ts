import {
  nativeReport,
  nativeExport,
  nativePortfolioReviewReport,
  nativeFollowupsReviewReport,
} from "./native-fixture-environment";
export function nativeFixtureRouterPorts() {
  return {
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
