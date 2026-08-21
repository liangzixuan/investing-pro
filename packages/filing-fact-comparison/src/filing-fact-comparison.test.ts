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
} from "./filing-fact-comparison";
import {
  buildSyntheticFilingFactComparisonEnvelopes,
  buildSyntheticFilingFactComparisonQuarantinedEnvelope,
  canonicalSyntheticFilingFactComparisonEnvelope,
  decodeSyntheticFilingFactComparisonEnvelope,
} from "./test-filing-fact-comparison-builder";

describe("synthetic filing fact comparison", () => {
  it("freezes the exact claim, registries, limits, checks, and nonclaims", () => {
    expect(FILING_FACT_COMPARISON_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_FACT_COMPARISON_CLAIM).toBe(
      "bounded_synthetic_two_declared_validator_exact_payload_agreement_conflict_quarantine_and_no_silent_repair",
    );
    expect(FILING_FACT_COMPARISON_FACT_KEYS).toEqual([
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
    expect(FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS).toEqual([
      {
        implementationSha256:
          "sha256:144c62df219b6f6cddfa49783fd9f9e169187d39d3fc848c8bb06147df76fa44",
        role: "declared-validator-a",
        validatorId: "synthetic-filing-fact-validator-a",
        validatorVersion: "1.0.0",
      },
      {
        implementationSha256:
          "sha256:8ae5aae1ecc92b3b71e764deb85d6758e38b1b11eee39f6aed07599bb30ae365",
        role: "declared-validator-b",
        validatorId: "synthetic-filing-fact-validator-b",
        validatorVersion: "1.0.0",
      },
    ]);
    expect(FILING_FACT_COMPARISON_LIMITS).toEqual({
      aggregateStringCodePoints: 131_072,
      decimalIntegerDigits: 26,
      decimalPrecision: 38,
      decimalScale: 12,
      factsPerReport: 10,
      factVersionsPerReport: 20,
      lineageEdgesPerReport: 10,
      reportBytes: 262_144,
      reportDepth: 12,
      reportNodes: 2_048,
      reports: 2,
    });
    expect(FILING_FACT_COMPARISON_CHECKS).toHaveLength(16);
    expect(FILING_FACT_COMPARISON_NOT_PROVEN).toHaveLength(16);
    expect(FILING_FACT_COMPARISON_QUARANTINE_CODES).toEqual([
      "report_invalid",
      "validator_binding_invalid",
      "normalized_payload_invalid",
      "validator_quarantined",
      "validator_conflict",
      "comparison_failure",
    ]);
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
  });

  it("returns one immutable metadata-only agreement receipt", () => {
    const envelopes = buildSyntheticFilingFactComparisonEnvelopes();
    const result = compareSyntheticFilingFactValidatorReports(
      envelopes.declaredValidatorAEnvelope,
      envelopes.declaredValidatorBEnvelope,
    );
    expect(result).toEqual({
      agreementSha256:
        "sha256:9c1a37a6e9761ed3e41c36b2780035a4275e92cd9bdf7e5300b2621dcbcff7b9",
      amendmentDocumentSha256:
        "sha256:94777ec43403f10bd8ebba0d405eba88d3c93844e76a616ef632b1a24065e71a",
      audit: {
        factVersionCount: 20,
        lineageCount: 10,
        outcome: "agreed",
        validatorCount: 2,
      },
      claim: FILING_FACT_COMPARISON_CLAIM,
      originalDocumentSha256:
        "sha256:500f038edfb287393c82a17ba1abba44eb36499a1b5bcf962fbd25298243b85c",
      schemaVersion: FILING_FACT_COMPARISON_SCHEMA_VERSION,
      status: "agreed",
      synthetic: true,
      validatorBindings: [
        {
          ...FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS[0],
          reportSha256:
            "sha256:f274534089a5df62e321366b469b39b7e2754e5e1e0b7b638dfda5fbc6eb7c04",
        },
        {
          ...FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS[1],
          reportSha256:
            "sha256:9e807a60a10a6d6c1d74c9090dc3a3b9da29d887c185b1c1288e701834f98f96",
        },
      ],
    });
    expect("factVersions" in result).toBe(false);
    expect("lineage" in result).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.audit)).toBe(true);
    if (result.status === "agreed") {
      expect(Object.isFrozen(result.validatorBindings)).toBe(true);
      expect(result.validatorBindings.every(Object.isFrozen)).toBe(true);
    }
  });

  it("binds distinct wrappers around the same exact normalized payload", () => {
    const envelopes = buildSyntheticFilingFactComparisonEnvelopes();
    expect(envelopes.declaredValidatorAEnvelope).not.toEqual(
      envelopes.declaredValidatorBEnvelope,
    );
    const first = decodeSyntheticFilingFactComparisonEnvelope(
      envelopes.declaredValidatorAEnvelope,
    );
    const second = decodeSyntheticFilingFactComparisonEnvelope(
      envelopes.declaredValidatorBEnvelope,
    );
    expect(first.role).toBe("declared-validator-a");
    expect(second.role).toBe("declared-validator-b");
    expect(first.normalizedPayload).toEqual(second.normalizedPayload);
    const payload = first.normalizedPayload as Record<string, unknown>;
    expect(payload.factVersions).toHaveLength(20);
    expect(payload.lineage).toHaveLength(10);
    expect(payload.sourceDocuments).toHaveLength(2);
  });

  it("is deterministic, snapshots both inputs, and returns fresh graphs", () => {
    const firstEnvelopes = buildSyntheticFilingFactComparisonEnvelopes();
    const secondEnvelopes = buildSyntheticFilingFactComparisonEnvelopes();
    const first = compareSyntheticFilingFactValidatorReports(
      firstEnvelopes.declaredValidatorAEnvelope,
      firstEnvelopes.declaredValidatorBEnvelope,
    );
    const second = compareSyntheticFilingFactValidatorReports(
      secondEnvelopes.declaredValidatorAEnvelope,
      secondEnvelopes.declaredValidatorBEnvelope,
    );
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    firstEnvelopes.declaredValidatorAEnvelope.fill(0);
    firstEnvelopes.declaredValidatorBEnvelope.fill(0);
    expect(first).toEqual(second);
  });

  it("rejects swapped, duplicated, or forged declared validator bindings", () => {
    const envelopes = buildSyntheticFilingFactComparisonEnvelopes();
    for (const [first, second] of [
      [
        envelopes.declaredValidatorBEnvelope,
        envelopes.declaredValidatorAEnvelope,
      ],
      [
        envelopes.declaredValidatorAEnvelope,
        envelopes.declaredValidatorAEnvelope,
      ],
    ] as const) {
      const result = compareSyntheticFilingFactValidatorReports(first, second);
      expect(result.status).toBe("quarantined");
      if (result.status === "quarantined")
        expect(result.code).toBe("validator_binding_invalid");
    }
    const forged = decodeSyntheticFilingFactComparisonEnvelope(
      envelopes.declaredValidatorAEnvelope,
    );
    forged.implementationSha256 = `sha256:${"0".repeat(64)}`;
    const result = compareSyntheticFilingFactValidatorReports(
      canonicalSyntheticFilingFactComparisonEnvelope(forged),
      envelopes.declaredValidatorBEnvelope,
    );
    expect(result.status).toBe("quarantined");
    if (result.status === "quarantined")
      expect(result.code).toBe("validator_binding_invalid");
  });

  it("rejects an invalid normalized payload without repairing it", () => {
    const envelopes = buildSyntheticFilingFactComparisonEnvelopes();
    const second = decodeSyntheticFilingFactComparisonEnvelope(
      envelopes.declaredValidatorBEnvelope,
    );
    const payload = second.normalizedPayload as Record<string, unknown>;
    const facts = payload.factVersions as Array<Record<string, unknown>>;
    if (facts[19] !== undefined) facts[19].value = "116400001";
    const result = compareSyntheticFilingFactValidatorReports(
      envelopes.declaredValidatorAEnvelope,
      canonicalSyntheticFilingFactComparisonEnvelope(second),
    );
    expect(result.status).toBe("quarantined");
    if (result.status === "quarantined") {
      expect(result.code).toBe("normalized_payload_invalid");
      expect(result.factVersions).toEqual([]);
      expect(result.lineage).toEqual([]);
      expect(result.validatorBindings).toEqual([]);
    }
    expect(JSON.stringify(result)).not.toContain("116400001");
  });

  it("fails closed when either declared validator reports quarantine", () => {
    const envelopes = buildSyntheticFilingFactComparisonEnvelopes();
    const cases = [
      [
        buildSyntheticFilingFactComparisonQuarantinedEnvelope(
          "declared-validator-a",
        ),
        envelopes.declaredValidatorBEnvelope,
      ],
      [
        envelopes.declaredValidatorAEnvelope,
        buildSyntheticFilingFactComparisonQuarantinedEnvelope(
          "declared-validator-b",
        ),
      ],
    ] as const;
    for (const [first, second] of cases) {
      const result = compareSyntheticFilingFactValidatorReports(first, second);
      expect(result.status).toBe("quarantined");
      if (result.status === "quarantined")
        expect(result.code).toBe("validator_quarantined");
    }
  });

  it("rejects missing, duplicate, noncanonical, and trailing wrapper bytes", () => {
    const envelopes = buildSyntheticFilingFactComparisonEnvelopes();
    const missing = decodeSyntheticFilingFactComparisonEnvelope(
      envelopes.declaredValidatorAEnvelope,
    );
    delete missing.validatorVersion;
    const text = new TextDecoder().decode(envelopes.declaredValidatorAEnvelope);
    const duplicate = new TextEncoder().encode(
      text.replace(
        '{"implementationSha256":',
        `{"implementationSha256":"${FILING_FACT_COMPARISON_DECLARED_VALIDATOR_BINDINGS[0]?.implementationSha256 ?? ""}","implementationSha256":`,
      ),
    );
    const trailing = new Uint8Array(
      envelopes.declaredValidatorAEnvelope.byteLength + 1,
    );
    trailing.set(envelopes.declaredValidatorAEnvelope);
    trailing[trailing.length - 1] = 0x0a;
    for (const malformed of [
      canonicalSyntheticFilingFactComparisonEnvelope(missing),
      duplicate,
      new TextEncoder().encode("{}\r\n"),
      trailing,
    ]) {
      const result = compareSyntheticFilingFactValidatorReports(
        malformed,
        envelopes.declaredValidatorBEnvelope,
      );
      expect(result.status).toBe("quarantined");
      if (result.status === "quarantined")
        expect(result.code).toBe("report_invalid");
    }
  });

  it("accepts exactly two runtime arguments and exact byte inputs", () => {
    const envelopes = buildSyntheticFilingFactComparisonEnvelopes();
    const extra = compareSyntheticFilingFactValidatorReports(
      envelopes.declaredValidatorAEnvelope,
      envelopes.declaredValidatorBEnvelope,
      // @ts-expect-error Runtime arity is part of the closed comparison API.
      envelopes.declaredValidatorAEnvelope,
    );
    expect(extra.status).toBe("quarantined");
    if (extra.status === "quarantined")
      expect(extra.code).toBe("report_invalid");
    const objectInput = compareSyntheticFilingFactValidatorReports(
      decodeSyntheticFilingFactComparisonEnvelope(
        envelopes.declaredValidatorAEnvelope,
      ),
      envelopes.declaredValidatorBEnvelope,
    );
    expect(objectInput.status).toBe("quarantined");
    if (objectInput.status === "quarantined")
      expect(objectInput.code).toBe("report_invalid");
  });

  it("returns fresh, deeply immutable, aggregate value-free quarantines", () => {
    const first = compareSyntheticFilingFactValidatorReports(null, null);
    const second = compareSyntheticFilingFactValidatorReports(null, null);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.status).toBe("quarantined");
    if (first.status !== "quarantined") throw new Error("expected quarantine");
    expect(first).toEqual({
      audit: {
        factVersionCount: 0,
        lineageCount: 0,
        outcome: "quarantined",
        validatorCount: 0,
      },
      claim: FILING_FACT_COMPARISON_CLAIM,
      code: "report_invalid",
      factVersions: [],
      lineage: [],
      schemaVersion: FILING_FACT_COMPARISON_SCHEMA_VERSION,
      status: "quarantined",
      synthetic: true,
      validatorBindings: [],
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.audit)).toBe(true);
    expect(Object.isFrozen(first.factVersions)).toBe(true);
    expect(Object.isFrozen(first.lineage)).toBe(true);
    expect(Object.isFrozen(first.validatorBindings)).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(
      /SYN-|entity\.synthetic|instrument\.synthetic|116400000/u,
    );
  });
});
