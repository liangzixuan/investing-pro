import { vi } from "vitest";
import { screenPassReviewWorkspaceFixture } from "../../android-tests/managed-workspace/test-screen-pass-review-workspace";
import { createWorkspaceScreenPassReview } from "./financial-screen-pass-review-context";
import { createScreenPassReviewReportSource } from "./screen-pass-review-report-source";

export async function screenPassReportFixture() {
  const f = await screenPassReviewWorkspaceFixture("screen-pass-report");
  let routeActive = true;
  const owner = createWorkspaceScreenPassReview(f.w, () => routeActive);
  const preview = owner.controller.preview(owner.controller.getSnapshot())!;
  const pending = owner.controller.run(preview);
  await vi.advanceTimersByTimeAsync(40000);
  await pending;
  const source = createScreenPassReviewReportSource(
    f.w,
    owner.controller,
    () => routeActive,
  );
  return {
    ...f,
    owner,
    source,
    setRoute(active: boolean) {
      routeActive = active;
      source.reconcile();
    },
    dispose() {
      source.dispose();
      owner.dispose();
      f.w.sessionOwner.dispose();
    },
  };
}
