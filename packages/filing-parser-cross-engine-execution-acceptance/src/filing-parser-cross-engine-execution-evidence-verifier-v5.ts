import type {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY,
} from "./filing-parser-cross-engine-execution-evidence";
import type {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE,
} from "./filing-parser-cross-engine-execution-evidence-v5";

/** Additive Cycle 2o review carrier; verification reuses the hardened v1-v4 verifier runtime. */
export interface FilingParserCrossEngineExecutionEvidenceReviewV5 {
  readonly artifactName: string;
  readonly baseline: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE;
  readonly evidenceSha256: `sha256:${string}`;
  readonly evidenceVersion: 5;
  readonly historicalV1: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY;
  readonly historicalV2: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY;
  readonly historicalV3: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY;
  readonly historicalV4: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_HISTORY;
  readonly repository: string;
  readonly revision: string;
  readonly runAttempt: number;
  readonly runId: string;
  readonly sourceCount: number;
  readonly transitionPathCount: number;
  readonly verdict: "offline_consistent";
}
