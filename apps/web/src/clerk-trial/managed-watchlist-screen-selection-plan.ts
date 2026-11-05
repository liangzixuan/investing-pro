import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import type {
  ManagedFinancialScreenMember,
  ManagedFinancialScreenState,
} from "./managed-financial-screen";
import {
  prepareScreenListingSelection,
  type ScreenListingSelectionMessages,
  type ScreenListingSelectionChoiceGroup,
  type ScreenListingSelectionRow,
} from "./screen-listing-selection-plan";
export interface WatchlistScreenSelectionRow {
  readonly membership: MainWatchlistPayload["memberships"][number];
  readonly member: ManagedFinancialScreenMember | null;
  readonly status: ScreenListingSelectionRow["status"];
  readonly reason: string;
}
export interface WatchlistScreenSelectionPlan {
  readonly rows: readonly WatchlistScreenSelectionRow[];
  readonly choiceGroups: readonly ScreenListingSelectionChoiceGroup[];
  readonly members: readonly ManagedFinancialScreenMember[];
  readonly canApply: boolean;
  readonly reason: string | null;
}
interface Input {
  readonly watchlist: MainWatchlistPayload | null;
  readonly screen: ManagedFinancialScreenState;
  readonly coveredMembers: readonly ManagedFinancialScreenMember[];
  readonly choices?: readonly ManagedFinancialScreenMember[];
}
const messages: ScreenListingSelectionMessages = {
  cohort_unloaded: "Load the screening cohort to review this Watchlist member.",
  identity_mismatch:
    "Review this Watchlist member's complete identity against the current Watchlist catalog.",
  outside_cohort: "This watched listing is outside the screening cohort.",
  uncovered: "Annual coverage is unavailable for this exact watched listing.",
  included: "Included in the proposed screen selection.",
  choice_required:
    "Choose one of this issuer's eligible watched share classes.",
  other_share_class: "Another watched share class was chosen for this issuer.",
  access: "Refresh the current screening catalog in an active session.",
  cohort: "Load the screening cohort first.",
  pending:
    "Finish the screen operation and apply or reset the criteria form first.",
  identity:
    "Review the Watchlist identities against the current catalog before Apply.",
  choices:
    "Choose only one current eligible watched listing for each share-class choice.",
  choose: "Choose one eligible watched share class for each listed issuer.",
  empty:
    "No current Watchlist members have eligible Annual screening coverage.",
  limit: "A screen can contain at most 17 issuers.",
};
export function prepareManagedWatchlistScreenSelection({
  watchlist,
  screen,
  coveredMembers,
  choices = [],
}: Input): WatchlistScreenSelectionPlan {
  if (!watchlist || !watchlist.memberships.length)
    return Object.freeze({
      rows: Object.freeze([]),
      choiceGroups: Object.freeze([]),
      members: Object.freeze([]),
      canApply: false,
      reason: watchlist
        ? "There are no current Watchlist companies to screen."
        : "Load My Watchlist first.",
    });
  const plan = prepareScreenListingSelection({
    listings: watchlist.memberships,
    snapshotSha256: watchlist.snapshotSha256,
    screen,
    coveredMembers,
    choices,
    messages,
  });
  return Object.freeze({
    ...plan,
    rows: Object.freeze(
      plan.rows.map((item, index) =>
        Object.freeze({
          membership: watchlist.memberships[index]!,
          member: item.member,
          status: item.status,
          reason: item.reason,
        }),
      ),
    ),
  });
}
