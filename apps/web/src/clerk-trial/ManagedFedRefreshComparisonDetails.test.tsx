import React, { type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseManagedMonetaryAnnouncements } from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import {
  compareManagedFedResponses,
  type ManagedFedRefreshComparison,
} from "./managed-fed-refresh-comparison";
import { ManagedFedRefreshComparisonDetails } from "./ManagedFedRefreshComparisonDetails";

function feed(
  count: number,
  availableItemCount = count,
  fetchedAt = "2026-10-20T18:00:00.000Z",
) {
  const packet = parseManagedMonetaryAnnouncements({
    ...fedAnnouncementsFixture(),
    fetchedAt,
    availableItemCount,
    items: Array.from({ length: count }, (_, index) => ({
      title: `Invented announcement ${index}`,
      url: `https://www.federalreserve.gov/newsevents/pressreleases/monetary202610${String(19 - index).padStart(2, "0")}a.htm`,
      publishedAt: null,
    })),
  });
  if (!packet) throw new Error("Invalid invented Fed comparison packet.");
  return packet;
}

function view(
  comparison: ManagedFedRefreshComparison,
  showingPrevious = false,
) {
  return ManagedFedRefreshComparisonDetails({ comparison, showingPrevious });
}

function disclosure(element: ReactElement<{ children?: React.ReactNode }>) {
  const child = React.Children.toArray(element.props.children).find(
    (node) => React.isValidElement(node) && node.type === "details",
  );
  if (!React.isValidElement<React.ComponentProps<"details">>(child))
    throw new Error("Missing native comparison disclosure.");
  return child;
}

describe("managed Fed loaded-feed comparison details", () => {
  it("binds the count to the displayed packet and shows exact original clocks, source and capped coverage", () => {
    const previous = feed(1);
    const current = feed(10, 15, "2026-11-03T18:00:00.000Z");
    const pair = compareManagedFedResponses(previous, current)!;
    const html = renderToStaticMarkup(view(pair));
    expect(html).toContain(
      "Newly observed in this refresh: 9 of 10 links in the loaded feed.",
    );
    expect(html).toContain(
      "These URLs were absent from the previous loaded list.",
    );
    expect(html).toContain('aria-label="Previous loaded feed"');
    expect(html).toContain('aria-label="Current loaded feed"');
    expect(html.indexOf(previous.fetchedAt)).toBeLessThan(
      html.indexOf(current.fetchedAt),
    );
    for (const packet of [previous, current]) {
      expect(html).toContain(
        `<time dateTime="${packet.fetchedAt}">${packet.fetchedAt}</time>`,
      );
      expect(html).toContain(
        `${packet.items.length} of ${packet.availableItemCount} validated feed entries`,
      );
      expect(html).toContain(
        `href="${packet.source.feedUrl}" target="_blank" rel="noopener noreferrer"`,
      );
      expect(html).toContain(packet.source.name);
    }
    expect(html).toContain("up to 10 links per feed");
    expect(html).toContain(
      "does not establish a new publication, an article change or complete feed history",
    );
    expect(html).not.toContain("last two accepted feeds");
  });
  it.each([0, 2])(
    "shows a valid zero comparison with %i current links",
    (count) => {
      const previous = feed(count);
      const pair = compareManagedFedResponses(previous, feed(count))!;
      expect(renderToStaticMarkup(view(pair))).toContain(
        `Newly observed in this refresh: 0 of ${count} links in the loaded feed.`,
      );
    },
  );
  it("keeps an unkeyed uncontrolled native disclosure through retained and replaced pairs", () => {
    const previous = feed(1);
    const current = feed(2);
    const pair = compareManagedFedResponses(previous, current)!;
    const original = disclosure(view(pair));
    for (const shown of [
      view(pair, true),
      view(compareManagedFedResponses(current, feed(0))!),
    ]) {
      const next = disclosure(shown);
      expect(next.type).toBe(original.type);
      expect(next.key).toBe(original.key);
      expect(next.props.open).toBeUndefined();
      expect(next.props.onToggle).toBeUndefined();
      expect(next.props.ref).toBeUndefined();
      const summary = React.Children.toArray(
        next.props.children,
      )[0] as ReactElement<{ children: string }>;
      expect(summary.type).toBe("summary");
      expect(summary.props.children).toBe("Compared loaded feeds");
    }
    // Structure preserves native ownership; actual open state/focus is browser QA.
  });
});
