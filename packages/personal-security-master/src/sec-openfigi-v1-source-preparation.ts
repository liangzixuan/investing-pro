import { createHash } from "node:crypto";

import {
  PERSONAL_SECURITY_MASTER_PROFILE,
  PERSONAL_SECURITY_MASTER_SCHEMA_VERSION,
  admitPersonalSecurityMasterSnapshot,
  type PersonalSecurityMasterCatalog,
  type PersonalSecurityMasterContentKind,
  type PersonalSecurityMasterSourcePolicyCompatibility,
} from "./personal-security-master";

export const SEC_OPENFIGI_V1_SOURCE_PREPARATION_SCHEMA_VERSION =
  "1.0.0" as const;
export const SEC_OPENFIGI_V1_SOURCE_PROFILE = "sec_openfigi_v1" as const;

export const SEC_OPENFIGI_V1_ARTIFACT_ROLES = Object.freeze({
  aggregatedOpenFigiMappings: "aggregated_openfigi_mappings",
  isoMicRegistry: "iso_mic_registry",
  normalizedSecCoverEvidence: "normalized_sec_cover_evidence",
  opaqueIdentityAssignments: "opaque_identity_assignments",
  preparationPlan: "preparation_plan",
  secCandidates: "sec_candidates",
} as const);

export const SEC_OPENFIGI_V1_SOURCE_PREPARATION_LIMITS = Object.freeze({
  aggregateArtifactBytes: 67_108_864,
  aggregateArrayEntries: 800_000,
  aggregateStringCodePoints: 16_000_000,
  artifactBytes: 16_777_216,
  documentDepth: 10,
  documentNodes: 1_200_000,
  maximumStringCodePoints: 2_048,
  records: 20_000,
});

export const SEC_OPENFIGI_V1_SOURCE_PREPARATION_CHECKS = Object.freeze([
  "six_exact_named_owned_canonical_json_lf_uint8array_artifacts",
  "exact_expected_sha256_and_plan_role_digest_binding",
  "bounded_copy_before_parse_and_hostile_carrier_rejection",
  "deterministic_value_free_record_quarantine",
  "independently_minted_role_typed_opaque_internal_identifiers",
  "active_us_operating_iso_mic_reconciliation",
  "one_unambiguous_listed_openfigi_mapping_per_admitted_candidate",
  "issuer_filed_cover_and_openfigi_common_stock_or_adr_agreement",
  "openfigi_identifiers_remain_typed_provider_mappings",
  "existing_personal_security_master_admission_is_mandatory",
  "identity_bound_consuming_one_shot_snapshot_read",
  "immutable_aggregate_only_receipt_and_generic_closed_errors",
] as const);

export const SEC_OPENFIGI_V1_SOURCE_PREPARATION_NOT_PROVEN = Object.freeze([
  "source_authenticity_or_provider_attestation",
  "legal_opinion_or_source_rights_approval",
  "opaque_identifier_randomness_or_minting_independence",
  "complete_us_or_global_security_coverage",
  "complete_or_exchange_effective_ticker_history",
  "iso_mic_registry_authenticity",
  "openfigi_mapping_freshness",
  "network_acquisition_credentials_or_fair_access_behavior",
  "real_three_thousand_security_breadth_or_production_latency",
  "multi_user_tenant_commercial_or_redistribution_safety",
] as const);

export const SEC_OPENFIGI_V1_SOURCE_PREPARATION_FAILURE_CODES = Object.freeze([
  "SEC_OPENFIGI_V1_INVALID_INPUT",
  "SEC_OPENFIGI_V1_DIGEST_MISMATCH",
  "SEC_OPENFIGI_V1_ARTIFACT_INVALID",
  "SEC_OPENFIGI_V1_CAPABILITY_INVALID",
] as const);

export type SecOpenFigiV1SourcePreparationFailureCode =
  (typeof SEC_OPENFIGI_V1_SOURCE_PREPARATION_FAILURE_CODES)[number];

export class SecOpenFigiV1SourcePreparationError extends Error {
  public constructor(
    public readonly code: SecOpenFigiV1SourcePreparationFailureCode,
  ) {
    super("SEC/OpenFIGI source preparation failed.");
    this.name = "SecOpenFigiV1SourcePreparationError";
    Object.defineProperty(this, "stack", {
      configurable: false,
      enumerable: false,
      value: undefined,
      writable: false,
    });
  }
}

type Sha256 = `sha256:${string}`;
type ArtifactRole =
  (typeof SEC_OPENFIGI_V1_ARTIFACT_ROLES)[keyof typeof SEC_OPENFIGI_V1_ARTIFACT_ROLES];
type SourceArtifactRole = Exclude<ArtifactRole, "preparation_plan">;
type ArtifactProperty = keyof typeof SEC_OPENFIGI_V1_ARTIFACT_ROLES;

export type SecOpenFigiV1ExpectedSha256 = Readonly<
  Record<ArtifactProperty, Sha256>
>;

export type SecOpenFigiV1SourceArtifacts = Readonly<
  Record<ArtifactProperty, Uint8Array>
>;

export interface SecOpenFigiV1SourcePreparationInput {
  readonly artifacts: SecOpenFigiV1SourceArtifacts;
  readonly expectedSha256: SecOpenFigiV1ExpectedSha256;
}

declare const capabilityBrand: unique symbol;
export interface SecOpenFigiV1SnapshotReadCapability {
  readonly [capabilityBrand]: "sec-openfigi-v1-snapshot-read-capability";
}

export interface SecOpenFigiV1ExclusionReasonCounts {
  readonly classificationDisagreement: number;
  readonly inactiveOrNonUsOperatingMic: number;
  readonly missingOrAmbiguousIsoMic: number;
  readonly missingOrAmbiguousNormalizedSecCoverEvidence: number;
  readonly missingOrAmbiguousOpaqueIdentityAssignment: number;
  readonly missingOrAmbiguousOpenFigiMapping: number;
  readonly staleSecCoverEvidence: number;
  readonly unsupportedClassification: number;
}

export interface SecOpenFigiV1SourcePreparationReceipt {
  readonly admittedRecords: number;
  readonly artifactCount: 6;
  readonly candidateRecords: number;
  readonly ineligibleRecords: number;
  readonly quarantinedRecords: number;
  readonly exclusionReasonCounts: SecOpenFigiV1ExclusionReasonCounts;
  readonly schemaVersion: typeof SEC_OPENFIGI_V1_SOURCE_PREPARATION_SCHEMA_VERSION;
  readonly snapshotSha256: Sha256 | null;
  readonly sourceBundleSha256: Sha256;
  readonly sourceProfile: typeof SEC_OPENFIGI_V1_SOURCE_PROFILE;
  readonly status: "prepared" | "prepared_with_exclusions" | "quarantined";
  readonly staleRecords: number;
  readonly unsupportedRecords: number;
}

export interface SecOpenFigiV1PreparedSnapshot {
  readonly catalog: PersonalSecurityMasterCatalog;
  readonly expectedSha256: Sha256;
  readonly snapshot: Uint8Array;
}

export interface SecOpenFigiV1PreparedSource {
  readonly capability: SecOpenFigiV1SnapshotReadCapability;
  readonly readSnapshot: (capability: unknown) => SecOpenFigiV1PreparedSnapshot;
  readonly receipt: SecOpenFigiV1SourcePreparationReceipt;
  readonly status: "prepared" | "prepared_with_exclusions";
}

