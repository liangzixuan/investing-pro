import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CHECKS,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_NOT_PROVEN,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
  createFilingParserArchivePairCustodyProtocolForTest,
  exactFileIdentityMatchesForTest,
  type FilingParserArchivePairCustodyPhase,
} from "./parser-archive-pair-custody";
import { createSyntheticFilingParserArchivePairFixture } from "./parser-archive-pair-fixture";

const SOURCE_CONTEXT = `sha256:${"1".repeat(64)}` as const;
const ownedParents: string[] = [];

afterEach(async () => {
  await Promise.all(
    ownedParents
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("filing parser archive pair custody", () => {
  it("exports the separate exact-pair contract without widening Cycle 2c v1", () => {
    expect(FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM).toBe(
      "bounded_synthetic_exact_parser_archive_pair_encrypted_custody_and_authenticated_readback",
    );
    expect(FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CHECKS).toHaveLength(16);
    expect(FILING_PARSER_ARCHIVE_PAIR_CUSTODY_NOT_PROVEN).toHaveLength(16);
    expect(FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES).toEqual({
      amendment: {
        byteLength: 2_330,
        contentSha256:
          "sha256:df7f1ff416b60168b09902bd7714fa47bf0453ef9732c8c5b476988bb70f47a8",
        role: "amendment",
      },
      original: {
        byteLength: 2_306,
        contentSha256:
          "sha256:f331ff51540c11aca55a5d1d81d2c1daeaf4354acdea45530faed5275a5322ba",
        role: "original",
      },
    });
  });

  it("encrypts both exact roles, authenticates owned readback, derives distinct role bindings, and cleans before publication", async () => {
    const parent = await testParent();
    const fixture = createSyntheticFilingParserArchivePairFixture();
    let observedWorkspace: string | undefined;
    const result = await createFilingParserArchivePairCustodyProtocolForTest({
      afterPhase: (phase, workspace) => {
        if (phase === "pair_published") observedWorkspace = workspace;
      },
      entropy: deterministicEntropy(),
      workspaceParentDirectory: parent,
    }).custodyAndRead(
      SOURCE_CONTEXT,
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    expect(result.status).toBe("readback");
    if (result.status !== "readback") throw new TypeError();
    expect(result.originalArchive).toEqual(fixture.originalArchive);
    expect(result.amendmentArchive).toEqual(fixture.amendmentArchive);
    expect(result.originalArchive).not.toBe(fixture.originalArchive);
    expect(result.amendmentArchive).not.toBe(fixture.amendmentArchive);
    expect(result.receipts.map(({ role }) => role)).toEqual([
      "original",
      "amendment",
    ]);
    expect(result.receipts[0].sourceBindingSha256).not.toBe(
      result.receipts[1].sourceBindingSha256,
    );
    expect(result.receipts[0].sourceBindingSha256).not.toBe(SOURCE_CONTEXT);
    expect(result.audit).toEqual({
      cleanupCount: 1,
      readbackCount: 2,
      stagedArchiveCount: 2,
      zeroResidue: true,
    });
    expect(observedWorkspace).toBeDefined();
    expect(await readdir(parent)).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.receipts)).toBe(true);
  });

  it("quarantines ciphertext tamper and still removes the owned workspace", async () => {
    const parent = await testParent();
    const fixture = createSyntheticFilingParserArchivePairFixture();
    const result = await createFilingParserArchivePairCustodyProtocolForTest({
      afterPhase: async (phase, workspace) => {
        if (phase !== "pair_published") return;
        const path = join(workspace, "pair", "original", "ciphertext.bin");
        const bytes = Uint8Array.from(await readFile(path));
        bytes[0] = (bytes[0] ?? 0) ^ 0xff;
        await writeFile(path, bytes);
      },
      entropy: deterministicEntropy(),
      workspaceParentDirectory: parent,
    }).custodyAndRead(
      SOURCE_CONTEXT,
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    expect(result).toEqual({
      claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
      code: "parser_archive_pair_custody_quarantined",
      schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
      status: "quarantined",
      synthetic: true,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(await readdir(parent)).toEqual([]);
  });

  it("quarantines cleanup-phase failure only after actual zero-residue cleanup", async () => {
    const parent = await testParent();
    const fixture = createSyntheticFilingParserArchivePairFixture();
    const result = await createFilingParserArchivePairCustodyProtocolForTest({
      afterPhase: (phase) => {
        if (phase === "before_cleanup") throw new TypeError("injected");
      },
      entropy: deterministicEntropy(),
      workspaceParentDirectory: parent,
    }).custodyAndRead(
      SOURCE_CONTEXT,
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    expect(result.status).toBe("quarantined");
    expect(await readdir(parent)).toEqual([]);
  });

  it.each([
    ["same key only", [1, 2, 1, 3]],
    ["same nonce only", [1, 2, 3, 2]],
    ["same key and nonce pair", [1, 2, 1, 2]],
  ] as const)(
    "quarantines %s entropy reuse before pair publication and leaves zero residue",
    async (_label, seeds) => {
      const parent = await testParent();
      const fixture = createSyntheticFilingParserArchivePairFixture();
      let pairPublished = false;
      const result = await createFilingParserArchivePairCustodyProtocolForTest({
        afterPhase: (phase) => {
          if (phase === "pair_published") pairPublished = true;
        },
        entropy: seededEntropy(seeds),
        workspaceParentDirectory: parent,
      }).custodyAndRead(
        SOURCE_CONTEXT,
        fixture.originalArchive,
        fixture.amendmentArchive,
      );
      expect(result.status).toBe("quarantined");
      expect(pairPublished).toBe(false);
      expect(await readdir(parent)).toEqual([]);
    },
  );

  it("wipes every raw entropy-provider buffer after taking its owned clone", async () => {
    const parent = await testParent();
    const fixture = createSyntheticFilingParserArchivePairFixture();
    const provided: Uint8Array[] = [];
    let counter = 0;
    const result = await createFilingParserArchivePairCustodyProtocolForTest({
      entropy: (length) => {
        counter += 1;
        const bytes = Uint8Array.from(
          { length },
          (_, index) => (index * 31 + counter * 23) & 0xff,
        );
        provided.push(bytes);
        return bytes;
      },
      workspaceParentDirectory: parent,
    }).custodyAndRead(
      SOURCE_CONTEXT,
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    expect(result.status).toBe("readback");
    expect(provided).toHaveLength(4);
    expect(provided.every((bytes) => bytes.every((byte) => byte === 0))).toBe(
      true,
    );
  });

  it.each(["extra role", "extra file"] as const)(
    "rejects an %s in the exact published pair workspace",
    async (kind) => {
      const parent = await testParent();
      const fixture = createSyntheticFilingParserArchivePairFixture();
      const result = await createFilingParserArchivePairCustodyProtocolForTest({
        afterPhase: async (phase, workspace) => {
          if (phase !== "pair_published") return;
          if (kind === "extra role")
            await mkdir(join(workspace, "pair", "unexpected-role"));
          else
            await writeFile(
              join(workspace, "pair", "original", "unexpected.bin"),
              Uint8Array.of(1),
            );
        },
        entropy: deterministicEntropy(),
        workspaceParentDirectory: parent,
      }).custodyAndRead(
        SOURCE_CONTEXT,
        fixture.originalArchive,
        fixture.amendmentArchive,
      );
      expect(result.status).toBe("quarantined");
      expect(await readdir(parent)).toEqual([]);
    },
  );

  it("identity-binds cleanup so a rename-plus-decoy ABA cannot delete the replacement or leave the owned workspace", async () => {
    const parent = await testParent();
    const fixture = createSyntheticFilingParserArchivePairFixture();
    let originalPath: string | undefined;
    let movedPath: string | undefined;
    const result = await createFilingParserArchivePairCustodyProtocolForTest({
      afterPhase: async (phase, workspace) => {
        if (phase !== "before_cleanup") return;
        originalPath = workspace;
        movedPath = `${workspace}-moved`;
        await rename(workspace, movedPath);
        await mkdir(workspace);
      },
      entropy: deterministicEntropy(),
      workspaceParentDirectory: parent,
    }).custodyAndRead(
      SOURCE_CONTEXT,
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    expect(result.status).toBe("quarantined");
    expect(originalPath).toBeDefined();
    expect(movedPath).toBeDefined();
    expect((await lstat(originalPath as string)).isDirectory()).toBe(true);
    await expect(lstat(movedPath as string)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("does not follow a junction replacement while locating and removing the owned workspace identity", async () => {
    const parent = await testParent();
    const fixture = createSyntheticFilingParserArchivePairFixture();
    let replacementPath: string | undefined;
    let movedPath: string | undefined;
    const result = await createFilingParserArchivePairCustodyProtocolForTest({
      afterPhase: async (phase, workspace) => {
        if (phase !== "before_cleanup") return;
        replacementPath = workspace;
        movedPath = `${workspace}-moved`;
        await rename(workspace, movedPath);
        await symlink(movedPath, workspace, "junction");
      },
      entropy: deterministicEntropy(),
      workspaceParentDirectory: parent,
    }).custodyAndRead(
      SOURCE_CONTEXT,
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    expect(result.status).toBe("quarantined");
    expect(replacementPath).toBeDefined();
    expect((await lstat(replacementPath as string)).isSymbolicLink()).toBe(
      true,
    );
    await expect(lstat(movedPath as string)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("removes only its owned identity and preserves unrelated parent residue", async () => {
    const parent = await testParent();
    await mkdir(join(parent, "unrelated-residue"));
    const fixture = createSyntheticFilingParserArchivePairFixture();
    const result = await createFilingParserArchivePairCustodyProtocolForTest({
      entropy: deterministicEntropy(),
      workspaceParentDirectory: parent,
    }).custodyAndRead(
      SOURCE_CONTEXT,
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    expect(result.status).toBe("readback");
    expect(await readdir(parent)).toEqual(["unrelated-residue"]);
  });

  it.runIf(process.platform === "win32")(
    "accepts a Windows alias spelling only when realpath proves the same directory identity",
    async () => {
      const parent = await testParent();
      const fixture = createSyntheticFilingParserArchivePairFixture();
      let firstPhase: FilingParserArchivePairCustodyPhase | undefined;
      const result = await createFilingParserArchivePairCustodyProtocolForTest({
        afterPhase: (phase) => {
          firstPhase ??= phase;
        },
        entropy: deterministicEntropy(),
        workspaceParentDirectory: parent.toUpperCase(),
      }).custodyAndRead(
        SOURCE_CONTEXT,
        fixture.originalArchive,
        fixture.amendmentArchive,
      );
      expect(firstPhase).toBe("workspace_created");
      expect(result.status).toBe("readback");
      expect(await readdir(parent)).toEqual([]);
    },
  );

  it("compares device and inode identities without 64-bit precision loss", () => {
    const leftInode = 9_007_199_254_740_992n;
    const rightInode = leftInode + 1n;
    expect(Number(leftInode)).toBe(Number(rightInode));
    expect(exactFileIdentityMatchesForTest(7n, leftInode, 7n, rightInode)).toBe(
      false,
    );
    expect(exactFileIdentityMatchesForTest(7n, leftInode, 7n, leftInode)).toBe(
      true,
    );
    expect(exactFileIdentityMatchesForTest(7n, leftInode, 8n, leftInode)).toBe(
      false,
    );
  });

  it("rejects an ancestor directory link before creating a workspace", async ({
    skip,
  }) => {
    const root = await testParent();
    const targetRoot = join(root, "target");
    const realParent = join(targetRoot, "parent");
    const ancestorAlias = join(root, "ancestor-alias");
    await mkdir(realParent, { recursive: true });
    try {
      await symlink(
        targetRoot,
        ancestorAlias,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if (isLinkCapabilityError(error))
        skip("directory links are unavailable in this environment");
      throw error;
    }
    const fixture = createSyntheticFilingParserArchivePairFixture();
    let firstPhase: FilingParserArchivePairCustodyPhase | undefined;
    const result = await createFilingParserArchivePairCustodyProtocolForTest({
      afterPhase: (phase) => {
        firstPhase ??= phase;
      },
      entropy: deterministicEntropy(),
      workspaceParentDirectory: join(ancestorAlias, "parent"),
    }).custodyAndRead(
      SOURCE_CONTEXT,
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    expect(firstPhase).toBeUndefined();
    expect(result.status).toBe("quarantined");
    expect(await readdir(realParent)).toEqual([]);
  });

  it("reserves one-shot state before await so concurrency invalidates both calls", async () => {
    const parent = await testParent();
    const fixture = createSyntheticFilingParserArchivePairFixture();
    let release = (): void => undefined;
    let started = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const observed = new Promise<void>((resolve) => {
      started = resolve;
    });
    const protocol = createFilingParserArchivePairCustodyProtocolForTest({
      afterPhase: async (phase) => {
        if (phase !== "workspace_created") return;
        started();
        await gate;
      },
      entropy: deterministicEntropy(),
      workspaceParentDirectory: parent,
    });
    const first = protocol.custodyAndRead(
      SOURCE_CONTEXT,
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    await observed;
    const second = await protocol.custodyAndRead(
      SOURCE_CONTEXT,
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    release();
    expect(second.status).toBe("quarantined");
    expect((await first).status).toBe("quarantined");
    expect(await readdir(parent)).toEqual([]);
  });

  it("rejects role swap, archive mutation, replay, hostile carriers, and hidden arguments", async () => {
    const fixture = createSyntheticFilingParserArchivePairFixture();
    const cases: readonly (readonly [unknown, unknown])[] = [
      [fixture.amendmentArchive, fixture.originalArchive],
      [tamper(fixture.originalArchive), fixture.amendmentArchive],
      [Buffer.from(fixture.originalArchive), fixture.amendmentArchive],
      [
        new Uint8Array(
          new SharedArrayBuffer(fixture.originalArchive.byteLength),
        ),
        fixture.amendmentArchive,
      ],
    ];
    for (const [original, amendment] of cases) {
      const parent = await testParent();
      const result = await createFilingParserArchivePairCustodyProtocolForTest({
        entropy: deterministicEntropy(),
        workspaceParentDirectory: parent,
      }).custodyAndRead(SOURCE_CONTEXT, original, amendment);
      expect(result.status).toBe("quarantined");
      expect(await readdir(parent)).toEqual([]);
    }

    const parent = await testParent();
    const protocol = createFilingParserArchivePairCustodyProtocolForTest({
      entropy: deterministicEntropy(),
      workspaceParentDirectory: parent,
    });
    const first = await protocol.custodyAndRead(
      SOURCE_CONTEXT,
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    expect(first.status).toBe("readback");
    expect(
      (
        await protocol.custodyAndRead(
          SOURCE_CONTEXT,
          fixture.originalArchive,
          fixture.amendmentArchive,
        )
      ).status,
    ).toBe("quarantined");
  });
});

async function testParent(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "cycle2o-pair-test-"));
  ownedParents.push(path);
  return path;
}

function deterministicEntropy(): (length: number) => Uint8Array {
  let counter = 0;
  return (length: number): Uint8Array => {
    counter += 1;
    return Uint8Array.from(
      { length },
      (_, index) => (index * 29 + counter * 17) & 0xff,
    );
  };
}

function seededEntropy(
  seeds: readonly number[],
): (length: number) => Uint8Array {
  let call = 0;
  return (length: number): Uint8Array => {
    const seed = seeds[call];
    call += 1;
    if (seed === undefined) throw new TypeError("unexpected entropy request");
    return Uint8Array.from(
      { length },
      (_, index) => (index * 29 + seed * 17) & 0xff,
    );
  };
}

function tamper(value: Uint8Array): Uint8Array {
  const result = Uint8Array.from(value);
  result[0] = (result[0] ?? 0) ^ 0xff;
  return result;
}

function isLinkCapabilityError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ["EACCES", "EINVAL", "ENOSYS", "EPERM"].includes(
      String((error as { readonly code?: unknown }).code),
    )
  );
}
