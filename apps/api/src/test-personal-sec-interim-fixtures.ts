import {
  PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
  PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY,
  type PersonalSecInterimCanonicalRequestDto,
} from "@research-cockpit/contracts";
import { createManagedCatalogService } from "./managed-workspace-catalog";
export const INTERIM_ENTRY = "2026-10-01T12:00:00.000Z";
export const INTERIM_CONTACT = "Invented interim fixture fixture@example.test";
export const INTERIM_PRINCIPAL = { userId: "synthetic_interim_principal_01" };
export function interimCommand(
  symbol = "AAPL",
): PersonalSecInterimCanonicalRequestDto {
  const catalog = createManagedCatalogService();
  const listing = catalog
    .search(symbol)!
    .results.find((row) => row.symbol === symbol)!;
  return {
    schemaVersion: PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
    catalogSnapshotSha256: catalog.status().snapshot.snapshotSha256,
    listingId: listing.listingId,
    symbol,
  };
}
export function interimFact(cik = "0000320193") {
  return {
    start: "2026-04-01",
    end: "2026-06-30",
    val: 100,
    accn: `${cik}-26-000042`,
    fy: 2026,
    fp: "Q2",
    form: "10-Q",
    filed: "2026-08-01",
  };
}
export function interimPackets(cik = "0000320193") {
  const fact = interimFact(cik);
  const submissions = {
    cik,
    filings: {
      recent: {
        accessionNumber: [fact.accn, `${cik}-26-000099`, `${cik}-26-000041`],
        form: ["10-Q", "10-K", "10-Q"],
        filingDate: [fact.filed, "2026-10-01", "2026-05-01"],
        reportDate: [fact.end, "2026-09-30", "2026-03-31"],
        acceptanceDateTime: [
          "2026-08-01T12:00:00.000Z",
          "2026-10-01T08:00:00.000Z",
          "2026-05-01T12:00:00.000Z",
        ],
      },
      files: [{ name: "must-not-fetch-history.json" }],
    },
  };
  const facts = Object.fromEntries(
    PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY.map(({ concept, periodType }) => {
      const current =
        periodType === "instant"
          ? { ...fact, start: undefined, val: 50 }
          : fact;
      const selected =
        periodType === "instant"
          ? [current]
          : [current, { ...fact, start: "2026-01-01", val: 200 }];
      const comparative = {
        ...current,
        start: periodType === "instant" ? undefined : "2025-01-01",
        end: "2025-06-30",
        val: 70,
      };
      const other = {
        ...current,
        accn: `${cik}-26-000041`,
        end: "2026-03-31",
        filed: "2026-05-01",
        start: periodType === "instant" ? undefined : "2026-01-01",
        val: 999,
      };
      return [concept, { units: { USD: [...selected, comparative, other] } }];
    }),
  );
  return [
    submissions,
    { cik: Number(cik), facts: { "us-gaap": facts } },
  ] as const;
}
export function interimSourceFetch(
  packets: readonly unknown[] = interimPackets(),
): typeof globalThis.fetch {
  let count = 0;
  return () => {
    const value = packets[count++];
    if (value === undefined)
      throw new Error("Unexpected invented interim source request");
    return Promise.resolve(Response.json(value));
  };
}
