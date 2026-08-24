import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  FILING_FACT_COMPARISON_CHECKS,
  FILING_FACT_COMPARISON_CLAIM,
  FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS,
  FILING_FACT_COMPARISON_FACT_KEYS,
  FILING_FACT_COMPARISON_LIMITS,
  FILING_FACT_COMPARISON_NOT_PROVEN,
  FILING_FACT_COMPARISON_QUARANTINE_CODES,
  FILING_FACT_COMPARISON_SCHEMA_VERSION,
  compareSyntheticFilingFactValidatorReports,
  type FilingFactComparisonQuarantineCode,
  type FilingFactComparisonResult,
} from "./filing-fact-comparison";
import {
  buildSyntheticFilingFactComparisonEnvelopes,
  buildSyntheticFilingFactComparisonQuarantinedEnvelope,
  canonicalSyntheticFilingFactComparisonEnvelope,
  decodeSyntheticFilingFactComparisonEnvelope,
} from "./test-filing-fact-comparison-builder";

type MutableRecord = Record<string, unknown>;
type ReportPosition = "a" | "b";

const WRAPPER_KEYS = [
  "implementationSha256",
  "normalizedPayload",
  "role",
  "schemaVersion",
  "status",
  "synthetic",
  "validatorId",
  "validatorVersion",
] as const;
const PAYLOAD_KEYS = [
  "amendmentDocumentSha256",
  "audit",
  "claim",
  "factVersions",
  "lineage",
  "originalDocumentSha256",
  "schemaVersion",
  "sourceDocuments",
  "status",
  "synthetic",
] as const;
const SOURCE_DOCUMENT_KEYS = [
  "accession",
  "acceptedAt",
  "amendmentOf",
  "availableAt",
  "contentSha256",
  "documentSha256",
  "entityId",
  "form",
  "instrumentId",
  "parserVersion",
  "schemaVersion",
  "synthetic",
  "taxonomyFamily",
  "taxonomyVersion",
] as const;
const FACT_VERSION_KEYS = [
  "dimensions",
  "factId",
  "key",
  "knownFrom",
  "knownToExclusive",
  "parserVersion",
  "periodEnd",
  "periodStart",
  "predecessorFactId",
  "sourceAcceptedAt",
  "sourceAccession",
  "sourceAvailableAt",
  "sourceConcept",
  "sourceContentSha256",
  "sourceDocumentSha256",
  "successorFactId",
  "synthetic",
  "taxonomyFamily",
  "taxonomyVersion",
  "unit",
  "value",
] as const;
const LINEAGE_KEYS = [
  "effectiveAt",
  "key",
  "predecessorFactId",
  "successorFactId",
] as const;
const FACT_ID_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-normalized-filing-fact:v1\u0000",
);
const AGREEMENT_DOMAIN = new TextEncoder().encode(
  "research-cockpit:synthetic-filing-fact-comparison-agreement:v1\u0000",
);

