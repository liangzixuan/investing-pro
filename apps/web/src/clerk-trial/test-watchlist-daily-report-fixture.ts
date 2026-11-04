import { createWatchlistValuationFixture } from "./test-watchlist-valuation-review-fixture";
export async function createFinishedWatchlistDailyReportFixture() {
  const f = await createWatchlistValuationFixture();
  await f.run();
  const plan = await f.preview();
  if (!plan || !f.model.evaluate(plan))
    throw new Error("Missing scenario reading");
  if (!f.group.finishDaily(f.group.getSnapshot()))
    throw new Error("Missing finished group");
  return f;
}
