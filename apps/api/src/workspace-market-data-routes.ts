import type {
  PersonalAnnualFinancialsDto,
  PersonalMarketDataIdentityDto,
  PersonalMarketDataRangeDto,
  PersonalMarketOverviewDto,
  PersonalQuarterlyFinancialsDto,
  PersonalValuationHistoryDto,
  ProblemDetailsDto,
} from "@research-cockpit/contracts";
import {
  PERSONAL_SECURITY_MASTER_LIMITS,
  searchPersonalSecurityMaster,
  type PersonalSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { DemoApiListenOptions } from "./listen-options";
import type { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import {
  authorizePersonalJsonRouteRequest,
  authorizePersonalRouteRequest,
  sendPersonalOwnerSessionProblem,
} from "./personal-owner-session-routes";
import {
  PersonalMarketDataProviderError,
  type PersonalMarketDataProvider,
  type PersonalMarketDataProviderErrorCode,
} from "./personal-market-data-provider";

export const PERSONAL_MARKET_DATA_STATUS_PATH =
  "/v1/personal-filing/market-data/status" as const;
export const PERSONAL_MARKET_DATA_OVERVIEW_PATH =
  "/v1/personal-filing/market-data/overview" as const;
export const PERSONAL_ANNUAL_FINANCIALS_PATH =
  "/v1/personal-filing/market-data/annual-financials" as const;
export const PERSONAL_QUARTERLY_FINANCIALS_PATH =
  "/v1/personal-filing/market-data/quarterly-financials" as const;
export const PERSONAL_VALUATION_HISTORY_PATH =
  "/v1/personal-filing/market-data/valuation-history" as const;

const RANGES = new Set<PersonalMarketDataRangeDto>([
  "1m",
  "3m",
  "ytd",
  "1y",
  "5y",
  "10y",
]);
const LISTING_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SYMBOL = /^[A-Z0-9][A-Z0-9.-]{0,31}$/u;

interface OverviewRequest {
  readonly listingId: string;
  readonly range: PersonalMarketDataRangeDto;
  readonly symbol: string;
}

interface AnnualFinancialsRequest {
  readonly listingId: string;
  readonly symbol: string;
}

interface QuarterlyFinancialsRequest {
  readonly listingId: string;
  readonly symbol: string;
}

type ValuationHistoryRequest = OverviewRequest;

export function registerPersonalWorkspaceMarketDataRoutes(
  app: FastifyInstance,
  catalog: PersonalSecurityMasterCatalog,
  provider: PersonalMarketDataProvider,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  app.get(
    PERSONAL_MARKET_DATA_STATUS_PATH,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_MARKET_DATA_STATUS_PATH,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
      },
    },
    (_request, reply) => {
      return reply
        .type("application/json; charset=utf-8")
        .send(provider.getStatus());
    },
  );

  app.post<{ Body: unknown }>(
    PERSONAL_MARKET_DATA_OVERVIEW_PATH,
    {
      errorHandler: (_error, request, reply) => {
        void sendMarketDataProblem(reply, request, 400);
      },
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalJsonRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_MARKET_DATA_OVERVIEW_PATH,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
      },
    },
    async (request, reply) => {
      const body = parseOverviewRequest(request.body);
      if (body === undefined) {
        return sendMarketDataProblem(reply, request, 400);
      }
      const identity = resolveIdentity(catalog, body);
      if (identity === undefined) {
        return sendMarketDataProblem(reply, request, 400);
      }

      const abortController = new AbortController();
      const abort = () => abortController.abort();
      request.raw.once("aborted", abort);
      reply.raw.once("close", abort);
      try {
        const overview = await provider.loadOverview(
          identity,
          body.range,
          abortController.signal,
        );
        if (!matchesRequestedOverview(overview, identity, body.range)) {
          return sendMarketDataProblem(reply, request, 502);
        }
        return reply.type("application/json; charset=utf-8").send(overview);
      } catch (error) {
        return sendMarketDataProblem(
          reply,
          request,
          providerProblemStatus(error),
        );
      } finally {
        request.raw.off("aborted", abort);
        reply.raw.off("close", abort);
      }
    },
  );

  app.post<{ Body: unknown }>(
    PERSONAL_ANNUAL_FINANCIALS_PATH,
    {
      errorHandler: (_error, request, reply) => {
        void sendMarketDataProblem(
          reply,
          request,
          400,
          PERSONAL_ANNUAL_FINANCIALS_PATH,
        );
      },
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalJsonRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_ANNUAL_FINANCIALS_PATH,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
      },
    },
    async (request, reply) => {
      const body = parseAnnualFinancialsRequest(request.body);
      if (body === undefined) {
        return sendMarketDataProblem(
          reply,
          request,
          400,
          PERSONAL_ANNUAL_FINANCIALS_PATH,
        );
      }
      const identity = resolveIdentity(catalog, body);
      if (identity === undefined) {
        return sendMarketDataProblem(
          reply,
          request,
          400,
          PERSONAL_ANNUAL_FINANCIALS_PATH,
        );
      }

      const abortController = new AbortController();
      const abort = () => abortController.abort();
      request.raw.once("aborted", abort);
      reply.raw.once("close", abort);
      try {
        const financials = await provider.loadAnnualFinancials(
          identity,
          abortController.signal,
        );
        if (!matchesRequestedAnnualFinancials(financials, identity)) {
          return sendMarketDataProblem(
            reply,
            request,
            502,
            PERSONAL_ANNUAL_FINANCIALS_PATH,
          );
        }
        return reply.type("application/json; charset=utf-8").send(financials);
      } catch (error) {
        return sendMarketDataProblem(
          reply,
          request,
          providerProblemStatus(error),
          PERSONAL_ANNUAL_FINANCIALS_PATH,
        );
      } finally {
        request.raw.off("aborted", abort);
        reply.raw.off("close", abort);
      }
    },
  );

  app.post<{ Body: unknown }>(
    PERSONAL_QUARTERLY_FINANCIALS_PATH,
    {
      errorHandler: (_error, request, reply) => {
        void sendMarketDataProblem(
          reply,
          request,
          400,
          PERSONAL_QUARTERLY_FINANCIALS_PATH,
        );
      },
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalJsonRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_QUARTERLY_FINANCIALS_PATH,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
      },
    },
    async (request, reply) => {
      const body = parseQuarterlyFinancialsRequest(request.body);
      if (body === undefined) {
        return sendMarketDataProblem(
          reply,
          request,
          400,
          PERSONAL_QUARTERLY_FINANCIALS_PATH,
        );
      }
      const identity = resolveIdentity(catalog, body);
      if (identity === undefined) {
        return sendMarketDataProblem(
          reply,
          request,
          400,
          PERSONAL_QUARTERLY_FINANCIALS_PATH,
        );
      }

      const abortController = new AbortController();
      const abort = () => abortController.abort();
      request.raw.once("aborted", abort);
      reply.raw.once("close", abort);
      try {
        const financials = await provider.loadQuarterlyFinancials(
          identity,
          abortController.signal,
        );
        if (!matchesRequestedQuarterlyFinancials(financials, identity)) {
          return sendMarketDataProblem(
            reply,
            request,
            502,
            PERSONAL_QUARTERLY_FINANCIALS_PATH,
          );
        }
        return reply.type("application/json; charset=utf-8").send(financials);
      } catch (error) {
        return sendMarketDataProblem(
          reply,
          request,
          providerProblemStatus(error),
          PERSONAL_QUARTERLY_FINANCIALS_PATH,
        );
      } finally {
        request.raw.off("aborted", abort);
        reply.raw.off("close", abort);
      }
    },
  );

  app.post<{ Body: unknown }>(
    PERSONAL_VALUATION_HISTORY_PATH,
    {
      errorHandler: (_error, request, reply) => {
        void sendMarketDataProblem(
          reply,
          request,
          400,
          PERSONAL_VALUATION_HISTORY_PATH,
        );
      },
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalJsonRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_VALUATION_HISTORY_PATH,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
      },
    },
    async (request, reply) => {
      const body = parseValuationHistoryRequest(request.body);
      if (body === undefined) {
        return sendMarketDataProblem(
          reply,
          request,
          400,
          PERSONAL_VALUATION_HISTORY_PATH,
        );
      }
      const identity = resolveIdentity(catalog, body);
      if (identity === undefined) {
        return sendMarketDataProblem(
          reply,
          request,
          400,
          PERSONAL_VALUATION_HISTORY_PATH,
        );
      }

      const abortController = new AbortController();
      const abort = () => abortController.abort();
      request.raw.once("aborted", abort);
      reply.raw.once("close", abort);
      try {
        const valuation = await provider.loadValuationHistory(
          identity,
          body.range,
          abortController.signal,
        );
        if (
          !matchesRequestedValuationHistory(valuation, identity, body.range)
        ) {
          return sendMarketDataProblem(
            reply,
            request,
            502,
            PERSONAL_VALUATION_HISTORY_PATH,
          );
        }
        return reply.type("application/json; charset=utf-8").send(valuation);
      } catch (error) {
        return sendMarketDataProblem(
          reply,
          request,
          providerProblemStatus(error),
          PERSONAL_VALUATION_HISTORY_PATH,
        );
      } finally {
        request.raw.off("aborted", abort);
        reply.raw.off("close", abort);
      }
    },
  );
}