describe("Cycle 2e filing fact comparison security boundary", () => {
  it("freezes the exact ordered checks and explicit nonclaims", () => {
    expect(FILING_FACT_COMPARISON_CHECKS).toEqual([
      "exact_two_declared_validator_same_schema_synthetic_envelopes",
      "owned_bounded_utf8_canonical_json_byte_snapshots_and_duplicate_key_rejection",
      "exact_distinct_declared_validator_identity_version_and_implementation_digest_bindings",
      "separate_no_shared_runtime_validator_implementations_and_fixed_argument_roles",
      "each_envelope_closed_schema_validation_precedes_agreement",
      "closed_original_amendment_entity_instrument_accession_hash_form_and_chronology_binding",
      "exact_ten_keys_twenty_versions_and_ten_one_to_one_lineage_edges_per_validator",
      "strict_decimal_unit_period_dimension_concept_parser_taxonomy_and_source_metadata_contract",
      "complete_source_preimage_fact_identity_recomputation_uniqueness_and_pointer_consistency",
      "acyclic_single_predecessor_changed_unchanged_and_half_open_known_window_validation",
      "byte_exact_full_normalized_payload_agreement_not_digest_or_subset_equality",
      "any_invalid_upstream_quarantine_source_fact_lineage_metadata_or_byte_conflict_fails_closed",
      "no_primary_preference_merge_fallback_reordering_tolerance_coercion_or_silent_repair",
      "atomic_metadata_only_agreement_receipt_or_empty_value_free_conflict_quarantine",
      "domain_separated_determinism_owned_snapshot_mutation_safety_runtime_immutability_and_canary_absence",
      "no_network_raw_parser_normalizer_custody_corpus_database_api_web_queue_or_historical_evidence_mutation",
    ]);
    expect(FILING_FACT_COMPARISON_NOT_PROVEN).toEqual([
      "true_validator_parser_implementation_process_host_operator_key_or_failure_domain_independence",
      "declared_validator_identity_digest_authenticity_code_correspondence_signature_or_authority",
      "cycle2b_external_manifest_rights_steward_key_authority_or_phaseb_admission",
      "real_filing_raw_payload_identity_digest_equality_or_sec_source_authenticity",
      "xml_xbrl_ixbrl_parser_worker_or_general_taxonomy_plugin_correctness",
      "fact_id_source_preimage_authenticity_accounting_truth_or_cycle2d_normalizer_correctness",
      "independently_adjudicated_ground_truth_or_2000_assertions",
      "precision_recall_document_success_quality_thresholds_quarantine_rate_or_zero_silent_failures",
      "merge_repair_majority_tie_break_human_adjudication_or_correction_policy",
      "malicious_validator_collusion_common_mode_failure_or_real_cross_engine_determinism",
      "edgar_fetch_dns_tls_ssrf_rate_limit_malware_archive_or_source_safety",
      "raw_payload_custody_retention_kms_backup_deletion_or_cryptographic_erasure",
      "real_amendment_completeness_correction_discovery_or_sec_restated_status",
      "multi_issuer_multi_document_batch_streaming_concurrency_retry_crash_recovery_or_slo",
      "database_api_web_queue_persistence_evidence_passport_rights_projection_b15_or_v15_composition",
      "production_identity_secrets_network_operations_real_data_full_cycle2_exit_or_production_use",
    ]);
    expect(FILING_FACT_COMPARISON_QUARANTINE_CODES).toEqual([
      "report_invalid",
      "validator_binding_invalid",
      "normalized_payload_invalid",
      "validator_quarantined",
      "validator_conflict",
      "comparison_failure",
    ]);
  });

  it("binds exact full payload bytes and emits only a domain-separated metadata receipt", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    const result = compareSyntheticFilingFactValidatorReports(
      reports.declaredValidatorAEnvelope,
      reports.declaredValidatorBEnvelope,
    );
    expect(result.status).toBe("agreed");
    if (result.status !== "agreed") return;
    const first = decodeSyntheticFilingFactComparisonEnvelope(
      reports.declaredValidatorAEnvelope,
    );
    const normalizedPayloadBytes = new TextEncoder().encode(
      `${canonicalJson(first.normalizedPayload)}\n`,
    );
    const normalizedPayloadSha256 = sha256(normalizedPayloadBytes);
    const expectedAgreement = `sha256:${createHash("sha256")
      .update(AGREEMENT_DOMAIN)
      .update(
        new TextEncoder().encode(
          canonicalJson({
            normalizedPayloadSha256,
            validatorBindings: result.validatorBindings,
          }),
        ),
      )
      .digest("hex")}`;
    expect(result.agreementSha256).toBe(expectedAgreement);
    expect(result.validatorBindings).toEqual([
      {
        ...FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS[0],
        reportSha256: sha256(reports.declaredValidatorAEnvelope),
      },
      {
        ...FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS[1],
        reportSha256: sha256(reports.declaredValidatorBEnvelope),
      },
    ]);
    expect(Object.keys(result).sort()).toEqual([
      "agreementSha256",
      "amendmentDocumentSha256",
      "audit",
      "claim",
      "originalDocumentSha256",
      "schemaVersion",
      "status",
      "synthetic",
      "validatorBindings",
    ]);
    expect("factVersions" in result).toBe(false);
    expect("lineage" in result).toBe(false);
  });

  it("accepts only two exact Uint8Array arguments", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    const invoke = compareSyntheticFilingFactValidatorReports;
    for (const values of [
      [],
      [reports.declaredValidatorAEnvelope],
      [
        reports.declaredValidatorAEnvelope,
        reports.declaredValidatorBEnvelope,
        reports.declaredValidatorAEnvelope,
      ],
    ]) {
      const result: unknown = Reflect.apply(invoke, undefined, values);
      if (!isComparisonResult(result))
        throw new TypeError("comparison returned an invalid result");
      expectQuarantine(result, "report_invalid");
    }
  });

  it("rejects alternate byte containers, aliases, detached storage, and report bounds in either role", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    class DerivedBytes extends Uint8Array {}
    const detached = reports.declaredValidatorAEnvelope.slice();
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    const invalidInputs: readonly unknown[] = [
      null,
      "bytes",
      {},
      Buffer.from(reports.declaredValidatorAEnvelope),
      new DataView(reports.declaredValidatorAEnvelope.slice().buffer),
      new Uint16Array(2),
      new DerivedBytes(reports.declaredValidatorAEnvelope),
      new Proxy(reports.declaredValidatorAEnvelope.slice(), {}),
      new Uint8Array(new SharedArrayBuffer(16)),
      detached,
      new Uint8Array(),
      new Uint8Array(FILING_FACT_COMPARISON_LIMITS.reportBytes + 1),
    ];
    for (const position of ["a", "b"] as const) {
      for (const input of invalidInputs) {
        const result =
          position === "a"
            ? compareSyntheticFilingFactValidatorReports(
                input,
                reports.declaredValidatorBEnvelope,
              )
            : compareSyntheticFilingFactValidatorReports(
                reports.declaredValidatorAEnvelope,
                input,
              );
        expectQuarantine(result, "report_invalid", `${position} byte input`);
      }
    }
  });

  it("uses intrinsic backing-store metadata for both validator report byte roles", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    for (const position of ["a", "b"] as const) {
      const source = reportAt(reports, position);
      const shared = new Uint8Array(new SharedArrayBuffer(source.byteLength));
      Uint8Array.prototype.set.call(shared, source);
      shadowByteMetadata(shared, source.byteLength);
      expectQuarantine(
        compareAt(reports, position, shared),
        "report_invalid",
        `${position} shared metadata shadow`,
      );

      expectQuarantine(
        compareAt(reports, position, rePrototypedSharedCopy(source)),
        "report_invalid",
        `${position} re-prototyped shared backing`,
      );

      for (const carrier of rePrototypedNonUint8Copies(source)) {
        expectQuarantine(
          compareAt(reports, position, carrier),
          "report_invalid",
          `${position} re-prototyped non-Uint8 typed array`,
        );
      }

      const oversized = new Uint8Array(
        FILING_FACT_COMPARISON_LIMITS.reportBytes + 1,
      );
      Uint8Array.prototype.set.call(oversized, source);
      shadowByteMetadata(oversized, source.byteLength);
      expectQuarantine(
        compareAt(reports, position, oversized),
        "report_invalid",
        `${position} oversized metadata shadow`,
      );
    }
  });

  it("does not dispatch metadata, iterator, allocation, or instance hooks for either validator report byte role", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    for (const position of ["a", "b"] as const) {
      for (const hook of [
        "buffer",
        "byteLength",
        "toStringTag",
        "constructor",
        "species",
        "iterator",
        "set",
      ] as const) {
        let calls = 0;
        const carrier = withTypedArrayAllocationHook(
          reportAt(reports, position),
          hook,
          () => {
            calls += 1;
          },
        );
        expect(compareAt(reports, position, carrier).status, position).toBe(
          "agreed",
        );
        expect(calls, `${position}:${hook}`).toBe(0);
      }
    }
  });

  it("rejects proxies before a getPrototypeOf trap can run in either validator report byte role", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    for (const position of ["a", "b"] as const) {
      let trapCalls = 0;
      const carrier = new Proxy(reportAt(reports, position).slice(), {
        getPrototypeOf() {
          trapCalls += 1;
          throw new Error("Proxy prototype trap must not execute.");
        },
      });
      expectQuarantine(
        compareAt(reports, position, carrier),
        "report_invalid",
        `${position} proxy carrier`,
      );
      expect(trapCalls, position).toBe(0);
    }
  });

  it("rejects invalid UTF-8, BOM, line endings, trailing bytes, and noncanonical key order in either role", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    for (const position of ["a", "b"] as const) {
      const valid = reportAt(reports, position);
      const text = new TextDecoder().decode(valid);
      const decoded = decodeSyntheticFilingFactComparisonEnvelope(valid);
      const reversed = Object.fromEntries(Object.entries(decoded).reverse());
      const variants = [
        valid.slice(0, -1),
        concatBytes(valid, new Uint8Array([0x0a])),
        new TextEncoder().encode(`${text.slice(0, -1)}\r\n`),
        concatBytes(new Uint8Array([0xef, 0xbb, 0xbf]), valid),
        new Uint8Array([0xc3, 0x28]),
        new TextEncoder().encode(`${text.slice(0, -1)} \n`),
        new TextEncoder().encode(`${JSON.stringify(reversed)}\n`),
      ];
      for (const variant of variants) {
        expectQuarantine(
          compareAt(reports, position, variant),
          "report_invalid",
          `${position} canonical bytes`,
        );
      }
    }
  });

  it("rejects same-value and changed-value duplicate keys at wrapper and nested levels", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    for (const position of ["a", "b"] as const) {
      const valid = reportAt(reports, position);
      const text = new TextDecoder().decode(valid);
      const binding =
        FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS[
          position === "a" ? 0 : 1
        ];
      if (binding === undefined) throw new TypeError("binding missing");
      const duplicateSame = text.replace(
        '{"implementationSha256":',
        `{"implementationSha256":${JSON.stringify(binding.implementationSha256)},"implementationSha256":`,
      );
      const duplicateChanged = text.replace(
        '{"implementationSha256":',
        `{"implementationSha256":"sha256:${"0".repeat(64)}","implementationSha256":`,
      );
      const nestedSame = text.replace(
        '"dimensions":{},',
        '"dimensions":{},"dimensions":{},',
      );
      const nestedChanged = text.replace(
        '"dimensions":{},',
        '"dimensions":{"segment":"x"},"dimensions":{},',
      );
      for (const duplicate of [
        duplicateSame,
        duplicateChanged,
        nestedSame,
        nestedChanged,
      ]) {
        expectQuarantine(
          compareAt(reports, position, new TextEncoder().encode(duplicate)),
          "report_invalid",
          `${position} duplicate key`,
        );
      }
    }
  });

  it("enforces depth, node, and aggregate-string limits before schema validation", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    for (const position of ["a", "b"] as const) {
      const deep = mutateReport(reportAt(reports, position), (envelope) => {
        let nested: unknown = "leaf";
        for (
          let index = 0;
          index <= FILING_FACT_COMPARISON_LIMITS.reportDepth;
          index += 1
        ) {
          nested = { nested };
        }
        envelope.normalizedPayload = nested;
      });
      const wide = mutateReport(reportAt(reports, position), (envelope) => {
        envelope.normalizedPayload = Array.from(
          { length: FILING_FACT_COMPARISON_LIMITS.reportNodes + 1 },
          () => null,
        );
      });
      const long = mutateReport(reportAt(reports, position), (envelope) => {
        envelope.validatorId = "x".repeat(
          FILING_FACT_COMPARISON_LIMITS.aggregateStringCodePoints + 1,
        );
      });
      for (const malicious of [deep, wide, long]) {
        expectQuarantine(
          compareAt(reports, position, malicious),
          "report_invalid",
          `${position} structural limit`,
        );
      }
    }
  });

  it("requires every exact wrapper field and rejects extras or pollution keys in both positions", () => {
    for (const position of ["a", "b"] as const) {
      for (const key of WRAPPER_KEYS) {
        const result = compareWithMutation(position, (envelope) => {
          delete envelope[key];
        });
        expectQuarantine(result, "report_invalid", `${position}.${key}`);
      }
      for (const key of ["extra", "constructor", "prototype", "__proto__"]) {
        const result = compareWithMutation(position, (envelope) => {
          Object.defineProperty(envelope, key, {
            configurable: true,
            enumerable: true,
            value: "forbidden",
            writable: true,
          });
        });
        expectQuarantine(result, "report_invalid", `${position}.${key}`);
      }
    }
  });

  it("rejects every forged fixed wrapper binding, swapped roles, and duplicated reports", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    for (const position of ["a", "b"] as const) {
      for (const [field, value] of [
        ["implementationSha256", `sha256:${"0".repeat(64)}`],
        [
          "role",
          position === "a" ? "declared-validator-b" : "declared-validator-a",
        ],
        ["schemaVersion", "2.0.0"],
        ["synthetic", false],
        ["validatorId", "synthetic-filing-fact-validator-forged"],
        ["validatorVersion", "2.0.0"],
      ] as const) {
        const result = compareWithMutation(position, (envelope) => {
          envelope[field] = value;
        });
        expectQuarantine(
          result,
          "validator_binding_invalid",
          `${position}.${field}`,
        );
      }
    }
    expectQuarantine(
      compareSyntheticFilingFactValidatorReports(
        reports.declaredValidatorBEnvelope,
        reports.declaredValidatorAEnvelope,
      ),
      "validator_binding_invalid",
    );
    expectQuarantine(
      compareSyntheticFilingFactValidatorReports(
        reports.declaredValidatorAEnvelope,
        reports.declaredValidatorAEnvelope,
      ),
      "validator_binding_invalid",
    );
  });

  it("requires every normalized payload field independently in both validator implementations", () => {
    for (const position of ["a", "b"] as const) {
      for (const key of PAYLOAD_KEYS) {
        const result = compareWithMutation(position, (envelope) => {
          delete payloadOf(envelope)[key];
        });
        expectQuarantine(
          result,
          "normalized_payload_invalid",
          `${position}.normalizedPayload.${key}`,
        );
      }
      const extra = compareWithMutation(position, (envelope) => {
        payloadOf(envelope).extra = "forbidden";
      });
      expectQuarantine(extra, "normalized_payload_invalid");
    }
  });

  it("requires every source-preimage field in both source documents and validator positions", () => {
    for (const position of ["a", "b"] as const) {
      for (const sourceIndex of [0, 1]) {
        for (const key of SOURCE_DOCUMENT_KEYS) {
          const result = compareWithMutation(position, (envelope) => {
            delete sourceDocumentsOf(payloadOf(envelope), sourceIndex)[key];
          });
          expectQuarantine(
            result,
            "normalized_payload_invalid",
            `${position}.sourceDocuments[${sourceIndex}].${key}`,
          );
        }
      }
    }
  });

  it("requires every normalized fact field for original and amendment versions in both validators", () => {
    for (const position of ["a", "b"] as const) {
      for (const factIndex of [0, 10]) {
        for (const key of FACT_VERSION_KEYS) {
          const result = compareWithMutation(position, (envelope) => {
            delete factVersionsOf(payloadOf(envelope), factIndex)[key];
          });
          expectQuarantine(
            result,
            "normalized_payload_invalid",
            `${position}.factVersions[${factIndex}].${key}`,
          );
        }
      }
    }
  });

  it("requires every lineage field and rejects missing, extra, orphaned, forked, cyclic, and reordered edges", () => {
    for (const position of ["a", "b"] as const) {
      for (const key of LINEAGE_KEYS) {
        const result = compareWithMutation(position, (envelope) => {
          delete lineageOf(payloadOf(envelope), 0)[key];
        });
        expectQuarantine(
          result,
          "normalized_payload_invalid",
          `${position}.lineage[0].${key}`,
        );
      }
      const mutations: Array<(payload: MutableRecord) => void> = [
        (payload) => {
          asArray(payload.lineage).pop();
        },
        (payload) => {
          lineageOf(payload, 0).extra = "forbidden";
        },
        (payload) => {
          lineageOf(payload, 0).successorFactId =
            `fact:sha256:${"0".repeat(64)}`;
        },
        (payload) => {
          lineageOf(payload, 1).successorFactId = lineageOf(
            payload,
            0,
          ).successorFactId;
        },
        (payload) => {
          lineageOf(payload, 0).successorFactId = lineageOf(
            payload,
            0,
          ).predecessorFactId;
        },
        (payload) => {
          asArray(payload.lineage).reverse();
        },
      ];
      for (const mutate of mutations) {
        const result = compareWithMutation(position, (envelope) => {
          mutate(payloadOf(envelope));
        });
        expectQuarantine(result, "normalized_payload_invalid");
      }
    }
  });

  it("recomputes source-bound fact IDs and rejects stale, forged, duplicate, or disconnected pointers", () => {
    for (const position of ["a", "b"] as const) {
      const cases: Array<(payload: MutableRecord) => void> = [
        (payload) => {
          factVersionsOf(payload, 10).value = "250000001";
        },
        (payload) => {
          factVersionsOf(payload, 10).factId = `fact:sha256:${"0".repeat(64)}`;
        },
        (payload) => {
          factVersionsOf(payload, 10).factId = factVersionsOf(
            payload,
            11,
          ).factId;
        },
        (payload) => {
          factVersionsOf(payload, 0).successorFactId =
            `fact:sha256:${"0".repeat(64)}`;
        },
        (payload) => {
          factVersionsOf(payload, 10).predecessorFactId =
            `fact:sha256:${"0".repeat(64)}`;
        },
      ];
      for (const mutate of cases) {
        const result = compareWithMutation(position, (envelope) => {
          mutate(payloadOf(envelope));
        });
        expectQuarantine(result, "normalized_payload_invalid");
      }
    }
  });

  it("rejects decimal, unit, period, dimension, time, hash, taxonomy, order, and type coercion tricks without repair", () => {
    for (const position of ["a", "b"] as const) {
      const cases: Array<(payload: MutableRecord) => void> = [
        (payload) => {
          factVersionsOf(payload, 10).value = "250000000.0";
        },
        (payload) => {
          factVersionsOf(payload, 10).value = "2.5e8";
        },
        (payload) => {
          factVersionsOf(payload, 10).value = "-0";
        },
        (payload) => {
          factVersionsOf(payload, 10).value = 250000000;
        },
        (payload) => {
          factVersionsOf(payload, 10).unit = "shares";
        },
        (payload) => {
          factVersionsOf(payload, 10).dimensions = { segment: "x" };
        },
        (payload) => {
          factVersionsOf(payload, 10).periodStart = "2025-01-01";
        },
        (payload) => {
          factVersionsOf(payload, 13).periodStart = null;
        },
        (payload) => {
          sourceDocumentsOf(payload, 1).availableAt =
            "2026-03-15T15:00:01.000-05:00";
        },
        (payload) => {
          sourceDocumentsOf(payload, 1).documentSha256 =
            `sha256:${"A".repeat(64)}`;
        },
        (payload) => {
          sourceDocumentsOf(payload, 1).taxonomyVersion = "1.0.1";
        },
        (payload) => {
          asArray(payload.factVersions).reverse();
        },
      ];
      for (const mutate of cases) {
        const result = compareWithMutation(position, (envelope) => {
          mutate(payloadOf(envelope));
        });
        expectQuarantine(result, "normalized_payload_invalid");
      }
    }
  });

  it("compares byte-exact complete valid payloads rather than declared digests or a subset", () => {
    for (const position of ["a", "b"] as const) {
      const valueConflict = compareWithMutation(position, (envelope) => {
        mutateFactValueAndRepair(payloadOf(envelope), 10, "250000001");
      });
      expectQuarantine(valueConflict, "validator_conflict");

      const sourceConflict = compareWithMutation(position, (envelope) => {
        rebaseAmendmentDocumentSha(
          payloadOf(envelope),
          `sha256:${position === "a" ? "1" : "2"}${"0".repeat(63)}`,
        );
      });
      expectQuarantine(sourceConflict, "validator_conflict");
    }
  });

  it("does not prefer either validator, merge fields, or expose a valid side on conflict", () => {
    const canary = "731984.27";
    for (const position of ["a", "b"] as const) {
      const result = compareWithMutation(position, (envelope) => {
        mutateFactValueAndRepair(payloadOf(envelope), 10, canary);
      });
      expectQuarantine(result, "validator_conflict");
      expect(JSON.stringify(result)).not.toContain(canary);
      expect(JSON.stringify(result)).not.toMatch(
        /SYN-|entity\.synthetic|instrument\.synthetic|reportSha256|agreementSha256/u,
      );
    }
  });

  it("validates both reports before agreement even when both contain the same malformed payload", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    const first = mutateReport(
      reports.declaredValidatorAEnvelope,
      (envelope) => {
        delete factVersionsOf(payloadOf(envelope), 0).factId;
      },
    );
    const second = mutateReport(
      reports.declaredValidatorBEnvelope,
      (envelope) => {
        delete factVersionsOf(payloadOf(envelope), 0).factId;
      },
    );
    expectQuarantine(
      compareSyntheticFilingFactValidatorReports(first, second),
      "normalized_payload_invalid",
    );
  });

  it("aggregates upstream quarantine without adopting a payload from either side", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    const firstQuarantine =
      buildSyntheticFilingFactComparisonQuarantinedEnvelope(
        "declared-validator-a",
      );
    const secondQuarantine =
      buildSyntheticFilingFactComparisonQuarantinedEnvelope(
        "declared-validator-b",
      );
    for (const [first, second] of [
      [firstQuarantine, reports.declaredValidatorBEnvelope],
      [reports.declaredValidatorAEnvelope, secondQuarantine],
      [firstQuarantine, secondQuarantine],
    ] as const) {
      expectQuarantine(
        compareSyntheticFilingFactValidatorReports(first, second),
        "validator_quarantined",
      );
    }
    for (const position of ["a", "b"] as const) {
      const invalid = compareWithMutation(position, (envelope) => {
        envelope.status = "quarantined";
      });
      expectQuarantine(invalid, "report_invalid");
    }
  });

  it("uses side-neutral invalid-code precedence without leaking which report failed", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    const invalidReport = new TextEncoder().encode("{}\n");
    const invalidBinding = mutateReport(
      reports.declaredValidatorBEnvelope,
      (envelope) => {
        envelope.validatorId = "forged";
      },
    );
    const invalidPayload = mutateReport(
      reports.declaredValidatorBEnvelope,
      (envelope) => {
        delete factVersionsOf(payloadOf(envelope), 0).factId;
      },
    );
    expectQuarantine(
      compareSyntheticFilingFactValidatorReports(invalidReport, invalidBinding),
      "report_invalid",
    );
    expectQuarantine(
      compareSyntheticFilingFactValidatorReports(
        mutateReport(reports.declaredValidatorAEnvelope, (envelope) => {
          envelope.validatorId = "forged";
        }),
        invalidPayload,
      ),
      "validator_binding_invalid",
    );
  });

  it("takes owned snapshots, replays deterministically, and returns fresh deeply frozen graphs", () => {
    const reports = buildSyntheticFilingFactComparisonEnvelopes();
    const expectedFirstSha = sha256(reports.declaredValidatorAEnvelope);
    const first = compareSyntheticFilingFactValidatorReports(
      reports.declaredValidatorAEnvelope,
      reports.declaredValidatorBEnvelope,
    );
    const second = compareSyntheticFilingFactValidatorReports(
      reports.declaredValidatorAEnvelope,
      reports.declaredValidatorBEnvelope,
    );
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.audit)).toBe(true);
    if (first.status !== "agreed" || second.status !== "agreed") return;
    expect(first.validatorBindings).not.toBe(second.validatorBindings);
    expect(Object.isFrozen(first.validatorBindings)).toBe(true);
    expect(first.validatorBindings.every(Object.isFrozen)).toBe(true);
    expect(first.validatorBindings[0].reportSha256).toBe(expectedFirstSha);
    const snapshot = JSON.stringify(first);
    reports.declaredValidatorAEnvelope.fill(0);
    reports.declaredValidatorBEnvelope.fill(0);
    expect(JSON.stringify(first)).toBe(snapshot);
  });

  it("returns fresh deeply frozen value-free quarantines with no input correlators", () => {
    const first = compareSyntheticFilingFactValidatorReports(null, null);
    const second = compareSyntheticFilingFactValidatorReports(null, null);
    expectQuarantine(first, "report_invalid");
    expectQuarantine(second, "report_invalid");
    expect(first).not.toBe(second);
    if (first.status !== "quarantined" || second.status !== "quarantined")
      return;
    expect(first.audit).not.toBe(second.audit);
    expect(first.factVersions).not.toBe(second.factVersions);
    expect(first.lineage).not.toBe(second.lineage);
    expect(first.validatorBindings).not.toBe(second.validatorBindings);
    expect(JSON.stringify(first)).not.toMatch(
      /sha256:|SYN-|entity\.synthetic|instrument\.synthetic|validator-a|validator-b/u,
    );
  });

  it("keeps all public registries and nested binding objects runtime immutable", () => {
    for (const value of [
      FILING_FACT_COMPARISON_FACT_KEYS,
      FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS,
      FILING_FACT_COMPARISON_CHECKS,
      FILING_FACT_COMPARISON_NOT_PROVEN,
      FILING_FACT_COMPARISON_LIMITS,
      FILING_FACT_COMPARISON_QUARANTINE_CODES,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(
      FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS.every(Object.isFrozen),
    ).toBe(true);
    expect(FILING_FACT_COMPARISON_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_FACT_COMPARISON_CLAIM).toBe(
      "bounded_synthetic_two_declared_validator_exact_payload_agreement_conflict_quarantine_and_no_silent_repair",
    );
  });
});

