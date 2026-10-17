import {
  parseManagedCatalogResolveRequest,
  parseManagedCatalogResolveResponse,
  parseManagedSecAnnualCanonicalRequest,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { annualReportPacket } from "../../src/clerk-trial/test-annual-report-fixture";
import {
  bindAnnualPacket,
  replaceConceptRows,
  type TestAnnualPacket,
} from "../../src/lib/test-personal-sec-annual-api-fixture";
import { parseSecAnnualCanonicalResponse } from "../../src/lib/sec-annual-canonical-response";
import type { SharedNativeFixture } from "./fixture";

export const financialScreenListingIds = Object.freeze(["listing-zero"]);
export const financialScreenPins = Object.freeze({
  operatingCashFlow: "120.125",
  operatingCashFlowLessPpePurchases: "100.1",
  workingCapital: "40.1",
  shareholdersEquity: "-200.125",
  currentRatio: "1.50",
});

/** Synthetic graph construction uses the real hashes and owning canonical decoder. */
export async function financialScreenPacket() {
  const packet = structuredClone(
    await annualReportPacket(),
  ) as TestAnnualPacket;
  replaceConceptRows(packet, "OperatingIncomeLoss", []);
  for (const [concept, value] of [
    ["NetCashProvidedByUsedInOperatingActivities", "120.125"],
    ["PaymentsToAcquirePropertyPlantAndEquipment", "20.025"],
    ["AssetsCurrent", "120.125"],
    ["LiabilitiesCurrent", "80.025"],
    ["StockholdersEquity", "-200.125"],
  ] as const) {
    const original = packet.evidence.facts.observations.find(
      (row) => row.concept === concept,
    )!;
    replaceConceptRows(packet, concept, [{ ...original, value }]);
  }
  const bound = await bindAnnualPacket(packet);
  const admitted = await parseSecAnnualCanonicalResponse(
    bound,
    {
      schemaVersion: "6.0.0",
      catalogSnapshotSha256: bound.catalogSnapshotSha256,
      listingId: bound.security.listingId,
      symbol: bound.security.symbol,
    },
    new AbortController().signal,
  );
  if (!admitted)
    throw new Error("Invented financial screen packet was refused");
  return admitted;
}
export interface NativeFinancialScreenMetadata {
  readonly listingIds: readonly string[];
  readonly pins: typeof financialScreenPins;
  readonly generation: PersonalSecAnnualCanonicalResponseDto["evidence"]["generation"];
}
type State = ReturnType<SharedNativeFixture["getSnapshot"]>;
type Counter =
  | "resolve"
  | "annual"
  | "save"
  | "eod"
  | "filings"
  | "search"
  | "calendar"
  | "fed";

/** One exact issuer, one explicit cohort resolve and one explicit Annual request. */
export async function createFinancialScreenNativeFixture(
  base: SharedNativeFixture,
) {
  const packet = await financialScreenPacket();
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
  const unexpected = (operation: string): Promise<never> =>
    Promise.reject(
      new Error(`Unexpected financial screen operation: ${operation}`),
    );
  const unrelated = () =>
    snapshot.save +
      snapshot.eod +
      snapshot.filings +
      snapshot.search +
      snapshot.calendar +
      snapshot.fed +
      snapshot.token +
      snapshot.signOut !==
    0;
  const api: ManagedApi = {
    ...base.api,
    load: (signal) =>
      signal.aborted || snapshot.load !== 0
        ? unexpected("load")
        : base.api.load(signal),
    status: (signal) =>
      signal.aborted || snapshot.status !== 0
        ? unexpected("status")
        : base.api.status(signal),
    resolve: (input, signal) => {
      const request = parseManagedCatalogResolveRequest(input);
      if (
        request?.listingIds.join("|") ===
        base.marketsCohort.map((row) => row.listingId).join("|")
      ) {
        if (
          snapshot.marketsResolve !== 0 ||
          snapshot.resolve !== 0 ||
          snapshot.annual !== 0 ||
          snapshot.load !== 1 ||
          snapshot.status !== 1 ||
          unrelated()
        )
          return unexpected("startup resolve");
        return base.api.resolve(input, signal);
      }
      if (
        signal.aborted ||
        request?.snapshotSha256 !== packet.catalogSnapshotSha256 ||
        request.listingIds.join("|") !== financialScreenListingIds.join("|") ||
        snapshot.load !== 1 ||
        snapshot.status !== 1 ||
        snapshot.marketsResolve !== 1 ||
        snapshot.resolve !== 0 ||
        snapshot.annual !== 0 ||
        unrelated()
      )
        return unexpected("screen resolve");
      const identity = {
        ...packet.security,
        instrumentType: "common_stock" as const,
        securityId: "security-zero",
        shareClassId: "class-zero",
        shareClassName: "Class A",
      };
      const { cik: _cik, ...publicIdentity } = identity;
      void _cik;
      const resolved = parseManagedCatalogResolveResponse(
        {
          snapshotSha256: packet.catalogSnapshotSha256,
          results: [{ listingId: "listing-zero", listing: publicIdentity }],
        },
        request,
      );
      if (!resolved) throw new Error("Invented screening identity was refused");
      count("resolve");
      return Promise.resolve(resolved);
    },
    annualReport: (input, signal) => {
      const request = parseManagedSecAnnualCanonicalRequest(input);
      if (
        signal.aborted ||
        request?.catalogSnapshotSha256 !== packet.catalogSnapshotSha256 ||
        request.listingId !== "listing-zero" ||
        request.symbol !== "ZERO" ||
        snapshot.load !== 1 ||
        snapshot.status !== 1 ||
        snapshot.marketsResolve !== 1 ||
        snapshot.resolve !== 1 ||
        snapshot.annual !== 0 ||
        unrelated()
      )
        return unexpected("annualReport");
      count("annual");
      return Promise.resolve(structuredClone(packet));
    },
    save: () => {
      count("save");
      return unexpected("save");
    },
    eodHistory: () => {
      count("eod");
      return unexpected("eodHistory");
    },
    recentFilings: () => {
      count("filings");
      return unexpected("recentFilings");
    },
    search: () => {
      count("search");
      return unexpected("search");
    },
    economicCalendar: () => {
      count("calendar");
      return unexpected("economicCalendar");
    },
    monetaryAnnouncements: () => {
      count("fed");
      return unexpected("monetaryAnnouncements");
    },
    loadPortfolio: () => unexpected("loadPortfolio"),
    savePortfolio: () => unexpected("savePortfolio"),
    loadFollowups: () => unexpected("loadFollowups"),
    saveFollowups: () => unexpected("saveFollowups"),
  };
  return {
    ...base,
    api,
    financialReview: null,
    financialScreen: Object.freeze({
      listingIds: financialScreenListingIds,
      pins: financialScreenPins,
      generation: packet.evidence.generation,
    }),
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
