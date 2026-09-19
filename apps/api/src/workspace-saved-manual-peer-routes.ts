import {
  isPersonalSavedManualPeerPayload,
  isPersonalSavedManualPeerPutRequest,
  isPersonalSavedManualPeerResolveRequest,
  PERSONAL_SAVED_MANUAL_PEER_IDENTITY_FIELDS,
  type PersonalSavedManualPeerBindingDto,
  type PersonalSavedManualPeerIdentityDto,
  type PersonalSavedManualPeerPayloadDto,
  type PersonalSavedManualPeerResolvedDto,
  type ProblemDetailsDto,
} from "@research-cockpit/contracts";
import {
  LocalResearchVaultError,
  type JsonValue,
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
  authorizePersonalRouteRequest,
  authorizePersonalVaultMutationRouteRequest,
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
  sendPersonalOwnerSessionProblem,
} from "./personal-owner-session-routes";
import {
  isMainWatchlistPayload,
  membershipMatchesResult,
  type MainWatchlistPayload,
} from "./workspace-watchlist-routes";

export const PERSONAL_SAVED_MANUAL_PEER_PATH =
  "/v1/personal-filing/workspace/manual-peer-group" as const;
export const PERSONAL_SAVED_MANUAL_PEER_RESOLVE_PATH =
  `${PERSONAL_SAVED_MANUAL_PEER_PATH}/resolve` as const;
export const PERSONAL_SAVED_MANUAL_PEER_RECORD_ID =
  "personal-manual-peer-group" as const;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;

class SavedManualPeerError extends Error {
  constructor(readonly status: 400 | 404 | 409) {
    super("Saved peer group is unavailable.");
  }
}

export function registerPersonalSavedManualPeerRoutes(
  app: FastifyInstance,
  catalog: PersonalSecurityMasterCatalog,
  vault: LocalResearchVault,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  app.get(
    PERSONAL_SAVED_MANUAL_PEER_PATH,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_SAVED_MANUAL_PEER_PATH,
          )
        )
          return sendPersonalOwnerSessionProblem(reply, request);
      },
    },
    (request, reply) => {
      try {
        const record = vault.getRecord(
          "settings",
          PERSONAL_SAVED_MANUAL_PEER_RECORD_ID,
        );
        reply.header("ETag", versionEtag(record.version));
        if (!isPersonalSavedManualPeerPayload(record.payload))
          throw new SavedManualPeerError(409);
        return reply.send(record);
      } catch (error) {
        return handleError(error, reply, request);
      }
    },
  );

  app.post<{ Body: unknown }>(
    PERSONAL_SAVED_MANUAL_PEER_PATH,
    {
      onRequest: async (request, reply) => {
        const intent = singleHeader(request, PERSONAL_OWNER_INTENT_HEADER_NAME);
        if (
          (intent !== "personal-vault-create" &&
            intent !== "personal-vault-update") ||
          !authorizePersonalVaultMutationRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_SAVED_MANUAL_PEER_PATH,
            intent,
            "json",
          )
        )
          return sendPersonalOwnerSessionProblem(reply, request);
        const key = singleHeader(
          request,
          PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
        );
        if (
          mutationPrecondition(request, intent) === undefined ||
          key === undefined ||
          !IDEMPOTENCY_PATTERN.test(key)
        )
          return sendProblem(reply, request, 400);
      },
      errorHandler: (_error, request, reply) => {
        void sendProblem(reply, request, 400);
      },
    },
    (request, reply) => {
      const intent = singleHeader(request, PERSONAL_OWNER_INTENT_HEADER_NAME);
      if (
        (intent !== "personal-vault-create" &&
          intent !== "personal-vault-update") ||
        !isPersonalSavedManualPeerPutRequest(request.body)
      )
        return sendProblem(reply, request, 400);
      const expectedVersion = mutationPrecondition(request, intent);
      const idempotencyKey = singleHeader(
        request,
        PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
      );
      if (
        expectedVersion === undefined ||
        idempotencyKey === undefined ||
        (request.body.operation === "clear" && expectedVersion === 0)
      )
        return sendProblem(reply, request, 400);
      try {
        const body = request.body;
        const current = readSavedRecord(vault);
        if (current === null && body.operation === "clear")
          throw new SavedManualPeerError(404);
        // Submit the caller's exact payload so the vault can recognize replay
        // before CAS; a later group must not change an earlier request hash.
        if (body.operation === "save") {
          const group = body.payload.group!;
          for (const identity of [group.primary, ...group.peers])
            resolveMember(vault, catalog, identity, body.context);
          // Existing local admission pattern; not a cross-record transaction.
          readBoundWatchlist(vault, catalog, body.context);
        }
        const receipt = vault.putRecord({
          expectedVersion,
          id: PERSONAL_SAVED_MANUAL_PEER_RECORD_ID,
          idempotencyKey,
          kind: "settings",
          payload: body.payload as unknown as JsonValue,
        });
        return reply
          .status(intent === "personal-vault-create" ? 201 : 200)
          .header("ETag", versionEtag(receipt.version))
          .send(receipt);
      } catch (error) {
        return handleError(error, reply, request);
      }
    },
  );

  app.post<{ Body: unknown }>(
    PERSONAL_SAVED_MANUAL_PEER_RESOLVE_PATH,
    {
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalJsonRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_SAVED_MANUAL_PEER_RESOLVE_PATH,
          )
        )
          return sendPersonalOwnerSessionProblem(reply, request);
      },
      errorHandler: (_error, request, reply) => {
        void sendProblem(reply, request, 400);
      },
    },
    (request, reply) => {
      if (!isPersonalSavedManualPeerResolveRequest(request.body))
        return sendProblem(reply, request, 400);
      try {
        const body = request.body;
        const record = readSavedRecord(vault);
        if (record === null) throw new SavedManualPeerError(404);
        if (record.version !== body.expectedVersion)
          throw new SavedManualPeerError(409);
        const group = record.payload.group;
        if (group === null) throw new SavedManualPeerError(404);
        if (!sameIdentity(group.primary, body.primary))
          throw new SavedManualPeerError(409);
        for (const identity of [group.primary, ...group.peers])
          resolveMember(vault, catalog, identity, body);
        readBoundWatchlist(vault, catalog, body);
        if (readSavedRecord(vault)?.version !== record.version)
          throw new SavedManualPeerError(409);
        const response: PersonalSavedManualPeerResolvedDto = {
          schemaVersion: "1.0.0",
          catalogSnapshotSha256: catalog.snapshotSha256,
          watchlistVersion: body.watchlistVersion,
          savedPeerGroupVersion: record.version,
          group,
        };
        return reply.header("ETag", versionEtag(record.version)).send(response);
      } catch (error) {
        return handleError(error, reply, request);
      }
    },
  );
}

