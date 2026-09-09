import {
  PERSONAL_WATCHLIST_FILINGS_LIMITS,
  type PersonalSecIssuerFilingsDto,
  type PersonalWatchlistFilingDto,
  type PersonalWatchlistFilingListingDto,
  type PersonalWatchlistFilingsRequestDto,
  type PersonalWatchlistFilingsResponseDto,
  type ProblemDetailsDto,
} from "@research-cockpit/contracts";
import {
  LocalResearchVaultError,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
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
  sendPersonalOwnerSessionProblem,
} from "./personal-owner-session-routes";
import {
  PersonalSecFilingsProviderError,
  type PersonalSecFilingsProvider,
} from "./personal-sec-filings-provider";
import {
  isMainWatchlistPayload,
  membershipMatchesResult,
  type MainWatchlistPayload,
} from "./workspace-watchlist-routes";

export const PERSONAL_WATCHLIST_FILINGS_PATH =
  "/v1/personal-filing/workspace/watchlist-filings" as const;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const DAY_MS = 86_400_000;

class WatchlistSelectionError extends Error {
  constructor(readonly status: 400 | 404 | 409) {
    super("The saved watchlist selection is unavailable.");
  }
}

export function registerPersonalWorkspaceWatchlistFilingsRoutes(
  app: FastifyInstance,
  catalog: PersonalSecurityMasterCatalog,
  vault: LocalResearchVault,
  provider: PersonalSecFilingsProvider,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  app.post<{ Body: unknown }>(
    PERSONAL_WATCHLIST_FILINGS_PATH,
    {
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalJsonRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_WATCHLIST_FILINGS_PATH,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
      },
      errorHandler: (_error, request, reply) => {
        void sendFilingsProblem(reply, request, 400, "invalid_request");
      },
    },
    async (request, reply) => {
      if (!isFilingsRequest(request.body)) {
        return sendFilingsProblem(reply, request, 400, "invalid_request");
      }
      const body = request.body;
      if (body.catalogSnapshotSha256 !== catalog.snapshotSha256) {
        return sendFilingsProblem(reply, request, 409, "conflict");
      }
      const controller = new AbortController();
      const abort = () => controller.abort();
      request.raw.once("aborted", abort);
      reply.raw.once("close", abort);
      try {
        const watchlist = readBoundWatchlist(vault, catalog, body);
        const listingsByCik = resolveSelectedListings(catalog, watchlist, body);
        // Capture the date window once, so a request crossing UTC midnight
        // retains the same inclusive filing-date bounds and request timestamp.
        const fetchedAt = new Date().toISOString();
        const throughDate = fetchedAt.slice(0, 10);
        const fromDate = new Date(
          Date.parse(`${throughDate}T00:00:00.000Z`) -
            (body.lookbackDays - 1) * DAY_MS,
        )
          .toISOString()
          .slice(0, 10);
        const results = await provider.loadFilings(
          [...listingsByCik.keys()],
          fromDate,
          throughDate,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        try {
          readBoundWatchlist(vault, catalog, body);
        } catch (error) {
          // Deletion or mutation during an in-flight read invalidates the
          // selection. Source results must never restore that stale selection.
          if (error instanceof WatchlistSelectionError) {
            throw new WatchlistSelectionError(409);
          }
          throw error;
        }
        const response = assembleResponse(
          body,
          watchlist.memberships.length,
          listingsByCik,
          results,
          fromDate,
          throughDate,
          fetchedAt,
        );
        return reply.type("application/json; charset=utf-8").send(response);
      } catch (error) {
        if (error instanceof WatchlistSelectionError) {
          return sendFilingsProblem(
            reply,
            request,
            error.status,
            error.status === 409
              ? "conflict"
              : error.status === 404
                ? "not_covered"
                : "invalid_request",
          );
        }
        if (error instanceof PersonalSecFilingsProviderError) {
          if (error.code === "aborted" && controller.signal.aborted) return;
          if (error.code === "not_configured") {
            return sendFilingsProblem(reply, request, 503, "not_configured");
          }
          if (error.code === "busy") {
            return sendFilingsProblem(reply, request, 429, "rate_limited");
          }
          if (error.code === "invalid_request") {
            return sendFilingsProblem(reply, request, 400, "invalid_request");
          }
        }
        return sendFilingsProblem(reply, request, 502, "provider_unavailable");
      } finally {
        request.raw.off("aborted", abort);
        reply.raw.off("close", abort);
      }
    },
  );
}

