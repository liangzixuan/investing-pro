import { describe, expect, it } from "vitest";
import { normalizeBlsCalendar } from "./bls-calendar-normalization";

const NOW = "2026-10-20T00:00:00.000Z";
const zone = `BEGIN:VTIMEZONE
TZID:US-Eastern
BEGIN:DAYLIGHT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
DTSTART:20070311T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZNAME:EDT
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
DTSTART:20071104T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZNAME:EST
END:STANDARD
END:VTIMEZONE`;
const event = (
  uid: string,
  date = "DTSTART:20261021T140000Z",
  summary = "Invented release",
  extra = "",
) =>
  `BEGIN:VEVENT\nUID:${uid}\n${date}\nSUMMARY:${summary}\n${extra}\nEND:VEVENT`;
const calendar = (events: string[], declaration = "") =>
  `BEGIN:VCALENDAR\nVERSION:2.0\n${declaration}\n${events.join("\n")}\nEND:VCALENDAR\n`;

describe("BLS publisher calendar normalization", () => {
  it("normalizes publisher name padding without accepting blank names", async () => {
    const result = await normalizeBlsCalendar(
      calendar([event("padded", undefined, "  Invented release  ")]),
      NOW,
    );
    expect(result.events[0]?.series).toBe("Invented release");
    await expect(
      normalizeBlsCalendar(calendar([event("blank", undefined, "   ")]), NOW),
    ).rejects.toThrow();
  });
  it("admits the declared legacy zone with correct summer and winter instants", async () => {
    const result = await normalizeBlsCalendar(
      calendar(
        [
          event("fall-before", "DTSTART;TZID=US-Eastern:20261021T100000"),
          event("fall-last", "DTSTART;TZID=US-Eastern:20261030T083000"),
          event("winter", "DTSTART;TZID=US-Eastern:20261102T083000"),
        ],
        zone,
      ),
      NOW,
    );
    expect(result.events.map((item) => item.scheduledAt)).toEqual([
      "2026-10-21T14:00:00.000Z",
      "2026-10-30T12:30:00.000Z",
      "2026-11-02T13:30:00.000Z",
    ]);
    expect(result.source.scheduleUrl).toBe("https://www.bls.gov/schedule/");
  });
  it("uses IANA spring DST and refuses nonexistent or ambiguous local times", async () => {
    const result = await normalizeBlsCalendar(
      calendar([
        event("before", "DTSTART;TZID=America/New_York:20260306T083000"),
        event("after", "DTSTART;TZID=America/New_York:20260309T083000"),
      ]),
      "2026-03-01T00:00:00.000Z",
    );
    expect(result.events.map((item) => item.scheduledAt)).toEqual([
      "2026-03-06T13:30:00.000Z",
      "2026-03-09T12:30:00.000Z",
    ]);
    for (const date of ["20260308T023000", "20261101T013000"]) {
      await expect(
        normalizeBlsCalendar(
          calendar([event("bad", `DTSTART;TZID=America/New_York:${date}`)]),
          NOW,
        ),
      ).rejects.toThrow();
    }
  });
  it("keeps different simultaneous releases, decodes text and ignores untrusted links/HTML", async () => {
    const result = await normalizeBlsCalendar(
      calendar([
        event("a", undefined, "Zulu"),
        event("b", undefined, "Alpha\\, beta"),
        event("duplicate-pair", undefined, "Zulu"),
        event("cancelled", undefined, "Cancelled", "STATUS:CANCELLED"),
        event(
          "payload",
          "DTSTART:20261022T140000Z",
          "Literal US-Eastern",
          "DESCRIPTION:<script>bad</script>\nURL:https://untrusted.invalid/\nX-ALT-DESC:<b>ignored</b>",
        ),
      ]),
      NOW,
    );
    expect(result.events.map((item) => item.series)).toEqual([
      "Alpha, beta",
      "Zulu",
      "Literal US-Eastern",
    ]);
    expect(JSON.stringify(result)).not.toContain("untrusted");
    expect(JSON.stringify(result)).not.toContain("script");
  });
  it("keeps the inclusive start and exclusive 30 elapsed-day end", async () => {
    const result = await normalizeBlsCalendar(
      calendar([
        event("before", "DTSTART:20261019T235959Z"),
        event("start", "DTSTART:20261020T000000Z"),
        event("last", "DTSTART:20261118T235959Z"),
        event("end", "DTSTART:20261119T000000Z"),
      ]),
      NOW,
    );
    expect(result.events.map((item) => item.scheduledAt)).toEqual([
      NOW,
      "2026-11-18T23:59:59.000Z",
    ]);
    expect(result.window.toExclusive).toBe("2026-11-19T00:00:00.000Z");
  });
  it("lets node-ical decode folded and escaped summary text", async () => {
    const result = await normalizeBlsCalendar(
      calendar([
        event("fold", undefined, "Invented \\,\n release\\; detail\\\\end"),
      ]),
      NOW,
    );
    expect(result.events[0]?.series).toBe("Invented ,release; detail\\end");
  });
  it.each([
    [
      "missing legacy declaration",
      calendar([event("x", "DTSTART;TZID=US-Eastern:20261021T100000")]),
    ],
    [
      "changed DST rule",
      calendar([event("x")], zone.replace("BYDAY=2SU", "BYDAY=1SU")),
    ],
    ["duplicate zone", calendar([event("x")], zone + "\n" + zone)],
    [
      "unknown zone",
      calendar([event("x", "DTSTART;TZID=Unknown:20261021T100000")]),
    ],
    ["floating time", calendar([event("x", "DTSTART:20261021T100000")])],
    ["date only", calendar([event("x", "DTSTART;VALUE=DATE:20261021")])],
    ["invalid date", calendar([event("x", "DTSTART:20260230T100000Z")])],
    ["duplicate UID", calendar([event("x"), event("x")])],
    [
      "duplicate DTSTART",
      calendar([event("x", undefined, "A", "DTSTART:20261022T000000Z")]),
    ],
    [
      "nested alarm",
      calendar([event("x", undefined, "A", "BEGIN:VALARM\nEND:VALARM")]),
    ],
    ["recurrence", calendar([event("x", undefined, "A", "RRULE:FREQ=DAILY")])],
    [
      "override",
      calendar([event("x", undefined, "A", "RECURRENCE-ID:20261021T140000Z")]),
    ],
    ["tentative", calendar([event("x", undefined, "A", "STATUS:TENTATIVE")])],
    ["missing end", calendar([event("x")]).replace("END:VEVENT", "")],
    ["control summary", calendar([event("x", undefined, "Bad\\nname")])],
    ["oversized name", calendar([event("x", undefined, "a".repeat(257))])],
    ["no events", calendar([])],
  ])("rejects the whole schedule: %s", async (_name, source) => {
    await expect(normalizeBlsCalendar(source, NOW)).rejects.toThrow();
  });
  it("refuses normalized event overflow without returning a partial schedule", async () => {
    const events = Array.from({ length: 513 }, (_, index) =>
      event(`e${index}`, undefined, `Release ${index}`),
    );
    await expect(normalizeBlsCalendar(calendar(events), NOW)).rejects.toThrow();
  });
});
