import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  PERSONAL_FILING_CORPUS_CHECKS,
  PERSONAL_FILING_CORPUS_CLAIM,
  PERSONAL_FILING_CORPUS_FAILURE_CODES,
  PERSONAL_FILING_CORPUS_LIMITS,
  PERSONAL_FILING_CORPUS_NOT_PROVEN,
  PERSONAL_FILING_CORPUS_PROFILE,
  PERSONAL_FILING_CORPUS_SCHEMA_VERSION,
  PersonalFilingCorpusError,
  verifyPersonalFilingCorpusManifest,
} from "./personal-filing-corpus";

type JsonRecord = Record<string, unknown>;

const EXPECTED_CHECKS = [
  "owned_bounded_canonical_json_declaration_and_manifest_snapshots",
  "duplicate_json_property_and_noncanonical_byte_rejection",
  "closed_personal_single_user_local_no_redistribution_declaration",
  "declaration_to_exact_manifest_sha256_binding",
  "one_to_100_sorted_unique_filing_metadata_entries",
  "unique_accession_and_declared_content_sha256_identity",
  "closed_cik_form_time_media_taxonomy_source_and_amendment_metadata",
  "bounded_per_entry_and_aggregate_declared_content_bytes",
  "explicit_bounded_retention_and_user_managed_local_deletion",
  "whole_input_atomic_verification_or_value_free_rejection",
  "aggregate_only_immutable_verified_record",
  "deterministic_exact_byte_replay_and_mutation_rejection",
] as const;

const EXPECTED_NONCLAIMS = [
  "raw_payload_presence_or_declared_content_sha256_byte_equality",
  "sec_source_authenticity_sec_attestation_or_complete_filing_provenance",
  "legal_opinion_rights_authority_data_steward_or_external_approval",
  "network_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety",
  "parser_correctness_fact_normalization_adjudication_or_quality_thresholds",
  "retention_enforcement_backup_deletion_or_cryptographic_erasure",
  "multi_user_identity_tenancy_authorization_or_shared_service_safety",
  "commercial_redistribution_production_kms_queue_load_slo_or_incident_readiness",
  "database_api_web_composition_or_b15_v15",
  "fitness_for_any_profile_other_than_declared_personal_single_user_local_use",
] as const;

