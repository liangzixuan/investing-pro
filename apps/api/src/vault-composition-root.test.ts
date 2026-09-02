import { randomBytes } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY } from "./personal-owner-session";
import {
  captureVaultApiEnvironment,
  createVaultConfiguredApp,
  PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY,
  PERSONAL_VAULT_STARTUP_ENVIRONMENT_KEY,
  VAULT_API_MODE,
} from "./vault-composition-root";

const applications: Awaited<ReturnType<typeof createVaultConfiguredApp>>[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map(async (app) => app.close()));
  await Promise.all(
    directories
      .splice(0)
      .map(async (path) => rm(path, { recursive: true, force: true })),
  );
});

describe("personal vault composition root", () => {
  it("captures private startup values and composes only the exact vault mode", async () => {
    const parent = await temporaryParent();
    const root = join(parent, "owner-vault");
    const environment: Record<string, string | undefined> = {
      RESEARCH_COCKPIT_MODE: VAULT_API_MODE,
      [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]:
        randomBytes(32).toString("hex"),
      [PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY]: root,
      [PERSONAL_VAULT_STARTUP_ENVIRONMENT_KEY]: "initialize",
    };
    const captured = captureVaultApiEnvironment(environment);
    expect(
      environment[PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY],
    ).toBeUndefined();
    expect(environment[PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY]).toBeUndefined();
    expect(environment[PERSONAL_VAULT_STARTUP_ENVIRONMENT_KEY]).toBeUndefined();
    const app = await createVaultConfiguredApp(captured);
    applications.push(app);
    expect(captured[PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]).toBeUndefined();
    expect(captured[PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY]).toBeUndefined();
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/health/ready",
          remoteAddress: "127.0.0.1",
        })
      ).json(),
    ).toEqual({ status: "ready" });
  }, 30_000);

  it("reopens durable state but rejects initialization over an existing root", async () => {
    const parent = await temporaryParent();
    const root = join(parent, "owner-vault");
    const first = await createVaultConfiguredApp(
      captureVaultApiEnvironment(vaultEnvironment(root, "initialize")),
    );
    await first.close();
    const reopened = await createVaultConfiguredApp(
      captureVaultApiEnvironment(vaultEnvironment(root, "open")),
    );
    applications.push(reopened);
    await expect(
      createVaultConfiguredApp(
        captureVaultApiEnvironment(vaultEnvironment(root, "initialize")),
      ),
    ).rejects.toMatchObject({ code: "VAULT_UNAVAILABLE" });
  }, 30_000);

  it("rejects adjacent modes and all other private compositions", async () => {
    const parent = await temporaryParent();
    const root = join(parent, "owner-vault");
    await expect(
      createVaultConfiguredApp(
        captureVaultApiEnvironment({
          ...vaultEnvironment(root, "initialize"),
          RESEARCH_COCKPIT_MODE: "synthetic_demo",
        }),
      ),
    ).rejects.toMatchObject({ code: "VAULT_MODE_REQUIRED" });
    await expect(
      createVaultConfiguredApp(
        captureVaultApiEnvironment({
          ...vaultEnvironment(root, "initialize"),
          CONNECTED_SOURCE_POLICY_BUNDLE_PATH: "private-canary",
        }),
      ),
    ).rejects.toMatchObject({
      code: "VAULT_MODE_REJECTS_OTHER_PRIVATE_CONFIGURATION",
    });
  });
});

async function temporaryParent(): Promise<string> {
  const path = await mkdtemp(
    join(await realpath(tmpdir()), "vault-composition-test-"),
  );
  directories.push(path);
  return path;
}

function vaultEnvironment(
  root: string,
  action: "initialize" | "open",
): Record<string, string | undefined> {
  return {
    HOST: "127.0.0.1",
    PORT: "3100",
    RESEARCH_COCKPIT_MODE: VAULT_API_MODE,
    [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: randomBytes(32).toString("hex"),
    [PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY]: root,
    [PERSONAL_VAULT_STARTUP_ENVIRONMENT_KEY]: action,
  };
}
