import {
  MANAGED_VALUATION_ASSUMPTIONS_PATH,
  MANAGED_VALUATION_ASSUMPTIONS_LIMITS,
  parseManagedValuationAssumptions,
  parseManagedValuationAssumptionsCommand,
  parseManagedValuationAssumptionsReceipt,
  type ManagedValuationAssumptionsCommand,
  type ManagedValuationAssumptionsDto,
  type ManagedValuationAssumptionsReceiptDto,
  MANAGED_PORTFOLIO_PATH,
  MANAGED_PORTFOLIO_LIMITS,
  parseManagedPortfolio,
  parseManagedPortfolioCommand,
  parseManagedPortfolioReceipt,
  type ManagedPortfolioCommand,
  type ManagedPortfolioDto,
  type ManagedPortfolioReceiptDto,
  MANAGED_RESEARCH_FOLLOWUPS_PATH,
  MANAGED_RESEARCH_FOLLOWUPS_LIMITS,
  parseManagedResearchFollowups,
  parseManagedResearchFollowupsCommand,
  parseManagedResearchFollowupsReceipt,
  type ManagedResearchFollowupsCommand,
  type ManagedResearchFollowupsDto,
  type ManagedResearchFollowupsReceiptDto,
  MANAGED_SEC_FILINGS_PATH,
  MANAGED_SEC_FILINGS_LIMITS,
  parseManagedSecFilingsRequest,
  parseManagedSecFilingsResponse,
  parseManagedSecFilingsError,
  type ManagedSecFilingsRequestDto,
  type ManagedSecFilingsResponseDto,
  type ManagedSecFilingsErrorCode,
  MANAGED_MONETARY_ANNOUNCEMENTS_LIMITS,
  MANAGED_MONETARY_ANNOUNCEMENTS_PATH,
  parseManagedMonetaryAnnouncements,
  type PersonalMonetaryAnnouncementsDto,
  MANAGED_BLS_CALENDAR_LIMITS,
  MANAGED_BLS_CALENDAR_PATH,
  parseManagedBlsCalendar,
  type ManagedBlsCalendarDto,
  MANAGED_ECONOMIC_CALENDAR_LIMITS,
  MANAGED_ECONOMIC_CALENDAR_PATH,
  parseManagedEconomicCalendar,
  type PersonalEconomicCalendarDto,
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
  MANAGED_SEC_INTERIM_EVIDENCE_PATH,
  MANAGED_SEC_INTERIM_EVIDENCE_LIMITS,
  parseManagedSecInterimCanonicalRequest,
  type PersonalSecInterimCanonicalRequestDto,
  type PersonalSecInterimCanonicalResponseDto,
  MANAGED_SEC_ANNUAL_EVIDENCE_PATH,
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  parseManagedSecAnnualCanonicalRequest,
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
  type PersonalSecAnnualCanonicalRequestDto,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { parseSecInterimCanonicalResponse } from "../lib/sec-interim-canonical-response";
import { parseSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";
import { TrialApiError, validateApiOrigin, type TrialErrorCode } from "./api";
import type { TrialSession } from "./session";

export interface ManagedApi {
  loadValuationAssumptions: (
    signal: AbortSignal,
  ) => Promise<ManagedValuationAssumptionsDto>;
  saveValuationAssumptions: (
    command: ManagedValuationAssumptionsCommand,
    signal: AbortSignal,
  ) => Promise<ManagedValuationAssumptionsReceiptDto>;
  loadPortfolio: (signal: AbortSignal) => Promise<ManagedPortfolioDto>;
  savePortfolio: (
    command: ManagedPortfolioCommand,
    signal: AbortSignal,
  ) => Promise<ManagedPortfolioReceiptDto>;
  loadFollowups: (signal: AbortSignal) => Promise<ManagedResearchFollowupsDto>;
  saveFollowups: (
    command: ManagedResearchFollowupsCommand,
    signal: AbortSignal,
  ) => Promise<ManagedResearchFollowupsReceiptDto>;
  recentFilings: (
    request: ManagedSecFilingsRequestDto,
    signal: AbortSignal,
  ) => Promise<ManagedSecFilingsResponseDto>;
  monetaryAnnouncements: (
    signal: AbortSignal,
  ) => Promise<PersonalMonetaryAnnouncementsDto>;
  blsCalendar: (signal: AbortSignal) => Promise<ManagedBlsCalendarDto>;
  economicCalendar: (
    signal: AbortSignal,
  ) => Promise<PersonalEconomicCalendarDto>;
  eodHistory: (
    request: ManagedEodHistoryRequestDto,
    signal: AbortSignal,
  ) => Promise<ManagedEodHistoryResponseDto>;
  interimReport: (
    request: PersonalSecInterimCanonicalRequestDto,
    signal: AbortSignal,
  ) => Promise<PersonalSecInterimCanonicalResponseDto>;
  annualReport: (
    request: PersonalSecAnnualCanonicalRequestDto,
    signal: AbortSignal,
  ) => Promise<PersonalSecAnnualCanonicalResponseDto>;
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

export class ManagedInterimReportError extends Error {
  constructor(readonly code: "not_configured" | "request_timeout") {
    super(code);
  }
}

export class ManagedAnnualReportError extends Error {
  constructor(readonly code: "not_configured" | "request_timeout") {
    super(code);
  }
}

export class ManagedSecCooldownError extends Error {
  constructor(readonly nextAllowedAt: string) {
    super("rate_limited");
  }
}

export class ManagedSecFilingsError extends Error {
  constructor(readonly code: ManagedSecFilingsErrorCode) {
    super(code);
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

type RequestKind =
  | "valuation-assumptions"
  | "portfolio"
  | "watchlist"
  | "followups"
  | "resolve"
  | "interim"
  | "annual"
  | "eod"
  | "calendar"
  | "filings"
  | "announcements";
const mutationKinds: readonly RequestKind[] = [
  "watchlist",
  "followups",
  "portfolio",
  "valuation-assumptions",
];

function secCooldown(value: unknown): never {
  const error = parseManagedSecFilingsError(value);
  if (error?.error === "rate_limited")
    throw new ManagedSecCooldownError(error.nextAllowedAt);
  throw new TrialApiError("invalid_response");
}

function filingsError(status: number, value: unknown): never {
  const error = parseManagedSecFilingsError(value);
  if (!error) throw new TrialApiError("invalid_response");
  if (status === 429) secCooldown(value);
  if (status === 409 && error.error === "catalog_changed")
    throw new ManagedCatalogChangedError();
  const allowed: Record<number, readonly string[]> = {
    400: ["invalid_request"],
    408: ["request_timeout"],
    503: ["not_configured", "unavailable"],
  };
  if (error.error !== "rate_limited" && allowed[status]?.includes(error.error))
    throw new ManagedSecFilingsError(error.error);
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
  if (kind === "filings") filingsError(status, value);
  if (kind === "calendar" || kind === "announcements") {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 1 &&
      "error" in value &&
      ((status === 408 && value.error === "request_timeout") ||
        (status === 503 && value.error === "unavailable"))
    )
      throw new TrialApiError("unavailable");
    throw new TrialApiError("invalid_response");
  }
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
  if ((kind === "annual" || kind === "interim") && status === 429)
    secCooldown(value);
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
  const mutation = mutationKinds.includes(kind);
  if (!mutation && status === 409 && error === "catalog_changed")
    throw new ManagedCatalogChangedError();
  if (kind === "interim") {
    if (status === 503 && error === "not_configured")
      throw new ManagedInterimReportError("not_configured");
    if (status === 408 && error === "request_timeout")
      throw new ManagedInterimReportError("request_timeout");
  }
  if (kind === "annual") {
    if (status === 503 && error === "not_configured")
      throw new ManagedAnnualReportError("not_configured");
    if (status === 408 && error === "request_timeout")
      throw new ManagedAnnualReportError("request_timeout");
  }
  const allowed: Record<number, readonly string[]> = {
    400: ["invalid_request"],
    409: mutation ? ["conflict", "idempotency_conflict"] : [],
    413: ["payload_too_large"],
    415: ["unsupported_media_type"],
    503: mutation ? ["unavailable", "commit_unknown"] : ["unavailable"],
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
type ManagedRequest = <T>(
  path: string,
  signal: AbortSignal,
  maximum: number,
  parse: (value: unknown, signal: AbortSignal) => T | null | Promise<T | null>,
  body?: string,
  kind?: RequestKind,
) => Promise<T>;

function valuationAssumptionsApi(
  request: ManagedRequest,
): Pick<ManagedApi, "loadValuationAssumptions" | "saveValuationAssumptions"> {
  return {
    loadValuationAssumptions: (signal) =>
      request(
        MANAGED_VALUATION_ASSUMPTIONS_PATH,
        signal,
        MANAGED_VALUATION_ASSUMPTIONS_LIMITS.envelopeBytes,
        parseManagedValuationAssumptions,
        undefined,
        "valuation-assumptions",
      ),
    saveValuationAssumptions: async (input, signal) => {
      const captured = parseManagedValuationAssumptionsCommand(input);
      if (!captured) throw new TrialApiError("invalid_request");
      return request(
        MANAGED_VALUATION_ASSUMPTIONS_PATH,
        signal,
        MANAGED_VALUATION_ASSUMPTIONS_LIMITS.envelopeBytes,
        (value) => parseManagedValuationAssumptionsReceipt(value, captured),
        requestBody(
          captured,
          MANAGED_VALUATION_ASSUMPTIONS_LIMITS.envelopeBytes,
        ),
        "valuation-assumptions",
      );
    },
  };
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
        error instanceof ManagedSecCooldownError ||
        error instanceof ManagedAnnualReportError ||
        error instanceof ManagedInterimReportError ||
        error instanceof ManagedSecFilingsError ||
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
    ...valuationAssumptionsApi(request),
    loadPortfolio: (signal) =>
      request(
        MANAGED_PORTFOLIO_PATH,
        signal,
        MANAGED_PORTFOLIO_LIMITS.envelopeBytes,
        parseManagedPortfolio,
        undefined,
        "portfolio",
      ),
    savePortfolio: async (input, signal) => {
      const captured = parseManagedPortfolioCommand(input);
      if (!captured) throw new TrialApiError("invalid_request");
      return request(
        MANAGED_PORTFOLIO_PATH,
        signal,
        MANAGED_PORTFOLIO_LIMITS.envelopeBytes,
        (value) => parseManagedPortfolioReceipt(value, captured),
        requestBody(captured, MANAGED_PORTFOLIO_LIMITS.envelopeBytes),
        "portfolio",
      );
    },
    loadFollowups: (signal) =>
      request(
        MANAGED_RESEARCH_FOLLOWUPS_PATH,
        signal,
        MANAGED_RESEARCH_FOLLOWUPS_LIMITS.envelopeBytes,
        parseManagedResearchFollowups,
        undefined,
        "followups",
      ),
    saveFollowups: async (input, signal) => {
      const captured = parseManagedResearchFollowupsCommand(input);
      if (!captured) throw new TrialApiError("invalid_request");
      return request(
        MANAGED_RESEARCH_FOLLOWUPS_PATH,
        signal,
        MANAGED_RESEARCH_FOLLOWUPS_LIMITS.envelopeBytes,
        (value) => parseManagedResearchFollowupsReceipt(value, captured),
        requestBody(captured, MANAGED_RESEARCH_FOLLOWUPS_LIMITS.envelopeBytes),
        "followups",
      );
    },
    recentFilings: async (input, signal) => {
      const captured = parseManagedSecFilingsRequest(input);
      if (!captured) throw new TrialApiError("invalid_request");
      return request(
        MANAGED_SEC_FILINGS_PATH,
        signal,
        MANAGED_SEC_FILINGS_LIMITS.responseBytes,
        (value) => parseManagedSecFilingsResponse(value, captured),
        requestBody(captured, MANAGED_SEC_FILINGS_LIMITS.requestBytes),
        "filings",
      );
    },
    monetaryAnnouncements: (signal) =>
      request(
        MANAGED_MONETARY_ANNOUNCEMENTS_PATH,
        signal,
        MANAGED_MONETARY_ANNOUNCEMENTS_LIMITS.responseBytes,
        parseManagedMonetaryAnnouncements,
        undefined,
        "announcements",
      ),
    blsCalendar: (signal) =>
      request(
        MANAGED_BLS_CALENDAR_PATH,
        signal,
        MANAGED_BLS_CALENDAR_LIMITS.responseBytes,
        parseManagedBlsCalendar,
        undefined,
        "calendar",
      ),
    economicCalendar: (signal) =>
      request(
        MANAGED_ECONOMIC_CALENDAR_PATH,
        signal,
        MANAGED_ECONOMIC_CALENDAR_LIMITS.responseBytes,
        parseManagedEconomicCalendar,
        undefined,
        "calendar",
      ),
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
    interimReport: async (input, signal) => {
      const captured = parseManagedSecInterimCanonicalRequest(input);
      if (!captured) throw new TrialApiError("invalid_request");
      return request(
        MANAGED_SEC_INTERIM_EVIDENCE_PATH,
        signal,
        MANAGED_SEC_INTERIM_EVIDENCE_LIMITS.responseBytes,
        (value, lifetime) =>
          parseSecInterimCanonicalResponse(value, captured, lifetime),
        requestBody(captured, MANAGED_SEC_INTERIM_EVIDENCE_LIMITS.requestBytes),
        "interim",
      );
    },
    annualReport: async (input, signal) => {
      const captured = parseManagedSecAnnualCanonicalRequest(input);
      if (!captured) throw new TrialApiError("invalid_request");
      return request(
        MANAGED_SEC_ANNUAL_EVIDENCE_PATH,
        signal,
        MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes,
        (value, lifetime) =>
          parseSecAnnualCanonicalResponse(value, captured, lifetime),
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
