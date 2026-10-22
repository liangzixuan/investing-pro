import {
  encodeMainWatchlistPayload,
  parseManagedSecFilingsRequest,
  parseManagedSecFilingsResponse,
  parseManagedWatchlistCommand,
  type MainWatchlistPayload,
  type ManagedSecFilingsResponseDto,
  type ManagedWatchlistDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { TrialApiError } from "../../src/clerk-trial/api";
import { filingReferenceNoteExcerpt } from "../../src/clerk-trial/managed-filings-note";
import { inventedFilingsPacket } from "./filings-fixture";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";

type State = ReturnType<SharedNativeFixture["getSnapshot"]>;
type Counter =
  | "load"
  | "save"
  | "status"
  | "filings"
  | "filingsAborted"
  | "filingsLateResolved"
  | "annual"
  | "eod"
  | "calendar"
  | "fed"
  | "resolve"
  | "search";
type CoverageRow = SharedNativeFixture["researchCoverage"]["listings"][number];
const sequence = [
  "listing-zero",
  "listing-one",
  "listing-zero",
  "listing-one",
  "listing-one",
];

function requireFixture(value: unknown): asserts value {
  if (!value) throw new Error("Unexpected invented filing-review action");
}
function packetFor(row: CoverageRow) {
  const original = inventedFilingsPacket(row.listing);
  if (row.cik === original.issuer.cik) return original;
  const filings = original.issuer.filings.slice(0, 2).map((filing) => {
    const accessionNumber = filing.accessionNumber.replace(
      "0000000001",
      row.cik,
    );
    return {
      ...filing,
      cik: row.cik,
      accessionNumber,
      filingDate: "2026-09-20",
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/2/${accessionNumber}-index.htm`,
    };
  });
  const result = parseManagedSecFilingsResponse(
    {
      ...original,
      security: { ...original.security, cik: row.cik },
      window: {
        ...original.window,
        fromDate: "2026-06-24",
        throughDate: "2026-09-21",
      },
      requestStartedAt: "2026-09-21T00:00:00.000Z",
      completedAt: "2026-09-21T00:00:02.000Z",
      issuer: {
        ...original.issuer,
        cik: row.cik,
        sourceUrl: `https://data.sec.gov/submissions/CIK${row.cik}.json`,
        fetchedAt: "2026-09-21T00:00:01.000Z",
        matchingFilings: filings.length,
        filings,
      },
    },
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: original.catalogSnapshotSha256,
      listingId: row.listing.listingId,
      symbol: row.listing.symbol,
    },
  );
  requireFixture(result);
  return result;
}

