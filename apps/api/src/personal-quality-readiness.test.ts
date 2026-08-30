import { link, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  isPersonalQualityReadinessCapability,
  loadPersonalQualityReadiness,
  PersonalQualityReadinessError,
} from "./personal-quality-readiness";
import {
  createPublicPersonalQualityReadinessFixture,
  createValidPersonalQualityReadinessWrapper,
  encodePersonalQualityReadinessWrapper,
  personalQualityReadinessEnvironment,
} from "./test-personal-quality-readiness-builder";

const directories: string[] = [];
const GENERIC_MESSAGE = "Personal filing quality readiness is unavailable.";
const PRIVATE_CANARY = "private-quality-canary-value";

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map(async (directory) =>
        rm(directory, { force: true, recursive: true }),
      ),
  );
});

describe("personal quality readiness", () => {
  it("is disabled only when both configuration keys are absent", async () => {
    await expect(loadPersonalQualityReadiness({})).resolves.toBeUndefined();
    for (const environment of [
      { PERSONAL_FILING_QUALITY_RESULT_PATH: "C:\\missing.json" },
      { PERSONAL_FILING_QUALITY_RESULT_SHA256: `sha256:${"a".repeat(64)}` },
      {
        PERSONAL_FILING_QUALITY_RESULT_PATH: "",
        PERSONAL_FILING_QUALITY_RESULT_SHA256: `sha256:${"a".repeat(64)}`,
      },
    ]) {
      await expectGenericFailure(environment);
    }
  });

  it("returns only a frozen WeakSet-backed opaque capability", async () => {
    const fixture = await createPublicPersonalQualityReadinessFixture();
    directories.push(fixture.directory);

    expect(isPersonalQualityReadinessCapability(fixture.capability)).toBe(true);
    expect(Object.isFrozen(fixture.capability)).toBe(true);
    expect(Reflect.ownKeys(fixture.capability)).toEqual([]);
    expect(isPersonalQualityReadinessCapability(Object.freeze({}))).toBe(false);
    expect(isPersonalQualityReadinessCapability(null)).toBe(false);
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    expect(isPersonalQualityReadinessCapability(proxy)).toBe(false);
  });

  it("accepts both bounded one- and two-document zero-tolerance results", async () => {
    for (const documentCount of [1, 2]) {
      const { directory, path } = await tempPath();
      const bytes = encodePersonalQualityReadinessWrapper(
        createValidPersonalQualityReadinessWrapper(documentCount),
      );
      await writeFile(path, bytes);
      const capability = await loadPersonalQualityReadiness(
        personalQualityReadinessEnvironment(path, bytes),
      );
      expect(isPersonalQualityReadinessCapability(capability)).toBe(true);
      expect(directory).toContain("personal-quality-readiness-test-");
    }
  });

  it("rejects a wrong file digest and noncanonical or non-LF JSON", async () => {
    const wrapper = createValidPersonalQualityReadinessWrapper();
    const canonical = encodePersonalQualityReadinessWrapper(wrapper);
    for (const bytes of [
      canonical,
      new TextEncoder().encode(`${JSON.stringify(wrapper, null, 2)}\n`),
      new TextEncoder().encode(
        `${new TextDecoder().decode(canonical).trim()}\r\n`,
      ),
    ]) {
      const { path } = await tempPath();
      await writeFile(path, bytes);
      const environment = personalQualityReadinessEnvironment(path, bytes);
      if (bytes === canonical) {
        await expectGenericFailure({
          ...environment,
          PERSONAL_FILING_QUALITY_RESULT_SHA256: `sha256:${"f".repeat(64)}`,
        });
      } else {
        await expectGenericFailure(environment);
      }
    }
  });

  it("rejects invalid UTF-8, empty files, directories, and oversize files", async () => {
    for (const bytes of [
      new Uint8Array([0xff, 0x0a]),
      new Uint8Array(),
      new Uint8Array(1024 * 1024 + 1).fill(0x20),
    ]) {
      const { path } = await tempPath();
      await writeFile(path, bytes);
      await expectGenericFailure(
        personalQualityReadinessEnvironment(path, bytes),
      );
    }
    const { directory } = await tempPath();
    const fake = new TextEncoder().encode("{}\n");
    await expectGenericFailure(
      personalQualityReadinessEnvironment(directory, fake),
    );
  });

  it("rejects a symbolic link when the platform permits creating one", async () => {
    const { directory, path } = await tempPath();
    const target = join(directory, "target.json");
    const bytes = encodePersonalQualityReadinessWrapper(
      createValidPersonalQualityReadinessWrapper(),
    );
    await writeFile(target, bytes);
    try {
      await symlink(target, path);
    } catch {
      return;
    }
    await expectGenericFailure(
      personalQualityReadinessEnvironment(path, bytes),
    );
  });

  it("rejects a hard-linked aggregate when the platform permits it", async () => {
    const { directory, path } = await tempPath();
    const target = join(directory, "target.json");
    const bytes = encodePersonalQualityReadinessWrapper(
      createValidPersonalQualityReadinessWrapper(),
    );
    await writeFile(target, bytes);
    try {
      await link(target, path);
    } catch {
      return;
    }
    await expectGenericFailure(
      personalQualityReadinessEnvironment(path, bytes),
    );
  });

  it("rejects not-met, wrapper, runner, audit, count, metric, and hash mismatches", async () => {
    const mutators: Array<(wrapper: Record<string, unknown>) => void> = [
      (wrapper) => {
        result(wrapper).personalQualityThresholdOutcome = "not_met";
      },
      (wrapper) => {
        result(wrapper).failedThresholds = ["fact_recall_minimum"];
      },
      (wrapper) => {
        wrapper.extra = PRIVATE_CANARY;
      },
      (wrapper) => {
        runner(wrapper).sourceCommit = "0".repeat(40);
      },
      (wrapper) => {
        runner(wrapper).originalAggregateSha256 = PRIVATE_CANARY;
      },
      (wrapper) => {
        result(wrapper).candidateCommitmentSha256 = `sha256:${"e".repeat(64)}`;
      },
      (wrapper) => {
        result(wrapper).evaluationSha256 = `sha256:${"e".repeat(64)}`;
      },
      (wrapper) => {
        audit(wrapper).documentCount = 2;
      },
      (wrapper) => {
        counts(wrapper).falseNegativeFactCount = 1;
      },
      (wrapper) => {
        metric(wrapper, "factRecall").numerator = 9;
      },
      (wrapper) => {
        metric(wrapper, "quarantineRate").thresholdKind = "minimum";
      },
    ];
    for (const mutate of mutators) {
      const wrapper = createValidPersonalQualityReadinessWrapper();
      mutate(wrapper);
      const { path } = await tempPath();
      const bytes = encodePersonalQualityReadinessWrapper(wrapper);
      await writeFile(path, bytes);
      await expectGenericFailure(
        personalQualityReadinessEnvironment(path, bytes),
      );
    }
  });

  it("never includes configured material in errors", async () => {
    const { path } = await tempPath();
    const bytes = new TextEncoder().encode(
      `{"canary":"${PRIVATE_CANARY}","path":"${path.replaceAll("\\", "\\\\")}"}\n`,
    );
    await writeFile(path, bytes);
    try {
      await loadPersonalQualityReadiness(
        personalQualityReadinessEnvironment(path, bytes),
      );
      throw new Error("Expected readiness failure.");
    } catch (error) {
      expect(error).toBeInstanceOf(PersonalQualityReadinessError);
      expect(error).toMatchObject({ message: GENERIC_MESSAGE });
      expect(String(error)).not.toContain(PRIVATE_CANARY);
      expect(String(error)).not.toContain(path);
      expect(Object.keys(error as object)).toEqual([]);
    }
  });
});

