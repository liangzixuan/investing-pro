import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { JSON_SCHEMA, load } from "js-yaml";
import {
  CHECK_WORKFLOWS,
  createSourceCheckProof,
  type SourceCheckProof,
  type WorkflowSources,
} from "./github-checks";
import {
  selectProduct,
  verifyProductSource,
  type ControllerContext,
} from "./product-source";

const repository = "example/investment";
let root: string;
let productRoot: string;
let sourceSha: string;
let unrelated: string;
let controller: ControllerContext;
let proof: SourceCheckProof;
const selection = () => ({ sourceSha, ciRunId: "12345", ciRunAttempt: 2 });
function git(directory: string, ...args: string[]) {
  return execFileSync(
    "git",
    [
      "-c",
      "user.name=Release Test",
      "-c",
      "user.email=release@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.autocrlf=false",
      "-c",
      `core.hooksPath=${resolve(root, "no-hooks")}`,
      ...args,
    ],
    { cwd: directory, encoding: "utf8", windowsHide: true, timeout: 10_000 },
  ).trim();
}

beforeAll(async () => {
  root = await mkdtemp(resolve(tmpdir(), "investment-product-source-"));
  await mkdir(resolve(root, "no-hooks"));
  git(root, "init", "-q", "-b", "main");
  const sources = Object.fromEntries(
    await Promise.all(
      CHECK_WORKFLOWS.map(async (path) => {
        const text = await readFile(
          resolve(import.meta.dirname, "../..", path),
          "utf8",
        );
        await mkdir(dirname(resolve(root, path)), { recursive: true });
        await writeFile(resolve(root, path), text);
        return [path, text];
      }),
    ),
  ) as WorkflowSources;
  await writeFile(resolve(root, ".gitignore"), "release-product/\nno-hooks/\n");
  await writeFile(resolve(root, "package.json"), '{"version":"0"}\n');
  git(root, "add", ".");
  git(root, "commit", "-qm", "Base fixture");
  const before = git(root, "rev-parse", "HEAD");
  await writeFile(resolve(root, "package.json"), '{"version":"1"}\n');
  git(root, "commit", "-qam", "Product fixture");
  sourceSha = git(root, "rev-parse", "HEAD");
  proof = createSourceCheckProof(
    {
      before,
      after: sourceSha,
      ref: "refs/heads/main",
      repository: { full_name: repository },
      deleted: false,
      forced: false,
    },
    {
      repository,
      sha: sourceSha,
      ref: "refs/heads/main",
      ciRunId: "12345",
      ciRunAttempt: 2,
    },
    ["package.json"],
    sources,
  );
  await writeFile(
    resolve(root, "controller.txt"),
    "Separate accepted controller fixture\n",
  );
  git(root, "add", "controller.txt");
  git(root, "commit", "-qm", "Controller fixture");
  controller = {
    sha: git(root, "rev-parse", "HEAD"),
    repository,
    ref: "refs/heads/main",
    event: "workflow_dispatch",
  };
  git(root, "checkout", "--orphan", "unrelated");
  git(root, "commit", "-qm", "Unrelated fixture");
  unrelated = git(root, "rev-parse", "HEAD");
  git(root, "checkout", "-q", "main");
  productRoot = resolve(root, "release-product");
  git(root, "clone", "-q", "--no-hardlinks", root, productRoot);
  git(productRoot, "checkout", "-q", "--detach", sourceSha);
});

