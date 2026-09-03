import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { searchPersonalSecurityMaster } from "./personal-security-master";
import {
  SEC_OPENFIGI_V1_ARTIFACT_ROLES,
  SEC_OPENFIGI_V1_SOURCE_PREPARATION_CHECKS,
  SEC_OPENFIGI_V1_SOURCE_PREPARATION_NOT_PROVEN,
  SEC_OPENFIGI_V1_SOURCE_PROFILE,
  prepareSecOpenFigiV1Source,
  type SecOpenFigiV1ExpectedSha256,
  type SecOpenFigiV1SourceArtifacts,
  type SecOpenFigiV1SourcePreparationInput,
} from "./sec-openfigi-v1-source-preparation";

type JsonRecord = Record<string, unknown>;

interface SourceDocuments {
  readonly aggregatedOpenFigiMappings: JsonRecord;
  readonly isoMicRegistry: JsonRecord;
  readonly normalizedSecCoverEvidence: JsonRecord;
  readonly opaqueIdentityAssignments: JsonRecord;
  readonly secCandidates: JsonRecord;
}

describe("sec_openfigi_v1 source preparation", () => {
  it("freezes its exact offline boundary, checks, and nonclaims", () => {
    expect(SEC_OPENFIGI_V1_SOURCE_PROFILE).toBe("sec_openfigi_v1");
    expect(SEC_OPENFIGI_V1_ARTIFACT_ROLES).toEqual({
      aggregatedOpenFigiMappings: "aggregated_openfigi_mappings",
      isoMicRegistry: "iso_mic_registry",
      normalizedSecCoverEvidence: "normalized_sec_cover_evidence",
      opaqueIdentityAssignments: "opaque_identity_assignments",
      preparationPlan: "preparation_plan",
      secCandidates: "sec_candidates",
    });
    expect(SEC_OPENFIGI_V1_SOURCE_PREPARATION_CHECKS).toContain(
      "existing_personal_security_master_admission_is_mandatory",
    );
    expect(SEC_OPENFIGI_V1_SOURCE_PREPARATION_NOT_PROVEN).toContain(
      "network_acquisition_credentials_or_fair_access_behavior",
    );
    expect(SEC_OPENFIGI_V1_SOURCE_PREPARATION_NOT_PROVEN).toContain(
      "real_three_thousand_security_breadth_or_production_latency",
    );
    expect(Object.isFrozen(SEC_OPENFIGI_V1_ARTIFACT_ROLES)).toBe(true);
    expect(Object.isFrozen(SEC_OPENFIGI_V1_SOURCE_PREPARATION_CHECKS)).toBe(
      true,
    );
  });

  it("reconciles common stock and ADR rows, admits the canonical snapshot, and exposes it once", () => {
    const fixture = assembleFixture(buildDocuments(2));
    const callerCopies = copyArtifacts(fixture.artifacts);

    const prepared = prepareSecOpenFigiV1Source(fixture);

    expect(prepared.status).toBe("prepared");
    expect(prepared.receipt).toMatchObject({
      admittedRecords: 2,
      artifactCount: 6,
      candidateRecords: 2,
      ineligibleRecords: 0,
      quarantinedRecords: 0,
      staleRecords: 0,
      status: "prepared",
      unsupportedRecords: 0,
    });
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(Object.isFrozen(prepared.receipt)).toBe(true);
    expect(Object.isFrozen(prepared.receipt.exclusionReasonCounts)).toBe(true);
    expect(fixture.artifacts).toEqual(callerCopies);
    if (prepared.status === "quarantined") throw new Error("unexpected");

    const revealed = prepared.readSnapshot(prepared.capability);
    expect(revealed.expectedSha256).toBe(prepared.receipt.snapshotSha256);
    expect(revealed.catalog.coverage).toMatchObject({
      activeEligibleSecurities: 2,
      eligibleSecurityBand: "under_1000",
      ineligibleSourceRecords: 0,
      quarantinedSourceRecords: 0,
      sourceRecords: 2,
      staleSourceRecords: 0,
      unsupportedSourceRecords: 0,
    });
    expect(revealed.catalog.provenance.contentKind).toBe(
      "synthetic_engineering",
    );
    const firstTicker = ticker(0);
    expect(
      searchPersonalSecurityMaster(revealed.catalog, {
        limit: 5,
        query: firstTicker,
      }).results[0],
    ).toMatchObject({
      instrumentType: "common_stock",
      symbol: firstTicker,
    });
    expect(
      JSON.parse(new TextDecoder().decode(revealed.snapshot)),
    ).toMatchObject({
      sourceCoverage: {
        admittedRecords: 2,
        ineligibleRecords: 0,
        quarantinedRecords: 0,
        sourceRecords: 2,
        staleRecords: 0,
        unsupportedRecords: 0,
      },
    });
    expect(() => prepared.readSnapshot(prepared.capability)).toThrowError(
      expect.objectContaining({ code: "SEC_OPENFIGI_V1_CAPABILITY_INVALID" }),
    );
  });

  it("uses deterministic precedence and aggregate-only accounting for every exclusion class", () => {
    const documents = buildDocuments(7);
    const covers = documentRecords(documents.normalizedSecCoverEvidence);
    const candidates = documentRecords(documents.secCandidates);
    const mappings = documentRecords(documents.aggregatedOpenFigiMappings);
    const assignments = documentRecords(documents.opaqueIdentityAssignments);
    const mics = documentRecords(documents.isoMicRegistry);

    covers.push(structuredClone(covers[1]!));
    covers[2]!.classification = "unsupported";
    mappings[3]!.securityType2 =
      mappings[3]!.securityType2 === "Common Stock"
        ? "Depositary Receipt"
        : "Common Stock";
    covers[4]!.observedAt = "2025-12-31T23:59:59.999Z";
    candidates[5]!.exchangeName = "Toronto Stock Exchange";
    mappings[5]!.exchangeMic = "XTSE";
    mics.push({
      countryCode: "CA",
      mic: "XTSE",
      operatingMic: "XTSE",
      secExchangeName: "Toronto Stock Exchange",
      status: "active",
      type: "operating",
    });
    assignments.splice(6, 1);

    const prepared = prepareSecOpenFigiV1Source(assembleFixture(documents));

    expect(prepared.status).toBe("prepared_with_exclusions");
    expect(prepared.receipt).toMatchObject({
      admittedRecords: 1,
      candidateRecords: 7,
      ineligibleRecords: 1,
      quarantinedRecords: 3,
      staleRecords: 1,
      unsupportedRecords: 1,
    });
    expect(prepared.receipt.exclusionReasonCounts).toEqual({
      classificationDisagreement: 1,
      inactiveOrNonUsOperatingMic: 1,
      missingOrAmbiguousIsoMic: 0,
      missingOrAmbiguousNormalizedSecCoverEvidence: 1,
      missingOrAmbiguousOpaqueIdentityAssignment: 1,
      missingOrAmbiguousOpenFigiMapping: 0,
      staleSecCoverEvidence: 1,
      unsupportedClassification: 1,
    });
    if (prepared.status === "quarantined") throw new Error("unexpected");
    const revealed = prepared.readSnapshot(prepared.capability);
    expect(revealed.catalog.coverage).toMatchObject({
      admittedSourceRecords: 1,
      ineligibleSourceRecords: 1,
      quarantinedSourceRecords: 3,
      sourceRecords: 7,
      staleSourceRecords: 1,
      unsupportedSourceRecords: 1,
    });
  });

  it("quarantines one ambiguous opaque assignment without aborting other candidates", () => {
    const documents = buildDocuments(2);
    const assignments = documentRecords(documents.opaqueIdentityAssignments);
    const ambiguous = structuredClone(assignments[0]!);
    ambiguous.listingId = opaqueId("listing", 100);
    ambiguous.mappingIds = {
      compositeFigi: opaqueId("mapping", 300),
      listingFigi: opaqueId("mapping", 301),
      shareClassFigi: opaqueId("mapping", 302),
    };
    ambiguous.securityId = opaqueId("security", 100);
    ambiguous.shareClassId = opaqueId("share-class", 100);
    assignments.push(ambiguous);

    const prepared = prepareSecOpenFigiV1Source(assembleFixture(documents));

    expect(prepared.status).toBe("prepared_with_exclusions");
    expect(prepared.receipt).toMatchObject({
      admittedRecords: 1,
      candidateRecords: 2,
      quarantinedRecords: 1,
    });
    expect(prepared.receipt.exclusionReasonCounts).toMatchObject({
      missingOrAmbiguousOpaqueIdentityAssignment: 1,
    });
    if (prepared.status === "quarantined") throw new Error("unexpected");
    expect(
      prepared.readSnapshot(prepared.capability).catalog.coverage,
    ).toMatchObject({
      admittedSourceRecords: 1,
      quarantinedSourceRecords: 1,
      sourceRecords: 2,
    });
  });

  it("returns a value-free aggregate quarantine when no row can be admitted", () => {
    const documents = buildDocuments(1);
    documentRecords(documents.aggregatedOpenFigiMappings)[0]!.securityType2 =
      "Depositary Receipt";

    const result = prepareSecOpenFigiV1Source(assembleFixture(documents));

    expect(result.status).toBe("quarantined");
    expect(result.receipt).toMatchObject({
      admittedRecords: 0,
      candidateRecords: 1,
      quarantinedRecords: 1,
      snapshotSha256: null,
      status: "quarantined",
    });
    expect("capability" in result).toBe(false);
    expect("readSnapshot" in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain(ticker(0));
    expect(JSON.stringify(result)).not.toContain("Synthetic Issuer");
  });

  it("produces the same exact snapshot for the same exact six artifacts", () => {
    const documents = buildDocuments(12);
    const first = prepareSecOpenFigiV1Source(assembleFixture(documents));
    const second = prepareSecOpenFigiV1Source(assembleFixture(documents));
    if (first.status === "quarantined" || second.status === "quarantined") {
      throw new Error("unexpected");
    }

    const firstSnapshot = first.readSnapshot(first.capability);
    const secondSnapshot = second.readSnapshot(second.capability);

    expect(firstSnapshot.expectedSha256).toBe(secondSnapshot.expectedSha256);
    expect(firstSnapshot.snapshot).toEqual(secondSnapshot.snapshot);
    expect(first.receipt.sourceBundleSha256).toBe(
      second.receipt.sourceBundleSha256,
    );
  });

  it("keeps reconciliation dispositions and emitted ordering independent of source row order", () => {
    const orderedDocuments = buildDocuments(8);
    const reorderedDocuments = structuredClone(orderedDocuments);
    for (const property of [
      "aggregatedOpenFigiMappings",
      "isoMicRegistry",
      "normalizedSecCoverEvidence",
      "opaqueIdentityAssignments",
      "secCandidates",
    ] as const) {
      documentRecords(reorderedDocuments[property]).reverse();
    }
    const ordered = prepareSecOpenFigiV1Source(
      assembleFixture(orderedDocuments),
    );
    const reordered = prepareSecOpenFigiV1Source(
      assembleFixture(reorderedDocuments),
    );
    if (
      ordered.status === "quarantined" ||
      reordered.status === "quarantined"
    ) {
      throw new Error("unexpected");
    }

    const orderedSnapshot = ordered.readSnapshot(ordered.capability);
    const reorderedSnapshot = reordered.readSnapshot(reordered.capability);
    const orderedDocument = JSON.parse(
      new TextDecoder().decode(orderedSnapshot.snapshot),
    ) as JsonRecord;
    const reorderedDocument = JSON.parse(
      new TextDecoder().decode(reorderedSnapshot.snapshot),
    ) as JsonRecord;

    expect(reordered.receipt).toMatchObject({
      admittedRecords: ordered.receipt.admittedRecords,
      candidateRecords: ordered.receipt.candidateRecords,
      exclusionReasonCounts: ordered.receipt.exclusionReasonCounts,
      ineligibleRecords: ordered.receipt.ineligibleRecords,
      quarantinedRecords: ordered.receipt.quarantinedRecords,
      staleRecords: ordered.receipt.staleRecords,
      status: ordered.receipt.status,
      unsupportedRecords: ordered.receipt.unsupportedRecords,
    });
    expect(reorderedDocument.issuers).toEqual(orderedDocument.issuers);
    expect(reorderedDocument.records).toEqual(orderedDocument.records);
    expect(reorderedDocument.providerMappings).toEqual(
      orderedDocument.providerMappings,
    );
    expect(reorderedDocument.sourceCoverage).toEqual(
      orderedDocument.sourceCoverage,
    );
    expect(reordered.receipt.sourceBundleSha256).not.toBe(
      ordered.receipt.sourceBundleSha256,
    );
    expect(reorderedSnapshot.expectedSha256).not.toBe(
      orderedSnapshot.expectedSha256,
    );
  });

  it("admits at least 3,000 synthetic rows without claiming real breadth", () => {
    const prepared = prepareSecOpenFigiV1Source(
      assembleFixture(buildDocuments(3_000)),
    );

    expect(prepared.status).toBe("prepared");
    expect(prepared.receipt.admittedRecords).toBe(3_000);
    if (prepared.status === "quarantined") throw new Error("unexpected");
    const revealed = prepared.readSnapshot(prepared.capability);
    expect(revealed.catalog.coverage).toMatchObject({
      activeEligibleSecurities: 3_000,
      basis: "synthetic_engineering_only_not_real_universe",
      eligibleSecurityBand: "at_least_3000",
      sourceRecords: 3_000,
    });
  });
});

function buildDocuments(count: number): SourceDocuments {
  const secCandidates: JsonRecord[] = [];
  const normalizedSecCoverEvidence: JsonRecord[] = [];
  const aggregatedOpenFigiMappings: JsonRecord[] = [];
  const opaqueIdentityAssignments: JsonRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const currentTicker = ticker(index);
    const cik = String(index + 1).padStart(10, "0");
    const classification = index % 2 === 0 ? "common_stock" : "adr";
    secCandidates.push({
      cik,
      companyName: `Synthetic Issuer ${index + 1}`,
      exchangeName: "Nasdaq",
      ticker: currentTicker,
    });
    normalizedSecCoverEvidence.push({
      cik,
      classification,
      observedAt: "2026-02-15T00:00:00.000Z",
      securityTitle:
        classification === "common_stock"
          ? `Synthetic Common Stock ${index + 1}`
          : `Synthetic ADR ${index + 1}`,
      ticker: currentTicker,
    });
    aggregatedOpenFigiMappings.push({
      compositeFigi: figi("0", index),
      exchangeMic: "XNAS",
      figi: figi("1", index),
      marketSector: "Equity",
      name: `Synthetic Security ${index + 1}`,
      securityType2:
        classification === "common_stock"
          ? "Common Stock"
          : "Depositary Receipt",
      shareClassFigi: figi("2", index),
      ticker: currentTicker,
      unlisted: false,
    });
    opaqueIdentityAssignments.push({
      cik,
      issuerId: opaqueId("issuer", index),
      listingId: opaqueId("listing", index),
      mappingIds: {
        compositeFigi: opaqueId("mapping", index * 3),
        listingFigi: opaqueId("mapping", index * 3 + 1),
        shareClassFigi: opaqueId("mapping", index * 3 + 2),
      },
      securityId: opaqueId("security", index),
      shareClassId: opaqueId("share-class", index),
      ticker: currentTicker,
    });
  }
  return {
    aggregatedOpenFigiMappings: artifact(
      "aggregated_openfigi_mappings",
      aggregatedOpenFigiMappings,
    ),
    isoMicRegistry: artifact("iso_mic_registry", [
      {
        countryCode: "US",
        mic: "XNAS",
        operatingMic: "XNAS",
        secExchangeName: "Nasdaq",
        status: "active",
        type: "operating",
      },
    ]),
    normalizedSecCoverEvidence: artifact(
      "normalized_sec_cover_evidence",
      normalizedSecCoverEvidence,
    ),
    opaqueIdentityAssignments: {
      artifactRole: "opaque_identity_assignments",
      identityScheme: "independently_minted_opaque_v1",
      profile: SEC_OPENFIGI_V1_SOURCE_PROFILE,
      records: opaqueIdentityAssignments,
      schemaVersion: "1.0.0",
    },
    secCandidates: artifact("sec_candidates", secCandidates),
  };
}

