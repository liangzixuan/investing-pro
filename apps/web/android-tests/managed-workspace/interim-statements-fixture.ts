import {
  encodeMainWatchlistPayload,
  parseManagedWatchlistCommand,
  parseManagedSecInterimCanonicalRequest,
  type MainWatchlistPayload,
  type ManagedWatchlistDto,
  type PersonalSecInterimCanonicalResponseDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import {
  prepareManagedInterimStatementsNote,
  type ManagedInterimCellSelection,
} from "../../src/clerk-trial/managed-interim-statements-note";
import { parseSecInterimCanonicalResponse } from "../../src/lib/sec-interim-canonical-response";
import { buildInterimFixture } from "./interim-report-packet";
import type { SharedNativeFixture } from "./fixture";

const prefix = "Thèse café 📈";
const selectedCells = Object.freeze([
  {
    concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
    periodKey: JSON.stringify(["duration", "2026-04-01", "2026-06-30"]),
  },
  {
    concept: "NetCashProvidedByUsedInOperatingActivities",
    periodKey: JSON.stringify(["duration", "2026-01-01", "2026-06-30"]),
  },
  {
    concept: "Assets",
    periodKey: JSON.stringify(["instant", null, "2026-06-30"]),
  },
] satisfies ManagedInterimCellSelection[]);
export interface NativeInterimStatementsMetadata {
  readonly prefix: string;
  readonly expectedNote: string;
  readonly selectedCells: readonly ManagedInterimCellSelection[];
  readonly issuers: readonly string[];
  readonly generation: PersonalSecInterimCanonicalResponseDto["evidence"]["generation"];
  readonly pins: Readonly<{
    reportDate: string;
    filedDate: string;
    accession: string;
    quarterRevenue: string;
    ytdRevenue: string;
    ytdCash: string;
    assets: string;
  }>;
}
type State = ReturnType<SharedNativeFixture["getSnapshot"]>;
type Counter =
  | "load"
  | "status"
  | "save"
  | "interimReport"
  | "interimPortfolioLoad"
  | "interimPortfolioSave"
  | "interimFollowupsLoad"
  | "interimFollowupsSave"
  | "annual"
  | "eod"
  | "filings"
  | "search"
  | "calendar"
  | "fed";
type InterimRequest = Parameters<ManagedApi["interimReport"]>[0];
type WatchlistCommand = NonNullable<
  ReturnType<typeof parseManagedWatchlistCommand>
>;
function invalidSourceRequest(): never {
  throw new Error("Unexpected interim source request or order");
}
function admitWatchlistRead(signal: AbortSignal, state: State): void {
  const refuse = () => {
    throw new Error("Unexpected interim Watchlist read");
  };
  if (signal.aborted) refuse();
  if (state.load >= 2) refuse();
  if (state.load !== 1) return;
  if (state.save !== 1) refuse();
}
function admitSourceVisit(signal: AbortSignal, state: State): void {
  if (signal.aborted) invalidSourceRequest();
  if (state.interimReport !== 0) invalidSourceRequest();
  if (state.load !== 1) invalidSourceRequest();
  if (state.status !== 1) invalidSourceRequest();
}
function admitSourceIdentity(
  input: InterimRequest,
  original: MainWatchlistPayload | null,
  packet: PersonalSecInterimCanonicalResponseDto,
): void {
  if (input.schemaVersion !== "1.0.0") invalidSourceRequest();
  if (input.catalogSnapshotSha256 !== original?.snapshotSha256)
    invalidSourceRequest();
  if (input.listingId !== packet.security.listingId) invalidSourceRequest();
  if (input.symbol !== packet.security.symbol) invalidSourceRequest();
}
function expectedSavedWatchlist(
  original: MainWatchlistPayload | null,
  listingId: string,
  note: string,
): MainWatchlistPayload | null {
  if (!original) return null;
  if (!original.memberships.some((member) => member.listingId === listingId))
    return null;
  return {
    ...original,
    memberships: original.memberships.map((member) =>
      member.listingId === listingId ? { ...member, note } : member,
    ),
  };
}
function unsavedInterimVisit(state: State): boolean {
  if (state.save !== 0) return false;
  if (state.load !== 1) return false;
  if (state.status !== 1) return false;
  return state.interimReport === 1;
}
function expectedSaveVersion(
  saved: ManagedWatchlistDto | null,
  captured: WatchlistCommand,
): boolean {
  if (saved?.version !== 1) return false;
  return captured.expectedVersion === 1;
}
export async function createInterimStatementsNativeFixture(
  base: SharedNativeFixture,
) {
  const known = base.researchCoverage.listings[0]!;
  const l = known.listing;
  const captured = parseManagedSecInterimCanonicalRequest({
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
    listingId: l.listingId,
    symbol: l.symbol,
  });
  if (!captured) throw new Error("Invalid invented interim request identity");
  const packet = await buildInterimFixture({
    catalogSnapshotSha256: captured.catalogSnapshotSha256,
    security: {
      listingId: l.listingId,
      symbol: l.symbol,
      issuerId: l.issuerId,
      issuerName: l.issuerName,
      securityName: l.securityName,
      country: l.country,
      exchangeMic: l.exchangeMic,
      cik: known.cik,
    },
  });
  const request = {
    schemaVersion: "1.0.0" as const,
    catalogSnapshotSha256: packet.catalogSnapshotSha256,
    listingId: l.listingId,
    symbol: l.symbol,
  };
  const owned = await parseSecInterimCanonicalResponse(
    packet,
    request,
    new AbortController().signal,
  );
  if (!owned) throw new Error("Invalid invented interim packet");
  const prepared = prepareManagedInterimStatementsNote({
    response: owned,
    selection: selectedCells,
    note: prefix,
    showingPrevious: false,
    isCurrent: () => true,
    apply: () => {
      throw new Error("Expected-note construction cannot append");
    },
  });
  if (!prepared.preview)
    throw new Error(`Invalid invented interim note: ${prepared.reason}`);
  const expectedNote = prepared.preview.note;
  const overrides: Partial<Record<Counter, number>> = {};
  let snapshot: State = base.getSnapshot();
  const listeners = new Set<() => void>();
  const publish = () => {
    snapshot = { ...base.getSnapshot(), ...overrides };
    for (const listener of listeners) listener();
  };
  base.subscribe(publish);
  const count = (key: Counter) => {
    overrides[key] = snapshot[key] + 1;
    publish();
  };
  const unexpected = (name: string): Promise<never> =>
    Promise.reject(new Error(`Unexpected invented interim action: ${name}`));
  let saved: ManagedWatchlistDto | null = null;
  let original: MainWatchlistPayload | null = null;
  const unrelated = () =>
    snapshot.eod +
      snapshot.interimPortfolioLoad +
      snapshot.interimPortfolioSave +
      snapshot.interimFollowupsLoad +
      snapshot.interimFollowupsSave +
      snapshot.annual +
      snapshot.filings +
      snapshot.search +
      snapshot.resolve +
      snapshot.marketsEod +
      snapshot.calendar +
      snapshot.fed +
      snapshot.token +
      snapshot.signOut !==
    0;
  const api: ManagedApi = {
    ...base.api,
    load: async (signal) => {
      admitWatchlistRead(signal, snapshot);
      count("load");
      if (snapshot.load === 1) {
        saved = structuredClone(await base.api.load(signal));
        original = structuredClone(saved.payload);
      }
      if (!saved)
        throw new Error("Load invented Watchlist before interim research");
      return structuredClone(saved);
    },
    status: (signal) => {
      if (signal.aborted || snapshot.status !== 0)
        throw new Error("Unexpected interim catalog read");
      count("status");
      return base.api.status(signal);
    },
    interimReport: (input, signal) => {
      admitSourceVisit(signal, snapshot);
      admitSourceIdentity(input, original, packet);
      count("interimReport");
      return Promise.resolve(structuredClone(packet));
    },
    save: (command, signal) => {
      const captured = parseManagedWatchlistCommand(command);
      const expected = expectedSavedWatchlist(
        original,
        l.listingId,
        expectedNote,
      );
      if (!captured) return unexpected("save");
      if (!expected) return unexpected("save");
      if (signal.aborted) return unexpected("save");
      if (!unsavedInterimVisit(snapshot)) return unexpected("save");
      if (!expectedSaveVersion(saved, captured)) return unexpected("save");
      if (unrelated()) return unexpected("save");
      if (
        encodeMainWatchlistPayload(captured.payload) !==
        encodeMainWatchlistPayload(expected)
      )
        return unexpected("save");
      count("save");
      saved = { version: 2, payload: structuredClone(captured.payload) };
      return Promise.resolve({ ...structuredClone(saved), replayed: false });
    },
    annualReport: () => {
      count("annual");
      return unexpected("annual");
    },
    eodHistory: () => {
      count("eod");
      return unexpected("eod");
    },
    recentFilings: () => {
      count("filings");
      return unexpected("filings");
    },
    search: () => {
      count("search");
      return unexpected("search");
    },
    economicCalendar: () => {
      count("calendar");
      return unexpected("calendar");
    },
    monetaryAnnouncements: () => {
      count("fed");
      return unexpected("fed");
    },
    loadPortfolio: () => {
      count("interimPortfolioLoad");
      return unexpected("loadPortfolio");
    },
    savePortfolio: () => {
      count("interimPortfolioSave");
      return unexpected("savePortfolio");
    },
    loadFollowups: () => {
      count("interimFollowupsLoad");
      return unexpected("loadFollowups");
    },
    saveFollowups: () => {
      count("interimFollowupsSave");
      return unexpected("saveFollowups");
    },
  };
  return {
    ...base,
    api,
    financialReview: null,
    interimReview: Object.freeze({
      prefix,
      expectedNote,
      selectedCells,
      issuers: Object.freeze([known.cik]),
      generation: packet.evidence.generation,
      pins: Object.freeze({
        reportDate: "2026-06-30",
        filedDate: "2026-07-30",
        accession: "0000000001-26-000002",
        quarterRevenue: "40",
        ytdRevenue: "75",
        ytdCash: "9",
        assets: "120",
      }),
    }),
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    settleCancelledRead: () => {
      throw new Error("Interim journey has no held source read");
    },
    enableRefreshScenario: () => {
      throw new Error("Interim journey permits one explicit read");
    },
    failRefresh: () => {
      throw new Error("Interim journey has no synthetic refresh failure");
    },
  };
}
