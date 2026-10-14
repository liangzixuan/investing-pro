import { describe, expect, it } from "vitest";
import {
  parseManagedMonetaryAnnouncements,
  type PersonalMonetaryAnnouncementDto,
} from "@research-cockpit/contracts";
import { projectFedAnnouncementView } from "../features/markets/fed-announcement-view";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import { compareManagedFedResponses } from "./managed-fed-refresh-comparison";
import { projectManagedFedUpdatesView } from "./managed-fed-updates-view";

function item(key: string, title = `Invented policy ${key}`) {
  return {
    title,
    url: `https://www.federalreserve.gov/newsevents/pressreleases/monetary20261019${key}.htm`,
    publishedAt: null,
  };
}
function packet(items: readonly PersonalMonetaryAnnouncementDto[]) {
  const response = parseManagedMonetaryAnnouncements({
    ...fedAnnouncementsFixture(),
    items,
    availableItemCount: items.length,
  });
  if (!response) throw new Error("Invalid invented Fed list.");
  return response;
}

describe("managed Fed updates view", () => {
  it.each([null, packet([item("a")])])(
    "keeps the original title view before a loaded comparison",
    (response) => {
      const titles = projectFedAnnouncementView(response, "policy");
      const result = projectManagedFedUpdatesView(titles, null, "new");
      expect(result.view).toBe(titles);
      expect(result.available).toBe(false);
      expect(result.refreshView).toBe("all");
    },
  );
  it("intersects title matches with absent URLs in current order and keeps exact objects and metadata", () => {
    const previous = packet([item("a"), item("b")]);
    const current = packet([
      {
        ...item("a"),
        title: "Revised policy",
        publishedAt: "2026-10-19T18:00:00.000Z",
      },
      item("d", "Invented policy without publication time"),
      item("c", "Invented unrelated announcement"),
      item("e", "Invented POLICY without publication time"),
    ]);
    const comparison = compareManagedFedResponses(previous, current)!;
    const titles = projectFedAnnouncementView(current, "  POLICY  WITHOUT  ");
    const result = projectManagedFedUpdatesView(titles, comparison, "new");
    expect(result.available).toBe(true);
    expect(result.refreshView).toBe("new");
    expect(result.view.response).toBe(current);
    expect(result.view.query).toBe(titles.query);
    expect(result.view.visibleItems).toEqual([
      current.items[1],
      current.items[3],
    ]);
    expect(result.view.visibleItems[0]).toBe(current.items[1]);
    expect(result.view.visibleItems[1]).toBe(current.items[3]);
    expect(result.view.visibleItems[0]!.publishedAt).toBeNull();
    expect(comparison.newUrls).toEqual([
      current.items[1]!.url,
      current.items[2]!.url,
      current.items[3]!.url,
    ]);
    expect(current.items).toHaveLength(4);
    expect(current.availableItemCount).toBe(4);
    expect(projectManagedFedUpdatesView(titles, comparison, "all").view).toBe(
      titles,
    );
    expect(
      projectManagedFedUpdatesView(
        projectFedAnnouncementView(current, ""),
        comparison,
        "new",
      ).view.visibleItems,
    ).toEqual([current.items[1], current.items[2], current.items[3]]);
  });
  it.each(["same", "empty"] as const)(
    "keeps a valid zero-result %s comparison distinct from unavailability",
    (mode) => {
      const previous = packet([item("a")]);
      const current = packet(
        mode === "empty" ? [] : [item("a", "Revised title")],
      );
      const titles = projectFedAnnouncementView(current, "");
      const result = projectManagedFedUpdatesView(
        titles,
        compareManagedFedResponses(previous, current),
        "new",
      );
      expect(result.available).toBe(true);
      expect(result.refreshView).toBe("new");
      expect(result.view.visibleItems).toEqual([]);
      expect(result.view.response).toBe(current);
    },
  );
  it("refuses an equal-content comparison for another response and does not restore its subset later", () => {
    const original = packet([item("a"), item("b")]);
    const replacement = packet([item("a"), item("b")]);
    expect(original).toEqual(replacement);
    const stale = compareManagedFedResponses(packet([]), original);
    const titles = projectFedAnnouncementView(replacement, "policy");
    const result = projectManagedFedUpdatesView(titles, stale, "new");
    expect(result.view).toBe(titles);
    expect(result.available).toBe(false);
    expect(result.refreshView).toBe("all");
  });
});
