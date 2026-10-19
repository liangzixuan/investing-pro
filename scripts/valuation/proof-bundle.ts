import { readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { build } from "tsup";

interface FilePin {
  path: string;
  bytes: number;
  sha256: string;
}
interface Graph {
  inputs: Record<
    string,
    {
      bytes: number;
      imports: { path: string; kind: string; external?: boolean }[];
    }
  >;
  outputs: Record<string, { imports: { path: string; external?: boolean }[] }>;
}
interface BundlePolicy {
  root: string;
  api: readonly string[];
  sourcePaths: ReadonlySet<string>;
  dependencyRoots: readonly string[];
  builtinImports: readonly string[];
  pin(path: string): Promise<FilePin>;
}

async function compileGraph(root: string, outDir: string, buildProof: string) {
  let graph: Graph | undefined;
  await build({
    config: false,
    tsconfig: resolve(root, "apps/api/tsconfig.json"),
    entry: {
      main: resolve(root, "apps/api/src/valuation-assumptions-proof-entry.ts"),
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
    define: { __VALUATION_PROOF_BUILD__: JSON.stringify(buildProof) },
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
    },
    esbuildPlugins: [
      {
        name: "fixed-valuation-proof-inputs",
        setup(context) {
          context.onEnd((result) => {
            if (result.warnings.length > 0)
              throw new Error("Proof build warning requires review");
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
  if (!graph || Object.keys(graph.inputs).length > 2000)
    throw new Error("Missing or unbounded proof module graph");
  return graph;
}

async function requireSingleOutput(graph: Graph, root: string, outDir: string) {
  const paths = Object.keys(graph.outputs);
  if (
    paths.length !== 1 ||
    resolve(root, paths[0]!) !== resolve(outDir, "main.js")
  )
    throw new Error("Unexpected proof build output");
  const entries = await readdir(outDir, { withFileTypes: true });
  if (
    entries.length !== 1 ||
    entries[0]?.name !== "main.js" ||
    !entries[0].isFile()
  )
    throw new Error("Unexpected proof output directory member");
}

function admitModule(path: string, policy: BundlePolicy) {
  if (
    path.startsWith("scripts/") ||
    /(?:\.test\.|\/test-|(?:^|\/)(?:clerk-trial-proof-entry|managed-workspace-handler|managed-workspace-function)\.)/u.test(
      path,
    )
  )
    throw new Error("Unrelated execution module in proof bundle");
  if (path.startsWith("node_modules/")) {
    if (!policy.dependencyRoots.some((root) => path.startsWith(root + "/")))
      throw new Error("Unreviewed third-party proof module");
  } else if (!policy.sourcePaths.has(path)) {
    throw new Error("Unbound application module in proof bundle");
  }
}

async function modulePin(
  path: string,
  input: Graph["inputs"][string],
  policy: BundlePolicy,
) {
  const normalized = relative(
    policy.root,
    resolve(policy.root, path),
  ).replaceAll(sep, "/");
  admitModule(normalized, policy);
  const file = await policy.pin(normalized);
  if (input.bytes !== file.bytes)
    throw new Error("Proof module changed during graph discovery");
  return { ...file, imports: input.imports };
}

function requireBuiltinImports(graph: Graph, admitted: readonly string[]) {
  for (const output of Object.values(graph.outputs)) {
    for (const item of output.imports) {
      if (
        !item.external ||
        !admitted.includes(item.path.replace(/^node:/u, ""))
      )
        throw new Error("External proof runtime import");
    }
  }
}

export async function bundleValuationProof(
  outDir: string,
  buildProof: string,
  policy: BundlePolicy,
) {
  const graph = await compileGraph(policy.root, outDir, buildProof);
  await requireSingleOutput(graph, policy.root, outDir);
  const modules = await Promise.all(
    Object.keys(graph.inputs)
      .sort()
      .map((path) => modulePin(path, graph.inputs[path]!, policy)),
  );
  if (policy.api.some((path) => !modules.some((item) => item.path === path)))
    throw new Error("Required valuation proof module missing");
  if (modules.reduce((sum, item) => sum + item.bytes, 0) > 64 * 1024 * 1024)
    throw new Error("Proof module bound exceeded");
  requireBuiltinImports(graph, policy.builtinImports);
  return modules;
}
