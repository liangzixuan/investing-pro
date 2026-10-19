import { AppwriteException } from "node-appwrite";
import { ProofFailure } from "./appwrite-storage-proof-phase";
import { valuationProofLocation } from "./valuation-assumptions-proof-data";
import type { ValuationProofContext } from "./valuation-assumptions-storage-proof-context";
import {
  requireValuationProof as requireProof,
  valuationProofRow,
} from "./valuation-assumptions-storage-proof-evidence";

export async function valuationRace(
  context: ValuationProofContext,
  stage: "prestage" | "overlap",
): Promise<void> {
  const reached = context.lifetime.barrier();
  const release = context.lifetime.barrier();
  const hold = async () => {
    reached.release();
    await release.wait();
  };
  const loserName = stage === "prestage" ? "prestage-loser" : "overlap-loser";
  const winnerName =
    stage === "prestage" ? "prestage-winner" : "overlap-winner";
  const loser = context.put({
    owner: "a",
    name: loserName,
    actor: "loser",
    hooks:
      stage === "prestage" ? { beforeIncrement: hold } : { beforeCommit: hold },
  });
  const ready = await Promise.race([
    reached.wait().then(() => true),
    loser.then(() => false),
  ]);
  if (!ready) throw new ProofFailure("stage_not_reached");
  await context.success({ owner: "a", name: winnerName, actor: "winner" });
  release.release();
  await context.refuse(loser, "conflict");
  await context.read("a", stage === "prestage" ? 3 : 4);
  await context.receipt("a", winnerName);
  context.joined("a", winnerName);
  await context.requireAbsent(valuationProofLocation("a", loserName));
  context.check(`${stage}_one_cas_winner`, "loser_receipt_absent");
}

export async function valuationRollback(context: ValuationProofContext) {
  let before: string | undefined;
  await context.refuse(
    context.put({
      owner: "a",
      name: "rollback",
      hooks: {
        beforeReceipt: () => {
          before = context.fingerprint("a");
          throw new AppwriteException(
            "Synthetic qualification interruption",
            403,
          );
        },
      },
    }),
    "access_denied",
  );
  requireProof(context.lifetime.rollbackObserved);
  await context.read("a", 4);
  requireProof(before === context.fingerprint("a"));
  await context.requireAbsent(valuationProofLocation("a", "rollback"));
  await context.receipt("a", "overlap-winner");
  context.joined("a", "overlap-winner");
  context.check(
    "acknowledged_rollback",
    "current_bytes_and_metadata_unchanged",
    "rollback_receipt_absent",
  );
}

export async function valuationUnknown(context: ValuationProofContext) {
  let acknowledged = false;
  await context.refuse(
    context.put({
      owner: "a",
      name: "unknown",
      hooks: {
        afterCommit: (input, value) => {
          const result = valuationProofRow(value);
          requireProof(result.$id === input.transactionId);
          requireProof(result.status === "committed");
          acknowledged = true;
          throw new Error("Synthetic local acknowledgment suppression");
        },
      },
    }),
    "commit_unknown",
  );
  requireProof(acknowledged);
  requireProof(!context.lifetime.rollbackObserved);
  const count = context.lifetime.count;
  await context.replay({ owner: "a", name: "unknown" });
  requireProof(context.lifetime.count === count + 1);
  await context.read("a", 5);
  context.joined("a", "unknown");
  context.check(
    "real_commit_ack_locally_suppressed",
    "original_receipt_replay_no_second_commit",
  );
}
