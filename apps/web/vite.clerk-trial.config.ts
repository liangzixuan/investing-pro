import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { buildIdentity } from "./build-identity";
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

export default defineConfig({
  root,
  base: "./",
  publicDir: false,
  envDir: false,
  define: {
    __INVESTMENT_CLERK_TRIAL_CONFIG__: JSON.stringify(config),
  },
  plugins: [
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
              `script-src 'self' ${clerkOrigin} https://challenges.cloudflare.com`,
              "style-src 'self' 'unsafe-inline'",
              `connect-src 'self' ${clerkOrigin} ${apiOrigin}`,
              "img-src 'self' data: https://img.clerk.com",
              "font-src 'self'",
              `frame-src ${clerkOrigin} https://challenges.cloudflare.com`,
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
    outDir: fileURLToPath(
      new URL(
        config.environment === "production"
          ? "./dist/clerk-production"
          : "./dist/clerk-trial",
        import.meta.url,
      ),
    ),
    emptyOutDir: true,
    sourcemap: false,
    rolldownOptions: { input: `${root}/index.html` },
  },
});
