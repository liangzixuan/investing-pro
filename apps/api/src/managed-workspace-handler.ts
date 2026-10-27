import { createHash } from "node:crypto";

import {
  MANAGED_VALUATION_ASSUMPTIONS_PATH,
  MANAGED_VALUATION_ASSUMPTIONS_LIMITS,
  parseManagedValuationAssumptions,
  parseManagedValuationAssumptionsCommand,
  parseManagedValuationAssumptionsReceipt,
  encodeValuationAssumptionsPayload,
  type ManagedValuationAssumptionsCommand,
  MANAGED_PORTFOLIO_PATH,
  MANAGED_PORTFOLIO_LIMITS,
  encodePortfolioPayload,
  parseManagedPortfolio,
  parseManagedPortfolioCommand,
  parseManagedPortfolioReceipt,
  type ManagedPortfolioCommand,
  MANAGED_RESEARCH_FOLLOWUPS_LIMITS,
  MANAGED_RESEARCH_FOLLOWUPS_PATH,
  parseManagedResearchFollowups,
  parseManagedResearchFollowupsCommand,
  parseManagedResearchFollowupsReceipt,
  encodeResearchFollowupsPayload,
  type ManagedResearchFollowupsCommand,
  MANAGED_CATALOG_LIMITS,
  MANAGED_CATALOG_RESOLVE_LIMITS,
  MANAGED_CATALOG_RESOLVE_PATH,
  MANAGED_CATALOG_SEARCH_PATH,
  MANAGED_CATALOG_STATUS_PATH,
  MANAGED_WATCHLIST_LIMITS,
  MANAGED_WATCHLIST_PATH,
  MANAGED_SEC_ANNUAL_EVIDENCE_PATH,
  MANAGED_SEC_INTERIM_EVIDENCE_PATH,
  MANAGED_SEC_INTERIM_EVIDENCE_LIMITS,
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  MANAGED_SEC_FILINGS_PATH,
  MANAGED_SEC_FILINGS_LIMITS,
  parseManagedSecFilingsRequest,
  parseManagedSecFilingsResponse,
  parseManagedSecFilingsError,
  MANAGED_EOD_HISTORY_PATH,
  MANAGED_EOD_HISTORY_LIMITS,
  MANAGED_BLS_CALENDAR_PATH,
  MANAGED_ECONOMIC_CALENDAR_PATH,
  MANAGED_MONETARY_ANNOUNCEMENTS_PATH,
  MANAGED_ECONOMIC_CALENDAR_LIMITS,
  parseManagedBlsCalendar,
  MANAGED_BLS_CALENDAR_LIMITS,
  parseManagedEconomicCalendar,
  MANAGED_MONETARY_ANNOUNCEMENTS_LIMITS,
  parseManagedMonetaryAnnouncements,
  parseManagedEodHistoryRequest,
  parseManagedEodError,
  encodeMainWatchlistPayload,
  parseManagedCatalogResolveRequest,
  parseManagedCatalogResolveResponse,
  parseManagedCatalogSearch,
  parseManagedCatalogStatus,
  parseManagedWatchlist,
  parseManagedWatchlistCommand,
  parseManagedWatchlistReceipt,
  parseManagedSecAnnualCanonicalRequest,
  parseManagedSecInterimCanonicalRequest,
  type ManagedWatchlistCommand,
} from "@research-cockpit/contracts";

