import type { ConnectedSourcePolicyStatus } from "@research-cockpit/connected-source-policy";
import type {
  ConnectedSourcePolicyStatusDto,
  ProblemDetailsDto,
} from "@research-cockpit/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  isConnectedSourcePolicyAdministration,
  type ConnectedSourcePolicyAdministration,
} from "./connected-source-policy-composition";
import type { DemoApiListenOptions } from "./listen-options";
import {
  isPersonalOwnerSessionAuthority,
  type PersonalOwnerSessionAuthority,
} from "./personal-owner-session";
import {
  authorizePersonalMutationRouteRequest,
  authorizePersonalRouteRequest,
} from "./personal-owner-session-routes";

export const CONNECTED_SOURCE_POLICY_STATUS_PATH =
  "/v1/personal-filing/connected-source-policy/status" as const;
export const CONNECTED_SOURCE_POLICY_KILL_PATH =
  "/v1/personal-filing/connected-source-policy/kill" as const;
export const CONNECTED_SOURCE_POLICY_KILL_INTENT =
  "connected-source-policy-kill" as const;

export async function registerConnectedSourcePolicyRoutes(
  app: FastifyInstance,
  administration: ConnectedSourcePolicyAdministration,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): Promise<void> {
  if (!isConnectedSourcePolicyAdministration(administration)) {
    throw new TypeError(
      "Connected source policy administration is unavailable.",
    );
  }
  if (!isPersonalOwnerSessionAuthority(ownerSession)) {
    throw new TypeError("Personal owner session is unavailable.");
  }

  await app.register((routes, _options, done) => {
    routes.get(
      CONNECTED_SOURCE_POLICY_STATUS_PATH,
      { exposeHeadRoute: false },
      (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            CONNECTED_SOURCE_POLICY_STATUS_PATH,
          )
        ) {
          return sendBoundaryProblem(reply, request);
        }
        return sendStatus(reply, administration.status());
      },
    );

    routes.post(CONNECTED_SOURCE_POLICY_KILL_PATH, (request, reply) => {
      if (
        !authorizePersonalMutationRouteRequest(
          request,
          ownerSession,
          listenOptions,
          CONNECTED_SOURCE_POLICY_KILL_PATH,
          CONNECTED_SOURCE_POLICY_KILL_INTENT,
        )
      ) {
        return sendBoundaryProblem(reply, request);
      }
      administration.kill();
      return reply
        .status(204)
        .header("Cache-Control", "private, no-store")
        .header("Pragma", "no-cache")
        .header("Vary", "Origin")
        .send();
    });
    done();
  });
}

function sendStatus(reply: FastifyReply, status: ConnectedSourcePolicyStatus) {
  const response: ConnectedSourcePolicyStatusDto = {
    schemaVersion: status.schemaVersion,
    profile: status.profile,
    status: status.status,
    reasonCode: status.reasonCode,
    sourceId: status.sourceId,
    policyId: status.policyId,
    policyVersion: status.policyVersion,
    budget: status.budget,
  };
  return reply
    .header("Cache-Control", "private, no-store")
    .header("Pragma", "no-cache")
    .header("Vary", "Origin")
    .type("application/json; charset=utf-8")
    .send(response);
}

function sendBoundaryProblem(reply: FastifyReply, request: FastifyRequest) {
  const problem: ProblemDetailsDto = {
    type: "https://research-cockpit.local/problems/403",
    title: "Request forbidden",
    status: 403,
    detail: "The local connected-source policy request was not accepted.",
    instance: request.url.split("?", 1)[0] ?? "/",
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
