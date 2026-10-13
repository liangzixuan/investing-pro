import {
  PERSONAL_FED_MONETARY_SOURCE,
  type PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";

/** Invented feed metadata for source-free client tests. */
export function fedAnnouncementsFixture(): PersonalMonetaryAnnouncementsDto {
  return {
    schemaVersion: "1.0.0",
    source: PERSONAL_FED_MONETARY_SOURCE,
    fetchedAt: "2026-10-20T18:00:00.000Z",
    availableItemCount: 2,
    items: [
      {
        title: "Invented monetary policy announcement",
        url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261019a.htm",
        publishedAt: "2026-10-19T18:00:00.000Z",
      },
      {
        title: "Invented announcement without a publication time",
        url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm",
        publishedAt: null,
      },
    ],
  };
}
