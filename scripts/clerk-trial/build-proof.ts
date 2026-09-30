import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "tsup";

import { validateClerkTrialProofProfile } from "../../apps/api/src/clerk-trial-storage-proof";

if (process.argv.length !== 3)
  throw new Error("Pass exactly one proof profile: development or production.");
const profile = validateClerkTrialProofProfile(process.argv[2]);
const outDir = resolve(
  profile.environment === "production"
    ? "dist/clerk-production-proof"
    : "dist/clerk-trial-proof",
);

const inputs = [
  "apps/api/src/clerk-trial-proof-entry.ts",
  "apps/api/src/clerk-trial-storage-proof.ts",
  "apps/api/src/clerk-trial-catalog.ts",
  "apps/api/src/appwrite-transport.ts",
  "apps/api/src/appwrite-watchlist-repository.ts",
  "apps/api/src/watchlist-repository.ts",
  "pnpm-lock.yaml",
  "scripts/clerk-trial/build-proof.ts",
];
const sources = await Promise.all(
  inputs.map(async (path) => ({
    path,
    sha256: createHash("sha256")
      .update(await readFile(path))
      .digest("hex"),
  })),
);
const marker = {
  profile: profile.environment,
  planSha256: profile.planSha256,
  sources,
};
const buildProof = createHash("sha256")
  .update(JSON.stringify(marker))
  .digest("hex");
await build({
  entry: { main: "apps/api/src/clerk-trial-proof-entry.ts" },
  outDir,
  format: ["esm"],
  platform: "node",
  target: "node24",
  splitting: false,
  sourcemap: false,
  clean: true,
  noExternal: [/.*/u],
  define: {
    __CLERK_TRIAL_PROOF_PROFILE__: JSON.stringify(profile.environment),
    __CLERK_TRIAL_PROOF_BUILD__: JSON.stringify(buildProof),
  },
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
});
await mkdir(outDir, { recursive: true });
await writeFile(
  `${outDir}/package.json`,
  JSON.stringify({ private: true, type: "module" }) + "\n",
);
await writeFile(
  `${outDir}/build-proof.json`,
  JSON.stringify({ buildProof, ...marker }, null, 2) + "\n",
);
console.log(
  `Private ${profile.environment} storage proof built: ${buildProof}`,
);
