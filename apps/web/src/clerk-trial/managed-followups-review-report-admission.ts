import type { ResearchFollowupsPayload } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type { FollowupsDraftFileContext } from "./managed-research-followups";
import type { SaveState } from "./save-coordinator";
import {
  captureFollowupsReportRoute,
  sameFollowupsReportRoute,
  type FollowupsReportRoute,
} from "./managed-followups-review-report-route";

export interface FollowupsReportContext
  extends FollowupsDraftFileContext, FollowupsReportRoute {
  readonly saveState: SaveState<ResearchFollowupsPayload>;
}
function freshBase(saved: SaveState<ResearchFollowupsPayload>) {
  if (!saved.latestLoaded) return false;
  if (!saved.saved) return false;
  return saved.baseVersion === saved.saved.version;
}
function settledSave(saved: SaveState<ResearchFollowupsPayload>) {
  if (saved.phase !== "idle") return false;
  if (saved.conflict) return false;
  if (saved.uncertain) return false;
  return !saved.replayPending;
}
function captureDraft(workspace: ManagedWorkspace) {
  if (workspace.followups.hasDraftFileActivity()) return null;
  const context = workspace.followups.getDraftFileContext(false);
  const saveState = workspace.followups.coordinator.getSnapshot();
  if (!context) return null;
  if (!freshBase(saveState)) return null;
  if (!settledSave(saveState)) return null;
  return { ...context, saveState };
}
export function captureFollowupsReportContext(
  workspace: ManagedWorkspace,
  routeActive: () => boolean,
): FollowupsReportContext | null {
  const route = captureFollowupsReportRoute(workspace, routeActive);
  if (!route) return null;
  const draft = captureDraft(workspace);
  if (!draft) return null;
  return { ...draft, ...route };
}
function sameDraft(
  before: FollowupsDraftFileContext,
  after: FollowupsDraftFileContext,
) {
  return (
    before.saved === after.saved &&
    before.draft === after.draft &&
    before.baseVersion === after.baseVersion &&
    before.catalog === after.catalog
  );
}
export function sameFollowupsReportContext(
  before: FollowupsReportContext,
  after: FollowupsReportContext | null,
) {
  if (!after) return false;
  if (before.saveState !== after.saveState) return false;
  if (!sameDraft(before, after)) return false;
  return sameFollowupsReportRoute(before, after);
}
