import {
  managedSecFilingsWindow,
  parseManagedSecFilingsResponse,
} from "@research-cockpit/contracts";
import { beforeAll, describe, expect, it } from "vitest";
import {
  bindManagedFilingsFilter,
  initialManagedFilingsFilter,
  projectManagedFilingsFilter,
  selectManagedFilingsForm,
  selectManagedFilingsPage,
  selectManagedFilingsScope,
} from "./managed-filings-filter";
import { annualComparisonResponse } from "./annual-comparison-fixture";
import type { ManagedFilingsAnnualBaseline } from "./managed-filings-annual-baseline";
import { filingsResponse } from "./sec-filings-fixture";

let baseline: ManagedFilingsAnnualBaseline;
beforeAll(async () => {
  const response = await annualComparisonResponse();
  if (response.evidence.target.status !== "target")
    throw new Error("Invented Annual target required");
  baseline = { response, target: response.evidence.target };
});

function datedFilings() {
  const source = filingsResponse(56);
  const requestStartedAt = "2026-02-04T00:00:00.000Z";
  const response = parseManagedSecFilingsResponse(
    {
      ...source,
      requestStartedAt,
      completedAt: "2026-02-04T00:00:01.000Z",
      window: managedSecFilingsWindow(requestStartedAt),
      issuer: {
        ...source.issuer,
        fetchedAt: "2026-02-04T00:00:00.500Z",
        matchingFilings: 56,
        truncated: false,
        filings: source.issuer.filings.map((row, index) => ({
          ...row,
          form: index === 1 ? "10-K/A" : index === 54 ? "10-Q" : "8-K",
          filingDate:
            index < 54
              ? "2026-02-02"
              : index === 54
                ? "2026-02-01"
                : "2026-01-31",
          reportDate: index === 1 ? "2025-12-31" : null,
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
  if (!response) throw new Error("Invalid invented dated filings packet");
  return response;
}

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
      resetNotice: null,
    });
    const replacement = mixedForms();
    const reset = bindManagedFilingsFilter(page, replacement);
    expect(reset).toEqual({
      response: replacement,
      baseline: null,
      scope: "all",
      form: "",
      page: 0,
      resetNotice: "filings-replaced",
    });
    expect(bindManagedFilingsFilter(reset, replacement)).toBe(reset);
    expect(bindManagedFilingsFilter(initial, replacement).resetNotice).toBe(
      null,
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
        resetNotice: "filings-replaced",
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
      null,
    );
    expect(selectManagedFilingsPage(reset, reset, 1).resetNotice).toBe(null);
  });
});

