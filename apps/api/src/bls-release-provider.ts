import type { ManagedBlsCalendarDto } from "@research-cockpit/contracts";
import { normalizeBlsCalendar } from "./bls-calendar-normalization";

const SOURCE_URL = "https://www.bls.gov/schedule/news_release/bls.ics";
const MAX_BYTES = 256 * 1_024;
const DEADLINE_MILLISECONDS = 10_000;
export class BlsReleaseProviderError extends Error {
  constructor(readonly code: "unavailable" | "invalid_response" | "aborted") {
    super("The BLS release schedule is unavailable.");
    this.name = "BlsReleaseProviderError";
  }
}
export interface BlsReleaseProvider {
  load(signal?: AbortSignal): Promise<ManagedBlsCalendarDto>;
  close(): void;
}
interface Dependencies {
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
}

/** A fixed public schedule source. Construction never acquires data. */
export function createBlsReleaseProvider(
  dependencies: Dependencies = {},
): BlsReleaseProvider {
  return new PublicBlsReleaseProvider(dependencies);
}

class PublicBlsReleaseProvider implements BlsReleaseProvider {
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

  async load(signal?: AbortSignal): Promise<ManagedBlsCalendarDto> {
    if (this.#closed || signal?.aborted) fail("aborted");
    const lifetime = requestLifetime(signal);
    const controller = lifetime.controller;
    this.#active.add(controller);
    try {
      const response = await fetchSchedule(this.#fetch, controller.signal);
      const text = await readBoundedText(response, controller.signal);
      assertActive(controller.signal);
      const fetchedAt = this.#now().toISOString();
      const result = await parseSchedule(text, fetchedAt, controller.signal);
      assertActive(controller.signal);
      if (this.#closed) fail("aborted");
      return result;
    } catch (error) {
      return propagateFailure(
        error,
        this.#closed || signal?.aborted === true,
        lifetime.timedOut(),
      );
    } finally {
      lifetime.dispose();
      this.#active.delete(controller);
    }
  }
}

function requestLifetime(signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, DEADLINE_MILLISECONDS);
  return {
    controller,
    timedOut: () => timedOut,
    dispose() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    },
  };
}

function propagateFailure(
  error: unknown,
  aborted: boolean,
  timedOut: boolean,
): never {
  if (aborted) fail("aborted");
  if (timedOut) fail("unavailable");
  if (error instanceof BlsReleaseProviderError) throw error;
  if (error instanceof SyntaxError || error instanceof RangeError)
    fail("invalid_response");
  return fail("unavailable");
}

async function fetchSchedule(
  fetch: typeof globalThis.fetch,
  signal: AbortSignal,
): Promise<Response> {
  const response = await withAbort(
    fetch(SOURCE_URL, {
      method: "GET",
      headers: { Accept: "text/calendar" },
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal,
    }),
    signal,
  );
  if (response.status !== 200 || response.redirected) {
    void response.body?.cancel().catch(() => undefined);
    fail("unavailable");
  }
  return response;
}

async function parseSchedule(
  text: string,
  fetchedAt: string,
  signal: AbortSignal,
): Promise<ManagedBlsCalendarDto> {
  try {
    return await withAbort(normalizeBlsCalendar(text, fetchedAt), signal);
  } catch {
    assertActive(signal);
    fail("invalid_response");
  }
}

function fail(code: BlsReleaseProviderError["code"]): never {
  throw new BlsReleaseProviderError(code);
}
function assertActive(signal: AbortSignal): void {
  if (signal.aborted) fail("aborted");
}

async function withAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  assertActive(signal);
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        abort = () => reject(new BlsReleaseProviderError("aborted"));
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      }),
    ]);
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
  }
}

function admitBody(response: Response): ReadableStream<Uint8Array> {
  const length = response.headers.get("content-length");
  if (length !== null) admitContentLength(response, length);
  if (response.body === null) fail("invalid_response");
  return response.body;
}

function admitContentLength(response: Response, length: string): void {
  if (/^(?:0|[1-9]\d*)$/u.test(length) && Number(length) <= MAX_BYTES) return;
  void response.body?.cancel().catch(() => undefined);
  fail("invalid_response");
}

async function readChunks(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): Promise<Uint8Array[]> {
  const reader = body.getReader(),
    chunks: Uint8Array[] = [];
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
    return chunks;
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function decodeChunks(chunks: readonly Uint8Array[]): string {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
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

async function readBoundedText(
  response: Response,
  signal: AbortSignal,
): Promise<string> {
  return decodeChunks(await readChunks(admitBody(response), signal));
}
