import { afterEach, describe, expect, it, vi } from "vitest";
import {
  capacitorClientProfile,
  clerkClientProfile,
  nativeAssetManifest,
} from "./client-profile";

const production = {
  environment: "production",
  publishableKey: `pk_live_${Buffer.from("clerk.investingpro.app$").toString("base64")}`,
  apiOrigin: "https://investment-managed-6abac57a.appwrite.network",
  frontendApiOrigin: "https://clerk.investingpro.app",
} as const;
const source = "a".repeat(40);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("compiled client profiles", () => {
  it.each(["development", "production"] as const)(
    "keeps the omitted %s build web-only",
    (environment) => {
      expect(clerkClientProfile(undefined, environment)).toEqual({
        target: "web",
        appId: null,
        webDir:
          environment === "production"
            ? "dist/clerk-production"
            : "dist/clerk-trial",
      });
    },
  );
  it.each([
    [
      "clerk-trial",
      "development",
      "android-trial",
      "local.investment.personal.clerktrial",
      "dist/clerk-trial-android",
    ],
    [
      "managed",
      "production",
      "android-managed",
      "app.investingpro.android",
      "dist/managed-android",
    ],
  ] as const)(
    "shares the exact %s build/sync selection",
    (selector, environment, target, appId, webDir) => {
      expect(clerkClientProfile(selector, environment)).toMatchObject({
        target,
        appId,
        webDir,
      });
      expect(capacitorClientProfile(selector)).toEqual(
        clerkClientProfile(selector, environment),
      );
    },
  );
  it.each(["", "web", "production", "MANAGED", null, {}, false])(
    "rejects an unknown selector %#",
    (selector) => {
      expect(() => capacitorClientProfile(selector)).toThrow(
        "Invalid Investment client profile.",
      );
      expect(() => clerkClientProfile(selector, "production")).toThrow();
    },
  );
  it.each([
    ["managed", "development"],
    ["clerk-trial", "production"],
    ["disconnected", "production"],
  ] as const)("rejects mixed %s/%s", (selector, environment) => {
    expect(() => clerkClientProfile(selector, environment)).toThrow(
      "does not match",
    );
  });
  it("preserves the disconnected app as the Capacitor default", () => {
    expect(capacitorClientProfile(undefined)).toEqual(
      capacitorClientProfile("disconnected"),
    );
    expect(capacitorClientProfile(undefined)).toMatchObject({
      appId: "local.investment.personal",
      webDir: "dist/mobile",
    });
  });
  it("sets a fixed native origin and disables remote/debug web content", async () => {
    vi.stubEnv("INVESTMENT_CLIENT_PROFILE", "managed");
    const { default: config } = await import("./capacitor.config");
    expect(config).toEqual({
      appId: "app.investingpro.android",
      appName: "Investment",
      webDir: "dist/managed-android",
      loggingBehavior: "none",
      server: { hostname: "localhost", androidScheme: "https" },
      android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
    });
  });
});

describe("native asset identity", () => {
  it("binds exact UTF-8 bytes, public config and source without retaining input references", () => {
    const config = { ...production };
    const bytes = Buffer.from("abc");
    const manifest = nativeAssetManifest("managed", config, source, {
      "index.html": bytes,
    });
    expect(manifest).toEqual({
      schemaVersion: 1,
      target: "android-managed",
      appId: "app.investingpro.android",
      config: production,
      sourceSha: source,
      assets: [
        {
          path: "index.html",
          sha256:
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        },
      ],
    });
    bytes.fill(0);
    config.publishableKey = "invalid" as typeof production.publishableKey;
    expect(manifest.config).toEqual(production);
    expect(manifest.assets[0]?.sha256).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it.each([undefined, "", "A".repeat(40), "a".repeat(39)])(
    "rejects absent or malformed source identity %#",
    (identity) => {
      expect(() =>
        nativeAssetManifest("managed", production, identity, {
          "index.html": Buffer.from("ok"),
        }),
      ).toThrow();
    },
  );
  it("cannot label web assets or a mixed key as an Android build", () => {
    const assets = { "index.html": Buffer.from("ok") };
    expect(() =>
      nativeAssetManifest(undefined, production, source, assets),
    ).toThrow("explicit native profile");
    expect(() =>
      nativeAssetManifest(
        "managed",
        { ...production, publishableKey: "pk_test_invalid" },
        source,
        assets,
      ),
    ).toThrow("Invalid public");
  });
  it.each([
    "../escape",
    "/absolute",
    "assets//file",
    "assets/./file",
    "assets\\file",
    "investment-client.json",
    "cordova.js",
    "cordova_plugins.js",
  ])("rejects reserved or unsafe asset path %s", (path) => {
    expect(() =>
      nativeAssetManifest("managed", production, source, {
        "index.html": Buffer.from("ok"),
        [path]: Buffer.from("bad"),
      }),
    ).toThrow("Invalid native asset inventory.");
  });
  it("requires an index and produces a deterministic complete asset inventory", () => {
    expect(() =>
      nativeAssetManifest("managed", production, source, {}),
    ).toThrow("Invalid native asset inventory.");
    const manifest = nativeAssetManifest("managed", production, source, {
      "index.html": Buffer.from("ok"),
      "assets/main.js": Buffer.from("code"),
    });
    expect(manifest.assets.map(({ path }) => path)).toEqual([
      "assets/main.js",
      "index.html",
    ]);
  });
});
