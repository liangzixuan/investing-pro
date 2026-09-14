import { execFileSync } from "node:child_process";
import {
  chmodSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createPersonalOwnerAccountRecord,
  isValidPersonalOwnerPassword,
  isValidPersonalOwnerUsername,
  PersonalOwnerAccountConfigurationError,
  type PersonalOwnerAccountRecord,
  readPersonalOwnerAccountFile,
  validatePersonalOwnerAccountRecord,
  verifyPersonalOwnerAccountPassword,
  writePersonalOwnerAccountFile,
} from "./personal-owner-account";

const password = "Synthetic owner passphrase 🌱";
const directory = mkdtempSync(join(tmpdir(), "cockpit-owner-account-test-"));
let record: PersonalOwnerAccountRecord;

beforeAll(async () => {
  record = await createPersonalOwnerAccountRecord("owner.test", password);
});

afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("durable local owner account", () => {
  it("uses a fixed scrypt profile and verifies passwords without normalizing them", async () => {
    expect(record).toMatchObject({
      version: 1,
      username: "owner.test",
      kdf: "scrypt",
      cost: 131_072,
      blockSize: 8,
      parallelization: 1,
    });
    expect(record.salt).toMatch(/^[a-f0-9]{64}$/u);
    expect(record.verifier).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(record)).not.toContain(password);
    expect(
      await verifyPersonalOwnerAccountPassword(record, "owner.test", password),
    ).toBe(true);
    expect(
      await verifyPersonalOwnerAccountPassword(
        record,
        "someone.else",
        password,
      ),
    ).toBe(false);
    expect(
      await verifyPersonalOwnerAccountPassword(
        record,
        "owner.test",
        `${password} `,
      ),
    ).toBe(false);
  });

  it("bounds username and Unicode password input without trimming or composition rules", () => {
    for (const username of ["owner", "owner@example.test", "a".repeat(64)])
      expect(isValidPersonalOwnerUsername(username)).toBe(true);
    for (const username of [
      "",
      " owner",
      "owner ",
      "a".repeat(65),
      "所有者",
      "owner/name",
    ])
      expect(isValidPersonalOwnerUsername(username)).toBe(false);
    expect(isValidPersonalOwnerPassword(" ".repeat(15))).toBe(true);
    expect(isValidPersonalOwnerPassword("a".repeat(14))).toBe(false);
    expect(isValidPersonalOwnerPassword("🌱".repeat(128))).toBe(true);
    expect(isValidPersonalOwnerPassword("🌱".repeat(129))).toBe(false);
    expect(
      isValidPersonalOwnerPassword(
        `a long password ${String.fromCharCode(0xd800)}`,
      ),
    ).toBe(false);
  });

  it("rejects extra keys, unbounded work factors, malformed encodings, and accessors", async () => {
    for (const candidate of [
      { ...record, cost: 1_048_576 },
      { ...record, blockSize: 16 },
      { ...record, parallelization: 8 },
      { ...record, version: 2 },
      { ...record, salt: "a".repeat(63) },
      { ...record, verifier: "F".repeat(64) },
      { ...record, password },
      { ...record, username: "" },
    ])
      expect(() => validatePersonalOwnerAccountRecord(candidate)).toThrow(
        PersonalOwnerAccountConfigurationError,
      );
    const accessor = { ...record };
    Object.defineProperty(accessor, "username", {
      get: () => {
        throw new Error("must not run");
      },
    });
    expect(() => validatePersonalOwnerAccountRecord(accessor)).toThrow(
      PersonalOwnerAccountConfigurationError,
    );
    await expect(
      createPersonalOwnerAccountRecord("owner", "short"),
    ).rejects.toThrow(PersonalOwnerAccountConfigurationError);
  });

  it("atomically creates an owner-only verifier and requires explicit reset to replace it", () => {
    const path = join(directory, "setup.json");
    writePersonalOwnerAccountFile(path, record);
    expect(readPersonalOwnerAccountFile(path)).toEqual(record);
    expect(readFileSync(path, "utf8")).not.toContain(password);
    expect(() => writePersonalOwnerAccountFile(path, record)).toThrow(
      PersonalOwnerAccountConfigurationError,
    );
    const replacement = validatePersonalOwnerAccountRecord({
      ...record,
      username: "renamed.owner",
    });
    writePersonalOwnerAccountFile(path, replacement, { replace: true });
    expect(readPersonalOwnerAccountFile(path).username).toBe("renamed.owner");
    expect(() =>
      writePersonalOwnerAccountFile(
        join(directory, "absent-reset.json"),
        record,
        { replace: true },
      ),
    ).toThrow(PersonalOwnerAccountConfigurationError);
  }, 30_000);

  it("fails closed for missing, corrupt, oversized, and hardlinked account files", () => {
    const path = join(directory, "invalid.json");
    expect(() => readPersonalOwnerAccountFile(path)).toThrow(
      PersonalOwnerAccountConfigurationError,
    );
    writePersonalOwnerAccountFile(path, record);
    const alias = join(directory, "linked.json");
    linkSync(path, alias);
    expect(() => readPersonalOwnerAccountFile(path)).toThrow(
      PersonalOwnerAccountConfigurationError,
    );
    expect(() =>
      writePersonalOwnerAccountFile(path, record, { replace: true }),
    ).toThrow(PersonalOwnerAccountConfigurationError);
    rmSync(alias);
    writeFileSync(path, "{");
    expect(() => readPersonalOwnerAccountFile(path)).toThrow(
      PersonalOwnerAccountConfigurationError,
    );
    writeFileSync(path, "a".repeat(2_049));
    expect(() => readPersonalOwnerAccountFile(path)).toThrow(
      PersonalOwnerAccountConfigurationError,
    );
    expect(() => readPersonalOwnerAccountFile("relative.json")).toThrow(
      PersonalOwnerAccountConfigurationError,
    );
  }, 30_000);

  it("rejects linked parent directories and broad file permissions", () => {
    const actual = join(directory, "actual");
    const linked = join(directory, "parent-link");
    mkdirSync(actual, { mode: 0o700 });
    const path = join(actual, "account.json");
    writePersonalOwnerAccountFile(path, record);
    symlinkSync(
      actual,
      linked,
      process.platform === "win32" ? "junction" : "dir",
    );
    expect(() =>
      readPersonalOwnerAccountFile(join(linked, "account.json")),
    ).toThrow(PersonalOwnerAccountConfigurationError);
    expect(() =>
      writePersonalOwnerAccountFile(join(linked, "new.json"), record),
    ).toThrow(PersonalOwnerAccountConfigurationError);
    if (process.platform === "win32") {
      const script =
        "$p=$env:RESEARCH_COCKPIT_TEST_ACL_PATH; $a=[System.IO.File]::GetAccessControl($p); $a.SetAccessRuleProtection($false,$true); [System.IO.File]::SetAccessControl($p,$a)";
      execFileSync(
        join(
          process.env.SystemRoot ?? "C:\\Windows",
          "System32",
          "WindowsPowerShell",
          "v1.0",
          "powershell.exe",
        ),
        [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          Buffer.from(script, "utf16le").toString("base64"),
        ],
        {
          env: { ...process.env, RESEARCH_COCKPIT_TEST_ACL_PATH: path },
          stdio: "ignore",
          windowsHide: true,
        },
      );
    } else {
      chmodSync(path, 0o644);
    }
    expect(() => readPersonalOwnerAccountFile(path)).toThrow(
      PersonalOwnerAccountConfigurationError,
    );
  }, 30_000);
});
