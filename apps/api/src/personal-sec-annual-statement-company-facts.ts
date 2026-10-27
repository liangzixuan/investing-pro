import { createHash } from "node:crypto";
import { serializePersonalSecAnnualStatementObservation } from "@research-cockpit/contracts";
import {
  scanPersonalSecStatementCompanyFacts,
  unavailablePersonalSecStatementCompanyFacts,
  type PersonalSecStatementCompanyFacts,
  type PersonalSecStatementRawObservation,
} from "./personal-sec-statement-company-facts";

export type PersonalSecAnnualStatementRawObservation =
  PersonalSecStatementRawObservation<`sec-fact:${string}`>;
export type PersonalSecAnnualStatementCompanyFacts =
  PersonalSecStatementCompanyFacts<`sec-fact:${string}`>;
export const unavailablePersonalSecAnnualStatementCompanyFacts =
  unavailablePersonalSecStatementCompanyFacts<`sec-fact:${string}`>;

/** Annual retains its exact identity domain; the scanner has no period rules. */
export function normalizePersonalSecAnnualStatementCompanyFacts(
  value: unknown,
  cik: string,
  accession: string | null,
): PersonalSecAnnualStatementCompanyFacts {
  return scanPersonalSecStatementCompanyFacts(value, cik, {
    accession,
    identify(fields) {
      const key = serializePersonalSecAnnualStatementObservation(fields);
      return {
        key,
        id: `sec-fact:${createHash("sha256").update(key).digest("hex")}` as const,
      };
    },
  });
}
