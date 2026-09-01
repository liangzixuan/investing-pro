import type { ProblemDetailsDto } from "@research-cockpit/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { DemoApiListenOptions } from "./listen-options";
import {
  isPersonalOwnerSessionAuthority,
  isPersonalOwnerSessionToken,
  type PersonalOwnerSessionAuthority,
  type PersonalOwnerSessionBinding,
  PERSONAL_OWNER_SESSION_COOKIE_NAME,
} from "./personal-owner-session";

export const PERSONAL_OWNER_SESSION_PATH =
  "/v1/personal-filing/session" as const;
export const PERSONAL_OWNER_SESSION_BOOTSTRAP_PATH =
  "/v1/personal-filing/session/bootstrap" as const;
export const PERSONAL_OWNER_SESSION_ROTATE_PATH =
  "/v1/personal-filing/session/rotate" as const;
export const PERSONAL_OWNER_SESSION_LOGOUT_PATH =
  "/v1/personal-filing/session/logout" as const;
export const PERSONAL_OWNER_SESSION_REVOKE_PATH =
  "/v1/personal-filing/session/revoke" as const;
export const PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME =
  "x-research-cockpit-bootstrap" as const;
export const PERSONAL_OWNER_INTENT_HEADER_NAME =
  "x-research-cockpit-intent" as const;

const ACTIVE_COOKIE_ATTRIBUTES =
  `Path=/v1/personal-filing; HttpOnly; SameSite=Strict` as const;
const CLEAR_COOKIE =
  `${PERSONAL_OWNER_SESSION_COOKIE_NAME}=; Path=/v1/personal-filing; HttpOnly; SameSite=Strict; Max-Age=0` as const;
const TOKEN_COOKIE_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;
const FORWARDED_HEADERS = new Set([
  "forwarded",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-real-ip",
]);
const FORBIDDEN_NEGOTIATION_HEADERS = new Set([
  "authorization",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-unmodified-since",
  "range",
]);

type PersonalOwnerIntent = "bootstrap" | "logout" | "revoke" | "rotate";
export type PersonalOwnerMutationIntent = "connected-source-policy-kill";
type ParsedHeader =
  | { readonly kind: "invalid" }
  | { readonly kind: "missing" }
  | { readonly kind: "value"; readonly value: string };

interface PersonalRequestBoundary {
  readonly sessionBinding: PersonalOwnerSessionBinding;
  readonly cookie: ParsedHeader;
}

export async function registerPersonalOwnerSessionRoutes(
  app: FastifyInstance,
  authority: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): Promise<void> {
  if (!isPersonalOwnerSessionAuthority(authority)) {
    throw new TypeError("Personal owner session is unavailable.");
  }

  await app.register((routes, _options, done) => {
    routes.get(
      PERSONAL_OWNER_SESSION_PATH,
      { exposeHeadRoute: false },
      (request, reply) => {
        const boundary = inspectPersonalRequest(
          request,
          listenOptions,
          PERSONAL_OWNER_SESSION_PATH,
          "GET",
        );
        if (!authorizeBoundary(authority, boundary)) {
          return sendOwnerSessionProblem(reply, request);
        }
        return sendNoContent(reply);
      },
    );

    routes.post(PERSONAL_OWNER_SESSION_BOOTSTRAP_PATH, (request, reply) => {
      const boundary = inspectPersonalRequest(
        request,
        listenOptions,
        PERSONAL_OWNER_SESSION_BOOTSTRAP_PATH,
        "POST",
        "bootstrap",
      );
      const bootstrap = readSingleHeader(
        request,
        PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME,
      );
      if (
        boundary === undefined ||
        boundary.cookie.kind === "invalid" ||
        bootstrap.kind !== "value"
      ) {
        return sendOwnerSessionProblem(reply, request);
      }
      const token = authority.bootstrap(
        bootstrap.value,
        boundary.sessionBinding,
      );
      if (token === undefined) {
        return sendOwnerSessionProblem(reply, request);
      }
      return sendNoContent(reply, activeCookie(token));
    });

    routes.post(PERSONAL_OWNER_SESSION_ROTATE_PATH, (request, reply) => {
      const boundary = inspectPersonalRequest(
        request,
        listenOptions,
        PERSONAL_OWNER_SESSION_ROTATE_PATH,
        "POST",
        "rotate",
      );
      if (boundary?.cookie.kind !== "value") {
        return sendOwnerSessionProblem(reply, request);
      }
      const replacement = authority.rotate(
        boundary.cookie.value,
        boundary.sessionBinding,
      );
      if (replacement === undefined) {
        return sendOwnerSessionProblem(reply, request);
      }
      return sendNoContent(reply, activeCookie(replacement));
    });

    routes.post(PERSONAL_OWNER_SESSION_LOGOUT_PATH, (request, reply) => {
      return terminateSession(
        request,
        reply,
        authority,
        listenOptions,
        PERSONAL_OWNER_SESSION_LOGOUT_PATH,
        "logout",
      );
    });

    routes.post(PERSONAL_OWNER_SESSION_REVOKE_PATH, (request, reply) => {
      return terminateSession(
        request,
        reply,
        authority,
        listenOptions,
        PERSONAL_OWNER_SESSION_REVOKE_PATH,
        "revoke",
      );
    });
    done();
  });
}

