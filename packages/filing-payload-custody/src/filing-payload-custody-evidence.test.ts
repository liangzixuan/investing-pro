import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  FILING_PAYLOAD_CUSTODY_EVIDENCE_CHECKS,
  FILING_PAYLOAD_CUSTODY_EVIDENCE_NOT_PROVEN,
  FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS,
  createFilingPayloadCustodyEvidence,
  filingPayloadCustodyEvidenceSha256,
  parseCanonicalFilingPayloadCustodyEvidence,
  serializeCanonicalFilingPayloadCustodyEvidence,
  type FilingPayloadCustodyEvidenceInput,
} from "./filing-payload-custody-evidence";
import {
  FILING_PAYLOAD_CUSTODY_CLAIM,
  FILING_PAYLOAD_CUSTODY_FIXTURE,
} from "./payload-custody";

const HASH = `sha256:${"a".repeat(64)}` as const;

describe("filing payload custody evidence v1", () => {
  it("freezes the exact claim, checks, nonclaims, and ordered source set", () => {
    expect(FILING_PAYLOAD_CUSTODY_CLAIM).toBe(
      "bounded_synthetic_filing_payload_integrity_custody_and_logical_key_unavailability",
    );
    expect(FILING_PAYLOAD_CUSTODY_EVIDENCE_CHECKS).toHaveLength(16);
    expect(FILING_PAYLOAD_CUSTODY_EVIDENCE_CHECKS[15]).toBe(
      "no_network_parser_database_api_web_queue_and_cycle2a_schema_check_nonclaim_source_set_artifact_preservation",
    );
    expect(FILING_PAYLOAD_CUSTODY_EVIDENCE_NOT_PROVEN).toHaveLength(16);
    expect(FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS).toHaveLength(29);
    expect(new Set(FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS).size).toBe(29);
  });

  it("round-trips one canonical success-only record", () => {
    const evidence = createFilingPayloadCustodyEvidence(input());
    const serialized = serializeCanonicalFilingPayloadCustodyEvidence(evidence);
    expect(
      parseCanonicalFilingPayloadCustodyEvidence(
        new TextEncoder().encode(serialized),
      ),
    ).toEqual(evidence);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(serialized.slice(0, -1)).not.toContain("\n");
    expect(filingPayloadCustodyEvidenceSha256(evidence)).toMatch(
      /^sha256:[0-9a-f]{64}$/u,
    );
  });

  it("rejects failure, reordered arrays, source drift, and noncanonical bytes", () => {
    const canonical = JSON.parse(
      serializeCanonicalFilingPayloadCustodyEvidence(
        createFilingPayloadCustodyEvidence(input()),
      ),
    ) as Record<string, unknown>;
    for (const mutation of [
      { ...canonical, status: "failed" },
      {
        ...canonical,
        checksPassed: [...FILING_PAYLOAD_CUSTODY_EVIDENCE_CHECKS].reverse(),
      },
      {
        ...canonical,
        notProven: [...FILING_PAYLOAD_CUSTODY_EVIDENCE_NOT_PROVEN].slice(1),
      },
      {
        ...canonical,
        sourceHashes: (canonical.sourceHashes as unknown[]).slice(1),
      },
      {
        ...canonical,
        lifecycle: {
          ...(canonical.lifecycle as Record<string, unknown>),
          keyUnavailableAfterExpiry: false,
        },
      },
      {
        ...canonical,
        lifecycle: {
          ...(canonical.lifecycle as Record<string, unknown>),
          sourceBindingSha256: `sha256:${"b".repeat(64)}`,
        },
      },
    ]) {
      expect(() =>
        createFilingPayloadCustodyEvidence(
          mutation as unknown as FilingPayloadCustodyEvidenceInput,
        ),
      ).toThrow("Filing payload custody evidence is invalid.");
    }

    const serialized = serializeCanonicalFilingPayloadCustodyEvidence(
      createFilingPayloadCustodyEvidence(input()),
    );
    expect(() =>
      parseCanonicalFilingPayloadCustodyEvidence(
        new TextEncoder().encode(` ${serialized}`),
      ),
    ).toThrow("Filing payload custody evidence is invalid.");
    expect(() =>
      parseCanonicalFilingPayloadCustodyEvidence(
        Uint8Array.from([
          0xef,
          0xbb,
          0xbf,
          ...new TextEncoder().encode(serialized),
        ]),
      ),
    ).toThrow("Filing payload custody evidence is invalid.");
    expect(() =>
      parseCanonicalFilingPayloadCustodyEvidence(
        new TextEncoder().encode(
          serialized.replace(
            '"schemaVersion":"1.0.0"',
            '"schemaVersion":"1.0.0","schemaVersion":"1.0.0"',
          ),
        ),
      ),
    ).toThrow("Filing payload custody evidence is invalid.");
  });

  it("pins trusted output custody and direct key, DEK, nonce, and canary observations", async () => {
    const source = await readFile(
      new URL("./run-filing-payload-custody-acceptance.ts", import.meta.url),
      "utf8",
    );
    for (const required of [
      'requiredEnvironment("RUNNER_TEMP")',
      "evidencePath !== join(trustedParent, EVIDENCE_FILE_NAME)",
      "firstKeyStore.read(firstKeyId) === undefined",
      "firstKeyStore.read(firstKeyId) !== undefined",
      "secondInsertion.keySha256 === firstDekSha256",
      "secondNonceSha256 === firstNonceSha256",
      "secondKeyStore.keyIds().length !== 0",
      "expectedPayload.slice(1_024, 1_088)",
    ]) {
      expect(source).toContain(required);
    }
    expect(source).not.toContain(
      "createSyntheticInMemoryFilingPayloadKeyStore",
    );
  });
});

