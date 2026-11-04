import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
export async function createWatchlistValuationFixture() {
  const fixture = await createFixture("watchlist-saved-scenario");
  const options = {
    researchCoverage: fixture.researchCoverage,
    priceCoverage: fixture.priceCoverage,
    marketsCohort: fixture.marketsCohort,
  };
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    options,
  );
  await workspace.refreshCatalog();
  await workspace.coordinator.load();
  workspace.setView("watchlist");
  const group = workspace.filingsReview;
  for (const member of group.getSnapshot().memberships)
    group.choose(group.getSnapshot(), member);
  group.startDaily(group.getSnapshot());
  return {
    fixture,
    workspace,
    group,
    model: workspace.watchlistValuationReview,
    options,
    async run() {
      const plan = group.prepareDaily(group.getSnapshot(), ["price"]);
      if (!plan) throw new Error("Missing source plan");
      await group.runDaily(group.getSnapshot(), plan);
    },
    async preview() {
      await workspace.valuationAssumptions.coordinator.load();
      return workspace.watchlistValuationReview.preview(
        workspace.watchlistValuationReview.getSnapshot(),
      );
    },
    dispose() {
      workspace.sessionOwner.dispose();
    },
  };
}
