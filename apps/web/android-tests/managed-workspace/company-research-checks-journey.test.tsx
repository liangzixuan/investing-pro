import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFixture, savedValuationInputs } from "./fixture";
import {
  companyCheckNote,
  companyCheckIndependentResult,
  companyCheckAssessment,
  companyCheckResult,
} from "./company-research-checks-fixture-data";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { ManagedCompanyResearchChecks } from "../../src/clerk-trial/ManagedCompanyResearchChecks";
import { ManagedResearchFollowup } from "../../src/clerk-trial/ManagedResearchFollowup";
import { ManagedFollowupAssessment } from "../../src/clerk-trial/ManagedFollowupAssessment";
import { ManagedResearchFollowups } from "../../src/clerk-trial/ManagedResearchFollowups";
import { ManagedFilingsAssessment } from "../../src/clerk-trial/ManagedFilingsAssessment";
import { managedCompanySourceActionsProps } from "../../src/clerk-trial/managed-company-source-actions-props";
import { managedResearchDraftProps } from "../../src/clerk-trial/managed-research-draft-props";
import type { ManagedCompanyNavigation } from "../../src/clerk-trial/useManagedCompanyNavigation";
const hooks = vi.hoisted(() => ({
  key: "",
  stores: new Map<
    string,
    { index: number; slots: unknown[]; effects: (() => void)[] }
  >(),
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  const { createValuationDraftTestHooks } =
    await import("../../src/clerk-trial/valuation-draft-files-test-hooks");
  const active = () =>
    createValuationDraftTestHooks(hooks.stores.get(hooks.key)!);
  return {
    ...actual,
    useState: (value: unknown) => active().useState(value),
    useRef: (value: unknown) => active().useRef(value),
    useLayoutEffect: (effect: () => void, deps?: React.DependencyList) =>
      active().useLayoutEffect(effect, deps),
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
      snapshot(),
  };
});
type Props = {
  id?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  value?: unknown;
  ref?: { current: unknown };
  onClick?: (event: { preventDefault: () => void }) => void;
  onChange?: (event: { currentTarget: { value: string } }) => void;
  onApply?: () => void;
};
function nodes(tree: React.ReactNode): React.ReactElement<Props>[] {
  return React.Children.toArray(tree).flatMap((node) => {
    if (!React.isValidElement<Props>(node)) return [];
    if (
      node.type === ManagedFollowupAssessment ||
      (typeof node.type === "function" && node.type.name === "Resource")
    )
      return nodes((node.type as (p: Props) => React.ReactNode)(node.props));
    return [node, ...nodes(node.props.children)];
  });
}
function control(tree: React.ReactNode, id: string) {
  const found = nodes(tree).find((node) => node.props.id === id);
  if (!found) throw new Error("Missing real UI control: " + id);
  return found.props;
}
function click(tree: React.ReactNode, id: string) {
  const value = control(tree, id);
  expect(value.disabled).not.toBe(true);
  value.onClick!({ preventDefault: vi.fn() });
}
function change(tree: React.ReactNode, id: string, value: string) {
  const field = control(tree, id);
  expect(field.disabled).not.toBe(true);
  expect(field.readOnly).not.toBe(true);
  field.onChange!({ currentTarget: { value } });
}
function render<P>(
  key: string,
  component: (props: P) => React.ReactNode,
  props: P,
  commit = true,
) {
  hooks.key = key;
  const store = hooks.stores.get(key) ?? { index: 0, slots: [], effects: [] };
  hooks.stores.set(key, store);
  store.index = 0;
  store.effects = [];
  const tree = component(props);
  if (commit) for (const effect of store.effects) effect();
  return tree;
}
const workspaces: ManagedWorkspace[] = [];
beforeEach(() => {
  hooks.stores.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
});
afterEach(() => {
  workspaces.splice(0).forEach((w) => w.sessionOwner.dispose());
  vi.useRealTimers();
});
async function setup() {
  const fixture = await createFixture("company-research-checks");
  function create(fresh = false) {
    const w = new ManagedWorkspace(
      fixture.api,
      fresh ? fixture.followups!.nextSession() : fixture.session,
      undefined,
      {
        researchCoverage: fixture.researchCoverage,
        marketsCohort: fixture.marketsCohort,
        priceCoverage: fixture.priceCoverage,
      },
    );
    workspaces.push(w);
    return w;
  }
  const w = create();
  await w.refreshCatalog();
  w.setNavigationBlocked(true);
  await w.setCompanyRoute({
    kind: "company",
    listingId: "listing-zero",
    section: "filings",
  });
  const selection = w.getSnapshot().research!.selection;
  let pending = false;
  const navigation: ManagedCompanyNavigation = {
    invalid: false,
    pending: false,
    isPending: () => pending,
    returnFocus: 0,
    open: vi.fn(),
    section: vi.fn(),
    back: vi.fn(),
    hasCompanyRoute: () => !!w.getSnapshot().companyRoute,
    view: (next) => {
      w.setNavigationBlocked(true);
      pending = true;
      w.setView(next);
      return true;
    },
  };
  const context = () =>
    render("context", ManagedCompanyResearchChecks, {
      workspace: w,
      selection,
      navigationPending: pending,
      routeActive: () => !pending,
    });
  async function loadResources() {
    for (const name of ["watchlist", "portfolio", "followups"]) {
      click(context(), "managed-company-context-load-" + name);
      await vi.waitFor(() =>
        expect(
          w.getCompanyResearchChecks(selection)![
            name as "watchlist" | "portfolio" | "followups"
          ].saved.phase,
        ).toBe("idle"),
      );
    }
  }
  const research = () => {
    const props = managedResearchDraftProps(w, selection, navigation, vi.fn());
    const node = props.researchFollowup as React.ReactElement<
      React.ComponentProps<typeof ManagedResearchFollowup>
    >;
    return render("research", ManagedResearchFollowup, node.props);
  };
  return {
    fixture,
    w,
    selection,
    context,
    loadResources,
    research,
    navigation,
    create,
    settle: async () => {
      pending = false;
      w.setNavigationBlocked(false);
      await w.setCompanyRoute(null);
    },
  };
}
it("uses complete real context, attachment, assessment, citation, exact review, Complete, Save and fresh Load controls", async () => {
  const f = await setup();
  const unloaded = load(renderToStaticMarkup(f.context()));
  expect(unloaded("#managed-company-context-watchlist").text()).toContain(
    "has not been loaded",
  );
  expect(f.fixture.companyResearchChecks!.getSnapshot().load).toBe(0);
  await f.loadResources();
  const ledger = f.fixture.companyResearchChecks!.data.portfolio;
  f.w.note("listing-zero", companyCheckNote);
  f.w.portfolio.coordinator.replaceDraft({
    ledger: { ...ledger, opening: { ...ledger.opening, cashUsd: "1500.00" } },
  });
  f.w.followups.edit(
    f.w.followups.coordinator.getSnapshot().draft!.entries[1]!,
    "result",
    companyCheckIndependentResult,
  );
  const editorContext = f.w.valuation.getSnapshot().context!;
  expect(
    f.w.valuation.restoreDraftInputs(
      {
        ...savedValuationInputs!,
        listing: editorContext.listing,
        cik: editorContext.cik,
        catalogSnapshotSha256: editorContext.catalogSnapshotSha256,
      },
      f.w.valuation.getSnapshot(),
    ),
  ).toBe(true);
  expect(f.w.valuation.calculate()).not.toBeNull();
  const before = {
    watchlist: f.w.coordinator.getSnapshot().draft,
    portfolio: f.w.portfolio.coordinator.getSnapshot().draft,
    editor: f.w.valuation.getSnapshot(),
  };
  const visit = f.w.getSnapshot().research!;
  await managedCompanySourceActionsProps(
    f.w,
    visit,
    f.navigation,
  ).onRequestSource("filings");
  const response = f.w.filings.getSnapshot().response!;
  expect(response).not.toBeNull();
  const html = load(renderToStaticMarkup(f.context()));
  expect(html("#managed-company-context-note").text()).toBe(companyCheckNote);
  expect(html("script")).toHaveLength(0);
  expect(html("#managed-company-context-holding dd").first().text()).toBe("2");
  expect(html("#managed-company-context-watchlist").text()).toContain(
    "Draft base: 7",
  );
  expect(html("#managed-company-context-portfolio").text()).toContain(
    "Draft base: 3",
  );
  expect(control(f.context(), "managed-company-check-choice").value).toBe("");
  expect(control(f.context(), "managed-company-check-attach").disabled).toBe(
    true,
  );
  const entry = f.w.followups.coordinator.getSnapshot().draft!.entries[0]!;
  change(f.context(), "managed-company-check-choice", entry.id);
  click(f.context(), "managed-company-check-attach");
  expect(f.w.getSnapshot().research!.selection).toBe(f.selection);
  expect(f.selection.origin).toBe("route");
  expect(f.w.filings.getSnapshot().response).toBe(response);
  expect(f.w.coordinator.getSnapshot().draft).toBe(before.watchlist);
  expect(f.w.portfolio.coordinator.getSnapshot().draft).toBe(before.portfolio);
  expect(f.w.valuation.getSnapshot()).toBe(before.editor);
  change(
    f.research(),
    "managed-research-followup-result",
    companyCheckAssessment,
  );
  const citation = () =>
    render("citation", ManagedFilingsAssessment, {
      response,
      actions: managedCompanySourceActionsProps(
        f.w,
        f.w.getSnapshot().research!,
        f.navigation,
      ).filingsAssessmentActions!,
    });
  void citation();
  click(citation(), "filings-assessment-toggle");
  change(
    citation(),
    "filings-assessment-filing",
    response.issuer.filings[0]!.accessionNumber,
  );
  click(citation(), "filings-assessment-preview");
  const preview = citation();
  const apply = nodes(preview).find((node) => node.props.onApply)!.props
    .onApply!;
  apply();
  apply();
  expect(f.w.followups.currentEntry(entry.id)!.result).toBe(companyCheckResult);
  expect(f.w.coordinator.getSnapshot().draft).toBe(before.watchlist);
  expect(f.w.portfolio.coordinator.getSnapshot().draft).toBe(before.portfolio);
  expect(f.w.valuation.getSnapshot()).toBe(before.editor);
  click(f.research(), "managed-research-followup-review");
  await f.settle();
  expect(f.w.getSnapshot().view).toBe("followups");
  expect(f.w.followups.getSnapshot().selectedId).toBe(entry.id);
  const followups = () =>
    render("followups", ManagedResearchFollowups, {
      workspace: f.w,
      navigationPending: false,
      onResearch: vi.fn(),
    });
  click(followups(), "managed-followup-complete");
  click(followups(), "managed-followups-save");
  await vi.waitFor(() =>
    expect(f.w.followups.coordinator.getSnapshot().phase).toBe("idle"),
  );
  expect(f.fixture.followups!.getSnapshot()).toMatchObject({
    commits: 1,
    version: 2,
  });
  f.w.sessionOwner.dispose();
  const fresh = f.create(true);
  await fresh.refreshCatalog();
  fresh.setView("followups");
  const freshUi = () =>
    render("fresh", ManagedResearchFollowups, {
      workspace: fresh,
      navigationPending: false,
      onResearch: vi.fn(),
    });
  click(freshUi(), "managed-followups-load");
  await vi.waitFor(() =>
    expect(fresh.followups.coordinator.getSnapshot().phase).toBe("idle"),
  );
  expect(fresh.followups.currentEntry(entry.id)).toMatchObject({
    result: companyCheckResult,
    status: "completed",
    completedOn: "2026-10-30",
  });
  expect(f.fixture.companyResearchChecks!.getSnapshot()).toMatchObject({
    filings: 1,
    rejected: 0,
    save: 0,
    portfolioSave: 0,
    eod: 0,
    annual: 0,
    interim: 0,
    valuationLoad: 0,
    valuationSave: 0,
  });
});
it("requires a new explicit choice after external draft replacement and refuses captured attachment callbacks", async () => {
  const f = await setup();
  await f.loadResources();
  const entry = f.w.followups.coordinator.getSnapshot().draft!.entries[0]!;
  change(f.context(), "managed-company-check-choice", entry.id);
  const escaped = control(f.context(), "managed-company-check-attach").onClick!;
  f.w.followups.edit(entry, "check", entry.check + " changed");
  escaped({ preventDefault: vi.fn() });
  expect(f.w.researchFollowupContext(f.selection)).toBeNull();
  expect(control(f.context(), "managed-company-check-choice").value).toBe("");
  expect(control(f.context(), "managed-company-check-attach").disabled).toBe(
    true,
  );
});
it("moves focus once only after its committed attachment and never for independent loads or a retired action", async () => {
  const f = await setup();
  await f.loadResources();
  const entry = f.w.followups.coordinator.getSnapshot().draft!.entries[0]!;
  change(f.context(), "managed-company-check-choice", entry.id);
  click(f.context(), "managed-company-check-attach");
  const focus = vi.fn(),
    scrollIntoView = vi.fn(),
    doc = { activeElement: null as unknown };
  const target = {
    isConnected: true,
    closest: () => null,
    getClientRects: () => [1],
    ownerDocument: doc,
    focus: () => {
      focus();
      doc.activeElement = target;
    },
    scrollIntoView,
  };
  // Assign the mounted target before this render's layout effects commit.
  hooks.key = "context";
  const store = hooks.stores.get("context")!;
  store.index = 0;
  store.effects = [];
  const props = {
    workspace: f.w,
    selection: f.selection,
    navigationPending: false,
    routeActive: () => true,
  };
  const tree = ManagedCompanyResearchChecks(props);
  control(tree, "managed-company-check-attached-heading").ref!.current = target;
  store.effects.forEach((effect) => effect());
  expect(focus).toHaveBeenCalledOnce();
  expect(scrollIntoView).toHaveBeenCalledOnce();
  void f.context();
  void f.context();
  expect(focus).toHaveBeenCalledOnce();
  f.w.closeResearch();
  void f.context();
  expect(focus).toHaveBeenCalledOnce();
});

it("refuses abandoned render and choice-ABA callbacks before any attachment or focus", async () => {
  const f = await setup();
  await f.loadResources();
  const entry = f.w.followups.coordinator.getSnapshot().draft!.entries[0]!;
  change(f.context(), "managed-company-check-choice", entry.id);
  const escaped = control(f.context(), "managed-company-check-attach").onClick!;
  change(f.context(), "managed-company-check-choice", "");
  change(f.context(), "managed-company-check-choice", entry.id);
  escaped({ preventDefault: vi.fn() });
  expect(f.w.researchFollowupContext(f.selection)).toBeNull();
  const abandoned = render(
    "context",
    ManagedCompanyResearchChecks,
    {
      workspace: f.w,
      selection: f.selection,
      navigationPending: false,
      routeActive: () => true,
    },
    false,
  );
  control(abandoned, "managed-company-check-attach").onClick!({
    preventDefault: vi.fn(),
  });
  expect(f.w.researchFollowupContext(f.selection)).toBeNull();
  click(f.context(), "managed-company-check-attach");
  expect(f.w.researchFollowupContext(f.selection)?.entry.id).toBe(entry.id);
});

it("starts with an empty choice when the same listing opens in a new visit", async () => {
  const f = await setup();
  await f.loadResources();
  const entry = f.w.followups.coordinator.getSnapshot().draft!.entries[0]!;
  change(f.context(), "managed-company-check-choice", entry.id);
  f.w.closeResearch();
  await f.w.setCompanyRoute({
    kind: "company",
    listingId: "listing-zero",
    section: "filings",
  });
  const selection = f.w.getSnapshot().research!.selection;
  expect(selection).not.toBe(f.selection);
  const props = {
    workspace: f.w,
    selection,
    navigationPending: false,
    routeActive: () => true,
  };
  const reopened = () => render("context", ManagedCompanyResearchChecks, props);
  expect(control(reopened(), "managed-company-check-choice").value).toBe("");
  expect(control(reopened(), "managed-company-check-attach").disabled).toBe(
    true,
  );
  change(reopened(), "managed-company-check-choice", entry.id);
  click(reopened(), "managed-company-check-attach");
  expect(f.w.researchFollowupContext(selection)?.entry.id).toBe(entry.id);
});