function assembleFixture(
  documents: SourceDocuments,
): SecOpenFigiV1SourcePreparationInput {
  const partialArtifacts = {
    aggregatedOpenFigiMappings: canonicalBytes(
      documents.aggregatedOpenFigiMappings,
    ),
    isoMicRegistry: canonicalBytes(documents.isoMicRegistry),
    normalizedSecCoverEvidence: canonicalBytes(
      documents.normalizedSecCoverEvidence,
    ),
    opaqueIdentityAssignments: canonicalBytes(
      documents.opaqueIdentityAssignments,
    ),
    secCandidates: canonicalBytes(documents.secCandidates),
  };
  const partialDigests = {
    aggregatedOpenFigiMappings: sha256(
      partialArtifacts.aggregatedOpenFigiMappings,
    ),
    isoMicRegistry: sha256(partialArtifacts.isoMicRegistry),
    normalizedSecCoverEvidence: sha256(
      partialArtifacts.normalizedSecCoverEvidence,
    ),
    opaqueIdentityAssignments: sha256(
      partialArtifacts.opaqueIdentityAssignments,
    ),
    secCandidates: sha256(partialArtifacts.secCandidates),
  };
  const roles = [
    "aggregated_openfigi_mappings",
    "iso_mic_registry",
    "normalized_sec_cover_evidence",
    "opaque_identity_assignments",
    "sec_candidates",
  ] as const;
  const roleProperties = {
    aggregated_openfigi_mappings: "aggregatedOpenFigiMappings",
    iso_mic_registry: "isoMicRegistry",
    normalized_sec_cover_evidence: "normalizedSecCoverEvidence",
    opaque_identity_assignments: "opaqueIdentityAssignments",
    sec_candidates: "secCandidates",
  } as const;
  const preparationPlan = canonicalBytes({
    artifactBindings: roles.map((artifactRole) => ({
      artifactRole,
      sha256: partialDigests[roleProperties[artifactRole]],
    })),
    artifactRole: "preparation_plan",
    asOf: "2026-04-01T00:00:00.000Z",
    catalogId: "catalog-sec-openfigi-v1",
    catalogVersion: "version-1",
    generatedAt: "2026-03-03T00:00:00.000Z",
    profile: SEC_OPENFIGI_V1_SOURCE_PROFILE,
    provenance: {
      acquiredAt: "2026-03-02T00:00:00.000Z",
      artifacts: roles.map((artifactRole) => ({
        acquiredAt: "2026-03-01T00:00:00.000Z",
        artifactId: `artifact-${artifactRole.replaceAll("_", "-")}`,
        artifactRole,
        mediaType: "application/json",
        sourceUri: `https://example.test/${artifactRole}.json`,
        sourceVersion: "v1",
      })),
      attribution: "Synthetic engineering fixture; not real source data.",
      contentKind: "synthetic_engineering",
      sourceId: "sec_openfigi_v1_fixture",
    },
    schemaVersion: "1.0.0",
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
      policyDocumentSha256: `sha256:${"9".repeat(64)}`,
      policyId: "sec_openfigi_v1_fixture_policy",
      policyProfile: "personal_single_user_local_connected",
      policySchemaVersion: "1.0.0",
      policyVersion: "version-1",
      redistribution: "prohibited",
      retention: "permitted_owner_local",
      reviewedAt: "2026-02-01T00:00:00.000Z",
      revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation",
      revokedAt: null,
      rightsBasis: "owner_reviewed_rights_compatible",
      search: "permitted_owner_local",
      sourceId: "sec_openfigi_v1_fixture",
    },
    staleBefore: "2026-01-15T00:00:00.000Z",
  });
  const artifacts: SecOpenFigiV1SourceArtifacts = Object.freeze({
    ...partialArtifacts,
    preparationPlan,
  });
  const expectedSha256: SecOpenFigiV1ExpectedSha256 = Object.freeze({
    ...partialDigests,
    preparationPlan: sha256(preparationPlan),
  });
  return Object.freeze({ artifacts, expectedSha256 });
}