describe("selected-product release workflow", () => {
  it("keeps both source gates before product code and the mandatory staging/browser/production sequence", async () => {
    const document = load(
      await readFile(
        resolve(
          import.meta.dirname,
          "../../.github/workflows/appwrite-site-release.yml",
        ),
        "utf8",
      ),
      { schema: JSON_SCHEMA },
    ) as {
      on: {
        workflow_dispatch: { inputs: Record<string, { required: boolean }> };
      };
      concurrency: { group: string; "cancel-in-progress": boolean };
      jobs: Record<
        string,
        { if: string; needs?: string; steps: Record<string, unknown>[] }
      >;
    };
    for (const key of [
      "ci_run_id",
      "ci_run_attempt",
      "product_source_sha",
      "product_ci_run_id",
      "product_ci_run_attempt",
    ])
      expect(document.on.workflow_dispatch.inputs[key]?.required).toBe(true);
    expect(document.concurrency).toEqual({
      group: "browserstack-deployed-preview-smoke",
      "cancel-in-progress": false,
    });
    const staging = document.jobs.staging!;
    expect(staging.if).toBe("github.ref == 'refs/heads/main'");
    const steps = staging.steps;
    const index = (name: string) => {
      const matches = steps
        .map((step, position) => (step.name === name ? position : -1))
        .filter((position) => position >= 0);
      expect(matches).toHaveLength(1);
      return matches[0]!;
    };
    const controllerGate = index("Verify actual applicable GitHub checks");
    const productGate = index(
      "Verify the selected main product and its actual checks",
    );
    const installProduct = index("Install exact product dependencies");
    const build = index("Build the production Clerk static site");
    const pack = index("Package the exact artifact");
    const stage = index("Deploy and activate staging");
    const browser = index("Test this exact build on BrowserStack");
    const acceptance = index("Record successful staging acceptance");
    expect(controllerGate).toBeLessThan(productGate);
    expect(productGate).toBeLessThan(installProduct);
    expect(installProduct).toBeLessThan(build);
    expect(build).toBeLessThan(pack);
    expect(pack).toBeLessThan(stage);
    expect(steps[pack]?.run).toContain(
      "cp dist/source-proof/source-proof.json dist/appwrite-release/controller-source-proof.json",
    );
    expect(steps[pack]?.run).toContain(
      "cp dist/product-source-proof/source-proof.json dist/appwrite-release/product-source-proof.json",
    );
    expect(stage).toBeLessThan(browser);
    expect(browser).toBeLessThan(acceptance);
    for (const position of [
      controllerGate,
      productGate,
      stage,
      browser,
      acceptance,
    ]) {
      expect(steps[position]).not.toHaveProperty("continue-on-error");
      expect(steps[position]).not.toHaveProperty("if");
    }
    expect(steps[build]?.["working-directory"]).toBe("release-product");
    expect(
      (steps[build]?.env as Record<string, string>).INVESTMENT_BUILD_SHA,
    ).toBe("${{ inputs.product_source_sha }}");
    expect(
      (steps[browser]?.env as Record<string, string>)
        .INVESTMENT_EXPECTED_BUILD_SHA,
    ).toBe("${{ inputs.product_source_sha }}");
    expect(steps[browser]?.run).toBe(
      "pnpm exec tsx scripts/browserstack/run-web.ts --run-staging",
    );
    for (const step of steps)
      expect(step.env ?? {}).not.toHaveProperty("GITHUB_SHA");
    const controllerCheckout =
      steps[index("Check out the exact main revision")]!;
    const productCheckout =
      steps[index("Check out the selected product revision separately")]!;
    expect(controllerCheckout.with).toMatchObject({
      ref: "${{ github.sha }}",
      "persist-credentials": false,
    });
    expect(productCheckout.with).toMatchObject({
      ref: "${{ inputs.product_source_sha }}",
      path: "release-product",
      "persist-credentials": false,
    });
    for (const step of steps.filter(
      (step) => step["working-directory"] === "release-product",
    ))
      expect(JSON.stringify(step.env ?? {})).not.toContain("secrets.");
    expect(document.jobs.production?.needs).toBe("staging");
    expect(document.jobs.production?.if).toBe(
      "inputs.promote && github.ref == 'refs/heads/main'",
    );
    const downloaded = document.jobs.production!.steps.find(
      (step) => step.name === "Download the tested bytes without rebuilding",
    );
    expect(downloaded?.with).toMatchObject({
      name: "appwrite-site-${{ inputs.product_source_sha }}-${{ github.run_attempt }}",
      "digest-mismatch": "error",
    });
  });
});

afterAll(async () => {
  if (!root) return;
  const inside = relative(resolve(tmpdir()), root);
  expect(inside.startsWith("investment-product-source-")).toBe(true);
  expect(inside.includes("..")).toBe(false);
  await rm(root, { recursive: true, force: true });
});

