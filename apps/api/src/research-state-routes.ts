import type {
  AlertWriteRequestDto,
  AlertWriteResponseDto,
  ProblemDetailsDto,
  ThesisWriteRequestDto,
  ThesisWriteResponseDto,
} from "@research-cockpit/contracts";
import {
  ResearchStateError,
  type SyntheticActorContext,
} from "@research-cockpit/research-state";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  DEMO_PERSONA_HEADER_NAME,
  type DemoResearchStateComposition,
} from "./demo-research-state";

const IDEMPOTENCY_HEADER_NAME = "idempotency-key";
const IF_MATCH_HEADER_NAME = "if-match";
const CONTENT_TYPE_HEADER_NAME = "content-type";
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const STRONG_VERSION_ETAG_PATTERN = /^"([1-9][0-9]*)"$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9._:-]+$/;
const METRIC_KEY_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;
const DECIMAL_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const JSON_CONTENT_TYPE_PATTERN =
  /^application\/json(?:\s*;\s*charset=utf-8)?$/i;

interface ResearchStateParams {
  thesisId?: string;
  alertId?: string;
}

interface ParsedRequestContext {
  idempotencyKey: string;
  expectedVersion: number;
}

type RouteProblemStatus = 400 | 403 | 404 | 409 | 412 | 428 | 500;

class RouteProblem extends Error {
  constructor(readonly status: RouteProblemStatus) {
    super("research state route rejected the request");
    this.name = "RouteProblem";
  }
}

export async function registerResearchStateRoutes(
  app: FastifyInstance,
  composition: DemoResearchStateComposition,
): Promise<void> {
  await app.register((routes, _options, done) => {
    const requestActors = new WeakMap<FastifyRequest, SyntheticActorContext>();
    routes.setErrorHandler((error, request, reply) =>
      sendProblem(reply, request, mapErrorStatus(error)),
    );
    routes.addHook("onRequest", (request, _reply, next) => {
      try {
        requestActors.set(request, resolveRequestActor(request, composition));
        next();
      } catch (error) {
        next(error instanceof Error ? error : new RouteProblem(500));
      }
    });
    routes.addHook("onResponse", (request, _reply, next) => {
      requestActors.delete(request);
      next();
    });

    routes.put<{
      Params: ResearchStateParams;
      Body: unknown;
    }>("/v1/theses/:thesisId", async (request, reply) => {
      const actor = requireRequestActor(request, requestActors);
      const context = parseRequestContext(request);
      const thesisId = request.params.thesisId;
      if (!isUuid(thesisId)) throw new RouteProblem(400);
      const payload = parseThesisBody(request.body);
      if (!payload) throw new RouteProblem(400);

      const record = await composition.service.saveThesis(actor, {
        id: thesisId,
        payload,
        expectedVersion: context.expectedVersion,
        idempotencyKey: context.idempotencyKey,
      });
      const response: ThesisWriteResponseDto = {
        schemaVersion: "1.0.0",
        synthetic: true,
        id: record.id,
        instrumentId: record.instrumentId,
        claim: record.claim,
        evidence: record.evidence,
        risks: record.risks,
        invalidation: record.invalidation,
        version: record.version,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
      return reply
        .header("ETag", versionEtag(record.version))
        .type("application/json; charset=utf-8")
        .send(response);
    });

    routes.put<{
      Params: ResearchStateParams;
      Body: unknown;
    }>("/v1/alerts/:alertId", async (request, reply) => {
      const actor = requireRequestActor(request, requestActors);
      const context = parseRequestContext(request);
      const alertId = request.params.alertId;
      if (!isUuid(alertId)) throw new RouteProblem(400);
      const payload = parseAlertBody(request.body);
      if (!payload) throw new RouteProblem(400);

      const record = await composition.service.saveAlert(actor, {
        id: alertId,
        payload,
        expectedVersion: context.expectedVersion,
        idempotencyKey: context.idempotencyKey,
      });
      const response: AlertWriteResponseDto = {
        schemaVersion: "1.0.0",
        synthetic: true,
        id: record.id,
        instrumentId: record.instrumentId,
        metricKey: record.metricKey,
        operator: record.operator,
        threshold: record.threshold,
        version: record.version,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
      return reply
        .header("ETag", versionEtag(record.version))
        .type("application/json; charset=utf-8")
        .send(response);
    });
    done();
  });
}

function requireRequestActor(
  request: FastifyRequest,
  requestActors: WeakMap<FastifyRequest, SyntheticActorContext>,
): SyntheticActorContext {
  const actor = requestActors.get(request);
  if (!actor) throw new RouteProblem(500);
  return actor;
}

function resolveRequestActor(
  request: FastifyRequest,
  composition: DemoResearchStateComposition,
) {
  const persona = readSingleHeader(request, DEMO_PERSONA_HEADER_NAME);
  if (persona.kind !== "value") throw new RouteProblem(403);
  const actor = composition.resolveActor({
    personaSelector: persona.value,
    remoteAddress: request.ip,
    requestHeaders: request.headers,
  });
  if (!actor) throw new RouteProblem(403);
  return actor;
}

function parseRequestContext(request: FastifyRequest): ParsedRequestContext {
  if (request.url.includes("?")) throw new RouteProblem(400);

  const contentType = readSingleHeader(request, CONTENT_TYPE_HEADER_NAME);
  if (
    contentType.kind !== "value" ||
    !JSON_CONTENT_TYPE_PATTERN.test(contentType.value)
  )
    throw new RouteProblem(400);

  const idempotencyKey = readSingleHeader(request, IDEMPOTENCY_HEADER_NAME);
  if (
    idempotencyKey.kind !== "value" ||
    !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey.value)
  )
    throw new RouteProblem(400);

  const ifMatch = readSingleHeader(request, IF_MATCH_HEADER_NAME);
  if (ifMatch.kind === "missing") throw new RouteProblem(428);
  if (ifMatch.kind !== "value") throw new RouteProblem(400);
  const match = STRONG_VERSION_ETAG_PATTERN.exec(ifMatch.value);
  if (!match) throw new RouteProblem(400);
  const versionText = match[1];
  if (versionText === undefined) throw new RouteProblem(400);
  const expectedVersion = Number(versionText);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
    throw new RouteProblem(400);

  return { idempotencyKey: idempotencyKey.value, expectedVersion };
}

function parseThesisBody(value: unknown): ThesisWriteRequestDto | null {
  if (
    !hasExactKeys(value, [
      "instrumentId",
      "claim",
      "evidence",
      "risks",
      "invalidation",
    ]) ||
    !isToken(value.instrumentId, 3, 160) ||
    !isSafeText(value.claim, 4_000) ||
    !isSafeText(value.evidence, 8_000) ||
    !isSafeText(value.risks, 8_000) ||
    !isSafeText(value.invalidation, 4_000)
  )
    return null;
  return {
    instrumentId: value.instrumentId,
    claim: value.claim,
    evidence: value.evidence,
    risks: value.risks,
    invalidation: value.invalidation,
  };
}

function parseAlertBody(value: unknown): AlertWriteRequestDto | null {
  if (
    !hasExactKeys(value, [
      "instrumentId",
      "metricKey",
      "operator",
      "threshold",
    ]) ||
    !isToken(value.instrumentId, 3, 160) ||
    typeof value.metricKey !== "string" ||
    !METRIC_KEY_PATTERN.test(value.metricKey) ||
    (value.operator !== "above" && value.operator !== "below") ||
    typeof value.threshold !== "string" ||
    value.threshold.length > 64 ||
    !DECIMAL_PATTERN.test(value.threshold)
  )
    return null;
  return {
    instrumentId: value.instrumentId,
    metricKey: value.metricKey,
    operator: value.operator,
    threshold: value.threshold,
  };
}

function readSingleHeader(
  request: FastifyRequest,
  headerName: string,
):
  { kind: "missing" } | { kind: "invalid" } | { kind: "value"; value: string } {
  const rawValues: string[] = [];
  const rawHeaders = request.raw.rawHeaders;
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index]?.toLowerCase() === headerName)
      rawValues.push(rawHeaders[index + 1] ?? "");
  }
  const normalized = request.headers[headerName];
  if (rawValues.length === 0 && normalized === undefined)
    return { kind: "missing" };
  if (
    rawValues.length !== 1 ||
    typeof normalized !== "string" ||
    normalized !== rawValues[0] ||
    normalized.includes(",")
  )
    return { kind: "invalid" };
  return { kind: "value", value: normalized };
}

