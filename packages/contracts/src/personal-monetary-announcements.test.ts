import { describe, expect, it } from "vitest";
import {
  isPersonalMonetaryAnnouncementUrl,
  isPersonalMonetaryAnnouncementsDto,
  PERSONAL_FED_MONETARY_SOURCE,
} from "./personal-monetary-announcements";

const url = (letter = "a") =>
  `https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916${letter}.htm`;
function announcements() {
  return {
    schemaVersion: "1.0.0",
    source: { ...PERSONAL_FED_MONETARY_SOURCE },
    fetchedAt: "2026-09-27T04:40:21.558Z",
    availableItemCount: 3,
    items: [
      {
        title: "Board's announcement",
        url: url(),
        publishedAt: "2026-09-16T18:00:00.000Z" as string | null,
      },
      {
        title: "Board's announcement",
        url: url("b"),
        publishedAt: "2026-09-16T18:00:00.000Z" as string | null,
      },
      {
        title: "Announcement without a source time",
        url: url("c"),
        publishedAt: null as string | null,
      },
    ],
  };
}

describe("Federal Reserve announcement response contract", () => {
  it("admits equal dates, repeated titles, unknown time and a distinct retrieval instant", () => {
    const value = announcements();
    const before = structuredClone(value);
    expect(isPersonalMonetaryAnnouncementsDto(value)).toBe(true);
    expect(value).toEqual(before);
    expect(
      isPersonalMonetaryAnnouncementsDto({
        ...value,
        availableItemCount: 0,
        items: [],
      }),
    ).toBe(true);
  });

  it("admits the ten-item projection of up to 128 validated unique source items", () => {
    const value = announcements();
    value.availableItemCount = 128;
    value.items = Array.from({ length: 10 }, (_, index) => ({
      ...value.items[0]!,
      url: url(String.fromCharCode(97 + index)),
    }));
    expect(isPersonalMonetaryAnnouncementsDto(value)).toBe(true);
    expect(
      isPersonalMonetaryAnnouncementsDto({
        ...value,
        items: value.items.slice(1),
      }),
    ).toBe(false);
    expect(
      isPersonalMonetaryAnnouncementsDto({
        ...value,
        items: [...value.items, { ...value.items[0]!, url: url("k") }],
      }),
    ).toBe(false);
  });

  it.each([-1, 1.5, 129, NaN, Infinity, "3", null])(
    "rejects invalid available count %s",
    (availableItemCount) => {
      expect(
        isPersonalMonetaryAnnouncementsDto({
          ...announcements(),
          availableItemCount,
        }),
      ).toBe(false);
    },
  );

  it("rejects counts inconsistent with displayed items", () => {
    for (const availableItemCount of [0, 2, 4, 10]) {
      expect(
        isPersonalMonetaryAnnouncementsDto({
          ...announcements(),
          availableItemCount,
        }),
      ).toBe(false);
    }
  });

  it("rejects ascending known times, known times after unknowns and duplicate URLs", () => {
    const value = announcements();
    value.items[1]!.publishedAt = "2026-09-17T18:00:00.000Z";
    expect(isPersonalMonetaryAnnouncementsDto(value)).toBe(false);
    expect(
      isPersonalMonetaryAnnouncementsDto({
        ...announcements(),
        items: announcements().items.reverse(),
      }),
    ).toBe(false);
    const duplicate = announcements();
    duplicate.items[1]!.url = duplicate.items[0]!.url;
    expect(isPersonalMonetaryAnnouncementsDto(duplicate)).toBe(false);
  });

  it.each([
    "2026-02-30T18:00:00.000Z",
    "2026-09-16T18:00:00Z",
    "2026-09-16T14:00:00.000-04:00",
    "2026-09-16T18:00:00.001Z",
    "2026-09-16T18:00:60.000Z",
    "0999-09-16T18:00:00.000Z",
    "",
    undefined,
  ])("rejects invalid or non-whole-second publication %s", (publishedAt) => {
    const value = announcements();
    expect(
      isPersonalMonetaryAnnouncementsDto({
        ...value,
        items: [{ ...value.items[0], publishedAt }, ...value.items.slice(1)],
      }),
    ).toBe(false);
  });

  it("admits future source instants without replacing them with retrieval time", () => {
    const value = announcements();
    value.items[0]!.publishedAt = "2027-01-01T00:00:00.000Z";
    expect(isPersonalMonetaryAnnouncementsDto(value)).toBe(true);
  });

  it.each(["2026-02-30T00:00:00.000Z", "2026-09-27T04:40:21Z", null])(
    "requires a real canonical retrieval instant %s",
    (fetchedAt) => {
      expect(
        isPersonalMonetaryAnnouncementsDto({ ...announcements(), fetchedAt }),
      ).toBe(false);
    },
  );

  it.each([
    "",
    " Leading",
    "Trailing ",
    "Line\nbreak",
    "Direction\u202e",
    "Lone\ud800",
    "x".repeat(257),
  ])("rejects unsafe or unbounded title %j", (title) => {
    const value = announcements();
    value.items[0]!.title = title;
    expect(isPersonalMonetaryAnnouncementsDto(value)).toBe(false);
  });

  it("preserves decoded ordinary Unicode and literal markup as text", () => {
    const value = announcements();
    value.items[0]!.title = "Board’s policy — café 😀 <not HTML>";
    expect(isPersonalMonetaryAnnouncementsDto(value)).toBe(true);
    value.items[0]!.title = "x".repeat(256);
    expect(isPersonalMonetaryAnnouncementsDto(value)).toBe(true);
  });

  it("requires exact keys and the fixed source at every level", () => {
    const value = announcements();
    for (const invalid of [
      null,
      [],
      {},
      { ...value, extra: true },
      { ...value, schemaVersion: "2.0.0" },
      { ...value, source: { ...value.source, extra: true } },
      { ...value, source: { ...value.source, timeZone: "UTC" } },
      {
        ...value,
        source: { ...value.source, feedUrl: "https://example.com/feed.xml" },
      },
      {
        ...value,
        items: [
          { ...value.items[0], description: "unwanted" },
          ...value.items.slice(1),
        ],
      },
      {
        ...value,
        items: [
          { title: "Missing date field", url: url() },
          ...value.items.slice(1),
        ],
      },
      { ...value, items: "not an array" },
    ])
      expect(isPersonalMonetaryAnnouncementsDto(invalid)).toBe(false);
    for (const key of Object.keys(PERSONAL_FED_MONETARY_SOURCE)) {
      expect(
        isPersonalMonetaryAnnouncementsDto({
          ...value,
          source: { ...value.source, [key]: "other" },
        }),
      ).toBe(false);
    }
  });
});

