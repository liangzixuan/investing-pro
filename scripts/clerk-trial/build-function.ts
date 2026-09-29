import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "tsup";

const configPath = process.argv[2];
if (!configPath || process.argv.length !== 3)
  throw new Error("Pass the reviewed public server configuration path.");
const config = JSON.parse(await readFile(configPath, "utf8")) as unknown;
const outDir = resolve("dist/clerk-trial-function");
await mkdir(outDir, { recursive: true });
await build({
  entry: { main: "apps/api/src/clerk-trial-function.ts" },
  outDir,
  format: ["esm"],
  platform: "node",
  target: "node24",
  splitting: false,
  sourcemap: false,
  clean: true,
  noExternal: [/.*/u],
  define: { __CLERK_TRIAL_SERVER_CONFIG__: JSON.stringify(config) },
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
});
await writeFile(
  `${outDir}/package.json`,
  JSON.stringify({ private: true, type: "module" }) + "\n",
);
console.log("Trial function built; public configuration values omitted.");
