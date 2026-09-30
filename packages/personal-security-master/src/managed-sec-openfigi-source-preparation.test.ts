import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  admitPersonalSecurityMasterSnapshot,
  searchPersonalSecurityMaster,
} from "./personal-security-master";
import {
  SEC_OPENFIGI_V1_ARTIFACT_ROLES,
  SEC_OPENFIGI_V1_SOURCE_PROFILE,
  prepareManagedSecOpenFigiV1Source,
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

const invalidArtifact: unknown = expect.objectContaining({
  code: "SEC_OPENFIGI_V1_ARTIFACT_INVALID",
});
const invalidCapability: unknown = expect.objectContaining({
  code: "SEC_OPENFIGI_V1_CAPABILITY_INVALID",
});

describe("managed SEC/OpenFIGI source preparation", () => {
  it("preserves synthetic coverage and the shared identity/search result without relabeling the local snapshot", () => {
    const documents = buildDocuments(2);
    const input = assembleFixture(documents);
    const before = copyArtifacts(input.artifacts);
    const first = prepareManagedSecOpenFigiV1Source(input);
    const second = prepareManagedSecOpenFigiV1Source(input);
    const local = prepareSecOpenFigiV1Source(
      assembleFixture(documents, "local"),
    );
    expect(first.status).toBe("prepared");
    expect(first.receipt).toEqual(second.receipt);
    expect(input.artifacts).toEqual(before);
    if (
      first.status === "quarantined" ||
      second.status === "quarantined" ||
      local.status === "quarantined"
    )
      throw new Error("unexpected quarantine");
    const managedSnapshot = first.readSnapshot(first.capability);
    const localSnapshot = local.readSnapshot(local.capability);
    expect(managedSnapshot.snapshot).toEqual(
      second.readSnapshot(second.capability).snapshot,
    );
    expect(managedSnapshot.catalog).toMatchObject({
      profile: "personal_single_user_managed_security_master",
      status: "admitted_for_personal_managed_search",
      coverage: {
        basis: "synthetic_engineering_only_not_real_universe",
        activeEligibleSecurities: 2,
      },
      provenance: {
        contentKind: "synthetic_engineering",
        sourceLocator: `managed-composite-manifest:${first.receipt.sourceBundleSha256}`,
      },
      sourcePolicyCompatibility: {
        localOnly: false,
        rightsBasis: "reviewed_redistributable_source",
      },
    });
    for (const query of [ticker(0), ticker(1)]) {
      expect(
        searchPersonalSecurityMaster(managedSnapshot.catalog, {
          query,
          limit: 5,
        }).results,
      ).toEqual(
        searchPersonalSecurityMaster(localSnapshot.catalog, { query, limit: 5 })
          .results,
      );
    }
    expect(() =>
      admitPersonalSecurityMasterSnapshot({
        snapshot: managedSnapshot.snapshot,
        expectedSha256: managedSnapshot.expectedSha256,
      }),
    ).toThrow();
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.receipt.exclusionReasonCounts)).toBe(true);
    expect(Object.isFrozen(managedSnapshot.catalog)).toBe(true);
  });

  it("records reviewed source declarations without claiming source authenticity", () => {
    // Invented bytes exercise the declaration branch, not actual source rights.
    const input = withPlan(assembleFixture(buildDocuments(1)), (plan) => {
      (plan.provenance as JsonRecord).contentKind = "redistributable_source";
    });
    const prepared = prepareManagedSecOpenFigiV1Source(input);
    if (prepared.status === "quarantined")
      throw new Error("unexpected quarantine");
    expect(
      prepared.readSnapshot(prepared.capability).catalog.coverage.basis,
    ).toBe("reviewed_snapshot_only");
  });

  it("rejects local plans through the managed entry and managed plans through the local entry", () => {
    const documents = buildDocuments(1);
    expect(() =>
      prepareManagedSecOpenFigiV1Source(assembleFixture(documents, "local")),
    ).toThrowError(invalidArtifact);
    expect(() =>
      prepareSecOpenFigiV1Source(assembleFixture(documents)),
    ).toThrowError(invalidArtifact);
    expect(() => {
      Reflect.apply(prepareManagedSecOpenFigiV1Source, undefined, [
        assembleFixture(documents),
        "local",
      ]);
    }).toThrowError(
      expect.objectContaining({ code: "SEC_OPENFIGI_V1_INVALID_INPUT" }),
    );
  });

  it.each([
    ["cache", "permitted_owner_local"],
    ["display", "permitted_owner_local"],
    ["export", "prohibited"],
    ["localOnly", true],
    ["policyProfile", "personal_single_user_local_connected"],
    ["redistribution", "prohibited"],
    ["retention", "permitted_owner_local"],
    ["rightsBasis", "owner_reviewed_rights_compatible"],
    ["search", "permitted_owner_local"],
    ["attribution", "optional"],
    ["revokedAt", "2026-02-01T00:00:00.000Z"],
    ["sourceId", "another-source"],
    ["expiresAt", "2026-04-01T00:00:00.000Z"],
    ["reviewedAt", "2026-03-03T00:00:00.000Z"],
    ["effectiveAt", "2026-02-02T00:00:00.000Z"],
  ])("rejects incompatible policy field %s", (key, value) => {
    const input = withPlan(assembleFixture(buildDocuments(1)), (plan) => {
      (plan.sourcePolicyCompatibility as JsonRecord)[key] = value;
    });
    expect(() => prepareManagedSecOpenFigiV1Source(input)).toThrowError(
      invalidArtifact,
    );
  });

  it.each(["owner_local_source", "licensed_private", ""])(
    "rejects nonmanaged provenance %s",
    (contentKind) => {
      const input = withPlan(assembleFixture(buildDocuments(1)), (plan) => {
        (plan.provenance as JsonRecord).contentKind = contentKind;
      });
      expect(() => prepareManagedSecOpenFigiV1Source(input)).toThrowError(
        invalidArtifact,
      );
    },
  );

  it.each(
    Object.keys(
      SEC_OPENFIGI_V1_ARTIFACT_ROLES,
    ) as (keyof SecOpenFigiV1SourceArtifacts)[],
  )("binds the exact %s bytes", (role) => {
    const input = assembleFixture(buildDocuments(1));
    expect(() =>
      prepareManagedSecOpenFigiV1Source({
        ...input,
        expectedSha256: {
          ...input.expectedSha256,
          [role]: `sha256:${"0".repeat(64)}`,
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "SEC_OPENFIGI_V1_DIGEST_MISMATCH" }),
    );
  });

  it("rejects plan role substitution and cover evidence newer than acquisition", () => {
    const wrongBinding = withPlan(
      assembleFixture(buildDocuments(1)),
      (plan) => {
        (plan.artifactBindings as JsonRecord[])[0]!.artifactRole =
          "sec_candidates";
      },
    );
    expect(() => prepareManagedSecOpenFigiV1Source(wrongBinding)).toThrowError(
      invalidArtifact,
    );
    const documents = buildDocuments(1);
    documentRecords(documents.normalizedSecCoverEvidence)[0]!.observedAt =
      "2026-03-03T00:00:00.000Z";
    expect(() =>
      prepareManagedSecOpenFigiV1Source(assembleFixture(documents)),
    ).toThrowError(invalidArtifact);
  });

  it("uses the same exclusion accounting and identity reconciliation for both profiles", () => {
    const documents = buildDocuments(4);
    documentRecords(documents.normalizedSecCoverEvidence)[1]!.classification =
      "unsupported";
    documentRecords(documents.normalizedSecCoverEvidence)[2]!.observedAt =
      "2026-01-01T00:00:00.000Z";
    documentRecords(documents.opaqueIdentityAssignments).pop();
    const managed = prepareManagedSecOpenFigiV1Source(
      assembleFixture(documents),
    );
    const local = prepareSecOpenFigiV1Source(
      assembleFixture(documents, "local"),
    );
    expect(managed.receipt).toMatchObject({
      admittedRecords: 1,
      candidateRecords: 4,
      quarantinedRecords: 1,
      staleRecords: 1,
      unsupportedRecords: 1,
      status: "prepared_with_exclusions",
    });
    expect(managed.receipt.exclusionReasonCounts).toEqual(
      local.receipt.exclusionReasonCounts,
    );
    expect(managed.status).toBe(local.status);
    if (managed.status === "quarantined" || local.status === "quarantined")
      throw new Error("unexpected quarantine");
    expect(
      searchPersonalSecurityMaster(
        managed.readSnapshot(managed.capability).catalog,
        { query: ticker(0), limit: 5 },
      ).results,
    ).toEqual(
      searchPersonalSecurityMaster(
        local.readSnapshot(local.capability).catalog,
        { query: ticker(0), limit: 5 },
      ).results,
    );
  });

  it("quarantines an ambiguous mapping without releasing a capability or source values", () => {
    const documents = buildDocuments(1);
    const mapping = documentRecords(documents.aggregatedOpenFigiMappings)[0]!;
    documentRecords(documents.aggregatedOpenFigiMappings).push({
      ...mapping,
      figi: figi("1", 9),
    });
    const prepared = prepareManagedSecOpenFigiV1Source(
      assembleFixture(documents),
    );
    expect(prepared.status).toBe("quarantined");
    expect(prepared.receipt).toMatchObject({
      admittedRecords: 0,
      quarantinedRecords: 1,
      snapshotSha256: null,
    });
    expect(Object.keys(prepared).sort()).toEqual(["receipt", "status"]);
    expect(JSON.stringify(prepared)).not.toContain(ticker(0));
  });

  it("consumes failed cross-profile capability attempts without exposing either snapshot", () => {
    const documents = buildDocuments(1);
    const local = prepareSecOpenFigiV1Source(
      assembleFixture(documents, "local"),
    );
    const managed = prepareManagedSecOpenFigiV1Source(
      assembleFixture(documents),
    );
    if (local.status === "quarantined" || managed.status === "quarantined")
      throw new Error("unexpected quarantine");
    expect(() => managed.readSnapshot(local.capability)).toThrowError(
      invalidCapability,
    );
    expect(() => local.readSnapshot(managed.capability)).toThrowError(
      invalidCapability,
    );
    expect(() => managed.readSnapshot(managed.capability)).toThrowError(
      invalidCapability,
    );
    expect(() => local.readSnapshot(local.capability)).toThrowError(
      invalidCapability,
    );
  });

  it("owns captured bytes and rejects copied capabilities and repeat reads", () => {
    const input = assembleFixture(buildDocuments(1));
    const prepared = prepareManagedSecOpenFigiV1Source(input);
    const forged = prepareManagedSecOpenFigiV1Source(input);
    if (prepared.status === "quarantined" || forged.status === "quarantined")
      throw new Error("unexpected quarantine");
    for (const bytes of Object.values(input.artifacts)) bytes.fill(0);
    const snapshot = prepared.readSnapshot(prepared.capability);
    expect(sha256(snapshot.snapshot)).toBe(snapshot.expectedSha256);
    expect(() => prepared.readSnapshot(prepared.capability)).toThrowError(
      invalidCapability,
    );
    expect(() => forged.readSnapshot({ ...forged.capability })).toThrowError(
      invalidCapability,
    );
    expect(() => forged.readSnapshot(forged.capability)).toThrowError(
      invalidCapability,
    );
  });
});

