import { createHash } from "node:crypto";

import {
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  type PersonalSecAnnualConceptDto,
  type PersonalSecAnnualFactDto,
  type PersonalSecAnnualFinancialSnapshotDto,
  type PersonalSecAnnualFrameDto,
} from "@research-cockpit/contracts";

export const PERSONAL_SEC_USER_AGENT = "PERSONAL_SEC_USER_AGENT" as const;

export type PersonalSecFinancialProviderErrorCode =
  "not_configured" | "invalid_request" | "busy" | "aborted";

export interface PersonalSecFinancialProvider {
  close(): void;
  status(): Readonly<{ configured: boolean }>;
  loadSnapshot(
    calendarYear: number,
    signal?: AbortSignal,
    refresh?: boolean,
  ): Promise<PersonalSecAnnualFinancialSnapshotDto>;
}

export interface SecPersonalFinancialProviderDependencies {
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
}

interface ActiveSnapshotLoad {
  readonly calendarYear: number;
  readonly controller: AbortController;
  readonly promise: Promise<PersonalSecAnnualFinancialSnapshotDto>;
  consumers: number;
}

const MESSAGE = "Personal financial screening data is unavailable.";
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_FRAME_ROWS = 50_000;
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_INTERVAL_MS = 220;
const CACHE_DURATION_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SAFE_COEFFICIENT = BigInt(Number.MAX_SAFE_INTEGER);

// SEC documents the fixed cross-company frames, calendar alignment, and fair
// access at https://www.sec.gov/search-filings/edgar-application-programming-interfaces
// and https://www.sec.gov/about/webmaster-frequently-asked-questions.
// This is current extracted public filing data, never point-in-time history.
export class PersonalSecFinancialProviderError extends Error {
  public constructor(
    public readonly code: PersonalSecFinancialProviderErrorCode,
  ) {
    super(MESSAGE);
    this.name = "PersonalSecFinancialProviderError";
  }
}

class FrameError extends Error {
  public constructor(
    public readonly status: PersonalSecAnnualFrameDto["status"],
  ) {
    super(MESSAGE);
  }
}

export function createSecPersonalFinancialProvider(
  userAgent?: string,
  dependencies: SecPersonalFinancialProviderDependencies = {},
): PersonalSecFinancialProvider {
  return new SecPersonalFinancialProvider(userAgent, dependencies);
}

class SecPersonalFinancialProvider implements PersonalSecFinancialProvider {
  readonly #userAgent: string | undefined;
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  #closed = false;
  #cache: PersonalSecAnnualFinancialSnapshotDto | undefined;
  #active: ActiveSnapshotLoad | undefined;
  #requestHasRun = false;

  public constructor(
    userAgent: string | undefined,
    dependencies: SecPersonalFinancialProviderDependencies,
  ) {
    this.#userAgent = validUserAgent(userAgent) ? userAgent : undefined;
    this.#fetch = dependencies.fetch ?? globalThis.fetch;
    this.#now = dependencies.now ?? (() => new Date());
    if (typeof this.#fetch !== "function" || typeof this.#now !== "function") {
      throw new TypeError(MESSAGE);
    }
  }

  public status(): Readonly<{ configured: boolean }> {
    return Object.freeze({
      configured: !this.#closed && this.#userAgent !== undefined,
    });
  }

  public close(): void {
    this.#closed = true;
    this.#cache = undefined;
    this.#active?.controller.abort();
  }

