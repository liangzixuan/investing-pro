/** Filings scope remains separate from Annual qualification and catalog identity. */
export const MANAGED_SEC_FILINGS_ISSUERS: readonly string[] = Object.freeze([
  "0000320193",
  "0001652044",
  "0000789019",
]);

/** Named Annual cohort; exact canonical source qualification recorded October 17. */
export const MANAGED_SEC_ANNUAL_ISSUERS: readonly string[] = Object.freeze([
  ...MANAGED_SEC_FILINGS_ISSUERS,
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
]);
