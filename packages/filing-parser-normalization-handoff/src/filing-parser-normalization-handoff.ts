import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  FILING_FACT_NORMALIZATION_LIMITS,
  normalizeSyntheticFilingFactPair,
  type FilingFactNormalizationRecord,
} from "@research-cockpit/filing-fact-normalization";

export const FILING_PARSER_NORMALIZATION_HANDOFF_SCHEMA_VERSION =
  "1.0.0" as const;
export const FILING_PARSER_NORMALIZATION_HANDOFF_CLAIM =
  "bounded_synthetic_authenticated_ten_fact_parser_result_to_normalization_handoff" as const;

export const FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS = Object.freeze({
  aggregateStringCodePoints: 131_072,
  archiveBytes: 1_048_576,
  archives: 2,
  documentBytes: FILING_FACT_NORMALIZATION_LIMITS.documentBytes,
  envelopeBytes: 262_144,
  envelopeDepth: 12,
  envelopeNodes: 1_024,
  envelopes: 2,
  publicKeySpkiBytes: 512,
  signatureBytes: 64,
});

export const FILING_PARSER_NORMALIZATION_HANDOFF_CHECKS = Object.freeze([
  "exact_two_raw_archives_two_signed_parser_envelopes_and_strict_options",
  "intrinsic_uint8array_arraybuffer_brand_prototype_and_preallocation_bounds",
  "fresh_owned_snapshot_before_hash_parse_signature_or_normalization_use",
  "bounded_canonical_utf8_json_envelope_and_duplicate_key_rejection",
  "closed_envelope_payload_document_signature_and_identity_schema",
  "exact_ed25519_spki_key_id_and_expected_image_digest_binding",
  "domain_separated_signature_verification_over_exact_canonical_payload",
  "raw_archive_sha256_recomputation_and_source_content_digest_binding",
  "complete_embedded_original_and_amendment_document_without_fact_synthesis",
  "exact_original_then_amendment_role_and_cross_document_identity_binding",
  "canonical_embedded_document_bytes_delegated_to_cycle2d_normalization",
  "whole_pair_atomic_success_or_single_empty_value_free_quarantine",
  "deeply_frozen_cycle2d_record_and_aggregate_provenance_success",
  "exact_replay_determinism_owned_input_mutation_safety_and_no_partial_result",
  "signature_source_key_image_role_schema_and_downstream_failure_quarantine",
  "no_io_network_parser_execution_custody_corpus_database_api_web_or_queue",
] as const);

export const FILING_PARSER_NORMALIZATION_HANDOFF_NOT_PROVEN = Object.freeze([
  "cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission",
  "real_public_filing_payload_presence_sec_source_authenticity_or_attestation",
  "counsel_identity_legal_validity_revocation_freshness_or_data_rights",
  "edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety",
  "xml_xbrl_ixbrl_parser_worker_execution_or_general_taxonomy_correctness",
  "signing_key_identity_production_kms_hsm_custody_rotation_or_nonrepudiation",
  "raw_payload_custody_retention_backup_deletion_or_cryptographic_erasure",
  "independent_dual_parser_validator_or_cross_engine_conflict_quarantine",
  "independently_adjudicated_ground_truth_or_two_thousand_assertions",
  "precision_recall_document_success_quality_thresholds_or_zero_silent_failures",
  "general_concept_alias_unit_conversion_dimensions_or_fiscal_calendar_coverage",
  "real_amendment_completeness_correction_discovery_or_accounting_truth",
  "multi_issuer_batch_streaming_concurrency_retry_crash_recovery_or_slo",
  "database_api_web_queue_persistence_evidence_passport_or_b15_v15_composition",
  "production_identity_secrets_network_operations_or_incident_recovery",
  "real_data_admission_full_cycle2_exit_or_production_use",
] as const);

export interface FilingParserNormalizationHandoffOptions {
  readonly expectedImageSha256: `sha256:${string}`;
  readonly expectedKeyId: string;
  readonly publicKeySpki: Uint8Array;
}

export interface FilingParserNormalizationHandoffProvenance {
  readonly archiveCount: 2;
  readonly documentCount: 2;
  readonly imageSha256: `sha256:${string}`;
  readonly keyId: string;
  readonly pairBindingSha256: `sha256:${string}`;
  readonly publicKeySpkiSha256: `sha256:${string}`;
  readonly signatureCount: 2;
}

