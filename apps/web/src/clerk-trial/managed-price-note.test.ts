import { describe, expect, it } from "vitest";
import { eodResponse } from "./eod-history-fixture";
import { priceComparisonNoteExcerpt } from "./managed-price-note";

const expected =
  "Observed raw-close comparison: ZERO (XNAS); 2026-09-17 USD 100.000000000000000001 to latest loaded 2026-09-19 USD 110.000000000000000003; raw close change +$10.000000000000000002 (+10.0000%). Source: Tiingo; requested window 2026-08-20 to 2026-09-20; original request started 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:01.000Z. Raw closes are not adjusted for splits or dividends and are not live quotes. Evidence dates are unchanged; this action does not refresh sources.";

describe("managed price comparison note excerpt", () => {
  it("preserves the exact selected endpoints, source provenance and raw-price qualification", () => {
    const response = {
      ...eodResponse(),
      rows: [
        { date: "2026-09-17", close: "100.000000000000000001" },
        { date: "2026-09-18", close: "107.500000000000000002" },
        { date: "2026-09-19", close: "110.000000000000000003" },
      ],
    };
    const first = response.rows[0]!;
    expect(priceComparisonNoteExcerpt(response, first, false)).toBe(expected);
    expect(priceComparisonNoteExcerpt(response, first, true)).toBe(
      expected.replace(
        "Evidence dates are unchanged;",
        "Retained previous history; newer prices were not confirmed. Evidence dates are unchanged;",
      ),
    );
    expect(priceComparisonNoteExcerpt(response, first, false)).not.toMatch(
      /[\r\n]/u,
    );
    const middle = priceComparisonNoteExcerpt(
      response,
      response.rows[1]!,
      false,
    )!;
    expect(middle).toContain(
      "2026-09-18 USD 107.500000000000000002 to latest loaded 2026-09-19 USD 110.000000000000000003; raw close change +$2.500000000000000001 (+2.3256%).",
    );
  });

  it.each([
    ["100", "110", "+$10 (+10.0000%)"],
    ["100", "90", "-$10 (-10.0000%)"],
    ["100", "100", "$0 (0.0000%)"],
    ["100", "100.00000001", "+$0.00000001 (less than 0.0001% higher)"],
    ["100", "99.99999999", "-$0.00000001 (less than 0.0001% lower)"],
    ["3", "4", "+$1 (+33.3333%)"],
    [
      "9007199254740993123.0000000001",
      "9007199254740993123.0000000002",
      "+$0.0000000001 (less than 0.0001% higher)",
    ],
  ])(
    "formats %s to %s without losing sign or decimal precision",
    (start, end, change) => {
      const response = {
        ...eodResponse(),
        rows: [
          { date: "2026-09-18", close: start },
          { date: "2026-09-19", close: end },
        ],
      };
      const text = priceComparisonNoteExcerpt(
        response,
        response.rows[0]!,
        false,
      )!;
      expect(text).toContain(
        `2026-09-18 USD ${start} to latest loaded 2026-09-19 USD ${end}`,
      );
      expect(text).toContain(`raw close change ${change}.`);
    },
  );

  it("requires an actual earlier row from this history and two dated endpoints", () => {
    const response = eodResponse();
    const first = response.rows[0]!;
    expect(
      priceComparisonNoteExcerpt(response, { ...first }, false),
    ).toBeNull();
    expect(
      priceComparisonNoteExcerpt(response, response.rows.at(-1)!, false),
    ).toBeNull();
    expect(
      priceComparisonNoteExcerpt({ ...response, rows: [first] }, first, false),
    ).toBeNull();
    expect(
      priceComparisonNoteExcerpt({ ...response, rows: [] }, first, false),
    ).toBeNull();
  });
});
