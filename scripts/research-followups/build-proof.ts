import { createHash } from "node:crypto";
import {
  readFile,
  readdir,
  realpath,
  mkdir,
  writeFile,
  mkdtemp,
} from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "tsup";
import {
  FOLLOWUPS_PROOF_COMMAND_PINS,
  FOLLOWUPS_PROOF_PLAN_SHA256,
  FOLLOWUPS_PROOF_ROWS,
  FOLLOWUPS_PROOF_CATALOG_HASH,
  FOLLOWUPS_PROOF_REVISED_HASH,
  followupsProofData,
} from "../../apps/api/src/research-followups-proof-data";

if (process.argv.length !== 2 || !/^v24\./u.test(process.version))
  throw new Error("Use the fixed Node 24 proof builder without arguments.");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const hash = (raw: Uint8Array | string) =>
  createHash("sha256").update(raw).digest("hex");
const api = [
  "research-followups-proof-entry",
  "research-followups-proof-data",
  "research-followups-storage-proof",
  "appwrite-storage-proof-phase",
  "appwrite-transport",
  "appwrite-versioned-row-store",
  "appwrite-versioned-resource-repository",
  "appwrite-research-followups-repository",
  "research-followups-repository",
].map((name) => `apps/api/src/${name}.ts`);
const inputs = [
  ...api,
  "scripts/research-followups/build-proof.ts",
  "pnpm-lock.yaml",
  "package.json",
  "apps/api/package.json",
  "packages/contracts/package.json",
  "packages/personal-security-master/package.json",
  "apps/api/tsconfig.json",
  "tsconfig.base.json",
];
async function discover(directory: string): Promise<void> {
  for (const item of await readdir(resolve(root, directory), {
    withFileTypes: true,
  })) {
    const path = `${directory}/${item.name}`;
    if (item.isSymbolicLink())
      throw new Error("Proof source links are not admitted");
    if (item.isDirectory()) await discover(path);
    else if (item.name.endsWith(".ts") && !/(?:\.test\.|\/test-)/u.test(path))
      inputs.push(path);
  }
}
await discover("packages/contracts/src");
await discover("packages/personal-security-master/src");
async function pin(path: string) {
  const full = resolve(root, path),
    actual = await realpath(full);
  if (actual !== full || !actual.startsWith(root + sep))
    throw new Error("Proof input escaped its checkout");
  const bytes = await readFile(full);
  return { path, bytes: bytes.length, sha256: hash(bytes) };
}
const sources = await Promise.all([...new Set(inputs)].sort().map(pin));
if (
  sources.length > 2000 ||
  sources.reduce((sum, item) => sum + item.bytes, 0) > 32 * 1024 * 1024
)
  throw new Error("Proof source bound exceeded");