  public async loadSnapshot(
    calendarYear: number,
    signal?: AbortSignal,
    refresh = false,
  ): Promise<PersonalSecAnnualFinancialSnapshotDto> {
    if (this.#closed || signal?.aborted === true) fail("aborted");
    if (this.#userAgent === undefined) fail("not_configured");
    const now = this.#now();
    if (
      !validClock(now) ||
      !Number.isSafeInteger(calendarYear) ||
      calendarYear < 2009 ||
      calendarYear >= now.getUTCFullYear() ||
      typeof refresh !== "boolean"
    ) {
      fail("invalid_request");
    }
    if (this.#active !== undefined) {
      if (this.#active.calendarYear !== calendarYear) fail("busy");
      return this.#join(this.#active, signal);
    }
    if (
      !refresh &&
      this.#cache?.calendarYear === calendarYear &&
      Date.parse(this.#cache.expiresAt) > now.getTime() &&
      Date.parse(this.#cache.fetchedAt) <= now.getTime()
    ) {
      return this.#cache;
    }
    const controller = new AbortController();
    const promise = this.#load(calendarYear, controller.signal).finally(() => {
      if (this.#active?.controller === controller) this.#active = undefined;
    });
    this.#active = { calendarYear, controller, promise, consumers: 0 };
    return this.#join(this.#active, signal);
  }

  async #join(
    active: ActiveSnapshotLoad,
    signal?: AbortSignal,
  ): Promise<PersonalSecAnnualFinancialSnapshotDto> {
    active.consumers += 1;
    try {
      return await withAbort(active.promise, signal);
    } finally {
      active.consumers -= 1;
      // Coalescing must not let one disconnected caller cancel another caller's
      // screen. Cancel the source operation only when nobody is waiting for it.
      if (active.consumers === 0 && this.#active === active)
        active.controller.abort();
    }
  }

  async #load(
    calendarYear: number,
    signal: AbortSignal,
  ): Promise<PersonalSecAnnualFinancialSnapshotDto> {
    const frames: PersonalSecAnnualFrameDto[] = [];
    for (const concept of PERSONAL_SEC_ANNUAL_CONCEPTS) {
      if (signal.aborted) fail("aborted");
      // One provider operation at a time, and spacing between every request,
      // including separate refreshes, keeps this adapter below five per second.
      if (this.#requestHasRun) await delay(REQUEST_INTERVAL_MS, signal);
      this.#requestHasRun = true;
      frames.push(await this.#loadFrame(concept, calendarYear, signal));
    }
    if (this.#closed || signal.aborted) fail("aborted");
    const fetchedAt = this.#now();
    if (!validClock(fetchedAt)) fail("invalid_request");
    const normalized = Object.freeze(frames);
    const snapshot: PersonalSecAnnualFinancialSnapshotDto = Object.freeze({
      calendarYear,
      fetchedAt: fetchedAt.toISOString(),
      expiresAt: new Date(
        fetchedAt.getTime() + CACHE_DURATION_MS,
      ).toISOString(),
      // Source content, source statuses, and selected year define the digest.
      // A refresh of identical facts does not invalidate pagination unnecessarily.
      snapshotSha256: `sha256:${createHash("sha256")
        .update(JSON.stringify({ calendarYear, frames: normalized }))
        .digest("hex")}`,
      frames: normalized,
    });
    this.#cache = snapshot;
    return snapshot;
  }

  async #loadFrame(
    concept: PersonalSecAnnualConceptDto,
    calendarYear: number,
    signal: AbortSignal,
  ): Promise<PersonalSecAnnualFrameDto> {
    const sourceUrl = `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY${calendarYear}.json`;
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await withAbort(
        this.#fetch(sourceUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": this.#userAgent!,
          },
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
          cache: "no-store",
          signal: controller.signal,
        }),
        controller.signal,
      );
      if (
        !(response instanceof Response) ||
        response.redirected ||
        (response.url !== "" && response.url !== sourceUrl)
      )
        throw new FrameError("invalid_response");
      if (!response.ok) {
        void response.body?.cancel().catch(() => undefined);
        throw new FrameError(
          response.status === 404
            ? "not_covered"
            : response.status === 429
              ? "rate_limited"
              : "upstream_unavailable",
        );
      }
      const text = await readBoundedText(response, controller.signal);
      const result = normalizeFrame(
        parseLosslessJson(text),
        concept,
        calendarYear,
        sourceUrl,
      );
      if (controller.signal.aborted)
        throw new FrameError("upstream_unavailable");
      return result;
    } catch (error) {
      if (this.#closed || signal.aborted) fail("aborted");
      return Object.freeze({
        concept,
        sourceUrl,
        status:
          error instanceof FrameError ? error.status : "upstream_unavailable",
        facts: Object.freeze([]),
        unknownCiks: Object.freeze([]),
      });
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    }
  }
}

function normalizeFrame(
  value: unknown,
  concept: PersonalSecAnnualConceptDto,
  calendarYear: number,
  sourceUrl: string,
): PersonalSecAnnualFrameDto {
  if (
    !isRecord(value) ||
    value.taxonomy !== "us-gaap" ||
    value.tag !== concept ||
    value.ccp !== `CY${calendarYear}` ||
    value.uom !== "USD" ||
    !Array.isArray(value.data) ||
    value.data.length > MAX_FRAME_ROWS ||
    String(value.pts) !== String(value.data.length)
  ) {
    throw new FrameError("invalid_response");
  }
  const facts = new Map<string, PersonalSecAnnualFactDto>();
  const unknownCiks = new Set<string>();
  const seen = new Set<string>();
  for (const candidate of value.data) {
    if (!isRecord(candidate)) throw new FrameError("invalid_response");
    const cik = normalizeCik(candidate.cik);
    if (cik === undefined) throw new FrameError("invalid_response");
    if (seen.has(cik)) {
      facts.delete(cik);
      unknownCiks.add(cik);
      continue;
    }
    seen.add(cik);
    const startDate = normalizeDate(candidate.start);
    const endDate = normalizeDate(candidate.end);
    const decimal = normalizeDecimal(candidate.val);
    const duration =
      startDate !== undefined && endDate !== undefined
        ? (Date.parse(endDate) - Date.parse(startDate)) / DAY_MS + 1
        : 0;
    if (
      startDate === undefined ||
      endDate === undefined ||
      duration < 335 ||
      duration > 395 ||
      Math.abs(Number(endDate.slice(0, 4)) - calendarYear) > 1 ||
      decimal === undefined ||
      typeof candidate.accn !== "string" ||
      !/^\d{10}-\d{2}-\d{6}$/u.test(candidate.accn)
    ) {
      unknownCiks.add(cik);
      continue;
    }
    facts.set(
      cik,
      Object.freeze({
        cik,
        accessionNumber: candidate.accn,
        startDate,
        endDate,
        value: decimal,
      }),
    );
  }
  return Object.freeze({
    concept,
    status: "available",
    sourceUrl,
    facts: Object.freeze(
      [...facts.values()].sort((left, right) =>
        left.cik.localeCompare(right.cik),
      ),
    ),
    unknownCiks: Object.freeze([...unknownCiks].sort()),
  });
}

function normalizeDecimal(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    value.length > 32 ||
    !/^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/u.test(value)
  )
    return undefined;
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "", fraction = ""] = unsigned.split(".");
  const trimmedFraction = fraction.replace(/0+$/u, "");
  const coefficient = BigInt(`${integer}${trimmedFraction}`);
  if (coefficient > MAX_SAFE_COEFFICIENT) return undefined;
  if (coefficient === 0n) return "0";
  return `${negative ? "-" : ""}${integer}${trimmedFraction === "" ? "" : `.${trimmedFraction}`}`;
}

