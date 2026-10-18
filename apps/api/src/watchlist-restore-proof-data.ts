import { createHash } from "node:crypto";
import {
  encodeMainWatchlistPayload,
  isMainWatchlistPayload,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import {
  admitManagedSecurityMasterSnapshot,
  lookupPersonalSecurityMasterListing,
} from "@research-cockpit/personal-security-master";
import type { PutMainWatchlistCommand } from "./watchlist-repository";

export const WATCHLIST_RESTORE_PROOF_TARGET = Object.freeze({
  endpoint: "https://nyc.cloud.appwrite.io/v1",
  project: "6abac57a0007b7c1a671",
  sourceDatabaseId: "investment_backup_watchlist_v1",
  restoredDatabaseId: "investment_restore_watchlist_v1",
  currentTableId: "watchlists",
  receiptsTableId: "receipts",
});
export const WATCHLIST_RESTORE_PROOF_PHASES = Object.freeze([
  "preflight",
  "seed",
  "verify-restored",
  "verify-source",
] as const);
export type WatchlistRestoreProofPhase =
  (typeof WATCHLIST_RESTORE_PROOF_PHASES)[number];
export type WatchlistRestoreProofSide = "source" | "restored";
export const WATCHLIST_RESTORE_PROOF_LIMITS = Object.freeze({
  preflight: 8,
  seed: 19,
  "verify-restored": 18,
  "verify-source": 6,
} satisfies Record<WatchlistRestoreProofPhase, number>);
export const WATCHLIST_RESTORE_PROOF_PRINCIPAL = Object.freeze({
  userId: "proof-watchlist-restore-20261018",
});
export const WATCHLIST_RESTORE_PROOF_TIMES = Object.freeze([
  "2026-10-18T00:00:01.000Z",
  "2026-10-18T00:00:02.000Z",
  "2026-10-18T00:00:03.000Z",
] as const);
export const watchlistRestoreProofHash = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const TIME = "2026-10-18T00:00:00.000Z";
const SOURCE = "invented-watchlist-restore-source";
const sourceSha = `sha256:${watchlistRestoreProofHash(SOURCE)}`;
const identities = ["a", "b"].map((suffix) => ({
  issuerId: `restore-issuer-${suffix}`,
  securityId: `restore-security-${suffix}`,
  shareClassId: `restore-class-${suffix}`,
  listingId: `restore-listing-${suffix}`,
  symbol: `RESTORE${suffix.toUpperCase()}`,
}));
const snapshot = `${canonical({
  asOf: TIME,
  catalogId: "invented-watchlist-restore-catalog",
  catalogVersion: "1.0.0",
  generatedAt: TIME,
  issuers: identities.map((identity, index) => ({
    cik: String(index + 1).padStart(10, "0"),
    issuerId: identity.issuerId,
    issuerName: `Invented restore company ${index + 1}`,
  })),
  profile: "personal_single_user_managed_security_master",
  provenance: {
    acquiredAt: TIME,
    artifacts: [
      {
        acquiredAt: TIME,
        artifactId: "invented-watchlist-restore-artifact",
        contentSha256: sourceSha,
        mediaType: "text/plain",
        sourceUri: "https://example.invalid/watchlist-restore/invented.txt",
        sourceVersion: "1.0.0",
      },
    ],
    attribution: "Invented restore qualification data; no provider data.",
    contentKind: "synthetic_engineering",
    sourceId: SOURCE,
    sourceLocator: `managed-composite-manifest:${sourceSha}`,
    sourceRevision: sourceSha,
  },
  providerMappings: identities.flatMap((identity, index) => [
    {
      mappingId: `restore-map-${index}-class`,
      mappingKind: "share_class",
      providerId: "invented-restore-provider",
      providerSecurityId: `restore-class-${index}`,
      targetId: identity.shareClassId,
    },
    {
      mappingId: `restore-map-${index}-listing`,
      mappingKind: "listing",
      providerId: "invented-restore-provider",
      providerSecurityId: `restore-listing-${index}`,
      targetId: identity.listingId,
    },
  ]),
  records: identities.map((identity) => ({
    active: true,
    eligibility: "eligible",
    instrumentType: "common_stock",
    issuerId: identity.issuerId,
    securityId: identity.securityId,
    securityName: `Invented ${identity.symbol} security`,
    shareClasses: [
      {
        active: true,
        securityId: identity.securityId,
        shareClassId: identity.shareClassId,
        shareClassName: "Invented ordinary shares",
        listings: [
          {
            active: true,
            country: "US",
            currentSymbol: identity.symbol,
            exchangeMic: "XNAS",
            exchangeMicType: "operating",
            listingId: identity.listingId,
            securityId: identity.securityId,
            shareClassId: identity.shareClassId,
            tickerHistory: [
              {
                listingId: identity.listingId,
                symbol: identity.symbol,
                timeBasis: "prospective_snapshot_observed",
                validFrom: TIME,
                validTo: null,
              },
            ],
          },
        ],
      },
    ],
  })),
  schemaVersion: "1.0.0",
  sourceCoverage: {
    admittedRecords: 2,
    ineligibleRecords: 0,
    quarantinedRecords: 0,
    sourceRecords: 2,
    staleRecords: 0,
    unsupportedRecords: 0,
  },
  sourcePolicyCompatibility: {
    attribution: "required",
    cache: "permitted_managed",
    decision: "compatible",
    deleteOnRequest: true,
    display: "permitted_managed",
    effectiveAt: TIME,
    expiresAt: "9999-12-31T23:59:59.999Z",
    export: "permitted_with_attribution",
    intendedUse: "personal_security_research",
    localOnly: false,
    operation: "fetch_snapshot",
    policyDocumentSha256: sourceSha,
    policyId: "invented-watchlist-restore-policy",
    policyProfile: "personal_single_user_managed_connected",
    policySchemaVersion: "1.0.0",
    policyVersion: "1.0.0",
    redistribution: "permitted_with_attribution",
    retention: "permitted_managed",
    reviewedAt: TIME,
    revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation",
    revokedAt: null,
    rightsBasis: "reviewed_redistributable_source",
    search: "permitted_managed",
    sourceId: SOURCE,
  },
})}\n`;
const snapshotBytes = new TextEncoder().encode(snapshot);
const catalog = admitManagedSecurityMasterSnapshot({
  expectedSha256: `sha256:${watchlistRestoreProofHash(snapshot)}`,
  snapshot: snapshotBytes,
});
const commands = [0, 1, 2].map((index): PutMainWatchlistCommand => {
  const members = identities.map((identity): WatchlistMembership => {
    const listing = lookupPersonalSecurityMasterListing(
      catalog,
      identity.listingId,
    );
    if (listing === null) throw new Error("Missing fixed restore listing");
    return {
      country: listing.country,
      exchangeMic: listing.exchangeMic,
      instrumentType: listing.instrumentType,
      issuerId: listing.issuerId,
      issuerName: listing.issuerName,
      listingId: listing.listingId,
      securityId: listing.securityId,
      securityName: listing.securityName,
      shareClassId: listing.shareClassId,
      shareClassName: listing.shareClassName,
      symbol: listing.symbol,
      note: `Invented version ${index + 1}: café 東京 📈 · Exact saved note, "quoted".`,
    };
  });
  const payload = {
    schemaVersion: 1 as const,
    name: "My Watchlist" as const,
    snapshotSha256: catalog.snapshotSha256,
    memberships: index === 1 ? members.reverse() : members,
  };
  if (!isMainWatchlistPayload(payload))
    throw new Error("Invalid fixed restore payload");
  return {
    expectedVersion: index,
    idempotencyKey: `proof-watchlist-restore-20261018-v${index + 1}`,
    payload,
  };
});
export const WATCHLIST_RESTORE_PROOF_COMMAND_PINS = freeze(
  commands.map((command, index) => {
    const payloadJson = encodeMainWatchlistPayload(command.payload);
    const payloadSha256 = watchlistRestoreProofHash(payloadJson);
    return {
      version: index + 1,
      expectedVersion: command.expectedVersion,
      keySha256: watchlistRestoreProofHash(command.idempotencyKey),
      payloadJson,
      payloadBytes: Buffer.byteLength(payloadJson),
      payloadSha256,
      commandSha256: watchlistRestoreProofHash(JSON.stringify(command)),
      requestSha256: watchlistRestoreProofHash(
        JSON.stringify({
          expectedVersion: command.expectedVersion,
          id: "main",
          operation: "put",
          payloadSha256,
        }),
      ),
      committedAt: WATCHLIST_RESTORE_PROOF_TIMES[index]!,
    };
  }),
);
const DATA = freeze({ catalog, commands });
export const watchlistRestoreProofData = () => DATA;

export function watchlistRestoreProofLocation(
  side: WatchlistRestoreProofSide,
  version?: 1 | 2 | 3,
) {
  const namespace = [WATCHLIST_RESTORE_PROOF_PRINCIPAL.userId, "main"];
  return Object.freeze({
    databaseId:
      side === "source"
        ? WATCHLIST_RESTORE_PROOF_TARGET.sourceDatabaseId
        : WATCHLIST_RESTORE_PROOF_TARGET.restoredDatabaseId,
    tableId: version === undefined ? "watchlists" : "receipts",
    rowId:
      (version === undefined ? "w" : "r") +
      watchlistRestoreProofHash(
        JSON.stringify(
          version === undefined
            ? namespace
            : [...namespace, commands[version - 1]!.idempotencyKey],
        ),
      ).slice(0, 32),
  });
}
export const WATCHLIST_RESTORE_PROOF_ROWS = freeze(
  (["source", "restored"] as const).flatMap((side) =>
    ([undefined, 1, 2, 3] as const).map((version) => ({
      side,
      version: version ?? null,
      ...watchlistRestoreProofLocation(side, version),
    })),
  ),
);
export const WATCHLIST_RESTORE_PROOF_PLAN_SHA256 = watchlistRestoreProofHash(
  JSON.stringify({
    version: 1,
    target: WATCHLIST_RESTORE_PROOF_TARGET,
    phases: WATCHLIST_RESTORE_PROOF_PHASES,
    limits: WATCHLIST_RESTORE_PROOF_LIMITS,
    principal: WATCHLIST_RESTORE_PROOF_PRINCIPAL,
    rows: WATCHLIST_RESTORE_PROOF_ROWS,
    commands: WATCHLIST_RESTORE_PROOF_COMMAND_PINS,
    catalogSha256: catalog.snapshotSha256,
    nativeBackup:
      "external_existing_cli_single_database_archive_and_distinct_restore",
    inventory:
      "fixed_known_rows_only_operator_checks_complete_inventory_and_schema",
  }),
);
