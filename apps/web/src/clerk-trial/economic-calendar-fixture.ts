import {
  PERSONAL_BEA_CALENDAR_SOURCE,
  type PersonalEconomicCalendarDto,
} from "@research-cockpit/contracts";

export function economicCalendarFixture(): PersonalEconomicCalendarDto {
  return {
    schemaVersion: "1.0.0",
    source: PERSONAL_BEA_CALENDAR_SOURCE,
    fetchedAt: "2026-10-20T18:00:00.000Z",
    window: {
      fromInclusive: "2026-10-20T18:00:00.000Z",
      toExclusive: "2026-11-19T18:00:00.000Z",
    },
    events: [
      {
        series: "Invented October release",
        scheduledAt: "2026-10-30T12:30:00.000Z",
      },
      {
        series: "Invented November release",
        scheduledAt: "2026-11-02T13:30:00.000Z",
      },
    ],
  };
}