function compareWithMutation(
  position: ReportPosition,
  mutate: (envelope: MutableRecord) => void,
): FilingFactComparisonResult {
  const reports = buildSyntheticFilingFactComparisonEnvelopes();
  return compareAt(
    reports,
    position,
    mutateReport(reportAt(reports, position), mutate),
  );
}

function isComparisonResult(
  value: unknown,
): value is FilingFactComparisonResult {
  if (typeof value !== "object" || value === null) return false;
  const status = (value as { readonly status?: unknown }).status;
  return status === "agreed" || status === "quarantined";
}

function mutateReport(
  bytes: Uint8Array,
  mutate: (envelope: MutableRecord) => void,
): Uint8Array {
  const envelope = decodeSyntheticFilingFactComparisonEnvelope(bytes);
  mutate(envelope);
  return canonicalSyntheticFilingFactComparisonEnvelope(envelope);
}

function reportAt(
  reports: ReturnType<typeof buildSyntheticFilingFactComparisonEnvelopes>,
  position: ReportPosition,
): Uint8Array {
  return position === "a"
    ? reports.declaredValidatorAEnvelope
    : reports.declaredValidatorBEnvelope;
}

function compareAt(
  reports: ReturnType<typeof buildSyntheticFilingFactComparisonEnvelopes>,
  position: ReportPosition,
  replacement: Uint8Array,
): FilingFactComparisonResult {
  return position === "a"
    ? compareSyntheticFilingFactValidatorReports(
        replacement,
        reports.declaredValidatorBEnvelope,
      )
    : compareSyntheticFilingFactValidatorReports(
        reports.declaredValidatorAEnvelope,
        replacement,
      );
}

