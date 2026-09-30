import { TablesDB } from "node-appwrite";

import { createAppwriteTransport } from "./appwrite-transport";
import {
  appwriteWatchlistStore,
  createAppwriteWatchlistRepository,
} from "./appwrite-watchlist-repository";
import {
  createClerkTrialAuth,
  type ClerkTrialAuthOptions,
} from "./clerk-trial-auth";
import { CLERK_TRIAL_CATALOG } from "./clerk-trial-catalog";
import { createClerkTrialHandler } from "./clerk-trial-handler";

export interface ClerkTrialFunctionConfiguration {
  readonly auth: ClerkTrialAuthOptions;
  readonly allowedOrigins: readonly string[];
}
export interface ClerkTrialFunctionContext {
  readonly req: {
    readonly method: string;
    readonly path: string;
    readonly queryString?: string;
    readonly bodyText: string;
    readonly headers: Readonly<Record<string, string | undefined>>;
  };
  readonly res: {
    json(
      body: unknown,
      status: number,
      headers: Record<string, string>,
    ): unknown;
    empty(): unknown;
    text(
      body: string,
      status: number,
      headers: Record<string, string>,
    ): unknown;
  };
}

declare const __CLERK_TRIAL_SERVER_CONFIG__: ClerkTrialFunctionConfiguration;

/** Appwrite supplies the execution key. It never becomes request/user authority. */
export function createClerkTrialFunction(
  config: ClerkTrialFunctionConfiguration,
) {
  const auth = createClerkTrialAuth(config.auth);
  return async ({ req, res }: ClerkTrialFunctionContext) => {
    try {
      if (
        !req.path.startsWith("/") ||
        req.path.startsWith("//") ||
        req.queryString
      ) {
        return res.json({ error: "not_found" }, 404, {
          "cache-control": "no-store",
        });
      }
      if (
        typeof req.bodyText !== "string" ||
        Buffer.byteLength(req.bodyText) > 8192
      ) {
        return res.json({ error: "payload_too_large" }, 413, {
          "cache-control": "no-store",
        });
      }
      const headers = new Headers();
      for (const name of [
        "authorization",
        "origin",
        "cookie",
        "content-type",
        "content-encoding",
        "access-control-request-method",
        "access-control-request-headers",
      ]) {
        const value = req.headers[name];
        if (value !== undefined) headers.set(name, value);
      }
      const request = new Request(
        `https://investment-trial.invalid${req.path}`,
        {
          method: req.method,
          headers,
          ...(req.method === "POST" ? { body: req.bodyText } : {}),
        },
      );
      const handle = createClerkTrialHandler({
        auth,
        allowedOrigins: config.allowedOrigins,
        async openRepository() {
          const executionKey = req.headers["x-appwrite-key"];
          if (!executionKey) throw new Error("Execution authority unavailable");
          const transport = createAppwriteTransport({
            endpoint: "https://nyc.cloud.appwrite.io/v1",
          });
          try {
            transport.client
              .setProject("6abac57a0007b7c1a671")
              .setKey(executionKey);
            return {
              repository: createAppwriteWatchlistRepository({
                store: appwriteWatchlistStore(new TablesDB(transport.client)),
                databaseId: "investment_clerk_trial_v1",
                watchlistsTableId: "watchlists",
                receiptsTableId: "receipts",
                catalog: CLERK_TRIAL_CATALOG,
              }),
              close: () => transport.close(),
            };
          } catch {
            await transport.close();
            throw new Error("Trial storage unavailable");
          }
        },
      });
      const response = await handle(request);
      const outputHeaders = Object.fromEntries(response.headers.entries());
      if (response.status === 204) return res.text("", 204, outputHeaders);
      return res.json(await response.json(), response.status, outputHeaders);
    } catch {
      return res.json(
        { error: req.method === "POST" ? "commit_unknown" : "unavailable" },
        503,
        { "cache-control": "no-store" },
      );
    }
  };
}

export default async function main(context: ClerkTrialFunctionContext) {
  return createClerkTrialFunction(__CLERK_TRIAL_SERVER_CONFIG__)(context);
}