function acceptedGitHub() {
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
    const path = url.pathname.replace(`/repos/${repository}/actions`, "");
    const run = (index: number) => ({
      id: 12345 + index,
      run_attempt: index === 0 ? 2 : 1,
      path: proof.workflows[index]!.path,
      event: "push",
      head_branch: "main",
      head_sha: sourceSha,
      status: "completed",
      conclusion: "success",
      repository: { full_name: repository },
      head_repository: { full_name: repository },
    });
    let value: unknown;
    if (path === "/runs/12345") value = run(0);
    else if (path.startsWith("/workflows/")) {
      expect(url.searchParams.get("head_sha")).toBe(sourceSha);
      const index = proof.workflows.findIndex((item) =>
        path.includes(item.path.split("/").at(-1)!),
      );
      expect(index).toBeGreaterThanOrEqual(0);
      value = { total_count: 1, workflow_runs: [run(index)] };
    } else {
      const match = /^\/runs\/(\d+)\/attempts\/(\d+)\/jobs$/u.exec(path);
      expect(match).not.toBeNull();
      const index = Number(match![1]) - 12345;
      value = {
        total_count: proof.workflows[index]!.jobs.length,
        jobs: proof.workflows[index]!.jobs.map((name) => ({
          name,
          run_id: 12345 + index,
          run_attempt: Number(match![2]),
          head_sha: sourceSha,
          status: "completed",
          conclusion: "success",
        })),
      };
    }
    return Promise.resolve(new Response(JSON.stringify(value)));
  });
}

describe("separate product and controller source", () => {
  it("checks an earlier clean main product against its own real Git inventory and workflow files", async () => {
    const request = acceptedGitHub();
    const result = await verifyProductSource(
      selection(),
      controller,
      root,
      proof,
      "synthetic-token",
      request,
    );
    expect(result).toMatchObject({
      version: 1,
      controllerSha: controller.sha,
      sourceSha,
      productCiRunId: "12345",
      productCiRunAttempt: 2,
    });
    expect(result.controllerSha).not.toBe(result.sourceSha);
    expect(result.verifiedWorkflows).toBeGreaterThan(0);
    expect(request).toHaveBeenCalled();
  });

  it.each([
    { sourceSha: "main" },
    { sourceSha: "0".repeat(40) },
    { sourceSha: "A".repeat(40) },
    { sourceSha: "a".repeat(40) + "; command" },
    { ciRunId: "0" },
    { ciRunId: "1; command" },
    { ciRunAttempt: 0 },
    { ciRunAttempt: 1.5 },
    { ciRunAttempt: "2" },
    { unexpected: true },
  ])("rejects invalid selectors %j", (change) => {
    expect(() =>
      selectProduct({ ...selection(), ...change }, controller),
    ).toThrow();
  });

  it.each([
    { ref: "refs/heads/other" },
    { event: "pull_request" },
    { sha: "" },
  ])("rejects untrusted controller context %j", (change) => {
    expect(() =>
      selectProduct(selection(), { ...controller, ...change }),
    ).toThrow();
  });

  it("rejects a product outside the accepted controller history before any request", async () => {
    const request = acceptedGitHub();
    await expect(
      verifyProductSource(
        { ...selection(), sourceSha: unrelated },
        controller,
        root,
        proof,
        "synthetic-token",
        request,
      ),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it.each([{ ciRunAttempt: 1 }, { ciRunId: "99999" }])(
    "rejects a different product proof or attempt %j",
    async (change) => {
      const request = acceptedGitHub();
      await expect(
        verifyProductSource(
          { ...selection(), ...change },
          controller,
          root,
          proof,
          "synthetic-token",
          request,
        ),
      ).rejects.toThrow();
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("rejects a proof from a different repository before any request", async () => {
    const request = acceptedGitHub();
    await expect(
      verifyProductSource(
        selection(),
        controller,
        root,
        { ...proof, repository: "other/repository" },
        "synthetic-token",
        request,
      ),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects product edits instead of trusting its HEAD label", async () => {
    const request = acceptedGitHub();
    const file = resolve(productRoot, "package.json");
    const original = await readFile(file);
    try {
      await writeFile(file, "changed after checkout\n");
      await expect(
        verifyProductSource(
          selection(),
          controller,
          root,
          proof,
          "synthetic-token",
          request,
        ),
      ).rejects.toThrow();
      expect(request).not.toHaveBeenCalled();
    } finally {
      await writeFile(file, original);
    }
  });
});