export interface SecOpenFigiV1QuarantinedSource {
  readonly receipt: SecOpenFigiV1SourcePreparationReceipt;
  readonly status: "quarantined";
}

export type SecOpenFigiV1SourcePreparation =
  SecOpenFigiV1PreparedSource | SecOpenFigiV1QuarantinedSource;

interface CapturedArtifacts {
  readonly aggregatedOpenFigiMappings: Uint8Array;
  readonly isoMicRegistry: Uint8Array;
  readonly normalizedSecCoverEvidence: Uint8Array;
  readonly opaqueIdentityAssignments: Uint8Array;
  readonly preparationPlan: Uint8Array;
  readonly secCandidates: Uint8Array;
}

interface PreparationPlan {
  readonly asOf: string;
  readonly catalogId: string;
  readonly catalogVersion: string;
  readonly staleBefore: string;
  readonly generatedAt: string;
  readonly provenance: PlanProvenance;
  readonly sourcePolicyCompatibility: PersonalSecurityMasterSourcePolicyCompatibility;
}

interface PlanProvenance {
  readonly acquiredAt: string;
  readonly artifacts: readonly PlanProvenanceArtifact[];
  readonly attribution: string;
  readonly contentKind: PersonalSecurityMasterContentKind;
  readonly sourceId: string;
}

interface PlanProvenanceArtifact {
  readonly acquiredAt: string;
  readonly artifactId: string;
  readonly artifactRole: SourceArtifactRole;
  readonly mediaType: "application/json";
  readonly sourceUri: string;
  readonly sourceVersion: string;
}

interface SecCandidate {
  readonly cik: string;
  readonly companyName: string;
  readonly exchangeName: string;
  readonly ticker: string;
}

interface NormalizedSecCoverEvidence {
  readonly cik: string;
  readonly classification: "adr" | "common_stock" | "unsupported";
  readonly observedAt: string;
  readonly securityTitle: string;
  readonly ticker: string;
}

interface OpenFigiMapping {
  readonly compositeFigi: string;
  readonly exchangeMic: string;
  readonly figi: string;
  readonly marketSector: "Equity";
  readonly name: string;
  readonly securityType2: "Common Stock" | "Depositary Receipt";
  readonly shareClassFigi: string;
  readonly ticker: string;
  readonly unlisted: false;
}

interface IsoMicEntry {
  readonly countryCode: string;
  readonly mic: string;
  readonly operatingMic: string;
  readonly secExchangeName: string;
  readonly status: "active" | "expired";
  readonly type: "operating" | "segment";
}

interface OpaqueIdentityAssignment {
  readonly cik: string;
  readonly issuerId: string;
  readonly listingId: string;
  readonly mappingIds: Readonly<{
    compositeFigi: string;
    listingFigi: string;
    shareClassFigi: string;
  }>;
  readonly securityId: string;
  readonly shareClassId: string;
  readonly ticker: string;
}

interface Resolution {
  readonly assignment: OpaqueIdentityAssignment;
  readonly candidate: SecCandidate;
  readonly cover: NormalizedSecCoverEvidence;
  readonly mapping: OpenFigiMapping;
  readonly mic: IsoMicEntry;
}

interface Reconciliation {
  readonly admitted: readonly Resolution[];
  readonly ineligibleRecords: number;
  readonly quarantinedRecords: number;
  readonly reasons: SecOpenFigiV1ExclusionReasonCounts;
  readonly staleRecords: number;
  readonly unsupportedRecords: number;
}

interface InternalFailureShape {
  readonly code: SecOpenFigiV1SourcePreparationFailureCode;
}

class InternalFailure extends Error implements InternalFailureShape {
  public constructor(
    public readonly code: SecOpenFigiV1SourcePreparationFailureCode,
  ) {
    super();
  }
}

const ARTIFACT_PROPERTIES = Object.freeze([
  "preparationPlan",
  "secCandidates",
  "normalizedSecCoverEvidence",
  "aggregatedOpenFigiMappings",
  "isoMicRegistry",
  "opaqueIdentityAssignments",
] as const satisfies readonly ArtifactProperty[]);

const SOURCE_ARTIFACT_ROLES = Object.freeze([
  "aggregated_openfigi_mappings",
  "iso_mic_registry",
  "normalized_sec_cover_evidence",
  "opaque_identity_assignments",
  "sec_candidates",
] as const satisfies readonly SourceArtifactRole[]);

const HASH = /^sha256:[0-9a-f]{64}$/u;
const CIK = /^[0-9]{10}$/u;
const MIC = /^[A-Z0-9]{4}$/u;
const COUNTRY_CODE = /^[A-Z]{2}$/u;
const SYMBOL = /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;
const FIGI = /^BBG[A-Z0-9]{9}$/u;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const DISALLOWED_CHARACTER = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const OPAQUE_ID =
  /^oid-(issuer|security|share-class|listing|mapping)-[0-9a-f]{32}$/u;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_BUFFER_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
);
const TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
);
const TYPED_ARRAY_BYTE_OFFSET_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
);
const TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
);
const ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
);
const UINT8_ARRAY_FILL = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "fill",
)?.value as typeof Uint8Array.prototype.fill;
const UINT8_ARRAY_SET = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "set",
)?.value as typeof Uint8Array.prototype.set;