function isFilingsRequest(
  value: unknown,
): value is PersonalWatchlistFilingsRequestDto {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !==
      "catalogSnapshotSha256,listingIds,lookbackDays,schemaVersion,watchlistVersion"
  ) {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    body.schemaVersion === "1.0.0" &&
    typeof body.catalogSnapshotSha256 === "string" &&
    DIGEST.test(body.catalogSnapshotSha256) &&
    Number.isSafeInteger(body.watchlistVersion) &&
    (body.watchlistVersion as number) > 0 &&
    (body.lookbackDays === 7 ||
      body.lookbackDays === 30 ||
      body.lookbackDays === 90) &&
    Array.isArray(body.listingIds) &&
    body.listingIds.length > 0 &&
    body.listingIds.length <=
      PERSONAL_WATCHLIST_FILINGS_LIMITS.selectedListings &&
    body.listingIds.every(
      (id: unknown) => typeof id === "string" && IDENTIFIER.test(id),
    ) &&
    new Set(body.listingIds).size === body.listingIds.length
  );
}

function readBoundWatchlist(
  vault: LocalResearchVault,
  catalog: PersonalSecurityMasterCatalog,
  request: PersonalWatchlistFilingsRequestDto,
): MainWatchlistPayload {
  let record;
  try {
    record = vault.getRecord("watchlist", "main");
  } catch (error) {
    if (
      error instanceof LocalResearchVaultError &&
      (error.code === "VAULT_NOT_FOUND" || error.code === "VAULT_DELETED")
    ) {
      throw new WatchlistSelectionError(404);
    }
    throw error;
  }
  if (
    record.version !== request.watchlistVersion ||
    !isMainWatchlistPayload(record.payload) ||
    record.payload.snapshotSha256 !== catalog.snapshotSha256
  ) {
    throw new WatchlistSelectionError(409);
  }
  return record.payload;
}

function resolveSelectedListings(
  catalog: PersonalSecurityMasterCatalog,
  watchlist: MainWatchlistPayload,
  request: PersonalWatchlistFilingsRequestDto,
): Map<string, PersonalWatchlistFilingListingDto[]> {
  const memberships = new Map(
    watchlist.memberships.map((membership) => [
      membership.listingId,
      membership,
    ]),
  );
  const listingsByCik = new Map<string, PersonalWatchlistFilingListingDto[]>();
  for (const listingId of request.listingIds) {
    const membership = memberships.get(listingId);
    if (membership === undefined) throw new WatchlistSelectionError(400);
    const admitted = searchPersonalSecurityMaster(catalog, {
      limit: PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap,
      query: membership.symbol,
    }).results.find((listing) => listing.listingId === listingId);
    if (
      admitted === undefined ||
      !membershipMatchesResult(membership, admitted)
    ) {
      throw new WatchlistSelectionError(409);
    }
    const listings = listingsByCik.get(admitted.cik) ?? [];
    listings.push({
      listingId: admitted.listingId,
      symbol: admitted.symbol,
      issuerName: admitted.issuerName,
    });
    listingsByCik.set(admitted.cik, listings);
  }
  return listingsByCik;
}

