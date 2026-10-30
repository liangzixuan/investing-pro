import {
  parseManagedPortfolio,
  managedEodHistoryWindow,
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryRequestDto,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import type { SharedNativeFixture } from "./fixture";

export const portfolioComparisonNote =
  "Independent unsaved Portfolio comparison note · Café 東京 📈 <script>literal</script>";
export const portfolioComparisonIds = Object.freeze({
  a: "listing-zero",
  c: "listing-zero-c",
  past: "listing-past",
  added: "listing-new",
});
export function portfolioComparisonIdentities(base: SharedNativeFixture) {
  const first = base.researchCoverage.listings[0]!.listing;
  return [
    {
      ...first,
      issuerName: "Invented Zero <script>literal</script> & Café 東京",
    },
    {
      ...first,
      issuerName: "Invented Zero <script>literal</script> & Café 東京",
      listingId: portfolioComparisonIds.c,
      securityId: "security-zero-c",
      securityName: "Zero Class C",
      shareClassId: "class-zero-c",
      shareClassName: "Class C",
      symbol: "ZERO.C",
    },
    {
      ...first,
      issuerId: "issuer-past",
      issuerName: "Invented Past & Company",
      listingId: portfolioComparisonIds.past,
      securityId: "security-past",
      securityName: "Past common shares",
      shareClassId: "class-past",
      shareClassName: "Common",
      symbol: "PAST",
    },
    {
      ...first,
      issuerId: "issuer-new",
      issuerName: "Invented New Unpriced Company",
      listingId: portfolioComparisonIds.added,
      securityId: "security-new",
      securityName: "New common shares",
      shareClassId: "class-new",
      shareClassName: "Common",
      symbol: "NEW",
    },
  ];
}
export function portfolioComparisonLedger(
  base: SharedNativeFixture,
  current: boolean,
) {
  const identities = portfolioComparisonIdentities(base);
  const dto = parseManagedPortfolio({
    version: 3,
    payload: {
      schemaVersion: 3,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: base.researchCoverage.catalogSnapshotSha256,
      basisMethod: "fifo_with_opening_pool",
      identities: identities.filter(
        (r) =>
          r.listingId !==
          (current
            ? portfolioComparisonIds.past
            : portfolioComparisonIds.added),
      ),
      opening: {
        asOfDate: current ? "2026-10-05" : "2026-10-04",
        cashUsd: current ? "0.00" : "100.00",
        holdings: [
          {
            listingId: portfolioComparisonIds.a,
            shares: current ? "3.500000" : "2.000000",
            totalCostBasisUsd: current ? "70.00" : "40.00",
            confirmedOn: current ? "2026-10-05" : "2026-10-02",
          },
          {
            listingId: portfolioComparisonIds.c,
            shares: current ? "1.250000" : "1.000000",
            totalCostBasisUsd: null,
            confirmedOn: "2026-10-03",
          },
          {
            listingId: current
              ? portfolioComparisonIds.added
              : portfolioComparisonIds.past,
            shares: current ? "2.000000" : "4.000000",
            totalCostBasisUsd: null,
            confirmedOn: current ? "2026-10-05" : "2026-10-04",
          },
        ],
      },
      transactions: [],
    },
  });
  if (!dto?.payload)
    throw new Error("Invalid invented saved Portfolio comparison ledger");
  return dto;
}
export function portfolioComparisonPacket(
  request: ManagedEodHistoryRequestDto,
  security: ManagedEodIdentity,
  current: boolean,
  observedDate: string,
  now = Date.now(),
) {
  const requestStartedAt = new Date(now - 2000).toISOString();
  const prior = new Date(
    Date.parse(observedDate + "T00:00:00.000Z") - 2 * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const close =
    security.listingId === portfolioComparisonIds.a
      ? current
        ? "25.5"
        : "20.25"
      : security.listingId === portfolioComparisonIds.c
        ? current
          ? "50"
          : "40"
        : "10";
  const response = parseManagedEodHistoryResponse(
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: request.catalogSnapshotSha256,
      security,
      range: "1m",
      provider: "Tiingo",
      currency: "USD",
      priceBasis: "raw_close",
      window: managedEodHistoryWindow(requestStartedAt, "1m"),
      requestStartedAt,
      completedAt: new Date(now - 1000).toISOString(),
      rows: [
        { date: prior, close: "1" },
        { date: observedDate, close },
      ],
    },
    request,
  );
  if (!response)
    throw new Error("Invalid invented saved Portfolio comparison close packet");
  return response;
}