export interface FilingParserNormalizationHandoffSuccess {
  readonly claim: typeof FILING_PARSER_NORMALIZATION_HANDOFF_CLAIM;
  readonly normalization: FilingFactNormalizationRecord;
  readonly provenance: FilingParserNormalizationHandoffProvenance;
  readonly schemaVersion: typeof FILING_PARSER_NORMALIZATION_HANDOFF_SCHEMA_VERSION;
  readonly status: "normalized";
  readonly synthetic: true;
}

export interface FilingParserNormalizationHandoffQuarantinedResult {
  readonly claim: typeof FILING_PARSER_NORMALIZATION_HANDOFF_CLAIM;
  readonly code: "handoff_quarantined";
  readonly normalization: null;
  readonly provenance: null;
  readonly schemaVersion: typeof FILING_PARSER_NORMALIZATION_HANDOFF_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: true;
}

export type FilingParserNormalizationHandoffResult =
  | FilingParserNormalizationHandoffQuarantinedResult
  | FilingParserNormalizationHandoffSuccess;

interface NormalizedOptions {
  readonly expectedImageSha256: `sha256:${string}`;
  readonly expectedKeyId: string;
  readonly publicKeySpki: Uint8Array;
}

interface ParsedEnvelope {
  readonly documentBytes: Uint8Array;
  readonly payloadBytes: Uint8Array;
  readonly signature: Uint8Array;
  readonly sourceSha256: `sha256:${string}`;
}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const KEY_ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const ENVELOPE_KEYS = [
  "payload",
  "schemaVersion",
  "signature",
  "synthetic",
] as const;
const PAYLOAD_KEYS = [
  "algorithm",
  "document",
  "imageSha256",
  "keyId",
  "sourceSha256",
] as const;
const OPTION_KEYS = [
  "expectedImageSha256",
  "expectedKeyId",
  "publicKeySpki",
] as const;
const SIGNATURE_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-parser-normalization-handoff-signature:v1\u0000",
);
const PAIR_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-parser-normalization-handoff-pair:v1\u0000",
);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
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
const TYPED_ARRAY_TAG_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
);
const ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
);
const intrinsicSet = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "set",
)?.value as unknown;
const isProxy = utilTypes.isProxy;

export function handoffAuthenticatedSyntheticFilingParserResults(
  originalArchive: unknown,
  amendmentArchive: unknown,
  originalEnvelope: unknown,
  amendmentEnvelope: unknown,
  options: unknown,
): FilingParserNormalizationHandoffResult {
  try {
    if (arguments.length !== 5) return quarantined();
    const normalizedOptions = normalizeOptions(options);
    const ownedOriginalArchive = snapshotBytes(
      originalArchive,
      FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS.archiveBytes,
    );
    const ownedAmendmentArchive = snapshotBytes(
      amendmentArchive,
      FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS.archiveBytes,
    );
    const ownedOriginalEnvelope = snapshotBytes(
      originalEnvelope,
      FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS.envelopeBytes,
    );
    const ownedAmendmentEnvelope = snapshotBytes(
      amendmentEnvelope,
      FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS.envelopeBytes,
    );
    const originalSourceSha256 = sha256(ownedOriginalArchive);
    const amendmentSourceSha256 = sha256(ownedAmendmentArchive);
    const original = parseEnvelope(
      ownedOriginalEnvelope,
      originalSourceSha256,
      normalizedOptions,
    );
    const amendment = parseEnvelope(
      ownedAmendmentEnvelope,
      amendmentSourceSha256,
      normalizedOptions,
    );
    const publicKey = createPublicKey({
      format: "der",
      key: Buffer.from(normalizedOptions.publicKeySpki),
      type: "spki",
    });
    const canonicalPublicKeySpki = publicKey.export({
      format: "der",
      type: "spki",
    });
    if (
      publicKey.asymmetricKeyType !== "ed25519" ||
      !Buffer.from(canonicalPublicKeySpki).equals(
        Buffer.from(normalizedOptions.publicKeySpki),
      ) ||
      !verifySignature(
        null,
        signingBytes(original.payloadBytes),
        publicKey,
        original.signature,
      ) ||
      !verifySignature(
        null,
        signingBytes(amendment.payloadBytes),
        publicKey,
        amendment.signature,
      )
    )
      return quarantined();
    const normalization = normalizeSyntheticFilingFactPair(
      original.documentBytes,
      amendment.documentBytes,
    );
    if (normalization.status !== "normalized") return quarantined();
    const provenance = Object.freeze({
      archiveCount: 2 as const,
      documentCount: 2 as const,
      imageSha256: normalizedOptions.expectedImageSha256,
      keyId: normalizedOptions.expectedKeyId,
      pairBindingSha256: sha256(
        concatBytes(
          PAIR_DOMAIN,
          textEncoder.encode(
            canonicalJson({
              amendmentDocumentSha256: normalization.amendmentDocumentSha256,
              amendmentSourceSha256: amendment.sourceSha256,
              imageSha256: normalizedOptions.expectedImageSha256,
              keyId: normalizedOptions.expectedKeyId,
              originalDocumentSha256: normalization.originalDocumentSha256,
              originalSourceSha256: original.sourceSha256,
              publicKeySpkiSha256: sha256(normalizedOptions.publicKeySpki),
            }),
          ),
        ),
      ),
      publicKeySpkiSha256: sha256(normalizedOptions.publicKeySpki),
      signatureCount: 2 as const,
    });
    return Object.freeze({
      claim: FILING_PARSER_NORMALIZATION_HANDOFF_CLAIM,
      normalization,
      provenance,
      schemaVersion: FILING_PARSER_NORMALIZATION_HANDOFF_SCHEMA_VERSION,
      status: "normalized" as const,
      synthetic: true as const,
    });
  } catch {
    return quarantined();
  }
}

