import { describe, expect, it } from "vitest";
import { parseManagedMonetaryAnnouncements } from "@research-cockpit/contracts";
import { fedAnnouncementsFixture } from "../../clerk-trial/fed-announcements-fixture";
import { projectFedAnnouncementView } from "./fed-announcement-view";

const packet = parseManagedMonetaryAnnouncements({
  ...fedAnnouncementsFixture(),
  availableItemCount: 2,
  items: [
    {
      ...fedAnnouncementsFixture().items[0]!,
      title: "Café 東京 📈 policy  decision",
    },
    {
      ...fedAnnouncementsFixture().items[1]!,
      title: "Policy   decision <img>",
    },
  ],
});
if (!packet) throw new Error("Invalid invented title-search packet");

describe("loaded Fed title view", () => {
  it.each(["", " \t\n "])(
    "returns the original full list for blank query %j",
    (query) => {
      const view = projectFedAnnouncementView(packet, query);
      expect(view.response).toBe(packet);
      expect(view.query).toBe(query);
      expect(view.visibleItems).toBe(packet.items);
      expect(view.response!.availableItemCount).toBe(2);
    },
  );
  it.each(["POLICY DECISION", "  policy \t\n decision "])(
    "matches a normalized phrase %j without changing items or order",
    (query) => {
      const view = projectFedAnnouncementView(packet, query);
      expect(view.visibleItems).toEqual(packet.items);
      expect(view.visibleItems[0]).toBe(packet.items[0]);
      expect(view.visibleItems[1]).toBe(packet.items[1]);
      expect(packet.items[0]!.title).toBe("Café 東京 📈 policy  decision");
      expect(packet.items[1]!.title).toBe("Policy   decision <img>");
    },
  );
  it.each([
    "東京 📈",
    "<img>",
    "no match",
    "decision policy",
    "monetary20261019",
  ])("searches titles only for %j", (query) => {
    const view = projectFedAnnouncementView(packet, query);
    const expected =
      query === "東京 📈"
        ? [packet.items[0]]
        : query === "<img>"
          ? [packet.items[1]]
          : [];
    expect(view.visibleItems).toEqual(expected);
    expect(view.response).toBe(packet);
  });
  it("has no items for an unloaded or empty response", () => {
    expect(projectFedAnnouncementView(null, "policy").visibleItems).toEqual([]);
    const empty = parseManagedMonetaryAnnouncements({
      ...fedAnnouncementsFixture(),
      availableItemCount: 0,
      items: [],
    })!;
    expect(projectFedAnnouncementView(empty, "policy").visibleItems).toEqual(
      [],
    );
  });
});
