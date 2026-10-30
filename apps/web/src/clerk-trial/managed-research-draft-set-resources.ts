import type { ManagedWorkspace } from "./managed-workspace";
import { formatManagedWatchlistDraftFile } from "./managed-watchlist-draft-file";
import { formatManagedPortfolioDraftFile } from "./managed-portfolio-draft-file";
import { formatManagedFollowupsDraftFile } from "./managed-followups-draft-file";
import { formatManagedValuationCollectionDraftFile } from "./managed-valuation-collection-draft-file";
import type {
  ResearchDraftMember,
  ResearchDraftResource,
} from "./managed-research-draft-set-file";
interface Context {
  saved: unknown;
  draft: unknown;
  baseVersion: number;
  catalog: unknown;
  editorFileRevision?: object;
}
export interface DraftSetResourceCommit {
  isCurrent(): boolean;
}
export interface DraftSetResourceCapture {
  readonly resource: ResearchDraftResource;
  readonly content: ResearchDraftMember | null;
  readonly baseVersion: number;
  sameData(owner?: object): boolean;
  isCurrent(): boolean;
  restore(
    content: ResearchDraftMember,
    owner: object,
  ): DraftSetResourceCommit | null;
}
interface CaptureOptions<C extends Context> {
  resource: ResearchDraftResource;
  owner: object | undefined;
  context: (owner?: object) => C | null;
  snapshot: () => unknown;
  activity: () => object;
  asFile: boolean;
  currentContent: (context: C) => ResearchDraftMember | null;
  format: (context: C) => { text: string } | null;
  restore: (context: C, content: ResearchDraftMember, owner: object) => boolean;
}
function capture<C extends Context>(
  options: CaptureOptions<C>,
): DraftSetResourceCapture | null {
  const before = options.context(options.owner);
  if (!before) return null;
  const snapshot = options.snapshot(),
    activity = options.activity(),
    document = options.asFile ? options.format(before) : null;
  if (options.asFile && !document) return null;
  const sameData = (owner = options.owner) => {
    const current = options.context(owner);
    return (
      current !== null &&
      options.snapshot() === snapshot &&
      current.saved === before.saved &&
      current.draft === before.draft &&
      current.baseVersion === before.baseVersion &&
      current.catalog === before.catalog &&
      current.editorFileRevision === before.editorFileRevision
    );
  };
  if (!sameData()) return null;
  return {
    resource: options.resource,
    content: document
      ? (JSON.parse(document.text) as ResearchDraftMember)
      : options.currentContent(before),
    baseVersion: before.baseVersion,
    sameData,
    isCurrent: () => sameData() && options.activity() === activity,
    restore: (content, owner) => {
      if (
        !sameData(owner) ||
        options.activity() !== activity ||
        !options.restore(before, content, owner)
      )
        return null;
      const installed = options.snapshot();
      return { isCurrent: () => options.snapshot() === installed };
    },
  };
}
export function draftSetResourceEligible(
  workspace: ManagedWorkspace,
  resource: ResearchDraftResource,
) {
  switch (resource) {
    case "watchlist":
      return workspace.getWatchlistResourceDraftContext() !== null;
    case "portfolio":
      return (
        !workspace.portfolio.hasDraftFileActivity() &&
        workspace.portfolio.getDraftFileContext()?.draft.ledger != null
      );
    case "followups":
      return (
        !workspace.followups.hasDraftFileActivity() &&
        workspace.followups.getDraftFileContext() !== null
      );
    case "valuation":
      return workspace.valuationAssumptions.getDraftFileContext() !== null;
  }
}
export function captureDraftSetResource(
  workspace: ManagedWorkspace,
  resource: ResearchDraftResource,
  accountScope: string,
  capturedAt: string,
  owner?: object,
  asFile = true,
): DraftSetResourceCapture | null {
  switch (resource) {
    case "watchlist":
      return capture({
        resource,
        owner,
        asFile,
        context: (o) => workspace.getWatchlistResourceDraftContext(o),
        snapshot: workspace.coordinator.getSnapshot,
        activity: () => workspace.getWatchlistDraftFileActivityRevision(),
        currentContent: (c) => ({
          format: "investment-watchlist-draft",
          version: 1,
          accountScope,
          capturedAt,
          baseVersion: c.baseVersion,
          draft: c.draft,
        }),
        format: (c) =>
          formatManagedWatchlistDraftFile({
            accountScope,
            capturedAt,
            baseVersion: c.baseVersion,
            draft: c.draft,
          }),
        restore: (c, m, o) =>
          m.format === "investment-watchlist-draft" &&
          workspace.restoreWatchlistResourceDraft(c, m.draft, o),
      });
    case "portfolio":
      return capture({
        resource,
        owner,
        asFile,
        context: (o) =>
          workspace.portfolio.hasDraftFileActivity() &&
          (!o || !workspace.portfolio.ownsDraftFileActivity(o))
            ? null
            : workspace.portfolio.getDraftFileContext(),
        snapshot: workspace.portfolio.coordinator.getSnapshot,
        activity: () => workspace.portfolio.getDraftFileActivityRevision(),
        currentContent: (c) =>
          c.draft.ledger
            ? {
                format: "investment-portfolio-draft",
                version: 1,
                accountScope,
                capturedAt,
                baseVersion: c.baseVersion,
                draft: c.draft.ledger,
              }
            : null,
        format: (c) =>
          c.draft.ledger
            ? formatManagedPortfolioDraftFile({
                accountScope,
                capturedAt,
                baseVersion: c.baseVersion,
                draft: c.draft.ledger,
              })
            : null,
        restore: (c, m) =>
          m.format === "investment-portfolio-draft" &&
          workspace.portfolio.restoreFileDraft(c, m.draft),
      });
    case "followups":
      return capture({
        resource,
        owner,
        asFile,
        context: (o) =>
          workspace.followups.hasDraftFileActivity() &&
          (!o || !workspace.followups.ownsDraftFileActivity(o))
            ? null
            : workspace.followups.getDraftFileContext(),
        snapshot: workspace.followups.coordinator.getSnapshot,
        activity: () => workspace.followups.getDraftFileActivityRevision(),
        currentContent: (c) => ({
          format: "investment-followups-draft",
          version: 1,
          accountScope,
          capturedAt,
          baseVersion: c.baseVersion,
          draft: c.draft,
        }),
        format: (c) =>
          formatManagedFollowupsDraftFile({
            accountScope,
            capturedAt,
            baseVersion: c.baseVersion,
            draft: c.draft,
          }),
        restore: (c, m) =>
          m.format === "investment-followups-draft" &&
          workspace.followups.restoreFileDraft(c, m.draft),
      });
    case "valuation":
      return capture({
        resource,
        owner,
        asFile,
        context: (o) => workspace.valuationAssumptions.getDraftFileContext(o),
        snapshot: workspace.valuationAssumptions.coordinator.getSnapshot,
        activity: () =>
          workspace.valuationAssumptions.getCollectionFileActivityRevision(),
        currentContent: (c) => ({
          format: "investment-valuation-collection-draft",
          version: 1,
          accountScope,
          capturedAt,
          payload: c.draft,
        }),
        format: (c) =>
          formatManagedValuationCollectionDraftFile({
            accountScope,
            capturedAt,
            payload: c.draft,
          }),
        restore: (c, m, o) =>
          m.format === "investment-valuation-collection-draft" &&
          workspace.valuationAssumptions.restoreFileDraft(c, m.payload, o),
      });
  }
}
export function beginDraftSetResource(
  workspace: ManagedWorkspace,
  key: ResearchDraftResource,
  owner: object,
) {
  switch (key) {
    case "watchlist":
      workspace.beginWatchlistDraftFileActivity(owner);
      break;
    case "portfolio":
      workspace.portfolio.beginDraftFileActivity(owner);
      break;
    case "followups":
      workspace.followups.beginDraftFileActivity(owner);
      break;
    case "valuation":
      workspace.valuationAssumptions.beginCollectionFileActivity(owner);
  }
}
export function endDraftSetResource(
  workspace: ManagedWorkspace,
  key: ResearchDraftResource,
  owner: object,
) {
  switch (key) {
    case "watchlist":
      workspace.endWatchlistDraftFileActivity(owner);
      break;
    case "portfolio":
      workspace.portfolio.endDraftFileActivity(owner);
      break;
    case "followups":
      workspace.followups.endDraftFileActivity(owner);
      break;
    case "valuation":
      workspace.valuationAssumptions.endCollectionFileActivity(owner);
  }
}
export function draftSetReadFence(
  workspace: ManagedWorkspace,
): readonly unknown[] {
  return [
    workspace.coordinator.getSnapshot(),
    workspace.portfolio.coordinator.getSnapshot(),
    workspace.followups.coordinator.getSnapshot(),
    workspace.valuationAssumptions.coordinator.getSnapshot(),
    workspace.getSnapshot().snapshot,
    workspace.getWatchlistDraftFileActivityRevision(),
    workspace.portfolio.getDraftFileActivityRevision(),
    workspace.followups.getDraftFileActivityRevision(),
    workspace.valuationAssumptions.getCollectionFileActivityRevision(),
    workspace.valuation.getDraftFileActivityRevision(),
  ];
}
