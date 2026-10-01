import {
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  parseManagedSecAnnualEvidenceRequest,
  type PersonalSecAnnualEvidenceRequestDto,
  type PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import {
  PersonalWorkspaceApiError,
  requestPersonalWorkspace,
} from "./personal-workspace-api";
import { parseSecAnnualEvidenceResponse } from "./sec-annual-evidence-response";

export const PERSONAL_SEC_ANNUAL_EVIDENCE_PATH =
  "/v1/personal-filing/workspace/sec-annual-evidence";
const maxBrowserResponseBytes =
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes;

export async function fetchPersonalSecAnnualEvidence(
  input: PersonalSecAnnualEvidenceRequestDto,
  signal: AbortSignal,
): Promise<PersonalSecAnnualEvidenceResponseDto> {
  const requested = parseManagedSecAnnualEvidenceRequest(input);
  if (requested === null)
    throw new PersonalWorkspaceApiError("invalid_request");
  signal.throwIfAborted();
  const response = await requestPersonalWorkspace(
    PERSONAL_SEC_ANNUAL_EVIDENCE_PATH,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requested),
      signal,
    },
  );
  if (!response.ok) throw await responseError(response, signal);
  const value = await readJson(response, signal);
  const parsed = await parseSecAnnualEvidenceResponse(value, requested, signal);
  if (parsed === null) throw new PersonalWorkspaceApiError("invalid_response");
  return parsed;
}

async function readJson(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new PersonalWorkspaceApiError("invalid_response");
  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    signal.throwIfAborted();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const chunks: string[] = [];
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBrowserResponseBytes)
        throw new PersonalWorkspaceApiError("invalid_response");
      chunks.push(decoder.decode(chunk.value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return JSON.parse(chunks.join("")) as unknown;
  } catch {
    void reader.cancel().catch(() => undefined);
    signal.throwIfAborted();
    throw new PersonalWorkspaceApiError("invalid_response");
  } finally {
    signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

async function responseError(
  response: Response,
  signal: AbortSignal,
): Promise<PersonalWorkspaceApiError> {
  if (response.status === 401 || response.status === 403)
    return new PersonalWorkspaceApiError("session_unavailable");
  if (response.status === 400)
    return new PersonalWorkspaceApiError("invalid_request");
  if (response.status === 409) return new PersonalWorkspaceApiError("conflict");
  if (response.status === 404)
    return new PersonalWorkspaceApiError("not_covered");
  if (response.status === 429)
    return new PersonalWorkspaceApiError("rate_limited");
  if (response.status === 502)
    return new PersonalWorkspaceApiError("provider_unavailable");
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
  }
  return new PersonalWorkspaceApiError("unavailable");
}
