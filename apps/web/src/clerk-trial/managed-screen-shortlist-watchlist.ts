import {
  membershipMatchesResult,
  type MainWatchlistPayload,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import type { ManagedFinancialScreenState } from "./managed-financial-screen";
import type { ManagedSessionState } from "./managed-session-owner";
import type {
  ManagedDiscoveryState,
  ManagedWorkspace,
} from "./managed-workspace";
import type { SaveState } from "./save-coordinator";

export interface ScreenShortlistWatchlistPreview {
  readonly rows: readonly {
    readonly listing: ManagedEodIdentity;
    readonly status: "add" | "existing";
  }[];
  readonly additions: number;
  readonly runStartedAt: string;
  readonly runCompletedAt: string | null;
}
interface Capture {
  readonly workspace: ManagedWorkspace;
  readonly view: ManagedDiscoveryState;
  readonly screen: ManagedFinancialScreenState;
  readonly saved: SaveState<MainWatchlistPayload>;
  readonly session: Readonly<ManagedSessionState>;
}
const previews = new WeakMap<ScreenShortlistWatchlistPreview, Capture>();
const stale =
  "Prepare a new review because the screen, Watchlist or session changed.";

function capture(workspace: ManagedWorkspace): Capture {
  return {
    workspace,
    view: workspace.getSnapshot(),
    screen: workspace.financialScreen.getSnapshot(),
    saved: workspace.coordinator.getSnapshot(),
    session: workspace.sessionOwner.getSnapshot(),
  };
}
function routeIssue({ workspace, view, session }: Capture): string | null {
  if (session.phase !== "active")
    return "Start an active session before reviewing the shortlist.";
  if (view.view !== "discover")
    return "Return to the financial screen before reviewing the shortlist.";
  if (view.research || view.companyRoute)
    return "Close company research before reviewing the shortlist.";
  if (!workspace.canNavigate())
    return "Finish the current editor before reviewing the shortlist.";
  if (view.read || view.review || view.reviewing)
    return "Finish the catalog operation before reviewing the shortlist.";
  return null;
}
function saveIssue({ workspace, saved }: Capture): string | null {
  if (!workspace.canEdit())
    return "Resolve the current Watchlist operation before reviewing the shortlist.";
  if (saved.phase !== "idle")
    return "Wait for the Watchlist operation to finish.";
  if (saved.uncertain || saved.replayPending)
    return "Reconcile the pending Watchlist save before reviewing the shortlist.";
  if (!saved.latestLoaded)
    return "Load the latest Watchlist before reviewing the shortlist.";
  if (!saved.saved || saved.baseVersion !== saved.saved.version)
    return "Load the latest Watchlist before reviewing the shortlist.";
  if (!saved.draft) return "Load My Watchlist before reviewing the shortlist.";
  return null;
}
function catalogIssue({
  workspace,
  view,
  screen,
  saved,
}: Capture): string | null {
  if (!view.snapshot)
    return "Refresh the catalog before reviewing the shortlist.";
  if (workspace.watchlistFileCatalogReviewRequired())
    return "Review the imported Watchlist catalog before adding the shortlist.";
  const digest = view.snapshot.snapshotSha256;
  if (saved.draft?.snapshotSha256 !== digest)
    return "Review catalog changes in My Watchlist before adding the shortlist.";
  if (screen.catalogSnapshotSha256 !== digest)
    return "Refresh the financial screen against the current catalog.";
  return null;
}
function reportIssue({ workspace, screen }: Capture): string | null {
  if (!screen.run || screen.shortlist.length === 0)
    return "Shortlist at least one screened company first.";
  for (const row of screen.shortlist) {
    const response = row.report?.response;
    if (!response)
      return "Run the screen again before reviewing the shortlist.";
    if (
      !workspace.financialScreen.canAdmitReport({
        run: screen.run,
        row,
        response,
      })
    )
      return "Run the screen again with the current criteria and catalog before reviewing the shortlist.";
  }
  return null;
}
function eligibilityIssue(context: Capture): string | null {
  return (
    routeIssue(context) ??
    saveIssue(context) ??
    catalogIssue(context) ??
    reportIssue(context)
  );
}
function reviewRows({ screen, saved }: Capture) {
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
    if (existing && !membershipMatchesResult(existing, listing)) return null;
    rows.push(
      Object.freeze({
        listing: Object.freeze({ ...listing }),
        status: existing ? "existing" : "add",
      }),
    );
  }
  return Object.freeze(rows);
}

/** Review existing admitted reports and the current local draft without reading or saving. */
export function prepareScreenShortlistWatchlist(workspace: ManagedWorkspace): {
  preview: ScreenShortlistWatchlistPreview | null;
  reason: string;
} {
  const context = capture(workspace);
  const issue = eligibilityIssue(context);
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
function sameCapture(workspace: ManagedWorkspace, context: Capture): boolean {
  if (workspace !== context.workspace) return false;
  if (workspace.getSnapshot() !== context.view) return false;
  if (workspace.financialScreen.getSnapshot() !== context.screen) return false;
  if (workspace.coordinator.getSnapshot() !== context.saved) return false;
  return workspace.sessionOwner.getSnapshot() === context.session;
}
export function isScreenShortlistWatchlistCurrent(
  workspace: ManagedWorkspace,
  preview: ScreenShortlistWatchlistPreview,
): boolean {
  const context = previews.get(preview);
  if (!context) return false;
  if (!sameCapture(workspace, context)) return false;
  return eligibilityIssue(context) === null;
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
