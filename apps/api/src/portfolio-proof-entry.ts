import { TablesDB } from "node-appwrite";
import { createAppwriteTransport } from "./appwrite-transport";
import { appwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import {
  PORTFOLIO_PROOF_PHASES,
  PORTFOLIO_PROOF_TARGET,
} from "./portfolio-proof-data";
import {
  runPortfolioStorageProof,
  type PortfolioProofReport,
} from "./portfolio-storage-proof";

export interface PortfolioProofContext {
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

/** The request selects one fixed phase. Authority is captured before any await. */
export function createPortfolioProofFunction(buildProof: string) {
  if (!/^[0-9a-f]{64}$/u.test(buildProof))
    throw new Error("Invalid proof build binding");
  return async ({ req, res }: PortfolioProofContext) => {
    let phase: (typeof PORTFOLIO_PROOF_PHASES)[number] | undefined;
    let key: unknown;
    try {
      const { method, path, queryString, bodyText, bodyBinary, headers } = req;
      phase = PORTFOLIO_PROOF_PHASES.find(
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
    let report: PortfolioProofReport;
    try {
      report = await runPortfolioStorageProof(phase, buildProof, (signal) => {
        const transport = createAppwriteTransport({
          endpoint: PORTFOLIO_PROOF_TARGET.endpoint,
          signal,
        });
        let configured = false;
        return {
          newStore: () => {
            // The runner owns cleanup before SDK configuration can fail.
            if (!configured) {
              transport.client
                .setProject(PORTFOLIO_PROOF_TARGET.project)
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

declare const __PORTFOLIO_PROOF_BUILD__: string;
export default function main(context: PortfolioProofContext) {
  return createPortfolioProofFunction(__PORTFOLIO_PROOF_BUILD__)(context);
}
