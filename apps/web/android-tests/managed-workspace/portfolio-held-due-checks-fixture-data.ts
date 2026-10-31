import {
  parseManagedPortfolio,
  parseResearchFollowupsPayload,
  type ManagedEodIdentity,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
export const heldDueIds = Object.freeze({
  goog: "invented-held-due-goog",
  googl: "invented-held-due-googl",
  apple: "invented-held-due-aapl",
  outside: "invented-held-due-alfa",
  later: "invented-held-due-msft",
  completed: "invented-held-due-ibm",
  mismatch: "invented-held-due-nvda",
  catalog: "invented-held-due-orcl",
});
export const heldDueEntryIds = Object.freeze(
  Array.from(
    { length: 7 },
    (_, i) => `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  ),
);
export const heldDueQuestions = Object.freeze([
  "Does the complete GOOG Class C holding still support its authored thesis? Café 東京 📈",
  "Which exact GOOGL Class A evidence changes this held-position check? Keep <script>invented</script> & all raw facts.",
  "Keep this later MSFT question and its complete independent result.",
  "Keep this previously completed IBM check and original completion date.",
  "This ALFA check is not a current holding; retain its independent assessment.",
  "Same listing ID with a different security name is not the held identity.",
  "A different catalog snapshot does not match the current held listing.",
]);
export const heldDueAssessment =
  "Original GOOGL result Café 東京 📈; current authored assessment <script>invented</script> & full exact Class A retained. No financial source was loaded.";
export function heldDueIdentities(): readonly ManagedEodIdentity[] {
  return ["GOOG", "GOOGL", "AAPL", "ALFA", "MSFT", "IBM", "NVDA", "ORCL"].map(
    (symbol, index) => ({
      listingId: [
        heldDueIds.goog,
        heldDueIds.googl,
        heldDueIds.apple,
        heldDueIds.outside,
        heldDueIds.later,
        heldDueIds.completed,
        heldDueIds.mismatch,
        heldDueIds.catalog,
      ][index]!,
      issuerId:
        index < 2
          ? "invented-held-due-alphabet"
          : "invented-held-due-" + symbol.toLowerCase(),
      issuerName:
        index < 2
          ? "Invented Alphabet Holdings"
          : "Invented " + symbol + " Holdings",
      securityId: "invented-held-due-security-" + symbol.toLowerCase(),
      securityName: "Invented " + symbol + " full security",
      shareClassId: "invented-held-due-class-" + symbol.toLowerCase(),
      shareClassName: index === 0 ? "Class C" : "Class A",
      symbol,
      exchangeMic: "XNAS",
      country: "US",
      instrumentType: "common_stock",
    }),
  );
}
export function heldDueLedger(digest: `sha256:${string}`) {
  const parsed = parseManagedPortfolio({
    version: 3,
    payload: {
      schemaVersion: 3,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: digest,
      basisMethod: "fifo_with_opening_pool",
      identities: heldDueIdentities().filter(
        (x) => x.listingId !== heldDueIds.outside,
      ),
      opening: {
        asOfDate: "2026-10-08",
        cashUsd: "1000.00",
        holdings: heldDueIdentities()
          .filter((x) => x.listingId !== heldDueIds.outside)
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
export function heldDueOriginal(
  digest: `sha256:${string}`,
  day: string,
): ResearchFollowupsPayload {
  const identities = heldDueIdentities(),
    indices = [0, 1, 4, 5, 3, 6, 7];
  const parsed = parseResearchFollowupsPayload({
    schemaVersion: 1,
    entries: indices.map((i, index) => ({
      id: heldDueEntryIds[index],
      listing:
        index === 5
          ? {
              ...identities[i]!,
              securityName: "Different unheld security name",
            }
          : identities[i],
      catalogSnapshotSha256: index === 6 ? `sha256:${"f".repeat(64)}` : digest,
      check: heldDueQuestions[index],
      dueOn: index === 1 ? day : index === 2 ? "2999-12-31" : "2000-01-01",
      status: index === 3 ? "completed" : "open",
      completedOn: index === 3 ? "2026-10-03" : null,
      result:
        index === 1
          ? "Original GOOGL result Café 東京 📈"
          : `Independent result ${index + 1} remains raw & complete.`,
    })),
  });
  if (!parsed) throw new Error("Invalid invented held-due checks");
  return parsed;
}
export function heldDueExpected(
  original: ResearchFollowupsPayload,
  day: string,
): ResearchFollowupsPayload {
  return {
    ...original,
    entries: original.entries.map((entry, index) =>
      index < 2
        ? {
            ...entry,
            status: "completed",
            completedOn: day,
            result: index === 1 ? heldDueAssessment : entry.result,
          }
        : entry,
    ),
  };
}