function shadowByteMetadata(bytes: Uint8Array, byteLength: number): void {
  Object.defineProperties(bytes, {
    buffer: { value: new ArrayBuffer(byteLength) },
    byteLength: { value: byteLength },
  });
}

function rePrototypedSharedCopy(source: Uint8Array): Uint8Array {
  const backing = new SharedArrayBuffer(source.byteLength);
  const bytes = new Uint8Array(backing);
  Uint8Array.prototype.set.call(bytes, source);
  Object.setPrototypeOf(backing, ArrayBuffer.prototype);
  return bytes;
}

function rePrototypedNonUint8Copies(source: Uint8Array): readonly Uint8Array[] {
  const paddedByteLength =
    Math.ceil(source.byteLength / Uint16Array.BYTES_PER_ELEMENT) *
    Uint16Array.BYTES_PER_ELEMENT;
  const views = [
    new Int8Array(source.byteLength),
    new Uint8ClampedArray(source.byteLength),
    new Uint16Array(paddedByteLength / Uint16Array.BYTES_PER_ELEMENT),
  ];
  return views.map((view) => {
    Uint8Array.prototype.set.call(new Uint8Array(view.buffer), source);
    Object.setPrototypeOf(view, Uint8Array.prototype);
    return view as unknown as Uint8Array;
  });
}

