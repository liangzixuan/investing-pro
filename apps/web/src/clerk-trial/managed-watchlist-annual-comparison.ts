import {
  membershipMatchesResult,
  type MainWatchlistPayload,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import {
  ManagedAnnualReport,
  type ManagedAnnualReportState,
} from "./managed-annual-report";
import { ManagedSecAccess } from "./managed-sec-access";

export type ManagedWatchlistAnnualComparisonSide = "left" | "right";
export interface ManagedWatchlistAnnualComparisonMember {
  readonly handle: symbol;
  readonly listing: ManagedEodIdentity;
}
interface SelectedReport {
  readonly selected: ManagedWatchlistAnnualComparisonMember | null;
  readonly report: ManagedAnnualReportState;
}
interface PendingRead {
  readonly side: ManagedWatchlistAnnualComparisonSide;
  readonly cancel: () => void;
}
export interface ManagedWatchlistAnnualComparisonState {
  readonly active: boolean;
  readonly canRead: boolean;
  readonly memberships: readonly ManagedWatchlistAnnualComparisonMember[];
  readonly left: SelectedReport;
  readonly right: SelectedReport;
  readonly pending: PendingRead | null;
  readonly catalogChanged: boolean;
  readonly message: string;
}
interface Owner {
  selected: ManagedWatchlistAnnualComparisonMember | null;
  readonly model: ManagedAnnualReport;
}
interface Operation {
  readonly side: ManagedWatchlistAnnualComparisonSide;
  readonly member: ManagedWatchlistAnnualComparisonMember;
  readonly pending: PendingRead;
}
const sides = ["left", "right"] as const;

/** Two explicit report owners; saved/draft payloads are only read here. */
export class ManagedWatchlistAnnualComparison {
  private readonly owners: Record<ManagedWatchlistAnnualComparisonSide, Owner>;
  private readonly listeners = new Set<() => void>();
  private state: ManagedWatchlistAnnualComparisonState;
  private memberships: readonly ManagedWatchlistAnnualComparisonMember[] = [];
  private digest: `sha256:${string}` | null = null;
  private active = false;
  private canRead = false;
  private retired = false;
  private changing = false;
  private message = "";
  private operation: Operation | null = null;

  constructor(
    read: ManagedApi["annualReport"],
    readError: (error: TrialApiError) => void,
    access = new ManagedSecAccess(),
  ) {
    const owner = (side: ManagedWatchlistAnnualComparisonSide): Owner => ({
      selected: null,
      model: new ManagedAnnualReport(
        (request, signal) => {
          const operation = this.operation;
          if (
            !operation ||
            operation.side !== side ||
            signal.aborted ||
            !this.current(operation)
          )
            return Promise.reject(new TrialApiError("unavailable"));
          return read(request, signal);
        },
        (error) => {
          this.retire();
          readError(error);
        },
        access,
      ),
    });
    this.owners = { left: owner("left"), right: owner("right") };
    this.state = this.snapshot();
    for (const side of sides)
      this.owners[side].model.subscribe(() => this.publish());
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private selectedReport(
    side: ManagedWatchlistAnnualComparisonSide,
  ): SelectedReport {
    const { selected, model } = this.owners[side];
    const report = model.getSnapshot();
    const prior = this.state?.[side];
    return prior?.selected === selected && prior.report === report
      ? prior
      : { selected, report };
  }
  private snapshot(): ManagedWatchlistAnnualComparisonState {
    const left = this.selectedReport("left");
    const right = this.selectedReport("right");
    return {
      active: this.active,
      canRead: this.canRead,
      memberships: this.memberships,
      left,
      right,
      pending: this.operation?.pending ?? null,
      catalogChanged: left.report.catalogChanged || right.report.catalogChanged,
      message: this.message,
    };
  }
  private publish() {
    if (this.changing) return;
    const next = this.snapshot();
    if (
      Object.keys(next).every(
        (key) =>
          next[key as keyof typeof next] ===
          this.state[key as keyof typeof next],
      )
    )
      return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
  private current(operation: Operation) {
    return (
      !this.retired &&
      this.active &&
      this.canRead &&
      this.operation === operation &&
      this.owners[operation.side].selected === operation.member
    );
  }
  private cancel(operation: Operation) {
    if (this.operation !== operation) return;
    this.operation = null;
    this.owners[operation.side].model.cancel();
    this.publish();
  }
  private replace(
    side: ManagedWatchlistAnnualComparisonSide,
    member: ManagedWatchlistAnnualComparisonMember | null,
  ) {
    if (this.operation?.side === side) this.cancel(this.operation);
    const owner = this.owners[side];
    owner.selected = member;
    if (member && this.digest)
      owner.model.open({
        listing: member.listing,
        catalogSnapshotSha256: this.digest,
        cik: null,
        origin: "watchlist",
      });
    else owner.model.close();
  }
  private reconcileMembers(
    draft: MainWatchlistPayload | null,
    digest: `sha256:${string}` | null,
  ) {
    const admitted = draft && digest === draft.snapshotSha256 ? draft : null;
    const previous = new Map(
      this.memberships.map((member) => [member.listing.listingId, member]),
    );
    const next = (admitted?.memberships ?? []).map((member) => {
      const prior = previous.get(member.listingId);
      if (
        this.digest === digest &&
        prior &&
        membershipMatchesResult(member, prior.listing)
      )
        return prior;
      const listing: ManagedEodIdentity = {
        country: member.country,
        exchangeMic: member.exchangeMic,
        instrumentType: member.instrumentType,
        issuerId: member.issuerId,
        issuerName: member.issuerName,
        listingId: member.listingId,
        securityId: member.securityId,
        securityName: member.securityName,
        shareClassId: member.shareClassId,
        shareClassName: member.shareClassName,
        symbol: member.symbol,
      };
      return Object.freeze({
        handle: Symbol(),
        listing: Object.freeze(listing),
      });
    });
    if (
      next.length !== this.memberships.length ||
      next.some((member, i) => member !== this.memberships[i])
    )
      this.memberships = next;
    this.digest = admitted ? digest : null;
  }
  reconcile(
    draft: MainWatchlistPayload | null,
    digest: `sha256:${string}` | null,
    active: boolean,
    canRead: boolean,
  ) {
    if (this.retired) return;
    this.changing = true;
    try {
      this.reconcileMembers(draft, digest);
      this.active = active;
      this.canRead = active && canRead && this.digest !== null;
      if (!this.canRead && this.operation) this.cancel(this.operation);
      for (const side of sides) {
        const selected = this.owners[side].selected;
        if (selected && !this.memberships.includes(selected)) {
          this.replace(side, null);
          this.message =
            "The watchlist or catalog changed. Choose the company again.";
        }
      }
    } finally {
      this.changing = false;
      this.publish();
    }
  }
  private acceptsSelection(
    captured: ManagedWatchlistAnnualComparisonState,
    member: ManagedWatchlistAnnualComparisonMember | null,
  ) {
    return (
      !this.retired &&
      this.canRead &&
      !this.state.catalogChanged &&
      this.state === captured &&
      (member === null || this.memberships.includes(member))
    );
  }
  select(
    side: ManagedWatchlistAnnualComparisonSide,
    captured: ManagedWatchlistAnnualComparisonState,
    member: ManagedWatchlistAnnualComparisonMember | null,
  ) {
    if (!this.acceptsSelection(captured, member)) return;
    const other = this.owners[side === "left" ? "right" : "left"].selected;
    if (member && member.listing.issuerId === other?.listing.issuerId) {
      this.message =
        "Choose two different companies. Share classes of the same issuer cannot be compared.";
      this.publish();
      return;
    }
    this.changing = true;
    try {
      this.message = "";
      if (this.owners[side].selected !== member) this.replace(side, member);
    } finally {
      this.changing = false;
      this.publish();
    }
  }
  async load(
    side: ManagedWatchlistAnnualComparisonSide,
    member: ManagedWatchlistAnnualComparisonMember,
  ) {
    if (
      this.retired ||
      !this.canRead ||
      this.operation ||
      this.state.catalogChanged ||
      this.owners[side].selected !== member
    )
      return;
    const operation: Operation = {
      side,
      member,
      pending: { side, cancel: () => this.cancel(operation) },
    };
    this.operation = operation;
    this.publish();
    try {
      if (this.current(operation)) await this.owners[side].model.load();
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        this.publish();
      }
    }
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.changing = true;
    this.active = false;
    this.canRead = false;
    this.operation = null;
    this.memberships = [];
    this.digest = null;
    this.message = "";
    for (const side of sides) {
      this.owners[side].selected = null;
      this.owners[side].model.retire();
    }
    this.changing = false;
    this.publish();
  }
}
