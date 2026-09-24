import {
  PERSONAL_SEC_QUARTER_ASSESSMENT_LIMITS,
  assertPersonalSecJsonUniqueKeys,
  isPersonalSecQuarterAssessmentRequest,
  isPersonalSecQuarterAssessmentResponse,
  personalSecQuarterBundlePayload,
  type PersonalSecQuarterAssessmentRequestDto,
  type PersonalSecQuarterAssessmentResponseDto,
} from "@research-cockpit/contracts";

import {
  PersonalWorkspaceApiError,
  requestPersonalWorkspace,
} from "./personal-workspace-api";

export const PERSONAL_SEC_QUARTER_ASSESSMENT_PATH =
  "/v1/personal-filing/workspace/sec-quarter-assessment";

export async function fetchPersonalSecQuarterAssessment(
  requested: PersonalSecQuarterAssessmentRequestDto,
  signal: AbortSignal,
): Promise<PersonalSecQuarterAssessmentResponseDto> {
  if (!isPersonalSecQuarterAssessmentRequest(requested))
    throw new PersonalWorkspaceApiError("invalid_request");
  const input = Object.freeze({
    ...requested,
    selection: Object.freeze({ ...requested.selection }),
  });
  signal.throwIfAborted();
  const response = await requestPersonalWorkspace(
    PERSONAL_SEC_QUARTER_ASSESSMENT_PATH,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal,
    },
  );
  signal.throwIfAborted();
  if (!response.ok) throw await responseError(response, signal);
  const value = await readJson(response, signal);
  signal.throwIfAborted();
  if (!isPersonalSecQuarterAssessmentResponse(value, input))
    throw new PersonalWorkspaceApiError("invalid_response");
  if (value.assessment.stage === "assessment") {
    try {
      const payload = personalSecQuarterBundlePayload(
        {
          catalogSnapshotSha256: value.catalogSnapshotSha256,
          security: value.security,
        },
        input.selection,
        value.assessment.sources,
      );
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(payload),
      );
      signal.throwIfAborted();
      const digest = `sha256:${Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      if (digest !== value.assessment.bundleId)
        throw new Error("Source binding mismatch.");
    } catch {
      signal.throwIfAborted();
      throw new PersonalWorkspaceApiError("invalid_response");
    }
  }
  signal.throwIfAborted();
  return freeze(value);
}

async function readJson(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (reader === undefined)
    throw new PersonalWorkspaceApiError("invalid_response");
  const abort = (): void => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    const chunks: string[] = [];
    while (true) {
      const part = await reader.read();
      signal.throwIfAborted();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > PERSONAL_SEC_QUARTER_ASSESSMENT_LIMITS.finalResponseBytes)
        throw new Error();
      chunks.push(decoder.decode(part.value, { stream: true }));
    }
    chunks.push(decoder.decode());
    const text = chunks.join("");
    assertPersonalSecJsonUniqueKeys(text);
    signal.throwIfAborted();
    return JSON.parse(text) as unknown;
  } catch {
    abort();
    signal.throwIfAborted();
    throw new PersonalWorkspaceApiError("invalid_response");
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

async function responseError(
  response: Response,
  signal: AbortSignal,
): Promise<PersonalWorkspaceApiError> {
  if (response.status === 503) {
    try {
      const value = await readJson(response, signal);
      if (
        typeof value === "object" &&
        value !== null &&
        "code" in value &&
        value.code === "not_configured"
      )
        return new PersonalWorkspaceApiError("not_configured");
    } catch {
      signal.throwIfAborted();
    }
  } else {
    void response.body?.cancel().catch(() => undefined);
  }
  const code =
    response.status === 401 || response.status === 403
      ? "session_unavailable"
      : response.status === 400
        ? "invalid_request"
        : response.status === 404
          ? "not_covered"
          : response.status === 409
            ? "conflict"
            : response.status === 429
              ? "rate_limited"
              : response.status === 502
                ? "provider_unavailable"
                : "unavailable";
  return new PersonalWorkspaceApiError(code);
}

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