function withTypedArrayAllocationHook(
  source: Uint8Array,
  hook:
    | "buffer"
    | "byteLength"
    | "toStringTag"
    | "constructor"
    | "species"
    | "iterator"
    | "set",
  onAccess: () => void,
): Uint8Array {
  const bytes = new Uint8Array(source);
  const failOnAccess = (): never => {
    onAccess();
    throw new Error("Caller-controlled allocation hook was accessed.");
  };
  if (hook === "species") {
    const constructor = {};
    Object.defineProperty(constructor, Symbol.species, { get: failOnAccess });
    Object.defineProperty(bytes, "constructor", { value: constructor });
  } else {
    Object.defineProperty(
      bytes,
      hook === "iterator"
        ? Symbol.iterator
        : hook === "toStringTag"
          ? Symbol.toStringTag
          : hook,
      { get: failOnAccess },
    );
  }
  return bytes;
}

function payloadOf(envelope: MutableRecord): MutableRecord {
  return asRecord(envelope.normalizedPayload);
}

function sourceDocumentsOf(
  payload: MutableRecord,
  index: number,
): MutableRecord {
  return asRecord(asArray(payload.sourceDocuments)[index]);
}

function factVersionsOf(payload: MutableRecord, index: number): MutableRecord {
  return asRecord(asArray(payload.factVersions)[index]);
}

