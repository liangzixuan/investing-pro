import assert from "node:assert/strict";
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
interface BundleJob {
  readonly outDir: string;
  readonly buildProof: string;
  readonly policy: BundlePolicy;
}
interface OutputGraph {
  job: BundleJob;
  graph: Graph;
}
interface GraphModule {
  path: string;
  input: Graph["inputs"][string];
  policy: BundlePolicy;
}

async function compileGraph(job: BundleJob) {
  const {
    outDir,
    buildProof,
    policy: { root },
  } = job;
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
            assert(
              !(result.warnings.length > 0),
              new Error("Proof build warning requires review"),
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
  assert(graph, new Error("Missing or unbounded proof module graph"));
  assert(
    Object.keys(graph.inputs).length <= 2000,
    new Error("Missing or unbounded proof module graph"),
  );
  return graph;
}

async function requireSingleOutput(output: OutputGraph) {
  const {
    graph,
    job: {
      outDir,
      policy: { root },
    },
  } = output;
  const paths = Object.keys(graph.outputs);
  assert(paths.length === 1, new Error("Unexpected proof build output"));
  assert(
    resolve(root, paths[0]!) === resolve(outDir, "main.js"),
    new Error("Unexpected proof build output"),
  );
  await requireMainOutputMember(output);
}

async function requireMainOutputMember(output: OutputGraph) {
  const entries = await readdir(output.job.outDir, { withFileTypes: true });
  assert(
    entries.length === 1,
    new Error("Unexpected proof output directory member"),
  );
  assert(
    entries[0]?.name === "main.js",
    new Error("Unexpected proof output directory member"),
  );
  assert(
    entries[0].isFile(),
    new Error("Unexpected proof output directory member"),
  );
}

function requireExecutionModule(candidate: GraphModule) {
  assert(
    !candidate.path.startsWith("scripts/"),
    new Error("Unrelated execution module in proof bundle"),
  );
  assert(
    !/(?:\.test\.|\/test-|(?:^|\/)(?:clerk-trial-proof-entry|managed-workspace-handler|managed-workspace-function)\.)/u.test(
      candidate.path,
    ),
    new Error("Unrelated execution module in proof bundle"),
  );
}

function requireDependencyModule(candidate: GraphModule) {
  assert(
    candidate.policy.dependencyRoots.some((root) =>
      candidate.path.startsWith(root + "/"),
    ),
    new Error("Unreviewed third-party proof module"),
  );
}

function admitModule(candidate: GraphModule) {
  requireExecutionModule(candidate);
  if (candidate.path.startsWith("node_modules/")) {
    requireDependencyModule(candidate);
  } else {
    assert(
      candidate.policy.sourcePaths.has(candidate.path),
      new Error("Unbound application module in proof bundle"),
    );
  }
}

async function modulePin(candidate: GraphModule) {
  const { path, input, policy } = candidate;
  const normalized = relative(
    policy.root,
    resolve(policy.root, path),
  ).replaceAll(sep, "/");
  admitModule({ ...candidate, path: normalized });
  const file = await policy.pin(normalized);
  assert(
    input.bytes === file.bytes,
    new Error("Proof module changed during graph discovery"),
  );
  return { ...file, imports: input.imports };
}

function requireBuiltinImports(output: OutputGraph) {
  const {
    graph,
    job: {
      policy: { builtinImports: admitted },
    },
  } = output;
  for (const output of Object.values(graph.outputs)) {
    for (const item of output.imports) {
      assert(item.external, new Error("External proof runtime import"));
      assert(
        admitted.includes(item.path.replace(/^node:/u, "")),
        new Error("External proof runtime import"),
      );
    }
  }
}

export async function bundleValuationProof(input: BundleJob) {
  const job = Object.freeze({
    outDir: input.outDir,
    buildProof: input.buildProof,
    policy: input.policy,
  });
  const { policy } = job;
  const graph = await compileGraph(job);
  const output = { job, graph };
  await requireSingleOutput(output);
  const modules = await Promise.all(
    Object.keys(graph.inputs)
      .sort()
      .map((path) => modulePin({ path, input: graph.inputs[path]!, policy })),
  );
  assert(
    !policy.api.some((path) => !modules.some((item) => item.path === path)),
    new Error("Required valuation proof module missing"),
  );
  assert(
    modules.reduce((sum, item) => sum + item.bytes, 0) <= 64 * 1024 * 1024,
    new Error("Proof module bound exceeded"),
  );
  requireBuiltinImports(output);
  return modules;
}
