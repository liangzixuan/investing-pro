import { createHash } from "node:crypto";
import { serializePersonalSecInterimStatementObservation } from "@research-cockpit/contracts";
import {
  scanPersonalSecStatementCompanyFacts,
  unavailablePersonalSecStatementCompanyFacts,
  type PersonalSecStatementCompanyFacts,
  type PersonalSecStatementRawObservation,
} from "./personal-sec-statement-company-facts";

export type PersonalSecInterimStatementRawObservation =
  PersonalSecStatementRawObservation<`sec-interim-fact:${string}`>;
export type PersonalSecInterimStatementCompanyFacts =
  PersonalSecStatementCompanyFacts<`sec-interim-fact:${string}`>;
export const unavailablePersonalSecInterimStatementCompanyFacts =
  unavailablePersonalSecStatementCompanyFacts<`sec-interim-fact:${string}`>;

/** Interim retains its exact identity domain; the scanner has no period rules. */
export function normalizePersonalSecInterimStatementCompanyFacts(
  value: unknown,
  cik: string,
  accession: string | null,
): PersonalSecInterimStatementCompanyFacts {
  return scanPersonalSecStatementCompanyFacts(value, cik, {
    accession,
    identify(fields) {
      const key = serializePersonalSecInterimStatementObservation(fields);
      return {
        key,
        id: `sec-interim-fact:${createHash("sha256").update(key).digest("hex")}` as const,
      };
    },
  });
}
