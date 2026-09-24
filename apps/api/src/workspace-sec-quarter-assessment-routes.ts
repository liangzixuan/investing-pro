import { createHash } from "node:crypto";

import {
  PERSONAL_SEC_QUARTER_ASSESSMENT_LIMITS,
  assertPersonalSecJsonUniqueKeys,
  isPersonalSecQuarterAssessmentRequest,
  isPersonalSecQuarterAssessmentResponse,
  personalSecQuarterBundlePayload,
  type PersonalSecQuarterAssessmentResponseDto,
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
  PersonalSecQuarterAssessmentProviderError,
  type PersonalSecQuarterAssessmentProvider,
} from "./personal-sec-quarter-assessment-provider";
import {
  PersonalSecQuarterOperation,
  PersonalSecQuarterOperationError,
} from "./personal-sec-quarter-operation";

export const PERSONAL_SEC_QUARTER_ASSESSMENT_PATH =
  "/v1/personal-filing/workspace/sec-quarter-assessment" as const;

export async function registerPersonalWorkspaceSecQuarterAssessmentRoutes(
  app: FastifyInstance,
  catalog: PersonalSecurityMasterCatalog,
  provider: PersonalSecQuarterAssessmentProvider,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): Promise<void> {
  // Encapsulation preserves every existing route's parser and error behavior.
  await app.register((scope) => {
    const defaultJsonParser = scope.getDefaultJsonParser("error", "error");
    scope.removeContentTypeParser("application/json");
    scope.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (request, body, done) => {
        try {
          if (!Buffer.isBuffer(body)) throw new Error("Invalid body type.");
          const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
          assertPersonalSecJsonUniqueKeys(text);
          void defaultJsonParser(request, text, done);
        } catch {
          done(new Error("Invalid SEC quarter request JSON."));
        }
      },
    );
    const authorized = (request: FastifyRequest): boolean =>
      authorizePersonalJsonRouteRequest(
        request,
        ownerSession,
        listenOptions,
        PERSONAL_SEC_QUARTER_ASSESSMENT_PATH,
      );
    scope.post<{ Body: unknown }>(
      PERSONAL_SEC_QUARTER_ASSESSMENT_PATH,
      {
        onRequest: async (request, reply) => {
          if (!authorized(request))
            return sendPersonalOwnerSessionProblem(reply, request);
        },
        errorHandler: (_error, request, reply) => {
          void sendProblem(reply, request, 400, "invalid_request");
        },
      },
      async (request, reply) => {
        if (!isPersonalSecQuarterAssessmentRequest(request.body))
          return sendProblem(reply, request, 400, "invalid_request");
        const body = request.body;
        if (body.catalogSnapshotSha256 !== catalog.snapshotSha256)
          return sendProblem(reply, request, 409, "conflict");
        const listing = searchPersonalSecurityMaster(catalog, {
          query: body.symbol,
          limit: PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap,
        }).results.find(
          (candidate) =>
            candidate.listingId === body.listingId &&
            candidate.symbol === body.symbol,
        );
        if (listing === undefined)
          return sendProblem(reply, request, 404, "not_covered");
        const target = {
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
        };
        const controller = new AbortController();
        const abort = (): void => controller.abort();
        request.raw.once("aborted", abort);
        reply.raw.once("close", abort);
        const operation = new PersonalSecQuarterOperation(controller.signal);
        try {
          const assessment = await provider.assess(
            target,
            body.selection,
            operation.signal,
          );
          if (controller.signal.aborted) return;
          operation.check();
          if (!authorized(request))
            return sendPersonalOwnerSessionProblem(reply, request);
          const response: PersonalSecQuarterAssessmentResponseDto = {
            schemaVersion: "1.0.0",
            ...target,
            assessment,
          };
          if (!isPersonalSecQuarterAssessmentResponse(response, body))
            return sendProblem(reply, request, 502, "provider_unavailable");
          if (assessment.stage === "assessment") {
            const digest = `sha256:${createHash("sha256")
              .update(
                personalSecQuarterBundlePayload(
                  target,
                  body.selection,
                  assessment.sources,
                ),
              )
              .digest("hex")}`;
            if (digest !== assessment.bundleId)
              return sendProblem(reply, request, 502, "provider_unavailable");
          }
          operation.check();
          const serialized = JSON.stringify(response);
          operation.check();
          if (
            Buffer.byteLength(serialized, "utf8") >
            PERSONAL_SEC_QUARTER_ASSESSMENT_LIMITS.finalResponseBytes
          ) {
            return reply.type("application/json; charset=utf-8").send(
              JSON.stringify({
                schemaVersion: "1.0.0",
                ...target,
                assessment: {
                  status: "unavailable",
                  cik: listing.cik,
                  selection: body.selection,
                  stage: "assembly",
                  reason: "output_too_large",
                  sources: assessment.sources,
                },
              } satisfies PersonalSecQuarterAssessmentResponseDto),
            );
          }
          if (!authorized(request))
            return sendPersonalOwnerSessionProblem(reply, request);
          return reply.type("application/json; charset=utf-8").send(serialized);
        } catch (error) {
          if (controller.signal.aborted) return;
          if (!authorized(request))
            return sendPersonalOwnerSessionProblem(reply, request);
          let failure = error;
          try {
            operation.check();
          } catch (deadlineError) {
            failure = deadlineError;
          }
          if (
            failure instanceof PersonalSecQuarterOperationError &&
            failure.code === "operation_deadline"
          ) {
            return reply.type("application/json; charset=utf-8").send(
              JSON.stringify({
                schemaVersion: "1.0.0",
                ...target,
                assessment: {
                  status: "unavailable",
                  cik: listing.cik,
                  selection: body.selection,
                  stage: "assembly",
                  reason: "operation_deadline",
                  sources: [],
                },
              } satisfies PersonalSecQuarterAssessmentResponseDto),
            );
          }
          if (error instanceof PersonalSecQuarterAssessmentProviderError) {
            if (error.code === "not_configured")
              return sendProblem(reply, request, 503, "not_configured");
            if (error.code === "busy")
              return sendProblem(reply, request, 429, "rate_limited");
            if (error.code === "invalid_request")
              return sendProblem(reply, request, 400, "invalid_request");
          }
          return sendProblem(reply, request, 502, "provider_unavailable");
        } finally {
          operation.dispose();
          request.raw.off("aborted", abort);
          reply.raw.off("close", abort);
        }
      },
    );
    return Promise.resolve();
  });
}

function sendProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: 400 | 404 | 409 | 429 | 502 | 503,
  code: string,
) {
  const problem: ProblemDetailsDto & { readonly code: string } = {
    type: `https://research-cockpit.local/problems/${String(status)}`,
    title: "SEC quarter assessment unavailable",
    status,
    detail: "The selected quarter assessment request was not accepted.",
    instance: PERSONAL_SEC_QUARTER_ASSESSMENT_PATH,
    traceId: request.id,
    code,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
