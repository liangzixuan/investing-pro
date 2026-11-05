import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { expect, it, vi } from "vitest";
import {
  WatchlistScreenSelectionRows,
  WATCHLIST_SCREEN_PAGE_SIZE,
} from "./WatchlistScreenSelectionRows";
import type { WatchlistScreenSelectionPlan } from "./managed-watchlist-screen-selection-plan";
import { eodSelection } from "./eod-history-fixture";

type Element = React.ReactElement<Record<string, unknown>>;
function nodes(node: React.ReactNode): Element[] {
  return React.Children.toArray(node).flatMap((child) =>
    React.isValidElement<Record<string, unknown>>(child)
      ? [child, ...nodes(child.props.children as React.ReactNode)]
      : [],
  );
}
it("keeps all 10,000 eligibility rows reachable in order while mounting only one bounded page", () => {
  const rows: WatchlistScreenSelectionPlan["rows"] = Array.from(
    { length: 10000 },
    (_, index) => ({
      membership: {
        ...eodSelection.listing,
        listingId: `outside-${index}`,
        note: `Raw note ${index}`,
      },
      member: null,
      status: "outside_cohort",
      reason: `Outside current Annual cohort ${index}`,
    }),
  );
  const visited: string[] = [],
    onPage = vi.fn();
  for (let page = 0; page < rows.length / WATCHLIST_SCREEN_PAGE_SIZE; page++) {
    const tree: Element = WatchlistScreenSelectionRows({
      rows,
      id: "review",
      page,
      onPage,
    });
    // Inspect the mounted list directly on every page. Descending through all
    // identity disclosures and page options repeats work unrelated to row reachability.
    const list = React.Children.toArray(
      tree.props.children as React.ReactNode,
    ).find(
      (child): child is Element =>
        React.isValidElement<Record<string, unknown>>(child) &&
        child.type === "ol",
    );
    expect(list).toBeDefined();
    const entries = React.Children.toArray(
      list!.props.children as React.ReactNode,
    ).filter(
      (child): child is Element =>
        React.isValidElement<Record<string, unknown>>(child) &&
        typeof child.props["data-listing-id"] === "string",
    );
    expect(entries).toHaveLength(WATCHLIST_SCREEN_PAGE_SIZE);
    visited.push(...entries.map((n) => n.props["data-listing-id"] as string));
  }
  expect(visited).toEqual(rows.map((r) => r.membership.listingId));
  const tree = WatchlistScreenSelectionRows({
    rows,
    id: "review",
    page: 399,
    onPage,
  });
  const $ = load(renderToStaticMarkup(tree));
  expect($("#review-count").text()).toContain(
    "10000 entries. Showing 9976–10000. Page 400 of 400.",
  );
  expect($('[aria-label="Complete eligibility counts"]').text()).toContain(
    "Outside this cohort: 10000",
  );
  expect($("ol").attr("start")).toBe("9976");
  expect($("#review-next").attr("disabled")).toBeDefined();
  const select = nodes(tree).find((n) => n.props.id === "review-page")!;
  const change = select.props.onChange as (event: {
    currentTarget: { value: string };
  }) => void;
  change({ currentTarget: { value: "123" } });
  expect(onPage).toHaveBeenLastCalledWith(123);
  change({ currentTarget: { value: "400" } });
  change({ currentTarget: { value: "-1" } });
  expect(onPage).toHaveBeenCalledOnce();
});