describe("loaded filings after the Annual target", () => {
  it("starts at All, filters strictly by filed date and excludes the exact target accession", () => {
    const response = datedFilings();
    const initial = initialManagedFilingsFilter(response, baseline);
    expect(initial.scope).toBe("all");
    expect(projectManagedFilingsFilter(initial).matchingCount).toBe(56);
    const selected = selectManagedFilingsScope(
      initial,
      initial,
      "after-annual",
    );
    const view = projectManagedFilingsFilter(selected);
    // The first row has the target accession even though this other packet dates it later.
    expect(response.issuer.filings[0]?.accessionNumber).toBe(
      baseline.target.accessionNumber,
    );
    expect(view.matchingCount).toBe(53);
    expect(view.loadedCount).toBe(56);
    expect(view.pages).toBe(3);
    expect(view.rows[0]).toBe(response.issuer.filings[1]);
    expect(view.forms).toEqual(["10-K/A", "10-Q", "8-K"]);
    const last = selectManagedFilingsPage(selected, selected, 2);
    expect(projectManagedFilingsFilter(last).rows).toEqual(
      response.issuer.filings.slice(51, 54),
    );
    expect(response.issuer.matchingFilings).toBe(56);
    expect(response.issuer.truncated).toBe(false);
    expect(response.issuer.olderHistoryAvailable).toBe(true);
    expect(response.window).toEqual(initial.response.window);
  });

  it("intersects Form and date before paging, preserving other choices and original rows", () => {
    const initial = initialManagedFilingsFilter(datedFilings(), baseline);
    const form = selectManagedFilingsForm(initial, initial, "8-K");
    const page = selectManagedFilingsPage(form, form, 1);
    const scoped = selectManagedFilingsScope(page, page, "after-annual");
    expect(scoped).toMatchObject({
      form: "8-K",
      scope: "after-annual",
      page: 0,
    });
    expect(projectManagedFilingsFilter(scoped).matchingCount).toBe(52);
    const second = selectManagedFilingsPage(scoped, scoped, 1);
    expect(projectManagedFilingsFilter(second).rows[0]).toBe(
      initial.response.issuer.filings[27],
    );
    const amendment = selectManagedFilingsForm(second, second, "10-K/A");
    expect(amendment).toMatchObject({ scope: "after-annual", page: 0 });
    expect(projectManagedFilingsFilter(amendment).rows).toEqual([
      initial.response.issuer.filings[1],
    ]);
    const sameDay = selectManagedFilingsForm(amendment, amendment, "10-Q");
    expect(projectManagedFilingsFilter(sameDay)).toMatchObject({
      matchingCount: 0,
      pages: 1,
      rows: [],
    });
    const all = selectManagedFilingsScope(sameDay, sameDay, "all");
    expect(all.form).toBe("10-Q");
    expect(projectManagedFilingsFilter(all).rows).toEqual([
      initial.response.issuer.filings[54],
    ]);
  });

  it("allows an older baseline outside the loaded window without extending or filling that window", () => {
    const response = filingsResponse();
    const initial = initialManagedFilingsFilter(response, baseline);
    const selected = selectManagedFilingsScope(
      initial,
      initial,
      "after-annual",
    );
    expect(baseline.target.filedDate < response.window.fromDate).toBe(true);
    expect(projectManagedFilingsFilter(selected).matchingCount).toBe(25);
    expect(selected.response).toBe(response);
    expect(selected.baseline).toBe(baseline);
  });

  it("retains choices for the same packets even when a new baseline wrapper is derived", () => {
    const response = datedFilings();
    const initial = initialManagedFilingsFilter(response, baseline);
    const form = selectManagedFilingsForm(initial, initial, "8-K");
    const scope = selectManagedFilingsScope(form, form, "after-annual");
    const page = selectManagedFilingsPage(scope, scope, 1);
    expect(bindManagedFilingsFilter(page, response, { ...baseline })).toBe(
      page,
    );
    expect(initialManagedFilingsFilter(response, baseline)).toMatchObject({
      scope: "all",
      form: "",
      page: 0,
      resetNotice: null,
    });
  });

  it.each(["replacement", "loss"] as const)(
    "resets active date scope and page, but keeps Form, after Annual %s",
    (kind) => {
      const initial = initialManagedFilingsFilter(datedFilings(), baseline);
      const form = selectManagedFilingsForm(initial, initial, "8-K");
      const scope = selectManagedFilingsScope(form, form, "after-annual");
      const page = selectManagedFilingsPage(scope, scope, 1);
      const nextBaseline =
        kind === "loss"
          ? null
          : { ...baseline, response: { ...baseline.response } };
      const bound = bindManagedFilingsFilter(page, page.response, nextBaseline);
      expect(bound).toMatchObject({
        form: "8-K",
        scope: "all",
        page: 0,
        resetNotice: "annual-baseline-changed",
      });
      expect(bound.baseline).toBe(nextBaseline);
      expect(selectManagedFilingsScope(bound, page, "after-annual")).toBe(
        bound,
      );
      expect(selectManagedFilingsForm(bound, page, "10-Q")).toBe(bound);
      expect(selectManagedFilingsPage(bound, page, 1)).toBe(bound);
      expect(selectManagedFilingsPage(bound, bound, 1).resetNotice).toBeNull();
    },
  );

  it("rebinds an Annual baseline under All without resetting Form/page or inventing a notice", () => {
    const initial = initialManagedFilingsFilter(datedFilings(), baseline);
    const form = selectManagedFilingsForm(initial, initial, "8-K");
    const page = selectManagedFilingsPage(form, form, 1);
    const changed = { ...baseline, response: { ...baseline.response } };
    const rebound = bindManagedFilingsFilter(page, page.response, changed);
    expect(rebound).toMatchObject({
      form: "8-K",
      scope: "all",
      page: 1,
      resetNotice: null,
    });
    expect(rebound.baseline).toBe(changed);
    expect(selectManagedFilingsScope(rebound, page, "after-annual")).toBe(
      rebound,
    );
    expect(
      bindManagedFilingsFilter(rebound, page.response, null),
    ).toMatchObject({ form: "8-K", page: 1, resetNotice: null });
  });

  it.each(["equal-content", "empty"] as const)(
    "resets all local choices for a %s Filings replacement",
    (kind) => {
      const initial = initialManagedFilingsFilter(datedFilings(), baseline);
      const scope = selectManagedFilingsScope(initial, initial, "after-annual");
      const replacement =
        kind === "empty" ? filingsResponse(0) : { ...initial.response };
      const reset = bindManagedFilingsFilter(scope, replacement, {
        ...baseline,
        response: { ...baseline.response },
      });
      expect(reset).toMatchObject({
        form: "",
        scope: "all",
        page: 0,
        resetNotice: "filings-replaced",
      });
      expect(selectManagedFilingsScope(reset, scope, "after-annual")).toBe(
        reset,
      );
      expect(bindManagedFilingsFilter(reset, replacement, reset.baseline)).toBe(
        reset,
      );
      expect(
        selectManagedFilingsScope(reset, reset, "after-annual").resetNotice,
      ).toBeNull();
    },
  );

  it("refuses missing baselines and stale scope handlers after Form, page or scope changes", () => {
    const missing = initialManagedFilingsFilter(datedFilings());
    expect(selectManagedFilingsScope(missing, missing, "after-annual")).toBe(
      missing,
    );
    const initial = bindManagedFilingsFilter(
      missing,
      missing.response,
      baseline,
    );
    expect(selectManagedFilingsScope(initial, initial, "all")).toBe(initial);
    const form = selectManagedFilingsForm(initial, initial, "8-K");
    const page = selectManagedFilingsPage(initial, initial, 1);
    const scope = selectManagedFilingsScope(initial, initial, "after-annual");
    for (const changed of [form, page, scope])
      expect(selectManagedFilingsScope(changed, initial, "after-annual")).toBe(
        changed,
      );
    expect(selectManagedFilingsForm(scope, initial, "8-K")).toBe(scope);
    expect(selectManagedFilingsPage(scope, initial, 1)).toBe(scope);
  });
});
