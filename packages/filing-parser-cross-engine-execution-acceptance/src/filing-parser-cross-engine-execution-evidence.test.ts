import { describe, expect, it } from "vitest";

import {
  createFilingParserCrossEngineExecutionEvidence,
  filingParserCrossEngineImplementationSha256,
  parseCanonicalFilingParserCrossEngineExecutionEvidence,
  serializeCanonicalFilingParserCrossEngineExecutionEvidence,
} from "./filing-parser-cross-engine-execution-evidence";
import { buildFilingParserCrossEngineExecutionEvidenceInput } from "./test-filing-parser-cross-engine-execution-evidence-builder";

const HASH_Z = `sha256:${"0".repeat(64)}`;

describe("filing parser cross-engine execution evidence", () => {
  it("round-trips exactly one canonical line", () => {
    const evidence = createFilingParserCrossEngineExecutionEvidence(
      buildFilingParserCrossEngineExecutionEvidenceInput(),
    );
    const serialized =
      serializeCanonicalFilingParserCrossEngineExecutionEvidence(evidence);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(serialized.slice(0, -1)).not.toContain("\n");
    expect(
      parseCanonicalFilingParserCrossEngineExecutionEvidence(
        new TextEncoder().encode(serialized),
      ),
    ).toEqual(evidence);
  });

  it("rejects contradictory success bindings and value-bearing quarantines", () => {
    for (const mutate of [
      (root: Record<string, unknown>) =>
        (outcome(root, 0).nodeOriginalStdoutSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).nodeAmendmentStdoutSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).nodeExecutionBindingSha256 = outcome(
          root,
          0,
        ).pythonExecutionBindingSha256),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).factVersionCount = 19),
      (root: Record<string, unknown>) => (outcome(root, 0).lineageCount = 9),
      (root: Record<string, unknown>) =>
        (outcome(root, 1).originalArchiveSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 1).factVersionCount = 0),
      (root: Record<string, unknown>) =>
        (outcome(root, 1).resultSha256 = HASH_Z),
    ]) {
      const value = mutableEvidence();
      mutate(value);
      expect(() =>
        createFilingParserCrossEngineExecutionEvidence(value as never),
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
    }
  });

  it("binds implementations, fixture, artifact, engines, and runtime exactly", () => {
    for (const mutate of [
      (root: Record<string, unknown>) =>
        (engine(root, 0).runtimeVersion = "Python 3.12.14"),
      (root: Record<string, unknown>) =>
        (engine(root, 1).baseIndexDigest = HASH_Z),
      (root: Record<string, unknown>) => mutateImplementationProjection(root),
      (root: Record<string, unknown>) => (root.fixtureManifestSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (workflow(root).artifactName = "wrong"),
      (root: Record<string, unknown>) =>
        (runtime(root).auditedContainerCount = 14),
      (root: Record<string, unknown>) =>
        (runtime(root).productionContainerCount = 10),
      (root: Record<string, unknown>) =>
        (runtime(root).successfulPairContainerCount = 3),
      (root: Record<string, unknown>) =>
        records(transition(root).entries).pop(),
      (root: Record<string, unknown>) =>
        ((
          records(transition(root).entries)[0] as Record<string, unknown>
        ).status = "M"),
      (root: Record<string, unknown>) => {
        records(transition(root).entries).push({
          path: "unexpected",
          status: "A",
        });
        transition(root).pathCount = 45;
      },
    ]) {
      const value = mutableEvidence();
      mutate(value);
      expect(() =>
        createFilingParserCrossEngineExecutionEvidence(value as never),
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
    }
  });

  it("rejects noncanonical, duplicate, multiline, and extra-field encodings", () => {
    const canonical =
      serializeCanonicalFilingParserCrossEngineExecutionEvidence(
        buildFilingParserCrossEngineExecutionEvidenceInput(),
      );
    for (const text of [
      ` ${canonical}`,
      canonical.replace("{", '{"status":"passed",'),
      canonical.replace("\n", "\n\n"),
      canonical.slice(0, -1),
    ])
      expect(() =>
        parseCanonicalFilingParserCrossEngineExecutionEvidence(
          new TextEncoder().encode(text),
        ),
      ).toThrow();
  });

  it("maps hostile carriers to the generic evidence error", () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error("secret");
        },
      },
    );
    expect(() =>
      createFilingParserCrossEngineExecutionEvidence(hostile as never),
    ).toThrow("Filing parser cross-engine execution evidence is invalid.");
  });
});

function mutableEvidence(): Record<string, unknown> {
  return structuredClone(
    buildFilingParserCrossEngineExecutionEvidenceInput(),
  ) as unknown as Record<string, unknown>;
}
function records(value: unknown): Record<string, unknown>[] {
  return value as Record<string, unknown>[];
}
function outcome(
  root: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  return records(root.caseOutcomes)[index] as Record<string, unknown>;
}
function engine(
  root: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  return records(root.engines)[index] as Record<string, unknown>;
}
function implementation(
  value: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  return records(value.implementationSourceHashes)[index] as Record<
    string,
    unknown
  >;
}
function mutateImplementationProjection(root: Record<string, unknown>): void {
  const target = engine(root, 0);
  implementation(target, 0).sha256 = HASH_Z;
  target.implementationSha256 = filingParserCrossEngineImplementationSha256(
    target.implementationSourceHashes as never,
  );
}
function runtime(root: Record<string, unknown>): Record<string, unknown> {
  return root.runtime as Record<string, unknown>;
}
function workflow(root: Record<string, unknown>): Record<string, unknown> {
  return root.workflow as Record<string, unknown>;
}
function transition(root: Record<string, unknown>): Record<string, unknown> {
  return root.transition as Record<string, unknown>;
}
