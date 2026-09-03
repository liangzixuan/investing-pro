import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  SEC_OPENFIGI_V1_SOURCE_PREPARATION_LIMITS,
  SecOpenFigiV1SourcePreparationError,
  prepareSecOpenFigiV1Source,
  type SecOpenFigiV1SourceArtifacts,
  type SecOpenFigiV1SourcePreparationInput,
} from "./sec-openfigi-v1-source-preparation";

type JsonRecord = Record<string, unknown>;
type ArtifactProperty = keyof SecOpenFigiV1SourceArtifacts;

describe("sec_openfigi_v1 source preparation security boundary", () => {
  it("burns the identity-bound read on every first attempt and returns only closed public errors", () => {
    const wrongFirst = prepareSecOpenFigiV1Source(buildFixture());
    if (wrongFirst.status === "quarantined") throw new Error("unexpected");
    assertClosedError(
      captureFailure(() => wrongFirst.readSnapshot(Object.freeze({}))),
      "SEC_OPENFIGI_V1_CAPABILITY_INVALID",
    );
    assertClosedError(
      captureFailure(() => wrongFirst.readSnapshot(wrongFirst.capability)),
      "SEC_OPENFIGI_V1_CAPABILITY_INVALID",
    );

    const extraArgument = prepareSecOpenFigiV1Source(buildFixture());
    if (extraArgument.status === "quarantined") throw new Error("unexpected");
    assertClosedError(
      captureFailure(() =>
        Reflect.apply(extraArgument.readSnapshot, undefined, [
          extraArgument.capability,
          "extra",
        ]),
      ),
      "SEC_OPENFIGI_V1_CAPABILITY_INVALID",
    );
    assertClosedError(
      captureFailure(() =>
        extraArgument.readSnapshot(extraArgument.capability),
      ),
      "SEC_OPENFIGI_V1_CAPABILITY_INVALID",
    );

    const first = prepareSecOpenFigiV1Source(buildFixture());
    const second = prepareSecOpenFigiV1Source(buildFixture());
    if (first.status === "quarantined" || second.status === "quarantined") {
      throw new Error("unexpected");
    }
    assertClosedError(
      captureFailure(() => first.readSnapshot(second.capability)),
      "SEC_OPENFIGI_V1_CAPABILITY_INVALID",
    );
  });

  it("does not expose canary values or paths in digest and schema failures", () => {
    const digestFixture = buildFixture();
    const changedExpected = {
      ...digestFixture.expectedSha256,
      secCandidates: `sha256:${"f".repeat(64)}` as const,
    };
    const digestFailure = captureFailure(() =>
      prepareSecOpenFigiV1Source({
        artifacts: digestFixture.artifacts,
        expectedSha256: changedExpected,
      }),
    );
    assertClosedError(digestFailure, "SEC_OPENFIGI_V1_DIGEST_MISMATCH");

    const schemaFixture = mutatePlan(buildFixture(), (plan) => {
      plan.ownerPath = "C:\\CANARY-PRIVATE\\secret.json";
    });
    const schemaFailure = captureFailure(() =>
      prepareSecOpenFigiV1Source(schemaFixture),
    );
    assertClosedError(schemaFailure, "SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    expect(JSON.stringify(schemaFailure)).not.toContain("CANARY-PRIVATE");
    expect((schemaFailure as Error).message).not.toContain("secret.json");
  });

  it("rejects accessors without invoking them and consumes no caller-owned bytes", () => {
    const fixture = buildFixture();
    let reads = 0;
    const artifacts = { ...fixture.artifacts } as Record<
      ArtifactProperty,
      Uint8Array
    >;
    Object.defineProperty(artifacts, "secCandidates", {
      enumerable: true,
      get() {
        reads += 1;
        return fixture.artifacts.secCandidates;
      },
    });
    const before = new Uint8Array(fixture.artifacts.preparationPlan);

    assertClosedError(
      captureFailure(() =>
        prepareSecOpenFigiV1Source({
          artifacts,
          expectedSha256: fixture.expectedSha256,
        }),
      ),
      "SEC_OPENFIGI_V1_INVALID_INPUT",
    );
    expect(reads).toBe(0);
    expect(fixture.artifacts.preparationPlan).toEqual(before);
  });

  it.each([
    [
      "subclass",
      (source: Uint8Array) => new (class extends Uint8Array {})(source),
      "SEC_OPENFIGI_V1_ARTIFACT_INVALID",
    ],
    [
      "proxy",
      (source: Uint8Array) => new Proxy(source, {}),
      "SEC_OPENFIGI_V1_INVALID_INPUT",
    ],
    [
      "shared buffer",
      (source: Uint8Array) => {
        const shared = new Uint8Array(new SharedArrayBuffer(source.byteLength));
        shared.set(source);
        return shared;
      },
      "SEC_OPENFIGI_V1_INVALID_INPUT",
    ],
    [
      "non-owning view",
      (source: Uint8Array) => {
        const padded = new Uint8Array(source.byteLength + 1);
        padded.set(source, 1);
        return new Uint8Array(padded.buffer, 1, source.byteLength);
      },
      "SEC_OPENFIGI_V1_ARTIFACT_INVALID",
    ],
    [
      "node buffer",
      (source: Uint8Array) => Buffer.from(source),
      "SEC_OPENFIGI_V1_ARTIFACT_INVALID",
    ],
  ] as const)(
    "rejects the hostile %s byte carrier",
    (_label, hostile, code) => {
      const fixture = buildFixture();
      const artifacts = {
        ...fixture.artifacts,
        secCandidates: hostile(fixture.artifacts.secCandidates),
      };

      assertClosedError(
        captureFailure(() =>
          prepareSecOpenFigiV1Source({
            artifacts,
            expectedSha256: fixture.expectedSha256,
          }),
        ),
        code,
      );
    },
  );

  it("rejects detached and oversized artifacts before parsing", () => {
    const detachedFixture = buildFixture();
    const detached = new Uint8Array(detachedFixture.artifacts.secCandidates);
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    assertClosedError(
      captureFailure(() =>
        prepareSecOpenFigiV1Source({
          artifacts: {
            ...detachedFixture.artifacts,
            secCandidates: detached,
          },
          expectedSha256: detachedFixture.expectedSha256,
        }),
      ),
      "SEC_OPENFIGI_V1_ARTIFACT_INVALID",
    );

    const oversizedFixture = buildFixture();
    const oversized = new Uint8Array(
      SEC_OPENFIGI_V1_SOURCE_PREPARATION_LIMITS.artifactBytes + 1,
    );
    assertClosedError(
      captureFailure(() =>
        prepareSecOpenFigiV1Source({
          artifacts: {
            ...oversizedFixture.artifacts,
            secCandidates: oversized,
          },
          expectedSha256: oversizedFixture.expectedSha256,
        }),
      ),
      "SEC_OPENFIGI_V1_ARTIFACT_INVALID",
    );
  });

  it("requires canonical JSON plus exactly one LF and closed role-bound schemas", () => {
    const fixture = buildFixture();
    const text = new TextDecoder().decode(fixture.artifacts.preparationPlan);
    const crlf = new TextEncoder().encode(text.replace(/\n$/u, "\r\n"));
    assertClosedError(
      captureFailure(() =>
        prepareSecOpenFigiV1Source(replacePreparationPlanBytes(fixture, crlf)),
      ),
      "SEC_OPENFIGI_V1_ARTIFACT_INVALID",
    );

    const wrongRole = replaceSourceDocument(
      buildFixture(),
      "secCandidates",
      (document) => {
        document.artifactRole = "iso_mic_registry";
      },
    );
    assertClosedError(
      captureFailure(() => prepareSecOpenFigiV1Source(wrongRole)),
      "SEC_OPENFIGI_V1_ARTIFACT_INVALID",
    );

    const wrongBinding = mutatePlan(buildFixture(), (plan) => {
      const bindings = plan.artifactBindings as JsonRecord[];
      bindings[0]!.sha256 = `sha256:${"a".repeat(64)}`;
    });
    assertClosedError(
      captureFailure(() => prepareSecOpenFigiV1Source(wrongBinding)),
      "SEC_OPENFIGI_V1_ARTIFACT_INVALID",
    );
  });

  it("rejects post-acquisition cover observations and role-wrong or reused opaque identities", () => {
    const futureCover = replaceSourceDocument(
      buildFixture(),
      "normalizedSecCoverEvidence",
      (document) => {
        documentRecords(document)[0]!.observedAt = "2026-03-02T00:00:00.001Z";
      },
    );
    assertClosedError(
      captureFailure(() => prepareSecOpenFigiV1Source(futureCover)),
      "SEC_OPENFIGI_V1_ARTIFACT_INVALID",
    );

    const wrongIdentityRole = replaceSourceDocument(
      buildFixture(),
      "opaqueIdentityAssignments",
      (document) => {
        documentRecords(document)[0]!.listingId = opaqueId("security", 91);
      },
    );
    assertClosedError(
      captureFailure(() => prepareSecOpenFigiV1Source(wrongIdentityRole)),
      "SEC_OPENFIGI_V1_ARTIFACT_INVALID",
    );

    const repeatedMappingId = replaceSourceDocument(
      buildFixture(2),
      "opaqueIdentityAssignments",
      (document) => {
        const records = documentRecords(document);
        const first = records[0]!.mappingIds as JsonRecord;
        const second = records[1]!.mappingIds as JsonRecord;
        second.listingFigi = first.listingFigi;
      },
    );
    assertClosedError(
      captureFailure(() => prepareSecOpenFigiV1Source(repeatedMappingId)),
      "SEC_OPENFIGI_V1_ARTIFACT_INVALID",
    );
  });

  it("quarantines ambiguous mapping joins without leaking rejected values", () => {
    const canary = "CANARY PRIVATE ISSUER";
    const fixture = replaceSourceDocument(
      buildFixture(),
      "aggregatedOpenFigiMappings",
      (document) => {
        const records = documentRecords(document);
        const duplicate = structuredClone(records[0]!);
        duplicate.compositeFigi = figi("3", 0);
        duplicate.figi = figi("4", 0);
        duplicate.name = canary;
        duplicate.shareClassFigi = figi("5", 0);
        records.push(duplicate);
      },
    );

    const result = prepareSecOpenFigiV1Source(fixture);

    expect(result.status).toBe("quarantined");
    expect(result.receipt.exclusionReasonCounts).toMatchObject({
      missingOrAmbiguousOpenFigiMapping: 1,
    });
    expect(JSON.stringify(result)).not.toContain(canary);
    expect(Object.isFrozen(result.receipt.exclusionReasonCounts)).toBe(true);
  });

  it("copies all source bytes before use and returns a caller-owned snapshot copy", () => {
    const fixture = buildFixture();
    const prepared = prepareSecOpenFigiV1Source(fixture);
    if (prepared.status === "quarantined") throw new Error("unexpected");
    for (const bytes of Object.values(fixture.artifacts)) bytes.fill(0x78);

    const revealed = prepared.readSnapshot(prepared.capability);
    const expectedFirstByte = revealed.snapshot[0];
    expect(expectedFirstByte).toBe(0x7b);
    revealed.snapshot.fill(0);
    expect(revealed.catalog.coverage.activeEligibleSecurities).toBe(1);
    expect(revealed.catalog.snapshotSha256).toBe(revealed.expectedSha256);
  });
});

function assertClosedError(
  error: unknown,
  code:
    | "SEC_OPENFIGI_V1_INVALID_INPUT"
    | "SEC_OPENFIGI_V1_DIGEST_MISMATCH"
    | "SEC_OPENFIGI_V1_ARTIFACT_INVALID"
    | "SEC_OPENFIGI_V1_CAPABILITY_INVALID",
): void {
  expect(error).toBeInstanceOf(SecOpenFigiV1SourcePreparationError);
  expect(error).toMatchObject({
    code,
    message: "SEC/OpenFIGI source preparation failed.",
    name: "SecOpenFigiV1SourcePreparationError",
    stack: undefined,
  });
  expect(Object.keys(error as object).sort()).toEqual(["code", "name"]);
}

function captureFailure(operation: () => unknown): unknown {
  try {
    operation();
  } catch (error) {
    return error;
  }
  throw new Error("expected operation to fail");
}

function buildFixture(count = 1): SecOpenFigiV1SourcePreparationInput {
  const secCandidates: JsonRecord[] = [];
  const covers: JsonRecord[] = [];
  const mappings: JsonRecord[] = [];
  const assignments: JsonRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const cik = String(index + 1).padStart(10, "0");
    const symbol = ticker(index);
    secCandidates.push({
      cik,
      companyName: `Synthetic Issuer ${index + 1}`,
      exchangeName: "Nasdaq",
      ticker: symbol,
    });
    covers.push({
      cik,
      classification: "common_stock",
      observedAt: "2026-02-15T00:00:00.000Z",
      securityTitle: `Synthetic Common Stock ${index + 1}`,
      ticker: symbol,
    });
    mappings.push({
      compositeFigi: figi("0", index),
      exchangeMic: "XNAS",
      figi: figi("1", index),
      marketSector: "Equity",
      name: `Synthetic Security ${index + 1}`,
      securityType2: "Common Stock",
      shareClassFigi: figi("2", index),
      ticker: symbol,
      unlisted: false,
    });
    assignments.push({
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
      ticker: symbol,
    });
  }
  const documents = {
    aggregatedOpenFigiMappings: artifact(
      "aggregated_openfigi_mappings",
      mappings,
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
      covers,
    ),
    opaqueIdentityAssignments: {
      artifactRole: "opaque_identity_assignments",
      identityScheme: "independently_minted_opaque_v1",
      profile: "sec_openfigi_v1",
      records: assignments,
      schemaVersion: "1.0.0",
    },
    secCandidates: artifact("sec_candidates", secCandidates),
  };
  return assemble(documents);
}

