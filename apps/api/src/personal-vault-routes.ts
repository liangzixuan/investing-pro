import type { ProblemDetailsDto } from "@research-cockpit/contracts";
import {
  LOCAL_RESEARCH_RECORD_KINDS,
  LOCAL_RESEARCH_VAULT_PROFILE,
  LocalResearchVaultError,
  type JsonValue,
  type LocalResearchRecordKind,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { DemoApiListenOptions } from "./listen-options";
import {
  isPersonalOwnerSessionAuthority,
  type PersonalOwnerSessionAuthority,
} from "./personal-owner-session";
import {
  authorizePersonalRouteRequest,
  authorizePersonalVaultMutationRouteRequest,
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
  sendPersonalOwnerSessionProblem,
} from "./personal-owner-session-routes";

export const PERSONAL_VAULT_STATUS_PATH = "/v1/personal-filing/vault" as const;
export const PERSONAL_VAULT_RECORDS_PREFIX =
  "/v1/personal-filing/vault/records" as const;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const KIND_SET = new Set<string>(LOCAL_RESEARCH_RECORD_KINDS);

interface RecordParams {
  kind: string;
  id: string;
}

interface KindParams {
  kind: string;
}

interface PutBody {
  payload: JsonValue;
}

export function registerPersonalVaultRoutes(
  app: FastifyInstance,
  vault: LocalResearchVault,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  if (vault.profile !== LOCAL_RESEARCH_VAULT_PROFILE) {
    throw new TypeError("Personal research vault is unavailable.");
  }
  if (!isPersonalOwnerSessionAuthority(ownerSession)) {
    throw new TypeError("Personal owner session is unavailable.");
  }

  app.get(
    PERSONAL_VAULT_STATUS_PATH,
    {
      exposeHeadRoute: false,
      onRequest: ownerReadGuard(ownerSession, listenOptions),
    },
    (_request, reply) => {
      const inventory = vault.inventory();
      return reply.send({
        profile: inventory.profile,
        schemaVersion: inventory.schemaVersion,
        durableSource: "sqlite",
        browserDurableSource: false,
      });
    },
  );

  app.get<{ Params: KindParams }>(
    `${PERSONAL_VAULT_RECORDS_PREFIX}/:kind`,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            request.url,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
        const kind = validatedKind(request.params.kind);
        if (
          kind === undefined ||
          request.url !== `${PERSONAL_VAULT_RECORDS_PREFIX}/${kind}`
        ) {
          return sendVaultProblem(reply, request, 400);
        }
      },
    },
    (request, reply) => {
      const kind = requireKind(request.params.kind);
      return reply.send({ records: vault.listRecords(kind) });
    },
  );

  app.get<{ Params: RecordParams }>(
    `${PERSONAL_VAULT_RECORDS_PREFIX}/:kind/:id`,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            request.url,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
        const path = validatedRecordPath(request.params);
        if (path === undefined || request.url !== path) {
          return sendVaultProblem(reply, request, 400);
        }
      },
    },
    (request, reply) => {
      try {
        const record = vault.getRecord(
          requireKind(request.params.kind),
          request.params.id,
        );
        return reply.header("ETag", versionEtag(record.version)).send(record);
      } catch (error) {
        return handleVaultError(error, reply, request);
      }
    },
  );

  app.post<{ Body: PutBody; Params: RecordParams }>(
    `${PERSONAL_VAULT_RECORDS_PREFIX}/:kind/:id`,
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
            request.url,
            intent,
            "json",
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
        const path = validatedRecordPath(request.params);
        const precondition = mutationPrecondition(request, intent);
        const idempotencyKey = singleHeader(
          request,
          PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
        );
        if (
          path === undefined ||
          request.url !== path ||
          precondition === undefined ||
          idempotencyKey === undefined ||
          !IDEMPOTENCY_PATTERN.test(idempotencyKey)
        ) {
          return sendVaultProblem(reply, request, 400);
        }
      },
    },
    (request, reply) => {
      if (!isPutBody(request.body))
        return sendVaultProblem(reply, request, 400);
      const intent = requireVaultIntent(request);
      const expectedVersion = mutationPrecondition(request, intent);
      const idempotencyKey = singleHeader(
        request,
        PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
      );
      if (expectedVersion === undefined || idempotencyKey === undefined) {
        return sendVaultProblem(reply, request, 400);
      }
      try {
        const receipt = vault.putRecord({
          kind: requireKind(request.params.kind),
          id: request.params.id,
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

  app.post<{ Params: RecordParams }>(
    `${PERSONAL_VAULT_RECORDS_PREFIX}/:kind/:id/delete`,
    {
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalVaultMutationRouteRequest(
            request,
            ownerSession,
            listenOptions,
            request.url,
            "personal-vault-delete",
            "none",
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
        const basePath = validatedRecordPath(request.params);
        const expectedVersion = strongIfMatch(request);
        const idempotencyKey = singleHeader(
          request,
          PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
        );
        if (
          basePath === undefined ||
          request.url !== `${basePath}/delete` ||
          expectedVersion === undefined ||
          hasHeader(request, "if-none-match") ||
          idempotencyKey === undefined ||
          !IDEMPOTENCY_PATTERN.test(idempotencyKey)
        ) {
          return sendVaultProblem(reply, request, 400);
        }
      },
    },
    (request, reply) => {
      const expectedVersion = strongIfMatch(request);
      const idempotencyKey = singleHeader(
        request,
        PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
      );
      if (expectedVersion === undefined || idempotencyKey === undefined) {
        return sendVaultProblem(reply, request, 400);
      }
      try {
        const receipt = vault.deleteRecord({
          kind: requireKind(request.params.kind),
          id: request.params.id,
          expectedVersion,
          idempotencyKey,
        });
        return reply.header("ETag", versionEtag(receipt.version)).send(receipt);
      } catch (error) {
        return handleVaultError(error, reply, request);
      }
    },
  );
}

function ownerReadGuard(
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (
      !authorizePersonalRouteRequest(
        request,
        ownerSession,
        listenOptions,
        PERSONAL_VAULT_STATUS_PATH,
      )
    ) {
      return sendPersonalOwnerSessionProblem(reply, request);
    }
  };
}

function validatedRecordPath(params: RecordParams): string | undefined {
  const kind = validatedKind(params.kind);
  return kind === undefined || !IDENTIFIER_PATTERN.test(params.id)
    ? undefined
    : `${PERSONAL_VAULT_RECORDS_PREFIX}/${kind}/${params.id}`;
}

function validatedKind(value: string): LocalResearchRecordKind | undefined {
  return KIND_SET.has(value) ? (value as LocalResearchRecordKind) : undefined;
}

function requireKind(value: string): LocalResearchRecordKind {
  const kind = validatedKind(value);
  if (kind === undefined) throw new TypeError("Invalid vault record kind.");
  return kind;
}

function isPutBody(value: unknown): value is PutBody {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === "payload";
}

function requireVaultIntent(
  request: FastifyRequest,
): "personal-vault-create" | "personal-vault-update" {
  const intent = singleHeader(request, PERSONAL_OWNER_INTENT_HEADER_NAME);
  if (
    intent !== "personal-vault-create" &&
    intent !== "personal-vault-update"
  ) {
    throw new TypeError("Invalid vault mutation intent.");
  }
  return intent;
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
    return sendVaultProblem(reply, request, 400);
  }
  if (error.code === "VAULT_NOT_FOUND" || error.code === "VAULT_DELETED") {
    return sendVaultProblem(reply, request, 404);
  }
  if (
    error.code === "VAULT_CONFLICT" ||
    error.code === "VAULT_IDEMPOTENCY_CONFLICT"
  ) {
    return sendVaultProblem(reply, request, 409);
  }
  throw error;
}

function sendVaultProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: 400 | 404 | 409,
) {
  const problem: ProblemDetailsDto = {
    type: `https://research-cockpit.local/problems/${String(status)}`,
    title:
      status === 400
        ? "Request invalid"
        : status === 404
          ? "Record unavailable"
          : "Mutation conflict",
    status,
    detail: "The personal vault request was not accepted.",
    instance: request.url.split("?", 1)[0] ?? PERSONAL_VAULT_STATUS_PATH,
    traceId: request.id,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