describe("Federal Reserve announcement URL identity", () => {
  it("admits only the literal canonical source location", () => {
    expect(isPersonalMonetaryAnnouncementUrl(url())).toBe(true);
  });
  it.each([
    url().replace("https:", "http:"),
    url().replace("www.", ""),
    url().replace(".gov/", ".gov.evil.example/"),
    url().replace(".gov/", ".gov:443/"),
    url().replace("https://", "https://user@"),
    `${url()}?x=1`,
    `${url()}#fragment`,
    ` ${url()}`,
    `${url()}\n`,
    url().replace("monetary", "%6donetary"),
    url().replace("pressreleases/", "pressreleases/../pressreleases/"),
    url().replace("https:", "HTTPS:"),
    url().replace("a.htm", "A.htm"),
    url().replace("monetary", "other"),
    "/newsevents/pressreleases/monetary20260916a.htm",
    "javascript:alert(1)",
    "x".repeat(2049),
    null,
  ])("rejects alternate or unsafe URL %s", (value) => {
    expect(isPersonalMonetaryAnnouncementUrl(value)).toBe(false);
    const dto = announcements();
    expect(
      isPersonalMonetaryAnnouncementsDto({
        ...dto,
        items: [{ ...dto.items[0], url: value }, ...dto.items.slice(1)],
      }),
    ).toBe(false);
  });
});
