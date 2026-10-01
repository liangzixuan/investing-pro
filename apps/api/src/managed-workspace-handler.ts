import { createHash } from "node:crypto";

import {
  MANAGED_CATALOG_LIMITS,
  MANAGED_CATALOG_RESOLVE_LIMITS,
  MANAGED_CATALOG_RESOLVE_PATH,
  MANAGED_CATALOG_SEARCH_PATH,
  MANAGED_CATALOG_STATUS_PATH,
  MANAGED_WATCHLIST_LIMITS,
  MANAGED_WATCHLIST_PATH,
  encodeMainWatchlistPayload,
  parseManagedCatalogResolveRequest,
  parseManagedCatalogResolveResponse,
  parseManagedCatalogSearch,
  parseManagedCatalogStatus,
  parseManagedWatchlist,
  parseManagedWatchlistCommand,
  parseManagedWatchlistReceipt,
  type ManagedWatchlistCommand,
} from "@research-cockpit/contracts";

import type { ClerkTrialAuth } from "./clerk-trial-auth";
import type { ManagedCatalogService } from "./managed-workspace-catalog";
import {
  WatchlistRepositoryError,
  type MainWatchlistReceipt,
  type MainWatchlistRecord,
  type MainWatchlistRepository,
} from "./watchlist-repository";

export interface ManagedWorkspaceRepositoryOperation {
  readonly repository: MainWatchlistRepository;
  close(): Promise<void>;
}
export interface ManagedWorkspaceHandlerOptions {
  readonly auth: ClerkTrialAuth;
  readonly catalog: ManagedCatalogService;
  readonly openRepository: (
    signal: AbortSignal,
  ) => Promise<ManagedWorkspaceRepositoryOperation>;
}

export const MANAGED_WORKSPACE_ORIGIN = "https://app.investingpro.app";
const PATHS: readonly string[] = [
  MANAGED_CATALOG_STATUS_PATH,
  MANAGED_CATALOG_SEARCH_PATH,
  MANAGED_CATALOG_RESOLVE_PATH,
  MANAGED_WATCHLIST_PATH,
];

class RequestFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function validateRequestTarget(request: Request, url: URL): void {
  if (
    url.pathname.length + url.search.length + url.hash.length >
      MANAGED_CATALOG_LIMITS.maximumRequestTargetCodeUnits ||
    url.username ||
    url.password ||
    request.url.includes("#")
  )
    throw new RequestFailure(400, "invalid_request");
}

function validateReadBody(request: Request): void {
  if (
    request.body !== null ||
    request.headers.has("content-encoding") ||
    (request.headers.has("content-length") &&
      request.headers.get("content-length") !== "0")
  )
    throw new RequestFailure(400, "invalid_request");
}

function decodeSearchQuery(search: string): string {
  const encodedQuery = /^\?q=([^&]*)$/u.exec(search)?.[1];
  if (encodedQuery === undefined)
    throw new RequestFailure(400, "invalid_request");
  let query: string;
  try {
    query = decodeURIComponent(encodedQuery.replaceAll("+", " "));
  } catch {
    throw new RequestFailure(400, "invalid_request");
  }
  if ([...query].length > MANAGED_CATALOG_LIMITS.searchQueryCodePoints)
    throw new RequestFailure(400, "invalid_request");
  return query;
}

function methods(path: string): readonly string[] {
  if (path === MANAGED_WATCHLIST_PATH) return ["GET", "POST"];
  return path === MANAGED_CATALOG_RESOLVE_PATH ? ["POST"] : ["GET"];
}

function admitRoute(request: Request) {
  const url = new URL(request.url);
  validateRequestTarget(request, url);
  // Preserve catalog read admission order; write bytes are admitted after auth.
  if (
    request.method !== "POST" ||
    !(
      [
        MANAGED_WATCHLIST_PATH,
        MANAGED_CATALOG_RESOLVE_PATH,
      ] as readonly string[]
    ).includes(url.pathname)
  )
    validateReadBody(request);
  if (!PATHS.includes(url.pathname)) throw new RequestFailure(404, "not_found");
  if (
    request.method !== "OPTIONS" &&
    !methods(url.pathname).includes(request.method)
  )
    throw new RequestFailure(405, "method_not_allowed");
  if (url.pathname === MANAGED_CATALOG_SEARCH_PATH)
    return { path: url.pathname, query: decodeSearchQuery(url.search) };
  if (request.url.includes("?"))
    throw new RequestFailure(400, "invalid_request");
  return { path: url.pathname, query: null };
}