export function prepareSecOpenFigiV1Source(
  input: SecOpenFigiV1SourcePreparationInput,
): SecOpenFigiV1SourcePreparation {
  let captured: CapturedArtifacts | undefined;
  let retainedSnapshot: Uint8Array | undefined;
  try {
    if (arguments.length !== 1) fail("SEC_OPENFIGI_V1_INVALID_INPUT");
    const capturedInput = snapshotInput(input);
    captured = capturedInput.artifacts;
    assertExpectedDigests(captured, capturedInput.expectedSha256);

    const sourceBundleSha256 = bundleDigest(capturedInput.expectedSha256);
    const documents = Object.freeze({
      aggregatedOpenFigiMappings: parseCanonicalArtifact(
        captured.aggregatedOpenFigiMappings,
      ),
      isoMicRegistry: parseCanonicalArtifact(captured.isoMicRegistry),
      normalizedSecCoverEvidence: parseCanonicalArtifact(
        captured.normalizedSecCoverEvidence,
      ),
      opaqueIdentityAssignments: parseCanonicalArtifact(
        captured.opaqueIdentityAssignments,
      ),
      preparationPlan: parseCanonicalArtifact(captured.preparationPlan),
      secCandidates: parseCanonicalArtifact(captured.secCandidates),
    });

    const plan = validatePreparationPlan(
      documents.preparationPlan,
      capturedInput.expectedSha256,
    );
    const candidates = validateSecCandidates(documents.secCandidates);
    const coverEvidence = validateNormalizedSecCoverEvidence(
      documents.normalizedSecCoverEvidence,
      plan.provenance.acquiredAt,
    );
    const mappings = validateAggregatedOpenFigiMappings(
      documents.aggregatedOpenFigiMappings,
    );
    const micRegistry = validateIsoMicRegistry(documents.isoMicRegistry);
    const assignments = validateOpaqueIdentityAssignments(
      documents.opaqueIdentityAssignments,
    );
    const reconciliation = reconcile(
      candidates,
      coverEvidence,
      mappings,
      micRegistry,
      assignments,
      plan.staleBefore,
    );

    if (reconciliation.admitted.length === 0) {
      const receipt = makeReceipt(
        candidates.length,
        reconciliation,
        sourceBundleSha256,
        null,
      );
      return Object.freeze({ receipt, status: "quarantined" as const });
    }

    retainedSnapshot = canonicalBytes(
      buildPersonalSecurityMasterSnapshot(
        plan,
        reconciliation,
        capturedInput.expectedSha256,
        sourceBundleSha256,
      ),
    );
    const snapshotSha256 = sha256(retainedSnapshot);
    const catalog = admitPersonalSecurityMasterSnapshot({
      expectedSha256: snapshotSha256,
      snapshot: retainedSnapshot,
    });
    const receipt = makeReceipt(
      candidates.length,
      reconciliation,
      sourceBundleSha256,
      snapshotSha256,
    );
    const status =
      reconciliation.quarantinedRecords === 0 &&
      reconciliation.ineligibleRecords === 0 &&
      reconciliation.staleRecords === 0 &&
      reconciliation.unsupportedRecords === 0
        ? "prepared"
        : "prepared_with_exclusions";
    const capability = Object.freeze({}) as SecOpenFigiV1SnapshotReadCapability;
    let consumed = false;
    const readSnapshot = function (
      candidateCapability: unknown,
    ): SecOpenFigiV1PreparedSnapshot {
      let source: Uint8Array | undefined;
      try {
        if (consumed) fail("SEC_OPENFIGI_V1_CAPABILITY_INVALID");
        consumed = true;
        source = retainedSnapshot;
        retainedSnapshot = undefined;
        if (
          arguments.length !== 1 ||
          candidateCapability !== capability ||
          source === undefined
        ) {
          fail("SEC_OPENFIGI_V1_CAPABILITY_INVALID");
        }
        return Object.freeze({
          catalog,
          expectedSha256: snapshotSha256,
          snapshot: copyBytes(source),
        });
      } catch (error) {
        throw publicError(error, "SEC_OPENFIGI_V1_CAPABILITY_INVALID");
      } finally {
        wipeBytes(source);
      }
    };
    return Object.freeze({
      capability,
      readSnapshot,
      receipt,
      status,
    });
  } catch (error) {
    wipeBytes(retainedSnapshot);
    throw publicError(error, "SEC_OPENFIGI_V1_INVALID_INPUT");
  } finally {
    wipeArtifacts(captured);
  }
}

function snapshotInput(value: unknown): Readonly<{
  artifacts: CapturedArtifacts;
  expectedSha256: SecOpenFigiV1ExpectedSha256;
}> {
  const input = exactDataObject(
    value,
    ["artifacts", "expectedSha256"],
    "SEC_OPENFIGI_V1_INVALID_INPUT",
  );
  const expected = exactDataObject(
    input.expectedSha256,
    ARTIFACT_PROPERTIES,
    "SEC_OPENFIGI_V1_INVALID_INPUT",
  );
  const source = exactDataObject(
    input.artifacts,
    ARTIFACT_PROPERTIES,
    "SEC_OPENFIGI_V1_INVALID_INPUT",
  );
  const expectedSha256 = {} as Record<ArtifactProperty, Sha256>;
  for (const property of ARTIFACT_PROPERTIES) {
    if (
      typeof expected[property] !== "string" ||
      !HASH.test(expected[property])
    ) {
      fail("SEC_OPENFIGI_V1_INVALID_INPUT");
    }
    expectedSha256[property] = expected[property] as Sha256;
  }
  const snapshots = {} as Record<ArtifactProperty, Uint8Array>;
  let aggregateBytes = 0;
  try {
    for (const property of ARTIFACT_PROPERTIES) {
      const snapshot = byteSnapshot(source[property]);
      snapshots[property] = snapshot;
      aggregateBytes += snapshot.byteLength;
      if (
        aggregateBytes >
        SEC_OPENFIGI_V1_SOURCE_PREPARATION_LIMITS.aggregateArtifactBytes
      ) {
        fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
      }
    }
  } catch (error) {
    for (const property of ARTIFACT_PROPERTIES) wipeBytes(snapshots[property]);
    throw error;
  }
  return Object.freeze({
    artifacts: Object.freeze(snapshots),
    expectedSha256: Object.freeze(expectedSha256),
  });
}

function assertExpectedDigests(
  artifacts: CapturedArtifacts,
  expected: SecOpenFigiV1ExpectedSha256,
): void {
  for (const property of ARTIFACT_PROPERTIES) {
    if (sha256(artifacts[property]) !== expected[property]) {
      fail("SEC_OPENFIGI_V1_DIGEST_MISMATCH");
    }
  }
}

