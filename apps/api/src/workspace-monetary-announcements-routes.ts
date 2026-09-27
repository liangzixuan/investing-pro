import {
  isPersonalMonetaryAnnouncementsDto,
  PERSONAL_MONETARY_ANNOUNCEMENTS_PATH,
  type ProblemDetailsDto,
} from "@research-cockpit/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { FedMonetaryAnnouncementsProvider } from "./fed-monetary-announcements-provider";
import type { DemoApiListenOptions } from "./listen-options";
import type { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import {
  authorizePersonalRouteRequest,
  sendPersonalOwnerSessionProblem,
} from "./personal-owner-session-routes";

export function registerPersonalWorkspaceMonetaryAnnouncementsRoutes(
  app: FastifyInstance,
  provider: FedMonetaryAnnouncementsProvider,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  app.get(
    PERSONAL_MONETARY_ANNOUNCEMENTS_PATH,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_MONETARY_ANNOUNCEMENTS_PATH,
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
        if (
          controller.signal.aborted ||
          !isPersonalMonetaryAnnouncementsDto(result)
        )
          return sendAnnouncementsProblem(reply, request);
        return reply.type("application/json; charset=utf-8").send(result);
      } catch {
        return sendAnnouncementsProblem(reply, request);
      } finally {
        request.raw.off("aborted", abort);
        reply.raw.off("close", abort);
      }
    },
  );
}

function sendAnnouncementsProblem(
  reply: FastifyReply,
  request: FastifyRequest,
) {
  const problem: ProblemDetailsDto = {
    type: "https://research-cockpit.local/problems/502",
    title: "Federal Reserve announcements unavailable",
    status: 502,
    detail: "The Federal Reserve announcements could not be loaded.",
    instance: PERSONAL_MONETARY_ANNOUNCEMENTS_PATH,
    traceId: request.id,
  };
  return reply.status(502).type("application/problem+json").send(problem);
}