function preflight(request: Request, path: string, headers: Headers): Response {
  const allowed = methods(path);
  const requested = (
    request.headers.get("access-control-request-headers") ?? ""
  )
    .split(",")
    .map((entry) => entry.trim().toLowerCase());
  const permitted = allowed.includes("POST")
    ? ["authorization", "content-type"]
    : ["authorization"];
  if (
    !allowed.includes(
      request.headers.get("access-control-request-method") ?? "",
    ) ||
    new Set(requested).size !== requested.length ||
    (requested.length > 1 && requested.includes("")) ||
    requested.some((name) => name !== "" && !permitted.includes(name))
  )
    throw new RequestFailure(403, "origin_denied");
  headers.set("access-control-allow-methods", allowed.join(", "));
  headers.set(
    "access-control-allow-headers",
    allowed.includes("POST") ? "Authorization, Content-Type" : "Authorization",
  );
  headers.set(
    "vary",
    "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
  );
  return new Response(null, { status: 204, headers });
}

function requireActiveRequest(request: Request): void {
  if (request.signal.aborted) throw new RequestFailure(408, "request_timeout");
}

async function readJson(request: Request, maximum: number): Promise<unknown> {
  if (
    !/^application\/json(?:;\s*charset=utf-8)?$/iu.test(
      request.headers.get("content-type") ?? "",
    ) ||
    request.headers.has("content-encoding")
  )
    throw new RequestFailure(415, "unsupported_media_type");
  const length = request.headers.get("content-length");
  if (
    length !== null &&
    (!/^(0|[1-9][0-9]*)$/u.test(length) || Number(length) > maximum)
  )
    throw new RequestFailure(413, "payload_too_large");
  if (request.body === null) throw new RequestFailure(400, "invalid_request");
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stop: () => void = () => undefined;
  const deadline = new Promise<never>((_, reject) => {
    stop = () => reject(new RequestFailure(408, "request_timeout"));
    timer = setTimeout(stop, 2000);
    request.signal.addEventListener("abort", stop, { once: true });
    if (request.signal.aborted) stop();
  });
  try {
    while (true) {
      const item = await Promise.race([reader.read(), deadline]);
      if (item.done) break;
      size += item.value.byteLength;
      if (size > maximum) throw new RequestFailure(413, "payload_too_large");
      chunks.push(Buffer.from(item.value));
    }
    requireActiveRequest(request);
    if (length !== null && Number(length) !== size)
      throw new RequestFailure(400, "invalid_request");
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    ) as unknown;
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure(400, "invalid_request");
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", stop);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function jsonResponse(
  value: unknown,
  maximum: number,
  headers: Headers,
): Response {
  if (value === null) throw new Error("Invalid managed response");
  const body = JSON.stringify(value);
  if (Buffer.byteLength(body) > maximum)
    throw new Error("Managed response exceeds byte limit");
  return new Response(body, { status: 200, headers });
}

function readResult(
  record: MainWatchlistRecord | null,
  catalog: ManagedCatalogService,
) {
  if (record !== null && (record.id !== "main" || record.version < 1))
    throw new Error("Invalid watchlist record");
  return parseManagedWatchlist(
    record === null
      ? {
          version: 0,
          payload: {
            schemaVersion: 1,
            name: "My Watchlist",
            snapshotSha256: catalog.status().snapshot.snapshotSha256,
            memberships: [],
          },
        }
      : { version: record.version, payload: record.payload },
  );
}

function writeResult(
  receipt: MainWatchlistReceipt,
  command: ManagedWatchlistCommand,
) {
  const digest = createHash("sha256")
    .update(encodeMainWatchlistPayload(command.payload))
    .digest("hex");
  if (receipt.id !== "main" || receipt.digestSha256 !== digest)
    throw new Error("Invalid watchlist receipt");
  return parseManagedWatchlistReceipt(
    {
      version: receipt.version,
      payload: command.payload,
      replayed: receipt.replayed,
    },
    command,
  );
}

