import type { ProblemDetailsDto } from "@research-cockpit/contracts";
import {
  LocalResearchVaultError,
  type JsonValue,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
import {
  PERSONAL_SECURITY_MASTER_LIMITS,
  searchPersonalSecurityMaster,
  type PersonalSecurityMasterCatalog,
  type PersonalSecurityMasterSearchResult,
} from "@research-cockpit/personal-security-master";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { DemoApiListenOptions } from "./listen-options";
import type { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import {
  authorizePersonalRouteRequest,
  authorizePersonalVaultMutationRouteRequest,
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
  sendPersonalOwnerSessionProblem,
} from "./personal-owner-session-routes";

export const PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH =
  "/v1/personal-filing/workspace/watchlists/main" as const;

const MAIN_WATCHLIST_ID = "main" as const;
const MAIN_WATCHLIST_NAME = "My Watchlist" as const;
const WATCHLIST_KIND = "watchlist" as const;
const MAXIMUM_MEMBERSHIPS = 10_000;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const SNAPSHOT_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MIC_PATTERN = /^[A-Z0-9]{4}$/u;
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;
const CONTROL_FORMAT_OR_SURROGATE_CHARACTER = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const WATCHLIST_PAYLOAD_KEYS = [
  "memberships",
  "name",
  "schemaVersion",
  "snapshotSha256",
] as const;
const MEMBERSHIP_KEYS = [
  "country",
  "exchangeMic",
  "instrumentType",
  "issuerId",
  "issuerName",
  "listingId",
  "note",
  "securityId",
  "securityName",
  "shareClassId",
  "shareClassName",
  "symbol",
] as const;

interface PutBody {
  readonly payload: JsonValue;
}

type WatchlistMembership = Readonly<{
  country: "US";
  exchangeMic: string;
  instrumentType: "adr" | "common_stock";
  issuerId: string;
  issuerName: string;
  listingId: string;
  note: string;
  securityId: string;
  securityName: string;
  shareClassId: string;
  shareClassName: string;
  symbol: string;
}>;

type MainWatchlistPayload = Readonly<{
  memberships: readonly WatchlistMembership[];
  name: typeof MAIN_WATCHLIST_NAME;
  schemaVersion: 1;
  snapshotSha256: string;
}> & { readonly [key: string]: JsonValue };

export function registerPersonalWorkspaceWatchlistRoutes(
  app: FastifyInstance,
  catalog: PersonalSecurityMasterCatalog,
  vault: LocalResearchVault,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  app.get(
    PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
      },
    },
    (request, reply) => {
      try {
        const record = vault.getRecord(WATCHLIST_KIND, MAIN_WATCHLIST_ID);
        if (
          !isMainWatchlistPayload(record.payload) ||
          (record.payload.snapshotSha256 === catalog.snapshotSha256 &&
            !membershipsMatchCatalog(catalog, record.payload.memberships))
        ) {
          return sendWatchlistProblem(
            reply.header("ETag", versionEtag(record.version)),
            request,
            409,
          );
        }
        return reply.header("ETag", versionEtag(record.version)).send(record);
      } catch (error) {
        return handleVaultError(error, reply, request);
      }
    },
  );

  app.post<{ Body: PutBody }>(
    PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
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
            PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
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
          return sendWatchlistProblem(reply, request, 400);
        }
      },
    },
    (request, reply) => {
      const intent = singleHeader(request, PERSONAL_OWNER_INTENT_HEADER_NAME);
      if (
        (intent !== "personal-vault-create" &&
          intent !== "personal-vault-update") ||
        !isPutBody(request.body) ||
        !isMainWatchlistPayload(request.body.payload)
      ) {
        return sendWatchlistProblem(reply, request, 400);
      }
      if (request.body.payload.snapshotSha256 !== catalog.snapshotSha256) {
        return sendWatchlistProblem(reply, request, 409);
      }
      if (!membershipsMatchCatalog(catalog, request.body.payload.memberships)) {
        return sendWatchlistProblem(reply, request, 400);
      }
      const expectedVersion = mutationPrecondition(request, intent);
      const idempotencyKey = singleHeader(
        request,
        PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
      );
      if (expectedVersion === undefined || idempotencyKey === undefined) {
        return sendWatchlistProblem(reply, request, 400);
      }
      try {
        const receipt = vault.putRecord({
          kind: WATCHLIST_KIND,
          id: MAIN_WATCHLIST_ID,
          expectedVersion,
          idempotencyKey,
          payload: request.body.payload,
        });
        return reply
          .status(intent === "personal-vault-create" ? 201 : 200)
          .header("ETag", versionEtag(receipt.version))
          .send(receipt);
      } catch (error) {
        return handleVaultError(error, reply, request);
      }
    },
  );
}

