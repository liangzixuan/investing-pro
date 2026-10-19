import { createHash } from "node:crypto";
import {
  parseValuationAssumptionEntry,
  type ValuationAssumptionEntry,
} from "@research-cockpit/contracts";
import type { ManagedValuationAssumptionsCatalog } from "./managed-workspace-catalog";

/** Trusted catalog-port fixture; this does not exercise source admission. */
export function inventedValuationCatalog(
  firstIssuerName = "Invented issuer zero",
): ManagedValuationAssumptionsCatalog {
  const listings = Array.from({ length: 3 }, (_, index) => {
    const suffix = String(index).padStart(5, "0");
    const issuerIndex = Math.floor(index / 2);
    return Object.freeze({
      country: "US" as const,
      exchangeMic: index % 2 === 0 ? "XNAS" : "XNYS",
      instrumentType: "common_stock" as const,
      issuerId: `iss-${String(issuerIndex).padStart(5, "0")}`,
      issuerName: issuerIndex === 0 ? firstIssuerName : "Invented issuer one",
      listingId: `lst-${suffix}`,
      securityId: `sec-${suffix}`,
      securityName: `Invented security ${index}`,
      shareClassId: `shr-${suffix}`,
      shareClassName: `Invented class ${index}`,
      symbol: `INVENTED${index}`,
      cik: String(issuerIndex + 1).padStart(10, "0"),
    });
  });
  return Object.freeze({
    snapshotSha256:
      `sha256:${createHash("sha256").update(JSON.stringify(listings)).digest("hex")}` as const,
    lookup: (listingId: string) =>
      listings.find((listing) => listing.listingId === listingId) ?? null,
  });
}

/** Invented raw inputs only; no calculator, provider or stored account data. */
export function valuationAssumptionEntry(
  catalog: ManagedValuationAssumptionsCatalog,
  listingId = "lst-00000",
): ValuationAssumptionEntry {
  const result = catalog.lookup(listingId);
  if (!result) throw new Error("Missing invented valuation listing");
  const {
    country,
    exchangeMic,
    instrumentType,
    issuerId,
    issuerName,
    securityId,
    securityName,
    shareClassId,
    shareClassName,
    symbol,
  } = result;
  const dcfScenario = () => ({ annualCashFlowGrowthPercent: "" });
  const exitScenario = () => ({
    annualRevenueGrowthPercent: "",
    targetEbitdaMarginPercent: "",
    exitMultiple: "",
  });
  const captured = parseValuationAssumptionEntry({
    catalogSnapshotSha256: catalog.snapshotSha256,
    listing: {
      country,
      exchangeMic,
      instrumentType,
      issuerId,
      issuerName,
      listingId,
      securityId,
      securityName,
      shareClassId,
      shareClassName,
      symbol,
    },
    cik: result.cik,
    dcf: {
      modelVersion: "authored-cash-flow-dcf-v1",
      inputs: {
        startingUnleveredCashFlowUsd: "unfinished 12e",
        enterpriseToEquityBridgeUsd: "",
        dilutedShares: "",
        forecastYears: "5",
        waccPercent: "",
        terminalGrowthPercent: "",
        scenarios: {
          conservative: dcfScenario(),
          base: dcfScenario(),
          expansion: dcfScenario(),
        },
      },
    },
    exit: {
      modelVersion: "authored-exit-multiple-v1",
      inputs: {
        baseRevenue: "",
        cash: "",
        debt: "",
        dilutedShares: "",
        horizonYears: "5",
        discountRatePercent: "",
        scenarios: {
          conservative: exitScenario(),
          base: exitScenario(),
          expansion: exitScenario(),
        },
      },
    },
  });
  if (!captured) throw new Error("Invalid invented valuation entry");
  return captured;
}
