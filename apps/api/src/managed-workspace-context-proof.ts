import { createHash } from "node:crypto";

import {
  MANAGED_CATALOG_RESOLVE_LIMITS,
  MANAGED_CATALOG_RESOLVE_PATH,
  MANAGED_CATALOG_SEARCH_PATH,
  MANAGED_WATCHLIST_LIMITS,
  MANAGED_WATCHLIST_PATH,
  type ManagedCatalogStatusDto,
} from "@research-cockpit/contracts";

import {
  CLERK_TRIAL_CATALOG,
  toClerkTrialPayload,
} from "./clerk-trial-catalog";
import {
  bridgeManagedWorkspaceRequest,
  type ManagedWorkspaceFunctionContext,
} from "./managed-workspace-function";
import {
  createManagedWorkspaceHandler,
  MANAGED_WORKSPACE_ORIGIN,
} from "./managed-workspace-handler";

export const MANAGED_CONTEXT_PROOF_MAX_BYTES = 8192;
export const MANAGED_CONTEXT_PROOF_INPUTS = Object.freeze([
  Object.freeze({
    id: "empty_encoded_query",
    method: "GET",
    path: MANAGED_CATALOG_SEARCH_PATH,
    queryString: "q=Invented%2BName+%2525%3F",
    bodyText: "",
    bodyBytes: 0,
    bodySha256:
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    decodedQuery: "Invented+Name %25?",
    responseStatus: 200,
    responseCode: null,
  }),
  Object.freeze({
    id: "multibyte_empty_query",
    method: "POST",
    path: MANAGED_CATALOG_RESOLVE_PATH,
    queryString: "",
    bodyText: '{"probe":"Invented café 🌱"}',
    bodyBytes: 31,
    bodySha256:
      "43e9db7ad4412bcc7580c05c9f8a60b2183b667c93bff5711192d0eebe333c1a",
    decodedQuery: null,
    responseStatus: 400,
    responseCode: "invalid_request",
  }),
] as const);

export interface ManagedContextProofContext {
  readonly req: {
    readonly method: string;
    readonly path: string;
    readonly queryString?: string;
    readonly bodyBinary?: unknown;
  };
  readonly res: ManagedWorkspaceFunctionContext["res"];
}
type ContextInput = (typeof MANAGED_CONTEXT_PROOF_INPUTS)[number];
type ProofCode = "invalid_request" | "payload_too_large" | "unavailable" | null;
interface FixedCase {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly queryString: string;
  readonly body: Buffer;
  readonly bridged: boolean;
  readonly status: number;
  readonly code: ProofCode;
  readonly query?: string;
}
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const HEADERS = Object.freeze({
  origin: MANAGED_WORKSPACE_ORIGIN,
  "content-type": "application/json",
});
const STATUS: ManagedCatalogStatusDto = {
  snapshot: {
    schemaVersion: "1.0.0",
    profile: "personal_single_user_managed_security_master",
    snapshotSha256: CLERK_TRIAL_CATALOG.snapshotSha256,
    catalogId: "invented-context-proof",
    catalogVersion: "1.0.0",
    acquiredAt: "2026-09-29T00:00:00.000Z",
    generatedAt: "2026-09-29T00:00:00.000Z",
    asOf: "2026-09-29T00:00:00.000Z",
    contentKind: "synthetic_engineering",
    attribution: "Invented private runtime proof; no market data.",
    coverage: {
      ...CLERK_TRIAL_CATALOG.coverage,
      basis: "synthetic_engineering_only_not_real_universe",
    },
    sources: [],
    excludedCandidates: [],
  },
};

/** Only the private proof bundle constructs this invented handler dependency. */
function harness() {
  let repositoryOpens = 0;
  let query: string | null = null;
  const handle = createManagedWorkspaceHandler({
    auth: () =>
      Promise.resolve({
        status: "allowed",
        principal: { userId: "invented-context-proof-principal" },
      }),
    catalog: {
      status: () => STATUS,
      search(value) {
        query = value;
        return {
          ...STATUS,
          results: [],
          limitApplied: 25,
          totalMatches: 0,
          normalizedQuery: value,
        };
      },
      resolve() {
        throw new Error("Invented read-only resolution failure");
      },
    },
    openRepository() {
      repositoryOpens++;
      return Promise.reject(
        new Error("Context proof must not open a repository"),
      );
    },
  });
  return { handle, counts: () => ({ repositoryOpens, query }) };
}

function request(input: {
  method: string;
  path: string;
  queryString: string;
  body: Buffer;
}) {
  return bridgeManagedWorkspaceRequest({
    method: input.method,
    path: input.path,
    queryString: input.queryString,
    bodyBinary: input.body,
    headers: HEADERS,
  });
}

