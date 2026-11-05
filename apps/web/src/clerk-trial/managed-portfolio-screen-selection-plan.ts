import type {
  PersonalPortfolioHolding,
  PersonalPortfolioLedgerProjection,
} from "@research-cockpit/contracts";
import {
  prepareScreenListingSelection,
  type ScreenListingSelectionMessages,
} from "./screen-listing-selection-plan";
import type {
  ManagedFinancialScreenMember,
  ManagedFinancialScreenState,
} from "./managed-financial-screen";

export interface PortfolioScreenSelectionRow {
  readonly holding: PersonalPortfolioHolding;
  readonly member: ManagedFinancialScreenMember | null;
  readonly status:
    | "included"
    | "outside_cohort"
    | "uncovered"
    | "identity_mismatch"
    | "choice_required"
    | "other_share_class"
    | "cohort_unloaded";
  readonly reason: string;
}
export interface PortfolioScreenSelectionChoiceGroup {
  readonly issuerId: string;
  readonly members: readonly ManagedFinancialScreenMember[];
  readonly selected: ManagedFinancialScreenMember | null;
}
export interface PortfolioScreenSelectionPlan {
  readonly rows: readonly PortfolioScreenSelectionRow[];
  readonly choiceGroups: readonly PortfolioScreenSelectionChoiceGroup[];
  readonly members: readonly ManagedFinancialScreenMember[];
  readonly canApply: boolean;
  readonly reason: string | null;
}
interface Input {
  readonly projection: PersonalPortfolioLedgerProjection | null;
  readonly screen: ManagedFinancialScreenState;
  readonly coveredMembers: readonly ManagedFinancialScreenMember[];
  readonly choices?: readonly ManagedFinancialScreenMember[];
}
const messages: ScreenListingSelectionMessages = {
  cohort_unloaded: "Load the screening cohort to review this holding.",
  identity_mismatch:
    "Review this holding's complete identity against the current Portfolio catalog.",
  outside_cohort: "This held listing is outside the screening cohort.",
  uncovered: "Annual coverage is unavailable for this exact held listing.",
  included: "Included in the proposed screen selection.",
  choice_required: "Choose one of this issuer's eligible held share classes.",
  other_share_class: "Another held share class was chosen for this issuer.",
  access: "Refresh the current screening catalog in an active session.",
  cohort: "Load the screening cohort first.",
  pending:
    "Finish the screen operation and apply or reset the criteria form first.",
  identity:
    "Review the Portfolio identities against the current catalog before Apply.",
  choices:
    "Choose only one current eligible held listing for each share-class choice.",
  choose: "Choose one eligible held share class for each listed issuer.",
  empty: "No current holdings have eligible Annual screening coverage.",
  limit: "A screen can contain at most 17 issuers.",
};
function finish(
  rows: readonly PortfolioScreenSelectionRow[],
  choiceGroups: readonly PortfolioScreenSelectionChoiceGroup[],
  reason: string | null,
): PortfolioScreenSelectionPlan {
  return Object.freeze({
    rows: Object.freeze([...rows]),
    choiceGroups: Object.freeze([...choiceGroups]),
    members: Object.freeze(
      rows
        .filter((item) => item.status === "included")
        .map((item) => item.member!),
    ),
    canApply: reason === null,
    reason,
  });
}
/** Adapt actual ledger holdings without changing their quantities, dates or identity. */
export function prepareManagedPortfolioScreenSelection({
  projection,
  screen,
  coveredMembers,
  choices = [],
}: Input): PortfolioScreenSelectionPlan {
  if (!projection)
    return finish([], [], "Load and start the Portfolio draft first.");
  if (projection.status !== "valid")
    return finish(
      [],
      [],
      "Correct the invalid Portfolio ledger before choosing companies.",
    );
  const holdings = projection.portfolio.holdings;
  if (!holdings.length)
    return finish([], [], "There are no current Portfolio holdings to screen.");
  const plan = prepareScreenListingSelection({
    listings: holdings.map((holding) => holding.identity),
    snapshotSha256: projection.portfolio.snapshotSha256,
    screen,
    coveredMembers,
    choices,
    messages,
  });
  return finish(
    plan.rows.map((item, index) =>
      Object.freeze({
        holding: holdings[index]!,
        member: item.member,
        status: item.status,
        reason: item.reason,
      }),
    ),
    plan.choiceGroups,
    plan.reason,
  );
}
