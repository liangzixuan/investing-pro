import {
  MANAGED_SEC_INTERIM_EVIDENCE_LIMITS,
  PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
  parseManagedSecInterimCanonicalRequest,
  serializePersonalSecInterimStatementObservation,
  type PersonalSecInterimCanonicalRequestDto as Request,
  type PersonalSecInterimCanonicalResponseDto as Response,
} from "@research-cockpit/contracts";
import {
  assertPersonalSecInterimCanonicalEvidence,
  interimTemporalContext,
} from "./personal-sec-interim-evidence";
import { serializePersonalSecInterimCanonicalGeneration } from "./personal-sec-interim-serialization";
import {
  check,
  record,
  matches,
  freeze,
} from "./personal-sec-interim-validation";
const ownedResponses = new WeakSet<object>();
const encoder = new TextEncoder();
const identifier = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;

function labelCharacter(character: string): boolean {
  const point = character.codePointAt(0)!;
  if (point < 32) return false;
  if (point >= 0xd800 && point <= 0xdfff) return false;
  return point !== 127;
}
function label(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (!value.length) return false;
  if (value.length > 512) return false;
  if (value.trim() !== value) return false;
  for (const character of value) {
    if (!labelCharacter(character)) return false;
  }
  return true;
}
function matchesRequest(response: Response, request: Request): boolean {
  if (response.catalogSnapshotSha256 !== request.catalogSnapshotSha256)
    return false;
  if (response.security.listingId !== request.listingId) return false;
  return response.security.symbol === request.symbol;
}
function assertResponse(value: unknown): asserts value is Response {
  const response = record(value, [
    "schemaVersion",
    "catalogSnapshotSha256",
    "security",
    "evidence",
  ]);
  check(
    response.schemaVersion === PERSONAL_SEC_INTERIM_CANONICAL_VERSION &&
      matches(response.catalogSnapshotSha256, /^sha256:[a-f0-9]{64}$/u),
  );
  const security = record(response.security, [
    "country",
    "exchangeMic",
    "issuerId",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
    "cik",
  ]);
  check(
    security.country === "US" &&
      matches(security.exchangeMic, /^[A-Z0-9]{4}$/u),
  );
  check(
    matches(security.issuerId, identifier) &&
      matches(security.listingId, identifier),
  );
  check(label(security.issuerName) && label(security.securityName));
  check(matches(security.symbol, /^[A-Z0-9][A-Z0-9.-]{0,14}$/u));
  check(matches(security.cik, /^(?!0000000000)[0-9]{10}$/u));
  assertPersonalSecInterimCanonicalEvidence(response.evidence);
  check(
    response.evidence.cik === security.cik &&
      interimTemporalContext(response.evidence),
  );
}
async function hash(value: string, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  signal.throwIfAborted();
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
async function hashesMatch(
  response: Response,
  signal: AbortSignal,
): Promise<boolean> {
  const rows = response.evidence.facts.observations;
  for (let offset = 0; offset < rows.length; offset += 32) {
    signal.throwIfAborted();
    const checks = await Promise.all(
      rows
        .slice(offset, offset + 32)
        .map(
          async (row) =>
            row.id ===
            `sec-interim-fact:${await hash(serializePersonalSecInterimStatementObservation(row), signal)}`,
        ),
    );
    signal.throwIfAborted();
    if (checks.some((valid) => !valid)) return false;
  }
  const expected = await hash(
    serializePersonalSecInterimCanonicalGeneration(response.evidence),
    signal,
  );
  return response.evidence.generation.sha256 === `sha256:${expected}`;
}
export function isOwnedPersonalSecInterimCanonicalResponse(
  value: unknown,
): value is Response {
  return (
    value !== null && typeof value === "object" && ownedResponses.has(value)
  );
}
/** Own a closed, bounded, hash-verified packet within the caller's active lifetime. */
export async function parsePersonalSecInterimCanonicalResponse(
  value: unknown,
  capturedRequest: Request,
  signal: AbortSignal,
): Promise<Response | null> {
  signal.throwIfAborted();
  try {
    const requested = parseManagedSecInterimCanonicalRequest(capturedRequest);
    if (!requested) return null;
    assertResponse(value);
    if (!matchesRequest(value, requested)) return null;
    const owned = structuredClone(value);
    if (
      encoder.encode(JSON.stringify(owned)).byteLength >
      MANAGED_SEC_INTERIM_EVIDENCE_LIMITS.responseBytes
    )
      return null;
    if (!(await hashesMatch(owned, signal))) return null;
    signal.throwIfAborted();
    const result = freeze(owned);
    ownedResponses.add(result);
    return result;
  } catch {
    signal.throwIfAborted();
    return null;
  }
}
