import { randomUUID } from "node:crypto";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { ProblemDetailsDto } from "@research-cockpit/contracts";
import {
  LOCAL_RESEARCH_VAULT_PROFILE,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
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
  createTiingoPersonalMarketDataProvider,
  type PersonalMarketDataProvider,
} from "./personal-market-data-provider";
import {
  personalBrowserOrigin,
  PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME,
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
  registerPersonalOwnerSessionRoutes,
} from "./personal-owner-session-routes";
import {
  PERSONAL_SECURITY_MASTER_STATUS_PATH,
  registerPersonalSecurityMasterRoutes,
} from "./personal-security-master-routes";
import { registerPersonalWorkspaceMarketDataRoutes } from "./workspace-market-data-routes";
import { registerPersonalWorkspaceScreenerRoutes } from "./workspace-screener-routes";
import { registerPersonalWorkspaceFinancialScreenRoutes } from "./workspace-financial-screen-routes";
import {
  createSecPersonalFinancialProvider,
  type PersonalSecFinancialProvider,
} from "./personal-sec-financial-provider";
import { registerPersonalWorkspaceWatchlistRoutes } from "./workspace-watchlist-routes";
import { registerPersonalWorkspacePortfolioRoutes } from "./workspace-portfolio-routes";
import { registerPersonalWorkspaceWatchlistFilingsRoutes } from "./workspace-watchlist-filings-routes";
import {
  createSecPersonalFilingsProvider,
  type PersonalSecFilingsProvider,
} from "./personal-sec-filings-provider";
import {
  createSecPersonalQuarterlyEvidenceProvider,
  type PersonalSecQuarterlyEvidenceProvider,
} from "./personal-sec-quarterly-evidence-provider";
import { registerPersonalWorkspaceSecQuarterlyEvidenceRoutes } from "./workspace-sec-quarterly-evidence-routes";

const PERSONAL_WORKSPACE_BODY_LIMIT_BYTES = 300 * 1_024;
const DEFAULT_LISTEN_OPTIONS: DemoApiListenOptions = Object.freeze({
  host: DEFAULT_DEMO_API_HOST,
  port: DEFAULT_DEMO_API_PORT,
});

export async function buildPersonalWorkspaceApp(
  catalog: PersonalSecurityMasterCatalog,
  vault: LocalResearchVault,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions = DEFAULT_LISTEN_OPTIONS,
  marketDataProvider: PersonalMarketDataProvider = createTiingoPersonalMarketDataProvider(),
  financialProvider: PersonalSecFinancialProvider = createSecPersonalFinancialProvider(),
  filingsProvider: PersonalSecFilingsProvider = createSecPersonalFilingsProvider(),
  quarterlyEvidenceProvider: PersonalSecQuarterlyEvidenceProvider = createSecPersonalQuarterlyEvidenceProvider(),
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
  if (vault.profile !== LOCAL_RESEARCH_VAULT_PROFILE) {
    throw new TypeError("Personal research vault is unavailable.");
  }
  if (!isPersonalOwnerSessionAuthority(ownerSession)) {
    throw new TypeError("Personal owner session is unavailable.");
  }

  const app = Fastify({
    bodyLimit: PERSONAL_WORKSPACE_BODY_LIMIT_BYTES,
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
      try {
        marketDataProvider.close();
      } finally {
        try {
          financialProvider.close();
        } finally {
          try {
            filingsProvider.close();
          } finally {
            try {
              quarterlyEvidenceProvider.close();
            } finally {
              ownerSession.close();
              done();
            }
          }
        }
      }
    }
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
  registerPersonalWorkspaceWatchlistRoutes(
    app,
    catalog,
    vault,
    ownerSession,
    listenOptions,
  );
  registerPersonalWorkspacePortfolioRoutes(
    app,
    catalog,
    vault,
    ownerSession,
    listenOptions,
  );
  registerPersonalWorkspaceScreenerRoutes(
    app,
    catalog,
    vault,
    ownerSession,
    listenOptions,
  );
  registerPersonalWorkspaceMarketDataRoutes(
    app,
    catalog,
    marketDataProvider,
    ownerSession,
    listenOptions,
  );
  registerPersonalWorkspaceFinancialScreenRoutes(
    app,
    catalog,
    vault,
    financialProvider,
    ownerSession,
    listenOptions,
  );
  registerPersonalWorkspaceWatchlistFilingsRoutes(
    app,
    catalog,
    vault,
    filingsProvider,
    ownerSession,
    listenOptions,
  );
  registerPersonalWorkspaceSecQuarterlyEvidenceRoutes(
    app,
    catalog,
    quarterlyEvidenceProvider,
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
    detail: "The personal workspace request was not accepted.",
    instance:
      request.url.split("?", 1)[0] ?? PERSONAL_SECURITY_MASTER_STATUS_PATH,
    traceId: request.id,
  };
  return reply.status(status).type("application/problem+json").send(problem);
}
