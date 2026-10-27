import { vi } from "vitest";
import type {
  ManagedCatalogSnapshotDto,
  ValuationAssumptionEntry,
} from "@research-cockpit/contracts";
import { ManagedWorkspace } from "./managed-workspace";
import type { ManagedApi } from "./managed-api";
import { eodSelection } from "./eod-history-fixture";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { ManagedValuationDraftRecovery } from "./managed-valuation-draft-recovery";
import { formatManagedValuationDraftFile } from "./managed-valuation-draft-file";
import type { ManagedValuationDraftFileDeliveryAdapter } from "./valuation-draft-file-delivery";
export const scope = `sha256:${"c".repeat(64)}`;
const time = "2026-10-22T10:00:00.000Z";
const digest = eodSelection.catalogSnapshotSha256;
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "invented",
  catalogVersion: "one",
  asOf: time,
  acquiredAt: time,
  generatedAt: time,
  contentKind: "synthetic_engineering",
  attribution: "Invented engineering catalog",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 1,
    activeListings: 1,
    admittedSourceRecords: 1,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 1,
    providerMappings: 0,
    quarantinedSourceRecords: 0,
    sourceRecords: 1,
    staleSourceRecords: 0,
    shareClasses: 1,
    totalSecurities: 1,
    unsupportedSourceRecords: 0,
  },
};
function inventedApi() {
  const unexpected = vi.fn(() =>
    Promise.reject(new Error("Unexpected request")),
  );
  const refuse = () => vi.fn(() => unexpected());
  const api: ManagedApi = {
    interimReport: vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(new Error("Unexpected interim read")),
    load: refuse(),
    save: refuse(),
    loadPortfolio: refuse(),
    savePortfolio: refuse(),
    loadValuationAssumptions: refuse(),
    saveValuationAssumptions: refuse(),
    search: refuse(),
    eodHistory: refuse(),
    annualReport: refuse(),
    recentFilings: refuse(),
    monetaryAnnouncements: refuse(),
    blsCalendar: refuse(),
    economicCalendar: refuse(),
    loadFollowups: refuse(),
    saveFollowups: refuse(),
    status: vi.fn(() => Promise.resolve({ snapshot })),
    resolve: vi.fn<ManagedApi["resolve"]>((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: eodSelection.listing,
        })),
      }),
    ),
  };
  return { api, unexpected };
}
export async function valuationFileFixture() {
  const { api, unexpected } = inventedApi();
  const workspace = new ManagedWorkspace(
    api,
    {
      userId: "invented-file-user",
      sessionId: "invented-file-session",
      getToken: vi.fn(),
      signOut: vi.fn(),
    },
    undefined,
    { researchCoverage: inventedManagedResearchCoverage },
  );
  await workspace.refreshCatalog();
  await workspace.setCompanyRoute({
    kind: "company",
    listingId: eodSelection.listing.listingId,
    section: "annual",
  });
  const selection = workspace.getSnapshot().research!.selection;
  workspace.valuation.setDcfField("startingUnleveredCashFlowUsd", " 001.50 ");
  let active = true;
  const deliver = vi.fn<ManagedValuationDraftFileDeliveryAdapter["deliver"]>(
    () => Promise.resolve("written"),
  );
  const recovery = new ManagedValuationDraftRecovery({
    workspace,
    accountScope: Promise.resolve(scope),
    delivery: { deliver },
    routeActive: () => active,
    selection: () => workspace.getSnapshot().research?.selection ?? selection,
    now: () => time,
  });
  await Promise.resolve();
  return {
    workspace,
    api,
    unexpected,
    deliver,
    recovery,
    active: (value: boolean) => {
      active = value;
      recovery.reconcile();
    },
    close: () => {
      recovery.dispose();
      workspace.sessionOwner.dispose();
    },
  };
}
export function inputFile(
  entry: ValuationAssumptionEntry,
  accountScope = scope,
) {
  const document = formatManagedValuationDraftFile({
    accountScope,
    capturedAt: time,
    entry,
  });
  if (!document) throw new Error("Invalid invented file");
  const bytes = new TextEncoder().encode(document.text).buffer;
  return {
    size: bytes.byteLength,
    arrayBuffer: vi.fn(() => Promise.resolve(bytes)),
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
