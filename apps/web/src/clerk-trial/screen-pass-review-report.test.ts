import { afterEach, expect, it, vi } from "vitest";
import { screenPassReportFixture } from "./test-screen-pass-review-report-fixture";
import { prepareScreenPassReviewReport } from "./screen-pass-review-report";
import { createScreenPassReviewReportSource } from "./screen-pass-review-report-source";
afterEach(() => vi.useRealTimers());

it("rechecks disposal after an owned route callback during current()", async () => {
  const f = await screenPassReportFixture();
  let armed = false;
  let source: ReturnType<typeof createScreenPassReviewReportSource> | undefined;
  const spy = vi
    .spyOn(f.w, "captureWatchlistScreenRoute")
    .mockImplementation(() => () => {
      if (armed) source!.dispose();
      return true;
    });
  try {
    source = createScreenPassReviewReportSource(
      f.w,
      f.owner.controller,
      () => true,
    );
    const capture = source.capture()!;
    expect(capture).not.toBeNull();
    armed = true;
    expect(capture.current()).toBe(false);
    expect(source.canCapture()).toBe(false);
  } finally {
    source?.dispose();
    spy.mockRestore();
    f.dispose();
  }
});
it("copies every previous/current field and ordered request without authority symbols or new effects", async () => {
  const f = await screenPassReportFixture();
  try {
    const before = f.meta.getSnapshot(),
      screen = f.screen.getSnapshot(),
      state = f.owner.controller.getSnapshot();
    const captured = f.source.capture()!;
    expect(captured).not.toBeNull();
    expect(captured.report.plan).toEqual(
      JSON.parse(JSON.stringify(state.plan)),
    );
    expect(captured.report.current).toEqual(
      JSON.parse(JSON.stringify(state.result)),
    );
    expect(captured.report.catalogSnapshotSha256).toBe(
      screen.catalogSnapshotSha256,
    );
    expect(() => structuredClone(captured.report)).not.toThrow();
    expect(
      Object.isFrozen(captured.report.current.rows[0]!.report!.response),
    ).toBe(true);
    expect(f.meta.getSnapshot()).toBe(before);
    expect(f.screen.getSnapshot()).toBe(screen);
    expect(f.w.coordinator.getSnapshot()).toBe(f.resource);
    expect(
      prepareScreenPassReviewReport(
        { ...state, status: "running" },
        screen.catalogSnapshotSha256!,
        new Date().toISOString(),
      ),
    ).toBeNull();
    expect(
      prepareScreenPassReviewReport(
        { ...state, currentHandle: Symbol() },
        screen.catalogSnapshotSha256!,
        new Date().toISOString(),
      ),
    ).toBeNull();
  } finally {
    f.dispose();
  }
});
it("retires capture on route ABA and prepares only a new lease after return", async () => {
  const f = await screenPassReportFixture();
  try {
    const old = f.source.capture()!;
    f.setRoute(false);
    f.setRoute(true);
    expect(old.current()).toBe(false);
    expect(f.source.capture()).not.toBeNull();
    const next = f.source.capture()!;
    f.w.note(
      f.resource.draft!.memberships[0]!.listingId,
      "changed invented note",
    );
    expect(next.current()).toBe(false);
  } finally {
    f.dispose();
  }
});
it.each(["dispose", "replace"] as const)(
  "refuses source reentry during route capture: %s",
  async (kind) => {
    const f = await screenPassReportFixture();
    try {
      const old = f.source.capture()!;
      const original = f.w.captureWatchlistScreenRoute.bind(f.w);
      const spy = vi
        .spyOn(f.w, "captureWatchlistScreenRoute")
        .mockImplementationOnce(() => {
          if (kind === "dispose") f.source.dispose();
          else f.owner.controller.cancel(f.owner.controller.getSnapshot());
          return original();
        });
      expect(f.source.capture()).toBeNull();
      expect(old.current()).toBe(false);
      spy.mockRestore();
    } finally {
      f.dispose();
    }
  },
);
it("does not treat an equal criteria replacement as the captured result", async () => {
  const f = await screenPassReportFixture();
  try {
    const captured = f.source.capture()!,
      state = f.screen.getSnapshot();
    const next = {
      ...state.criteria,
      clauses: [
        {
          field: "operatingCashFlow" as const,
          operator: "gte" as const,
          value: "999999",
        },
      ],
    };
    f.screen.captureRefinement(state, next, new Date().toISOString())!.apply();
    expect(captured.current()).toBe(false);
    expect(f.source.capture()).toBeNull();
    f.screen
      .captureRefinement(
        f.screen.getSnapshot(),
        state.criteria,
        new Date().toISOString(),
      )!
      .apply();
    expect(captured.current()).toBe(false);
    expect(f.source.capture()).toBeNull();
  } finally {
    f.dispose();
  }
});
