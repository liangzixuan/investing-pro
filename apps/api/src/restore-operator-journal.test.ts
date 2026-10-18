import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import type * as FileSystem from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFileRestoreOperatorJournal,
  RestoreOperatorJournalError,
  type RestoreOperatorIntent,
  type RestoreOperatorJournal,
} from "./restore-operator-journal";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof FileSystem>();
  return { ...actual, open: vi.fn(actual.open), mkdir: vi.fn(actual.mkdir) };
});
const actualFs = await vi.importActual<typeof FileSystem>("node:fs/promises");
const parents: string[] = [];
const INTENT: RestoreOperatorIntent = Object.freeze({
  attemptId: "invented-restore-attempt-1",
  controllerRevision: "a".repeat(40),
  reviewedPlanSha256: "b".repeat(64),
  approvalRecordSha256: "c".repeat(64),
  expiresAt: "2026-10-20T12:00:00.000Z",
  endpoint: "https://restore.example.invalid/v1",
  projectId: "invented-project",
  archiveSha256: "d".repeat(64),
  buildProof: "e".repeat(64),
});
const STEP = Object.freeze({
  ordinal: 1,
  label: "preflight:source-database",
  method: "GET" as const,
  path: "/v1/tablesdb/invented-source",
  requestSha256: "f".repeat(64),
});
async function fixture() {
  const parent = await mkdtemp(join(tmpdir(), "restore-journal-test-"));
  parents.push(parent);
  const directory = join(parent, "dedicated-attempt");
  return {
    directory,
    journal: createFileRestoreOperatorJournal({ directory }),
  };
}
async function ready() {
  const f = await fixture();
  await f.journal.consume(INTENT);
  return f;
}
function failingFile(operation: "writeFile" | "sync" | "close") {
  vi.mocked(open).mockImplementationOnce(async (...args) => {
    const file = await actualFs.open(...args);
    const close = file.close.bind(file);
    const rejection = new Error("private-invented-key /private/owner/path");
    if (operation === "close") {
      vi.spyOn(file, "close").mockImplementationOnce(async () => {
        await close();
        throw rejection;
      });
    } else vi.spyOn(file, operation).mockRejectedValueOnce(rejection);
    return file;
  });
}
async function stopped(operation: Promise<void>, reason: string) {
  const error: unknown = await operation.catch((value: unknown) => value);
  expect(error).toBeInstanceOf(RestoreOperatorJournalError);
  expect(error).toMatchObject({ reason });
  expect(String(error)).toBe("Error: Restore operator journal stopped.");
  expect(JSON.stringify(error)).not.toMatch(/private|owner|path/u);
}
function observeWrites() {
  const events: string[] = [];
  vi.mocked(open).mockImplementation(async (...args) => {
    expect(args[1]).toBe("wx");
    expect(args[2]).toBe(0o600);
    const file = await actualFs.open(...args);
    const write = file.writeFile.bind(file),
      sync = file.sync.bind(file),
      close = file.close.bind(file);
    vi.spyOn(file, "writeFile").mockImplementation(async (...values) => {
      events.push("write");
      return write(...values);
    });
    vi.spyOn(file, "sync").mockImplementation(async () => {
      events.push("sync");
      return sync();
    });
    vi.spyOn(file, "close").mockImplementation(async () => {
      events.push("close");
      return close();
    });
    return file;
  });
  return events;
}
afterEach(async () => {
  vi.restoreAllMocks();
  vi.mocked(open).mockReset().mockImplementation(actualFs.open);
  vi.mocked(mkdir).mockReset().mockImplementation(actualFs.mkdir);
  for (const parent of parents.splice(0))
    await rm(parent, { recursive: true, force: true });
});

