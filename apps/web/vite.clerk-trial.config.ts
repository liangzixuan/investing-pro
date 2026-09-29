import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL("./clerk-trial", import.meta.url));
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const apiOrigin = process.env.INVESTMENT_CLERK_TRIAL_API_ORIGIN;
if (!publishableKey?.startsWith("pk_test_") || !apiOrigin) {
  throw new Error(
    "The isolated Clerk trial needs its development public key and API origin.",
  );
}
const api = new URL(apiOrigin);
if (api.protocol !== "https:" || api.origin !== apiOrigin) {
  throw new Error(
    "The isolated Clerk trial requires an exact HTTPS API origin.",
  );
}
const clerkHost = Buffer.from(publishableKey.slice(8), "base64")
  .toString("utf8")
  .replace(/\$$/u, "");
if (!/^[a-z0-9-]+\.clerk\.accounts\.dev$/u.test(clerkHost)) {
  throw new Error(
    "The trial requires its separate Clerk development instance.",
  );
}
const clerkOrigin = `https://${clerkHost}`;

export default defineConfig({
  root,
  base: "./",
  publicDir: false,
  envDir: false,
  define: {
    __INVESTMENT_CLERK_TRIAL_CONFIG__: JSON.stringify({
      publishableKey,
      apiOrigin,
      frontendApiOrigin: clerkOrigin,
    }),
  },
  plugins: [
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
    outDir: fileURLToPath(new URL("./dist/clerk-trial", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    rolldownOptions: { input: `${root}/index.html` },
  },
});
