import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, open, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSitesPort,
  runSiteRelease,
  SITE_RELEASE_LIMITS,
  SITE_RELEASE_TARGET,
  validateArtifact,
  validateStagingReceipt,
  type SitesPort,
} from "../../apps/api/scripts/appwrite-site-release.js";

const productionSiteId = "investment-production";
const hash = (value: Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/u.test(value);
const sha = (value: unknown, length: number): value is string =>
  typeof value === "string" &&
  new RegExp(`^[a-f0-9]{${length}}$`, "u").test(value);

async function boundedFile(name: string, maximum: number): Promise<Buffer> {
  const path = `dist/promotion-input/${name}`;
  const before = await lstat(path);
  assert(before.isFile() && !before.isSymbolicLink());
  const handle = await open(path, "r");
  try {
    const stat = await handle.stat();
    assert(stat.isFile() && stat.size > 0 && stat.size <= maximum);
    const data = Buffer.alloc(stat.size + 1);
    let count = 0;
    while (count < data.length) {
      const result = await handle.read(data, count, data.length - count, count);
      if (result.bytesRead === 0) break;
      count += result.bytesRead;
    }
    assert.equal(count, stat.size);
    return data.subarray(0, count);
  } finally {
    await handle.close();
  }
}

export interface PromotionFiles {
  archive: Buffer;
  manifestBytes: Buffer;
  stagingBytes: Buffer;
  acceptanceBytes: Buffer;
}

export function preparePromotion(inputs: unknown, files: PromotionFiles) {
  assert(inputs && typeof inputs === "object" && !Array.isArray(inputs));
  const values = inputs as Record<string, unknown>;
  assert.deepEqual(Object.keys(values).sort(), [
    "archive_sha256",
    "browserstack_acceptance_sha256",
    "manifest_sha256",
    "previous_production_deployment_id",
    "source_sha",
    "staging_deployment_id",
    "staging_receipt_sha256",
    "staging_run_attempt",
    "staging_run_id",
  ]);
  assert(sha(values.source_sha, 40));
  for (const name of [
    "archive_sha256",
    "manifest_sha256",
    "staging_receipt_sha256",
    "browserstack_acceptance_sha256",
  ])
    assert(sha(values[name], 64));
  assert(
    typeof values.staging_run_id === "string" &&
      /^[1-9]\d{0,19}$/u.test(values.staging_run_id),
  );
  assert(
    typeof values.staging_run_attempt === "string" &&
      /^[1-9]\d{0,2}$/u.test(values.staging_run_attempt),
  );
  assert(
    id(values.staging_deployment_id) &&
      id(values.previous_production_deployment_id),
  );
  const { archive, manifestBytes, stagingBytes, acceptanceBytes } = files;
  const { manifest, manifestSha256 } = validateArtifact(archive, manifestBytes);
  assert.equal(manifest.sourceSha, values.source_sha);
  assert.equal(manifest.archiveSha256, values.archive_sha256);
  assert.equal(manifestSha256, values.manifest_sha256);
  assert.equal(hash(stagingBytes), values.staging_receipt_sha256);
  assert.equal(hash(acceptanceBytes), values.browserstack_acceptance_sha256);
  const stagingReceipt: unknown = JSON.parse(stagingBytes.toString("utf8"));
  const acceptance: unknown = JSON.parse(acceptanceBytes.toString("utf8"));
  const staged = validateStagingReceipt(
    stagingReceipt,
    manifest,
    manifestSha256,
  );
  assert.equal(staged.stagingDeploymentId, values.staging_deployment_id);
  assert(
    acceptance && typeof acceptance === "object" && !Array.isArray(acceptance),
  );
  const accepted = acceptance as Record<string, unknown>;
  assert.equal(accepted.browserstackRunId, values.staging_run_id);
  assert.equal(
    accepted.browserstackRunAttempt,
    Number(values.staging_run_attempt),
  );
  // The existing writer repeats its complete strict join before its first request.
  assert.equal(accepted.sourceSha, manifest.sourceSha);
  assert.equal(accepted.archiveSha256, manifest.archiveSha256);
  assert.equal(accepted.manifestSha256, manifestSha256);
  assert.equal(accepted.stagingDeploymentId, staged.stagingDeploymentId);
  assert.equal(accepted.passed, true);
  assert.deepEqual(Object.keys(accepted).sort(), [
    "archiveSha256",
    "browserstackRunAttempt",
    "browserstackRunId",
    "manifestSha256",
    "passed",
    "sourceSha",
    "stagingDeploymentId",
    "version",
  ]);
  assert.equal(accepted.version, 1);
  return {
    values,
    input: {
      operation: "promote" as const,
      archive,
      manifestBytes,
      productionSiteId,
      acceptance,
      stagingReceipt,
    },
  };
}

export function approvedProductionPort(
  port: SitesPort,
  previousDeploymentId: string,
) {
  assert(id(previousDeploymentId));
  let approvedPointerSeen = false;
  let pointerMismatch = false;
  const sites: SitesPort = {
    ...port,
    getSite: async (siteId) => {
      const value = await port.getSite(siteId);
      if (siteId === productionSiteId && !approvedPointerSeen) {
        const actual = value as Record<string, unknown> | null;
        if (!actual || actual.deploymentId !== previousDeploymentId) {
          pointerMismatch = true;
          throw new Error("approved_previous_pointer_changed");
        }
        approvedPointerSeen = true;
      }
      return value;
    },
    createDeployment: (siteId, bytes) => {
      assert(approvedPointerSeen && siteId === productionSiteId);
      return port.createDeployment(siteId, bytes);
    },
  };
  return { sites, pointerMismatch: () => pointerMismatch };
}

async function main(): Promise<void> {
  // Capture the controller inputs and existing environment authority before await.
  const inputs: unknown = JSON.parse(process.env.PROMOTION_INPUTS_JSON ?? "");
  const apiKey = process.env.APPWRITE_API_KEY ?? "";
  const controllerSha = process.env.GITHUB_SHA;
  assert.equal(process.env.GITHUB_REF, "refs/heads/main");
  assert(sha(controllerSha, 40));
  assert(apiKey.length > 0 && !/[\r\n]/u.test(apiKey));
  const { input, values } = preparePromotion(inputs, {
    archive: await boundedFile("site.tar.gz", SITE_RELEASE_LIMITS.archiveBytes),
    manifestBytes: await boundedFile(
      "manifest.json",
      SITE_RELEASE_LIMITS.jsonBytes,
    ),
    stagingBytes: await boundedFile(
      "staging-receipt.json",
      SITE_RELEASE_LIMITS.jsonBytes,
    ),
    acceptanceBytes: await boundedFile(
      "browserstack-acceptance.json",
      SITE_RELEASE_LIMITS.jsonBytes,
    ),
  });
  const receiptFile = await open("dist/promotion-receipt.json", "wx", 0o600);
  let transport: ReturnType<typeof createSitesPort> | undefined;
  try {
    await writeFile(
      "dist/promotion-controller.json",
      JSON.stringify(
        {
          controllerSha,
          productSourceSha: values.source_sha,
          expectedInputs: values,
          expectedProductionSiteId: productionSiteId,
          stagingSiteId: SITE_RELEASE_TARGET.stagingSiteId,
          apiKeyRetained: false,
          rebuilt: false,
          stagingRepeated: false,
          browserstackRepeated: false,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    transport = createSitesPort({ apiKey, productionSiteId });
    const guarded = approvedProductionPort(
      transport.port,
      values.previous_production_deployment_id as string,
    );
    const receipt = await runSiteRelease(input, {
      sites: guarded.sites,
      persist: async (value) => {
        const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
        await receiptFile.truncate(0);
        let written = 0;
        while (written < bytes.length) {
          const result = await receiptFile.write(
            bytes,
            written,
            bytes.length - written,
            written,
          );
          assert(result.bytesWritten > 0);
          written += result.bytesWritten;
        }
        await receiptFile.sync();
      },
    });
    process.stdout.write(
      JSON.stringify({
        outcome: receipt.outcome,
        approvedPreviousPointerMismatch: guarded.pointerMismatch(),
      }) + "\n",
    );
    if (receipt.outcome !== "succeeded") process.exitCode = 1;
  } finally {
    try {
      await transport?.close();
    } finally {
      await receiptFile.close();
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main().catch(() => {
    process.stderr.write(
      "Promotion controller stopped; retained receipts require review.\n",
    );
    process.exitCode = 1;
  });
}
