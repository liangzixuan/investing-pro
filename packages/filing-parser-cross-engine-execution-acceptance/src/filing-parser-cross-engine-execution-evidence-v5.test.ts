import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CUSTODY_PROFILE } from "@research-cockpit/filing-parser-custody-quality-composition";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_NOT_PROVEN,
  createFilingParserCrossEngineExecutionEvidenceV5,
  filingParserCrossEngineExecutionEvidenceV5Sha256,
  parseCanonicalFilingParserCrossEngineExecutionEvidenceV5,
  serializeCanonicalFilingParserCrossEngineExecutionEvidenceV5,
  type FilingParserCrossEngineExecutionEvidenceV5,
  type FilingParserCrossEngineExecutionEvidenceV5Invocation,
} from "./filing-parser-cross-engine-execution-evidence-v5";
import { buildFilingParserCrossEngineExecutionEvidenceV5Input } from "./test-filing-parser-cross-engine-execution-evidence-builder";

describe("Cycle 2o v5 custody-quality evidence", () => {
  it("round-trips one canonical deeply frozen version 5 record", () => {
    const evidence = createFilingParserCrossEngineExecutionEvidenceV5(
      buildFilingParserCrossEngineExecutionEvidenceV5Input(),
    );
    const canonical =
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV5(evidence);
    const parsed = parseCanonicalFilingParserCrossEngineExecutionEvidenceV5(
      new TextEncoder().encode(canonical),
    );
    expect(parsed).toEqual(evidence);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.caseOutcomes)).toBe(true);
    expect(
      Object.isFrozen(parsed.caseOutcomes[0]?.invocations?.[0].custody),
    ).toBe(true);
    expect(parsed.checksPassed).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CHECKS,
    );
    expect(parsed.notProven).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_NOT_PROVEN,
    );
    expect(filingParserCrossEngineExecutionEvidenceV5Sha256(parsed)).toMatch(
      /^sha256:[0-9a-f]{64}$/u,
    );
  });

  it.each([
    "custody receipt",
    "inner commitment",
    "measurement evaluation",
  ] as const)("rejects a forged %s binding", (kind) => {
    const value = clone(buildFilingParserCrossEngineExecutionEvidenceV5Input());
    const invocationValue = value.caseOutcomes[0]?.invocations?.[0];
    if (invocationValue === undefined) throw new TypeError();
    const invocation = invocationValue as unknown as MutableInvocation;
    if (kind === "custody receipt")
      (
        invocation.custody.receipts[0] as { receiptSha256: string }
      ).receiptSha256 = `sha256:${"f".repeat(64)}`;
    if (kind === "inner commitment")
      (
        invocation as { qualityCompositionCommitmentSha256: string }
      ).qualityCompositionCommitmentSha256 = `sha256:${"f".repeat(64)}`;
    if (kind === "measurement evaluation")
      (
        invocation.measurement as { evaluationSha256: string }
      ).evaluationSha256 = `sha256:${"f".repeat(64)}`;
    expect(() =>
      createFilingParserCrossEngineExecutionEvidenceV5(value),
    ).toThrow();
  });

  it.each([
    "source context with dependent receipts",
    "original receipt with dependent pair",
    "amendment receipt with dependent pair",
    "pair with dependent outer bindings",
    "inner quality commitment with dependent outer bindings",
    "inner quality composition evaluation with dependent outer bindings",
    "inner quality evaluation with dependent outer bindings",
    "outer commitment with dependent evaluation",
    "outer evaluation",
  ] as const)("rejects a recomputed forged %s", (kind) => {
    const value = mutable(
      buildFilingParserCrossEngineExecutionEvidenceV5Input(),
    );
    const invocationValue = value.caseOutcomes[0]?.invocations?.[0];
    if (invocationValue === undefined) throw new TypeError();
    const invocation = invocationValue as unknown as MutableInvocation;
    if (kind === "source context with dependent receipts") {
      invocation.custody.sourceContextSha256 = forgedHash(51);
      rebindReceipts(invocation);
      rebindPair(invocation);
      rebindOuter(invocation);
    }
    if (kind === "original receipt with dependent pair") {
      invocation.custody.receipts[0]!.receiptSha256 = forgedHash(52);
      rebindPair(invocation);
      rebindOuter(invocation);
    }
    if (kind === "amendment receipt with dependent pair") {
      invocation.custody.receipts[1]!.receiptSha256 = forgedHash(53);
      rebindPair(invocation);
      rebindOuter(invocation);
    }
    if (kind === "pair with dependent outer bindings") {
      invocation.custody.custodyPairBindingSha256 = forgedHash(54);
      rebindOuter(invocation);
    }
    if (kind === "inner quality commitment with dependent outer bindings") {
      invocation.qualityCompositionCommitmentSha256 = forgedHash(55);
      rebindOuter(invocation);
    }
    if (
      kind ===
      "inner quality composition evaluation with dependent outer bindings"
    ) {
      invocation.qualityCompositionEvaluationBindingSha256 = forgedHash(56);
      rebindOuter(invocation);
    }
    if (kind === "inner quality evaluation with dependent outer bindings") {
      invocation.qualityEvaluationBindingSha256 = forgedHash(57);
      rebindOuter(invocation);
    }
    if (kind === "outer commitment with dependent evaluation") {
      invocation.custodyCompositionCommitmentSha256 = forgedHash(58);
      rebindOuterEvaluation(invocation);
    }
    if (kind === "outer evaluation")
      invocation.custodyCompositionEvaluationBindingSha256 = forgedHash(59);
    expect(() =>
      createFilingParserCrossEngineExecutionEvidenceV5(
        value as unknown as FilingParserCrossEngineExecutionEvidenceV5,
      ),
    ).toThrow();
  });

  it("rejects nested proxies without invoking their traps", () => {
    const value = clone(buildFilingParserCrossEngineExecutionEvidenceV5Input());
    let reads = 0;
    (value as unknown as { runtime: unknown }).runtime = new Proxy(
      {},
      {
        get: () => {
          reads += 1;
          throw new Error("must not read");
        },
        ownKeys: () => {
          reads += 1;
          throw new Error("must not enumerate");
        },
      },
    );
    expect(() =>
      createFilingParserCrossEngineExecutionEvidenceV5(value),
    ).toThrow("FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_INVALID");
    expect(reads).toBe(0);
  });

  it("rejects nested accessors and sparse arrays without invoking them", () => {
    const accessor = clone(
      buildFilingParserCrossEngineExecutionEvidenceV5Input(),
    );
    let reads = 0;
    Object.defineProperty(accessor.summary, "total", {
      enumerable: true,
      get: () => {
        reads += 1;
        return 6;
      },
    });
    expect(() =>
      createFilingParserCrossEngineExecutionEvidenceV5(accessor),
    ).toThrow("FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_INVALID");
    expect(reads).toBe(0);

    const sparse = clone(
      buildFilingParserCrossEngineExecutionEvidenceV5Input(),
    );
    const sparseOutcomes = sparse.caseOutcomes.slice(0, -1);
    sparseOutcomes.length = sparse.caseOutcomes.length;
    (sparse as unknown as { caseOutcomes: unknown[] }).caseOutcomes =
      sparseOutcomes;
    expect(() =>
      createFilingParserCrossEngineExecutionEvidenceV5(sparse),
    ).toThrow("FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_INVALID");
  });
});

