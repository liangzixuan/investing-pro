import {
  MANAGED_CPI_HEADLINE_SOURCE,
  type ManagedCpiHeadlinesDto,
} from "@research-cockpit/contracts";
export const CPI_FETCHED_AT = "2026-10-28T19:00:00.000Z";
export function cpiItem(index = 0) {
  return {
    sourceId: `invented-cpi-${index}`,
    title: `Invented café CPI headline ${index}`,
    url: `https://www.bls.gov/news.release/archives/cpi_10${String(index + 1).padStart(2, "0")}2026.htm`,
    publishedAt: "2026-10-01T07:50:31.2000001-04:00" as string | null,
    updatedAt: "2025-01-01T00:00:00Z" as string | null,
  };
}
export function cpiPacket(): ManagedCpiHeadlinesDto {
  return {
    schemaVersion: "1.0.0",
    source: MANAGED_CPI_HEADLINE_SOURCE,
    fetchedAt: CPI_FETCHED_AT,
    feedUpdatedAt: "2026-10-01T07:50:31.2-04:00",
    availableItemCount: 2,
    items: [cpiItem(), { ...cpiItem(1), publishedAt: null, updatedAt: null }],
  };
}
export function cpiEntry(index = 0) {
  const item = cpiItem(index);
  return `<entry><title>${item.title}</title><link href="${item.url}"/><id>${item.sourceId}</id><content>Excluded invented economic text</content><published>${item.publishedAt}</published><updated>${item.updatedAt}</updated><category>News Release</category></entry>`;
}
export function cpiAtom(entries = cpiEntry()) {
  return `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><id>bls.gov:feed:cpi</id><title>Consumer Price Index</title><subtitle>Excluded invented subtitle</subtitle><updated>2026-10-01T07:50:31.2-04:00</updated><logo>https://www.bls.gov/images/excluded.gif</logo><icon>https://www.bls.gov/favicon.ico</icon><author><name>Bureau of Labor Statistics Publications</name><uri>https://www.bls.gov</uri></author><rights>US Bureau of Labor Statistics</rights>${entries}</feed>`;
}
