import {
  MANAGED_BLS_CALENDAR_SOURCE,
  encodeMainWatchlistPayload,
  parseManagedBlsCalendar,
  parseManagedEconomicCalendar,
  parseManagedEodHistoryResponse,
  parseManagedMonetaryAnnouncements,
  parseManagedWatchlistCommand,
  type ManagedEodHistoryRequestDto,
  type ManagedBlsCalendarDto,
} from "@research-cockpit/contracts";
import { economicCalendarFixture } from "../../src/clerk-trial/economic-calendar-fixture";
import { eodResponse } from "../../src/clerk-trial/eod-history-fixture";
import { fedAnnouncementsFixture } from "../../src/clerk-trial/fed-announcements-fixture";
import type { SharedNativeFixture } from "./fixture";

export const sourceReviewNote =
  "Source review keeps this independent authored note. Café 東京 📈";
const digest = `sha256:${"a".repeat(64)}` as const;
const firstOrder = ["price-0", "price-1", "price-2", "bls", "bea", "fed"];
interface Counts {
  readonly order: readonly string[];
  readonly prices: number;
  readonly bls: number;
  readonly bea: number;
  readonly fed: number;
  readonly save: number;
  readonly aborted: number;
  readonly late: number;
}
export interface SourceReviewFixtureControls {
  readonly getSnapshot: () => Counts;
  readonly subscribe: (listener: () => void) => () => void;
  readonly settleCancelledBls: () => void;
}
function refuse(): never {
  throw new Error("Unexpected invented source-review action");
}
type Api = SharedNativeFixture["api"];
type Stored = Awaited<ReturnType<Api["load"]>>;
export function sourceReviewBlsPacket() {
  const packet = parseManagedBlsCalendar({
    ...economicCalendarFixture(),
    source: MANAGED_BLS_CALENDAR_SOURCE,
    events: [],
  });
  if (!packet) return refuse();
  return packet;
}
function beaPacket() {
  const packet = parseManagedEconomicCalendar({
    ...economicCalendarFixture(),
    fetchedAt: "2026-10-21T19:00:00.000Z",
    window: {
      fromInclusive: "2026-10-21T19:00:00.000Z",
      toExclusive: "2026-11-20T19:00:00.000Z",
    },
  });
  if (!packet) return refuse();
  return packet;
}
function fedPacket() {
  const packet = parseManagedMonetaryAnnouncements({
    ...fedAnnouncementsFixture(),
    fetchedAt: "2026-10-22T20:00:00.000Z",
  });
  if (!packet) return refuse();
  return packet;
}
class SourceReviewStore {
  private counts: Counts = {
    order: [],
    prices: 0,
    bls: 0,
    bea: 0,
    fed: 0,
    save: 0,
    aborted: 0,
    late: 0,
  };
  private stored: Stored | null = null;
  private pending: ((packet: ManagedBlsCalendarDto) => void) | null = null;
  private readonly listeners = new Set<() => void>();
  private state: ReturnType<SharedNativeFixture["getSnapshot"]>;
  constructor(private readonly base: SharedNativeFixture) {
    this.state = base.getSnapshot();
    base.subscribe(this.publish);
  }
  readonly getCounts = () => this.counts;
  readonly getSnapshot = () => this.state;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private readonly publish = () => {
    this.state = {
      ...this.base.getSnapshot(),
      marketsEod: this.counts.prices,
      save: this.counts.save,
    };
    for (const listener of this.listeners) listener();
  };
  private record(kind: Exclude<keyof Counts, "order">, source?: string) {
    this.counts = {
      ...this.counts,
      [kind]: this.counts[kind] + 1,
      order: source ? [...this.counts.order, source] : this.counts.order,
    };
    this.publish();
  }
  private admit(source: string, signal: AbortSignal) {
    if (signal.aborted) refuse();
    if (firstOrder[this.counts.order.length] !== source) refuse();
  }
  readonly load: Api["load"] = async (signal) => {
    const loaded = await this.base.api.load(signal);
    this.stored ??= loaded;
    return structuredClone(this.stored);
  };
  readonly eodHistory: Api["eodHistory"] = (request, signal) => {
    const index = this.counts.prices,
      listing = this.base.marketsCohort[index];
    this.admit(`price-${index}`, signal);
    if (!listing) return refuse();
    if (request.listingId !== listing.listingId) return refuse();
    if (request.catalogSnapshotSha256 !== digest) return refuse();
    if (request.range !== "1m") return refuse();
    const packet = this.pricePacket(request, listing);
    this.record("prices", `price-${index}`);
    return Promise.resolve(packet);
  };
  private pricePacket(
    request: ManagedEodHistoryRequestDto,
    listing: SharedNativeFixture["marketsCohort"][number],
  ) {
    const packet = parseManagedEodHistoryResponse(
      { ...eodResponse(), catalogSnapshotSha256: digest, security: listing },
      request,
    );
    if (!packet) return refuse();
    return packet;
  }
  readonly blsCalendar: Api["blsCalendar"] = (signal) => {
    if (this.counts.bls === 0) {
      this.admit("bls", signal);
      this.record("bls", "bls");
      return Promise.resolve(sourceReviewBlsPacket());
    }
    if (signal.aborted) return refuse();
    if (this.counts.bls !== 1) return refuse();
    if (this.counts.order.join("|") !== firstOrder.join("|")) return refuse();
    const pending = new Promise<ManagedBlsCalendarDto>((resolve) => {
      this.pending = resolve;
    });
    signal.addEventListener("abort", () => this.record("aborted"), {
      once: true,
    });
    this.record("bls", "bls-refresh");
    return pending;
  };
  readonly economicCalendar: Api["economicCalendar"] = (signal) => {
    this.admit("bea", signal);
    this.record("bea", "bea");
    return Promise.resolve(beaPacket());
  };
  readonly monetaryAnnouncements: Api["monetaryAnnouncements"] = (signal) => {
    this.admit("fed", signal);
    this.record("fed", "fed");
    return Promise.resolve(fedPacket());
  };
  readonly settleCancelledBls = () => {
    if (!this.pending) return refuse();
    if (this.counts.aborted !== 1) return refuse();
    if (this.counts.late !== 0) return refuse();
    const resolve = this.pending;
    this.pending = null;
    resolve({
      ...sourceReviewBlsPacket(),
      fetchedAt: "2026-10-23T18:00:00.000Z",
      window: {
        fromInclusive: "2026-10-23T18:00:00.000Z",
        toExclusive: "2026-11-22T18:00:00.000Z",
      },
    });
    void Promise.resolve().then(() => this.record("late"));
  };
  private captureSave(input: Parameters<Api["save"]>[0], signal: AbortSignal) {
    if (signal.aborted) return refuse();
    if (!this.stored) return refuse();
    if (this.counts.save !== 0) return refuse();
    if (this.counts.late !== 1) return refuse();
    const command = parseManagedWatchlistCommand(input);
    if (command?.expectedVersion !== 1) return refuse();
    const expected = {
      ...this.stored.payload,
      memberships: this.stored.payload.memberships.map((member, index) =>
        index === 0 ? { ...member, note: sourceReviewNote } : member,
      ),
    };
    if (
      encodeMainWatchlistPayload(command.payload) !==
      encodeMainWatchlistPayload(expected)
    )
      return refuse();
    return command;
  }
  readonly save: Api["save"] = (input, signal) => {
    const command = this.captureSave(input, signal);
    this.stored = { version: 2, payload: structuredClone(command.payload) };
    this.record("save");
    return Promise.resolve({
      ...structuredClone(this.stored),
      replayed: false,
    });
  };
}
/** This isolated scenario wraps only the existing exact source APIs and RAM Watchlist. */
export function createMarketsSourceReviewNativeFixture(
  base: SharedNativeFixture,
) {
  const store = new SourceReviewStore(base);
  return {
    ...base,
    financialReview: null,
    sourceReview: {
      getSnapshot: store.getCounts,
      subscribe: store.subscribe,
      settleCancelledBls: store.settleCancelledBls,
    },
    api: {
      ...base.api,
      load: store.load,
      save: store.save,
      eodHistory: store.eodHistory,
      blsCalendar: store.blsCalendar,
      economicCalendar: store.economicCalendar,
      monetaryAnnouncements: store.monetaryAnnouncements,
    },
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
  };
}
