import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  trialFrontendApiOrigin,
  validateTrialConfig,
  type ClerkTrialConfig,
} from "./config";

// These keys are constructed locally; no service or account configuration is read.
const key = (prefix: "test" | "live", host: string) =>
  `pk_${prefix}_${Buffer.from(`${host}$`).toString("base64")}`;
const development: ClerkTrialConfig = {
  environment: "development",
  publishableKey: key("test", "invented-trial-12.clerk.accounts.dev"),
  apiOrigin: "https://investment-clerk-api-6abac57a.appwrite.network",
  frontendApiOrigin: "https://invented-trial-12.clerk.accounts.dev",
};
const production: ClerkTrialConfig = {
  environment: "production",
  publishableKey: key("live", "clerk.investingpro.app"),
  apiOrigin: "https://investment-managed-6abac57a.appwrite.network",
  frontendApiOrigin: "https://clerk.investingpro.app",
};
const failure = "Invalid public Clerk trial configuration.";
beforeEach(() => {
  vi.stubEnv("INVESTMENT_CLIENT_PROFILE", undefined);
  vi.stubEnv("INVESTMENT_BUILD_SHA", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("public Clerk environment configuration", () => {
  it("rejects the previous production trial API instead of falling back", () => {
    expect(() =>
      validateTrialConfig({
        ...production,
        apiOrigin: "https://api.investingpro.app",
      }),
    ).toThrowError(new Error(failure));
  });
  it.each([development, production])(
    "returns a checked copy for $environment",
    (config) => {
      const input = { ...config };
      const checked = validateTrialConfig(input);
      expect(checked).toEqual(config);
      expect(checked).not.toBe(input);
      expect(trialFrontendApiOrigin(config.publishableKey)).toBe(
        config.frontendApiOrigin,
      );
      input.apiOrigin = "https://changed.example.invalid";
      input.frontendApiOrigin = "https://changed.example.invalid";
      input.publishableKey = "invalid";
      expect(checked).toEqual(config);
    },
  );

  it.each([
    undefined,
    null,
    [],
    "development",
    {},
    { ...development, environment: undefined },
    { ...development, environment: "staging" },
    { ...development, environment: "Production" },
    { ...development, environment: null },
    { ...development, secretKey: "synthetic-do-not-retain" },
    { ...development, allowedSubject: "user_synthetic" },
    { ...development, storage: { databaseId: "other" } },
    { ...development, [Symbol("extra")]: true },
    { ...development, apiOrigin: null },
    {
      ...development,
      frontendApiOrigin: { origin: development.frontendApiOrigin },
    },
  ])(
    "rejects incomplete or non-public shape %# with a finite error",
    (input) => {
      expect(() => validateTrialConfig(input)).toThrowError(new Error(failure));
    },
  );

  it.each([
    { ...development, environment: "production" },
    { ...production, environment: "development" },
    { ...development, publishableKey: production.publishableKey },
    { ...production, publishableKey: development.publishableKey },
    { ...development, apiOrigin: production.apiOrigin },
    { ...production, apiOrigin: development.apiOrigin },
    { ...development, frontendApiOrigin: production.frontendApiOrigin },
    { ...production, frontendApiOrigin: development.frontendApiOrigin },
    {
      ...development,
      frontendApiOrigin: "https://different-trial-12.clerk.accounts.dev",
    },
  ])("rejects mixed environment, key, host or API %#", (input) => {
    expect(() => validateTrialConfig(input)).toThrowError(new Error(failure));
  });

  it.each([
    undefined,
    null,
    12,
    {},
    "",
    "pk_test_synthetic",
    "pk_live_%%%",
    "sk_test_synthetic-do-not-retain",
    `pk_test_${"a".repeat(513)}`,
    key("test", "clerk.investingpro.app"),
    key("live", "invented-trial-12.clerk.accounts.dev"),
    key("live", "clerk.other.example.invalid"),
    key("test", "nested.invented.clerk.accounts.dev"),
    key("test", "-invalid.clerk.accounts.dev"),
    key("test", `${"a".repeat(64)}.clerk.accounts.dev`),
    key("test", "invented.clerk.accounts.dev:443"),
    key("test", "user@invented.clerk.accounts.dev"),
    key("test", "invented.clerk.accounts.dev/path"),
    key("test", "invented.clerk.accounts.dev?query"),
  ])("rejects malformed or out-of-profile public key %#", (publishableKey) => {
    expect(() => trialFrontendApiOrigin(publishableKey)).toThrowError(
      new Error(failure),
    );
    expect(() =>
      validateTrialConfig({ ...development, publishableKey }),
    ).toThrowError(new Error(failure));
  });

  it.each([
    "http://investment-managed-6abac57a.appwrite.network",
    "https://investment-managed-6abac57a.appwrite.network/",
    "https://investment-managed-6abac57a.appwrite.network:443",
    "https://INVESTMENT-MANAGED-6ABAC57A.appwrite.network",
    "https://user:secret@investment-managed-6abac57a.appwrite.network",
    "https://investment-managed-6abac57a.appwrite.network?query",
    "https://investment-managed-6abac57a.appwrite.network#fragment",
    "https://localhost",
  ])("requires the exact API origin: %s", (apiOrigin) => {
    expect(() =>
      validateTrialConfig({ ...production, apiOrigin }),
    ).toThrowError(new Error(failure));
  });

  it.each([
    "http://clerk.investingpro.app",
    "https://clerk.investingpro.app/",
    "https://clerk.investingpro.app:443",
    "https://CLERK.investingpro.app",
    "https://user:secret@clerk.investingpro.app",
    "https://clerk.investingpro.app?query",
    "https://clerk.investingpro.app#fragment",
  ])(
    "requires the exact decoded Frontend API origin: %s",
    (frontendApiOrigin) => {
      expect(() =>
        validateTrialConfig({ ...production, frontendApiOrigin }),
      ).toThrowError(new Error(failure));
    },
  );
});

describe("Vite public profile composition", () => {
  it.each([development, production])(
    "selects only $environment public configuration and its output directory",
    async (config) => {
      vi.stubEnv("INVESTMENT_CLERK_ENVIRONMENT", config.environment);
      vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", config.publishableKey);
      vi.stubEnv("INVESTMENT_CLERK_TRIAL_API_ORIGIN", config.apiOrigin);
      const { default: vite } = await import("../../vite.clerk-trial.config");
      expect(
        JSON.parse(String(vite.define?.__INVESTMENT_CLERK_TRIAL_CONFIG__)),
      ).toEqual(config);
      expect(vite.envDir).toBe(false);
      expect(vite.publicDir).toBe(false);
      expect(vite.build?.sourcemap).toBe(false);
      expect(vite.define?.__INVESTMENT_CLIENT_TARGET__).toBe('"web"');
      expect(vite.build?.outDir?.replaceAll("\\", "/")).toMatch(
        config.environment === "production"
          ? /\/dist\/clerk-production$/u
          : /\/dist\/clerk-trial$/u,
      );
    },
  );

  it.each([undefined, "", "unknown", "production"])(
    "refuses invalid or mixed selector %s during configuration import",
    async (environment) => {
      vi.stubEnv("INVESTMENT_CLERK_ENVIRONMENT", environment);
      vi.stubEnv(
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        development.publishableKey,
      );
      vi.stubEnv("INVESTMENT_CLERK_TRIAL_API_ORIGIN", development.apiOrigin);
      await expect(import("../../vite.clerk-trial.config")).rejects.toThrow(
        failure,
      );
    },
  );

  it.each([
    ["managed", production, "android-managed", "managed-android"],
    ["clerk-trial", development, "android-trial", "clerk-trial-android"],
  ] as const)(
    "bakes %s into a separate native output",
    async (selector, config, target, directory) => {
      vi.stubEnv("INVESTMENT_CLIENT_PROFILE", selector);
      vi.stubEnv("INVESTMENT_BUILD_SHA", "a".repeat(40));
      vi.stubEnv("INVESTMENT_CLERK_ENVIRONMENT", config.environment);
      vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", config.publishableKey);
      vi.stubEnv("INVESTMENT_CLERK_TRIAL_API_ORIGIN", config.apiOrigin);
      const { default: vite } = await import("../../vite.clerk-trial.config");
      expect(vite.define?.__INVESTMENT_CLIENT_TARGET__).toBe(
        JSON.stringify(target),
      );
      expect(
        JSON.parse(String(vite.define?.__INVESTMENT_CLERK_TRIAL_CONFIG__)),
      ).toEqual(config);
      expect(
        vite.build?.outDir
          ?.replaceAll("\\", "/")
          .endsWith(`/dist/${directory}`),
      ).toBe(true);
      const plugin = (
        vite.plugins as Array<{
          name: string;
          transformIndexHtml?: () => Array<{ attrs: { content: string } }>;
        }>
      ).find(({ name }) => name === "isolated-clerk-trial");
      expect(plugin?.transformIndexHtml?.()[0]?.attrs.content).toBe(
        [
          "default-src 'none'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          `connect-src 'self' ${config.apiOrigin}`,
          "img-src 'self' data:",
          "font-src 'self'",
          "frame-src 'none'",
          "base-uri 'none'",
          "form-action 'self'",
        ].join("; "),
      );
    },
  );

  it.each([
    ["managed", development, "a".repeat(40)],
    ["clerk-trial", production, "a".repeat(40)],
    ["unknown", production, "a".repeat(40)],
    ["managed", production, undefined],
  ] as const)(
    "rejects native selector/environment/source mismatch %# before build",
    async (selector, config, source) => {
      vi.stubEnv("INVESTMENT_CLIENT_PROFILE", selector);
      vi.stubEnv("INVESTMENT_BUILD_SHA", source);
      vi.stubEnv("INVESTMENT_CLERK_ENVIRONMENT", config.environment);
      vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", config.publishableKey);
      vi.stubEnv("INVESTMENT_CLERK_TRIAL_API_ORIGIN", config.apiOrigin);
      await expect(import("../../vite.clerk-trial.config")).rejects.toThrow();
    },
  );
});
