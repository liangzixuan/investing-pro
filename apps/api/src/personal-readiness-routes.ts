import type {
  PersonalFilingReadinessDto,
  ProblemDetailsDto,
} from "@research-cockpit/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { DemoApiListenOptions } from "./listen-options";
import {
  isPersonalOwnerSessionAuthority,
  type PersonalOwnerSessionAuthority,
} from "./personal-owner-session";
import { authorizePersonalRouteRequest } from "./personal-owner-session-routes";
import {
  isPersonalQualityReadinessCapability,
  type PersonalQualityReadinessCapability,
} from "./personal-quality-readiness";

export const PERSONAL_FILING_READINESS_PATH =
  "/v1/personal-filing/readiness" as const;

const READINESS_RESPONSE = Object.freeze({
  schemaVersion: "1.0.0",
  profile: "personal_single_user_local",
  status: "quality_gate_ready",
  dataPlane: "disabled",
} satisfies PersonalFilingReadinessDto);

const ALLOWED_ORIGINS = new Set([
  "http://[::1]:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
]);
const FORWARDED_HEADERS = new Set([
  "forwarded",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-real-ip",
]);
export async function registerPersonalReadinessRoute(
  app: FastifyInstance,
  capability?: PersonalQualityReadinessCapability,
  ownerSession?: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions = { host: "127.0.0.1", port: 3100 },
): Promise<void> {
  if (
    capability !== undefined &&
    !isPersonalQualityReadinessCapability(capability)
  ) {
    throw new TypeError("Personal filing readiness is unavailable.");
  }
  if (
    capability !== undefined &&
    !isPersonalOwnerSessionAuthority(ownerSession)
  ) {
    throw new TypeError("Personal owner session is unavailable.");
  }

  await app.register((routes, _options, done) => {
    routes.get(
      PERSONAL_FILING_READINESS_PATH,
      { exposeHeadRoute: false },
      (request, reply) => {
        const allowed =
          ownerSession === undefined
            ? isAllowedReadinessRequest(request, listenOptions)
            : authorizePersonalRouteRequest(
                request,
                ownerSession,
                listenOptions,
                PERSONAL_FILING_READINESS_PATH,
              );
        if (!allowed) {
          return sendBoundaryProblem(reply, request);
        }
        if (capability === undefined) {
          return sendUnavailableProblem(reply, request);
        }
        return reply
          .header("Cache-Control", "private, no-store")
          .header("Pragma", "no-cache")
          .type("application/json; charset=utf-8")
          .send(READINESS_RESPONSE);
      },
    );
    done();
  });
}

function sendUnavailableProblem(reply: FastifyReply, request: FastifyRequest) {
  const problem: ProblemDetailsDto = {
    type: "https://research-cockpit.local/problems/404",
    title: "Readiness unavailable",
    status: 404,
    detail: "No personal filing readiness state is available.",
    instance: PERSONAL_FILING_READINESS_PATH,
    traceId: request.id,
  };
  return reply
    .status(404)
    .header("Cache-Control", "private, no-store")
    .header("Pragma", "no-cache")
    .type("application/problem+json")
    .send(problem);
}

function isAllowedReadinessRequest(
  request: FastifyRequest,
  listenOptions: DemoApiListenOptions,
): boolean {
  if (
    request.ip !== "127.0.0.1" &&
    request.ip !== "::1" &&
    request.ip !== "::ffff:127.0.0.1"
  ) {
    return false;
  }
  if (request.url !== PERSONAL_FILING_READINESS_PATH) return false;

  const names = request.raw.rawHeaders
    .filter((_value, index) => index % 2 === 0)
    .map((name) => name.toLowerCase());
  if (
    count(names, "host") !== 1 ||
    count(names, "origin") > 1 ||
    count(names, "accept") > 1
  ) {
    return false;
  }
  if (names.some((name) => FORWARDED_HEADERS.has(name))) return false;
  if (names.includes("content-length") || names.includes("transfer-encoding"))
    return false;

  const host = request.headers.host;
  if (host === undefined || host !== expectedHost(request, listenOptions)) {
    return false;
  }
  const origin = request.headers.origin;
  if (typeof origin !== "string" || !ALLOWED_ORIGINS.has(origin)) {
    return false;
  }
  const accept = request.headers.accept;
  return (
    accept === undefined ||
    accept === "*/*" ||
    accept.toLowerCase() === "application/json"
  );
}

function expectedHost(
  request: FastifyRequest,
  listenOptions: DemoApiListenOptions,
): string | undefined {
  const port =
    listenOptions.port === 0
      ? request.raw.socket.localPort
      : listenOptions.port;
  if (
    port === undefined ||
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    return undefined;
  }
  const host = listenOptions.host === "::1" ? "[::1]" : "127.0.0.1";
  return port === 80 ? host : `${host}:${String(port)}`;
}

function count(values: readonly string[], value: string): number {
  return values.filter((candidate) => candidate === value).length;
}

function sendBoundaryProblem(reply: FastifyReply, request: FastifyRequest) {
  const problem: ProblemDetailsDto = {
    type: "https://research-cockpit.local/problems/403",
    title: "Request forbidden",
    status: 403,
    detail: "The local readiness request was not accepted.",
    instance: PERSONAL_FILING_READINESS_PATH,
    traceId: request.id,
  };
  return reply
    .status(403)
    .header("Cache-Control", "private, no-store")
    .header("Pragma", "no-cache")
    .type("application/problem+json")
    .send(problem);
}
