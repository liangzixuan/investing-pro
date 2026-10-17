import {
  parseManagedSecAnnualCanonicalRequest,
  type ProblemDetailsDto,
} from "@research-cockpit/contracts";
import {
  PERSONAL_SECURITY_MASTER_LIMITS,
  searchPersonalSecurityMaster,
  type PersonalSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { DemoApiListenOptions } from "./listen-options";
import type { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import {
  authorizePersonalJsonRouteRequest,
  sendPersonalOwnerSessionProblem,
} from "./personal-owner-session-routes";
import {
  PersonalSecAnnualEvidenceProviderError,
  type PersonalSecAnnualEvidenceProvider,
} from "./personal-sec-annual-evidence-provider";
import { encodePersonalSecAnnualCanonicalResponse } from "./personal-sec-annual-canonical-response";

export const PERSONAL_SEC_ANNUAL_EVIDENCE_PATH =
  "/v1/personal-filing/workspace/sec-annual-evidence" as const;

export function registerPersonalWorkspaceSecAnnualEvidenceRoutes(
  app: FastifyInstance,
  catalog: PersonalSecurityMasterCatalog,
  provider: PersonalSecAnnualEvidenceProvider,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  const authorized = (request: FastifyRequest) =>
    authorizePersonalJsonRouteRequest(
      request,
      ownerSession,
      listenOptions,
      PERSONAL_SEC_ANNUAL_EVIDENCE_PATH,
    );
  app.post<{ Body: unknown }>(
    PERSONAL_SEC_ANNUAL_EVIDENCE_PATH,
    {
      onRequest: async (request, reply) => {
        if (!authorized(request)) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
      },
      errorHandler: (_error, request, reply) => {
        void sendProblem(reply, request, 400, "invalid_request");
      },
    },
    async (request, reply) => {
      const body = parseManagedSecAnnualCanonicalRequest(request.body);
      if (body === null) {
        return sendProblem(reply, request, 400, "invalid_request");
      }
      if (body.catalogSnapshotSha256 !== catalog.snapshotSha256) {
        return sendProblem(reply, request, 409, "conflict");
      }
      const listing = searchPersonalSecurityMaster(catalog, {
        query: body.symbol,
        limit: PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap,
      }).results.find(
        (candidate) =>
          candidate.listingId === body.listingId &&
          candidate.symbol === body.symbol,
      );
      if (listing === undefined) {
        return sendProblem(reply, request, 404, "not_covered");
      }
      const controller = new AbortController();
      const abort = () => controller.abort();
      request.raw.once("aborted", abort);
      reply.raw.once("close", abort);
      try {
        const evidence = await provider.loadEvidence(
          listing.cik,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        // A session revoked during a source read must not receive its result.
        if (!authorized(request)) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
        const prepared = encodePersonalSecAnnualCanonicalResponse(
          body,
          catalog.snapshotSha256,
          listing,
          evidence,
        );
        if (controller.signal.aborted) return;
        if (!authorized(request)) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
        return reply
          .type("application/json; charset=utf-8")
          .send(prepared.body);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (!authorized(request)) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
        if (error instanceof PersonalSecAnnualEvidenceProviderError) {
          if (error.code === "aborted" && controller.signal.aborted) return;
          if (error.code === "not_configured") {
            return sendProblem(reply, request, 503, "not_configured");
          }
          if (error.code === "busy") {
            return sendProblem(reply, request, 429, "rate_limited");
          }
          if (error.code === "invalid_request") {
            return sendProblem(reply, request, 400, "invalid_request");
          }
        }
        return sendProblem(reply, request, 502, "provider_unavailable");
      } finally {
        request.raw.off("aborted", abort);
        reply.raw.off("close", abort);
      }
    },
  );
}

function sendProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: 400 | 404 | 409 | 429 | 502 | 503,
  code: string,
) {
  const problem: ProblemDetailsDto & { readonly code: string } = {
    type: `https://research-cockpit.local/problems/${String(status)}`,
    title: "SEC annual evidence unavailable",
    status,
    detail: "The selected-company SEC evidence request was not accepted.",
    instance: PERSONAL_SEC_ANNUAL_EVIDENCE_PATH,
    traceId: request.id,
    code,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
