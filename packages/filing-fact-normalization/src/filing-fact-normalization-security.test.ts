import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  FILING_FACT_CONTRACTS,
  FILING_FACT_KEYS,
  FILING_FACT_NORMALIZATION_CHECKS,
  FILING_FACT_NORMALIZATION_CLAIM,
  FILING_FACT_NORMALIZATION_LIMITS,
  FILING_FACT_NORMALIZATION_NOT_PROVEN,
  FILING_FACT_NORMALIZATION_QUARANTINE_CODES,
  FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
  FilingFactProjectionError,
  normalizeSyntheticFilingFactPair,
  projectNormalizedFilingFactsAsKnown,
  type FilingFactNormalizationQuarantineCode,
  type FilingFactNormalizationRecord,
  type FilingFactNormalizationResult,
} from "./filing-fact-normalization";
import {
  buildSyntheticFilingFactDocuments,
  canonicalSyntheticFilingFactDocument,
  decodeSyntheticFilingFactDocument,
} from "./test-filing-fact-builder";

type JsonRecord = Record<string, unknown>;

const EXPECTED_CHECKS = [
  "exact_two_document_original_and_amendment_synthetic_fixture",
  "exact_ten_launch_fact_keys_once_per_document",
  "owned_bounded_canonical_json_byte_snapshot_and_duplicate_key_rejection",
  "closed_accession_form_entity_source_hash_parser_and_taxonomy_metadata",
  "strict_decimal_string_precision_scale_and_no_binary_float",
  "fact_key_unit_instant_duration_period_and_dimension_contract",
  "accepted_available_and_report_period_time_ordering",
  "amendment_predecessor_entity_form_period_and_later_publication_binding",
  "derived_fact_identity_and_single_predecessor_acyclic_supersession",
  "half_open_known_windows_and_pre_post_as_known_projection",
  "unchanged_and_changed_fact_versions_preserve_source_lineage",
  "missing_duplicate_ambiguous_fork_cycle_and_cross_context_rejection",
  "whole_document_pair_atomic_normalization_or_empty_quarantine",
  "exact_byte_replay_determinism_owned_input_snapshot_and_buffer_mutation_safety",
  "aggregate_value_free_quarantine_error_and_ci_output_canary_absence",
  "no_network_raw_parser_custody_corpus_database_api_web_queue_and_cycle2a_cycle2c_schema_check_nonclaim_source_set_artifact_preservation",
] as const;

const EXPECTED_NONCLAIMS = [
  "cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission",
  "real_filing_raw_payload_identity_digest_equality_or_sec_source_authenticity",
  "counsel_identity_legal_validity_revocation_freshness_or_data_rights",
  "edgar_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety",
  "xml_xbrl_ixbrl_parser_worker_or_general_taxonomy_plugin_correctness",
  "raw_payload_custody_retention_kms_backup_deletion_or_cryptographic_erasure",
  "independent_dual_parser_validator_or_cross_engine_conflict_quarantine",
  "independently_adjudicated_ground_truth_or_2000_assertions",
  "precision_recall_document_success_quality_thresholds_or_zero_silent_failures",
  "general_concept_alias_unit_conversion_dimensions_or_fiscal_calendar_coverage",
  "real_amendment_completeness_correction_discovery_or_sec_restated_status",
  "multi_issuer_multi_document_batch_streaming_concurrency_retry_or_crash_recovery",
  "derived_metrics_formulas_evidence_passports_rights_projection_or_valuation",
  "database_api_web_queue_persistence_or_b15_v15_composition",
  "production_identity_secrets_network_load_slo_operations_or_incident_recovery",
  "real_data_admission_full_cycle2_exit_or_production_use",
] as const;

