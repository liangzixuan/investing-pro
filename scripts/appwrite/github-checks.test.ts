import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  CHECK_WORKFLOWS,
  createSourceCheckProof,
  validateSourceCheckProof,
  verifyGitHubChecks,
  type SourceCheckProof,
  type SourceProofContext,
  type WorkflowSources,
} from "./github-checks";

const repository = "example/investment";
const revision = "b".repeat(40);
const before = "a".repeat(40);
const context: SourceProofContext = {
  repository,
  sha: revision,
  ref: "refs/heads/main",
  ciRunId: "12345",
  ciRunAttempt: 2,
};
const event = {
  before,
  after: revision,
  ref: context.ref,
  repository: { full_name: repository },
  deleted: false,
  forced: false,
};
const sources = Object.fromEntries(
  CHECK_WORKFLOWS.map((path) => [
    path,
    readFileSync(resolve(import.meta.dirname, "../..", path), "utf8"),
  ]),
) as WorkflowSources;
const paths = ["package.json"];

function proofFor(
  changed = paths,
  workflowSources = sources,
): SourceCheckProof {
  return createSourceCheckProof(event, context, changed, workflowSources);
}

function runFor(index: number) {
  return {
    id: Number(context.ciRunId) + index,
    run_attempt: index === 0 ? context.ciRunAttempt : 1,
    path: CHECK_WORKFLOWS[index],
    event: "push",
    head_branch: "main",
    head_sha: revision,
    status: "completed",
    conclusion: "success",
    repository: { full_name: repository },
    head_repository: { full_name: repository },
  };
}

function responses(proof: SourceCheckProof): Map<string, unknown> {
  const result = new Map<string, unknown>();
  result.set(`/runs/${context.ciRunId}`, runFor(0));
  proof.workflows.forEach((workflow, index) => {
    const run = runFor(index);
    result.set(`/workflows/${workflow.path.split("/").at(-1)}/runs`, {
      total_count: 1,
      workflow_runs: [run],
    });
    result.set(`/runs/${run.id}/attempts/${run.run_attempt}/jobs`, {
      total_count: workflow.jobs.length,
      jobs: workflow.jobs.map((name) => ({
        name,
        run_id: run.id,
        run_attempt: run.run_attempt,
        head_sha: revision,
        status: "completed",
        conclusion: "success",
      })),
    });
  });
  return result;
}

