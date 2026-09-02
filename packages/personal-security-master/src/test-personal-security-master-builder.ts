import { createHash } from "node:crypto";

import type {
  PersonalSecurityMasterAdmissionInput,
  PersonalSecurityMasterContentKind,
} from "./personal-security-master";

export type JsonRecord = Record<string, unknown>;

export interface MutableSecurityMasterDocument extends JsonRecord {
  issuers: JsonRecord[];
  provenance: JsonRecord;
  providerMappings: JsonRecord[];
  records: SecurityRecordDocument[];
  sourceCoverage: JsonRecord;
  sourcePolicyCompatibility: JsonRecord;
}

export interface SecurityRecordDocument extends JsonRecord {
  shareClasses: ShareClassDocument[];
}

export interface ShareClassDocument extends JsonRecord {
  listings: ListingDocument[];
}

export interface ListingDocument extends JsonRecord {
  tickerHistory: JsonRecord[];
}

export function buildMutableSecurityMasterDocument(
  recordCount = 2,
  contentKind: PersonalSecurityMasterContentKind = "synthetic_engineering",
): MutableSecurityMasterDocument {
  const excluded = 15;
  const issuerCount = Math.ceil(recordCount / 2);
  return {
    asOf: "2026-09-01T18:00:00.000Z",
    catalogId: "personal-security-master-2026-09",
    catalogVersion: "1.0.0",
    generatedAt: "2026-09-01T17:30:00.000Z",
    issuers: Array.from({ length: issuerCount }, (_, index) => issuer(index)),
    profile: "personal_single_user_local_security_master",
    provenance: {
      acquiredAt: "2026-09-01T17:00:00.000Z",
      artifacts: [
        {
          acquiredAt: "2026-09-01T16:00:00.000Z",
          artifactId: "synthetic-component-a",
          contentSha256: `sha256:${"b".repeat(64)}`,
          mediaType: "application/json",
          sourceUri: "https://example.invalid/security-master-component.json",
          sourceVersion: "synthetic-component-v1",
        },
        {
          acquiredAt: "2026-09-01T16:30:00.000Z",
          artifactId: "synthetic-component-b",
          contentSha256: `sha256:${"d".repeat(64)}`,
          mediaType: "text/html",
          sourceUri: "https://example.invalid/inline-xbrl-cover.html",
          sourceVersion: "synthetic-inline-xbrl-v1",
        },
      ],
      attribution: "Synthetic engineering fixture; not a real source.",
      contentKind,
      sourceId: "synthetic-security-source",
      sourceLocator: `owner-local-composite-manifest:sha256:${"c".repeat(64)}`,
      sourceRevision: `sha256:${"c".repeat(64)}`,
    },
    providerMappings: Array.from({ length: recordCount }, (_, index) =>
      providerMappings(index),
    ).flat(),
    records: Array.from({ length: recordCount }, (_, index) =>
      securityRecord(index),
    ),
    schemaVersion: "1.0.0",
    sourceCoverage: {
      admittedRecords: recordCount,
      ineligibleRecords: 5,
      quarantinedRecords: 3,
      sourceRecords: recordCount + excluded,
      staleRecords: 4,
      unsupportedRecords: 3,
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
      policyId: "synthetic-security-policy",
      policyProfile: "personal_single_user_local_connected",
      policySchemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      redistribution: "prohibited",
      retention: "permitted_owner_local",
      reviewedAt: "2026-08-01T00:00:00.000Z",
      revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation",
      revokedAt: null,
      rightsBasis: "owner_reviewed_rights_compatible",
      search: "permitted_owner_local",
      sourceId: "synthetic-security-source",
    },
  };
}

export function buildSecurityMasterAdmission(
  recordCount = 2,
): PersonalSecurityMasterAdmissionInput {
  return admissionFromDocument(buildMutableSecurityMasterDocument(recordCount));
}

export function admissionFromDocument(
  document: MutableSecurityMasterDocument,
): PersonalSecurityMasterAdmissionInput {
  const snapshot = canonicalBytes(document);
  return { expectedSha256: sha256(snapshot), snapshot };
}

export function bindRawSnapshot(
  snapshot: Uint8Array,
): PersonalSecurityMasterAdmissionInput {
  return { expectedSha256: sha256(snapshot), snapshot };
}

export function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}

function issuer(index: number): JsonRecord {
  const suffix = String(index).padStart(5, "0");
  return {
    cik: String(index + 1).padStart(10, "0"),
    issuerId: `iss-${suffix}`,
    issuerName:
      index === 0 ? "Zéro Alpha Holdings" : `Synthetic Issuer ${suffix}`,
  };
}

function securityRecord(index: number): SecurityRecordDocument {
  const suffix = String(index).padStart(5, "0");
  const issuerSuffix = String(Math.floor(index / 2)).padStart(5, "0");
  const securityId = `sec-${suffix}`;
  const shareClassId = `shr-${suffix}`;
  const listingId = `lst-${suffix}`;
  const symbol = `S${suffix}`;
  const tickerHistory: JsonRecord[] = [];
  if (index === 0) {
    tickerHistory.push({
      listingId,
      symbol: "OLDZERO",
      timeBasis: "sec_filing_observed",
      validFrom: "2010-01-01T00:00:00.000Z",
      validTo: "2020-01-01T00:00:00.000Z",
    });
  }
  tickerHistory.push({
    listingId,
    symbol,
    timeBasis: "prospective_snapshot_observed",
    validFrom:
      index === 0 ? "2020-01-01T00:00:00.000Z" : "2010-01-01T00:00:00.000Z",
    validTo: null,
  });
  return {
    active: true,
    eligibility: "eligible",
    instrumentType: index % 5 === 0 ? "adr" : "common_stock",
    issuerId: `iss-${issuerSuffix}`,
    securityId,
    securityName:
      index === 0 ? "Zéro Alpha Security" : `Synthetic Security ${suffix}`,
    shareClasses: [
      {
        active: true,
        listings: [
          {
            active: true,
            country: "US",
            currentSymbol: symbol,
            exchangeMic: index % 2 === 0 ? "XNAS" : "XNYS",
            exchangeMicType: "operating",
            listingId,
            securityId,
            shareClassId,
            tickerHistory,
          },
        ],
        securityId,
        shareClassId,
        shareClassName:
          index === 0 ? "Zéro Alpha ADR" : `Synthetic Class ${suffix}`,
      },
    ],
  };
}

function providerMappings(index: number): JsonRecord[] {
  const suffix = String(index).padStart(5, "0");
  return [
    {
      mappingId: `map-${suffix}-a`,
      mappingKind: "share_class",
      providerId: "synthetic-provider",
      providerSecurityId: `share-class-figi-${suffix}`,
      targetId: `shr-${suffix}`,
    },
    {
      mappingId: `map-${suffix}-b`,
      mappingKind: "listing",
      providerId: "synthetic-provider",
      providerSecurityId: `listing-figi-${suffix}`,
      targetId: `lst-${suffix}`,
    },
  ];
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as JsonRecord;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
