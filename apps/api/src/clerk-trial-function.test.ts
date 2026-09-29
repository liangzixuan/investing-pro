import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createClerkTrialFunction,
  type ClerkTrialFunctionContext,
} from "./clerk-trial-function";

const key = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .publicKey.export({ type: "spki", format: "pem" })
  .toString();
const origin = "https://trial.example.invalid";
const run = createClerkTrialFunction({
  auth: {
    issuer: "https://trial.clerk.accounts.dev",
    jwtKey: key,
    allowedSubject: null,
    authorizedParties: [origin],
  },
  allowedOrigins: [origin],
});
function context(
  overrides: Partial<ClerkTrialFunctionContext["req"]> = {},
): ClerkTrialFunctionContext {
  return {
    req: {
      method: "GET",
      path: "/v1/trial/session",
      bodyText: "",
      headers: { origin },
      ...overrides,
    },
    res: {
      json: (body, status, headers) => ({ body, status, headers }),
      text: (body, status, headers) => ({ body, status, headers }),
      empty: () => ({ status: 204 }),
    },
  };
}
describe("Appwrite Clerk trial adapter", () => {
  it("does not trust platform user or execution-key headers as account authority", async () => {
    const result = await run(
      context({
        headers: {
          origin,
          "x-appwrite-user-id": "owner",
          "x-appwrite-key": "synthetic-service-key",
        },
      }),
    );
    expect(result).toMatchObject({
      status: 401,
      body: { error: "unauthenticated" },
    });
    expect(JSON.stringify(result)).not.toContain("synthetic-service-key");
  });
  it("returns exact preflight headers without a JSON body", async () => {
    expect(
      await run(
        context({
          method: "OPTIONS",
          headers: {
            origin,
            "access-control-request-method": "GET",
            "access-control-request-headers": "Authorization",
          },
        }),
      ),
    ).toMatchObject({
      status: 204,
      body: "",
      headers: { "access-control-allow-origin": origin },
    });
  });
  it.each([
    "//elsewhere.invalid",
    "v1/trial/session",
    "/v1/trial/session?unexpected=1",
  ])("rejects altered request paths %s", async (path) => {
    expect(await run(context({ path }))).toMatchObject({ status: 404 });
  });
  it("rejects platform queryString before authentication", async () => {
    expect(await run(context({ queryString: "unexpected=1" }))).toMatchObject({
      status: 404,
    });
  });
  it("bounds buffered platform bodies", async () => {
    expect(
      await run(
        context({
          method: "POST",
          path: "/v1/trial/watchlist",
          bodyText: "x".repeat(8193),
        }),
      ),
    ).toMatchObject({ status: 413 });
  });
  it("rejects an unapproved browser origin without a CORS grant", async () => {
    const result = await run(
      context({ headers: { origin: "https://unrelated.invalid" } }),
    );
    expect(result).toMatchObject({ status: 403 });
    expect(JSON.stringify(result)).not.toContain("access-control-allow-origin");
  });
});