describe("exclusive restore operator journal", () => {
  it("persists a frozen input snapshot and each ordered record before returning", async () => {
    const f = await fixture();
    const events = observeWrites();
    const intent = { ...INTENT };
    const consumed = f.journal.consume(intent);
    intent.attemptId = "mutated-after-call";
    await consumed;
    expect(
      JSON.parse(await readFile(join(f.directory, "intent.json"), "utf8")),
    ).toEqual(INTENT);
    expect(mkdir).toHaveBeenCalledWith(f.directory, { mode: 0o700 });
    await f.journal.before(STEP);
    const result = {
      observed: { exists: true, values: [null, 1, "invented"] },
    };
    const received = f.journal.received(1, result);
    result.observed.values.push("late mutation");
    await received;
    await f.journal.before({ ...STEP, ordinal: 2, method: "PATCH" });
    await f.journal.received(2, { accepted: true });
    await f.journal.finish({ state: "COMPLETE" });
    expect(await readdir(f.directory)).toEqual([
      "intent.json",
      "step-1-before.json",
      "step-1-received.json",
      "step-2-before.json",
      "step-2-received.json",
      "terminal.json",
    ]);
    expect(
      JSON.parse(
        await readFile(join(f.directory, "step-1-before.json"), "utf8"),
      ),
    ).toEqual(STEP);
    expect(
      JSON.parse(
        await readFile(join(f.directory, "step-1-received.json"), "utf8"),
      ),
    ).toEqual({
      observed: { exists: true, values: [null, 1, "invented"] },
    });
    expect(
      JSON.parse(await readFile(join(f.directory, "terminal.json"), "utf8")),
    ).toEqual({ state: "COMPLETE" });
    expect(events).toEqual(
      Array.from({ length: 6 }, () => ["write", "sync", "close"]).flat(),
    );
  });

  it.each(["empty", "consumed", "partial", "file"])(
    "never resumes an existing %s attempt",
    async (kind) => {
      const f = await fixture();
      const prepare = {
        empty: () => actualFs.mkdir(f.directory),
        consumed: () => f.journal.consume(INTENT),
        partial: async () => {
          await actualFs.mkdir(f.directory);
          await writeFile(join(f.directory, "intent.json"), "partial");
        },
        file: () => writeFile(f.directory, "existing"),
      }[kind]!;
      await prepare();
      const journal = createFileRestoreOperatorJournal({
        directory: f.directory,
      });
      await stopped(journal.consume(INTENT), "persistence_failed");
      await stopped(journal.consume(INTENT), "invalid_lifecycle");
      await stopped(journal.before(STEP), "invalid_lifecycle");
      expect(open).toHaveBeenCalledTimes(kind === "consumed" ? 1 : 0);
    },
  );

  it("uses exclusive file creation and preserves a competing record", async () => {
    const f = await ready();
    const file = join(f.directory, "step-1-before.json");
    await writeFile(file, "invented competing record");
    await stopped(f.journal.before(STEP), "persistence_failed");
    expect(await readFile(file, "utf8")).toBe("invented competing record");
    await stopped(
      f.journal.finish({ state: "uncertain" }),
      "invalid_lifecycle",
    );
  });

  it("can record an uncertain terminal outcome with one unanswered step", async () => {
    const f = await ready();
    await f.journal.before(STEP);
    await f.journal.finish({ state: "UNCERTAIN", responseReceived: false });
    expect(await readdir(f.directory)).toEqual([
      "intent.json",
      "step-1-before.json",
      "terminal.json",
    ]);
    await stopped(f.journal.received(1, { late: true }), "invalid_lifecycle");
  });

  it("can finish without a request after consuming the attempt", async () => {
    const f = await ready();
    await f.journal.finish({ state: "STOPPED_BEFORE_REQUEST" });
    expect(await readdir(f.directory)).toEqual([
      "intent.json",
      "terminal.json",
    ]);
    await stopped(f.journal.finish({ retry: true }), "invalid_lifecycle");
  });

  const invalidLifecycles: {
    label: string;
    prepare?: (journal: RestoreOperatorJournal) => Promise<void>;
    action: (journal: RestoreOperatorJournal) => Promise<void>;
  }[] = [
    { label: "before consume", action: (journal) => journal.before(STEP) },
    {
      label: "received before consume",
      action: (journal) => journal.received(1, {}),
    },
    { label: "finish before consume", action: (journal) => journal.finish({}) },
    {
      label: "second consume",
      prepare: (journal) => journal.consume(INTENT),
      action: (journal) => journal.consume(INTENT),
    },
    {
      label: "missing response",
      prepare: async (journal) => {
        await journal.consume(INTENT);
        await journal.before(STEP);
      },
      action: (journal) => journal.before({ ...STEP, ordinal: 2 }),
    },
    {
      label: "unsolicited response",
      prepare: (journal) => journal.consume(INTENT),
      action: (journal) => journal.received(1, {}),
    },
    {
      label: "duplicate response",
      prepare: async (journal) => {
        await journal.consume(INTENT);
        await journal.before(STEP);
        await journal.received(1, {});
      },
      action: (journal) => journal.received(1, {}),
    },
    {
      label: "request after finish",
      prepare: async (journal) => {
        await journal.consume(INTENT);
        await journal.finish({});
      },
      action: (journal) => journal.before(STEP),
    },
  ];
  it.each(invalidLifecycles)(
    "seals after $label",
    async ({ prepare, action }) => {
      const f = await fixture();
      await prepare?.(f.journal);
      await stopped(action(f.journal), "invalid_lifecycle");
      const files = await readdir(f.directory).catch(() => []);
      await stopped(f.journal.consume(INTENT), "invalid_lifecycle");
      expect(await readdir(f.directory).catch(() => [])).toEqual(files);
    },
  );

  it.each([
    { attemptId: "../invented" },
    { controllerRevision: "a".repeat(39) },
    { reviewedPlanSha256: "B".repeat(64) },
    { approvalRecordSha256: "bad" },
    { archiveSha256: "bad" },
    { buildProof: "not-a-sha" },
    { expiresAt: "2026-02-30T12:00:00.000Z" },
    { expiresAt: "2026-10-20T12:00:00Z" },
    { endpoint: "https://user:invented@restore.example.invalid/v1" },
    { endpoint: "http://restore.example.invalid/v1" },
    { projectId: "../invented" },
    { unknown: true },
  ])(
    "rejects malformed intent %j without creating the directory",
    async (patch) => {
      const f = await fixture();
      await stopped(
        f.journal.consume({ ...INTENT, ...patch }),
        "invalid_intent",
      );
      expect(mkdir).not.toHaveBeenCalled();
      await stopped(f.journal.consume(INTENT), "invalid_lifecycle");
    },
  );

  it.each([
    { ordinal: 0 },
    { ordinal: 2 },
    { ordinal: 1.5 },
    { label: "unsafe\nlabel" },
    { method: "DELETE" },
    { path: "/v1/tablesdb/../invented" },
    { path: "/v1//invented" },
    { path: "/v1/invented?key=private" },
    { requestSha256: "wrong" },
    { extra: true },
  ])("seals malformed step %j before opening its record", async (patch) => {
    const f = await ready();
    await stopped(
      f.journal.before({ ...STEP, ...patch } as Parameters<
        RestoreOperatorJournal["before"]
      >[0]),
      "invalid_step",
    );
    expect(await readdir(f.directory)).toEqual(["intent.json"]);
    await stopped(f.journal.before(STEP), "invalid_lifecycle");
  });

  it("requires the exact active ordinal for a response", async () => {
    const f = await ready();
    await f.journal.before(STEP);
    await stopped(f.journal.received(2, { accepted: true }), "invalid_result");
    expect(await readdir(f.directory)).toEqual([
      "intent.json",
      "step-1-before.json",
    ]);
    await stopped(f.journal.received(1, {}), "invalid_lifecycle");
  });

  const badJson: { label: string; create: () => unknown }[] = [
    { label: "undefined", create: () => ({ value: undefined }) },
    { label: "function", create: () => ({ value: () => undefined }) },
    { label: "symbol", create: () => ({ value: Symbol("invented") }) },
    { label: "bigint", create: () => ({ value: 1n }) },
    { label: "nonfinite", create: () => ({ value: Infinity }) },
    { label: "date prototype", create: () => ({ value: new Date() }) },
    {
      label: "custom prototype",
      create: () => Object.create({ invented: true }) as object,
    },
    {
      label: "hidden member",
      create: () => Object.defineProperty({}, "value", { value: "invented" }),
    },
    { label: "symbol key", create: () => ({ [Symbol("invented")]: 1 }) },
    {
      label: "sparse array",
      create: () => ({ values: new Array<unknown>(2) }),
    },
    {
      label: "array extra",
      create: () => ({ values: Object.assign([1], { extra: true }) }),
    },
    {
      label: "cycle",
      create: () => {
        const value: Record<string, unknown> = {};
        value.self = value;
        return value;
      },
    },
    { label: "top-level array", create: () => [] },
  ];
  it.each(badJson)(
    "rejects $label without silently dropping data",
    async ({ create }) => {
      const f = await ready();
      await stopped(f.journal.finish(create()), "invalid_result");
      expect(await readdir(f.directory)).toEqual(["intent.json"]);
      await stopped(f.journal.finish({ safe: true }), "invalid_lifecycle");
    },
  );

  it("never calls getters, toJSON, or proxy traps", async () => {
    const getter = vi.fn(() => "invented"),
      toJSON = vi.fn(() => ({ invented: true })),
      trap = vi.fn(() => []);
    const inputs = [
      Object.defineProperty({}, "value", { get: getter, enumerable: true }),
      { toJSON },
      { nested: new Proxy({}, { ownKeys: trap }) },
    ];
    for (const input of inputs) {
      const f = await ready();
      await stopped(f.journal.finish(input), "invalid_result");
    }
    expect(getter).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
    expect(trap).not.toHaveBeenCalled();
  });

  it("admits shared references and null-prototype records without hooks", async () => {
    const f = await ready();
    const shared: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    shared.value = "invented\nvalue";
    await f.journal.finish({ first: shared, second: shared });
    expect(
      JSON.parse(await readFile(join(f.directory, "terminal.json"), "utf8")),
    ).toEqual({
      first: { value: "invented\nvalue" },
      second: { value: "invented\nvalue" },
    });
  });

  it("counts UTF-8 encoded file bytes including the final newline", async () => {
    const overhead = Buffer.byteLength(JSON.stringify({ value: "" }) + "\n");
    const accepted = await ready();
    await accepted.journal.finish({
      value: "x".repeat(1024 * 1024 - overhead),
    });
    expect(
      (await readFile(join(accepted.directory, "terminal.json"))).byteLength,
    ).toBe(1024 * 1024);
    const rejected = await ready();
    await stopped(
      rejected.journal.finish({
        value: "x".repeat(1024 * 1024 - overhead + 1),
      }),
      "invalid_result",
    );
    const unicode = await ready();
    await stopped(
      unicode.journal.finish({ value: "漢".repeat(400_000) }),
      "invalid_result",
    );
  });

  it.each(["depth", "nodes"])("bounds JSON traversal by %s", async (kind) => {
    const f = await ready();
    const value =
      kind === "depth"
        ? Array.from({ length: 66 }).reduce<unknown>(
            (nested) => ({ nested }),
            {},
          )
        : { values: new Array<{ value: null }>(50_000).fill({ value: null }) };
    await stopped(f.journal.finish(value), "invalid_result");
    expect(await readdir(f.directory)).toEqual(["intent.json"]);
  });

  it.each(["open", "writeFile", "sync", "close"] as const)(
    "seals permanently when intent %s fails",
    async (operation) => {
      const f = await fixture();
      if (operation === "open")
        vi.mocked(open).mockRejectedValueOnce(new Error("private /owner/path"));
      else failingFile(operation);
      await stopped(f.journal.consume(INTENT), "persistence_failed");
      const count = vi.mocked(open).mock.calls.length;
      await stopped(f.journal.consume(INTENT), "invalid_lifecycle");
      await stopped(f.journal.before(STEP), "invalid_lifecycle");
      expect(open).toHaveBeenCalledTimes(count);
      const restarted = createFileRestoreOperatorJournal({
        directory: f.directory,
      });
      await stopped(restarted.consume(INTENT), "persistence_failed");
    },
  );

  it.each(["before", "received", "finish"] as const)(
    "does not retry after %s sync failure",
    async (method) => {
      const f = await ready();
      if (method === "received") await f.journal.before(STEP);
      failingFile("sync");
      const actions = {
        before: () => f.journal.before(STEP),
        received: () => f.journal.received(1, { accepted: true }),
        finish: () => f.journal.finish({ state: "COMPLETE" }),
      };
      await stopped(actions[method](), "persistence_failed");
      const count = vi.mocked(open).mock.calls.length;
      await stopped(actions[method](), "invalid_lifecycle");
      expect(open).toHaveBeenCalledTimes(count);
    },
  );

  it("rejects concurrent calls while consume is syncing and fences the pending result", async () => {
    const f = await fixture();
    let release!: () => void, entered!: () => void;
    const syncing = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const block = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(open).mockImplementationOnce(async (...args) => {
      const file = await actualFs.open(...args),
        sync = file.sync.bind(file);
      vi.spyOn(file, "sync").mockImplementationOnce(async () => {
        entered();
        await block;
        await sync();
      });
      return file;
    });
    const consuming = f.journal.consume(INTENT);
    const rejected = expect(consuming).rejects.toBeInstanceOf(
      RestoreOperatorJournalError,
    );
    await syncing;
    await stopped(f.journal.before(STEP), "invalid_lifecycle");
    release();
    await rejected;
    expect(await readdir(f.directory)).toEqual(["intent.json"]);
    await stopped(f.journal.before(STEP), "invalid_lifecycle");
  });

  it.each(["relative/invented", "", "private\0invalid"])(
    "sanitizes invalid directory configuration",
    (directory) => {
      expect(() => createFileRestoreOperatorJournal({ directory })).toThrow(
        RestoreOperatorJournalError,
      );
      expect(mkdir).not.toHaveBeenCalled();
    },
  );
});
