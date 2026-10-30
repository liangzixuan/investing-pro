import type {
  ManagedPortfolioPayload,
  MainWatchlistPayload,
  ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { eodSelection } from "./eod-history-fixture";
import { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import {
  formatManagedWatchlistDraftFile,
  parseManagedWatchlistDraftFile,
} from "./managed-watchlist-draft-file";
import {
  formatManagedPortfolioDraftFile,
  parseManagedPortfolioDraftFile,
} from "./managed-portfolio-draft-file";
import {
  formatManagedFollowupsDraftFile,
  parseManagedFollowupsDraftFile,
} from "./managed-followups-draft-file";
import {
  formatManagedValuationCollectionDraftFile,
  parseManagedValuationCollectionDraftFile,
} from "./managed-valuation-collection-draft-file";
import {
  formatManagedResearchDraftSetFile,
  parseManagedResearchDraftSetFile,
} from "./managed-research-draft-set-file";
export const scope = `sha256:${"c".repeat(64)}`,
  time = "2026-10-30T00:00:00.000Z";
export function draftSetMembers() {
  const listing = eodSelection.listing,
    digest = eodSelection.catalogSnapshotSha256;
  const watchlist: MainWatchlistPayload = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: digest,
    memberships: [{ ...listing, note: "Full note 東京 😀 \nsecond line" }],
  };
  const portfolio: ManagedPortfolioPayload = {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: digest,
    basisMethod: "fifo_with_opening_pool",
    identities: [listing],
    opening: { asOfDate: "2026-10-01", cashUsd: "1000.00", holdings: [] },
    transactions: [],
  };
  const followups: ResearchFollowupsPayload = {
    schemaVersion: 1,
    entries: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        catalogSnapshotSha256: digest,
        listing,
        check: "Whole exact question 東京 😀",
        dueOn: "2026-10-31",
        result: "Whole authored result",
        status: "open",
        completedOn: null,
      },
    ],
  };
  const model = new ManagedValuationWorkbench();
  model.activate(eodSelection);
  model.setDcfField("waccPercent", " unfinished 1.. 😀 ");
  const payload = {
    schemaVersion: 1 as const,
    entries: [model.captureInputs()!.entry],
  };
  return {
    watchlist: parseManagedWatchlistDraftFile(
      formatManagedWatchlistDraftFile({
        accountScope: scope,
        capturedAt: time,
        baseVersion: 3,
        draft: watchlist,
      })!.text,
      scope,
    )!,
    portfolio: parseManagedPortfolioDraftFile(
      formatManagedPortfolioDraftFile({
        accountScope: scope,
        capturedAt: time,
        baseVersion: 3,
        draft: portfolio,
      })!.text,
      scope,
    )!,
    followups: parseManagedFollowupsDraftFile(
      formatManagedFollowupsDraftFile({
        accountScope: scope,
        capturedAt: time,
        baseVersion: 3,
        draft: followups,
      })!.text,
      scope,
    )!,
    valuation: parseManagedValuationCollectionDraftFile(
      formatManagedValuationCollectionDraftFile({
        accountScope: scope,
        capturedAt: time,
        payload,
      })!.text,
      scope,
    )!,
  };
}
export function draftSetDocument() {
  return formatManagedResearchDraftSetFile({
    accountScope: scope,
    capturedAt: time,
    members: draftSetMembers(),
  })!;
}
export function draftSetContent() {
  return parseManagedResearchDraftSetFile(draftSetDocument().text, scope)!;
}
