import { afterEach, expect, it, vi } from "vitest";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";
import {
  captureFollowupsReportContext,
  sameFollowupsReportContext,
} from "./managed-followups-review-report-admission";
import type { ManagedDiscoveryState } from "./managed-workspace";

const disposals: (() => void)[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  disposals.splice(0).forEach((dispose) => dispose());
});
async function fixture() {
  const f = await createFollowupsReviewFixture();
  disposals.push(f.dispose);
  const workspace = f.workspace;
  const session = workspace.sessionOwner.getSnapshot();
  const view = workspace.getSnapshot();
  const draft = workspace.followups.getDraftFileContext(false)!;
  const saved = workspace.followups.coordinator.getSnapshot();
  const calls: string[] = [];
  const sessionRead = vi
    .spyOn(workspace.sessionOwner, "getSnapshot")
    .mockImplementation(() => {
      calls.push("session");
      return session;
    });
  const viewRead = vi.spyOn(workspace, "getSnapshot").mockImplementation(() => {
    calls.push("view");
    return view;
  });
  const activityRead = vi
    .spyOn(workspace.followups, "hasDraftFileActivity")
    .mockImplementation(() => {
      calls.push("activity");
      return false;
    });
  const draftRead = vi
    .spyOn(workspace.followups, "getDraftFileContext")
    .mockImplementation(() => {
      calls.push("draft");
      return draft;
    });
  const savedRead = vi
    .spyOn(workspace.followups.coordinator, "getSnapshot")
    .mockImplementation(() => {
      calls.push("save");
      return saved;
    });
  const capture = (active = true) =>
    captureFollowupsReportContext(workspace, () => {
      calls.push("route");
      return active;
    });
  return {
    capture,
    calls,
    session,
    view,
    draft,
    saved,
    sessionRead,
    viewRead,
    activityRead,
    draftRead,
    savedRead,
  };
}
it("keeps admission reads ordered and retains the exact captured resource and route references", async () => {
  const f = await fixture();
  const context = f.capture()!;
  expect(f.calls).toEqual([
    "route",
    "session",
    "view",
    "activity",
    "draft",
    "save",
  ]);
  expect(context.saveState).toBe(f.saved);
  expect(context.saved).toBe(f.draft.saved);
  expect(context.draft).toBe(f.draft.draft);
  expect(context.baseVersion).toBe(f.draft.baseVersion);
  expect(context.catalog).toBe(f.draft.catalog);
  expect(context.catalogSnapshot).toBe(f.view.snapshot);
  expect(context.session).toBe(f.session);
  expect(sameFollowupsReportContext(context, { ...context })).toBe(true);
});
it("stops before session access on an inactive route and before resource access on an inactive session", async () => {
  const f = await fixture();
  expect(f.capture(false)).toBeNull();
  expect(f.calls).toEqual(["route"]);
  f.calls.length = 0;
  f.sessionRead.mockReturnValue({ ...f.session, phase: "retired" });
  expect(f.capture()).toBeNull();
  expect(f.viewRead).not.toHaveBeenCalled();
  expect(f.activityRead).not.toHaveBeenCalled();
  expect(f.draftRead).not.toHaveBeenCalled();
});
it.each([
  ["destination", { view: "watchlist" }],
  ["research", { research: {} }],
  ["company route", { companyRoute: {} }],
  ["company opening", { followupOpening: true }],
  ["catalog read", { read: "status" }],
  ["catalog review", { reviewing: true }],
  ["catalog review result", { review: {} }],
] as const)(
  "refuses %s before reading draft ownership",
  async (_name, change) => {
    const f = await fixture();
    // Truthy route tokens test refusal only; their private contents are never read.
    f.viewRead.mockReturnValue({
      ...f.view,
      ...change,
    } as ManagedDiscoveryState);
    expect(f.capture()).toBeNull();
    expect(f.activityRead).not.toHaveBeenCalled();
    expect(f.draftRead).not.toHaveBeenCalled();
  },
);
it("checks recovery ownership before reading any draft and still reads saved state after a missing draft context", async () => {
  const f = await fixture();
  f.activityRead.mockReturnValue(true);
  expect(f.capture()).toBeNull();
  expect(f.draftRead).not.toHaveBeenCalled();
  expect(f.savedRead).not.toHaveBeenCalled();
  f.activityRead.mockReturnValue(false);
  f.draftRead.mockReturnValue(null);
  expect(f.capture()).toBeNull();
  expect(f.savedRead).toHaveBeenCalledOnce();
});
it.each([
  ["fresh load", { latestLoaded: false }],
  ["saved resource", { saved: null }],
  ["matching base", { baseVersion: 99 }],
  ["idle phase", { phase: "saving" }],
  ["conflict", { conflict: true }],
  ["uncertain commit", { uncertain: true }],
  ["pending replay", { replayPending: true }],
] as const)(
  "independently preserves the %s save admission predicate",
  async (_name, change) => {
    const f = await fixture();
    f.savedRead.mockReturnValue({
      ...f.saved,
      ...change,
    });
    expect(f.capture()).toBeNull();
  },
);
it.each([
  "saveState",
  "saved",
  "draft",
  "baseVersion",
  "catalog",
  "catalogSnapshot",
  "session",
] as const)("retires context identity when %s changes", async (field) => {
  const f = await fixture();
  const before = f.capture()!;
  const replacement = field === "baseVersion" ? 99 : null;
  // Identity comparison must refuse changed references before reading their contents.
  const after = { ...before, [field]: replacement };
  expect(sameFollowupsReportContext(before, after)).toBe(false);
  expect(sameFollowupsReportContext(before, null)).toBe(false);
});