function input(): FilingPayloadCustodyEvidenceInput {
  return {
    checksPassed: FILING_PAYLOAD_CUSTODY_EVIDENCE_CHECKS,
    claim: FILING_PAYLOAD_CUSTODY_CLAIM,
    completedAt: "2026-08-21T01:00:01.000Z",
    evidenceVersion: 1,
    fixtureManifestSha256: HASH,
    lifecycle: {
      auditValueFree: true,
      contentSha256: FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256,
      createdAt: "2026-08-21T01:00:00.000Z",
      distinctCiphertextObserved: true,
      earlyExpiryRejected: true,
      exactReplayMatched: true,
      keyUnavailableAfterExpiry: true,
      payloadBytes: FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength,
      payloadExpiresAt: "2026-08-22T01:00:00.000Z",
      plaintextCanaryAbsent: true,
      postExpiryReadDenied: true,
      preExpiryReadMatched: true,
      sourceBindingSha256: HASH,
      terminalState: "logical_key_unavailability",
      transitionedAt: "2026-08-22T01:00:00.000Z",
      zeroResidue: true,
    },
    notProven: FILING_PAYLOAD_CUSTODY_EVIDENCE_NOT_PROVEN,
    repository: "example/research-cockpit",
    revision: "b".repeat(40),
    runtime: {
      algorithm: "aes-256-gcm",
      architecture: "x64",
      keyBytes: 32,
      maximumPayloadBytes: 1_048_576,
      nonceBytes: 12,
      operatingSystem: "linux",
      retentionMilliseconds: 86_400_000,
      tagBytes: 16,
    },
    schemaVersion: "1.0.0",
    sourceHashes: FILING_PAYLOAD_CUSTODY_EVIDENCE_SOURCE_PATHS.map((path) => ({
      path,
      sha256: HASH,
    })),
    startedAt: "2026-08-21T01:00:00.000Z",
    status: "passed",
    synthetic: true,
    tools: { git: "2.51.0", node: "v24.19.0", pnpm: "11.19.0" },
    workflow: {
      event: "push",
      job: "acceptance",
      ref: "refs/heads/main",
      runAttempt: 1,
      runId: "123",
      workflowName: "Filing payload custody acceptance",
    },
  };
}