function artifact(role: string, records: readonly JsonRecord[]): JsonRecord {
  return {
    artifactRole: role,
    profile: SEC_OPENFIGI_V1_SOURCE_PROFILE,
    records,
    schemaVersion: "1.0.0",
  };
}

function documentRecords(document: JsonRecord): JsonRecord[] {
  return document.records as JsonRecord[];
}

function copyArtifacts(
  artifacts: SecOpenFigiV1SourceArtifacts,
): SecOpenFigiV1SourceArtifacts {
  return {
    aggregatedOpenFigiMappings: new Uint8Array(
      artifacts.aggregatedOpenFigiMappings,
    ),
    isoMicRegistry: new Uint8Array(artifacts.isoMicRegistry),
    normalizedSecCoverEvidence: new Uint8Array(
      artifacts.normalizedSecCoverEvidence,
    ),
    opaqueIdentityAssignments: new Uint8Array(
      artifacts.opaqueIdentityAssignments,
    ),
    preparationPlan: new Uint8Array(artifacts.preparationPlan),
    secCandidates: new Uint8Array(artifacts.secCandidates),
  };
}

function ticker(index: number): string {
  return `T${index.toString(36).toUpperCase().padStart(5, "0")}`;
}

function figi(kind: "0" | "1" | "2", index: number): string {
  return `BBG${kind}${index.toString(36).toUpperCase().padStart(8, "0")}`;
}

function opaqueId(
  role: "issuer" | "listing" | "mapping" | "security" | "share-class",
  index: number,
): string {
  return `oid-${role}-${(index + 1).toString(16).padStart(32, "0")}`;
}

function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
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
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
