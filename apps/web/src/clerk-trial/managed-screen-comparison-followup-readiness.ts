import type { ManagedWorkspace } from "./managed-workspace";
import type { SaveState } from "./save-coordinator";
type WatchlistState = ReturnType<
  ManagedWorkspace["coordinator"]["getSnapshot"]
>;
const followupsStale =
  "Load Follow-ups here, or finish its save, file or recovery decision, before previewing this check.";
function settled(state: SaveState<unknown>) {
  if (state.phase !== "idle") return false;
  if (state.conflict || state.uncertain) return false;
  return !state.replayPending;
}
function savedVersionMatches(state: SaveState<unknown>) {
  if (!state.saved) return false;
  return state.baseVersion === state.saved.version;
}
function loaded(state: SaveState<unknown>) {
  if (!settled(state)) return false;
  if (!state.latestLoaded || !state.draft) return false;
  return savedVersionMatches(state);
}
/** Feature-specific draft, saved-version and file admission; source ownership stays in its context. */
export class ScreenComparisonFollowupReadiness {
  constructor(
    private readonly host: { readonly workspace: ManagedWorkspace },
  ) {}
  watchlistReady(state: WatchlistState, digest: string) {
    if (!loaded(state)) return false;
    if (!this.host.workspace.canEdit()) return false;
    if (this.host.workspace.watchlistFileCatalogReviewRequired()) return false;
    return state.draft?.snapshotSha256 === digest;
  }
  filesReady() {
    return !this.host.workspace.followups.hasDraftFileActivity();
  }
  private followupsFileIssue() {
    if (!this.filesReady()) return followupsStale;
    const view = this.host.workspace.followups.getSnapshot();
    return view.review || view.reviewing ? followupsStale : null;
  }
  followupsIssue(requireDraft: boolean, digest: string) {
    if (this.followupsFileIssue()) return followupsStale;
    const model = this.host.workspace.followups;
    const view = model.getSnapshot();
    const saved = model.coordinator.getSnapshot();
    if (!settled(saved)) return followupsStale;
    if (!requireDraft) return null;
    if (!loaded(saved)) return followupsStale;
    if (!model.canEdit()) return followupsStale;
    return view.catalogSnapshotSha256 === digest ? null : followupsStale;
  }
}
