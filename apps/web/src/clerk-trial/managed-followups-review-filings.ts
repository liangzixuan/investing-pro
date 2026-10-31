import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import {
  ManagedCompanyFilings,
  captureManagedFollowupsReviewFilingsSeed,
  type ManagedCompanyFilingsState,
  type ManagedFollowupsReviewFilingsSeed,
} from "./managed-company-filings";
import type {
  FollowupsReviewHandle,
  ManagedFollowupsReviewSession,
} from "./managed-followups-review-session";
import type { ManagedResearchFollowups } from "./managed-research-followups";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedResearchCoverage } from "./managed-research-eligibility";
import { ManagedSecAccess } from "./managed-sec-access";

export interface FollowupsReviewFilingsRow {
  readonly handle: FollowupsReviewHandle;
  readonly entry: ResearchFollowup;
  readonly filings: ManagedCompanyFilingsState;
}
export interface FollowupsReviewFilingsState {
  readonly active: boolean;
  readonly canRead: boolean;
  readonly rows: readonly FollowupsReviewFilingsRow[];
  readonly selected: FollowupsReviewFilingsRow | null;
  readonly catalogChanged: boolean;
}
export interface FollowupsReviewFilingsCapture {
  readonly handle: FollowupsReviewHandle;
  readonly entry: ResearchFollowup;
  readonly seed: ManagedFollowupsReviewFilingsSeed;
  readonly isCurrent: () => boolean;
}
interface PacketOwner {
  readonly handle: FollowupsReviewHandle;
  readonly selection: ManagedResearchSelection;
  readonly model: ManagedCompanyFilings;
  readonly off: () => void;
}

/** Temporary per-check evidence. Review handles own packets; captured frames own actions. */
export class ManagedFollowupsReviewFilings {
  private readonly listeners = new Set<() => void>();
  private readonly off: readonly (() => void)[];
  private entries: readonly PacketOwner[] = [];
  private scope: object | null = null;
  private selected: FollowupsReviewHandle | null = null;
  private selectionRevision = 0;
  private reconciling = false;
  private retired = false;
  private state: FollowupsReviewFilingsState = Object.freeze({
    active: false,
    canRead: false,
    rows: [],
    selected: null,
    catalogChanged: false,
  });

