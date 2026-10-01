import {
  MANAGED_CATALOG_LIMITS,
  MANAGED_CATALOG_RESOLVE_LIMITS,
  MANAGED_CATALOG_RESOLVE_PATH,
  MANAGED_CATALOG_SEARCH_PATH,
  MANAGED_CATALOG_STATUS_PATH,
  MANAGED_WATCHLIST_LIMITS,
  MANAGED_WATCHLIST_PATH,
  parseManagedCatalogResolveRequest,
  parseManagedCatalogResolveResponse,
  parseManagedCatalogSearch,
  parseManagedCatalogStatus,
  parseManagedWatchlist,
  parseManagedWatchlistCommand,
  parseManagedWatchlistReceipt,
  type ManagedCatalogResolveRequest,
  type ManagedCatalogResolveResponse,
  type ManagedCatalogSearchDto,
  type ManagedCatalogStatusDto,
  type ManagedWatchlistCommand,
  type ManagedWatchlistDto,
  type ManagedWatchlistReceiptDto,
} from "@research-cockpit/contracts";
import { TrialApiError, validateApiOrigin, type TrialErrorCode } from "./api";
import type { TrialSession } from "./session";

export interface ManagedApi {
  status: (signal: AbortSignal) => Promise<ManagedCatalogStatusDto>;
  search: (
    query: string,
    signal: AbortSignal,
  ) => Promise<ManagedCatalogSearchDto>;
  resolve: (
    request: ManagedCatalogResolveRequest,
    signal: AbortSignal,
  ) => Promise<ManagedCatalogResolveResponse>;
  load: (signal: AbortSignal) => Promise<ManagedWatchlistDto>;
  save: (
    command: ManagedWatchlistCommand,
    signal: AbortSignal,
  ) => Promise<ManagedWatchlistReceiptDto>;
}

export class ManagedCatalogChangedError extends Error {
  constructor() {
    super("catalog_changed");
  }
}

async function readJson(
  response: Response,
  maximum: number,
  signal: AbortSignal,
): Promise<unknown> {
  if (
    !/^application\/json(?:\s*;|$)/iu.test(
      response.headers.get("content-type") ?? "",
    ) ||
    !response.body
  ) {
    void response.body?.cancel().catch(() => undefined);
    throw new TrialApiError("invalid_response");
  }
  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    for (;;) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximum) throw new TrialApiError("invalid_response");
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof TrialApiError) throw error;
    if (signal.aborted) throw new TrialApiError("aborted");
    throw new TrialApiError("invalid_response");
  } finally {
    signal.removeEventListener("abort", cancel);
    cancel();
    reader.releaseLock();
  }
}

function responseError(
  status: number,
  value: unknown,
  resolve: boolean,
): never {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !("error" in value)
  ) {
    throw new TrialApiError("invalid_response");
  }
  const error = value.error;
  if (resolve && status === 409 && error === "catalog_changed")
    throw new ManagedCatalogChangedError();
  const allowed: Record<number, readonly string[]> = {
    400: ["invalid_request"],
    409: ["conflict", "idempotency_conflict"],
    413: ["payload_too_large"],
    415: ["unsupported_media_type"],
    503: resolve ? ["unavailable"] : ["unavailable", "commit_unknown"],
  };
  if (typeof error !== "string" || !allowed[status]?.includes(error))
    throw new TrialApiError("invalid_response");
  throw new TrialApiError(error as TrialErrorCode);
}

function requestBody(value: unknown, maximum: number): string {
  const body = JSON.stringify(value);
  if (new TextEncoder().encode(body).byteLength > maximum)
    throw new TrialApiError("payload_too_large");
  return body;
}

