import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";
import { CompanyReportRevisit } from "./company-report-revisit";
import {
  captureCompanyReportRevisit,
  type CompanyReportRevisitProps,
} from "./company-report-revisit-capture";
import { formatCompanyReportDocument } from "./managed-company-report-document";
import { prepareCompanyReportComparisonCheck } from "./company-report-comparison-check";
import { companyReportComparisonCheckActions } from "./company-report-comparison-check-actions";
import type { ManagedApi } from "./managed-api";
import { reportAnnualPacket } from "./managed-annual-statements-report-fixture";
import { captureCompanyReportRevisitTargetContext } from "./company-report-revisit-target";
import type { ManagedSessionState } from "./managed-session-owner";

const disposals: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
});
afterEach(() => {
  disposals.splice(0).forEach((stop) => stop());
  vi.useRealTimers();
});
const RAW = "  Earlier assessment · Cafe\u0301 東京 😀  ";
const ASSESSMENT = "  Compare the source dates before reviewing demand.  ";
async function fixture(generic = false) {
  const f = await createFollowupsReviewFixture();
  disposals.push(f.dispose);
  const w = f.workspace;
  vi.spyOn(f.api, "save");
  if (generic) {
    w.setView("discover");
    w.setNavigationBlocked(true);
    await w.setCompanyRoute({
      kind: "company",
      listingId: f.entries[0]!.listing.listingId,
      section: "annual",
    });
  } else {
    expect(f.model.enter()).toBe(true);
    f.model.choose(
      f.model.getSnapshot(),
      f.model.getSnapshot().rows[0]!.handle,
    );
    f.model.start(f.model.getSnapshot());
    await f.open();
    w.switchToAnnual();
  }
  const selection = w.getSnapshot().research!.selection;
  vi.mocked(f.api.annualReport).mockResolvedValue(await reportAnnualPacket());
  await w.annual.load();
  expect(w.annual.getSnapshot().response).not.toBeNull();
  const entry = () => w.followups.currentEntry(f.entries[0]!.id)!;
  w.followups.edit(entry(), "result", RAW);
  if (generic) {
    expect(
      w.captureCompanyReportComparisonCheckTarget(selection, () => true),
    ).toBeNull();
    const checks = w.getCompanyResearchChecks(selection)!;
    expect(checks.attach(checks.followups.value!)?.isCurrent()).toBe(true);
  }
  let routeActive = true;
  const props: CompanyReportRevisitProps = {
    selection,
    price: w.eod,
    annual: w.annual,
    interim: w.interim,
    filings: w.filings,
    valuation: w.valuation,
    readWatchlist: (selected) => w.getResearchWatchlist(selected),
    target: () =>
      w.captureCompanyReportRevisitTarget(selection, () => routeActive),
  };
  const report = captureCompanyReportRevisit(props)!.report!;
  expect(report).not.toBeNull();
  const document = formatCompanyReportDocument({
    ...report,
    preparedAt: "2026-10-01T00:00:00.000Z",
    note: "Archived invented claim",
  })!;
  const bytes = new TextEncoder().encode(document.text).buffer;
  const controller = new CompanyReportRevisit({
    selection,
    active: () => props.target()?.isCurrent() === true,
    capture: () => captureCompanyReportRevisit(props),
  });
  disposals.push(() => controller.dispose());
  await controller.readFile({
    size: bytes.byteLength,
    arrayBuffer: () => Promise.resolve(bytes),
  });
  controller.captureCurrent();
  controller.setAssessment(ASSESSMENT);
  const target = () =>
    w.captureCompanyReportComparisonCheckTarget(selection, () => routeActive);
  const prepare = () => {
    const result = prepareCompanyReportComparisonCheck(
      controller.captureComparison()!,
      target()!,
      () => true,
    );
    expect(result.reason).toBeNull();
    expect(result.preview).not.toBeNull();
    return result.preview!;
  };
  return {
    ...f,
    w,
    entry,
    selection,
    props,
    controller,
    target,
    prepare,
    setRoute: (value: boolean) => {
      routeActive = value;
    },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function noEffects(f: Fixture) {
  expect(f.api.annualReport).toHaveBeenCalledOnce();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.recentFilings).not.toHaveBeenCalled();
  expect(f.api.save).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
}
it.each([false, true])(
  "applies once to the exact %s generic target, preserves the comparison and saves only after explicit completion",
  async (generic) => {
    const f = await fixture(generic);
    const before = f.entry();
    const visit = f.w.getSnapshot().research;
    const watchlist = f.w.coordinator.getSnapshot();
    const source = f.w.annual.getSnapshot();
    const editor = f.w.valuation.getSnapshot();
    const comparison = f.controller.captureComparison()!;
    const other = f.w.followups.currentEntry(f.entries[2]!.id);
    const preview = f.prepare();
    expect(preview.result).toBe(`${RAW} ${preview.excerpt}`);
    expect(preview.result).toContain(ASSESSMENT);
    let reentrant: boolean | undefined;
    const stop = f.w.followups.coordinator.subscribe(() => {
      reentrant = preview.apply();
    });
    expect(preview.apply()).toBe(true);
    stop();
    expect(reentrant).toBe(false);
    expect(preview.apply()).toBe(false);
    expect(f.entry()).toEqual({ ...before, result: preview.result });
    expect(f.w.followups.currentEntry(f.entries[2]!.id)).toEqual(other);
    expect(f.w.getSnapshot().research).toBe(visit);
    expect(f.w.coordinator.getSnapshot()).toBe(watchlist);
    expect(f.w.annual.getSnapshot()).toBe(source);
    expect(f.w.valuation.getSnapshot()).toBe(editor);
    expect(comparison.isCurrent()).toBe(true);
    noEffects(f);
    if (generic) {
      expect(
        f.w.reviewCompanyResearchCheck(f.selection, () => {
          f.w.setNavigationBlocked(true);
          f.w.setView("followups");
          return true;
        }),
      ).not.toBeNull();
      f.w.setNavigationBlocked(false);
      await f.w.setCompanyRoute(null);
      expect(f.w.followups.getSnapshot().selectedId).toBe(before.id);
    } else {
      f.w.closeResearch();
      expect(f.model.getSnapshot().selected?.entry.id).toBe(before.id);
      expect(f.model.getSnapshot().position).toBe(0);
    }
    const unsaved = f.make();
    await unsaved.refreshCatalog();
    await unsaved.followups.coordinator.load();
    expect(unsaved.followups.currentEntry(before.id)?.result).toBe("");
    f.w.followups.complete(f.entry(), new Date("2026-10-30T12:00:00Z"));
    await f.w.followups.coordinator.save();
    const fresh = f.make();
    await fresh.refreshCatalog();
    await fresh.followups.coordinator.load();
    expect(fresh.followups.currentEntry(before.id)).toMatchObject({
      result: preview.result.normalize("NFC").trim(),
      status: "completed",
      completedOn: "2026-10-30",
    });
    expect(f.api.saveFollowups).toHaveBeenCalledOnce();
    expect(f.api.save).not.toHaveBeenCalled();
  },
);

const changes: { name: string; change: (f: Fixture) => void }[] = [
  {
    name: "result ABA",
    change: (f) => {
      f.w.followups.edit(f.entry(), "result", "changed");
      f.w.followups.edit(f.entry(), "result", RAW);
    },
  },
  {
    name: "question ABA",
    change: (f) => {
      const raw = f.entry().check;
      f.w.followups.edit(f.entry(), "check", "changed");
      f.w.followups.edit(f.entry(), "check", raw);
    },
  },
  {
    name: "comparison assessment ABA",
    change: (f) => {
      f.controller.setAssessment("changed");
      f.controller.setAssessment(ASSESSMENT);
    },
  },
  {
    name: "equal whole draft",
    change: (f) => {
      f.w.followups.coordinator.replaceDraft({
        ...f.w.followups.coordinator.getSnapshot().draft!,
      });
    },
  },
  {
    name: "Watchlist file ABA",
    change: (f) => {
      const o = {};
      f.w.beginWatchlistDraftFileActivity(o);
      f.w.endWatchlistDraftFileActivity(o);
    },
  },
  {
    name: "Follow-ups file ABA",
    change: (f) => {
      const o = {};
      f.w.followups.beginDraftFileActivity(o);
      f.w.followups.endDraftFileActivity(o);
    },
  },
  {
    name: "Portfolio file ABA",
    change: (f) => {
      const o = {};
      f.w.portfolio.beginDraftFileActivity(o);
      f.w.portfolio.endDraftFileActivity(o);
    },
  },
  {
    name: "valuation file ABA",
    change: (f) => {
      const o = {};
      f.w.valuation.beginDraftFileActivity(o);
      f.w.valuation.endDraftFileActivity(o);
    },
  },
  {
    name: "navigation ABA",
    change: (f) => {
      f.w.setNavigationBlocked(true);
      f.w.setNavigationBlocked(false);
    },
  },
  {
    name: "catalog",
    change: (f) => {
      f.w.followups.syncCatalog(`sha256:${"b".repeat(64)}`);
    },
  },
  {
    name: "source close/open",
    change: (f) => {
      f.w.annual.close();
      f.w.annual.open(f.selection);
    },
  },
  { name: "comparison clear", change: (f) => f.controller.clear() },
  {
    name: "new current comparison",
    change: (f) => f.controller.captureCurrent(),
  },
  { name: "visit close", change: (f) => f.w.closeResearch() },
  { name: "session retirement", change: (f) => f.w.sessionOwner.retire() },
];
it.each(changes)(
  "retires after $name without observing intermediate state",
  async ({ change }) => {
    const f = await fixture();
    const preview = f.prepare();
    change(f);
    const after = f.w.followups.coordinator.getSnapshot();
    expect(preview.isCurrent()).toBe(false);
    expect(preview.apply()).toBe(false);
    expect(f.w.followups.coordinator.getSnapshot()).toBe(after);
    noEffects(f);
  },
);
it("cancel and host retirement are permanent, and reject a copied wrong destination", async () => {
  const f = await fixture();
  const saved = f.w.followups.coordinator.getSnapshot();
  const preview = f.prepare();
  preview.cancel();
  expect(preview.apply()).toBe(false);
  let active = true;
  const pending = prepareCompanyReportComparisonCheck(
    f.controller.captureComparison()!,
    f.target()!,
    () => active,
  ).preview!;
  active = false;
  expect(pending.isCurrent()).toBe(false);
  active = true;
  expect(pending.apply()).toBe(false);
  const target = f.target()!;
  expect(
    prepareCompanyReportComparisonCheck(
      f.controller.captureComparison()!,
      {
        ...target,
        entry: {
          ...target.entry,
          listing: { ...target.entry.listing, shareClassId: "different" },
        },
      },
      () => true,
    ).preview,
  ).toBeNull();
  expect(f.w.followups.coordinator.getSnapshot()).toBe(saved);
  noEffects(f);
});
it("refuses a pending save and the pre-save target after settlement", async () => {
  const f = await fixture();
  const preview = f.prepare();
  let settle!: (
    value: Awaited<ReturnType<ManagedApi["saveFollowups"]>>,
  ) => void;
  vi.mocked(f.api.saveFollowups).mockReturnValueOnce(
    new Promise((resolve) => {
      settle = resolve;
    }),
  );
  const saving = f.w.followups.coordinator.save();
  expect(f.target()?.editable).not.toBe(true);
  const command = vi.mocked(f.api.saveFollowups).mock.calls[0]![0];
  settle({
    version: command.expectedVersion + 1,
    payload: command.payload,
    replayed: false,
  });
  await saving;
  expect(preview.apply()).toBe(false);
  expect(f.entry().result).toBe(RAW.normalize("NFC").trim());
});
it("observes actual owner changes without auto-reading or selecting a target", async () => {
  const f = await fixture();
  const actions = companyReportComparisonCheckActions(
    f.w,
    f.selection,
    () => true,
  );
  const initial = actions.getSnapshot();
  expect(actions.getSnapshot()).toBe(initial);
  const listener = vi.fn();
  const stop = actions.subscribe(listener);
  f.w.followups.edit(f.entry(), "result", "new raw result");
  expect(listener).toHaveBeenCalled();
  expect(actions.getSnapshot()).not.toBe(initial);
  stop();
  noEffects(f);
});
it("keeps same-owner resource summaries separate from session replacement and permanent retirement", async () => {
  const f = await fixture();
  let owner = {};
  let session: Readonly<ManagedSessionState> = f.w.sessionOwner.getSnapshot();
  const operation = Symbol();
  const note = vi.fn();
  const capture = () =>
    captureCompanyReportRevisitTargetContext({
      selection: f.selection,
      routeActive: () => true,
      watchlist: () => f.w.getResearchWatchlist(f.selection),
      saved: () => f.w.coordinator.getSnapshot(),
      session: () => session,
      sessionOwner: () => owner,
      visit: () => f.w.getSnapshot().research,
      lifetime: () => ({
        retired: false,
        navigationBlocked: false,
        operation,
        navigation: 0,
      }),
      note,
    })!;
  const replaced = capture();
  session = {
    ...session,
    followups: { ...session.followups, dirty: !session.followups.dirty },
  };
  expect(replaced.isCurrent()).toBe(true);
  owner = {};
  expect(replaced.isCurrent()).toBe(false);
  const retired = capture();
  session = { ...session, phase: "signing_out" };
  expect(retired.isCurrent()).toBe(false);
  session = { ...session, phase: "active" };
  expect(retired.isCurrent()).toBe(false);
  expect(retired.append("Must not append", "")).toBe(false);
  expect(note).not.toHaveBeenCalled();
  const actual = f.props.target()!;
  f.w.sessionOwner.retire();
  expect(actual.isCurrent()).toBe(false);
  expect(actual.append("Must not append", "")).toBe(false);
});
