import {
  membershipMatchesResult,
  type PersonalPortfolioHolding,
  type PersonalPortfolioLedgerProjection,
  type ResearchFollowup,
} from "@research-cockpit/contracts";
import type { FollowupsReviewContext } from "./managed-research-followups";
import {
  groupResearchFollowupsByDueDate,
  isResearchFollowupDueDate,
} from "./managed-research-followups-date";

export interface PortfolioFollowupsHoldingRow {
  readonly holding: PersonalPortfolioHolding;
  readonly checks: readonly ResearchFollowup[];
}
export interface PortfolioFollowupsCheckRow {
  readonly entry: ResearchFollowup;
  readonly holding: PersonalPortfolioHolding | null;
  readonly identity: "matched" | "not_held" | "mismatch" | "unavailable";
  readonly due: "overdue" | "today" | "later" | "completed" | "invalid_date";
  readonly eligible: boolean;
  readonly reasons: readonly string[];
}
export interface PortfolioFollowupsPlan {
  readonly status:
    | "ready"
    | "portfolio_unavailable"
    | "portfolio_invalid"
    | "followups_unavailable"
    | "catalog_mismatch";
  readonly reason: string | null;
  readonly assessedOn: string | null;
  readonly holdings: readonly PortfolioFollowupsHoldingRow[];
  readonly checks: readonly PortfolioFollowupsCheckRow[];
  readonly eligible: readonly ResearchFollowup[];
}
interface Input {
  readonly projection: PersonalPortfolioLedgerProjection | null;
  readonly context: FollowupsReviewContext | null;
}
const dueReasons = {
  overdue: "This open check is overdue.",
  today: "This open check is due today.",
  later: "This check is due later.",
  completed: "This check is completed.",
  invalid_date: "Correct this check's invalid due date in Follow-ups.",
} as const;

/** Read only the captured projection and review context; retain all authored data. */
export function prepareManagedPortfolioFollowupsPlan({
  projection,
  context,
}: Input): PortfolioFollowupsPlan {
  const portfolio =
    projection?.status === "valid" ? projection.portfolio : null;
  const entries = context?.draft.entries ?? [];
  const groups =
    context && isResearchFollowupDueDate(context.assessedOn)
      ? groupResearchFollowupsByDueDate(
          entries,
          new Date(`${context.assessedOn}T00:00:00.000Z`),
        )
      : null;
  let status: PortfolioFollowupsPlan["status"] = "ready";
  let reason: string | null = null;
  if (!projection) {
    status = "portfolio_unavailable";
    reason = "Load and start the Portfolio draft first.";
  } else if (!portfolio) {
    status = "portfolio_invalid";
    reason = "Correct the invalid Portfolio ledger first.";
  } else if (!context || !groups || groups.assessedOn !== context.assessedOn) {
    status = "followups_unavailable";
    reason = "Load Follow-ups and assess its due checks first.";
  } else if (portfolio.snapshotSha256 !== context.catalogSnapshotSha256) {
    status = "catalog_mismatch";
    reason = "Review both drafts against the same current catalog first.";
  }
  const holdings = Object.freeze(
    (portfolio?.holdings ?? []).map((holding) =>
      Object.freeze({
        holding,
        checks: Object.freeze(
          entries.filter(
            (entry) => entry.listing.listingId === holding.identity.listingId,
          ),
        ),
      }),
    ),
  );
  const checks = Object.freeze(
    entries.map((entry): PortfolioFollowupsCheckRow => {
      const matches = holdings.filter(
        (row) => row.holding.identity.listingId === entry.listing.listingId,
      );
      const holding = matches.length === 1 ? matches[0]!.holding : null;
      const identity: PortfolioFollowupsCheckRow["identity"] = !portfolio
        ? "unavailable"
        : entry.catalogSnapshotSha256 !== context?.catalogSnapshotSha256 ||
            portfolio.snapshotSha256 !== context?.catalogSnapshotSha256 ||
            matches.length > 1 ||
            (holding &&
              !membershipMatchesResult(
                { ...entry.listing, note: "" },
                holding.identity,
              ))
          ? "mismatch"
          : holding
            ? "matched"
            : "not_held";
      const due: PortfolioFollowupsCheckRow["due"] =
        !groups || groups.invalidDates.includes(entry)
          ? "invalid_date"
          : groups.completed.includes(entry)
            ? "completed"
            : groups.overdue.includes(entry)
              ? "overdue"
              : groups.today.includes(entry)
                ? "today"
                : "later";
      const identityReason = {
        matched: "The complete listing identity matches a current holding.",
        not_held: "This listing is not currently held in Portfolio.",
        mismatch:
          "Review the complete listing identity and catalog before choosing this check.",
        unavailable: "Current Portfolio holdings are unavailable.",
      }[identity];
      return Object.freeze({
        entry,
        holding,
        identity,
        due,
        eligible:
          status === "ready" &&
          identity === "matched" &&
          (due === "overdue" || due === "today"),
        reasons: Object.freeze([identityReason, dueReasons[due]]),
      });
    }),
  );
  return Object.freeze({
    status,
    reason,
    assessedOn: groups?.assessedOn ?? null,
    holdings,
    checks,
    eligible: Object.freeze(
      checks.filter((row) => row.eligible).map((row) => row.entry),
    ),
  });
}
