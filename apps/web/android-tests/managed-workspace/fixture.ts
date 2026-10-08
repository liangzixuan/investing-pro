import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
  ManagedEodHistoryResponseDto,
  PersonalSecurityMasterSearchResultDto,
  PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import {
  encodeMainWatchlistPayload,
  parseManagedCatalogResolveResponse,
  parseManagedEodHistoryResponse,
  parseManagedWatchlistCommand,
} from "@research-cockpit/contracts";
import {
  ManagedEodHistoryError,
  type ManagedApi,
} from "../../src/clerk-trial/managed-api";
import { listingMembership } from "../../src/clerk-trial/managed-workspace";
import type { TrialSession } from "../../src/clerk-trial/session";
import {
  response,
  row,
} from "../../src/features/research/sec-annual-evidence-fixture";
import { TrialApiError } from "../../src/clerk-trial/api";

const digest = `sha256:${"a".repeat(64)}` as const;
export const annualNoteDraft =
  "Annual research draft Observed Annual report: ZERO (XNAS); 10-K 2025-01-01 to 2025-12-31; Revenues revenue USD 1000; NetIncomeLoss USD 100; net margin 10%. Filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. Original load cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current-use policy at original load: eligible. Evidence dates are unchanged; this action does not refresh sources.";
export const priceNoteDraft =
  "Price research draft Observed raw-close comparison: ZERO (XNAS); 2026-09-17 USD 100.000000000000000001 to latest loaded 2026-09-19 USD 110.000000000000000003; raw close change +$10.000000000000000002 (+10.0000%). Source: Tiingo; requested window 2026-08-20 to 2026-09-20; original request started 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:01.000Z. Raw closes are not adjusted for splits or dividends and are not live quotes. Evidence dates are unchanged; this action does not refresh sources.";
export const marketsPriceNoteDraft =
  "Markets research draft Observed raw-close comparison: BETA (XNAS); 2026-09-18 USD 20.75 to latest loaded 2026-09-19 USD 20.5; raw close change -$0.25 (-1.2048%). Source: Tiingo; requested window 2026-08-20 to 2026-09-20; original request started 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:01.000Z. Raw closes are not adjusted for splits or dividends and are not live quotes. Retained previous history; newer prices were not confirmed. Evidence dates are unchanged; this action does not refresh sources.";
const zero: PersonalSecurityMasterSearchResultDto = {
  cik: "0000000001",
  country: "US",
  exchangeMic: "XNAS",
  instrumentType: "common_stock",
  issuerId: "issuer-zero",
  issuerName: "Zero Company",
  listingId: "listing-zero",
  matchKind: "current_symbol_exact",
  matchedValue: "ZERO",
  securityId: "security-zero",
  securityName: "Zero Class A",
  shareClassId: "class-zero",
  shareClassName: "Class A",
  symbol: "ZERO",
};
const { note, ...identity } = listingMembership(zero);
const marketsCohort = [
  {
    ...identity,
    issuerId: "issuer-alfa",
    issuerName: "Alfa Company",
    listingId: "listing-alfa",
    securityId: "security-alfa",
    securityName: "Alfa Common Stock",
    shareClassId: "class-alfa",
    shareClassName: "Common Stock",
    symbol: "ALFA",
  },
  {
    ...identity,
    issuerId: "issuer-beta",
    issuerName: "Beta Company",
    listingId: "listing-beta-a",
    securityId: "security-beta-a",
    securityName: "Beta Class A",
    shareClassId: "class-beta-a",
    shareClassName: "Class A",
    symbol: "BETA",
  },
  {
    ...identity,
    issuerId: "issuer-beta",
    issuerName: "Beta Company",
    listingId: "listing-beta-c",
    securityId: "security-beta-c",
    securityName: "Beta Class C",
    shareClassId: "class-beta-c",
    shareClassName: "Class C",
    symbol: "BETB",
  },
] as const;
const payload: MainWatchlistPayload = {
  name: "My Watchlist",
  schemaVersion: 1,
  snapshotSha256: digest,
  memberships: [
    { ...identity, note },
    {
      ...identity,
      issuerId: "issuer-one",
      issuerName: "One Company",
      listingId: "listing-one",
      securityId: "security-one",
      securityName: "One Class A",
      shareClassId: "class-one",
      symbol: "ONE",
      note: "Invented second note",
    },
  ],
};
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "android-invented-catalog",
  catalogVersion: "fixture-v1",
  acquiredAt: "2026-09-20T00:00:00.000Z",
  generatedAt: "2026-09-20T00:00:00.000Z",
  asOf: "2026-09-20T00:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented Android test data. No provider was contacted.",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 5,
    activeListings: 5,
    admittedSourceRecords: 5,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 4,
    providerMappings: 0,
    quarantinedSourceRecords: 0,
    sourceRecords: 5,
    staleSourceRecords: 0,
    shareClasses: 5,
    totalSecurities: 5,
    unsupportedSourceRecords: 0,
  },
};

