import {
  membershipMatchesResult,
  type ManagedEodIdentity,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import {
  captureScreenShortlistContext,
  screenShortlistContextIssue,
  isScreenShortlistContextCurrent,
  type ScreenShortlistContext,
} from "./managed-screen-shortlist-context";

export interface ScreenShortlistWatchlistPreview {
  readonly rows: readonly {
    readonly listing: ManagedEodIdentity;
    readonly status: "add" | "existing";
  }[];
  readonly additions: number;
  readonly runStartedAt: string;
  readonly runCompletedAt: string | null;
}
const previews = new WeakMap<
  ScreenShortlistWatchlistPreview,
  ScreenShortlistContext
>();
const stale =
  "Prepare a new review because the screen, Watchlist or session changed.";

function reviewListing(
  listing: ManagedEodIdentity,
  existing: WatchlistMembership | undefined,
): ScreenShortlistWatchlistPreview["rows"][number] | null {
  if (existing && !membershipMatchesResult(existing, listing)) return null;
  return Object.freeze({
    listing: Object.freeze({ ...listing }),
    status: existing ? "existing" : "add",
  });
}
function reviewRows({ screen, saved }: ScreenShortlistContext) {
  const members = new Map(
    saved.draft!.memberships.map((member) => [member.listingId, member]),
  );
  if (members.size !== saved.draft!.memberships.length) return null;
  const rows: ScreenShortlistWatchlistPreview["rows"][number][] = [];
  const seen = new Set<string>();
  for (const row of screen.shortlist) {
    const listing = row.member.listing;
    if (seen.has(listing.listingId)) return null;
    seen.add(listing.listingId);
    const existing = members.get(listing.listingId);
    const reviewed = reviewListing(listing, existing);
    if (!reviewed) return null;
    rows.push(reviewed);
  }
  return Object.freeze(rows);
}

/** Review existing admitted reports and the current local draft without reading or saving. */
export function prepareScreenShortlistWatchlist(workspace: ManagedWorkspace): {
  preview: ScreenShortlistWatchlistPreview | null;
  reason: string;
} {
  const context = captureScreenShortlistContext(workspace);
  const issue = screenShortlistContextIssue(context);
  if (issue) return { preview: null, reason: issue };
  const rows = reviewRows(context);
  if (!rows)
    return {
      preview: null,
      reason:
        "Review changed or duplicate listing identities in My Watchlist before adding the shortlist.",
    };
  const additions = rows.filter((row) => row.status === "add").length;
  if (context.saved.draft!.memberships.length + additions > 10_000)
    return {
      preview: null,
      reason:
        "The complete shortlist would exceed the 10,000-entry Watchlist limit. Remove entries before reviewing it again.",
    };
  const preview = Object.freeze({
    rows,
    additions,
    runStartedAt: context.screen.run!.startedAt,
    runCompletedAt: context.screen.run!.completedAt,
  });
  previews.set(preview, context);
  return { preview, reason: "" };
}
export function isScreenShortlistWatchlistCurrent(
  workspace: ManagedWorkspace,
  preview: ScreenShortlistWatchlistPreview,
): boolean {
  const context = previews.get(preview);
  if (!context) return false;
  if (!isScreenShortlistContextCurrent(workspace, context)) return false;
  return screenShortlistContextIssue(context) === null;
}

/** Consume the review before notifying draft subscribers. Explicit Save remains separate. */
export function applyScreenShortlistWatchlist(
  workspace: ManagedWorkspace,
  preview: ScreenShortlistWatchlistPreview,
): { added: boolean; message: string } {
  if (!isScreenShortlistWatchlistCurrent(workspace, preview))
    return { added: false, message: stale };
  const context = previews.get(preview)!;
  previews.delete(preview);
  if (preview.additions === 0)
    return {
      added: false,
      message: "Every shortlisted listing is already in the Watchlist draft.",
    };
  const draft = context.saved.draft!;
  const additions = preview.rows
    .filter((row) => row.status === "add")
    .map((row) => ({ ...row.listing, note: "" }));
  workspace.coordinator.replaceDraft({
    ...draft,
    memberships: [...draft.memberships, ...additions],
  });
  return {
    added: true,
    message:
      "Shortlisted listings added to the Watchlist draft. Review and Save My Watchlist when ready.",
  };
}
