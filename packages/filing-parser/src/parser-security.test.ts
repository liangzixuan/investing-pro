import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign as ed25519Sign,
  type KeyObject,
} from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  FILING_PARSER_CONCEPTS,
  FILING_PARSER_CONTAINER_LABEL,
  FILING_PARSER_LIMITS,
  FILING_PARSER_PARSER_VERSION,
  FILING_PARSER_SCHEMA_VERSION,
  FILING_PARSER_TAXONOMY_VERSION,
  FilingParserBoundaryError,
  FilingParserProcessError,
  createDockerFilingParserBoundary,
  verifyFilingParserProvenance,
  type FilingParserProcessRequest,
  type FilingParserProcessResult,
  type FilingParserProcessRunner,
  type FilingParserQuarantineCode,
  type FilingParserSigner,
  type SignedFilingParserResult,
} from "./parser-boundary";
import {
  TEST_ZIP_SIGNATURES,
  buildParserSecurityCases,
  buildTestZip,
  findTestZipSignatures,
  patchTestZipUint32,
} from "./test-archive-builder";

const IMAGE_ID = `sha256:${"a".repeat(64)}`;
const CONTAINER_ID = "b".repeat(64);
const SIGNING_KEY_ID = "cycle2a-security-key-v1";
const ARCHIVE_CANARY = "archive-payload-secret-canary";