function hasExactKeys<K extends string>(
  value: unknown,
  keys: readonly K[],
): value is Record<K, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const actual = Object.keys(value);
  const expected = new Set<string>(keys);
  return (
    actual.length === expected.size && actual.every((key) => expected.has(key))
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isToken(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length >= minimum &&
    value.length <= maximum &&
    TOKEN_PATTERN.test(value)
  );
}

function isSafeText(value: unknown, maximum: number): value is string {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  let length = 0;
  for (const character of value) {
    length += 1;
    if (length > maximum) return false;
    const code = character.charCodeAt(0);
    if (
      code <= 8 ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    )
      return false;
  }
  return true;
}

function versionEtag(version: number): string {
  return `"${version}"`;
}

function mapErrorStatus(error: unknown): RouteProblemStatus {
  if (error instanceof RouteProblem) return error.status;
  if (error instanceof ResearchStateError) {
    switch (error.code) {
      case "FORBIDDEN":
        return 403;
      case "NOT_FOUND":
        return 404;
      case "IDEMPOTENCY_CONFLICT":
        return 409;
      case "VERSION_CONFLICT":
        return 412;
      case "INVALID_INPUT":
        return 500;
    }
  }
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error
      ? error.statusCode
      : undefined;
  if (statusCode === 400 || statusCode === 413 || statusCode === 415)
    return 400;
  return 500;
}

function sendProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: RouteProblemStatus,
) {
  const descriptor = problemDescriptor(status);
  const problem: ProblemDetailsDto = {
    type: `https://research-cockpit.local/problems/${status}`,
    title: descriptor.title,
    status,
    detail: descriptor.detail,
    instance: request.routeOptions.url ?? "/v1/research-state",
    traceId: request.id,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}

function problemDescriptor(status: RouteProblemStatus): {
  title: string;
  detail: string;
} {
  switch (status) {
    case 400:
      return { title: "Invalid request", detail: "The request is invalid." };
    case 403:
      return { title: "Request denied", detail: "The request is not allowed." };
    case 404:
      return {
        title: "Resource not found",
        detail: "The requested resource is not available.",
      };
    case 409:
      return {
        title: "Idempotency conflict",
        detail: "The idempotency key conflicts with an earlier request.",
      };
    case 412:
      return {
        title: "Version precondition failed",
        detail: "The resource version precondition failed.",
      };
    case 428:
      return {
        title: "Precondition required",
        detail: "A single strong If-Match header is required.",
      };
    case 500:
      return {
        title: "Internal server error",
        detail: "The request could not be completed.",
      };
  }
}
