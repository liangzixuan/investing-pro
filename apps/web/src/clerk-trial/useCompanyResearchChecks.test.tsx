import * as React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedCompanyResearchChecks } from "./ManagedCompanyResearchChecks";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";
import { reportAnnualPacket } from "./managed-annual-statements-report-fixture";
import { captureCompanyReportRevisit } from "./company-report-revisit-capture";
import { CompanyReportRevisit } from "./company-report-revisit";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { reportRevisitDocument } from "../../android-tests/managed-workspace/report-revisit-fixture";
import type { ManagedApi } from "./managed-api";
import type { ValuationTestEffectSlot } from "./valuation-draft-files-test-hooks";

const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
  pending: false,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  const base = createValuationDraftTestHooks(hooks);
  return {
    ...actual,
    ...base,
    useState: (initial: unknown) => {
      const [value, setter] = base.useState(initial);
      return [
        value,
        (next: unknown) => {
          (setter as (next: unknown) => void)(next);
          hooks.pending = true;
        },
      ];
    },
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      snapshot: () => unknown,
    ) => {
      const value = snapshot();
      base.useLayoutEffect(() => {
        let previous = value;
        return subscribe(() => {
          const next = snapshot();
          if (next !== previous) {
            previous = next;
            hooks.pending = true;
          }
        });
      }, [subscribe, snapshot]);
      return value;
    },
  };
});
type NodeProps = {
  id?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  value?: unknown;
  onClick?: () => void;
};
function controls(tree: React.ReactNode): React.ReactElement<NodeProps>[] {
  return React.Children.toArray(tree).flatMap((node) => {
    if (!React.isValidElement<NodeProps>(node)) return [];
    return [node, ...controls(node.props.children)];
  });
}
function choice(tree: React.ReactNode) {
  return controls(tree).find(
    (node) => node.props.id === "managed-company-check-choice",
  )!.props;
}
const disposals: (() => void)[] = [];
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  hooks.pending = false;
});
afterEach(() => {
  for (const slot of hooks.slots)
    (slot as ValuationTestEffectSlot | undefined)?.cleanup?.();
  disposals.splice(0).forEach((stop) => stop());
});
async function setup() {
  const f = await createFollowupsReviewFixture();
  disposals.push(f.dispose);
  const w = f.workspace;
  w.setView("discover");
  w.setNavigationBlocked(true);
  await w.setCompanyRoute({
    kind: "company",
    listingId: f.entries[0]!.listing.listingId,
    section: "annual",
  });
  const selection = w.getSnapshot().research!.selection;
  const props = {
    workspace: w,
    selection,
    navigationPending: false,
    routeActive: () => true,
  };
  let tree: React.ReactNode;
  function render() {
    hooks.pending = false;
    hooks.index = 0;
    hooks.effects = [];
    tree = ManagedCompanyResearchChecks(props);
    hooks.effects.splice(0).forEach((effect) => effect());
  }
  render();
  const flush = () => {
    if (hooks.pending) render();
    return tree;
  };
  let settle!: (value: Awaited<ReturnType<ManagedApi["annualReport"]>>) => void;
  vi.mocked(f.api.annualReport).mockReturnValueOnce(
    new Promise((resolve) => {
      settle = resolve;
    }),
  );
  return {
    ...f,
    w,
    selection,
    flush,
    settle: (packet: Awaited<ReturnType<ManagedApi["annualReport"]>>) =>
      settle(packet),
  };
}

