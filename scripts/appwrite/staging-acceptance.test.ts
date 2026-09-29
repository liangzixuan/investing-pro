import { describe, expect, it } from "vitest";
import { SITE_RELEASE_TARGET } from "../../apps/api/scripts/appwrite-site-release";
import { createManifest, digest } from "./site-artifact";
import { makeStagingAcceptance } from "./staging-acceptance";

const sha = "a".repeat(40);
const archive = Buffer.from("synthetic archive");
const manifest = createManifest(
  sha,
  new Map([
    [
      "index.html",
      Buffer.from(`<meta name="investment-build-sha" content="${sha}">`),
    ],
    ["assets/index-ABC12345.js", Buffer.from("synthetic")],
  ]),
  archive,
);
const bytes = Buffer.from(JSON.stringify(manifest));
const environment = { sha, runId: "12345", attempt: "1" };
const receipt = {
  version: 1,
  operation: "stage",
  outcome: "succeeded",
  failure: null,
  sourceSha: sha,
  archiveSha256: manifest.archiveSha256,
  manifestSha256: digest(bytes),
  archiveBytes: archive.length,
  siteId: SITE_RELEASE_TARGET.stagingSiteId,
  stagingDeploymentId: null,
  previousDeploymentId: "previous",
  candidateDeploymentId: "candidate",
  activeDeploymentId: "candidate",
  deploymentStatus: "ready",
  observations: 1,
  createAttempted: true,
  activationAttempted: true,
  activationVerified: true,
  startedAt: "2026-09-29T00:00:00.000Z",
  finishedAt: "2026-09-29T00:00:01.000Z",
};

describe("staging acceptance binding", () => {
  it("joins the exact artifact, active staging deployment and successful workflow step", () => {
    expect(makeStagingAcceptance(archive, bytes, receipt, environment)).toEqual(
      {
        version: 1,
        sourceSha: sha,
        archiveSha256: digest(archive),
        manifestSha256: digest(bytes),
        stagingDeploymentId: "candidate",
        browserstackRunId: "12345",
        browserstackRunAttempt: 1,
        passed: true,
      },
    );
  });
  it.each([
    { sha: "b".repeat(40) },
    { runId: "" },
    { runId: "1; command" },
    { attempt: "0" },
    { attempt: "1.2" },
  ])("rejects workflow identity mismatch %j", (change) => {
    expect(() =>
      makeStagingAcceptance(archive, bytes, receipt, {
        ...environment,
        ...change,
      }),
    ).toThrow();
  });
  it.each([
    { outcome: "activation_unknown" },
    { failure: "request_failed" },
    { activationVerified: false },
    { activeDeploymentId: "previous" },
    { archiveSha256: "b".repeat(64) },
    { sourceSha: "b".repeat(40) },
  ])("rejects unaccepted or mismatched staging result %j", (change) => {
    expect(() =>
      makeStagingAcceptance(
        archive,
        bytes,
        { ...receipt, ...change },
        environment,
      ),
    ).toThrow();
  });
  it("rejects bytes changed after the browser test", () => {
    expect(() =>
      makeStagingAcceptance(
        Buffer.from("changed"),
        bytes,
        receipt,
        environment,
      ),
    ).toThrow();
  });
});
