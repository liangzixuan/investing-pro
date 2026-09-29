import { AppwriteException, Client } from "node-appwrite";
import { Agent, DecoratorHandler, type Dispatcher } from "undici";

export const APPWRITE_TRANSPORT_LIMITS = Object.freeze({
  timeoutMs: 12_000,
  requestTimeoutMs: 2_000,
  mutationWindowMs: 9_000,
  maxResponseBytes: 1_048_576,
  maxRequests: 20,
});

interface Limits {
  readonly timeoutMs: number;
  readonly requestTimeoutMs: number;
  readonly mutationWindowMs: number;
  readonly maxResponseBytes: number;
  readonly maxRequests: number;
}

interface Options {
  /** Trusted server configuration, never an incoming request field. */
  readonly endpoint: string;
  readonly signal?: AbortSignal;
  readonly limits?: Partial<Limits>;
  /** Injection seam for isolated tests. This composition owns its lifetime. */
  readonly dispatcher?: Dispatcher;
}

type Failure =
  | "invalid_request"
  | "invalid_response"
  | "deadline"
  | "request_limit"
  | "closed";

const ERROR_TYPES = new Set([
  "attribute_limit_exceeded",
  "transaction_conflict",
  "transaction_failed",
  "document_invalid_structure",
  "row_invalid_structure",
  "general_argument_invalid",
]);

function failure(type: Failure): AppwriteException {
  return new AppwriteException(
    "Appwrite transport rejected the request.",
    0,
    type,
  );
}

