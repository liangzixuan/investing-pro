import { parseManagedSecFilingsResponse } from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import {
  bindManagedFilingsFilter,
  initialManagedFilingsFilter,
  projectManagedFilingsFilter,
  selectManagedFilingsForm,
  selectManagedFilingsPage,
} from "./managed-filings-filter";
import { filingsResponse } from "./sec-filings-fixture";

function mixedForms() {
  const source = filingsResponse(56);
  const forms = ["8-K", "10-K/A", "10-K", "8-k", "10-K/A", "10-k"];
  const response = parseManagedSecFilingsResponse(
    {
      ...source,
      issuer: {
        ...source.issuer,
        filings: source.issuer.filings.map((row, index) => ({
          ...row,
          form: forms[index] ?? "8-K",
        })),
      },
    },
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: source.catalogSnapshotSha256,
      listingId: source.security.listingId,
      symbol: source.security.symbol,
    },
  );
  if (!response) throw new Error("Invalid invented forms fixture");
  return response;
}

describe("loaded filings form projection", () => {
  it("keeps exact case and amendment forms in codepoint order with original row identities", () => {
    const response = mixedForms();
    const initial = initialManagedFilingsFilter(response);
    expect(projectManagedFilingsFilter(initial).forms).toEqual([
      "10-K",
      "10-K/A",
      "10-k",
      "8-K",
      "8-k",
    ]);
    const selected = selectManagedFilingsForm(initial, initial, "10-K/A");
    const view = projectManagedFilingsFilter(selected);
    expect(view.matchingCount).toBe(2);
    expect(view.loadedCount).toBe(56);
    expect(view.rows[0]).toBe(response.issuer.filings[1]);
    expect(view.rows[1]).toBe(response.issuer.filings[4]);
    expect(projectManagedFilingsFilter(initial).rows[0]).toBe(
      response.issuer.filings[0],
    );
  });

  it("filters before paging, retains source order and resets page when the form changes", () => {
    const response = mixedForms();
    const initial = initialManagedFilingsFilter(response);
    const pageTwo = selectManagedFilingsPage(initial, initial, 1);
    const filtered = selectManagedFilingsForm(pageTwo, pageTwo, "8-K");
    expect(filtered.page).toBe(0);
    expect(projectManagedFilingsFilter(filtered).pages).toBe(3);
    const second = selectManagedFilingsPage(filtered, filtered, 1);
    const view = projectManagedFilingsFilter(second);
    expect(view.matchingCount).toBe(51);
    expect(view.rows).toHaveLength(25);
    expect(view.rows[0]).toBe(response.issuer.filings[30]);
    expect(view.rows[24]).toBe(response.issuer.filings[54]);
    const third = selectManagedFilingsPage(second, second, 2);
    expect(projectManagedFilingsFilter(third).rows).toEqual([
      response.issuer.filings[55],
    ]);
    const all = selectManagedFilingsForm(third, third, "");
    expect(all.page).toBe(0);
    expect(projectManagedFilingsFilter(all).matchingCount).toBe(56);
  });

  it("does not mistake the unfiltered source matching count for loaded coverage", () => {
    const source = filingsResponse(1000);
    const response = {
      ...source,
      issuer: { ...source.issuer, matchingFilings: 1234, truncated: true },
    };
    const initial = initialManagedFilingsFilter(response);
    const selected = selectManagedFilingsForm(initial, initial, "10-Q");
    expect(projectManagedFilingsFilter(selected)).toMatchObject({
      matchingCount: 1,
      loadedCount: 1000,
      pages: 1,
    });
    expect(response.issuer.matchingFilings).toBe(1234);
    expect(response.issuer.truncated).toBe(true);
  });

  it.each([
    "available",
    "not_covered",
    "invalid_response",
    "upstream_unavailable",
    "rate_limited",
  ] as const)(
    "leaves only All and one empty page for %s without accepting a made-up form",
    (status) => {
      const initial = initialManagedFilingsFilter(filingsResponse(0, status));
      expect(projectManagedFilingsFilter(initial)).toEqual({
        forms: [],
        loadedCount: 0,
        matchingCount: 0,
        pages: 1,
        rows: [],
      });
      expect(selectManagedFilingsForm(initial, initial, "8-K")).toBe(initial);
      expect(selectManagedFilingsPage(initial, initial, 1)).toBe(initial);
    },
  );
});

describe("response-bound form and page selection", () => {
  it("retains the same response choice and makes initial mount distinct from replacement", () => {
    const response = mixedForms();
    const initial = initialManagedFilingsFilter(response);
    const form = selectManagedFilingsForm(initial, initial, "8-K");
    const page = selectManagedFilingsPage(form, form, 1);
    expect(bindManagedFilingsFilter(page, response)).toBe(page);
    expect(initialManagedFilingsFilter(response)).toMatchObject({
      form: "",
      page: 0,
      resetNotice: false,
    });
    const replacement = mixedForms();
    const reset = bindManagedFilingsFilter(page, replacement);
    expect(reset).toEqual({
      response: replacement,
      form: "",
      page: 0,
      resetNotice: true,
    });
    expect(bindManagedFilingsFilter(reset, replacement)).toBe(reset);
    expect(bindManagedFilingsFilter(initial, replacement).resetNotice).toBe(
      false,
    );
  });

  it.each(["form", "page"])(
    "announces a reset of only the prior %s, including empty replacement",
    (kind) => {
      const initial = initialManagedFilingsFilter(mixedForms());
      const changed =
        kind === "form"
          ? selectManagedFilingsForm(initial, initial, "8-K")
          : selectManagedFilingsPage(initial, initial, 1);
      expect(
        bindManagedFilingsFilter(changed, filingsResponse(0)),
      ).toMatchObject({
        form: "",
        page: 0,
        resetNotice: true,
      });
    },
  );

  it("ignores stale form/page handlers after another choice or response replacement", () => {
    const initial = initialManagedFilingsFilter(mixedForms());
    const selected = selectManagedFilingsForm(initial, initial, "8-K");
    expect(selectManagedFilingsForm(selected, initial, "10-K")).toBe(selected);
    expect(selectManagedFilingsPage(selected, initial, 1)).toBe(selected);
    const next = selectManagedFilingsPage(selected, selected, 1);
    expect(selectManagedFilingsPage(next, selected, 2)).toBe(next);
    const reset = bindManagedFilingsFilter(next, mixedForms());
    expect(selectManagedFilingsForm(reset, next, "8-K")).toBe(reset);
    expect(selectManagedFilingsPage(reset, next, 1)).toBe(reset);
  });

  it("ignores unknown forms, repeated choices and invalid pages; a fresh interaction clears a reset notice", () => {
    const initial = initialManagedFilingsFilter(mixedForms());
    for (const form of ["10-k/A", " 8-K", "ALL", ""])
      expect(selectManagedFilingsForm(initial, initial, form)).toBe(initial);
    for (const page of [-1, 0, 3, 1.5, NaN, Infinity])
      expect(selectManagedFilingsPage(initial, initial, page)).toBe(initial);
    const selected = selectManagedFilingsForm(initial, initial, "8-K");
    const next = selectManagedFilingsPage(selected, selected, 1);
    expect(selectManagedFilingsForm(next, next, "8-K")).toBe(next);
    const reset = bindManagedFilingsFilter(next, mixedForms());
    expect(selectManagedFilingsForm(reset, reset, "8-K").resetNotice).toBe(
      false,
    );
    expect(selectManagedFilingsPage(reset, reset, 1).resetNotice).toBe(false);
  });
});