describe("Cycle 2a filing parser security boundary", () => {
  it("rejects nonclosed factory and signer configuration value-free", () => {
    const validSigner = signingHarness().signer;
    const optionAccessor = vi.fn(() => IMAGE_ID);
    const signerAccessor = vi.fn(
      () => (payload: Uint8Array) => validSigner.sign(payload),
    );
    const validOptions = {
      imageId: IMAGE_ID,
      processRunner: new NeverRunner(),
      signer: validSigner,
    };
    const accessorOptions = {
      get imageId() {
        return optionAccessor();
      },
      processRunner: new NeverRunner(),
      signer: validSigner,
    };
    const accessorSigner = {
      algorithm: "ed25519",
      keyId: SIGNING_KEY_ID,
      get sign() {
        return signerAccessor();
      },
    };
    const symbol = Symbol("forbidden-configuration-key");
    const invalidConfigurations: unknown[] = [
      { ...validOptions, imageId: "filing-parser:latest" },
      {
        ...validOptions,
        signer: { ...validSigner, keyId: "short" },
      },
      { ...validOptions, processRunner: null },
      { ...validOptions, processRunner: { run: 42 } },
      { ...validOptions, extra: ARCHIVE_CANARY },
      { ...validOptions, [symbol]: ARCHIVE_CANARY },
      accessorOptions,
      { ...validOptions, signer: { ...validSigner, extra: ARCHIVE_CANARY } },
      { ...validOptions, signer: { ...validSigner, [symbol]: ARCHIVE_CANARY } },
      { ...validOptions, signer: accessorSigner },
    ];

    for (const configuration of invalidConfigurations) {
      let error: unknown;
      try {
        createDockerFilingParserBoundary(configuration as never);
      } catch (value) {
        error = value;
      }
      expect(error).toEqual(
        new FilingParserBoundaryError("FILING_PARSER_INVALID_CONFIGURATION"),
      );
      expect(String(error)).toBe(
        "FilingParserBoundaryError: Filing parser boundary failed.",
      );
      expect(String(error)).not.toContain(ARCHIVE_CANARY);
    }
    expect(optionAccessor).not.toHaveBeenCalled();
    expect(signerAccessor).not.toHaveBeenCalled();
  });

  it("rejects invalid archives, detached views, and nonclosed parse options", async () => {
    const signing = signingHarness();
    const runner = new NeverRunner();
    const boundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: signing.signer,
      processRunner: runner,
    });
    const optionAccessor = vi.fn(() => undefined);
    const symbol = Symbol("forbidden-input-key");
    const detachedBuffer = new ArrayBuffer(4);
    const detachedView = new Uint8Array(detachedBuffer);
    structuredClone(detachedBuffer, { transfer: [detachedBuffer] });
    const invalidCalls = [
      () => boundary.parse(new ArrayBuffer(1) as never),
      () => boundary.parse(new Uint16Array(1) as never),
      () => boundary.parse(detachedView),
      () => boundary.parse(Uint8Array.from([1]), null as never),
      () => boundary.parse(Uint8Array.from([1]), { extra: true } as never),
      () => boundary.parse(Uint8Array.from([1]), { signal: {} } as never),
      () =>
        boundary.parse(Uint8Array.from([1]), {
          get signal() {
            return optionAccessor();
          },
        } as never),
      () =>
        boundary.parse(Uint8Array.from([1]), {
          [symbol]: ARCHIVE_CANARY,
        } as never),
    ];

    for (const call of invalidCalls) {
      const error = await call().then(
        () => null,
        (value: unknown) => value,
      );
      expect(error).toEqual(
        new FilingParserBoundaryError("FILING_PARSER_INVALID_INPUT"),
      );
      expect(String(error)).toBe(
        "FilingParserBoundaryError: Filing parser boundary failed.",
      );
      expect(String(error)).not.toContain(ARCHIVE_CANARY);
    }
    expect(optionAccessor).not.toHaveBeenCalled();
    expect(runner.calls).toBe(0);
  });

  it("uses intrinsic archive slots and rejects nonordinary carriers before prototype traps", async () => {
    const signing = signingHarness();
    const runner = new NeverRunner();
    const boundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: signing.signer,
      processRunner: runner,
    });
    class ArchiveSubclass extends Uint8Array {}
    const shared = new Uint8Array(new SharedArrayBuffer(4));
    shared.set([1, 2, 3, 4]);
    Object.defineProperties(shared, {
      buffer: { value: new ArrayBuffer(4) },
      byteLength: { value: 4 },
    });
    const reprotoShared = rePrototypedSharedCopy(Uint8Array.from([1, 2, 3, 4]));
    const reprotoNonUint8 = rePrototypedNonUint8Copies(
      Uint8Array.from([1, 2, 3, 4]),
    );
    let prototypeTrapCalls = 0;
    const proxy = new Proxy(Uint8Array.from([1, 2, 3, 4]), {
      getPrototypeOf() {
        prototypeTrapCalls += 1;
        throw new Error(ARCHIVE_CANARY);
      },
    });

    for (const archive of [
      new ArchiveSubclass([1, 2, 3, 4]),
      shared,
      reprotoShared,
      ...reprotoNonUint8,
      proxy,
    ]) {
      await expect(boundary.parse(archive)).rejects.toEqual(
        new FilingParserBoundaryError("FILING_PARSER_INVALID_INPUT"),
      );
    }
    expect(prototypeTrapCalls).toBe(0);
    expect(runner.calls).toBe(0);
  });

  it("uses intrinsic oversize metadata without allocating an owned archive copy", async () => {
    const signing = signingHarness();
    const runner = new NeverRunner();
    const boundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: signing.signer,
      processRunner: runner,
    });
    const oversized = new Uint8Array(FILING_PARSER_LIMITS.archiveBytes + 1);
    oversized[0] = 17;
    oversized[oversized.length - 1] = 19;
    Object.defineProperties(oversized, {
      buffer: { value: new ArrayBuffer(1) },
      byteLength: { value: 1 },
    });
    let iteratorCalls = 0;
    Object.defineProperty(oversized, Symbol.iterator, {
      get() {
        iteratorCalls += 1;
        throw new Error(ARCHIVE_CANARY);
      },
    });

    const signed = await boundary.parse(oversized);

    expect(signed.result).toMatchObject({
      code: "archive_limit_exceeded",
      sourceSha256: sha256(oversized),
      status: "quarantined",
    });
    expect(verifyFilingParserProvenance(signed, signing.publicKey)).toBe(true);
    expect(iteratorCalls).toBe(0);
    expect(runner.calls).toBe(0);
  });

  it("does not invoke caller metadata, iterator, allocation, or instance hooks while snapshotting", async () => {
    for (const hook of [
      "buffer",
      "byteLength",
      "toStringTag",
      "constructor",
      "species",
      "iterator",
      "set",
    ] as const) {
      let hookCalls = 0;
      const source = Uint8Array.from([13, 14, 15, 16]);
      const archive = withByteHook(source, hook, () => {
        hookCalls += 1;
      });
      const signing = signingHarness();
      const runner = new SuccessfulRunner((snapshot) =>
        acceptedOutput(snapshot),
      );
      const boundary = createDockerFilingParserBoundary({
        imageId: IMAGE_ID,
        signer: signing.signer,
        processRunner: runner,
      });

      await expect(boundary.parse(archive)).resolves.toMatchObject({
        result: { sourceSha256: sha256(source), status: "accepted" },
      });
      expect(runner.archive).toEqual(Buffer.from(source));
      expect(hookCalls, hook).toBe(0);
    }
  });

  it("uses an exact resource-bounded Docker request and removes all staged residue", async () => {
    const signing = signingHarness();
    const runner = new SuccessfulRunner((archive) => acceptedOutput(archive));
    const boundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: signing.signer,
      processRunner: runner,
    });
    const archive = Uint8Array.from(
      buildTestZip([
        { name: "filing-manifest.json", content: "{}" },
        { name: "filing.xml", content: ARCHIVE_CANARY },
      ]),
    );

    const signed = await boundary.parse(archive);

    expect(verifyFilingParserProvenance(signed, signing.publicKey)).toBe(true);
    expect(signed.result).toMatchObject({
      status: "accepted",
      sourceSha256: sha256(archive),
      facts: [
        { concept: FILING_PARSER_CONCEPTS[0] },
        { concept: FILING_PARSER_CONCEPTS[1] },
      ],
    });
    expect(signed.provenance).toMatchObject({
      algorithm: "ed25519",
      imageId: IMAGE_ID,
      keyId: SIGNING_KEY_ID,
    });
    expect(Uint8Array.from(runner.archive ?? [])).toEqual(archive);
    expect(runner.requests).toHaveLength(4);

    const create = runner.requests[0];
    const start = runner.requests[1];
    const remove = runner.requests[2];
    const residue = runner.requests[3];
    expect(create).toBeDefined();
    expect(start).toBeDefined();
    expect(remove).toBeDefined();
    expect(residue).toBeDefined();
    if (!create || !start || !remove || !residue) throw new Error();

    const containerName = optionValue(create.args, "--name");
    expect(create).toMatchObject({
      command: "docker",
      timeoutMilliseconds: FILING_PARSER_LIMITS.dockerControlMilliseconds,
      stdoutLimitBytes: 256,
      stderrLimitBytes: FILING_PARSER_LIMITS.stderrBytes,
    });
    expect(create.args).toEqual([
      "create",
      "--name",
      containerName,
      "--label",
      FILING_PARSER_CONTAINER_LABEL,
      "--network",
      "none",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges=true",
      "--user",
      "65532:65532",
      "--pids-limit",
      String(FILING_PARSER_LIMITS.pids),
      "--memory",
      String(FILING_PARSER_LIMITS.memoryBytes),
      "--memory-swap",
      String(FILING_PARSER_LIMITS.memoryBytes),
      "--cpus",
      String(FILING_PARSER_LIMITS.cpuCount),
      "--ulimit",
      `nofile=${FILING_PARSER_LIMITS.openFiles}:${FILING_PARSER_LIMITS.openFiles}`,
      "--ipc",
      "none",
      "--tmpfs",
      `/tmp:rw,noexec,nosuid,nodev,size=${FILING_PARSER_LIMITS.temporaryFilesystemBytes}`,
      "--mount",
      expect.stringMatching(
        /^type=bind,source=.+,destination=\/input\/filing\.zip,readonly$/u,
      ),
      IMAGE_ID,
    ]);
    expect(create.args.join(" ")).not.toContain(ARCHIVE_CANARY);
    expect(create.args.join(" ")).not.toContain(SIGNING_KEY_ID);
    expect(create.args).not.toContain("--env");
    expect(start).toEqual({
      command: "docker",
      args: ["start", "--attach", containerName],
      timeoutMilliseconds: FILING_PARSER_LIMITS.workerWallMilliseconds,
      stdoutLimitBytes: FILING_PARSER_LIMITS.stdoutBytes,
      stderrLimitBytes: FILING_PARSER_LIMITS.stderrBytes,
    });
    expect(remove).toEqual({
      command: "docker",
      args: ["rm", "--force", containerName],
      timeoutMilliseconds: FILING_PARSER_LIMITS.dockerControlMilliseconds,
      stdoutLimitBytes: 256,
      stderrLimitBytes: FILING_PARSER_LIMITS.stderrBytes,
    });
    expect(residue).toEqual({
      command: "docker",
      args: [
        "container",
        "ls",
        "--all",
        "--quiet",
        "--filter",
        `name=^/${containerName}$`,
      ],
      timeoutMilliseconds: FILING_PARSER_LIMITS.dockerControlMilliseconds,
      stdoutLimitBytes: 256,
      stderrLimitBytes: FILING_PARSER_LIMITS.stderrBytes,
    });
    if (!runner.archivePath) throw new Error();
    await expect(access(runner.archivePath)).rejects.toBeTruthy();
    await expect(access(dirname(runner.archivePath))).rejects.toBeTruthy();
  });

  it("quarantines empty and over-limit archives before starting a process", async () => {
    const signing = signingHarness();
    const runner = new NeverRunner();
    const boundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: signing.signer,
      processRunner: runner,
    });
    const overLimit = new Uint8Array(FILING_PARSER_LIMITS.archiveBytes + 1);

    const empty = await boundary.parse(new Uint8Array());
    const oversized = await boundary.parse(overLimit);

    expect(empty.result).toMatchObject({
      status: "quarantined",
      code: "archive_invalid",
      facts: [],
      sourceSha256: sha256(new Uint8Array()),
    });
    expect(oversized.result).toMatchObject({
      status: "quarantined",
      code: "archive_limit_exceeded",
      facts: [],
      sourceSha256: sha256(overLimit),
    });
    expect(verifyFilingParserProvenance(empty, signing.publicKey)).toBe(true);
    expect(verifyFilingParserProvenance(oversized, signing.publicKey)).toBe(
      true,
    );
    expect(runner.calls).toBe(0);
  });

  it("maps staging acquisition failure to one value-free boundary error", async () => {
    const signing = signingHarness();
    const runner = new NeverRunner();
    const boundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: signing.signer,
      processRunner: runner,
    });
    const missingTemporaryDirectory = join(
      process.cwd(),
      `.cycle2a-missing-temporary-directory-${randomUUID()}`,
    );
    const temporaryEnvironmentNames = ["TMPDIR", "TMP", "TEMP"] as const;
    const previousEnvironment = temporaryEnvironmentNames.map(
      (name) => [name, process.env[name]] as const,
    );

    for (const name of temporaryEnvironmentNames) {
      process.env[name] = missingTemporaryDirectory;
    }
    try {
      await expect(access(missingTemporaryDirectory)).rejects.toBeTruthy();
      const error = await boundary.parse(Uint8Array.from([13])).then(
        () => null,
        (value: unknown) => value,
      );

      expect(error).toEqual(
        new FilingParserBoundaryError("FILING_PARSER_FAILURE"),
      );
      expect(String(error)).toBe(
        "FilingParserBoundaryError: Filing parser boundary failed.",
      );
      expect(String(error)).not.toContain(missingTemporaryDirectory);
      expect(runner.calls).toBe(0);
      await expect(access(missingTemporaryDirectory)).rejects.toBeTruthy();
    } finally {
      for (const [name, value] of previousEnvironment) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  it("copies archive bytes before the first asynchronous boundary", async () => {
    const signing = signingHarness();
    const runner = new SuccessfulRunner((archive) =>
      quarantinedOutput(archive, "archive_invalid"),
    );
    const boundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: signing.signer,
      processRunner: runner,
    });
    const input = Uint8Array.from([1, 2, 3, 4]);
    const expected = Uint8Array.from(input);

    const pending = boundary.parse(input);
    input.fill(255);
    const signed = await pending;

    expect(Uint8Array.from(runner.archive ?? [])).toEqual(expected);
    expect(signed.result.sourceSha256).toBe(sha256(expected));
  });

  it("rejects overlap before the second operation can touch the runner", async () => {
    const signing = signingHarness();
    const runner = new GatedCreateRunner();
    const boundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: signing.signer,
      processRunner: runner,
    });

    const first = boundary.parse(Uint8Array.from([1]));
    await vi.waitFor(() => expect(runner.requests).toHaveLength(1));
    await expect(boundary.parse(Uint8Array.from([2]))).rejects.toMatchObject({
      name: "FilingParserBoundaryError",
      code: "FILING_PARSER_BUSY",
      message: "Filing parser boundary failed.",
    });
    expect(runner.requests).toHaveLength(1);

    runner.releaseCreate();
    await expect(first).resolves.toMatchObject({
      result: { status: "quarantined", code: "archive_invalid" },
    });
  });

  it("honors abort before work, during work, and after signing without residue", async () => {
    const signing = signingHarness();
    const never = new NeverRunner();
    const preBoundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: signing.signer,
      processRunner: never,
    });
    const preController = new AbortController();
    preController.abort();
    await expect(
      preBoundary.parse(Uint8Array.from([1]), {
        signal: preController.signal,
      }),
    ).rejects.toMatchObject({ code: "FILING_PARSER_ABORTED" });
    expect(never.calls).toBe(0);

    const duringRunner = new AbortAwareRunner();
    const duringBoundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: signing.signer,
      processRunner: duringRunner,
    });
    const duringController = new AbortController();
    const during = duringBoundary.parse(Uint8Array.from([2]), {
      signal: duringController.signal,
    });
    await vi.waitFor(() => expect(duringRunner.createStarted).toBe(true));
    duringController.abort();
    await expect(during).rejects.toMatchObject({
      code: "FILING_PARSER_ABORTED",
      message: "Filing parser boundary failed.",
    });
    expect(duringRunner.cleanupCommands).toEqual(["rm", "residue"]);

    const deferredSigning = deferredSigner();
    const completedRunner = new SuccessfulRunner((archive) =>
      quarantinedOutput(archive, "archive_invalid"),
    );
    const postBoundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: deferredSigning.signer,
      processRunner: completedRunner,
    });
    const postController = new AbortController();
    const post = postBoundary.parse(Uint8Array.from([3]), {
      signal: postController.signal,
    });
    await deferredSigning.started;
    postController.abort();
    deferredSigning.complete();
    await expect(post).rejects.toMatchObject({
      code: "FILING_PARSER_ABORTED",
    });
    expect(completedRunner.requests.map(commandName)).toEqual([
      "create",
      "start",
      "rm",
      "residue",
    ]);
  });

  it.each([
    [
      "create timeout",
      "create",
      "FILING_PARSER_PROCESS_TIMEOUT",
      "worker_timeout",
    ],
    [
      "start timeout",
      "start",
      "FILING_PARSER_PROCESS_TIMEOUT",
      "worker_timeout",
    ],
    [
      "create output",
      "create",
      "FILING_PARSER_PROCESS_OUTPUT_LIMIT",
      "worker_failure",
    ],
    [
      "start output",
      "start",
      "FILING_PARSER_PROCESS_OUTPUT_LIMIT",
      "worker_failure",
    ],
    [
      "create failure",
      "create",
      "FILING_PARSER_PROCESS_FAILURE",
      "worker_failure",
    ],
    [
      "start failure",
      "start",
      "FILING_PARSER_PROCESS_FAILURE",
      "worker_failure",
    ],
  ] as const)(
    "maps %s to one signed value-free quarantine and still cleans up",
    async (_label, stage, processCode, quarantineCode) => {
      const signing = signingHarness();
      const runner = new FailingStageRunner(stage, processCode);
      const boundary = createDockerFilingParserBoundary({
        imageId: IMAGE_ID,
        signer: signing.signer,
        processRunner: runner,
      });

      const signed = await boundary.parse(
        new TextEncoder().encode(ARCHIVE_CANARY),
      );

      expect(signed.result).toMatchObject({
        status: "quarantined",
        code: quarantineCode,
        facts: [],
      });
      expect(JSON.stringify(signed)).not.toContain(ARCHIVE_CANARY);
      expect(verifyFilingParserProvenance(signed, signing.publicKey)).toBe(
        true,
      );
      expect(runner.cleanupCommands).toEqual(["rm", "residue"]);
    },
  );

  it.each([
    ["invalid UTF-8", Uint8Array.from([0xff, 0x0a])],
    ["missing newline", utf8("{}")],
    ["CRLF", utf8("{}\r\n")],
    ["multiple lines", utf8("{}\n{}\n")],
    ["non-ASCII", utf8('{"code":"é"}\n')],
    ["noncanonical whitespace", utf8("{} \n")],
    [
      "duplicate JSON key",
      utf8(
        '{"code":"archive_invalid","code":"archive_invalid","facts":[],"parserVersion":"filing-parser-boundary-v1","schemaVersion":"1.0.0","sourceSha256":"sha256:' +
          "0".repeat(64) +
          '","status":"quarantined","synthetic":true,"taxonomyVersion":"rc-synthetic-taxonomy-1.0.0"}\n',
      ),
    ],
    ["JSON scalar", utf8("null\n")],
  ])(
    "maps untrusted worker %s output to worker_failure",
    async (_label, output) => {
      const signing = signingHarness();
      const runner = new SuccessfulRunner(() => output);
      const boundary = createDockerFilingParserBoundary({
        imageId: IMAGE_ID,
        signer: signing.signer,
        processRunner: runner,
      });

      const signed = await boundary.parse(Uint8Array.from([7]));

      expect(signed.result).toMatchObject({
        status: "quarantined",
        code: "worker_failure",
        facts: [],
      });
      expect(verifyFilingParserProvenance(signed, signing.publicKey)).toBe(
        true,
      );
    },
  );

  it("rejects noncanonical and semantically malformed worker objects", async () => {
    const signing = signingHarness();
    const variants = [
      (archive: Uint8Array) => {
        const value = quarantinedObject(archive, "archive_invalid");
        return utf8(`${JSON.stringify({ status: value.status, ...value })}\n`);
      },
      (archive: Uint8Array) => {
        const value = quarantinedObject(archive, "archive_invalid");
        value.extra = "forbidden";
        return utf8(`${canonicalJson(value)}\n`);
      },
      (archive: Uint8Array) => {
        const value = acceptedObject(archive);
        value.sourceSha256 = `sha256:${"0".repeat(64)}`;
        return utf8(`${canonicalJson(value)}\n`);
      },
      (archive: Uint8Array) => {
        const value = acceptedObject(archive);
        const facts = value.facts as Array<Record<string, unknown>>;
        facts.reverse();
        return utf8(`${canonicalJson(value)}\n`);
      },
    ];

    for (const variant of variants) {
      const runner = new SuccessfulRunner(variant);
      const boundary = createDockerFilingParserBoundary({
        imageId: IMAGE_ID,
        signer: signing.signer,
        processRunner: runner,
      });
      await expect(boundary.parse(Uint8Array.from([9]))).resolves.toMatchObject(
        { result: { status: "quarantined", code: "worker_failure" } },
      );
    }
  });

  it("hardens every stdout and stderr carrier kind at every injected process stage", async () => {
    const signing = signingHarness();
    const archive = Uint8Array.from([31, 32, 33, 34]);
    for (const stage of ["create", "start", "remove", "residue"] as const) {
      for (const role of ["stdout", "stderr"] as const) {
        for (const kind of [
          "metadata_shared",
          "metadata_oversized",
          "reproto_shared",
          "reproto_int8",
          "reproto_uint8_clamped",
          "reproto_wider",
          "proxy",
          "subclass",
          "detached",
        ] as const) {
          const hostile = hostileByteCarrier(
            processByteSource(stage, role, archive),
            processByteLimit(stage, role),
            kind,
          );
          const runner = new SuccessfulRunner(
            (snapshot) => acceptedOutput(snapshot),
            processOverride(stage, role, hostile.bytes, archive),
          );
          const boundary = createDockerFilingParserBoundary({
            imageId: IMAGE_ID,
            signer: signing.signer,
            processRunner: runner,
          });
          const parse = boundary.parse(archive);

          if (stage === "create" || stage === "start") {
            await expect(parse).resolves.toMatchObject({
              result: { code: "worker_failure", status: "quarantined" },
            });
          } else {
            await expect(parse).rejects.toEqual(
              new FilingParserBoundaryError("FILING_PARSER_FAILURE"),
            );
          }
          expect(hostile.trapCalls(), `${stage}:${role}:${kind}`).toBe(0);
        }
      }
    }
  });

  it("does not dispatch injected stdout or stderr metadata, iterator, allocation, or instance hooks", async () => {
    const signing = signingHarness();
    const archive = Uint8Array.from([39, 40, 41, 42]);
    for (const stage of ["create", "start", "remove", "residue"] as const) {
      for (const role of ["stdout", "stderr"] as const) {
        for (const hook of [
          "buffer",
          "byteLength",
          "toStringTag",
          "constructor",
          "species",
          "iterator",
          "set",
        ] as const) {
          let hookCalls = 0;
          const carrier = withByteHook(
            processByteSource(stage, role, archive),
            hook,
            () => {
              hookCalls += 1;
            },
          );
          const runner = new SuccessfulRunner(
            (snapshot) => acceptedOutput(snapshot),
            processOverride(stage, role, carrier, archive),
          );
          const boundary = createDockerFilingParserBoundary({
            imageId: IMAGE_ID,
            signer: signing.signer,
            processRunner: runner,
          });

          const signed = await boundary.parse(archive);
          expect(signed.result.status, `${stage}:${role}:${hook}`).toBe(
            "accepted",
          );
          expect(hookCalls, `${stage}:${role}:${hook}`).toBe(0);
        }
      }
    }
  });

  it.each([
    ["remove rejection", { removeExitCode: 2 }],
    ["residual container", { residueStdout: `${CONTAINER_ID}\n` }],
    ["cleanup runner failure", { cleanupThrows: true }],
  ] as const)("fails closed on %s", async (_label, failure) => {
    const signing = signingHarness();
    const runner = new CleanupFailureRunner(failure);
    const boundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: signing.signer,
      processRunner: runner,
    });

    await expect(boundary.parse(Uint8Array.from([11]))).rejects.toEqual(
      new FilingParserBoundaryError("FILING_PARSER_FAILURE"),
    );
    expect(runner.commands).toContain("rm");
  });

  it("requires a successful Ed25519 signer and rejects failed or malformed signatures", async () => {
    const runner = () =>
      new SuccessfulRunner((archive) =>
        quarantinedOutput(archive, "archive_invalid"),
      );
    for (const signer of [
      {
        algorithm: "ed25519" as const,
        keyId: SIGNING_KEY_ID,
        sign: () => Promise.reject(new Error(ARCHIVE_CANARY)),
      },
      {
        algorithm: "ed25519" as const,
        keyId: SIGNING_KEY_ID,
        sign: () => Promise.resolve(new Uint8Array(63)),
      },
      {
        algorithm: "ed25519" as const,
        keyId: SIGNING_KEY_ID,
        sign: () => Promise.resolve(new Uint8Array(65)),
      },
    ]) {
      const boundary = createDockerFilingParserBoundary({
        imageId: IMAGE_ID,
        signer,
        processRunner: runner(),
      });
      await expect(boundary.parse(Uint8Array.from([12]))).rejects.toMatchObject(
        {
          code: "FILING_PARSER_FAILURE",
          message: "Filing parser boundary failed.",
        },
      );
    }
  });

  it("hardens hostile injected signer byte results before allocation", async () => {
    const signing = signingHarness();
    for (const kind of [
      "metadata_shared",
      "metadata_oversized",
      "reproto_shared",
      "reproto_int8",
      "reproto_uint8_clamped",
      "reproto_wider",
      "proxy",
      "subclass",
      "detached",
    ] as const) {
      let hostile: ReturnType<typeof hostileByteCarrier> | undefined;
      const signer = signerWithTransform(signing.signer, (signature) => {
        hostile = hostileByteCarrier(signature, 64, kind);
        return hostile.bytes;
      });
      const boundary = createDockerFilingParserBoundary({
        imageId: IMAGE_ID,
        signer,
        processRunner: new NeverRunner(),
      });

      await expect(boundary.parse(new Uint8Array())).rejects.toEqual(
        new FilingParserBoundaryError("FILING_PARSER_FAILURE"),
      );
      expect(hostile?.trapCalls(), kind).toBe(0);
    }
  });

  it("does not dispatch injected signer metadata, iterator, allocation, or instance hooks", async () => {
    const signing = signingHarness();
    for (const hook of [
      "buffer",
      "byteLength",
      "toStringTag",
      "constructor",
      "species",
      "iterator",
      "set",
    ] as const) {
      let hookCalls = 0;
      const signer = signerWithTransform(signing.signer, (signature) =>
        withByteHook(signature, hook, () => {
          hookCalls += 1;
        }),
      );
      const boundary = createDockerFilingParserBoundary({
        imageId: IMAGE_ID,
        signer,
        processRunner: new NeverRunner(),
      });

      const signed = await boundary.parse(new Uint8Array());
      expect(signed.result).toMatchObject({
        code: "archive_invalid",
        status: "quarantined",
      });
      expect(verifyFilingParserProvenance(signed, signing.publicKey)).toBe(
        true,
      );
      expect(hookCalls, hook).toBe(0);
    }
  });

  it("owns retained signer and every process-result byte source after parse returns", async () => {
    const signing = signingHarness();
    const archive = Uint8Array.from([43, 44, 45, 46]);
    const retainedEmpty = (): Uint8Array =>
      new Uint8Array(new ArrayBuffer(1), 0, 0);
    const outputs = {
      create: {
        exitCode: 0,
        stderr: retainedEmpty(),
        stdout: utf8(`${CONTAINER_ID}\n`),
      },
      start: {
        exitCode: 0,
        stderr: retainedEmpty(),
        stdout: acceptedOutput(archive),
      },
      remove: {
        exitCode: 0,
        stderr: retainedEmpty(),
        stdout: retainedEmpty(),
      },
      residue: {
        exitCode: 0,
        stderr: retainedEmpty(),
        stdout: retainedEmpty(),
      },
    } satisfies Required<SuccessfulRunnerOverrides>;
    const processSources = [
      outputs.create.stdout,
      outputs.create.stderr,
      outputs.start.stdout,
      outputs.start.stderr,
      outputs.remove.stdout,
      outputs.remove.stderr,
      outputs.residue.stdout,
      outputs.residue.stderr,
    ];
    let retainedSignature: Uint8Array | undefined;
    const signer = signerWithTransform(signing.signer, (signature) => {
      retainedSignature = signature;
      return signature;
    });
    const boundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer,
      processRunner: new SuccessfulRunner(
        (snapshot) => acceptedOutput(snapshot),
        outputs,
      ),
    });

    const signed = await boundary.parse(archive);
    const expected = structuredClone(signed);
    if (retainedSignature === undefined) throw new Error();
    const retainedSources = [retainedSignature, ...processSources];
    const originalBackings = retainedSources.map((source) =>
      Uint8Array.from(new Uint8Array(source.buffer)),
    );

    for (const source of retainedSources) {
      new Uint8Array(source.buffer).fill(0xa5);
    }

    expect(retainedSources).toHaveLength(9);
    retainedSources.forEach((source, index) => {
      expect(new Uint8Array(source.buffer), String(index)).not.toEqual(
        originalBackings[index],
      );
    });
    expect(signed).toStrictEqual(expected);
    expect(signed.result.status).toBe("accepted");
    expect(verifyFilingParserProvenance(signed, signing.publicKey)).toBe(true);
  });

  it("binds exact replay bytes and detects archive, result, provenance, and key tampering", async () => {
    const signing = signingHarness();
    const otherSigning = signingHarness();
    const runner = () =>
      new SuccessfulRunner((archive) => acceptedOutput(archive));
    const boundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: signing.signer,
      processRunner: runner(),
    });
    const archive = Uint8Array.from([20, 21, 22]);
    const replay = Uint8Array.from(archive);

    const first = await boundary.parse(archive);
    const second = await boundary.parse(replay);
    expect(second).toEqual(first);
    expect(verifyFilingParserProvenance(first, signing.publicKey)).toBe(true);
    expect(verifyFilingParserProvenance(first, otherSigning.publicKey)).toBe(
      false,
    );

    const mutatedArchive = Uint8Array.from(archive);
    mutatedArchive[0] = (mutatedArchive[0] ?? 0) ^ 1;
    const mutated = await boundary.parse(mutatedArchive);
    expect(mutated.result.sourceSha256).not.toBe(first.result.sourceSha256);
    expect(mutated.provenance.payloadSha256).not.toBe(
      first.provenance.payloadSha256,
    );

    for (const tamper of [
      (value: Record<string, unknown>) => {
        const result = value.result as Record<string, unknown>;
        result.status = "quarantined";
      },
      (value: Record<string, unknown>) => {
        const result = value.result as Record<string, unknown>;
        result.accession = "SYN-0000000000-26-999999";
      },
      (value: Record<string, unknown>) => {
        const provenance = value.provenance as Record<string, unknown>;
        provenance.imageId = `sha256:${"c".repeat(64)}`;
      },
      (value: Record<string, unknown>) => {
        const provenance = value.provenance as Record<string, unknown>;
        provenance.keyId = "different-security-key";
      },
      (value: Record<string, unknown>) => {
        const provenance = value.provenance as Record<string, unknown>;
        provenance.payloadSha256 = `sha256:${"0".repeat(64)}`;
      },
      (value: Record<string, unknown>) => {
        const provenance = value.provenance as Record<string, unknown>;
        provenance.signature = "A".repeat(86);
      },
      (value: Record<string, unknown>) => {
        value.extra = ARCHIVE_CANARY;
      },
      (value: Record<string, unknown>) => {
        const result = value.result as Record<string, unknown>;
        if (!Array.isArray(result.facts)) throw new Error();
        Object.assign(result.facts, { extra: ARCHIVE_CANARY });
      },
    ]) {
      const value = JSON.parse(JSON.stringify(first)) as Record<
        string,
        unknown
      >;
      tamper(value);
      expect(
        verifyFilingParserProvenance(
          value as unknown as SignedFilingParserResult,
          signing.publicKey,
        ),
      ).toBe(false);
    }
  });

  it("keeps stable failures value-free and validates test ZIP corruption helpers", async () => {
    const signing = signingHarness();
    const stderr = utf8(ARCHIVE_CANARY);
    const runner = new SuccessfulRunner(() => new Uint8Array(), {
      start: { exitCode: 1, stdout: new Uint8Array(), stderr },
    });
    const boundary = createDockerFilingParserBoundary({
      imageId: IMAGE_ID,
      signer: signing.signer,
      processRunner: runner,
    });

    const signed = await boundary.parse(utf8(ARCHIVE_CANARY));
    expect(signed.result).toMatchObject({
      status: "quarantined",
      code: "worker_failure",
      facts: [],
    });
    expect(JSON.stringify(signed)).not.toContain(ARCHIVE_CANARY);

    const zip = buildTestZip([{ name: "filing.xml", content: "payload" }]);
    const localOffsets = findTestZipSignatures(
      zip,
      TEST_ZIP_SIGNATURES.localFileHeader,
    );
    expect(localOffsets).toHaveLength(1);
    const offset = localOffsets[0];
    if (offset === undefined) throw new Error();
    const patched = patchTestZipUint32(zip, offset + 14, 0);
    expect(patched).not.toEqual(zip);
    expect(zip.readUInt32LE(offset + 14)).not.toBe(0);
    expect(patched.readUInt32LE(offset + 14)).toBe(0);
  });

  it("exports a unique, deterministic, mutation-isolated adversarial corpus", () => {
    const first = buildParserSecurityCases();
    const second = buildParserSecurityCases();
    const ids = first.map(({ id }) => id);

    expect(ids).toHaveLength(103);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      Object.fromEntries(
        Object.entries(
          first.reduce<Record<string, number>>((counts, { expected }) => {
            const key =
              expected.status === "accepted" ? "accepted" : expected.code;
            counts[key] = (counts[key] ?? 0) + 1;
            return counts;
          }, {}),
        ).sort(([left], [right]) => left.localeCompare(right)),
      ),
    ).toEqual({
      accepted: 3,
      archive_encrypted: 1,
      archive_entry_invalid: 22,
      archive_invalid: 23,
      archive_limit_exceeded: 4,
      archive_nested: 6,
      fact_ambiguous: 1,
      fact_invalid: 14,
      manifest_invalid: 9,
      taxonomy_not_allowed: 4,
      xml_forbidden_construct: 6,
      xml_invalid: 5,
      xml_limit_exceeded: 5,
    });
    expect(second.map(({ id, expected }) => ({ id, expected }))).toEqual(
      first.map(({ id, expected }) => ({ id, expected })),
    );
    expect(first.map(({ archive }) => sha256(archive))).toEqual(
      second.map(({ archive }) => sha256(archive)),
    );

    const canonical = first.find(({ id }) => id === "accepted_canonical");
    const replay = first.find(({ id }) => id === "accepted_exact_replay");
    const mutation = first.find(({ id }) => id === "archive_one_byte_mutation");
    expect(canonical?.expected).toEqual({ status: "accepted" });
    expect(replay?.archive).toEqual(canonical?.archive);
    expect(mutation?.archive).not.toEqual(canonical?.archive);

    if (!canonical || !replay) throw new Error();
    const original = replay.archive[0];
    replay.archive[0] = (original ?? 0) ^ 1;
    expect(canonical.archive[0]).toBe(original);
    expect(
      buildParserSecurityCases().find(({ id }) => id === replay.id)?.archive,
    ).toEqual(canonical.archive);
  });
});