function parseOverviewRequest(value: unknown): OverviewRequest | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== "listingId" ||
    keys[1] !== "range" ||
    keys[2] !== "symbol" ||
    typeof record.listingId !== "string" ||
    !LISTING_ID.test(record.listingId) ||
    typeof record.symbol !== "string" ||
    !SYMBOL.test(record.symbol) ||
    typeof record.range !== "string" ||
    !RANGES.has(record.range as PersonalMarketDataRangeDto)
  ) {
    return undefined;
  }
  return {
    listingId: record.listingId,
    range: record.range as PersonalMarketDataRangeDto,
    symbol: record.symbol,
  };
}

function parseAnnualFinancialsRequest(
  value: unknown,
): AnnualFinancialsRequest | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== "listingId" ||
    keys[1] !== "symbol" ||
    typeof record.listingId !== "string" ||
    !LISTING_ID.test(record.listingId) ||
    typeof record.symbol !== "string" ||
    !SYMBOL.test(record.symbol)
  ) {
    return undefined;
  }
  return { listingId: record.listingId, symbol: record.symbol };
}

function parseQuarterlyFinancialsRequest(
  value: unknown,
): QuarterlyFinancialsRequest | undefined {
  return parseAnnualFinancialsRequest(value);
}

function parseValuationHistoryRequest(
  value: unknown,
): ValuationHistoryRequest | undefined {
  return parseOverviewRequest(value);
}

