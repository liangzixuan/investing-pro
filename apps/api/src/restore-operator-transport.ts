import assert from "node:assert/strict";
import { AppwriteException, Client } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { Agent, DecoratorHandler, File, type Dispatcher } from "undici";

export const RESTORE_OPERATOR_TRANSPORT_LIMITS = Object.freeze({
  timeoutMs: 20 * 60_000,
  requestTimeoutMs: 20_000,
  maxSteps: 89,
  maxResponseBytes: 1_048_576,
  closeTimeoutMs: 1000,
});
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;
const MAX_JSON_BYTES = 64 * 1024;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/u;
type Limits = {
  readonly [K in keyof typeof RESTORE_OPERATOR_TRANSPORT_LIMITS]: number;
};
type Failure =
  | "invalid_configuration"
  | "invalid_step"
  | "invalid_request"
  | "invalid_response"
  | "step_failed"
  | "request_failed"
  | "step_limit"
  | "deadline"
  | "closed"
  | "cleanup_failed";
type Absence = "database_not_found" | "function_not_found";

export class RestoreOperatorTransportError extends Error {
  constructor(
    readonly reason: Failure,
    readonly status: number | null = null,
    readonly absence: Absence | null = null,
  ) {
    super("Restore operator transport stopped.");
  }
}
export interface RestoreOperatorStep {
  readonly method: "GET" | "POST" | "PATCH";
  readonly path: string;
}
interface Options {
  readonly endpoint: string;
  readonly projectId: string;
  readonly key: string;
  readonly signal?: AbortSignal;
  /** This transport owns the supplied dispatcher and closes it. Tests disable networking. */
  readonly dispatcher?: Dispatcher;
  /** Trusted test bounds may only reduce the fixed ceilings. */
  readonly limits?: Partial<Limits>;
}
interface Lease extends RestoreOperatorStep {
  deadlineAt: number;
  active: boolean;
  calls: number;
  prepares: number;
  dispatches: number;
  upload: boolean;
  settled: boolean;
  failure?: RestoreOperatorTransportError;
}
type Headers = Parameters<Client["prepareRequest"]>[2];
type Payload = Parameters<Client["prepareRequest"]>[3];