export function authorizePersonalRouteRequest(
  request: FastifyRequest,
  authority: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
  expectedPath: string,
): boolean {
  if (!isPersonalOwnerSessionAuthority(authority)) return false;
  const boundary = inspectPersonalRequest(
    request,
    listenOptions,
    expectedPath,
    "GET",
  );
  return authorizeBoundary(authority, boundary);
}

export function authorizePersonalMutationRouteRequest(
  request: FastifyRequest,
  authority: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
  expectedPath: string,
  expectedIntent: PersonalOwnerMutationIntent,
): boolean {
  if (!isPersonalOwnerSessionAuthority(authority)) return false;
  const boundary = inspectPersonalRequest(
    request,
    listenOptions,
    expectedPath,
    "POST",
    expectedIntent,
  );
  return authorizeBoundary(authority, boundary);
}

export function personalBrowserOrigin(
  listenOptions: DemoApiListenOptions,
): string {
  return listenOptions.host === "::1"
    ? "http://[::1]:3000"
    : "http://127.0.0.1:3000";
}

function terminateSession(
  request: FastifyRequest,
  reply: FastifyReply,
  authority: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
  path: string,
  intent: "logout" | "revoke",
) {
  const boundary = inspectPersonalRequest(
    request,
    listenOptions,
    path,
    "POST",
    intent,
  );
  if (boundary?.cookie.kind !== "value") {
    return sendOwnerSessionProblem(reply, request);
  }
  const terminated =
    intent === "logout"
      ? authority.logout(boundary.cookie.value, boundary.sessionBinding)
      : authority.revoke(boundary.cookie.value, boundary.sessionBinding);
  if (!terminated) return sendOwnerSessionProblem(reply, request);
  return sendNoContent(reply, CLEAR_COOKIE);
}

function authorizeBoundary(
  authority: PersonalOwnerSessionAuthority,
  boundary: PersonalRequestBoundary | undefined,
): boolean {
  return (
    boundary?.cookie.kind === "value" &&
    authority.authorize(boundary.cookie.value, boundary.sessionBinding)
  );
}

function inspectPersonalRequest(
  request: FastifyRequest,
  listenOptions: DemoApiListenOptions,
  expectedPath: string,
  expectedMethod: "GET" | "POST",
  expectedIntent?: PersonalOwnerIntent | PersonalOwnerMutationIntent,
): PersonalRequestBoundary | undefined {
  if (
    request.method !== expectedMethod ||
    request.url !== expectedPath ||
    !isLoopback(request.ip)
  ) {
    return undefined;
  }

  const rawNames = request.raw.rawHeaders
    .filter((_value, index) => index % 2 === 0)
    .map((name) => name.toLowerCase());
  if (
    count(rawNames, "host") !== 1 ||
    count(rawNames, "origin") !== 1 ||
    count(rawNames, "accept") > 1 ||
    count(rawNames, "cookie") > 1 ||
    count(rawNames, PERSONAL_OWNER_INTENT_HEADER_NAME) > 1 ||
    count(rawNames, PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME) > 1 ||
    rawNames.some((name) => FORWARDED_HEADERS.has(name)) ||
    rawNames.some((name) => FORBIDDEN_NEGOTIATION_HEADERS.has(name)) ||
    rawNames.includes("transfer-encoding") ||
    rawNames.includes("content-type")
  ) {
    return undefined;
  }

  const contentLength = readSingleHeader(request, "content-length");
  if (
    contentLength.kind === "invalid" ||
    (expectedMethod === "GET" && contentLength.kind !== "missing") ||
    (contentLength.kind === "value" && contentLength.value !== "0")
  ) {
    return undefined;
  }
  const host = readSingleHeader(request, "host");
  const origin = readSingleHeader(request, "origin");
  const accept = readSingleHeader(request, "accept");
  if (
    host.kind !== "value" ||
    host.value !== expectedHost(request, listenOptions) ||
    origin.kind !== "value" ||
    origin.value !== personalBrowserOrigin(listenOptions) ||
    (accept.kind === "value" &&
      accept.value !== "*/*" &&
      accept.value.toLowerCase() !== "application/json") ||
    accept.kind === "invalid"
  ) {
    return undefined;
  }

  const fetchSite = readSingleHeader(request, "sec-fetch-site");
  if (
    fetchSite.kind === "invalid" ||
    (fetchSite.kind === "value" &&
      fetchSite.value !== "same-origin" &&
      fetchSite.value !== "same-site")
  ) {
    return undefined;
  }

  const intent = readSingleHeader(request, PERSONAL_OWNER_INTENT_HEADER_NAME);
  const bootstrap = readSingleHeader(
    request,
    PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME,
  );
  if (expectedIntent === undefined) {
    if (intent.kind !== "missing" || bootstrap.kind !== "missing") {
      return undefined;
    }
  } else if (
    intent.kind !== "value" ||
    intent.value !== expectedIntent ||
    (expectedIntent === "bootstrap"
      ? bootstrap.kind !== "value"
      : bootstrap.kind !== "missing")
  ) {
    return undefined;
  }

  return {
    sessionBinding: { authority: host.value, origin: origin.value },
    cookie: readSessionCookie(request),
  };
}

