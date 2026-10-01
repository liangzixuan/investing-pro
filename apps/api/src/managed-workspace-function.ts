import {
  MANAGED_CATALOG_LIMITS,
  MANAGED_CATALOG_RESOLVE_LIMITS,
  MANAGED_CATALOG_RESOLVE_PATH,
  MANAGED_CATALOG_SEARCH_PATH,
  MANAGED_CATALOG_STATUS_PATH,
  MANAGED_WATCHLIST_LIMITS,
  MANAGED_WATCHLIST_PATH,
  MANAGED_SEC_ANNUAL_EVIDENCE_PATH,
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
} from "@research-cockpit/contracts";
import { TablesDB } from "node-appwrite";

import { createAppwriteTransport } from "./appwrite-transport";
import {
  appwriteWatchlistStore,
  createAppwriteWatchlistRepository,
} from "./appwrite-watchlist-repository";
import { createClerkTrialAuth } from "./clerk-trial-auth";
import { validateClerkTrialFunctionConfiguration } from "./clerk-trial-config";
import { validateManagedSecAnnualConfiguration } from "./managed-sec-annual-config";
import {
  createManagedSecAnnualAdmission,
  MANAGED_SEC_ADMISSION_LIMITS,
} from "./managed-sec-annual-admission";
import {
  createManagedSecAnnualService,
  awaitManagedSecAnnual,
  ManagedSecAnnualServiceError,
} from "./managed-sec-annual-service";
import {
  createManagedCatalogService,
  getManagedWorkspaceCatalog,
} from "./managed-workspace-catalog";
import {
  createManagedWorkspaceHandler,
  getManagedWorkspaceOrigin,
  MANAGED_WORKSPACE_NATIVE_ORIGIN,
} from "./managed-workspace-handler";

export interface ManagedWorkspaceFunctionContext {
  readonly req: {
    readonly method: string;
    readonly path: string;
    /** The runtime supplies encoded query text without the leading question mark. */
    readonly queryString?: string;
    readonly bodyBinary: Buffer;
    readonly headers: Readonly<Record<string, string | undefined>>;
  };
  readonly res: {
    json(
      body: unknown,
      status: number,
      headers: Record<string, string>,
    ): unknown;
    text(
      body: string,
      status: number,
      headers: Record<string, string>,
    ): unknown;
  };
}

declare const __MANAGED_WORKSPACE_SERVER_CONFIG__: unknown;
declare const __MANAGED_SEC_ANNUAL_CONFIG__: unknown;
const PATHS: readonly string[] = [
  MANAGED_CATALOG_STATUS_PATH,
  MANAGED_CATALOG_SEARCH_PATH,
  MANAGED_CATALOG_RESOLVE_PATH,
  MANAGED_WATCHLIST_PATH,
  MANAGED_SEC_ANNUAL_EVIDENCE_PATH,
];
const FORWARDED_HEADERS = [
  "authorization",
  "origin",
  "cookie",
  "content-type",
  "content-encoding",
  "content-length",
  "access-control-request-method",
  "access-control-request-headers",
];

class BridgeFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export function bridgeManagedWorkspaceRequest(
  req: ManagedWorkspaceFunctionContext["req"],
): Request {
  if (!PATHS.includes(req.path)) throw new BridgeFailure(404, "not_found");
  const query = req.queryString === undefined ? "" : req.queryString;
  // URL constructors erase controls and escape some visible characters. Admit the
  // supplied context text first; an erased original HTTP marker is unrecoverable.
  if (
    typeof query !== "string" ||
    !/^[A-Za-z0-9._~!$&()*+,;=:@/?%+-]*$/u.test(query) ||
    query.startsWith("?") ||
    req.path.length + (query === "" ? 0 : query.length + 1) >
      MANAGED_CATALOG_LIMITS.maximumRequestTargetCodeUnits
  )
    throw new BridgeFailure(400, "invalid_request");
  if (query !== "" && req.path !== MANAGED_CATALOG_SEARCH_PATH)
    throw new BridgeFailure(400, "invalid_request");
  if (!Buffer.isBuffer(req.bodyBinary))
    throw new BridgeFailure(400, "invalid_request");
  const maximum =
    req.path === MANAGED_WATCHLIST_PATH
      ? MANAGED_WATCHLIST_LIMITS.envelopeBytes
      : req.path === MANAGED_SEC_ANNUAL_EVIDENCE_PATH
        ? MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.requestBytes
        : MANAGED_CATALOG_RESOLVE_LIMITS.requestBytes;
  if (req.bodyBinary.byteLength > maximum)
    throw new BridgeFailure(413, "payload_too_large");
  if (req.method !== "POST" && req.bodyBinary.byteLength !== 0)
    throw new BridgeFailure(400, "invalid_request");
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = req.headers[name];
    if (value !== undefined) headers.set(name, value);
  }
  const target = `https://managed-workspace.invalid${req.path}${query === "" ? "" : `?${query}`}`;
  try {
    return new Request(target, {
      method: req.method,
      headers,
      ...(req.method === "POST" ? { body: Buffer.from(req.bodyBinary) } : {}),
    });
  } catch {
    throw new BridgeFailure(400, "invalid_request");
  }
}