interface SigningHarness {
  readonly publicKey: KeyObject;
  readonly signer: FilingParserSigner;
}

function signingHarness(): SigningHarness {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    publicKey,
    signer: {
      algorithm: "ed25519",
      keyId: SIGNING_KEY_ID,
      sign: (payload) =>
        Promise.resolve(
          Uint8Array.from(ed25519Sign(null, payload, privateKey)),
        ),
    },
  };
}

function signerWithTransform(
  signer: FilingParserSigner,
  transform: (signature: Uint8Array) => Uint8Array,
): FilingParserSigner {
  return {
    algorithm: "ed25519",
    keyId: signer.keyId,
    sign: async (payload) => transform(await signer.sign(payload)),
  };
}

function deferredSigner(): {
  readonly signer: FilingParserSigner;
  readonly started: Promise<void>;
  complete(): void;
} {
  const { privateKey } = generateKeyPairSync("ed25519");
  let resolveStarted: (() => void) | undefined;
  let complete: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    resolveStarted = resolve;
  });
  return {
    signer: {
      algorithm: "ed25519",
      keyId: SIGNING_KEY_ID,
      sign: (payload) =>
        new Promise<Uint8Array>((resolve) => {
          resolveStarted?.();
          complete = () =>
            resolve(Uint8Array.from(ed25519Sign(null, payload, privateKey)));
        }),
    },
    started,
    complete: () => complete?.(),
  };
}