function configuration(options: Options) {
  try {
    const endpoint = new URL(options.endpoint);
    assert.equal(endpoint.protocol, "https:");
    assert.equal(endpoint.pathname, "/v1");
    assert.equal(
      endpoint.username + endpoint.password + endpoint.search + endpoint.hash,
      "",
    );
    assert.match(options.projectId, ID);
    assert.equal(typeof options.key, "string");
    assert.ok(options.key.trim().length > 0);
    assert.ok(options.key.length <= 8192);
    assert.doesNotMatch(options.key, /[\r\n]/u);
    if (options.signal !== undefined)
      assert.ok(options.signal instanceof AbortSignal);
    const limits = { ...RESTORE_OPERATOR_TRANSPORT_LIMITS, ...options.limits };
    assert.deepEqual(
      Object.keys(limits).sort(),
      Object.keys(RESTORE_OPERATOR_TRANSPORT_LIMITS).sort(),
    );
    for (const name of Object.keys(
      RESTORE_OPERATOR_TRANSPORT_LIMITS,
    ) as (keyof Limits)[]) {
      assert.ok(Number.isSafeInteger(limits[name]));
      assert.ok(limits[name] > 0);
      assert.ok(limits[name] <= RESTORE_OPERATOR_TRANSPORT_LIMITS[name]);
    }
    return {
      endpoint: endpoint.href,
      origin: endpoint.origin,
      projectId: options.projectId,
      key: options.key,
      limits: Object.freeze(limits),
      signal: options.signal,
      dispatcher: options.dispatcher,
    };
  } catch {
    throw new RestoreOperatorTransportError("invalid_configuration");
  }
}
function admittedStep(value: RestoreOperatorStep): RestoreOperatorStep {
  assert.ok(["GET", "POST", "PATCH"].includes(value.method));
  assert.match(value.path, /^\/v1\/[A-Za-z0-9._/-]+$/u);
  assert.ok(
    !value.path.split("/").some((part) => part === ".." || part === "."),
  );
  assert.ok(!value.path.includes("//"));
  assert.ok(value.path.length <= 512);
  return Object.freeze({ method: value.method, path: value.path });
}
function requestHeaders(headers: Headers, projectId: string) {
  const names = Object.keys(headers ?? {}).map((name) => name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
  assert.ok(
    names.every((name) =>
      ["x-appwrite-project", "content-type", "accept"].includes(name),
    ),
  );
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (name.toLowerCase() === "x-appwrite-project")
      assert.equal(value, projectId);
  }
}
function bufferUpload(payload: Payload) {
  assert.ok(payload);
  assert.ok(
    Object.keys(payload).every((name) =>
      ["code", "activate", "entrypoint", "commands"].includes(name),
    ),
  );
  assert.equal(typeof payload.activate, "boolean");
  for (const name of ["entrypoint", "commands"]) {
    const value: unknown = payload[name];
    if (value !== undefined) {
      assert.ok(typeof value === "string");
      assert.ok(Buffer.byteLength(value) <= 4096);
    }
  }
  const file: unknown = payload.code;
  assert.ok(file instanceof InputFile);
  // SDK29's own buffer discriminator lets us refuse fromPath before size()/toFile() can read a file.
  const source: unknown = Object.getOwnPropertyDescriptor(
    file,
    "source",
  )?.value;
  assert.ok(source !== null && typeof source === "object");
  const kind: unknown = Object.getOwnPropertyDescriptor(source, "type")?.value;
  const data: unknown = Object.getOwnPropertyDescriptor(source, "data")?.value;
  assert.equal(kind, "buffer");
  assert.ok(data instanceof Uint8Array);
  assert.ok(data.byteLength > 0 && data.byteLength <= MAX_UPLOAD_BYTES);
  const filename: unknown = Object.getOwnPropertyDescriptor(
    file,
    "filename",
  )?.value;
  assert.ok(typeof filename === "string");
  assert.match(filename, /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u);
  assert.equal(Client.CHUNK_SIZE, 5 * 1024 * 1024);
  return {
    ...payload,
    code: InputFile.fromBuffer(Buffer.from(data), filename),
  };
}
function errorProjection(
  error: unknown,
  lease: Lease,
): RestoreOperatorTransportError {
  if (error instanceof RestoreOperatorTransportError) return error;
  if (!(error instanceof AppwriteException)) {
    return new RestoreOperatorTransportError("step_failed");
  }
  const status =
    Number.isInteger(error.code) && error.code >= 400 && error.code <= 599
      ? error.code
      : null;
  let absence: Absence | null = null;
  if (status === 404 && lease.method === "GET") {
    if (
      /^\/v1\/tablesdb\/[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/u.test(lease.path) &&
      error.type === "database_not_found"
    )
      absence = "database_not_found";
    if (
      /^\/v1\/functions\/[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/u.test(lease.path) &&
      error.type === "function_not_found"
    )
      absence = "function_not_found";
  }
  return new RestoreOperatorTransportError("request_failed", status, absence);
}
function wireBody(input: Dispatcher.DispatchOptions) {
  // SDK29 fetch supplies a plain header map and calculates FormData length before dispatch.
  assert.ok(input.headers && !Array.isArray(input.headers));
  const headers = input.headers as Record<string, unknown>;
  const pairs = Object.entries(headers).map(
    ([name, value]) => [name.toLowerCase(), String(value)] as const,
  );
  const type = pairs.find(([name]) => name === "content-type")?.[1] ?? "";
  const length = pairs.find(([name]) => name === "content-length")?.[1];
  if (input.method === "GET") {
    assert.ok(input.body === null || input.body === undefined);
    return;
  }
  assert.ok(length !== undefined && /^(?:0|[1-9]\d*)$/u.test(length));
  if (type.startsWith("multipart/form-data")) {
    assert.match(type, /^multipart\/form-data; boundary=[A-Za-z0-9-]{1,128}$/u);
    assert.ok(Number(length) <= MAX_MULTIPART_BYTES);
  } else {
    assert.equal(type, "application/json");
    assert.ok(Number(length) <= MAX_JSON_BYTES);
  }
}

/** Bounded mechanics only. The controller supplies exact resources, approval and response validation.
 * A trusted callback may explicitly admit an exact database/function absence error.
 * Every other failed step seals the lifetime. File bytes are capped at 2 MiB;
 * the separately counted encoded multipart body allows 64 KiB of fixed overhead.
 */
export function createRestoreOperatorTransport(options: Options) {
  const config = configuration(options);
  if (config.signal?.aborted)
    throw new RestoreOperatorTransportError("deadline");
  const controller = new AbortController();
  const signal = config.signal
    ? AbortSignal.any([controller.signal, config.signal])
    : controller.signal;
  const agent =
    config.dispatcher ??
    new Agent({ allowH2: false, connections: 1, pipelining: 0 });
  const started = performance.now();
  let active: Lease | undefined,
    steps = 0,
    requests = 0,
    lastStatus: number | null = null;
  let sealed: Failure | undefined,
    closing: Promise<void> | undefined,
    closed = false;
  const seal = (reason: Failure) => {
    sealed ??= reason;
    // A dispatcher may reject synchronously while SDK fetch initializes its controller.
    // Seal admission immediately, then abort after that initialization stack returns.
    queueMicrotask(() => controller.abort());
  };
  const timer = setTimeout(() => seal("deadline"), config.limits.timeoutMs);
  timer.unref();
  function check(lease: Lease) {
    if (closing || closed) throw new RestoreOperatorTransportError("closed");
    const now = performance.now();
    if (
      !Number.isFinite(now) ||
      now < started ||
      signal.aborted ||
      now - started >= config.limits.timeoutMs ||
      now >= lease.deadlineAt
    )
      throw new RestoreOperatorTransportError(sealed ?? "deadline");
    if (sealed) throw new RestoreOperatorTransportError(sealed);
    assert.equal(active, lease);
    assert.equal(lease.active, true);
  }
  function target(lease: Lease, method: string, url: URL) {
    check(lease);
    assert.equal(method.toUpperCase(), lease.method);
    assert.equal(url.origin, config.origin);
    assert.equal(url.pathname, lease.path);
    assert.equal(url.username + url.password + url.hash, "");
    assert.ok(url.href.length <= 8192);
  }
  function responseHandler(handler: Dispatcher.DispatchHandlers) {
    let bytes = 0;
    const wrapped: Dispatcher.DispatchHandlers = new DecoratorHandler(handler);
    wrapped.onHeaders = (status, headers, resume, statusText) => {
      if (signal.aborted) return false;
      if (status < 200)
        return handler.onHeaders?.(status, headers, resume, statusText) ?? true;
      lastStatus = status;
      try {
        assert.ok(Number.isInteger(status) && status <= 599);
        assert.ok(status < 300 || status >= 400);
        assert.notEqual(status, 421);
        const filtered: Buffer[] = [];
        let json = false;
        for (let index = 0; index < headers.length; index += 2) {
          const name = headers[index]!,
            value = headers[index + 1]!;
          assert.ok(name && value);
          const key = name.toString().toLowerCase(),
            text = value.toString();
          if (key === "content-encoding")
            assert.equal(text.trim().toLowerCase(), "identity");
          if (key === "content-length") {
            assert.match(text, /^(?:0|[1-9]\d*)$/u);
            assert.ok(Number(text) <= config.limits.maxResponseBytes);
          }
          if (key === "content-type") {
            json = /^application\/json(?:\s*;|$)/iu.test(text);
            filtered.push(name, Buffer.from("application/json"));
          } else if (key !== "x-appwrite-warning") filtered.push(name, value);
        }
        assert.ok(json);
        return (
          handler.onHeaders?.(status, filtered, resume, statusText) ?? true
        );
      } catch {
        seal("invalid_response");
        return false;
      }
    };
    wrapped.onData = (chunk) => {
      if (signal.aborted) return false;
      bytes += chunk.byteLength;
      if (bytes > config.limits.maxResponseBytes) {
        seal("invalid_response");
        return false;
      }
      return handler.onData?.(chunk) ?? true;
    };
    wrapped.onComplete = (trailers) => {
      if (!signal.aborted) handler.onComplete?.(trailers);
    };
    return wrapped;
  }
  function clientFor(lease: Lease) {
    const dispatcher = agent.compose((dispatch) => (input, handler) => {
      try {
        target(
          lease,
          input.method,
          new URL(input.path, input.origin?.toString()),
        );
        assert.equal(lease.dispatches, 0);
        assert.ok(requests < config.limits.maxSteps);
        wireBody(input);
        lease.dispatches++;
        requests++;
        return dispatch(
          { ...input, idempotent: false },
          responseHandler(handler),
        );
      } catch {
        seal("invalid_request");
        throw new RestoreOperatorTransportError("invalid_request");
      }
    });
    class OperatorClient extends Client {
      override prepareRequest(
        method: string,
        url: URL,
        headers: Headers = {},
        params: Payload = {},
      ) {
        target(lease, method, url);
        assert.equal(lease.prepares++, 0);
        requestHeaders(headers, config.projectId);
        if (headers["content-type"] === "multipart/form-data") {
          assert.equal(lease.upload, true);
          assert.ok(params.code instanceof File);
        }
        const prepared = super.prepareRequest(
          method,
          new URL(url),
          headers,
          params,
        );
        target(lease, method, new URL(prepared.uri));
        if (typeof prepared.options.body === "string")
          assert.ok(Buffer.byteLength(prepared.options.body) <= MAX_JSON_BYTES);
        prepared.options.headers = {
          ...(prepared.options.headers as Record<string, string>),
          "accept-encoding": "identity",
        };
        prepared.options.redirect = "error";
        prepared.options.dispatcher = dispatcher;
        prepared.options.signal = signal;
        return prepared;
      }
      override async chunkedUpload(
        method: string,
        url: URL,
        headers: Headers = {},
        payload: Payload = {},
        onProgress: Parameters<Client["chunkedUpload"]>[4],
      ) {
        check(lease);
        assert.equal(method.toUpperCase(), "POST");
        assert.equal(headers["content-type"], "multipart/form-data");
        assert.equal(lease.upload, false);
        lease.upload = true;
        assert.equal(onProgress, undefined);
        const result: unknown = await super.chunkedUpload(
          method,
          url,
          headers,
          bufferUpload(payload),
          onProgress,
        );
        return result;
      }
      override async call(
        method: string,
        url: URL,
        headers: Headers = {},
        params: Payload = {},
        responseType = "json",
      ): Promise<unknown> {
        try {
          check(lease);
          assert.equal(lease.calls++, 0);
          assert.equal(responseType, "json");
          const result: unknown = await super.call(
            method,
            url,
            headers,
            params,
            responseType,
          );
          check(lease);
          return result;
        } catch (error) {
          const safe = errorProjection(error, lease);
          if (safe.absence === null) {
            lease.failure ??= safe;
            seal(safe.reason);
          }
          throw safe;
        } finally {
          lease.settled = true;
        }
      }
      override redirect(
        ...args: Parameters<Client["redirect"]>
      ): Promise<string> {
        void args;
        seal("invalid_request");
        return Promise.reject(
          new RestoreOperatorTransportError("invalid_request"),
        );
      }
    }
    const client = new OperatorClient()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId)
      .setKey(config.key);
    Object.freeze(client.config);
    Object.freeze(client.headers);
    Object.freeze(client);
    return client;
  }
  return {
    async runStep<T>(
      step: RestoreOperatorStep,
      action: (client: Client) => Promise<T>,
    ): Promise<T> {
      let lease: Lease | undefined;
      let stepTimer: ReturnType<typeof setTimeout> | undefined;
      let onAbort: (() => void) | undefined;
      try {
        if (active) throw new RestoreOperatorTransportError("invalid_step");
        if (sealed || signal.aborted)
          throw new RestoreOperatorTransportError(sealed ?? "deadline");
        if (closing || closed)
          throw new RestoreOperatorTransportError("closed");
        if (steps >= config.limits.maxSteps)
          throw new RestoreOperatorTransportError("step_limit");
        lease = {
          ...admittedStep(step),
          deadlineAt: performance.now() + config.limits.requestTimeoutMs,
          active: true,
          calls: 0,
          prepares: 0,
          dispatches: 0,
          upload: false,
          settled: false,
        };
        active = lease;
        steps++;
        const client = clientFor(lease);
        stepTimer = setTimeout(
          () => seal("deadline"),
          config.limits.requestTimeoutMs,
        );
        const aborted = new Promise<never>((_resolve, reject) => {
          onAbort = () =>
            reject(
              lease?.failure ??
                new RestoreOperatorTransportError(sealed ?? "deadline"),
            );
          signal.addEventListener("abort", onAbort, { once: true });
        });
        const result = await Promise.race([
          Promise.resolve().then(() => action(client)),
          aborted,
        ]);
        check(lease);
        assert.equal(lease.calls, 1);
        assert.equal(lease.prepares, 1);
        assert.equal(lease.dispatches, 1);
        assert.equal(lease.settled, true);
        assert.ok(!(result instanceof Client));
        return result;
      } catch (error) {
        const safe = lease
          ? errorProjection(error, lease)
          : new RestoreOperatorTransportError(
              error instanceof RestoreOperatorTransportError
                ? error.reason
                : "invalid_step",
            );
        seal(safe.reason);
        throw safe;
      } finally {
        clearTimeout(stepTimer);
        if (onAbort) signal.removeEventListener("abort", onAbort);
        if (lease) {
          lease.active = false;
          if (active === lease) active = undefined;
        }
      }
    },
    snapshot: () =>
      Object.freeze({
        steps,
        requests,
        lastStatus,
        sealed: sealed !== undefined,
        closed,
        activeStep: active !== undefined,
      }),
    close() {
      if (closing) return closing;
      clearTimeout(timer);
      seal("closed");
      let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_resolve, reject) => {
        cleanupTimer = setTimeout(
          () => reject(new RestoreOperatorTransportError("cleanup_failed")),
          config.limits.closeTimeoutMs,
        );
      });
      closing = Promise.race([
        Promise.resolve().then(() => agent.destroy()),
        timeout,
      ])
        .then(
          () => {
            closed = true;
          },
          () => {
            throw new RestoreOperatorTransportError("cleanup_failed");
          },
        )
        .finally(() => clearTimeout(cleanupTimer));
      return closing;
    },
  };
}