function resolveIdentity(
  catalog: PersonalSecurityMasterCatalog,
  body: AnnualFinancialsRequest | OverviewRequest | QuarterlyFinancialsRequest,
): PersonalMarketDataIdentityDto | undefined {
  try {
    const listing = searchPersonalSecurityMaster(catalog, {
      query: body.symbol,
      limit: PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap,
    }).results.find(
      (candidate) =>
        candidate.listingId === body.listingId &&
        candidate.symbol === body.symbol,
    );
    return listing === undefined
      ? undefined
      : {
          country: listing.country,
          exchangeMic: listing.exchangeMic,
          issuerName: listing.issuerName,
          listingId: listing.listingId,
          securityName: listing.securityName,
          symbol: listing.symbol,
        };
  } catch {
    return undefined;
  }
}

function matchesRequestedAnnualFinancials(
  financials: PersonalAnnualFinancialsDto,
  identity: PersonalMarketDataIdentityDto,
): boolean {
  if (financials === null || typeof financials !== "object") return false;
  const security = Reflect.get(financials, "security") as unknown;
  if (security === null || typeof security !== "object") return false;
  return (
    Reflect.get(security, "country") === identity.country &&
    Reflect.get(security, "exchangeMic") === identity.exchangeMic &&
    Reflect.get(security, "issuerName") === identity.issuerName &&
    Reflect.get(security, "listingId") === identity.listingId &&
    Reflect.get(security, "securityName") === identity.securityName &&
    Reflect.get(security, "symbol") === identity.symbol
  );
}

function matchesRequestedQuarterlyFinancials(
  financials: PersonalQuarterlyFinancialsDto,
  identity: PersonalMarketDataIdentityDto,
): boolean {
  if (financials === null || typeof financials !== "object") return false;
  const security = Reflect.get(financials, "security") as unknown;
  if (security === null || typeof security !== "object") return false;
  return (
    Reflect.get(security, "country") === identity.country &&
    Reflect.get(security, "exchangeMic") === identity.exchangeMic &&
    Reflect.get(security, "issuerName") === identity.issuerName &&
    Reflect.get(security, "listingId") === identity.listingId &&
    Reflect.get(security, "securityName") === identity.securityName &&
    Reflect.get(security, "symbol") === identity.symbol
  );
}

function matchesRequestedValuationHistory(
  valuation: PersonalValuationHistoryDto,
  identity: PersonalMarketDataIdentityDto,
  range: PersonalMarketDataRangeDto,
): boolean {
  if (valuation === null || typeof valuation !== "object") return false;
  const asOf = Reflect.get(valuation, "asOf") as unknown;
  const history = Reflect.get(valuation, "history") as unknown;
  const security = Reflect.get(valuation, "security") as unknown;
  if (
    typeof asOf !== "string" ||
    history === null ||
    typeof history !== "object" ||
    security === null ||
    typeof security !== "object"
  ) {
    return false;
  }
  const expectedWindow = valuationRangeDates(range, asOf);
  if (expectedWindow === undefined) return false;
  return (
    Reflect.get(history, "range") === range &&
    Reflect.get(history, "startDate") === expectedWindow.startDate &&
    Reflect.get(history, "endDate") === expectedWindow.endDate &&
    Reflect.get(security, "country") === identity.country &&
    Reflect.get(security, "exchangeMic") === identity.exchangeMic &&
    Reflect.get(security, "issuerName") === identity.issuerName &&
    Reflect.get(security, "listingId") === identity.listingId &&
    Reflect.get(security, "securityName") === identity.securityName &&
    Reflect.get(security, "symbol") === identity.symbol
  );
}

