import {
  encodeMainWatchlistPayload,
  parseManagedWatchlistCommand,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { prepareManagedInterimStatementsNote } from "../../src/clerk-trial/managed-interim-statements-note";
import { parseSecInterimCanonicalResponse } from "../../src/lib/sec-interim-canonical-response";
import type { SharedNativeFixture } from "./fixture";
import type { NativeInterimStatementsMetadata } from "./interim-statements-fixture";
import { buildInterimFixture } from "./interim-report-packet";

type State = ReturnType<SharedNativeFixture["getSnapshot"]>;
type Api = SharedNativeFixture["api"];
type Stored = Awaited<ReturnType<Api["load"]>>;
export interface ReviewedCompanySourcePassControls {
  readonly settleCancelledAnnual: () => void;
  readonly getSnapshot: () => Readonly<{
    order: readonly string[];
    aborted: number;
    late: number;
  }>;
  readonly subscribe: (listener: () => void) => () => void;
}
function refuse(): never {
  throw new Error("Unexpected invented reviewed company source pass action");
}
async function interimEvidence(base: SharedNativeFixture) {
  const known = base.researchCoverage.listings[0]!;
  const listing = known.listing;
  const packet = await buildInterimFixture({
    catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
    security: {
      listingId: listing.listingId,
      symbol: listing.symbol,
      issuerId: listing.issuerId,
      issuerName: listing.issuerName,
      securityName: listing.securityName,
      country: listing.country,
      exchangeMic: listing.exchangeMic,
      cik: known.cik,
    },
  });
  const request = {
    schemaVersion: "1.0.0" as const,
    catalogSnapshotSha256: packet.catalogSnapshotSha256,
    listingId: listing.listingId,
    symbol: listing.symbol,
  };
  const owned = await parseSecInterimCanonicalResponse(
    packet,
    request,
    new AbortController().signal,
  );
  if (!owned) return refuse();
  const selectedCells: NativeInterimStatementsMetadata["selectedCells"] = [
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
  ];
  const prefix = "Thèse café 📈";
  const prepared = prepareManagedInterimStatementsNote({
    response: owned,
    selection: selectedCells,
    note: prefix,
    showingPrevious: false,
    isCurrent: () => true,
    apply: refuse,
  });
  if (!prepared.preview) return refuse();
  const metadata: NativeInterimStatementsMetadata = {
    prefix,
    expectedNote: prepared.preview.note,
    selectedCells,
    issuers: [known.cik],
    generation: packet.evidence.generation,
    pins: {
      reportDate: "2026-06-30",
      filedDate: "2026-07-30",
      accession: "0000000001-26-000002",
      quarterRevenue: "40",
      ytdRevenue: "75",
      ytdCash: "9",
      assets: "120",
    },
  };
  return { packet, metadata };
}

/** One held invented Annual read exercises Cancel and a later explicitly reviewed continuation. */
export async function createReviewedCompanySourcePassNativeFixture(
  base: SharedNativeFixture,
) {
  const { packet, metadata } = await interimEvidence(base);
  let stored: Stored | null = null;
  let original: Stored | null = null;
  let annual: PersonalSecAnnualCanonicalResponseDto | null = null;
  let pending: ((value: PersonalSecAnnualCanonicalResponseDto) => void) | null =
    null;
  let snapshot: State = base.getSnapshot();
  let observations = { order: [] as readonly string[], aborted: 0, late: 0 };
  const overrides: Partial<State> = {};
  const listeners = new Set<() => void>();
  const publish = () => {
    snapshot = { ...base.getSnapshot(), ...overrides };
    for (const listener of listeners) listener();
  };
  base.subscribe(publish);
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const record = (name: "eod" | "annual" | "filings" | "interimReport") => {
    overrides[name] = snapshot[name] + 1;
    observations = { ...observations, order: [...observations.order, name] };
    publish();
  };
  const admit = (
    signal: AbortSignal,
    input: { catalogSnapshotSha256: string; listingId: string },
  ) => {
    if (signal.aborted || !original) refuse();
    if (snapshot.load !== 1 || snapshot.status !== 1 || snapshot.save !== 0)
      refuse();
    if (
      input.catalogSnapshotSha256 !== packet.catalogSnapshotSha256 ||
      input.listingId !== packet.security.listingId
    )
      refuse();
  };
  const controls: ReviewedCompanySourcePassControls = {
    subscribe,
    getSnapshot: () => observations,
    settleCancelledAnnual: () => {
      if (
        !pending ||
        !annual ||
        observations.aborted !== 1 ||
        observations.late !== 0
      )
        return refuse();
      const resolve = pending;
      pending = null;
      resolve(structuredClone(annual));
      void Promise.resolve().then(() => {
        observations = { ...observations, late: 1 };
        publish();
      });
    },
  };
  const api: Api = {
    ...base.api,
    load: async (signal) => {
      if (
        signal.aborted ||
        snapshot.load > 1 ||
        (snapshot.load === 1 && snapshot.save !== 1)
      )
        refuse();
      const count = snapshot.load;
      if (!stored) {
        stored = structuredClone(await base.api.load(signal));
        original = structuredClone(stored);
      }
      overrides.load = count + 1;
      publish();
      return structuredClone(stored);
    },
    eodHistory: (input, signal) => {
      admit(signal, input);
      if (snapshot.eod !== 0 || snapshot.annual !== 0) return refuse();
      record("eod");
      return base.api.eodHistory(input, signal);
    },
    annualReport: async (input, signal) => {
      admit(signal, input);
      if (snapshot.eod !== 1 || snapshot.annual > 1 || snapshot.filings !== 0)
        return refuse();
      if (snapshot.annual === 1) {
        if (!annual || pending || observations.late !== 1) return refuse();
        record("annual");
        return structuredClone(annual);
      }
      record("annual");
      annual = await base.api.annualReport(input, signal);
      return new Promise<PersonalSecAnnualCanonicalResponseDto>((resolve) => {
        pending = resolve;
        signal.addEventListener(
          "abort",
          () => {
            observations = {
              ...observations,
              aborted: observations.aborted + 1,
            };
            publish();
          },
          { once: true },
        );
        publish();
      });
    },
    recentFilings: (input, signal) => {
      admit(signal, input);
      if (snapshot.annual !== 2 || snapshot.filings !== 0 || pending)
        return refuse();
      record("filings");
      return base.api.recentFilings(input, signal);
    },
    interimReport: (input, signal) => {
      admit(signal, input);
      if (
        input.symbol !== packet.security.symbol ||
        snapshot.filings !== 1 ||
        snapshot.interimReport !== 0
      )
        return refuse();
      record("interimReport");
      return Promise.resolve(structuredClone(packet));
    },
    save: (input, signal) => {
      const command = parseManagedWatchlistCommand(input);
      if (!original || !stored || !command || signal.aborted) return refuse();
      if (
        snapshot.save !== 0 ||
        snapshot.interimReport !== 1 ||
        command.expectedVersion !== 1
      )
        return refuse();
      const expected = {
        ...original.payload,
        memberships: original.payload.memberships.map((member, index) =>
          index === 0 ? { ...member, note: metadata.expectedNote } : member,
        ),
      };
      if (
        encodeMainWatchlistPayload(command.payload) !==
        encodeMainWatchlistPayload(expected)
      )
        return refuse();
      stored = { version: 2, payload: structuredClone(command.payload) };
      overrides.save = 1;
      publish();
      return Promise.resolve({ ...structuredClone(stored), replayed: false });
    },
  };
  return {
    ...base,
    api,
    financialReview: null,
    interimReview: metadata,
    reviewedCompanySourcePass: controls,
    getSnapshot: () => snapshot,
    subscribe,
  };
}
