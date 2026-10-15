import {
  isMainWatchlistPayload,
  type PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import { getPersonalSecAnnualSourceReason } from "@research-cockpit/personal-financial-analytics";
import { annualCashGeneration } from "../lib/sec-annual-cash-response";
import { annualOperatingResults } from "../lib/sec-annual-operating-response";
import { projectAnnualComparison } from "./managed-annual-comparison-display";
import { annualLiquidityNoteExcerpt } from "./managed-annual-liquidity-note";
import type { ManagedWatchlistAnnualComparisonMember } from "./managed-watchlist-annual-comparison";

export type AnnualComparisonNoteGroup =
  "income" | "cash" | "liquidity" | "operating";
export interface AnnualComparisonNoteCapture {
  readonly group: AnnualComparisonNoteGroup;
  readonly left: {
    readonly member: ManagedWatchlistAnnualComparisonMember;
    readonly response: PersonalSecAnnualEvidenceResponseDto;
    readonly selectedBasis: string | null;
    readonly showingPrevious: boolean;
  };
  readonly right: AnnualComparisonNoteCapture["left"];
}

type Column = AnnualComparisonNoteCapture["left"];
type Evidence = { excerpt: string | null; reason: string | null };
const identityFields = [
  "country",
  "exchangeMic",
  "issuerId",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;

function validPair({ left, right }: AnnualComparisonNoteCapture): boolean {
  return (
    left.member.handle !== right.member.handle &&
    left.member.listing.issuerId !== right.member.listing.issuerId &&
    left.response.security.cik !== right.response.security.cik &&
    left.response.catalogSnapshotSha256 ===
      right.response.catalogSnapshotSha256 &&
    isMainWatchlistPayload({
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: left.response.catalogSnapshotSha256,
      memberships: [left, right].map(({ member }) => ({
        ...member.listing,
        note: "",
      })),
    }) &&
    [left, right].every(validIdentity)
  );
}

function validIdentity({ member, response }: Column): boolean {
  return (
    typeof member.handle === "symbol" &&
    response.schemaVersion === "4.0.0" &&
    response.security.cik === response.evidence.cik &&
    identityFields.every(
      (key) => member.listing[key] === response.security[key],
    )
  );
}

function sourceAvailable({ evidence }: Column["response"]): boolean {
  return (
    evidence.target.status === "target" &&
    getPersonalSecAnnualSourceReason(evidence.generation) === null &&
    evidence.generation.sources.companyFacts.sourceUrl ===
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${evidence.cik}.json` &&
    evidence.generation.sources.submissions.sourceUrl ===
      `https://data.sec.gov/submissions/CIK${evidence.cik}.json`
  );
}

function provenance(column: Column, currentUse: boolean): string {
  const { cik, target, generation } = column.response.evidence;
  if (target.status !== "target") return "";
  const filing = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`;
  return [
    `CIK ${cik}; filed ${target.filedDate}; accession ${target.accessionNumber}; filing ${filing}.`,
    `Original cutoff ${generation.cutoffAt}; completed ${generation.completedAt}; Company Facts captured ${generation.sources.companyFacts.fetchedAt}; Submissions captured ${generation.sources.submissions.fetchedAt}.`,
    currentUse
      ? "Current use eligible at original load."
      : "Historical evidence; current use unavailable at original load.",
    ...(column.showingPrevious ? ["Retained previous report."] : []),
  ].join(" ");
}

function identity(column: Column): string {
  const listing = column.member.listing;
  return `${listing.symbol} (${listing.issuerName}; ${listing.securityName}; ${listing.shareClassName}; ${listing.exchangeMic}, ${listing.country})`;
}

function incomeEvidence(column: Column): Evidence {
  if (column.selectedBasis === null)
    return { excerpt: null, reason: "Choose a revenue basis explicitly." };
  const display = projectAnnualComparison(
    column.response,
    column.selectedBasis,
  );
  if (!display.current || !display.currentUse)
    return { excerpt: null, reason: display.currentReason };
  const { current, revenueChange: change } = display;
  const margin =
    current.netMarginPercent === null
      ? "unavailable because revenue is not positive"
      : `${current.netMarginPercent}%`;
  const reportedChange = change
    ? `Reported revenue change: ${change.priorStartDate} to ${change.priorEndDate} versus ${change.currentStartDate} to ${change.currentEndDate}, USD ${change.differenceUSD} (${change.percentText}).`
    : `Reported revenue change unavailable: ${display.revenueChangeReason}`;
  return {
    excerpt: [
      `${identity(column)}: ${column.response.evidence.target.status === "target" ? column.response.evidence.target.form : ""} ${current.startDate} to ${current.endDate}; ${column.selectedBasis} revenue USD ${current.revenueUSD}; NetIncomeLoss USD ${current.netIncomeUSD}; net margin ${margin}.`,
      reportedChange,
      provenance(column, display.currentUse.eligible),
    ].join(" "),
    reason: null,
  };
}

function cashEvidence(column: Column): Evidence {
  const { evidence } = column.response;
  const cash = evidence.cashGeneration;
  if (
    !annualCashGeneration(
      cash,
      evidence,
      new Set(evidence.observations.map((row) => row.id)),
    )
  )
    return { excerpt: null, reason: "Cash evidence could not be validated." };
  const {
    operatingCashFlow: operating,
    ppePurchases: purchases,
    operatingCashFlowLessPpePurchases: difference,
  } = cash.resolution;
  if (
    operating.status !== "available" ||
    purchases.status !== "available" ||
    difference.status !== "available"
  )
    return {
      excerpt: null,
      reason:
        "Cash comparison needs available operating cash flow and PP&E purchases from the same filing and annual period.",
    };
  return {
    excerpt: [
      `${identity(column)}: ${column.response.evidence.target.status === "target" ? column.response.evidence.target.form : ""} ${operating.startDate} to ${operating.endDate}; reported OCF USD ${operating.value}; reported PP&E USD ${purchases.value}; app calculation OCF less PP&E USD ${difference.value}.`,
      provenance(column, difference.currentUseEligible),
    ].join(" "),
    reason: null,
  };
}

function liquidityEvidence(column: Column): Evidence {
  const excerpt = annualLiquidityNoteExcerpt(
    column.response,
    column.showingPrevious,
  );
  return excerpt === null
    ? {
        excerpt: null,
        reason:
          "Liquidity comparison needs available current assets, current liabilities and working capital from the same filing and date, with a checked ratio or zero-liability refusal.",
      }
    : { excerpt: `${identity(column)}: ${excerpt}`, reason: null };
}

function operatingEvidence(column: Column): Evidence {
  if (column.selectedBasis === null)
    return { excerpt: null, reason: "Choose a revenue basis explicitly." };
  const { evidence } = column.response;
  const { operatingResults, cashGeneration, liquidity } = evidence;
  const ids = new Set(
    [
      ...evidence.observations,
      ...cashGeneration.operatingCashFlow.observations,
      ...cashGeneration.ppePurchases.observations,
      ...liquidity.currentAssets.observations,
      ...liquidity.currentLiabilities.observations,
    ].map((row) => row.id),
  );
  if (!annualOperatingResults(operatingResults, evidence, ids))
    return {
      excerpt: null,
      reason: "Operating evidence could not be validated.",
    };
  const basis = operatingResults.resolution.margins.find(
    (item) => item.concept === column.selectedBasis,
  );
  if (!basis)
    return {
      excerpt: null,
      reason:
        "The selected operating revenue basis is unavailable. Choose another basis explicitly.",
    };
  const { operatingIncome } = operatingResults.resolution;
  const { revenue, operatingMargin } = basis;
  if (
    operatingIncome.status !== "available" ||
    revenue.status !== "available" ||
    operatingMargin.status !== "available"
  )
    return {
      excerpt: null,
      reason:
        "Operating comparison needs available operating income and positive revenue from the same filing and exact annual period.",
    };
  return {
    excerpt: [
      `${identity(column)}: ${evidence.target.status === "target" ? evidence.target.form : ""} ${operatingIncome.startDate} to ${operatingIncome.endDate}; reported OperatingIncomeLoss USD ${operatingIncome.value}; ${basis.concept} revenue USD ${revenue.value}; operating margin ${operatingMargin.value}%.`,
      provenance(column, operatingMargin.currentUseEligible),
    ].join(" "),
    reason: null,
  };
}

const formatEvidence = {
  income: incomeEvidence,
  cash: cashEvidence,
  liquidity: liquidityEvidence,
  operating: operatingEvidence,
};

/** Formats admitted captured reports; callers own freshness, draft and Save guards. */
export function getAnnualComparisonNoteEvidence(
  capture: AnnualComparisonNoteCapture,
): Evidence {
  try {
    if (!validPair(capture))
      return {
        excerpt: null,
        reason:
          "Choose two distinct companies with matching report identities.",
      };
    if (
      capture.group !== "income" &&
      capture.group !== "cash" &&
      capture.group !== "liquidity" &&
      capture.group !== "operating"
    )
      return {
        excerpt: null,
        reason: "Choose income, cash, liquidity or operating evidence.",
      };
    const pieces: string[] = [];
    for (const [label, column] of [
      ["First company", capture.left],
      ["Second company", capture.right],
    ] as const) {
      if (!sourceAvailable(column.response))
        return {
          excerpt: null,
          reason: `${label}: Annual source or filing is unavailable.`,
        };
      const result = formatEvidence[capture.group](column);
      if (result.excerpt === null)
        return { excerpt: null, reason: `${label}: ${result.reason}` };
      pieces.push(result.excerpt);
    }
    if (capture.group === "liquidity")
      return {
        excerpt: [
          "Observed Annual liquidity comparison; exact, unscaled USD; current ratio is a multiple.",
          ...pieces,
          "Company balance dates may differ; no cross-company calculation or ranking.",
        ].join(" "),
        reason: null,
      };
    if (capture.group === "operating")
      return {
        excerpt: [
          "Observed Annual operating comparison; exact, unscaled USD.",
          ...pieces,
          "App calculation: operating margin = operating income / positive revenue * 100, rounded to two decimal places, half up; each company's inputs use the same filing and exact period.",
          "Company periods may differ; no cross-company calculation or ranking. Evidence dates are unchanged; this action does not refresh sources.",
        ].join(" "),
        reason: null,
      };
    return {
      excerpt: [
        capture.group === "income"
          ? "Observed Annual income comparison; exact, unscaled USD."
          : "Observed Annual cash comparison; exact, unscaled USD. OCF = NetCashProvidedByUsedInOperatingActivities; PP&E = PaymentsToAcquirePropertyPlantAndEquipment.",
        ...pieces,
        capture.group === "income"
          ? "Period length, accounting changes and restatements are unadjusted; not as-originally-filed history or organic growth."
          : "The app calculation uses each company's same filing and period; no adjustment for leases, acquisitions or other investing cash flows.",
        "Company periods may differ; no cross-company calculation or ranking. Evidence dates are unchanged; this action does not refresh sources.",
      ].join(" "),
      reason: null,
    };
  } catch {
    return {
      excerpt: null,
      reason: "The captured Annual evidence could not be validated.",
    };
  }
}
