import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  PERSONAL_SEC_FILING_CONTEXT_LIMITS as LIMITS,
  PERSONAL_SEC_QUARTERLY_CONCEPTS,
  type PersonalSecFilingContextCandidateDto,
  type PersonalSecFilingContextIssue,
  type PersonalSecFilingContextParserResultDto,
  type PersonalSecFilingContextSelectionDto,
} from "@research-cockpit/contracts";

export type PersonalSecFilingContextParserErrorCode =
  | "invalid_request"
  | "busy"
  | "aborted"
  | "runtime_unavailable"
  | "timeout"
  | "worker_failed"
  | "invalid_output"
  | "output_too_large";

export class PersonalSecFilingContextParserError extends Error {
  public constructor(
    public readonly code: PersonalSecFilingContextParserErrorCode,
  ) {
    super("Personal SEC filing context parsing is unavailable.");
    this.name = "PersonalSecFilingContextParserError";
  }
}

export interface PersonalSecFilingContextParserInput {
  readonly document: Uint8Array;
  readonly cik: string;
  readonly selection: PersonalSecFilingContextSelectionDto;
}

export interface PersonalSecFilingContextParser {
  parse(
    input: PersonalSecFilingContextParserInput,
    signal?: AbortSignal,
  ): Promise<PersonalSecFilingContextParserResultDto>;
  close(): void;
}

export interface PersonalSecFilingContextParserDependencies {
  /** Test seam only; executable, worker resource, arguments and transport stay fixed. */
  readonly spawn?: typeof spawn;
}

const WORKER = fileURLToPath(
  new URL("../workers/personal_sec_filing_context.py", import.meta.url),
);
function workerEnvironment(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {}),
    LANG: "C.UTF-8",
  };
}
// Reject control characters at the untrusted worker boundary; whitespace is retained.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const ISSUES = new Set<PersonalSecFilingContextIssue>([
  "invalid_document",
  "document_limit",
  "node_limit",
  "depth_limit",
  "attribute_limit",
  "context_limit",
  "unit_limit",
  "candidate_limit",
  "output_limit",
  "duplicate_id",
  "invalid_namespace",
  "invalid_identifier",
  "malformed_context",
  "unresolved_context",
  "unsupported_entity",
  "entity_mismatch",
  "unsupported_dimensions",
  "unsupported_unit",
  "unresolved_unit",
  "unsupported_period",
  "period_mismatch",
  "unsupported_inline",
  "unsupported_transform",
  "invalid_numeric",
  "decimal_limit",
]);

export function createPersonalSecFilingContextParser(
  dependencies: PersonalSecFilingContextParserDependencies = {},
): PersonalSecFilingContextParser {
  return new FilingContextParser(dependencies.spawn ?? spawn);
}

class FilingContextParser implements PersonalSecFilingContextParser {
  readonly #spawn: typeof spawn;
  #closed = false;
  #active:
    { child: ChildProcessWithoutNullStreams; abort: () => void } | undefined;

  public constructor(spawnWorker: typeof spawn) {
    this.#spawn = spawnWorker;
  }

