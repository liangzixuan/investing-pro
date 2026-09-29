import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  validateArtifact,
  validateStagingReceipt,
} from "../../apps/api/scripts/appwrite-site-release";

export function makeStagingAcceptance(
  archive: Uint8Array,
  manifestBytes: Uint8Array,
  receipt: unknown,
  environment: {
    sha?: string | undefined;
    runId?: string | undefined;
    attempt?: string | undefined;
  },
) {
  const { manifest, manifestSha256 } = validateArtifact(archive, manifestBytes);
  const { stagingDeploymentId } = validateStagingReceipt(
    receipt,
    manifest,
    manifestSha256,
  );
  if (
    environment.sha !== manifest.sourceSha ||
    !/^[1-9][0-9]{0,19}$/u.test(environment.runId ?? "") ||
    !/^[1-9][0-9]{0,3}$/u.test(environment.attempt ?? "")
  ) {
    throw new Error("Staging result does not match this workflow run.");
  }
  return {
    version: 1,
    sourceSha: manifest.sourceSha,
    archiveSha256: manifest.archiveSha256,
    manifestSha256,
    stagingDeploymentId,
    browserstackRunId: environment.runId,
    browserstackRunAttempt: Number(environment.attempt),
    passed: true,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    if (process.argv.length !== 2) throw new Error("Unexpected arguments.");
    const base = "dist/appwrite-release";
    const result = makeStagingAcceptance(
      await readFile(`${base}/site.tar.gz`),
      await readFile(`${base}/manifest.json`),
      JSON.parse(
        await readFile(`${base}/staging-receipt.json`, "utf8"),
      ) as unknown,
      {
        sha: process.env.GITHUB_SHA,
        runId: process.env.GITHUB_RUN_ID,
        attempt: process.env.GITHUB_RUN_ATTEMPT,
      },
    );
    // The workflow calls this only after its exact-build BrowserStack step succeeds.
    await writeFile(
      `${base}/browserstack-acceptance.json`,
      JSON.stringify(result, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log("Retained this workflow's successful staging test binding.");
  } catch {
    console.error("Staging acceptance could not be recorded.");
    process.exitCode = 1;
  }
}