function finiteCode(value: unknown): ProofCode | "unexpected" {
  return value === "invalid_request" ||
    value === "payload_too_large" ||
    value === "unavailable"
    ? value
    : "unexpected";
}
async function responseCode(response: Response) {
  if (response.status === 200) return null;
  const value: unknown = await response.json();
  return value !== null && typeof value === "object" && "error" in value
    ? finiteCode(value.error)
    : "unexpected";
}

// Malformed bytes occupy an otherwise valid note. Replacement decoding would
// admit the command and reach the repository trap, so a 400 proves rejection.
function malformedNote(bytes: readonly number[]) {
  const text = JSON.stringify({
    expectedVersion: 0,
    idempotencyKey: "invented-context-command",
    payload: toClerkTrialPayload(["DEMO_A"], "UTF8_MARK"),
  });
  const [before, after] = text.split("UTF8_MARK");
  return Buffer.concat([
    Buffer.from(before!),
    Buffer.from(bytes),
    Buffer.from(after!),
  ]);
}
function multibyteBody(size: number) {
  return Buffer.from(`{"probe":"${"é".repeat((size - 12) / 2)}"}`);
}
function fixedCases(): readonly FixedCase[] {
  const post = (
    id: string,
    body: Buffer,
    path: string = MANAGED_CATALOG_RESOLVE_PATH,
    over = false,
  ): FixedCase => ({
    id,
    method: "POST",
    path,
    queryString: "",
    body,
    bridged: !over,
    status: over ? 413 : 400,
    code: over ? "payload_too_large" : "invalid_request",
  });
  const search = (
    id: string,
    queryString: string,
    bridged = true,
  ): FixedCase => ({
    id,
    method: "GET",
    path: MANAGED_CATALOG_SEARCH_PATH,
    queryString,
    body: Buffer.alloc(0),
    bridged,
    status: 400,
    code: "invalid_request",
  });
  const resolveBody = multibyteBody(
    MANAGED_CATALOG_RESOLVE_LIMITS.requestBytes,
  );
  const watchlistBody = multibyteBody(MANAGED_WATCHLIST_LIMITS.envelopeBytes);
  return [
    post("malformed_utf8", malformedNote([0xc3, 0x28]), MANAGED_WATCHLIST_PATH),
    post(
      "truncated_utf8",
      malformedNote([0xf0, 0x9f, 0x8c]),
      MANAGED_WATCHLIST_PATH,
    ),
    post("resolve_exact_cap", resolveBody),
    post(
      "resolve_over_cap",
      Buffer.concat([resolveBody, Buffer.from(" ")]),
      MANAGED_CATALOG_RESOLVE_PATH,
      true,
    ),
    post("watchlist_exact_cap", watchlistBody, MANAGED_WATCHLIST_PATH),
    post(
      "watchlist_over_cap",
      Buffer.concat([watchlistBody, Buffer.from(" ")]),
      MANAGED_WATCHLIST_PATH,
      true,
    ),
    { ...search("get_nonempty", "q=Invented", false), body: Buffer.from("x") },
    {
      ...post("options_nonempty", Buffer.from("x")),
      method: "OPTIONS",
      bridged: false,
    },
    search("query_tab", "q=Invented\tName", false),
    search("query_newline", "q=Invented\nName", false),
    search("query_space", "q=Invented Name", false),
    search("query_fragment", "q=Invented#Name", false),
    search("leading_query_marker", "?q=Invented", false),
    search("duplicate_query", "q=Invented&q=Other"),
    search("encoded_parameter_name", "%71=Invented"),
    search("malformed_escape", "q=%GG"),
    search("truncated_escape", "q=%E0%A4"),
    {
      ...search("decode_once", "q=%252B+%2B"),
      status: 200,
      code: null,
      query: "%2B +",
    },
    {
      ...post(
        "resolve_failure_read_only",
        Buffer.from(
          JSON.stringify({
            snapshotSha256: STATUS.snapshot.snapshotSha256,
            listingIds: ["trial-listing-a"],
          }),
        ),
      ),
      status: 503,
      code: "unavailable",
    },
  ];
}

async function runFixedCase(input: FixedCase) {
  const runtime = harness();
  let bridged = false;
  let status = 0;
  let code: ProofCode | "unexpected" = "unexpected";
  try {
    const bridgedRequest = request(input);
    bridged = true;
    const response = await runtime.handle(bridgedRequest);
    status = response.status;
    code = await responseCode(response);
  } catch (error) {
    if (error instanceof Error && "status" in error && "code" in error) {
      status = typeof error.status === "number" ? error.status : 0;
      code = finiteCode(error.code);
    }
  }
  const counts = runtime.counts();
  return {
    id: input.id,
    passed:
      bridged === input.bridged &&
      status === input.status &&
      code === input.code &&
      counts.repositoryOpens === 0 &&
      (input.query === undefined || counts.query === input.query),
    bridged,
    status,
    code,
    repositoryOpens: counts.repositoryOpens,
  };
}
async function ownedBufferCheck() {
  const body = Buffer.from(MANAGED_CONTEXT_PROOF_INPUTS[1].bodyText);
  const bridged = request({ ...MANAGED_CONTEXT_PROOF_INPUTS[1], body });
  body.fill(0);
  await Promise.resolve();
  return (
    digest(new Uint8Array(await bridged.arrayBuffer())) ===
    MANAGED_CONTEXT_PROOF_INPUTS[1].bodySha256
  );
}