  public async parse(
    input: PersonalSecFilingContextParserInput,
    signal?: AbortSignal,
  ): Promise<PersonalSecFilingContextParserResultDto> {
    if (this.#closed || signal?.aborted)
      throw new PersonalSecFilingContextParserError("aborted");
    if (this.#active) throw new PersonalSecFilingContextParserError("busy");
    if (!validInput(input))
      throw new PersonalSecFilingContextParserError("invalid_request");
    // Serialize a copy before the process boundary; caller mutations cannot change
    // the selected value or document after dispatch.
    const selection = Object.freeze({ ...input.selection });
    const cik = input.cik;
    const stdin = Buffer.from(
      JSON.stringify({
        documentBase64: Buffer.from(input.document).toString("base64"),
        cik,
        selection,
      }),
      "utf8",
    );
    if (stdin.byteLength > LIMITS.workerInputBytes)
      throw new PersonalSecFilingContextParserError("invalid_request");
    return await new Promise((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = this.#spawn(
          process.platform === "win32" ? "python" : "python3",
          ["-I", "-S", "-B", WORKER],
          {
            shell: false,
            windowsHide: true,
            stdio: ["pipe", "pipe", "pipe"],
            env: workerEnvironment(),
            cwd: fileURLToPath(new URL("../workers/", import.meta.url)),
          },
        );
      } catch {
        reject(new PersonalSecFilingContextParserError("runtime_unavailable"));
        return;
      }
      let settled = false;
      let stdoutBytes = 0;
      let stderrBytes = 0;
      const chunks: Buffer[] = [];
      const cleanup = (): void => {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
        stdin.fill(0);
      };
      const fail = (code: PersonalSecFilingContextParserErrorCode): void => {
        if (settled) return;
        settled = true;
        cleanup();
        chunks.length = 0;
        child.stdin.destroy();
        child.kill("SIGKILL");
        // Keep the busy guard until close confirms the process has exited.
        reject(new PersonalSecFilingContextParserError(code));
      };
      const abort = (): void => fail("aborted");
      const timeout = setTimeout(() => fail("timeout"), LIMITS.workerTimeoutMs);
      this.#active = { child, abort };
      signal?.addEventListener("abort", abort, { once: true });
      child.on("error", () => fail("runtime_unavailable"));
      child.stdin.on("error", () => fail("worker_failed"));
      child.stdout.on("error", () => fail("worker_failed"));
      child.stderr.on("error", () => fail("worker_failed"));
      child.stdout.on("data", (chunk: Buffer) => {
        if (settled) return;
        stdoutBytes += chunk.byteLength;
        if (stdoutBytes > LIMITS.workerOutputBytes) {
          fail("output_too_large");
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      child.stderr.on("data", (chunk: Buffer) => {
        if (settled) return;
        stderrBytes += chunk.byteLength;
        if (stderrBytes > LIMITS.workerStderrBytes) fail("output_too_large");
      });
      child.once("close", (code, terminationSignal) => {
        if (this.#active?.child === child) this.#active = undefined;
        if (settled) return;
        if (code !== 0 || terminationSignal !== null || stderrBytes !== 0) {
          fail("worker_failed");
          return;
        }
        try {
          const result: unknown = JSON.parse(
            new TextDecoder("utf-8", { fatal: true }).decode(
              Buffer.concat(chunks),
            ),
          );
          if (!validResult(result, selection, cik)) {
            fail("invalid_output");
            return;
          }
          settled = true;
          cleanup();
          chunks.length = 0;
          resolve(freezeResult(result));
        } catch {
          fail("invalid_output");
        }
      });
      if (signal?.aborted || this.#closed) abort();
      else child.stdin.end(stdin);
    });
  }

  public close(): void {
    this.#closed = true;
    this.#active?.abort();
  }
}

function record(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function text(
  value: unknown,
  max: number = LIMITS.identifierCharacters,
): value is string {
  return (
    typeof value === "string" && value.length <= max && !CONTROL.test(value)
  );
}
function nullableText(
  value: unknown,
  max: number = LIMITS.identifierCharacters,
): boolean {
  return value === null || text(value, max);
}
function date(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u.test(value)
  )
    return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
function decimal(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= LIMITS.decimalCharacters &&
    /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/u.test(value) &&
    value !== "-0"
  );
}
function validInput(input: PersonalSecFilingContextParserInput): boolean {
  if (
    !input ||
    !(input.document instanceof Uint8Array) ||
    input.document.byteLength < 1 ||
    input.document.byteLength > LIMITS.documentBytes ||
    !/^[0-9]{10}$/u.test(input.cik) ||
    /^0+$/u.test(input.cik)
  )
    return false;
  const s = input.selection;
  return (
    record(s, [
      "id",
      "metric",
      "taxonomy",
      "concept",
      "unit",
      "value",
      "startDate",
      "endDate",
      "accessionNumber",
      "form",
      "filedDate",
    ]) &&
    typeof s.id === "string" &&
    /^sec-fact:[0-9a-f]{64}$/u.test(s.id) &&
    s.taxonomy === "us-gaap" &&
    (PERSONAL_SEC_QUARTERLY_CONCEPTS as readonly unknown[]).includes(
      s.concept,
    ) &&
    s.metric === (s.concept === "NetIncomeLoss" ? "net_income" : "revenue") &&
    s.unit === "USD" &&
    decimal(s.value) &&
    date(s.startDate) &&
    date(s.endDate) &&
    s.startDate <= s.endDate &&
    typeof s.accessionNumber === "string" &&
    /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u.test(s.accessionNumber) &&
    (s.form === "10-Q" || s.form === "10-Q/A") &&
    date(s.filedDate)
  );
}
function validQName(value: unknown): boolean {
  return (
    record(value, ["raw", "namespace", "localName"]) &&
    text(value.raw) &&
    nullableText(value.namespace, LIMITS.namespaceCharacters) &&
    nullableText(value.localName)
  );
}
function gaapNamespace(value: string | null): boolean {
  const match =
    /^http:\/\/fasb\.org\/us-gaap\/(20[0-9]{2})(-[0-9]{2}-[0-9]{2})?$/u.exec(
      value ?? "",
    );
  return (
    match !== null &&
    Number(match[1]) >= 2009 &&
    (match[2] === undefined || date(`${match[1]}${match[2]}`))
  );
}
function validCandidate(
  value: unknown,
  selection: PersonalSecFilingContextSelectionDto,
  cik: string,
): value is PersonalSecFilingContextCandidateDto {
  if (
    !record(value, [
      "locator",
      "factId",
      "contextId",
      "unitId",
      "concept",
      "entityIdentifier",
      "entityScheme",
      "entityCik",
      "dimensions",
      "periodKind",
      "startDate",
      "endDate",
      "unit",
      "unitMeasures",
      "rawText",
      "format",
      "sign",
      "scale",
      "decimals",
      "precision",
      "value",
      "issues",
    ]) ||
    !text(value.locator) ||
    !/^\/elements\/[1-9][0-9]{0,6}$/u.test(value.locator) ||
    Number(value.locator.slice(10)) > LIMITS.nodes ||
    ![
      "factId",
      "contextId",
      "unitId",
      "entityIdentifier",
      "entityScheme",
      "sign",
      "scale",
      "decimals",
      "precision",
    ].every((key) => nullableText(value[key])) ||
    !(
      value.entityCik === null ||
      (typeof value.entityCik === "string" &&
        /^[0-9]{10}$/u.test(value.entityCik) &&
        !/^0+$/u.test(value.entityCik))
    ) ||
    !validQName(value.concept) ||
    !(value.format === null || validQName(value.format)) ||
    !text(value.rawText, LIMITS.rawTextCharacters) ||
    !["duration", "instant", "unsupported"].includes(
      String(value.periodKind),
    ) ||
    !(value.startDate === null || date(value.startDate)) ||
    !(value.endDate === null || date(value.endDate)) ||
    !(value.unit === null || value.unit === "USD") ||
    !(value.value === null || decimal(value.value)) ||
    !Array.isArray(value.issues) ||
    value.issues.length > ISSUES.size ||
    new Set(value.issues).size !== value.issues.length ||
    !value.issues.every(
      (issue: unknown) =>
        typeof issue === "string" &&
        ISSUES.has(issue as PersonalSecFilingContextIssue),
    )
  )
    return false;
  if (
    !Array.isArray(value.dimensions) ||
    value.dimensions.length > LIMITS.dimensionsPerContext ||
    !value.dimensions.every(
      (dimension: unknown) =>
        record(dimension, ["kind", "dimension", "member", "typedText"]) &&
        validQName(dimension.dimension) &&
        ((dimension.kind === "explicit" &&
          validQName(dimension.member) &&
          dimension.typedText === null) ||
          (dimension.kind === "typed" &&
            dimension.member === null &&
            text(dimension.typedText, LIMITS.rawTextCharacters))),
    )
  )
    return false;
  if (
    !Array.isArray(value.unitMeasures) ||
    value.unitMeasures.length > LIMITS.unitMeasures ||
    !value.unitMeasures.every(validQName)
  )
    return false;
  const candidate = value as unknown as PersonalSecFilingContextCandidateDto;
  if (candidate.issues.length === 0) {
    if (
      !candidate.contextId ||
      !candidate.unitId ||
      !/^[A-Za-z_][A-Za-z0-9_.-]{0,255}$/u.test(candidate.contextId) ||
      !/^[A-Za-z_][A-Za-z0-9_.-]{0,255}$/u.test(candidate.unitId) ||
      (candidate.factId !== null &&
        !/^[A-Za-z_][A-Za-z0-9_.-]{0,255}$/u.test(candidate.factId)) ||
      candidate.concept.localName !== selection.concept ||
      !gaapNamespace(candidate.concept.namespace) ||
      candidate.entityScheme !== "http://www.sec.gov/CIK" ||
      candidate.entityCik !== cik ||
      !candidate.entityIdentifier ||
      !/^[0-9]{1,10}$/u.test(candidate.entityIdentifier) ||
      candidate.entityIdentifier.padStart(10, "0") !== cik ||
      candidate.dimensions.length !== 0 ||
      candidate.periodKind !== "duration" ||
      candidate.startDate !== selection.startDate ||
      candidate.endDate !== selection.endDate ||
      candidate.unit !== "USD" ||
      candidate.unitMeasures.length !== 1 ||
      candidate.unitMeasures[0]?.namespace !==
        "http://www.xbrl.org/2003/iso4217" ||
      candidate.unitMeasures[0].localName !== "USD" ||
      candidate.value === null
    )
      return false;
  }
  return true;
}
function validResult(
  value: unknown,
  selection: PersonalSecFilingContextSelectionDto,
  cik: string,
): value is PersonalSecFilingContextParserResultDto {
  if (
    !record(value, [
      "status",
      "reason",
      "candidates",
      "correspondingCandidateLocators",
    ]) ||
    ![
      "matched",
      "value_differs",
      "ambiguous",
      "no_corresponding_fact",
      "unsupported",
    ].includes(String(value.status)) ||
    !(
      value.reason === null ||
      (typeof value.reason === "string" &&
        ISSUES.has(value.reason as PersonalSecFilingContextIssue))
    ) ||
    !Array.isArray(value.candidates) ||
    value.candidates.length > LIMITS.candidates ||
    !value.candidates.every((row: unknown) =>
      validCandidate(row, selection, cik),
    ) ||
    !Array.isArray(value.correspondingCandidateLocators)
  )
    return false;
  const candidates = value.candidates;
  const locators = candidates.map((row) => row.locator);
  if (
    locators.some(
      (locator, index) =>
        index > 0 &&
        Number(locator.slice(10)) <= Number(locators[index - 1]?.slice(10)),
    )
  )
    return false;
  const corresponding = candidates.filter((row) => row.issues.length === 0);
  if (
    JSON.stringify(value.correspondingCandidateLocators) !==
    JSON.stringify(corresponding.map((row) => row.locator))
  )
    return false;
  if (value.status === "unsupported" && candidates.length === 0)
    return value.reason !== null;
  const uncertain = candidates.filter(
    (row) =>
      row.issues.length > 0 &&
      !row.issues.some(
        (issue) => issue === "entity_mismatch" || issue === "period_mismatch",
      ),
  );
  if (uncertain.length > 0)
    return (
      value.status === "unsupported" && value.reason === uncertain[0]?.issues[0]
    );
  if (value.reason !== null) return false;
  const expected =
    corresponding.length === 0
      ? "no_corresponding_fact"
      : new Set(corresponding.map((row) => row.value)).size > 1
        ? "ambiguous"
        : corresponding[0]?.value === selection.value
          ? "matched"
          : "value_differs";
  return value.status === expected;
}
function freezeResult(
  value: PersonalSecFilingContextParserResultDto,
): PersonalSecFilingContextParserResultDto {
  const candidates = value.candidates.map((row) =>
    Object.freeze({
      ...row,
      concept: Object.freeze({ ...row.concept }),
      format: row.format === null ? null : Object.freeze({ ...row.format }),
      dimensions: Object.freeze(
        row.dimensions.map((dimension) =>
          Object.freeze({
            ...dimension,
            dimension: Object.freeze({ ...dimension.dimension }),
            member:
              dimension.member === null
                ? null
                : Object.freeze({ ...dimension.member }),
          }),
        ),
      ),
      unitMeasures: Object.freeze(
        row.unitMeasures.map((measure) => Object.freeze({ ...measure })),
      ),
      issues: Object.freeze([...row.issues]),
    }),
  );
  return Object.freeze({
    ...value,
    candidates: Object.freeze(candidates),
    correspondingCandidateLocators: Object.freeze([
      ...value.correspondingCandidateLocators,
    ]),
  });
}
