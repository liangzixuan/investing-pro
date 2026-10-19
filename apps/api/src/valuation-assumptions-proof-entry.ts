import { Query, TablesDB } from "node-appwrite";
import { createAppwriteTransport } from "./appwrite-transport";
import { appwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import {
  VALUATION_PROOF_PHASES,
  VALUATION_PROOF_TARGET,
  type ValuationProofPhase,
} from "./valuation-assumptions-proof-data";
import {
  runValuationAssumptionsStorageProof,
  type ValuationProofOperation,
} from "./valuation-assumptions-storage-proof";

export interface ValuationProofContext {
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
type Request = ValuationProofContext["req"];
type Capture =
  | { readonly phase: ValuationProofPhase; readonly key: string }
  | { readonly error: "invalid_proof_request"; readonly status: 400 }
  | { readonly error: "proof_authority_unavailable"; readonly status: 503 };
const NO_STORE = { "cache-control": "no-store" };

function queryFree(value: unknown): boolean {
  return value === undefined || value === "";
}
function emptyBinary(value: unknown): boolean {
  if (!Buffer.isBuffer(value)) return false;
  return value.byteLength === 0;
}
function requestPhase(req: Request): ValuationProofPhase | undefined {
  const { method, path, queryString, bodyText, bodyBinary } = req;
  if (method !== "POST") return undefined;
  if (!queryFree(queryString)) return undefined;
  if (bodyText !== "") return undefined;
  if (!emptyBinary(bodyBinary)) return undefined;
  return VALUATION_PROOF_PHASES.find((phase) => path === `/proof/${phase}`);
}
function executionKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length > 8192) return false;
  return value.trim() !== "";
}
function captureRequest(req: Request): Capture {
  try {
    const phase = requestPhase(req);
    if (!phase) return { error: "invalid_proof_request", status: 400 };
    const key = req.headers["x-appwrite-key"];
    if (!executionKey(key))
      return { error: "proof_authority_unavailable", status: 503 };
    return { phase, key };
  } catch {
    return { error: "invalid_proof_request", status: 400 };
  }
}

async function metadata(tables: TablesDB) {
  const database = await tables.get({
    databaseId: VALUATION_PROOF_TARGET.databaseId,
  });
  const tableList = await tables.listTables({
    databaseId: VALUATION_PROOF_TARGET.databaseId,
    queries: [Query.limit(3)],
    total: true,
  });
  return { database, tableList };
}
function openOperation(
  signal: AbortSignal,
  key: string,
): ValuationProofOperation {
  const transport = createAppwriteTransport({
    endpoint: VALUATION_PROOF_TARGET.endpoint,
    signal,
  });
  let configured = false;
  const tables = () => {
    if (!configured) {
      transport.client.setProject(VALUATION_PROOF_TARGET.project).setKey(key);
      configured = true;
    }
    return new TablesDB(transport.client);
  };
  return {
    newStore: () => appwriteVersionedRowStore(tables()),
    metadata: () => metadata(tables()),
    snapshot: transport.snapshot,
    close: () => transport.close(),
  };
}

/** Only a fixed empty phase request can reach the bounded server composition. */
export function createValuationAssumptionsProofFunction(buildProof: string) {
  if (!/^[0-9a-f]{64}$/u.test(buildProof))
    throw new Error("Invalid proof build binding");
  return async ({ req, res }: ValuationProofContext) => {
    const captured = captureRequest(req);
    if ("error" in captured)
      return res.json({ error: captured.error }, captured.status, NO_STORE);
    try {
      const report = await runValuationAssumptionsStorageProof(
        captured.phase,
        buildProof,
        (signal) => openOperation(signal, captured.key),
      );
      return res.json(
        report,
        report.outcome === "passed" ? 200 : 409,
        NO_STORE,
      );
    } catch {
      return res.json({ error: "proof_unavailable" }, 503, NO_STORE);
    }
  };
}

declare const __VALUATION_PROOF_BUILD__: string;
export default function main(context: ValuationProofContext) {
  return createValuationAssumptionsProofFunction(__VALUATION_PROOF_BUILD__)(
    context,
  );
}