const tsupManifest = await realpath(
  resolve(root, "node_modules/tsup/package.json"),
);
const esbuildManifest = await realpath(
  resolve(dirname(tsupManifest), "../esbuild/package.json"),
);
const tools = await Promise.all(
  [
    "node_modules/tsup/package.json",
    "node_modules/typescript/package.json",
    "apps/api/node_modules/node-appwrite/package.json",
    relative(root, esbuildManifest),
  ]
    .map((path) => resolve(root, path))
    .map(async (path) => {
      const actual = await realpath(path);
      if (!actual.startsWith(root + sep))
        throw new Error("Proof tool escaped its checkout");
      const bytes = await readFile(actual);
      const manifest = JSON.parse(bytes.toString("utf8")) as {
        version?: unknown;
      };
      if (typeof manifest.version !== "string")
        throw new Error("Missing proof tool version");
      return {
        path: relative(root, actual).replaceAll(sep, "/"),
        sha256: hash(bytes),
        version: manifest.version,
      };
    }),
);
const data = followupsProofData();
for (const commandPin of FOLLOWUPS_PROOF_COMMAND_PINS) {
  const command = data.commands[commandPin.name],
    raw = JSON.stringify(command);
  const payloadSha256 = hash(JSON.stringify(command.payload));
  if (
    Buffer.byteLength(raw) !== commandPin.commandBytes ||
    hash(raw) !== commandPin.commandSha256 ||
    payloadSha256 !== commandPin.payloadSha256 ||
    hash(
      JSON.stringify({
        expectedVersion: command.expectedVersion,
        resource: "research-followups",
        id: "main",
        operation: "put",
        payloadSha256,
      }),
    ) !== commandPin.requestSha256
  )
    throw new Error("Proof command pin mismatch");
}
const sourceMarker = {
  version: 1,
  planSha256: FOLLOWUPS_PROOF_PLAN_SHA256,
  sources,
  tools,
  node: {
    version: process.version,
    sha256: hash(await readFile(process.execPath)),
  },
  catalog: FOLLOWUPS_PROOF_CATALOG_HASH,
  revisedCatalog: FOLLOWUPS_PROOF_REVISED_HASH,
  commands: FOLLOWUPS_PROOF_COMMAND_PINS,
  rows: FOLLOWUPS_PROOF_ROWS,
  // Fixed artifact policy from the installed node-appwrite 29 / Undici 6
  // source imports, plus this entry's crypto and ESM module banner.
  builtinImports: [
    "assert",
    "async_hooks",
    "buffer",
    "console",
    "crypto",
    "diagnostics_channel",
    "dns",
    "events",
    "fs",
    "http",
    "http2",
    "module",
    "net",
    "perf_hooks",
    "querystring",
    "stream",
    "string_decoder",
    "tls",
    "url",
    "util",
    "util/types",
    "worker_threads",
    "zlib",
  ],
};
type Graph = {
  inputs: Record<
    string,
    {
      bytes: number;
      imports: { path: string; kind: string; external?: boolean }[];
    }
  >;
  outputs: Record<string, { imports: { path: string; external?: boolean }[] }>;
};
const sourcePaths = new Set(sources.map((item) => item.path));
async function bundle(outDir: string, buildProof: string) {
  let meta: Graph | undefined;
  await build({
    config: false,
    tsconfig: resolve(root, "apps/api/tsconfig.json"),
    entry: {
      main: resolve(root, "apps/api/src/research-followups-proof-entry.ts"),
    },
    outDir,
    format: ["esm"],
    platform: "node",
    target: "node24",
    splitting: false,
    sourcemap: false,
    clean: false,
    noExternal: [/.*/u],
    // tsup always asks esbuild for its graph; do not emit a second runtime file.
    metafile: false,
    define: { __FOLLOWUPS_PROOF_BUILD__: JSON.stringify(buildProof) },
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
    },
    esbuildPlugins: [
      {
        name: "fixed-proof-inputs",
        setup(context) {
          context.onEnd((result) => {
            if (result.warnings.length > 0)
              throw new Error("Proof build warning requires review");
            meta = result.metafile;
          });
        },
      },
    ],
    esbuildOptions(options) {
      options.absWorkingDir = root;
      options.logOverride = {
        "unsupported-dynamic-import": "error",
        "unsupported-require-call": "error",
      };
    },
  });
  if (!meta || Object.keys(meta.inputs).length > 2000)
    throw new Error("Missing or unbounded proof module graph");
  const outputPaths = Object.keys(meta.outputs);
  if (
    outputPaths.length !== 1 ||
    resolve(root, outputPaths[0]!) !== resolve(outDir, "main.js")
  )
    throw new Error("Unexpected proof build output");
  const outputEntries = await readdir(outDir, { withFileTypes: true });
  if (
    outputEntries.length !== 1 ||
    outputEntries[0]?.name !== "main.js" ||
    !outputEntries[0].isFile()
  )
    throw new Error("Unexpected proof output directory member");
  const modules = [];
  for (const path of Object.keys(meta.inputs).sort()) {
    const normalized = relative(root, resolve(root, path)).replaceAll(sep, "/");
    if (
      /(?:\.test\.|\/test-|(?:^|\/)(?:clerk-trial-proof-entry|managed-workspace-handler|managed-workspace-function)\.)/u.test(
        normalized,
      )
    )
      throw new Error("Unrelated execution module in proof bundle");
    if (!normalized.startsWith("node_modules/") && !sourcePaths.has(normalized))
      throw new Error("Unbound application module in proof bundle");
    const actual = await realpath(resolve(root, path));
    if (!actual.startsWith(root + sep))
      throw new Error("Module escaped the proof checkout");
    const bytes = await readFile(actual);
    if (meta.inputs[path]?.bytes !== bytes.length)
      throw new Error("Proof module changed during graph discovery");
    modules.push({
      path: normalized,
      bytes: bytes.length,
      sha256: hash(bytes),
      imports: meta.inputs[path].imports,
    });
  }
  if (
    modules.reduce((sum, item) => sum + item.bytes, 0) > 64 * 1024 * 1024 ||
    Object.values(meta.outputs).some((output) =>
      output.imports.some(
        (item) =>
          !item.external ||
          !sourceMarker.builtinImports.includes(
            item.path.replace(/^node:/u, ""),
          ),
      ),
    )
  )
    throw new Error("Unbounded or external proof runtime");
  return modules;
}
async function verifySources() {
  for (const expected of sources) {
    if (JSON.stringify(await pin(expected.path)) !== JSON.stringify(expected))
      throw new Error("Proof source changed during build");
  }
  for (const expected of tools) {
    if ((await pin(expected.path)).sha256 !== expected.sha256)
      throw new Error("Proof tool changed during build");
  }
  if (hash(await readFile(process.execPath)) !== sourceMarker.node.sha256)
    throw new Error("Proof Node executable changed during build");
}
const parent = resolve(root, "dist/managed-followups-proof");
await mkdir(parent, { recursive: true });
const discovery = await mkdtemp(resolve(parent, ".discovery-"));
const modules = await bundle(discovery, "0".repeat(64));
await verifySources();
const marker = { ...sourceMarker, modules };
const buildProof = hash(JSON.stringify(marker));
const outDir = resolve(parent, buildProof);
await mkdir(outDir); // Exclusive final build identity; never clean or overwrite.
for (const expected of modules) {
  const current = await pin(expected.path);
  if (current.bytes !== expected.bytes || current.sha256 !== expected.sha256)
    throw new Error("Proof dependency changed before final build");
}
const finalModules = await bundle(outDir, buildProof);
if (JSON.stringify(finalModules) !== JSON.stringify(modules))
  throw new Error("Final proof graph differs from discovery");
await verifySources();
const artifact = await readFile(resolve(outDir, "main.js"));
await writeFile(
  resolve(outDir, "package.json"),
  JSON.stringify({ private: true, type: "module" }) + "\n",
  { flag: "wx" },
);
await writeFile(
  resolve(outDir, "build-proof.json"),
  JSON.stringify(
    {
      buildProof,
      ...marker,
      bundle: {
        path: "main.js",
        bytes: artifact.length,
        sha256: hash(artifact),
      },
      scope: "private synthetic storage qualification; no live acceptance",
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
console.log(`Private Follow-ups proof built: ${buildProof}`);
