import { describe, expect, it } from "vitest";
import {
  parseManagedMonetaryAnnouncements,
  type PersonalMonetaryAnnouncementDto,
} from "@research-cockpit/contracts";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import { compareManagedFedResponses } from "./managed-fed-refresh-comparison";

function item(key: string): PersonalMonetaryAnnouncementDto {
  return {
    title: `Invented announcement ${key}`,
    url: `https://www.federalreserve.gov/newsevents/pressreleases/monetary20261019${key}.htm`,
    publishedAt: null,
  };
}

function packet(
  items: readonly PersonalMonetaryAnnouncementDto[],
  availableItemCount = items.length,
  fetchedAt = "2026-10-20T18:00:00.000Z",
) {
  const response = parseManagedMonetaryAnnouncements({
    ...fedAnnouncementsFixture(),
    items,
    availableItemCount,
    fetchedAt,
  });
  if (!response)
    throw new Error("The invented feed must pass the real parser.");
  return response;
}

describe("consecutive loaded Fed feed comparison", () => {
  it.each([
    { name: "empty", items: [] },
    { name: "nonempty", items: [item("a")] },
  ])("$name has no comparison without an accepted baseline", ({ items }) => {
    expect(compareManagedFedResponses(null, packet(items))).toBeNull();
  });

  it("retains exact packets and current order, marking only previously absent URLs", () => {
    const previous = packet([item("a"), item("b"), item("c")]);
    const current = packet(
      [item("d"), item("c"), item("a"), item("e")],
      4,
      "2026-10-21T18:00:00.000Z",
    );
    const comparison = compareManagedFedResponses(previous, current)!;
    expect(comparison.previous).toBe(previous);
    expect(comparison.current).toBe(current);
    expect(comparison.newUrls).toEqual([item("d").url, item("e").url]);
    expect(current.items.map((row) => row.url)).toEqual(
      ["d", "c", "a", "e"].map((key) => item(key).url),
    );
    expect(comparison.previous.fetchedAt).toBe("2026-10-20T18:00:00.000Z");
    expect(comparison.current.fetchedAt).toBe("2026-10-21T18:00:00.000Z");
    expect(Object.isFrozen(comparison)).toBe(true);
    expect(Object.isFrozen(comparison.newUrls)).toBe(true);
  });

  it.each(["same object", "equal content", "reordered"] as const)(
    "%s is a valid zero comparison, including equal retrieval clocks",
    (mode) => {
      const previous = packet([item("a"), item("b")]);
      const current =
        mode === "same object"
          ? previous
          : packet(
              mode === "reordered"
                ? [...previous.items].reverse()
                : previous.items,
            );
      const comparison = compareManagedFedResponses(previous, current)!;
      expect(comparison.previous).toBe(previous);
      expect(comparison.current).toBe(current);
      expect(comparison.newUrls).toEqual([]);
    },
  );

  it("does not treat revised title or publication time at the same URL as a new link", () => {
    const previous = packet([item("a"), item("b")]);
    const current = packet([
      {
        ...item("a"),
        title: "Invented revised title",
        publishedAt: "2026-10-19T18:00:00.000Z",
      },
      item("c"),
    ]);
    const comparison = compareManagedFedResponses(previous, current)!;
    expect(comparison.newUrls).toEqual([item("c").url]);
    expect(comparison.current.items[0]).toBe(current.items[0]);
    expect(comparison.current.items[0]?.title).toBe("Invented revised title");
    expect(comparison.current.items[1]?.publishedAt).toBeNull();
  });

  it("compares both empty transitions without retaining session-wide URL history", () => {
    const full = packet([item("a"), item("b")]);
    const empty = packet([]);
    expect(compareManagedFedResponses(full, empty)?.newUrls).toEqual([]);
    expect(compareManagedFedResponses(empty, empty)?.newUrls).toEqual([]);
    expect(compareManagedFedResponses(empty, full)?.newUrls).toEqual(
      full.items.map((row) => row.url),
    );
    const shortened = packet([item("a")]);
    expect(compareManagedFedResponses(shortened, full)?.newUrls).toEqual([
      item("b").url,
    ]);
  });

  it("uses only loaded URLs when both packets report more than ten available items", () => {
    const previous = packet(Array.from("abcdefghij", item), 128);
    const current = packet(Array.from("jabcdefghi", item), 100);
    const zero = compareManagedFedResponses(previous, current)!;
    expect(zero.newUrls).toEqual([]);
    expect(zero.previous.availableItemCount).toBe(128);
    expect(zero.current.availableItemCount).toBe(100);
    const replacement = packet(Array.from("kabcdefghi", item), 100);
    expect(compareManagedFedResponses(current, replacement)?.newUrls).toEqual([
      item("k").url,
    ]);
    expect(replacement.items).toHaveLength(10);
  });
});