/** Managed web/native admission; execution authority stays scoped per operation. */
export function createManagedWorkspaceFunction(
  input: unknown,
  annualInput: unknown,
) {
  const checked = validateClerkTrialFunctionConfiguration(input);
  const annualConfiguration =
    validateManagedSecAnnualConfiguration(annualInput);
  if (checked.environment !== "production")
    throw new Error("Managed function requires production configuration");
  const webAuth = createClerkTrialAuth(checked.auth);
  const nativeAuth = createClerkTrialAuth({
    ...checked.auth,
    authorizedParties: [MANAGED_WORKSPACE_NATIVE_ORIGIN],
    nativeOrigin: MANAGED_WORKSPACE_NATIVE_ORIGIN,
  });
  const catalog = createManagedCatalogService();
  return async (
    { req, res }: ManagedWorkspaceFunctionContext,
    entry?: Readonly<{ startedAt: number; enteredAt: string }>,
  ) => {
    const startedAt = entry?.startedAt ?? performance.now();
    const enteredAt = entry?.enteredAt ?? new Date().toISOString();
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      vary: "Origin",
    };
    const origin = getManagedWorkspaceOrigin(req.headers.origin);
    if (origin === null)
      return res.json({ error: "origin_denied" }, 403, headers);
    headers["access-control-allow-origin"] = origin;
    let dispatchedWrite = false;
    const annualController =
      req.path === MANAGED_SEC_ANNUAL_EVIDENCE_PATH
        ? new AbortController()
        : undefined;
    const annualTimer =
      annualController === undefined
        ? undefined
        : setTimeout(
            () => annualController.abort(),
            Math.max(1, 10_000 - (performance.now() - startedAt)),
          );
    annualTimer?.unref();
    try {
      const bridged = bridgeManagedWorkspaceRequest(req);
      const request = annualController
        ? new Request(bridged, { signal: annualController.signal })
        : bridged;
      // Copy the supplied authority before auth awaits; it is never user authority.
      const executionKey = req.headers["x-appwrite-key"];
      const handle = createManagedWorkspaceHandler({
        auth:
          request.headers.get("origin") === MANAGED_WORKSPACE_NATIVE_ORIGIN
            ? nativeAuth
            : webAuth,
        catalog,
        ...(annualController === undefined
          ? {}
          : {
              annual: createManagedSecAnnualService({
                configuration: annualConfiguration,
                catalog: getManagedWorkspaceCatalog(),
                enteredAt,
                startedAt,
                openAdmission(signal, remainingMs) {
                  if (!executionKey)
                    throw new Error("Execution authority unavailable");
                  const transport = createAppwriteTransport({
                    endpoint: "https://nyc.cloud.appwrite.io/v1",
                    signal,
                    limits: {
                      timeoutMs: remainingMs,
                      mutationWindowMs: remainingMs,
                      requestTimeoutMs: remainingMs,
                      maxRequests: MANAGED_SEC_ADMISSION_LIMITS.maxRequests,
                    },
                  });
                  try {
                    transport.client
                      .setProject("6abac57a0007b7c1a671")
                      .setKey(executionKey);
                    return {
                      admission: createManagedSecAnnualAdmission({
                        store: appwriteWatchlistStore(
                          new TablesDB(transport.client),
                        ),
                        databaseId: "investment_managed_watchlist_v1",
                        tableId: "sec_annual_budget",
                        rowId: "observed-annual-v1",
                      }),
                      close: () => transport.close(),
                    };
                  } catch {
                    void transport.close().catch(() => undefined);
                    throw new Error("Managed annual storage unavailable");
                  }
                },
              }),
            }),
        async openRepository(signal) {
          if (!executionKey) throw new Error("Execution authority unavailable");
          const transport = createAppwriteTransport({
            endpoint: "https://nyc.cloud.appwrite.io/v1",
            signal,
          });
          try {
            transport.client
              .setProject("6abac57a0007b7c1a671")
              .setKey(executionKey);
            return {
              repository: createAppwriteWatchlistRepository({
                store: appwriteWatchlistStore(new TablesDB(transport.client)),
                databaseId: "investment_managed_watchlist_v1",
                watchlistsTableId: "watchlists",
                receiptsTableId: "receipts",
                catalog: getManagedWorkspaceCatalog(),
              }),
              close: () => transport.close(),
            };
          } catch {
            await transport.close();
            throw new Error("Managed storage unavailable");
          }
        },
      });
      dispatchedWrite =
        req.method === "POST" && req.path === MANAGED_WATCHLIST_PATH;
      const response = await (annualController
        ? awaitManagedSecAnnual(handle(request), annualController.signal)
        : handle(request));
      const body = await response.text();
      if (
        annualController &&
        (annualController.signal.aborted ||
          performance.now() - startedAt >= 10_000)
      )
        throw new ManagedSecAnnualServiceError("request_timeout");
      return res.text(
        body,
        response.status,
        Object.fromEntries(response.headers.entries()),
      );
    } catch (error) {
      return res.json(
        {
          error:
            error instanceof BridgeFailure
              ? error.code
              : error instanceof ManagedSecAnnualServiceError
                ? error.code
                : dispatchedWrite
                  ? "commit_unknown"
                  : "unavailable",
        },
        error instanceof BridgeFailure
          ? error.status
          : error instanceof ManagedSecAnnualServiceError &&
              error.code === "request_timeout"
            ? 408
            : 503,
        headers,
      );
    } finally {
      clearTimeout(annualTimer);
      annualController?.abort();
    }
  };
}

export default async function main(context: ManagedWorkspaceFunctionContext) {
  const startedAt = performance.now();
  const enteredAt = new Date().toISOString();
  return createManagedWorkspaceFunction(
    __MANAGED_WORKSPACE_SERVER_CONFIG__,
    __MANAGED_SEC_ANNUAL_CONFIG__,
  )(context, Object.freeze({ startedAt, enteredAt }));
}
