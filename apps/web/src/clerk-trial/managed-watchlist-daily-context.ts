import type {
  ManagedWorkspace,
  ManagedResearchVisit,
  ManagedDiscoveryState,
} from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedFilingsReviewState } from "./managed-filings-review";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import { companyFollowupsReadout } from "./managed-company-research-checks";

type WatchlistSaved = ReturnType<
  ManagedWorkspace["coordinator"]["getSnapshot"]
>;
type FollowupsSaved = ReturnType<
  ManagedWorkspace["followups"]["coordinator"]["getSnapshot"]
>;
interface Owner {
  readonly chosen: ManagedFilingsReviewState["chosen"];
  readonly saved: WatchlistSaved["saved"];
  readonly baseVersion: number | null;
  readonly watchlistActivity: object;
  readonly followupsActivity: object;
  followupsSaved: FollowupsSaved["saved"];
  visit: ManagedResearchVisit | null;
  opening: { readonly selection: ManagedResearchSelection } | null;
}

function resolvedResource(state: WatchlistSaved | FollowupsSaved) {
  return !state.conflict && !state.uncertain && !state.replayPending;
}
function followupsBelongToOwner(owner: Owner, checks: FollowupsSaved) {
  const initialLoad =
    checks.phase === "loading" && owner.followupsSaved === null;
  if (checks.phase !== "idle" && !initialLoad) return false;
  if (!resolvedResource(checks)) return false;
  return owner.followupsSaved === null || checks.saved === owner.followupsSaved;
}
function ownedNavigation(owner: Owner, route: ManagedDiscoveryState) {
  const company = route.companyRoute;
  if (company) {
    if (!owner.visit || route.research !== owner.visit) return false;
    if (company.status !== "open") return false;
    if (company.listingId !== owner.visit.selection.listing.listingId)
      return false;
  }
  if (!route.research) return true;
  if (!owner.opening) return route.research === owner.visit;
  return companyEvidenceSelectionMatches(
    owner.opening.selection,
    route.research.selection,
  );
}
function canLoadInitialChecks(saved: FollowupsSaved) {
  return (
    saved.phase === "idle" &&
    saved.saved === null &&
    saved.draft === null &&
    !saved.dirty &&
    resolvedResource(saved)
  );
}

/** Resource and navigation lifetime for the existing group's daily mode. */
export class ManagedWatchlistDailyContext {
  private owner: Owner | null = null;
  constructor(private readonly workspace: ManagedWorkspace) {
    workspace.filingsReview.subscribe(() => this.reconcile());
    workspace.coordinator.subscribe(() => this.reconcile());
    workspace.followups.coordinator.subscribe(() => this.reconcile());
    workspace.followups.subscribe(() => this.reconcile());
  }
  private ready() {
    const w = this.workspace;
    const saved = w.coordinator.getSnapshot();
    return (
      w.getSnapshot().view === "watchlist" &&
      w.sessionOwner.getSnapshot().phase === "active" &&
      saved.latestLoaded &&
      saved.draft !== null &&
      saved.phase === "idle" &&
      resolvedResource(saved) &&
      !w.hasWatchlistDraftFileActivity() &&
      !w.followups.hasDraftFileActivity()
    );
  }
  private discard() {
    this.owner = null;
    this.workspace.filingsReview.leave();
  }
  reconcile() {
    const w = this.workspace,
      group = w.filingsReview.getSnapshot();
    if (!group.daily) {
      this.owner = null;
      return;
    }
    if (!this.ready()) {
      this.discard();
      return;
    }
    const saved = w.coordinator.getSnapshot(),
      checks = w.followups.coordinator.getSnapshot();
    const route = w.getSnapshot();
    if (!this.owner || this.owner.chosen !== group.chosen) {
      if (route.research || route.companyRoute) {
        this.discard();
        return;
      }
      this.owner = {
        chosen: group.chosen,
        saved: saved.saved,
        baseVersion: saved.baseVersion,
        watchlistActivity: w.getWatchlistDraftFileActivityRevision(),
        followupsActivity: w.followups.getDraftFileActivityRevision(),
        followupsSaved: checks.saved,
        visit: null,
        opening: null,
      };
    }
    const owner = this.owner;
    if (
      !this.resourcesBelongToOwner(owner, saved, checks) ||
      !ownedNavigation(owner, route)
    ) {
      this.discard();
      return;
    }
    if (
      checks.phase === "idle" &&
      owner.followupsSaved === null &&
      checks.saved !== null
    )
      owner.followupsSaved = checks.saved;
    if (!route.research && !owner.opening) owner.visit = null;
  }
  private resourcesBelongToOwner(
    owner: Owner,
    saved: WatchlistSaved,
    checks: FollowupsSaved,
  ) {
    const w = this.workspace;
    return (
      saved.saved === owner.saved &&
      saved.baseVersion === owner.baseVersion &&
      w.getWatchlistDraftFileActivityRevision() === owner.watchlistActivity &&
      w.followups.getDraftFileActivityRevision() === owner.followupsActivity &&
      followupsBelongToOwner(owner, checks)
    );
  }
  switchVisit(previous: ManagedResearchVisit, next: ManagedResearchVisit) {
    const owner = this.owner;
    if (owner?.visit === previous && next.selection === previous.selection)
      owner.visit = next;
  }
  beginVisit(selection: ManagedResearchSelection) {
    this.reconcile();
    const owner = this.owner;
    if (!owner || owner.opening || this.workspace.getSnapshot().research)
      return null;
    const opening = Object.freeze({ selection });
    owner.opening = opening;
    return opening;
  }
  finishVisit(opening: object, visit: ManagedResearchVisit | undefined) {
    const owner = this.owner;
    if (!owner || owner.opening !== opening) return;
    owner.opening = null;
    if (!visit || this.workspace.getSnapshot().research !== visit) {
      this.discard();
      return;
    }
    owner.visit = visit;
    this.reconcile();
  }
  captureChecks() {
    const w = this.workspace,
      owner = this.owner;
    const group = w.filingsReview.getSnapshot();
    if (!owner || !group.daily) return null;
    const saved = w.followups.coordinator.getSnapshot();
    const current = () =>
      this.owner === owner &&
      this.ready() &&
      w.filingsReview.getSnapshot() === group &&
      group.active &&
      !w.getSnapshot().research &&
      !w.getSnapshot().companyRoute &&
      !w.getResearchDraftSetRoute().blocked;
    const canLoad =
      current() &&
      group.daily.phase !== "finished" &&
      canLoadInitialChecks(saved);
    let consumed = false;
    return {
      rows: group.rows.map((row) => ({
        member: row.member,
        check: row.filings.selection
          ? companyFollowupsReadout(w, row.filings.selection)
          : null,
      })),
      canLoad,
      load: async () => {
        if (
          consumed ||
          !canLoad ||
          !current() ||
          w.followups.coordinator.getSnapshot() !== saved
        )
          return;
        consumed = true;
        await w.followups.coordinator.load();
      },
    };
  }
}