describe("Cycle 2d filing fact normalization security boundary", () => {
  it("freezes the exact bounded claim, checks, nonclaims, limits, and registries", () => {
    expect(FILING_FACT_NORMALIZATION_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_FACT_NORMALIZATION_CLAIM).toBe(
      "bounded_synthetic_ten_fact_normalization_and_amendment_supersession_lineage",
    );
    expect(FILING_FACT_KEYS).toEqual([
      "assets",
      "cash",
      "debt",
      "diluted_shares",
      "free_cash_flow",
      "gross_profit",
      "net_income",
      "operating_cash_flow",
      "operating_income",
      "revenue",
    ]);
    expect(FILING_FACT_NORMALIZATION_CHECKS).toEqual(EXPECTED_CHECKS);
    expect(FILING_FACT_NORMALIZATION_NOT_PROVEN).toEqual(EXPECTED_NONCLAIMS);
    expect(FILING_FACT_NORMALIZATION_QUARANTINE_CODES).toEqual([
      "document_invalid",
      "source_metadata_invalid",
      "fact_set_invalid",
      "lineage_invalid",
      "normalization_failure",
    ]);
    expect(FILING_FACT_NORMALIZATION_LIMITS).toEqual({
      aggregateStringCodePoints: 65_536,
      decimalIntegerDigits: 26,
      decimalPrecision: 38,
      decimalScale: 12,
      documentBytes: 131_072,
      documentDepth: 8,
      documentNodes: 512,
      documents: 2,
      factVersions: 20,
      factsPerDocument: 10,
      lineageEdges: 10,
    });
    for (const value of [
      FILING_FACT_KEYS,
      FILING_FACT_CONTRACTS,
      FILING_FACT_NORMALIZATION_CHECKS,
      FILING_FACT_NORMALIZATION_NOT_PROVEN,
      FILING_FACT_NORMALIZATION_QUARANTINE_CODES,
      FILING_FACT_NORMALIZATION_LIMITS,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(FILING_FACT_CONTRACTS.every(Object.isFrozen)).toBe(true);
    expect(() => {
      Reflect.apply(Array.prototype.pop, FILING_FACT_KEYS, []);
    }).toThrow(TypeError);
  });

  it("returns exactly twenty deeply immutable source-preserving fact versions", () => {
    const documents = buildSyntheticFilingFactDocuments();
    const result = normalized(
      normalizeSyntheticFilingFactPair(
        documents.originalDocument,
        documents.amendmentDocument,
      ),
    );

    expect(result.audit).toEqual({
      factVersionCount: 20,
      lineageCount: 10,
      outcome: "normalized",
    });
    expect(result.factVersions).toHaveLength(20);
    expect(result.lineage).toHaveLength(10);
    expect(
      new Set(result.factVersions.map((fact) => fact.factId)),
    ).toHaveLength(20);
    expect(result.factVersions.slice(0, 10).map((fact) => fact.key)).toEqual(
      FILING_FACT_KEYS,
    );
    expect(result.factVersions.slice(10).map((fact) => fact.key)).toEqual(
      FILING_FACT_KEYS,
    );
    expect(
      result.factVersions.every((fact) => typeof fact.value === "string"),
    ).toBe(true);
    expect(
      result.factVersions.every(
        (fact) => Object.keys(fact.dimensions).length === 0,
      ),
    ).toBe(true);
    for (const value of [
      result,
      result.audit,
      result.factVersions,
      result.lineage,
      ...result.factVersions,
      ...result.factVersions.map((fact) => fact.dimensions),
      ...result.lineage,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(result.originalDocumentSha256).toBe(
      sha256(documents.originalDocument),
    );
    expect(result.amendmentDocumentSha256).toBe(
      sha256(documents.amendmentDocument),
    );
  });

  it("derives immutable identities from the complete source document identity", () => {
    const baselineDocuments = buildSyntheticFilingFactDocuments();
    const baseline = normalized(
      normalizeSyntheticFilingFactPair(
        baselineDocuments.originalDocument,
        baselineDocuments.amendmentDocument,
      ),
    );
    const variantDocuments = mutableDocuments();
    variantDocuments.original.availableAt = "2026-02-20T20:00:02.000Z";
    variantDocuments.amendment.acceptedAt = "2026-03-15T20:00:02.000Z";
    variantDocuments.amendment.availableAt = "2026-03-15T20:00:03.000Z";
    const variant = normalizeMutablePair(variantDocuments);

    expect(variant.status).toBe("normalized");
    if (variant.status !== "normalized") return;
    expect(variant.factVersions.map((fact) => fact.factId)).not.toEqual(
      baseline.factVersions.map((fact) => fact.factId),
    );
    expect(
      variant.factVersions.every(
        (fact, index) => fact.factId !== baseline.factVersions[index]?.factId,
      ),
    ).toBe(true);
  });

  it("accepts only two runtime arguments and refuses an ignored fork document", () => {
    const documents = buildSyntheticFilingFactDocuments();
    const result = Reflect.apply(normalizeSyntheticFilingFactPair, undefined, [
      documents.originalDocument,
      documents.amendmentDocument,
      documents.amendmentDocument.slice(),
    ]) as FilingFactNormalizationResult;

    expectQuarantined(result, "document_invalid");
  });

  it("owns exact ArrayBuffer-backed byte snapshots and rejects hostile views", () => {
    const documents = buildSyntheticFilingFactDocuments();
    const subclass = new (class extends Uint8Array {})(
      documents.originalDocument,
    );
    const hostile = new Proxy(documents.originalDocument, {
      getPrototypeOf() {
        throw new Error("PROXY_INPUT_CANARY");
      },
    });
    const detached = documents.originalDocument.slice();
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    const inputs: unknown[] = [
      undefined,
      null,
      "bytes",
      {},
      new DataView(new ArrayBuffer(1)),
      Buffer.from(documents.originalDocument),
      subclass,
      hostile,
      detached,
      new Uint8Array(),
      new Uint8Array(FILING_FACT_NORMALIZATION_LIMITS.documentBytes + 1),
    ];
    if (typeof SharedArrayBuffer === "function") {
      inputs.push(new Uint8Array(new SharedArrayBuffer(8)));
    }

    for (const input of inputs) {
      const result = normalizeSyntheticFilingFactPair(
        input,
        documents.amendmentDocument,
      );
      expectQuarantined(result, "document_invalid", ["PROXY_INPUT_CANARY"]);
    }
  });

  it("rejects noncanonical JSON, duplicate keys, BOM, invalid UTF-8, and trailing bytes", () => {
    const documents = buildSyntheticFilingFactDocuments();
    const text = new TextDecoder().decode(documents.originalDocument);
    const duplicate = text.replace(
      '"accession":',
      '"accession":"DUPLICATE_KEY_CANARY","accession":',
    );
    const variants = [
      new TextEncoder().encode(`\uFEFF${text}`),
      new TextEncoder().encode(text.trimEnd()),
      new TextEncoder().encode(text.replace(/\n$/u, "\r\n")),
      new TextEncoder().encode(` ${text}`),
      new TextEncoder().encode(duplicate),
      new TextEncoder().encode(`${text}{}`),
      Uint8Array.of(0xff, 0xfe, 0xfd),
    ];

    for (const variant of variants) {
      expectQuarantined(
        normalizeSyntheticFilingFactPair(variant, documents.amendmentDocument),
        "document_invalid",
        ["DUPLICATE_KEY_CANARY"],
      );
    }
  });

  it("enforces bounded canonical trees before accepting document fields", () => {
    let nested: unknown = "leaf";
    for (
      let depth = 0;
      depth <= FILING_FACT_NORMALIZATION_LIMITS.documentDepth;
      depth += 1
    ) {
      nested = { nested };
    }
    const deepBytes = canonicalSyntheticFilingFactDocument(nested);
    const documents = buildSyntheticFilingFactDocuments();
    expectQuarantined(
      normalizeSyntheticFilingFactPair(deepBytes, documents.amendmentDocument),
      "document_invalid",
    );

    const manyNodes = canonicalSyntheticFilingFactDocument(
      Array.from(
        { length: FILING_FACT_NORMALIZATION_LIMITS.documentNodes + 1 },
        () => null,
      ),
    );
    expectQuarantined(
      normalizeSyntheticFilingFactPair(manyNodes, documents.amendmentDocument),
      "document_invalid",
    );
  });

  it("rejects malformed and cross-bound source metadata with closed codes", () => {
    const cases: Array<{
      readonly mutate: (pair: MutableDocuments) => void;
      readonly code: FilingFactNormalizationQuarantineCode;
    }> = [
      {
        code: "document_invalid",
        mutate: ({ original }) => {
          original.extra = "SOURCE_METADATA_CANARY";
        },
      },
      {
        code: "source_metadata_invalid",
        mutate: ({ original }) => {
          original.schemaVersion = "2.0.0";
        },
      },
      {
        code: "source_metadata_invalid",
        mutate: ({ original }) => {
          original.synthetic = false;
        },
      },
      {
        code: "source_metadata_invalid",
        mutate: ({ original }) => {
          original.contentSha256 = `sha256:${"A".repeat(64)}`;
        },
      },
      {
        code: "source_metadata_invalid",
        mutate: ({ amendment }) => {
          amendment.form = "10-K";
        },
      },
      {
        code: "source_metadata_invalid",
        mutate: ({ amendment }) => {
          amendment.parserVersion = "untrusted-parser";
        },
      },
      {
        code: "source_metadata_invalid",
        mutate: ({ amendment }) => {
          amendment.taxonomyVersion = "9.9.9";
        },
      },
      {
        code: "source_metadata_invalid",
        mutate: ({ original }) => {
          original.acceptedAt = "2026-02-30T20:00:00.000Z";
        },
      },
      {
        code: "source_metadata_invalid",
        mutate: ({ original }) => {
          original.acceptedAt = "2026-02-20T20:00:01.001Z";
        },
      },
      {
        code: "lineage_invalid",
        mutate: ({ amendment }) => {
          amendment.entityId = "entity.synthetic.other";
        },
      },
      {
        code: "lineage_invalid",
        mutate: ({ amendment }) => {
          amendment.instrumentId = "instrument.synthetic.other";
        },
      },
      {
        code: "lineage_invalid",
        mutate: ({ amendment, original }) => {
          amendment.contentSha256 = original.contentSha256;
        },
      },
      {
        code: "lineage_invalid",
        mutate: ({ amendment }) => {
          amendment.amendmentOf = "SYN-0000000001-26-999999";
        },
      },
      {
        code: "lineage_invalid",
        mutate: ({ amendment }) => {
          amendment.accession = "SYN-0000000002-26-000002";
        },
      },
      {
        code: "source_metadata_invalid",
        mutate: ({ original }) => {
          original.accession = "SYN-0000000001-25-000001";
        },
      },
    ];

    for (const { code, mutate } of cases) {
      const pair = mutableDocuments();
      mutate(pair);
      expectQuarantined(normalizeMutablePair(pair), code, [
        "SOURCE_METADATA_CANARY",
      ]);
    }
  });

  it("pins the strict decimal grammar and numeric(38,12) boundary", () => {
    const accepted = [
      "0",
      "1",
      "-1",
      "0.000000000001",
      "-0.000000000001",
      `${"9".repeat(26)}.${"9".repeat(12)}`,
    ];
    for (const value of accepted) {
      const pair = mutableDocuments();
      fact(pair.amendment, "revenue").value = value;
      expect(normalizeMutablePair(pair).status).toBe("normalized");
    }

    const rejected: unknown[] = [
      1,
      "",
      "+1",
      "01",
      "-0",
      "0.0",
      "1.",
      ".1",
      "1.230",
      "1e3",
      "NaN",
      "Infinity",
      "-Infinity",
      "9".repeat(27),
      `0.${"1".repeat(13)}`,
    ];
    for (const value of rejected) {
      const pair = mutableDocuments();
      fact(pair.amendment, "revenue").value = value;
      expectQuarantined(normalizeMutablePair(pair), "fact_set_invalid");
    }
  });

  it("rejects key, concept, unit, dimension, and period-shape ambiguity", () => {
    const mutations: Array<(pair: MutableDocuments) => void> = [
      ({ amendment }) => {
        fact(amendment, "revenue").key = "net_income";
      },
      ({ amendment }) => {
        fact(amendment, "revenue").concept = "rc-synthetic:Other";
      },
      ({ amendment }) => {
        fact(amendment, "diluted_shares").unit = "USD";
      },
      ({ amendment }) => {
        fact(amendment, "assets").dimensions = { segment: "hidden" };
      },
      ({ amendment }) => {
        fact(amendment, "assets").periodStart = "2025-01-01";
      },
      ({ amendment }) => {
        fact(amendment, "revenue").periodStart = null;
      },
      ({ amendment }) => {
        fact(amendment, "revenue").periodStart = "2026-01-01";
      },
      ({ amendment }) => {
        fact(amendment, "revenue").periodEnd = "2025-02-29";
      },
      ({ amendment }) => {
        amendment.facts = facts(amendment).slice(0, 9);
      },
      ({ amendment }) => {
        amendment.facts = [
          facts(amendment)[0],
          ...facts(amendment).slice(0, 9),
        ];
      },
    ];

    for (const mutate of mutations) {
      const pair = mutableDocuments();
      mutate(pair);
      expectQuarantined(normalizeMutablePair(pair), "fact_set_invalid");
    }
  });

  it("rejects pair-wide mixed reporting contexts and zero-length durations", () => {
    const mixed = mutableDocuments();
    fact(mixed.original, "assets").periodEnd = "2025-11-30";
    fact(mixed.amendment, "assets").periodEnd = "2025-11-30";
    expectQuarantined(normalizeMutablePair(mixed), "lineage_invalid");

    const zeroLength = mutableDocuments();
    fact(zeroLength.original, "revenue").periodStart = "2025-12-31";
    fact(zeroLength.amendment, "revenue").periodStart = "2025-12-31";
    expectQuarantined(normalizeMutablePair(zeroLength), "fact_set_invalid");

    const futurePeriod = mutableDocuments();
    for (const document of [futurePeriod.original, futurePeriod.amendment]) {
      for (const entry of facts(document)) entry.periodEnd = "2026-02-20";
    }
    expectQuarantined(normalizeMutablePair(futurePeriod), "lineage_invalid");
  });

  it("requires at least one changed and one unchanged version", () => {
    const allUnchanged = mutableDocuments();
    for (const key of FILING_FACT_KEYS) {
      fact(allUnchanged.amendment, key).value = fact(
        allUnchanged.original,
        key,
      ).value;
    }
    expectQuarantined(normalizeMutablePair(allUnchanged), "lineage_invalid");

    const allChanged = mutableDocuments();
    for (const key of FILING_FACT_KEYS) {
      const amendmentFact = fact(allChanged.amendment, key);
      amendmentFact.value = `${String(amendmentFact.value)}1`;
    }
    expectQuarantined(normalizeMutablePair(allChanged), "lineage_invalid");
  });

  it("derives exact acyclic one-to-one lineage for changed and unchanged facts", () => {
    const documents = buildSyntheticFilingFactDocuments();
    const result = normalized(
      normalizeSyntheticFilingFactPair(
        documents.originalDocument,
        documents.amendmentDocument,
      ),
    );
    for (let index = 0; index < FILING_FACT_KEYS.length; index += 1) {
      const predecessor = result.factVersions[index];
      const successor = result.factVersions[index + 10];
      const edge = result.lineage[index];
      expect(predecessor?.predecessorFactId).toBeNull();
      expect(predecessor?.successorFactId).toBe(successor?.factId);
      expect(successor?.predecessorFactId).toBe(predecessor?.factId);
      expect(successor?.successorFactId).toBeNull();
      expect(edge).toEqual({
        effectiveAt: "2026-03-15T20:00:01.000Z",
        key: FILING_FACT_KEYS[index],
        predecessorFactId: predecessor?.factId,
        successorFactId: successor?.factId,
      });
      expect(predecessor?.knownToExclusive).toBe(successor?.knownFrom);
    }
    expect(
      result.factVersions
        .filter((entry) => entry.key === "cash")
        .map((entry) => entry.value),
    ).toEqual(["24000000", "24000000"]);
    expect(
      result.factVersions
        .filter((entry) => entry.key === "revenue")
        .map((entry) => entry.value),
    ).toEqual(["120000000", "116400000"]);
  });

  it("projects only trusted records with exact half-open public knowledge windows", () => {
    const documents = buildSyntheticFilingFactDocuments();
    const result = normalized(
      normalizeSyntheticFilingFactPair(
        documents.originalDocument,
        documents.amendmentDocument,
      ),
    );
    const cutoffs = [
      ["2026-02-20T20:00:00.999Z", 0, ""],
      ["2026-02-20T20:00:01.000Z", 10, "000001"],
      ["2026-03-15T20:00:00.999Z", 10, "000001"],
      ["2026-03-15T20:00:01.000Z", 10, "000002"],
      ["9999-12-31T23:59:59.999Z", 10, "000002"],
    ] as const;
    for (const [knownAt, count, accessionSuffix] of cutoffs) {
      const projected = projectNormalizedFilingFactsAsKnown(result, knownAt);
      expect(projected).toHaveLength(count);
      expect(Object.isFrozen(projected)).toBe(true);
      expect(
        projected.every((entry) =>
          entry.sourceAccession.endsWith(accessionSuffix),
        ),
      ).toBe(true);
    }

    const forged = { ...result } as FilingFactNormalizationRecord;
    for (const [record, knownAt] of [
      [forged, "2026-03-15T20:00:01.000Z"],
      [result, "2026-03-15T20:00:01Z"],
      [result, "PROJECTION_CANARY"],
    ] as const) {
      let caught: unknown;
      try {
        projectNormalizedFilingFactsAsKnown(record, knownAt);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(FilingFactProjectionError);
      expect((caught as Error).message).toBe("Filing fact projection failed.");
      expect(JSON.stringify(caught)).not.toContain("PROJECTION_CANARY");
    }
  });

  it("is deterministic, owns inputs, and returns fresh immutable result graphs", () => {
    const firstDocuments = buildSyntheticFilingFactDocuments();
    const secondDocuments = buildSyntheticFilingFactDocuments();
    const first = normalized(
      normalizeSyntheticFilingFactPair(
        firstDocuments.originalDocument,
        firstDocuments.amendmentDocument,
      ),
    );
    const second = normalized(
      normalizeSyntheticFilingFactPair(
        secondDocuments.originalDocument,
        secondDocuments.amendmentDocument,
      ),
    );
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.factVersions).not.toBe(second.factVersions);
    expect(first.factVersions[0]).not.toBe(second.factVersions[0]);

    firstDocuments.originalDocument.fill(0x41);
    firstDocuments.amendmentDocument.fill(0x42);
    expect(first).toEqual(second);
    expect(
      Reflect.set(first.factVersions[0] as object, "value", "MUTATION_CANARY"),
    ).toBe(false);
    expect(JSON.stringify(first)).not.toContain("MUTATION_CANARY");
  });

  it("returns only aggregate value-free quarantine metadata for every abuse class", () => {
    const cases: Array<{
      readonly canary: string;
      readonly mutate: (pair: MutableDocuments) => void;
    }> = [
      {
        canary: "DOCUMENT_CANARY",
        mutate: ({ original }) => {
          original.DOCUMENT_CANARY = true;
        },
      },
      {
        canary: "METADATA_CANARY",
        mutate: ({ original }) => {
          original.entityId = "METADATA_CANARY";
        },
      },
      {
        canary: "FACT_CANARY",
        mutate: ({ amendment }) => {
          fact(amendment, "revenue").value = "FACT_CANARY";
        },
      },
      {
        canary: "LINEAGE_CANARY",
        mutate: ({ amendment }) => {
          amendment.amendmentOf = "LINEAGE_CANARY";
        },
      },
    ];

    for (const { canary, mutate } of cases) {
      const pair = mutableDocuments();
      mutate(pair);
      const result = normalizeMutablePair(pair);
      expect(result.status).toBe("quarantined");
      if (result.status !== "quarantined") continue;
      expect(Object.keys(result).sort()).toEqual([
        "audit",
        "claim",
        "code",
        "factVersions",
        "lineage",
        "schemaVersion",
        "status",
        "synthetic",
      ]);
      expect(result.audit).toEqual({
        factVersionCount: 0,
        lineageCount: 0,
        outcome: "quarantined",
      });
      expect(result.factVersions).toEqual([]);
      expect(result.lineage).toEqual([]);
      expect(JSON.stringify(result)).not.toContain(canary);
      expect(JSON.stringify(result)).not.toContain("SYN-");
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.audit)).toBe(true);
      expect(Object.isFrozen(result.factVersions)).toBe(true);
      expect(Object.isFrozen(result.lineage)).toBe(true);
    }
  });

  it("treats declared source hashes as synthetic metadata rather than raw-byte proof", () => {
    const pair = mutableDocuments();
    pair.original.contentSha256 = `sha256:${"a".repeat(64)}`;
    pair.amendment.contentSha256 = `sha256:${"b".repeat(64)}`;
    const result = normalizeMutablePair(pair);
    expect(result.status).toBe("normalized");
    if (result.status !== "normalized") return;
    expect(result.factVersions[0]?.sourceContentSha256).toBe(
      `sha256:${"a".repeat(64)}`,
    );
    expect(result.factVersions[10]?.sourceContentSha256).toBe(
      `sha256:${"b".repeat(64)}`,
    );
    expect(result.originalDocumentSha256).not.toBe(
      result.factVersions[0]?.sourceContentSha256,
    );
  });
});

interface MutableDocuments {
  readonly amendment: JsonRecord;
  readonly original: JsonRecord;
}

function mutableDocuments(): MutableDocuments {
  const documents = buildSyntheticFilingFactDocuments();
  return {
    amendment: decodeSyntheticFilingFactDocument(documents.amendmentDocument),
    original: decodeSyntheticFilingFactDocument(documents.originalDocument),
  };
}

function normalizeMutablePair(
  documents: MutableDocuments,
): FilingFactNormalizationResult {
  return normalizeSyntheticFilingFactPair(
    canonicalSyntheticFilingFactDocument(documents.original),
    canonicalSyntheticFilingFactDocument(documents.amendment),
  );
}

function facts(document: JsonRecord): JsonRecord[] {
  return document.facts as JsonRecord[];
}

function fact(document: JsonRecord, key: string): JsonRecord {
  const entry = facts(document).find((candidate) => candidate.key === key);
  if (entry === undefined) throw new Error("Synthetic test fact is missing.");
  return entry;
}

function normalized(
  result: FilingFactNormalizationResult,
): FilingFactNormalizationRecord {
  expect(result.status).toBe("normalized");
  if (result.status !== "normalized")
    throw new Error("Expected normalized synthetic fixture.");
  return result;
}

function expectQuarantined(
  result: FilingFactNormalizationResult,
  code?: FilingFactNormalizationQuarantineCode,
  canaries: readonly string[] = [],
): void {
  expect(result.status).toBe("quarantined");
  if (result.status !== "quarantined") return;
  if (code !== undefined) expect(result.code).toBe(code);
  expect(result.factVersions).toEqual([]);
  expect(result.lineage).toEqual([]);
  expect(result.audit).toEqual({
    factVersionCount: 0,
    lineageCount: 0,
    outcome: "quarantined",
  });
  const serialized = JSON.stringify(result);
  for (const canary of canaries) expect(serialized).not.toContain(canary);
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
