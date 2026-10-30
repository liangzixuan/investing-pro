import type {
  PersonalPortfolioHolding,
  PersonalPortfolioLedgerProjection,
} from "@research-cockpit/contracts";
import type {
  ManagedFinancialScreenMember,
  ManagedFinancialScreenState,
} from "./managed-financial-screen";

export interface PortfolioScreenSelectionRow {
  readonly holding: PersonalPortfolioHolding;
  readonly member: ManagedFinancialScreenMember | null;
  readonly status:
    | "included"
    | "outside_cohort"
    | "uncovered"
    | "identity_mismatch"
    | "choice_required"
    | "other_share_class"
    | "cohort_unloaded";
  readonly reason: string;
}
export interface PortfolioScreenSelectionChoiceGroup {
  readonly issuerId: string;
  readonly members: readonly ManagedFinancialScreenMember[];
  readonly selected: ManagedFinancialScreenMember | null;
}
export interface PortfolioScreenSelectionPlan {
  readonly rows: readonly PortfolioScreenSelectionRow[];
  readonly choiceGroups: readonly PortfolioScreenSelectionChoiceGroup[];
  readonly members: readonly ManagedFinancialScreenMember[];
  readonly canApply: boolean;
  readonly reason: string | null;
}
interface Input {
  readonly projection: PersonalPortfolioLedgerProjection | null;
  readonly screen: ManagedFinancialScreenState;
  readonly coveredMembers: readonly ManagedFinancialScreenMember[];
  readonly choices?: readonly ManagedFinancialScreenMember[];
}
const identityKeys = [
  "country",
  "exchangeMic",
  "instrumentType",
  "issuerId",
  "issuerName",
  "listingId",
  "securityId",
  "securityName",
  "shareClassId",
  "shareClassName",
  "symbol",
] as const;
function row(
  holding: PersonalPortfolioHolding,
  member: ManagedFinancialScreenMember | null,
  status: PortfolioScreenSelectionRow["status"],
  reason: string,
): PortfolioScreenSelectionRow {
  return Object.freeze({ holding, member, status, reason });
}
function finish(
  rows: readonly PortfolioScreenSelectionRow[],
  choiceGroups: readonly PortfolioScreenSelectionChoiceGroup[],
  reason: string | null,
): PortfolioScreenSelectionPlan {
  return Object.freeze({
    rows: Object.freeze([...rows]),
    choiceGroups: Object.freeze([...choiceGroups]),
    members: Object.freeze(
      rows
        .filter((item) => item.status === "included")
        .map((item) => item.member!),
    ),
    canApply: reason === null,
    reason,
  });
}
/** Plan only from the existing exact ledger projection and captured cohort. */
export function prepareManagedPortfolioScreenSelection({
  projection,
  screen,
  coveredMembers,
  choices = [],
}: Input): PortfolioScreenSelectionPlan {
  if (!projection)
    return finish([], [], "Load and start the Portfolio draft first.");
  if (projection.status !== "valid")
    return finish(
      [],
      [],
      "Correct the invalid Portfolio ledger before choosing companies.",
    );
  const holdings = projection.portfolio.holdings;
  if (!holdings.length)
    return finish([], [], "There are no current Portfolio holdings to screen.");
  const rows = holdings.map((holding) => {
    const matches = screen.memberships.filter(
      (member) => member.listing.listingId === holding.identity.listingId,
    );
    const member = matches.length === 1 ? matches[0]! : null;
    if (!screen.catalogSnapshotSha256 || !screen.memberships.length)
      return row(
        holding,
        null,
        "cohort_unloaded",
        "Load the screening cohort to review this holding.",
      );
    if (
      projection.portfolio.snapshotSha256 !== screen.catalogSnapshotSha256 ||
      matches.length > 1 ||
      (member &&
        identityKeys.some(
          (key) => holding.identity[key] !== member.listing[key],
        ))
    )
      return row(
        holding,
        member,
        "identity_mismatch",
        "Review this holding's complete identity against the current Portfolio catalog.",
      );
    if (!member)
      return row(
        holding,
        null,
        "outside_cohort",
        "This held listing is outside the screening cohort.",
      );
    if (!coveredMembers.includes(member))
      return row(
        holding,
        member,
        "uncovered",
        "Annual coverage is unavailable for this exact held listing.",
      );
    return row(
      holding,
      member,
      "included",
      "Included in the proposed screen selection.",
    );
  });
  const byIssuer = new Map<string, ManagedFinancialScreenMember[]>();
  for (const item of rows) {
    if (item.status !== "included" || !item.member) continue;
    const issuer = item.member.listing.issuerId;
    const members = byIssuer.get(issuer) ?? [];
    members.push(item.member);
    byIssuer.set(issuer, members);
  }
  const choiceGroups = [...byIssuer]
    .filter(([, members]) => members.length > 1)
    .map(([issuerId, members]) => {
      const selected = choices.filter((choice) => members.includes(choice));
      return Object.freeze({
        issuerId,
        members: Object.freeze(members),
        selected: selected.length === 1 ? selected[0]! : null,
      });
    });
  const validChoices =
    new Set(choices).size === choices.length &&
    choices.every((choice) =>
      choiceGroups.some((group) => group.members.includes(choice)),
    ) &&
    new Set(choices.map((choice) => choice.listing.issuerId)).size ===
      choices.length;
  const resolved = rows.map((item) => {
    if (item.status !== "included" || !item.member) return item;
    const group = choiceGroups.find(
      (choice) => choice.issuerId === item.member!.listing.issuerId,
    );
    if (!group) return item;
    if (!group.selected)
      return row(
        item.holding,
        item.member,
        "choice_required",
        "Choose one of this issuer's eligible held share classes.",
      );
    return group.selected === item.member
      ? item
      : row(
          item.holding,
          item.member,
          "other_share_class",
          "Another held share class was chosen for this issuer.",
        );
  });
  const selectedCount = resolved.filter(
    (item) => item.status === "included",
  ).length;
  const reason =
    !screen.active ||
    !screen.canRead ||
    screen.catalogChanged ||
    !screen.catalogSnapshotSha256
      ? "Refresh the current screening catalog in an active session."
      : !screen.memberships.length
        ? "Load the screening cohort first."
        : screen.pending || screen.criteriaStaged
          ? "Finish the screen operation and apply or reset the criteria form first."
          : rows.some((item) => item.status === "identity_mismatch")
            ? "Review the Portfolio identities against the current catalog before Apply."
            : !validChoices
              ? "Choose only one current eligible held listing for each share-class choice."
              : choiceGroups.some((group) => !group.selected)
                ? "Choose one eligible held share class for each listed issuer."
                : selectedCount === 0
                  ? "No current holdings have eligible Annual screening coverage."
                  : selectedCount > 17
                    ? "A screen can contain at most 17 issuers."
                    : null;
  return finish(resolved, choiceGroups, reason);
}