class NeverRunner implements FilingParserProcessRunner {
  public calls = 0;

  public run(): Promise<FilingParserProcessResult> {
    this.calls += 1;
    return Promise.reject(new Error("The process runner must not be called."));
  }
}

interface SuccessfulRunnerOverrides {
  readonly create?: FilingParserProcessResult;
  readonly start?: FilingParserProcessResult;
  readonly remove?: FilingParserProcessResult;
  readonly residue?: FilingParserProcessResult;
}

class SuccessfulRunner implements FilingParserProcessRunner {
  public readonly requests: FilingParserProcessRequest[] = [];
  public archive: Buffer | null = null;
  public archivePath: string | null = null;

  public constructor(
    private readonly output: (archive: Uint8Array) => Uint8Array,
    private readonly overrides: SuccessfulRunnerOverrides = {},
  ) {}

  public async run(
    request: FilingParserProcessRequest,
  ): Promise<FilingParserProcessResult> {
    this.requests.push(copyRequest(request));
    switch (commandName(request)) {
      case "create": {
        const mount = optionValue(request.args, "--mount");
        this.archivePath = mountSource(mount);
        this.archive = await readFile(this.archivePath);
        return this.overrides.create ?? processResult(0, `${CONTAINER_ID}\n`);
      }
      case "start":
        if (!this.archive) throw new Error();
        return (
          this.overrides.start ?? {
            exitCode: 0,
            stdout: this.output(this.archive),
            stderr: new Uint8Array(),
          }
        );
      case "rm":
        return this.overrides.remove ?? processResult(0, "");
      case "residue":
        return this.overrides.residue ?? processResult(0, "");
    }
    throw new Error("Unexpected Docker command.");
  }
}