function clone(
  value: FilingParserCrossEngineExecutionEvidenceV5,
): FilingParserCrossEngineExecutionEvidenceV5 {
  return structuredClone(value);
}

type Mutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Entry)[]
    ? Mutable<Entry>[]
    : T[Key] extends object
      ? Mutable<T[Key]>
      : T[Key];
};
type MutableEvidence = Mutable<FilingParserCrossEngineExecutionEvidenceV5>;
type MutableInvocation =
  Mutable<FilingParserCrossEngineExecutionEvidenceV5Invocation>;

function mutable(
  value: FilingParserCrossEngineExecutionEvidenceV5,
): MutableEvidence {
  return structuredClone(value) as unknown as MutableEvidence;
}

function rebindReceipts(invocation: MutableInvocation): void {
  const profile = FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CUSTODY_PROFILE;
  for (const [index, role] of (["original", "amendment"] as const).entries()) {
    const receipt = invocation.custody.receipts[index]!;
    const fixture = profile.fixtures[role];
    const sourceBindingSha256 = domainHash(
      "research-cockpit:synthetic-filing-parser-archive-custody-role-source:v1\u0000",
      {
        amendmentArchiveSha256: profile.fixtures.amendment.contentSha256,
        claim: profile.claim,
        originalArchiveSha256: profile.fixtures.original.contentSha256,
        role,
        schemaVersion: profile.schemaVersion,
        sourceContextSha256: invocation.custody.sourceContextSha256,
      },
    );
    const aadSha256 = bytesHash(
      new Uint8Array([
        ...new TextEncoder().encode(profile.algorithm.aadDomain),
        ...canonicalBytes({
          algorithm: profile.algorithm.name,
          byteLength: fixture.byteLength,
          claim: profile.claim,
          contentSha256: fixture.contentSha256,
          role,
          schemaVersion: profile.schemaVersion,
          sourceBindingSha256,
        }),
      ]),
    );
    Object.assign(receipt, { aadSha256, sourceBindingSha256 });
    receipt.receiptSha256 = domainHash(
      "research-cockpit:synthetic-filing-parser-archive-custody-receipt:v1\u0000",
      {
        aadSha256,
        byteLength: receipt.byteLength,
        ciphertextSha256: receipt.ciphertextSha256,
        contentSha256: receipt.contentSha256,
        readbackSha256: receipt.readbackSha256,
        role,
        sourceBindingSha256,
      },
    );
  }
}

