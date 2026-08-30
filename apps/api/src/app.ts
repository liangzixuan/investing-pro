import { createHash } from "node:crypto";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { ProblemDetailsDto } from "@research-cockpit/contracts";
import {
  buildDossier,
  DEFAULT_KNOWN_AT,
  getEvidencePassport,
} from "@research-cockpit/research-core";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import { createDemoResearchStateComposition } from "./demo-research-state";
import {
  DEFAULT_DEMO_API_HOST,
  DEFAULT_DEMO_API_PORT,
  type DemoApiListenOptions,
} from "./listen-options";
import {
  isPersonalQualityReadinessCapability,
  type PersonalQualityReadinessCapability,
} from "./personal-quality-readiness";
import { registerPersonalReadinessRoute } from "./personal-readiness-routes";
import {
  isPersonalSelectedFactReleaseCapability,
  type PersonalSelectedFactReleaseCapability,
} from "./personal-selected-fact-release";
import { registerPersonalSelectedFactRoute } from "./personal-selected-fact-routes";
import { registerResearchStateRoutes } from "./research-state-routes";

const DEMO_API_BODY_LIMIT_BYTES = 384 * 1024;
const DEFAULT_LISTEN_OPTIONS: DemoApiListenOptions = Object.freeze({
  host: DEFAULT_DEMO_API_HOST,
  port: DEFAULT_DEMO_API_PORT,
});

interface DossierParams {
  symbol: string;
}

interface DossierQuery {
  knownAt?: string;
}

interface EvidenceParams {
  evidenceId: string;
}

export async function buildApp(
  listenOptions: DemoApiListenOptions = DEFAULT_LISTEN_OPTIONS,
): Promise<FastifyInstance> {
  return buildComposedApp(undefined, undefined, listenOptions);
}

export async function buildPersonalReadinessApp(
  readiness: PersonalQualityReadinessCapability,
  listenOptions: DemoApiListenOptions = DEFAULT_LISTEN_OPTIONS,
): Promise<FastifyInstance> {
  if (!isPersonalQualityReadinessCapability(readiness)) {
    throw new TypeError("Personal filing readiness is unavailable.");
  }
  return buildComposedApp(readiness, undefined, listenOptions);
}

export async function buildPersonalFactReleaseApp(
  factRelease: PersonalSelectedFactReleaseCapability,
  listenOptions: DemoApiListenOptions = DEFAULT_LISTEN_OPTIONS,
): Promise<FastifyInstance> {
  if (!isPersonalSelectedFactReleaseCapability(factRelease)) {
    throw new TypeError("Personal selected-fact release is unavailable.");
  }
  return buildComposedApp(undefined, factRelease, listenOptions);
}

async function buildComposedApp(
  readiness?: PersonalQualityReadinessCapability,
  factRelease?: PersonalSelectedFactReleaseCapability,
  listenOptions: DemoApiListenOptions = DEFAULT_LISTEN_OPTIONS,
): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: DEMO_API_BODY_LIMIT_BYTES,
    logger: false,
    trustProxy: false,
    genReqId: () => cryptoTraceId(),
  });
  const researchState = createDemoResearchStateComposition();

  await app.register(cors, {
    origin: [
      "http://[::1]:3000",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
    methods: ["GET"],
    allowedHeaders: ["Accept", "Content-Type", "X-Trace-Id"],
    exposedHeaders: ["ETag", "X-Data-As-Of", "X-Trace-Id"],
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  });

  app.addHook("onSend", async (request, reply, payload) => {
    void reply.header("X-Trace-Id", request.id);
    if (!reply.hasHeader("Cache-Control")) {
      void reply.header("Cache-Control", "no-store");
    }
    return payload;
  });

  app.get("/health/live", () => ({ status: "alive" }));
  app.get("/health/ready", () => ({
    status: "ready",
    fixture: "synthetic/v1",
  }));

  app.get<{ Params: DossierParams; Querystring: DossierQuery }>(
    "/v1/instruments/:symbol/dossier",
    async (request, reply) => {
      const knownAt = request.query.knownAt ?? DEFAULT_KNOWN_AT;
      try {
        const dossier = buildDossier(request.params.symbol, knownAt);
        if (!dossier) {
          return sendProblem(
            reply,
            request,
            404,
            "Synthetic instrument not found",
            "Only SYN1 exists in demo mode.",
          );
        }

        const serialized = JSON.stringify(dossier);
        void reply.header("X-Data-As-Of", dossier.requestedKnownAt);
        void reply.header(
          "ETag",
          `W/"${createHash("sha256").update(serialized).digest("hex")}"`,
        );
        return reply.type("application/json; charset=utf-8").send(serialized);
      } catch (error) {
        if (error instanceof RangeError) {
          return sendProblem(
            reply,
            request,
            400,
            "Invalid knownAt",
            error.message,
          );
        }
        throw error;
      }
    },
  );

  app.get<{ Params: EvidenceParams }>(
    "/v1/evidence/:evidenceId",
    async (request, reply) => {
      const evidence = getEvidencePassport(request.params.evidenceId);
      if (!evidence) {
        return sendProblem(
          reply,
          request,
          404,
          "Evidence not available",
          "The evidence identifier is unknown or its rights policy does not allow display.",
        );
      }
      return evidence;
    },
  );

  await registerResearchStateRoutes(app, researchState);
  await registerPersonalReadinessRoute(app, readiness, listenOptions);
  await registerPersonalSelectedFactRoute(app, factRelease, listenOptions);

  app.setNotFoundHandler((request, reply) =>
    sendProblem(
      reply,
      request,
      404,
      "Route not found",
      "No demo API route matches this request.",
    ),
  );

  app.setErrorHandler((error, request, reply) => {
    void error;
    return sendProblem(
      reply,
      request,
      500,
      "Internal server error",
      "An unexpected error occurred.",
    );
  });

  return app;
}

function sendProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: number,
  title: string,
  detail: string,
) {
  const problem: ProblemDetailsDto = {
    type: `https://research-cockpit.local/problems/${status}`,
    title,
    status,
    detail,
    instance: request.url.split("?", 1)[0] ?? "/",
    traceId: request.id,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}

function cryptoTraceId(): string {
  return `trace-${globalThis.crypto.randomUUID()}`;
}
