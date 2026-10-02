import {
  MANAGED_EOD_HISTORY_LIMITS,
  MANAGED_EOD_HISTORY_PATH,
  parseManagedEodHistoryRequest,
  parseManagedEodHistoryResponse,
  parseManagedEodError,
  type ManagedEodHistoryRequestDto,
  type ManagedEodHistoryResponseDto,
  type ManagedEodErrorCode,
  MANAGED_CATALOG_LIMITS,
  MANAGED_CATALOG_RESOLVE_LIMITS,
  MANAGED_CATALOG_RESOLVE_PATH,
  MANAGED_CATALOG_SEARCH_PATH,
  MANAGED_CATALOG_STATUS_PATH,
  MANAGED_WATCHLIST_LIMITS,
  MANAGED_WATCHLIST_PATH,
  MANAGED_SEC_ANNUAL_EVIDENCE_PATH,
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  parseManagedSecAnnualEvidenceRequest,
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
  type PersonalSecAnnualEvidenceRequestDto,
  type PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import { parseSecAnnualEvidenceResponse } from "../lib/sec-annual-evidence-response";
import { TrialApiError, validateApiOrigin, type TrialErrorCode } from "./api";
import type { TrialSession } from "./session";

export interface ManagedApi {
  eodHistory: (
    request: ManagedEodHistoryRequestDto,
    signal: AbortSignal,
  ) => Promise<ManagedEodHistoryResponseDto>;
  annualReport: (
    request: PersonalSecAnnualEvidenceRequestDto,
    signal: AbortSignal,
  ) => Promise<PersonalSecAnnualEvidenceResponseDto>;
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

export class ManagedAnnualReportError extends Error {
  constructor(readonly code: "not_configured" | "request_timeout") {
    super(code);
  }
}

export class ManagedAnnualCooldownError extends Error {
  constructor(readonly nextAllowedAt: string) {
    super("rate_limited");
  }
}

export class ManagedEodHistoryError extends Error {
  constructor(readonly code: ManagedEodErrorCode) {
    super(code);
  }
}

export class ManagedEodCooldownError extends Error {
  constructor(readonly nextAllowedAt: string) {
    super("rate_limited");
  }
}

type RequestKind = "watchlist" | "resolve" | "annual" | "eod";

function annualCooldown(value: unknown): never {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 2 &&
    "error" in value &&
    value.error === "rate_limited" &&
    "nextAllowedAt" in value &&
    typeof value.nextAllowedAt === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(
      value.nextAllowedAt,
    ) &&
    Number.isFinite(Date.parse(value.nextAllowedAt)) &&
    new Date(value.nextAllowedAt).toISOString() === value.nextAllowedAt
  )
    throw new ManagedAnnualCooldownError(value.nextAllowedAt);
  throw new TrialApiError("invalid_response");
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
  kind: RequestKind,
): never {
  if (kind === "eod") {
    const error = parseManagedEodError(value);
    if (!error) throw new TrialApiError("invalid_response");
    if (status === 429 && error.error === "rate_limited")
      throw new ManagedEodCooldownError(error.nextAllowedAt);
    if (status === 409 && error.error === "catalog_changed")
      throw new ManagedCatalogChangedError();
    const allowed: Record<number, readonly string[]> = {
      400: ["invalid_request"],
      408: ["request_timeout"],
      422: ["unsupported_listing"],
      429: ["source_rate_limited"],
      503: ["not_configured", "unavailable"],
    };
    if (
      error.error !== "rate_limited" &&
      allowed[status]?.includes(error.error)
    )
      throw new ManagedEodHistoryError(error.error);
    throw new TrialApiError("invalid_response");
  }
  if (kind === "annual" && status === 429) annualCooldown(value);
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
  if (kind !== "watchlist" && status === 409 && error === "catalog_changed")
    throw new ManagedCatalogChangedError();
  if (kind === "annual") {
    if (status === 503 && error === "not_configured")
      throw new ManagedAnnualReportError("not_configured");
    if (status === 408 && error === "request_timeout")
      throw new ManagedAnnualReportError("request_timeout");
  }
  const allowed: Record<number, readonly string[]> = {
    400: ["invalid_request"],
    409: kind === "watchlist" ? ["conflict", "idempotency_conflict"] : [],
    413: ["payload_too_large"],
    415: ["unsupported_media_type"],
    503:
      kind === "watchlist"
        ? ["unavailable", "commit_unknown"]
        : ["unavailable"],
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
    parse: (
      value: unknown,
      signal: AbortSignal,
    ) => T | null | Promise<T | null>,
    body?: string,
    kind: RequestKind = "watchlist",
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
          responseError(response.status, value, kind);
        const result = await parse(value, lifetime.signal);
        lifetime.signal.throwIfAborted();
        if (result === null) throw new TrialApiError("invalid_response");
        return result;
      };
      return await Promise.race([work(), aborted]);
    } catch (error) {
      if (
        error instanceof TrialApiError ||
        error instanceof ManagedCatalogChangedError ||
        error instanceof ManagedAnnualCooldownError ||
        error instanceof ManagedAnnualReportError ||
        error instanceof ManagedEodHistoryError ||
        error instanceof ManagedEodCooldownError
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
    eodHistory: async (input, signal) => {
      const captured = parseManagedEodHistoryRequest(input);
      if (!captured) throw new TrialApiError("invalid_request");
      return request(
        MANAGED_EOD_HISTORY_PATH,
        signal,
        MANAGED_EOD_HISTORY_LIMITS.responseBytes,
        (value) => parseManagedEodHistoryResponse(value, captured),
        requestBody(captured, MANAGED_EOD_HISTORY_LIMITS.requestBytes),
        "eod",
      );
    },
    annualReport: async (input, signal) => {
      const captured = parseManagedSecAnnualEvidenceRequest(input);
      if (!captured) throw new TrialApiError("invalid_request");
      return request(
        MANAGED_SEC_ANNUAL_EVIDENCE_PATH,
        signal,
        MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes,
        (value, lifetime) =>
          parseSecAnnualEvidenceResponse(value, captured, lifetime),
        requestBody(captured, MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.requestBytes),
        "annual",
      );
    },
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
        "resolve",
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