import type { ClerkTrialAuth } from "./clerk-trial-auth";
import {
  PortfolioRepositoryError,
  type PortfolioRepository,
  type PortfolioRecord,
  type PortfolioReceipt,
} from "./portfolio-repository";
import {
  ResearchFollowupsRepositoryError,
  type ResearchFollowupsRepository,
  type ResearchFollowupsRecord,
  type ResearchFollowupsReceipt,
} from "./research-followups-repository";
import {
  ValuationAssumptionsRepositoryError,
  type ValuationAssumptionsRepository,
  type ValuationAssumptionsRecord,
  type ValuationAssumptionsReceipt,
  type ValuationAssumptionsPrincipal,
} from "./valuation-assumptions-repository";
import type { ManagedCatalogService } from "./managed-workspace-catalog";
import {
  ManagedSecInterimServiceError,
  type ManagedSecInterimService,
} from "./managed-sec-interim-service";
import { isManagedSecDataServiceError } from "./managed-source-service-errors";
import {
  ManagedSecAnnualServiceError,
  type ManagedSecAnnualService,
} from "./managed-sec-annual-service";
import {
  ManagedSecFilingsServiceError,
  type ManagedSecFilingsService,
} from "./managed-sec-filings-service";
import {
  ManagedEodServiceError,
  type ManagedEodService,
} from "./managed-eod-service";
import type { ManagedBlsCalendarService } from "./managed-bls-calendar-service";
import {
  ManagedEconomicCalendarServiceError,
  type ManagedEconomicCalendarService,
} from "./managed-economic-calendar-service";
import {
  ManagedMonetaryAnnouncementsServiceError,
  type ManagedMonetaryAnnouncementsService,
} from "./managed-monetary-announcements-service";
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
export interface ManagedFollowupsRepositoryOperation {
  readonly repository: ResearchFollowupsRepository;
  close(): Promise<void>;
}
export interface ManagedPortfolioRepositoryOperation {
  readonly repository: PortfolioRepository;
  close(): Promise<void>;
}
export interface ManagedValuationAssumptionsRepositoryOperation {
  readonly repository: ValuationAssumptionsRepository;
  close(): Promise<void>;
}

export interface ManagedWorkspaceHandlerOptions {
  readonly auth: ClerkTrialAuth;
  readonly catalog: ManagedCatalogService;
  readonly annual?: ManagedSecAnnualService;
  readonly interim?: ManagedSecInterimService;
  readonly filings?: ManagedSecFilingsService;
  readonly eod?: ManagedEodService;
  readonly blsCalendar?: ManagedBlsCalendarService;
  readonly calendar?: ManagedEconomicCalendarService;
  readonly announcements?: ManagedMonetaryAnnouncementsService;
  readonly openRepository: (
    signal: AbortSignal,
  ) => Promise<ManagedWorkspaceRepositoryOperation>;
  readonly openFollowupsRepository: (
    signal: AbortSignal,
  ) => Promise<ManagedFollowupsRepositoryOperation>;
  readonly openValuationAssumptionsRepository?: (
    signal: AbortSignal,
  ) => Promise<ManagedValuationAssumptionsRepositoryOperation>;
  readonly openPortfolioRepository?: (
    signal: AbortSignal,
  ) => Promise<ManagedPortfolioRepositoryOperation>;
}

export const MANAGED_WORKSPACE_ORIGIN = "https://app.investingpro.app";
export const MANAGED_WORKSPACE_NATIVE_ORIGIN = "https://localhost";

export function getManagedWorkspaceOrigin(origin: string | null | undefined) {
  return origin === MANAGED_WORKSPACE_ORIGIN ||
    origin === MANAGED_WORKSPACE_NATIVE_ORIGIN
    ? origin
    : null;
}

const PATHS: readonly string[] = [
  MANAGED_VALUATION_ASSUMPTIONS_PATH,
  MANAGED_PORTFOLIO_PATH,
  MANAGED_RESEARCH_FOLLOWUPS_PATH,
  MANAGED_CATALOG_STATUS_PATH,
  MANAGED_CATALOG_SEARCH_PATH,
  MANAGED_CATALOG_RESOLVE_PATH,
  MANAGED_WATCHLIST_PATH,
  MANAGED_SEC_ANNUAL_EVIDENCE_PATH,
  MANAGED_SEC_INTERIM_EVIDENCE_PATH,
  MANAGED_SEC_FILINGS_PATH,
  MANAGED_EOD_HISTORY_PATH,
  MANAGED_BLS_CALENDAR_PATH,
  MANAGED_ECONOMIC_CALENDAR_PATH,
  MANAGED_MONETARY_ANNOUNCEMENTS_PATH,
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
  if (
    path === MANAGED_WATCHLIST_PATH ||
    path === MANAGED_PORTFOLIO_PATH ||
    path === MANAGED_VALUATION_ASSUMPTIONS_PATH ||
    path === MANAGED_RESEARCH_FOLLOWUPS_PATH
  )
    return ["GET", "POST"];
  return path === MANAGED_CATALOG_RESOLVE_PATH ||
    path === MANAGED_SEC_ANNUAL_EVIDENCE_PATH ||
    path === MANAGED_SEC_INTERIM_EVIDENCE_PATH ||
    path === MANAGED_SEC_FILINGS_PATH ||
    path === MANAGED_EOD_HISTORY_PATH
    ? ["POST"]
    : ["GET"];
}

