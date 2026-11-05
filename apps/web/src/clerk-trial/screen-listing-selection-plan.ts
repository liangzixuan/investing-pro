import type { ManagedEodIdentity } from "@research-cockpit/contracts";
import type {
  ManagedFinancialScreenMember,
  ManagedFinancialScreenState,
} from "./managed-financial-screen";

export interface ScreenListingSelectionRow {
  readonly listing: ManagedEodIdentity;
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
export interface ScreenListingSelectionChoiceGroup {
  readonly issuerId: string;
  readonly members: readonly ManagedFinancialScreenMember[];
  readonly selected: ManagedFinancialScreenMember | null;
}
export interface ScreenListingSelectionPlan {
  readonly rows: readonly ScreenListingSelectionRow[];
  readonly choiceGroups: readonly ScreenListingSelectionChoiceGroup[];
  readonly members: readonly ManagedFinancialScreenMember[];
  readonly canApply: boolean;
  readonly reason: string | null;
}
export type ScreenListingSelectionMessages = Readonly<
  Record<
    | ScreenListingSelectionRow["status"]
    | "access"
    | "cohort"
    | "pending"
    | "identity"
    | "choices"
    | "choose"
    | "empty"
    | "limit",
    string
  >
>;
interface Input {
  readonly listings: readonly ManagedEodIdentity[];
  readonly snapshotSha256: string;
  readonly messages: ScreenListingSelectionMessages;
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
  listing: ManagedEodIdentity,
  member: ManagedFinancialScreenMember | null,
  status: ScreenListingSelectionRow["status"],
  reason: string,
): ScreenListingSelectionRow {
  return Object.freeze({ listing, member, status, reason });
}
function finish(
  rows: readonly ScreenListingSelectionRow[],
  choiceGroups: readonly ScreenListingSelectionChoiceGroup[],
  reason: string | null,
): ScreenListingSelectionPlan {
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
/** Pure ordered admission shared by existing source owners; no resource or request authority. */
export function prepareScreenListingSelection({
  listings,
  snapshotSha256,
  messages,
  screen,
  coveredMembers,
  choices = [],
}: Input): ScreenListingSelectionPlan {
  const rows = listings.map((listing) => {
    const matches = screen.memberships.filter(
      (member) => member.listing.listingId === listing.listingId,
    );
    const member = matches.length === 1 ? matches[0]! : null;
    if (!screen.catalogSnapshotSha256 || !screen.memberships.length)
      return row(listing, null, "cohort_unloaded", messages.cohort_unloaded);
    if (
      snapshotSha256 !== screen.catalogSnapshotSha256 ||
      matches.length > 1 ||
      (member &&
        identityKeys.some((key) => listing[key] !== member.listing[key]))
    )
      return row(
        listing,
        member,
        "identity_mismatch",
        messages.identity_mismatch,
      );
    if (!member)
      return row(listing, null, "outside_cohort", messages.outside_cohort);
    if (!coveredMembers.includes(member))
      return row(listing, member, "uncovered", messages.uncovered);
    return row(listing, member, "included", messages.included);
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
        item.listing,
        item.member,
        "choice_required",
        messages.choice_required,
      );
    return group.selected === item.member
      ? item
      : row(
          item.listing,
          item.member,
          "other_share_class",
          messages.other_share_class,
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
      ? messages.access
      : !screen.memberships.length
        ? messages.cohort
        : screen.pending || screen.criteriaStaged
          ? messages.pending
          : rows.some((item) => item.status === "identity_mismatch")
            ? messages.identity
            : !validChoices
              ? messages.choices
              : choiceGroups.some((group) => !group.selected)
                ? messages.choose
                : selectedCount === 0
                  ? messages.empty
                  : selectedCount > 17
                    ? messages.limit
                    : null;
  return finish(resolved, choiceGroups, reason);
}
