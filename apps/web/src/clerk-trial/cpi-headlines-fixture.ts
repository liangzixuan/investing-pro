import {
  MANAGED_CPI_HEADLINE_SOURCE,
  type ManagedCpiHeadlinesDto,
} from "@research-cockpit/contracts";
/** Invented metadata only; never a retained provider body. */
export function cpiHeadlinesFixture(): ManagedCpiHeadlinesDto {
  return {
    schemaVersion: "1.0.0",
    source: MANAGED_CPI_HEADLINE_SOURCE,
    fetchedAt: "2026-10-28T19:00:00.000Z",
    feedUpdatedAt: "2026-10-03T06:45:09.000000001+02:00",
    availableItemCount: 2,
    items: [
      {
        sourceId: "invented-cpi-known",
        title: "Invented CPI headline: prices and household plans",
        url: "https://www.bls.gov/news.release/archives/cpi_10012026.htm",
        publishedAt: "2026-10-01T07:15:22.123456-04:00",
        updatedAt: "2026-10-02T09:45:10.1200+05:30",
      },
      {
        sourceId: "invented-cpi-unknown",
        title: "Invented CPI headline without source clocks",
        url: "https://www.bls.gov/news.release/archives/cpi_09012026.htm",
        publishedAt: null,
        updatedAt: null,
      },
    ],
  };
}
