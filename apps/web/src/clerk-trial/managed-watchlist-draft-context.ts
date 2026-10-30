import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
} from "@research-cockpit/contracts";
import type { ManagedDiscoveryState } from "./managed-workspace";
import type { SaveState, VersionedPayload } from "./save-coordinator";

export interface WatchlistDraftFileContext {
  readonly saved: VersionedPayload<MainWatchlistPayload>;
  readonly draft: MainWatchlistPayload;
  readonly baseVersion: number;
  readonly catalog: ManagedCatalogSnapshotDto | null;
}
type SavedDraftContext = Omit<WatchlistDraftFileContext, "catalog">;
type WatchlistSaveState = SaveState<MainWatchlistPayload>;

function watchlistRouteIsIdle(view: ManagedDiscoveryState) {
  return view.view === "watchlist" && !view.research && !view.companyRoute;
}
function catalogReadIsIdle(view: ManagedDiscoveryState) {
  return !view.read && !view.review && !view.reviewing;
}
function watchlistRecoveryIsClear(state: WatchlistSaveState) {
  return !state.conflict && !state.uncertain && !state.replayPending;
}
function savedDraftContext(
  state: WatchlistSaveState,
): SavedDraftContext | null {
  if (state.phase !== "idle") return null;
  if (state.saved === null) return null;
  if (state.draft === null) return null;
  if (state.baseVersion === null) return null;
  return {
    saved: state.saved,
    draft: state.draft,
    baseVersion: state.baseVersion,
  };
}
function savedDraftIsFresh(
  state: WatchlistSaveState,
  context: SavedDraftContext,
) {
  return state.latestLoaded && context.baseVersion === context.saved.version;
}

/** Capture actual settled references; file metadata never supplies this context. */
export function captureWatchlistDraftFileContext(
  state: WatchlistSaveState,
  view: ManagedDiscoveryState,
  requireFresh: boolean,
): WatchlistDraftFileContext | null {
  if (!watchlistRouteIsIdle(view)) return null;
  return captureWatchlistResourceDraftContext(state, view, requireFresh);
}

export function captureWatchlistResourceDraftContext(
  state: WatchlistSaveState,
  view: ManagedDiscoveryState,
  requireFresh: boolean,
): WatchlistDraftFileContext | null {
  if (!catalogReadIsIdle(view)) return null;
  if (!watchlistRecoveryIsClear(state)) return null;
  const context = savedDraftContext(state);
  if (!context) return null;
  if (requireFresh) {
    if (!savedDraftIsFresh(state, context)) return null;
  }
  return { ...context, catalog: view.snapshot };
}