class GatedCreateRunner extends SuccessfulRunner {
  private release: (() => void) | null = null;

  public constructor() {
    super((archive) => quarantinedOutput(archive, "archive_invalid"));
  }

  public override async run(
    request: FilingParserProcessRequest,
  ): Promise<FilingParserProcessResult> {
    const result = super.run(request);
    if (commandName(request) === "create") {
      await new Promise<void>((resolve) => {
        this.release = resolve;
      });
    }
    return result;
  }

  public releaseCreate(): void {
    this.release?.();
  }
}

class AbortAwareRunner implements FilingParserProcessRunner {
  public createStarted = false;
  public readonly cleanupCommands: string[] = [];

  public run(
    request: FilingParserProcessRequest,
  ): Promise<FilingParserProcessResult> {
    const command = commandName(request);
    if (command === "create") {
      this.createStarted = true;
      return new Promise((resolve, reject) => {
        const abort = () => {
          request.signal?.removeEventListener("abort", abort);
          reject(new FilingParserProcessError("FILING_PARSER_PROCESS_ABORTED"));
        };
        request.signal?.addEventListener("abort", abort, { once: true });
        void resolve;
      });
    }
    if (command === "rm" || command === "residue") {
      this.cleanupCommands.push(command);
      return Promise.resolve(processResult(0, ""));
    }
    return Promise.reject(new Error());
  }
}

