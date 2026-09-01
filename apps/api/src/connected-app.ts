import { randomUUID } from "node:crypto";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { ProblemDetailsDto } from "@research-cockpit/contracts";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import {
  isConnectedSourcePolicyAdministration,
  type ConnectedSourcePolicyAdministration,
} from "./connected-source-policy-composition";
import { registerConnectedSourcePolicyRoutes } from "./connected-source-policy-routes";
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

const CONNECTED_API_BODY_LIMIT_BYTES = 16 * 1_024;
const CONNECTED_PROBLEM_INSTANCE =
  "/v1/personal-filing/connected-source-policy" as const;
const DEFAULT_LISTEN_OPTIONS: DemoApiListenOptions = Object.freeze({
  host: DEFAULT_DEMO_API_HOST,
  port: DEFAULT_DEMO_API_PORT,
});

export async function buildConnectedSourcePolicyApp(
  administration: ConnectedSourcePolicyAdministration,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions = DEFAULT_LISTEN_OPTIONS,
): Promise<FastifyInstance> {
  if (!isConnectedSourcePolicyAdministration(administration)) {
    throw new TypeError(
      "Connected source policy administration is unavailable.",
    );
  }
  if (!isPersonalOwnerSessionAuthority(ownerSession)) {
    throw new TypeError("Personal owner session is unavailable.");
  }

  const app = Fastify({
    bodyLimit: CONNECTED_API_BODY_LIMIT_BYTES,
    logger: false,
    trustProxy: false,
    genReqId: () => cryptoTraceId(),
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

  app.get("/health/live", () => ({ status: "alive" }));
  app.get("/health/ready", () => ({ status: "ready" }));
  await registerPersonalOwnerSessionRoutes(app, ownerSession, listenOptions);
  await registerConnectedSourcePolicyRoutes(
    app,
    administration,
    ownerSession,
    listenOptions,
  );

  app.setNotFoundHandler((request, reply) =>
    sendProblem(
      reply,
      request,
      404,
      "Route not found",
      "No connected local API route matches this request.",
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
    instance: CONNECTED_PROBLEM_INSTANCE,
    traceId: request.id,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}

function cryptoTraceId(): string {
  return `trace-${randomUUID()}`;
}