function errorResponse(
  error: unknown,
  writeStarted: boolean,
  repositoryOpened: boolean,
  headers: Headers,
): Response {
  let status = 503,
    code = writeStarted ? "commit_unknown" : "unavailable";
  if (error instanceof RequestFailure) {
    status = error.status;
    code = error.code;
  } else if (
    repositoryOpened &&
    error instanceof WatchlistRepositoryError &&
    error.code !== "invalid_response"
  ) {
    code =
      error.code === "commit_unknown" && !writeStarted
        ? "unavailable"
        : error.code;
    status =
      code === "invalid_request"
        ? 400
        : code === "access_denied"
          ? 403
          : ["conflict", "idempotency_conflict"].includes(code)
            ? 409
            : 503;
  }
  return new Response(JSON.stringify({ error: code }), { status, headers });
}

/** Auth, request retirement and the per-operation repository lifetime stay here. */
export function createManagedWorkspaceHandler(
  options: ManagedWorkspaceHandlerOptions,
): (request: Request) => Promise<Response> {
  const { auth: authenticate, catalog, openRepository } = options;
  return async (request) => {
    const originAllowed =
      request.headers.get("origin") === MANAGED_WORKSPACE_ORIGIN;
    const headers = new Headers({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      vary: "Origin",
    });
    if (originAllowed)
      headers.set("access-control-allow-origin", MANAGED_WORKSPACE_ORIGIN);
    const fail = (status: number, code: string) =>
      errorResponse(new RequestFailure(status, code), false, false, headers);
    if (!originAllowed) return fail(403, "origin_denied");
    let operation: ManagedWorkspaceRepositoryOperation | undefined;
    let writeStarted = false;
    let response: Response;
    try {
      const route = admitRoute(request);
      if (request.method === "OPTIONS")
        return preflight(request, route.path, headers);
      const auth = await authenticate(request);
      if (auth.status !== "allowed")
        return fail(auth.status === "access_denied" ? 403 : 401, auth.status);
      requireActiveRequest(request);
      if (
        route.path === MANAGED_CATALOG_STATUS_PATH ||
        route.path === MANAGED_CATALOG_SEARCH_PATH
      ) {
        const value =
          route.query === null
            ? parseManagedCatalogStatus(catalog.status())
            : (() => {
                const result = catalog.search(route.query);
                if (result === null)
                  throw new RequestFailure(400, "invalid_request");
                return parseManagedCatalogSearch(result);
              })();
        response = jsonResponse(
          value,
          MANAGED_CATALOG_LIMITS.responseBytes,
          headers,
        );
        requireActiveRequest(request);
        return response;
      }
      if (route.path === MANAGED_CATALOG_RESOLVE_PATH) {
        const command = parseManagedCatalogResolveRequest(
          await readJson(request, MANAGED_CATALOG_RESOLVE_LIMITS.requestBytes),
        );
        if (command === null) throw new RequestFailure(400, "invalid_request");
        requireActiveRequest(request);
        const result = catalog.resolve(command);
        if (result === null) throw new RequestFailure(409, "catalog_changed");
        response = jsonResponse(
          parseManagedCatalogResolveResponse(result, command),
          MANAGED_CATALOG_RESOLVE_LIMITS.responseBytes,
          headers,
        );
        requireActiveRequest(request);
        return response;
      }
      const command =
        request.method === "POST"
          ? parseManagedWatchlistCommand(
              await readJson(request, MANAGED_WATCHLIST_LIMITS.envelopeBytes),
            )
          : undefined;
      if (command === null) throw new RequestFailure(400, "invalid_request");
      requireActiveRequest(request);
      operation = await openRepository(request.signal);
      requireActiveRequest(request);
      if (command) {
        writeStarted = true;
        const receipt = await operation.repository.put(auth.principal, command);
        if (request.signal.aborted) throw new Error("Write response retired");
        response = jsonResponse(
          writeResult(receipt, command),
          MANAGED_WATCHLIST_LIMITS.envelopeBytes,
          headers,
        );
      } else {
        const record = await operation.repository.get(auth.principal);
        requireActiveRequest(request);
        response = jsonResponse(
          readResult(record, catalog),
          MANAGED_WATCHLIST_LIMITS.envelopeBytes,
          headers,
        );
      }
    } catch (error) {
      response = errorResponse(
        error,
        writeStarted,
        operation !== undefined,
        headers,
      );
    } finally {
      if (operation) {
        try {
          await operation.close();
        } catch {
          response = errorResponse(undefined, writeStarted, true, headers);
        }
      }
    }
    if (request.signal.aborted && response.status === 200)
      return errorResponse(
        writeStarted
          ? new Error("Write response retired")
          : new RequestFailure(408, "request_timeout"),
        writeStarted,
        operation !== undefined,
        headers,
      );
    return response;
  };
}
