import assert from "node:assert/strict";
import { mkdir, open } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { types } from "node:util";

export interface RestoreOperatorIntent {
  readonly attemptId: string;
  readonly controllerRevision: string;
  readonly reviewedPlanSha256: string;
  readonly approvalRecordSha256: string;
  readonly expiresAt: string;
  readonly endpoint: string;
  readonly projectId: string;
  readonly archiveSha256: string;
  readonly buildProof: string;
}
interface JournalStep {
  readonly ordinal: number;
  readonly label: string;
  readonly method: "GET" | "POST" | "PATCH";
  readonly path: string;
  readonly requestSha256: string;
}
export interface RestoreOperatorJournal {
  consume(intent: RestoreOperatorIntent): Promise<void>;
  before(step: JournalStep): Promise<void>;
  received(stepOrdinal: number, result: unknown): Promise<void>;
  finish(result: unknown): Promise<void>;
}
type Failure =
  | "invalid_configuration"
  | "invalid_intent"
  | "invalid_step"
  | "invalid_result"
  | "invalid_lifecycle"
  | "persistence_failed";
export class RestoreOperatorJournalError extends Error {
  constructor(readonly reason: Failure) {
    super("Restore operator journal stopped.");
  }
}
const MAX_BYTES = 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/u;
const INTENT_FIELDS = [
  "attemptId",
  "controllerRevision",
  "reviewedPlanSha256",
  "approvalRecordSha256",
  "expiresAt",
  "endpoint",
  "projectId",
  "archiveSha256",
  "buildProof",
];
const STEP_FIELDS = ["ordinal", "label", "method", "path", "requestSha256"];

