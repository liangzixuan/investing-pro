import {
  MANAGED_CATALOG_LIMITS,
  MANAGED_CATALOG_SEARCH_PATH,
  MANAGED_CATALOG_STATUS_PATH,
  parseManagedCatalogSearch,
  parseManagedCatalogStatus,
} from "@research-cockpit/contracts";

import type { ClerkTrialAuth } from "./clerk-trial-auth";
import type { ManagedCatalogService } from "./managed-workspace-catalog";

export interface ManagedWorkspaceHandlerOptions {
  readonly auth: ClerkTrialAuth;
  readonly catalog: ManagedCatalogService;
}

const ORIGIN = "https://app.investingpro.app";

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

function admitRoute(request: Request): { readonly query: string | null } {
  const url = new URL(request.url);
  validateRequestTarget(request, url);
  validateReadBody(request);
  if (
    url.pathname !== MANAGED_CATALOG_STATUS_PATH &&
    url.pathname !== MANAGED_CATALOG_SEARCH_PATH
  )
    throw new RequestFailure(404, "not_found");
  if (request.method !== "GET" && request.method !== "OPTIONS")
    throw new RequestFailure(405, "method_not_allowed");
  if (url.pathname === MANAGED_CATALOG_STATUS_PATH) {
    if (request.url.includes("?"))
      throw new RequestFailure(400, "invalid_request");
    return { query: null };
  }
  return { query: decodeSearchQuery(url.search) };
}

function preflight(request: Request, headers: Headers): Response {
  const requested = (
    request.headers.get("access-control-request-headers") ?? ""
  )
    .split(",")
    .map((entry) => entry.trim().toLowerCase());
  if (
    request.headers.get("access-control-request-method") !== "GET" ||
    requested.length !== 1 ||
    !["", "authorization"].includes(requested[0] ?? "")
  )
    throw new RequestFailure(403, "origin_denied");
  headers.set("access-control-allow-methods", "GET");
  headers.set("access-control-allow-headers", "Authorization");
  headers.set(
    "vary",
    "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
  );
  return new Response(null, { status: 204, headers });
}

function requireActiveRequest(request: Request): void {
  if (request.signal.aborted) throw new RequestFailure(408, "request_timeout");
}

/** Authenticated catalog reads; composition owns the fixed admitted catalog. */
export function createManagedWorkspaceHandler(
  options: ManagedWorkspaceHandlerOptions,
): (request: Request) => Promise<Response> {
  const { auth: authenticate, catalog } = options;
  return async (request) => {
    const originAllowed = request.headers.get("origin") === ORIGIN;
    const headers = new Headers({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      vary: "Origin",
    });
    if (originAllowed) headers.set("access-control-allow-origin", ORIGIN);
    const respond = (status: number, error: string) =>
      new Response(JSON.stringify({ error }), { status, headers });
    if (!originAllowed) return respond(403, "origin_denied");
    try {
      const { query } = admitRoute(request);
      if (request.method === "OPTIONS") return preflight(request, headers);
      const auth = await authenticate(request);
      if (auth.status !== "allowed")
        return respond(
          auth.status === "access_denied" ? 403 : 401,
          auth.status,
        );
      requireActiveRequest(request);
      const result = query === null ? catalog.status() : catalog.search(query);
      if (query !== null && result === null)
        throw new RequestFailure(400, "invalid_request");
      const parsed =
        query === null
          ? parseManagedCatalogStatus(result)
          : parseManagedCatalogSearch(result);
      if (parsed === null) throw new Error("Invalid catalog response");
      const body = JSON.stringify(parsed);
      if (
        new TextEncoder().encode(body).byteLength >
        MANAGED_CATALOG_LIMITS.responseBytes
      )
        throw new Error("Catalog response exceeds byte limit");
      requireActiveRequest(request);
      return new Response(body, { status: 200, headers });
    } catch (error) {
      return error instanceof RequestFailure
        ? respond(error.status, error.code)
        : respond(503, "unavailable");
    }
  };
}