/** Test-APK-only data port. There is no fetch, credential, storage, or native-auth fallback. */
export async function createFixture(
  scenario:
    | "default"
    | "catalog-startup-recovery"
    | "company-direct-entry"
    | "annual-note"
    | "price-comparison-note"
    | "markets-price-handoff"
    | "raw-close-comparison"
    | "markets-selected-price" = "default",
) {
  const annual = await response();
  const recovered = await response(
    [row("Revenues", "2000"), row("NetIncomeLoss", "300")],
    "2026-09-21T00:00:00.000Z",
  );
  const eodPacket = (kind: "initial" | "late" | "recovered") => {
    const request = {
      catalogSnapshotSha256: digest,
      listingId: "listing-zero",
      range: "1m" as const,
    };
    const packet = parseManagedEodHistoryResponse(
      {
        schemaVersion: "1.0.0",
        catalogSnapshotSha256: digest,
        security: identity,
        range: "1m",
        provider: "Tiingo",
        currency: "USD",
        priceBasis: "raw_close",
        window:
          kind === "recovered"
            ? { startDate: "2026-08-21", endDate: "2026-09-21" }
            : { startDate: "2026-08-20", endDate: "2026-09-20" },
        requestStartedAt:
          kind === "recovered"
            ? "2026-09-21T00:00:00.000Z"
            : "2026-09-20T00:00:00.000Z",
        completedAt:
          kind === "recovered"
            ? "2026-09-21T00:00:02.000Z"
            : "2026-09-20T00:00:01.000Z",
        rows:
          scenario === "price-comparison-note" && kind === "initial"
            ? [
                { date: "2026-09-17", close: "100.000000000000000001" },
                { date: "2026-09-18", close: "107.500000000000000002" },
                { date: "2026-09-19", close: "110.000000000000000003" },
              ]
            : kind === "recovered"
              ? [
                  { date: "2026-09-19", close: "102.75" },
                  { date: "2026-09-20", close: "103.5" },
                ]
              : [
                  {
                    date: "2026-09-18",
                    close: kind === "late" ? "998.25" : "100.25",
                  },
                  {
                    date: "2026-09-19",
                    close: kind === "late" ? "999.75" : "101.5",
                  },
                ],
      },
      request,
    );
    if (!packet) throw new Error("Invalid invented EOD packet");
    return packet;
  };
  const eodInitial = eodPacket("initial");
  const eodLate = eodPacket("late");
  const eodRecovered = eodPacket("recovered");
  const marketsPacket = (
    index: number,
    kind: "initial" | "refreshed" | "late",
  ) => {
    const listing = marketsCohort[index];
    if (!listing) throw new Error("Unknown invented Markets listing");
    const request = {
      catalogSnapshotSha256: digest,
      listingId: listing.listingId,
      range: "1m" as const,
    };
    const refreshed = kind === "refreshed";
    const start =
      kind === "late"
        ? "998.25"
        : refreshed
          ? `${(index + 1) * 10 + 1}.25`
          : ["10.25", "20.75", "30.5"][index]!;
    const close =
      kind === "late"
        ? "999.75"
        : `${(index + 1) * 10 + (refreshed ? 1 : 0)}.5`;
    const parsed = parseManagedEodHistoryResponse(
      {
        ...eodInitial,
        security: listing,
        window: refreshed ? eodRecovered.window : eodInitial.window,
        requestStartedAt: refreshed
          ? eodRecovered.requestStartedAt
          : eodInitial.requestStartedAt,
        completedAt: refreshed
          ? eodRecovered.completedAt
          : eodInitial.completedAt,
        rows:
          scenario === "raw-close-comparison" && index === 0 && kind !== "late"
            ? refreshed
              ? [
                  { date: "2026-09-18", close: "120.000000000000000004" },
                  { date: "2026-09-19", close: "126.000000000000000005" },
                  { date: "2026-09-20", close: "132.000000000000000006" },
                ]
              : [
                  { date: "2026-09-17", close: "100.000000000000000001" },
                  { date: "2026-09-18", close: "107.500000000000000002" },
                  { date: "2026-09-19", close: "110.000000000000000003" },
                ]
            : refreshed
              ? [
                  { date: "2026-09-19", close: start },
                  { date: "2026-09-20", close },
                ]
              : [
                  { date: "2026-09-18", close: start },
                  { date: "2026-09-19", close },
                ],
      },
      request,
    );
    if (!parsed) throw new Error("Invalid invented Markets packet");
    return parsed;
  };
  const marketsInitial = marketsCohort.map((_listing, index) =>
    marketsPacket(index, "initial"),
  );
  const marketsRefreshed = marketsPacket(0, "refreshed");
  const selectedPriceScenario =
    scenario === "markets-selected-price" ||
    scenario === "raw-close-comparison";
  const marketsLate = marketsPacket(selectedPriceScenario ? 0 : 1, "late");
  let state = {
    load: 0,
    status: 0,
    search: 0,
    save: 0,
    resolve: 0,
    annual: 0,
    aborted: 0,
    lateResolved: 0,
    token: 0,
    signOut: 0,
    refreshScenario: false,
    refreshFailed: 0,
    catalogRecovery: scenario === "catalog-startup-recovery",
    catalogReleased: 0,
    eod: 0,
    eodAborted: 0,
    eodLateResolved: 0,
    marketsResolve: 0,
    marketsEod: 0,
    marketsAborted: 0,
    marketsLateResolved: 0,
  };
  const listeners = new Set<() => void>();
  const count = (
    key: Exclude<keyof typeof state, "refreshScenario" | "catalogRecovery">,
  ) => {
    state = { ...state, [key]: state[key] + 1 };
    for (const listener of listeners) listener();
  };
  let pending: ((value: PersonalSecAnnualEvidenceResponseDto) => void) | null =
    null;
  let rejectRefresh: ((error: unknown) => void) | null = null;
  let releaseCatalog: (() => void) | null = null;
  let pendingEod: ((value: ManagedEodHistoryResponseDto) => void) | null = null;
  let pendingMarkets: ((value: ManagedEodHistoryResponseDto) => void) | null =
    null;
  const unexpected = (
    key: "save" | "resolve" | "token" | "signOut",
  ): Promise<never> => {
    count(key);
    return Promise.reject(new Error(`Unexpected fixture operation: ${key}`));
  };
  let savedWatchlist = { version: 1, payload: structuredClone(payload) };
  const api: ManagedApi = {
    load: () => {
      count("load");
      return Promise.resolve(structuredClone(savedWatchlist));
    },
    status: () => {
      count("status");
      if (state.catalogRecovery) {
        if (state.status === 1)
          return Promise.reject(new TrialApiError("unavailable"));
        if (state.status === 2)
          return new Promise<{ snapshot: ManagedCatalogSnapshotDto }>(
            (resolve) => {
              releaseCatalog = () =>
                resolve({ snapshot: structuredClone(snapshot) });
            },
          );
        return Promise.reject(
          new Error("Unexpected extra fixture status read"),
        );
      }
      return Promise.resolve({ snapshot: structuredClone(snapshot) });
    },
    search: (query) => {
      count("search");
      if (query !== "ZERO")
        return Promise.reject(new Error("Unexpected fixture query"));
      return Promise.resolve({
        snapshot: structuredClone(snapshot),
        results: [structuredClone(zero)],
        limitApplied: 25,
        totalMatches: 1,
        normalizedQuery: "ZERO",
      });
    },
    save: (command, signal) => {
      const captured = parseManagedWatchlistCommand(command);
      const expected = {
        ...payload,
        memberships:
          scenario === "markets-price-handoff"
            ? [
                payload.memberships[1]!,
                {
                  ...payload.memberships[0]!,
                  note: "Draft survives native Back",
                },
                { ...marketsCohort[1], note: marketsPriceNoteDraft },
              ]
            : scenario === "annual-note" || scenario === "price-comparison-note"
              ? payload.memberships.map((member, index) =>
                  index === 0
                    ? {
                        ...member,
                        note:
                          scenario === "annual-note"
                            ? annualNoteDraft
                            : priceNoteDraft,
                      }
                    : member,
                )
              : [
                  ...payload.memberships,
                  {
                    ...marketsCohort[0],
                    note: "Company draft captured in research",
                  },
                ],
      };
      // One invented full-list save only. Other cases still require zero writes.
      if (
        signal.aborted ||
        (scenario === "annual-note" && state.annual !== 1) ||
        (scenario === "price-comparison-note" && state.eod !== 1) ||
        (scenario === "markets-price-handoff" &&
          (state.marketsResolve !== 3 ||
            state.marketsEod !== 5 ||
            state.marketsAborted !== 1 ||
            state.marketsLateResolved !== 1 ||
            state.eod !== 1 ||
            state.annual !== 0)) ||
        savedWatchlist.version !== 1 ||
        captured?.expectedVersion !== 1 ||
        encodeMainWatchlistPayload(captured.payload) !==
          encodeMainWatchlistPayload(expected)
      )
        return unexpected("save");
      count("save");
      savedWatchlist = {
        version: 2,
        payload: structuredClone(captured.payload),
      };
      return Promise.resolve({
        ...structuredClone(savedWatchlist),
        replayed: false,
      });
    },
    resolve: (request, signal) => {
      if (
        scenario === "company-direct-entry" &&
        request.listingIds.length === 1 &&
        request.listingIds[0] === identity.listingId
      ) {
        if (
          signal.aborted ||
          request.snapshotSha256 !== digest ||
          state.resolve !== 0
        )
          return unexpected("resolve");
        const resolved = parseManagedCatalogResolveResponse(
          {
            snapshotSha256: digest,
            results: [{ listingId: identity.listingId, listing: identity }],
          },
          request,
        );
        if (!resolved)
          throw new Error("Invalid invented company-link identity");
        count("resolve");
        return Promise.resolve(resolved);
      }
      if (
        signal.aborted ||
        request.snapshotSha256 !== digest ||
        request.listingIds.join("|") !==
          marketsCohort.map((listing) => listing.listingId).join("|")
      )
        return unexpected("resolve");
      const resolved = parseManagedCatalogResolveResponse(
        {
          snapshotSha256: digest,
          results: marketsCohort.map((listing) => ({
            listingId: listing.listingId,
            listing,
          })),
        },
        request,
      );
      if (!resolved)
        throw new Error("Invalid invented Markets resolve response");
      count("marketsResolve");
      return Promise.resolve(resolved);
    },
    eodHistory: (request, signal) => {
      if (
        scenario === "price-comparison-note" &&
        (request.listingId !== "listing-zero" || state.eod !== 0)
      )
        throw new Error("Unexpected extra fixture price note read");
      const marketIndex = marketsCohort.findIndex(
        (listing) => listing.listingId === request.listingId,
      );
      if (scenario === "markets-price-handoff" && marketIndex === -1)
        throw new Error("Unexpected invented handoff listing");
      if (marketIndex !== -1) {
        if (scenario === "markets-price-handoff" && state.marketsEod === 5) {
          if (
            signal.aborted ||
            pendingMarkets ||
            request.catalogSnapshotSha256 !== digest ||
            request.range !== "1m" ||
            marketIndex !== 1 ||
            state.marketsAborted !== 1 ||
            state.marketsLateResolved !== 1 ||
            state.marketsResolve !== 2 ||
            state.eod !== 0
          )
            throw new Error("Unexpected invented company handoff refresh");
          count("eod");
          return Promise.resolve(
            structuredClone(marketsPacket(1, "refreshed")),
          );
        }
        if (selectedPriceScenario) {
          if (
            signal.aborted ||
            pendingMarkets ||
            state.marketsResolve < 1 ||
            request.catalogSnapshotSha256 !== digest ||
            request.range !== "1m" ||
            marketIndex !== 0 ||
            state.marketsEod >= 3 ||
            (state.marketsEod === 2 &&
              (state.marketsAborted !== 1 || state.marketsLateResolved !== 1))
          )
            throw new Error("Unexpected invented selected-price request");
          count("marketsEod");
          if (state.marketsEod === 1)
            return Promise.resolve(structuredClone(marketsInitial[0]!));
          if (state.marketsEod === 3)
            return Promise.resolve(structuredClone(marketsRefreshed));
          signal.addEventListener("abort", () => count("marketsAborted"), {
            once: true,
          });
          // The cancelled ALFA reply must not replace its prior dated history.
          return new Promise((resolve) => {
            pendingMarkets = resolve;
          });
        }
        const expectedIndex =
          state.marketsEod < 3 ? state.marketsEod : state.marketsEod - 3;
        if (
          signal.aborted ||
          pendingMarkets ||
          state.marketsResolve < 1 ||
          request.catalogSnapshotSha256 !== digest ||
          request.range !== "1m" ||
          state.marketsEod >= 5 ||
          marketIndex !== expectedIndex
        )
          throw new Error("Unexpected invented Markets EOD request or order");
        count("marketsEod");
        if (state.marketsEod <= 3)
          return Promise.resolve(structuredClone(marketsInitial[marketIndex]!));
        if (state.marketsEod === 4)
          return Promise.resolve(structuredClone(marketsRefreshed));
        signal.addEventListener("abort", () => count("marketsAborted"), {
          once: true,
        });
        // The late reply ignores abort; the board must fence it and never start the third row.
        return new Promise((resolve) => {
          pendingMarkets = resolve;
        });
      }
      if (
        signal.aborted ||
        pendingEod ||
        request.catalogSnapshotSha256 !== digest ||
        request.listingId !== "listing-zero" ||
        request.range !== "1m"
      )
        throw new Error("Unexpected fixture EOD request");
      count("eod");
      if (state.eod === 1) return Promise.resolve(structuredClone(eodInitial));
      if (state.eod === 3)
        return Promise.reject(new ManagedEodHistoryError("unavailable"));
      if (state.eod === 4)
        return Promise.resolve(structuredClone(eodRecovered));
      if (state.eod !== 2) throw new Error("Unexpected extra fixture EOD read");
      signal.addEventListener("abort", () => count("eodAborted"), {
        once: true,
      });
      // Deliberately ignores abort so the real EOD model must fence the late reply.
      return new Promise((resolve) => {
        pendingEod = resolve;
      });
    },
    annualReport: (request, signal) => {
      if (scenario === "price-comparison-note")
        throw new Error("Unexpected fixture price note Annual read");
      if (scenario === "markets-price-handoff")
        throw new Error("Unexpected fixture handoff Annual read");
      if (
        signal.aborted ||
        pending ||
        request.schemaVersion !== "1.0.0" ||
        request.catalogSnapshotSha256 !== digest ||
        request.listingId !== "listing-zero" ||
        request.symbol !== "ZERO"
      )
        throw new Error("Unexpected fixture annual request");
      if (scenario === "annual-note") {
        if (state.annual !== 0)
          throw new Error("Unexpected extra fixture annual note read");
        count("annual");
        return Promise.resolve(structuredClone(annual));
      }
      count("annual");
      if (!state.refreshScenario && state.annual === 2) {
        if (state.aborted !== 1 || state.lateResolved !== 1)
          throw new Error("The cancelled Annual request must settle first");
        return Promise.resolve(structuredClone(recovered));
      }
      if (!state.refreshScenario && state.annual !== 1)
        throw new Error("Unexpected extra fixture annual read");
      signal.addEventListener("abort", () => count("aborted"), { once: true });
      if (state.refreshScenario) {
        if (state.annual === 1) return Promise.resolve(structuredClone(annual));
        if (state.annual === 2)
          return new Promise<PersonalSecAnnualEvidenceResponseDto>(
            (_resolve, reject) => {
              rejectRefresh = reject;
            },
          );
        if (state.annual === 3)
          return Promise.resolve(structuredClone(recovered));
        throw new Error("Unexpected extra fixture annual refresh");
      }
      // Deliberately ignores cancellation: the real model must reject this late completion.
      return new Promise((resolve) => {
        pending = resolve;
      });
    },
  };
  const session: TrialSession = {
    userId: "invented-android-user",
    sessionId: "invented-android-session",
    getToken: () => unexpected("token"),
    signOut: () => unexpected("signOut"),
  };
  return {
    api,
    session,
    marketsCohort,
    generations: {
      initial: annual.evidence.generation,
      recovered: recovered.evidence.generation,
    },
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    settleCancelledMarkets: () => {
      if (
        !pendingMarkets ||
        state.marketsEod !== (selectedPriceScenario ? 2 : 5) ||
        state.marketsAborted !== 1 ||
        state.marketsLateResolved !== 0
      )
        throw new Error("Only the cancelled Markets row may settle");
      const resolve = pendingMarkets;
      pendingMarkets = null;
      resolve(structuredClone(marketsLate));
      void Promise.resolve().then(() => count("marketsLateResolved"));
    },
    releaseCatalogRecovery: () => {
      if (
        !state.catalogRecovery ||
        state.status !== 2 ||
        state.catalogReleased !== 0 ||
        !releaseCatalog
      )
        throw new Error("Only the second fixture status read may recover");
      const release = releaseCatalog;
      releaseCatalog = null;
      count("catalogReleased");
      release();
    },
    settleCancelledEod: () => {
      if (
        !pendingEod ||
        state.eod !== 2 ||
        state.eodAborted !== 1 ||
        state.eodLateResolved !== 0
      )
        throw new Error("Only the cancelled fixture EOD read may settle");
      const resolve = pendingEod;
      pendingEod = null;
      resolve(structuredClone(eodLate));
      void Promise.resolve().then(() => count("eodLateResolved"));
    },
    settleCancelledRead: () => {
      if (!pending || state.aborted !== 1 || state.lateResolved !== 0)
        throw new Error("Only the cancelled fixture read may settle");
      const resolve = pending;
      pending = null;
      resolve(structuredClone(annual));
      // The model's await continuation runs before this observable settled diagnostic.
      void Promise.resolve().then(() => count("lateResolved"));
    },
    enableRefreshScenario: () => {
      if (
        state.refreshScenario ||
        state.annual !== 0 ||
        pending ||
        rejectRefresh
      )
        throw new Error("Only a fresh fixture can select the refresh sequence");
      state = { ...state, refreshScenario: true };
      for (const listener of listeners) listener();
    },
    failRefresh: () => {
      if (
        !state.refreshScenario ||
        state.annual !== 2 ||
        !rejectRefresh ||
        state.refreshFailed !== 0
      )
        throw new Error("Only the second fixture annual read may fail");
      const reject = rejectRefresh;
      rejectRefresh = null;
      count("refreshFailed");
      reject(new TrialApiError("unavailable"));
    },
  };
}
