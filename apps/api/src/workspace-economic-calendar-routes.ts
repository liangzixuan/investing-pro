import {
  isPersonalEconomicCalendarDto,
  PERSONAL_ECONOMIC_CALENDAR_PATH,
  type ProblemDetailsDto,
} from "@research-cockpit/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { BeaReleaseProvider } from "./bea-release-provider";
import type { DemoApiListenOptions } from "./listen-options";
import type { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import {
  authorizePersonalRouteRequest,
  sendPersonalOwnerSessionProblem,
} from "./personal-owner-session-routes";

export function registerPersonalWorkspaceEconomicCalendarRoutes(
  app: FastifyInstance,
  provider: BeaReleaseProvider,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  app.get(
    PERSONAL_ECONOMIC_CALENDAR_PATH,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_ECONOMIC_CALENDAR_PATH,
          )
        )
          return sendPersonalOwnerSessionProblem(reply, request);
      },
    },
    async (request, reply) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      request.raw.once("aborted", abort);
      reply.raw.once("close", abort);
      try {
        const result = await provider.load(controller.signal);
        if (controller.signal.aborted || !isPersonalEconomicCalendarDto(result))
          return sendCalendarProblem(reply, request);
        return reply.type("application/json; charset=utf-8").send(result);
      } catch {
        return sendCalendarProblem(reply, request);
      } finally {
        request.raw.off("aborted", abort);
        reply.raw.off("close", abort);
      }
    },
  );
}

function sendCalendarProblem(reply: FastifyReply, request: FastifyRequest) {
  const problem: ProblemDetailsDto = {
    type: "https://research-cockpit.local/problems/502",
    title: "Economic calendar unavailable",
    status: 502,
    detail: "The BEA release schedule could not be loaded.",
    instance: PERSONAL_ECONOMIC_CALENDAR_PATH,
    traceId: request.id,
  };
  return reply.status(502).type("application/problem+json").send(problem);
}
