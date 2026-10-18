import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  readFile,
  readdir,
  realpath,
  mkdir,
  writeFile,
  mkdtemp,
  lstat,
} from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "tsup";
import {
  WATCHLIST_RESTORE_PROOF_TARGET,
  WATCHLIST_RESTORE_PROOF_PHASES,
  WATCHLIST_RESTORE_PROOF_PLAN_SHA256,
} from "../../apps/api/src/watchlist-restore-proof-data";

assert.equal(
  process.argv.length,
  2,
  "Use the restore-proof builder without arguments",
);
assert.match(
  process.version,
  /^v24\./u,
  "Use the fixed Node 24 restore-proof builder",
);
const root = await realpath(
  resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
);
const hash = (raw: Uint8Array | string) =>
  createHash("sha256").update(raw).digest("hex");
const api = [
  "watchlist-restore-proof-entry",
  "watchlist-restore-proof-data",
  "watchlist-storage-restore-proof",
  "appwrite-storage-proof-phase",
  "appwrite-transport",
  "appwrite-versioned-row-store",
  "appwrite-versioned-resource-repository",
  "appwrite-watchlist-repository",
  "watchlist-repository",
].map((name) => `apps/api/src/${name}.ts`);
const builtins = new Set([
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
]);
const logical = (path: string) =>
  relative(root, resolve(root, path)).replaceAll(sep, "/");
