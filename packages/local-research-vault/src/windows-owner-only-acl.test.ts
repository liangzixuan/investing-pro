import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { WindowsOwnerOnlyAclTarget } from "./local-vault-paths";
import {
  createNativeWindowsOwnerOnlyAclPort,
  type WindowsAclCommandExecutor,
} from "./windows-owner-only-acl";

describe("Windows owner-only ACL adapter", () => {
  it("returns a receipt only after the fixed verifier succeeds", async () => {
    const requests: unknown[] = [];
    const executor: WindowsAclCommandExecutor = {
      execute(encoded) {
        requests.push(
          JSON.parse(
            Buffer.from(encoded, "base64").toString("utf8"),
          ) as unknown,
        );
        return Promise.resolve("S-1-5-21-1000\r\n");
      },
    };
    const target: WindowsOwnerOnlyAclTarget = {
      canonicalRootPath: "C:\\vault",
      targetPaths: ["C:\\vault", "C:\\vault\\vault.sqlite3"],
    };
    const port = createNativeWindowsOwnerOnlyAclPort(executor);
    await expect(
      port.provisionAndVerifyOwnerOnly(target),
    ).resolves.toMatchObject({
      canonicalRootPath: target.canonicalRootPath,
      ownerIdentity: "S-1-5-21-1000",
      ownerOnly: true,
      inheritanceProtected: true,
      verifiedPaths: target.targetPaths,
    });
    expect(requests).toEqual([
      { mode: "provision", targetPaths: target.targetPaths },
    ]);
  });

  it("rejects a command success that does not prove a Windows owner SID", async () => {
    const port = createNativeWindowsOwnerOnlyAclPort({
      execute: () => Promise.resolve("command completed"),
    });
    await expect(
      port.verifyOwnerOnly({
        canonicalRootPath: "C:\\vault",
        targetPaths: ["C:\\vault"],
      }),
    ).rejects.toMatchObject({ code: "VAULT_SECURITY_BOUNDARY_REJECTED" });
  });

  const windowsIt = process.platform === "win32" ? it : it.skip;
  windowsIt(
    "modifies the current owner's directory and file DACL without ownership privileges",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "cycle3d-native-owner-acl-"));
      const file = join(root, "vault.sqlite3");
      await writeFile(file, "test-only");
      const target: WindowsOwnerOnlyAclTarget = {
        canonicalRootPath: root,
        targetPaths: [root, file],
      };

      try {
        const port = createNativeWindowsOwnerOnlyAclPort();
        await expect(
          port.provisionAndVerifyOwnerOnly(target),
        ).resolves.toMatchObject({
          canonicalRootPath: root,
          verifiedPaths: [root, file],
          ownerOnly: true,
          inheritanceProtected: true,
        });
        await expect(port.verifyOwnerOnly(target)).resolves.toMatchObject({
          canonicalRootPath: root,
          verifiedPaths: [root, file],
          ownerOnly: true,
          inheritanceProtected: true,
        });
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    },
    20_000,
  );
});
