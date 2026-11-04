import type { SharedNativeFixture } from "./fixture";
import { createWatchlistSavedScenarioFixture } from "./watchlist-saved-scenario-fixture";

/** Reuses the bounded invented Class A/Class C/unsupported daily-review protocol. */
export function createWatchlistDailyReportFixture(base: SharedNativeFixture) {
  return createWatchlistSavedScenarioFixture(base);
}
