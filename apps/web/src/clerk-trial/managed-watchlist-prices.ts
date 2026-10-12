import {
  membershipMatchesResult,
  type MainWatchlistPayload,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import type { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import type { ManagedEodAccess } from "./managed-eod-access";
import {
  captureManagedEodHistorySeed,
  ManagedEodHistory,
  type ManagedEodHistorySeed,
  type ManagedEodHistoryState,
} from "./managed-eod-history";
import { MANAGED_PRICE_COVERAGE } from "./managed-price-coverage";

export type ManagedWatchlistPriceHandle = symbol;
export interface ManagedWatchlistPriceRow {
  readonly handle: ManagedWatchlistPriceHandle;
  readonly listing: ManagedEodIdentity;
  readonly history: ManagedEodHistoryState;
}
export interface ManagedWatchlistPricePending {
  readonly listing: ManagedEodIdentity;
  readonly cancel: () => void;
}
export interface ManagedWatchlistPricesState {
  readonly active: boolean;
  readonly canRead: boolean;
  readonly rows: readonly ManagedWatchlistPriceRow[];
  readonly pending: ManagedWatchlistPricePending | null;
  readonly catalogChanged: boolean;
}
interface Entry {
  readonly handle: ManagedWatchlistPriceHandle;
  readonly listing: ManagedEodIdentity;
  readonly digest: `sha256:${string}`;
  readonly model: ManagedEodHistory;
  readonly unsubscribe: () => void;
}
interface Operation {
  readonly entry: Entry;
  readonly pending: ManagedWatchlistPricePending;
}
const empty = (): ManagedWatchlistPricesState => ({
  active: false,
  canRead: false,
  rows: [],
  pending: null,
  catalogChanged: false,
});

/** A mounted watchlist owns bounded row lifetimes, sharing the workspace EOD budget. */
export class ManagedWatchlistPrices {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private readonly coverage: readonly ManagedEodIdentity[];
  private entries: readonly Entry[] = [];
  private operation: Operation | null = null;
  private active = false;
  private canRead = false;
  private retired = false;

  constructor(
    private readonly read: ManagedApi["eodHistory"],
    private readonly readError: (error: TrialApiError) => void,
    private readonly access: ManagedEodAccess,
    coverage: readonly ManagedEodIdentity[] = MANAGED_PRICE_COVERAGE,
  ) {
    this.coverage = Object.freeze(
      coverage.map((listing) => Object.freeze({ ...listing })),
    );
  }
  getSnapshot = (): ManagedWatchlistPricesState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish() {
    const rows = this.entries.map((entry) => {
      const previous = this.state.rows.find(
        (row) => row.handle === entry.handle,
      );
      const history = entry.model.getSnapshot();
      return previous?.history === history
        ? previous
        : Object.freeze({
            handle: entry.handle,
            listing: entry.listing,
            history,
          });
    });
    const pending = this.operation?.pending ?? null;
    const catalogChanged = rows.some((row) => row.history.catalogChanged);
    if (
      this.state.active === this.active &&
      this.state.canRead === this.canRead &&
      this.state.pending === pending &&
      this.state.catalogChanged === catalogChanged &&
      this.state.rows.length === rows.length &&
      rows.every((row, index) => row === this.state.rows[index])
    )
      return;
    this.state = Object.freeze({
      active: this.active,
      canRead: this.canRead,
      rows: Object.freeze(rows),
      pending,
      catalogChanged,
    });
    for (const listener of this.listeners) listener();
  }
  private createEntry(
    listing: ManagedEodIdentity,
    digest: `sha256:${string}`,
  ): Entry {
    const model = new ManagedEodHistory(
      this.read,
      (error) => {
        this.retire();
        this.readError(error);
      },
      this.access,
      this.coverage,
      "watchlist",
    );
    model.open({
      catalogSnapshotSha256: digest,
      listing,
      cik: null,
      origin: "watchlist",
    });
    return {
      handle: Symbol(listing.listingId),
      listing,
      digest,
      model,
      unsubscribe: model.subscribe(() => this.publish()),
    };
  }
  private discard(entry: Entry) {
    entry.unsubscribe();
    if (this.operation?.entry === entry) this.operation = null;
    entry.model.retire();
  }
  private covered(draft: MainWatchlistPayload | null): ManagedEodIdentity[] {
    const seen = new Set<string>();
    const listings: ManagedEodIdentity[] = [];
    for (const member of draft?.memberships ?? []) {
      const listing = this.coverage.find((item) =>
        membershipMatchesResult(member, item),
      );
      if (!listing || seen.has(listing.listingId)) continue;
      seen.add(listing.listingId);
      listings.push(listing);
    }
    return listings;
  }
  enter(
    draft: MainWatchlistPayload | null,
    digest: `sha256:${string}` | null,
    canRead: boolean,
  ) {
    if (this.retired) return;
    this.active = true;
    this.reconcile(draft, digest, canRead);
  }
  reconcile(
    draft: MainWatchlistPayload | null,
    digest: `sha256:${string}` | null,
    canRead: boolean,
  ) {
    if (this.retired) return;
    const current =
      this.active && digest !== null && draft?.snapshotSha256 === digest;
    const next = current
      ? this.covered(draft).map(
          (listing) =>
            this.entries.find(
              (entry) => entry.digest === digest && entry.listing === listing,
            ) ?? this.createEntry(listing, digest),
        )
      : [];
    const previous = this.entries;
    this.entries = next;
    this.canRead = current && canRead;
    for (const entry of previous)
      if (!next.includes(entry)) this.discard(entry);
    this.publish();
  }
  leave() {
    this.active = false;
    this.canRead = false;
    const previous = this.entries;
    this.entries = [];
    for (const entry of previous) this.discard(entry);
    this.publish();
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.leave();
  }
  cancel() {
    this.operation?.pending.cancel();
  }
  async load(handle: ManagedWatchlistPriceHandle) {
    const entry = this.entries.find((item) => item.handle === handle);
    if (!entry || !this.canRead || this.operation || this.state.catalogChanged)
      return;
    const operation: Operation = {
      entry,
      pending: Object.freeze({
        listing: entry.listing,
        cancel: () => {
          if (this.operation !== operation) return;
          this.operation = null;
          entry.model.cancel();
          this.publish();
        },
      }),
    };
    this.operation = operation;
    try {
      await entry.model.load();
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        this.publish();
      }
    }
  }
  seed(handle: ManagedWatchlistPriceHandle): ManagedEodHistorySeed | null {
    const entry = this.entries.find((item) => item.handle === handle);
    if (!entry) return null;
    const { selection, response, running, catalogChanged, showingPrevious } =
      entry.model.getSnapshot();
    return selection && response && !running && !catalogChanged
      ? captureManagedEodHistorySeed(selection, { response, showingPrevious })
      : null;
  }
}
