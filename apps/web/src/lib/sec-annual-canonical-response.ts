import {
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
  parseManagedSecAnnualCanonicalRequest,
  serializePersonalSecAnnualStatementObservation,
  type PersonalSecAnnualCanonicalEvidenceDto,
  type PersonalSecAnnualCanonicalRequestDto,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import {
  assertPersonalSecAnnualCanonicalEvidence,
  serializePersonalSecAnnualCanonicalGeneration,
} from "@research-cockpit/personal-financial-analytics";
import { matches, text } from "./sec-annual-response-validation";

const identifier = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const symbol = /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;
const digest = /^sha256:[a-f0-9]{64}$/u;
const cik = /^(?!0000000000)[0-9]{10}$/u;
const hashBatchSize = 32;
const encoder = new TextEncoder();
const ownedResponses = new WeakSet<object>();

/** Reuse only this decoder's immutable hash-validated result; reads no fields. */
export function isOwnedSecAnnualCanonicalResponse(
  value: unknown,
): value is PersonalSecAnnualCanonicalResponseDto {
  return (
    value !== null && typeof value === "object" && ownedResponses.has(value)
  );
}

/** Admit one canonical packet without fetching sources or deriving an enriched DTO. */
export async function parseSecAnnualCanonicalResponse(
  value: unknown,
  capturedRequest: PersonalSecAnnualCanonicalRequestDto,
  signal: AbortSignal,
): Promise<PersonalSecAnnualCanonicalResponseDto | null> {
  signal.throwIfAborted();
  try {
    const requested = parseManagedSecAnnualCanonicalRequest(capturedRequest);
    if (requested === null || !response(value)) return null;
    if (
      value.catalogSnapshotSha256 !== requested.catalogSnapshotSha256 ||
      value.security.listingId !== requested.listingId ||
      value.security.symbol !== requested.symbol
    )
      return null;
    // Admission checks descriptors before reading fields or cloning. In particular,
    // a getter or toJSON hook cannot run during ownership or byte measurement.
    const owned = structuredClone(value);
    if (
      encoder.encode(JSON.stringify(owned)).byteLength >
      MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes
    )
      return null;
    signal.throwIfAborted();
    const rows = owned.evidence.facts.observations;
    for (let offset = 0; offset < rows.length; offset += hashBatchSize) {
      signal.throwIfAborted();
      const checks = await Promise.all(
        rows
          .slice(offset, offset + hashBatchSize)
          .map(
            async (row) =>
              row.id ===
              `sec-fact:${await hash(serializePersonalSecAnnualStatementObservation(row), signal)}`,
          ),
      );
      signal.throwIfAborted();
      if (checks.some((valid) => !valid)) return null;
    }
    const generation = await hash(
      serializePersonalSecAnnualCanonicalGeneration(owned.evidence),
      signal,
    );
    signal.throwIfAborted();
    if (owned.evidence.generation.sha256 !== `sha256:${generation}`)
      return null;
    const result = freeze(owned);
    ownedResponses.add(result);
    return result;
  } catch {
    signal.throwIfAborted();
    return null;
  }
}

function response(
  value: unknown,
): value is PersonalSecAnnualCanonicalResponseDto {
  if (
    !plain(value, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "security",
      "evidence",
    ]) ||
    value.schemaVersion !== PERSONAL_SEC_ANNUAL_CANONICAL_VERSION ||
    !matches(value.catalogSnapshotSha256, digest) ||
    !plain(value.security, [
      "country",
      "exchangeMic",
      "issuerId",
      "issuerName",
      "listingId",
      "securityName",
      "symbol",
      "cik",
    ])
  )
    return false;
  const security = value.security;
  if (
    security.country !== "US" ||
    !matches(security.exchangeMic, /^[A-Z0-9]{4}$/u) ||
    !matches(security.issuerId, identifier) ||
    !matches(security.listingId, identifier) ||
    !text(security.issuerName, 512) ||
    !text(security.securityName, 512) ||
    !matches(security.symbol, symbol) ||
    !matches(security.cik, cik)
  )
    return false;
  assertPersonalSecAnnualCanonicalEvidence(value.evidence);
  return value.evidence.cik === security.cik && temporalContext(value.evidence);
}
/** Keep wire clock admission as strict as the existing Annual client. */
function temporalContext(
  evidence: PersonalSecAnnualCanonicalEvidenceDto,
): boolean {
  const { generation, target } = evidence;
  if (generation.completedAt < generation.cutoffAt) return false;
  for (const source of Object.values(generation.sources)) {
    if (
      source.fetchedAt !== null &&
      (source.fetchedAt < generation.cutoffAt ||
        source.fetchedAt > generation.completedAt)
    )
      return false;
  }
  if (target.status === "unresolved") return true;
  const cutoffDay = generation.cutoffAt.slice(0, 10);
  if (target.reportDate > target.filedDate || target.filedDate > cutoffDay)
    return false;
  return target.acceptedAt === null
    ? target.filedDate < cutoffDay
    : Date.parse(target.acceptedAt) <= Date.parse(generation.cutoffAt) &&
        target.acceptedAt.slice(0, 10) >= target.reportDate;
}
function plain<const Keys extends readonly string[]>(
  value: unknown,
  expected: Keys,
): value is Record<Keys[number], unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  return (
    actual.length === expected.length &&
    expected.every((key) => Object.hasOwn(descriptors, key)) &&
    actual.every(
      (key) =>
        typeof key === "string" &&
        descriptors[key]?.enumerable &&
        Object.hasOwn(descriptors[key], "value"),
    )
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
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