function withPlan(
  input: SecOpenFigiV1SourcePreparationInput,
  change: (plan: JsonRecord) => void,
): SecOpenFigiV1SourcePreparationInput {
  const plan = JSON.parse(
    new TextDecoder().decode(input.artifacts.preparationPlan),
  ) as JsonRecord;
  change(plan);
  const preparationPlan = canonicalBytes(plan);
  return {
    artifacts: { ...input.artifacts, preparationPlan },
    expectedSha256: {
      ...input.expectedSha256,
      preparationPlan: sha256(preparationPlan),
    },
  };
}

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
      providerQueryMic: "XNAS",
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
  profile: "local" | "managed" = "managed",
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
      cache:
        profile === "managed" ? "permitted_managed" : "permitted_owner_local",
      decision: "compatible",
      deleteOnRequest: true,
      display:
        profile === "managed" ? "permitted_managed" : "permitted_owner_local",
      effectiveAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z",
      export:
        profile === "managed" ? "permitted_with_attribution" : "prohibited",
      intendedUse: "personal_security_research",
      localOnly: profile === "local",
      operation: "fetch_snapshot",
      policyDocumentSha256: `sha256:${"9".repeat(64)}`,
      policyId: "sec_openfigi_v1_fixture_policy",
      policyProfile:
        profile === "managed"
          ? "personal_single_user_managed_connected"
          : "personal_single_user_local_connected",
      policySchemaVersion: "1.0.0",
      policyVersion: "version-1",
      redistribution:
        profile === "managed" ? "permitted_with_attribution" : "prohibited",
      retention:
        profile === "managed" ? "permitted_managed" : "permitted_owner_local",
      reviewedAt: "2026-02-01T00:00:00.000Z",
      revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation",
      revokedAt: null,
      rightsBasis:
        profile === "managed"
          ? "reviewed_redistributable_source"
          : "owner_reviewed_rights_compatible",
      search:
        profile === "managed" ? "permitted_managed" : "permitted_owner_local",
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
