import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "tsup";

import { validateClerkTrialFunctionConfiguration } from "../../apps/api/src/clerk-trial-config";
import { validateManagedSecConfiguration } from "../../apps/api/src/managed-sec-config";
import { validateManagedEodConfiguration } from "../../apps/api/src/managed-eod-config";

const surface = process.argv[2];
const configPath = process.argv[3];
const secConfigPath = process.argv[4];
const eodConfigPath = process.argv[5];
if (
  (surface !== "demo" && surface !== "managed") ||
  !configPath ||
  (surface === "demo"
    ? process.argv.length !== 4
    : process.argv.length !== 6 || !secConfigPath || !eodConfigPath)
)
  throw new Error(
    "Pass demo and its server configuration, or managed and separate server, SEC and EOD configuration paths.",
  );
const { environment, auth, allowedOrigins } =
  validateClerkTrialFunctionConfiguration(
    JSON.parse(await readFile(configPath, "utf8")) as unknown,
  );
if (surface === "managed" && environment !== "production")
  throw new Error("The managed workspace requires the production profile.");
const secConfiguration =
  surface === "managed"
    ? validateManagedSecConfiguration(
        JSON.parse(await readFile(secConfigPath!, "utf8")) as unknown,
      )
    : null;
const eodConfiguration =
  surface === "managed"
    ? validateManagedEodConfiguration(
        JSON.parse(await readFile(eodConfigPath!, "utf8")) as unknown,
      )
    : null;
const outDir = resolve(
  surface === "managed"
    ? "dist/managed-workspace-function"
    : environment === "production"
      ? "dist/clerk-production-function"
      : "dist/clerk-trial-function",
);
await mkdir(outDir, { recursive: true });
await build({
  entry: {
    main:
      surface === "managed"
        ? "apps/api/src/managed-workspace-function.ts"
        : "apps/api/src/clerk-trial-function.ts",
  },
  outDir,
  format: ["esm"],
  platform: "node",
  target: "node24",
  splitting: false,
  sourcemap: false,
  clean: true,
  noExternal: [/.*/u],
  define: {
    ...(surface === "managed"
      ? {
          __MANAGED_SEC_CONFIG__: JSON.stringify(secConfiguration),
          __MANAGED_EOD_CONFIG__: JSON.stringify(eodConfiguration),
        }
      : {}),
    [surface === "managed"
      ? "__MANAGED_WORKSPACE_SERVER_CONFIG__"
      : "__CLERK_TRIAL_SERVER_CONFIG__"]: JSON.stringify({
      environment,
      auth,
      allowedOrigins,
    }),
  },
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
});
await writeFile(
  `${outDir}/package.json`,
  JSON.stringify({ private: true, type: "module" }) + "\n",
);
console.log(`${surface} function built; configuration values omitted.`);
