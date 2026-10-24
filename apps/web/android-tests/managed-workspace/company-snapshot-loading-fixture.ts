import {
  encodeMainWatchlistPayload,
  parseManagedSecFilingsRequest,
  parseManagedWatchlistCommand,
  type ManagedSecFilingsResponseDto,
} from "@research-cockpit/contracts";
import type { SharedNativeFixture } from "./fixture";
import { inventedFilingsPacket } from "./filings-fixture";

export const snapshotLoadingNote =
  "Snapshot research remains an authored draft";
type Stored = Awaited<ReturnType<SharedNativeFixture["api"]["load"]>>;
type Api = SharedNativeFixture["api"];
export interface SnapshotLoadingFixtureControls {
  readonly settleCancelledFilings: () => void;
}
function refuse(): never {
  throw new Error("Unexpected invented company snapshot loading action");
}

/** Bounded RAM storage and one cancelled source packet belong only to the declared native journey. */
class SnapshotLoadingStore {
  private stored: Stored | null = null;
  private filings = 0;
  private saves = 0;
  private aborted = 0;
  private lateResolved = 0;
  private pending: ((value: ManagedSecFilingsResponseDto) => void) | null =
    null;
  private state: ReturnType<SharedNativeFixture["getSnapshot"]>;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly base: SharedNativeFixture) {
    this.state = base.getSnapshot();
    base.subscribe(this.publish);
  }
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
      filings: this.filings,
      filingsAborted: this.aborted,
      filingsLateResolved: this.lateResolved,
      save: this.saves,
    };
    for (const listener of this.listeners) listener();
  };
  readonly load: Api["load"] = async (signal) => {
    const original = await this.base.api.load(signal);
    this.stored ??= original;
    return structuredClone(this.stored);
  };
  readonly eodHistory: Api["eodHistory"] = (request, signal) => {
    const counts = this.base.getSnapshot();
    if (counts.eod !== 0) refuse();
    if (counts.annual !== 0) refuse();
    return this.base.api.eodHistory(request, signal);
  };
  readonly annualReport: Api["annualReport"] = (request, signal) => {
    const counts = this.base.getSnapshot();
    if (counts.eod !== 1) refuse();
    if (counts.annual !== 0) refuse();
    return this.base.api.annualReport(request, signal);
  };
  private requireInitialSources() {
    const current = this.base.getSnapshot();
    if (current.eod !== 1) refuse();
    if (current.annual !== 1) refuse();
  }
  private requireFilingsRequest(
    input: Parameters<Api["recentFilings"]>[0],
    signal: AbortSignal,
  ) {
    const request = parseManagedSecFilingsRequest(input);
    if (signal.aborted) refuse();
    if (request?.catalogSnapshotSha256 !== `sha256:${"a".repeat(64)}`) refuse();
    if (request?.listingId !== "listing-zero") refuse();
    if (request.symbol !== "ZERO") refuse();
    this.requireInitialSources();
  }
  private latePacket() {
    const member = this.stored?.payload.memberships[0];
    if (!member) return refuse();
    const { note, ...listing } = member;
    void note;
    return inventedFilingsPacket(listing);
  }
  readonly settleCancelledFilings = () => {
    if (!this.pending) refuse();
    if (this.aborted !== 1) refuse();
    if (this.lateResolved !== 0) refuse();
    const resolve = this.pending;
    this.pending = null;
    resolve(this.latePacket());
    // Real model continuations run before the observable settlement marker.
    void Promise.resolve().then(() => {
      this.lateResolved++;
      this.publish();
    });
  };
  private deferFilings(signal: AbortSignal) {
    this.filings++;
    signal.addEventListener(
      "abort",
      () => {
        this.aborted++;
        this.publish();
      },
      { once: true },
    );
    const result = new Promise<ManagedSecFilingsResponseDto>((resolve) => {
      this.pending = resolve;
    });
    this.publish();
    return result;
  }
  readonly recentFilings: Api["recentFilings"] = (input, signal) => {
    this.requireFilingsRequest(input, signal);
    if (this.filings === 0) return this.deferFilings(signal);
    if (this.filings !== 1) return refuse();
    if (this.pending) refuse();
    if (this.lateResolved !== 1) refuse();
    this.filings++;
    this.publish();
    return this.base.api.recentFilings(input, signal);
  };
  private requireSaveReadiness(signal: AbortSignal): Stored {
    if (signal.aborted) return refuse();
    if (!this.stored) return refuse();
    if (this.saves !== 0) refuse();
    if (this.filings !== 2) refuse();
    if (this.lateResolved !== 1) refuse();
    this.requireInitialSources();
    return this.stored;
  }
  private expectedSavedPayload(stored: Stored) {
    return {
      ...stored.payload,
      memberships: stored.payload.memberships.map((member, index) =>
        index === 0 ? { ...member, note: snapshotLoadingNote } : member,
      ),
    };
  }
  private captureSave(input: Parameters<Api["save"]>[0], signal: AbortSignal) {
    const stored = this.requireSaveReadiness(signal);
    const command = parseManagedWatchlistCommand(input);
    if (command?.expectedVersion !== 1) return refuse();
    const expected = this.expectedSavedPayload(stored);
    if (
      encodeMainWatchlistPayload(command.payload) !==
      encodeMainWatchlistPayload(expected)
    )
      refuse();
    return command;
  }
  readonly save: Api["save"] = (input, signal) => {
    const command = this.captureSave(input, signal);
    this.stored = { version: 2, payload: structuredClone(command.payload) };
    this.saves++;
    this.publish();
    return Promise.resolve({
      ...structuredClone(this.stored),
      replayed: false,
    });
  };
}

export function createCompanySnapshotLoadingNativeFixture(
  base: SharedNativeFixture,
) {
  const store = new SnapshotLoadingStore(base);
  return {
    ...base,
    financialReview: null,
    companySnapshotLoading: {
      settleCancelledFilings: store.settleCancelledFilings,
    },
    api: {
      ...base.api,
      load: store.load,
      eodHistory: store.eodHistory,
      annualReport: store.annualReport,
      recentFilings: store.recentFilings,
      save: store.save,
    },
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
  };
}
