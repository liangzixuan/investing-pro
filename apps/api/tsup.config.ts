import { resolve } from "node:path";

import { defineConfig } from "tsup";

import { resolveCleanBuildSourceIdentity } from "./src/build-source-identity";

const repositoryDirectory = resolve(process.cwd(), "../..");
const sourceCommit = resolveCleanBuildSourceIdentity(repositoryDirectory);

export default defineConfig({
  entry: ["src/server.ts", "src/connected-server.ts"],
  outDir: "dist/src",
  format: ["esm"],
  splitting: false,
  target: "node24",
  sourcemap: true,
  clean: true,
  define: {
    __RESEARCH_COCKPIT_SOURCE_COMMIT__: JSON.stringify(sourceCommit),
  },
  noExternal: [/^@research-cockpit\//, "decimal.js"],
  onSuccess: `tsx src/copy-validators.ts ${sourceCommit}`,
});
