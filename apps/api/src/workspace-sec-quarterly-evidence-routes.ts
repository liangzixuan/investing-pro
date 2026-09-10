import type {
  PersonalSecQuarterlyEvidenceRequestDto,
  PersonalSecQuarterlyEvidenceResponseDto,
  ProblemDetailsDto,
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
  PersonalSecQuarterlyEvidenceProviderError,
  type PersonalSecQuarterlyEvidenceProvider,
} from "./personal-sec-quarterly-evidence-provider";

export const PERSONAL_SEC_QUARTERLY_EVIDENCE_PATH =
  "/v1/personal-filing/workspace/sec-quarterly-evidence" as const;

export function registerPersonalWorkspaceSecQuarterlyEvidenceRoutes(
  app: FastifyInstance,
  catalog: PersonalSecurityMasterCatalog,
  provider: PersonalSecQuarterlyEvidenceProvider,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  const authorized = (request: FastifyRequest) =>
    authorizePersonalJsonRouteRequest(
      request,
      ownerSession,
      listenOptions,
      PERSONAL_SEC_QUARTERLY_EVIDENCE_PATH,
    );
  app.post<{ Body: unknown }>(
    PERSONAL_SEC_QUARTERLY_EVIDENCE_PATH,
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
      if (!isRequest(request.body)) {
        return sendProblem(reply, request, 400, "invalid_request");
      }
      const body = request.body;
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
        if (
          evidence === null ||
          typeof evidence !== "object" ||
          evidence.cik !== listing.cik
        ) {
          return sendProblem(reply, request, 502, "provider_unavailable");
        }
        const response: PersonalSecQuarterlyEvidenceResponseDto = {
          schemaVersion: "1.0.0",
          catalogSnapshotSha256: catalog.snapshotSha256,
          security: {
            country: listing.country,
            exchangeMic: listing.exchangeMic,
            issuerId: listing.issuerId,
            issuerName: listing.issuerName,
            listingId: listing.listingId,
            securityName: listing.securityName,
            symbol: listing.symbol,
            cik: listing.cik,
          },
          evidence,
        };
        return reply.type("application/json; charset=utf-8").send(response);
      } catch (error) {
        if (error instanceof PersonalSecQuarterlyEvidenceProviderError) {
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

function isRequest(
  value: unknown,
): value is PersonalSecQuarterlyEvidenceRequestDto {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const row = value as Record<string, unknown>;
  return (
    Object.keys(row).sort().join(",") ===
      "catalogSnapshotSha256,listingId,schemaVersion,symbol" &&
    row.schemaVersion === "1.0.0" &&
    typeof row.catalogSnapshotSha256 === "string" &&
    /^sha256:[0-9a-f]{64}$/u.test(row.catalogSnapshotSha256) &&
    typeof row.listingId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(row.listingId) &&
    typeof row.symbol === "string" &&
    /^[A-Z0-9][A-Z0-9.-]{0,31}$/u.test(row.symbol)
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
    title: "SEC quarterly evidence unavailable",
    status,
    detail: "The selected-company SEC evidence request was not accepted.",
    instance: PERSONAL_SEC_QUARTERLY_EVIDENCE_PATH,
    traceId: request.id,
    code,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
