import { randomUUID } from "node:crypto";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { ProblemDetailsDto } from "@research-cockpit/contracts";
import {
  PERSONAL_SECURITY_MASTER_PROFILE,
  searchPersonalSecurityMaster,
  type PersonalSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";
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
  PERSONAL_OWNER_INTENT_HEADER_NAME,
  registerPersonalOwnerSessionRoutes,
} from "./personal-owner-session-routes";
import {
  PERSONAL_SECURITY_MASTER_STATUS_PATH,
  registerPersonalSecurityMasterRoutes,
} from "./personal-security-master-routes";

const SECURITY_MASTER_API_BODY_LIMIT_BYTES = 8 * 1_024;
const DEFAULT_LISTEN_OPTIONS: DemoApiListenOptions = Object.freeze({
  host: DEFAULT_DEMO_API_HOST,
  port: DEFAULT_DEMO_API_PORT,
});

export async function buildPersonalSecurityMasterApp(
  catalog: PersonalSecurityMasterCatalog,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions = DEFAULT_LISTEN_OPTIONS,
): Promise<FastifyInstance> {
  if (
    catalog.profile !== PERSONAL_SECURITY_MASTER_PROFILE ||
    !Object.isFrozen(catalog)
  ) {
    throw new TypeError("Personal security master is unavailable.");
  }
  try {
    searchPersonalSecurityMaster(catalog, { limit: 1, query: "A" });
  } catch {
    throw new TypeError("Personal security master is unavailable.");
  }
  if (!isPersonalOwnerSessionAuthority(ownerSession)) {
    throw new TypeError("Personal owner session is unavailable.");
  }

  const app = Fastify({
    bodyLimit: SECURITY_MASTER_API_BODY_LIMIT_BYTES,
    logger: false,
    trustProxy: false,
    genReqId: () => `trace-${randomUUID()}`,
  });
  await app.register(cors, {
    origin: [personalBrowserOrigin(listenOptions)],
    methods: ["GET", "POST"],
    allowedHeaders: [
      "Accept",
      "X-Trace-Id",
      PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME,
      PERSONAL_OWNER_INTENT_HEADER_NAME,
    ],
    credentials: true,
    exposedHeaders: ["X-Trace-Id"],
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
    ownerSession.close();
    done();
  });

  app.get("/health/live", { exposeHeadRoute: false }, () => ({
    status: "alive",
  }));
  app.get("/health/ready", { exposeHeadRoute: false }, () => ({
    status: "ready",
  }));
  await registerPersonalOwnerSessionRoutes(app, ownerSession, listenOptions);
  registerPersonalSecurityMasterRoutes(
    app,
    catalog,
    ownerSession,
    listenOptions,
  );

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
    detail: "The personal security-master request was not accepted.",
    instance: PERSONAL_SECURITY_MASTER_STATUS_PATH,
    traceId: request.id,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
