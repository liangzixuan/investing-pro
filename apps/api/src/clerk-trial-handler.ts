import { isClerkTrialOrigin, type ClerkTrialAuth } from "./clerk-trial-auth";
import {
  fromClerkTrialPayload,
  toClerkTrialPayload,
} from "./clerk-trial-catalog";
import {
  WatchlistRepositoryError,
  type MainWatchlistRepository,
} from "./watchlist-repository";

export interface ClerkTrialRepositoryOperation {
  readonly repository: MainWatchlistRepository;
  close(): Promise<void>;
}
export interface ClerkTrialHandlerOptions {
  readonly auth: ClerkTrialAuth;
  readonly allowedOrigins: readonly string[];
  readonly openRepository: () => Promise<ClerkTrialRepositoryOperation>;
}
const BODY_LIMIT = 8192;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const PATHS = ["/v1/trial/session", "/v1/trial/watchlist"];

class RequestFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function readCommand(request: Request) {
  if (
    !/^application\/json(?:;\s*charset=utf-8)?$/iu.test(
      request.headers.get("content-type") ?? "",
    ) ||
    request.headers.has("content-encoding")
  )
    throw new RequestFailure(415, "unsupported_media_type");
  const length = request.headers.get("content-length");
  if (
    length !== null &&
    (!/^(0|[1-9][0-9]*)$/u.test(length) || Number(length) > BODY_LIMIT)
  )
    throw new RequestFailure(413, "payload_too_large");
  if (!request.body) throw new RequestFailure(400, "invalid_request");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new RequestFailure(408, "request_timeout")),
      2000,
    );
  });
  try {
    while (true) {
      const item = await Promise.race([reader.read(), deadline]);
      if (item.done) break;
      size += item.value.byteLength;
      if (size > BODY_LIMIT) throw new RequestFailure(413, "payload_too_large");
      chunks.push(item.value);
    }
    const body: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    );
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).sort().join(",") !==
        "expectedVersion,idempotencyKey,note,selected"
    )
      throw new RequestFailure(400, "invalid_request");
    const command = body as Record<string, unknown>;
    if (
      typeof command.expectedVersion !== "number" ||
      !Number.isSafeInteger(command.expectedVersion) ||
      command.expectedVersion < 0 ||
      command.expectedVersion >= Number.MAX_SAFE_INTEGER ||
      typeof command.idempotencyKey !== "string" ||
      !KEY.test(command.idempotencyKey)
    )
      throw new RequestFailure(400, "invalid_request");
    return {
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      payload: toClerkTrialPayload(command.selected, command.note),
    };
  } catch (error) {
    if (
      error instanceof RequestFailure ||
      error instanceof WatchlistRepositoryError
    )
      throw error;
    throw new RequestFailure(400, "invalid_request");
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Cloud-only request boundary. Local owner session routes remain unchanged. */
export function createClerkTrialHandler(options: ClerkTrialHandlerOptions) {
  if (
    options.allowedOrigins.length < 1 ||
    options.allowedOrigins.length > 8 ||
    !options.allowedOrigins.every(isClerkTrialOrigin) ||
    new Set(options.allowedOrigins).size !== options.allowedOrigins.length
  )
    throw new Error("Invalid trial origins");
  const origins = new Set(options.allowedOrigins);
  const { auth: authenticate, openRepository } = options;
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const originAllowed = origin !== null && origins.has(origin);
    const headers = new Headers({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      vary: "Origin",
    });
    if (originAllowed) headers.set("access-control-allow-origin", origin);
    const respond = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), { status, headers });
    if (!originAllowed) return respond(403, { error: "origin_denied" });
    let operation: ClerkTrialRepositoryOperation | undefined;
    let writeStarted = false;
    let response: Response;
    try {
      const url = new URL(request.url);
      if (
        !PATHS.includes(url.pathname) ||
        url.search ||
        url.hash ||
        url.username ||
        url.password
      )
        return respond(404, { error: "not_found" });
      if (request.method === "OPTIONS") {
        const method = request.headers.get("access-control-request-method");
        const requested = (
          request.headers.get("access-control-request-headers") ?? ""
        )
          .split(",")
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean);
        if (
          !method ||
          !(
            method === "GET" ||
            (method === "POST" && url.pathname === PATHS[1])
          ) ||
          requested.some(
            (entry) => !["authorization", "content-type"].includes(entry),
          )
        )
          return respond(403, { error: "origin_denied" });
        headers.set(
          "access-control-allow-methods",
          url.pathname === PATHS[0] ? "GET" : "GET, POST",
        );
        headers.set(
          "access-control-allow-headers",
          "Authorization, Content-Type",
        );
        headers.set(
          "vary",
          "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
        );
        return new Response(null, { status: 204, headers });
      }
      if (!(
        request.method === "GET" ||
        (request.method === "POST" && url.pathname === PATHS[1])
      ))
        return respond(405, { error: "method_not_allowed" });
      const auth = await authenticate(request);
      if (auth.status !== "allowed")
        return respond(auth.status === "access_denied" ? 403 : 401, {
          error: auth.status,
        });
      if (request.signal.aborted)
        throw new RequestFailure(408, "request_timeout");
      if (url.pathname === PATHS[0])
        return respond(200, { signedIn: true, allowed: true });
      const command =
        request.method === "POST" ? await readCommand(request) : undefined;
      if (request.signal.aborted)
        throw new RequestFailure(408, "request_timeout");
      operation = await openRepository();
      if (request.signal.aborted)
        throw new RequestFailure(408, "request_timeout");
      if (command) {
        writeStarted = true;
        const receipt = await operation.repository.put(auth.principal, command);
        if (
          receipt.id !== "main" ||
          !Number.isSafeInteger(receipt.version) ||
          receipt.version !== command.expectedVersion + 1 ||
          typeof receipt.replayed !== "boolean"
        )
          throw new WatchlistRepositoryError("commit_unknown");
        response = respond(200, {
          version: receipt.version,
          ...fromClerkTrialPayload(command.payload),
          replayed: receipt.replayed,
        });
      } else {
        const record = await operation.repository.get(auth.principal);
        if (
          record !== null &&
          (record.id !== "main" ||
            !Number.isSafeInteger(record.version) ||
            record.version < 1)
        )
          throw new WatchlistRepositoryError("invalid_response");
        response = respond(
          200,
          record === null
            ? { version: 0, selected: [], note: "" }
            : {
                version: record.version,
                ...fromClerkTrialPayload(record.payload),
              },
        );
      }
    } catch (error) {
      if (error instanceof RequestFailure)
        response = respond(error.status, { error: error.code });
      else if (error instanceof WatchlistRepositoryError) {
        const code =
          error.code === "invalid_response"
            ? writeStarted
              ? "commit_unknown"
              : "unavailable"
            : error.code;
        const status =
          code === "invalid_request"
            ? 400
            : code === "access_denied"
              ? 403
              : ["conflict", "idempotency_conflict"].includes(code)
                ? 409
                : 503;
        response = respond(status, { error: code });
      } else
        response = respond(503, {
          error: writeStarted ? "commit_unknown" : "unavailable",
        });
    } finally {
      if (operation) {
        try {
          await operation.close();
        } catch {
          response = respond(503, {
            error: writeStarted ? "commit_unknown" : "unavailable",
          });
        }
      }
    }
    return response;
  };
}