function readSavedRecord(
  vault: LocalResearchVault,
): { version: number; payload: PersonalSavedManualPeerPayloadDto } | null {
  try {
    const record = vault.getRecord(
      "settings",
      PERSONAL_SAVED_MANUAL_PEER_RECORD_ID,
    );
    if (!isPersonalSavedManualPeerPayload(record.payload))
      throw new SavedManualPeerError(409);
    return { version: record.version, payload: record.payload };
  } catch (error) {
    if (
      error instanceof LocalResearchVaultError &&
      error.code === "VAULT_NOT_FOUND"
    )
      return null;
    throw error;
  }
}

function readBoundWatchlist(
  vault: LocalResearchVault,
  catalog: PersonalSecurityMasterCatalog,
  binding: PersonalSavedManualPeerBindingDto,
): MainWatchlistPayload {
  if (binding.catalogSnapshotSha256 !== catalog.snapshotSha256)
    throw new SavedManualPeerError(409);
  const record = vault.getRecord("watchlist", "main");
  if (
    record.version !== binding.watchlistVersion ||
    !isMainWatchlistPayload(record.payload) ||
    record.payload.snapshotSha256 !== catalog.snapshotSha256
  )
    throw new SavedManualPeerError(409);
  return record.payload;
}

function resolveMember(
  vault: LocalResearchVault,
  catalog: PersonalSecurityMasterCatalog,
  identity: PersonalSavedManualPeerIdentityDto,
  binding: PersonalSavedManualPeerBindingDto,
): void {
  const watchlist = readBoundWatchlist(vault, catalog, binding);
  const member = watchlist.memberships.find(
    (membership) => membership.listingId === identity.listingId,
  );
  if (member === undefined) throw new SavedManualPeerError(404);
  if (!sameIdentity(member, identity)) throw new SavedManualPeerError(409);
  const admitted = searchPersonalSecurityMaster(catalog, {
    limit: PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap,
    query: member.symbol,
  }).results.find((result) => result.listingId === member.listingId);
  if (admitted === undefined || !membershipMatchesResult(member, admitted))
    throw new SavedManualPeerError(409);
}

function sameIdentity(
  a: PersonalSavedManualPeerIdentityDto,
  b: PersonalSavedManualPeerIdentityDto,
): boolean {
  return PERSONAL_SAVED_MANUAL_PEER_IDENTITY_FIELDS.every(
    (field) => a[field] === b[field],
  );
}
function mutationPrecondition(
  request: FastifyRequest,
  intent: "personal-vault-create" | "personal-vault-update",
): number | undefined {
  if (intent === "personal-vault-create")
    return singleHeader(request, "if-none-match") === "*" &&
      !hasHeader(request, "if-match")
      ? 0
      : undefined;
  if (hasHeader(request, "if-none-match")) return undefined;
  const match = singleHeader(request, "if-match")?.match(
    /^"v([1-9][0-9]{0,14})"$/u,
  );
  if (match?.[1] === undefined) return undefined;
  const version = Number(match[1]);
  return Number.isSafeInteger(version) ? version : undefined;
}
function singleHeader(
  request: FastifyRequest,
  name: string,
): string | undefined {
  const values: string[] = [];
  for (let index = 0; index < request.raw.rawHeaders.length; index += 2)
    if (request.raw.rawHeaders[index]?.toLowerCase() === name)
      values.push(request.raw.rawHeaders[index + 1] ?? "");
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

function handleError(
  error: unknown,
  reply: FastifyReply,
  request: FastifyRequest,
) {
  if (error instanceof SavedManualPeerError)
    return sendProblem(reply, request, error.status);
  if (error instanceof LocalResearchVaultError) {
    if (error.code === "VAULT_INVALID_INPUT")
      return sendProblem(reply, request, 400);
    if (error.code === "VAULT_NOT_FOUND" || error.code === "VAULT_DELETED")
      return sendProblem(reply, request, 404);
    if (
      error.code === "VAULT_CONFLICT" ||
      error.code === "VAULT_IDEMPOTENCY_CONFLICT"
    )
      return sendProblem(reply, request, 409);
  }
  return sendProblem(reply, request, 500);
}
function sendProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: 400 | 404 | 409 | 500,
) {
  const problem: ProblemDetailsDto = {
    detail: "The saved manual peer group request was not accepted.",
    instance: request.url.split("?", 1)[0] ?? PERSONAL_SAVED_MANUAL_PEER_PATH,
    status,
    title:
      status === 400
        ? "Saved peer group request invalid"
        : status === 409
          ? "Saved peer group conflict"
          : "Saved peer group unavailable",
    traceId: request.id,
    type: `https://research-cockpit.local/problems/${String(status)}`,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
