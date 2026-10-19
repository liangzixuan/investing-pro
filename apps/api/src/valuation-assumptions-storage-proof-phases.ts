import { encodeValuationAssumptionsPayload } from "@research-cockpit/contracts";
import {
  VALUATION_PROOF_ROWS,
  valuationProofLocation,
  type ValuationProofPhase,
} from "./valuation-assumptions-proof-data";
import { inspectValuationProofSchema } from "./valuation-assumptions-proof-schema";
import type { ValuationAssumptionsReceipt } from "./valuation-assumptions-repository";
import type { ValuationProofContext } from "./valuation-assumptions-storage-proof-context";
import { requireValuationProof as requireProof } from "./valuation-assumptions-storage-proof-evidence";
import {
  valuationRace,
  valuationRollback,
  valuationUnknown,
} from "./valuation-assumptions-storage-proof-races";

export async function valuationSchema(context: ValuationProofContext) {
  requireProof(context.operation);
  const task = context.operation.metadata();
  context.lifetime.actors.push(
    task.then(
      () => undefined,
      () => undefined,
    ),
  );
  const { database, tableList } = await context.lifetime.bounded(task);
  context.lifetime.assertRunning();
  const result = inspectValuationProofSchema(database, tableList);
  requireProof(result);
  requireProof(context.lifetime.count === 0);
  context.check("fixed_database_and_two_tables_schema_admitted");
  return result;
}
async function preflight(context: ValuationProofContext) {
  requireProof(VALUATION_PROOF_ROWS.length === 18);
  for (const row of VALUATION_PROOF_ROWS) await context.requireAbsent(row);
  context.check("18_exact_locations_absent");
}
async function createIsolation(context: ValuationProofContext) {
  await context.read("a", 0);
  await context.read("b", 0);
  const a = await context.success({ owner: "a", name: "create" });
  const b = await context.success({ owner: "b", name: "create" });
  await context.read("a", 1);
  await context.read("b", 1);
  const replayA = await context.replay({ owner: "a", name: "create" });
  const replayB = await context.replay({ owner: "b", name: "create" });
  requireProof(a.committedAt === replayA.committedAt);
  requireProof(b.committedAt === replayB.committedAt);
  context.joined("a", "create");
  context.joined("b", "create");
  context.check(
    "same_key_separate_principal_namespaces",
    "canonical_create_and_original_receipts",
  );
}
async function stale(context: ValuationProofContext) {
  await context.success({ owner: "a", name: "stale-winner", actor: "winner" });
  await context.refuse(
    context.put({ owner: "a", name: "stale-loser", actor: "loser" }),
    "conflict",
  );
  await context.replay({ owner: "a", name: "create" });
  await context.read("a", 2);
  await context.receipt("a", "stale-winner");
  context.joined("a", "stale-winner");
  await context.requireAbsent(valuationProofLocation("a", "stale-loser"));
  context.check(
    "stale_refused_original_receipt_retained",
    "winner_joined_loser_receipt_absent",
  );
}
async function capacity(context: ValuationProofContext) {
  const payload = context.command("size", "capacity").payload;
  requireProof(payload.entries.length === 20);
  requireProof(
    Buffer.byteLength(encodeValuationAssumptionsPayload(payload)) === 262144,
  );
  await context.success({ owner: "size", name: "capacity" });
  await context.read("size", 1);
  await context.receipt("size", "capacity");
  context.joined("size", "capacity");
  const before = context.lifetime.count;
  for (const variant of context.data.invalidCommands) {
    await context.refuse(
      context.putValue({ owner: "size", catalog: "overflow" }, variant.command),
      "invalid_request",
    );
    requireProof(context.lifetime.count === before);
  }
  context.check(
    "20_entries_exact_262144_utf8_bytes",
    "malformed_and_over_limit_zero_store_calls",
  );
}
async function domainGuards(context: ValuationProofContext) {
  await context.replay({
    owner: "a",
    name: "create",
    catalog: "revised",
    negativeClock: true,
  });
  await context.read("a", 5, "revised");
  const before = context.fingerprint("a");
  for (const variant of context.data.domainCommands) {
    await context.refuse(
      context.putValue(
        { owner: "a", catalog: variant.catalog },
        variant.command,
      ),
      "invalid_request",
    );
  }
  await context.refuse(
    context.put({
      owner: "a",
      name: "consumed-key-changed",
      catalog: "revised",
    }),
    "idempotency_conflict",
  );
  await context.requireAbsent(valuationProofLocation("a", "catalog-refused"));
  await context.read("a", 5, "revised");
  requireProof(before === context.fingerprint("a"));
  requireProof(
    context.lifetime.trace.every((entry) =>
      entry.operation.startsWith("read_"),
    ),
  );
  context.check(
    "historical_read_and_original_replay",
    "five_current_catalog_identity_guards",
    "consumed_key_content_refused_no_transaction",
  );
}
function joinHistoricalEditReceipt(
  context: ValuationProofContext,
  acknowledged: ValuationAssumptionsReceipt,
) {
  const receipt = context.rows.get(
    valuationProofLocation("a", "historical-edit").rowId,
  );
  requireProof(receipt);
  requireProof(receipt.version === acknowledged.version);
  requireProof(receipt.digestSha256 === acknowledged.digestSha256);
  requireProof(receipt.committedAt === acknowledged.committedAt);
  context.joined("a", "historical-edit");
}
async function historicalEdit(context: ValuationProofContext) {
  const acknowledged = await context.success({
    owner: "a",
    name: "historical-edit",
    catalog: "revised",
  });
  await context.success({
    owner: "a",
    name: "catalog-reviewed",
    catalog: "revised",
  });
  await context.receipt("a", "historical-edit");
  joinHistoricalEditReceipt(context, acknowledged);
  await context.receipt("a", "catalog-reviewed");
  await context.read("a", 7, "revised");
  context.joined("a", "catalog-reviewed");
  await context.replay({
    owner: "a",
    name: "create",
    catalog: "revised",
    negativeClock: true,
  });
  context.check(
    "historical_raw_edit_preserved",
    "exact_reviewed_catalog_metadata",
    "original_receipt_still_replayable",
  );
}
async function reopen(context: ValuationProofContext) {
  await context.read("a", 7, "revised");
  await context.read("b", 1, "revised");
  await context.read("size", 1, "revised");
  await context.receipt("a", "catalog-reviewed");
  await context.receipt("b", "create");
  await context.receipt("size", "capacity");
  context.joined("a", "catalog-reviewed");
  context.joined("b", "create");
  context.joined("size", "capacity");
  context.check("fresh_invocation_three_canonical_payloads_and_receipts");
}
async function remove(context: ValuationProofContext) {
  await context.success({ owner: "a", name: "remove", catalog: "revised" });
  await context.read("a", 8, "revised");
  await context.receipt("a", "remove");
  context.joined("a", "remove");
  context.check("explicit_empty_collection_committed");
}
async function reopenEmpty(context: ValuationProofContext) {
  await context.read("a", 8, "revised");
  context.check("fresh_invocation_empty_collection_retained");
}
export const VALUATION_STORAGE_PHASE_ACTIONS: Readonly<
  Record<
    Exclude<ValuationProofPhase, "schema">,
    (context: ValuationProofContext) => Promise<void>
  >
> = Object.freeze({
  preflight,
  "create-isolation": createIsolation,
  stale,
  prestage: (context) => valuationRace(context, "prestage"),
  overlap: (context) => valuationRace(context, "overlap"),
  rollback: valuationRollback,
  unknown: valuationUnknown,
  capacity,
  "domain-guards": domainGuards,
  "historical-edit-and-catalog-review": historicalEdit,
  reopen,
  remove,
  "reopen-empty": reopenEmpty,
});