class FailingStageRunner implements FilingParserProcessRunner {
  public readonly cleanupCommands: string[] = [];
  private archive: Buffer | null = null;

  public constructor(
    private readonly stage: "create" | "start",
    private readonly code:
      | "FILING_PARSER_PROCESS_TIMEOUT"
      | "FILING_PARSER_PROCESS_OUTPUT_LIMIT"
      | "FILING_PARSER_PROCESS_FAILURE",
  ) {}

  public async run(
    request: FilingParserProcessRequest,
  ): Promise<FilingParserProcessResult> {
    const command = commandName(request);
    if (command === "create") {
      const mount = optionValue(request.args, "--mount");
      this.archive = await readFile(mountSource(mount));
      if (this.stage === "create")
        throw new FilingParserProcessError(this.code);
      return processResult(0, `${CONTAINER_ID}\n`);
    }
    if (command === "start") {
      if (this.stage === "start") throw new FilingParserProcessError(this.code);
      if (!this.archive) throw new Error();
      return {
        exitCode: 0,
        stdout: quarantinedOutput(this.archive, "archive_invalid"),
        stderr: new Uint8Array(),
      };
    }
    if (command === "rm" || command === "residue") {
      this.cleanupCommands.push(command);
      return processResult(0, "");
    }
    throw new Error();
  }
}