function normalizeCik(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !/^\d{1,10}$/u.test(value) ||
    Number(value) === 0
  )
    return undefined;
  return value.padStart(10, "0");
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    return undefined;
  const instant = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(instant) &&
    new Date(instant).toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

function validUserAgent(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    /^[\x20-\x7E]{8,256}$/u.test(value) &&
    /\S+@[^\s@]+\.[^\s@]+/u.test(value)
  );
}

function validClock(value: Date): boolean {
  return (
    value instanceof Date &&
    Number.isFinite(value.getTime()) &&
    value.getUTCFullYear() >= 2010 &&
    value.getUTCFullYear() <= 9998
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(code: PersonalSecFinancialProviderErrorCode): never {
  throw new PersonalSecFinancialProviderError(code);
}

async function withAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal === undefined) return promise;
  if (signal.aborted) fail("aborted");
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        onAbort = () =>
          reject(new PersonalSecFinancialProviderError("aborted"));
        signal.addEventListener("abort", onAbort, { once: true });
      }),
    ]);
  } finally {
    if (onAbort !== undefined) signal.removeEventListener("abort", onAbort);
  }
}

async function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await withAbort(
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, milliseconds);
      }),
      signal,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedText(
  response: Response,
  signal: AbortSignal,
): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^(?:0|[1-9]\d*)$/u.test(declaredLength) ||
      !Number.isSafeInteger(Number(declaredLength)) ||
      Number(declaredLength) > MAX_RESPONSE_BYTES)
  ) {
    void response.body?.cancel().catch(() => undefined);
    throw new FrameError("invalid_response");
  }
  if (response.body === null) throw new FrameError("invalid_response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await withAbort(reader.read(), signal);
      if (result.done) break;
      if (!(result.value instanceof Uint8Array))
        throw new FrameError("invalid_response");
      size += result.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new FrameError("invalid_response");
      chunks.push(result.value);
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (size === 0) throw new FrameError("invalid_response");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new FrameError("invalid_response");
  }
}

function parseLosslessJson(text: string): unknown {
  try {
    // Validate original JSON, then preserve its numeric lexemes before decoding.
    // Checking a rounded JavaScript number would miss unsafe source precision.
    JSON.parse(text);
    return JSON.parse(
      text.replace(
        /"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/gu,
        (token) => (token.startsWith('"') ? token : JSON.stringify(token)),
      ),
    );
  } catch {
    throw new FrameError("invalid_response");
  }
}
