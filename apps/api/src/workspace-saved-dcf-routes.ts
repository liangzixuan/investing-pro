import {
  isPersonalSavedDcfPayload,
  isPersonalSavedDcfPutRequest,
  isPersonalSavedDcfResolveRequest,
  isPersonalSavedDcfSupportedEntry,
  PERSONAL_SAVED_DCF_IDENTITY_FIELDS,
  type PersonalSavedDcfBindingDto,
  type PersonalSavedDcfEntryDto,
  type PersonalSavedDcfIdentityDto,
  type PersonalSavedDcfPayloadDto,
  type PersonalSavedDcfPutRequestDto,
  type PersonalSavedDcfResolvedDto,
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

export const PERSONAL_SAVED_DCF_PATH =
  "/v1/personal-filing/workspace/dcf-assumptions" as const;
export const PERSONAL_SAVED_DCF_RESOLVE_PATH =
  `${PERSONAL_SAVED_DCF_PATH}/resolve` as const;
export const PERSONAL_SAVED_DCF_RECORD_ID = "personal-dcf-assumptions" as const;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;

class SavedDcfError extends Error {
  constructor(readonly status: 400 | 404 | 409) {
    super("Saved assumptions are unavailable.");
  }
}

export function registerPersonalSavedDcfRoutes(
  app: FastifyInstance,
  catalog: PersonalSecurityMasterCatalog,
  vault: LocalResearchVault,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  app.get(
    PERSONAL_SAVED_DCF_PATH,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_SAVED_DCF_PATH,
          )
        )
          return sendPersonalOwnerSessionProblem(reply, request);
      },
    },
    (request, reply) => {
      try {
        const record = vault.getRecord(
          "settings",
          PERSONAL_SAVED_DCF_RECORD_ID,
        );
        reply.header("ETag", versionEtag(record.version));
        if (!isPersonalSavedDcfPayload(record.payload))
          throw new SavedDcfError(409);
        return reply.send(record);
      } catch (error) {
        return handleError(error, reply, request);
      }
    },
  );

  app.post<{ Body: unknown }>(
    PERSONAL_SAVED_DCF_PATH,
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
            PERSONAL_SAVED_DCF_PATH,
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
        !isPersonalSavedDcfPutRequest(request.body)
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
          throw new SavedDcfError(404);
        // The vault checks an exact replay before its CAS. Do not rebuild a
        // submitted payload from a newer collection: that changes the replay hash.
        if ((current?.version ?? 0) === expectedVersion) {
          assertTargetedChange(
            current?.payload ?? { schemaVersion: 1, entries: [] },
            body,
          );
        }
        if (body.operation === "save") {
          const target = body.payload.entries.find(
            (entry) => entry.identity.listingId === body.listingId,
          )!;
          resolveMember(vault, catalog, target.identity, body.context);
          // Existing local admission pattern; this is not a cross-record transaction.
          readBoundWatchlist(vault, catalog, body.context);
        }
        const receipt = vault.putRecord({
          expectedVersion,
          id: PERSONAL_SAVED_DCF_RECORD_ID,
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
    PERSONAL_SAVED_DCF_RESOLVE_PATH,
    {
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalJsonRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_SAVED_DCF_RESOLVE_PATH,
          )
        )
          return sendPersonalOwnerSessionProblem(reply, request);
      },
      errorHandler: (_error, request, reply) => {
        void sendProblem(reply, request, 400);
      },
    },
    (request, reply) => {
      if (!isPersonalSavedDcfResolveRequest(request.body))
        return sendProblem(reply, request, 400);
      try {
        const body = request.body;
        const record = readSavedRecord(vault);
        if (record === null) throw new SavedDcfError(404);
        if (record.version !== body.expectedVersion)
          throw new SavedDcfError(409);
        const entry = record.payload.entries.find(
          (candidate) =>
            candidate.identity.listingId === body.identity.listingId,
        );
        if (entry === undefined) throw new SavedDcfError(404);
        if (
          !sameIdentity(entry.identity, body.identity) ||
          !isPersonalSavedDcfSupportedEntry(entry)
        )
          throw new SavedDcfError(409);
        resolveMember(vault, catalog, entry.identity, body);
        readBoundWatchlist(vault, catalog, body);
        if (readSavedRecord(vault)?.version !== record.version)
          throw new SavedDcfError(409);
        const response: PersonalSavedDcfResolvedDto = {
          schemaVersion: "1.0.0",
          catalogSnapshotSha256: catalog.snapshotSha256,
          watchlistVersion: body.watchlistVersion,
          savedAssumptionsVersion: record.version,
          entry,
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
): { version: number; payload: PersonalSavedDcfPayloadDto } | null {
  try {
    const record = vault.getRecord("settings", PERSONAL_SAVED_DCF_RECORD_ID);
    if (!isPersonalSavedDcfPayload(record.payload))
      throw new SavedDcfError(409);
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

function assertTargetedChange(
  before: PersonalSavedDcfPayloadDto,
  body: PersonalSavedDcfPutRequestDto,
): void {
  const index = before.entries.findIndex(
    (entry) => entry.identity.listingId === body.listingId,
  );
  let expected: readonly PersonalSavedDcfEntryDto[];
  if (body.operation === "clear") {
    if (index < 0) throw new SavedDcfError(404);
    expected = before.entries.filter(
      (entry) => entry.identity.listingId !== body.listingId,
    );
  } else {
    const target = body.payload.entries.find(
      (entry) => entry.identity.listingId === body.listingId,
    )!;
    if (
      index >= 0 &&
      (!sameIdentity(before.entries[index]!.identity, target.identity) ||
        !isPersonalSavedDcfSupportedEntry(before.entries[index]))
    )
      throw new SavedDcfError(409);
    expected =
      index < 0
        ? [...before.entries, target]
        : before.entries.map((entry, position) =>
            position === index ? target : entry,
          );
  }
  if (
    expected.length !== body.payload.entries.length ||
    expected.some(
      (entry, index) => !sameEntry(entry, body.payload.entries[index]!),
    )
  )
    throw new SavedDcfError(400);
}

function readBoundWatchlist(
  vault: LocalResearchVault,
  catalog: PersonalSecurityMasterCatalog,
  binding: PersonalSavedDcfBindingDto,
): MainWatchlistPayload {
  if (binding.catalogSnapshotSha256 !== catalog.snapshotSha256)
    throw new SavedDcfError(409);
  const record = vault.getRecord("watchlist", "main");
  if (
    record.version !== binding.watchlistVersion ||
    !isMainWatchlistPayload(record.payload) ||
    record.payload.snapshotSha256 !== catalog.snapshotSha256
  )
    throw new SavedDcfError(409);
  return record.payload;
}

function resolveMember(
  vault: LocalResearchVault,
  catalog: PersonalSecurityMasterCatalog,
  identity: PersonalSavedDcfIdentityDto,
  binding: PersonalSavedDcfBindingDto,
): void {
  const watchlist = readBoundWatchlist(vault, catalog, binding);
  const member = watchlist.memberships.find(
    (membership) => membership.listingId === identity.listingId,
  );
  if (member === undefined) throw new SavedDcfError(404);
  if (!sameIdentity(member, identity)) throw new SavedDcfError(409);
  const admitted = searchPersonalSecurityMaster(catalog, {
    limit: PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap,
    query: member.symbol,
  }).results.find((result) => result.listingId === member.listingId);
  if (admitted === undefined || !membershipMatchesResult(member, admitted))
    throw new SavedDcfError(409);
}

function sameIdentity(
  a: PersonalSavedDcfIdentityDto,
  b: PersonalSavedDcfIdentityDto,
): boolean {
  return PERSONAL_SAVED_DCF_IDENTITY_FIELDS.every(
    (field) => a[field] === b[field],
  );
}
function sameEntry(
  a: PersonalSavedDcfEntryDto,
  b: PersonalSavedDcfEntryDto,
): boolean {
  return (
    sameIdentity(a.identity, b.identity) &&
    a.modelVersion === b.modelVersion &&
    a.createdAgainstCatalogSnapshotSha256 ===
      b.createdAgainstCatalogSnapshotSha256 &&
    a.assumptions.forecastYears === b.assumptions.forecastYears &&
    a.assumptions.taxShieldRatePercent === b.assumptions.taxShieldRatePercent &&
    a.assumptions.waccPercent === b.assumptions.waccPercent &&
    a.assumptions.terminalGrowthPercent ===
      b.assumptions.terminalGrowthPercent &&
    (["conservative", "base", "expansion"] as const).every(
      (scenario) =>
        a.assumptions.scenarios[scenario].annualFcfProxyGrowthPercent ===
        b.assumptions.scenarios[scenario].annualFcfProxyGrowthPercent,
    )
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
  if (error instanceof SavedDcfError)
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
    detail: "The saved DCF assumptions request was not accepted.",
    instance: request.url.split("?", 1)[0] ?? PERSONAL_SAVED_DCF_PATH,
    status,
    title:
      status === 400
        ? "Saved assumptions request invalid"
        : status === 409
          ? "Saved assumptions conflict"
          : "Saved assumptions unavailable",
    traceId: request.id,
    type: `https://research-cockpit.local/problems/${String(status)}`,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