function dataProperty(value: object, name: PropertyKey): unknown {
  const property = Object.getOwnPropertyDescriptor(value, name);
  assert.ok(property);
  assert.equal(property.enumerable, true);
  assert.ok(Object.hasOwn(property, "value"));
  return property.value as unknown;
}
function recordEntries(value: unknown): [string, unknown][] {
  assert.ok(value !== null && typeof value === "object");
  assert.equal(types.isProxy(value), false);
  const prototype: unknown = Object.getPrototypeOf(value);
  assert.ok(prototype === null || prototype === Object.prototype);
  const keys = Reflect.ownKeys(value);
  assert.ok(keys.length <= 100_000);
  return keys.map((name) => {
    assert.equal(typeof name, "string");
    return [name as string, dataProperty(value, name)];
  });
}
function exactRecord(value: unknown, fields: readonly string[]) {
  const result: Record<string, unknown> = Object.fromEntries(
    recordEntries(value),
  );
  assert.deepEqual(Object.keys(result).sort(), [...fields].sort());
  return result;
}
function text(value: unknown, pattern: RegExp) {
  assert.equal(typeof value, "string");
  assert.match(value as string, pattern);
}
function verifyEndpoint(value: unknown) {
  assert.equal(typeof value, "string");
  assert.ok((value as string).length <= 2048);
  const url = new URL(value as string);
  assert.equal(url.protocol, "https:");
  assert.equal(url.pathname, "/v1");
  assert.equal(url.username + url.password + url.search + url.hash, "");
  assert.equal(url.href, value);
}
function intentDocument(value: unknown) {
  const intent = exactRecord(value, INTENT_FIELDS);
  text(intent.attemptId, /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u);
  text(intent.controllerRevision, /^[a-f0-9]{40}$/u);
  text(intent.projectId, /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/u);
  for (const name of [
    "reviewedPlanSha256",
    "approvalRecordSha256",
    "archiveSha256",
    "buildProof",
  ])
    text(intent[name], SHA256);
  text(intent.expiresAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  assert.equal(
    new Date(intent.expiresAt as string).toISOString(),
    intent.expiresAt,
  );
  verifyEndpoint(intent.endpoint);
  return jsonDocument(intent);
}
function stepDocument(value: unknown, ordinal: number) {
  const step = exactRecord(value, STEP_FIELDS);
  assert.ok(Number.isSafeInteger(step.ordinal));
  assert.equal(step.ordinal, ordinal);
  text(step.label, /^[A-Za-z0-9][A-Za-z0-9 ._:/-]{0,127}$/u);
  assert.ok(["GET", "POST", "PATCH"].includes(step.method as string));
  text(step.path, /^\/v1\/[A-Za-z0-9._/-]{1,508}$/u);
  assert.ok(!(step.path as string).includes("//"));
  assert.ok(
    !(step.path as string)
      .split("/")
      .some((part) => part === "." || part === ".."),
  );
  text(step.requestSha256, SHA256);
  return jsonDocument(step);
}
interface JsonWriter {
  readonly parts: string[];
  readonly ancestors: Set<object>;
  bytes: number;
  nodes: number;
}
function append(writer: JsonWriter, value: string) {
  writer.bytes += Buffer.byteLength(value);
  assert.ok(writer.bytes <= MAX_BYTES);
  writer.parts.push(value);
}
function writeArray(writer: JsonWriter, value: unknown[], depth: number) {
  assert.equal(Object.getPrototypeOf(value), Array.prototype);
  const length: unknown = Object.getOwnPropertyDescriptor(
    value,
    "length",
  )?.value;
  assert.ok(Number.isSafeInteger(length));
  assert.ok((length as number) <= 100_000);
  const keys = Reflect.ownKeys(value);
  assert.equal(keys.length, (length as number) + 1);
  assert.equal(keys.at(-1), "length");
  append(writer, "[");
  for (let index = 0; index < (length as number); index++) {
    if (index > 0) append(writer, ",");
    writeJson(writer, dataProperty(value, String(index)), depth + 1);
  }
  append(writer, "]");
}
function writeObject(writer: JsonWriter, value: object, depth: number) {
  append(writer, "{");
  const entries = recordEntries(value);
  for (const [index, [name, member]] of entries.entries()) {
    if (index > 0) append(writer, ",");
    assert.ok(name.length <= MAX_BYTES);
    append(writer, JSON.stringify(name));
    append(writer, ":");
    writeJson(writer, member, depth + 1);
  }
  append(writer, "}");
}
function writeContainer(writer: JsonWriter, value: object, depth: number) {
  assert.equal(types.isProxy(value), false);
  assert.ok(depth <= 64);
  assert.equal(writer.ancestors.has(value), false);
  writer.ancestors.add(value);
  if (Array.isArray(value)) writeArray(writer, value, depth);
  else writeObject(writer, value, depth);
  writer.ancestors.delete(value);
}
function writeJson(writer: JsonWriter, value: unknown, depth: number) {
  assert.ok(++writer.nodes <= 100_000);
  if (value === null) return append(writer, "null");
  switch (typeof value) {
    case "string":
      assert.ok(value.length <= MAX_BYTES);
      return append(writer, JSON.stringify(value));
    case "number":
      assert.ok(Number.isFinite(value));
      return append(writer, JSON.stringify(value));
    case "boolean":
      return append(writer, JSON.stringify(value));
    case "object":
      return writeContainer(writer, value, depth);
    default:
      assert.fail("Invalid JSON value");
  }
}
function jsonDocument(value: unknown) {
  recordEntries(value);
  const writer: JsonWriter = {
    parts: [],
    ancestors: new Set(),
    bytes: 0,
    nodes: 0,
  };
  writeJson(writer, value, 0);
  append(writer, "\n");
  return writer.parts.join("");
}
type State = "fresh" | "ready" | "awaiting_result" | "finished";
class FileRestoreOperatorJournal implements RestoreOperatorJournal {
  readonly #directory: string;
  #state: State = "fresh";
  #busy = false;
  #sealed = false;
  #ordinal = 1;
  constructor(directory: string) {
    this.#directory = directory;
  }
  async #run(
    states: readonly State[],
    reason: Failure,
    operation: () => Promise<void>,
  ) {
    try {
      assert.equal(this.#busy, false);
      assert.equal(this.#sealed, false);
      assert.ok(states.includes(this.#state));
    } catch {
      this.#sealed = true;
      throw new RestoreOperatorJournalError("invalid_lifecycle");
    }
    this.#busy = true;
    try {
      await operation();
      assert.equal(this.#sealed, false);
    } catch (error) {
      this.#sealed = true;
      throw error instanceof RestoreOperatorJournalError
        ? error
        : new RestoreOperatorJournalError(reason);
    } finally {
      this.#busy = false;
    }
  }
  async #write(name: string, document: string) {
    try {
      const file = await open(join(this.#directory, name), "wx", 0o600);
      try {
        await file.writeFile(document, "utf8");
        await file.sync();
      } finally {
        await file.close();
      }
    } catch {
      throw new RestoreOperatorJournalError("persistence_failed");
    }
  }
  async consume(intent: RestoreOperatorIntent) {
    return this.#run(["fresh"], "invalid_intent", async () => {
      const document = intentDocument(intent);
      try {
        await mkdir(this.#directory, { mode: 0o700 });
      } catch {
        throw new RestoreOperatorJournalError("persistence_failed");
      }
      await this.#write("intent.json", document);
      this.#state = "ready";
    });
  }
  async before(step: JournalStep) {
    return this.#run(["ready"], "invalid_step", async () => {
      const document = stepDocument(step, this.#ordinal);
      await this.#write(`step-${this.#ordinal}-before.json`, document);
      this.#state = "awaiting_result";
    });
  }
  async received(stepOrdinal: number, result: unknown) {
    return this.#run(["awaiting_result"], "invalid_result", async () => {
      assert.equal(stepOrdinal, this.#ordinal);
      const document = jsonDocument(result);
      await this.#write(`step-${this.#ordinal}-received.json`, document);
      this.#ordinal++;
      this.#state = "ready";
    });
  }
  async finish(result: unknown) {
    return this.#run(
      ["ready", "awaiting_result"],
      "invalid_result",
      async () => {
        await this.#write("terminal.json", jsonDocument(result));
        this.#state = "finished";
      },
    );
  }
}
/** Consumes a new directory once. It never resumes or repairs an earlier attempt.
 * Callers supply credential-free evidence projections and bind intent authority and expiry.
 * Every file is created exclusively, written, synced, and closed before its method returns.
 */
export function createFileRestoreOperatorJournal(options: {
  directory: string;
}): RestoreOperatorJournal {
  try {
    const config = exactRecord(options, ["directory"]);
    assert.equal(typeof config.directory, "string");
    const directory = config.directory as string;
    assert.ok(isAbsolute(directory));
    assert.ok(!directory.includes("\0"));
    const absolute = resolve(directory);
    assert.notEqual(absolute, dirname(absolute));
    return Object.freeze(new FileRestoreOperatorJournal(absolute));
  } catch {
    throw new RestoreOperatorJournalError("invalid_configuration");
  }
}