export function createManagedApi(
  origin: string,
  session: TrialSession,
  fetcher: typeof fetch = fetch,
): ManagedApi {
  const base = validateApiOrigin(origin);
  async function request<T>(
    path: string,
    signal: AbortSignal,
    maximum: number,
    parse: (value: unknown) => T | null,
    body?: string,
    resolving = false,
  ): Promise<T> {
    const lifetime = new AbortController();
    const abort = () => lifetime.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(abort, 20_000);
    let rejectAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      rejectAbort = () =>
        reject(new TrialApiError(signal.aborted ? "aborted" : "unavailable"));
      lifetime.signal.addEventListener("abort", rejectAbort, { once: true });
      if (lifetime.signal.aborted) rejectAbort();
    });
    try {
      const work = async () => {
        lifetime.signal.throwIfAborted();
        const token = await session.getToken();
        lifetime.signal.throwIfAborted();
        if (!token) throw new TrialApiError("unauthenticated");
        const response = await fetcher(`${base}${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
          },
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: lifetime.signal,
          ...(body === undefined ? {} : { body }),
        });
        if (
          lifetime.signal.aborted ||
          response.status === 401 ||
          response.status === 403
        ) {
          void response.body?.cancel().catch(() => undefined);
          lifetime.signal.throwIfAborted();
          throw new TrialApiError(
            response.status === 401 ? "unauthenticated" : "access_denied",
          );
        }
        const value = await readJson(response, maximum, lifetime.signal);
        lifetime.signal.throwIfAborted();
        if (response.status !== 200)
          responseError(response.status, value, resolving);
        const result = parse(value);
        if (result === null) throw new TrialApiError("invalid_response");
        return result;
      };
      return await Promise.race([work(), aborted]);
    } catch (error) {
      if (
        error instanceof TrialApiError ||
        error instanceof ManagedCatalogChangedError
      )
        throw error;
      throw new TrialApiError(signal.aborted ? "aborted" : "unavailable");
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (rejectAbort)
        lifetime.signal.removeEventListener("abort", rejectAbort);
      lifetime.abort();
    }
  }
  return {
    status: (signal) =>
      request(
        MANAGED_CATALOG_STATUS_PATH,
        signal,
        MANAGED_CATALOG_LIMITS.responseBytes,
        parseManagedCatalogStatus,
      ),
    search: async (query, signal) => {
      if (
        !query.trim() ||
        [...query].length > MANAGED_CATALOG_LIMITS.searchQueryCodePoints ||
        /[\p{Cc}\p{Cf}\p{Cs}]/u.test(query)
      )
        throw new TrialApiError("invalid_request");
      const path = `${MANAGED_CATALOG_SEARCH_PATH}?q=${encodeURIComponent(query)}`;
      if (path.length > MANAGED_CATALOG_LIMITS.maximumRequestTargetCodeUnits)
        throw new TrialApiError("invalid_request");
      return request(
        path,
        signal,
        MANAGED_CATALOG_LIMITS.responseBytes,
        parseManagedCatalogSearch,
      );
    },
    resolve: async (input, signal) => {
      const captured = parseManagedCatalogResolveRequest(input);
      if (!captured) throw new TrialApiError("invalid_request");
      const body = requestBody(
        captured,
        MANAGED_CATALOG_RESOLVE_LIMITS.requestBytes,
      );
      return request(
        MANAGED_CATALOG_RESOLVE_PATH,
        signal,
        MANAGED_CATALOG_RESOLVE_LIMITS.responseBytes,
        (value) => parseManagedCatalogResolveResponse(value, captured),
        body,
        true,
      );
    },
    load: (signal) =>
      request(
        MANAGED_WATCHLIST_PATH,
        signal,
        MANAGED_WATCHLIST_LIMITS.envelopeBytes,
        parseManagedWatchlist,
      ),
    save: async (input, signal) => {
      const captured = parseManagedWatchlistCommand(input);
      if (!captured) throw new TrialApiError("invalid_request");
      const body = requestBody(
        captured,
        MANAGED_WATCHLIST_LIMITS.envelopeBytes,
      );
      return request(
        MANAGED_WATCHLIST_PATH,
        signal,
        MANAGED_WATCHLIST_LIMITS.envelopeBytes,
        (value) => parseManagedWatchlistReceipt(value, captured),
        body,
      );
    },
  };
}
