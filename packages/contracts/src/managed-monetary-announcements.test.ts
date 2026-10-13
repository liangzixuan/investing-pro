import { describe, expect, it } from "vitest";
import { PERSONAL_FED_MONETARY_SOURCE } from "./personal-monetary-announcements";
import {
  MANAGED_MONETARY_ANNOUNCEMENTS_LIMITS,
  parseManagedMonetaryAnnouncements,
} from "./managed-monetary-announcements";

function announcements() {
  return {
    schemaVersion: "1.0.0",
    source: { ...PERSONAL_FED_MONETARY_SOURCE },
    fetchedAt: "2026-10-11T12:00:00.000Z",
    availableItemCount: 2,
    items: [
      {
        title: "Invented monetary announcement",
        url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm",
        publishedAt: "2026-09-16T18:00:00.000Z" as string | null,
      },
      {
        title: "Invented announcement without publication time",
        url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916b.htm",
        publishedAt: null,
      },
    ],
  };
}

describe("managed Fed announcements ownership", () => {
  it("detaches and freezes validated data without changing exact Unicode or source times", () => {
    const input = announcements();
    input.items[0]!.title = "Invented Café 界 announcement";
    const expected = structuredClone(input);
    const parsed = parseManagedMonetaryAnnouncements(input);
    expect(parsed).toEqual(expected);
    expect(parsed).not.toBe(input);
    expect(parsed?.items).not.toBe(input.items);
    expect(parsed?.items[0]).not.toBe(input.items[0]);
    for (const value of [
      parsed,
      parsed?.source,
      parsed?.items,
      parsed?.items[0],
    ])
      expect(Object.isFrozen(value)).toBe(true);
    input.items[0]!.title = "Changed caller-owned text";
    input.items.pop();
    input.source.name = "Changed source" as typeof input.source.name;
    input.fetchedAt = "2026-10-12T00:00:00.000Z";
    expect(parsed).toEqual(expected);
  });

  it("keeps the strict source, complete item count, URL, time and field validation", () => {
    const value = announcements();
    for (const invalid of [
      null,
      {
        ...value,
        source: { ...value.source, feedUrl: "https://other.example" },
      },
      { ...value, description: "extra" },
      {
        ...value,
        items: [{ ...value.items[0], description: "extra" }, value.items[1]],
      },
      { ...value, items: [...value.items].reverse() },
      { ...value, items: value.items.slice(1) },
      { ...value, availableItemCount: 129 },
      { ...value, items: [value.items[0], value.items[0]] },
      { ...value, fetchedAt: "not-a-time" },
    ])
      expect(parseManagedMonetaryAnnouncements(invalid)).toBeNull();
    expect(
      parseManagedMonetaryAnnouncements({
        ...value,
        items: [],
        availableItemCount: 0,
      })?.items,
    ).toEqual([]);
  });

  it("retains distinct equal-time items and an unknown publication time", () => {
    const value = announcements();
    value.items.splice(1, 0, {
      ...value.items[0]!,
      url: value.items[0]!.url.replace("a.htm", "c.htm"),
    });
    value.availableItemCount = 3;
    expect(parseManagedMonetaryAnnouncements(value)).toEqual(value);
  });

  it("fits maximum valid Unicode titles and ten of 128 items inside the response cap", () => {
    const value = announcements();
    value.availableItemCount = 128;
    value.items = Array.from({ length: 10 }, (_, index) => ({
      ...value.items[0]!,
      title: "界".repeat(256),
      url: value.items[0]!.url.replace(
        "a.htm",
        `${String.fromCharCode(97 + index)}.htm`,
      ),
    }));
    const parsed = parseManagedMonetaryAnnouncements(value);
    expect(parsed).not.toBeNull();
    expect(
      new TextEncoder().encode(JSON.stringify(parsed)).byteLength,
    ).toBeLessThan(MANAGED_MONETARY_ANNOUNCEMENTS_LIMITS.responseBytes);
    value.items.push({
      ...value.items[0]!,
      url: value.items[0]!.url.replace("a.htm", "z.htm"),
    });
    expect(parseManagedMonetaryAnnouncements(value)).toBeNull();
  });
});
