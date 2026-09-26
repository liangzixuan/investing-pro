import {
  isPersonalEconomicCalendarDto,
  PERSONAL_BEA_CALENDAR_SOURCE,
  PERSONAL_ECONOMIC_CALENDAR_MAXIMUM_EVENTS,
  PERSONAL_ECONOMIC_CALENDAR_MAXIMUM_SERIES_LENGTH,
  PERSONAL_ECONOMIC_CALENDAR_WINDOW_DAYS,
  type PersonalEconomicCalendarDto,
} from "@research-cockpit/contracts";

const SOURCE_URL = "https://apps.bea.gov/API/signup/release_dates.json";
const MAX_BYTES = 256 * 1_024;
const MAX_SERIES = 128;
const MAX_INPUT_DATES = 4_096;
const WINDOW_MILLISECONDS = PERSONAL_ECONOMIC_CALENDAR_WINDOW_DAYS * 86_400_000;
const DEADLINE_MILLISECONDS = 10_000;

export class BeaReleaseProviderError extends Error {
  constructor(readonly code: "unavailable" | "invalid_response" | "aborted") {
    super("The BEA release schedule is unavailable.");
    this.name = "BeaReleaseProviderError";
  }
}
export interface BeaReleaseProvider {
  load(signal?: AbortSignal): Promise<PersonalEconomicCalendarDto>;
  close(): void;
}
interface Dependencies {
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
}

/** A fixed public schedule source. Construction never acquires data. */
export function createBeaReleaseProvider(
  dependencies: Dependencies = {},
): BeaReleaseProvider {
  return new PublicBeaReleaseProvider(dependencies);
}

class PublicBeaReleaseProvider implements BeaReleaseProvider {
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  readonly #active = new Set<AbortController>();
  #closed = false;

  constructor(dependencies: Dependencies) {
    this.#fetch = dependencies.fetch ?? globalThis.fetch;
    this.#now = dependencies.now ?? (() => new Date());
  }

