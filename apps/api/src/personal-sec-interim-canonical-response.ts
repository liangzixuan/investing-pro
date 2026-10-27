import {
  digestSecCanonicalText as digest,
  isSecCanonicalGraphFrozen,
} from "./personal-sec-canonical-input";
import { readSecCanonicalPublicIdentity } from "./personal-sec-canonical-response-identity";
import {
  MANAGED_SEC_INTERIM_EVIDENCE_LIMITS,
  PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
  parseManagedSecInterimCanonicalRequest,
  serializePersonalSecInterimStatementObservation,
  type PersonalSecInterimCanonicalEvidenceDto,
  type PersonalSecInterimCanonicalRequestDto,
  type PersonalSecInterimCanonicalResponseDto,
} from "@research-cockpit/contracts";
import {
  assertPersonalSecInterimCanonicalEvidence,
  serializePersonalSecInterimCanonicalGeneration,
} from "@research-cockpit/personal-financial-analytics";

export class PersonalSecInterimCanonicalResponseError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "catalog_changed"
      | "invalid_identity"
      | "invalid_evidence"
      | "response_too_large",
  ) {
    super(code);
    this.name = "PersonalSecInterimCanonicalResponseError";
  }
}

export interface EncodedPersonalSecInterimCanonicalResponse {
  readonly response: PersonalSecInterimCanonicalResponseDto;
  readonly body: string;
  readonly byteLength: number;
}

/** Encode one catalog-bound graph, or refuse the whole unchanged wire packet. */
export function encodePersonalSecInterimCanonicalResponse(
  input: PersonalSecInterimCanonicalRequestDto,
  catalogSnapshotSha256: `sha256:${string}`,
  listing: PersonalSecInterimCanonicalResponseDto["security"],
  evidence: PersonalSecInterimCanonicalEvidenceDto,
): EncodedPersonalSecInterimCanonicalResponse {
  const request = parseManagedSecInterimCanonicalRequest(input);
  if (request === null)
    throw new PersonalSecInterimCanonicalResponseError("invalid_request");
  if (request.catalogSnapshotSha256 !== catalogSnapshotSha256)
    throw new PersonalSecInterimCanonicalResponseError("catalog_changed");
  let security: PersonalSecInterimCanonicalResponseDto["security"];
  try {
    security = readSecCanonicalPublicIdentity(listing);
  } catch {
    throw new PersonalSecInterimCanonicalResponseError("invalid_identity");
  }
  if (
    request.listingId !== security.listingId ||
    request.symbol !== security.symbol
  )
    throw new PersonalSecInterimCanonicalResponseError("invalid_identity");
  try {
    assertPersonalSecInterimCanonicalEvidence(evidence);
    if (evidence.cik !== security.cik || !isSecCanonicalGraphFrozen(evidence))
      throw new TypeError("Unowned or mismatched canonical evidence.");
    for (const row of evidence.facts.observations)
      if (
        row.id !==
        digest(serializePersonalSecInterimStatementObservation(row)).replace(
          /^sha256:/u,
          "sec-interim-fact:",
        )
      )
        throw new TypeError("Invalid canonical source identity.");
    if (
      evidence.generation.sha256 !==
      digest(serializePersonalSecInterimCanonicalGeneration(evidence))
    )
      throw new TypeError("Invalid canonical generation identity.");
  } catch {
    throw new PersonalSecInterimCanonicalResponseError("invalid_evidence");
  }
  const response: PersonalSecInterimCanonicalResponseDto = Object.freeze({
    schemaVersion: PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
    catalogSnapshotSha256: request.catalogSnapshotSha256,
    security,
    evidence,
  });
  const body = JSON.stringify(response);
  const byteLength = Buffer.byteLength(body, "utf8");
  if (byteLength > MANAGED_SEC_INTERIM_EVIDENCE_LIMITS.responseBytes)
    throw new PersonalSecInterimCanonicalResponseError("response_too_large");
  return Object.freeze({ response, body, byteLength });
}
