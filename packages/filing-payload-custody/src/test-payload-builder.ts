import {
  FILING_PAYLOAD_CUSTODY_FIXTURE,
  createSyntheticFilingPayloadFixture,
} from "./payload-custody";

export const FILING_PAYLOAD_CUSTODY_ACCEPTANCE_CASES = Object.freeze([
  Object.freeze({
    expected: Object.freeze({ status: "passed" as const }),
    id: "single_generated_payload_lifecycle" as const,
  }),
]);

export interface FilingPayloadCustodyAcceptanceCase {
  readonly expected: { readonly status: "passed" };
  readonly id: "single_generated_payload_lifecycle";
  readonly payload: Uint8Array;
}

/** Returns fresh deterministic bytes for the one bounded synthetic lifecycle. */
export function buildFilingPayloadCustodyAcceptanceCases(): readonly FilingPayloadCustodyAcceptanceCase[] {
  const payload = createSyntheticFilingPayloadFixture();
  const definition = FILING_PAYLOAD_CUSTODY_ACCEPTANCE_CASES[0];
  if (
    definition === undefined ||
    payload.byteLength !== FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength ||
    payload.buffer.byteLength !== payload.byteLength
  ) {
    throw new Error("Synthetic filing payload fixture is invalid.");
  }
  return Object.freeze([
    Object.freeze({
      expected: definition.expected,
      id: definition.id,
      payload,
    }),
  ]);
}