function lineageOf(payload: MutableRecord, index: number): MutableRecord {
  return asRecord(asArray(payload.lineage)[index]);
}

function asRecord(value: unknown): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError("expected mutable record");
  return value as MutableRecord;
}

function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError("expected mutable array");
  return value;
}

function requiredString(record: MutableRecord, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new TypeError(`${key} must be a string`);
  return value;
}

function mutateFactValueAndRepair(
  payload: MutableRecord,
  index: number,
  value: string,
): void {
  factVersionsOf(payload, index).value = value;
  recomputeAllFactIdsAndPointers(payload);
}

function rebaseAmendmentDocumentSha(
  payload: MutableRecord,
  documentSha256: string,
): void {
  payload.amendmentDocumentSha256 = documentSha256;
  sourceDocumentsOf(payload, 1).documentSha256 = documentSha256;
  for (let index = 10; index < 20; index += 1)
    factVersionsOf(payload, index).sourceDocumentSha256 = documentSha256;
  recomputeAllFactIdsAndPointers(payload);
}

function recomputeAllFactIdsAndPointers(payload: MutableRecord): void {
  const ids = Array.from({ length: 20 }, (_, index) =>
    recomputeFactId(payload, index),
  );
  for (let index = 0; index < 20; index += 1)
    factVersionsOf(payload, index).factId = ids[index];
  for (let index = 0; index < 10; index += 1) {
    const predecessorId = ids[index];
    const successorId = ids[index + 10];
    if (predecessorId === undefined || successorId === undefined)
      throw new TypeError("fact identity missing");
    factVersionsOf(payload, index).successorFactId = successorId;
    factVersionsOf(payload, index + 10).predecessorFactId = predecessorId;
    lineageOf(payload, index).predecessorFactId = predecessorId;
    lineageOf(payload, index).successorFactId = successorId;
  }
}

