import { createHash } from "node:crypto";
import { buildIdentity } from "./build-identity";
import {
  validateTrialConfig,
  type ClerkTrialConfig,
} from "./src/clerk-trial/config";

export type ClerkClientTarget = "web" | "android-trial" | "android-managed";

const nativeProfiles = {
  "clerk-trial": {
    target: "android-trial",
    environment: "development",
    appId: "local.investment.personal.clerktrial",
    appName: "Investment Trial",
    webDir: "dist/clerk-trial-android",
  },
  managed: {
    target: "android-managed",
    environment: "production",
    appId: "app.investingpro.android",
    appName: "Investment",
    webDir: "dist/managed-android",
  },
} as const;

export function capacitorClientProfile(value: unknown) {
  if (value === undefined || value === "disconnected") {
    return {
      target: "disconnected",
      appId: "local.investment.personal",
      appName: "Investment",
      webDir: "dist/mobile",
    } as const;
  }
  if (value === "clerk-trial" || value === "managed")
    return nativeProfiles[value];
  throw new Error("Invalid Investment client profile.");
}

export function clerkClientProfile(
  value: unknown,
  environment: ClerkTrialConfig["environment"],
) {
  if (value === undefined) {
    return {
      target: "web",
      appId: null,
      webDir:
        environment === "production"
          ? "dist/clerk-production"
          : "dist/clerk-trial",
    } as const;
  }
  const profile = capacitorClientProfile(value);
  if (
    profile.target === "disconnected" ||
    profile.environment !== environment
  ) {
    throw new Error("The client profile does not match its Clerk environment.");
  }
  return profile;
}

export function nativeAssetManifest(
  selector: unknown,
  input: ClerkTrialConfig,
  source: unknown,
  assets: Readonly<Record<string, Uint8Array>>,
) {
  const config = validateTrialConfig(input);
  const profile = clerkClientProfile(selector, config.environment);
  const sourceSha = buildIdentity(source);
  if (profile.target === "web" || !sourceSha) {
    throw new Error(
      "Native assets require an explicit native profile and source identity.",
    );
  }
  const paths = Object.keys(assets).sort();
  if (
    !paths.includes("index.html") ||
    paths.some(
      (path) =>
        !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(path) ||
        path
          .split("/")
          .some((part) => part === "" || part === "." || part === "..") ||
        ["investment-client.json", "cordova.js", "cordova_plugins.js"].includes(
          path,
        ),
    )
  ) {
    throw new Error("Invalid native asset inventory.");
  }
  return {
    schemaVersion: 1,
    target: profile.target,
    appId: profile.appId,
    config,
    sourceSha,
    assets: paths.map((path) => ({
      path,
      sha256: createHash("sha256").update(assets[path]!).digest("hex"),
    })),
  };
}
