import { afterEach, describe, expect, it, vi } from "vitest";
import {
  comparisonFollowupFixture,
  disposeComparisonFollowupFixture,
  held,
} from "./managed-screen-comparison-followup-fixture";
import { ScreenComparisonFollowupReview } from "./use-screen-comparison-followup-state";

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((close) => close());
  vi.restoreAllMocks();
});
async function fixture(loaded = true) {
  const f = await comparisonFollowupFixture(loaded);
  const workspace = f.host.workspace;
  Object.defineProperty(workspace, "screenComparisonFollowup", {
    value: f.context,
  });
  const props = {
    workspace,
    routeActive: () => f.state.available,
    navigationPending: false,
    onReview: vi.fn(),
  };
  const review = new ScreenComparisonFollowupReview(props);
  review.mount();
  review.commit({}, props);
  cleanups.push(() => {
    review.dispose();
    disposeComparisonFollowupFixture(f);
  });
  return { ...f, props, review };
}
function capture(review: ScreenComparisonFollowupReview) {
  review.setOpen(true);
  review.capture();
}
function author(review: ScreenComparisonFollowupReview) {
  review.edit("side", "right");
  review.edit(
    "question",
    "Does this comparison change my research? Café 東京 📈",
  );
  review.edit("dueOn", "2026-12-31");
}
function preview(review: ScreenComparisonFollowupReview) {
  capture(review);
  author(review);
  review.prepare();
  const result = review.getSnapshot().preview;
  expect(result).not.toBeNull();
  return result!;
}
function unchanged(
  f: Awaited<ReturnType<typeof fixture>>,
  watchlist: unknown,
  reads: number,
) {
  expect(f.watchlist.getSnapshot()).toBe(watchlist);
  expect(f.watchlist.getSnapshot().dirty).toBe(true);
  expect(f.screen.read).toHaveBeenCalledTimes(reads);
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.watchlistSave).not.toHaveBeenCalled();
}