describe("personal filing corpus manifest verifier", () => {
  it("freezes the exact bounded personal-use claim, checks, nonclaims, and limits", () => {
    expect(PERSONAL_FILING_CORPUS_SCHEMA_VERSION).toBe("1.0.0");
    expect(PERSONAL_FILING_CORPUS_PROFILE).toBe("personal_single_user_local");
    expect(PERSONAL_FILING_CORPUS_CLAIM).toBe(
      "bounded_content_addressed_manifest_verified_for_personal_single_user_local_use",
    );
    expect(PERSONAL_FILING_CORPUS_CHECKS).toEqual(EXPECTED_CHECKS);
    expect(PERSONAL_FILING_CORPUS_NOT_PROVEN).toEqual(EXPECTED_NONCLAIMS);
    expect(PERSONAL_FILING_CORPUS_FAILURE_CODES).toEqual([
      "PERSONAL_FILING_CORPUS_INVALID_INPUT",
      "PERSONAL_FILING_CORPUS_DECLARATION_INVALID",
      "PERSONAL_FILING_CORPUS_MANIFEST_INVALID",
      "PERSONAL_FILING_CORPUS_SCOPE_MISMATCH",
    ]);
    expect(PERSONAL_FILING_CORPUS_LIMITS).toEqual({
      aggregateStringCodePoints: 262_144,
      declarationBytes: 8_192,
      documentDepth: 8,
      documentNodes: 4_096,
      entries: 100,
      entryContentBytes: 67_108_864,
      manifestBytes: 524_288,
      retentionDays: 3_650,
      totalDeclaredContentBytes: 1_073_741_824,
    });
    for (const value of [
      PERSONAL_FILING_CORPUS_CHECKS,
      PERSONAL_FILING_CORPUS_NOT_PROVEN,
      PERSONAL_FILING_CORPUS_FAILURE_CODES,
      PERSONAL_FILING_CORPUS_LIMITS,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it("verifies a declaration bound to one canonical personal-use manifest", () => {
    const documents = buildDocuments();
    const result = verifyPersonalFilingCorpusManifest(documents);

    expect(result).toEqual({
      claim: PERSONAL_FILING_CORPUS_CLAIM,
      corpusId: "personal-filings-2026",
      corpusVersion: "1.0.0",
      declarationSha256: sha256(documents.declaration),
      filingCount: 1,
      frozenAt: "2026-08-27T18:00:00.000Z",
      manifestSha256: sha256(documents.manifest),
      profile: "personal_single_user_local",
      retentionDays: 365,
      schemaVersion: "1.0.0",
      status: "verified_for_personal_use",
      totalDeclaredBytes: 12_345,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("0001234567-26-000001");
    expect(JSON.stringify(result)).not.toContain("sec-edgar:");
    expect(JSON.stringify(result)).not.toContain("admitted");
  });

  it("accepts a sorted base filing and amendment with consistent lineage", () => {
    const documents = mutableDocuments();
    documents.manifest.entries.push({
      acceptedAt: "2026-08-26T17:00:00.000Z",
      accession: "0001234567-26-000002",
      amendmentOf: "0001234567-26-000001",
      availableAt: "2026-08-26T17:00:01.000Z",
      cik: "0001234567",
      contentBytes: 456,
      contentSha256: `sha256:${"b".repeat(64)}`,
      form: "10-K/A",
      mediaType: "text/html",
      source: "sec_edgar",
      sourceLocator: "sec-edgar:0001234567-26-000002",
      taxonomy: "us-gaap-2026",
    });
    const result = verifyMutable(documents);

    expect(result.filingCount).toBe(2);
    expect(result.totalDeclaredBytes).toBe(12_801);
  });

  it("accepts the exact 100-entry personal profile ceiling", () => {
    const documents = mutableDocuments();
    documents.manifest.entries = Array.from({ length: 100 }, (_, index) =>
      filingEntry(index + 1, 1),
    );
    const result = verifyMutable(documents);

    expect(result.filingCount).toBe(100);
    expect(result.totalDeclaredBytes).toBe(100);
  });

  it("is deterministic for exact replay and changes both bindings after mutation", () => {
    const baseline = buildDocuments();
    const replay = buildDocuments();
    expect(verifyPersonalFilingCorpusManifest(replay)).toEqual(
      verifyPersonalFilingCorpusManifest(baseline),
    );

    const mutated = mutableDocuments();
    mutated.manifest.entries[0]!.contentBytes = 12_346;
    const changed = verifyMutable(mutated);
    const original = verifyPersonalFilingCorpusManifest(baseline);
    expect(changed.manifestSha256).not.toBe(original.manifestSha256);
    expect(changed.declarationSha256).not.toBe(original.declarationSha256);
    expect(changed.totalDeclaredBytes).toBe(12_346);
  });

  it("rejects a declaration that does not bind the exact manifest bytes", () => {
    const documents = buildDocuments();
    documents.manifest[documents.manifest.length - 2] = 32;

    expectFailure(
      () => verifyPersonalFilingCorpusManifest(documents),
      "PERSONAL_FILING_CORPUS_SCOPE_MISMATCH",
    );
  });

  it("rejects a declaration and manifest with different corpus identities", () => {
    const documents = mutableDocuments();
    documents.declaration.corpusId = "different-personal-corpus";

    expectFailure(
      () => verifyMutable(documents),
      "PERSONAL_FILING_CORPUS_SCOPE_MISMATCH",
    );
  });

  it("rejects personal scope drift and unknown schema properties", () => {
    for (const mutate of [
      (value: ReturnType<typeof mutableDocuments>) => {
        value.declaration.singleUser = false;
      },
      (value: ReturnType<typeof mutableDocuments>) => {
        value.declaration.localOnly = false;
      },
      (value: ReturnType<typeof mutableDocuments>) => {
        value.declaration.redistribution = "allowed";
      },
      (value: ReturnType<typeof mutableDocuments>) => {
        value.declaration.retentionDays = 0;
      },
      (value: ReturnType<typeof mutableDocuments>) => {
        value.declaration.unknown = true;
      },
    ]) {
      const documents = mutableDocuments();
      mutate(documents);
      const manifest = canonicalBytes(documents.manifest);
      documents.declaration.manifestSha256 = sha256(manifest);
      expectFailure(
        () =>
          verifyPersonalFilingCorpusManifest({
            declaration: canonicalBytes(documents.declaration),
            manifest,
          }),
        "PERSONAL_FILING_CORPUS_DECLARATION_INVALID",
      );
    }
  });
});

function buildDocuments(): {
  declaration: Uint8Array;
  manifest: Uint8Array;
} {
  const documents = mutableDocuments();
  const manifest = canonicalBytes(documents.manifest);
  documents.declaration.manifestSha256 = sha256(manifest);
  return {
    declaration: canonicalBytes(documents.declaration),
    manifest,
  };
}

function mutableDocuments(): {
  declaration: JsonRecord;
  manifest: JsonRecord & { entries: JsonRecord[] };
} {
  return {
    declaration: {
      commercialUse: "prohibited",
      corpusId: "personal-filings-2026",
      corpusVersion: "1.0.0",
      deleteOnRequest: true,
      deletionMode: "user_managed_local_delete",
      localOnly: true,
      manifestSha256: `sha256:${"0".repeat(64)}`,
      profile: "personal_single_user_local",
      purpose: "personal_offline_filing_research_only",
      redistribution: "prohibited",
      retentionDays: 365,
      schemaVersion: "1.0.0",
      singleUser: true,
    },
    manifest: {
      corpusId: "personal-filings-2026",
      corpusVersion: "1.0.0",
      entries: [filingEntry(1, 12_345)],
      frozenAt: "2026-08-27T18:00:00.000Z",
      profile: "personal_single_user_local",
      schemaVersion: "1.0.0",
    },
  };
}

function filingEntry(sequence: number, contentBytes: number): JsonRecord {
  const accession = `0001234567-26-${String(sequence).padStart(6, "0")}`;
  return {
    acceptedAt: "2026-08-25T17:00:00.000Z",
    accession,
    amendmentOf: null,
    availableAt: "2026-08-25T17:00:01.000Z",
    cik: "0001234567",
    contentBytes,
    contentSha256: sha256(
      new TextEncoder().encode(`declared-content-${sequence}`),
    ),
    form: "10-K",
    mediaType: "text/html",
    source: "sec_edgar",
    sourceLocator: `sec-edgar:${accession}`,
    taxonomy: "us-gaap-2026",
  };
}

function verifyMutable(documents: ReturnType<typeof mutableDocuments>) {
  const manifest = canonicalBytes(documents.manifest);
  documents.declaration.manifestSha256 = sha256(manifest);
  return verifyPersonalFilingCorpusManifest({
    declaration: canonicalBytes(documents.declaration),
    manifest,
  });
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
  const record = value as JsonRecord;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function expectFailure(
  callback: () => unknown,
  code: PersonalFilingCorpusError["code"],
): void {
  try {
    callback();
    throw new Error("expected verification to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PersonalFilingCorpusError);
    expect((error as PersonalFilingCorpusError).code).toBe(code);
    expect((error as Error).message).toBe(
      "Personal filing corpus verification failed.",
    );
  }
}