class CleanupFailureRunner extends SuccessfulRunner {
  public readonly commands: string[] = [];

  public constructor(
    private readonly failure: {
      readonly removeExitCode?: number;
      readonly residueExitCode?: number;
      readonly residueStdout?: string;
      readonly cleanupThrows?: boolean;
    },
  ) {
    super((archive) => quarantinedOutput(archive, "archive_invalid"));
  }

  public override async run(
    request: FilingParserProcessRequest,
  ): Promise<FilingParserProcessResult> {
    const command = commandName(request);
    this.commands.push(command);
    if (
      this.failure.cleanupThrows === true &&
      (command === "rm" || command === "residue")
    ) {
      throw new Error();
    }
    if (command === "rm" && this.failure.removeExitCode !== undefined) {
      return processResult(this.failure.removeExitCode, "");
    }
    if (command === "residue" && this.failure.residueExitCode !== undefined) {
      return processResult(this.failure.residueExitCode, "");
    }
    if (command === "residue" && this.failure.residueStdout !== undefined) {
      return processResult(0, this.failure.residueStdout);
    }
    return super.run(request);
  }
}

function copyRequest(
  request: FilingParserProcessRequest,
): FilingParserProcessRequest {
  return request.signal === undefined
    ? { ...request, args: [...request.args] }
    : { ...request, args: [...request.args], signal: request.signal };
}

function commandName(request: FilingParserProcessRequest): string {
  return request.args[0] === "container" ? "residue" : (request.args[0] ?? "");
}

function optionValue(args: readonly string[], option: string): string {
  const index = args.indexOf(option);
  const value = index === -1 ? undefined : args[index + 1];
  if (value === undefined) throw new Error(`Missing ${option}.`);
  return value;
}

function mountSource(value: string): string {
  const match =
    /^type=bind,source=(.+),destination=\/input\/filing\.zip,readonly$/u.exec(
      value,
    );
  const source = match?.[1];
  if (source === undefined) throw new Error("Invalid bind mount.");
  return source;
}

function processResult(
  exitCode: number,
  stdout: string,
): FilingParserProcessResult {
  return { exitCode, stdout: utf8(stdout), stderr: new Uint8Array() };
}

type ProcessStage = "create" | "start" | "remove" | "residue";
type ProcessByteRole = "stdout" | "stderr";
type ByteHook =
  | "buffer"
  | "byteLength"
  | "toStringTag"
  | "constructor"
  | "species"
  | "iterator"
  | "set";
type HostileCarrierKind =
  | "metadata_shared"
  | "metadata_oversized"
  | "reproto_shared"
  | "reproto_int8"
  | "reproto_uint8_clamped"
  | "reproto_wider"
  | "proxy"
  | "subclass"
  | "detached";

function processByteSource(
  stage: ProcessStage,
  role: ProcessByteRole,
  archive: Uint8Array,
): Uint8Array {
  if (role === "stderr") return new Uint8Array();
  if (stage === "create") return utf8(`${CONTAINER_ID}\n`);
  if (stage === "start") return acceptedOutput(archive);
  return new Uint8Array();
}

function processByteLimit(stage: ProcessStage, role: ProcessByteRole): number {
  if (role === "stderr") return FILING_PARSER_LIMITS.stderrBytes;
  return stage === "start" ? FILING_PARSER_LIMITS.stdoutBytes : 256;
}

