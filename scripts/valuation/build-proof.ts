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
import { bundleValuationProof } from "./proof-bundle";
import {
  encodeValuationAssumptionsPayload,
  type ManagedValuationAssumptionsCommand,
} from "../../packages/contracts/src/managed-valuation-assumptions";
import {
  VALUATION_PROOF_COMMAND_PINS,
  VALUATION_PROOF_PLAN_SHA256,
  VALUATION_PROOF_ROWS,
  VALUATION_PROOF_CATALOG_PINS,
  VALUATION_PROOF_ROWS_SHA256,
  type ValuationProofCommandName,
  valuationProofData,
} from "../../apps/api/src/valuation-assumptions-proof-data";
import {
  VALUATION_PROOF_SCHEMA,
  VALUATION_PROOF_SCHEMA_SHA256,
  VALUATION_PROOF_CREATE_OPERATIONS,
} from "../../apps/api/src/valuation-assumptions-proof-schema";

if (process.argv.length !== 2 || !/^v24\./u.test(process.version))
  throw new Error("Use the fixed Node 24 proof builder without arguments.");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const hash = (raw: Uint8Array | string) =>
  createHash("sha256").update(raw).digest("hex");
const api = [
  "valuation-assumptions-proof-entry",
  "valuation-assumptions-proof-data",
  "valuation-assumptions-proof-schema",
  "valuation-assumptions-storage-proof",
  "valuation-assumptions-storage-proof-context",
  "valuation-assumptions-storage-proof-evidence",
  "valuation-assumptions-storage-proof-phases",
  "valuation-assumptions-storage-proof-races",
  "appwrite-storage-proof-phase",
  "appwrite-transport",
  "appwrite-versioned-row-store",
  "appwrite-versioned-resource-repository",
  "appwrite-valuation-assumptions-repository",
  "valuation-assumptions-repository",
].map((name) => `apps/api/src/${name}.ts`);
const inputs = [
  ...api,
  "apps/api/src/valuation-assumptions-storage-proof-types.ts",
  "scripts/valuation/build-proof.ts",
  "scripts/valuation/proof-bundle.ts",
  "pnpm-lock.yaml",
  "package.json",
  "apps/api/package.json",
  "packages/contracts/package.json",
  "packages/personal-security-master/package.json",
  "apps/api/tsconfig.json",
  "tsconfig.base.json",
  "THIRD_PARTY_NOTICES.md",
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
// Bind the installed builder implementations and the exact native esbuild tool.
const toolCode: FilePin[] = [];
for (const path of [
  resolve(dirname(tsupManifest), "dist/index.js"),
  resolve(
    dirname(
      await realpath(resolve(root, "node_modules/typescript/package.json")),
    ),
    "lib/typescript.js",
  ),
  resolve(dirname(esbuildManifest), "lib/main.js"),
  resolve(
    dirname(esbuildManifest),
    `../@esbuild/${process.platform}-${process.arch}/${process.platform === "win32" ? "esbuild.exe" : "bin/esbuild"}`,
  ),
]) {
  const actual = await realpath(path);
  toolCode.push(await pin(relative(root, actual).replaceAll(sep, "/")));
}
const data = valuationProofData();
for (const commandPin of VALUATION_PROOF_COMMAND_PINS) {
  const commands: Readonly<
    Partial<
      Record<ValuationProofCommandName, ManagedValuationAssumptionsCommand>
    >
  > = data.commands[commandPin.owner];
  const command =
    commands[commandPin.name] ??
    data.domainCommands.find((item) => item.name === commandPin.name)?.command;
  if (!command) throw new Error("Missing fixed proof command");
  const raw = JSON.stringify(command);
  const payloadSha256 = hash(
    encodeValuationAssumptionsPayload(command.payload),
  );
  if (
    Buffer.byteLength(raw) !== commandPin.commandBytes ||
    hash(raw) !== commandPin.commandSha256 ||
    payloadSha256 !== commandPin.payloadSha256 ||
    hash(
      JSON.stringify({
        expectedVersion: command.expectedVersion,
        resource: "valuation-assumptions",
        id: "main",
        operation: "put",
        payloadSha256,
      }),
    ) !== commandPin.requestSha256
  )
    throw new Error("Proof command pin mismatch");
}
// Only these installed runtime packages may enter the actual esbuild graph.
const appwriteRoot = dirname(
  await realpath(
    resolve(root, "apps/api/node_modules/node-appwrite/package.json"),
  ),
);
const bigintRoot = dirname(
  await realpath(resolve(appwriteRoot, "../json-bigint/package.json")),
);
const packagePolicy = [
  {
    root: appwriteRoot,
    name: "node-appwrite",
    version: "29.0.0",
    files: ["LICENSE"],
  },
  {
    root: dirname(
      await realpath(
        resolve(root, "apps/api/node_modules/undici/package.json"),
      ),
    ),
    name: "undici",
    version: "6.29.0",
    files: ["LICENSE", "lib/web/fetch/LICENSE"],
  },
  {
    root: bigintRoot,
    name: "json-bigint",
    version: "1.0.0",
    files: ["LICENSE"],
  },
  {
    root: dirname(
      await realpath(resolve(bigintRoot, "../bignumber.js/package.json")),
    ),
    name: "bignumber.js",
    version: "9.3.1",
    files: ["LICENCE.md"],
  },
];
const noticeParts = [
  Buffer.from("Valuation private storage proof runtime notices\n\n", "utf8"),
];
type FilePin = Awaited<ReturnType<typeof pin>>;
const dependencyLicenses: {
  root: string;
  name: string;
  version: string;
  manifest: FilePin;
  files: FilePin[];
}[] = [];
for (const policy of packagePolicy) {
  const packagePath = relative(root, policy.root).replaceAll(sep, "/");
  const manifest = await pin(`${packagePath}/package.json`);
  const value = JSON.parse(
    await readFile(resolve(root, manifest.path), "utf8"),
  ) as { name?: unknown; version?: unknown };
  if (value.name !== policy.name || value.version !== policy.version)
    throw new Error("Unreviewed proof runtime package version");
  const files = [];
  for (const name of policy.files) {
    const file = await pin(`${packagePath}/${name}`);
    if (file.bytes < 100 || file.bytes > 64 * 1024)
      throw new Error("Invalid proof license bytes");
    files.push(file);
    noticeParts.push(
      Buffer.from(
        `\n===== ${policy.name}@${policy.version}: ${name} =====\n`,
        "utf8",
      ),
      await readFile(resolve(root, file.path)),
    );
  }
  dependencyLicenses.push({
    root: packagePath,
    name: policy.name,
    version: policy.version,
    manifest,
    files,
  });
}
// These installed source comments carry additional vendored notices. Retain their
// complete comment lines. Legal block comments also remain inline in main.js.
const undiciRoot = packagePolicy[1]!.root;
for (const name of [
  "lib/core/util.js",
  "lib/web/fetch/body.js",
  "lib/web/websocket/frame.js",
  "lib/web/websocket/receiver.js",
]) {
  const path = relative(root, resolve(undiciRoot, name)).replaceAll(sep, "/");
  const file = await pin(path);
  dependencyLicenses[1]!.files.push(file);
  const text = await readFile(resolve(root, path), "utf8");
  const lines = text
    .split(/\r?\n/u)
    .filter(
      (line) =>
        /(?:Copyright|MIT License|MIT license)/u.test(line) &&
        line.length < 1024,
    );
  if (lines.length === 0) throw new Error("Missing reviewed embedded notice");
  noticeParts.push(
    Buffer.from(
      `\n===== undici embedded notices: ${name} =====\n${lines.join("\n")}\n`,
      "utf8",
    ),
  );
}
const notices = Buffer.concat(noticeParts);
if (notices.length > 1024 * 1024)
  throw new Error("Proof notices bound exceeded");
for (const catalog of VALUATION_PROOF_CATALOG_PINS) {
  const raw = data.snapshots[catalog.name];
  if (
    Buffer.byteLength(raw) !== catalog.bytes ||
    `sha256:${hash(raw)}` !== catalog.sha256
  )
    throw new Error("Proof catalog pin mismatch");
}
if (hash(JSON.stringify(VALUATION_PROOF_ROWS)) !== VALUATION_PROOF_ROWS_SHA256)
  throw new Error("Proof row pin mismatch");
const sourceMarker = {
  version: 1,
  planSha256: VALUATION_PROOF_PLAN_SHA256,
  schemaSha256: VALUATION_PROOF_SCHEMA_SHA256,
  schema: VALUATION_PROOF_SCHEMA,
  createOperations: VALUATION_PROOF_CREATE_OPERATIONS,
  createOperationsSha256: hash(
    JSON.stringify(VALUATION_PROOF_CREATE_OPERATIONS),
  ),
  sources,
  tools,
  toolCode,
  node: {
    version: process.version,
    sha256: hash(await readFile(process.execPath)),
  },
  catalogs: VALUATION_PROOF_CATALOG_PINS,
  rowsSha256: VALUATION_PROOF_ROWS_SHA256,
  dependencyLicenses,
  notices: { bytes: notices.length, sha256: hash(notices) },
  commands: VALUATION_PROOF_COMMAND_PINS,
  rows: VALUATION_PROOF_ROWS,
  // Fixed artifact policy from the installed node-appwrite 29 / Undici 6
  // source imports, plus this entry's crypto and ESM module banner.
  builtinImports: [
    "assert",
    "assert/strict",
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
const bundlePolicy = {
  root,
  api,
  sourcePaths: new Set(sources.map((item) => item.path)),
  dependencyRoots: dependencyLicenses.map((item) => item.root),
  builtinImports: sourceMarker.builtinImports,
  pin,
};
const bundle = (outDir: string, buildProof: string) =>
  bundleValuationProof(outDir, buildProof, bundlePolicy);
async function verifySources() {
  for (const expected of sources) {
    if (JSON.stringify(await pin(expected.path)) !== JSON.stringify(expected))
      throw new Error("Proof source changed during build");
  }
  for (const expected of [
    ...tools,
    ...toolCode,
    ...dependencyLicenses.flatMap((item) => [item.manifest, ...item.files]),
  ]) {
    if ((await pin(expected.path)).sha256 !== expected.sha256)
      throw new Error("Proof tool changed during build");
  }
  if (hash(await readFile(process.execPath)) !== sourceMarker.node.sha256)
    throw new Error("Proof Node executable changed during build");
}
const parent = resolve(root, "dist/managed-valuation-proof");
await mkdir(parent, { recursive: true });
if ((await realpath(parent)) !== parent)
  throw new Error("Proof output parent is redirected");
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
if (artifact.length > 8 * 1024 * 1024)
  throw new Error("Proof artifact bound exceeded");
await writeFile(resolve(outDir, "THIRD_PARTY_NOTICES.txt"), notices, {
  flag: "wx",
});
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
      scope:
        "private synthetic valuation storage qualification; no live acceptance",
      noticeScope:
        "Installed full license files for the four allowed runtime packages and retained embedded notices; frontend fonts and icons are not in this graph.",
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
console.log(`Private valuation proof built: ${buildProof}`);
