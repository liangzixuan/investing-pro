import {
  MANAGED_CPI_HEADLINE_SOURCE,
  MANAGED_CPI_HEADLINES_LIMITS,
  type ManagedCpiHeadlinesDto,
} from "@research-cockpit/contracts";
import {
  CpiHeadlinesProviderError,
  parseCpiHeadlinesAtom,
} from "./cpi-headlines-parser";
export { CpiHeadlinesProviderError } from "./cpi-headlines-parser";
const SOURCE_URL = MANAGED_CPI_HEADLINE_SOURCE.feedUrl;
const MAX_BYTES = MANAGED_CPI_HEADLINES_LIMITS.sourceBytes;
const DEADLINE_MILLISECONDS = MANAGED_CPI_HEADLINES_LIMITS.operationMs;
export interface CpiHeadlinesProvider {
  load(signal?: AbortSignal): Promise<ManagedCpiHeadlinesDto>;
  close(): void;
}
interface Dependencies {
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
}

/** A fixed public feed source. Construction never acquires data. */
export function createCpiHeadlinesProvider(
  dependencies: Dependencies = {},
): CpiHeadlinesProvider {
  return new PublicCpiHeadlinesProvider(dependencies);
}

class PublicCpiHeadlinesProvider implements CpiHeadlinesProvider {
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
  private assertActive(signal?: AbortSignal) {
    if (this.#closed || signal?.aborted) fail("aborted");
  }

  async load(signal?: AbortSignal): Promise<ManagedCpiHeadlinesDto> {
    this.assertActive(signal);
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
      const response = await fetchFeed(this.#fetch, controller.signal);
      const text = await readBoundedText(response, controller.signal);
      this.assertActive(controller.signal);
      const fetchedAt = this.#now().toISOString();
      const result = parseCpiHeadlinesAtom(text, fetchedAt);
      this.assertActive(controller.signal);
      return result;
    } catch (error) {
      this.assertActive(signal);
      return transportFailure(error, timedOut);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      this.#active.delete(controller);
    }
  }
}
function transportFailure(error: unknown, timedOut: boolean): never {
  if (timedOut) fail("unavailable");
  if (error instanceof CpiHeadlinesProviderError) throw error;
  if (error instanceof SyntaxError || error instanceof RangeError)
    fail("invalid_response");
  return fail("unavailable");
}
async function fetchFeed(fetch: typeof globalThis.fetch, signal: AbortSignal) {
  const response = await withAbort(
    fetch(SOURCE_URL, {
      method: "GET",
      headers: {
        Accept:
          "application/atom+xml, application/rss+xml;q=0.9, application/xml;q=0.8",
      },
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

function fail(code: CpiHeadlinesProviderError["code"]): never {
  throw new CpiHeadlinesProviderError(code);
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
        abort = () => reject(new CpiHeadlinesProviderError("aborted"));
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      }),
    ]);
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
  }
}

async function readBoundedText(response: Response, signal: AbortSignal) {
  const body = admittedBody(response);
  const bytes = await readBytes(body.getReader(), signal);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("invalid_response");
  }
}
function admittedBody(response: Response): ReadableStream<Uint8Array> {
  const length = response.headers.get("content-length");
  if (invalidDeclaredLength(length)) {
    void response.body?.cancel().catch(() => undefined);
    fail("invalid_response");
  }
  if (response.body === null) fail("invalid_response");
  return response.body;
}
function invalidDeclaredLength(length: string | null): boolean {
  if (length === null) return false;
  if (!/^(?:0|[1-9]\d*)$/u.test(length)) return true;
  return Number(length) > MAX_BYTES;
}
/** Own the complete bounded body before decoding; no partial source is admitted. */
class CpiSourceChunks {
  private readonly chunks: Uint8Array[] = [];
  private size = 0;
  append(value: unknown) {
    if (!(value instanceof Uint8Array)) fail("invalid_response");
    this.size += value.byteLength;
    if (this.size > MAX_BYTES) fail("invalid_response");
    this.chunks.push(value);
  }
  complete() {
    if (this.size === 0) fail("invalid_response");
    return concatenate(this.chunks, this.size);
  }
}
async function readBytes(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
) {
  const chunks = new CpiSourceChunks();
  try {
    while (true) {
      const result = await withAbort(reader.read(), signal);
      if (result.done) break;
      chunks.append(result.value);
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  return chunks.complete();
}
function concatenate(chunks: readonly Uint8Array[], size: number) {
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
