import {
  parseValuationAssumptionEntry,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import {
  annualComparisonMemberships,
  annualComparisonResponse,
  annualComparisonOperatingRows,
  annualComparisonBalanceRows,
} from "../../src/clerk-trial/test-canonical-annual-comparison-fixture";
import { savedValuationInputs } from "./fixture";
import { reviewFilingsIdentities } from "./review-filings-evidence-fixture-data";
export const decisionQuestion =
  "Does ONE retain cash generation after its next filing? Compare the retained ZERO reading. Café 東京 📈";
export const decisionDue = "2026-12-31";
export const decisionThesis =
  "Prefer ONE under my authored assumptions. Its June fiscal year differs from ZERO's December year. Café 東京 📈 <script>invented</script> & uncertainty remains.";
export const decisionUnsaved =
  "This later ZERO note is deliberately unsaved. Café 東京 📈";
export function decisionData() {
  const identities = [
    annualComparisonMemberships.left,
    annualComparisonMemberships.right,
  ].map(({ note: _note, ...listing }) => {
    void _note;
    return listing;
  });
  const unrelated = reviewFilingsIdentities()[0]!;
  const entries = [...identities, unrelated].map((listing, i) => {
    const entry = parseValuationAssumptionEntry({
      ...savedValuationInputs!,
      listing,
      cik: i < 2 ? (i ? "0000000002" : "0000000001") : null,
      exit: {
        ...savedValuationInputs!.exit,
        inputs: {
          ...savedValuationInputs!.exit.inputs,
          baseRevenue: `${800 + i * 100}.00`,
        },
      },
    });
    if (!entry) throw new Error("Invalid invented decision assumptions");
    return entry;
  });
  const revised = entries.map((entry, i) => {
    if (i === 2) return entry;
    const result = parseValuationAssumptionEntry({
      ...entry,
      exit: {
        ...entry.exit,
        inputs: {
          ...entry.exit.inputs,
          baseRevenue: i ? "2000.000" : "1000.125",
        },
      },
    });
    if (!result)
      throw new Error("Invalid invented revised decision assumptions");
    return result;
  });
  const watchlist = {
    schemaVersion: 1 as const,
    name: "My Watchlist" as const,
    snapshotSha256: entries[0]!.catalogSnapshotSha256,
    memberships: identities.map((listing) => ({
      ...listing,
      note: `Original ${listing.symbol} thesis. Keep the independent fiscal period.`,
    })),
  };
  const followups: ResearchFollowupsPayload = {
    schemaVersion: 1,
    entries: [
      {
        id: "72000000-0000-4000-8000-000000000001",
        listing: identities[0]!,
        catalogSnapshotSha256: watchlist.snapshotSha256,
        check: "Keep ZERO's unrelated original question.",
        dueOn: "2026-12-15",
        status: "open",
        completedOn: null,
        result: "Preserve the complete original assessment.",
      },
    ],
  };
  return { identities, entries, revised, watchlist, followups };
}
export const decisionExpectedWatchlist = (
  data: ReturnType<typeof decisionData>,
) => ({
  ...data.watchlist,
  memberships: data.watchlist.memberships.map((m, i) =>
    i === 1 ? { ...m, note: decisionThesis } : m,
  ),
});
export const decisionExpectedValuations = (
  data: ReturnType<typeof decisionData>,
  saves: number,
) => data.entries.map((entry, i) => (i < saves ? data.revised[i]! : entry));
export function decisionExpectedFollowups(
  data: ReturnType<typeof decisionData>,
  id: string,
): ResearchFollowupsPayload {
  return {
    ...data.followups,
    entries: [
      ...data.followups.entries,
      {
        id,
        listing: data.identities[1]!,
        catalogSnapshotSha256: data.watchlist.snapshotSha256,
        check: decisionQuestion,
        dueOn: decisionDue,
        status: "open",
        completedOn: null,
        result: "",
      },
    ],
  };
}
export const decisionPackets = () =>
  Promise.all(
    (["left", "right"] as const).map((side) =>
      annualComparisonResponse(side, {
        operatingRows: annualComparisonOperatingRows(side),
        balanceRows: annualComparisonBalanceRows(side),
        cutoffAt:
          side === "left"
            ? "2026-09-20T00:00:00.000Z"
            : "2026-09-21T03:04:05.000Z",
      }),
    ),
  );
