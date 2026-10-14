import { describe, expect, it } from "vitest";
import {
  parseManagedMonetaryAnnouncements,
  PERSONAL_FED_MONETARY_SOURCE,
  type PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import {
  getFedAnnouncementNoteEvidence,
  type FedAnnouncementNoteCapture,
} from "./managed-fed-announcement-note";

function capture(
  value: PersonalMonetaryAnnouncementsDto = fedAnnouncementsFixture(),
  index = 0,
): FedAnnouncementNoteCapture {
  const response = parseManagedMonetaryAnnouncements(value)!;
  expect(response).not.toBeNull();
  return { response, item: response.items[index]!, showingPrevious: false };
}

describe("Fed announcement note evidence", () => {
  it("keeps the complete admitted reference and original source clocks", () => {
    const selected = capture();
    expect(getFedAnnouncementNoteEvidence(selected)).toEqual({
      excerpt:
        "Observed Federal Reserve announcement: Invented monetary policy announcement. " +
        "Announcement URL: https://www.federalreserve.gov/newsevents/pressreleases/monetary20261019a.htm. " +
        "Source publication time: 2026-10-19T18:00:00.000Z (UTC). " +
        `Source: Board of Governors of the Federal Reserve System; monetary-policy feed ${PERSONAL_FED_MONETARY_SOURCE.feedUrl}. ` +
        "Original feed retrieved at: 2026-10-20T18:00:00.000Z (UTC). " +
        "Only feed metadata was loaded; article contents were not fetched. " +
        "Evidence dates are unchanged; this action does not refresh sources.",
      reason: null,
    });
    expect(Object.isFrozen(selected.response)).toBe(true);
    expect(Object.isFrozen(selected.item)).toBe(true);
  });

  it("keeps unknown publication time and qualifies the retained original feed", () => {
    const selected = {
      ...capture(fedAnnouncementsFixture(), 1),
      showingPrevious: true,
    };
    const evidence = getFedAnnouncementNoteEvidence(selected);
    expect(evidence.reason).toBeNull();
    expect(evidence.excerpt).toContain("Source publication time: unknown.");
    expect(evidence.excerpt).toContain(
      "Original feed retrieved at: 2026-10-20T18:00:00.000Z (UTC).",
    );
    expect(evidence.excerpt).toContain(
      "Retained previous feed; a newer feed was not confirmed.",
    );
    expect(evidence.excerpt).not.toContain("2026-10-18T");
  });

  it("preserves a future source time without substituting a URL date or current clock", () => {
    const raw = fedAnnouncementsFixture();
    const selected = capture({
      ...raw,
      items: [
        { ...raw.items[0]!, publishedAt: "2099-01-02T03:04:05.000Z" },
        raw.items[1]!,
      ],
    });
    expect(getFedAnnouncementNoteEvidence(selected).excerpt).toContain(
      "Source publication time: 2099-01-02T03:04:05.000Z (UTC).",
    );
  });

  it.each([
    "Cafe\u0301 <policy> & outlook 😀",
    "😀".repeat(128),
    "界".repeat(256),
  ])(
    "preserves the exact valid title without normalization or truncation: %s",
    (title) => {
      const raw = fedAnnouncementsFixture();
      const selected = capture({
        ...raw,
        items: [{ ...raw.items[0]!, title }, raw.items[1]!],
      });
      const evidence = getFedAnnouncementNoteEvidence(selected);
      expect(evidence.reason).toBeNull();
      expect(evidence.excerpt).toContain(
        `Observed Federal Reserve announcement: ${title}.`,
      );
      expect(evidence.excerpt).toContain(
        `Announcement URL: ${selected.item.url}.`,
      );
      expect([...evidence.excerpt!].length).toBeLessThan(2000);
      expect(selected.item.title).toBe(title);
    },
  );

  it.each(["copy", "another admitted packet"])(
    "refuses an item from %s",
    (kind) => {
      const selected = capture();
      const item = kind === "copy" ? { ...selected.item } : capture().item;
      expect(getFedAnnouncementNoteEvidence({ ...selected, item })).toEqual({
        excerpt: null,
        reason: "Choose an announcement from the current loaded feed.",
      });
    },
  );

  it.each([
    [
      "source",
      {
        source: {
          ...fedAnnouncementsFixture().source,
          name: "Invented source",
        },
      },
    ],
    [
      "URL",
      {
        items: [
          {
            ...fedAnnouncementsFixture().items[0]!,
            url: "https://example.com/article",
          },
          fedAnnouncementsFixture().items[1]!,
        ],
      },
    ],
    ["count", { availableItemCount: 3 }],
    ["order", { items: [...fedAnnouncementsFixture().items].reverse() }],
    ["clock", { fetchedAt: "2026-02-30T00:00:00.000Z" }],
    [
      "control character",
      {
        items: [
          {
            ...fedAnnouncementsFixture().items[0]!,
            title: "Policy\u0000update",
          },
          fedAnnouncementsFixture().items[1]!,
        ],
      },
    ],
    [
      "overlong title",
      {
        items: [
          { ...fedAnnouncementsFixture().items[0]!, title: "x".repeat(257) },
          fedAnnouncementsFixture().items[1]!,
        ],
      },
    ],
  ])("refuses an invalid %s without partial text", (_label, replacement) => {
    const response = {
      ...fedAnnouncementsFixture(),
      ...replacement,
    } as PersonalMonetaryAnnouncementsDto;
    expect(
      getFedAnnouncementNoteEvidence({
        response,
        item: response.items[0]!,
        showingPrevious: false,
      }),
    ).toEqual({
      excerpt: null,
      reason: "This announcement reference could not be verified.",
    });
  });

  it("refuses a missing item and a forged retained qualifier", () => {
    const selected = capture();
    expect(
      getFedAnnouncementNoteEvidence({
        ...selected,
        item: undefined,
      } as unknown as FedAnnouncementNoteCapture).excerpt,
    ).toBeNull();
    expect(
      getFedAnnouncementNoteEvidence({
        ...selected,
        showingPrevious: "false",
      } as unknown as FedAnnouncementNoteCapture),
    ).toEqual({
      excerpt: null,
      reason: "This announcement reference could not be verified.",
    });
  });

  it("does not treat the available feed count as additional loaded evidence", () => {
    const selected = capture();
    const empty = parseManagedMonetaryAnnouncements({
      ...selected.response,
      availableItemCount: 0,
      items: [],
    })!;
    expect(
      getFedAnnouncementNoteEvidence({ ...selected, response: empty }).excerpt,
    ).toBeNull();
  });
});
