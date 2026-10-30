import * as React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedWorkspace } from "./managed-workspace";
import {
  ManagedResearchDraftSetFiles,
  type ResearchDraftSetFilesProps,
} from "./ManagedResearchDraftSetFiles";
import {
  createFixture,
  savedValuationInputs,
} from "../../android-tests/managed-workspace/fixture";
import { draftSetFixture, scope } from "./test-research-draft-set-fixture";
import { RESEARCH_DRAFT_RESOURCES } from "./managed-research-draft-set-file";
import type { ValuationTestEffectSlot } from "./valuation-draft-files-test-hooks";
const h = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  ...(
    await import("./valuation-draft-files-test-hooks")
  ).createValuationDraftTestHooks(h),
}));
const closes: (() => void)[] = [];
beforeEach(() => {
  h.index = 0;
  h.slots = [];
  h.effects = [];
  vi.stubGlobal("document", { body: {}, activeElement: null });
});
afterEach(() => {
  for (const slot of h.slots)
    (slot as ValuationTestEffectSlot | undefined)?.cleanup?.();
  for (const close of closes.splice(0)) close();
  vi.unstubAllGlobals();
});
type Element = React.ReactElement<Record<string, unknown>>;
function elements(node: React.ReactNode): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === "function")
    return elements((node.type as (p: unknown) => React.ReactNode)(node.props));
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function mounted(props: ResearchDraftSetFilesProps) {
  const render = () => {
    let tree = React.createElement(React.Fragment);
    for (let i = 0; i < 2; i++) {
      h.index = 0;
      tree = ManagedResearchDraftSetFiles(props);
      elements(tree);
      for (const effect of h.effects.splice(0)) effect();
    }
    return tree;
  };
  const input = (tree: React.ReactNode, key: string) =>
    elements(tree).find(
      (n) => n.props.id === `managed-research-draft-set-select-${key}`,
    )!;
  return { render, input };
}
it("admits the actual staged native fixture's four controls on its settled company URL while preserving the root-file route guard", async () => {
  const fixture = await createFixture("research-draft-set"),
    control = fixture.researchDraftSet!;
  const w = new ManagedWorkspace(fixture.api, fixture.session, undefined, {
    researchCoverage: fixture.researchCoverage,
    marketsCohort: fixture.marketsCohort,
    priceCoverage: fixture.priceCoverage,
  });
  closes.push(() => w.sessionOwner.dispose());
  await w.coordinator.load();
  await w.refreshCatalog();
  w.openWatchlistAnnual(w.coordinator.getSnapshot().draft!.memberships[0]!);
  // This is the real router protocol: a company URL keeps the root-navigation block set.
  w.setNavigationBlocked(true);
  await w.setCompanyRoute({
    kind: "company",
    listingId: "listing-zero",
    section: "annual",
  });
  await Promise.all([
    w.portfolio.coordinator.load(),
    w.followups.coordinator.load(),
    w.valuationAssumptions.coordinator.load(),
  ]);
  w.coordinator.replaceDraft(control.data.captured.watchlist);
  w.portfolio.coordinator.replaceDraft({
    ledger: control.data.captured.portfolio,
  });
  w.followups.coordinator.replaceDraft(control.data.captured.followups);
  w.valuationAssumptions.coordinator.replaceDraft(
    control.data.captured.valuation,
  );
  const editor = w.valuation.getSnapshot(),
    context = editor.context!;
  expect(
    w.valuation.restoreDraftInputs(
      {
        ...savedValuationInputs!,
        listing: context.listing,
        cik: context.cik,
        catalogSnapshotSha256: context.catalogSnapshotSha256,
      },
      editor,
    ),
  ).toBe(true);
  expect(w.valuation.calculate()).not.toBeNull();
  const props: ResearchDraftSetFilesProps = {
      workspace: w,
      accountScope: Promise.resolve(scope),
      delivery: { deliver: () => Promise.resolve("written") },
      routeActive: () => true,
      navigationPending: false,
    },
    ui = mounted(props);
  ui.render();
  await Promise.resolve();
  let tree = ui.render();
  expect(w.getSnapshot().companyRoute).toMatchObject({
    status: "open",
    listingId: "listing-zero",
    section: "annual",
  });
  expect(w.getWatchlistDraftFileContext()).toBeNull();
  expect(w.getWatchlistResourceDraftContext()).not.toBeNull();
  for (const key of RESEARCH_DRAFT_RESOURCES) {
    const checkbox = ui.input(tree, key);
    expect(checkbox.props.disabled, key).toBe(false);
    expect(checkbox.props.checked, key).toBe(false);
    (checkbox.props.onChange as (e: unknown) => void)({
      currentTarget: { checked: true },
    });
    tree = ui.render();
    expect(ui.input(tree, key).props.checked, key).toBe(true);
  }
  expect(
    elements(tree).find(
      (n) => n.props.id === "managed-research-draft-set-capture",
    )?.props.disabled,
  ).toBe(false);
  expect(fixture.getSnapshot()).toMatchObject({
    load: 1,
    status: 1,
    marketsResolve: 1,
    annual: 0,
    eod: 0,
    filings: 0,
  });
  expect(control.getSnapshot()).toMatchObject({
    rejected: 0,
    portfolioSave: 0,
    valuationSave: 0,
  });
});
it("keeps exact route revision, away and session fences for the resource context", async () => {
  const f = await draftSetFixture();
  closes.push(f.close);
  const w = f.workspace,
    visit = w.getSnapshot().research!;
  w.setNavigationBlocked(true);
  await w.setCompanyRoute({
    kind: "company",
    listingId: visit.selection.listing.listingId,
    section: visit.section,
  });
  f.recovery.reconcile();
  expect(w.getWatchlistResourceDraftContext()).not.toBeNull();
  for (const key of RESEARCH_DRAFT_RESOURCES)
    expect(f.recovery.selectResource(key, true)).toBe(true);
  expect(f.recovery.captureDrafts()).toBe(true);
  w.setNavigationBlocked(true);
  w.setNavigationBlocked(true);
  f.recovery.reconcile();
  expect(f.recovery.getSnapshot().file).toBeNull();
  expect(w.getWatchlistResourceDraftContext()).not.toBeNull();
  w.closeResearch();
  expect(w.getResearchDraftSetRoute().blocked).toBe(true);
  expect(w.getWatchlistResourceDraftContext()).toBeNull();
  w.sessionOwner.retire("retired");
  expect(w.getWatchlistResourceDraftContext()).toBeNull();
  expect(f.recovery.getSnapshot().phase).toBe("retired");
});

