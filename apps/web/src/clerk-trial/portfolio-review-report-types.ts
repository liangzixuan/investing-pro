import type {
  ManagedPortfolioPayload,
  PersonalPortfolioPayload,
} from "@research-cockpit/contracts";
import type { AuthoredPortfolioCloseReviewResult } from "@research-cockpit/personal-market-analytics";
import type {
  PortfolioCloseRow,
  PortfolioCloseState,
} from "./managed-portfolio-close-review";

export interface PreparedPortfolioReviewReport {
  readonly kind: "portfolio_holdings_review";
  readonly preparedAt: string;
  readonly ledger: ManagedPortfolioPayload;
  readonly portfolio: PersonalPortfolioPayload;
  readonly review: AuthoredPortfolioCloseReviewResult;
  readonly sourceRows: readonly PortfolioCloseRow[];
  readonly selectedDate: string;
  readonly dates: readonly string[];
  readonly message: string;
}
export interface PortfolioReviewReportInput {
  readonly ledger: ManagedPortfolioPayload;
  readonly portfolio: PersonalPortfolioPayload;
  readonly state: PortfolioCloseState;
  readonly review: AuthoredPortfolioCloseReviewResult;
  readonly preparedAt: string;
}
