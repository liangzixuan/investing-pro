import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { JSON_SCHEMA, load } from "js-yaml";
import { minimatch } from "minimatch";

export const CHECK_WORKFLOWS = [
  ".github/workflows/ci.yml",
  ".github/workflows/postgres-acceptance.yml",
  ".github/workflows/filing-parser-acceptance.yml",
  ".github/workflows/filing-parser-normalization-execution-acceptance.yml",
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  ".github/workflows/filing-payload-custody-acceptance.yml",
  ".github/workflows/android-emulator.yml",
] as const;

type WorkflowPath = (typeof CHECK_WORKFLOWS)[number];
export type WorkflowSources = Record<WorkflowPath, string>;

export interface SourceProofContext {
  repository: string;
  sha: string;
  ref: string;
  ciRunId: string;
  ciRunAttempt: number;
}

export interface SourceCheckProof extends SourceProofContext {
  version: 1;
  before: string;
  changedPaths: string[];
  workflows: {
    path: WorkflowPath;
    sha256: string;
    required: boolean;
    jobs: string[];
  }[];
}

const MAIN_REF = "refs/heads/main";
const MAX_FILE_BYTES = 500_000;
const MAX_RESPONSE_BYTES = 1_048_576;
const MAX_TOTAL_BYTES = 4 * MAX_RESPONSE_BYTES;
const MAX_REQUESTS = 1 + 2 * CHECK_WORKFLOWS.length;
const FAILURE =
  "Source-check verification failed; no deployment is authorized.";

function requireValue(condition: unknown): asserts condition {
  if (!condition) throw new Error(FAILURE);
}

function record(value: unknown): Record<string, unknown> {
  requireValue(
    value !== null && typeof value === "object" && !Array.isArray(value),
  );
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[]): void {
  requireValue(Object.keys(value).sort().join("\0") === keys.sort().join("\0"));
}

function sha(value: unknown): asserts value is string {
  requireValue(typeof value === "string" && /^[a-f0-9]{40}$/u.test(value));
  requireValue(value !== "0".repeat(40));
}

function runId(value: unknown): asserts value is string {
  requireValue(typeof value === "string" && /^[1-9][0-9]{0,14}$/u.test(value));
  requireValue(Number.isSafeInteger(Number(value)));
}

function validateContext(context: SourceProofContext): void {
  requireValue(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(context.repository));
  sha(context.sha);
  runId(context.ciRunId);
  requireValue(context.ref === MAIN_REF);
  requireValue(
    Number.isSafeInteger(context.ciRunAttempt) && context.ciRunAttempt > 0,
  );
}

function pathInventory(input: readonly string[]): string[] {
  requireValue(input.length > 0 && input.length <= 2_048);
  const paths = [...input].sort();
  requireValue(new Set(paths).size === paths.length);
  for (const path of paths) {
    requireValue(
      path.length > 0 &&
        path.length <= 512 &&
        [...path].every(
          (character) =>
            character.charCodeAt(0) >= 32 &&
            character.charCodeAt(0) !== 127 &&
            character !== "\\",
        ) &&
        !path.startsWith("/") &&
        path
          .split("/")
          .every((part) => part !== "" && part !== "." && part !== ".."),
    );
  }
  return paths;
}

function stringList(value: unknown): string[] {
  requireValue(Array.isArray(value) && value.length > 0 && value.length <= 512);
  requireValue(
    value.every(
      (entry) =>
        typeof entry === "string" && entry.length > 0 && entry.length <= 512,
    ),
  );
  return value as string[];
}

