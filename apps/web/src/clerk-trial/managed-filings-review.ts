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

import type { ManagedEodAccess } from "./managed-eod-access";
import {
  captureManagedEodHistorySeed,
  ManagedEodHistory,
  type ManagedEodHistorySeed,
  type ManagedEodHistoryState,
} from "./managed-eod-history";
import {
  dailyReviewOutcomes,
  watchlistDailyReviewResult,
  watchlistDailyReviewPlan,
  type ManagedWatchlistDailyReviewCapture,
  type ManagedWatchlistDailyReviewHandoff,
  type WatchlistDailyReviewPlan,
  type WatchlistDailyReviewPlanRow,
  type WatchlistDailyReviewState,
  type WatchlistDailyReviewSource,
  type WatchlistDailyReviewOutcomeStatus,
} from "./managed-watchlist-daily-review";

export const FILINGS_REVIEW_LIMIT = 5;

export interface ManagedFilingsReviewRow {
  readonly member: ManagedWatchlistFilingsMember;
  readonly filings: ManagedCompanyFilingsState;
  readonly price: ManagedEodHistoryState | null;
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
  readonly daily: WatchlistDailyReviewState | null;
}
interface Entry {
  readonly member: ManagedWatchlistFilingsMember;
  readonly selection: ManagedResearchSelection;
  readonly model: ManagedCompanyFilings;
  price: ManagedEodHistory | null;
  unsubscribe: () => void;
}

interface DailyReviewOperation {
  readonly plan: WatchlistDailyReviewPlan;
  readonly lifetime: object;
  index: number;
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
  private daily: WatchlistDailyReviewState | null = null;
  private preparedDaily: WatchlistDailyReviewPlan | null = null;
  private dailyRun: DailyReviewOperation | null = null;
  private lifetime: object = {};
  private dailyCaptureOwner: object = {};
  private readonly dailyCaptures = new WeakMap<
    ManagedWatchlistDailyReviewCapture,
    object
  >();
  private mutationDepth = 0;
  private state: ManagedFilingsReviewState = this.snapshot();

