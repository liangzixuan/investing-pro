import type { ManagedWorkspace } from "./managed-workspace";

export function portfolioHeldDueIssue(workspace: ManagedWorkspace) {
  const saved = workspace.portfolio.coordinator.getSnapshot();
  const model = workspace.portfolio.getSnapshot();
  if (!saved.latestLoaded || !saved.saved || !saved.draft)
    return "Load Portfolio separately to inspect current holdings.";
  if (
    saved.phase !== "idle" ||
    saved.conflict ||
    saved.uncertain ||
    saved.replayPending ||
    saved.baseVersion === null ||
    saved.baseVersion !== saved.saved.version
  )
    return "Finish Portfolio Save or recovery before preparing held-company checks.";
  if (model.pendingEditor || model.review || model.reviewing)
    return "Apply or reset the Portfolio form and finish its identity review first.";
  if (workspace.portfolio.hasDraftFileActivity())
    return "Finish or cancel the Portfolio file operation first.";
  if (!saved.draft.ledger)
    return "Set up Portfolio before reviewing its held-company checks.";
  if (!workspace.portfolio.canSavePayload())
    return "Open Portfolio to review its identities against the current catalog and correct its ledger.";
  if (workspace.followups.hasDraftFileActivity())
    return "Finish or cancel the Follow-ups file operation first.";
  if (!workspace.followups.getReviewContext())
    return "Load Follow-ups separately, then finish any save, recovery or identity review.";
  return null;
}

/** A running review owns Portfolio and the Follow-ups scope, not authored results. */
export function captureHeldDueOwner(workspace: ManagedWorkspace) {
  const portfolio = workspace.portfolio.getSnapshot();
  const saved = workspace.portfolio.coordinator.getSnapshot();
  const catalog = workspace.getSnapshot().snapshot;
  const context = workspace.followups.getReviewContext();
  const portfolioFile = workspace.portfolio.getDraftFileActivityRevision();
  const followupsFile = workspace.followups.getDraftFileActivityRevision();
  let retired = false;
  const current = () => {
    const next = workspace.followups.getReviewContext();
    if (
      !context ||
      !next ||
      next.scope !== context.scope ||
      workspace.sessionOwner.getSnapshot().phase !== "active" ||
      workspace.portfolio.getSnapshot() !== portfolio ||
      workspace.portfolio.coordinator.getSnapshot() !== saved ||
      workspace.getSnapshot().snapshot !== catalog ||
      workspace.portfolio.getDraftFileActivityRevision() !== portfolioFile ||
      workspace.followups.getDraftFileActivityRevision() !== followupsFile ||
      workspace.portfolio.hasDraftFileActivity() ||
      workspace.followups.hasDraftFileActivity()
    )
      retired = true;
    return !retired;
  };
  return { context, current };
}
