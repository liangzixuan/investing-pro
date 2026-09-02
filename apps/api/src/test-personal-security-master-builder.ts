import { createHash } from "node:crypto";

export interface TestSecurityMasterAdmission {
  readonly expectedSha256: `sha256:${string}`;
  readonly snapshot: Uint8Array;
}

export type MutableJsonRecord = Record<string, unknown>;

export interface MutableSecurityMasterDocument extends MutableJsonRecord {
  issuers: MutableJsonRecord[];
  provenance: MutableJsonRecord;
  providerMappings: MutableJsonRecord[];
  records: MutableSecurityMasterRecord[];
  sourceCoverage: MutableJsonRecord;
  sourcePolicyCompatibility: MutableJsonRecord;
}

export interface MutableSecurityMasterRecord extends MutableJsonRecord {
  shareClasses: MutableSecurityMasterShareClass[];
}

export interface MutableSecurityMasterShareClass extends MutableJsonRecord {
  listings: MutableSecurityMasterListing[];
}

export interface MutableSecurityMasterListing extends MutableJsonRecord {
  tickerHistory: MutableJsonRecord[];
}

export function buildTestSecurityMasterAdmission(
  recordCount = 2,
): TestSecurityMasterAdmission {
  return bindTestSecurityMasterDocument(
    buildMutableTestSecurityMasterDocument(recordCount),
  );
}

export function buildMutableTestSecurityMasterDocument(
  recordCount = 2,
): MutableSecurityMasterDocument {
  const excludedRecords = 15;
  const issuerCount = Math.ceil(recordCount / 2);
  return {
    asOf: "2026-09-01T18:00:00.000Z",
    catalogId: "personal-security-master-2026-09",
    catalogVersion: "1.0.0",
    generatedAt: "2026-09-01T17:30:00.000Z",
    issuers: Array.from({ length: issuerCount }, (_, index) =>
      testSecurityMasterIssuer(index),
    ),
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
      contentKind: "synthetic_engineering",
      sourceId: "synthetic-security-source",
      sourceLocator: `owner-local-composite-manifest:sha256:${"c".repeat(64)}`,
      sourceRevision: `sha256:${"c".repeat(64)}`,
    },
    providerMappings: Array.from({ length: recordCount }, (_, index) =>
      testSecurityMasterProviderMappings(index),
    ).flat(),
    records: Array.from({ length: recordCount }, (_, index) =>
      testSecurityMasterRecord(index),
    ),
    schemaVersion: "1.0.0",
    sourceCoverage: {
      admittedRecords: recordCount,
      ineligibleRecords: 5,
      quarantinedRecords: 3,
      sourceRecords: recordCount + excludedRecords,
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

export function bindTestSecurityMasterDocument(
  document: MutableSecurityMasterDocument,
): TestSecurityMasterAdmission {
  return bindTestSecurityMasterBytes(canonicalSecurityMasterBytes(document));
}

export function bindTestSecurityMasterBytes(
  snapshot: Uint8Array,
): TestSecurityMasterAdmission {
  return {
    expectedSha256: `sha256:${createHash("sha256").update(snapshot).digest("hex")}`,
    snapshot,
  };
}

function canonicalSecurityMasterBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}

function testSecurityMasterRecord(index: number): MutableSecurityMasterRecord {
  const suffix = String(index).padStart(5, "0");
  const issuerSuffix = String(Math.floor(index / 2)).padStart(5, "0");
  const securityId = `sec-${suffix}`;
  const shareClassId = `shr-${suffix}`;
  const listingId = `lst-${suffix}`;
  const symbol = `S${suffix}`;
  const tickerHistory: MutableJsonRecord[] = [];
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

function testSecurityMasterIssuer(index: number): MutableJsonRecord {
  const suffix = String(index).padStart(5, "0");
  return {
    cik: String(index + 1).padStart(10, "0"),
    issuerId: `iss-${suffix}`,
    issuerName:
      index === 0 ? "Zéro Alpha Holdings" : `Synthetic Issuer ${suffix}`,
  };
}

function testSecurityMasterProviderMappings(
  index: number,
): MutableJsonRecord[] {
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
  const record = value as MutableJsonRecord;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}
