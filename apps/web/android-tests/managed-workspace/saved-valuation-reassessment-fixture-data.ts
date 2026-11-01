import {
  parseValuationAssumptionEntry,
  type ValuationAssumptionEntry,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { savedValuationInputs } from "./fixture";
import { reviewFilingsIdentities } from "./review-filings-evidence-fixture-data";
import {
  response,
  row,
  admitUiPacket,
} from "../../src/features/research/test-canonical-annual-ui-fixture";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../../src/lib/test-personal-sec-annual-api-fixture";

export const reassessmentQuestion =
  "Does the revised Class A revenue case still hold? Café 東京 📈";
export const reassessmentDue = "2026-12-31";
export const reassessmentCheck = `Question: ${reassessmentQuestion} | Authored estimate: Exit multiple authored-exit-multiple-v1; Base scenario; USD/share 20.00. Summary only; inputs and source evidence not included.`;
export const reassessmentReason =
  "Revised Class A assumptions after the dated Annual reading. Café 東京 📈 <script>invented</script> & uncertainty remains.";
export const reassessmentUnsaved =
  "This later Class C note is deliberately unsaved. Café 東京 📈";
export const reassessmentDigest = `sha256:${"a".repeat(64)}` as const;
export function reassessmentData() {
  const identities = [
    reviewFilingsIdentities()[1]!,
    reviewFilingsIdentities()[0]!,
  ];
  const entries = identities.map((listing, index) => {
    const value = parseValuationAssumptionEntry({
      ...savedValuationInputs!,
      listing,
      cik: null,
      exit: {
        ...savedValuationInputs!.exit,
        inputs: {
          ...savedValuationInputs!.exit.inputs,
          baseRevenue: index === 0 ? "800.00" : "900.00",
        },
      },
    });
    if (!value) throw new Error("Invalid invented reassessment baseline");
    return value;
  });
  const revised = parseValuationAssumptionEntry({
    ...entries[0]!,
    dcf: {
      ...entries[0]!.dcf,
      inputs: {
        ...entries[0]!.dcf.inputs,
        startingUnleveredCashFlowUsd: "110.00",
      },
    },
    exit: {
      ...entries[0]!.exit,
      inputs: {
        ...entries[0]!.exit.inputs,
        baseRevenue: "1000",
        cash: "200.00",
      },
    },
  });
  if (!revised) throw new Error("Invalid invented revised assumptions");
  const watchlist = {
    schemaVersion: 1 as const,
    name: "My Watchlist" as const,
    snapshotSha256: reassessmentDigest,
    memberships: identities.map((listing) => ({
      ...listing,
      note: `Original ${listing.symbol} thesis. Preserve the exact share class.`,
    })),
  };
  const followups: ResearchFollowupsPayload = {
    schemaVersion: 1,
    entries: [
      {
        id: "71000000-0000-4000-8000-000000000001",
        listing: identities[1]!,
        catalogSnapshotSha256: reassessmentDigest,
        check: "Preserve the independent Class C question.",
        dueOn: "2026-12-15",
        status: "open",
        completedOn: null,
        result: "Original Class C assessment remains unchanged.",
      },
    ],
  };
  return { identities, entries, revised, watchlist, followups };
}
export function reassessmentExpectedFollowups(
  data: ReturnType<typeof reassessmentData>,
  id: string,
): ResearchFollowupsPayload {
  return {
    ...data.followups,
    entries: [
      ...data.followups.entries,
      {
        id,
        listing: data.identities[0]!,
        catalogSnapshotSha256: reassessmentDigest,
        check: reassessmentCheck,
        dueOn: reassessmentDue,
        status: "open",
        completedOn: null,
        result: "",
      },
    ],
  };
}
export function reassessmentExpectedValuations(
  data: ReturnType<typeof reassessmentData>,
): readonly ValuationAssumptionEntry[] {
  return [data.revised, data.entries[1]!];
}
export async function reassessmentAnnual(
  data: ReturnType<typeof reassessmentData>,
) {
  const raw = structuredClone(
    await response([row(), row("NetIncomeLoss", "100")]),
  ) as TestAnnualPacket;
  const listing = data.identities[0]!;
  raw.security = {
    country: listing.country,
    exchangeMic: listing.exchangeMic,
    issuerId: listing.issuerId,
    issuerName: listing.issuerName,
    listingId: listing.listingId,
    securityName: listing.securityName,
    symbol: listing.symbol,
    cik: "0000000001",
  };
  return admitUiPacket(await bindAnnualPacket(raw));
}
