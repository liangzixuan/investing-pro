import {
  isPersonalFilingMonitorAcknowledgeDto,
  isPersonalFilingMonitorCommandDto,
  isPersonalFilingMonitorConfigureDto,
} from "@research-cockpit/contracts";
import { LocalResearchVaultError } from "@research-cockpit/local-research-vault";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { DemoApiListenOptions } from "./listen-options";
import {
  PersonalFilingMonitorError,
  type PersonalFilingMonitor,
} from "./personal-filing-monitor";
import type { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import {
  authorizePersonalRouteRequest,
  authorizePersonalVaultMutationRouteRequest,
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
  sendPersonalOwnerSessionProblem,
} from "./personal-owner-session-routes";

export const PERSONAL_FILING_MONITOR_PATH =
  "/v1/personal-filing/workspace/filing-monitor" as const;

export function registerPersonalWorkspaceFilingMonitorRoutes(
  app: FastifyInstance,
  monitor: PersonalFilingMonitor,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  app.get(
    PERSONAL_FILING_MONITOR_PATH,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_FILING_MONITOR_PATH,
          )
        )
          return sendPersonalOwnerSessionProblem(reply, request);
      },
    },
    (request, reply) => {
      try {
        const result = monitor.get();
        return reply.header("ETag", `"v${result.version}"`).send(result);
      } catch (error) {
        return problem(error, request, reply);
      }
    },
  );
  for (const operation of [
    "configure",
    "pause",
    "acknowledge",
    "reset",
  ] as const) {
    const path =
      operation === "configure"
        ? PERSONAL_FILING_MONITOR_PATH
        : `${PERSONAL_FILING_MONITOR_PATH}/${operation}`;
    app.post<{ Body: unknown }>(
      path,
      {
        bodyLimit: 128 * 1_024,
        onRequest: async (request, reply) => {
          const intent = singleHeader(
            request,
            PERSONAL_OWNER_INTENT_HEADER_NAME,
          );
          if (
            (intent !== "personal-vault-create" &&
              intent !== "personal-vault-update") ||
            (operation !== "configure" && intent !== "personal-vault-update") ||
            !authorizePersonalVaultMutationRouteRequest(
              request,
              ownerSession,
              listenOptions,
              path,
              intent,
              "json",
            )
          )
            return sendPersonalOwnerSessionProblem(reply, request);
          if (
            precondition(request, intent) === null ||
            !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u.test(
              singleHeader(request, PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME) ??
                "",
            )
          )
            return problem(
              new PersonalFilingMonitorError(400, "invalid_request"),
              request,
              reply,
            );
        },
        errorHandler: (_error, request, reply) => {
          void problem(
            new PersonalFilingMonitorError(400, "invalid_request"),
            request,
            reply,
          );
        },
      },
      (request, reply) => {
        const body = request.body,
          key = singleHeader(request, PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME)!;
        const intent = singleHeader(
          request,
          PERSONAL_OWNER_INTENT_HEADER_NAME,
        )!;
        const version = precondition(request, intent);
        try {
          let result;
          if (
            operation === "configure" &&
            isPersonalFilingMonitorConfigureDto(body) &&
            body.expectedVersion === version
          )
            result = monitor.configure(body, key);
          else if (
            operation === "acknowledge" &&
            isPersonalFilingMonitorAcknowledgeDto(body) &&
            body.expectedVersion === version
          )
            result = monitor.acknowledge(body, key);
          else if (
            (operation === "pause" || operation === "reset") &&
            isPersonalFilingMonitorCommandDto(body) &&
            body.expectedVersion === version
          )
            result = monitor[operation](body, key);
          else throw new PersonalFilingMonitorError(400, "invalid_request");
          return reply.header("ETag", `"v${result.version}"`).send(result);
        } catch (error) {
          return problem(error, request, reply);
        }
      },
    );
  }
}

function singleHeader(
  request: FastifyRequest,
  name: string,
): string | undefined {
  const values: string[] = [];
  for (let index = 0; index < request.raw.rawHeaders.length; index += 2)
    if (request.raw.rawHeaders[index]?.toLowerCase() === name)
      values.push(request.raw.rawHeaders[index + 1] ?? "");
  return values.length === 1 &&
    typeof request.headers[name] === "string" &&
    request.headers[name] === values[0]
    ? values[0]
    : undefined;
}
function precondition(request: FastifyRequest, intent: string): number | null {
  if (intent === "personal-vault-create")
    return singleHeader(request, "if-none-match") === "*" &&
      request.headers["if-match"] === undefined
      ? 0
      : null;
  if (request.headers["if-none-match"] !== undefined) return null;
  const match = singleHeader(request, "if-match")?.match(
    /^"v([1-9][0-9]{0,14})"$/u,
  );
  return match?.[1] !== undefined && Number.isSafeInteger(Number(match[1]))
    ? Number(match[1])
    : null;
}
function problem(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let status = 503,
    code = "unavailable";
  if (error instanceof PersonalFilingMonitorError) {
    status = error.status;
    code = error.code;
  } else if (
    error instanceof LocalResearchVaultError &&
    ["VAULT_CONFLICT", "VAULT_IDEMPOTENCY_CONFLICT"].includes(error.code)
  ) {
    status = 409;
    code = "conflict";
  }
  return reply
    .status(status)
    .type("application/problem+json")
    .send({
      type: `https://research-cockpit.local/problems/${status}`,
      title: "Filing monitor unavailable",
      status,
      detail: "The personal filing monitor request was not accepted.",
      instance: PERSONAL_FILING_MONITOR_PATH,
      traceId: request.id,
      code,
    });
}
