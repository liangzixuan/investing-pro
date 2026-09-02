import { randomBytes } from "node:crypto";
import { link, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  captureSecurityMasterApiEnvironment,
  createSecurityMasterConfiguredApp,
  disposeCapturedSecurityMasterApiEnvironment,
  isSecurityMasterSnapshotFileStateStable,
  PERSONAL_SECURITY_MASTER_SNAPSHOT_FILENAME,
  PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY,
  PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY,
  SECURITY_MASTER_API_MODE,
  SecurityMasterApiCompositionError,
} from "./security-master-composition-root";
import { PERSONAL_SECURITY_MASTER_STATUS_PATH } from "./personal-security-master-routes";
import { PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY } from "./personal-owner-session";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { bootstrapTestPersonalOwnerSession } from "./test-personal-owner-session-builder";

const apps: Awaited<ReturnType<typeof createSecurityMasterConfiguredApp>>[] =
  [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
  await Promise.all(
    directories
      .splice(0)
      .map(async (directory) =>
        rm(directory, { force: true, recursive: true }),
      ),
  );
});

describe("personal security-master API composition", () => {
  it("applies the narrow Windows ctime exception without weakening stable file state", () => {
    const baseline = {
      ctimeNs: 7n,
      dev: 11n,
      ino: 13n,
      mode: 33_188n,
      mtimeNs: 17n,
      nlink: 1n,
      size: 19n,
    } as const;

    expect(
      isSecurityMasterSnapshotFileStateStable(
        baseline,
        { ...baseline, ctimeNs: baseline.ctimeNs + 1n },
        "win32",
      ),
    ).toBe(true);
    expect(
      isSecurityMasterSnapshotFileStateStable(
        baseline,
        { ...baseline, ctimeNs: baseline.ctimeNs + 1n },
        "posix",
      ),
    ).toBe(false);

    const changedStableFields = [
      ["dev", baseline.dev + 1n],
      ["ino", baseline.ino + 1n],
      ["mode", baseline.mode + 1n],
      ["nlink", baseline.nlink + 1n],
      ["size", baseline.size + 1n],
      ["mtimeNs", baseline.mtimeNs + 1n],
    ] as const;
    for (const [field, changedValue] of changedStableFields) {
      expect(
        isSecurityMasterSnapshotFileStateStable(
          baseline,
          { ...baseline, [field]: changedValue },
          "win32",
        ),
        field,
      ).toBe(false);
    }
  });

  it("scrubs exact private startup inputs and retains only the admitted catalog", async () => {
    const fixture = await createSnapshotFixture();
    const bootstrapSecret = freshSecret();
    const environment: Record<string, string | undefined> = {
      ...fixture.environment,
      RESEARCH_COCKPIT_MODE: SECURITY_MASTER_API_MODE,
      [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: bootstrapSecret,
    };
    const captured = captureSecurityMasterApiEnvironment(environment);
    const appPromise = createSecurityMasterConfiguredApp(captured);

    for (const key of [
      PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY,
      PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY,
      PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY,
    ]) {
      expect(environment[key]).toBeUndefined();
      expect(captured[key]).toBeUndefined();
    }

    const app = await appPromise;
    apps.push(app);
    await rm(fixture.snapshotPath);
    const cookie = await bootstrapTestPersonalOwnerSession(
      app,
      bootstrapSecret,
    );
    const response = await app.inject({
      method: "GET",
      url: PERSONAL_SECURITY_MASTER_STATUS_PATH,
      headers: allowedHeaders(cookie),
      remoteAddress: "127.0.0.1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshot: {
        profile: SECURITY_MASTER_API_MODE,
        snapshotSha256: fixture.expectedSha256,
        status: "admitted_for_personal_local_search",
      },
    });
    expect(response.payload).not.toContain(fixture.snapshotPath);
  });

  it("rejects missing, partial, malformed, and wrong-mode configuration", async () => {
    const fixture = await createSnapshotFixture();
    const cases = [
      [{}, "SECURITY_MASTER_MODE_REQUIRED"],
      [
        {
          RESEARCH_COCKPIT_MODE: SECURITY_MASTER_API_MODE,
          [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: freshSecret(),
        },
        "SECURITY_MASTER_CONFIGURATION_REQUIRED",
      ],
      [
        {
          RESEARCH_COCKPIT_MODE: SECURITY_MASTER_API_MODE,
          [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: freshSecret(),
          [PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY]:
            fixture.snapshotPath,
        },
        "SECURITY_MASTER_CONFIGURATION_REQUIRED",
      ],
      [
        {
          ...fixture.environment,
          RESEARCH_COCKPIT_MODE: SECURITY_MASTER_API_MODE,
        },
        "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED",
      ],
      [
        {
          ...fixture.environment,
          RESEARCH_COCKPIT_MODE: SECURITY_MASTER_API_MODE,
          [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: "not-a-secret",
        },
        "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID",
      ],
      [
        {
          ...fixture.environment,
          RESEARCH_COCKPIT_MODE: SECURITY_MASTER_API_MODE,
          [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: freshSecret(),
          [PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY]:
            "SHA256:BAD",
        },
        "SECURITY_MASTER_CONFIGURATION_REQUIRED",
      ],
      [
        {
          ...fixture.environment,
          RESEARCH_COCKPIT_MODE: SECURITY_MASTER_API_MODE,
          [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: freshSecret(),
          [PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY]:
            PERSONAL_SECURITY_MASTER_SNAPSHOT_FILENAME,
        },
        "SECURITY_MASTER_CONFIGURATION_REQUIRED",
      ],
    ] as const;

    for (const [environment, code] of cases) {
      const error = await createSecurityMasterConfiguredApp(environment).catch(
        (reason: unknown) => reason,
      );
      expect(error).toBeInstanceOf(SecurityMasterApiCompositionError);
      expect(error).toMatchObject({ code });
      expect(String(error)).not.toContain(fixture.snapshotPath);
      expect(String(error)).not.toContain(fixture.expectedSha256);
    }
  });

  it.each([
    "CONNECTED_SOURCE_POLICY_BUNDLE_PATH",
    "CONNECTED_SOURCE_POLICY_BUNDLE_SHA256",
    "CONNECTED_SOURCE_POLICY_SECRET_REFERENCE",
    "PERSONAL_FILING_QUALITY_RESULT_PATH",
    "PERSONAL_FILING_QUALITY_RESULT_SHA256",
    "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH",
    "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256",
    "PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH",
    "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH",
    "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256",
    "PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH",
    "RESEARCH_COCKPIT_VAULT_ROOT",
    "RESEARCH_COCKPIT_VAULT_STARTUP",
  ])("rejects incompatible private configuration %s", async (key) => {
    const fixture = await createSnapshotFixture();
    const error = await createSecurityMasterConfiguredApp({
      ...fixture.environment,
      RESEARCH_COCKPIT_MODE: SECURITY_MASTER_API_MODE,
      [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: freshSecret(),
      [key]: "private-canary",
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(SecurityMasterApiCompositionError);
    expect(error).toMatchObject({
      code: "SECURITY_MASTER_MODE_REJECTS_OTHER_PRIVATE_CONFIGURATION",
    });
    expect(String(error)).not.toContain("private-canary");
  });

  it("fails closed for a digest mismatch, noncanonical file name, and hard link", async () => {
    const digestFixture = await createSnapshotFixture();
    const wrongDigest = await createSecurityMasterConfiguredApp({
      ...digestFixture.environment,
      RESEARCH_COCKPIT_MODE: SECURITY_MASTER_API_MODE,
      [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: freshSecret(),
      [PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY]: `sha256:${"0".repeat(64)}`,
    }).catch((reason: unknown) => reason);
    expect(wrongDigest).toMatchObject({ code: "SECURITY_MASTER_UNAVAILABLE" });

    const wrongNamePath = join(
      digestFixture.directory,
      "unexpected-security-master.json",
    );
    await writeFile(wrongNamePath, buildTestSecurityMasterAdmission().snapshot);
    const wrongName = await createSecurityMasterConfiguredApp({
      ...digestFixture.environment,
      RESEARCH_COCKPIT_MODE: SECURITY_MASTER_API_MODE,
      [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: freshSecret(),
      [PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY]: wrongNamePath,
    }).catch((reason: unknown) => reason);
    expect(wrongName).toMatchObject({
      code: "SECURITY_MASTER_CONFIGURATION_REQUIRED",
    });

    const hardLinkDirectory = await mkdtemp(
      join(tmpdir(), "research-cockpit-security-master-hardlink-"),
    );
    directories.push(hardLinkDirectory);
    const original = join(hardLinkDirectory, "original.json");
    const linked = join(
      hardLinkDirectory,
      PERSONAL_SECURITY_MASTER_SNAPSHOT_FILENAME,
    );
    const admission = buildTestSecurityMasterAdmission();
    await writeFile(original, admission.snapshot, { flag: "wx" });
    await link(original, linked);
    const hardLinkError = await createSecurityMasterConfiguredApp({
      RESEARCH_COCKPIT_MODE: SECURITY_MASTER_API_MODE,
      [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: freshSecret(),
      [PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY]: linked,
      [PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY]:
        admission.expectedSha256,
    }).catch((reason: unknown) => reason);
    expect(hardLinkError).toMatchObject({
      code: "SECURITY_MASTER_UNAVAILABLE",
    });
  });

  it("makes captured environment disposal idempotent", async () => {
    const fixture = await createSnapshotFixture();
    const environment: Record<string, string | undefined> = {
      ...fixture.environment,
      RESEARCH_COCKPIT_MODE: SECURITY_MASTER_API_MODE,
      [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: freshSecret(),
    };
    const captured = captureSecurityMasterApiEnvironment(environment);
    disposeCapturedSecurityMasterApiEnvironment(captured);
    disposeCapturedSecurityMasterApiEnvironment(captured);

    expect(
      captured[PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY],
    ).toBeUndefined();
    expect(
      captured[PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY],
    ).toBeUndefined();
    expect(captured[PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]).toBeUndefined();
  });

  it("scrubs private inputs before invalid listen configuration rejects", async () => {
    const fixture = await createSnapshotFixture();
    const environment: Record<string, string | undefined> = {
      ...fixture.environment,
      HOST: "not-loopback",
      RESEARCH_COCKPIT_MODE: SECURITY_MASTER_API_MODE,
      [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: freshSecret(),
    };
    const captured = captureSecurityMasterApiEnvironment(environment);
    const errorPromise = createSecurityMasterConfiguredApp(captured);

    expect(
      captured[PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY],
    ).toBeUndefined();
    expect(
      captured[PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY],
    ).toBeUndefined();
    expect(captured[PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]).toBeUndefined();
    await expect(errorPromise).rejects.toMatchObject({
      code: "SECURITY_MASTER_UNAVAILABLE",
    });
  });
});

async function createSnapshotFixture() {
  const directory = await mkdtemp(
    join(tmpdir(), "research-cockpit-security-master-"),
  );
  directories.push(directory);
  const snapshotPath = join(
    directory,
    PERSONAL_SECURITY_MASTER_SNAPSHOT_FILENAME,
  );
  const admission = buildTestSecurityMasterAdmission();
  await writeFile(snapshotPath, admission.snapshot, { flag: "wx" });
  return {
    directory,
    expectedSha256: admission.expectedSha256,
    environment: {
      [PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY]: snapshotPath,
      [PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY]:
        admission.expectedSha256,
    },
    snapshotPath,
  } as const;
}

function freshSecret(): string {
  return randomBytes(32).toString("hex");
}

function allowedHeaders(cookie: string): Record<string, string> {
  return {
    accept: "application/json",
    cookie,
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
  };
}