function workflowJobs(workflow: Record<string, unknown>): string[] {
  const jobs = Object.values(record(workflow.jobs));
  requireValue(jobs.length > 0 && jobs.length <= 16);
  const names: string[] = [];
  for (const input of jobs) {
    const job = record(input);
    requireValue(typeof job.name === "string" && job.name.length <= 160);
    // The existing acceptance jobs have fixed names. CI has one include-only OS matrix.
    if (job.strategy === undefined) {
      requireValue(!job.name.includes("${{"));
      names.push(job.name);
      continue;
    }
    const strategy = record(job.strategy);
    requireValue(
      Object.keys(strategy).every((key) =>
        ["fail-fast", "matrix"].includes(key),
      ),
    );
    const matrix = record(strategy.matrix);
    exactKeys(matrix, ["include"]);
    requireValue(
      Array.isArray(matrix.include) &&
        matrix.include.length > 0 &&
        matrix.include.length <= 8,
    );
    const nameTemplate = job.name;
    for (const row of matrix.include) {
      const values = record(row);
      const name = nameTemplate.replace(
        /\$\{\{\s*matrix\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/gu,
        (_match, key: string) => {
          const value = values[key];
          requireValue(
            typeof value === "string" && /^[A-Za-z0-9_.-]{1,64}$/u.test(value),
          );
          return value;
        },
      );
      requireValue(!name.includes("${{"));
      names.push(name);
    }
  }
  requireValue(new Set(names).size === names.length);
  return names.sort();
}

function classifyWorkflows(
  sources: WorkflowSources,
  paths: string[],
): SourceCheckProof["workflows"] {
  return CHECK_WORKFLOWS.map((path) => {
    const source = sources[path];
    requireValue(
      typeof source === "string" && Buffer.byteLength(source) <= MAX_FILE_BYTES,
    );
    const workflow = record(load(source, { schema: JSON_SCHEMA }));
    const push = record(record(workflow.on).push);
    requireValue(
      Object.keys(push).every((key) => ["branches", "paths"].includes(key)),
    );
    requireValue(JSON.stringify(stringList(push.branches)) === '["main"]');
    const patterns =
      push.paths === undefined ? undefined : stringList(push.paths);
    // These workflows use positive literal/*/** patterns only; refuse new glob semantics.
    requireValue(
      patterns?.every((pattern) => !/[!+?@(){}[\]\\]/u.test(pattern)) ?? true,
    );
    const required =
      patterns === undefined ||
      paths.some((changed) =>
        patterns.some((pattern) =>
          minimatch(changed, pattern, {
            dot: true,
            nonegate: true,
            noext: true,
          }),
        ),
      );
    return {
      path,
      sha256: createHash("sha256").update(source).digest("hex"),
      required,
      jobs: workflowJobs(workflow),
    };
  });
}

export function createSourceCheckProof(
  eventInput: unknown,
  context: SourceProofContext,
  changedPaths: readonly string[],
  sources: WorkflowSources,
): SourceCheckProof {
  validateContext(context);
  const event = record(eventInput);
  sha(event.before);
  requireValue(event.after === context.sha && event.ref === MAIN_REF);
  requireValue(record(event.repository).full_name === context.repository);
  requireValue(event.deleted === false && event.forced === false);
  const paths = pathInventory(changedPaths);
  const workflows = classifyWorkflows(sources, paths);
  requireValue(workflows[0]?.required);
  return {
    version: 1,
    ...context,
    before: event.before,
    changedPaths: paths,
    workflows,
  };
}

export function validateSourceCheckProof(
  input: unknown,
  expected: Pick<SourceProofContext, "repository" | "sha" | "ciRunId">,
  changedPaths: readonly string[],
  sources: WorkflowSources,
): SourceCheckProof {
  const proof = record(input);
  exactKeys(proof, [
    "version",
    "repository",
    "sha",
    "ref",
    "ciRunId",
    "ciRunAttempt",
    "before",
    "changedPaths",
    "workflows",
  ]);
  requireValue(
    proof.version === 1 &&
      proof.repository === expected.repository &&
      proof.sha === expected.sha &&
      proof.ciRunId === expected.ciRunId,
  );
  requireValue(typeof proof.ciRunAttempt === "number");
  const rebuilt = createSourceCheckProof(
    {
      before: proof.before,
      after: expected.sha,
      ref: proof.ref,
      repository: { full_name: expected.repository },
      deleted: false,
      forced: false,
    },
    { ...expected, ref: String(proof.ref), ciRunAttempt: proof.ciRunAttempt },
    changedPaths,
    sources,
  );
  requireValue(
    JSON.stringify(proof.changedPaths) === JSON.stringify(rebuilt.changedPaths),
  );
  requireValue(
    JSON.stringify(proof.workflows) === JSON.stringify(rebuilt.workflows),
  );
  return rebuilt;
}

interface GitHubRun {
  id: number;
  run_attempt: number;
  path: string;
  event: string;
  head_branch: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
  repository: { full_name: string };
  head_repository: { full_name: string };
}

function checkedRun(
  input: unknown,
  proof: SourceCheckProof,
  path: WorkflowPath,
): GitHubRun {
  const run = record(input);
  requireValue(Number.isSafeInteger(run.id) && Number(run.id) > 0);
  requireValue(
    Number.isSafeInteger(run.run_attempt) && Number(run.run_attempt) > 0,
  );
  requireValue(
    run.path === path &&
      run.event === "push" &&
      run.head_branch === "main" &&
      run.head_sha === proof.sha,
  );
  requireValue(
    record(run.repository).full_name === proof.repository &&
      record(run.head_repository).full_name === proof.repository,
  );
  requireValue(run.status === "completed" && run.conclusion === "success");
  return run as unknown as GitHubRun;
}

function resultList(input: unknown, key: string): unknown[] {
  const value = record(input);
  requireValue(Array.isArray(value[key]));
  const entries = value[key];
  requireValue(
    Number.isSafeInteger(value.total_count) &&
      value.total_count === entries.length &&
      entries.length > 0 &&
      entries.length <= 100,
  );
  return entries;
}

export async function verifyGitHubChecks(
  proof: SourceCheckProof,
  token: string,
  request: typeof fetch = fetch,
): Promise<{ verifiedWorkflows: number; verifiedJobs: number }> {
  try {
    validateContext(proof);
    requireValue(
      token.length > 0 && token.length <= 1_024 && !/[\r\n]/u.test(token),
    );
    const repository = proof.repository
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const root = `https://api.github.com/repos/${repository}/actions`;
    const lifetime = AbortSignal.timeout(90_000);
    let requests = 0;
    let totalBytes = 0;
    const get = async (path: string): Promise<unknown> => {
      requireValue(++requests <= MAX_REQUESTS && !lifetime.aborted);
      const controller = new AbortController();
      try {
        const response = await request(`${root}${path}`, {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.any([
            controller.signal,
            lifetime,
            AbortSignal.timeout(10_000),
          ]),
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });
        if (!response.ok || response.redirected || response.body === null) {
          await response.body?.cancel().catch(() => undefined);
          throw new Error(FAILURE);
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            totalBytes += chunk.value.byteLength;
            requireValue(
              bytes <= MAX_RESPONSE_BYTES && totalBytes <= MAX_TOTAL_BYTES,
            );
            chunks.push(chunk.value);
          }
          return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
        } finally {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
      } finally {
        controller.abort();
      }
    };

    const selected = checkedRun(
      await get(`/runs/${proof.ciRunId}`),
      proof,
      CHECK_WORKFLOWS[0],
    );
    requireValue(
      String(selected.id) === proof.ciRunId &&
        selected.run_attempt === proof.ciRunAttempt,
    );
    let verifiedJobs = 0;
    const required = proof.workflows.filter((workflow) => workflow.required);
    for (const workflow of required) {
      const filename = workflow.path.split("/").at(-1);
      requireValue(filename);
      const candidates = resultList(
        await get(
          `/workflows/${encodeURIComponent(filename)}/runs?branch=main&event=push&head_sha=${proof.sha}&per_page=100`,
        ),
        "workflow_runs",
      );
      // A newer failed/pending attempt supersedes an older success; never search for a green run.
      const ordered = candidates
        .map(record)
        .sort((left, right) => Number(right.id) - Number(left.id));
      requireValue(
        ordered.every(
          (run) => Number.isSafeInteger(run.id) && Number(run.id) > 0,
        ),
      );
      const latest = checkedRun(ordered[0], proof, workflow.path);
      if (workflow.path === CHECK_WORKFLOWS[0]) {
        requireValue(
          latest.id === selected.id &&
            latest.run_attempt === selected.run_attempt,
        );
      }
      const jobs = resultList(
        await get(
          `/runs/${latest.id}/attempts/${latest.run_attempt}/jobs?per_page=100`,
        ),
        "jobs",
      ).map(record);
      requireValue(jobs.length === workflow.jobs.length);
      requireValue(
        JSON.stringify(jobs.map((job) => job.name).sort()) ===
          JSON.stringify(workflow.jobs),
      );
      requireValue(
        jobs.every(
          (job) =>
            job.run_id === latest.id &&
            (job.run_attempt === undefined ||
              job.run_attempt === latest.run_attempt) &&
            job.head_sha === proof.sha &&
            job.status === "completed" &&
            job.conclusion === "success",
        ),
      );
      verifiedJobs += jobs.length;
    }
    return { verifiedWorkflows: required.length, verifiedJobs };
  } catch {
    throw new Error(FAILURE);
  }
}

async function boundedFile(path: string): Promise<string> {
  requireValue((await stat(path)).size <= MAX_FILE_BYTES);
  const text = await readFile(path, "utf8");
  requireValue(Buffer.byteLength(text) <= MAX_FILE_BYTES);
  return text;
}

function gitText(root: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: MAX_FILE_BYTES,
    windowsHide: true,
  });
  requireValue(!result.error && result.status === 0);
  return result.stdout;
}

