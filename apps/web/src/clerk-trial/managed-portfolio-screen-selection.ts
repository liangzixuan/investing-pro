import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedFinancialScreenMember } from "./managed-financial-screen";
import { prepareManagedPortfolioScreenSelection } from "./managed-portfolio-screen-selection-plan";
import {
  capturePortfolioScreenContext,
  portfolioScreenContextIssue,
} from "./portfolio-screen-selection-context";

export const stalePortfolioScreenSelection =
  "The Portfolio, screen or visit changed. Preview the current selection again.";

export function getPortfolioScreenSelection(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
  choices: readonly ManagedFinancialScreenMember[],
) {
  const context = capturePortfolioScreenContext(workspace, routeActive);
  const plan = prepareManagedPortfolioScreenSelection({
    projection: workspace.portfolio.getProjection(),
    screen: context.screen,
    coveredMembers: context.screen.memberships.filter((member) =>
      workspace.financialScreen.hasCoverage(member),
    ),
    choices,
  });
  return {
    context,
    plan,
    reason: portfolioScreenContextIssue(context) ?? plan.reason,
  };
}

export function preparePortfolioScreenSelection(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
  choices: readonly ManagedFinancialScreenMember[],
) {
  const { context, plan, reason } = getPortfolioScreenSelection(
    workspace,
    routeActive,
    choices,
  );
  if (reason || !plan.canApply || !context.isCurrent())
    return { preview: null, reason: reason ?? stalePortfolioScreenSelection };
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

export type PortfolioScreenSelectionPreview = NonNullable<
  ReturnType<typeof preparePortfolioScreenSelection>["preview"]
>;
