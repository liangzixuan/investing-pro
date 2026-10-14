import {
  parseManagedEconomicCalendar,
  PERSONAL_BEA_CALENDAR_SOURCE,
  type PersonalEconomicCalendarDto,
  type PersonalEconomicCalendarEventDto,
} from "@research-cockpit/contracts";
import { formatBeaReleaseDate } from "../features/markets/bea-release-dates";

export interface BeaReleaseNoteCapture {
  readonly response: PersonalEconomicCalendarDto;
  readonly event: PersonalEconomicCalendarEventDto;
  readonly showingPrevious: boolean;
}

const time = new Intl.DateTimeFormat("en-US", {
  timeZone: PERSONAL_BEA_CALENDAR_SOURCE.timeZone,
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/** One exact loaded schedule reference; no source read or clock update. */
export function getBeaReleaseNoteEvidence(
  capture: BeaReleaseNoteCapture,
): { excerpt: string; reason: null } | { excerpt: null; reason: string } {
  if (
    !parseManagedEconomicCalendar(capture.response) ||
    typeof capture.showingPrevious !== "boolean"
  )
    return {
      excerpt: null,
      reason: "This scheduled release reference could not be verified.",
    };
  const { response, event, showingPrevious } = capture;
  if (!response.events.includes(event))
    return {
      excerpt: null,
      reason: "Choose a release from the current loaded agenda.",
    };
  const source = PERSONAL_BEA_CALENDAR_SOURCE;
  return {
    excerpt: [
      `Scheduled BEA release: ${event.series}.`,
      `Scheduled time: ${formatBeaReleaseDate(event.scheduledAt)}, ${time.format(new Date(event.scheduledAt))} (${source.timeZone}); ${event.scheduledAt} (UTC).`,
      `Source: ${source.name}; official schedule ${source.scheduleUrl}.`,
      `Original agenda retrieved at: ${response.fetchedAt} (UTC).`,
      `Loaded window: ${response.window.fromInclusive} inclusive to ${response.window.toExclusive} exclusive (UTC).`,
      "Only schedule metadata was loaded; forecasts and released values were not supplied.",
      "Scheduled times may change; this reference does not confirm a release or company relevance.",
      ...(showingPrevious
        ? ["Retained previous agenda; a newer schedule was not confirmed."]
        : []),
      "Evidence dates are unchanged; this action does not refresh sources.",
    ].join(" "),
    reason: null,
  };
}