function validatePreparationPlan(
  value: unknown,
  expected: SecOpenFigiV1ExpectedSha256,
): PreparationPlan {
  const root = artifactRoot(value, "preparation_plan", [
    "artifactBindings",
    "artifactRole",
    "asOf",
    "catalogId",
    "catalogVersion",
    "staleBefore",
    "generatedAt",
    "profile",
    "provenance",
    "schemaVersion",
    "sourcePolicyCompatibility",
  ]);
  if (
    !isSafeId(root.catalogId) ||
    !isSafeId(root.catalogVersion) ||
    typeof root.staleBefore !== "string" ||
    typeof root.asOf !== "string" ||
    typeof root.generatedAt !== "string" ||
    !Array.isArray(root.artifactBindings)
  ) {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  const asOf = parseInstant(root.asOf);
  const generatedAt = parseInstant(root.generatedAt);
  const staleBefore = parseInstant(root.staleBefore);
  if (generatedAt > asOf || staleBefore > asOf) {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }

  const bindings = exactDenseDataArray(
    root.artifactBindings,
    SOURCE_ARTIFACT_ROLES.length,
  );
  for (const [index, role] of SOURCE_ARTIFACT_ROLES.entries()) {
    const binding = exactRecord(bindings[index], ["artifactRole", "sha256"]);
    const property = propertyForRole(role);
    if (
      binding.artifactRole !== role ||
      binding.sha256 !== expected[property]
    ) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
  }
  const provenance = validatePlanProvenance(root.provenance, generatedAt);
  const policy = validatePlanPolicy(
    root.sourcePolicyCompatibility,
    provenance,
    asOf,
  );
  return Object.freeze({
    asOf: root.asOf,
    catalogId: root.catalogId,
    catalogVersion: root.catalogVersion,
    staleBefore: root.staleBefore,
    generatedAt: root.generatedAt,
    provenance,
    sourcePolicyCompatibility: policy,
  });
}

function validatePlanProvenance(
  value: unknown,
  generatedAt: number,
): PlanProvenance {
  const root = exactRecord(value, [
    "acquiredAt",
    "artifacts",
    "attribution",
    "contentKind",
    "sourceId",
  ]);
  if (
    typeof root.acquiredAt !== "string" ||
    !Array.isArray(root.artifacts) ||
    !isBoundedText(root.attribution, 1, 512) ||
    (root.contentKind !== "owner_local_source" &&
      root.contentKind !== "synthetic_engineering") ||
    !isSafeId(root.sourceId)
  ) {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  const acquiredAt = parseInstant(root.acquiredAt);
  if (acquiredAt > generatedAt) fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  const values = exactDenseDataArray(
    root.artifacts,
    SOURCE_ARTIFACT_ROLES.length,
  );
  const artifacts: PlanProvenanceArtifact[] = [];
  const seenRoles = new Set<SourceArtifactRole>();
  const seenIds = new Set<string>();
  for (const value of values) {
    const artifact = exactRecord(value, [
      "acquiredAt",
      "artifactId",
      "artifactRole",
      "mediaType",
      "sourceUri",
      "sourceVersion",
    ]);
    if (
      typeof artifact.acquiredAt !== "string" ||
      !isSafeId(artifact.artifactId) ||
      !isSourceArtifactRole(artifact.artifactRole) ||
      artifact.mediaType !== "application/json" ||
      !isCanonicalHttpsUrl(artifact.sourceUri) ||
      !isBoundedTrimmedText(artifact.sourceVersion, 1, 256) ||
      parseInstant(artifact.acquiredAt) > acquiredAt ||
      seenRoles.has(artifact.artifactRole) ||
      seenIds.has(identityKey(artifact.artifactId))
    ) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
    seenRoles.add(artifact.artifactRole);
    seenIds.add(identityKey(artifact.artifactId));
    artifacts.push(
      Object.freeze({
        acquiredAt: artifact.acquiredAt,
        artifactId: artifact.artifactId,
        artifactRole: artifact.artifactRole,
        mediaType: "application/json" as const,
        sourceUri: artifact.sourceUri,
        sourceVersion: artifact.sourceVersion,
      }),
    );
  }
  if (SOURCE_ARTIFACT_ROLES.some((role) => !seenRoles.has(role))) {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  return Object.freeze({
    acquiredAt: root.acquiredAt,
    artifacts: Object.freeze(artifacts),
    attribution: root.attribution,
    contentKind: root.contentKind,
    sourceId: root.sourceId,
  });
}

function validatePlanPolicy(
  value: unknown,
  provenance: PlanProvenance,
  asOf: number,
): PersonalSecurityMasterSourcePolicyCompatibility {
  const policy = exactRecord(value, [
    "attribution",
    "cache",
    "decision",
    "deleteOnRequest",
    "display",
    "effectiveAt",
    "expiresAt",
    "export",
    "intendedUse",
    "localOnly",
    "operation",
    "policyDocumentSha256",
    "policyId",
    "policyProfile",
    "policySchemaVersion",
    "policyVersion",
    "redistribution",
    "retention",
    "reviewedAt",
    "revocationCheck",
    "revokedAt",
    "rightsBasis",
    "search",
    "sourceId",
  ]);
  if (
    policy.attribution !== "required" ||
    policy.cache !== "permitted_owner_local" ||
    policy.decision !== "compatible" ||
    policy.deleteOnRequest !== true ||
    policy.display !== "permitted_owner_local" ||
    typeof policy.effectiveAt !== "string" ||
    typeof policy.expiresAt !== "string" ||
    policy.export !== "prohibited" ||
    policy.intendedUse !== "personal_security_research" ||
    policy.localOnly !== true ||
    policy.operation !== "fetch_snapshot" ||
    typeof policy.policyDocumentSha256 !== "string" ||
    !HASH.test(policy.policyDocumentSha256) ||
    !isSafeId(policy.policyId) ||
    policy.policyProfile !== "personal_single_user_local_connected" ||
    policy.policySchemaVersion !== "1.0.0" ||
    !isSafeId(policy.policyVersion) ||
    policy.redistribution !== "prohibited" ||
    policy.retention !== "permitted_owner_local" ||
    typeof policy.reviewedAt !== "string" ||
    policy.revocationCheck !==
      "offline_snapshot_only_cannot_discover_later_revocation" ||
    policy.revokedAt !== null ||
    policy.rightsBasis !== "owner_reviewed_rights_compatible" ||
    policy.search !== "permitted_owner_local" ||
    policy.sourceId !== provenance.sourceId
  ) {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  const effectiveAt = parseInstant(policy.effectiveAt);
  const reviewedAt = parseInstant(policy.reviewedAt);
  const acquiredAt = parseInstant(provenance.acquiredAt);
  const expiresAt = parseInstant(policy.expiresAt);
  if (
    effectiveAt > reviewedAt ||
    reviewedAt > acquiredAt ||
    acquiredAt > asOf ||
    asOf >= expiresAt
  ) {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  return Object.freeze({
    attribution: "required",
    cache: "permitted_owner_local",
    decision: "compatible",
    deleteOnRequest: true,
    display: "permitted_owner_local",
    effectiveAt: policy.effectiveAt,
    expiresAt: policy.expiresAt,
    export: "prohibited",
    intendedUse: "personal_security_research",
    localOnly: true,
    operation: "fetch_snapshot",
    policyDocumentSha256: policy.policyDocumentSha256 as Sha256,
    policyId: policy.policyId,
    policyProfile: "personal_single_user_local_connected",
    policySchemaVersion: "1.0.0",
    policyVersion: policy.policyVersion,
    redistribution: "prohibited",
    retention: "permitted_owner_local",
    reviewedAt: policy.reviewedAt,
    revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation",
    revokedAt: null,
    rightsBasis: "owner_reviewed_rights_compatible",
    search: "permitted_owner_local",
    sourceId: provenance.sourceId,
  });
}

function validateSecCandidates(value: unknown): readonly SecCandidate[] {
  const records = recordsArtifact(value, "sec_candidates");
  const result: SecCandidate[] = [];
  const keys = new Set<string>();
  for (const value of records) {
    const record = exactRecord(value, [
      "cik",
      "companyName",
      "exchangeName",
      "ticker",
    ]);
    if (
      !isCik(record.cik) ||
      !isName(record.companyName) ||
      !isName(record.exchangeName) ||
      !isSymbol(record.ticker)
    ) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
    const key = candidateKey(record.cik, record.ticker);
    if (keys.has(key)) fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    keys.add(key);
    result.push(
      Object.freeze({
        cik: record.cik,
        companyName: record.companyName,
        exchangeName: record.exchangeName,
        ticker: record.ticker,
      }),
    );
  }
  return Object.freeze(result);
}

function validateNormalizedSecCoverEvidence(
  value: unknown,
  acquiredAt: string,
): readonly NormalizedSecCoverEvidence[] {
  const records = recordsArtifact(value, "normalized_sec_cover_evidence");
  const result: NormalizedSecCoverEvidence[] = [];
  const acquiredAtInstant = parseInstant(acquiredAt);
  for (const value of records) {
    const record = exactRecord(value, [
      "cik",
      "classification",
      "observedAt",
      "securityTitle",
      "ticker",
    ]);
    if (
      !isCik(record.cik) ||
      (record.classification !== "adr" &&
        record.classification !== "common_stock" &&
        record.classification !== "unsupported") ||
      typeof record.observedAt !== "string" ||
      parseInstant(record.observedAt) > acquiredAtInstant ||
      !isName(record.securityTitle) ||
      !isSymbol(record.ticker)
    ) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
    result.push(
      Object.freeze({
        cik: record.cik,
        classification: record.classification,
        observedAt: record.observedAt,
        securityTitle: record.securityTitle,
        ticker: record.ticker,
      }),
    );
  }
  return Object.freeze(result);
}

function validateAggregatedOpenFigiMappings(
  value: unknown,
): readonly OpenFigiMapping[] {
  const records = recordsArtifact(value, "aggregated_openfigi_mappings");
  const result: OpenFigiMapping[] = [];
  for (const value of records) {
    const record = exactRecord(value, [
      "compositeFigi",
      "exchangeMic",
      "figi",
      "marketSector",
      "name",
      "securityType2",
      "shareClassFigi",
      "ticker",
      "unlisted",
    ]);
    if (
      !isFigi(record.compositeFigi) ||
      !isMic(record.exchangeMic) ||
      !isFigi(record.figi) ||
      record.marketSector !== "Equity" ||
      !isName(record.name) ||
      (record.securityType2 !== "Common Stock" &&
        record.securityType2 !== "Depositary Receipt") ||
      !isFigi(record.shareClassFigi) ||
      !isSymbol(record.ticker) ||
      record.unlisted !== false ||
      new Set([record.compositeFigi, record.figi, record.shareClassFigi])
        .size !== 3
    ) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
    result.push(
      Object.freeze({
        compositeFigi: record.compositeFigi,
        exchangeMic: record.exchangeMic,
        figi: record.figi,
        marketSector: "Equity",
        name: record.name,
        securityType2: record.securityType2,
        shareClassFigi: record.shareClassFigi,
        ticker: record.ticker,
        unlisted: false,
      }),
    );
  }
  return Object.freeze(result);
}

function validateIsoMicRegistry(value: unknown): readonly IsoMicEntry[] {
  const records = recordsArtifact(value, "iso_mic_registry");
  const result: IsoMicEntry[] = [];
  const micKeys = new Set<string>();
  for (const value of records) {
    const record = exactRecord(value, [
      "countryCode",
      "mic",
      "operatingMic",
      "secExchangeName",
      "status",
      "type",
    ]);
    if (
      typeof record.countryCode !== "string" ||
      !COUNTRY_CODE.test(record.countryCode) ||
      !isMic(record.mic) ||
      !isMic(record.operatingMic) ||
      !isName(record.secExchangeName) ||
      (record.status !== "active" && record.status !== "expired") ||
      (record.type !== "operating" && record.type !== "segment") ||
      (record.type === "operating" && record.mic !== record.operatingMic)
    ) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
    const key = identityKey(record.mic);
    if (micKeys.has(key)) fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    micKeys.add(key);
    result.push(
      Object.freeze({
        countryCode: record.countryCode,
        mic: record.mic,
        operatingMic: record.operatingMic,
        secExchangeName: record.secExchangeName,
        status: record.status,
        type: record.type,
      }),
    );
  }
  return Object.freeze(result);
}

function validateOpaqueIdentityAssignments(
  value: unknown,
): readonly OpaqueIdentityAssignment[] {
  const root = artifactRoot(value, "opaque_identity_assignments", [
    "artifactRole",
    "identityScheme",
    "profile",
    "records",
    "schemaVersion",
  ]);
  if (
    root.identityScheme !== "independently_minted_opaque_v1" ||
    !Array.isArray(root.records) ||
    root.records.length < 1 ||
    root.records.length > SEC_OPENFIGI_V1_SOURCE_PREPARATION_LIMITS.records
  ) {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  const result: OpaqueIdentityAssignment[] = [];
  const identities = new Set<string>();
  const issuerIdentityByCik = new Map<string, string>();
  const cikByIssuerIdentity = new Map<string, string>();
  for (const value of root.records) {
    const record = exactRecord(value, [
      "cik",
      "issuerId",
      "listingId",
      "mappingIds",
      "securityId",
      "shareClassId",
      "ticker",
    ]);
    const mappingIds = exactRecord(record.mappingIds, [
      "compositeFigi",
      "listingFigi",
      "shareClassFigi",
    ]);
    if (
      !isCik(record.cik) ||
      !isOpaqueId(record.issuerId, "issuer") ||
      !isOpaqueId(record.securityId, "security") ||
      !isOpaqueId(record.shareClassId, "share-class") ||
      !isOpaqueId(record.listingId, "listing") ||
      !isOpaqueId(mappingIds.compositeFigi, "mapping") ||
      !isOpaqueId(mappingIds.listingFigi, "mapping") ||
      !isOpaqueId(mappingIds.shareClassFigi, "mapping") ||
      !isSymbol(record.ticker)
    ) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
    const priorIssuer = issuerIdentityByCik.get(record.cik);
    const priorCik = cikByIssuerIdentity.get(record.issuerId);
    if (
      (priorIssuer !== undefined && priorIssuer !== record.issuerId) ||
      (priorCik !== undefined && priorCik !== record.cik)
    ) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
    issuerIdentityByCik.set(record.cik, record.issuerId);
    cikByIssuerIdentity.set(record.issuerId, record.cik);
    const uniqueForRecord = [
      record.securityId,
      record.shareClassId,
      record.listingId,
      mappingIds.compositeFigi,
      mappingIds.listingFigi,
      mappingIds.shareClassFigi,
    ];
    if (priorIssuer === undefined) uniqueForRecord.push(record.issuerId);
    for (const identity of uniqueForRecord) {
      const key = identityKey(identity);
      if (identities.has(key)) fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
      identities.add(key);
    }
    result.push(
      Object.freeze({
        cik: record.cik,
        issuerId: record.issuerId,
        listingId: record.listingId,
        mappingIds: Object.freeze({
          compositeFigi: mappingIds.compositeFigi,
          listingFigi: mappingIds.listingFigi,
          shareClassFigi: mappingIds.shareClassFigi,
        }),
        securityId: record.securityId,
        shareClassId: record.shareClassId,
        ticker: record.ticker,
      }),
    );
  }
  return Object.freeze(result);
}

function reconcile(
  candidates: readonly SecCandidate[],
  coverEvidence: readonly NormalizedSecCoverEvidence[],
  mappings: readonly OpenFigiMapping[],
  micRegistry: readonly IsoMicEntry[],
  assignments: readonly OpaqueIdentityAssignment[],
  staleBefore: string,
): Reconciliation {
  const coverByCandidate = groupBy(coverEvidence, (value) =>
    candidateKey(value.cik, value.ticker),
  );
  const assignmentByCandidate = groupBy(assignments, (value) =>
    candidateKey(value.cik, value.ticker),
  );
  const micByExchangeName = groupBy(micRegistry, (value) =>
    identityKey(value.secExchangeName),
  );
  const mappingByTickerMic = groupBy(mappings, (value) =>
    listingKey(value.ticker, value.exchangeMic),
  );
  const reasons = mutableReasonCounts();
  const resolutions: Resolution[] = [];
  let unsupportedRecords = 0;
  let quarantinedRecords = 0;
  let ineligibleRecords = 0;
  let staleRecords = 0;
  const staleBeforeInstant = parseInstant(staleBefore);

  for (const candidate of candidates) {
    const coverMatches = coverByCandidate.get(
      candidateKey(candidate.cik, candidate.ticker),
    );
    if (coverMatches?.length !== 1) {
      reasons.missingOrAmbiguousNormalizedSecCoverEvidence += 1;
      quarantinedRecords += 1;
      continue;
    }
    const cover = coverMatches[0]!;
    if (parseInstant(cover.observedAt) < staleBeforeInstant) {
      reasons.staleSecCoverEvidence += 1;
      staleRecords += 1;
      continue;
    }
    if (cover.classification === "unsupported") {
      reasons.unsupportedClassification += 1;
      unsupportedRecords += 1;
      continue;
    }
    const micMatches = micByExchangeName.get(
      identityKey(candidate.exchangeName),
    );
    if (micMatches?.length !== 1) {
      reasons.missingOrAmbiguousIsoMic += 1;
      quarantinedRecords += 1;
      continue;
    }
    const mic = micMatches[0]!;
    if (
      mic.countryCode !== "US" ||
      mic.status !== "active" ||
      mic.type !== "operating" ||
      mic.mic !== mic.operatingMic
    ) {
      reasons.inactiveOrNonUsOperatingMic += 1;
      ineligibleRecords += 1;
      continue;
    }
    const mappingMatches = mappingByTickerMic.get(
      listingKey(candidate.ticker, mic.mic),
    );
    if (mappingMatches?.length !== 1) {
      reasons.missingOrAmbiguousOpenFigiMapping += 1;
      quarantinedRecords += 1;
      continue;
    }
    const mapping = mappingMatches[0]!;
    const assignmentMatches = assignmentByCandidate.get(
      candidateKey(candidate.cik, candidate.ticker),
    );
    if (assignmentMatches?.length !== 1) {
      reasons.missingOrAmbiguousOpaqueIdentityAssignment += 1;
      quarantinedRecords += 1;
      continue;
    }
    const assignment = assignmentMatches[0]!;
    const expectedSecurityType =
      cover.classification === "common_stock"
        ? "Common Stock"
        : "Depositary Receipt";
    if (mapping.securityType2 !== expectedSecurityType) {
      reasons.classificationDisagreement += 1;
      quarantinedRecords += 1;
      continue;
    }
    resolutions.push(
      Object.freeze({ assignment, candidate, cover, mapping, mic }),
    );
  }

  const listingCounts = countBy(resolutions, (resolution) =>
    listingKey(resolution.candidate.ticker, resolution.mic.mic),
  );
  const providerIdentityCounts = countBy(
    resolutions.flatMap((resolution) => [
      resolution.mapping.compositeFigi,
      resolution.mapping.figi,
      resolution.mapping.shareClassFigi,
    ]),
    (identity) => identity,
  );
  const admitted: Resolution[] = [];
  for (const resolution of resolutions) {
    const ambiguous =
      listingCounts.get(
        listingKey(resolution.candidate.ticker, resolution.mic.mic),
      ) !== 1 ||
      [
        resolution.mapping.compositeFigi,
        resolution.mapping.figi,
        resolution.mapping.shareClassFigi,
      ].some((identity) => providerIdentityCounts.get(identity) !== 1);
    if (ambiguous) {
      reasons.missingOrAmbiguousOpenFigiMapping += 1;
      quarantinedRecords += 1;
    } else {
      admitted.push(resolution);
    }
  }
  admitted.sort((left, right) =>
    compareCodePoints(left.assignment.securityId, right.assignment.securityId),
  );
  return Object.freeze({
    admitted: Object.freeze(admitted),
    ineligibleRecords,
    quarantinedRecords,
    reasons: Object.freeze(reasons),
    staleRecords,
    unsupportedRecords,
  });
}

function buildPersonalSecurityMasterSnapshot(
  plan: PreparationPlan,
  reconciliation: Reconciliation,
  expected: SecOpenFigiV1ExpectedSha256,
  sourceBundleSha256: Sha256,
): unknown {
  const issuerById = new Map<string, Readonly<Record<string, unknown>>>();
  const records: Array<Readonly<Record<string, unknown>>> = [];
  const providerMappings: Array<Readonly<Record<string, unknown>>> = [];

  for (const resolution of reconciliation.admitted) {
    const { assignment, candidate, cover, mapping, mic } = resolution;
    const existingIssuer = issuerById.get(assignment.issuerId);
    const issuer = Object.freeze({
      cik: candidate.cik,
      issuerId: assignment.issuerId,
      issuerName: candidate.companyName,
    });
    if (
      existingIssuer !== undefined &&
      canonicalJson(existingIssuer) !== canonicalJson(issuer)
    ) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
    issuerById.set(assignment.issuerId, issuer);
    records.push(
      Object.freeze({
        active: true,
        eligibility: "eligible",
        instrumentType: cover.classification,
        issuerId: assignment.issuerId,
        securityId: assignment.securityId,
        securityName: cover.securityTitle,
        shareClasses: Object.freeze([
          Object.freeze({
            active: true,
            listings: Object.freeze([
              Object.freeze({
                active: true,
                country: "US",
                currentSymbol: candidate.ticker,
                exchangeMic: mic.mic,
                exchangeMicType: "operating",
                listingId: assignment.listingId,
                securityId: assignment.securityId,
                shareClassId: assignment.shareClassId,
                tickerHistory: Object.freeze([
                  Object.freeze({
                    listingId: assignment.listingId,
                    symbol: candidate.ticker,
                    timeBasis: "sec_filing_observed",
                    validFrom: cover.observedAt,
                    validTo: null,
                  }),
                ]),
              }),
            ]),
            securityId: assignment.securityId,
            shareClassId: assignment.shareClassId,
            shareClassName: cover.securityTitle,
          }),
        ]),
      }),
    );
    providerMappings.push(
      Object.freeze({
        mappingId: assignment.mappingIds.compositeFigi,
        mappingKind: "composite",
        providerId: "openfigi_v3",
        providerSecurityId: mapping.compositeFigi,
        targetId: assignment.shareClassId,
      }),
      Object.freeze({
        mappingId: assignment.mappingIds.listingFigi,
        mappingKind: "listing",
        providerId: "openfigi_v3",
        providerSecurityId: mapping.figi,
        targetId: assignment.listingId,
      }),
      Object.freeze({
        mappingId: assignment.mappingIds.shareClassFigi,
        mappingKind: "share_class",
        providerId: "openfigi_v3",
        providerSecurityId: mapping.shareClassFigi,
        targetId: assignment.shareClassId,
      }),
    );
  }
  const issuers = [...issuerById.values()].sort((left, right) =>
    compareCodePoints(left.issuerId as string, right.issuerId as string),
  );
  records.sort((left, right) =>
    compareCodePoints(left.securityId as string, right.securityId as string),
  );
  providerMappings.sort((left, right) =>
    compareCodePoints(left.mappingId as string, right.mappingId as string),
  );
  const provenanceArtifacts = plan.provenance.artifacts
    .map((artifact) =>
      Object.freeze({
        acquiredAt: artifact.acquiredAt,
        artifactId: artifact.artifactId,
        contentSha256: expected[propertyForRole(artifact.artifactRole)],
        mediaType: artifact.mediaType,
        sourceUri: artifact.sourceUri,
        sourceVersion: artifact.sourceVersion,
      }),
    )
    .sort((left, right) =>
      compareCodePoints(left.artifactId, right.artifactId),
    );
  return Object.freeze({
    asOf: plan.asOf,
    catalogId: plan.catalogId,
    catalogVersion: plan.catalogVersion,
    generatedAt: plan.generatedAt,
    issuers: Object.freeze(issuers),
    profile: PERSONAL_SECURITY_MASTER_PROFILE,
    provenance: Object.freeze({
      acquiredAt: plan.provenance.acquiredAt,
      artifacts: Object.freeze(provenanceArtifacts),
      attribution: plan.provenance.attribution,
      contentKind: plan.provenance.contentKind,
      sourceId: plan.provenance.sourceId,
      sourceLocator: `owner-local-composite-manifest:${sourceBundleSha256}`,
      sourceRevision: sourceBundleSha256,
    }),
    providerMappings: Object.freeze(providerMappings),
    records: Object.freeze(records),
    schemaVersion: PERSONAL_SECURITY_MASTER_SCHEMA_VERSION,
    sourceCoverage: Object.freeze({
      admittedRecords: reconciliation.admitted.length,
      ineligibleRecords: reconciliation.ineligibleRecords,
      quarantinedRecords: reconciliation.quarantinedRecords,
      sourceRecords:
        reconciliation.admitted.length +
        reconciliation.ineligibleRecords +
        reconciliation.quarantinedRecords +
        reconciliation.staleRecords +
        reconciliation.unsupportedRecords,
      staleRecords: reconciliation.staleRecords,
      unsupportedRecords: reconciliation.unsupportedRecords,
    }),
    sourcePolicyCompatibility: plan.sourcePolicyCompatibility,
  });
}

function makeReceipt(
  candidateRecords: number,
  reconciliation: Reconciliation,
  sourceBundleSha256: Sha256,
  snapshotSha256: Sha256 | null,
): SecOpenFigiV1SourcePreparationReceipt {
  const status =
    snapshotSha256 === null
      ? "quarantined"
      : reconciliation.quarantinedRecords === 0 &&
          reconciliation.ineligibleRecords === 0 &&
          reconciliation.staleRecords === 0 &&
          reconciliation.unsupportedRecords === 0
        ? "prepared"
        : "prepared_with_exclusions";
  return Object.freeze({
    admittedRecords: reconciliation.admitted.length,
    artifactCount: 6 as const,
    candidateRecords,
    ineligibleRecords: reconciliation.ineligibleRecords,
    quarantinedRecords: reconciliation.quarantinedRecords,
    exclusionReasonCounts: reconciliation.reasons,
    schemaVersion: SEC_OPENFIGI_V1_SOURCE_PREPARATION_SCHEMA_VERSION,
    snapshotSha256,
    sourceBundleSha256,
    sourceProfile: SEC_OPENFIGI_V1_SOURCE_PROFILE,
    staleRecords: reconciliation.staleRecords,
    status,
    unsupportedRecords: reconciliation.unsupportedRecords,
  });
}

function artifactRoot(
  value: unknown,
  role: ArtifactRole,
  keys: readonly string[],
): Record<string, unknown> {
  const root = exactRecord(value, keys);
  if (
    root.artifactRole !== role ||
    root.profile !== SEC_OPENFIGI_V1_SOURCE_PROFILE ||
    root.schemaVersion !== SEC_OPENFIGI_V1_SOURCE_PREPARATION_SCHEMA_VERSION
  ) {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  return root;
}

function recordsArtifact(
  value: unknown,
  role: Exclude<
    ArtifactRole,
    "preparation_plan" | "opaque_identity_assignments"
  >,
): readonly unknown[] {
  const root = artifactRoot(value, role, [
    "artifactRole",
    "profile",
    "records",
    "schemaVersion",
  ]);
  if (
    !Array.isArray(root.records) ||
    root.records.length < 1 ||
    root.records.length > SEC_OPENFIGI_V1_SOURCE_PREPARATION_LIMITS.records
  ) {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  return root.records;
}

function parseCanonicalArtifact(bytes: Uint8Array): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  try {
    assertJsonBudget(value);
    if (`${canonicalJson(value)}\n` !== text) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
  } catch (error) {
    if (error instanceof InternalFailure) throw error;
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  return value;
}

function byteSnapshot(value: unknown): Uint8Array {
  try {
    if (typeof value !== "object" || value === null) {
      fail("SEC_OPENFIGI_V1_INVALID_INPUT");
    }
    const bytes = value as Uint8Array;
    const tag = TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR?.get?.call(bytes) as unknown;
    const byteLength = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const byteOffset = TYPED_ARRAY_BYTE_OFFSET_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const backingByteLength = ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      buffer,
    ) as unknown;
    if (
      tag !== "Uint8Array" ||
      typeof byteLength !== "number" ||
      typeof byteOffset !== "number" ||
      typeof backingByteLength !== "number" ||
      Object.getPrototypeOf(bytes) !== Uint8Array.prototype ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype ||
      byteOffset !== 0 ||
      backingByteLength !== byteLength ||
      byteLength < 3 ||
      byteLength > SEC_OPENFIGI_V1_SOURCE_PREPARATION_LIMITS.artifactBytes
    ) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
    const snapshot = new Uint8Array(byteLength);
    Reflect.apply(UINT8_ARRAY_SET, snapshot, [bytes]);
    return snapshot;
  } catch (error) {
    if (error instanceof InternalFailure) throw error;
    fail("SEC_OPENFIGI_V1_INVALID_INPUT");
  }
}

function exactDataObject(
  value: unknown,
  keys: readonly string[],
  code: SecOpenFigiV1SourcePreparationFailureCode,
): Record<string, unknown> {
  if (!isPlainRecord(value)) fail(code);
  let descriptors: PropertyDescriptorMap;
  let ownKeys: readonly PropertyKey[];
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
    ownKeys = Reflect.ownKeys(value);
  } catch {
    fail(code);
  }
  if (
    ownKeys.some((key) => typeof key !== "string") ||
    !exactKeys(ownKeys as readonly string[], keys) ||
    !exactKeys(Object.keys(descriptors), keys)
  ) {
    fail(code);
  }
  const captured: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      fail(code);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  return exactDataObject(value, keys, "SEC_OPENFIGI_V1_ARTIFACT_INVALID");
}

function exactDenseDataArray(
  value: unknown,
  expectedLength: number,
): readonly unknown[] {
  if (!Array.isArray(value)) fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  let descriptors: PropertyDescriptorMap;
  let prototype: object | null;
  try {
    descriptors = Object.getOwnPropertyDescriptors(
      value,
    ) as unknown as PropertyDescriptorMap;
    prototype = Reflect.getPrototypeOf(value);
  } catch {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  if (
    prototype !== Array.prototype ||
    Reflect.ownKeys(descriptors).length !== expectedLength + 1 ||
    descriptors.length?.value !== expectedLength
  ) {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  const result: unknown[] = [];
  for (let index = 0; index < expectedLength; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
    result.push(descriptor.value);
  }
  return Object.freeze(result);
}

function assertJsonBudget(root: unknown): void {
  const stack: Array<Readonly<{ depth: number; value: unknown }>> = [
    { depth: 0, value: root },
  ];
  let aggregateArrayEntries = 0;
  let aggregateStringCodePoints = 0;
  let nodes = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    nodes += 1;
    if (
      nodes > SEC_OPENFIGI_V1_SOURCE_PREPARATION_LIMITS.documentNodes ||
      current.depth > SEC_OPENFIGI_V1_SOURCE_PREPARATION_LIMITS.documentDepth
    ) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
    if (typeof current.value === "string") {
      const length = codePointLength(current.value);
      if (
        length >
          SEC_OPENFIGI_V1_SOURCE_PREPARATION_LIMITS.maximumStringCodePoints ||
        DISALLOWED_CHARACTER.test(current.value)
      ) {
        fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
      }
      aggregateStringCodePoints += length;
    } else if (
      current.value === null ||
      typeof current.value === "boolean" ||
      (typeof current.value === "number" && Number.isSafeInteger(current.value))
    ) {
      continue;
    } else if (Array.isArray(current.value)) {
      aggregateArrayEntries += current.value.length;
      for (const entry of current.value) {
        stack.push({ depth: current.depth + 1, value: entry });
      }
    } else if (isPlainRecord(current.value)) {
      for (const [key, entry] of Object.entries(current.value)) {
        const length = codePointLength(key);
        if (
          length >
            SEC_OPENFIGI_V1_SOURCE_PREPARATION_LIMITS.maximumStringCodePoints ||
          DISALLOWED_CHARACTER.test(key)
        ) {
          fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
        }
        aggregateStringCodePoints += length;
        stack.push({ depth: current.depth + 1, value: entry });
      }
    } else {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
    if (
      aggregateArrayEntries >
        SEC_OPENFIGI_V1_SOURCE_PREPARATION_LIMITS.aggregateArrayEntries ||
      aggregateStringCodePoints >
        SEC_OPENFIGI_V1_SOURCE_PREPARATION_LIMITS.aggregateStringCodePoints
    ) {
      fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
    }
  }
}

function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new TypeError();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (!isPlainRecord(value)) throw new TypeError();
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function bundleDigest(expected: SecOpenFigiV1ExpectedSha256): Sha256 {
  return sha256(
    canonicalBytes(
      ARTIFACT_PROPERTIES.map((property) =>
        Object.freeze({
          artifactRole: SEC_OPENFIGI_V1_ARTIFACT_ROLES[property],
          sha256: expected[property],
        }),
      ),
    ),
  );
}

function propertyForRole(role: SourceArtifactRole): ArtifactProperty {
  for (const property of ARTIFACT_PROPERTIES) {
    if (SEC_OPENFIGI_V1_ARTIFACT_ROLES[property] === role) return property;
  }
  fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
}

function mutableReasonCounts(): {
  -readonly [Key in keyof SecOpenFigiV1ExclusionReasonCounts]: number;
} {
  return {
    classificationDisagreement: 0,
    inactiveOrNonUsOperatingMic: 0,
    missingOrAmbiguousIsoMic: 0,
    missingOrAmbiguousNormalizedSecCoverEvidence: 0,
    missingOrAmbiguousOpaqueIdentityAssignment: 0,
    missingOrAmbiguousOpenFigiMapping: 0,
    staleSecCoverEvidence: 0,
    unsupportedClassification: 0,
  };
}

function groupBy<T>(
  values: readonly T[],
  selectKey: (value: T) => string,
): ReadonlyMap<string, readonly T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) {
    const key = selectKey(value);
    const group = result.get(key);
    if (group === undefined) result.set(key, [value]);
    else group.push(value);
  }
  return result;
}

function countBy<T>(
  values: readonly T[],
  selectKey: (value: T) => string,
): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  for (const value of values) {
    const key = selectKey(value);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

function candidateKey(cik: string, ticker: string): string {
  return `${cik}\u0000${ticker}`;
}

function listingKey(ticker: string, mic: string): string {
  return `${mic}\u0000${ticker}`;
}

function isSourceArtifactRole(value: unknown): value is SourceArtifactRole {
  return SOURCE_ARTIFACT_ROLES.some((role) => role === value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  if (actual.length !== expected.length) return false;
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedExpected.every((key, index) => sortedActual[index] === key);
}

function isCik(value: unknown): value is string {
  return typeof value === "string" && CIK.test(value);
}

function isMic(value: unknown): value is string {
  return typeof value === "string" && MIC.test(value);
}

function isSymbol(value: unknown): value is string {
  return typeof value === "string" && SYMBOL.test(value);
}

function isFigi(value: unknown): value is string {
  return typeof value === "string" && FIGI.test(value);
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID.test(value);
}

function isOpaqueId(
  value: unknown,
  role: "issuer" | "listing" | "mapping" | "security" | "share-class",
): value is string {
  return (
    typeof value === "string" &&
    OPAQUE_ID.test(value) &&
    value.startsWith(`oid-${role}-`)
  );
}

function isName(value: unknown): value is string {
  return (
    isBoundedTrimmedText(value, 1, 128) && !DISALLOWED_CHARACTER.test(value)
  );
}

function isBoundedText(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  if (typeof value !== "string") return false;
  const length = codePointLength(value);
  return (
    length >= minimum && length <= maximum && !DISALLOWED_CHARACTER.test(value)
  );
}

function isBoundedTrimmedText(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return isBoundedText(value, minimum, maximum) && value === value.trim();
}

function isCanonicalHttpsUrl(value: unknown): value is string {
  if (!isBoundedText(value, 1, 2_048)) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.search === "" &&
      parsed.hash === "" &&
      parsed.href === value
    );
  } catch {
    return false;
  }
}

function parseInstant(value: string): number {
  if (!ISO_UTC.test(value)) fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  const instant = Date.parse(value);
  if (!Number.isFinite(instant) || new Date(instant).toISOString() !== value) {
    fail("SEC_OPENFIGI_V1_ARTIFACT_INVALID");
  }
  return instant;
}

function codePointLength(value: string): number {
  return [...value].length;
}

function identityKey(value: string): string {
  return value.normalize("NFKC").toUpperCase();
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = [...left].map((value) => value.codePointAt(0) as number);
  const rightPoints = [...right].map((value) => value.codePointAt(0) as number);
  const sharedLength = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  const copy = new Uint8Array(bytes.byteLength);
  Reflect.apply(UINT8_ARRAY_SET, copy, [bytes]);
  return copy;
}

function wipeArtifacts(artifacts: CapturedArtifacts | undefined): void {
  if (artifacts === undefined) return;
  for (const property of ARTIFACT_PROPERTIES) wipeBytes(artifacts[property]);
}

function wipeBytes(bytes: Uint8Array | undefined): void {
  if (bytes === undefined) return;
  try {
    Reflect.apply(UINT8_ARRAY_FILL, bytes, [0]);
  } catch {
    // A best-effort wipe must not replace the closed public result.
  }
}

function sha256(bytes: Uint8Array): Sha256 {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function publicError(
  error: unknown,
  fallback: SecOpenFigiV1SourcePreparationFailureCode,
): SecOpenFigiV1SourcePreparationError {
  return new SecOpenFigiV1SourcePreparationError(
    error instanceof InternalFailure ? error.code : fallback,
  );
}

function fail(code: SecOpenFigiV1SourcePreparationFailureCode): never {
  throw new InternalFailure(code);
}
