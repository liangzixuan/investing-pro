import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClerkTrialConfig } from "./config";

const mounts = vi.hoisted(() => ({
  native: vi.fn(),
  platform: vi.fn(),
  createRoot: vi.fn(),
  render: vi.fn<(element: unknown) => void>(),
  webApp: vi.fn(() => null),
  nativeApp: vi.fn(() => null),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: mounts.native, getPlatform: mounts.platform },
}));
vi.mock("react-dom/client", () => ({ createRoot: mounts.createRoot }));
vi.mock("./ClerkTrialApp", () => ({ ClerkTrialApp: mounts.webApp }));
vi.mock("./NativeTrialApp", () => ({ NativeTrialApp: mounts.nativeApp }));

const development: ClerkTrialConfig = {
  environment: "development",
  publishableKey: `pk_test_${Buffer.from("invented-trial-12.clerk.accounts.dev$").toString("base64")}`,
  apiOrigin: "https://investment-clerk-api-6abac57a.appwrite.network",
  frontendApiOrigin: "https://invented-trial-12.clerk.accounts.dev",
};
const production: ClerkTrialConfig = {
  environment: "production",
  publishableKey: `pk_live_${Buffer.from("clerk.investingpro.app$").toString("base64")}`,
  apiOrigin: "https://api.investingpro.app",
  frontendApiOrigin: "https://clerk.investingpro.app",
};
const container = {};
const productionOrigin = "https://app.investingpro.app";
const stagingOrigin = "https://investment-device-preview.appwrite.network";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mounts.native.mockReturnValue(false);
  mounts.platform.mockReturnValue("web");
  mounts.createRoot.mockReturnValue({ render: mounts.render });
  vi.stubGlobal("document", { getElementById: () => container });
  vi.stubGlobal("window", { location: { origin: productionOrigin } });
  vi.stubGlobal("__INVESTMENT_CLERK_TRIAL_CONFIG__", development);
});
afterEach(() => vi.unstubAllGlobals());

