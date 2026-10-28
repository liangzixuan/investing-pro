import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MANAGED_CPI_HEADLINES_PATH,
  parseManagedCpiHeadlines,
} from "@research-cockpit/contracts";
import {
  createManagedWorkspaceFunction,
  type ManagedWorkspaceFunctionContext,
} from "./managed-workspace-function";
import {
  createManagedWorkspaceHandler,
  MANAGED_WORKSPACE_ORIGIN as WEB,
  MANAGED_WORKSPACE_NATIVE_ORIGIN as NATIVE,
  type ManagedWorkspaceHandlerOptions,
} from "./managed-workspace-handler";
import { ManagedCpiHeadlinesServiceError } from "./managed-cpi-headlines-service";
import * as authModule from "./clerk-trial-auth";
import * as storageModule from "./appwrite-transport";
import { cpiAtom, cpiPacket } from "./test-cpi-headlines-fixture";
import { CLERK_TRIAL_PRODUCTION_ISSUER as ISSUER } from "./clerk-trial-config";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const configuration = () => ({
  environment: "production",
  auth: {
    issuer: ISSUER,
    jwtKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
    allowedSubject: "user_inventedCpi",
    authorizedParties: [WEB],
  },
  allowedOrigins: [WEB],
});
function token(origin: string = WEB) {
  const now = Math.floor(Date.now() / 1000),
    payload = {
      iss: ISSUER,
      sub: "user_inventedCpi",
      azp: origin,
      sid: "sess_inventedCpi",
      iat: now,
      nbf: now - 1,
      exp: now + 120,
      v: 2,
      sts: "active",
    };
  const text = [{ alg: "RS256", typ: "JWT", kid: "invented-cpi" }, payload]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".");
  return `${text}.${sign("RSA-SHA256", Buffer.from(text), keys.privateKey).toString("base64url")}`;
}
function context(
  patch: Partial<ManagedWorkspaceFunctionContext["req"]> = {},
): ManagedWorkspaceFunctionContext {
  return {
    req: {
      method: "GET",
      path: MANAGED_CPI_HEADLINES_PATH,
      queryString: "",
      bodyBinary: Buffer.alloc(0),
      headers: { origin: WEB, authorization: `Bearer ${token()}` },
      ...patch,
    },
    res: {
      json: (body, status, headers) => ({ body, status, headers }),
      text: (body, status, headers) => ({
        body: body === "" ? "" : (JSON.parse(body) as unknown),
        status,
        headers,
      }),
    },
  };
}
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("Unexpected network")),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("composed CPI headline function boundary", () => {
  it.each([WEB, NATIVE])(
    "authenticates %s then performs exactly one fixed source read without storage",
    async (origin) => {
      const storage = vi.spyOn(storageModule, "createAppwriteTransport");
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(cpiAtom()));
      vi.stubGlobal("fetch", fetch);
      const run = createManagedWorkspaceFunction(configuration(), null, null);
      expect(fetch).not.toHaveBeenCalled();
      const result = (await run(
        context({
          headers: { origin, authorization: `Bearer ${token(origin)}` },
        }),
      )) as { status: number; body: unknown; headers: Record<string, string> };
      expect(result.status).toBe(200);
      expect(parseManagedCpiHeadlines(result.body)?.items[0]?.title).toBe(
        "Invented café CPI headline 0",
      );
      expect(parseManagedCpiHeadlines(result.body)?.items[0]?.publishedAt).toBe(
        "2026-10-01T07:50:31.2000001-04:00",
      );
      expect(result.headers["cache-control"]).toBe("no-store");
      expect(result.headers["access-control-allow-origin"]).toBe(origin);
      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch.mock.calls[0]![0]).toBe("https://www.bls.gov/feed/cpi.rss");
      expect(storage).not.toHaveBeenCalled();
    },
  );
  it.each([
    [{ method: "POST", bodyBinary: Buffer.from("{}") }, 400, "invalid_request"],
    [{ method: "HEAD" }, 405, "method_not_allowed"],
    [
      { queryString: "url=https%3A%2F%2Fprivate.invalid" },
      400,
      "invalid_request",
    ],
    [{ queryString: "%" }, 400, "invalid_request"],
    [{ bodyBinary: Buffer.from("x") }, 400, "invalid_request"],
    [{ bodyBinary: Buffer.alloc(20_000) }, 413, "payload_too_large"],
    [{ headers: { origin: WEB } }, 401, "unauthenticated"],
    [
      { headers: { origin: "https://untrusted.invalid" } },
      403,
      "origin_denied",
    ],
    [
      { headers: { origin: NATIVE, authorization: `Bearer ${token(WEB)}` } },
      401,
      "unauthenticated",
    ],
  ] as const)(
    "refuses unadmitted requests before source or storage %#",
    async (patch, status, error) => {
      const storage = vi.spyOn(storageModule, "createAppwriteTransport");
      const result = await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )(context(patch));
      expect(result).toMatchObject({ status, body: { error } });
      expect(fetch).not.toHaveBeenCalled();
      expect(storage).not.toHaveBeenCalled();
    },
  );
  it("admits only GET preflight and performs no authentication/provider read", async () => {
    const authenticate = vi.fn<authModule.ClerkTrialAuth>();
    const auth = vi
      .spyOn(authModule, "createClerkTrialAuth")
      .mockReturnValue(authenticate);
    const run = createManagedWorkspaceFunction(configuration(), null, null);
    const result = await run(
      context({
        method: "OPTIONS",
        headers: {
          origin: WEB,
          "access-control-request-method": "GET",
          "access-control-request-headers": "Authorization",
        },
      }),
    );
    expect(result).toMatchObject({
      status: 204,
      headers: { "access-control-allow-methods": "GET" },
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(auth).toHaveBeenCalledTimes(2);
    expect(authenticate).not.toHaveBeenCalled();
  });
  it.each(["malformed", "upstream"] as const)(
    "sanitizes %s source failures",
    async (kind) => {
      const fetch = vi.fn<typeof globalThis.fetch>();
      if (kind === "malformed")
        fetch.mockResolvedValue(new Response("<PRIVATE-SOURCE"));
      else fetch.mockRejectedValue(new Error("PRIVATE-SOURCE"));
      vi.stubGlobal("fetch", fetch);
      const result = await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )(context());
      expect(result).toMatchObject({
        status: 503,
        body: { error: "unavailable" },
      });
      expect(JSON.stringify(result)).not.toContain("PRIVATE-SOURCE");
      expect(fetch).toHaveBeenCalledOnce();
    },
  );
  it("refuses a response whose function lifetime expires during serialization", async () => {
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(cpiAtom())),
    );
    const originalText = Object.getOwnPropertyDescriptor(
      Response.prototype,
      "text",
    )!.value as (this: Response) => Promise<string>;
    vi.spyOn(Response.prototype, "text").mockImplementation(async function (
      this: Response,
    ) {
      const body = await originalText.call(this);
      elapsed = 10_000;
      return body;
    });
    const result = await createManagedWorkspaceFunction(
      configuration(),
      null,
      null,
    )(context());
    expect(result).toMatchObject({
      status: 408,
      body: { error: "request_timeout" },
    });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("spends the function-entry lifetime during uncooperative authentication", async () => {
    vi.useFakeTimers();
    vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(
      () => new Promise(() => undefined),
    );
    const loading = createManagedWorkspaceFunction(
      configuration(),
      null,
      null,
    )(context());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await loading).toMatchObject({
      status: 408,
      body: { error: "request_timeout" },
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
function handler(
  load = vi.fn().mockResolvedValue(cpiPacket()),
  assertActive = vi.fn(),
) {
  const noIO = vi.fn().mockRejectedValue(new Error("Unexpected storage"));
  const options: ManagedWorkspaceHandlerOptions = {
    auth: vi.fn().mockResolvedValue({
      status: "allowed",
      principal: { userId: "invented-cpi" },
    }),
    catalog: { status: noIO, search: noIO, resolve: noIO },
    openRepository: noIO,
    openFollowupsRepository: noIO,
    cpiHeadlines: { load, assertActive },
  };
  return {
    run: createManagedWorkspaceHandler(options),
    load,
    assertActive,
    noIO,
  };
}
const request = () =>
  new Request(`https://api.invalid${MANAGED_CPI_HEADLINES_PATH}`, {
    headers: { origin: WEB },
  });
describe("CPI handler serialization and error ownership", () => {
  it("validates/detaches the packet, checks both serialization fences and never opens storage", async () => {
    const f = handler(),
      response = await f.run(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(cpiPacket());
    expect(f.assertActive).toHaveBeenCalledTimes(2);
    expect(f.noIO).not.toHaveBeenCalled();
  });
  it.each(["request_timeout", "unavailable"] as const)(
    "returns only bounded %s errors",
    async (code) => {
      const f = handler(
          vi.fn().mockRejectedValue(new ManagedCpiHeadlinesServiceError(code)),
        ),
        response = await f.run(request());
      expect(response.status).toBe(code === "request_timeout" ? 408 : 503);
      expect(await response.json()).toEqual({ error: code });
    },
  );
  it("refuses invalid complete responses and a post-serialization expired lifetime", async () => {
    const bad = handler(
      vi.fn().mockResolvedValue({ ...cpiPacket(), private: "PRIVATE-SOURCE" }),
    );
    const response = await bad.run(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
    const late = handler(
      undefined,
      vi
        .fn()
        .mockImplementationOnce(() => undefined)
        .mockImplementationOnce(() => {
          throw new ManagedCpiHeadlinesServiceError("request_timeout");
        }),
    );
    const expired = await late.run(request());
    expect(expired.status).toBe(408);
    expect(await expired.json()).toEqual({ error: "request_timeout" });
  });
});
