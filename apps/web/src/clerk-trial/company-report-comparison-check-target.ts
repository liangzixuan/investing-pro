import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";

export interface CompanyReportComparisonCheckTarget {
  readonly entry: ResearchFollowup;
  readonly dirty: boolean;
  readonly editable: boolean;
  readonly reason: string | null;
  readonly isCurrent: () => boolean;
  readonly apply: (result: string) => boolean;
}

function idle(state: {
  phase: string;
  conflict: unknown;
  uncertain: unknown;
  replayPending: unknown;
}) {
  return (
    state.phase === "idle" &&
    !state.conflict &&
    !state.uncertain &&
    !state.replayPending
  );
}
function ready(w: ManagedWorkspace) {
  const saved = w.followups.coordinator.getSnapshot();
  const view = w.getSnapshot();
  const followups = w.followups.getSnapshot();
  const portfolio = w.portfolio.getSnapshot();
  return Boolean(
    w.canNavigate() &&
    w.followups.canEdit() &&
    saved.latestLoaded &&
    saved.saved !== null &&
    saved.baseVersion === saved.saved.version &&
    [
      saved,
      w.coordinator.getSnapshot(),
      w.portfolio.coordinator.getSnapshot(),
      w.valuationAssumptions.coordinator.getSnapshot(),
    ].every(idle) &&
    !view.read &&
    !view.review &&
    !view.reviewing &&
    !followups.review &&
    !followups.reviewing &&
    !portfolio.review &&
    !portfolio.reviewing &&
    !portfolio.pendingEditor &&
    !w.watchlistFileCatalogReviewRequired() &&
    !w.hasWatchlistDraftFileActivity() &&
    !w.followups.hasDraftFileActivity() &&
    !w.portfolio.hasDraftFileActivity() &&
    !w.valuation.hasDraftFileActivity() &&
    ![w.annual, w.interim, w.filings, w.eod].some(
      (source) => source.getSnapshot().running,
    ),
  );
}
function captureLifetime(
  w: ManagedWorkspace,
  selection: ManagedResearchSelection,
) {
  const route = w.getResearchDraftSetRoute();
  const session = w.sessionOwner.getSnapshot();
  const reads = [
    () => w.coordinator.getSnapshot(),
    () => w.followups.coordinator.getSnapshot(),
    () => w.portfolio.coordinator.getSnapshot(),
    () => w.valuationAssumptions.coordinator.getSnapshot(),
    () => w.valuation.getSnapshot(),
    () => w.getWatchlistDraftFileActivityRevision(),
    () => w.followups.getDraftFileActivityRevision(),
    () => w.portfolio.getDraftFileActivityRevision(),
    () => w.valuation.getDraftFileActivityRevision(),
    () => w.annual.getSnapshot(),
    () => w.interim.getSnapshot(),
    () => w.filings.getSnapshot(),
    () => w.eod.getSnapshot(),
  ];
  const captures = reads.map((read) => read());
  return () => {
    const current = w.getResearchDraftSetRoute();
    return (
      current.research === route.research &&
      current.companyRoute === route.companyRoute &&
      current.navigation === route.navigation &&
      current.view === route.view &&
      !current.blocked &&
      current.research?.selection === selection &&
      w.sessionOwner.getSnapshot() === session &&
      session.phase === "active" &&
      reads.every((read, index) => read() === captures[index])
    );
  };
}

/** Read-only destination capture; the sole mutation reuses the owned assessment edit. */
export function captureCompanyReportComparisonCheckTarget(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
  routeActive: () => boolean,
): CompanyReportComparisonCheckTarget | null {
  const context = workspace.researchFollowupContext(selection);
  if (!context) return null;
  const lifetime = captureLifetime(workspace, selection);
  let retired = false;
  const isCurrent = () => {
    if (retired) return false;
    retired =
      !routeActive() ||
      !lifetime() ||
      !context.isCurrent() ||
      !ready(workspace);
    return !retired;
  };
  const editable = context.editable && isCurrent();
  return Object.freeze({
    entry: context.entry,
    dirty: context.dirty,
    editable,
    reason: editable
      ? null
      : (context.reason ??
        "Finish the pending action, file activity or draft recovery before previewing this check."),
    isCurrent,
    apply(result: string) {
      if (!editable || !isCurrent()) return false;
      retired = true;
      context.editAssessment(result);
      const next = workspace.followups.currentEntry(context.entry.id);
      return next !== context.entry && next?.result === result;
    },
  });
}
