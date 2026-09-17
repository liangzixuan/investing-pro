import {
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_FINANCIAL_SCREEN_WATCHLIST_LIMIT,
  type PersonalFinancialSavedViewDisplayDto,
  type PersonalFinancialScreenRequestDto,
  type PersonalFinancialScreenWatchlistScopeDto,
  type PersonalFinancialSavedViewsPayloadDto,
  type PersonalSecurityMasterScreenRowDto,
  type ProblemDetailsDto,
} from "@research-cockpit/contracts";
import {
  evaluatePersonalFinancialScreen,
  validatePersonalFinancialScreenCriteria,
} from "@research-cockpit/personal-financial-analytics";
import {
  LocalResearchVaultError,
  type JsonValue,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
import {
  PERSONAL_SECURITY_MASTER_LIMITS,
  searchPersonalSecurityMaster,
  screenPersonalSecurityMaster,
  type PersonalSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { DemoApiListenOptions } from "./listen-options";
import type { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import {
  authorizePersonalJsonRouteRequest,
  authorizePersonalRouteRequest,
  authorizePersonalVaultMutationRouteRequest,
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
  sendPersonalOwnerSessionProblem,
} from "./personal-owner-session-routes";
import {
  PersonalSecFinancialProviderError,
  type PersonalSecFinancialProvider,
} from "./personal-sec-financial-provider";
import {
  isMainWatchlistPayload,
  membershipMatchesResult,
  type MainWatchlistPayload,
} from "./workspace-watchlist-routes";

export const PERSONAL_FINANCIAL_SCREEN_PATH =
  "/v1/personal-filing/workspace/financial-screen" as const;
export const PERSONAL_FINANCIAL_SAVED_VIEWS_PATH =
  "/v1/personal-filing/workspace/financial-screen/saved-views" as const;
export const PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID =
  "financial-screener-saved-views" as const;
const SAVED_VIEWS_KIND = "settings" as const;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SCREEN_REQUEST_KEYS = [
  "schemaVersion",
  "catalogSnapshotSha256",
  "financialSnapshotSha256",
  "criteria",
  "page",
  "refresh",
] as const;
interface PutBody {
  readonly payload: JsonValue;
}
class WatchlistFinancialSelectionError extends Error {
  constructor(readonly status: 400 | 404 | 409) {
    super("The saved watchlist selection is unavailable.");
  }
}

export function registerPersonalWorkspaceFinancialScreenRoutes(
  app: FastifyInstance,
  catalog: PersonalSecurityMasterCatalog,
  vault: LocalResearchVault,
  provider: PersonalSecFinancialProvider,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  app.post<{ Body: unknown }>(
    PERSONAL_FINANCIAL_SCREEN_PATH,
    {
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalJsonRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_FINANCIAL_SCREEN_PATH,
          )
        )
          return sendPersonalOwnerSessionProblem(reply, request);
      },
      errorHandler: (_error, request, reply) => {
        void sendFinancialProblem(reply, request, 400, "invalid_request");
      },
    },
    async (request, reply) => {
      if (!isScreenRequest(request.body))
        return sendScreenerProblem(reply, request, 400);
      const body = request.body;
      if (body.catalogSnapshotSha256 !== catalog.snapshotSha256)
        return sendScreenerProblem(reply, request, 409);
      const controller = new AbortController();
      const abort = () => controller.abort();
      request.raw.once("aborted", abort);
      reply.raw.once("close", abort);
      try {
        const watchlist =
          body.scope === undefined
            ? undefined
            : readBoundWatchlist(vault, catalog, body.scope);
        const selectedIdentities =
          watchlist === undefined || body.scope === undefined
            ? undefined
            : resolveSelectedListings(catalog, watchlist, body.scope);
        const snapshot = await provider.loadSnapshot(
          body.criteria.calendarYear,
          controller.signal,
          body.refresh,
        );
        if (controller.signal.aborted) return;
        if (body.scope !== undefined) {
          try {
            readBoundWatchlist(vault, catalog, body.scope);
          } catch (error) {
            // A deletion or mutation while loading cannot revive an old selection.
            if (error instanceof WatchlistFinancialSelectionError) {
              throw new WatchlistFinancialSelectionError(409);
            }
            throw error;
          }
        }
        if (
          body.financialSnapshotSha256 !== null &&
          body.financialSnapshotSha256 !== snapshot.snapshotSha256
        )
          return sendScreenerProblem(reply, request, 409);
        const identities: PersonalSecurityMasterScreenRowDto[] =
          selectedIdentities ?? [];
        for (
          let offset = 0;
          selectedIdentities === undefined && offset < 10_000;
          offset += 100
        ) {
          const batch = screenPersonalSecurityMaster(catalog, {
            schemaVersion: "1.0.0",
            snapshotSha256: catalog.snapshotSha256,
            query: { operator: "and", clauses: [] },
            sort: { field: "symbol", direction: "asc" },
            page: { offset, limit: 100 },
          });
          if (batch.totalUniverse > 10_000)
            return sendFinancialProblem(
              reply,
              request,
              503,
              "provider_unavailable",
            );
          identities.push(...batch.rows);
          if (!batch.hasMore) break;
        }
        const result = evaluatePersonalFinancialScreen(
          identities,
          snapshot,
          body.criteria,
          body.page,
          catalog.snapshotSha256,
        );
        return reply.type("application/json; charset=utf-8").send(
          watchlist === undefined || body.scope === undefined
            ? result
            : {
                ...result,
                scope: {
                  ...body.scope,
                  listingIds: [...body.scope.listingIds],
                  totalWatchlistListings: watchlist.memberships.length,
                },
              },
        );
      } catch (error) {
        if (error instanceof WatchlistFinancialSelectionError) {
          return sendFinancialProblem(
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
        if (error instanceof PersonalSecFinancialProviderError) {
          if (error.code === "not_configured")
            return sendFinancialProblem(reply, request, 503, "not_configured");
          if (error.code === "invalid_request")
            return sendFinancialProblem(reply, request, 400, "invalid_request");
          if (error.code === "busy")
            return sendFinancialProblem(reply, request, 429, "rate_limited");
          if (error.code === "aborted" && controller.signal.aborted) return;
        }
        return sendFinancialProblem(
          reply,
          request,
          502,
          "provider_unavailable",
        );
      } finally {
        request.raw.off("aborted", abort);
        reply.raw.off("close", abort);
      }
    },
  );
  app.get(
    PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
      },
    },
    (request, reply) => {
      try {
        const record = vault.getRecord(
          SAVED_VIEWS_KIND,
          PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
        );
        if (!isSavedViewsPayload(record.payload)) {
          return sendSavedViewsProblem(
            reply.header("ETag", versionEtag(record.version)),
            request,
            409,
          );
        }
        return reply.header("ETag", versionEtag(record.version)).send(record);
      } catch (error) {
        return handleSavedViewsVaultError(error, reply, request);
      }
    },
  );

  app.post<{ Body: PutBody }>(
    PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    {
      onRequest: async (request, reply) => {
        const intent = singleHeader(request, PERSONAL_OWNER_INTENT_HEADER_NAME);
        if (
          intent !== "personal-vault-create" &&
          intent !== "personal-vault-update"
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
        if (
          !authorizePersonalVaultMutationRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
            intent,
            "json",
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
        const expectedVersion = mutationPrecondition(request, intent);
        const idempotencyKey = singleHeader(
          request,
          PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
        );
        if (
          expectedVersion === undefined ||
          idempotencyKey === undefined ||
          !IDEMPOTENCY_PATTERN.test(idempotencyKey)
        ) {
          return sendSavedViewsProblem(reply, request, 400);
        }
      },
    },
    (request, reply) => {
      const intent = singleHeader(request, PERSONAL_OWNER_INTENT_HEADER_NAME);
      if (
        (intent !== "personal-vault-create" &&
          intent !== "personal-vault-update") ||
        !isPutBody(request.body) ||
        !isSavedViewsPayload(request.body.payload)
      ) {
        return sendSavedViewsProblem(reply, request, 400);
      }
      const expectedVersion = mutationPrecondition(request, intent);
      const idempotencyKey = singleHeader(
        request,
        PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
      );
      if (expectedVersion === undefined || idempotencyKey === undefined) {
        return sendSavedViewsProblem(reply, request, 400);
      }
      try {
        const receipt = vault.putRecord({
          expectedVersion,
          id: PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
          idempotencyKey,
          kind: SAVED_VIEWS_KIND,
          payload: request.body.payload,
        });
        return reply
          .status(intent === "personal-vault-create" ? 201 : 200)
          .header("ETag", versionEtag(receipt.version))
          .send(receipt);
      } catch (error) {
        return handleSavedViewsVaultError(error, reply, request);
      }
    },
  );
}

function isScreenRequest(
  value: unknown,
): value is PersonalFinancialScreenRequestDto {
  return (
    (hasExactKeys(value, SCREEN_REQUEST_KEYS) ||
      (hasExactKeys(value, [...SCREEN_REQUEST_KEYS, "scope"]) &&
        isWatchlistScope(value.scope))) &&
    value.schemaVersion === "12.0.0" &&
    isSnapshotDigest(value.catalogSnapshotSha256) &&
    (value.financialSnapshotSha256 === null ||
      isSnapshotDigest(value.financialSnapshotSha256)) &&
    typeof value.refresh === "boolean" &&
    (!value.refresh || value.financialSnapshotSha256 === null) &&
    validatePersonalFinancialScreenCriteria(value.criteria) &&
    value.criteria.calendarYear < new Date().getUTCFullYear() &&
    hasExactKeys(value.page, ["offset", "limit"]) &&
    Number.isSafeInteger(value.page.offset) &&
    (value.page.offset as number) >= 0 &&
    (value.page.offset as number) <= 10_000 &&
    ((value.page.offset as number) === 0 ||
      value.financialSnapshotSha256 !== null) &&
    (!value.refresh || (value.page.offset as number) === 0) &&
    Number.isSafeInteger(value.page.limit) &&
    (value.page.limit as number) >= 1 &&
    (value.page.limit as number) <= 250
  );
}
function isWatchlistScope(
  value: unknown,
): value is PersonalFinancialScreenWatchlistScopeDto {
  return (
    hasExactKeys(value, ["kind", "watchlistVersion", "listingIds"]) &&
    value.kind === "watchlist" &&
    Number.isSafeInteger(value.watchlistVersion) &&
    (value.watchlistVersion as number) > 0 &&
    Array.isArray(value.listingIds) &&
    value.listingIds.length > 0 &&
    value.listingIds.length <= PERSONAL_FINANCIAL_SCREEN_WATCHLIST_LIMIT &&
    value.listingIds.every(
      (id: unknown) => typeof id === "string" && IDENTIFIER.test(id),
    ) &&
    new Set(value.listingIds).size === value.listingIds.length
  );
}
function readBoundWatchlist(
  vault: LocalResearchVault,
  catalog: PersonalSecurityMasterCatalog,
  scope: PersonalFinancialScreenWatchlistScopeDto,
): MainWatchlistPayload {
  let record;
  try {
    record = vault.getRecord("watchlist", "main");
  } catch (error) {
    if (
      error instanceof LocalResearchVaultError &&
      (error.code === "VAULT_NOT_FOUND" || error.code === "VAULT_DELETED")
    ) {
      throw new WatchlistFinancialSelectionError(404);
    }
    throw error;
  }
  if (
    record.version !== scope.watchlistVersion ||
    !isMainWatchlistPayload(record.payload) ||
    record.payload.snapshotSha256 !== catalog.snapshotSha256
  ) {
    throw new WatchlistFinancialSelectionError(409);
  }
  return record.payload;
}
function resolveSelectedListings(
  catalog: PersonalSecurityMasterCatalog,
  watchlist: MainWatchlistPayload,
  scope: PersonalFinancialScreenWatchlistScopeDto,
): PersonalSecurityMasterScreenRowDto[] {
  const memberships = new Map(
    watchlist.memberships.map((membership) => [
      membership.listingId,
      membership,
    ]),
  );
  return scope.listingIds.map((listingId) => {
    const membership = memberships.get(listingId);
    if (membership === undefined)
      throw new WatchlistFinancialSelectionError(400);
    const admitted = searchPersonalSecurityMaster(catalog, {
      limit: PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap,
      query: membership.symbol,
    }).results.find((listing) => listing.listingId === listingId);
    if (
      admitted === undefined ||
      !membershipMatchesResult(membership, admitted)
    ) {
      throw new WatchlistFinancialSelectionError(409);
    }
    return {
      cik: admitted.cik,
      country: admitted.country,
      exchangeMic: admitted.exchangeMic,
      instrumentType: admitted.instrumentType,
      issuerId: admitted.issuerId,
      issuerName: admitted.issuerName,
      listingId: admitted.listingId,
      securityId: admitted.securityId,
      securityName: admitted.securityName,
      shareClassId: admitted.shareClassId,
      shareClassName: admitted.shareClassName,
      symbol: admitted.symbol,
    };
  });
}
function isPutBody(value: unknown): value is PutBody {
  return hasExactKeys(value, ["payload"]);
}
function isSavedViewsPayload(
  value: unknown,
): value is PersonalFinancialSavedViewsPayloadDto & JsonValue {
  if (
    !hasExactKeys(value, ["schemaVersion", "views"]) ||
    (value.schemaVersion !== 1 && value.schemaVersion !== 2) ||
    !Array.isArray(value.views) ||
    value.views.length > 20
  )
    return false;
  const ids = new Set<string>(),
    names = new Set<string>();
  for (const view of value.views) {
    if (
      !hasExactKeys(view, [
        "id",
        "name",
        "criteria",
        "createdAgainstCatalogSnapshotSha256",
        "createdAgainstFinancialSnapshotSha256",
        ...(value.schemaVersion === 2 ? ["display"] : []),
      ]) ||
      (value.schemaVersion === 2 &&
        view.display !== null &&
        !isSavedViewDisplay(view.display)) ||
      typeof view.id !== "string" ||
      !/^[a-z0-9][a-z0-9._:-]{2,127}$/u.test(view.id) ||
      typeof view.name !== "string" ||
      view.name !== view.name.trim().normalize("NFC") ||
      [...view.name].length < 1 ||
      [...view.name].length > 80 ||
      /[\p{Cc}\p{Cf}\p{Cs}]/u.test(view.name) ||
      !validatePersonalFinancialScreenCriteria(view.criteria) ||
      !isSnapshotDigest(view.createdAgainstCatalogSnapshotSha256) ||
      !isSnapshotDigest(view.createdAgainstFinancialSnapshotSha256)
    )
      return false;
    const name = view.name.toLocaleLowerCase("en-US");
    if (ids.has(view.id) || names.has(name)) return false;
    ids.add(view.id);
    names.add(name);
  }
  return true;
}
function isSavedViewDisplay(
  value: unknown,
): value is PersonalFinancialSavedViewDisplayDto {
  if (
    !hasExactKeys(value, ["visibleMetrics"]) ||
    !Array.isArray(value.visibleMetrics) ||
    value.visibleMetrics.length < 1 ||
    value.visibleMetrics.length > PERSONAL_FINANCIAL_SCREEN_METRICS.length
  )
    return false;
  let previousIndex = -1;
  for (const metric of value.visibleMetrics) {
    const index = PERSONAL_FINANCIAL_SCREEN_METRICS.findIndex(
      (candidate) => candidate === metric,
    );
    if (index <= previousIndex) return false;
    previousIndex = index;
  }
  return true;
}
function isSnapshotDigest(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && DIGEST.test(value);
}
function hasExactKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const actual = Object.keys(value).sort(),
    expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
function sendFinancialProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: 400 | 404 | 409 | 429 | 502 | 503,
  code: string,
) {
  const problem: ProblemDetailsDto & { code: string } = {
    type: `https://research-cockpit.local/problems/${String(status)}`,
    title: "Financial screen unavailable",
    detail: "The SEC financial screen request was not accepted.",
    instance: PERSONAL_FINANCIAL_SCREEN_PATH,
    status,
    traceId: request.id,
    code,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
function mutationPrecondition(
  request: FastifyRequest,
  intent: "personal-vault-create" | "personal-vault-update",
): number | undefined {
  if (intent === "personal-vault-create") {
    return singleHeader(request, "if-none-match") === "*" &&
      !hasHeader(request, "if-match")
      ? 0
      : undefined;
  }
  return !hasHeader(request, "if-none-match")
    ? strongIfMatch(request)
    : undefined;
}

function strongIfMatch(request: FastifyRequest): number | undefined {
  const value = singleHeader(request, "if-match");
  const match = value?.match(/^"v([1-9][0-9]{0,14})"$/u);
  if (match?.[1] === undefined) return undefined;
  const version = Number(match[1]);
  return Number.isSafeInteger(version) ? version : undefined;
}

function singleHeader(
  request: FastifyRequest,
  name: string,
): string | undefined {
  const values: string[] = [];
  for (let index = 0; index < request.raw.rawHeaders.length; index += 2) {
    if (request.raw.rawHeaders[index]?.toLowerCase() === name) {
      values.push(request.raw.rawHeaders[index + 1] ?? "");
    }
  }
  const normalized = request.headers[name];
  return values.length === 1 &&
    typeof normalized === "string" &&
    normalized === values[0]
    ? normalized
    : undefined;
}

function hasHeader(request: FastifyRequest, name: string): boolean {
  return request.raw.rawHeaders.some(
    (value, index) => index % 2 === 0 && value.toLowerCase() === name,
  );
}

function versionEtag(version: number): string {
  return `"v${String(version)}"`;
}

function handleSavedViewsVaultError(
  error: unknown,
  reply: FastifyReply,
  request: FastifyRequest,
) {
  if (!(error instanceof LocalResearchVaultError)) throw error;
  if (error.code === "VAULT_INVALID_INPUT") {
    return sendSavedViewsProblem(reply, request, 400);
  }
  if (error.code === "VAULT_NOT_FOUND" || error.code === "VAULT_DELETED") {
    return sendSavedViewsProblem(reply, request, 404);
  }
  if (
    error.code === "VAULT_CONFLICT" ||
    error.code === "VAULT_IDEMPOTENCY_CONFLICT"
  ) {
    return sendSavedViewsProblem(reply, request, 409);
  }
  throw error;
}

function sendScreenerProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: 400 | 409,
) {
  const problem: ProblemDetailsDto = {
    detail: "The personal financial screen request was not accepted.",
    instance: PERSONAL_FINANCIAL_SCREEN_PATH,
    status,
    title:
      status === 400
        ? "Screener request invalid"
        : "Screener snapshot conflict",
    traceId: request.id,
    type: `https://research-cockpit.local/problems/${String(status)}`,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}

function sendSavedViewsProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: 400 | 404 | 409,
) {
  const problem: ProblemDetailsDto = {
    detail: "The personal screener saved-view request was not accepted.",
    instance: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    status,
    title:
      status === 400
        ? "Saved-view request invalid"
        : status === 404
          ? "Saved views unavailable"
          : "Saved-view conflict",
    traceId: request.id,
    type: `https://research-cockpit.local/problems/${String(status)}`,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
