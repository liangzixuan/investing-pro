import {
  membershipMatchesResult,
  type MainWatchlistPayload,
  type ManagedSecFilingsResponseDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import {
  captureManagedCompanyFilingsSeed,
  ManagedCompanyFilings,
  type ManagedCompanyFilingsState,
} from "./managed-company-filings";
import type { ManagedResearchCoverage } from "./managed-research-eligibility";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { ManagedSecAccess } from "./managed-sec-access";
import {
  watchlistFilingsIdentity,
  type ManagedWatchlistFilingsHandoff,
  type ManagedWatchlistFilingsMember,
} from "./managed-watchlist-filings";

export const FILINGS_REVIEW_LIMIT = 5;

export interface ManagedFilingsReviewRow {
  readonly member: ManagedWatchlistFilingsMember;
  readonly filings: ManagedCompanyFilingsState;
}
export interface ManagedFilingsReviewCapture {
  readonly member: ManagedWatchlistFilingsMember;
  readonly response: ManagedSecFilingsResponseDto;
}
export interface ManagedFilingsReviewState {
  readonly active: boolean;
  readonly canRead: boolean;
  readonly memberships: readonly ManagedWatchlistFilingsMember[];
  readonly chosen: readonly ManagedWatchlistFilingsMember[];
  readonly rows: readonly ManagedFilingsReviewRow[];
  readonly selected: ManagedWatchlistFilingsMember | null;
  readonly catalogChanged: boolean;
}
interface Entry {
  readonly member: ManagedWatchlistFilingsMember;
  readonly selection: ManagedResearchSelection;
  readonly model: ManagedCompanyFilings;
  readonly unsubscribe: () => void;
}

/** A bounded review visit. Only the current company's explicit Load can read. */
export class ManagedFilingsReview {
  private readonly listeners = new Set<() => void>();
  private memberships: readonly ManagedWatchlistFilingsMember[] = [];
  private chosen: readonly ManagedWatchlistFilingsMember[] = [];
  private entries: readonly Entry[] = [];
  private selected: ManagedWatchlistFilingsMember | null = null;
  private digest: `sha256:${string}` | null = null;
  private active = false;
  private canRead = false;
  private catalogChanged = false;
  private retired = false;
  private changing = false;
  private state: ManagedFilingsReviewState = this.snapshot();

  constructor(
    private readonly read: ManagedApi["recentFilings"],
    private readonly readError: (error: TrialApiError) => void,
    private readonly access = new ManagedSecAccess(),
    private readonly options: {
      readonly coverage?: ManagedResearchCoverage;
    } = {},
  ) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private snapshot(): ManagedFilingsReviewState {
    const rows = this.entries.map(({ member, model }) => {
      const filings = model.getSnapshot();
      return (
        this.state?.rows.find(
          (row) => row.member === member && row.filings === filings,
        ) ?? Object.freeze({ member, filings })
      );
    });
    return Object.freeze({
      active: this.active,
      canRead: this.canRead,
      memberships: this.memberships,
      chosen: this.chosen,
      rows:
        this.state &&
        rows.length === this.state.rows.length &&
        rows.every((row, index) => row === this.state.rows[index])
          ? this.state.rows
          : Object.freeze(rows),
      selected: this.selected,
      catalogChanged: this.catalogChanged,
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
  private current(entry: Entry) {
    return (
      !this.retired &&
      !this.changing &&
      this.active &&
      !this.catalogChanged &&
      this.selected === entry.member &&
      this.entries.includes(entry) &&
      this.memberships.includes(entry.member) &&
      this.digest === entry.selection.catalogSnapshotSha256
    );
  }
  private accepts(captured: ManagedFilingsReviewState) {
    return (
      !this.retired && !this.changing && this.active && this.state === captured
    );
  }
  private clearReview() {
    const entries = this.entries;
    this.entries = [];
    this.chosen = [];
    this.selected = null;
    for (const entry of entries) {
      entry.unsubscribe();
      entry.model.retire();
    }
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
        digest && draft?.snapshotSha256 === digest ? draft : null;
      const members = (admitted?.memberships ?? []).map((member) => {
        const previous = this.memberships.find((item) =>
          membershipMatchesResult(member, item.listing),
        );
        return this.digest === digest && previous
          ? previous
          : Object.freeze({
              handle: Symbol(member.listingId),
              listing: watchlistFilingsIdentity(member),
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
      if (this.chosen.some((member) => !members.includes(member)))
        this.clearReview();
      if (!this.canRead) this.cancel();
    } finally {
      this.changing = false;
      this.publish();
    }
  }
  choose(
    captured: ManagedFilingsReviewState,
    member: ManagedWatchlistFilingsMember,
  ) {
    if (
      !this.accepts(captured) ||
      this.entries.length ||
      this.catalogChanged ||
      !this.memberships.includes(member)
    )
      return;
    if (this.chosen.includes(member))
      this.chosen = Object.freeze(
        this.chosen.filter((item) => item !== member),
      );
    else if (this.chosen.length < FILINGS_REVIEW_LIMIT)
      this.chosen = Object.freeze([...this.chosen, member]);
    this.publish();
  }
  start(captured: ManagedFilingsReviewState) {
    if (
      !this.accepts(captured) ||
      this.entries.length ||
      !this.digest ||
      this.catalogChanged ||
      !this.chosen.length
    )
      return;
    this.changing = true;
    try {
      this.entries = this.chosen.map((member) => {
        const selection: ManagedResearchSelection = Object.freeze({
          listing: member.listing,
          catalogSnapshotSha256: this.digest!,
          cik: null,
          origin: "watchlist",
        });
        const model = new ManagedCompanyFilings(
          (request, signal) =>
            this.current(entry) && this.canRead && !signal.aborted
              ? this.read(request, signal)
              : Promise.reject(new TrialApiError("aborted")),
          (error) => {
            this.retire();
            this.readError(error);
          },
          this.access,
          { ...this.options, compareRefresh: true },
        );
        model.open(selection);
        const entry: Entry = {
          member,
          model,
          selection,
          unsubscribe: model.subscribe(() => {
            if (model.getSnapshot().catalogChanged) this.catalogChanged = true;
            this.publish();
          }),
        };
        return entry;
      });
      this.selected = this.chosen[0]!;
    } finally {
      this.changing = false;
      this.publish();
    }
  }
  select(
    captured: ManagedFilingsReviewState,
    member: ManagedWatchlistFilingsMember,
  ) {
    const entry = this.entries.find((item) => item.member === member);
    const previous = this.selected;
    if (
      !this.accepts(captured) ||
      this.catalogChanged ||
      this.selected === member ||
      !entry
    )
      return;
    this.changing = true;
    try {
      this.cancel();
      if (!this.currentSelectionAfterCancel(entry, previous)) return;
      this.selected = member;
    } finally {
      this.changing = false;
      this.publish();
    }
  }
  private currentSelectionAfterCancel(
    entry: Entry,
    previous: ManagedWatchlistFilingsMember | null,
  ) {
    return (
      !this.retired &&
      this.active &&
      !this.catalogChanged &&
      this.selected === previous &&
      this.entries.includes(entry) &&
      this.memberships.includes(entry.member) &&
      this.digest === entry.selection.catalogSnapshotSha256
    );
  }
  async load(captured: ManagedFilingsReviewState) {
    const entry = this.entries.find((item) => item.member === this.selected);
    if (
      !this.accepts(captured) ||
      !entry ||
      !this.current(entry) ||
      !this.canRead
    )
      return;
    await entry.model.load();
  }
  cancel() {
    this.entries
      .find((entry) => entry.member === this.selected)
      ?.model.cancel();
  }
  canAdmit(capture: ManagedFilingsReviewCapture) {
    const entry = this.entries.find((item) => item.member === capture.member);
    const filings = entry?.model.getSnapshot();
    return Boolean(
      entry &&
      this.current(entry) &&
      filings &&
      !filings.running &&
      !filings.catalogChanged &&
      filings.response === capture.response,
    );
  }
  admit(
    capture: ManagedFilingsReviewCapture,
  ): ManagedWatchlistFilingsHandoff | null {
    if (!this.canAdmit(capture)) return null;
    const entry = this.entries.find((item) => item.member === capture.member)!;
    const seed = captureManagedCompanyFilingsSeed(
      entry.selection,
      {
        response: capture.response,
        showingPrevious: entry.model.getSnapshot().showingPrevious,
      },
      this.options,
    );
    return seed && this.canAdmit(capture)
      ? Object.freeze({ selection: entry.selection, seed })
      : null;
  }
  finish(captured: ManagedFilingsReviewState) {
    if (!this.accepts(captured)) return;
    this.changing = true;
    try {
      this.clearReview();
    } finally {
      this.changing = false;
      this.publish();
    }
  }
  leave() {
    this.active = false;
    this.canRead = false;
    this.clearReview();
    this.memberships = [];
    this.digest = null;
    this.catalogChanged = false;
    this.publish();
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.leave();
  }
}
