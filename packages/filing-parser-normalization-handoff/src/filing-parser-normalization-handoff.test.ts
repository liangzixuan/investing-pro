import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  FILING_PARSER_NORMALIZATION_HANDOFF_CHECKS,
  FILING_PARSER_NORMALIZATION_HANDOFF_CLAIM,
  FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS,
  FILING_PARSER_NORMALIZATION_HANDOFF_NOT_PROVEN,
  FILING_PARSER_NORMALIZATION_HANDOFF_SCHEMA_VERSION,
  handoffAuthenticatedSyntheticFilingParserResults,
} from "./filing-parser-normalization-handoff";
import { buildSyntheticFilingParserNormalizationHandoffFixture } from "./test-filing-parser-normalization-handoff-builder";

describe("synthetic authenticated parser-normalization handoff", () => {
  it("freezes the exact claim, checks, nonclaims, and limits", () => {
    expect(FILING_PARSER_NORMALIZATION_HANDOFF_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_PARSER_NORMALIZATION_HANDOFF_CLAIM).toBe(
      "bounded_synthetic_authenticated_ten_fact_parser_result_to_normalization_handoff",
    );
    expect(FILING_PARSER_NORMALIZATION_HANDOFF_CHECKS).toEqual([
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
    ]);
    expect(FILING_PARSER_NORMALIZATION_HANDOFF_NOT_PROVEN).toEqual([
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
    ]);
    expect(FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS).toEqual({
      aggregateStringCodePoints: 131_072,
      archiveBytes: 1_048_576,
      archives: 2,
      documentBytes: 131_072,
      envelopeBytes: 262_144,
      envelopeDepth: 12,
      envelopeNodes: 1_024,
      envelopes: 2,
      publicKeySpkiBytes: 512,
      signatureBytes: 64,
    });
    for (const value of [
      FILING_PARSER_NORMALIZATION_HANDOFF_CHECKS,
      FILING_PARSER_NORMALIZATION_HANDOFF_NOT_PROVEN,
      FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it("authenticates and normalizes the exact ten-fact original/amendment pair", () => {
    const fixture = buildSyntheticFilingParserNormalizationHandoffFixture();
    const result = handoff(fixture);
    expect(result.status).toBe("normalized");
    if (result.status !== "normalized") throw new Error("expected normalized");
    expect(result.normalization.factVersions).toHaveLength(20);
    expect(result.normalization.lineage).toHaveLength(10);
    expect(result.normalization.audit).toEqual({
      factVersionCount: 20,
      lineageCount: 10,
      outcome: "normalized",
    });
    expect(result.provenance).toMatchObject({
      archiveCount: 2,
      documentCount: 2,
      imageSha256: fixture.options.expectedImageSha256,
      keyId: fixture.options.expectedKeyId,
      signatureCount: 2,
    });
    expect(result.provenance.pairBindingSha256).toMatch(
      /^sha256:[0-9a-f]{64}$/u,
    );
    expect(result.provenance.publicKeySpkiSha256).toBe(
      sha256(fixture.options.publicKeySpki),
    );
    expect(
      result.normalization.factVersions
        .slice(0, 10)
        .every(
          (fact) =>
            fact.sourceContentSha256 === sha256(fixture.originalArchive),
        ),
    ).toBe(true);
    expect(
      result.normalization.factVersions
        .slice(10)
        .every(
          (fact) =>
            fact.sourceContentSha256 === sha256(fixture.amendmentArchive),
        ),
    ).toBe(true);
  });

  it("replays deterministically while returning fresh deeply frozen records", () => {
    const fixture = buildSyntheticFilingParserNormalizationHandoffFixture();
    const first = handoff(fixture);
    const second = handoff(fixture);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    if (first.status !== "normalized" || second.status !== "normalized")
      throw new Error("expected normalized");
    expect(first.normalization).not.toBe(second.normalization);
    for (const value of [
      first,
      first.provenance,
      first.normalization,
      first.normalization.audit,
      first.normalization.factVersions,
      first.normalization.lineage,
      ...first.normalization.factVersions,
      ...first.normalization.factVersions.map((fact) => fact.dimensions),
      ...first.normalization.lineage,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it("owns all accepted bytes before returning the normalized result", () => {
    const fixture = buildSyntheticFilingParserNormalizationHandoffFixture();
    const result = handoff(fixture);
    if (result.status !== "normalized") throw new Error("expected normalized");
    const snapshot = JSON.stringify(result);
    fixture.originalArchive.fill(0xff);
    fixture.amendmentArchive.fill(0xff);
    fixture.originalEnvelope.fill(0xff);
    fixture.amendmentEnvelope.fill(0xff);
    fixture.options.publicKeySpki.fill(0xff);
    expect(JSON.stringify(result)).toBe(snapshot);
  });
});

function handoff(
  fixture: ReturnType<
    typeof buildSyntheticFilingParserNormalizationHandoffFixture
  >,
) {
  return handoffAuthenticatedSyntheticFilingParserResults(
    fixture.originalArchive,
    fixture.amendmentArchive,
    fixture.originalEnvelope,
    fixture.amendmentEnvelope,
    fixture.options,
  );
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
