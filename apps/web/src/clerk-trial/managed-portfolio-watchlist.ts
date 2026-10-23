import {
  encodeMainWatchlistPayload,
  isMainWatchlistPayload,
  MANAGED_WATCHLIST_LIMITS,
  membershipMatchesResult,
  type MainWatchlistPayload,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import {
  capturePortfolioWatchlistContext,
  isPortfolioWatchlistContextCurrent,
  portfolioWatchlistContextIssue,
  type PortfolioWatchlistContext,
} from "./managed-portfolio-watchlist-context";

export interface PortfolioWatchlistPreview {
  readonly listing: ManagedEodIdentity;
  readonly status: "add" | "existing";
  readonly shares: string;
  readonly confirmedOn: string;
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
  if (existing) {
    if (!membershipMatchesResult(existing, listing))
      return {
        candidate: null,
        status: "existing",
        reason: "Review this listing's changed identity in My Watchlist first.",
      };
    return admitCandidate(draft, "existing");
  }
  return admitCandidate(
    {
      ...draft,
      memberships: [...draft.memberships, { ...listing, note: "" }],
    },
    "add",
  );
}
function completeCandidate(candidate: MainWatchlistPayload) {
  if (!isMainWatchlistPayload(candidate)) return false;
  const bytes = new TextEncoder().encode(
    encodeMainWatchlistPayload(candidate),
  ).byteLength;
  return bytes <= MANAGED_WATCHLIST_LIMITS.payloadBytes;
}
function admitCandidate(
  candidate: MainWatchlistPayload,
  status: PortfolioWatchlistPreview["status"],
) {
  if (!completeCandidate(candidate))
    return {
      candidate: null,
      status,
      reason:
        "Correct invalid Watchlist entries or shorten the complete draft before adding this holding.",
    };
  return { candidate, status, reason: "" };
}

/** Review one positive authored holding and the whole current Watchlist draft. No reads or saves. */
export function preparePortfolioWatchlist(
  workspace: ManagedWorkspace,
  listingId: string,
): { preview: PortfolioWatchlistPreview | null; reason: string } {
  const context = capturePortfolioWatchlistContext(workspace);
  const reason = portfolioWatchlistContextIssue(context);
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
  if (!isPortfolioWatchlistContextCurrent(workspace, context))
    return { preview: null, reason: stale };
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
  if (!prepared) return false;
  if (!isPortfolioWatchlistContextCurrent(workspace, prepared.context))
    return false;
  if (portfolioWatchlistContextIssue(prepared.context)) return false;
  const current = holding(prepared.context, preview.listing.listingId);
  if (!previewMatchesHolding(current, preview)) return false;
  return isPortfolioWatchlistContextCurrent(workspace, prepared.context);
}
function previewMatchesHolding(
  current: ReturnType<typeof holding>,
  preview: PortfolioWatchlistPreview,
) {
  if (!current) return false;
  if (
    !membershipMatchesResult({ ...current.identity, note: "" }, preview.listing)
  )
    return false;
  if (current.shares !== preview.shares) return false;
  return current.confirmedOn === preview.confirmedOn;
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
