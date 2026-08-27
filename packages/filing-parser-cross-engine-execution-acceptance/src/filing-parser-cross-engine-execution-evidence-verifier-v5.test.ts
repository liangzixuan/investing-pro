import { describe, expect, it } from "vitest";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_TRANSITION_PATH_COUNT,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_TRANSITION_SHA256,
  filingParserCrossEngineExecutionV5ChainAllowed,
  filingParserCrossEngineExecutionV5TransitionAllowed,
  verifyFilingParserCrossEngineExecutionEvidenceOffline,
} from "./filing-parser-cross-engine-execution-evidence-verifier";
import { FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE } from "./filing-parser-cross-engine-execution-evidence-v5";

describe("Cycle 2o v5 offline evidence verifier", () => {
  it("rejects malformed review options before filesystem or git access", async () => {
    await expect(
      verifyFilingParserCrossEngineExecutionEvidenceOffline({
        evidencePath: "relative.json",
        expectedArtifactName: "bad",
        expectedEvidenceSha256: `sha256:${"a".repeat(64)}`,
        expectedRepository: "owner/repository",
        expectedRevision: "a".repeat(40),
        expectedRunAttempt: 1,
        expectedRunId: "1",
        repositoryPath: ".",
      }),
    ).rejects.toThrow(/offline/iu);
  });

  it("admits only the exact direct-child topology and final transition tuple", () => {
    expect(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_TRANSITION_PATH_COUNT,
    ).toBe(39);
    expect(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_TRANSITION_SHA256,
    ).toBe(
      "sha256:d830b547c4c0727bd948267819a01e8beba575e2d80d8a5e89fd1d8542b30212",
    );
    const revision = "a".repeat(40);
    expect(
      filingParserCrossEngineExecutionV5ChainAllowed(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE,
        "1",
        "1",
        revision,
        `${revision} ${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE}`,
      ),
    ).toBe(true);
    for (const values of [
      ["b".repeat(40), "1", "1"],
      [FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE, "2", "1"],
      [FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE, "1", "2"],
    ] as const)
      expect(
        filingParserCrossEngineExecutionV5ChainAllowed(
          values[0],
          values[1],
          values[2],
          revision,
          `${revision} ${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE}`,
        ),
      ).toBe(false);
    expect(
      filingParserCrossEngineExecutionV5TransitionAllowed(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_TRANSITION_PATH_COUNT,
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_TRANSITION_SHA256,
      ),
    ).toBe(true);
    expect(
      filingParserCrossEngineExecutionV5TransitionAllowed(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_TRANSITION_PATH_COUNT +
          1,
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_TRANSITION_SHA256,
      ),
    ).toBe(false);
    expect(
      filingParserCrossEngineExecutionV5TransitionAllowed(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_TRANSITION_PATH_COUNT,
        `sha256:${"f".repeat(64)}`,
      ),
    ).toBe(false);
  });
});
