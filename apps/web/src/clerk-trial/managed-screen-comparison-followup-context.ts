import {
  membershipMatchesResult,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import { ScreenComparisonFollowupReadiness } from "./managed-screen-comparison-followup-readiness";
import type { ScreenComparisonReportCapture } from "./screen-comparison-report-controller";
import type {
  ScreenComparisonFollowupCapture,
  ScreenComparisonFollowupDestination,
  ScreenComparisonFollowupPort,
  ScreenComparisonFollowupSide,
} from "./managed-screen-comparison-followup";

export interface ScreenComparisonFollowupHost {
  readonly workspace: ManagedWorkspace;
  readonly available: () => boolean;
  readonly memberReady: (member: WatchlistMembership) => boolean;
  readonly revision: () => {
    readonly navigation: number;
    readonly view: number;
    readonly catalog: ReturnType<ManagedWorkspace["getSnapshot"]>["snapshot"];
  };
}
type WatchlistState = ReturnType<
  ManagedWorkspace["coordinator"]["getSnapshot"]
>;
interface SourceOwner {
  readonly comparison: ScreenComparisonReportCapture;
  readonly revision: ReturnType<ScreenComparisonFollowupHost["revision"]>;
  readonly epoch: object;
  readonly watchlist: WatchlistState;
  readonly fileActivity: object;
  readonly selectionIsCurrent: () => boolean;
}
interface DraftOwner {
  readonly capture: ScreenComparisonFollowupCapture;
  readonly side: ScreenComparisonFollowupSide;
  readonly member: WatchlistMembership;
  readonly state: ReturnType<ManagedWorkspace["followups"]["getSnapshot"]>;
  readonly saved: ReturnType<
    ManagedWorkspace["followups"]["coordinator"]["getSnapshot"]
  >;
}
function sameRevision(a: SourceOwner["revision"], b: SourceOwner["revision"]) {
  if (a.navigation !== b.navigation) return false;
  if (a.view !== b.view) return false;
  return a.catalog === b.catalog;
}
const sourceStale =
  "Review the current settled comparison again before keeping a dated check.";
const memberStale =
  "Choose an exact compared company from the editable current My Watchlist draft.";
const followupsStale =
  "Load Follow-ups here, or finish its save, file or recovery decision, before previewing this check.";

/** Own the current model capture independently of its explicit first Follow-ups read. */
export class ManagedScreenComparisonFollowupContext {
  private epoch: object = {};
  private retired = false;
  private readonly owners = new WeakMap<
    ScreenComparisonFollowupCapture,
    SourceOwner
  >();
  private readonly unsubscribers: (() => void)[];
  private revision: SourceOwner["revision"];
  private fileActivity: object;
  private readonly readiness: ScreenComparisonFollowupReadiness;
  constructor(private readonly host: ScreenComparisonFollowupHost) {
    const w = host.workspace;
    this.readiness = new ScreenComparisonFollowupReadiness(host);
    this.revision = host.revision();
    this.fileActivity = w.followups.getDraftFileActivityRevision();
    this.unsubscribers = [
      w.subscribe(() => this.reconcileSource()),
      w.financialScreen.subscribe(() => {
        this.epoch = {};
      }),
      w.coordinator.subscribe(() => {
        this.epoch = {};
      }),
      w.followups.subscribe(() => this.reconcileSource()),
      w.sessionOwner.subscribe(() => this.reconcileSource()),
    ];
  }
  private reconcileSource() {
    const revision = this.host.revision();
    const activity =
      this.host.workspace.followups.getDraftFileActivityRevision();
    if (!sameRevision(this.revision, revision)) this.epoch = {};
    if (this.fileActivity !== activity) this.epoch = {};
    if (!this.available()) this.epoch = {};
    this.revision = revision;
    this.fileActivity = activity;
  }
  private available() {
    if (this.retired) return false;
    if (!this.host.available()) return false;
    return this.host.workspace.sessionOwner.getSnapshot().phase === "active";
  }
  private sourceContextCurrent(owner: SourceOwner) {
    if (owner.epoch !== this.epoch) return false;
    if (!this.available()) return false;
    return sameRevision(owner.revision, this.host.revision());
  }
  private sourceResourcesCurrent(owner: SourceOwner) {
    const w = this.host.workspace;
    if (w.coordinator.getSnapshot() !== owner.watchlist) return false;
    if (
      !this.readiness.watchlistReady(
        owner.watchlist,
        owner.comparison.report.catalogSnapshotSha256,
      )
    )
      return false;
    if (w.followups.getDraftFileActivityRevision() !== owner.fileActivity)
      return false;
    return this.readiness.filesReady();
  }
  private sourceCurrent(owner: SourceOwner) {
    if (!this.sourceContextCurrent(owner)) return false;
    if (!this.sourceResourcesCurrent(owner)) return false;
    if (!owner.comparison.current()) return false;
    if (!owner.selectionIsCurrent()) return false;
    if (!this.sourceContextCurrent(owner)) return false;
    return owner.comparison.current() && this.sourceResourcesCurrent(owner);
  }

  private sourceOwner(
    preparedAt: string,
    selectionIsCurrent: () => boolean,
  ): {
    owner: SourceOwner | null;
    reason: string | null;
  } {
    if (!this.available()) return { owner: null, reason: sourceStale };
    const w = this.host.workspace;
    const comparison = w.financialScreen.captureComparisonReport(preparedAt);
    if (!comparison) return { owner: null, reason: sourceStale };
    if (
      !this.readiness.watchlistReady(
        w.coordinator.getSnapshot(),
        comparison.report.catalogSnapshotSha256,
      )
    )
      return { owner: null, reason: memberStale };
    if (
      this.readiness.followupsIssue(
        false,
        comparison.report.catalogSnapshotSha256,
      )
    )
      return { owner: null, reason: followupsStale };
    const owner: SourceOwner = {
      comparison,
      revision: this.host.revision(),
      epoch: this.epoch,
      watchlist: w.coordinator.getSnapshot(),
      fileActivity: w.followups.getDraftFileActivityRevision(),
      selectionIsCurrent,
    };
    return { owner, reason: null };
  }
  private ownCapture(owner: SourceOwner): {
    capture: ScreenComparisonFollowupCapture | null;
    reason: string | null;
  } {
    let retired = false;
    const capture: ScreenComparisonFollowupCapture = Object.freeze({
      comparison: owner.comparison.report,
      isCurrent: () => {
        if (retired) return false;
        try {
          retired = !this.sourceCurrent(owner);
        } catch {
          retired = true;
        }
        return !retired;
      },
    });
    if (!capture.isCurrent()) return { capture: null, reason: sourceStale };
    this.owners.set(capture, owner);
    return { capture, reason: null };
  }
  capture(
    preparedAt: string,
    selectionIsCurrent: () => boolean,
  ): {
    capture: ScreenComparisonFollowupCapture | null;
    reason: string | null;
  } {
    const { owner, reason } = this.sourceOwner(preparedAt, selectionIsCurrent);
    if (!owner) return { capture: null, reason };
    return this.ownCapture(owner);
  }
  private owner(capture: ScreenComparisonFollowupCapture) {
    const owner = this.owners.get(capture);
    if (!owner) return null;
    if (capture.comparison !== owner.comparison.report) return null;
    return capture.isCurrent() ? owner : null;
  }
  private member(capture: ScreenComparisonFollowupCapture, side: string) {
    if (side !== "left" && side !== "right") return null;
    const owner = this.owner(capture);
    if (!owner) return null;
    const listing = owner.comparison.report[side].listing;
    const member = owner.watchlist.draft?.memberships.find(
      (row) => row.listingId === listing.listingId,
    );
    if (!member) return null;
    if (!membershipMatchesResult(member, listing)) return null;
    return this.host.memberReady(member) ? member : null;
  }
  destinations(
    capture: ScreenComparisonFollowupCapture,
  ): readonly ScreenComparisonFollowupDestination[] {
    if (!this.owner(capture)) return [];
    return Object.freeze(
      (["left", "right"] as const).map((side) => {
        const eligible = this.member(capture, side) !== null;
        return Object.freeze({
          side,
          listing: capture.comparison[side].listing,
          eligible,
          reason: eligible ? null : memberStale,
        });
      }),
    );
  }
  capturePort(
    capture: ScreenComparisonFollowupCapture,
    side: string,
  ): {
    port: ScreenComparisonFollowupPort | null;
    reason: string | null;
  } {
    const member = this.member(capture, side);
    if (!member) return { port: null, reason: memberStale };
    const issue = this.readiness.followupsIssue(
      true,
      capture.comparison.catalogSnapshotSha256,
    );
    if (issue) return { port: null, reason: issue };
    return this.ownPort(capture, side as ScreenComparisonFollowupSide, member);
  }
  private draftCurrent(owner: DraftOwner) {
    const w = this.host.workspace;
    if (this.member(owner.capture, owner.side) !== owner.member) return false;
    if (w.followups.getSnapshot() !== owner.state) return false;
    if (w.followups.coordinator.getSnapshot() !== owner.saved) return false;
    return (
      this.readiness.followupsIssue(
        true,
        owner.capture.comparison.catalogSnapshotSha256,
      ) === null
    );
  }
  private ownPort(
    capture: ScreenComparisonFollowupCapture,
    side: ScreenComparisonFollowupSide,
    member: WatchlistMembership,
  ) {
    const w = this.host.workspace;
    const owner: DraftOwner = {
      capture,
      side,
      member,
      state: w.followups.getSnapshot(),
      saved: w.followups.coordinator.getSnapshot(),
    };
    let retired = false;
    const port: ScreenComparisonFollowupPort = Object.freeze({
      model: w.followups,
      member,
      comparison: capture.comparison,
      side,
      isCurrent: () => {
        if (retired) return false;
        retired = !this.draftCurrent(owner);
        return !retired;
      },
    });
    return { port, reason: null };
  }
  canLoad(capture: ScreenComparisonFollowupCapture, side: string) {
    const member = this.member(capture, side);
    if (!member) return false;
    if (
      this.readiness.followupsIssue(
        false,
        capture.comparison.catalogSnapshotSha256,
      )
    )
      return false;
    return this.host.workspace.followups.canLoadForNextCheck(member);
  }
  async load(
    capture: ScreenComparisonFollowupCapture,
    side: string,
    formIsCurrent: () => boolean,
  ) {
    if (!this.canLoad(capture, side)) return;
    if (!formIsCurrent()) return;
    const member = this.member(capture, side);
    if (!member) return;
    await this.host.workspace.followups.loadForNextCheck(member, () => {
      if (!formIsCurrent()) return false;
      return this.member(capture, side) === member;
    });
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.epoch = {};
    for (const unsubscribe of this.unsubscribers) unsubscribe();
  }
}
