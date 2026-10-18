import { TablesDB } from "node-appwrite";
import { createAppwriteTransport } from "./appwrite-transport";
import { appwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import {
  WATCHLIST_RESTORE_PROOF_PHASES,
  WATCHLIST_RESTORE_PROOF_TARGET,
} from "./watchlist-restore-proof-data";
import {
  runWatchlistRestoreProof,
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
/** No caller-controlled target, row, identity, command or transport configuration. */
export function createWatchlistRestoreProofFunction(buildProof: string) {
  if (!/^[0-9a-f]{64}$/u.test(buildProof))
    throw new Error("Invalid restore proof build binding");
  return async ({ req, res }: WatchlistRestoreProofContext) => {
    let phase: (typeof WATCHLIST_RESTORE_PROOF_PHASES)[number] | undefined;
    let key: unknown;
    try {
      const { method, path, queryString, bodyText, bodyBinary, headers } = req;
      phase = WATCHLIST_RESTORE_PROOF_PHASES.find(
        (value) => path === `/proof/${value}`,
      );
      if (
        !phase ||
        method !== "POST" ||
        (queryString !== undefined && queryString !== "") ||
        bodyText !== "" ||
        !Buffer.isBuffer(bodyBinary) ||
        bodyBinary.byteLength !== 0
      )
        return res.json({ error: "invalid_proof_request" }, 400, NO_STORE);
      key = headers["x-appwrite-key"];
    } catch {
      return res.json({ error: "invalid_proof_request" }, 400, NO_STORE);
    }
    if (typeof key !== "string" || key.trim() === "" || key.length > 8192)
      return res.json({ error: "proof_authority_unavailable" }, 503, NO_STORE);
    const executionKey = key;
    let report: WatchlistRestoreProofReport;
    try {
      report = await runWatchlistRestoreProof(phase, buildProof, (signal) => {
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
      });
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