  close(): void {
    this.#closed = true;
    for (const controller of this.#active) controller.abort();
    this.#active.clear();
  }

  async load(signal?: AbortSignal): Promise<PersonalEconomicCalendarDto> {
    if (this.#closed || signal?.aborted) fail("aborted");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    this.#active.add(controller);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, DEADLINE_MILLISECONDS);
    try {
      const response = await withAbort(
        this.#fetch(SOURCE_URL, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
          cache: "no-store",
          signal: controller.signal,
        }),
        controller.signal,
      );
      if (response.status !== 200 || response.redirected) {
        void response.body?.cancel().catch(() => undefined);
        fail("unavailable");
      }
      const text = await readBoundedText(response, controller.signal);
      if (controller.signal.aborted) fail("aborted");
      const fetchedAt = this.#now().toISOString();
      const value: unknown = JSON.parse(text);
      const result = normalizeSchedule(value, fetchedAt);
      if (controller.signal.aborted || this.#closed) fail("aborted");
      return result;
    } catch (error) {
      if (this.#closed || signal?.aborted) fail("aborted");
      if (timedOut) fail("unavailable");
      if (error instanceof BeaReleaseProviderError) throw error;
      if (error instanceof SyntaxError || error instanceof RangeError)
        fail("invalid_response");
      return fail("unavailable");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      this.#active.delete(controller);
    }
  }
}

function fail(code: BeaReleaseProviderError["code"]): never {
  throw new BeaReleaseProviderError(code);
}

function normalizeSchedule(
  value: unknown,
  fetchedAt: string,
): PersonalEconomicCalendarDto {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    fail("invalid_response");
  if (Object.hasOwn(value, "file_last_updated")) {
    const updated: unknown = Reflect.get(value, "file_last_updated");
    // BEA's file metadata has no time zone. Validate it without using it as an instant.
    if (
      typeof updated !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/u.test(updated) ||
      !validCalendarTime(updated.slice(0, 19))
    )
      fail("invalid_response");
  }
  const entries: [string, unknown][] = Object.entries(value).filter(
    ([name]) => name !== "file_last_updated",
  );
  if (entries.length === 0 || entries.length > MAX_SERIES)
    fail("invalid_response");
  const from = Date.parse(fetchedAt);
  const to = from + WINDOW_MILLISECONDS;
  const events: { series: string; scheduledAt: string }[] = [];
  const seen = new Set<string>();
  let inputDates = 0;
  for (const [series, input] of entries) {
    if (
      series.length === 0 ||
      series.length > PERSONAL_ECONOMIC_CALENDAR_MAXIMUM_SERIES_LENGTH ||
      series.trim() !== series ||
      /[\p{Cc}\p{Cf}\p{Cs}]/u.test(series) ||
      input === null ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).length !== 1 ||
      !Object.hasOwn(input, "release_dates")
    )
      fail("invalid_response");
    const dates: unknown = Reflect.get(input, "release_dates");
    if (!Array.isArray(dates)) fail("invalid_response");
    inputDates += dates.length;
    if (inputDates > MAX_INPUT_DATES) fail("invalid_response");
    for (const date of dates) {
      const scheduledAt = sourceInstant(date);
      const milliseconds = Date.parse(scheduledAt);
      if (milliseconds < from || milliseconds >= to) continue;
      const key = JSON.stringify([series, scheduledAt]);
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({ series, scheduledAt });
      if (events.length > PERSONAL_ECONOMIC_CALENDAR_MAXIMUM_EVENTS)
        fail("invalid_response");
    }
  }
  if (inputDates === 0) fail("invalid_response");
  events.sort((left, right) =>
    left.scheduledAt < right.scheduledAt
      ? -1
      : left.scheduledAt > right.scheduledAt
        ? 1
        : left.series < right.series
          ? -1
          : left.series > right.series
            ? 1
            : 0,
  );
  const result = {
    schemaVersion: "1.0.0" as const,
    source: PERSONAL_BEA_CALENDAR_SOURCE,
    fetchedAt,
    window: {
      fromInclusive: fetchedAt,
      toExclusive: new Date(to).toISOString(),
    },
    events,
  };
  if (!isPersonalEconomicCalendarDto(result)) fail("invalid_response");
  return Object.freeze({
    ...result,
    window: Object.freeze(result.window),
    events: Object.freeze(events.map((event) => Object.freeze(event))),
  });
}

function sourceInstant(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      value,
    )
  )
    fail("invalid_response");
  // Date.parse alone accepts impossible calendar dates such as February 30.
  const wallTime = value.slice(0, 19);
  const milliseconds = Date.parse(value);
  if (!validCalendarTime(wallTime) || !Number.isFinite(milliseconds))
    fail("invalid_response");
  return new Date(milliseconds).toISOString();
}

function validCalendarTime(value: string): boolean {
  const wall = new Date(`${value}Z`);
  return (
    Number.isFinite(wall.getTime()) && wall.toISOString().slice(0, 19) === value
  );
}

async function withAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) fail("aborted");
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        abort = () => reject(new BeaReleaseProviderError("aborted"));
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      }),
    ]);
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
  }
}

async function readBoundedText(response: Response, signal: AbortSignal) {
  const length = response.headers.get("content-length");
  if (
    length !== null &&
    (!/^(?:0|[1-9]\d*)$/u.test(length) || Number(length) > MAX_BYTES)
  ) {
    void response.body?.cancel().catch(() => undefined);
    fail("invalid_response");
  }
  if (response.body === null) fail("invalid_response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await withAbort(reader.read(), signal);
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) fail("invalid_response");
      size += result.value.byteLength;
      if (size > MAX_BYTES) fail("invalid_response");
      chunks.push(result.value);
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (size === 0) fail("invalid_response");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("invalid_response");
  }
}