function fakeGitHub(data: Map<string, unknown>) {
  return vi.fn<typeof fetch>((input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    expect(url.origin).toBe("https://api.github.com");
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const path = url.pathname.replace(`/repos/${repository}/actions`, "");
    if (path.startsWith("/workflows/")) {
      expect(Object.fromEntries(url.searchParams)).toEqual({
        branch: "main",
        event: "push",
        head_sha: revision,
        per_page: "100",
      });
    }
    expect(data.has(path)).toBe(true);
    return Promise.resolve(
      new Response(JSON.stringify(data.get(path)), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
}

describe("main-push source proof", () => {
  it("derives the actual six workflows and seven explicit jobs for a root manifest change", () => {
    const proof = proofFor();
    expect(proof.workflows.every((workflow) => workflow.required)).toBe(true);
    expect(proof.workflows.flatMap((workflow) => workflow.jobs)).toEqual([
      "Verify (ubuntu-latest)",
      "Verify (windows-latest)",
      "PostgreSQL 17.11 acceptance (Ubuntu 24.04)",
      "One-shot parser isolation (Ubuntu 24.04)",
      "Ten-fact parser execution (Ubuntu 24.04)",
      "Cross-engine parser execution (Ubuntu 24.04)",
      "Synthetic filing payload custody (Ubuntu 24.04)",
    ]);
    expect(
      proof.workflows.every((workflow) =>
        /^[a-f0-9]{64}$/u.test(workflow.sha256),
      ),
    ).toBe(true);
    expect(validateSourceCheckProof(proof, context, paths, sources)).toEqual(
      proof,
    );
  });

  it("requires only applicable acceptance workflows for a mobile-only change", () => {
    const proof = proofFor(["apps/web/mobile/main.tsx"]);
    expect(
      proof.workflows
        .filter((workflow) => workflow.required)
        .map((workflow) => workflow.path),
    ).toEqual([CHECK_WORKFLOWS[0], CHECK_WORKFLOWS[2]]);
  });

  it("requires the same acceptance jobs for a dependency-policy helper change as its boundary runner", () => {
    const runner = proofFor(["scripts/verify-boundaries.ts"]);
    const helper = proofFor(["scripts/boundaries/dependency-policy.ts"]);
    expect(helper.workflows).toEqual(runner.workflows);
    expect(
      helper.workflows
        .filter((workflow) => workflow.required)
        .map((workflow) => workflow.path),
    ).toEqual([
      CHECK_WORKFLOWS[0],
      CHECK_WORKFLOWS[2],
      CHECK_WORKFLOWS[3],
      CHECK_WORKFLOWS[4],
      CHECK_WORKFLOWS[5],
    ]);
  });

  it("uses every path in the complete push inventory, not only the final commit", () => {
    const proof = proofFor(["docs/CURRENT_WORK.md", "package.json"]);
    expect(proof.changedPaths).toEqual([
      "docs/CURRENT_WORK.md",
      "package.json",
    ]);
    expect(proof.workflows.every((workflow) => workflow.required)).toBe(true);
    expect(() =>
      validateSourceCheckProof(
        proof,
        context,
        ["docs/CURRENT_WORK.md"],
        sources,
      ),
    ).toThrow();
  });

  it.each([
    { before: "0".repeat(40) },
    { before: "HEAD~1" },
    { after: before },
    { ref: "refs/heads/other" },
    { repository: { full_name: "other/repository" } },
    { deleted: true },
    { forced: true },
  ])("rejects unsupported push metadata %#", (change) => {
    expect(() =>
      createSourceCheckProof({ ...event, ...change }, context, paths, sources),
    ).toThrow();
  });

  it.each([
    { changed: ["package.json", "package.json"] },
    { changed: ["../package.json"] },
    { changed: ["/package.json"] },
    { changed: ["apps\\web\\main.ts"] },
    { changed: ["file\nname"] },
    { changed: Array.from({ length: 2_049 }, (_, index) => `file${index}`) },
  ])("rejects unsafe or excessive path inventory %#", ({ changed }) => {
    expect(() => proofFor(changed)).toThrow();
  });

  it.each([
    { version: 2 },
    { sha: before },
    { ciRunId: "12346" },
    { ciRunAttempt: 0 },
    { repository: "other/repo" },
    { ref: "refs/heads/other" },
    { extra: true },
    { workflows: [] },
  ])("rejects changed artifact identity/schema %#", (change) => {
    expect(() =>
      validateSourceCheckProof(
        { ...proofFor(), ...change },
        context,
        paths,
        sources,
      ),
    ).toThrow();
  });

  it("rejects a source hash change and altered required-job decisions", () => {
    const proof = proofFor();
    expect(() =>
      validateSourceCheckProof(proof, context, paths, {
        ...sources,
        [CHECK_WORKFLOWS[0]]: `${sources[CHECK_WORKFLOWS[0]]}\n# changed\n`,
      }),
    ).toThrow();
    const tampered = structuredClone(proof);
    tampered.workflows[1]!.required = false;
    expect(() =>
      validateSourceCheckProof(tampered, context, paths, sources),
    ).toThrow();
  });

  it.each([
    "name: unsupported\non:\n  push:\n    branches: [main]\n    paths-ignore: [docs/**]\njobs: {}",
    'name: unsupported\non:\n  push:\n    branches: [main]\n    paths: ["!docs/**"]\njobs: {}',
    "name: unsupported\non:\n  push:\n    branches: [main]\njobs:\n  verify:\n    name: Verify\n    strategy:\n      matrix:\n        os: [ubuntu-latest, windows-latest]",
    "name: duplicate\nname: duplicate\non: {}",
  ])("fails closed on an unsupported workflow shape %#", (source) => {
    expect(() =>
      proofFor(paths, { ...sources, [CHECK_WORKFLOWS[0]]: source }),
    ).toThrow();
  });
});

describe("GitHub exact-revision completed checks", () => {
  it("verifies the latest exact attempts without re-running gates or polling", async () => {
    const proof = proofFor();
    const request = fakeGitHub(responses(proof));
    await expect(
      verifyGitHubChecks(proof, "synthetic-token", request),
    ).resolves.toEqual({ verifiedWorkflows: 6, verifiedJobs: 7 });
    expect(request).toHaveBeenCalledTimes(13);
  });

  it("does not demand path-filtered workflows that did not apply", async () => {
    const proof = proofFor(["apps/web/mobile/main.tsx"]);
    const request = fakeGitHub(responses(proof));
    await expect(
      verifyGitHubChecks(proof, "synthetic-token", request),
    ).resolves.toEqual({ verifiedWorkflows: 2, verifiedJobs: 3 });
    expect(request).toHaveBeenCalledTimes(5);
  });

  it("binds documented jobs without optional run_attempt through the attempt-specific endpoint", async () => {
    const proof = proofFor();
    const data = responses(proof);
    data.set("/runs/12345/attempts/2/jobs", {
      total_count: 2,
      jobs: proof.workflows[0]!.jobs.map((name) => ({
        name,
        run_id: 12345,
        head_sha: revision,
        status: "completed",
        conclusion: "success",
      })),
    });
    await expect(
      verifyGitHubChecks(proof, "synthetic-token", fakeGitHub(data)),
    ).resolves.toEqual({ verifiedWorkflows: 6, verifiedJobs: 7 });
  });

  it.each([
    { head_sha: before },
    { head_branch: "other" },
    { event: "pull_request" },
    { path: ".github/workflows/other.yml" },
    { repository: { full_name: "other/repo" } },
    { head_repository: { full_name: "other/repo" } },
    { status: "in_progress", conclusion: null },
    { status: "completed", conclusion: "failure" },
    { run_attempt: 3 },
    { id: 12346 },
  ])("rejects selected CI identity or attempt mismatch %#", async (change) => {
    const proof = proofFor();
    const data = responses(proof);
    data.set(`/runs/${context.ciRunId}`, { ...runFor(0), ...change });
    await expect(
      verifyGitHubChecks(proof, "synthetic-token", fakeGitHub(data)),
    ).rejects.toThrow("no deployment is authorized");
  });

  it.each(["failure", "cancelled", "skipped", null])(
    "does not fall back to an earlier success when the latest run is %s",
    async (conclusion) => {
      const proof = proofFor();
      const data = responses(proof);
      data.set("/workflows/postgres-acceptance.yml/runs", {
        total_count: 2,
        workflow_runs: [
          runFor(1),
          {
            ...runFor(1),
            id: 22346,
            status: conclusion === null ? "in_progress" : "completed",
            conclusion,
          },
        ],
      });
      await expect(
        verifyGitHubChecks(proof, "synthetic-token", fakeGitHub(data)),
      ).rejects.toThrow("no deployment is authorized");
    },
  );

  it("requires the selected source artifact to come from the latest CI run", async () => {
    const proof = proofFor();
    const data = responses(proof);
    data.set("/workflows/ci.yml/runs", {
      total_count: 2,
      workflow_runs: [runFor(0), { ...runFor(0), id: 22345 }],
    });
    await expect(
      verifyGitHubChecks(proof, "synthetic-token", fakeGitHub(data)),
    ).rejects.toThrow();
  });

  it.each([
    { status: "in_progress", conclusion: null },
    { conclusion: "skipped" },
    { conclusion: "failure" },
    { name: "Different job" },
    { run_id: 999 },
    { run_attempt: 1 },
    { head_sha: before },
  ])(
    "rejects incomplete, wrong or superseded job evidence %#",
    async (change) => {
      const proof = proofFor();
      const data = responses(proof);
      data.set("/runs/12345/attempts/2/jobs", {
        total_count: 2,
        jobs: proof.workflows[0]!.jobs.map((name, index) => ({
          name,
          run_id: 12345,
          run_attempt: 2,
          head_sha: revision,
          status: "completed",
          conclusion: "success",
          ...(index === 0 ? change : {}),
        })),
      });
      await expect(
        verifyGitHubChecks(proof, "synthetic-token", fakeGitHub(data)),
      ).rejects.toThrow();
    },
  );

  it.each([
    { total_count: 0, workflow_runs: [] },
    { total_count: 101, workflow_runs: [runFor(1)] },
    { total_count: 2, workflow_runs: [runFor(1)] },
  ])(
    "rejects missing or truncated required-run results %#",
    async (response) => {
      const proof = proofFor();
      const data = responses(proof);
      data.set("/workflows/postgres-acceptance.yml/runs", response);
      await expect(
        verifyGitHubChecks(proof, "synthetic-token", fakeGitHub(data)),
      ).rejects.toThrow();
    },
  );

  it("does not reveal upstream errors or response payloads", async () => {
    const request = vi.fn<typeof fetch>(() =>
      Promise.reject(new Error("synthetic-private-token")),
    );
    await expect(
      verifyGitHubChecks(proofFor(), "synthetic-private-token", request),
    ).rejects.toThrow(
      /^Source-check verification failed; no deployment is authorized\.$/u,
    );
    const badJson = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response("synthetic-private-response")),
    );
    await expect(
      verifyGitHubChecks(proofFor(), "synthetic-token", badJson),
    ).rejects.toThrow(
      /^Source-check verification failed; no deployment is authorized\.$/u,
    );
  });

  it("rejects oversized decoded response streams and cancels the reader", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(1_048_577));
      },
      cancel,
    });
    const request = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(body)),
    );
    await expect(
      verifyGitHubChecks(proofFor(), "synthetic-token", request),
    ).rejects.toThrow();
    expect(cancel).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
  });

  it("stops on HTTP errors without consuming error text", async () => {
    const request = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response("synthetic-private-error", { status: 403 })),
    );
    await expect(
      verifyGitHubChecks(proofFor(), "synthetic-token", request),
    ).rejects.toThrow(
      /^Source-check verification failed; no deployment is authorized\.$/u,
    );
    expect(request).toHaveBeenCalledOnce();
  });
});
