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
          headers: { Accept: "text/calendar" },
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
      let result: ManagedBlsCalendarDto;
      try {
        result = await withAbort(
          normalizeBlsCalendar(text, fetchedAt),
          controller.signal,
        );
      } catch {
        if (controller.signal.aborted) fail("aborted");
        fail("invalid_response");
      }
      if (controller.signal.aborted || this.#closed) fail("aborted");
      return result;
    } catch (error) {
      if (this.#closed || signal?.aborted) fail("aborted");
      if (timedOut) fail("unavailable");
      if (error instanceof BlsReleaseProviderError) throw error;
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

function fail(code: BlsReleaseProviderError["code"]): never {
  throw new BlsReleaseProviderError(code);
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
        abort = () => reject(new BlsReleaseProviderError("aborted"));
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