  constructor(
    private readonly review: ManagedFollowupsReviewSession,
    private readonly followups: ManagedResearchFollowups,
    private readonly read: ManagedApi["recentFilings"],
    private readonly readError: (error: TrialApiError) => void,
    private readonly access = new ManagedSecAccess(),
    private readonly options: {
      readonly coverage?: ManagedResearchCoverage;
    } = {},
  ) {
    this.off = [review, followups].map((source) =>
      source.subscribe(this.reconcile),
    );
    this.reconcile();
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private clear() {
    const previous = this.entries;
    this.entries = [];
    this.scope = null;
    this.selected = null;
    this.selectionRevision++;
    for (const entry of previous) {
      entry.off();
      entry.model.retire();
    }
  }
  private owned(owner: PacketOwner) {
    const review = this.review.getSnapshot();
    return (
      !this.retired &&
      !this.followups.hasDraftFileActivity() &&
      this.entries.includes(owner) &&
      this.followups.getReviewContext()?.scope === this.scope &&
      review.entered &&
      review.phase === "reviewing" &&
      review.selected?.handle === owner.handle
    );
  }
  private create(
    handle: FollowupsReviewHandle,
    entry: ResearchFollowup,
  ): PacketOwner {
    const selection: ManagedResearchSelection = Object.freeze({
      listing: Object.freeze({ ...entry.listing }),
      catalogSnapshotSha256: entry.catalogSnapshotSha256,
      origin: "followups",
      cik: null,
    });
    const model = new ManagedCompanyFilings(
      (request, signal) =>
        this.owned(owner) &&
        this.review.getSnapshot().available &&
        !signal.aborted
          ? this.read(request, signal)
          : Promise.reject(
              new Error("This review request is no longer current."),
            ),
      (error) => {
        this.retire();
        this.readError(error);
      },
      this.access,
      { ...this.options, compareRefresh: true },
    );
    model.open(selection);
    const owner: PacketOwner = {
      handle,
      selection,
      model,
      off: model.subscribe(this.reconcile),
    };
    return owner;
  }
  reconcile = () => {
    if (this.reconciling || this.retired) return;
    this.reconciling = true;
    try {
      const review = this.review.getSnapshot();
      const context = this.followups.getReviewContext();
      const active =
        !!context &&
        !this.followups.hasDraftFileActivity() &&
        review.entered &&
        review.phase === "reviewing";
      if (
        !active ||
        (this.scope !== null && this.scope !== context.scope) ||
        this.entries.some(
          (owner) => !review.chosen.some((row) => row.handle === owner.handle),
        )
      )
        this.clear();
      if (active) {
        this.scope = context.scope;
        this.entries = review.chosen.map(
          (row) =>
            this.entries.find((owner) => owner.handle === row.handle) ??
            this.create(row.handle, row.entry),
        );
        const selected = review.selected?.handle ?? null;
        if (this.selected !== selected) {
          const previous = this.entries.find(
            (owner) => owner.handle === this.selected,
          );
          this.selected = selected;
          this.selectionRevision++;
          previous?.model.cancel();
        }
        if (!review.available)
          this.entries
            .find((owner) => owner.handle === selected)
            ?.model.cancel();
      }
      const rows = Object.freeze(
        this.entries.map((owner) => {
          const entry = review.chosen.find(
            (row) => row.handle === owner.handle,
          )!.entry;
          const filings = owner.model.getSnapshot();
          return (
            this.state.rows.find(
              (row) =>
                row.handle === owner.handle &&
                row.entry === entry &&
                row.filings === filings,
            ) ?? Object.freeze({ handle: owner.handle, entry, filings })
          );
        }),
      );
      const catalogChanged = rows.some((row) => row.filings.catalogChanged);
      this.state = Object.freeze({
        active,
        canRead: active && review.available && !catalogChanged,
        rows,
        selected: rows.find((row) => row.handle === this.selected) ?? null,
        catalogChanged,
      });
    } finally {
      this.reconciling = false;
    }
    for (const listener of this.listeners) listener();
  };
  private accepts(captured: FollowupsReviewFilingsState) {
    return (
      !this.retired &&
      captured === this.state &&
      captured.active &&
      captured.canRead &&
      this.review.getSnapshot().available &&
      this.followups.getReviewContext()?.scope === this.scope
    );
  }
  canLoad(captured: FollowupsReviewFilingsState) {
    const row = captured.selected;
    return (
      this.accepts(captured) &&
      !!row &&
      row.filings.supported &&
      !row.filings.running
    );
  }
  async load(captured: FollowupsReviewFilingsState) {
    if (!this.canLoad(captured)) return;
    await this.entries
      .find((owner) => owner.handle === captured.selected!.handle)
      ?.model.load();
  }
  cancel(captured: FollowupsReviewFilingsState) {
    if (!this.accepts(captured)) return;
    this.entries
      .find((owner) => owner.handle === captured.selected?.handle)
      ?.model.cancel();
  }
  canInspect(captured: FollowupsReviewFilingsState) {
    return (
      this.accepts(captured) &&
      !!captured.selected?.filings.response &&
      !captured.selected.filings.running
    );
  }
  capture(
    captured: FollowupsReviewFilingsState,
  ): FollowupsReviewFilingsCapture | null {
    if (!this.canInspect(captured)) return null;
    const row = captured.selected!;
    const owner = this.entries.find((owner) => owner.handle === row.handle)!;
    const source = owner.model.getSnapshot();
    const response = row.filings.response!;
    const revision = this.selectionRevision;
    let retired = false;
    const isCurrent = () => {
      if (
        !this.owned(owner) ||
        this.selectionRevision !== revision ||
        owner.model.getSnapshot() !== source ||
        source.running
      )
        retired = true;
      return !retired;
    };
    const seed = captureManagedFollowupsReviewFilingsSeed(
      owner.selection,
      { response, showingPrevious: row.filings.showingPrevious },
      isCurrent,
      this.options,
    );
    return seed && isCurrent()
      ? Object.freeze({ handle: row.handle, entry: row.entry, seed, isCurrent })
      : null;
  }
  retire() {
    if (this.retired) return;
    this.off.forEach((off) => off());
    this.clear();
    this.state = Object.freeze({
      active: false,
      canRead: false,
      rows: [],
      selected: null,
      catalogChanged: false,
    });
    this.retired = true;
    for (const listener of this.listeners) listener();
  }
}
