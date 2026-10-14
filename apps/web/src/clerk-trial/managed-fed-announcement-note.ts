import {
  parseManagedMonetaryAnnouncements,
  PERSONAL_FED_MONETARY_SOURCE,
  type PersonalMonetaryAnnouncementDto,
  type PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";

export interface FedAnnouncementNoteCapture {
  readonly response: PersonalMonetaryAnnouncementsDto;
  readonly item: PersonalMonetaryAnnouncementDto;
  readonly showingPrevious: boolean;
}

/** One exact loaded reference; no source read, draft mutation or clock update. */
export function getFedAnnouncementNoteEvidence(
  capture: FedAnnouncementNoteCapture,
): { excerpt: string; reason: null } | { excerpt: null; reason: string } {
  if (
    !parseManagedMonetaryAnnouncements(capture.response) ||
    typeof capture.showingPrevious !== "boolean"
  )
    return {
      excerpt: null,
      reason: "This announcement reference could not be verified.",
    };
  const { response, item, showingPrevious } = capture;
  if (!response.items.includes(item))
    return {
      excerpt: null,
      reason: "Choose an announcement from the current loaded feed.",
    };
  const source = PERSONAL_FED_MONETARY_SOURCE;
  return {
    excerpt: [
      `Observed Federal Reserve announcement: ${item.title}.`,
      `Announcement URL: ${item.url}.`,
      item.publishedAt === null
        ? "Source publication time: unknown."
        : `Source publication time: ${item.publishedAt} (UTC).`,
      `Source: ${source.name}; monetary-policy feed ${source.feedUrl}.`,
      `Original feed retrieved at: ${response.fetchedAt} (UTC).`,
      "Only feed metadata was loaded; article contents were not fetched.",
      ...(showingPrevious
        ? ["Retained previous feed; a newer feed was not confirmed."]
        : []),
      "Evidence dates are unchanged; this action does not refresh sources.",
    ].join(" "),
    reason: null,
  };
}
