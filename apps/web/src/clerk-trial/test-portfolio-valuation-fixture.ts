import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { datedClosePacket } from "../../android-tests/managed-workspace/portfolio-dated-review-fixture-data";
import type { ManagedPortfolioPayload } from "@research-cockpit/contracts";
import { ManagedWorkspace } from "./managed-workspace";
import { preparePortfolioReviewReport } from "./portfolio-review-report";
import { portfolioReviewReportInput } from "./portfolio-review-report-fixture";
import {
  ManagedPortfolioValuationReview,
  type PortfolioValuationSource,
} from "./managed-portfolio-valuation-review";
export const portfolioScenarioTime = "2026-11-04T12:00:00.000Z";
export async function createPortfolioValuationFixture() {
  const fixture = await createFixture("watchlist-saved-scenario");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      priceCoverage: fixture.priceCoverage,
    },
  );
  await workspace.refreshCatalog();
  await workspace.valuationAssumptions.coordinator.load();
  const identities = fixture
    .watchlistSavedScenario!.saved()
    .watchlist.payload.memberships.map(({ note, ...identity }) => {
      void note;
      return identity;
    });
  const digest = fixture.watchlistSavedScenario!.saved().watchlist.payload
    .snapshotSha256 as `sha256:${string}`;
  const ledger: ManagedPortfolioPayload = {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: digest,
    basisMethod: "fifo_with_opening_pool",
    identities,
    opening: {
      asOfDate: "2026-10-01",
      cashUsd: "10.00",
      holdings: identities.map((listing, index) => ({
        listingId: listing.listingId,
        shares: String(index + 1),
        totalCostBasisUsd: null,
        confirmedOn: "2026-10-01",
      })),
    },
    transactions: [],
  };
  const responses = identities.slice(0, 2).map((security) =>
    datedClosePacket(
      {
        catalogSnapshotSha256: digest,
        listingId: security.listingId,
        range: "1m",
      },
      security,
      Date.parse(portfolioScenarioTime),
    ),
  );
  const input = {
    ...portfolioReviewReportInput(ledger, "2026-11-02", responses),
    preparedAt: portfolioScenarioTime,
  };
  const report = preparePortfolioReviewReport(input);
  if (!report) throw new Error("Invented portfolio report refused");
  let generation = {},
    available = true,
    live = true,
    clock = () => portfolioScenarioTime;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const fn of [...listeners]) fn();
  };
  const source: PortfolioValuationSource = {
    canCapture: () => live,
    capture: () => {
      const captured = generation;
      return { report, current: () => live && generation === captured };
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
  const model = new ManagedPortfolioValuationReview(
    source,
    workspace.valuationAssumptions,
    workspace.valuation,
    {
      now: () => clock(),
      available: () => available,
      coverage: fixture.researchCoverage,
    },
  );
  return {
    fixture,
    workspace,
    model,
    report,
    input,
    source,
    notify,
    pause(value: boolean) {
      available = !value;
      model.reconcile();
    },
    revoke() {
      live = false;
      notify();
    },
    restore() {
      live = true;
      notify();
    },
    replace() {
      generation = {};
      notify();
    },
    clock(fn: () => string) {
      clock = fn;
    },
    dispose() {
      model.retire();
      workspace.sessionOwner.dispose();
    },
  };
}