/** This fixed RAM scenario admits only the declared UI journey and complete save. */
class FilingsReviewStore {
  readonly prefix = "Filing review thesis · Café 東京 📈";
  readonly expectedNote: string;
  private readonly packets: Map<string, ManagedSecFilingsResponseDto>;
  private readonly listeners = new Set<() => void>();
  private readonly overrides: Partial<Record<Counter, number>> = {};
  private state: State;
  private original: MainWatchlistPayload | null = null;
  private saved: ManagedWatchlistDto | null = null;
  private pending: {
    signal: AbortSignal;
    packet: ManagedSecFilingsResponseDto;
    resolve: (value: ManagedSecFilingsResponseDto) => void;
  } | null = null;
  constructor(private readonly base: SharedNativeFixture) {
    this.state = base.getSnapshot();
    this.packets = new Map(
      base.researchCoverage.listings.map((row) => [
        row.listing.listingId,
        packetFor(row),
      ]),
    );
    const first = this.packets.get("listing-zero")!;
    this.expectedNote = `${this.prefix} ${filingReferenceNoteExcerpt(first, first.issuer.filings[0]!, false)}`;
    base.subscribe(this.publish);
  }
  private readonly publish = () => {
    this.state = { ...this.base.getSnapshot(), ...this.overrides };
    for (const listener of this.listeners) listener();
  };
  private count(key: Counter) {
    this.overrides[key] = this.state[key] + 1;
    this.publish();
  }
  private checkCounters(expected: Partial<Record<Counter, number>>) {
    for (const [key, value] of Object.entries(expected))
      if (this.state[key as Counter] !== value)
        throw new Error(
          `Unexpected invented filing-review ${key}: expected ${value}, received ${this.state[key as Counter]}`,
        );
  }
  readonly getSnapshot = () => this.state;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly load: ManagedApi["load"] = async (signal) => {
    requireFixture(!signal.aborted);
    this.count("load");
    if (this.state.load === 1) {
      this.saved = structuredClone(await this.base.api.load(signal));
      this.original = structuredClone(this.saved.payload);
    } else {
      this.checkCounters({ load: 2, save: 1 });
      requireFixture(this.saved?.version === 2);
    }
    requireFixture(this.saved);
    return structuredClone(this.saved);
  };
  readonly status: ManagedApi["status"] = (signal) => {
    requireFixture(!signal.aborted);
    this.count("status");
    if (this.state.status === 1) return this.base.api.status(signal);
    this.checkCounters({
      status: 2,
      load: 2,
      save: 1,
      filings: 5,
      filingsAborted: 2,
      filingsLateResolved: 2,
    });
    requireFixture(this.pending);
    return Promise.reject(new TrialApiError("unauthenticated"));
  };
  readonly save: ManagedApi["save"] = (input, signal) => {
    this.count("save");
    requireFixture(!signal.aborted);
    this.checkCounters({
      load: 1,
      save: 1,
      status: 1,
      filings: 2,
      filingsAborted: 0,
      filingsLateResolved: 0,
      annual: 0,
      eod: 0,
      calendar: 0,
      fed: 0,
      resolve: 0,
      search: 0,
    });
    requireFixture(!this.pending);
    requireFixture(this.original);
    const command = parseManagedWatchlistCommand(input);
    requireFixture(command?.expectedVersion === 1);
    const expected = {
      ...this.original,
      memberships: this.original.memberships.map((member) =>
        member.listingId === "listing-zero"
          ? { ...member, note: this.expectedNote }
          : member,
      ),
    };
    requireFixture(
      encodeMainWatchlistPayload(command.payload) ===
        encodeMainWatchlistPayload(expected),
    );
    this.saved = { version: 2, payload: structuredClone(command.payload) };
    return Promise.resolve({ ...structuredClone(this.saved), replayed: false });
  };
  readonly recentFilings: ManagedApi["recentFilings"] = (input, signal) => {
    const index = this.state.filings;
    this.count("filings");
    this.checkReadPhase();
    const request = parseManagedSecFilingsRequest(input);
    requireFixture(request);
    requireFixture(!signal.aborted && !this.pending);
    requireFixture(request.listingId === sequence[index]);
    const packet = this.packets.get(request.listingId);
    requireFixture(packet);
    requireFixture(
      request.catalogSnapshotSha256 === packet.catalogSnapshotSha256,
    );
    requireFixture(request.symbol === packet.security.symbol);
    if (this.state.filings <= 2)
      return Promise.resolve(structuredClone(packet));
    signal.addEventListener("abort", () => this.count("filingsAborted"), {
      once: true,
    });
    return new Promise((resolve) => {
      this.pending = { signal, packet, resolve };
    });
  };
  private checkReadPhase() {
    const read = this.state.filings;
    this.checkCounters({ status: 1, load: read === 5 ? 2 : 1 });
    this.checkCounters({ save: read <= 2 ? 0 : 1 });
    const cancelled = Math.max(0, read - 3);
    this.checkCounters({
      filingsAborted: cancelled,
      filingsLateResolved: cancelled,
    });
  }
  readonly settleCancelledFilings = () => {
    requireFixture(this.pending?.signal.aborted);
    const { packet, resolve } = this.pending;
    this.pending = null;
    // A valid changed empty packet must still be fenced by the actual product model.
    resolve({
      ...packet,
      issuer: { ...packet.issuer, matchingFilings: 0, filings: [] },
    });
    this.count("filingsLateResolved");
  };
  refuse(key: Counter): never {
    this.count(key);
    throw new Error(`Unexpected filing-review operation: ${key}`);
  }
}

export function createFilingsReviewNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const store = new FilingsReviewStore(base);
  return {
    ...base,
    financialReview: null,
    filingsReview: { prefix: store.prefix, expectedNote: store.expectedNote },
    api: {
      ...base.api,
      load: store.load,
      save: store.save,
      status: store.status,
      recentFilings: store.recentFilings,
      annualReport: () => store.refuse("annual"),
      eodHistory: () => store.refuse("eod"),
      economicCalendar: () => store.refuse("calendar"),
      monetaryAnnouncements: () => store.refuse("fed"),
      search: () => store.refuse("search"),
    },
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    settleCancelledFilings: store.settleCancelledFilings,
  };
}
