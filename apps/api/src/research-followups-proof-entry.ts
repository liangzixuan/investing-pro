import { TablesDB } from "node-appwrite";
import { createAppwriteTransport } from "./appwrite-transport";
import { appwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import {
  FOLLOWUPS_PROOF_PHASES,
  FOLLOWUPS_PROOF_TARGET,
} from "./research-followups-proof-data";
import { runResearchFollowupsStorageProof } from "./research-followups-storage-proof";

export interface ResearchFollowupsProofContext {
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

/** Only fixed phase selection is admitted. The platform execution key is captured before awaiting. */
export function createResearchFollowupsProofFunction(buildProof: string) {
  if (!/^[0-9a-f]{64}$/u.test(buildProof))
    throw new Error("Invalid proof build binding");
  return async ({ req, res }: ResearchFollowupsProofContext) => {
    let phase: (typeof FOLLOWUPS_PROOF_PHASES)[number] | undefined;
    let key: unknown;
    try {
      const { method, path, queryString, bodyText, bodyBinary, headers } = req;
      phase = FOLLOWUPS_PROOF_PHASES.find(
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
    const report = await runResearchFollowupsStorageProof(
      phase,
      buildProof,
      (signal) => {
        const transport = createAppwriteTransport({
          endpoint: FOLLOWUPS_PROOF_TARGET.endpoint,
          signal,
        });
        transport.client
          .setProject(FOLLOWUPS_PROOF_TARGET.project)
          .setKey(executionKey);
        return {
          newStore: () =>
            appwriteVersionedRowStore(new TablesDB(transport.client)),
          snapshot: transport.snapshot,
          close: () => transport.close(),
        };
      },
    );
    return res.json(report, report.outcome === "passed" ? 200 : 409, NO_STORE);
  };
}
declare const __FOLLOWUPS_PROOF_BUILD__: string;
export default function main(context: ResearchFollowupsProofContext) {
  return createResearchFollowupsProofFunction(__FOLLOWUPS_PROOF_BUILD__)(
    context,
  );
}
