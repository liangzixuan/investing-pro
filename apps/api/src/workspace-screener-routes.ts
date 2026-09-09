import type {
  PersonalScreenerSavedViewsPayloadDto,
  PersonalSecurityMasterScreenClauseDto,
  PersonalSecurityMasterScreenQueryDto,
  PersonalSecurityMasterScreenRequestDto,
  PersonalSecurityMasterScreenResponseDto,
  PersonalSecurityMasterScreenSortDto,
  PersonalSecurityMasterSnapshotReceiptDto,
  ProblemDetailsDto,
} from "@research-cockpit/contracts";
import {
  LocalResearchVaultError,
  type JsonValue,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
import {
  PERSONAL_SECURITY_MASTER_LIMITS,
  PERSONAL_SECURITY_MASTER_SCREENER_LIMITS,
  PERSONAL_SECURITY_MASTER_SCREENER_SCHEMA_VERSION,
  PersonalSecurityMasterError,
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

export const PERSONAL_SECURITY_MASTER_SCREEN_PATH =
  "/v1/personal-filing/security-master/screen" as const;
export const PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH =
  "/v1/personal-filing/workspace/screener/saved-views" as const;

export const PERSONAL_SCREENER_SAVED_VIEWS_RECORD_ID =
  "stock-screener-saved-views" as const;

const SAVED_VIEWS_KIND = "settings" as const;
const MAXIMUM_SAVED_VIEWS = 20;
const MAXIMUM_SAVED_VIEW_NAME_CODE_POINTS = 80;
const SAVED_VIEW_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const SNAPSHOT_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MIC_PATTERN = /^[A-Z0-9]{4}$/u;
const CIK_PATTERN = /^[0-9]{10}$/u;
const CONTROL_FORMAT_OR_SURROGATE_CHARACTER = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const COMBINING_MARKS = /\p{M}+/gu;
const NON_LETTER_OR_NUMBER = /[^\p{L}\p{N}]+/gu;
const SPACES = / +/gu;
const SCREEN_REQUEST_KEYS = [
  "page",
  "query",
  "schemaVersion",
  "snapshotSha256",
  "sort",
] as const;
const QUERY_KEYS = ["clauses", "operator"] as const;
const SORT_KEYS = ["direction", "field"] as const;
const PAGE_KEYS = ["limit", "offset"] as const;
const SAVED_VIEWS_PAYLOAD_KEYS = ["schemaVersion", "views"] as const;
const SAVED_VIEW_KEYS = [
  "columns",
  "createdAgainstSnapshotSha256",
  "id",
  "name",
  "query",
  "sort",
] as const;
const SAVED_COLUMNS = new Set([
  "cik",
  "exchange_mic",
  "instrument_type",
  "issuer_name",
  "symbol",
]);
const SORT_FIELDS = new Set([
  "cik",
  "exchange_mic",
  "instrument_type",
  "issuer_name",
  "symbol",
]);

interface PutBody {
  readonly payload: JsonValue;
}

export function registerPersonalWorkspaceScreenerRoutes(
  app: FastifyInstance,
  catalog: PersonalSecurityMasterCatalog,
  vault: LocalResearchVault,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  app.post<{ Body: unknown }>(
    PERSONAL_SECURITY_MASTER_SCREEN_PATH,
    {
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalJsonRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_SECURITY_MASTER_SCREEN_PATH,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
      },
    },
    (request, reply) => {
      if (!isScreenRequest(request.body)) {
        return sendScreenerProblem(reply, request, 400);
      }
      if (request.body.snapshotSha256 !== catalog.snapshotSha256) {
        return sendScreenerProblem(reply, request, 409);
      }
      try {
        const result = screenPersonalSecurityMaster(catalog, request.body);
        const response: PersonalSecurityMasterScreenResponseDto = {
          hasMore: result.hasMore,
          limitApplied: result.limitApplied,
          offset: result.offset,
          rows: result.rows,
          schemaVersion: result.schemaVersion,
          snapshot: snapshotReceipt(catalog),
          snapshotSha256: result.snapshotSha256,
          totalMatches: result.totalMatches,
          totalUniverse: result.totalUniverse,
        };
        return reply.type("application/json; charset=utf-8").send(response);
      } catch (error) {
        if (error instanceof PersonalSecurityMasterError) {
          return sendScreenerProblem(reply, request, 400);
        }
        throw error;
      }
    },
  );

  app.get(
    PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
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
          PERSONAL_SCREENER_SAVED_VIEWS_RECORD_ID,
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
    PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
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
            PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
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
          id: PERSONAL_SCREENER_SAVED_VIEWS_RECORD_ID,
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
): value is PersonalSecurityMasterScreenRequestDto {
  return (
    hasExactKeys(value, SCREEN_REQUEST_KEYS) &&
    value.schemaVersion === PERSONAL_SECURITY_MASTER_SCREENER_SCHEMA_VERSION &&
    isSnapshotDigest(value.snapshotSha256) &&
    isScreenQuery(value.query) &&
    isScreenSort(value.sort) &&
    hasExactKeys(value.page, PAGE_KEYS) &&
    Number.isSafeInteger(value.page.offset) &&
    (value.page.offset as number) >= 0 &&
    (value.page.offset as number) <=
      PERSONAL_SECURITY_MASTER_SCREENER_LIMITS.offset &&
    Number.isSafeInteger(value.page.limit) &&
    (value.page.limit as number) >= 1 &&
    (value.page.limit as number) <=
      PERSONAL_SECURITY_MASTER_SCREENER_LIMITS.pageLimit
  );
}

function isScreenQuery(
  value: unknown,
): value is PersonalSecurityMasterScreenQueryDto {
  if (
    !hasExactKeys(value, QUERY_KEYS) ||
    value.operator !== "and" ||
    !Array.isArray(value.clauses) ||
    value.clauses.length > PERSONAL_SECURITY_MASTER_SCREENER_LIMITS.clauses ||
    !value.clauses.every(isScreenClause)
  ) {
    return false;
  }
  return (
    new Set(value.clauses.map((clause) => clause.field)).size ===
    value.clauses.length
  );
}

function isScreenClause(
  value: unknown,
): value is PersonalSecurityMasterScreenClauseDto {
  if (!isPlainRecord(value) || typeof value.field !== "string") return false;
  if (value.field === "identity_text") {
    return (
      hasExactKeys(value, ["field", "operator", "value"]) &&
      value.operator === "matches" &&
      isNormalizedIdentityText(
        value.value,
        PERSONAL_SECURITY_MASTER_SCREENER_LIMITS.identityTextCodePoints,
      )
    );
  }
  if (value.field === "exchange_mic") {
    return (
      hasExactKeys(value, ["field", "operator", "values"]) &&
      value.operator === "in" &&
      isUniqueBoundedStringArray(value.values, MIC_PATTERN)
    );
  }
  if (value.field === "instrument_type") {
    return (
      hasExactKeys(value, ["field", "operator", "values"]) &&
      value.operator === "in" &&
      Array.isArray(value.values) &&
      value.values.length >= 1 &&
      value.values.length <=
        PERSONAL_SECURITY_MASTER_SCREENER_LIMITS.inValues &&
      value.values.every(
        (entry) => entry === "adr" || entry === "common_stock",
      ) &&
      new Set(value.values).size === value.values.length
    );
  }
  return (
    value.field === "cik" &&
    hasExactKeys(value, ["field", "operator", "value"]) &&
    value.operator === "equals" &&
    typeof value.value === "string" &&
    CIK_PATTERN.test(value.value)
  );
}

function isScreenSort(
  value: unknown,
): value is PersonalSecurityMasterScreenSortDto {
  return (
    hasExactKeys(value, SORT_KEYS) &&
    typeof value.field === "string" &&
    SORT_FIELDS.has(value.field) &&
    (value.direction === "asc" || value.direction === "desc")
  );
}

function isPutBody(value: unknown): value is PutBody {
  return hasExactKeys(value, ["payload"]);
}

function isSavedViewsPayload(
  value: unknown,
): value is PersonalScreenerSavedViewsPayloadDto & JsonValue {
  if (
    !hasExactKeys(value, SAVED_VIEWS_PAYLOAD_KEYS) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.views) ||
    value.views.length > MAXIMUM_SAVED_VIEWS ||
    !value.views.every(isSavedView)
  ) {
    return false;
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const entry of value.views) {
    const view = entry as PersonalScreenerSavedViewsPayloadDto["views"][number];
    const normalizedName = view.name.toLocaleLowerCase("en-US");
    if (ids.has(view.id) || names.has(normalizedName)) return false;
    ids.add(view.id);
    names.add(normalizedName);
  }
  return true;
}

function isSavedView(value: unknown): boolean {
  return (
    hasExactKeys(value, SAVED_VIEW_KEYS) &&
    typeof value.id === "string" &&
    SAVED_VIEW_IDENTIFIER_PATTERN.test(value.id) &&
    isNormalizedDisplayText(value.name, MAXIMUM_SAVED_VIEW_NAME_CODE_POINTS) &&
    isSnapshotDigest(value.createdAgainstSnapshotSha256) &&
    isScreenQuery(value.query) &&
    isScreenSort(value.sort) &&
    Array.isArray(value.columns) &&
    value.columns.length >= 1 &&
    value.columns.length <= SAVED_COLUMNS.size &&
    value.columns.includes("symbol") &&
    value.columns.every(
      (column) => typeof column === "string" && SAVED_COLUMNS.has(column),
    ) &&
    new Set(value.columns).size === value.columns.length
  );
}

function isUniqueBoundedStringArray(
  value: unknown,
  pattern: RegExp,
): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= PERSONAL_SECURITY_MASTER_SCREENER_LIMITS.inValues &&
    value.every((entry) => typeof entry === "string" && pattern.test(entry)) &&
    new Set(value).size === value.length
  );
}