function readSessionCookie(
  request: FastifyRequest,
): PersonalRequestBoundary["cookie"] {
  const header = readSingleHeader(request, "cookie");
  if (header.kind !== "value") return header;
  const names = new Set<string>();
  let sessionToken: string | undefined;
  for (const rawPart of header.value.split(";")) {
    const part = rawPart.trim();
    const separator = part.indexOf("=");
    if (separator < 1) return { kind: "invalid" };
    const name = part.slice(0, separator);
    const value = part.slice(separator + 1);
    if (!TOKEN_COOKIE_NAME_PATTERN.test(name) || names.has(name)) {
      return { kind: "invalid" };
    }
    names.add(name);
    if (name === PERSONAL_OWNER_SESSION_COOKIE_NAME) {
      if (!isPersonalOwnerSessionToken(value)) return { kind: "invalid" };
      sessionToken = value;
    }
  }
  return sessionToken === undefined
    ? { kind: "missing" }
    : { kind: "value", value: sessionToken };
}

function readSingleHeader(
  request: FastifyRequest,
  headerName: string,
): ParsedHeader {
  const rawValues: string[] = [];
  const rawHeaders = request.raw.rawHeaders;
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index]?.toLowerCase() === headerName) {
      rawValues.push(rawHeaders[index + 1] ?? "");
    }
  }
  const normalized = request.headers[headerName];
  if (rawValues.length === 0 && normalized === undefined) {
    return { kind: "missing" };
  }
  if (
    rawValues.length !== 1 ||
    typeof normalized !== "string" ||
    normalized !== rawValues[0]
  ) {
    return { kind: "invalid" };
  }
  return { kind: "value", value: normalized };
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

function isLoopback(address: string): boolean {
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

function count(values: readonly string[], value: string): number {
  return values.filter((candidate) => candidate === value).length;
}

function activeCookie(token: string): string {
  return `${PERSONAL_OWNER_SESSION_COOKIE_NAME}=${token}; ${ACTIVE_COOKIE_ATTRIBUTES}`;
}

function sendNoContent(reply: FastifyReply, cookie?: string) {
  void reply
    .header("Cache-Control", "private, no-store")
    .header("Pragma", "no-cache")
    .header("Vary", "Origin");
  if (cookie !== undefined) void reply.header("Set-Cookie", cookie);
  return reply.status(204).send();
}

function sendOwnerSessionProblem(reply: FastifyReply, request: FastifyRequest) {
  const problem: ProblemDetailsDto = {
    type: "https://research-cockpit.local/problems/403",
    title: "Request forbidden",
    status: 403,
    detail: "The local owner-session request was not accepted.",
    instance: request.url.split("?", 1)[0] ?? PERSONAL_OWNER_SESSION_PATH,
    traceId: request.id,
  };
  return reply
    .status(403)
    .header("Cache-Control", "private, no-store")
    .header("Pragma", "no-cache")
    .header("Vary", "Origin")
    .type("application/problem+json")
    .send(problem);
}
