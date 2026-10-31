import type { WatchlistMembership } from "@research-cockpit/contracts";
import {
  calendarFollowupEvidence,
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
  readonly sources: ReturnType<ManagedCpiHeadlineFollowupContext["sources"]>;
  readonly pass: ReturnType<
    ManagedWorkspace["marketsSourceReview"]["getSnapshot"]
  >;
  readonly revision: ReturnType<Host["revision"]>;
  readonly epoch: object;
  readonly evidence: string;
  readonly selectionIsCurrent: () => boolean;
}
interface DraftOwner {
  readonly watchlist: ReturnType<
    ManagedWorkspace["coordinator"]["getSnapshot"]
  >;
  readonly saved: ReturnType<
    ManagedWorkspace["followups"]["coordinator"]["getSnapshot"]
  >;
  readonly model: ReturnType<ManagedWorkspace["followups"]["getSnapshot"]>;
  readonly activity: object;
}
const sourceStale =
  "Choose an item from the current, settled Published CPI headlines again.";
const memberStale =
  "Choose an exact company from the editable current My Watchlist draft.";

/** A source choice outlives its explicit initial Follow-ups read, never a retired visit. */
export class ManagedCpiHeadlineFollowupContext {
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
    return this.host.workspace.cpiHeadlines.getSnapshot();
  }
  private available() {
    return (
      !this.retired &&
      this.host.available() &&
      !this.sources().busy &&
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
    return (
      this.sources() === owner.sources &&
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
  private sourceOwner(
    key: string,
    selectionIsCurrent: () => boolean,
  ): SourceOwner | null {
    const sources = this.sources();
    const packet = sources.headlines;
    const item = packet?.items.find((row) => row.url === key);
    const source =
      packet && item
        ? Object.freeze({
            kind: "cpi" as const,
            packet,
            item,
            showingPrevious: sources.showingPrevious,
          })
        : null;
    const evidence = source && calendarFollowupEvidence(source);
    if (!source || !evidence) return null;
    const owner: SourceOwner = {
      source,
      sources,
      pass: this.host.workspace.marketsSourceReview.getSnapshot(),
      revision: this.host.revision(),
      epoch: this.epoch,
      evidence: JSON.stringify(evidence),
      selectionIsCurrent,
    };
    return owner;
  }
  private ownedCapture(owner: SourceOwner) {
    let retired = false;
    const capture: CalendarSourceCapture = Object.freeze({
      source: owner.source,
      isCurrent: () => {
        retired ||= !this.sourceCurrent(owner);
        return !retired;
      },
    });
    this.owners.set(capture, owner);
    return { capture, reason: null };
  }
  capture(key: string, selectionIsCurrent: () => boolean) {
    if (!this.available() || !selectionIsCurrent())
      return { capture: null, reason: sourceStale };
    const owner = this.sourceOwner(key, selectionIsCurrent);
    if (!owner || !this.sourceCurrent(owner))
      return { capture: null, reason: sourceStale };
    return this.ownedCapture(owner);
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
  private captureDrafts(): DraftOwner {
    const workspace = this.host.workspace;
    return {
      watchlist: workspace.coordinator.getSnapshot(),
      saved: workspace.followups.coordinator.getSnapshot(),
      model: workspace.followups.getSnapshot(),
      activity: workspace.followups.getDraftFileActivityRevision(),
    };
  }
  private draftsCurrent(owner: DraftOwner) {
    const workspace = this.host.workspace;
    return (
      workspace.coordinator.getSnapshot() === owner.watchlist &&
      workspace.followups.coordinator.getSnapshot() === owner.saved &&
      workspace.followups.getSnapshot() === owner.model &&
      workspace.followups.getDraftFileActivityRevision() === owner.activity &&
      !workspace.followups.hasDraftFileActivity()
    );
  }
  capturePort(capture: CalendarSourceCapture, member: WatchlistMembership) {
    if (!this.memberReady(capture, member))
      return { port: null, reason: memberStale };
    const workspace = this.host.workspace;
    const drafts = this.captureDrafts();
    let retired = false;
    const port: CalendarFollowupPort = Object.freeze({
      model: workspace.followups,
      member,
      source: capture.source,
      isCurrent: () => {
        retired ||=
          !this.memberReady(capture, member) || !this.draftsCurrent(drafts);
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