describe("Clerk profile entry point", () => {
  it.each([development, production])(
    "mounts the browser adapter once for $environment",
    async (config) => {
      vi.stubGlobal("__INVESTMENT_CLERK_TRIAL_CONFIG__", config);
      await import("./main");
      expect(mounts.createRoot).toHaveBeenCalledExactlyOnceWith(container);
      expect(mounts.render).toHaveBeenCalledTimes(1);
      const element = mounts.render.mock.calls[0]?.[0] as ReactElement<{
        config: ClerkTrialConfig;
      }>;
      expect(element.type).toBe(mounts.webApp);
      expect(element.props.config).toEqual(config);
      expect(element.props.config).not.toBe(config);
    },
  );

  it("selects only the native adapter for the development Android profile", async () => {
    mounts.native.mockReturnValue(true);
    mounts.platform.mockReturnValue("android");
    await import("./main");
    expect(mounts.createRoot).toHaveBeenCalledExactlyOnceWith(container);
    expect(mounts.render).toHaveBeenCalledTimes(1);
    const element = mounts.render.mock.calls[0]?.[0] as ReactElement<{
      config: ClerkTrialConfig;
    }>;
    expect(element.type).toBe(mounts.nativeApp);
    expect(element.props.config).toEqual(development);
  });

  it.each(["android", "ios", "unknown"])(
    "rejects production on native %s before creating any React root",
    async (platform) => {
      vi.stubGlobal("__INVESTMENT_CLERK_TRIAL_CONFIG__", production);
      mounts.native.mockReturnValue(true);
      mounts.platform.mockReturnValue(platform);
      await expect(import("./main")).rejects.toThrow(
        "The production Clerk profile supports web only.",
      );
      expect(mounts.createRoot).not.toHaveBeenCalled();
      expect(mounts.render).not.toHaveBeenCalled();
      expect(mounts.webApp).not.toHaveBeenCalled();
      expect(mounts.nativeApp).not.toHaveBeenCalled();
    },
  );

  it("keeps unsupported development native platforms rejected", async () => {
    mounts.native.mockReturnValue(true);
    mounts.platform.mockReturnValue("ios");
    await expect(import("./main")).rejects.toThrow(
      "The installed trial supports Android only.",
    );
    expect(mounts.createRoot).not.toHaveBeenCalled();
  });

  it("renders the real frame and notices at staging without mounting either SDK", async () => {
    vi.stubGlobal("__INVESTMENT_CLERK_TRIAL_CONFIG__", production);
    vi.stubGlobal("window", { location: { origin: stagingOrigin } });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await import("./main");
    expect(mounts.createRoot).toHaveBeenCalledExactlyOnceWith(container);
    expect(mounts.render).toHaveBeenCalledTimes(1);
    const element = mounts.render.mock.calls[0]?.[0] as ReactElement;
    const html = renderToStaticMarkup(element);
    expect(html).toContain("A shared watchlist, across your devices");
    expect(html).toContain("Staging preview");
    expect(html).toContain("Sign-in is available on the production site.");
    expect(html).toContain(
      "This preview does not start a session or load saved data.",
    );
    expect(html).toContain("Synthetic data only.");
    expect(html).toContain("Software licenses");
    expect(html).not.toContain("Your demo watchlist");
    expect(mounts.webApp).not.toHaveBeenCalled();
    expect(mounts.nativeApp).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    productionOrigin.replace("https:", "http:"),
    `${productionOrigin}:8443`,
    `${productionOrigin}.invalid`,
    `${stagingOrigin}:8443`,
    `${stagingOrigin}.invalid`,
    "https://localhost",
    "https://unrelated.example",
    "null",
    undefined,
  ])("rejects production browser origin %s before mounting", async (origin) => {
    vi.stubGlobal("__INVESTMENT_CLERK_TRIAL_CONFIG__", production);
    vi.stubGlobal("window", { location: { origin } });
    await expect(import("./main")).rejects.toThrow(
      "The production Clerk profile requires its approved web origin.",
    );
    expect(mounts.createRoot).not.toHaveBeenCalled();
    expect(mounts.render).not.toHaveBeenCalled();
    expect(mounts.webApp).not.toHaveBeenCalled();
    expect(mounts.nativeApp).not.toHaveBeenCalled();
  });

  it("keeps development browser selection independent of the production preview origin", async () => {
    vi.stubGlobal("window", { location: { origin: stagingOrigin } });
    await import("./main");
    const element = mounts.render.mock.calls[0]?.[0] as ReactElement;
    expect(element.type).toBe(mounts.webApp);
  });

  it("rejects production native startup even when its reported origin matches staging", async () => {
    vi.stubGlobal("__INVESTMENT_CLERK_TRIAL_CONFIG__", production);
    vi.stubGlobal("window", { location: { origin: stagingOrigin } });
    mounts.native.mockReturnValue(true);
    await expect(import("./main")).rejects.toThrow(
      "The production Clerk profile supports web only.",
    );
    expect(mounts.createRoot).not.toHaveBeenCalled();
  });

  it("rejects malformed configuration before considering an unsupported production origin", async () => {
    vi.stubGlobal("__INVESTMENT_CLERK_TRIAL_CONFIG__", {
      ...production,
      apiOrigin: "https://unrelated.example",
    });
    vi.stubGlobal("window", { location: { origin: "null" } });
    await expect(import("./main")).rejects.toThrow(
      "Invalid public Clerk trial configuration.",
    );
    expect(mounts.createRoot).not.toHaveBeenCalled();
  });

  it("rejects malformed public configuration before mounting", async () => {
    vi.stubGlobal("__INVESTMENT_CLERK_TRIAL_CONFIG__", {
      ...development,
      environment: undefined,
    });
    await expect(import("./main")).rejects.toThrow(
      "Invalid public Clerk trial configuration.",
    );
    expect(mounts.createRoot).not.toHaveBeenCalled();
    expect(mounts.render).not.toHaveBeenCalled();
  });

  it("keeps a missing root a finite startup failure", async () => {
    vi.stubGlobal("document", { getElementById: () => null });
    await expect(import("./main")).rejects.toThrow("Missing trial root.");
    expect(mounts.createRoot).not.toHaveBeenCalled();
  });
});
