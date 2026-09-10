import {
  isPersonalPortfolioStoredPayload,
  type PersonalPortfolioIdentity,
  type PersonalPortfolioPayload,
  type PersonalPortfolioStoredPayload,
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

export const PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH =
  "/v1/personal-filing/workspace/portfolio/main" as const;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;

export function registerPersonalWorkspacePortfolioRoutes(
  app: FastifyInstance,
  catalog: PersonalSecurityMasterCatalog,
  vault: LocalResearchVault,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  app.get(
    PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
      },
    },
    (request, reply) => {
      try {
        const record = vault.getRecord("portfolio", "main");
        // An older snapshot remains readable so the owner can reconcile it.
        // Manual snapshots must still agree with current admitted identities.
        // Ledgers also retain historical identities admitted by earlier writes.
        if (
          !isPersonalPortfolioStoredPayload(record.payload) ||
          (record.payload.schemaVersion === 1 &&
            record.payload.snapshotSha256 === catalog.snapshotSha256 &&
            !holdingsMatchCatalog(catalog, record.payload))
        ) {
          return sendPortfolioProblem(
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

  app.post<{ Body: unknown }>(
    PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH,
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
            PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH,
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
          return sendPortfolioProblem(reply, request, 400);
        }
      },
      errorHandler: (_error, request, reply) => {
        void sendPortfolioProblem(reply, request, 400);
      },
    },
    (request, reply) => {
      const intent = singleHeader(request, PERSONAL_OWNER_INTENT_HEADER_NAME);
      if (
        (intent !== "personal-vault-create" &&
          intent !== "personal-vault-update") ||
        !isPutBody(request.body)
      ) {
        return sendPortfolioProblem(reply, request, 400);
      }
      const payload = request.body.payload;
      if (payload.snapshotSha256 !== catalog.snapshotSha256) {
        return sendPortfolioProblem(reply, request, 409);
      }
      if (
        payload.schemaVersion === 1 &&
        !holdingsMatchCatalog(catalog, payload)
      ) {
        return sendPortfolioProblem(reply, request, 400);
      }
      const expectedVersion = mutationPrecondition(request, intent);
      const idempotencyKey = singleHeader(
        request,
        PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
      );
      if (expectedVersion === undefined || idempotencyKey === undefined) {
        return sendPortfolioProblem(reply, request, 400);
      }
      try {
        const previous = readPreviousPortfolio(vault);
        let priorPayload: PersonalPortfolioStoredPayload | undefined;
        if (previous !== null) {
          if (!isPersonalPortfolioStoredPayload(previous.payload)) {
            return sendPortfolioProblem(reply, request, 409);
          }
          priorPayload = previous.payload;
        }
        // Do not discard ledger capabilities through a schema downgrade. Old
        // requests may still reach the vault's authenticated idempotent replay.
        if (
          previous?.version === expectedVersion &&
          priorPayload !== undefined &&
          priorPayload.schemaVersion > payload.schemaVersion
        ) {
          return sendPortfolioProblem(reply, request, 409);
        }
        if (
          payload.schemaVersion !== 1 &&
          expectedVersion === (previous?.version ?? 0) &&
          !ledgerIdentitiesAdmitted(catalog, payload.identities, priorPayload)
        ) {
          return sendPortfolioProblem(reply, request, 400);
        }
        const receipt = vault.putRecord({
          kind: "portfolio",
          id: "main",
          expectedVersion,
          idempotencyKey,
          payload,
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

function isPutBody(
  value: unknown,
): value is { readonly payload: PersonalPortfolioStoredPayload } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    "payload" in value &&
    isPersonalPortfolioStoredPayload(
      value.payload,
      new Date().toISOString().slice(0, 10),
    )
  );
}

function readPreviousPortfolio(vault: LocalResearchVault) {
  try {
    return vault.getRecord("portfolio", "main");
  } catch (error) {
    if (
      error instanceof LocalResearchVaultError &&
      (error.code === "VAULT_NOT_FOUND" || error.code === "VAULT_DELETED")
    )
      return null;
    throw error;
  }
}

function ledgerIdentitiesAdmitted(
  catalog: PersonalSecurityMasterCatalog,
  identities: readonly PersonalPortfolioIdentity[],
  previous: PersonalPortfolioStoredPayload | undefined,
): boolean {
  const priorIdentities =
    previous === undefined
      ? []
      : previous.schemaVersion === 1
        ? previous.holdings.map((holding) => holding.identity)
        : previous.identities;
  return identities.every((identity) => {
    const retained = priorIdentities.find(
      (prior) => prior.listingId === identity.listingId,
    );
    if (retained !== undefined && identityMatchesResult(identity, retained))
      return true;
    const admitted = searchPersonalSecurityMaster(catalog, {
      limit: PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap,
      query: identity.symbol,
    }).results.find((result) => result.listingId === identity.listingId);
    return admitted !== undefined && identityMatchesResult(identity, admitted);
  });
}

function holdingsMatchCatalog(
  catalog: PersonalSecurityMasterCatalog,
  payload: PersonalPortfolioPayload,
): boolean {
  return payload.holdings.every(({ identity }) => {
    const admitted = searchPersonalSecurityMaster(catalog, {
      limit: PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap,
      query: identity.symbol,
    }).results.find((result) => result.listingId === identity.listingId);
    return admitted !== undefined && identityMatchesResult(identity, admitted);
  });
}

function identityMatchesResult(
  identity: PersonalPortfolioIdentity,
  result: PersonalSecurityMasterSearchResult | PersonalPortfolioIdentity,
): boolean {
  return (
    identity.country === result.country &&
    identity.exchangeMic === result.exchangeMic &&
    identity.instrumentType === result.instrumentType &&
    identity.issuerId === result.issuerId &&
    identity.issuerName === result.issuerName &&
    identity.listingId === result.listingId &&
    identity.securityId === result.securityId &&
    identity.securityName === result.securityName &&
    identity.shareClassId === result.shareClassId &&
    identity.shareClassName === result.shareClassName &&
    identity.symbol === result.symbol
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
  for (let index = 0; index < request.raw.rawHeaders.length; index += 2) {
    if (request.raw.rawHeaders[index]?.toLowerCase() === name)
      values.push(request.raw.rawHeaders[index + 1] ?? "");
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
  if (error.code === "VAULT_INVALID_INPUT")
    return sendPortfolioProblem(reply, request, 400);
  if (error.code === "VAULT_NOT_FOUND" || error.code === "VAULT_DELETED")
    return sendPortfolioProblem(reply, request, 404);
  if (
    error.code === "VAULT_CONFLICT" ||
    error.code === "VAULT_IDEMPOTENCY_CONFLICT"
  )
    return sendPortfolioProblem(reply, request, 409);
  throw error;
}

function sendPortfolioProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: 400 | 404 | 409,
) {
  const problem: ProblemDetailsDto = {
    type: `https://research-cockpit.local/problems/${String(status)}`,
    title:
      status === 400
        ? "Portfolio request invalid"
        : status === 404
          ? "Portfolio unavailable"
          : "Portfolio conflict",
    status,
    detail: "The personal workspace portfolio request was not accepted.",
    instance: PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH,
    traceId: request.id,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
