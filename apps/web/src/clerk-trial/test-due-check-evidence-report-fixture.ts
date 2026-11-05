import { vi } from "vitest";
import { sourceConnectedFixture } from "./test-source-connected-workspace-fixture";
import { ManagedAnnualReportError } from "./managed-api";
import { createManagedDueCheckEvidenceReportSource } from "./managed-due-check-evidence-report-source";

/** Real review/evidence/resource owners, invented transport, no Watchlist load. */
export async function finishedDueCheckReportFixture(partial = false) {
  const f = await sourceConnectedFixture();
  const w = f.workspace;
  let routeActive = true;
  const source = createManagedDueCheckEvidenceReportSource(
    w,
    () => routeActive,
  );
  f.start();
  const first = await f.open();
  if (partial)
    vi.mocked(f.api.annualReport).mockRejectedValueOnce(
      new ManagedAnnualReportError("request_timeout"),
    );
  await f.run();
  const firstReading = f.capture();
  w.researchFollowupContext(first.selection)!.editAssessment(
    "Final authored assessment · Café 東京 <script>invented</script>",
  );
  w.returnFromResearch();
  w.followups.complete(f.review.getSnapshot().selected!.entry, new Date());
  f.review.continue(f.review.getSnapshot());
  await f.open();
  await f.run();
  const secondReading = f.capture();
  w.returnFromResearch();
  f.review.continue(f.review.getSnapshot());
  // Explicitly leave the unsupported chosen check uncaptured.
  f.review.finish(f.review.getSnapshot());
  return {
    ...f,
    source,
    firstReading,
    secondReading,
    setRouteActive: (value: boolean) => {
      routeActive = value;
      source.reconcile();
    },
    dispose: () => {
      source.dispose();
      f.dispose();
    },
  };
}
