import {
  membershipMatchesResult,
  type MainWatchlistPayload,
  type ManagedEodIdentity,
  type ManagedSecFilingsResponseDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import {
  captureManagedCompanyFilingsSeed,
  ManagedCompanyFilings,
  type ManagedCompanyFilingsSeed,
  type ManagedCompanyFilingsState,
} from "./managed-company-filings";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { ManagedSecAccess } from "./managed-sec-access";
import type { ManagedResearchCoverage } from "./managed-research-eligibility";

export interface ManagedWatchlistFilingsMember {
  readonly handle: symbol;
  readonly listing: ManagedEodIdentity;
}
export interface ManagedWatchlistFilingsCapture {
  readonly member: ManagedWatchlistFilingsMember;
  readonly response: ManagedSecFilingsResponseDto;
}
export interface ManagedWatchlistFilingsHandoff {
  readonly selection: ManagedResearchSelection;
  readonly seed: ManagedCompanyFilingsSeed;
}
export interface ManagedWatchlistFilingsState {
  readonly active: boolean;
  readonly canRead: boolean;
  readonly memberships: readonly ManagedWatchlistFilingsMember[];
  readonly selected: ManagedWatchlistFilingsMember | null;
  readonly filings: ManagedCompanyFilingsState;
  readonly pending: { readonly cancel: () => void } | null;
  readonly catalogChanged: boolean;
}
interface Operation {
  readonly member: ManagedWatchlistFilingsMember;
  readonly pending: { readonly cancel: () => void };
}

function identity(
  member: MainWatchlistPayload["memberships"][number],
): ManagedEodIdentity {
  return Object.freeze({
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
  });
}

/** One selected packet, owned by the mounted watchlist rather than its draft. */
export class ManagedWatchlistFilings {
  private readonly model: ManagedCompanyFilings;
  private readonly listeners = new Set<() => void>();
  private state: ManagedWatchlistFilingsState;
  private memberships: readonly ManagedWatchlistFilingsMember[] = [];
  private selected: ManagedWatchlistFilingsMember | null = null;
  private digest: `sha256:${string}` | null = null;
  private active = false;
  private canRead = false;
  private retired = false;
  private changing = false;
  private operation: Operation | null = null;

  constructor(
    read: ManagedApi["recentFilings"],
    readError: (error: TrialApiError) => void,
    access = new ManagedSecAccess(),
    private readonly options: {
      readonly coverage?: ManagedResearchCoverage;
    } = {},
  ) {
    this.model = new ManagedCompanyFilings(
      (request, signal) => {
        const operation = this.operation;
        return operation && this.current(operation) && !signal.aborted
          ? read(request, signal)
          : Promise.reject(new TrialApiError("aborted"));
      },
      (error) => {
        this.retire();
        readError(error);
      },
      access,
      options,
    );
    this.state = this.snapshot();
    this.model.subscribe(() => this.publish());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private snapshot(): ManagedWatchlistFilingsState {
    const filings = this.model.getSnapshot();
    return Object.freeze({
      active: this.active,
      canRead: this.canRead,
      memberships: this.memberships,
      selected: this.selected,
      filings,
      pending: this.operation?.pending ?? null,
      catalogChanged: filings.catalogChanged,
    });
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
      this.selected === operation.member
    );
  }
  private cancelOperation(operation: Operation) {
    if (this.operation !== operation) return;
    this.operation = null;
    this.model.cancel();
    this.publish();
  }
  cancel() {
    if (this.operation) this.cancelOperation(this.operation);
  }
  private replace(member: ManagedWatchlistFilingsMember | null) {
    this.operation = null;
    this.selected = member;
    if (member && this.digest)
      this.model.open({
        listing: member.listing,
        catalogSnapshotSha256: this.digest,
        cik: null,
        origin: "watchlist",
      });
    else this.model.close();
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
      const admitted =
        digest !== null && draft?.snapshotSha256 === digest ? draft : null;
      const members = (admitted?.memberships ?? []).map((member) => {
        const previous = this.memberships.find(
          (item) => item.listing.listingId === member.listingId,
        );
        return this.digest === digest &&
          previous &&
          membershipMatchesResult(member, previous.listing)
          ? previous
          : Object.freeze({
              handle: Symbol(member.listingId),
              listing: identity(member),
            });
      });
      if (
        members.length !== this.memberships.length ||
        members.some((member, index) => member !== this.memberships[index])
      )
        this.memberships = Object.freeze(members);
      this.digest = admitted ? digest : null;
      this.active = active;
      this.canRead = active && canRead && this.digest !== null;
      if (this.selected && !this.memberships.includes(this.selected))
        this.replace(null);
      if (!this.canRead) this.cancel();
    } finally {
      this.changing = false;
      this.publish();
    }
  }
  select(
    captured: ManagedWatchlistFilingsState,
    member: ManagedWatchlistFilingsMember | null,
  ) {
    if (
      this.retired ||
      !this.active ||
      this.state !== captured ||
      this.state.catalogChanged ||
      (member !== null && !this.memberships.includes(member)) ||
      this.selected === member
    )
      return;
    this.changing = true;
    try {
      this.replace(member);
    } finally {
      this.changing = false;
      this.publish();
    }
  }
  async load(member: ManagedWatchlistFilingsMember) {
    if (
      this.retired ||
      !this.active ||
      !this.canRead ||
      this.operation ||
      this.state.catalogChanged ||
      this.selected !== member
    )
      return;
    if (!this.model.getSnapshot().supported) return;
    const operation: Operation = {
      member,
      pending: { cancel: () => this.cancelOperation(operation) },
    };
    this.operation = operation;
    this.publish();
    try {
      if (this.current(operation)) await this.model.load();
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        this.publish();
      }
    }
  }
  canAdmitFilings(capture: ManagedWatchlistFilingsCapture): boolean {
    const state = this.model.getSnapshot();
    return (
      !this.retired &&
      this.active &&
      !this.operation &&
      !state.running &&
      !state.catalogChanged &&
      this.selected === capture.member &&
      this.memberships.includes(capture.member) &&
      state.response !== null &&
      state.response === capture.response &&
      state.selection?.catalogSnapshotSha256 === this.digest
    );
  }
  admitFilings(
    capture: ManagedWatchlistFilingsCapture,
  ): ManagedWatchlistFilingsHandoff | null {
    if (!this.canAdmitFilings(capture)) return null;
    const state = this.model.getSnapshot();
    const selection: ManagedResearchSelection = Object.freeze({
      listing: capture.member.listing,
      catalogSnapshotSha256: this.digest!,
      cik: null,
      origin: "watchlist",
    });
    const seed = captureManagedCompanyFilingsSeed(
      selection,
      {
        response: capture.response,
        showingPrevious: state.showingPrevious,
      },
      this.options,
    );
    return seed && !this.operation && this.canAdmitFilings(capture)
      ? Object.freeze({ selection, seed })
      : null;
  }
  leave() {
    this.changing = true;
    this.active = false;
    this.canRead = false;
    this.memberships = [];
    this.digest = null;
    this.replace(null);
    this.changing = false;
    this.publish();
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.leave();
    this.model.retire();
  }
}
