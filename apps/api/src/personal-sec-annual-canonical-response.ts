import {
  digestSecCanonicalText as digest,
  isSecCanonicalGraphFrozen,
} from "./personal-sec-canonical-input";
import { readSecCanonicalPublicIdentity } from "./personal-sec-canonical-response-identity";
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
  let security: PersonalSecAnnualCanonicalResponseDto["security"];
  try {
    security = readSecCanonicalPublicIdentity(listing);
  } catch {
    throw new PersonalSecAnnualCanonicalResponseError("invalid_identity");
  }
  if (
    request.listingId !== security.listingId ||
    request.symbol !== security.symbol
  )
    throw new PersonalSecAnnualCanonicalResponseError("invalid_identity");
  try {
    assertPersonalSecAnnualCanonicalEvidence(evidence);
    if (evidence.cik !== security.cik || !isSecCanonicalGraphFrozen(evidence))
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
