import {
  PERSONAL_SEC_FILING_CONTEXT_LIMITS as LIMITS,
  PERSONAL_SEC_FILING_REPORTING_CONCEPTS,
  type PersonalSecFilingContextQNameDto,
} from "./personal-sec-filing-context";

const DATE_FORMAT = "date-monthname-day-year-en";
const DATE_NAMESPACE =
  "http://www.xbrl.org/inlineXBRL/transformation/2020-02-12";
// Reject source controls while preserving the four XML whitespace characters.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const MONTHS = Object.freeze([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);
const MONTH_SPELLINGS = [
  ...MONTHS,
  ...MONTHS.map((month) => month.slice(0, 3)),
  ...MONTHS.map((month) => month.toUpperCase()),
  ...MONTHS.map((month) => month.slice(0, 3).toUpperCase()),
];
// TRR4 sections 4.1/4.58: enumerated month names, broad nonnumeric separators,
// first month occurrence, and 1/2/4-digit years. No locale or case inference.
const TRANSFORMED_DATE = new RegExp(
  `^(${MONTH_SPELLINGS.join("|")})[^0-9]+([0-9]{1,2})[^0-9]+([0-9]{1,2}|[0-9]{4})$`,
  "u",
);

function knownConcept(concept: string | null): boolean {
  return (
    PERSONAL_SEC_FILING_REPORTING_CONCEPTS as readonly unknown[]
  ).includes(concept);
}

/** Supported formatting only; this does not establish context or issuer scope. */
export function isSupportedPersonalSecReportingFormat(
  concept: string | null,
  format: PersonalSecFilingContextQNameDto | null,
): boolean {
  if (!knownConcept(concept)) return false;
  if (format === null) return true;
  if (
    concept !== "DocumentPeriodEndDate" ||
    typeof format !== "object" ||
    format === null ||
    typeof format.raw !== "string" ||
    format.raw.length > LIMITS.identifierCharacters ||
    format.namespace !== DATE_NAMESPACE ||
    format.localName !== DATE_FORMAT
  )
    return false;
  const name =
    /^(?:[A-Za-z_][A-Za-z0-9_.-]*:)?([A-Za-z_][A-Za-z0-9_.-]*)$/u.exec(
      format.raw,
    );
  return (
    name !== null && name[0] === format.raw && name[1] === format.localName
  );
}

function validDate(value: string): boolean {
  if (value.length !== 10 || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(value))
    return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1]!;
}

/** Exact bounded DEI lexical normalization; no source or accounting admission. */
export function normalizePersonalSecReportingValue(
  concept: string | null,
  raw: string,
  format: PersonalSecFilingContextQNameDto | null = null,
): string | null {
  if (
    typeof raw !== "string" ||
    raw.length > LIMITS.rawTextCharacters ||
    CONTROL.test(raw) ||
    !isSupportedPersonalSecReportingFormat(concept, format)
  )
    return null;
  // XML whitespace only; e.g. NBSP is neither collapsed nor stripped.
  const value = raw.replace(/[ \t\r\n]+/gu, " ").replace(/^ +| +$/gu, "");
  if (format !== null) {
    const parts = TRANSFORMED_DATE.exec(value);
    if (parts === null || parts[0] !== value) return null;
    const month =
      MONTHS.findIndex(
        (name) =>
          name.slice(0, 3).toUpperCase() ===
          parts[1]!.slice(0, 3).toUpperCase(),
      ) + 1;
    const year = Number(parts[3]) + (parts[3]!.length <= 2 ? 2000 : 0);
    const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${parts[2]!.padStart(2, "0")}`;
    return validDate(date) ? date : null;
  }
  switch (concept) {
    case "DocumentType":
      return ["10-Q", "10-Q/A", "10-K", "10-K/A"].includes(value)
        ? value
        : null;
    case "DocumentPeriodEndDate":
      return validDate(value) ? value : null;
    case "DocumentFiscalYearFocus":
      return /^[1-9][0-9]{3}$/u.test(value) && value.length === 4
        ? value
        : null;
    case "DocumentFiscalPeriodFocus":
      return ["FY", "Q1", "Q2", "Q3"].includes(value) ? value : null;
    default:
      return null;
  }
}
