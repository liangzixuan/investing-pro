import { randomUUID } from "node:crypto";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { ProblemDetailsDto } from "@research-cockpit/contracts";
import {
  LOCAL_RESEARCH_VAULT_PROFILE,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import {
  DEFAULT_DEMO_API_HOST,
  DEFAULT_DEMO_API_PORT,
  type DemoApiListenOptions,
} from "./listen-options";
import {
  isPersonalOwnerSessionAuthority,
  type PersonalOwnerSessionAuthority,
} from "./personal-owner-session";
import {
  personalBrowserOrigin,
  PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME,
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
  registerPersonalOwnerSessionRoutes,
} from "./personal-owner-session-routes";
import {
  PERSONAL_VAULT_STATUS_PATH,
  registerPersonalVaultRoutes,
} from "./personal-vault-routes";

const VAULT_API_BODY_LIMIT_BYTES = 300 * 1_024;
const DEFAULT_LISTEN_OPTIONS: DemoApiListenOptions = Object.freeze({
  host: DEFAULT_DEMO_API_HOST,
  port: DEFAULT_DEMO_API_PORT,
});

export async function buildPersonalVaultApp(
  vault: LocalResearchVault,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions = DEFAULT_LISTEN_OPTIONS,
): Promise<FastifyInstance> {
  if (vault.profile !== LOCAL_RESEARCH_VAULT_PROFILE) {
    throw new TypeError("Personal research vault is unavailable.");
  }
  if (!isPersonalOwnerSessionAuthority(ownerSession)) {
    throw new TypeError("Personal owner session is unavailable.");
  }

  const app = Fastify({
    bodyLimit: VAULT_API_BODY_LIMIT_BYTES,
    logger: false,
    trustProxy: false,
    genReqId: () => `trace-${randomUUID()}`,
  });
  await app.register(cors, {
    origin: [personalBrowserOrigin(listenOptions)],
    methods: ["GET", "POST"],
    allowedHeaders: [
      "Accept",
      "Content-Type",
      "If-Match",
      "If-None-Match",
      "X-Trace-Id",
      PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME,
      PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
      PERSONAL_OWNER_INTENT_HEADER_NAME,
    ],
    credentials: true,
    exposedHeaders: ["ETag", "X-Trace-Id"],
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  });
  app.addHook("onSend", async (request, reply, payload) => {
    void reply
      .header("X-Trace-Id", request.id)
      .header("Cache-Control", "private, no-store")
      .header("Pragma", "no-cache")
      .header("Vary", "Origin");
    return payload;
  });
  app.addHook("onClose", (_instance, done) => {
    try {
      vault.close();
    } finally {
      ownerSession.close();
      done();
    }
  });

  app.get("/health/live", { exposeHeadRoute: false }, () => ({
    status: "alive",
  }));
  app.get("/health/ready", { exposeHeadRoute: false }, () => ({
    status: "ready",
  }));
  await registerPersonalOwnerSessionRoutes(app, ownerSession, listenOptions);
  registerPersonalVaultRoutes(app, vault, ownerSession, listenOptions);

  app.setNotFoundHandler((request, reply) =>
    sendProblem(reply, request, 404, "Route not found"),
  );
  app.setErrorHandler((error, request, reply) => {
    void error;
    return sendProblem(reply, request, 500, "Internal server error");
  });
  return app;
}

function sendProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  status: 404 | 500,
  title: string,
) {
  const problem: ProblemDetailsDto = {
    type: `https://research-cockpit.local/problems/${String(status)}`,
    title,
    status,
    detail: "The personal vault request was not accepted.",
    instance: PERSONAL_VAULT_STATUS_PATH,
    traceId: request.id,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
