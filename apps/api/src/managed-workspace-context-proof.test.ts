import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createManagedContextProofFunction,
  isManagedContextProofRequest,
  MANAGED_CONTEXT_PROOF_INPUTS,
  MANAGED_CONTEXT_PROOF_MAX_BYTES,
  type ManagedContextProofContext,
} from "./managed-workspace-context-proof";

const BUILD = "a".repeat(64);
const FIXED_CASES = [
  "malformed_utf8",
  "truncated_utf8",
  "resolve_exact_cap",
  "resolve_over_cap",
  "watchlist_exact_cap",
  "watchlist_over_cap",
  "get_nonempty",
  "options_nonempty",
  "query_tab",
  "query_newline",
  "query_space",
  "query_fragment",
  "leading_query_marker",
  "duplicate_query",
  "encoded_parameter_name",
  "malformed_escape",
  "truncated_escape",
  "decode_once",
  "resolve_failure_read_only",
];
const storage = vi.hoisted(() =>
  vi.fn<(context: unknown) => string>(() => "storage-profile-result"),
);
vi.mock("./clerk-trial-storage-proof", () => ({
  createClerkTrialStorageProofFunction: vi.fn(() => storage),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function context(
  index: 0 | 1 = 0,
  overrides: Partial<ManagedContextProofContext["req"]> = {},
) {
  const input = MANAGED_CONTEXT_PROOF_INPUTS[index];
  return {
    req: {
      method: input.method,
      path: input.path,
      queryString: input.queryString,
      bodyBinary: Buffer.from(input.bodyText),
      ...overrides,
      get headers(): never {
        throw new Error("Must not inspect authority");
      },
      get bodyText(): never {
        throw new Error("Must not use decoded body text");
      },
      get bodyJson(): never {
        throw new Error("Must not use decoded body JSON");
      },
    },
    res: {
      json: vi.fn(
        (body: unknown, status: number, headers: Record<string, string>) => ({
          body,
          status,
          headers,
        }),
      ),
      text: vi.fn(),
      empty: vi.fn(),
    },
  };
}

describe("private managed runtime context proof", () => {
  it.each([0, 1] as const)(
    "separates actual input %s from every fixed synthetic runtime check",
    async (index) => {
      const fetch = vi.fn(() => {
        throw new Error("Unexpected outbound dispatch");
      });
      vi.stubGlobal("fetch", fetch);
      const input = MANAGED_CONTEXT_PROOF_INPUTS[index];
      const bytes = Buffer.from(input.bodyText);
      expect(bytes.byteLength).toBe(input.bodyBytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        input.bodySha256,
      );
      const runtime = context(index);
      await createManagedContextProofFunction(BUILD)(runtime);
      const [value, status, headers] = runtime.res.json.mock.calls[0]!;
      expect(status).toBe(200);
      expect(headers).toEqual({ "cache-control": "no-store" });
      expect(value).toMatchObject({
        version: 1,
        buildProof: BUILD,
        outcome: "passed",
        nodeVersion: process.version,
        actualContext: {
          id: input.id,
          passed: true,
          bodyIsBuffer: true,
          bodyMatches: true,
          bodyBytes: input.bodyBytes,
          bodySha256: input.bodySha256,
          queryMatches: true,
          queryPreserved: true,
          bytesPreserved: true,
          status: input.responseStatus,
          code: input.responseCode,
          repositoryOpens: 0,
        },
        syntheticInRuntime: {
          ownedBuffer: true,
          checks: FIXED_CASES.map((id) => ({
            id,
            passed: true,
            repositoryOpens: 0,
          })),
        },
        repositoryOpens: 0,
        outboundDispatches: 0,
      });
      const report = value as {
        syntheticInRuntime: {
          checks: {
            id: string;
            bridged: boolean;
            status: number;
            code: string | null;
          }[];
        };
      };
      expect(report.syntheticInRuntime.checks).toHaveLength(19);
      expect(
        report.syntheticInRuntime.checks.filter((item) =>
          item.id.includes("_exact_cap"),
        ),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "resolve_exact_cap",
            bridged: true,
            status: 400,
          }),
          expect.objectContaining({
            id: "watchlist_exact_cap",
            bridged: true,
            status: 400,
          }),
        ]),
      );
      expect(report.syntheticInRuntime.checks.at(-1)).toMatchObject({
        status: 503,
        code: "unavailable",
      });
      expect(Buffer.byteLength(JSON.stringify(value))).toBeLessThanOrEqual(
        MANAGED_CONTEXT_PROOF_MAX_BYTES,
      );
      expect(fetch).not.toHaveBeenCalled();
      expect(storage).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: "non-Buffer bytes", bodyBinary: new Uint8Array() },
    { name: "missing binary", bodyBinary: undefined },
    { name: "decoded string", bodyBinary: "" },
    { name: "changed body", bodyBinary: Buffer.from("private untrusted text") },
    { name: "oversized actual body", bodyBinary: Buffer.alloc(8193, 120) },
  ])(
    "fails $name without running synthetic checks or echoing content",
    async ({ bodyBinary }) => {
      const runtime = context(0, { bodyBinary });
      await createManagedContextProofFunction(BUILD)(runtime);
      const [body, status] = runtime.res.json.mock.calls[0]!;
      expect(status).toBe(409);
      expect(body).toMatchObject({
        outcome: "failed",
        actualContext: { passed: false },
        syntheticInRuntime: { checks: [], ownedBuffer: false },
        repositoryOpens: 0,
        outboundDispatches: 0,
      });
      expect(JSON.stringify(body)).not.toContain("private untrusted text");
      expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThanOrEqual(8192);
    },
  );

  it.each([undefined, "?q=Invented%2BName+%2525%3F", "q=Invented+Name+%25%3F"])(
    "rejects an absent or transformed actual query %s",
    async (queryString: string | undefined) => {
      const runtime = context();
      if (queryString === undefined)
        Reflect.deleteProperty(runtime.req, "queryString");
      else runtime.req.queryString = queryString;
      await createManagedContextProofFunction(BUILD)(runtime);
      expect(runtime.res.json.mock.calls[0]?.[0]).toMatchObject({
        outcome: "failed",
        actualContext: { queryMatches: false },
        syntheticInRuntime: { checks: [], ownedBuffer: false },
      });
      expect(runtime.res.json.mock.calls[0]?.[1]).toBe(409);
    },
  );

  it.each([
    { method: "GET", path: "/unselected" },
    { method: "POST", path: MANAGED_CONTEXT_PROOF_INPUTS[0].path },
  ])(
    "admits only the fixed method/path pair $method $path",
    async (overrides) => {
      const runtime = context(0, overrides);
      expect(isManagedContextProofRequest(runtime.req)).toBe(false);
      await createManagedContextProofFunction(BUILD)(runtime);
      expect(runtime.res.json).toHaveBeenCalledWith(
        { error: "invalid_context_proof_request" },
        400,
        { "cache-control": "no-store" },
      );
    },
  );

  it("fails closed on unreadable runtime shape without leaking exception text", async () => {
    const runtime = context();
    Object.defineProperty(runtime.req, "bodyBinary", {
      get() {
        throw new Error("private exception text");
      },
    });
    await createManagedContextProofFunction(BUILD)(runtime);
    expect(runtime.res.json).toHaveBeenCalledWith(
      { error: "context_proof_failed", buildProof: BUILD },
      409,
      { "cache-control": "no-store" },
    );
  });

  it("bounds the caller-supplied build marker", () => {
    expect(() =>
      createManagedContextProofFunction("private malformed marker"),
    ).toThrow("Invalid context proof build");
  });

  it.each(["development", "production", "managed"] as const)(
    "routes context only for the managed profile, preserving %s storage dispatch",
    async (profile) => {
      vi.resetModules();
      vi.stubGlobal("__CLERK_TRIAL_PROOF_PROFILE__", profile);
      vi.stubGlobal("__CLERK_TRIAL_PROOF_BUILD__", BUILD);
      const main = (await import("./clerk-trial-proof-entry")).default;
      const runtime = context();
      const result = await main(runtime);
      if (profile === "managed") {
        expect(runtime.res.json.mock.calls[0]?.[1]).toBe(200);
        expect(storage).not.toHaveBeenCalled();
      } else {
        expect(result).toBe("storage-profile-result");
        expect(storage.mock.calls[0]?.[0]).toBe(runtime);
      }
      const storageRequest = context(0, {
        method: "POST",
        path: "/proof/reopen",
      });
      expect(await main(storageRequest)).toBe("storage-profile-result");
      expect(storage.mock.calls.at(-1)?.[0]).toBe(storageRequest);
    },
  );
});