function assemble(
  documents: Record<Exclude<ArtifactProperty, "preparationPlan">, JsonRecord>,
): SecOpenFigiV1SourcePreparationInput {
  const sourceArtifacts = {
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
  const sourceDigests = {
    aggregatedOpenFigiMappings: sha256(
      sourceArtifacts.aggregatedOpenFigiMappings,
    ),
    isoMicRegistry: sha256(sourceArtifacts.isoMicRegistry),
    normalizedSecCoverEvidence: sha256(
      sourceArtifacts.normalizedSecCoverEvidence,
    ),
    opaqueIdentityAssignments: sha256(
      sourceArtifacts.opaqueIdentityAssignments,
    ),
    secCandidates: sha256(sourceArtifacts.secCandidates),
  };
  const roles = [
    "aggregated_openfigi_mappings",
    "iso_mic_registry",
    "normalized_sec_cover_evidence",
    "opaque_identity_assignments",
    "sec_candidates",
  ] as const;
  const properties = {
    aggregated_openfigi_mappings: "aggregatedOpenFigiMappings",
    iso_mic_registry: "isoMicRegistry",
    normalized_sec_cover_evidence: "normalizedSecCoverEvidence",
    opaque_identity_assignments: "opaqueIdentityAssignments",
    sec_candidates: "secCandidates",
  } as const;
  const preparationPlan = canonicalBytes({
    artifactBindings: roles.map((artifactRole) => ({
      artifactRole,
      sha256: sourceDigests[properties[artifactRole]],
    })),
    artifactRole: "preparation_plan",
    asOf: "2026-04-01T00:00:00.000Z",
    catalogId: "catalog-sec-openfigi-v1",
    catalogVersion: "version-1",
    generatedAt: "2026-03-03T00:00:00.000Z",
    profile: "sec_openfigi_v1",
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
  return {
    artifacts: {
      ...sourceArtifacts,
      preparationPlan,
    },
    expectedSha256: {
      ...sourceDigests,
      preparationPlan: sha256(preparationPlan),
    },
  };
}

function replaceSourceDocument(
  fixture: SecOpenFigiV1SourcePreparationInput,
  property: Exclude<ArtifactProperty, "preparationPlan">,
  mutate: (document: JsonRecord) => void,
): SecOpenFigiV1SourcePreparationInput {
  const documents = {
    aggregatedOpenFigiMappings: parseDocument(
      fixture.artifacts.aggregatedOpenFigiMappings,
    ),
    isoMicRegistry: parseDocument(fixture.artifacts.isoMicRegistry),
    normalizedSecCoverEvidence: parseDocument(
      fixture.artifacts.normalizedSecCoverEvidence,
    ),
    opaqueIdentityAssignments: parseDocument(
      fixture.artifacts.opaqueIdentityAssignments,
    ),
    secCandidates: parseDocument(fixture.artifacts.secCandidates),
  };
  mutate(documents[property]);
  return assemble(documents);
}

function mutatePlan(
  fixture: SecOpenFigiV1SourcePreparationInput,
  mutate: (plan: JsonRecord) => void,
): SecOpenFigiV1SourcePreparationInput {
  const plan = parseDocument(fixture.artifacts.preparationPlan);
  mutate(plan);
  return replacePreparationPlanBytes(fixture, canonicalBytes(plan));
}

function replacePreparationPlanBytes(
  fixture: SecOpenFigiV1SourcePreparationInput,
  preparationPlan: Uint8Array,
): SecOpenFigiV1SourcePreparationInput {
  return {
    artifacts: { ...fixture.artifacts, preparationPlan },
    expectedSha256: {
      ...fixture.expectedSha256,
      preparationPlan: sha256(preparationPlan),
    },
  };
}

function artifact(role: string, records: readonly JsonRecord[]): JsonRecord {
  return {
    artifactRole: role,
    profile: "sec_openfigi_v1",
    records,
    schemaVersion: "1.0.0",
  };
}

function documentRecords(document: JsonRecord): JsonRecord[] {
  return document.records as JsonRecord[];
}

function parseDocument(bytes: Uint8Array): JsonRecord {
  return JSON.parse(new TextDecoder().decode(bytes)) as JsonRecord;
}

function ticker(index: number): string {
  return `T${index.toString(36).toUpperCase().padStart(5, "0")}`;
}

function figi(kind: string, index: number): string {
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
