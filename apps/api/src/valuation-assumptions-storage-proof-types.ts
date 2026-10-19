import type { AppwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import type {
  OperationTrace,
  ProofFailureReason,
} from "./appwrite-storage-proof-phase";
import type { ValuationAssumptionsRepositoryErrorCode } from "./valuation-assumptions-repository";
import type { ValuationProofPhase } from "./valuation-assumptions-proof-data";
import type { inspectValuationProofSchema } from "./valuation-assumptions-proof-schema";

export interface ValuationProofOperation {
  newStore(): AppwriteVersionedRowStore;
  metadata(): Promise<{ database: unknown; tableList: unknown }>;
  snapshot(): {
    readonly requests: number;
    readonly lastStatus: number | null;
    readonly closed: boolean;
  };
  close(): Promise<void>;
}
export type ValuationProofFactory = (
  signal: AbortSignal,
) => ValuationProofOperation;
export interface ValuationProofReport {
  readonly version: 1;
  readonly buildProof: string;
  readonly planSha256: string;
  readonly phase: ValuationProofPhase;
  readonly outcome: "passed" | "failed" | "incomplete";
  readonly failure: "none" | ProofFailureReason;
  readonly repositoryError: ValuationAssumptionsRepositoryErrorCode | null;
  readonly operationCount: number;
  readonly metadataCount: number;
  readonly httpDispatches: number | null;
  readonly upstreamStatus: number | null;
  readonly elapsedMs: number | null;
  readonly closed: boolean;
  readonly observedVersion: number | null;
  readonly rollbackObserved: boolean;
  readonly cleanupIncomplete: boolean;
  readonly checks: readonly string[];
  readonly rowFingerprints: readonly Readonly<{
    rowId: string;
    sha256: string;
  }>[];
  readonly receipts: readonly Readonly<{
    rowId: string;
    version: number;
    digestSha256: string;
    committedAt: string;
  }>[];
  readonly currentRecords: readonly Readonly<{
    rowId: string;
    version: number;
    digestSha256: string;
    createdAt: string;
    updatedAt: string;
  }>[];
  readonly trace: readonly Readonly<OperationTrace>[];
  readonly schema: ReturnType<typeof inspectValuationProofSchema>;
}
