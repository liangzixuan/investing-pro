import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { FollowupsReviewReportInput } from "./followups-review-report";

/** Invented complete capture input; no account, provider or saved owner data. */
export function followupsReviewReportFixture(
  count = 3,
): FollowupsReviewReportInput {
  const entries: ResearchFollowup[] = Array.from(
    { length: count },
    (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      catalogSnapshotSha256: `sha256:${String(index % 10).repeat(64)}`,
      listing: {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: `invented-issuer-${index}`,
        issuerName: `Invented issuer ${index + 1}`,
        listingId: `invented-listing-${index}`,
        securityId: `invented-security-${index}`,
        securityName: `Invented security ${index + 1}`,
        shareClassId: `invented-class-${index}`,
        shareClassName: `Class ${index + 1}`,
        symbol: `INV${index + 1}`,
      },
      check: `Question ${index + 1}: inspect stated capacity · Café 東京 📈`,
      dueOn: index === 2 ? "2027-01-15" : "2026-10-20",
      ...(index === 1
        ? { status: "completed" as const, completedOn: "2026-10-22" }
        : { status: "open" as const, completedOn: null }),
      result:
        index === 1 ? "Authored assessment: compare the original dates." : "",
    }),
  );
  return {
    capturedAt: "2026-10-26T03:04:05.678Z",
    draft: { schemaVersion: 1, entries },
    baseVersion: 7,
    dirty: true,
    currentCatalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
  };
}
