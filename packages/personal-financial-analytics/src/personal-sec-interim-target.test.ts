import { describe, expect, it } from "vitest";
import type { PersonalSecInterimFilingDto } from "@research-cockpit/contracts";
import { selectPersonalSecInterimTarget as select } from "./personal-sec-interim-target";
const cutoff = "2026-08-01T12:00:00.000Z",
  fetched = "2026-08-01T12:00:01.000Z";
const filing = (
  overrides: Partial<PersonalSecInterimFilingDto> = {},
): PersonalSecInterimFilingDto => ({
  accessionNumber: "0000000001-26-000002",
  form: "10-Q",
  filedDate: "2026-07-30",
  reportDate: "2026-06-30",
  acceptedAt: "2026-07-30T14:00:00Z",
  ...overrides,
});
describe("interim metadata target", () => {
  it("selects newest observed report before values and never invents history", () => {
    const earlier = filing({
      accessionNumber: "0000000001-26-000001",
      reportDate: "2026-03-31",
      filedDate: "2026-04-30",
      acceptedAt: null,
    });
    expect(select([earlier, filing()], cutoff, fetched)).toEqual({
      status: "target",
      ...filing(),
    });
    expect(Object.isFrozen(select([filing()], cutoff, fetched))).toBe(true);
  });
  it.each([
    ["null source", null, "submissions_unavailable"],
    ["empty source", [], "no_observed_interim_target"],
    [
      "annual is not interim",
      [filing({ form: "10-K" })],
      "no_observed_interim_target",
    ],
    ["missing filed date", [filing({ filedDate: null })], "filed_date_missing"],
    [
      "missing report date",
      [filing({ reportDate: null })],
      "target_missing_report_date",
    ],
    [
      "bad calendar",
      [filing({ reportDate: "2026-02-30" })],
      "invalid_submissions",
    ],
    ["duplicate accession", [filing(), filing()], "invalid_submissions"],
    [
      "newer amendment",
      [
        filing(),
        filing({
          accessionNumber: "0000000001-26-000003",
          form: "10-Q/A",
          filedDate: "2026-07-31",
        }),
      ],
      "amendment_not_supported",
    ],
    ["amendment only", [filing({ form: "10-Q/A" })], "amendment_not_supported"],
    [
      "same-date ambiguity",
      [filing(), filing({ accessionNumber: "0000000001-26-000004" })],
      "target_ambiguous",
    ],
    [
      "same-day unknown time",
      [filing({ filedDate: "2026-08-01", acceptedAt: null })],
      "cutoff_time_unresolved",
    ],
    [
      "report after filing",
      [filing({ reportDate: "2026-07-31" })],
      "future_or_inconsistent_dates",
    ],
    [
      "future filing excluded",
      [filing({ filedDate: "2026-08-02", acceptedAt: "2026-08-02T10:00:00Z" })],
      "no_observed_interim_target",
    ],
  ] as const)("refuses %s", (_name, rows, reason) =>
    expect(select(rows, cutoff, fetched)).toEqual({
      status: "unresolved",
      reason,
    }),
  );
  it("refuses untrusted shapes without invoking getters and refuses invalid capture clocks", () => {
    let reads = 0;
    const hostile = Object.defineProperty(filing(), "form", {
      get() {
        reads++;
        return "10-Q";
      },
      enumerable: true,
    });
    expect(select([hostile], cutoff, fetched)).toEqual({
      status: "unresolved",
      reason: "invalid_submissions",
    });
    expect(reads).toBe(0);
    expect(select([filing()], cutoff, "2026-07-31T12:00:00.000Z")).toEqual({
      status: "unresolved",
      reason: "invalid_clock",
    });
  });
});
