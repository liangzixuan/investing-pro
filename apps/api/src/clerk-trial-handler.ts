import { isClerkTrialOrigin, type ClerkTrialAuth } from "./clerk-trial-auth";
import {
  fromClerkTrialPayload,
  toClerkTrialPayload,
} from "./clerk-trial-catalog";
import {
  WatchlistRepositoryError,
  type MainWatchlistReceipt,
  type MainWatchlistRecord,
  type MainWatchlistRepository,
  type PutMainWatchlistCommand,
  type WatchlistRepositoryErrorCode,
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

function allowsMethod(method: string, path: string) {
  return method === "GET" || (method === "POST" && path === PATHS[1]);
}

function admitRoute(request: Request) {
  const url = new URL(request.url);
  if (
    !PATHS.includes(url.pathname) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new RequestFailure(404, "not_found");
  if (
    request.method !== "OPTIONS" &&
    !allowsMethod(request.method, url.pathname)
  )
    throw new RequestFailure(405, "method_not_allowed");
  return url.pathname;
}

function preflightResponse(request: Request, path: string, headers: Headers) {
  const method = request.headers.get("access-control-request-method");
  const requested = (
    request.headers.get("access-control-request-headers") ?? ""
  )
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (
    !method ||
    !allowsMethod(method, path) ||
    requested.some(
      (entry) => !["authorization", "content-type"].includes(entry),
    )
  )
    throw new RequestFailure(403, "origin_denied");
  headers.set(
    "access-control-allow-methods",
    path === PATHS[0] ? "GET" : "GET, POST",
  );
  headers.set("access-control-allow-headers", "Authorization, Content-Type");
  headers.set(
    "vary",
    "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
  );
  return new Response(null, { status: 204, headers });
}

function readResult(record: MainWatchlistRecord | null) {
  if (
    record !== null &&
    (record.id !== "main" ||
      !Number.isSafeInteger(record.version) ||
      record.version < 1)
  )
    throw new WatchlistRepositoryError("invalid_response");
  return record === null
    ? { version: 0, selected: [], note: "" }
    : { version: record.version, ...fromClerkTrialPayload(record.payload) };
}

function writeResult(
  receipt: MainWatchlistReceipt,
  command: PutMainWatchlistCommand,
) {
  if (
    receipt.id !== "main" ||
    !Number.isSafeInteger(receipt.version) ||
    receipt.version !== command.expectedVersion + 1 ||
    typeof receipt.replayed !== "boolean"
  )
    throw new WatchlistRepositoryError("commit_unknown");
  return {
    version: receipt.version,
    ...fromClerkTrialPayload(command.payload),
    replayed: receipt.replayed,
  };
}

function repositoryErrorStatus(code: WatchlistRepositoryErrorCode) {
  switch (code) {
    case "invalid_request":
      return 400;
    case "access_denied":
      return 403;
    case "conflict":
    case "idempotency_conflict":
      return 409;
    default:
      return 503;
  }
}

function unavailableResponse(writeStarted: boolean, headers: Headers) {
  return new Response(
    JSON.stringify({ error: writeStarted ? "commit_unknown" : "unavailable" }),
    { status: 503, headers },
  );
}

function errorResponse(
  error: unknown,
  writeStarted: boolean,
  headers: Headers,
) {
  if (error instanceof RequestFailure)
    return new Response(JSON.stringify({ error: error.code }), {
      status: error.status,
      headers,
    });
  if (!(error instanceof WatchlistRepositoryError))
    return unavailableResponse(writeStarted, headers);
  if (error.code === "invalid_response")
    return unavailableResponse(writeStarted, headers);
  return new Response(JSON.stringify({ error: error.code }), {
    status: repositoryErrorStatus(error.code),
    headers,
  });
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
      const path = admitRoute(request);
      if (request.method === "OPTIONS")
        return preflightResponse(request, path, headers);
      const auth = await authenticate(request);
      if (auth.status !== "allowed")
        return respond(auth.status === "access_denied" ? 403 : 401, {
          error: auth.status,
        });
      if (request.signal.aborted)
        throw new RequestFailure(408, "request_timeout");
      if (path === PATHS[0])
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
        response = respond(200, writeResult(receipt, command));
      } else {
        const record = await operation.repository.get(auth.principal);
        response = respond(200, readResult(record));
      }
    } catch (error) {
      response = errorResponse(error, writeStarted, headers);
    } finally {
      if (operation) {
        try {
          await operation.close();
        } catch {
          response = unavailableResponse(writeStarted, headers);
        }
      }
    }
    return response;
  };
}
