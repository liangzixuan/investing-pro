import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  runSiteRelease,
  SITE_RELEASE_TARGET,
  type ReleaseReceipt,
  type SitesPort,
} from "../../apps/api/scripts/appwrite-site-release.js";
import {
  approvedProductionPort,
  preparePromotion,
  type PromotionFiles,
} from "./promote-tested-site.js";

const PRODUCTION = "investment-production";
const SOURCE = "a".repeat(40);
const PREVIOUS = "invented-previous";
const STAGED = "invented-staging";
const CANDIDATE = "invented-candidate";
const hash = (value: Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const json = (value: unknown) => Buffer.from(JSON.stringify(value));

function evidence() {
  // Archive membership is the packager's responsibility. These tests bind bytes.
  const archive = Buffer.from("invented-original-staging-archive");
  const manifestBytes = json({
    version: 1,
    sourceSha: SOURCE,
    archiveSha256: hash(archive),
    archiveBytes: archive.length,
    files: [
      { path: "index.html", bytes: 100, sha256: "b".repeat(64) },
      { path: "assets/index-ABCDEFGH.js", bytes: 200, sha256: "c".repeat(64) },
    ],
  });
  const stagingBytes = json({
    version: 1,
    operation: "stage",
    sourceSha: SOURCE,
    archiveSha256: hash(archive),
    manifestSha256: hash(manifestBytes),
    archiveBytes: archive.length,
    siteId: SITE_RELEASE_TARGET.stagingSiteId,
    candidateDeploymentId: STAGED,
    activeDeploymentId: STAGED,
    deploymentStatus: "ready",
    createAttempted: true,
    activationAttempted: true,
    activationVerified: true,
    outcome: "succeeded",
    failure: null,
  });
  const acceptanceBytes = json({
    version: 1,
    sourceSha: SOURCE,
    archiveSha256: hash(archive),
    manifestSha256: hash(manifestBytes),
    stagingDeploymentId: STAGED,
    browserstackRunId: "12345",
    browserstackRunAttempt: 1,
    passed: true,
  });
  const files: PromotionFiles = {
    archive,
    manifestBytes,
    stagingBytes,
    acceptanceBytes,
  };
  const inputs: Record<string, string> = {
    source_sha: SOURCE,
    staging_run_id: "12345",
    staging_run_attempt: "1",
    archive_sha256: hash(archive),
    manifest_sha256: hash(manifestBytes),
    staging_deployment_id: STAGED,
    previous_production_deployment_id: PREVIOUS,
    staging_receipt_sha256: hash(stagingBytes),
    browserstack_acceptance_sha256: hash(acceptanceBytes),
  };
  return { inputs, files };
}

type Evidence = ReturnType<typeof evidence>;

function replaceJson(
  packet: Evidence,
  file: "stagingBytes" | "acceptanceBytes",
  updates: Record<string, unknown>,
) {
  packet.files[file] = json({
    ...JSON.parse(packet.files[file].toString("utf8")),
    ...updates,
  });
  const input =
    file === "stagingBytes"
      ? "staging_receipt_sha256"
      : "browserstack_acceptance_sha256";
  packet.inputs[input] = hash(packet.files[file]);
}

function recordingPort(
  options: {
    prior?: string;
    staging?: string;
    changedAfterUpload?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const uploads: Uint8Array[] = [];
  const receipts: ReleaseReceipt[] = [];
  let active = options.prior ?? PREVIOUS;
  let productionReads = 0;
  const site = (siteId: string, deploymentId: string) => ({
    $id: siteId,
    enabled: true,
    adapter: "static",
    framework: "other",
    fallbackFile: "index.html",
    deploymentRetention: 0,
    providerRepositoryId: "",
    installationId: "",
    scopes: [],
    deploymentId,
    get vars(): never {
      throw new Error("A promotion must not read private variables");
    },
  });
  const sites: SitesPort = {
    getSite: vi.fn<SitesPort["getSite"]>((siteId) => {
      calls.push(`get:${siteId}`);
      if (siteId === SITE_RELEASE_TARGET.stagingSiteId)
        return Promise.resolve(site(siteId, options.staging ?? STAGED));
      expect(siteId).toBe(PRODUCTION);
      productionReads++;
      if (productionReads === 2 && options.changedAfterUpload)
        active = "intervening-deployment";
      return Promise.resolve(site(siteId, active));
    }),
    createDeployment: vi.fn<SitesPort["createDeployment"]>(
      (siteId, archive) => {
        calls.push(`create:${siteId}`);
        uploads.push(Uint8Array.from(archive));
        return Promise.resolve({
          $id: CANDIDATE,
          resourceId: siteId,
          resourceType: "sites",
          activate: false,
          status: "ready",
        });
      },
    ),
    getDeployment: vi.fn<SitesPort["getDeployment"]>(() => {
      throw new Error("Already-ready invented deployment needs no polling");
    }),
    activate: vi.fn<SitesPort["activate"]>((siteId, deploymentId) => {
      calls.push(`activate:${siteId}:${deploymentId}`);
      active = deploymentId;
      return Promise.resolve(site(siteId, active));
    }),
  };
  return { sites, calls, uploads, receipts };
}

async function promote(
  packet: Evidence,
  recorder: ReturnType<typeof recordingPort>,
) {
  const prepared = preparePromotion(packet.inputs, packet.files);
  const guarded = approvedProductionPort(
    recorder.sites,
    prepared.values.previous_production_deployment_id as string,
  );
  const receipt = await runSiteRelease(prepared.input, {
    sites: guarded.sites,
    now: () => Date.parse("2026-01-01T00:00:00Z"),
    sleep: () => {
      throw new Error("No test may sleep or retry");
    },
    persist: (value) => {
      recorder.receipts.push({ ...value });
      return Promise.resolve();
    },
  });
  return { receipt, pointerMismatch: guarded.pointerMismatch() };
}

describe("tested staging artifact promotion", () => {
  const refusals: [string, (packet: Evidence) => void][] = [
    [
      "unexpected input",
      (p) => {
        p.inputs.extra = "unreviewed";
      },
    ],
    [
      "abbreviated source",
      (p) => {
        p.inputs.source_sha = "abc";
      },
    ],
    [
      "different source",
      (p) => {
        p.inputs.source_sha = "d".repeat(40);
      },
    ],
    [
      "different archive",
      (p) => {
        p.files.archive = Buffer.from("different");
      },
    ],
    [
      "different manifest bytes",
      (p) => {
        p.files.manifestBytes = Buffer.concat([
          p.files.manifestBytes,
          Buffer.from("\n"),
        ]);
      },
    ],
    [
      "different staging receipt bytes",
      (p) => {
        p.files.stagingBytes = Buffer.concat([
          p.files.stagingBytes,
          Buffer.from("\n"),
        ]);
      },
    ],
    [
      "different acceptance bytes",
      (p) => {
        p.files.acceptanceBytes = Buffer.concat([
          p.files.acceptanceBytes,
          Buffer.from("\n"),
        ]);
      },
    ],
    [
      "different original run",
      (p) => {
        p.inputs.staging_run_id = "54321";
      },
    ],
    [
      "different original attempt",
      (p) => {
        p.inputs.staging_run_attempt = "2";
      },
    ],
    [
      "failed staging",
      (p) => {
        replaceJson(p, "stagingBytes", { outcome: "failed" });
      },
    ],
    [
      "unverified staging activation",
      (p) => {
        replaceJson(p, "stagingBytes", { activationVerified: false });
      },
    ],
    [
      "wrong staging deployment",
      (p) => {
        p.inputs.staging_deployment_id = "other-staging";
      },
    ],
    [
      "failed browser acceptance",
      (p) => {
        replaceJson(p, "acceptanceBytes", { passed: false });
      },
    ],
    [
      "acceptance from another source",
      (p) => {
        replaceJson(p, "acceptanceBytes", { sourceSha: "e".repeat(40) });
      },
    ],
    [
      "acceptance from another deployment",
      (p) => {
        replaceJson(p, "acceptanceBytes", {
          stagingDeploymentId: "other-staging",
        });
      },
    ],
    [
      "extra acceptance property",
      (p) => {
        replaceJson(p, "acceptanceBytes", { approved: true });
      },
    ],
    [
      "invalid approved previous pointer",
      (p) => {
        p.inputs.previous_production_deployment_id = "../other";
      },
    ],
  ];

  it.each(refusals)(
    "refuses %s before any platform call",
    async (_name, change) => {
      const packet = evidence();
      const recorder = recordingPort();
      change(packet);
      await expect(promote(packet, recorder)).rejects.toThrow();
      expect(recorder.calls).toEqual([]);
      expect(recorder.sites.createDeployment).not.toHaveBeenCalled();
      expect(recorder.sites.activate).not.toHaveBeenCalled();
    },
  );

  it("refuses a changed approved production pointer before upload", async () => {
    const recorder = recordingPort({ prior: "intervening-deployment" });
    const { receipt, pointerMismatch } = await promote(evidence(), recorder);
    expect(pointerMismatch).toBe(true);
    expect(receipt.outcome).toBe("failed");
    expect(receipt.createAttempted).toBe(false);
    expect(recorder.sites.createDeployment).not.toHaveBeenCalled();
    expect(recorder.sites.activate).not.toHaveBeenCalled();
  });

  it("refuses changed staging before upload", async () => {
    const recorder = recordingPort({ staging: "new-staging" });
    const { receipt } = await promote(evidence(), recorder);
    expect(receipt.failure).toBe("active_deployment_changed");
    expect(receipt.createAttempted).toBe(false);
    expect(recorder.sites.createDeployment).not.toHaveBeenCalled();
    expect(recorder.sites.activate).not.toHaveBeenCalled();
  });

  it("delegates the exact accepted archive to the existing writer once", async () => {
    const packet = evidence();
    const recorder = recordingPort();
    const { receipt, pointerMismatch } = await promote(packet, recorder);
    expect(pointerMismatch).toBe(false);
    expect(receipt).toMatchObject({
      outcome: "succeeded",
      sourceSha: SOURCE,
      archiveSha256: hash(packet.files.archive),
      previousDeploymentId: PREVIOUS,
      stagingDeploymentId: STAGED,
      candidateDeploymentId: CANDIDATE,
      activeDeploymentId: CANDIDATE,
      activationVerified: true,
    });
    expect(recorder.uploads).toEqual([Uint8Array.from(packet.files.archive)]);
    expect(recorder.calls).toEqual([
      `get:${SITE_RELEASE_TARGET.stagingSiteId}`,
      `get:${PRODUCTION}`,
      `create:${PRODUCTION}`,
      `get:${PRODUCTION}`,
      `activate:${PRODUCTION}:${CANDIDATE}`,
      `get:${PRODUCTION}`,
    ]);
    expect(recorder.sites.createDeployment).toHaveBeenCalledTimes(1);
    expect(recorder.sites.activate).toHaveBeenCalledTimes(1);
    expect(
      recorder.receipts.some(
        (value) =>
          value.createAttempted &&
          value.candidateDeploymentId === null &&
          value.previousDeploymentId === PREVIOUS,
      ),
    ).toBe(true);
  });

  it("keeps the writer's intervening-change refusal after upload", async () => {
    const recorder = recordingPort({ changedAfterUpload: true });
    const { receipt } = await promote(evidence(), recorder);
    expect(receipt).toMatchObject({
      outcome: "failed",
      failure: "active_deployment_changed",
      previousDeploymentId: PREVIOUS,
      candidateDeploymentId: CANDIDATE,
      activeDeploymentId: "intervening-deployment",
      activationAttempted: false,
    });
    expect(recorder.sites.createDeployment).toHaveBeenCalledTimes(1);
    expect(recorder.sites.activate).not.toHaveBeenCalled();
  });
});
