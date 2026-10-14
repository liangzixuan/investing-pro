import { describe, expect, it, vi } from "vitest";
import {
  parseManagedEconomicCalendar,
  PERSONAL_BEA_CALENDAR_SOURCE,
  type PersonalEconomicCalendarDto,
} from "@research-cockpit/contracts";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import {
  getBeaReleaseNoteEvidence,
  type BeaReleaseNoteCapture,
} from "./managed-bea-release-note";

function capture(
  raw = economicCalendarFixture(),
  index = 0,
): BeaReleaseNoteCapture {
  const response = parseManagedEconomicCalendar(raw)!;
  expect(response).not.toBeNull();
  return { response, event: response.events[index]!, showingPrevious: false };
}

const golden =
  "Scheduled BEA release: Invented GDP. " +
  "Scheduled time: Thu, Oct 29, 2026, 8:30 AM EDT (America/New_York); 2026-10-29T12:30:00.000Z (UTC). " +
  `Source: U.S. Bureau of Economic Analysis; official schedule ${PERSONAL_BEA_CALENDAR_SOURCE.scheduleUrl}. ` +
  "Original agenda retrieved at: 2026-10-20T18:00:00.000Z (UTC). " +
  "Loaded window: 2026-10-20T18:00:00.000Z inclusive to 2026-11-19T18:00:00.000Z exclusive (UTC). " +
  "Only schedule metadata was loaded; forecasts and released values were not supplied. " +
  "Scheduled times may change; this reference does not confirm a release or company relevance. " +
  "Evidence dates are unchanged; this action does not refresh sources.";

describe("BEA scheduled release note evidence", () => {
  it("keeps the complete independent golden, original window and exact admitted event", () => {
    const selected = capture({
      ...economicCalendarFixture(),
      events: [
        { series: "Invented GDP", scheduledAt: "2026-10-29T12:30:00.000Z" },
      ],
    });
    expect(getBeaReleaseNoteEvidence(selected)).toEqual({
      excerpt: golden,
      reason: null,
    });
    expect(Object.isFrozen(selected.response)).toBe(true);
    expect(Object.isFrozen(selected.event)).toBe(true);
    expect([...golden].length).toBeLessThan(1000);
  });

  it.each([
    ["2026-10-30T12:30:00.000Z", "Fri, Oct 30, 2026, 8:30 AM EDT"],
    ["2026-11-02T13:30:00.000Z", "Mon, Nov 2, 2026, 8:30 AM EST"],
    ["2026-11-02T04:30:00.000Z", "Sun, Nov 1, 2026, 11:30 PM EST"],
  ])("uses the Eastern date and offset for %s", (scheduledAt, readable) => {
    const selected = capture({
      ...economicCalendarFixture(),
      events: [{ series: "Invented release", scheduledAt }],
    });
    expect(getBeaReleaseNoteEvidence(selected).excerpt).toContain(
      `Scheduled time: ${readable} (America/New_York); ${scheduledAt} (UTC).`,
    );
  });

  it("keeps simultaneous different series distinct without changing their times", () => {
    const raw = {
      ...economicCalendarFixture(),
      events: [
        { series: "Invented GDP", scheduledAt: "2026-10-29T12:30:00.000Z" },
        { series: "Invented Trade", scheduledAt: "2026-10-29T12:30:00.000Z" },
      ],
    };
    const first = capture(raw);
    const second = { ...first, event: first.response.events[1]! };
    expect(getBeaReleaseNoteEvidence(first).excerpt).toBe(golden);
    expect(getBeaReleaseNoteEvidence(second).excerpt).toBe(
      golden.replace("Invented GDP", "Invented Trade"),
    );
  });

  it("labels a retained schedule without rewriting dates or claiming a release after time passes", () => {
    const selected = {
      ...capture({
        ...economicCalendarFixture(),
        events: [
          { series: "Invented GDP", scheduledAt: "2026-10-29T12:30:00.000Z" },
        ],
      }),
      showingPrevious: true,
    };
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2099-01-01T00:00:00.000Z"));
      expect(getBeaReleaseNoteEvidence(selected).excerpt).toBe(
        golden.replace(
          "Evidence dates are unchanged;",
          "Retained previous agenda; a newer schedule was not confirmed. Evidence dates are unchanged;",
        ),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["Cafe\u0301 <GDP> & 東京", "😀".repeat(128), "界".repeat(256)])(
    "keeps complete raw Unicode series without normalization or clipping: %s",
    (series) => {
      const selected = capture({
        ...economicCalendarFixture(),
        events: [{ series, scheduledAt: "2026-10-29T12:30:00.000Z" }],
      });
      const evidence = getBeaReleaseNoteEvidence(selected);
      expect(evidence.reason).toBeNull();
      expect(evidence.excerpt).toContain(`Scheduled BEA release: ${series}.`);
      expect([...evidence.excerpt!].length).toBeLessThan(2000);
      expect(selected.event.series).toBe(series);
    },
  );

  it.each(["copy", "other packet", "empty packet"])(
    "refuses an event from %s",
    (kind) => {
      const selected = capture();
      const response =
        kind === "empty packet" ? capture().response : selected.response;
      const evidence = getBeaReleaseNoteEvidence({
        ...selected,
        response:
          kind === "empty packet"
            ? parseManagedEconomicCalendar({ ...response, events: [] })!
            : response,
        event: kind === "copy" ? { ...selected.event } : capture().event,
      });
      expect(evidence).toEqual({
        excerpt: null,
        reason: "Choose a release from the current loaded agenda.",
      });
    },
  );

  it.each([
    [
      "source",
      { source: { ...PERSONAL_BEA_CALENDAR_SOURCE, name: "Invented agency" } },
    ],
    [
      "window",
      {
        window: {
          fromInclusive: "2026-10-21T18:00:00.000Z",
          toExclusive: "2026-11-19T18:00:00.000Z",
        },
      },
    ],
    ["clock", { fetchedAt: "2026-02-30T00:00:00.000Z" }],
    [
      "outside window",
      {
        events: [
          { series: "Invented", scheduledAt: "2026-11-19T18:00:00.000Z" },
        ],
      },
    ],
    [
      "control",
      {
        events: [
          { series: "GDP\u0000", scheduledAt: "2026-10-29T12:30:00.000Z" },
        ],
      },
    ],
    [
      "overlong series",
      {
        events: [
          { series: "x".repeat(257), scheduledAt: "2026-10-29T12:30:00.000Z" },
        ],
      },
    ],
  ])(
    "refuses invalid %s without a partial reference",
    (_label, replacement) => {
      const selected = capture();
      const response = {
        ...selected.response,
        ...replacement,
      } as PersonalEconomicCalendarDto;
      expect(getBeaReleaseNoteEvidence({ ...selected, response })).toEqual({
        excerpt: null,
        reason: "This scheduled release reference could not be verified.",
      });
    },
  );

  it("refuses an unverified retained qualifier", () => {
    const selected = {
      ...capture(),
      showingPrevious: "true",
    } as unknown as BeaReleaseNoteCapture;
    expect(getBeaReleaseNoteEvidence(selected)).toEqual({
      excerpt: null,
      reason: "This scheduled release reference could not be verified.",
    });
  });
});