async function pin(path: string) {
  const actual = await realpath(resolve(root, path));
  assert.ok(
    actual.startsWith(root + sep),
    "Restore-proof input escaped its checkout",
  );
  const bytes = await readFile(actual);
  return { path: logical(actual), bytes: bytes.length, sha256: hash(bytes) };
}
type Pin = Awaited<ReturnType<typeof pin>>;
const sources = await Promise.all(
  [
    ...api,
    "scripts/recovery/build-watchlist-restore-proof.ts",
    "pnpm-lock.yaml",
    "package.json",
    "apps/api/package.json",
    "apps/api/tsconfig.json",
    "tsconfig.base.json",
    "packages/contracts/package.json",
    "packages/personal-security-master/package.json",
    "THIRD_PARTY_NOTICES.md",
  ]
    .sort()
    .map(pin),
);
const appwriteRoot = dirname(
  await realpath(
    resolve(root, "apps/api/node_modules/node-appwrite/package.json"),
  ),
);
const undiciRoot = dirname(
  await realpath(resolve(root, "apps/api/node_modules/undici/package.json")),
);
const bigintRoot = dirname(
  await realpath(resolve(appwriteRoot, "../json-bigint/package.json")),
);
const vendors = [
  {
    root: appwriteRoot,
    name: "node-appwrite",
    version: "29.0.0",
    files: ["LICENSE"],
  },
  {
    root: undiciRoot,
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
const notices: Buffer[] = [
  Buffer.from("Watchlist isolated restore proof runtime notices\n", "utf8"),
];
const licensePins: Pin[] = [];
for (const vendor of vendors) {
  const manifestPin = await pin(resolve(vendor.root, "package.json"));
  const manifest = JSON.parse(
    await readFile(resolve(root, manifestPin.path), "utf8"),
  ) as { name?: unknown; version?: unknown };
  assert.equal(
    manifest.name,
    vendor.name,
    "Unreviewed restore-proof runtime package",
  );
  assert.equal(
    manifest.version,
    vendor.version,
    "Unreviewed restore-proof runtime version",
  );
  licensePins.push(manifestPin);
  for (const file of vendor.files) {
    const value = await pin(resolve(vendor.root, file));
    assert.ok(value.bytes >= 100, "Runtime license below proof bound");
    assert.ok(value.bytes <= 64 * 1024, "Runtime license exceeds proof bound");
    licensePins.push(value);
    notices.push(
      Buffer.from(`\n===== ${vendor.name}@${vendor.version}: ${file} =====\n`),
      await readFile(resolve(root, value.path)),
    );
  }
}
for (const file of [
  "lib/core/util.js",
  "lib/web/fetch/body.js",
  "lib/web/websocket/frame.js",
  "lib/web/websocket/receiver.js",
]) {
  const value = await pin(resolve(undiciRoot, file));
  licensePins.push(value);
  const lines = (await readFile(resolve(root, value.path), "utf8"))
    .split(/\r?\n/u)
    .filter(
      (line) =>
        /(?:Copyright|MIT License|MIT license)/u.test(line) &&
        line.length < 1024,
    );
  assert.ok(lines.length > 0, "Missing reviewed embedded license notice");
  notices.push(
    Buffer.from(
      `\n===== undici embedded notices: ${file} =====\n${lines.join("\n")}\n`,
    ),
  );
}
const noticeBytes = Buffer.concat(notices);
assert.ok(
  noticeBytes.length <= 1024 * 1024,
  "Runtime notices exceed proof bound",
);
const tsupRoot = dirname(
  await realpath(resolve(root, "node_modules/tsup/package.json")),
);
const esbuildRoot = dirname(
  await realpath(resolve(tsupRoot, "../esbuild/package.json")),
);
const typescriptRoot = dirname(
  await realpath(resolve(root, "node_modules/typescript/package.json")),
);
const toolPins = await Promise.all(
  [
    resolve(tsupRoot, "package.json"),
    resolve(tsupRoot, "dist/index.js"),
    resolve(typescriptRoot, "package.json"),
    resolve(typescriptRoot, "lib/typescript.js"),
    resolve(esbuildRoot, "package.json"),
    resolve(esbuildRoot, "lib/main.js"),
    resolve(
      esbuildRoot,
      `../@esbuild/${process.platform}-${process.arch}/${process.platform === "win32" ? "esbuild.exe" : "bin/esbuild"}`,
    ),
  ].map(pin),
);
const node = {
  version: process.version,
  sha256: hash(await readFile(process.execPath)),
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
type ModulePin = Pin & { imports: Graph["inputs"][string]["imports"] };

async function generateGraph(outDir: string, buildProof: string) {
  let graph: Graph | undefined;
  await build({
    config: false,
    tsconfig: resolve(root, "apps/api/tsconfig.json"),
    entry: {
      main: resolve(root, "apps/api/src/watchlist-restore-proof-entry.ts"),
    },
    outDir,
    format: ["esm"],
    platform: "node",
    target: "node24",
    splitting: false,
    sourcemap: false,
    minify: false,
    clean: false,
    noExternal: [/.*/u],
    metafile: false,
    define: { __WATCHLIST_RESTORE_PROOF_BUILD__: JSON.stringify(buildProof) },
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
    },
    esbuildPlugins: [
      {
        name: "restore-proof-fixed-graph",
        setup(context) {
          context.onEnd((result) => {
            assert.equal(
              result.warnings.length,
              0,
              "Restore-proof build warning requires review",
            );
            graph = result.metafile;
          });
        },
      },
    ],
    esbuildOptions(options) {
      options.absWorkingDir = root;
      options.legalComments = "inline";
      options.logOverride = {
        "unsupported-dynamic-import": "error",
        "unsupported-require-call": "error",
      };
    },
  });
  assert.ok(graph, "Missing proof graph");
  assert.ok(Object.keys(graph.inputs).length <= 2000, "Unbounded proof graph");
  return graph;
}

function validateOutputGraph(graph: Graph, outDir: string) {
  const outputs = Object.keys(graph.outputs);
  assert.equal(outputs.length, 1, "Unexpected restore-proof output graph");
  assert.equal(
    resolve(root, outputs[0]!),
    resolve(outDir, "main.js"),
    "Unexpected restore-proof output path",
  );
  const imports = Object.values(graph.outputs).flatMap(
    (output) => output.imports,
  );
  for (const item of imports) {
    assert.ok(
      item.external,
      "Unexpected internal restore-proof runtime import",
    );
    assert.ok(
      builtins.has(item.path.replace(/^node:/u, "")),
      "Unreviewed restore-proof runtime import",
    );
  }
}

async function validateOutputMember(outDir: string) {
  const entries = await readdir(outDir, { withFileTypes: true });
  assert.equal(entries.length, 1, "Unexpected restore-proof output member");
  const entry = entries[0]!;
  assert.equal(
    entry.name,
    "main.js",
    "Unexpected restore-proof output member name",
  );
  assert.ok(entry.isFile(), "Restore-proof output is not a file");
}

function isApplicationModule(path: string) {
  if (api.includes(path)) return true;
  return [
    "packages/contracts/src/",
    "packages/personal-security-master/src/",
  ].some((prefix) => path.startsWith(prefix));
}

async function pinGraphModule(path: string, input: Graph["inputs"][string]) {
  const value = await pin(path);
  const actual = resolve(root, value.path);
  const allowedVendor = vendors.some((vendor) =>
    actual.startsWith(vendor.root + sep),
  );
  assert.ok(
    isApplicationModule(value.path) || allowedVendor,
    "Unreviewed restore-proof module",
  );
  assert.doesNotMatch(
    value.path,
    /(?:\.test\.|\/test-)/u,
    "Test module cannot enter restore proof",
  );
  assert.equal(
    input.bytes,
    value.bytes,
    "Proof module changed during discovery",
  );
  return { ...value, imports: input.imports };
}

async function pinRuntimeGraph(graph: Graph) {
  const modules: ModulePin[] = [];
  for (const [path, input] of Object.entries(graph.inputs).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    modules.push(await pinGraphModule(path, input));
  }
  const paths = new Set(modules.map((inputPin) => inputPin.path));
  assert.ok(
    api.every((path) => paths.has(path)),
    "Missing application proof graph",
  );
  assert.ok(
    modules.reduce((sum, inputPin) => sum + inputPin.bytes, 0) <=
      64 * 1024 * 1024,
    "Unbounded application proof graph",
  );
  return modules;
}

async function bundle(outDir: string, buildProof: string) {
  const graph = await generateGraph(outDir, buildProof);
  validateOutputGraph(graph, outDir);
  await validateOutputMember(outDir);
  return pinRuntimeGraph(graph);
}
async function verify(pins: readonly Pin[]) {
  for (const value of pins) {
    assert.equal(
      JSON.stringify(await pin(value.path)),
      JSON.stringify({
        path: value.path,
        bytes: value.bytes,
        sha256: value.sha256,
      }),
      "Restore-proof source or tool changed during build",
    );
  }
  assert.equal(
    hash(await readFile(process.execPath)),
    node.sha256,
    "Proof Node changed during build",
  );
}
// Refuse redirected output ancestors before creating any artifact directory.
for (const path of [
  resolve(root, "dist"),
  resolve(root, "dist/managed-watchlist-restore-proof"),
]) {
  try {
    const entry = await lstat(path);
    assert.ok(
      entry.isDirectory(),
      "Restore-proof output ancestor is not a directory",
    );
    assert.ok(
      !entry.isSymbolicLink(),
      "Restore-proof output ancestor is redirected",
    );
    assert.equal(
      await realpath(path),
      path,
      "Restore-proof output ancestor is redirected",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
const parent = resolve(root, "dist/managed-watchlist-restore-proof");
await mkdir(parent, { recursive: true });
assert.equal(
  await realpath(parent),
  parent,
  "Proof output parent is redirected",
);
const discovery = await mkdtemp(resolve(parent, ".discovery-"));
const modules = await bundle(discovery, "0".repeat(64));
const pins = [...sources, ...toolPins, ...licensePins, ...modules];
await verify(pins);
const marker = {
  version: 1,
  planSha256: WATCHLIST_RESTORE_PROOF_PLAN_SHA256,
  target: WATCHLIST_RESTORE_PROOF_TARGET,
  phases: WATCHLIST_RESTORE_PROOF_PHASES,
  node,
  sources,
  tools: toolPins,
  runtimeLicenses: licensePins,
  modules,
  notices: { bytes: noticeBytes.length, sha256: hash(noticeBytes) },
};
const buildProof = hash(JSON.stringify(marker));
const outDir = resolve(parent, buildProof);
await mkdir(outDir); // Exclusive identity; preserve every prior artifact and failure.
const finalModules = await bundle(outDir, buildProof);
assert.equal(
  JSON.stringify(finalModules),
  JSON.stringify(modules),
  "Final restore-proof graph changed",
);
await verify(pins);
const artifact = await readFile(resolve(outDir, "main.js"));
assert.ok(
  artifact.length <= 8 * 1024 * 1024,
  "Restore-proof artifact exceeds its bound",
);
await writeFile(resolve(outDir, "THIRD_PARTY_NOTICES.txt"), noticeBytes, {
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
        "Fixed invented-data Watchlist restore qualification; not cloud backup/restore acceptance or operational authorization.",
      noticeScope:
        "Full installed licenses and embedded runtime notices for the four allowed vendor packages; frontend assets are absent.",
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
console.log(`Private Watchlist restore proof built: ${buildProof}`);