/** One bounded lifetime shared by every SDK call in a server operation. */
export function createAppwriteTransport(options: Options) {
  let endpoint: URL;
  try {
    endpoint = new URL(options.endpoint);
  } catch {
    throw failure("invalid_request");
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username !== "" ||
    endpoint.password !== "" ||
    endpoint.search !== "" ||
    endpoint.hash !== "" ||
    endpoint.pathname !== "/v1"
  )
    throw failure("invalid_request");
  const limits = { ...APPWRITE_TRANSPORT_LIMITS, ...options.limits };
  for (const key of Object.keys(
    APPWRITE_TRANSPORT_LIMITS,
  ) as (keyof Limits)[]) {
    if (
      !Number.isSafeInteger(limits[key]) ||
      limits[key] < 1 ||
      limits[key] > APPWRITE_TRANSPORT_LIMITS[key]
    )
      throw failure("invalid_request");
  }
  if (limits.mutationWindowMs > limits.timeoutMs)
    throw failure("invalid_request");

  const started = performance.now();
  const deadline = started + limits.timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  timer.unref();
  const signal = options.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;
  const agent =
    options.dispatcher ??
    new Agent({
      allowH2: false,
      connections: 2,
      pipelining: 0,
    });
  let closed = false;
  let closing: Promise<void> | undefined;
  let requests = 0;
  let lastStatus: number | null = null;

  function assertActive() {
    if (closed) throw failure("closed");
    if (signal.aborted || performance.now() >= deadline)
      throw failure("deadline");
  }

  function assertTarget(url: URL) {
    if (
      url.origin !== endpoint.origin ||
      !url.pathname.startsWith(`${endpoint.pathname}/`) ||
      url.username !== "" ||
      url.password !== "" ||
      url.hash !== ""
    )
      throw failure("invalid_request");
  }

  const requestDispatcher = (
    policy: AbortController,
    rollback: boolean,
    requestSignal: AbortSignal,
  ) =>
    agent.compose((dispatch) => (input, handler) => {
      assertActive();
      const origin = input.origin?.toString();
      if (origin !== endpoint.origin) throw failure("invalid_request");
      assertTarget(new URL(input.path, origin));
      // Ordinary traffic cannot consume the final rollback dispatch slot.
      if (requests >= limits.maxRequests - (rollback ? 0 : 1))
        throw failure("request_limit");
      requests++;

      let bytes = 0;
      const wrapped: Dispatcher.DispatchHandlers = new DecoratorHandler(
        handler,
      );
      wrapped.onHeaders = (status, headers, resume, statusText) => {
        if (requestSignal.aborted) return false;
        if (status < 200)
          return (
            handler.onHeaders?.(status, headers, resume, statusText) ?? true
          );
        lastStatus = status;
        // Fetch internally retries 421, including JSON writes. Reject it first.
        if ((status >= 300 && status < 400) || status === 421) {
          policy.abort(failure("invalid_response"));
          return false;
        }
        const filtered: Buffer[] = [];
        let json = false;
        for (let index = 0; index < headers.length; index += 2) {
          const name = headers[index];
          const value = headers[index + 1];
          if (!name || !value) {
            policy.abort(failure("invalid_response"));
            return false;
          }
          const key = name.toString().toLowerCase();
          const text = value.toString();
          if (
            (key === "content-encoding" &&
              text.trim().toLowerCase() !== "identity") ||
            (key === "content-length" &&
              (!/^(?:0|[1-9]\d*)$/u.test(text) ||
                Number(text) > limits.maxResponseBytes))
          ) {
            policy.abort(failure("invalid_response"));
            return false;
          }
          if (key === "content-type") {
            json = /^application\/json(?:\s*;|$)/iu.test(text);
            // The SDK checks this header case-sensitively after HTTP validation.
            filtered.push(name, Buffer.from("application/json"));
            continue;
          }
          // The SDK prints this header verbatim. It must never receive it.
          if (key !== "x-appwrite-warning") filtered.push(name, value);
        }
        if (!json) {
          policy.abort(failure("invalid_response"));
          return false;
        }
        return (
          handler.onHeaders?.(status, filtered, resume, statusText) ?? true
        );
      };
      wrapped.onData = (chunk) => {
        if (requestSignal.aborted) return false;
        bytes += chunk.byteLength;
        if (bytes > limits.maxResponseBytes) {
          policy.abort(failure("invalid_response"));
          return false;
        }
        return handler.onData?.(chunk) ?? true;
      };
      wrapped.onComplete = (trailers) => {
        if (!requestSignal.aborted) handler.onComplete?.(trailers);
      };
      // Disable Undici's pipeline retry permission even for GET requests.
      return dispatch({ ...input, idempotent: false }, wrapped);
    });

  class BoundedClient extends Client {
    override prepareRequest(
      method: string,
      url: URL,
      headers: Parameters<Client["prepareRequest"]>[2] = {},
      params: Parameters<Client["prepareRequest"]>[3] = {},
    ): ReturnType<Client["prepareRequest"]> {
      method = method.toUpperCase();
      assertActive();
      assertTarget(url);
      if (
        this.config.selfSigned ||
        this.config.endpoint !== endpoint.href ||
        Object.keys({ ...this.headers, ...headers }).some((name) =>
          ["host", ":authority"].includes(name.toLowerCase()),
        ) ||
        !["GET", "POST", "PATCH"].includes(method) ||
        (method !== "GET" && headers["content-type"] !== "application/json")
      )
        throw failure("invalid_request");
      const rollback =
        method === "PATCH" &&
        /^\/v1\/tablesdb\/transactions\/[A-Za-z0-9._-]+$/u.test(url.pathname) &&
        params.rollback === true &&
        params.commit === undefined;
      if (
        method !== "GET" &&
        !rollback &&
        performance.now() - started >= limits.mutationWindowMs
      )
        throw failure("deadline");
      const prepared = super.prepareRequest(
        method,
        new URL(url),
        headers,
        params,
      );
      const policy = new AbortController();
      prepared.options.redirect = "error";
      const requestSignal = AbortSignal.any([
        signal,
        policy.signal,
        AbortSignal.timeout(limits.requestTimeoutMs),
      ]);
      prepared.options.dispatcher = requestDispatcher(
        policy,
        rollback,
        requestSignal,
      );
      prepared.options.signal = requestSignal;
      prepared.options.headers = {
        ...this.headers,
        ...headers,
        "accept-encoding": "identity",
      };
      return prepared;
    }

    override async call(
      method: string,
      url: URL,
      headers: Parameters<Client["call"]>[2] = {},
      params: Parameters<Client["call"]>[3] = {},
      responseType = "json",
    ): Promise<unknown> {
      if (responseType !== "json") throw failure("invalid_request");
      try {
        const result: unknown = await super.call(
          method,
          url,
          headers,
          params,
          responseType,
        );
        assertActive();
        return result;
      } catch (error) {
        // Keep only finite diagnostic types and the exact row absence type.
        // Raw SDK messages/responses can contain records; no cause is attached.
        const code =
          error instanceof AppwriteException &&
          Number.isInteger(error.code) &&
          error.code >= 400 &&
          error.code <= 599
            ? error.code
            : 0;
        const type =
          code === 404 &&
          error instanceof AppwriteException &&
          error.type === "row_not_found"
            ? "row_not_found"
            : code !== 0 &&
                error instanceof AppwriteException &&
                ERROR_TYPES.has(error.type)
              ? error.type
              : "request_failed";
        throw new AppwriteException("Appwrite request failed.", code, type);
      }
    }

    override redirect(
      ...args: Parameters<Client["redirect"]>
    ): Promise<string> {
      void args;
      return Promise.reject(failure("invalid_request"));
    }
  }

  const client = new BoundedClient().setEndpoint(endpoint.href);
  return {
    client,
    snapshot: () => Object.freeze({ requests, lastStatus, closed }),
    async close() {
      if (closing) return closing;
      closed = true;
      clearTimeout(timer);
      controller.abort();
      closing = agent.destroy();
      await closing;
    },
  };
}
