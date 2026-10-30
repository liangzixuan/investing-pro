import {
  membershipMatchesResult,
  type MainWatchlistPayload,
  type ResearchFollowup,
  type ResearchFollowupsPayload,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type { HoldingFollowupPosition } from "./managed-holding-followup";
import type { PortfolioDraft } from "./managed-portfolio";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedWorkspace } from "./managed-workspace";
import type { SaveState } from "./save-coordinator";

export type CompanyResearchResourceStatus =
  "unloaded" | "empty" | "absent" | "invalid" | "stale" | "ready";
export interface CompanyResearchResource<P, V> {
  readonly status: CompanyResearchResourceStatus;
  readonly saved: SaveState<P>;
  readonly value: V | null;
  readonly reason: string | null;
  readonly canLoad: boolean;
  readonly load: () => Promise<void>;
}
export interface CompanyResearchCheckAttachment {
  readonly entry: ResearchFollowup;
  readonly isCurrent: () => boolean;
}
export interface CompanyResearchChecksContext {
  readonly watchlist: CompanyResearchResource<
    MainWatchlistPayload,
    WatchlistMembership
  >;
  readonly portfolio: CompanyResearchResource<
    PortfolioDraft,
    HoldingFollowupPosition
  >;
  readonly followups: CompanyResearchResource<
    ResearchFollowupsPayload,
    ResearchFollowup
  >;
  readonly attachment: CompanyResearchCheckAttachment | null;
  readonly canAttach: boolean;
  readonly reason: string | null;
  readonly attach: (
    entry: ResearchFollowup,
  ) => CompanyResearchCheckAttachment | null;
}

type Readout<V> = {
  status: CompanyResearchResourceStatus;
  value: V | null;
  reason: string | null;
};
function readout(
  status: CompanyResearchResourceStatus,
  value?: null,
  reason?: string | null,
): Readout<never>;
function readout<V>(
  status: CompanyResearchResourceStatus,
  value: V,
  reason?: string | null,
): Readout<V>;
function readout<V>(
  status: CompanyResearchResourceStatus,
  value: V | null = null,
  reason: string | null = null,
): Readout<V> {
  return { status, value, reason };
}
function matches(
  selection: ManagedResearchSelection,
  listing: Omit<WatchlistMembership, "note">,
) {
  return membershipMatchesResult({ ...listing, note: "" }, selection.listing);
}
export function companyWatchlistReadout(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
): Readout<WatchlistMembership> {
  const draft = workspace.coordinator.getSnapshot().draft;
  if (!draft) return readout("unloaded");
  if (
    draft.snapshotSha256 !== selection.catalogSnapshotSha256 ||
    workspace.watchlistFileCatalogReviewRequired()
  )
    return readout(
      "stale",
      null,
      "Review My Watchlist against the current catalog.",
    );
  if (!draft.memberships.length) return readout("empty");
  const rows = draft.memberships.filter((member) => matches(selection, member));
  if (rows.length > 1)
    return readout(
      "invalid",
      null,
      "More than one note matches this exact listing.",
    );
  return rows[0] ? readout("ready", rows[0]) : readout("absent");
}
export function companyFollowupsReadout(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
): Readout<ResearchFollowup> {
  const draft = workspace.followups.coordinator.getSnapshot().draft;
  if (!draft) return readout("unloaded");
  if (
    workspace.followups.getSnapshot().catalogSnapshotSha256 !==
    selection.catalogSnapshotSha256
  )
    return readout(
      "stale",
      null,
      "Review Follow-ups against the current catalog.",
    );
  if (!draft.entries.length) return readout("empty");
  const rows = draft.entries.filter((entry) =>
    matches(selection, entry.listing),
  );
  if (rows.length > 1)
    return readout(
      "invalid",
      null,
      "More than one check matches this exact listing.",
    );
  const entry = rows[0];
  if (!entry) return readout("absent");
  if (entry.catalogSnapshotSha256 !== selection.catalogSnapshotSha256)
    return readout(
      "stale",
      null,
      "Review this check against the current catalog.",
    );
  return readout("ready", entry);
}
export function companyPortfolioReadout(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
): Readout<HoldingFollowupPosition> {
  const draft = workspace.portfolio.coordinator.getSnapshot().draft;
  if (!draft) return readout("unloaded");
  const ledger = draft.ledger;
  if (!ledger)
    return readout(
      "empty",
      null,
      "The loaded Portfolio has no initialized ledger.",
    );
  if (
    ledger.snapshotSha256 !== selection.catalogSnapshotSha256 ||
    workspace.portfolio.getSnapshot().catalogSnapshotSha256 !==
      selection.catalogSnapshotSha256
  )
    return readout(
      "stale",
      null,
      "Review Portfolio against the current catalog.",
    );
  const projection = workspace.portfolio.getProjection();
  if (projection?.status !== "valid")
    return readout(
      "invalid",
      null,
      "The authored ledger cannot produce a valid holding.",
    );
  const holdings = projection.portfolio.holdings;
  if (!holdings.length) return readout("empty");
  const rows = holdings.filter((row) => matches(selection, row.identity));
  if (rows.length > 1)
    return readout(
      "invalid",
      null,
      "More than one holding matches this exact listing.",
    );
  const holding = rows[0];
  return holding
    ? readout(
        "ready",
        Object.freeze({
          listing: holding.identity,
          shares: holding.shares,
          totalCostBasisUsd: holding.totalCostBasisUsd,
          confirmedOn: holding.confirmedOn,
        }),
      )
    : readout("absent");
}
