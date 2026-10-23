import {
  encodeMainWatchlistPayload,
  isMainWatchlistPayload,
  MANAGED_WATCHLIST_LIMITS,
  membershipMatchesResult,
  type MainWatchlistPayload,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type { SaveState } from "./save-coordinator";

export interface PortfolioWatchlistPreview {
  readonly listing: ManagedEodIdentity;
  readonly status: "add" | "existing";
  readonly shares: string;
  readonly confirmedOn: string;
}
interface PortfolioWatchlistContext {
  readonly workspace: ManagedWorkspace;
  readonly view: ReturnType<ManagedWorkspace["getSnapshot"]>;
  readonly session: ReturnType<ManagedWorkspace["sessionOwner"]["getSnapshot"]>;
  readonly portfolio: ReturnType<ManagedWorkspace["portfolio"]["getSnapshot"]>;
  readonly ledger: ReturnType<
    ManagedWorkspace["portfolio"]["coordinator"]["getSnapshot"]
  >;
  readonly watchlist: ReturnType<
    ManagedWorkspace["coordinator"]["getSnapshot"]
  >;
  readonly routeCurrent: (() => boolean) | null;
}
const previews = new WeakMap<
  PortfolioWatchlistPreview,
  {
    readonly context: PortfolioWatchlistContext;
    readonly candidate: MainWatchlistPayload;
  }
>();
const stale =
  "Prepare a new review because Portfolio, Watchlist or the session changed.";

function capture(workspace: ManagedWorkspace): PortfolioWatchlistContext {
  return {
    workspace,
    view: workspace.getSnapshot(),
    session: workspace.sessionOwner.getSnapshot(),
    portfolio: workspace.portfolio.getSnapshot(),
    ledger: workspace.portfolio.coordinator.getSnapshot(),
    watchlist: workspace.coordinator.getSnapshot(),
    routeCurrent: workspace.capturePortfolioWatchlistRoute(),
  };
}
function unchanged(
  workspace: ManagedWorkspace,
  context: PortfolioWatchlistContext,
) {
  return (
    workspace === context.workspace &&
    workspace.getSnapshot() === context.view &&
    workspace.sessionOwner.getSnapshot() === context.session &&
    workspace.portfolio.getSnapshot() === context.portfolio &&
    workspace.portfolio.coordinator.getSnapshot() === context.ledger &&
    workspace.coordinator.getSnapshot() === context.watchlist &&
    context.routeCurrent?.() === true
  );
}
function fresh(state: SaveState<unknown>) {
  return (
    state.phase === "idle" &&
    !state.conflict &&
    !state.uncertain &&
    !state.replayPending &&
    state.latestLoaded &&
    state.draft !== null &&
    state.saved !== null &&
    state.baseVersion !== null &&
    state.baseVersion === state.saved.version
  );
}
function issue(context: PortfolioWatchlistContext): string | null {
  const { workspace, view, portfolio, ledger, watchlist, session } = context;
  if (session.phase !== "active" || !context.routeCurrent?.())
    return "Return to Portfolio in an active session before reviewing a holding.";
  if (
    view.view !== "portfolio" ||
    view.research ||
    view.companyRoute ||
    view.read ||
    view.review ||
    view.reviewing ||
    !workspace.canNavigate()
  )
    return "Finish the current operation and return to Portfolio.";
  if (portfolio.pendingEditor || portfolio.reviewing || portfolio.review)
    return "Apply or reset the Portfolio form and finish its identity review first.";
  if (!fresh(ledger))
    return "Load the latest Portfolio and resolve any pending save or conflict first.";
  if (!fresh(watchlist) || !workspace.canEdit())
    return "Open My Watchlist, load its latest version and resolve any pending save or conflict first.";
  const digest = view.snapshot?.snapshotSha256;
  if (
    !digest ||
    portfolio.catalogSnapshotSha256 !== digest ||
    ledger.draft?.ledger?.snapshotSha256 !== digest ||
    watchlist.draft?.snapshotSha256 !== digest ||
    workspace.watchlistFileCatalogReviewRequired()
  )
    return "Review Portfolio and Watchlist against the current catalog first.";
  if (!workspace.portfolio.canSavePayload())
    return "Review and apply Portfolio identities against the current catalog, and correct its ledger before adding a holding.";
  return null;
}
function holding(context: PortfolioWatchlistContext, listingId: string) {
  const projection = context.workspace.portfolio.getProjection();
  if (projection?.status !== "valid") return null;
  return (
    projection.portfolio.holdings.find(
      (entry) =>
        entry.identity.listingId === listingId && Number(entry.shares) > 0,
    ) ?? null
  );
}
function candidateFor(
  context: PortfolioWatchlistContext,
  listing: ManagedEodIdentity,
): {
  candidate: MainWatchlistPayload | null;
  status: "add" | "existing";
  reason: string;
} {
  const draft = context.watchlist.draft!;
  const existing = draft.memberships.find(
    (member) => member.listingId === listing.listingId,
  );
  if (existing && !membershipMatchesResult(existing, listing))
    return {
      candidate: null,
      status: "existing",
      reason: "Review this listing's changed identity in My Watchlist first.",
    };
  const candidate = existing
    ? draft
    : {
        ...draft,
        memberships: [...draft.memberships, { ...listing, note: "" }],
      };
  if (
    !isMainWatchlistPayload(candidate) ||
    new TextEncoder().encode(encodeMainWatchlistPayload(candidate)).byteLength >
      MANAGED_WATCHLIST_LIMITS.payloadBytes
  )
    return {
      candidate: null,
      status: existing ? "existing" : "add",
      reason:
        "Correct invalid Watchlist entries or shorten the complete draft before adding this holding.",
    };
  return { candidate, status: existing ? "existing" : "add", reason: "" };
}

/** Review one positive authored holding and the whole current Watchlist draft. No reads or saves. */
export function preparePortfolioWatchlist(
  workspace: ManagedWorkspace,
  listingId: string,
): { preview: PortfolioWatchlistPreview | null; reason: string } {
  const context = capture(workspace);
  const reason = issue(context);
  if (reason) return { preview: null, reason };
  const current = holding(context, listingId);
  if (!current)
    return {
      preview: null,
      reason:
        "Choose a current positive Portfolio holding before reviewing it.",
    };
  const reviewed = candidateFor(context, current.identity);
  if (!reviewed.candidate) return { preview: null, reason: reviewed.reason };
  if (!unchanged(workspace, context)) return { preview: null, reason: stale };
  const preview = Object.freeze({
    listing: Object.freeze({ ...current.identity }),
    status: reviewed.status,
    shares: current.shares,
    confirmedOn: current.confirmedOn,
  });
  previews.set(preview, { context, candidate: reviewed.candidate });
  return { preview, reason: "" };
}
export function isPortfolioWatchlistCurrent(
  workspace: ManagedWorkspace,
  preview: PortfolioWatchlistPreview,
): boolean {
  const prepared = previews.get(preview);
  if (!prepared || !unchanged(workspace, prepared.context)) return false;
  if (issue(prepared.context)) return false;
  const current = holding(prepared.context, preview.listing.listingId);
  return (
    !!current &&
    membershipMatchesResult(
      { ...current.identity, note: "" },
      preview.listing,
    ) &&
    current.shares === preview.shares &&
    current.confirmedOn === preview.confirmedOn &&
    unchanged(workspace, prepared.context)
  );
}

/** Consume before notifying subscribers. My Watchlist Save remains an explicit separate action. */
export function applyPortfolioWatchlist(
  workspace: ManagedWorkspace,
  preview: PortfolioWatchlistPreview,
): { added: boolean; message: string } {
  if (!isPortfolioWatchlistCurrent(workspace, preview))
    return { added: false, message: stale };
  const prepared = previews.get(preview)!;
  previews.delete(preview);
  if (preview.status === "existing")
    return {
      added: false,
      message:
        "This exact listing is already in the Watchlist draft. Its note and position are unchanged.",
    };
  workspace.coordinator.replaceDraft(prepared.candidate);
  return {
    added: true,
    message:
      "Holding added to the Watchlist draft. Review and Save My Watchlist when ready.",
  };
}