function isSnapshotDigest(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && SNAPSHOT_DIGEST_PATTERN.test(value);
}

function isNormalizedDisplayText(
  value: unknown,
  maximum: number,
): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim().normalize("NFC");
  return (
    value === normalized &&
    [...value].length >= 1 &&
    [...value].length <= maximum &&
    !CONTROL_FORMAT_OR_SURROGATE_CHARACTER.test(value)
  );
}

function isNormalizedIdentityText(value: unknown, maximum: number): boolean {
  if (!isNormalizedDisplayText(value, maximum)) return false;
  const normalizedLength = [...normalizeSearchText(value)].length;
  return (
    normalizedLength >= 1 &&
    normalizedLength <=
      PERSONAL_SECURITY_MASTER_LIMITS.normalizedSearchQueryCodePoints
  );
}

// Keep this identical to the security-master engine's search normalization so
// persisted definitions cannot pass the API and later fail when executed.
function normalizeSearchText(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toUpperCase()
    .replace(NON_LETTER_OR_NUMBER, " ")
    .replace(SPACES, " ")
    .trim();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (!isPlainRecord(value)) return false;
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
    detail: "The personal security-master screen request was not accepted.",
    instance: PERSONAL_SECURITY_MASTER_SCREEN_PATH,
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
    instance: PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
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

function snapshotReceipt(
  catalog: PersonalSecurityMasterCatalog,
): PersonalSecurityMasterSnapshotReceiptDto {
  return {
    asOf: catalog.asOf,
    catalogId: catalog.catalogId,
    catalogVersion: catalog.catalogVersion,
    claim: catalog.claim,
    coverage: catalog.coverage,
    generatedAt: catalog.generatedAt,
    profile: catalog.profile,
    provenance: {
      acquiredAt: catalog.provenance.acquiredAt,
      artifacts: catalog.provenance.artifacts.map((artifact) => ({
        acquiredAt: artifact.acquiredAt,
        artifactId: artifact.artifactId,
        contentSha256: artifact.contentSha256,
        mediaType: artifact.mediaType,
        sourceUri: artifact.sourceUri,
        sourceVersion: artifact.sourceVersion,
      })),
      attribution: catalog.provenance.attribution,
      contentKind: catalog.provenance.contentKind,
      sourceId: catalog.provenance.sourceId,
      sourceRevision: catalog.provenance.sourceRevision,
    },
    schemaVersion: catalog.schemaVersion,
    snapshotSha256: catalog.snapshotSha256,
    sourcePolicyCompatibility: catalog.sourcePolicyCompatibility,
    status: catalog.status,
  };
}
