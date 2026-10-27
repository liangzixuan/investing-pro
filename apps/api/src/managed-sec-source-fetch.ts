interface SecFetchBoundary {
  readonly cik: string;
  readonly contact: string;
  readonly fetch: typeof globalThis.fetch;
  readonly controller: AbortController;
  readonly guard: () => void;
}
/** Exactly Submissions then CompanyFacts, with fixed issuer and no redirect authority. */
export function createManagedSecSourceFetch(
  options: SecFetchBoundary,
): typeof globalThis.fetch {
  return new SecFetchSequence(options).fetch;
}
class SecFetchSequence {
  #count = 0;
  readonly #urls: readonly string[];
  readonly options: SecFetchBoundary;
  constructor(options: SecFetchBoundary) {
    this.options = Object.freeze({
      cik: options.cik,
      contact: options.contact,
      fetch: options.fetch,
      controller: options.controller,
      guard: options.guard,
    });
    this.#urls = [
      `https://data.sec.gov/submissions/CIK${options.cik}.json`,
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${options.cik}.json`,
    ];
  }
  readonly fetch: typeof globalThis.fetch = async (input, init) => {
    this.options.guard();
    const url = requestUrl(input);
    if (this.#count >= 2) this.#stop();
    if (url !== this.#urls[this.#count]) this.#stop();
    if (!fixedRequest(init, this.options.contact)) this.#stop();
    this.#count++;
    return this.#read(input, init!, url);
  };
  #stop(): never {
    this.options.controller.abort();
    throw new Error("Managed SEC request boundary rejected.");
  }
  async #read(
    input: Parameters<typeof globalThis.fetch>[0],
    init: RequestInit,
    url: string,
  ): Promise<Response> {
    const requestSignal = init.signal!;
    const bodyFailed = () => this.options.controller.abort();
    requestSignal.addEventListener("abort", bodyFailed, { once: true });
    const release = () =>
      requestSignal.removeEventListener("abort", bodyFailed);
    try {
      const response = await this.options.fetch(input, init);
      if (!(response instanceof Response)) this.#stop();
      this.#guardResponse(response, url);
      if (response.body === null) {
        release();
        return response;
      }
      return relayResponse(response, { release, bodyFailed });
    } catch {
      release();
      return this.#stop();
    }
  }
  #guardResponse(response: Response, url: string): void {
    try {
      this.options.guard();
    } catch (error) {
      cancelBody(response);
      throw error;
    }
    if (!response.ok) {
      cancelBody(response);
      this.#stop();
    }
    if (response.redirected) {
      cancelBody(response);
      this.#stop();
    }
    if (response.url !== "" && response.url !== url) {
      cancelBody(response);
      this.#stop();
    }
  }
}
function requestUrl(input: Parameters<typeof globalThis.fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}
function fixedRequest(init: RequestInit | undefined, contact: string): boolean {
  if (init === undefined) return false;
  if (!fixedRequestMode(init)) return false;
  if (init.body !== undefined) return false;
  if (init.signal?.aborted !== false) return false;
  const headers = new Headers(init.headers);
  return (
    headers.get("user-agent") === contact &&
    headers.get("accept") === "application/json"
  );
}
function fixedRequestMode(init: RequestInit): boolean {
  if (init.method !== "GET") return false;
  if (init.redirect !== "error") return false;
  if (init.credentials !== "omit") return false;
  return init.cache === "no-store";
}
function cancelBody(response: Response): void {
  void response.body?.cancel().catch(() => undefined);
}
interface BodyLifetime {
  readonly release: () => void;
  readonly bodyFailed: () => void;
}
function relayResponse(response: Response, lifetime: BodyLifetime): Response {
  const reader = response.body!.getReader();
  const body = new ReadableStream<Uint8Array>(
    {
      async pull(stream) {
        try {
          const part = await reader.read();
          if (part.done) {
            lifetime.release();
            reader.releaseLock();
            stream.close();
          } else stream.enqueue(part.value);
        } catch {
          lifetime.bodyFailed();
          lifetime.release();
          stream.error(new Error("Managed SEC body failed"));
        }
      },
      cancel() {
        lifetime.release();
        void reader.cancel().catch(() => undefined);
      },
    },
    { highWaterMark: 0 },
  );
  return new Response(body, {
    status: response.status,
    headers: response.headers,
  });
}