export function isManagedContextProofRequest(
  req: ManagedContextProofContext["req"],
) {
  return MANAGED_CONTEXT_PROOF_INPUTS.some(
    (input) => req.method === input.method && req.path === input.path,
  );
}

async function observe(
  req: ManagedContextProofContext["req"],
  input: ContextInput,
) {
  const body = req.bodyBinary;
  const method = req.method;
  const path = req.path;
  const queryString = req.queryString;
  const methodMatches = method === input.method;
  const pathMatches = path === input.path;
  const bodyIsBuffer = Buffer.isBuffer(body);
  const bodyBytes = bodyIsBuffer ? body.byteLength : null;
  const bodySha256 =
    bodyIsBuffer && body.byteLength <= MANAGED_CONTEXT_PROOF_MAX_BYTES
      ? digest(body)
      : null;
  const queryMatches = queryString === input.queryString;
  const bodyMatches =
    bodyBytes === input.bodyBytes && bodySha256 === input.bodySha256;
  const runtime = harness();
  let bytesPreserved = false;
  let queryPreserved = false;
  let status = 0;
  let code: ProofCode | "unexpected" = "unexpected";
  if (
    bodyIsBuffer &&
    bodyMatches &&
    queryMatches &&
    methodMatches &&
    pathMatches &&
    typeof queryString === "string"
  ) {
    const bridged = request({ method, path, queryString, body });
    queryPreserved =
      bridged.url ===
      `https://managed-workspace.invalid${input.path}${input.queryString ? `?${input.queryString}` : ""}`;
    bytesPreserved =
      digest(new Uint8Array(await bridged.clone().arrayBuffer())) ===
      bodySha256;
    const response = await runtime.handle(bridged);
    status = response.status;
    code = await responseCode(response);
  }
  const counts = runtime.counts();
  return {
    id: input.id,
    methodMatches,
    pathMatches,
    bodyIsBuffer,
    bodyBytes,
    bodySha256,
    queryMatches,
    bodyMatches,
    bytesPreserved,
    queryPreserved,
    status,
    code,
    repositoryOpens: counts.repositoryOpens,
    passed:
      bodyIsBuffer &&
      methodMatches &&
      pathMatches &&
      bodyMatches &&
      queryMatches &&
      bytesPreserved &&
      queryPreserved &&
      status === input.responseStatus &&
      code === input.responseCode &&
      counts.repositoryOpens === 0 &&
      counts.query === input.decodedQuery,
  };
}

/** Private execution only. No input headers, authority, storage or transport are read. */
export function createManagedContextProofFunction(buildProof: string) {
  if (!/^[0-9a-f]{64}$/u.test(buildProof))
    throw new Error("Invalid context proof build");
  return async ({ req, res }: ManagedContextProofContext) => {
    const headers = { "cache-control": "no-store" };
    const input = MANAGED_CONTEXT_PROOF_INPUTS.find(
      (item) => req.method === item.method && req.path === item.path,
    );
    if (!input)
      return res.json({ error: "invalid_context_proof_request" }, 400, headers);
    try {
      const actualContext = await observe(req, input);
      // Synthetic checks cannot replace a failed actual input observation.
      const fixed = actualContext.passed
        ? await Promise.all(fixedCases().map(runFixedCase))
        : [];
      const ownedBuffer = actualContext.passed && (await ownedBufferCheck());
      const passed =
        actualContext.passed &&
        ownedBuffer &&
        fixed.every((item) => item.passed);
      const report = {
        version: 1,
        buildProof,
        outcome: passed ? "passed" : "failed",
        nodeVersion: /^v\d+\.\d+\.\d+$/u.test(process.version)
          ? process.version
          : "unrecognized",
        actualContext,
        syntheticInRuntime: { checks: fixed, ownedBuffer },
        repositoryOpens:
          actualContext.repositoryOpens +
          fixed.reduce((sum, item) => sum + item.repositoryOpens, 0),
        // The fixed harness has no outbound port; a repository attempt fails above.
        outboundDispatches: 0,
      };
      if (
        Buffer.byteLength(JSON.stringify(report)) >
        MANAGED_CONTEXT_PROOF_MAX_BYTES
      )
        throw new Error("Context proof report exceeded its cap");
      return res.json(report, passed ? 200 : 409, headers);
    } catch {
      return res.json(
        { error: "context_proof_failed", buildProof },
        409,
        headers,
      );
    }
  };
}