function recomputeFactId(
  payload: MutableRecord,
  factIndex: number,
): `fact:sha256:${string}` {
  const document = sourceDocumentsOf(payload, factIndex < 10 ? 0 : 1);
  const fact = factVersionsOf(payload, factIndex);
  const preimage = new TextEncoder().encode(
    canonicalJson({
      accession: document.accession,
      acceptedAt: document.acceptedAt,
      amendmentOf: document.amendmentOf,
      availableAt: document.availableAt,
      contentSha256: document.contentSha256,
      documentSha256: document.documentSha256,
      entityId: document.entityId,
      form: document.form,
      instrumentId: document.instrumentId,
      key: fact.key,
      periodEnd: fact.periodEnd,
      periodStart: fact.periodStart,
      parserVersion: fact.parserVersion,
      sourceConcept: fact.sourceConcept,
      taxonomyFamily: fact.taxonomyFamily,
      taxonomyVersion: fact.taxonomyVersion,
      unit: fact.unit,
      value: requiredString(fact, "value"),
    }),
  );
  return `fact:sha256:${createHash("sha256")
    .update(FACT_ID_DOMAIN)
    .update(preimage)
    .digest("hex")}`;
}

function expectQuarantine(
  result: FilingFactComparisonResult,
  code: FilingFactComparisonQuarantineCode,
  message?: string,
): void {
  expect(result.status, message).toBe("quarantined");
  if (result.status !== "quarantined") return;
  expect(result, message).toEqual({
    audit: {
      factVersionCount: 0,
      lineageCount: 0,
      outcome: "quarantined",
      validatorCount: 0,
    },
    claim: FILING_FACT_COMPARISON_CLAIM,
    code,
    factVersions: [],
    lineage: [],
    schemaVersion: FILING_FACT_COMPARISON_SCHEMA_VERSION,
    status: "quarantined",
    synthetic: true,
    validatorBindings: [],
  });
  expect(Object.isFrozen(result), message).toBe(true);
  expect(Object.isFrozen(result.audit), message).toBe(true);
  expect(Object.isFrozen(result.factVersions), message).toBe(true);
  expect(Object.isFrozen(result.lineage), message).toBe(true);
  expect(Object.isFrozen(result.validatorBindings), message).toBe(true);
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function concatBytes(first: Uint8Array, second: Uint8Array): Uint8Array {
  const result = new Uint8Array(first.byteLength + second.byteLength);
  result.set(first, 0);
  result.set(second, first.byteLength);
  return result;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null)
    throw new TypeError("canonical test value is invalid");
  return `{${Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}