function assembleResponse(
  request: PersonalWatchlistFilingsRequestDto,
  totalWatchlistListings: number,
  listingsByCik: ReadonlyMap<
    string,
    readonly PersonalWatchlistFilingListingDto[]
  >,
  results: readonly PersonalSecIssuerFilingsDto[],
  fromDate: string,
  throughDate: string,
  fetchedAt: string,
): PersonalWatchlistFilingsResponseDto {
  if (
    !isArray(results) ||
    results.length !== listingsByCik.size ||
    new Set(results.map((result) => result.cik)).size !== results.length ||
    results.some((result) => !listingsByCik.has(result.cik))
  ) {
    throw new Error("The filings source response does not match the request.");
  }
  const resultsByCik = new Map(results.map((result) => [result.cik, result]));
  const issuers: PersonalWatchlistFilingsResponseDto["issuers"][number][] = [];
  const filings: PersonalWatchlistFilingDto[] = [];
  let matchingFilings = 0;
  let sourceTruncated = false;
  for (const [cik, listings] of listingsByCik) {
    const result = resultsByCik.get(cik)!;
    if (
      !isArray(result.filings) ||
      result.filings.length >
        PERSONAL_WATCHLIST_FILINGS_LIMITS.responseFilings ||
      !Number.isSafeInteger(result.matchingFilings) ||
      result.matchingFilings < result.filings.length ||
      result.matchingFilings > 10_000 ||
      result.truncated !== result.matchingFilings > result.filings.length ||
      new Set(result.filings.map((filing) => filing.accessionNumber)).size !==
        result.filings.length ||
      result.filings.some(
        (filing) =>
          filing.cik !== cik ||
          filing.filingDate < fromDate ||
          filing.filingDate > throughDate,
      ) ||
      (result.status !== "available" &&
        (result.filings.length !== 0 ||
          result.matchingFilings !== 0 ||
          result.olderHistoryAvailable !== false ||
          result.truncated !== false))
    ) {
      throw new Error(
        "The filings source response does not match the request.",
      );
    }
    matchingFilings += result.matchingFilings;
    sourceTruncated ||= result.truncated;
    issuers.push({
      cik,
      status: result.status,
      fetchedAt: result.fetchedAt,
      sourceUrl: result.sourceUrl,
      olderHistoryAvailable: result.olderHistoryAvailable,
      matchingFilings: result.matchingFilings,
      truncated: result.truncated,
      listings,
    });
    for (const filing of result.filings) {
      filings.push({
        cik,
        accessionNumber: filing.accessionNumber,
        form: filing.form,
        filingDate: filing.filingDate,
        reportDate: filing.reportDate,
        sourceUrl: filing.sourceUrl,
        listings,
      });
    }
  }
  filings.sort(
    (left, right) =>
      compare(right.filingDate, left.filingDate) ||
      compare(left.accessionNumber, right.accessionNumber) ||
      compare(left.cik, right.cik),
  );
  const visibleFilings = filings.slice(
    0,
    PERSONAL_WATCHLIST_FILINGS_LIMITS.responseFilings,
  );
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: request.catalogSnapshotSha256,
    watchlistVersion: request.watchlistVersion,
    lookbackDays: request.lookbackDays,
    fromDate,
    throughDate,
    fetchedAt,
    totalWatchlistListings,
    selectedListingIds: [...request.listingIds],
    issuers,
    matchingFilings,
    truncated: sourceTruncated || matchingFilings > visibleFilings.length,
    filings: visibleFilings,
  };
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isArray(value: unknown): boolean {
  return Array.isArray(value);
}

function sendFilingsProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: 400 | 404 | 409 | 429 | 502 | 503,
  code: string,
) {
  const problem: ProblemDetailsDto & { readonly code: string } = {
    type: `https://research-cockpit.local/problems/${String(status)}`,
    title: "Watchlist filings unavailable",
    status,
    detail:
      "The personal workspace watchlist filings request was not accepted.",
    instance: PERSONAL_WATCHLIST_FILINGS_PATH,
    traceId: request.id,
    code,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