function gitInventory(
  root: string,
  before: unknown,
  revision: unknown,
): string[] {
  sha(before);
  sha(revision);
  requireValue(gitText(root, ["rev-parse", "HEAD"]).trim() === revision);
  const output = gitText(root, [
    "diff",
    "--name-only",
    "--no-renames",
    "-z",
    before,
    revision,
    "--",
  ]);
  requireValue(output.endsWith("\0"));
  return output.slice(0, -1).split("\0");
}

export async function main(
  args: string[],
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const sources = Object.fromEntries(
    await Promise.all(
      CHECK_WORKFLOWS.map(async (path) => [
        path,
        await boundedFile(resolve(root, path)),
      ]),
    ),
  ) as WorkflowSources;
  const repository = environment.GITHUB_REPOSITORY ?? "";
  const revision = environment.GITHUB_SHA ?? "";
  requireValue(environment.GITHUB_REF === MAIN_REF);
  if (args.length === 3 && args[0] === "capture" && args[1] === "--output") {
    requireValue(
      environment.GITHUB_EVENT_NAME === "push" &&
        environment.GITHUB_EVENT_PATH &&
        args[2],
    );
    const event = record(
      JSON.parse(await boundedFile(environment.GITHUB_EVENT_PATH)) as unknown,
    );
    const proof = createSourceCheckProof(
      event,
      {
        repository,
        sha: revision,
        ref: MAIN_REF,
        ciRunId: environment.GITHUB_RUN_ID ?? "",
        ciRunAttempt: Number(environment.GITHUB_RUN_ATTEMPT),
      },
      gitInventory(root, event.before, revision),
      sources,
    );
    const output = resolve(args[2]);
    const text = `${JSON.stringify(proof, null, 2)}\n`;
    requireValue(Buffer.byteLength(text) <= MAX_FILE_BYTES);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, text, { flag: "wx" });
    console.log("Exact main-push source-check proof written.");
    return;
  }
  requireValue(
    args.length === 5 &&
      args[0] === "verify" &&
      args[1] === "--proof" &&
      args[3] === "--ci-run-id" &&
      args[2] &&
      args[4],
  );
  requireValue(environment.GITHUB_EVENT_NAME === "workflow_dispatch");
  const input = record(
    JSON.parse(await boundedFile(resolve(args[2]))) as unknown,
  );
  const proof = validateSourceCheckProof(
    input,
    { repository, sha: revision, ciRunId: args[4] },
    gitInventory(root, input.before, revision),
    sources,
  );
  const result = await verifyGitHubChecks(proof, environment.GH_TOKEN ?? "");
  console.log(
    `Exact revision passed ${result.verifiedWorkflows} required workflows and ${result.verifiedJobs} jobs.`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main(process.argv.slice(2), process.env).catch(() => {
    console.error(FAILURE);
    process.exitCode = 1;
  });
}
