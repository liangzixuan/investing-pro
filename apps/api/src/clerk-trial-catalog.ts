import { createHash } from "node:crypto";

import {
  isMainWatchlistPayload,
  membershipMatchesResult,
  type MainWatchlistPayload,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import {
  admitPersonalSecurityMasterSnapshot,
  searchPersonalSecurityMaster,
} from "@research-cockpit/personal-security-master";

import { WatchlistRepositoryError } from "./watchlist-repository";

export const CLERK_TRIAL_SELECTIONS = ["DEMO_A", "DEMO_B"] as const;
export type ClerkTrialSelection = (typeof CLERK_TRIAL_SELECTIONS)[number];
export interface ClerkTrialContent {
  readonly selected: readonly ClerkTrialSelection[];
  readonly note: string;
}

// These two invented securities carry no market data or provider access.
const identities = ["A", "B"].map((suffix, index) => ({
  suffix,
  issuerId: `trial-issuer-${suffix.toLowerCase()}`,
  securityId: `trial-security-${suffix.toLowerCase()}`,
  shareClassId: `trial-class-${suffix.toLowerCase()}`,
  listingId: `trial-listing-${suffix.toLowerCase()}`,
  symbol: `DEMO.${suffix}`,
  cik: String(index + 1).padStart(10, "0"),
}));
const document = {
  asOf: "2026-09-29T00:00:00.000Z",
  catalogId: "clerk-trial-invented",
  catalogVersion: "1.0.0",
  generatedAt: "2026-09-29T00:00:00.000Z",
  issuers: identities.map((item) => ({
    cik: item.cik,
    issuerId: item.issuerId,
    issuerName: `Invented Trial ${item.suffix}`,
  })),
  profile: "personal_single_user_local_security_master",
  provenance: {
    acquiredAt: "2026-09-29T00:00:00.000Z",
    artifacts: [
      {
        acquiredAt: "2026-09-29T00:00:00.000Z",
        artifactId: "clerk-trial-invented-input",
        contentSha256: `sha256:${createHash("sha256").update("clerk-trial-invented-v1").digest("hex")}`,
        mediaType: "application/json",
        sourceUri: "https://example.invalid/clerk-trial-invented.json",
        sourceVersion: "invented-v1",
      },
    ],
    attribution: "Invented trial entries; not real companies or market data.",
    contentKind: "synthetic_engineering",
    sourceId: "clerk-trial-invented",
    sourceLocator: `owner-local-composite-manifest:sha256:${"c".repeat(64)}`,
    sourceRevision: `sha256:${"c".repeat(64)}`,
  },
  providerMappings: identities.flatMap((item) => [
    {
      mappingId: `trial-map-${item.suffix.toLowerCase()}-a`,
      mappingKind: "share_class",
      providerId: "invented-no-provider",
      providerSecurityId: `invented-class-reference-${item.suffix}`,
      targetId: item.shareClassId,
    },
    {
      mappingId: `trial-map-${item.suffix.toLowerCase()}-b`,
      mappingKind: "listing",
      providerId: "invented-no-provider",
      providerSecurityId: `invented-listing-reference-${item.suffix}`,
      targetId: item.listingId,
    },
  ]),
  records: identities.map((item) => ({
    active: true,
    eligibility: "eligible",
    instrumentType: "common_stock",
    issuerId: item.issuerId,
    securityId: item.securityId,
    securityName: `Invented Trial ${item.suffix} Security`,
    shareClasses: [
      {
        active: true,
        listings: [
          {
            active: true,
            country: "US",
            currentSymbol: item.symbol,
            exchangeMic: "XNAS",
            exchangeMicType: "operating",
            listingId: item.listingId,
            securityId: item.securityId,
            shareClassId: item.shareClassId,
            tickerHistory: [
              {
                listingId: item.listingId,
                symbol: item.symbol,
                timeBasis: "prospective_snapshot_observed",
                validFrom: "2026-09-29T00:00:00.000Z",
                validTo: null,
              },
            ],
          },
        ],
        securityId: item.securityId,
        shareClassId: item.shareClassId,
        shareClassName: `Invented Trial ${item.suffix} Class`,
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
    cache: "permitted_owner_local",
    decision: "compatible",
    deleteOnRequest: true,
    display: "permitted_owner_local",
    effectiveAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
    export: "prohibited",
    intendedUse: "personal_security_research",
    localOnly: true,
    operation: "fetch_snapshot",
    policyDocumentSha256: `sha256:${"a".repeat(64)}`,
    policyId: "clerk-trial-invented-policy",
    policyProfile: "personal_single_user_local_connected",
    policySchemaVersion: "1.0.0",
    policyVersion: "1.0.0",
    redistribution: "prohibited",
    retention: "permitted_owner_local",
    reviewedAt: "2026-09-29T00:00:00.000Z",
    revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation",
    revokedAt: null,
    rightsBasis: "owner_reviewed_rights_compatible",
    search: "permitted_owner_local",
    sourceId: "clerk-trial-invented",
  },
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
const snapshot = new TextEncoder().encode(`${canonical(document)}\n`);
export const CLERK_TRIAL_CATALOG = admitPersonalSecurityMasterSnapshot({
  snapshot,
  expectedSha256: `sha256:${createHash("sha256").update(snapshot).digest("hex")}`,
});
const members: readonly Omit<WatchlistMembership, "note">[] = identities.map(
  (item) => {
    const result = searchPersonalSecurityMaster(CLERK_TRIAL_CATALOG, {
      query: item.symbol,
      limit: 1,
    }).results[0];
    if (!result || result.listingId !== item.listingId)
      throw new Error("Invalid trial catalog");
    return {
      country: result.country,
      exchangeMic: result.exchangeMic,
      instrumentType: result.instrumentType,
      issuerId: result.issuerId,
      issuerName: result.issuerName,
      listingId: result.listingId,
      securityId: result.securityId,
      securityName: result.securityName,
      shareClassId: result.shareClassId,
      shareClassName: result.shareClassName,
      symbol: result.symbol,
    };
  },
);

export function isClerkTrialContent(value: {
  selected: unknown;
  note: unknown;
}): value is ClerkTrialContent {
  return (
    Array.isArray(value.selected) &&
    value.selected.length <= 2 &&
    value.selected.every(
      (entry, index, all) =>
        (entry === "DEMO_A" || entry === "DEMO_B") &&
        (index === 0 || entry > all[index - 1]),
    ) &&
    typeof value.note === "string" &&
    value.note.length <= 1000 &&
    value.note === value.note.trim().normalize("NFC") &&
    !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value.note) &&
    (value.selected.includes("DEMO_A") || value.note === "")
  );
}

export function toClerkTrialPayload(
  selected: unknown,
  note: unknown,
): MainWatchlistPayload {
  const content = { selected, note };
  if (!isClerkTrialContent(content))
    throw new WatchlistRepositoryError("invalid_request");
  return {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: CLERK_TRIAL_CATALOG.snapshotSha256,
    memberships: content.selected.map((id) => ({
      ...members[CLERK_TRIAL_SELECTIONS.indexOf(id)]!,
      note: id === "DEMO_A" ? content.note : "",
    })),
  };
}

export function fromClerkTrialPayload(payload: unknown): ClerkTrialContent {
  if (
    !isMainWatchlistPayload(payload) ||
    payload.snapshotSha256 !== CLERK_TRIAL_CATALOG.snapshotSha256
  )
    throw new WatchlistRepositoryError("invalid_response");
  const selected: ClerkTrialSelection[] = [];
  let note = "";
  for (const member of payload.memberships) {
    const index = members.findIndex((entry) =>
      membershipMatchesResult(member, entry),
    );
    if (index < 0 || (index === 1 && member.note !== ""))
      throw new WatchlistRepositoryError("invalid_response");
    selected.push(CLERK_TRIAL_SELECTIONS[index]!);
    if (index === 0) note = member.note;
  }
  const content = { selected, note };
  if (!isClerkTrialContent(content))
    throw new WatchlistRepositoryError("invalid_response");
  return content;
}
