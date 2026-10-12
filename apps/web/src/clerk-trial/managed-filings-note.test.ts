import { describe, expect, it } from "vitest";
import { parseManagedSecFilingsResponse } from "@research-cockpit/contracts";
import { filingsResponse } from "./sec-filings-fixture";
import { filingReferenceNoteExcerpt } from "./managed-filings-note";

describe("observed filing reference excerpt", () => {
  it("keeps exact identity, dates, original index link and the limited source scope", () => {
    const response = filingsResponse(1);
    expect(
      filingReferenceNoteExcerpt(response, response.issuer.filings[0]!, false),
    ).toBe(
      "Observed SEC filing reference: ZERO (XNAS); CIK 0000000001; Form 10-Q; accession 0000000001-26-000001; filed 2026-10-11; report date 2026-09-30; filing index https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. " +
        "Source: SEC Submissions; requested window 2026-07-15 to 2026-10-12; original request started 2026-10-12T00:00:00.000Z; retrieved 2026-10-12T00:00:00.500Z; completed 2026-10-12T00:00:01.000Z. " +
        "Only the current recent-filings object was checked; older continuation files were not loaded; complete window coverage is not established. " +
        "The source lists older continuation files. " +
        "Filing contents were not fetched. Evidence dates are unchanged; this action does not refresh sources.",
    );
  });
  it("retains missing report date, amendment form and truncated/previous qualifications", () => {
    const initial = filingsResponse(1000);
    const filing = { ...initial.issuer.filings[1]!, form: "8-K/A" };
    const response = {
      ...initial,
      issuer: {
        ...initial.issuer,
        filings: initial.issuer.filings.map((row, index) =>
          index === 1 ? filing : row,
        ),
        truncated: true,
        matchingFilings: 1001,
        olderHistoryAvailable: false,
      },
    };
    const excerpt = filingReferenceNoteExcerpt(response, filing, true)!;
    expect(
      parseManagedSecFilingsResponse(response, {
        schemaVersion: "1.0.0",
        catalogSnapshotSha256: response.catalogSnapshotSha256,
        listingId: response.security.listingId,
        symbol: response.security.symbol,
      }),
    ).not.toBeNull();
    expect(excerpt).toContain("Form 8-K/A;");
    expect(excerpt).toContain("report date unavailable;");
    expect(excerpt).toContain(
      "The list was truncated to 1000 of 1001 matching filings.",
    );
    expect(excerpt).toContain(
      "Retained previous filings response; newer filings were not confirmed.",
    );
    expect(excerpt).not.toContain("The source lists older continuation files.");
    expect(excerpt).toContain(initial.issuer.fetchedAt);
  });
  it("refuses cloned or foreign rows even when the accession matches", () => {
    const response = filingsResponse(1);
    expect(
      filingReferenceNoteExcerpt(
        response,
        { ...response.issuer.filings[0]! },
        false,
      ),
    ).toBeNull();
    expect(
      filingReferenceNoteExcerpt(
        response,
        filingsResponse(1).issuer.filings[0]!,
        false,
      ),
    ).toBeNull();
  });
  it.each([
    "not_covered",
    "invalid_response",
    "rate_limited",
    "upstream_unavailable",
  ] as const)("refuses %s evidence", (status) => {
    const response = filingsResponse(1);
    expect(
      filingReferenceNoteExcerpt(
        { ...response, issuer: { ...response.issuer, status } },
        response.issuer.filings[0]!,
        false,
      ),
    ).toBeNull();
  });
});
