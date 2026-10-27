import { MANAGED_SEC_INTERIM_ISSUERS } from "./managed-sec-issuers";
import { describe, expect, it } from "vitest";
import {
  MANAGED_SEC_ANNUAL_ISSUERS,
  MANAGED_SEC_FILINGS_ISSUERS,
} from "./managed-sec-issuers";

const QUALIFIED_CIKS = [
  "0000320193",
  "0001652044",
  "0000789019",
  "0000002186",
  "0000002488",
  "0000003453",
  "0000003545",
  "0000003570",
  "0000004127",
  "0000004281",
  "0000004457",
  "0000004962",
  "0000004977",
  "0000005272",
  "0000005513",
  "0000005981",
  "0000006176",
];

describe("independent SEC capability admission", () => {
  it("preserves the exact qualified Annual issuers independently of Filings", () => {
    expect(MANAGED_SEC_ANNUAL_ISSUERS).toEqual(QUALIFIED_CIKS);
    expect(MANAGED_SEC_FILINGS_ISSUERS).toEqual(QUALIFIED_CIKS);
    expect(MANAGED_SEC_ANNUAL_ISSUERS).not.toBe(MANAGED_SEC_FILINGS_ISSUERS);
    expect(Object.isFrozen(MANAGED_SEC_ANNUAL_ISSUERS)).toBe(true);
    expect(Object.isFrozen(MANAGED_SEC_FILINGS_ISSUERS)).toBe(true);
    expect(new Set(MANAGED_SEC_ANNUAL_ISSUERS).size).toBe(17);
    expect(new Set(MANAGED_SEC_FILINGS_ISSUERS).size).toBe(17);
  });
});

it("keeps interim fixture-qualified coverage explicit,separate,and within the existing17issuercohort", () => {
  expect(MANAGED_SEC_INTERIM_ISSUERS).toEqual(QUALIFIED_CIKS);
  expect(MANAGED_SEC_INTERIM_ISSUERS).not.toBe(MANAGED_SEC_ANNUAL_ISSUERS);
  expect(Object.isFrozen(MANAGED_SEC_INTERIM_ISSUERS)).toBe(true);
  expect(new Set(MANAGED_SEC_INTERIM_ISSUERS).size).toBe(17);
  for (const cik of MANAGED_SEC_INTERIM_ISSUERS)
    expect(MANAGED_SEC_ANNUAL_ISSUERS).toContain(cik);
});
