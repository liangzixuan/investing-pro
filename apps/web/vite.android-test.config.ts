import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { buildIdentity } from "./build-identity";

const sourceSha = buildIdentity(process.env.INVESTMENT_BUILD_SHA);
if (!sourceSha)
  throw new Error("Android test assets require INVESTMENT_BUILD_SHA");

export default defineConfig({
  root: fileURLToPath(
    new URL("./android-tests/managed-workspace", import.meta.url),
  ),
  base: "./",
  publicDir: false,
  envDir: false,
  plugins: [
    {
      name: "android-test-boundary",
      moduleParsed({ id }) {
        const path = id.replaceAll("\\", "/");
        if (
          path.startsWith("node:") ||
          path.includes("/node_modules/@clerk/") ||
          path.includes("/node_modules/next/") ||
          /\/(?:apps\/api|packages\/(?:db|local-research-vault))\//u.test(
            path,
          ) ||
          (/\/(?:NativeTrialApp|native-session|main)\.tsx?$/u.test(path) &&
            path.includes("/src/clerk-trial/"))
        )
          this.error("Account or server code entered Android test assets");
      },
    },
    {
      name: "android-test-build-identity",
      transformIndexHtml: () => [
        {
          tag: "meta",
          attrs: { name: "investment-build-sha", content: sourceSha },
          injectTo: "head",
        },
      ],
    },
  ],
  build: {
    outDir: fileURLToPath(
      new URL("./dist/android-test-assets/managed-workspace", import.meta.url),
    ),
    emptyOutDir: true,
    sourcemap: false,
  },
});