  constructor(
    private readonly read: ManagedApi["recentFilings"],
    private readonly readError: (error: TrialApiError) => void,
    private readonly access = new ManagedSecAccess(),
    private readonly options: {
      readonly coverage?: ManagedResearchCoverage;
      readonly daily?: {
        readonly readPrice: ManagedApi["eodHistory"];
        readonly priceAccess: ManagedEodAccess;
        readonly priceCoverage?: readonly ManagedEodIdentity[];
        readonly priceSeed?: (
          selection: ManagedResearchSelection,
        ) => ManagedEodHistorySeed | null;
      };
    } = {},
  ) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private snapshot(): ManagedFilingsReviewState {
    const rows = this.entries.map(({ member, model, price: priceModel }) => {
      const filings = model.getSnapshot();
      const price = priceModel?.getSnapshot() ?? null;
      return (
        this.state?.rows.find(
          (row) =>
            row.member === member &&
            row.filings === filings &&
            row.price === price,
        ) ?? Object.freeze({ member, filings, price })
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
      daily: this.daily,
    });
  }
  private publish() {
    if (this.mutationDepth !== 0) return;
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
    return this.state === next ? next : null;
  }
  private current(entry: Entry) {
    return (
      !this.retired &&
      this.mutationDepth === 0 &&
      this.active &&
      !this.catalogChanged &&
      this.daily?.phase !== "finished" &&
      this.selected === entry.member &&
      this.entries.includes(entry) &&
      this.memberships.includes(entry.member) &&
      this.digest === entry.selection.catalogSnapshotSha256
    );
  }
  private accepts(captured: ManagedFilingsReviewState) {
    return (
      !this.retired &&
      this.mutationDepth === 0 &&
      this.active &&
      this.state === captured
    );
  }
  private planning(captured: ManagedFilingsReviewState) {
    return (
      this.accepts(captured) &&
      this.entries.length === 0 &&
      !this.catalogChanged
    );
  }
  canChoose(
    captured: ManagedFilingsReviewState,
    member: ManagedWatchlistFilingsMember,
  ) {
    return (
      this.planning(captured) &&
      this.memberships.includes(member) &&
      (this.chosen.includes(member) ||
        this.chosen.length < FILINGS_REVIEW_LIMIT)
    );
  }
  canStart(captured: ManagedFilingsReviewState) {
    return (
      this.planning(captured) && this.digest !== null && this.chosen.length > 0
    );
  }
  private clearReview() {
    this.lifetime = {};
    this.dailyCaptureOwner = {};
    this.dailyRun = null;
    this.preparedDaily = null;
    this.daily = null;
    const entries = this.entries;
    this.entries = [];
    this.chosen = [];
    this.selected = null;
    for (const entry of entries) {
      entry.unsubscribe();
      entry.model.retire();
      entry.price?.retire();
    }
  }
  reconcile(
    draft: MainWatchlistPayload | null,
    digest: `sha256:${string}` | null,
    active: boolean,
    canRead: boolean,
  ) {
    if (this.retired) return;
    this.mutationDepth += 1;
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
      ) {
        if (this.daily) this.clearReview();
        this.memberships = Object.freeze(members);
      }
      this.digest = admitted ? digest : null;
      if (
        this.active !== active ||
        this.canRead !== (active && canRead && this.digest !== null)
      )
        this.dailyCaptureOwner = {};
      this.active = active;
      this.canRead = active && canRead && this.digest !== null;
      if (this.chosen.some((member) => !members.includes(member)))
        this.clearReview();
      if (!this.canRead) this.cancel();
    } finally {
      this.mutationDepth -= 1;
      this.publish();
    }
  }
  choose(
    captured: ManagedFilingsReviewState,
    member: ManagedWatchlistFilingsMember,
  ) {
    if (!this.canChoose(captured, member)) return;
    if (this.chosen.includes(member))
      this.chosen = Object.freeze(
        this.chosen.filter((item) => item !== member),
      );
    else this.chosen = Object.freeze([...this.chosen, member]);
    this.publish();
  }
  start(captured: ManagedFilingsReviewState) {
    if (!this.canStart(captured)) return;
    this.mutationDepth += 1;
    try {
      this.entries = this.chosen.map((member) => this.createEntry(member));
      this.selected = this.chosen[0]!;
    } finally {
      this.mutationDepth -= 1;
      this.publish();
    }
  }
  private createEntry(member: ManagedWatchlistFilingsMember): Entry {
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
      price: null,
      selection,
      unsubscribe: model.subscribe(() => {
        if (model.getSnapshot().catalogChanged) this.catalogChanged = true;
        this.publish();
      }),
    };
    return entry;
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
      this.daily?.phase === "finished"
    )
      return;
    if (!entry || this.selected === member) return;
    let installed: ManagedFilingsReviewState | null | undefined;
    this.mutationDepth += 1;
    try {
      this.cancel();
      if (!this.currentSelectionAfterCancel(entry, previous)) return;
      this.dailyCaptureOwner = {};
      this.selected = member;
    } finally {
      this.mutationDepth -= 1;
      installed = this.publish();
    }
    return installed ?? null;
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
  canLoad(captured: ManagedFilingsReviewState) {
    const entry = this.entries.find((item) => item.member === this.selected);
    if (!entry) return false;
    const filings = entry.model.getSnapshot();
    return (
      this.accepts(captured) &&
      this.current(entry) &&
      this.canRead &&
      this.daily === null &&
      filings.supported &&
      !filings.running
    );
  }
  async load(captured: ManagedFilingsReviewState) {
    if (!this.canLoad(captured)) return;
    await this.entries
      .find((item) => item.member === this.selected)!
      .model.load();
  }
  cancel() {
    this.preparedDaily = null;
    if (this.dailyRun) this.cancelDaily();
    const entry = this.entries.find((item) => item.member === this.selected);
    entry?.model.cancel();
    entry?.price?.cancel();
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
  canStartDaily(captured: ManagedFilingsReviewState) {
    return Boolean(
      this.options.daily && this.canStart(captured) && this.canRead,
    );
  }
  startDaily(captured: ManagedFilingsReviewState) {
    if (!this.canStartDaily(captured)) return;
    const lifetime = this.lifetime;
    const chosen = this.chosen;
    const memberships = this.memberships;
    const pending: Entry[] = [];
    let installed: ManagedFilingsReviewState | null | undefined;
    this.mutationDepth += 1;
    try {
      for (const member of chosen) {
        const filings = this.createEntry(member);
        const options = this.options.daily!;
        const price = new ManagedEodHistory(
          options.readPrice,
          (error) => {
            this.retire();
            this.readError(error);
          },
          options.priceAccess,
          options.priceCoverage,
          "watchlist",
        );
        const entry = filings;
        const unsubscribeFilings = filings.unsubscribe;
        entry.price = price;
        const unsubscribePrice = price.subscribe(() => {
          if (price.getSnapshot().catalogChanged) this.catalogChanged = true;
          this.publish();
        });
        entry.unsubscribe = () => {
          unsubscribeFilings();
          unsubscribePrice();
        };
        pending.push(entry);
        // The optional seed is independently decoded by the existing history model.
        const seed = options.priceSeed?.(entry.selection) ?? undefined;
        if (
          this.lifetime !== lifetime ||
          this.retired ||
          !this.active ||
          !this.canRead ||
          this.chosen !== chosen ||
          this.memberships !== memberships
        )
          return null;
        price.open(entry.selection, seed);
      }
      this.entries = pending;
      this.selected = chosen[0]!;
      const plan = watchlistDailyReviewPlan(
        pending.map((entry) => ({
          member: entry.member,
          price: entry.price!.getSnapshot(),
          filings: entry.model.getSnapshot(),
        })),
        ["price", "filings"],
      )!;
      this.daily = Object.freeze({
        phase: "ready",
        plan: null,
        outcomes: dailyReviewOutcomes(plan),
      });
    } finally {
      if (this.entries !== pending)
        for (const entry of pending) {
          entry.unsubscribe();
          entry.model.retire();
          entry.price?.retire();
        }
      this.mutationDepth -= 1;
      installed = this.publish();
    }
    return installed ?? null;
  }
  prepareDaily(
    captured: ManagedFilingsReviewState,
    names: readonly WatchlistDailyReviewSource[],
  ): WatchlistDailyReviewPlan | null {
    if (
      !this.accepts(captured) ||
      !this.canRead ||
      !this.daily ||
      this.dailyRun ||
      this.daily.phase === "finished" ||
      this.catalogChanged
    )
      return null;
    const rows = this.entries.map((entry) => ({
      member: entry.member,
      price: entry.price!.getSnapshot(),
      filings: entry.model.getSnapshot(),
    }));
    if (rows.some((row) => row.price.running || row.filings.running))
      return null;
    const plan = watchlistDailyReviewPlan(rows, names);
    if (!plan) return null;
    this.preparedDaily = plan;
    this.daily = Object.freeze({
      phase: "ready",
      plan,
      outcomes: dailyReviewOutcomes(plan),
    });
    this.publish();
    return this.preparedDaily === plan && this.canRunDaily(this.state, plan)
      ? plan
      : null;
  }
  canRunDaily(
    captured: ManagedFilingsReviewState,
    plan: WatchlistDailyReviewPlan,
  ) {
    return (
      this.accepts(captured) &&
      this.canRead &&
      !this.catalogChanged &&
      this.daily?.phase === "ready" &&
      !this.dailyRun &&
      this.preparedDaily === plan &&
      plan.rows.every((row) => {
        const entry = this.entries.find((item) => item.member === row.member);
        return (
          entry &&
          entry.price?.getSnapshot() === row.price &&
          entry.model.getSnapshot() === row.filings
        );
      })
    );
  }
  private dailyOutcome(
    index: number,
    status: WatchlistDailyReviewOutcomeStatus,
  ) {
    if (!this.daily) return;
    this.daily = Object.freeze({
      ...this.daily,
      outcomes: Object.freeze(
        this.daily.outcomes.map((row, i) => {
          if (i !== index) return row;
          const entry = this.entries.find(
            (item) => item.member === row.member,
          )!;
          return Object.freeze({
            ...row,
            status,
            price: entry.price!.getSnapshot(),
            filings: entry.model.getSnapshot(),
          });
        }),
      ),
    });
    this.publish();
  }
  private ownsDailyRun(operation: DailyReviewOperation) {
    return (
      this.dailyRun === operation &&
      this.lifetime === operation.lifetime &&
      !this.retired &&
      this.active &&
      this.canRead &&
      !this.catalogChanged
    );
  }
  private beginDailyRun(plan: WatchlistDailyReviewPlan): DailyReviewOperation {
    const operation = { plan, lifetime: this.lifetime, index: -1 };
    this.preparedDaily = null;
    this.dailyRun = operation;
    this.dailyCaptureOwner = {};
    this.daily = Object.freeze({
      phase: "running",
      plan,
      outcomes: dailyReviewOutcomes(plan),
    });
    this.publish();
    return operation;
  }
  private async readDailyRow(
    operation: DailyReviewOperation,
    row: WatchlistDailyReviewPlanRow,
    index: number,
  ) {
    const entry = this.entries.find((item) => item.member === row.member)!;
    operation.index = index;
    this.selected = row.member;
    this.dailyOutcome(index, "running");
    if (!this.ownsDailyRun(operation) || !this.current(entry)) return false;
    const model = row.source === "price" ? entry.price! : entry.model;
    await model.load();
    if (!this.ownsDailyRun(operation) || !this.current(entry)) return false;
    const price = entry.price!.getSnapshot();
    const filings = entry.model.getSnapshot();
    const cooldown =
      row.source === "price"
        ? this.options.daily!.priceAccess.getNextAllowedAt()
        : this.access.getNextAllowedAt();
    const status = watchlistDailyReviewResult(
      row.source,
      price,
      filings,
      Boolean(cooldown),
    );
    this.dailyOutcome(index, status);
    operation.index = -1;
    return status === "loaded" || status === "verified-empty";
  }
  private settleDailyRun(operation: DailyReviewOperation) {
    if (this.dailyRun !== operation) return;
    this.mutationDepth += 1;
    try {
      this.dailyRun = null;
      if (
        operation.index >= 0 &&
        this.daily?.outcomes[operation.index]?.status === "running"
      )
        this.dailyOutcome(
          operation.index,
          this.catalogChanged ? "failed" : "cancelled",
        );
      if (this.daily)
        this.daily = Object.freeze({ ...this.daily, phase: "settled" });
    } finally {
      this.mutationDepth -= 1;
      this.publish();
    }
  }
  async runDaily(
    captured: ManagedFilingsReviewState,
    plan: WatchlistDailyReviewPlan,
  ) {
    if (!this.canRunDaily(captured, plan)) return;
    const operation = this.beginDailyRun(plan);
    try {
      for (let index = 0; index < plan.rows.length; index += 1) {
        if (!this.ownsDailyRun(operation)) return;
        const row = plan.rows[index]!;
        if (row.disposition !== "missing") continue;
        if (!(await this.readDailyRow(operation, row, index))) break;
      }
    } finally {
      this.settleDailyRun(operation);
    }
  }
  cancelDaily() {
    const operation = this.dailyRun;
    this.preparedDaily = null;
    if (!operation) return;
    this.dailyRun = null;
    const lifetime = this.lifetime;
    this.mutationDepth += 1;
    try {
      const row = operation.plan.rows[operation.index];
      const entry = this.entries.find((item) => item.member === row?.member);
      entry?.price?.cancel();
      entry?.model.cancel();
      if (this.lifetime !== lifetime || !this.daily) return;
      if (row && this.daily.outcomes[operation.index]?.status === "running")
        this.dailyOutcome(operation.index, "cancelled");
      this.daily = Object.freeze({ ...this.daily, phase: "settled" });
    } finally {
      this.mutationDepth -= 1;
      this.publish();
    }
  }
  captureDaily(
    captured: ManagedFilingsReviewState,
  ): ManagedWatchlistDailyReviewCapture | null {
    const entry = this.entries.find((item) => item.member === this.selected);
    if (
      !this.accepts(captured) ||
      !entry ||
      !entry.price ||
      !this.current(entry) ||
      !this.daily ||
      this.dailyRun ||
      this.daily.phase === "finished"
    )
      return null;
    const capture = Object.freeze({
      member: entry.member,
      price: entry.price.getSnapshot(),
      filings: entry.model.getSnapshot(),
    });
    this.dailyCaptures.set(capture, this.dailyCaptureOwner);
    return this.canAdmitDaily(capture) ? capture : null;
  }
  canAdmitDaily(capture: ManagedWatchlistDailyReviewCapture) {
    const entry = this.entries.find((item) => item.member === capture.member);
    return Boolean(
      this.daily &&
      this.dailyCaptures.get(capture) === this.dailyCaptureOwner &&
      !this.dailyRun &&
      entry &&
      this.current(entry) &&
      entry.price?.getSnapshot() === capture.price &&
      entry.model.getSnapshot() === capture.filings &&
      !capture.price.running &&
      !capture.filings.running,
    );
  }
  admitDaily(
    capture: ManagedWatchlistDailyReviewCapture,
  ): ManagedWatchlistDailyReviewHandoff | null {
    if (!this.canAdmitDaily(capture)) return null;
    const entry = this.entries.find((item) => item.member === capture.member)!;
    const priceSeed = capture.price.response
      ? captureManagedEodHistorySeed(entry.selection, {
          response: capture.price.response,
          showingPrevious: capture.price.showingPrevious,
        })
      : null;
    const filingsSeed = capture.filings.response
      ? captureManagedCompanyFilingsSeed(
          entry.selection,
          {
            response: capture.filings.response,
            showingPrevious: capture.filings.showingPrevious,
          },
          this.options,
        )
      : null;
    if (
      (capture.price.response && !priceSeed) ||
      (capture.filings.response && !filingsSeed) ||
      !this.canAdmitDaily(capture)
    )
      return null;
    return Object.freeze({
      selection: entry.selection,
      priceSeed,
      filingsSeed,
    });
  }
  finishDaily(
    captured: ManagedFilingsReviewState,
  ): ManagedFilingsReviewState | null {
    if (
      !this.accepts(captured) ||
      !this.daily ||
      this.dailyRun ||
      this.daily.phase === "finished"
    )
      return null;
    this.preparedDaily = null;
    this.daily = Object.freeze({ ...this.daily, phase: "finished" });
    return this.publish() ?? null;
  }
  resetDaily(captured: ManagedFilingsReviewState) {
    if (!this.accepts(captured) || this.daily?.phase !== "finished")
      return null;
    this.mutationDepth += 1;
    try {
      this.clearReview();
    } finally {
      this.mutationDepth -= 1;
    }
    return this.publish() ?? null;
  }
  finish(captured: ManagedFilingsReviewState) {
    if (!this.accepts(captured)) return;
    this.mutationDepth += 1;
    try {
      this.clearReview();
    } finally {
      this.mutationDepth -= 1;
      this.publish();
    }
  }
  leave() {
    this.mutationDepth += 1;
    try {
      this.clearReview();
      this.active = false;
      this.canRead = false;
      this.memberships = [];
      this.digest = null;
      this.catalogChanged = false;
    } finally {
      this.mutationDepth -= 1;
      this.publish();
    }
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.leave();
  }
}