function valuationRangeDates(
  range: PersonalMarketDataRangeDto,
  asOf: string,
): Readonly<{ endDate: string; startDate: string }> | undefined {
  const milliseconds = Date.parse(asOf);
  if (!Number.isFinite(milliseconds)) return undefined;
  const instant = new Date(milliseconds);
  if (instant.toISOString() !== asOf) return undefined;
  const endDate = instant.toISOString().slice(0, 10);
  let start: Date;
  switch (range) {
    case "1m":
      start = subtractValuationCalendar(instant, 0, 1);
      break;
    case "3m":
      start = subtractValuationCalendar(instant, 0, 3);
      break;
    case "ytd":
      start = new Date(Date.UTC(instant.getUTCFullYear(), 0, 1));
      break;
    case "1y":
      start = subtractValuationCalendar(instant, 1, 0);
      break;
    case "5y":
      start = subtractValuationCalendar(instant, 5, 0);
      break;
    case "10y":
      start = subtractValuationCalendar(instant, 10, 0);
      break;
  }
  return { endDate, startDate: start.toISOString().slice(0, 10) };
}

function subtractValuationCalendar(
  date: Date,
  years: number,
  months: number,
): Date {
  const sourceMonth = date.getUTCMonth();
  const targetMonthOrdinal = sourceMonth - months;
  const targetYear =
    date.getUTCFullYear() - years + Math.floor(targetMonthOrdinal / 12);
  const targetMonth = ((targetMonthOrdinal % 12) + 12) % 12;
  const targetDay = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate(),
  );
  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

function matchesRequestedOverview(
  overview: PersonalMarketOverviewDto,
  identity: PersonalMarketDataIdentityDto,
  range: PersonalMarketDataRangeDto,
): boolean {
  if (overview === null || typeof overview !== "object") return false;
  const history = Reflect.get(overview, "history") as unknown;
  const security = Reflect.get(overview, "security") as unknown;
  if (
    history === null ||
    typeof history !== "object" ||
    security === null ||
    typeof security !== "object"
  ) {
    return false;
  }
  return (
    Reflect.get(history, "range") === range &&
    Reflect.get(security, "country") === identity.country &&
    Reflect.get(security, "exchangeMic") === identity.exchangeMic &&
    Reflect.get(security, "issuerName") === identity.issuerName &&
    Reflect.get(security, "listingId") === identity.listingId &&
    Reflect.get(security, "securityName") === identity.securityName &&
    Reflect.get(security, "symbol") === identity.symbol
  );
}

function providerProblemStatus(
  error: unknown,
): 402 | 404 | 424 | 429 | 502 | 503 {
  const code: PersonalMarketDataProviderErrorCode | undefined =
    error instanceof PersonalMarketDataProviderError ? error.code : undefined;
  switch (code) {
    case "not_configured":
      return 503;
    case "credentials_invalid":
      return 424;
    case "not_entitled":
      return 402;
    case "rate_limited":
      return 429;
    case "not_covered":
      return 404;
    case "aborted":
    case "invalid_response":
    case "upstream_unavailable":
    default:
      return 502;
  }
}

function sendMarketDataProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: 400 | 402 | 404 | 424 | 429 | 502 | 503,
  instance:
    | typeof PERSONAL_ANNUAL_FINANCIALS_PATH
    | typeof PERSONAL_QUARTERLY_FINANCIALS_PATH
    | typeof PERSONAL_VALUATION_HISTORY_PATH
    | typeof PERSONAL_MARKET_DATA_OVERVIEW_PATH = PERSONAL_MARKET_DATA_OVERVIEW_PATH,
) {
  const titles = {
    400: "Invalid request",
    402: "Annual financials not included",
    404: "Market data not covered",
    424: "Market data credentials rejected",
    429: "Market data rate limited",
    502: "Market data unavailable",
    503: "Market data not configured",
  } as const;
  const problem: ProblemDetailsDto = {
    type: `https://research-cockpit.local/problems/${String(status)}`,
    title:
      status === 402
        ? instance === PERSONAL_QUARTERLY_FINANCIALS_PATH
          ? "Quarterly financials not included"
          : instance === PERSONAL_VALUATION_HISTORY_PATH
            ? "Valuation history not included"
            : titles[status]
        : titles[status],
    status,
    detail: "The personal market-data request was not accepted.",
    instance,
    traceId: request.id,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