describe("comparison dated-check form ownership", () => {
  it("starts closed and requires explicit capture and an empty two-company destination choice", async () => {
    const f = await fixture();
    const watchlist = f.watchlist.getSnapshot(),
      reads = f.screen.read.mock.calls.length;
    expect(f.review.getSnapshot().open).toBe(false);
    expect(f.review.canCapture()).toBe(false);
    f.review.capture();
    f.review.edit("side", "right");
    expect(f.review.getSnapshot().capture).toBeNull();
    expect(f.review.getSnapshot().side).toBe("");
    capture(f.review);
    expect(
      f.review
        .destinations()
        .map((row) => [row.side, row.listing.listingId, row.eligible]),
    ).toEqual([
      ["left", f.report.left.listing.listingId, true],
      ["right", f.report.right.listing.listingId, true],
    ]);
    expect(f.review.canPrepare()).toBe(false);
    author(f.review);
    f.review.capture();
    expect(f.review.getSnapshot().side).toBe("");
    expect(f.review.getSnapshot().question).toContain("Café 東京 📈");
    unchanged(f, watchlist, reads);
  });

  it("retains raw invalid text, refuses overflow and independently validates the UTC date", async () => {
    const f = await fixture();
    capture(f.review);
    author(f.review);
    for (const question of [
      "raw\nquestion",
      "😀".repeat(501),
      "hidden\u200btext",
    ]) {
      f.review.edit("question", question);
      f.review.prepare();
      expect(f.review.getSnapshot().question).toBe(question);
      expect(f.review.getSnapshot().preview).toBeNull();
      expect(f.review.getSnapshot().message).toBeTruthy();
    }
    author(f.review);
    f.review.edit("dueOn", "2026-02-29");
    f.review.prepare();
    expect(f.review.getSnapshot().dueOn).toBe("2026-02-29");
    expect(f.review.getSnapshot().preview).toBeNull();
    expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([]);
  });

  it("creates one exact selected draft, admits Review and leaves both Saves independent", async () => {
    const f = await fixture();
    const watchlist = f.watchlist.getSnapshot(),
      reads = f.screen.read.mock.calls.length;
    const ready = preview(f.review);
    expect(ready.comparison.left.response).toBe(f.screen.left);
    expect(ready.comparison.right.response).toBe(f.screen.right);
    expect(ready.listing).toEqual(f.report.right.listing);
    expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([]);
    f.review.create(ready);
    f.review.create(ready);
    const created = f.review.getSnapshot().created!;
    expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([
      created,
    ]);
    expect(created.check).toBe(ready.check);
    expect(created.dueOn).toBe("2026-12-31");
    expect(created.listing).toEqual(ready.listing);
    expect(f.review.canReview()).toBe(true);
    const opener = {} as HTMLButtonElement;
    f.review.review(opener);
    expect(f.props.onReview).toHaveBeenCalledExactlyOnceWith(created, opener);
    unchanged(f, watchlist, reads);
  });

  it("invalidates old preview and committed handlers on edits, collapse and navigation ABA", async () => {
    const f = await fixture();
    const ready = preview(f.review);
    const token = {},
      rendered = f.review.getSnapshot();
    f.review.commit(token, f.props);
    expect(f.review.current(token, rendered)).toBe(true);
    f.review.edit("question", "Retain my revised question");
    expect(f.review.current(token, rendered)).toBe(false);
    expect(ready.isCurrent()).toBe(false);
    f.review.prepare();
    const second = f.review.getSnapshot().preview!;
    f.review.setOpen(false);
    f.review.create(second);
    expect(f.review.getSnapshot().capture).toBeNull();
    expect(f.review.getSnapshot().question).toBe("Retain my revised question");
    capture(f.review);
    author(f.review);
    f.review.prepare();
    const third = f.review.getSnapshot().preview!;
    f.state.available = false;
    f.state.navigation++;
    f.updates.emit();
    f.state.available = true;
    f.state.navigation++;
    f.updates.emit();
    f.review.create(third);
    expect(f.review.getSnapshot().preview).toBeNull();
    expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([]);
  });

  it("loads only explicitly, then requires a fresh post-load preview without choosing or writing", async () => {
    const f = await fixture(false);
    capture(f.review);
    author(f.review);
    const source = f.review.getSnapshot().capture;
    expect(f.api.loadFollowups).not.toHaveBeenCalled();
    expect(f.review.canPrepare()).toBe(false);
    expect(f.review.canLoad()).toBe(true);
    await f.review.load();
    expect(f.api.loadFollowups).toHaveBeenCalledOnce();
    expect(f.review.getSnapshot().capture).toBe(source);
    expect(f.review.getSnapshot().preview).toBeNull();
    expect(f.review.getSnapshot().side).toBe("right");
    expect(f.review.canLoad()).toBe(false);
    expect(f.review.canPrepare()).toBe(true);
    f.review.prepare();
    expect(f.review.getSnapshot().preview).not.toBeNull();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  });

  it("refuses late Load adoption after collapse and retains raw edits after settlement", async () => {
    const f = await fixture(false);
    capture(f.review);
    author(f.review);
    const pending = held<Awaited<ReturnType<typeof f.api.loadFollowups>>>();
    f.api.loadFollowups.mockReturnValueOnce(pending.promise);
    const loading = f.review.load();
    expect(f.review.getSnapshot().loading).toBe(true);
    f.review.edit("question", "Later raw question");
    f.review.setOpen(false);
    pending.resolve({ version: 0, payload: { schemaVersion: 1, entries: [] } });
    await loading;
    expect(f.review.getSnapshot()).toMatchObject({
      open: false,
      loading: false,
      capture: null,
      preview: null,
      question: "Later raw question",
      side: "",
    });
    expect(f.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  });

  it("cancels previews on draft and session publications and keeps disposed handlers inert", async () => {
    const f = await fixture();
    const ready = preview(f.review);
    f.followups.coordinator.replaceDraft({
      ...f.followups.coordinator.getSnapshot().draft!,
      entries: [],
    });
    expect(f.review.getSnapshot().capture).not.toBeNull();
    expect(f.review.getSnapshot().preview).toBeNull();
    expect(ready.isCurrent()).toBe(false);
    f.review.prepare();
    const next = f.review.getSnapshot().preview!;
    f.state.sessionPhase = "signing_out";
    f.sessions.emit();
    expect(f.review.getSnapshot().capture).toBeNull();
    f.state.sessionPhase = "active";
    f.sessions.emit();
    f.review.dispose();
    f.review.create(next);
    f.review.capture();
    expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([]);
  });

  it("adds the recorded Watchlist retirement reason while retaining the raw authored fields", async () => {
    const f = await fixture();
    capture(f.review);
    author(f.review);
    f.review.edit("question", "Keep this raw\nquestion Café 東京 📈");
    const captured = f.review.getSnapshot().capture!;
    const draft = f.watchlist.getSnapshot().draft!;
    f.watchlist.replaceDraft({
      ...draft,
      memberships: draft.memberships.map((member, index) =>
        index === 0
          ? { ...member, note: "Another unsaved Watchlist note." }
          : member,
      ),
    });
    const reason = f.context.retirementReason(captured);
    expect(reason).toMatch(/Watchlist/i);
    expect(f.review.getSnapshot()).toMatchObject({
      capture: null,
      preview: null,
      side: "right",
      question: "Keep this raw\nquestion Café 東京 📈",
      dueOn: "2026-12-31",
    });
    expect(f.review.getSnapshot().message).toBe(
      "This comparison or check is no longer current. Capture or preview the current context again. Your question and date are retained. " +
        reason,
    );
    expect(f.watchlistSave).not.toHaveBeenCalled();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  });

  it("keeps the original generic guidance when no recorded retirement reason is available", async () => {
    const f = await fixture();
    capture(f.review);
    author(f.review);
    const captured = f.review.getSnapshot().capture!;
    const read = vi.spyOn(f.context, "retirementReason").mockReturnValue(null);
    f.state.available = false;
    f.updates.emit();
    expect(read).toHaveBeenCalledExactlyOnceWith(captured);
    expect(f.review.getSnapshot()).toMatchObject({
      capture: null,
      preview: null,
      question: "Does this comparison change my research? Café 東京 📈",
      dueOn: "2026-12-31",
      message:
        "This comparison or check is no longer current. Capture or preview the current context again. Your question and date are retained.",
    });
    expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([]);
  });

  it("distinguishes inactive committed navigation without evaluating a context retirement lookup", async () => {
    const f = await fixture();
    capture(f.review);
    author(f.review);
    const read = vi.spyOn(f.context, "retirementReason");
    f.review.commit({}, { ...f.props, navigationPending: true });
    expect(read).not.toHaveBeenCalled();
    expect(f.review.getSnapshot()).toMatchObject({
      capture: null,
      preview: null,
      side: "right",
      question: "Does this comparison change my research? Café 東京 📈",
      dueOn: "2026-12-31",
      message:
        "This comparison or check is no longer current. Capture or preview the current context again. Your question and date are retained. The comparison form is no longer on its active route.",
    });
    expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([]);
  });
});
