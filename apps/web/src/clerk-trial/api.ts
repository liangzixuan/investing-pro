import type { TrialSession } from "./session";

export type TrialEntry = "DEMO_A" | "DEMO_B";
export interface TrialDraft {
  selected: TrialEntry[];
  note: string;
}
export interface TrialWatchlist extends TrialDraft {
  version: number;
}
export interface TrialCommand extends TrialDraft {
  expectedVersion: number;
  idempotencyKey: string;
}
export interface TrialSaved extends TrialWatchlist {
  replayed: boolean;
}
export interface TrialApi {
  load(signal: AbortSignal): Promise<TrialWatchlist>;
  save(command: TrialCommand, signal: AbortSignal): Promise<TrialSaved>;
}

export type TrialErrorCode =
  | "unauthenticated"
  | "access_denied"
  | "origin_denied"
  | "conflict"
  | "idempotency_conflict"
  | "unavailable"
  | "commit_unknown"
  | "invalid_request"
  | "payload_too_large"
  | "unsupported_media_type"
  | "invalid_response"
  | "aborted";
export class TrialApiError extends Error {
  constructor(readonly code: TrialErrorCode) {
    super(code);
  }
}

export function validateApiOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.origin !== value ||
    url.username ||
    url.password
  ) {
    throw new Error("The trial requires its configured HTTPS API origin.");
  }
  return url.origin;
}

export function normalizeDraft(draft: TrialDraft): TrialDraft {
  return {
    selected: (["DEMO_A", "DEMO_B"] as const).filter((entry) =>
      draft.selected.includes(entry),
    ),
    note: draft.selected.includes("DEMO_A")
      ? draft.note.trim().normalize("NFC")
      : "",
  };
}

export function validDraft(value: TrialDraft): boolean {
  return value.note.length <= 1000 && !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value.note);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TrialApiError("invalid_response");
  }
  return value as Record<string, unknown>;
}

function watchlist(
  value: unknown,
  saved: boolean,
): TrialWatchlist | TrialSaved {
  const data = record(value);
  const keys = saved
    ? ["version", "selected", "note", "replayed"]
    : ["version", "selected", "note"];
  if (
    Object.keys(data).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(data, key)) ||
    typeof data.version !== "number" ||
    !Number.isSafeInteger(data.version) ||
    data.version < (saved ? 1 : 0) ||
    !Array.isArray(data.selected) ||
    data.selected.length > 2 ||
    typeof data.note !== "string" ||
    data.selected.some((entry) => entry !== "DEMO_A" && entry !== "DEMO_B") ||
    (saved && typeof data.replayed !== "boolean")
  ) {
    throw new TrialApiError("invalid_response");
  }
  const draft: TrialDraft = {
    selected: data.selected as TrialEntry[],
    note: data.note,
  };
  const normalized = normalizeDraft(draft);
  if (
    !validDraft(draft) ||
    JSON.stringify(normalized) !== JSON.stringify(draft) ||
    (data.version === 0 && (draft.selected.length !== 0 || draft.note !== ""))
  ) {
    throw new TrialApiError("invalid_response");
  }
  return saved
    ? { ...draft, version: data.version, replayed: data.replayed as boolean }
    : { ...draft, version: data.version };
}

async function boundedJson(response: Response): Promise<unknown> {
  if (
    !/^application\/json(?:\s*;|$)/iu.test(
      response.headers.get("content-type") ?? "",
    ) ||
    !response.body
  ) {
    throw new TrialApiError("invalid_response");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 8192) throw new TrialApiError("invalid_response");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  ) as unknown;
}

export function createTrialApi(
  origin: string,
  session: TrialSession,
  fetcher: typeof fetch = fetch,
): TrialApi {
  const endpoint = `${validateApiOrigin(origin)}/v1/trial/watchlist`;
  async function request(
    signal: AbortSignal,
    command?: TrialCommand,
  ): Promise<TrialWatchlist | TrialSaved> {
    const lifetime = new AbortController();
    const abort = () => lifetime.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(abort, 20_000);
    let rejectAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      rejectAbort = () =>
        reject(new TrialApiError(signal.aborted ? "aborted" : "unavailable"));
      lifetime.signal.addEventListener("abort", rejectAbort, { once: true });
      if (lifetime.signal.aborted) rejectAbort();
    });
    try {
      const work = async () => {
        const token = await session.getToken();
        lifetime.signal.throwIfAborted();
        if (!token) throw new TrialApiError("unauthenticated");
        const response = await fetcher(endpoint, {
          method: command ? "POST" : "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(command ? { "Content-Type": "application/json" } : {}),
          },
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: lifetime.signal,
          ...(command ? { body: JSON.stringify(command) } : {}),
        });
        if (response.status === 401 || response.status === 403) {
          await response.body?.cancel();
          throw new TrialApiError(
            response.status === 401 ? "unauthenticated" : "access_denied",
          );
        }
        const data = await boundedJson(response);
        lifetime.signal.throwIfAborted();
        if (!response.ok) {
          const error = record(data).error;
          const allowed: Record<number, readonly string[]> = {
            400: ["invalid_request"],
            409: ["conflict", "idempotency_conflict"],
            413: ["payload_too_large"],
            415: ["unsupported_media_type"],
            503: ["unavailable", "commit_unknown"],
          };
          if (
            typeof error !== "string" ||
            !allowed[response.status]?.includes(error)
          ) {
            throw new TrialApiError("invalid_response");
          }
          throw new TrialApiError(error as TrialErrorCode);
        }
        if (response.status !== 200)
          throw new TrialApiError("invalid_response");
        const parsed = watchlist(data, command !== undefined);
        if (
          command &&
          (parsed.version !== command.expectedVersion + 1 ||
            parsed.note !== command.note ||
            JSON.stringify(parsed.selected) !==
              JSON.stringify(command.selected))
        ) {
          throw new TrialApiError("invalid_response");
        }
        return parsed;
      };
      return await Promise.race([work(), aborted]);
    } catch (error) {
      if (error instanceof TrialApiError) throw error;
      throw new TrialApiError(signal.aborted ? "aborted" : "unavailable");
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (rejectAbort)
        lifetime.signal.removeEventListener("abort", rejectAbort);
      lifetime.abort();
    }
  }
  return {
    load: (signal) => request(signal),
    save: async (command, signal) =>
      (await request(signal, command)) as TrialSaved,
  };
}