async function tempPath(): Promise<{ directory: string; path: string }> {
  const directory = join(
    tmpdir(),
    `personal-quality-readiness-test-${crypto.randomUUID()}`,
  );
  await mkdir(directory);
  directories.push(directory);
  return { directory, path: join(directory, "quality-result.json") };
}

async function expectGenericFailure(
  environment: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  try {
    await loadPersonalQualityReadiness(environment);
    throw new Error("Expected readiness failure.");
  } catch (error) {
    expect(error).toBeInstanceOf(PersonalQualityReadinessError);
    expect(error).toMatchObject({ message: GENERIC_MESSAGE });
  }
}

function result(wrapper: Record<string, unknown>): Record<string, unknown> {
  return wrapper.result as Record<string, unknown>;
}

function runner(wrapper: Record<string, unknown>): Record<string, unknown> {
  return wrapper.runner as Record<string, unknown>;
}

function audit(wrapper: Record<string, unknown>): Record<string, unknown> {
  return result(wrapper).audit as Record<string, unknown>;
}

function counts(wrapper: Record<string, unknown>): Record<string, unknown> {
  return result(wrapper).counts as Record<string, unknown>;
}

function metric(
  wrapper: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return (result(wrapper).metrics as Record<string, unknown>)[key] as Record<
    string,
    unknown
  >;
}