function processOverride(
  stage: ProcessStage,
  role: ProcessByteRole,
  bytes: Uint8Array,
  archive: Uint8Array,
): SuccessfulRunnerOverrides {
  const result: FilingParserProcessResult = {
    exitCode: 0,
    stderr: processByteSource(stage, "stderr", archive),
    stdout: processByteSource(stage, "stdout", archive),
    [role]: bytes,
  };
  return { [stage]: result };
}

function hostileByteCarrier(
  source: Uint8Array,
  maximumBytes: number,
  kind: HostileCarrierKind,
): { readonly bytes: Uint8Array; readonly trapCalls: () => number } {
  let trapCalls = 0;
  if (kind === "metadata_shared") {
    const bytes = sharedCopy(source);
    shadowByteMetadata(bytes, source.byteLength);
    return { bytes, trapCalls: () => trapCalls };
  }
  if (kind === "metadata_oversized") {
    const bytes = new Uint8Array(maximumBytes + 1);
    Uint8Array.prototype.set.call(bytes, source);
    shadowByteMetadata(bytes, source.byteLength);
    Object.defineProperty(bytes, Symbol.iterator, {
      get() {
        trapCalls += 1;
        throw new Error(ARCHIVE_CANARY);
      },
    });
    return { bytes, trapCalls: () => trapCalls };
  }
  if (kind === "reproto_shared") {
    return {
      bytes: rePrototypedSharedCopy(source),
      trapCalls: () => trapCalls,
    };
  }
  if (
    kind === "reproto_int8" ||
    kind === "reproto_uint8_clamped" ||
    kind === "reproto_wider"
  ) {
    return {
      bytes: rePrototypedNonUint8Copy(source, kind),
      trapCalls: () => trapCalls,
    };
  }
  if (kind === "proxy") {
    return {
      bytes: new Proxy(new Uint8Array(source), {
        getPrototypeOf() {
          trapCalls += 1;
          throw new Error(ARCHIVE_CANARY);
        },
      }),
      trapCalls: () => trapCalls,
    };
  }
  if (kind === "subclass") {
    class ByteSubclass extends Uint8Array {}
    return {
      bytes: new ByteSubclass(source),
      trapCalls: () => trapCalls,
    };
  }
  const bytes = new Uint8Array(source);
  structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
  return { bytes, trapCalls: () => trapCalls };
}

function sharedCopy(source: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(new SharedArrayBuffer(source.byteLength));
  Uint8Array.prototype.set.call(bytes, source);
  return bytes;
}

function rePrototypedSharedCopy(source: Uint8Array): Uint8Array {
  const backing = new SharedArrayBuffer(source.byteLength);
  const bytes = new Uint8Array(backing);
  Uint8Array.prototype.set.call(bytes, source);
  Object.setPrototypeOf(backing, ArrayBuffer.prototype);
  return bytes;
}

function rePrototypedNonUint8Copies(source: Uint8Array): readonly Uint8Array[] {
  return [
    rePrototypedNonUint8Copy(source, "reproto_int8"),
    rePrototypedNonUint8Copy(source, "reproto_uint8_clamped"),
    rePrototypedNonUint8Copy(source, "reproto_wider"),
  ];
}

function rePrototypedNonUint8Copy(
  source: Uint8Array,
  kind: "reproto_int8" | "reproto_uint8_clamped" | "reproto_wider",
): Uint8Array {
  const paddedByteLength =
    Math.ceil(source.byteLength / Uint16Array.BYTES_PER_ELEMENT) *
    Uint16Array.BYTES_PER_ELEMENT;
  const view =
    kind === "reproto_int8"
      ? new Int8Array(source.byteLength)
      : kind === "reproto_uint8_clamped"
        ? new Uint8ClampedArray(source.byteLength)
        : new Uint16Array(paddedByteLength / Uint16Array.BYTES_PER_ELEMENT);
  Uint8Array.prototype.set.call(new Uint8Array(view.buffer), source);
  Object.setPrototypeOf(view, Uint8Array.prototype);
  return view as unknown as Uint8Array;
}

function shadowByteMetadata(bytes: Uint8Array, byteLength: number): void {
  Object.defineProperties(bytes, {
    buffer: { value: new ArrayBuffer(byteLength) },
    byteLength: { value: byteLength },
  });
}

function withByteHook(
  source: Uint8Array,
  hook: ByteHook,
  onAccess: () => void,
): Uint8Array {
  const bytes = new Uint8Array(source);
  const failOnAccess = (): never => {
    onAccess();
    throw new Error(ARCHIVE_CANARY);
  };
  if (hook === "species") {
    const constructor = {};
    Object.defineProperty(constructor, Symbol.species, { get: failOnAccess });
    Object.defineProperty(bytes, "constructor", { value: constructor });
  } else {
    Object.defineProperty(
      bytes,
      hook === "iterator"
        ? Symbol.iterator
        : hook === "toStringTag"
          ? Symbol.toStringTag
          : hook,
      { get: failOnAccess },
    );
  }
  return bytes;
}

function acceptedOutput(archive: Uint8Array): Uint8Array {
  return utf8(`${canonicalJson(acceptedObject(archive))}\n`);
}

function acceptedObject(archive: Uint8Array): Record<string, unknown> {
  return {
    accession: "SYN-0000000000-26-000001",
    acceptedAt: "2026-08-20T12:00:00.000Z",
    availableAt: "2026-08-20T12:01:00.000Z",
    facts: [
      {
        concept: "net_income",
        dimensions: {},
        periodEnd: "2025-12-31",
        periodStart: "2025-01-01",
        unit: "USD",
        value: "12.34",
      },
      {
        concept: "revenue",
        dimensions: {},
        periodEnd: "2025-12-31",
        periodStart: "2025-01-01",
        unit: "USD",
        value: "123.45",
      },
    ],
    parserVersion: FILING_PARSER_PARSER_VERSION,
    schemaVersion: FILING_PARSER_SCHEMA_VERSION,
    sourceSha256: sha256(archive),
    status: "accepted",
    synthetic: true,
    taxonomyVersion: FILING_PARSER_TAXONOMY_VERSION,
  };
}

function quarantinedOutput(
  archive: Uint8Array,
  code: FilingParserQuarantineCode,
): Uint8Array {
  return utf8(`${canonicalJson(quarantinedObject(archive, code))}\n`);
}

function quarantinedObject(
  archive: Uint8Array,
  code: FilingParserQuarantineCode,
): Record<string, unknown> {
  return {
    code,
    facts: [],
    parserVersion: FILING_PARSER_PARSER_VERSION,
    schemaVersion: FILING_PARSER_SCHEMA_VERSION,
    sourceSha256: sha256(archive),
    status: "quarantined",
    synthetic: true,
    taxonomyVersion: FILING_PARSER_TAXONOMY_VERSION,
  };
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