function normalizeOptions(value: unknown): NormalizedOptions {
  if (typeof value !== "object" || value === null || isProxy(value))
    throw new TypeError();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Object.getPrototypeOf(value) !== Object.prototype ||
    !exactKeys(Reflect.ownKeys(value), OPTION_KEYS)
  )
    throw new TypeError();
  const image = dataDescriptorValue(descriptors.expectedImageSha256);
  const keyId = dataDescriptorValue(descriptors.expectedKeyId);
  const spki = dataDescriptorValue(descriptors.publicKeySpki);
  if (
    typeof image !== "string" ||
    !HASH.test(image) ||
    typeof keyId !== "string" ||
    !KEY_ID.test(keyId)
  )
    throw new TypeError();
  return Object.freeze({
    expectedImageSha256: image as `sha256:${string}`,
    expectedKeyId: keyId,
    publicKeySpki: snapshotBytes(
      spki,
      FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS.publicKeySpkiBytes,
    ),
  });
}

function parseEnvelope(
  bytes: Uint8Array,
  expectedSourceSha256: `sha256:${string}`,
  options: NormalizedOptions,
): ParsedEnvelope {
  const text = textDecoder.decode(bytes);
  if (!text.endsWith("\n") || text.startsWith("\ufeff")) throw new TypeError();
  const value = JSON.parse(text) as unknown;
  if (`${canonicalJson(value)}\n` !== text) throw new TypeError();
  const envelope = record(value);
  if (!exactKeys(Object.keys(envelope), ENVELOPE_KEYS)) throw new TypeError();
  if (
    envelope.schemaVersion !==
      FILING_PARSER_NORMALIZATION_HANDOFF_SCHEMA_VERSION ||
    envelope.synthetic !== true ||
    typeof envelope.signature !== "string"
  )
    throw new TypeError();
  const payload = record(envelope.payload);
  if (!exactKeys(Object.keys(payload), PAYLOAD_KEYS)) throw new TypeError();
  if (
    payload.algorithm !== "ed25519" ||
    payload.imageSha256 !== options.expectedImageSha256 ||
    payload.keyId !== options.expectedKeyId ||
    payload.sourceSha256 !== expectedSourceSha256
  )
    throw new TypeError();
  const document = record(payload.document);
  if (document.contentSha256 !== expectedSourceSha256) throw new TypeError();
  const documentBytes = canonicalBytes(document);
  if (
    documentBytes.byteLength >
    FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS.documentBytes
  )
    throw new TypeError();
  const signature = decodeBase64url(
    envelope.signature,
    FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS.signatureBytes,
  );
  return Object.freeze({
    documentBytes,
    payloadBytes: canonicalBytes(payload),
    signature,
    sourceSha256: expectedSourceSha256,
  });
}

