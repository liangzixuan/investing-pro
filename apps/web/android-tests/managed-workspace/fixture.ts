import type {
  MainWatchlistPayload,
  ManagedCatalogSnapshotDto,
  PersonalSecurityMasterSearchResultDto,
  PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { listingMembership } from "../../src/clerk-trial/managed-workspace";
import type { TrialSession } from "../../src/clerk-trial/session";
import { response } from "../../src/features/research/sec-annual-evidence-fixture";

const digest = `sha256:${"a".repeat(64)}` as const;
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
const identity = listingMembership(zero);
const payload: MainWatchlistPayload = {
  name: "My Watchlist",
  schemaVersion: 1,
  snapshotSha256: digest,
  memberships: [
    { ...identity, note: "" },
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
    activeEligibleSecurities: 2,
    activeListings: 2,
    admittedSourceRecords: 2,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 2,
    providerMappings: 0,
    quarantinedSourceRecords: 0,
    sourceRecords: 2,
    staleSourceRecords: 0,
    shareClasses: 2,
    totalSecurities: 2,
    unsupportedSourceRecords: 0,
  },
};

/** Test-APK-only data port. There is no fetch, credential, storage, or native-auth fallback. */
export async function createFixture() {
  const annual = await response();
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
  };
  const listeners = new Set<() => void>();
  const count = (key: keyof typeof state) => {
    state = { ...state, [key]: state[key] + 1 };
    for (const listener of listeners) listener();
  };
  let pending: ((value: PersonalSecAnnualEvidenceResponseDto) => void) | null =
    null;
  const unexpected = (
    key: "save" | "resolve" | "token" | "signOut",
  ): Promise<never> => {
    count(key);
    return Promise.reject(new Error(`Unexpected fixture operation: ${key}`));
  };
  const api: ManagedApi = {
    load: () => {
      count("load");
      return Promise.resolve({ version: 1, payload: structuredClone(payload) });
    },
    status: () => {
      count("status");
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
    save: () => unexpected("save"),
    resolve: () => unexpected("resolve"),
    annualReport: (request, signal) => {
      if (
        signal.aborted ||
        pending ||
        request.schemaVersion !== "1.0.0" ||
        request.catalogSnapshotSha256 !== digest ||
        request.listingId !== "listing-zero" ||
        request.symbol !== "ZERO"
      )
        throw new Error("Unexpected fixture annual request");
      count("annual");
      signal.addEventListener("abort", () => count("aborted"), { once: true });
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
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
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
  };
}
