import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateCheckoutSourceProof,
  verifyGitHubChecks,
} from "./github-checks";

export interface ProductSelection {
  sourceSha: string;
  ciRunId: string;
  ciRunAttempt: number;
}

export interface ControllerContext {
  sha: string;
  repository: string;
  ref: string;
  event: string;
}

const isSourceSha = (candidate: unknown): candidate is string =>
  typeof candidate === "string" &&
  /^[a-f0-9]{40}$/u.test(candidate) &&
  candidate !== "0".repeat(40);

export function selectProduct(
  input: unknown,
  controller: ControllerContext,
): ProductSelection {
  assert(input && typeof input === "object" && !Array.isArray(input));
  const value = input as Record<string, unknown>;
  assert.deepEqual(Object.keys(value).sort(), [
    "ciRunAttempt",
    "ciRunId",
    "sourceSha",
  ]);
  assert(isSourceSha(value.sourceSha) && isSourceSha(controller.sha));
  assert(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(controller.repository));
  assert(controller.ref === "refs/heads/main");
  assert(controller.event === "workflow_dispatch");
  assert(
    typeof value.ciRunId === "string" &&
      /^[1-9][0-9]{0,14}$/u.test(value.ciRunId) &&
      Number.isSafeInteger(Number(value.ciRunId)),
  );
  assert(
    typeof value.ciRunAttempt === "number" &&
      Number.isSafeInteger(value.ciRunAttempt) &&
      value.ciRunAttempt > 0,
  );
  return {
    sourceSha: value.sourceSha,
    ciRunId: value.ciRunId,
    ciRunAttempt: value.ciRunAttempt,
  };
}

function git(root: string, args: string[]): string {
  const result = spawnSync("git", ["--no-replace-objects", ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 500_000,
    windowsHide: true,
  });
  assert(!result.error && result.status === 0);
  return result.stdout.trim();
}

export async function verifyProductSource(
  input: unknown,
  controller: ControllerContext,
  controllerRoot: string,
  proof: unknown,
  token: string,
  request: typeof fetch = fetch,
) {
  const selection = selectProduct(input, controller);
  const productRoot = resolve(controllerRoot, "release-product");
  assert.equal(git(controllerRoot, ["rev-parse", "HEAD"]), controller.sha);
  // An accepted side branch is not a release source. The product must also
  // have an actual main-push proof and be retained in this controller's history.
  git(controllerRoot, [
    "merge-base",
    "--is-ancestor",
    selection.sourceSha,
    controller.sha,
  ]);
  assert.equal(git(productRoot, ["rev-parse", "HEAD"]), selection.sourceSha);
  assert.equal(
    git(productRoot, ["status", "--porcelain=v1", "--untracked-files=normal"]),
    "",
  );
  const accepted = await validateCheckoutSourceProof(productRoot, proof, {
    repository: controller.repository,
    sha: selection.sourceSha,
    ciRunId: selection.ciRunId,
  });
  assert.equal(accepted.ciRunAttempt, selection.ciRunAttempt);
  const checks = await verifyGitHubChecks(accepted, token, request);
  return {
    version: 1,
    controllerSha: controller.sha,
    sourceSha: selection.sourceSha,
    productCiRunId: selection.ciRunId,
    productCiRunAttempt: selection.ciRunAttempt,
    ...checks,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    assert.equal(process.argv.length, 2);
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const proofPath = resolve(
      root,
      "dist/product-source-proof/source-proof.json",
    );
    assert((await stat(proofPath)).size <= 500_000);
    const proofText = await readFile(proofPath, "utf8");
    assert(Buffer.byteLength(proofText) <= 500_000);
    const result = await verifyProductSource(
      {
        sourceSha: process.env.PRODUCT_SOURCE_SHA,
        ciRunId: process.env.PRODUCT_CI_RUN_ID,
        ciRunAttempt: Number(process.env.PRODUCT_CI_RUN_ATTEMPT),
      },
      {
        sha: process.env.GITHUB_SHA ?? "",
        repository: process.env.GITHUB_REPOSITORY ?? "",
        ref: process.env.GITHUB_REF ?? "",
        event: process.env.GITHUB_EVENT_NAME ?? "",
      },
      root,
      JSON.parse(proofText) as unknown,
      process.env.GH_TOKEN ?? "",
    );
    await writeFile(
      resolve(root, "dist/product-source-proof/selection.json"),
      JSON.stringify(result, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log("Accepted product source verified separately from controller.");
  } catch {
    console.error(
      "Product source verification failed; no deployment is authorized.",
    );
    process.exitCode = 1;
  }
}