it("refuses reentrant capture while navigation invalidates a prepared source pass", async () => {
  const f = await draftSetFixture();
  closes.push(f.close);
  const w = f.workspace,
    visit = w.getSnapshot().research!;
  w.setNavigationBlocked(true);
  await w.setCompanyRoute({
    kind: "company",
    listingId: visit.selection.listing.listingId,
    section: visit.section,
  });
  f.recovery.reconcile();
  f.recovery.selectResource("watchlist", true);
  expect(
    w.prepareCompanySourcePass(w.getSnapshot().research!, ["annual"]),
  ).not.toBeNull();
  const attempts: unknown[] = [];
  const off = w.companySourcePass.subscribe(() => {
    attempts.push({
      blocked: w.getResearchDraftSetRoute().blocked,
      context: w.getWatchlistResourceDraftContext(),
      captured: f.recovery.captureDrafts(),
    });
  });
  w.setNavigationBlocked(true);
  off();
  expect(attempts.length).toBeGreaterThan(0);
  expect(attempts).toEqual(
    attempts.map(() => ({ blocked: true, context: null, captured: false })),
  );
  expect(f.recovery.getSnapshot().file).toBeNull();
  f.recovery.reconcile();
  expect(w.getWatchlistResourceDraftContext()).not.toBeNull();
  expect(f.recovery.captureDrafts()).toBe(true);
  expect(f.unexpected).not.toHaveBeenCalled();
});
it("retires a captured file through catalog reads and refuses a changed catalog with the old company visit", async () => {
  const f = await draftSetFixture();
  closes.push(f.close);
  const w = f.workspace,
    visit = w.getSnapshot().research!;
  w.setNavigationBlocked(true);
  await w.setCompanyRoute({
    kind: "company",
    listingId: visit.selection.listing.listingId,
    section: visit.section,
  });
  f.recovery.reconcile();
  f.capture();
  const original = await f.api.status(new AbortController().signal);
  let finish!: (value: Awaited<ReturnType<typeof f.api.status>>) => void;
  vi.mocked(f.api.status).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = w.refreshCatalog();
  expect(w.getWatchlistResourceDraftContext()).toBeNull();
  expect(f.recovery.getSnapshot().file).toBeNull();
  expect(f.recovery.captureDrafts()).toBe(false);
  finish({
    ...original,
    snapshot: {
      ...original.snapshot,
      snapshotSha256: `sha256:${"f".repeat(64)}`,
    },
  });
  await pending;
  expect(w.getSnapshot().research).toBeNull();
  expect(w.getWatchlistResourceDraftContext()).toBeNull();
  expect(w.getResearchDraftSetRoute().blocked).toBe(true);
});
