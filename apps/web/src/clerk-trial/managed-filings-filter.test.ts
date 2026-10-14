import {
  managedSecFilingsWindow,
  parseManagedSecFilingsResponse,
  type ManagedSecFilingsResponseDto,
} from "@research-cockpit/contracts";
import { beforeAll, describe, expect, it } from "vitest";
import {
  bindManagedFilingsFilter,
  initialManagedFilingsFilter,
  projectManagedFilingsFilter,
  selectManagedFilingsForm,
  selectManagedFilingsPage,
  selectManagedFilingsScope,
  selectManagedFilingsRefreshView,
  type ManagedFilingsRefreshView,
} from "./managed-filings-filter";
import { compareManagedFilingsResponses } from "./managed-filings-refresh-comparison";
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
      refreshComparison: null,
      refreshView: "all",
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

describe("newly observed filings filter", () => {
  function admitted(source: ManagedSecFilingsResponseDto) {
    const response = parseManagedSecFilingsResponse(source, {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: source.catalogSnapshotSha256,
      listingId: source.security.listingId,
      symbol: source.security.symbol,
    });
    if (!response) throw new Error("Invalid invented refresh filter packet");
    return response;
  }

  function comparisonFor(
    current: ManagedSecFilingsResponseDto,
    newIndexes: readonly number[],
  ) {
    const filings = current.issuer.filings.filter(
      (_, index) => !newIndexes.includes(index),
    );
    const previous = admitted({
      ...current,
      issuer: {
        ...current.issuer,
        filings,
        matchingFilings: filings.length,
        truncated: false,
      },
    });
    const comparison = compareManagedFilingsResponses(previous, current);
    if (!comparison) throw new Error("Expected admitted refresh comparison");
    return comparison;
  }

  function selectedNew() {
    const response = datedFilings();
    const comparison = comparisonFor(
      response,
      response.issuer.filings.map((_, index) => index),
    );
    const initial = initialManagedFilingsFilter(response, baseline, comparison);
    const form = selectManagedFilingsForm(initial, initial, "8-K");
    const scope = selectManagedFilingsScope(form, form, "after-annual");
    const fresh = selectManagedFilingsRefreshView(scope, scope, "new");
    return selectManagedFilingsPage(fresh, fresh, 1);
  }

  it("intersects new accessions, exact forms and Annual date before paging without replacing rows", () => {
    const response = datedFilings();
    const indexes = [0, 1, 27, 30, 54, 55];
    const comparison = comparisonFor(response, indexes);
    const original = JSON.stringify({ response, comparison });
    const initial = initialManagedFilingsFilter(response, baseline, comparison);
    expect(initial.refreshView).toBe("all");
    expect(initial.refreshComparison).toBe(comparison);
    const page = selectManagedFilingsPage(initial, initial, 1);
    const fresh = selectManagedFilingsRefreshView(page, page, "new");
    expect(fresh.page).toBe(0);
    const view = projectManagedFilingsFilter(fresh);
    expect(view).toMatchObject({ matchingCount: 6, loadedCount: 56, pages: 1 });
    indexes.forEach((index, position) =>
      expect(view.rows[position]).toBe(response.issuer.filings[index]),
    );
    const scope = selectManagedFilingsScope(fresh, fresh, "after-annual");
    expect(projectManagedFilingsFilter(scope).rows).toEqual(
      [1, 27, 30].map((index) => response.issuer.filings[index]),
    );
    const form = selectManagedFilingsForm(scope, scope, "8-K");
    expect(projectManagedFilingsFilter(form).rows).toEqual(
      [27, 30].map((index) => response.issuer.filings[index]),
    );
    const amendment = selectManagedFilingsForm(form, form, "10-K/A");
    expect(projectManagedFilingsFilter(amendment).rows[0]).toBe(
      response.issuer.filings[1],
    );
    expect(projectManagedFilingsFilter(amendment).forms).toEqual(view.forms);
    expect(comparison.newAccessions).toHaveLength(6);
    expect(JSON.stringify({ response, comparison })).toBe(original);
  });

  it("finds an older-dated accession beyond the first page while keeping shifted and truncated source limits", () => {
    const source = filingsResponse(1000);
    const previous = admitted({
      ...source,
      issuer: { ...source.issuer, matchingFilings: 1200, truncated: true },
    });
    const accessionNumber = "0000000001-26-001001";
    const requestStartedAt = "2026-10-13T00:00:00.000Z";
    const current = admitted({
      ...source,
      requestStartedAt,
      completedAt: "2026-10-13T00:00:01.000Z",
      window: managedSecFilingsWindow(requestStartedAt)!,
      issuer: {
        ...source.issuer,
        fetchedAt: "2026-10-13T00:00:00.500Z",
        matchingFilings: 1300,
        truncated: true,
        filings: source.issuer.filings.map((row, index) =>
          index === 999
            ? {
                ...row,
                accessionNumber,
                filingDate: "2026-10-10",
                sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${accessionNumber}-index.htm`,
              }
            : row,
        ),
      },
    });
    const comparison = compareManagedFilingsResponses(previous, current)!;
    const initial = initialManagedFilingsFilter(current, null, comparison);
    const selected = selectManagedFilingsRefreshView(initial, initial, "new");
    expect(projectManagedFilingsFilter(selected)).toMatchObject({
      loadedCount: 1000,
      matchingCount: 1,
      pages: 1,
    });
    expect(projectManagedFilingsFilter(selected).rows[0]).toBe(
      current.issuer.filings[999],
    );
    expect(selected.refreshComparison).toBe(comparison);
    expect(comparison.previous.window).not.toEqual(comparison.current.window);
    expect(comparison.previous.issuer.matchingFilings).toBe(1200);
    expect(comparison.current.issuer.matchingFilings).toBe(1300);
    expect(comparison.current.issuer.truncated).toBe(true);
    expect(comparison.current.issuer.olderHistoryAvailable).toBe(true);
  });

  it("refuses absent and mismatched comparisons instead of treating a first or seeded packet as zero new", () => {
    const response = admitted(filingsResponse(2));
    const comparison = comparisonFor(response, [1]);
    const equal = admitted(filingsResponse(2));
    for (const value of [null, comparison]) {
      const initial = initialManagedFilingsFilter(equal, null, value);
      expect(initial.refreshComparison).toBeNull();
      expect(selectManagedFilingsRefreshView(initial, initial, "new")).toBe(
        initial,
      );
      expect(projectManagedFilingsFilter(initial).matchingCount).toBe(2);
    }
    const initial = initialManagedFilingsFilter(response, null, comparison);
    const mismatch = bindManagedFilingsFilter(initial, equal, null, comparison);
    expect(mismatch.refreshComparison).toBeNull();
  });

  it.each([
    "not_covered",
    "invalid_response",
    "upstream_unavailable",
    "rate_limited",
  ] as const)(
    "does not admit a comparison attached to an unavailable %s packet",
    (status) => {
      const response = admitted(filingsResponse(0, status));
      const attached = {
        previous: admitted(filingsResponse(1)),
        current: response,
        newAccessions: [],
      };
      const initial = initialManagedFilingsFilter(response, null, attached);
      expect(initial.refreshComparison).toBeNull();
      expect(selectManagedFilingsRefreshView(initial, initial, "new")).toBe(
        initial,
      );
    },
  );

  it.each(["equal-content", "empty"] as const)(
    "allows the new-only view for an admitted %s zero-new comparison",
    (kind) => {
      const previous = admitted(filingsResponse(2));
      const response = admitted(filingsResponse(kind === "empty" ? 0 : 2));
      const comparison = compareManagedFilingsResponses(previous, response)!;
      const initial = initialManagedFilingsFilter(response, null, comparison);
      const selected = selectManagedFilingsRefreshView(initial, initial, "new");
      expect(selected.refreshView).toBe("new");
      expect(selected.refreshComparison).toBe(comparison);
      expect(projectManagedFilingsFilter(selected)).toMatchObject({
        matchingCount: 0,
        pages: 1,
        rows: [],
      });
      expect(selectManagedFilingsPage(selected, selected, 1)).toBe(selected);
    },
  );

  it("retains all choices and page for the same accepted packets and clears only presentation on remount", () => {
    const selected = selectedNew();
    expect(selected.page).toBe(1);
    expect(
      bindManagedFilingsFilter(
        selected,
        selected.response,
        { ...baseline },
        selected.refreshComparison,
      ),
    ).toBe(selected);
    expect(
      initialManagedFilingsFilter(
        selected.response,
        baseline,
        selected.refreshComparison,
      ),
    ).toMatchObject({
      scope: "all",
      form: "",
      refreshView: "all",
      page: 0,
      resetNotice: null,
    });
    const all = selectManagedFilingsRefreshView(selected, selected, "all");
    expect(all).toMatchObject({
      scope: "after-annual",
      form: "8-K",
      page: 0,
      refreshView: "all",
    });
  });

  it.each(["replacement", "loss", "mismatched"] as const)(
    "resets active Refresh view on comparison %s while preserving Form and Annual scope",
    (kind) => {
      const selected = selectedNew();
      const comparison =
        kind === "loss"
          ? null
          : comparisonFor(
              kind === "mismatched" ? datedFilings() : selected.response,
              [27],
            );
      const bound = bindManagedFilingsFilter(
        selected,
        selected.response,
        baseline,
        comparison,
      );
      expect(bound).toMatchObject({
        form: "8-K",
        scope: "after-annual",
        refreshView: "all",
        page: 0,
        resetNotice: "refresh-comparison-changed",
      });
      expect(bound.refreshComparison).toBe(
        kind === "replacement" ? comparison : null,
      );
      expect(selectManagedFilingsRefreshView(bound, selected, "new")).toBe(
        bound,
      );
      expect(selectManagedFilingsForm(bound, selected, "10-K/A")).toBe(bound);
      expect(selectManagedFilingsScope(bound, selected, "all")).toBe(bound);
      expect(selectManagedFilingsPage(bound, selected, 1)).toBe(bound);
      expect(
        bindManagedFilingsFilter(bound, bound.response, baseline, comparison),
      ).toBe(bound);
    },
  );

  it("binds comparison changes even under All without resetting other filters or accepting old handlers", () => {
    const selected = selectedNew();
    const all = selectManagedFilingsRefreshView(selected, selected, "all");
    const page = selectManagedFilingsPage(all, all, 1);
    const replacement = comparisonFor(page.response, [27]);
    const bound = bindManagedFilingsFilter(
      page,
      page.response,
      baseline,
      replacement,
    );
    expect(bound).toMatchObject({
      form: "8-K",
      scope: "after-annual",
      refreshView: "all",
      page: 1,
      resetNotice: null,
    });
    expect(bound.refreshComparison).toBe(replacement);
    expect(selectManagedFilingsRefreshView(bound, page, "new")).toBe(bound);
    expect(selectManagedFilingsPage(bound, page, 0)).toBe(bound);
  });

  it.each(["replacement", "loss"] as const)(
    "keeps Refresh view and Form when an Annual baseline %s resets its date scope",
    (kind) => {
      const selected = selectedNew();
      const changed =
        kind === "loss"
          ? null
          : { ...baseline, response: { ...baseline.response } };
      const bound = bindManagedFilingsFilter(
        selected,
        selected.response,
        changed,
        selected.refreshComparison,
      );
      expect(bound).toMatchObject({
        form: "8-K",
        scope: "all",
        refreshView: "new",
        page: 0,
        resetNotice: "annual-baseline-changed",
      });
      expect(bound.refreshComparison).toBe(selected.refreshComparison);
      expect(bound.baseline).toBe(changed);
      expect(selectManagedFilingsRefreshView(bound, selected, "all")).toBe(
        bound,
      );
    },
  );

  it("binds simultaneous Annual and comparison changes together and reports both active resets", () => {
    const selected = selectedNew();
    const changed = { ...baseline, response: { ...baseline.response } };
    const comparison = comparisonFor(selected.response, [27]);
    const bound = bindManagedFilingsFilter(
      selected,
      selected.response,
      changed,
      comparison,
    );
    expect(bound).toMatchObject({
      form: "8-K",
      scope: "all",
      refreshView: "all",
      page: 0,
      resetNotice: "annual-and-refresh-comparison-changed",
    });
    expect(bound.baseline).toBe(changed);
    expect(bound.refreshComparison).toBe(comparison);
    expect(
      bindManagedFilingsFilter(bound, bound.response, changed, comparison),
    ).toBe(bound);
    expect(selectManagedFilingsRefreshView(bound, selected, "new")).toBe(bound);
    expect(selectManagedFilingsScope(bound, selected, "after-annual")).toBe(
      bound,
    );
    expect(
      selectManagedFilingsRefreshView(bound, bound, "new").resetNotice,
    ).toBeNull();
  });

  it.each(["annual", "refresh", "neither"] as const)(
    "reports only the active %s reset when both bindings change",
    (active) => {
      let selected = selectedNew();
      if (active !== "annual")
        selected = selectManagedFilingsScope(selected, selected, "all");
      if (active !== "refresh")
        selected = selectManagedFilingsRefreshView(selected, selected, "all");
      selected = selectManagedFilingsPage(selected, selected, 1);
      const bound = bindManagedFilingsFilter(
        selected,
        selected.response,
        null,
        null,
      );
      expect(bound.scope).toBe("all");
      expect(bound.refreshView).toBe("all");
      expect(bound.form).toBe("8-K");
      expect(bound.page).toBe(active === "neither" ? 1 : 0);
      expect(bound.resetNotice).toBe(
        active === "annual"
          ? "annual-baseline-changed"
          : active === "refresh"
            ? "refresh-comparison-changed"
            : null,
      );
      expect(bound.baseline).toBeNull();
      expect(bound.refreshComparison).toBeNull();
    },
  );

  it.each(["equal-content", "empty", "unavailable"] as const)(
    "gives a %s Filings replacement priority over simultaneous baseline and comparison changes",
    (kind) => {
      const selected = selectedNew();
      const response =
        kind === "equal-content"
          ? admitted(selected.response)
          : admitted(
              filingsResponse(
                0,
                kind === "empty" ? "available" : "upstream_unavailable",
              ),
            );
      const comparison = compareManagedFilingsResponses(
        selected.response,
        response,
      );
      const bound = bindManagedFilingsFilter(
        selected,
        response,
        null,
        comparison,
      );
      expect(bound).toMatchObject({
        scope: "all",
        refreshView: "all",
        form: "",
        page: 0,
        resetNotice: "filings-replaced",
      });
      expect(bound.response).toBe(response);
      expect(bound.baseline).toBeNull();
      expect(bound.refreshComparison).toBe(comparison);
      expect(selectManagedFilingsRefreshView(bound, selected, "new")).toBe(
        bound,
      );
      expect(selectManagedFilingsForm(bound, selected, "8-K")).toBe(bound);
      expect(selectManagedFilingsScope(bound, selected, "after-annual")).toBe(
        bound,
      );
      expect(selectManagedFilingsPage(bound, selected, 1)).toBe(bound);
    },
  );

  it("refuses repeated, invalid and stale refresh-view actions after local filter choices", () => {
    const selected = selectedNew();
    expect(selectManagedFilingsRefreshView(selected, selected, "new")).toBe(
      selected,
    );
    expect(
      selectManagedFilingsRefreshView(
        selected,
        selected,
        "NEW" as ManagedFilingsRefreshView,
      ),
    ).toBe(selected);
    const form = selectManagedFilingsForm(selected, selected, "10-K/A");
    const scope = selectManagedFilingsScope(selected, selected, "all");
    const page = selectManagedFilingsPage(selected, selected, 0);
    for (const changed of [form, scope, page])
      expect(selectManagedFilingsRefreshView(changed, selected, "all")).toBe(
        changed,
      );
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
