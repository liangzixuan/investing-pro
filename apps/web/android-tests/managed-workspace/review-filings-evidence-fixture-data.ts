import { parseManagedSecFilingsResponse } from "@research-cockpit/contracts";
import { inventedFilingsPacket } from "./filings-fixture";
import {
  parseManagedPortfolio,
  parseResearchFollowupsPayload,
  type ManagedEodIdentity,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
export const reviewFilingsIds = Object.freeze({
  goog: "invented-review-filings-goog",
  googl: "invented-review-filings-googl",
  apple: "invented-review-filings-aapl",
  outside: "invented-review-filings-alfa",
  later: "invented-review-filings-msft",
  completed: "invented-review-filings-ibm",
  mismatch: "invented-review-filings-nvda",
  catalog: "invented-review-filings-orcl",
});
export const reviewFilingsEntryIds = Object.freeze(
  Array.from(
    { length: 7 },
    (_, i) => `40000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  ),
);
export const reviewFilingsQuestions = Object.freeze([
  "Does the complete GOOG Class C holding still support its authored thesis? Café 東京 📈",
  "Which exact GOOGL Class A evidence changes this held-position check? Keep <script>invented</script> & all raw facts.",
  "This exact held NVDA check has no filings coverage; retain its complete raw assessment.",
  "Keep this later MSFT question and its complete independent result.",
  "Keep this previously completed IBM check and original completion date.",
  "This ALFA check is not a current holding; retain its independent assessment.",
  "A different catalog snapshot does not match the current held listing.",
]);
export function reviewFilingsIdentities(): readonly ManagedEodIdentity[] {
  return ["GOOG", "GOOGL", "AAPL", "ALFA", "MSFT", "IBM", "NVDA", "ORCL"].map(
    (symbol, index) => ({
      listingId: [
        reviewFilingsIds.goog,
        reviewFilingsIds.googl,
        reviewFilingsIds.apple,
        reviewFilingsIds.outside,
        reviewFilingsIds.later,
        reviewFilingsIds.completed,
        reviewFilingsIds.mismatch,
        reviewFilingsIds.catalog,
      ][index]!,
      issuerId:
        index < 2
          ? "invented-review-filings-alphabet"
          : "invented-review-filings-" + symbol.toLowerCase(),
      issuerName:
        index < 2
          ? "Invented Alphabet Holdings"
          : "Invented " + symbol + " Holdings",
      securityId: "invented-review-filings-security-" + symbol.toLowerCase(),
      securityName: "Invented " + symbol + " full security",
      shareClassId: "invented-review-filings-class-" + symbol.toLowerCase(),
      shareClassName: index === 0 ? "Class C" : "Class A",
      symbol,
      exchangeMic: "XNAS",
      country: "US",
      instrumentType: "common_stock",
    }),
  );
}
export function reviewFilingsLedger(digest: `sha256:${string}`) {
  const parsed = parseManagedPortfolio({
    version: 3,
    payload: {
      schemaVersion: 3,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: digest,
      basisMethod: "fifo_with_opening_pool",
      identities: reviewFilingsIdentities().filter(
        (x) => x.listingId !== reviewFilingsIds.outside,
      ),
      opening: {
        asOfDate: "2026-10-08",
        cashUsd: "1000.00",
        holdings: reviewFilingsIdentities()
          .filter((x) => x.listingId !== reviewFilingsIds.outside)
          .map((listing, index) => ({
            listingId: listing.listingId,
            shares: [
              "1.000001",
              "0.750001",
              "2.000000",
              "3.000000",
              "4.000000",
              "5.000000",
              "6.000000",
            ][index],
            totalCostBasisUsd: [
              "90.00",
              null,
              "80.00",
              "120.00",
              "160.00",
              "200.00",
              null,
            ][index],
            confirmedOn: [
              "2026-10-02",
              "2026-10-03",
              "2026-10-04",
              "2026-10-05",
              "2026-10-06",
              "2026-10-07",
              "2026-10-08",
            ][index],
          })),
      },
      transactions: [],
    },
  });
  if (!parsed?.payload) throw new Error("Invalid invented held-due ledger");
  return parsed;
}
export function reviewFilingsOriginal(
  digest: `sha256:${string}`,
  day: string,
): ResearchFollowupsPayload {
  const identities = reviewFilingsIdentities(),
    indices = [0, 1, 6, 4, 5, 3, 7];
  const parsed = parseResearchFollowupsPayload({
    schemaVersion: 1,
    entries: indices.map((i, index) => ({
      id: reviewFilingsEntryIds[index],
      listing: identities[i],
      catalogSnapshotSha256: index === 6 ? `sha256:${"f".repeat(64)}` : digest,
      check: reviewFilingsQuestions[index],
      dueOn: index === 1 ? day : index === 3 ? "2999-12-31" : "2000-01-01",
      status: index === 4 ? "completed" : "open",
      completedOn: index === 4 ? "2026-10-03" : null,
      result:
        index === 1
          ? "Original GOOGL result Café 東京 📈"
          : `Independent result ${index + 1} remains raw & complete.`,
    })),
  });
  if (!parsed) throw new Error("Invalid invented held-due checks");
  return parsed;
}
export function reviewFilingsExpected(
  original: ResearchFollowupsPayload,
  day: string,
): ResearchFollowupsPayload {
  return {
    ...original,
    entries: original.entries.map((entry, index) =>
      index < 3
        ? {
            ...entry,
            status: "completed",
            completedOn: day,
            result: index < 2 ? reviewFilingsResult(index) : entry.result,
          }
        : entry,
    ),
  };
}

export const reviewFilingsRaw = Object.freeze([
  "GOOG Class C authored assessment Café 東京 📈; raw <script>invented</script> & evidence.",
  "GOOGL Class A independent authored assessment Café 東京 📈; retain exact share class.",
]);
// Independent literal citation expectation; no production formatter call.
export function reviewFilingsCitation(index: number) {
  const symbol = index === 0 ? "GOOG" : "GOOGL",
    n = index === 0 ? "000001" : "000003",
    day = index === 0 ? "20" : "21",
    from = index === 0 ? "23" : "24";
  return `Observed SEC filing reference: ${symbol} (XNAS); CIK 0000000002; Form 10-Q; accession 0000000002-26-${n}; filed 2026-09-19; report date 2026-06-30; filing index https://www.sec.gov/Archives/edgar/data/2/0000000002-26-${n}-index.htm. Source: SEC Submissions; requested window 2026-06-${from} to 2026-09-${day}; original request started 2026-09-${day}T00:00:00.000Z; retrieved 2026-09-${day}T00:00:01.000Z; completed 2026-09-${day}T00:00:02.000Z. Only the current recent-filings object was checked; older continuation files were not loaded; complete window coverage is not established. The source lists older continuation files. Filing contents were not fetched. Evidence dates are unchanged; this action does not refresh sources.`;
}
export function reviewFilingsResult(index: number) {
  return `${reviewFilingsRaw[index]} ${reviewFilingsCitation(index)}`;
}
export function reviewFilingsPackets(digest: `sha256:${string}`) {
  return reviewFilingsIdentities()
    .slice(0, 2)
    .map((listing, index) => {
      const p = inventedFilingsPacket(listing),
        day = index === 0 ? "20" : "21";
      const value = parseManagedSecFilingsResponse(
        {
          ...p,
          catalogSnapshotSha256: digest,
          security: { ...listing, cik: "0000000002" },
          window: {
            ...p.window,
            fromDate: index === 0 ? "2026-06-23" : "2026-06-24",
            throughDate: `2026-09-${day}`,
          },
          requestStartedAt: `2026-09-${day}T00:00:00.000Z`,
          completedAt: `2026-09-${day}T00:00:02.000Z`,
          issuer: {
            ...p.issuer,
            cik: "0000000002",
            sourceUrl: "https://data.sec.gov/submissions/CIK0000000002.json",
            fetchedAt: `2026-09-${day}T00:00:01.000Z`,
            matchingFilings: 2,
            filings: p.issuer.filings.slice(0, 2).map((f, j) => {
              const accessionNumber = `0000000002-26-${String(index * 2 + j + 1).padStart(6, "0")}`;
              return {
                ...f,
                cik: "0000000002",
                accessionNumber,
                sourceUrl: `https://www.sec.gov/Archives/edgar/data/2/${accessionNumber}-index.htm`,
              };
            }),
          },
        },
        {
          schemaVersion: "1.0.0",
          catalogSnapshotSha256: digest,
          listingId: listing.listingId,
          symbol: listing.symbol,
        },
      );
      if (!value)
        throw new Error("Invalid invented retained-review filing packet");
      return value;
    });
}
