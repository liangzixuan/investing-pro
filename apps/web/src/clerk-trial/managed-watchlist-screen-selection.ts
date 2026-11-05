import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedFinancialScreenMember } from "./managed-financial-screen";
import { prepareManagedWatchlistScreenSelection } from "./managed-watchlist-screen-selection-plan";
import {
  captureWatchlistScreenContext,
  watchlistScreenContextIssue,
} from "./watchlist-screen-selection-context";

export const staleWatchlistScreenSelection =
  "The Watchlist, screen or visit changed. Preview the current selection again.";

export function getWatchlistScreenSelection(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
  choices: readonly ManagedFinancialScreenMember[],
) {
  const context = captureWatchlistScreenContext(workspace, routeActive);
  const plan = prepareManagedWatchlistScreenSelection({
    watchlist: context.saved.draft,
    screen: context.screen,
    coveredMembers: context.screen.memberships.filter((member) =>
      workspace.financialScreen.hasCoverage(member),
    ),
    choices,
  });
  return {
    context,
    plan,
    reason: watchlistScreenContextIssue(context) ?? plan.reason,
  };
}

export function prepareWatchlistScreenSelection(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
  choices: readonly ManagedFinancialScreenMember[],
) {
  const { context, plan, reason } = getWatchlistScreenSelection(
    workspace,
    routeActive,
    choices,
  );
  if (reason || !plan.canApply || !context.isCurrent())
    return { preview: null, reason: reason ?? staleWatchlistScreenSelection };
  let available = true;
  const unchanged =
    context.screen.selected.length === plan.members.length &&
    context.screen.selected.every(
      (member, index) => member === plan.members[index],
    );
  const isCurrent = () => {
    if (!available) return false;
    if (!context.isCurrent()) available = false;
    return available;
  };
  const preview = Object.freeze({
    plan,
    unchanged,
    isCurrent,
    cancel: () => {
      available = false;
    },
    apply: () => {
      if (!isCurrent()) return null;
      available = false;
      const installed = workspace.financialScreen.applyCompanySelection(
        context.screen,
        plan.members,
      );
      if (!installed || !context.isCurrent(installed)) return null;
      return { unchanged, isCurrent: () => context.isCurrent(installed) };
    },
  });
  return { preview, reason: null };
}

export type WatchlistScreenSelectionPreview = NonNullable<
  ReturnType<typeof prepareWatchlistScreenSelection>["preview"]
>;