function isPutBody(value: unknown): value is PutBody {
  return hasExactKeys(value, ["payload"]);
}

function isMainWatchlistPayload(value: unknown): value is MainWatchlistPayload {
  if (!hasExactKeys(value, WATCHLIST_PAYLOAD_KEYS)) return false;
  if (
    value.schemaVersion !== 1 ||
    value.name !== MAIN_WATCHLIST_NAME ||
    typeof value.snapshotSha256 !== "string" ||
    !SNAPSHOT_DIGEST_PATTERN.test(value.snapshotSha256) ||
    !Array.isArray(value.memberships) ||
    value.memberships.length > MAXIMUM_MEMBERSHIPS ||
    !value.memberships.every(isWatchlistMembership)
  ) {
    return false;
  }
  return (
    new Set(value.memberships.map((membership) => membership.listingId))
      .size === value.memberships.length
  );
}

function isWatchlistMembership(value: unknown): value is WatchlistMembership {
  if (!hasExactKeys(value, MEMBERSHIP_KEYS)) return false;
  return (
    value.country === "US" &&
    typeof value.exchangeMic === "string" &&
    MIC_PATTERN.test(value.exchangeMic) &&
    (value.instrumentType === "adr" ||
      value.instrumentType === "common_stock") &&
    isIdentifier(value.issuerId) &&
    isDisplayText(value.issuerName) &&
    isIdentifier(value.listingId) &&
    typeof value.note === "string" &&
    normalizeWatchlistNote(value.note) === value.note &&
    isIdentifier(value.securityId) &&
    isDisplayText(value.securityName) &&
    isIdentifier(value.shareClassId) &&
    isDisplayText(value.shareClassName) &&
    typeof value.symbol === "string" &&
    SYMBOL_PATTERN.test(value.symbol)
  );
}

function membershipsMatchCatalog(
  catalog: PersonalSecurityMasterCatalog,
  memberships: readonly WatchlistMembership[],
): boolean {
  return memberships.every((membership) => {
    const admitted = searchPersonalSecurityMaster(catalog, {
      limit: PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap,
      query: membership.symbol,
    }).results.find((result) => result.listingId === membership.listingId);
    return (
      admitted !== undefined && membershipMatchesResult(membership, admitted)
    );
  });
}

function membershipMatchesResult(
  membership: WatchlistMembership,
  result: PersonalSecurityMasterSearchResult,
): boolean {
  return (
    membership.country === result.country &&
    membership.exchangeMic === result.exchangeMic &&
    membership.instrumentType === result.instrumentType &&
    membership.issuerId === result.issuerId &&
    membership.issuerName === result.issuerName &&
    membership.listingId === result.listingId &&
    membership.securityId === result.securityId &&
    membership.securityName === result.securityName &&
    membership.shareClassId === result.shareClassId &&
    membership.shareClassName === result.shareClassName &&
    membership.symbol === result.symbol
  );
}

function normalizeWatchlistNote(value: string): string | null {
  const normalized = value.trim().normalize("NFC");
  return [...normalized].length <= 2_000 &&
    !CONTROL_FORMAT_OR_SURROGATE_CHARACTER.test(normalized)
    ? normalized
    : null;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

function isDisplayText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    [...value].length <= 512 &&
    !CONTROL_FORMAT_OR_SURROGATE_CHARACTER.test(value)
  );
}

function hasExactKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    expected.every((key, index) => actual[index] === key)
  );
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

function handleVaultError(
  error: unknown,
  reply: FastifyReply,
  request: FastifyRequest,
) {
  if (!(error instanceof LocalResearchVaultError)) throw error;
  if (error.code === "VAULT_INVALID_INPUT") {
    return sendWatchlistProblem(reply, request, 400);
  }
  if (error.code === "VAULT_NOT_FOUND" || error.code === "VAULT_DELETED") {
    return sendWatchlistProblem(reply, request, 404);
  }
  if (
    error.code === "VAULT_CONFLICT" ||
    error.code === "VAULT_IDEMPOTENCY_CONFLICT"
  ) {
    return sendWatchlistProblem(reply, request, 409);
  }
  throw error;
}

function sendWatchlistProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: 400 | 404 | 409,
) {
  const problem: ProblemDetailsDto = {
    type: `https://research-cockpit.local/problems/${String(status)}`,
    title:
      status === 400
        ? "Watchlist request invalid"
        : status === 404
          ? "Watchlist unavailable"
          : "Watchlist conflict",
    status,
    detail: "The personal workspace watchlist request was not accepted.",
    instance: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
    traceId: request.id,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