it("reenables the mounted empty selector after a pending Annual load and local report capture, without another workspace render", async () => {
  const f = await setup();
  expect(choice(f.flush()).disabled).toBe(false);
  const props = {
    selection: f.selection,
    price: f.w.eod,
    annual: f.w.annual,
    interim: f.w.interim,
    filings: f.w.filings,
    readWatchlist: () => f.w.getResearchWatchlist(f.selection),
    target: () =>
      f.w.captureCompanyReportRevisitTarget(f.selection, () => true),
  };
  const report = new CompanyReportRevisit({
    selection: f.selection,
    active: () => props.target()?.isCurrent() === true,
    capture: () => captureCompanyReportRevisit(props),
  });
  disposals.push(() => report.dispose());
  const document = await reportRevisitDocument(
    await createFixture("company-snapshot"),
  );
  const bytes = new TextEncoder().encode(document.text).buffer;
  await report.readFile({
    size: bytes.byteLength,
    arrayBuffer: () => Promise.resolve(bytes),
  });
  const pending = f.w.annual.load();
  expect(f.w.annual.getSnapshot().running).toBe(true);
  // A normal same-company note edit is a subscribed owner change during the source read.
  f.w.note(
    f.selection.listing.listingId,
    "Authored note edited during Annual load",
  );
  expect(hooks.pending).toBe(true);
  expect(choice(f.flush()).disabled).toBe(true);
  const resources = [
    f.w.coordinator.getSnapshot(),
    f.w.portfolio.coordinator.getSnapshot(),
    f.w.followups.coordinator.getSnapshot(),
  ];
  const visit = f.w.getSnapshot();
  f.settle(await reportAnnualPacket());
  await pending;
  expect(f.w.annual.getSnapshot().running).toBe(false);
  expect(f.w.getSnapshot()).toBe(visit);
  [
    f.w.coordinator.getSnapshot(),
    f.w.portfolio.coordinator.getSnapshot(),
    f.w.followups.coordinator.getSnapshot(),
  ].forEach((snapshot, index) => expect(snapshot).toBe(resources[index]));
  report.captureCurrent();
  expect(report.comparisonIsCurrent()).toBe(true);
  expect(f.w.getCompanyResearchChecks(f.selection)?.canAttach).toBe(true);
  // This flush processes subscribed notifications only; it never forces a parent render.
  expect(choice(f.flush()).disabled).toBe(false);
  expect(choice(f.flush()).value).toBe("");
  expect(f.w.getCompanyResearchChecks(f.selection)?.attachment).toBeNull();
  expect(f.api.annualReport).toHaveBeenCalledOnce();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.recentFilings).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});

it("observes close notifications from all four source models and retains pending file restrictions", async () => {
  const f = await setup();
  const pending = f.w.annual.load();
  const operation = {};
  f.w.beginWatchlistDraftFileActivity(operation);
  expect(choice(f.flush()).disabled).toBe(true);
  f.settle(await reportAnnualPacket());
  await pending;
  expect(choice(f.flush()).disabled).toBe(true);
  f.w.endWatchlistDraftFileActivity(operation);
  expect(choice(f.flush()).disabled).toBe(false);
  for (const source of [f.w.annual, f.w.interim, f.w.filings, f.w.eod]) {
    if (!source.getSnapshot().selection) source.open(f.selection);
    void f.flush();
    hooks.pending = false;
    source.close();
    expect(hooks.pending).toBe(true);
    void f.flush();
  }
});

it("disables the selector during a separate saved-valuation load and reenables it only after settlement", async () => {
  const f = await setup();
  const before = f.w.followups.coordinator.getSnapshot();
  let settle!: (
    value: Awaited<ReturnType<ManagedApi["loadValuationAssumptions"]>>,
  ) => void;
  const load = vi.spyOn(f.api, "loadValuationAssumptions").mockReturnValueOnce(
    new Promise((resolve) => {
      settle = resolve;
    }),
  );
  expect(choice(f.flush()).disabled).toBe(false);
  const pending = f.w.valuationAssumptions.coordinator.load();
  expect(f.w.valuationAssumptions.coordinator.getSnapshot().phase).toBe(
    "loading",
  );
  expect(choice(f.flush()).disabled).toBe(true);
  settle({ version: 0, payload: { schemaVersion: 1, entries: [] } });
  await pending;
  expect(f.w.valuationAssumptions.coordinator.getSnapshot().phase).toBe("idle");
  expect(f.w.valuationAssumptions.coordinator.getSnapshot().latestLoaded).toBe(
    true,
  );
  expect(choice(f.flush()).disabled).toBe(false);
  expect(choice(f.flush()).value).toBe("");
  expect(f.w.followups.coordinator.getSnapshot()).toBe(before);
  expect(f.w.getCompanyResearchChecks(f.selection)?.attachment).toBeNull();
  expect(load).toHaveBeenCalledOnce();
  expect(f.api.annualReport).not.toHaveBeenCalled();
});
