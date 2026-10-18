import { TablesDB } from "node-appwrite";
import { createAppwriteTransport } from "./appwrite-transport";
import { appwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import {
  WATCHLIST_RESTORE_PROOF_PHASES,
  WATCHLIST_RESTORE_PROOF_TARGET,
  type WatchlistRestoreProofPhase,
} from "./watchlist-restore-proof-data";
import {
  runWatchlistRestoreProof,
  type WatchlistRestoreProofFactory,
  type WatchlistRestoreProofReport,
} from "./watchlist-storage-restore-proof";

export interface WatchlistRestoreProofContext {
  readonly req: {
    readonly method: unknown;
    readonly path: unknown;
    readonly queryString?: unknown;
    readonly bodyText: unknown;
    readonly bodyBinary: unknown;
    readonly headers: Readonly<Record<string, unknown>>;
  };
  readonly res: {
    json(
      body: unknown,
      status: number,
      headers: Record<string, string>,
    ): unknown;
  };
}
const NO_STORE = { "cache-control": "no-store" };

function requireEmptyQuery(query: unknown) {
  if (query === undefined) return;
  if (query === "") return;
  throw new Error("Invalid proof query");
}
function requireEmptyBody(text: unknown, binary: unknown) {
  if (text !== "") throw new Error("Invalid proof body");
  if (!Buffer.isBuffer(binary)) throw new Error("Invalid proof bytes");
  if (binary.byteLength !== 0) throw new Error("Nonempty proof bytes");
}
/** Capture every request field, including authority, synchronously. */
function captureRequest(req: WatchlistRestoreProofContext["req"]) {
  const { method, path, queryString, bodyText, bodyBinary, headers } = req;
  const phase = WATCHLIST_RESTORE_PROOF_PHASES.find(
    (value) => path === `/proof/${value}`,
  );
  if (phase === undefined) throw new Error("Invalid proof path");
  if (method !== "POST") throw new Error("Invalid proof method");
  requireEmptyQuery(queryString);
  requireEmptyBody(bodyText, bodyBinary);
  return { phase, key: headers["x-appwrite-key"] };
}
function isExecutionKey(key: unknown): key is string {
  if (typeof key !== "string") return false;
  if (key.trim() === "") return false;
  return key.length <= 8192;
}

/** The operation is registered with the runner before SDK configuration. */
function proofOperationFactory(
  phase: WatchlistRestoreProofPhase,
  executionKey: string,
): WatchlistRestoreProofFactory {
  return (signal) => {
    const transport = createAppwriteTransport({
      endpoint: WATCHLIST_RESTORE_PROOF_TARGET.endpoint,
      signal,
      ...(phase === "preflight"
        ? {
            expectedAbsentDatabaseId:
              WATCHLIST_RESTORE_PROOF_TARGET.restoredDatabaseId,
          }
        : {}),
    });
    let configured = false;
    return {
      newStore: () => {
        if (!configured) {
          transport.client
            .setProject(WATCHLIST_RESTORE_PROOF_TARGET.project)
            .setKey(executionKey);
          configured = true;
        }
        return appwriteVersionedRowStore(new TablesDB(transport.client));
      },
      snapshot: transport.snapshot,
      close: () => transport.close(),
    };
  };
}

/** No caller-controlled target, row, identity, command or transport configuration. */
export function createWatchlistRestoreProofFunction(buildProof: string) {
  if (!/^[0-9a-f]{64}$/u.test(buildProof))
    throw new Error("Invalid restore proof build binding");
  return async ({ req, res }: WatchlistRestoreProofContext) => {
    let request: ReturnType<typeof captureRequest>;
    try {
      request = captureRequest(req);
    } catch {
      return res.json({ error: "invalid_proof_request" }, 400, NO_STORE);
    }
    if (!isExecutionKey(request.key))
      return res.json({ error: "proof_authority_unavailable" }, 503, NO_STORE);
    let report: WatchlistRestoreProofReport;
    try {
      report = await runWatchlistRestoreProof(
        request.phase,
        buildProof,
        proofOperationFactory(request.phase, request.key),
      );
    } catch {
      return res.json({ error: "proof_unavailable" }, 503, NO_STORE);
    }
    return res.json(report, report.outcome === "passed" ? 200 : 409, NO_STORE);
  };
}
declare const __WATCHLIST_RESTORE_PROOF_BUILD__: string;
export default function main(context: WatchlistRestoreProofContext) {
  return createWatchlistRestoreProofFunction(__WATCHLIST_RESTORE_PROOF_BUILD__)(
    context,
  );
}
