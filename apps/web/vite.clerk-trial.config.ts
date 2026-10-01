import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineConfig } from "vite";
import { buildIdentity } from "./build-identity";
import { clerkClientProfile, nativeAssetManifest } from "./client-profile";
import {
  trialFrontendApiOrigin,
  validateTrialConfig,
} from "./src/clerk-trial/config";

const root = fileURLToPath(new URL("./clerk-trial", import.meta.url));
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const config = validateTrialConfig({
  environment: process.env.INVESTMENT_CLERK_ENVIRONMENT,
  publishableKey,
  apiOrigin: process.env.INVESTMENT_CLERK_TRIAL_API_ORIGIN,
  frontendApiOrigin: trialFrontendApiOrigin(publishableKey),
});
const { apiOrigin, frontendApiOrigin: clerkOrigin } = config;
const sourceSha = buildIdentity(process.env.INVESTMENT_BUILD_SHA);
const selector = process.env.INVESTMENT_CLIENT_PROFILE;
const profile = clerkClientProfile(selector, config.environment);
if (profile.target !== "web" && !sourceSha) {
  throw new Error("Native assets require an explicit source identity.");
}
const outDir = fileURLToPath(new URL(`./${profile.webDir}`, import.meta.url));
const native = profile.target !== "web";

export default defineConfig({
  root,
  base: "./",
  publicDir: false,
  envDir: false,
  define: {
    __INVESTMENT_CLERK_TRIAL_CONFIG__: JSON.stringify(config),
    __INVESTMENT_CLIENT_TARGET__: JSON.stringify(profile.target),
  },
  plugins: [
    {
      name: "native-asset-identity",
      async writeBundle(_options, bundle) {
        if (profile.target === "web") return;
        const assets = Object.fromEntries(
          await Promise.all(
            Object.keys(bundle).map(
              async (path) =>
                [path, await readFile(join(outDir, path))] as const,
            ),
          ),
        );
        const manifest = nativeAssetManifest(
          selector,
          config,
          sourceSha,
          assets,
        );
        await writeFile(
          join(outDir, "investment-client.json"),
          `${JSON.stringify(manifest, null, 2)}\n`,
          { flag: "wx" },
        );
      },
    },
    {
      name: "public-build-identity",
      transformIndexHtml: () =>
        sourceSha
          ? [
              {
                tag: "meta",
                attrs: { name: "investment-build-sha", content: sourceSha },
                injectTo: "head",
              },
            ]
          : [],
    },
    {
      name: "isolated-clerk-trial",
      moduleParsed({ id }) {
        const normalized = id.replaceAll("\\", "/");
        if (
          normalized.startsWith("node:") ||
          normalized.includes("/node_modules/next/") ||
          /\/(?:apps\/api|packages\/(?:db|local-research-vault))\//u.test(
            normalized,
          )
        )
          this.error("A server-only module entered the Clerk trial client.");
      },
      transformIndexHtml: () => [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: [
              "default-src 'none'",
              native
                ? "script-src 'self'"
                : `script-src 'self' ${clerkOrigin} https://challenges.cloudflare.com`,
              "style-src 'self' 'unsafe-inline'",
              native
                ? `connect-src 'self' ${apiOrigin}`
                : `connect-src 'self' ${clerkOrigin} ${apiOrigin}`,
              native
                ? "img-src 'self' data:"
                : "img-src 'self' data: https://img.clerk.com",
              "font-src 'self'",
              native
                ? "frame-src 'none'"
                : `frame-src ${clerkOrigin} https://challenges.cloudflare.com`,
              "base-uri 'none'",
              "form-action 'self'",
            ].join("; "),
          },
          injectTo: "head-prepend",
        },
      ],
    },
  ],
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: false,
    rolldownOptions: { input: `${root}/index.html` },
  },
});
