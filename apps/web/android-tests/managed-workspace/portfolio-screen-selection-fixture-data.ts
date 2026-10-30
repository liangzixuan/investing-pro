import {
  parseManagedPortfolio,
  type ManagedEodIdentity,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { MANAGED_FINANCIAL_SCREEN_LISTING_IDS } from "../../src/clerk-trial/managed-financial-screen-cohort";
import {
  annualComparisonResponse,
  annualComparisonOperatingRows,
  annualComparisonBalanceRows,
} from "../../src/clerk-trial/test-canonical-annual-comparison-fixture";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../../src/lib/test-personal-sec-annual-api-fixture";
import { parseSecAnnualCanonicalResponse } from "../../src/lib/sec-annual-canonical-response";

const symbols = [
  "AAPL",
  "AFL",
  "AIG",
  "ALCO",
  "AMD",
  "AP",
  "AVD",
  "AXP",
  "BKTI",
  "GOOG",
  "GOOGL",
  "HWM",
  "LNG",
  "MATX",
  "MSFT",
  "SWKS",
  "UHAL",
  "UNM",
] as const;
export const portfolioScreenIds = Object.freeze({
  apple: MANAGED_FINANCIAL_SCREEN_LISTING_IDS[0]!,
  goog: MANAGED_FINANCIAL_SCREEN_LISTING_IDS[9]!,
  googl: MANAGED_FINANCIAL_SCREEN_LISTING_IDS[10]!,
  uncovered: MANAGED_FINANCIAL_SCREEN_LISTING_IDS[16]!,
  outside: "invented-portfolio-screen-aem",
});
export const portfolioScreenSelectedIds = Object.freeze([
  portfolioScreenIds.apple,
  portfolioScreenIds.googl,
]);
export const portfolioScreenHeldIds = Object.freeze([
  portfolioScreenIds.apple,
  portfolioScreenIds.goog,
  portfolioScreenIds.googl,
  portfolioScreenIds.outside,
  portfolioScreenIds.uncovered,
]);
export function portfolioScreenIdentities(): readonly ManagedEodIdentity[] {
  const cohort = symbols.map((symbol, index): ManagedEodIdentity => {
    const alphabet = symbol === "GOOG" || symbol === "GOOGL";
    const issuer = alphabet ? "alphabet" : symbol.toLowerCase();
    const share = symbol === "GOOG" ? "C" : "A";
    return {
      listingId: MANAGED_FINANCIAL_SCREEN_LISTING_IDS[index]!,
      issuerId: "invented-held-issuer-" + issuer,
      issuerName:
        "Invented " + (alphabet ? "Alphabet" : symbol) + " Research Company",
      securityId: "invented-held-security-" + symbol.toLowerCase(),
      securityName: "Invented " + symbol + " Class " + share,
      shareClassId: "invented-held-class-" + symbol.toLowerCase(),
      shareClassName: "Class " + share,
      symbol,
      exchangeMic: "XNAS",
      country: "US",
      instrumentType: "common_stock",
    };
  });
  return Object.freeze([
    ...cohort,
    {
      ...cohort[0]!,
      listingId: portfolioScreenIds.outside,
      issuerId: "invented-held-issuer-aem",
      issuerName: "Invented AEM Research Company",
      securityId: "invented-held-security-aem",
      securityName: "Invented AEM Class A",
      shareClassId: "invented-held-class-aem",
      symbol: "AEM",
    },
  ]);
}
export function portfolioScreenLedger(
  snapshotSha256: `sha256:${string}`,
  identities: readonly ManagedEodIdentity[],
) {
  const dto = parseManagedPortfolio({
    version: 3,
    payload: {
      schemaVersion: 3,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256,
      basisMethod: "fifo_with_opening_pool",
      identities: portfolioScreenHeldIds.map((id) =>
        identities.find((row) => row.listingId === id)!,
      ),
      opening: {
        asOfDate: "2026-10-04",
        cashUsd: "1000.00",
        holdings: portfolioScreenHeldIds.map((listingId, index) => ({
          listingId,
          shares: ["2.000000", "1.000000", "0.750001", "3.500000", "4.000000"][
            index
          ]!,
          totalCostBasisUsd: ["80.00", "90.00", "70.01", "60.00", null][index]!,
          confirmedOn: "2026-10-03",
        })),
      },
      transactions: [],
    },
  });
  if (!dto?.payload) throw new Error("Invalid invented held-company ledger");
  return dto;
}
export async function portfolioScreenPackets(
  identities: readonly ManagedEodIdentity[],
): Promise<readonly PersonalSecAnnualCanonicalResponseDto[]> {
  return Promise.all(
    (["left", "right"] as const).map(async (side, index) => {
      const original = await annualComparisonResponse(side, {
        operatingRows: annualComparisonOperatingRows(side),
        balanceRows: annualComparisonBalanceRows(side),
        cutoffAt:
          index === 0 ? "2026-10-29T12:34:56.000Z" : "2026-10-30T01:02:03.000Z",
      });
      const packet = structuredClone(original) as TestAnnualPacket;
      const identity = identities.find(
        (row) => row.listingId === portfolioScreenSelectedIds[index],
      )!;
      packet.security = {
        listingId: identity.listingId,
        issuerId: identity.issuerId,
        issuerName: identity.issuerName,
        securityName: identity.securityName,
        symbol: identity.symbol,
        country: identity.country,
        exchangeMic: identity.exchangeMic,
        cik: index === 0 ? "0000000001" : "0000000002",
      };
      const bound = await bindAnnualPacket(packet);
      const admitted = await parseSecAnnualCanonicalResponse(
        bound,
        {
          schemaVersion: "6.0.0",
          catalogSnapshotSha256: bound.catalogSnapshotSha256,
          listingId: identity.listingId,
          symbol: identity.symbol,
        },
        new AbortController().signal,
      );
      if (!admitted)
        throw new Error("Invented held-company Annual packet refused");
      return admitted;
    }),
  );
}