function snapshotBytes(value: unknown, maximumBytes: number): Uint8Array {
  if (typeof value !== "object" || value === null) throw new TypeError();
  const tag = TYPED_ARRAY_TAG_DESCRIPTOR?.get?.call(value) as unknown;
  const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR?.get?.call(value) as unknown;
  const byteLength = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get?.call(
    value,
  ) as unknown;
  const backingLength = ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR?.get?.call(
    buffer,
  ) as unknown;
  if (
    tag !== "Uint8Array" ||
    typeof byteLength !== "number" ||
    typeof backingLength !== "number" ||
    Object.getPrototypeOf(value) !== Uint8Array.prototype ||
    Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype ||
    byteLength <= 0 ||
    byteLength > maximumBytes
  )
    throw new TypeError();
  const owned = new Uint8Array(byteLength);
  copyBytes(owned, value as Uint8Array);
  return owned;
}

function canonicalBytes(value: unknown): Uint8Array {
  return textEncoder.encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  const budget = {
    nodes: 0,
    stringCodePoints: 0,
  };
  return canonicalJsonValue(value, 0, budget);
}

function canonicalJsonValue(
  value: unknown,
  depth: number,
  budget: { nodes: number; stringCodePoints: number },
): string {
  budget.nodes += 1;
  if (
    budget.nodes > FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS.envelopeNodes ||
    depth > FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS.envelopeDepth
  )
    throw new TypeError();
  if (typeof value === "string") {
    budget.stringCodePoints += [...value].length;
    if (
      budget.stringCodePoints >
      FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS.aggregateStringCodePoints
    )
      throw new TypeError();
    return JSON.stringify(value);
  }
  if (value === null || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value))
    return `[${value
      .map((entry) => canonicalJsonValue(entry, depth + 1, budget))
      .join(",")}]`;
  if (
    typeof value !== "object" ||
    value === null ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new TypeError();
  const item = value as Record<string, unknown>;
  return `{${Object.keys(item)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJsonValue(item[key], depth + 1, budget)}`,
    )
    .join(",")}}`;
}

function signingBytes(payloadBytes: Uint8Array): Uint8Array {
  return concatBytes(SIGNATURE_DOMAIN, payloadBytes);
}

function decodeBase64url(value: string, exactBytes: number): Uint8Array {
  if (!BASE64URL.test(value)) throw new TypeError();
  const decoded = Buffer.from(value, "base64url");
  if (
    decoded.byteLength !== exactBytes ||
    decoded.toString("base64url") !== value
  )
    throw new TypeError();
  return Uint8Array.from(decoded);
}

function concatBytes(...values: readonly Uint8Array[]): Uint8Array {
  const byteLength = values.reduce(
    (total, value) => total + value.byteLength,
    0,
  );
  const result = new Uint8Array(byteLength);
  let offset = 0;
  for (const value of values) {
    copyBytes(result, value, offset);
    offset += value.byteLength;
  }
  return result;
}

function copyBytes(target: Uint8Array, source: Uint8Array, offset = 0): void {
  if (typeof intrinsicSet !== "function") throw new TypeError();
  Reflect.apply(intrinsicSet, target, [source, offset]);
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function record(value: unknown): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new TypeError();
  return value as Record<string, unknown>;
}

function exactKeys(
  actual: readonly PropertyKey[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    [...actual].map(String).sort().join("\u0000") ===
      [...expected].sort().join("\u0000")
  );
}

function dataDescriptorValue(
  descriptor: PropertyDescriptor | undefined,
): unknown {
  if (descriptor === undefined || !("value" in descriptor))
    throw new TypeError();
  return descriptor.value as unknown;
}

function quarantined(): FilingParserNormalizationHandoffQuarantinedResult {
  return Object.freeze({
    claim: FILING_PARSER_NORMALIZATION_HANDOFF_CLAIM,
    code: "handoff_quarantined" as const,
    normalization: null,
    provenance: null,
    schemaVersion: FILING_PARSER_NORMALIZATION_HANDOFF_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: true as const,
  });
}