function rebindPair(invocation: MutableInvocation): void {
  const profile = FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CUSTODY_PROFILE;
  invocation.custody.custodyPairBindingSha256 = domainHash(
    "research-cockpit:synthetic-filing-parser-archive-custody-pair:v1\u0000",
    {
      claim: profile.claim,
      receipts: invocation.custody.receipts,
      schemaVersion: profile.schemaVersion,
      sourceContextSha256: invocation.custody.sourceContextSha256,
    },
  );
}

function rebindOuter(invocation: MutableInvocation): void {
  invocation.custodyCompositionCommitmentSha256 = domainHash(
    "research-cockpit:synthetic-filing-parser-custody-quality-commitment:v1\u0000",
    {
      candidateCommitmentSha256: invocation.candidateCommitmentSha256,
      candidateObservationsSha256: invocation.candidateObservationsSha256,
      claim:
        "bounded_synthetic_source_owned_exact_pair_encrypted_custody_authenticated_readback_to_direct_docker_cross_engine_quality_evaluation_binding",
      custody: invocation.custody,
      declaredReferenceSha256: invocation.declaredReferenceSha256,
      planSha256: invocation.planSha256,
      quality: invocation.quality,
      qualityCompositionCommitmentSha256:
        invocation.qualityCompositionCommitmentSha256,
      schemaVersion: "1.0.0",
    },
  );
  rebindOuterEvaluation(invocation);
}

function rebindOuterEvaluation(invocation: MutableInvocation): void {
  invocation.custodyCompositionEvaluationBindingSha256 = domainHash(
    "research-cockpit:synthetic-filing-parser-custody-quality-evaluation:v1\u0000",
    {
      candidateCommitmentSha256: invocation.candidateCommitmentSha256,
      candidateObservationsSha256: invocation.candidateObservationsSha256,
      claim:
        "bounded_synthetic_source_owned_exact_pair_encrypted_custody_authenticated_readback_to_direct_docker_cross_engine_quality_evaluation_binding",
      custody: invocation.custody,
      custodyCompositionCommitmentSha256:
        invocation.custodyCompositionCommitmentSha256,
      declaredReferenceSha256: invocation.declaredReferenceSha256,
      measurementEvaluationSha256: invocation.measurement.evaluationSha256,
      planSha256: invocation.planSha256,
      quality: invocation.quality,
      qualityCompositionCommitmentSha256:
        invocation.qualityCompositionCommitmentSha256,
      qualityCompositionEvaluationBindingSha256:
        invocation.qualityCompositionEvaluationBindingSha256,
      qualityEvaluationBindingSha256: invocation.qualityEvaluationBindingSha256,
      schemaVersion: "1.0.0",
    },
  );
}

function forgedHash(value: number): `sha256:${string}` {
  return `sha256:${value.toString(16).padStart(64, "0")}`;
}
function domainHash(domain: string, value: unknown): `sha256:${string}` {
  return bytesHash(
    new Uint8Array([
      ...new TextEncoder().encode(domain),
      ...canonicalBytes(value),
    ]),
  );
}
function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonical(value)}\n`);
}
function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value !== "object" || value === null) throw new TypeError();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}
function bytesHash(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
