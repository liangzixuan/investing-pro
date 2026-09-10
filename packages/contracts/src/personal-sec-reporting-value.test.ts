import { describe, expect, it } from "vitest";

import type { PersonalSecFilingContextQNameDto } from "./personal-sec-filing-context";
import {
  isSupportedPersonalSecReportingFormat,
  normalizePersonalSecReportingValue,
} from "./personal-sec-reporting-value";

const concept = "DocumentPeriodEndDate";
const format: PersonalSecFilingContextQNameDto = Object.freeze({
  raw: "ixt:date-monthname-day-year-en",
  namespace: "http://www.xbrl.org/inlineXBRL/transformation/2020-02-12",
  localName: "date-monthname-day-year-en",
});

describe("bounded SEC reporting value normalization", () => {
  it.each([
    ["DocumentType", " \t10-Q/A\r\n", "10-Q/A"],
    ["DocumentType", "10-K", "10-K"],
    ["DocumentPeriodEndDate", "\r2024-02-29\t", "2024-02-29"],
    ["DocumentFiscalYearFocus", " 1000 ", "1000"],
    ["DocumentFiscalYearFocus", "9999", "9999"],
    ["DocumentFiscalPeriodFocus", "\nFY\r", "FY"],
    ["DocumentFiscalPeriodFocus", "Q3", "Q3"],
  ])("preserves direct %s text %s", (name, raw, expected) => {
    expect(normalizePersonalSecReportingValue(name, raw)).toBe(expected);
    expect(isSupportedPersonalSecReportingFormat(name, null)).toBe(true);
  });

  it.each([
    [null, "2025-01-01"],
    ["documentperiodenddate", "2025-01-01"],
    ["DocumentType", "10-q"],
    ["DocumentType", "8-K"],
    ["DocumentType", "10- Q"],
    ["DocumentType", "\u00a010-Q\u00a0"],
    ["DocumentPeriodEndDate", "March 31, 2025"],
    ["DocumentPeriodEndDate", "2025-02-29"],
    ["DocumentPeriodEndDate", "0999-01-01"],
    ["DocumentFiscalYearFocus", "0999"],
    ["DocumentFiscalYearFocus", "2025\u2028"],
    ["DocumentFiscalPeriodFocus", "Q4"],
    ["DocumentFiscalPeriodFocus", "q1"],
  ])("rejects unsupported direct %s text %s", (name, raw) => {
    expect(normalizePersonalSecReportingValue(name, raw)).toBeNull();
  });

  it.each([
    ["January", "Jan", "01"],
    ["February", "Feb", "02"],
    ["March", "Mar", "03"],
    ["April", "Apr", "04"],
    ["May", "May", "05"],
    ["June", "Jun", "06"],
    ["July", "Jul", "07"],
    ["August", "Aug", "08"],
    ["September", "Sep", "09"],
    ["October", "Oct", "10"],
    ["November", "Nov", "11"],
    ["December", "Dec", "12"],
  ])(
    "normalizes enumerated full/short/uppercase month %s",
    (full, short, month) => {
      for (const spelling of new Set([
        full,
        short,
        full.toUpperCase(),
        short.toUpperCase(),
      ])) {
        expect(
          normalizePersonalSecReportingValue(
            concept,
            `${spelling} 1, 2025`,
            format,
          ),
        ).toBe(`2025-${month}-01`);
      }
    },
  );

  it.each([
    [" \tJune\r\n30,\t2026\n", "2026-06-30"],
    ["January, March and April the 30th, 1969", "1969-01-30"],
    ["JanuaRY 2, 2025", "2025-01-02"],
    ["JANuary 2, 2025", "2025-01-02"],
    ["Sept 3, 2025", "2025-09-03"],
    ["Jun_30_2026", "2026-06-30"],
    ["Jun\u00a030,\u00a02026", "2026-06-30"],
    ["Feb 29, 0", "2000-02-29"],
    ["Feb 29, 00", "2000-02-29"],
    ["Jan 1, 9", "2009-01-01"],
    ["Jan 1, 09", "2009-01-01"],
    ["Jan 1, 99", "2099-01-01"],
    ["Feb 29, 2000", "2000-02-29"],
    ["Jan 01, 1000", "1000-01-01"],
    ["Dec 31, 9999", "9999-12-31"],
  ])("uses exact registry semantics for %s", (raw, expected) => {
    expect(normalizePersonalSecReportingValue(concept, raw, format)).toBe(
      expected,
    );
  });

  it.each([
    "February then March 31, 2025",
    "February 30th, 2009",
    "Feb 29, 1900",
    "Feb 29, 2100",
    "April 31, 2025",
    "Jan 00, 2025",
    "Jan 32, 2025",
    "Jan 001, 2025",
    "Jan 1, 025",
    "Jan 1, 0001",
    "Jan 1, 0999",
    "Jan 1, 10000",
    "Jan 1, 2025, 2026",
    "Jan 1, 2025 trailing",
    "prefix Jan 1, 2025",
    "jan 1, 2025",
    "jAn 1, 2025",
    "May1, 2025",
    "Jan 1, ２０２５",
    "Jan ١, 2025",
    "Jan 1, 2025\u2028",
    "\u00a0Jan 1, 2025",
    "Jan 1, 2025\u00a0",
    "Jan 1, 2025\u0000",
  ])("rejects invalid lexical/calendar value %s", (raw) => {
    expect(normalizePersonalSecReportingValue(concept, raw, format)).toBeNull();
  });

  it("keeps raw text bounded in UTF-16 units before normalization", () => {
    const exact = `Jan${"😀".repeat(2043)} 1 2025`;
    expect(exact.length).toBe(4096);
    expect(normalizePersonalSecReportingValue(concept, exact, format)).toBe(
      "2025-01-01",
    );
    expect(
      normalizePersonalSecReportingValue(concept, exact + " ", format),
    ).toBeNull();
  });

  it.each([
    {
      ...format,
      namespace: "http://www.xbrl.org/inlineXBRL/transformation/2022-02-16",
    },
    {
      ...format,
      namespace: "https://www.xbrl.org/inlineXBRL/transformation/2020-02-12",
    },
    { ...format, namespace: null },
    { ...format, localName: null },
    { ...format, raw: "ixt:date-month-day-year" },
    { ...format, raw: "ixt::date-monthname-day-year-en" },
    { ...format, raw: "ixt:date-monthname-day-year-en\n" },
    { ...format, raw: "ixt:DATE-MONTHNAME-DAY-YEAR-EN" },
    { ...format, localName: "date-month-day-year" },
  ])("requires an exact consistent format QName %#", (invalid) => {
    expect(isSupportedPersonalSecReportingFormat(concept, invalid)).toBe(false);
    expect(
      normalizePersonalSecReportingValue(concept, "June 30, 2026", invalid),
    ).toBeNull();
  });

  it("allows bound prefixes/default namespace but never formats another field", () => {
    for (const raw of [
      "custom:date-monthname-day-year-en",
      "date-monthname-day-year-en",
      `${"a".repeat(256 - 1 - format.localName!.length)}:${format.localName}`,
    ]) {
      expect(
        isSupportedPersonalSecReportingFormat(concept, { ...format, raw }),
      ).toBe(true);
    }
    expect(
      isSupportedPersonalSecReportingFormat(concept, {
        ...format,
        raw: `${"a".repeat(257 - 1 - format.localName!.length)}:${format.localName}`,
      }),
    ).toBe(false);
    for (const name of [
      null,
      "DocumentType",
      "DocumentFiscalYearFocus",
      "DocumentFiscalPeriodFocus",
      "documentperiodenddate",
    ]) {
      expect(isSupportedPersonalSecReportingFormat(name, format)).toBe(false);
      expect(
        normalizePersonalSecReportingValue(name, "June 30, 2026", format),
      ).toBeNull();
    }
  });
});
