import { createHash } from "node:crypto";
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

export class PersonalSecAnnualCanonicalResponseError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "catalog_changed"
      | "invalid_identity"
      | "invalid_evidence"
      | "response_too_large",
  ) {
    super(code);
    this.name = "PersonalSecAnnualCanonicalResponseError";
  }
}

export interface EncodedPersonalSecAnnualCanonicalResponse {
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly body: string;
  readonly byteLength: number;
}

/** Encode one catalog-bound graph, or refuse the whole unchanged wire packet. */
export function encodePersonalSecAnnualCanonicalResponse(
  input: PersonalSecAnnualCanonicalRequestDto,
  catalogSnapshotSha256: `sha256:${string}`,
  listing: PersonalSecAnnualCanonicalResponseDto["security"],
  evidence: PersonalSecAnnualCanonicalEvidenceDto,
): EncodedPersonalSecAnnualCanonicalResponse {
  const request = parseManagedSecAnnualCanonicalRequest(input);
  if (request === null)
    throw new PersonalSecAnnualCanonicalResponseError("invalid_request");
  if (request.catalogSnapshotSha256 !== catalogSnapshotSha256)
    throw new PersonalSecAnnualCanonicalResponseError("catalog_changed");
  const security = publicIdentity(listing);
  if (
    request.listingId !== security.listingId ||
    request.symbol !== security.symbol
  )
    throw new PersonalSecAnnualCanonicalResponseError("invalid_identity");
  try {
    assertPersonalSecAnnualCanonicalEvidence(evidence);
    if (evidence.cik !== security.cik || !frozen(evidence))
      throw new TypeError("Unowned or mismatched canonical evidence.");
    for (const row of evidence.facts.observations)
      if (
        row.id !==
        digest(serializePersonalSecAnnualStatementObservation(row)).replace(
          /^sha256:/u,
          "sec-fact:",
        )
      )
        throw new TypeError("Invalid canonical source identity.");
    if (
      evidence.generation.sha256 !==
      digest(serializePersonalSecAnnualCanonicalGeneration(evidence))
    )
      throw new TypeError("Invalid canonical generation identity.");
  } catch {
    throw new PersonalSecAnnualCanonicalResponseError("invalid_evidence");
  }
  const response: PersonalSecAnnualCanonicalResponseDto = Object.freeze({
    schemaVersion: PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
    catalogSnapshotSha256: request.catalogSnapshotSha256,
    security,
    evidence,
  });
  const body = JSON.stringify(response);
  const byteLength = Buffer.byteLength(body, "utf8");
  if (byteLength > MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes)
    throw new PersonalSecAnnualCanonicalResponseError("response_too_large");
  return Object.freeze({ response, body, byteLength });
}

function digest(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}
function frozen(value: unknown): boolean {
  return (
    value === null ||
    typeof value !== "object" ||
    (Object.isFrozen(value) && Object.values(value).every(frozen))
  );
}

/** Catalog records may contain private fields. Read and emit only this tuple. */
function publicIdentity(
  value: PersonalSecAnnualCanonicalResponseDto["security"],
): PersonalSecAnnualCanonicalResponseDto["security"] {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Object.getPrototypeOf(value) !== Object.prototype
    )
      throw new TypeError();
    const fields = [
      "country",
      "exchangeMic",
      "issuerId",
      "issuerName",
      "listingId",
      "securityName",
      "symbol",
      "cik",
    ] as const;
    for (const field of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      if (
        !descriptor?.enumerable ||
        !Object.hasOwn(descriptor, "value") ||
        typeof descriptor.value !== "string"
      )
        throw new TypeError();
    }
    const identifier = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
    if (
      value.country !== "US" ||
      !/^[A-Z0-9]{4}$/u.test(value.exchangeMic) ||
      !identifier.test(value.issuerId) ||
      !identifier.test(value.listingId) ||
      !/^[A-Z0-9][A-Z0-9.-]{0,14}$/u.test(value.symbol) ||
      !/^(?!0000000000)[0-9]{10}$/u.test(value.cik) ||
      !name(value.issuerName) ||
      !name(value.securityName)
    )
      throw new TypeError();
    return Object.freeze({
      country: value.country,
      exchangeMic: value.exchangeMic,
      issuerId: value.issuerId,
      issuerName: value.issuerName,
      listingId: value.listingId,
      securityName: value.securityName,
      symbol: value.symbol,
      cik: value.cik,
    });
  } catch {
    throw new PersonalSecAnnualCanonicalResponseError("invalid_identity");
  }
}
function name(value: string): boolean {
  return (
    value === value.trim().normalize("NFC") &&
    [...value].length > 0 &&
    [...value].length <= 512 &&
    !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)
  );
}