function admitRoute(request: Request) {
  const url = new URL(request.url);
  validateRequestTarget(request, url);
  // Preserve catalog read admission order; write bytes are admitted after auth.
  if (
    request.method !== "POST" ||
    !(
      [
        MANAGED_PORTFOLIO_PATH,
        MANAGED_VALUATION_ASSUMPTIONS_PATH,
        MANAGED_RESEARCH_FOLLOWUPS_PATH,
        MANAGED_WATCHLIST_PATH,
        MANAGED_CATALOG_RESOLVE_PATH,
        MANAGED_SEC_ANNUAL_EVIDENCE_PATH,
        MANAGED_SEC_INTERIM_EVIDENCE_PATH,
        MANAGED_SEC_FILINGS_PATH,
        MANAGED_EOD_HISTORY_PATH,
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

function readPortfolioResult(record: PortfolioRecord | null) {
  if (record !== null && (record.id !== "main" || record.version < 1))
    throw new Error("Invalid portfolio record");
  return parseManagedPortfolio(
    record === null
      ? { version: 0, payload: null }
      : { version: record.version, payload: record.payload },
  );
}

function writePortfolioResult(
  receipt: PortfolioReceipt,
  command: ManagedPortfolioCommand,
) {
  const digest = createHash("sha256")
    .update(encodePortfolioPayload(command.payload))
    .digest("hex");
  if (receipt.id !== "main" || receipt.digestSha256 !== digest)
    throw new Error("Invalid portfolio receipt");
  return parseManagedPortfolioReceipt(
    {
      version: receipt.version,
      payload: command.payload,
      replayed: receipt.replayed,
    },
    command,
  );
}

function readFollowupsResult(record: ResearchFollowupsRecord | null) {
  if (record !== null && (record.id !== "main" || record.version < 1))
    throw new Error("Invalid follow-up record");
  return parseManagedResearchFollowups(
    record === null
      ? { version: 0, payload: { schemaVersion: 1, entries: [] } }
      : { version: record.version, payload: record.payload },
  );
}

function readValuationAssumptionsResult(
  record: ValuationAssumptionsRecord | null,
) {
  if (record !== null && (record.id !== "main" || record.version < 1))
    throw new Error("Invalid valuation assumptions record");
  return parseManagedValuationAssumptions(
    record === null
      ? { version: 0, payload: { schemaVersion: 1, entries: [] } }
      : { version: record.version, payload: record.payload },
  );
}

function writeFollowupsResult(
  receipt: ResearchFollowupsReceipt,
  command: ManagedResearchFollowupsCommand,
) {
  const digest = createHash("sha256")
    .update(encodeResearchFollowupsPayload(command.payload))
    .digest("hex");
  if (receipt.id !== "main" || receipt.digestSha256 !== digest)
    throw new Error("Invalid follow-up receipt");
  return parseManagedResearchFollowupsReceipt(
    {
      version: receipt.version,
      payload: command.payload,
      replayed: receipt.replayed,
    },
    command,
  );
}

function writeValuationAssumptionsResult(
  receipt: ValuationAssumptionsReceipt,
  command: ManagedValuationAssumptionsCommand,
) {
  const digest = createHash("sha256")
    .update(encodeValuationAssumptionsPayload(command.payload))
    .digest("hex");
  if (receipt.id !== "main" || receipt.digestSha256 !== digest)
    throw new Error("Invalid valuation assumptions receipt");
  return parseManagedValuationAssumptionsReceipt(
    {
      version: receipt.version,
      payload: command.payload,
      replayed: receipt.replayed,
    },
    command,
  );
}

interface ValuationRequestState {
  operation?: ManagedValuationAssumptionsRepositoryOperation;
  writeStarted: boolean;
}
/** One schema-aware resource branch; shared auth/error/cleanup stay in the workspace handler. */
async function valuationAssumptionsResponse(context: {
  request: Request;
  principal: ValuationAssumptionsPrincipal;
  headers: Headers;
  open: ManagedWorkspaceHandlerOptions["openValuationAssumptionsRepository"];
  state: ValuationRequestState;
}): Promise<Response> {
  const { request, principal, headers, state } = context;
  const command =
    request.method === "POST"
      ? parseManagedValuationAssumptionsCommand(
          await readJson(
            request,
            MANAGED_VALUATION_ASSUMPTIONS_LIMITS.envelopeBytes,
          ),
        )
      : undefined;
  if (command === null) throw new RequestFailure(400, "invalid_request");
  requireActiveRequest(request);
  if (!context.open)
    throw new Error("Valuation assumptions storage unavailable");
  state.operation = await context.open(request.signal);
  requireActiveRequest(request);
  if (command) {
    state.writeStarted = true;
    const receipt = await state.operation.repository.put(principal, command);
    if (request.signal.aborted) throw new Error("Write response retired");
    return jsonResponse(
      writeValuationAssumptionsResult(receipt, command),
      MANAGED_VALUATION_ASSUMPTIONS_LIMITS.envelopeBytes,
      headers,
    );
  }
  const record = await state.operation.repository.get(principal);
  requireActiveRequest(request);
  return jsonResponse(
    readValuationAssumptionsResult(record),
    MANAGED_VALUATION_ASSUMPTIONS_LIMITS.envelopeBytes,
    headers,
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
    error instanceof ManagedEconomicCalendarServiceError ||
    error instanceof ManagedMonetaryAnnouncementsServiceError
  ) {
    code = error.code;
    status = code === "request_timeout" ? 408 : 503;
  } else if (isManagedSecDataServiceError(error)) {
    if (
      error instanceof ManagedSecFilingsServiceError &&
      parseManagedSecFilingsError(
        error.code === "rate_limited"
          ? { error: error.code, nextAllowedAt: error.nextAllowedAt }
          : { error: error.code },
      ) === null
    )
      return new Response(JSON.stringify({ error: "unavailable" }), {
        status: 503,
        headers,
      });
    if (
      error instanceof ManagedEodServiceError &&
      parseManagedEodError(
        error.code === "rate_limited"
          ? { error: error.code, nextAllowedAt: error.nextAllowedAt }
          : { error: error.code },
      ) === null
    )
      return new Response(JSON.stringify({ error: "unavailable" }), {
        status: 503,
        headers,
      });
    code = error.code;
    status =
      code === "invalid_request"
        ? 400
        : code === "catalog_changed"
          ? 409
          : code === "request_timeout"
            ? 408
            : code === "unsupported_listing"
              ? 422
              : code === "rate_limited" || code === "source_rate_limited"
                ? 429
                : 503;
    if (code === "rate_limited" && error.nextAllowedAt !== undefined)
      return new Response(
        JSON.stringify({ error: code, nextAllowedAt: error.nextAllowedAt }),
        { status, headers },
      );
  } else if (
    repositoryOpened &&
    (error instanceof WatchlistRepositoryError ||
      error instanceof PortfolioRepositoryError ||
      error instanceof ResearchFollowupsRepositoryError ||
      error instanceof ValuationAssumptionsRepositoryError) &&
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
    const origin = getManagedWorkspaceOrigin(request.headers.get("origin"));
    const headers = new Headers({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      vary: "Origin",
    });
    if (origin !== null) headers.set("access-control-allow-origin", origin);
    const fail = (status: number, code: string) =>
      errorResponse(new RequestFailure(status, code), false, false, headers);
    if (origin === null) return fail(403, "origin_denied");
    let operation: ManagedWorkspaceRepositoryOperation | undefined;
    let followupsOperation: ManagedFollowupsRepositoryOperation | undefined;
    const valuationState: ValuationRequestState = { writeStarted: false };
    let portfolioOperation: ManagedPortfolioRepositoryOperation | undefined;
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
      if (route.path === MANAGED_BLS_CALENDAR_PATH) {
        if (!options.blsCalendar)
          throw new Error("Calendar service unavailable");
        const result = await options.blsCalendar.load(request.signal);
        options.blsCalendar.assertActive(request.signal);
        response = jsonResponse(
          parseManagedBlsCalendar(result),
          MANAGED_BLS_CALENDAR_LIMITS.responseBytes,
          headers,
        );
        options.blsCalendar.assertActive(request.signal);
        return response;
      }
      if (route.path === MANAGED_ECONOMIC_CALENDAR_PATH) {
        if (!options.calendar) throw new Error("Calendar service unavailable");
        const result = await options.calendar.load(request.signal);
        options.calendar.assertActive(request.signal);
        response = jsonResponse(
          parseManagedEconomicCalendar(result),
          MANAGED_ECONOMIC_CALENDAR_LIMITS.responseBytes,
          headers,
        );
        options.calendar.assertActive(request.signal);
        return response;
      }
      if (route.path === MANAGED_MONETARY_ANNOUNCEMENTS_PATH) {
        if (!options.announcements)
          throw new Error("Announcements service unavailable");
        const result = await options.announcements.load(request.signal);
        options.announcements.assertActive(request.signal);
        response = jsonResponse(
          parseManagedMonetaryAnnouncements(result),
          MANAGED_MONETARY_ANNOUNCEMENTS_LIMITS.responseBytes,
          headers,
        );
        options.announcements.assertActive(request.signal);
        return response;
      }
      if (route.path === MANAGED_EOD_HISTORY_PATH) {
        const command = parseManagedEodHistoryRequest(
          await readJson(request, MANAGED_EOD_HISTORY_LIMITS.requestBytes),
        );
        if (command === null) throw new RequestFailure(400, "invalid_request");
        requireActiveRequest(request);
        if (options.eod === undefined)
          throw new ManagedEodServiceError("not_configured");
        const result = await options.eod.load(
          command,
          auth.principal,
          request.signal,
        );
        options.eod.assertActive(request.signal);
        response = jsonResponse(
          result,
          MANAGED_EOD_HISTORY_LIMITS.responseBytes,
          headers,
        );
        options.eod.assertActive(request.signal);
        return response;
      }
      if (route.path === MANAGED_SEC_ANNUAL_EVIDENCE_PATH) {
        const command = parseManagedSecAnnualCanonicalRequest(
          await readJson(
            request,
            MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.requestBytes,
          ),
        );
        if (command === null) throw new RequestFailure(400, "invalid_request");
        requireActiveRequest(request);
        if (options.annual === undefined)
          throw new ManagedSecAnnualServiceError("not_configured");
        const result = await options.annual.load(
          command,
          auth.principal,
          request.signal,
        );
        options.annual.assertActive(request.signal);
        response = jsonResponse(
          result,
          MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes,
          headers,
        );
        options.annual.assertActive(request.signal);
        return response;
      }
      if (route.path === MANAGED_SEC_INTERIM_EVIDENCE_PATH) {
        const command = parseManagedSecInterimCanonicalRequest(
          await readJson(
            request,
            MANAGED_SEC_INTERIM_EVIDENCE_LIMITS.requestBytes,
          ),
        );
        if (command === null) throw new RequestFailure(400, "invalid_request");
        requireActiveRequest(request);
        if (options.interim === undefined)
          throw new ManagedSecInterimServiceError("not_configured");
        const result = await options.interim.load(
          command,
          auth.principal,
          request.signal,
        );
        options.interim.assertActive(request.signal);
        response = jsonResponse(
          result,
          MANAGED_SEC_INTERIM_EVIDENCE_LIMITS.responseBytes,
          headers,
        );
        options.interim.assertActive(request.signal);
        return response;
      }
      if (route.path === MANAGED_SEC_FILINGS_PATH) {
        const command = parseManagedSecFilingsRequest(
          await readJson(request, MANAGED_SEC_FILINGS_LIMITS.requestBytes),
        );
        if (command === null) throw new RequestFailure(400, "invalid_request");
        requireActiveRequest(request);
        if (options.filings === undefined)
          throw new ManagedSecFilingsServiceError("not_configured");
        const result = await options.filings.load(
          command,
          auth.principal,
          request.signal,
        );
        options.filings.assertActive(request.signal);
        response = jsonResponse(
          parseManagedSecFilingsResponse(result, command),
          MANAGED_SEC_FILINGS_LIMITS.responseBytes,
          headers,
        );
        options.filings.assertActive(request.signal);
        return response;
      }
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
      if (route.path === MANAGED_VALUATION_ASSUMPTIONS_PATH) {
        response = await valuationAssumptionsResponse({
          request,
          principal: auth.principal,
          headers,
          open: options.openValuationAssumptionsRepository,
          state: valuationState,
        });
        writeStarted = valuationState.writeStarted;
      } else if (route.path === MANAGED_PORTFOLIO_PATH) {
        const command =
          request.method === "POST"
            ? parseManagedPortfolioCommand(
                await readJson(request, MANAGED_PORTFOLIO_LIMITS.envelopeBytes),
              )
            : undefined;
        if (command === null) throw new RequestFailure(400, "invalid_request");
        requireActiveRequest(request);
        if (!options.openPortfolioRepository)
          throw new Error("Portfolio storage unavailable");
        portfolioOperation = await options.openPortfolioRepository(
          request.signal,
        );
        requireActiveRequest(request);
        if (command) {
          writeStarted = true;
          const receipt = await portfolioOperation.repository.put(
            auth.principal,
            command,
          );
          if (request.signal.aborted) throw new Error("Write response retired");
          response = jsonResponse(
            writePortfolioResult(receipt, command),
            MANAGED_PORTFOLIO_LIMITS.envelopeBytes,
            headers,
          );
        } else {
          const record = await portfolioOperation.repository.get(
            auth.principal,
          );
          requireActiveRequest(request);
          response = jsonResponse(
            readPortfolioResult(record),
            MANAGED_PORTFOLIO_LIMITS.envelopeBytes,
            headers,
          );
        }
      } else if (route.path === MANAGED_RESEARCH_FOLLOWUPS_PATH) {
        const command =
          request.method === "POST"
            ? parseManagedResearchFollowupsCommand(
                await readJson(
                  request,
                  MANAGED_RESEARCH_FOLLOWUPS_LIMITS.envelopeBytes,
                ),
              )
            : undefined;
        if (command === null) throw new RequestFailure(400, "invalid_request");
        requireActiveRequest(request);
        followupsOperation = await options.openFollowupsRepository(
          request.signal,
        );
        requireActiveRequest(request);
        if (command) {
          writeStarted = true;
          const receipt = await followupsOperation.repository.put(
            auth.principal,
            command,
          );
          if (request.signal.aborted) throw new Error("Write response retired");
          response = jsonResponse(
            writeFollowupsResult(receipt, command),
            MANAGED_RESEARCH_FOLLOWUPS_LIMITS.envelopeBytes,
            headers,
          );
        } else {
          const record = await followupsOperation.repository.get(
            auth.principal,
          );
          requireActiveRequest(request);
          response = jsonResponse(
            readFollowupsResult(record),
            MANAGED_RESEARCH_FOLLOWUPS_LIMITS.envelopeBytes,
            headers,
          );
        }
      } else {
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
          const receipt = await operation.repository.put(
            auth.principal,
            command,
          );
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
      }
    } catch (error) {
      writeStarted = writeStarted || valuationState.writeStarted;
      response = errorResponse(
        error,
        writeStarted,
        operation !== undefined ||
          followupsOperation !== undefined ||
          portfolioOperation !== undefined ||
          valuationState.operation !== undefined,
        headers,
      );
    } finally {
      const opened =
        operation ??
        followupsOperation ??
        portfolioOperation ??
        valuationState.operation;
      if (opened) {
        try {
          await opened.close();
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
        operation !== undefined ||
          followupsOperation !== undefined ||
          portfolioOperation !== undefined ||
          valuationState.operation !== undefined,
        headers,
      );
    return response;
  };
}
