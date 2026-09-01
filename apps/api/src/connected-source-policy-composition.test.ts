import { createHash } from "node:crypto";
import { link, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY,
  CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY,
  CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY,
  ConnectedSourcePolicyCompositionError,
  isConnectedSourcePolicyAdministration,
  loadConnectedSourcePolicyAdministration,
} from "./connected-source-policy-composition";
import {
  createTestConnectedSourcePolicyFixture,
  TEST_CONNECTED_SOURCE_CLOCK,
  TEST_CONNECTED_SOURCE_SECRET_REFERENCE,
} from "./test-connected-source-policy-builder";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map(async (directory) =>
        rm(directory, { force: true, recursive: true }),
      ),
  );
});

describe("connected source policy composition", () => {
  it("returns no capability when no connected configuration is present", async () => {
    await expect(
      loadConnectedSourcePolicyAdministration({}, TEST_CONNECTED_SOURCE_CLOCK),
    ).resolves.toBeUndefined();
  });

  it("narrows the core controller to a genuine status-and-kill capability", async () => {
    const fixture = await createTestConnectedSourcePolicyFixture();
    directories.push(fixture.directory);

    expect(isConnectedSourcePolicyAdministration(fixture.administration)).toBe(
      true,
    );
    expect(Object.keys(fixture.administration).sort()).toEqual([
      "kill",
      "status",
    ]);
    expect(fixture.administration).not.toHaveProperty("execute");
    expect(fixture.administration).not.toHaveProperty("authorizeOperation");
    expect(fixture.administration.status()).toMatchObject({ status: "ready" });
    fixture.administration.kill();
    expect(fixture.administration.status()).toMatchObject({
      reasonCode: "OWNER_KILL_SWITCH",
      status: "killed",
    });
    expect(isConnectedSourcePolicyAdministration(Object.freeze({}))).toBe(
      false,
    );
  });

  it("rejects partial, unpinned, reference-mismatched, and clockless startup", async () => {
    const fixture = await createTestConnectedSourcePolicyFixture();
    directories.push(fixture.directory);
    const cases = [
      {
        [CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY]: fixture.bundlePath,
      },
      {
        ...fixture.environment,
        [CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY]: `sha256:${"0".repeat(64)}`,
      },
      {
        ...fixture.environment,
        [CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY]:
          "owner-local:different-reference",
      },
      {
        ...fixture.environment,
        [CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY]:
          "sk_live_private_canary",
      },
    ];
    for (const environment of cases) {
      await expect(
        loadConnectedSourcePolicyAdministration(
          environment,
          TEST_CONNECTED_SOURCE_CLOCK,
        ),
      ).rejects.toBeInstanceOf(ConnectedSourcePolicyCompositionError);
    }
    await expect(
      loadConnectedSourcePolicyAdministration(fixture.environment),
    ).rejects.toBeInstanceOf(ConnectedSourcePolicyCompositionError);
    for (const now of [
      () => "not-an-instant",
      () => {
        throw new Error("private-clock-canary");
      },
    ]) {
      await expect(
        loadConnectedSourcePolicyAdministration(fixture.environment, { now }),
      ).rejects.toBeInstanceOf(ConnectedSourcePolicyCompositionError);
    }
  });

  it("rejects UNC, device-namespace, and root-relative bundle paths before file access", async () => {
    for (const bundlePath of [
      String.raw`\\server\share\connected-source-policy.bundle.json`,
      String.raw`\\?\UNC\server\share\connected-source-policy.bundle.json`,
      String.raw`\\?\C:\policy\connected-source-policy.bundle.json`,
      String.raw`\\.\C:\policy\connected-source-policy.bundle.json`,
      String.raw`\policy\connected-source-policy.bundle.json`,
      "//server/share/connected-source-policy.bundle.json",
    ]) {
      await expect(
        loadConnectedSourcePolicyAdministration(
          {
            [CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY]: bundlePath,
            [CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY]: `sha256:${"1".repeat(64)}`,
            [CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY]:
              TEST_CONNECTED_SOURCE_SECRET_REFERENCE,
          },
          TEST_CONNECTED_SOURCE_CLOCK,
        ),
      ).rejects.toBeInstanceOf(ConnectedSourcePolicyCompositionError);
    }
  });

  it("requires an exact canonical stable single-link regular-file bundle", async () => {
    const fixture = await createTestConnectedSourcePolicyFixture();
    directories.push(fixture.directory);
    const original = await readFile(fixture.bundlePath);
    const noncanonical = Buffer.concat([original, Buffer.from(" ")]);
    await writeFile(fixture.bundlePath, noncanonical);
    await expect(
      loadConnectedSourcePolicyAdministration(
        {
          ...fixture.environment,
          [CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY]: sha256(noncanonical),
        },
        TEST_CONNECTED_SOURCE_CLOCK,
      ),
    ).rejects.toBeInstanceOf(ConnectedSourcePolicyCompositionError);

    await writeFile(fixture.bundlePath, original);
    const hardLink = join(fixture.directory, "bundle-hard-link.json");
    await link(fixture.bundlePath, hardLink);
    await expect(
      loadConnectedSourcePolicyAdministration(
        fixture.environment,
        TEST_CONNECTED_SOURCE_CLOCK,
      ),
    ).rejects.toBeInstanceOf(ConnectedSourcePolicyCompositionError);
  });

  it("never reflects sensitive startup values through generic failures", async () => {
    const pathCanary = "private-path-canary";
    const error = await loadConnectedSourcePolicyAdministration(
      {
        [CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY]: pathCanary,
        [CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY]: `sha256:${"1".repeat(64)}`,
        [CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY]:
          TEST_CONNECTED_SOURCE_SECRET_REFERENCE,
      },
      TEST_CONNECTED_SOURCE_CLOCK,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConnectedSourcePolicyCompositionError);
    expect(String(error)).not.toContain(pathCanary);
    expect(String(error)).not.toContain(TEST_CONNECTED_SOURCE_SECRET_REFERENCE);
  });
});

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
