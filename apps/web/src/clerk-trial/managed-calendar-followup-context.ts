import type { WatchlistMembership } from "@research-cockpit/contracts";
import {
  calendarFollowupEvidence,
  resolveCalendarFollowupSource,
  type CalendarFollowupPort,
  type CalendarFollowupSource,
  type CalendarSourceCapture,
} from "./managed-calendar-followup";
import type { ManagedWorkspace } from "./managed-workspace";

interface Host {
  readonly workspace: ManagedWorkspace;
  readonly available: () => boolean;
  readonly memberReady: (member: WatchlistMembership) => boolean;
  readonly revision: () => {
    readonly navigation: number;
    readonly view: number;
    readonly catalog: ReturnType<ManagedWorkspace["getSnapshot"]>["snapshot"];
  };
}
interface SourceOwner {
  readonly source: CalendarFollowupSource;
  readonly sources: ReturnType<
    ManagedMarketsCalendarFollowupContext["sources"]
  >;
  readonly pass: ReturnType<
    ManagedWorkspace["marketsSourceReview"]["getSnapshot"]
  >;
  readonly revision: ReturnType<Host["revision"]>;
  readonly epoch: object;
  readonly evidence: string;
  readonly selectionIsCurrent: () => boolean;
}
const sourceStale =
  "Choose an item from the current, settled Markets day view again.";
const memberStale =
  "Choose an exact company from the editable current My Watchlist draft.";

/** A source choice outlives its explicit initial Follow-ups read, never a retired visit. */
export class ManagedMarketsCalendarFollowupContext {
  private epoch: object = {};
  private retired = false;
  private readonly owners = new WeakMap<CalendarSourceCapture, SourceOwner>();
  private readonly unsubscribers: (() => void)[];

  constructor(private readonly host: Host) {
    this.unsubscribers = [
      host.workspace.subscribe(() => {
        if (!host.available()) this.epoch = {};
      }),
      host.workspace.sessionOwner.subscribe(() => {
        if (host.workspace.sessionOwner.getSnapshot().phase !== "active")
          this.epoch = {};
      }),
    ];
  }
  sources() {
    const workspace = this.host.workspace;
    return {
      bls: workspace.blsCalendar.getSnapshot(),
      bea: workspace.agenda.getSnapshot(),
      fed: workspace.announcements.getSnapshot(),
    };
  }
  private available() {
    const state = this.sources();
    return (
      !this.retired &&
      this.host.available() &&
      !state.bls.busy &&
      !state.bea.busy &&
      !state.fed.busy &&
      this.host.workspace.marketsSourceReview.getSnapshot().phase !== "running"
    );
  }
  private sameRevision(owner: SourceOwner) {
    const revision = this.host.revision();
    return (
      revision.navigation === owner.revision.navigation &&
      revision.view === owner.revision.view &&
      revision.catalog === owner.revision.catalog
    );
  }
  private sameSources(owner: SourceOwner) {
    const state = this.sources();
    return (
      state.bls === owner.sources.bls &&
      state.bea === owner.sources.bea &&
      state.fed === owner.sources.fed &&
      this.host.workspace.marketsSourceReview.getSnapshot() === owner.pass
    );
  }
  private sourceCurrent(owner: SourceOwner) {
    return (
      owner.epoch === this.epoch &&
      this.available() &&
      this.sameRevision(owner) &&
      this.sameSources(owner) &&
      JSON.stringify(calendarFollowupEvidence(owner.source)) ===
        owner.evidence &&
      owner.selectionIsCurrent()
    );
  }
  capture(key: string, selectionIsCurrent: () => boolean) {
    if (!this.available() || !selectionIsCurrent())
      return { capture: null, reason: sourceStale };
    const sources = this.sources();
    const source = resolveCalendarFollowupSource(key, sources);
    const evidence = source && calendarFollowupEvidence(source);
    if (!source || !evidence) return { capture: null, reason: sourceStale };
    const owner: SourceOwner = {
      source,
      sources,
      pass: this.host.workspace.marketsSourceReview.getSnapshot(),
      revision: this.host.revision(),
      epoch: this.epoch,
      evidence: JSON.stringify(evidence),
      selectionIsCurrent,
    };
    if (!this.sourceCurrent(owner))
      return { capture: null, reason: sourceStale };
    let retired = false;
    const capture: CalendarSourceCapture = Object.freeze({
      source,
      isCurrent: () => {
        retired ||= !this.sourceCurrent(owner);
        return !retired;
      },
    });
    this.owners.set(capture, owner);
    return { capture, reason: null };
  }
  private current(capture: CalendarSourceCapture) {
    const owner = this.owners.get(capture);
    return (
      owner !== undefined &&
      owner.source === capture.source &&
      capture.isCurrent() &&
      this.sourceCurrent(owner)
    );
  }
  private memberReady(
    capture: CalendarSourceCapture,
    member: WatchlistMembership,
  ) {
    return this.current(capture) && this.host.memberReady(member);
  }
  capturePort(capture: CalendarSourceCapture, member: WatchlistMembership) {
    if (!this.memberReady(capture, member))
      return { port: null, reason: memberStale };
    const workspace = this.host.workspace;
    const watchlist = workspace.coordinator.getSnapshot();
    const saved = workspace.followups.coordinator.getSnapshot();
    const model = workspace.followups.getSnapshot();
    const activity = workspace.followups.getDraftFileActivityRevision();
    let retired = false;
    const port: CalendarFollowupPort = Object.freeze({
      model: workspace.followups,
      member,
      source: capture.source,
      isCurrent: () => {
        retired ||=
          !this.memberReady(capture, member) ||
          workspace.coordinator.getSnapshot() !== watchlist ||
          workspace.followups.coordinator.getSnapshot() !== saved ||
          workspace.followups.getSnapshot() !== model ||
          workspace.followups.getDraftFileActivityRevision() !== activity ||
          workspace.followups.hasDraftFileActivity();
        return !retired;
      },
    });
    return { port, reason: null };
  }
  canLoad(capture: CalendarSourceCapture, member: WatchlistMembership) {
    const followups = this.host.workspace.followups;
    return (
      this.memberReady(capture, member) &&
      !followups.hasDraftFileActivity() &&
      followups.canLoadForNextCheck(member)
    );
  }
  async load(
    capture: CalendarSourceCapture,
    member: WatchlistMembership,
    formIsCurrent: () => boolean,
  ) {
    if (!this.canLoad(capture, member) || !formIsCurrent()) return;
    const workspace = this.host.workspace;
    const watchlist = workspace.coordinator.getSnapshot();
    const activity = workspace.followups.getDraftFileActivityRevision();
    await workspace.followups.loadForNextCheck(
      member,
      () =>
        this.memberReady(capture, member) &&
        formIsCurrent() &&
        workspace.coordinator.getSnapshot() === watchlist &&
        workspace.followups.getDraftFileActivityRevision() === activity &&
        !workspace.followups.hasDraftFileActivity(),
    );
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.epoch = {};
    for (const unsubscribe of this.unsubscribers) unsubscribe();
  }
}
