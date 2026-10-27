import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry } from "@research-cockpit/contracts";
import { createFixture } from "./fixture";
import {
  annualStatementsPacket,
  createAnnualStatementsNativeFixture,
  type AnnualStatementsNativeFixture,
} from "./annual-statements-fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import {
  ManagedAnnualStatements,
  type ManagedAnnualStatementsProps,
} from "../../src/clerk-trial/ManagedAnnualStatements";
import {
  ManagedAnnualStatementsReview,
  type ManagedAnnualStatementsReviewActions,
  type ManagedAnnualStatementsReviewProps,
} from "../../src/clerk-trial/ManagedAnnualStatementsReview";
import { AnnualStatementsReportView } from "../../src/clerk-trial/AnnualStatementsReportView";
import { ManagedUnsavedWatchlistReview } from "../../src/clerk-trial/ManagedUnsavedWatchlistReview";
import { prepareCompanyReport } from "../../src/clerk-trial/managed-company-report";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import { formatCompanyReportDocument } from "../../src/clerk-trial/managed-company-report-document";
import { CompanyReportHtmlView } from "../../src/clerk-trial/CompanyReportHtmlView";
import { getManagedAnnualView } from "../../src/clerk-trial/managed-annual-view";

// The repository's direct-hook convention exercises captured handlers without a DOM library.
const hooks = vi.hoisted(() => ({
  direct: false,
  index: 0,
  slots: [] as unknown[],
  layouts: [] as Array<() => void>,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => (hooks.direct ? "native-statements-test" : actual.useId()),
    useRef: <T,>(initial: T) => {
      if (!hooks.direct) return actual.useRef(initial);
      const i = hooks.index++;
      if (!(i in hooks.slots)) hooks.slots[i] = { current: initial };
      return hooks.slots[i];
    },
    useMemo: <T,>(factory: () => T, deps: React.DependencyList) => {
      if (!hooks.direct) return actual.useMemo(factory, deps);
      const i = hooks.index++;
      const old = hooks.slots[i] as
        { deps: React.DependencyList; value: T } | undefined;
      if (!old || deps.some((value, at) => !Object.is(value, old.deps[at])))
        hooks.slots[i] = { deps, value: factory() };
      return (hooks.slots[i] as { value: T }).value;
    },
    useState: (initial: unknown) => {
      if (!hooks.direct) return actual.useState(initial);
      const i = hooks.index++;
      if (!(i in hooks.slots))
        hooks.slots[i] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        hooks.slots[i],
        (value: unknown) => {
          hooks.slots[i] = value;
        },
      ];
    },
    useLayoutEffect: (
      effect: () => void | (() => void),
      deps: React.DependencyList,
    ) => {
      if (!hooks.direct) return actual.useLayoutEffect(effect, deps);
      const i = hooks.index++;
      const old = hooks.slots[i] as
        | { kind: "layout"; deps: React.DependencyList; cleanup?: () => void }
        | undefined;
      if (!old || deps.some((value, at) => !Object.is(value, old.deps[at])))
        hooks.layouts.push(() => {
          old?.cleanup?.();
          hooks.slots[i] = { kind: "layout", deps, cleanup: effect() };
        });
    },
  };
});
function unmount() {
  for (const slot of hooks.slots)
    if (
      slot &&
      typeof slot === "object" &&
      "kind" in slot &&
      slot.kind === "layout" &&
      "cleanup" in slot &&
      typeof slot.cleanup === "function"
    )
      (slot.cleanup as () => void)();
}
const owners: ManagedWorkspace[] = [];
beforeEach(() => {
  hooks.direct = false;
  hooks.index = 0;
  hooks.slots = [];
  hooks.layouts = [];
});
afterEach(() => {
  unmount();
  for (const owner of owners.splice(0)) owner.sessionOwner.dispose();
});
function elements(
  node: React.ReactNode,
): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function control(node: React.ReactNode, label: string) {
  const result = elements(node).find(
    (element) => element.type === "button" && element.props.children === label,
  );
  if (!result) throw new Error(`Missing control: ${label}`);
  return result;
}
const click = (element: React.ReactElement<Record<string, unknown>>) =>
  (element.props.onClick as () => void)();
function reader(node: React.ReactNode) {
  return elements(node).find(
    (element) => element.type === ManagedAnnualStatements,
  )!.props as unknown as ManagedAnnualStatementsProps;
}
function reviewHarness(props: ManagedAnnualStatementsReviewProps) {
  return () => {
    hooks.direct = true;
    hooks.index = 0;
    const node = ManagedAnnualStatementsReview(props);
    for (const layout of hooks.layouts.splice(0)) layout();
    hooks.direct = false;
    return node;
  };
}
async function fixture(loadAnnual = true) {
  const base = await createFixture("annual-note");
  const f = await createAnnualStatementsNativeFixture(base);
  const workspace = new ManagedWorkspace(f.api, f.session, undefined, {
    researchCoverage: f.researchCoverage,
    marketsCohort: f.marketsCohort,
    priceCoverage: f.priceCoverage,
  });
  owners.push(workspace);
  await Promise.all([workspace.coordinator.load(), workspace.refreshCatalog()]);
  const original = workspace.coordinator.getSnapshot().draft!;
  workspace.setView("watchlist");
  workspace.move("listing-zero", 1);
  workspace.note("listing-zero", f.annualStatements.prefix);
  const before = workspace.coordinator.getSnapshot().draft!;
  expect(f.getSnapshot().resolve).toBe(0);
  workspace.openWatchlistAnnual(before.memberships[1]!);
  expect(workspace.getSnapshot().research?.selection).toMatchObject({
    origin: "watchlist",
    cik: null,
    listing: { listingId: "listing-zero" },
  });
  workspace.setNavigationBlocked(true);
  await workspace.setCompanyRoute({
    kind: "company",
    listingId: "listing-zero",
    section: "annual",
  });
  expect(f.getSnapshot().resolve).toBe(0);
  const selection = workspace.getSnapshot().research!.selection;
  if (loadAnnual) await workspace.annual.load();
  const note = () =>
    workspace.coordinator.getSnapshot().draft!.memberships[1]!.note;
  return { f, workspace, selection, original, before, note };
}
function noOtherOperations(f: AnnualStatementsNativeFixture) {
  expect(f.getSnapshot()).toMatchObject({
    eod: 0,
    filings: 0,
    resolve: 0,
    search: 0,
    marketsEod: 0,
    calendar: 0,
    fed: 0,
    token: 0,
    signOut: 0,
    aborted: 0,
    lateResolved: 0,
    refreshFailed: 0,
  });
}

describe("invented complete standardized annual statement journey", () => {
  it("constructs without API reads, admits32 scans and95 observations across three exact dates, and pins a complete bounded note", async () => {
    const base = await createFixture("annual-note");
    const load = vi.spyOn(base.api, "load");
    const annual = vi.spyOn(base.api, "annualReport");
    const status = vi.spyOn(base.api, "status");
    const f = await createAnnualStatementsNativeFixture(base);
    expect(load).not.toHaveBeenCalled();
    expect(annual).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
    expect(f.getSnapshot()).toBe(f.getSnapshot());
    expect(f.getSnapshot()).toMatchObject({
      load: 0,
      annual: 0,
      status: 0,
      save: 0,
    });
    const packet = await annualStatementsPacket();
    const view = getManagedAnnualView(packet)!;
    expect(packet.schemaVersion).toBe("6.0.0");
    expect(packet.security).toMatchObject({
      listingId: "listing-zero",
      symbol: "ZERO",
      cik: "0000000001",
    });
    expect(packet.evidence.facts.scans.map((item) => item.concept)).toEqual(
      registry.map((item) => item.concept),
    );
    expect(packet.evidence.facts.observations).toHaveLength(95);
    expect(Object.isFrozen(packet.evidence.facts.observations)).toBe(true);
    expect(view.canonical).toBe(packet.evidence);
    for (const statement of view.statements.statements)
      expect(statement.columns.map((column) => column.endDate)).toEqual(
        f.annualStatements.pins.dates,
      );
    expect(view.statements.statements.map((statement) => statement.id)).toEqual(
      ["income_statement", "balance_sheet", "cash_flow"],
    );
    expect(
      view.statements.statements.flatMap((statement) => statement.rows),
    ).toHaveLength(32);
    const cell = (concept: string, endDate: string) =>
      view.statements.statements
        .flatMap((statement) => statement.rows)
        .find((row) => row.concept === concept)!
        .cells.find((cell) => cell.endDate === endDate)!;
    expect(cell("NetIncomeLoss", "2025-12-31")).toMatchObject({
      status: "available",
      value: f.annualStatements.pins.parentNetIncome,
      startDate: "2025-01-01",
      currentUseEligible: true,
    });
    expect(cell("Assets", "2024-12-31")).toMatchObject({
      status: "available",
      value: "900.5",
      startDate: null,
      currentUseEligible: false,
    });
    expect(
      cell("NetCashProvidedByUsedInOperatingActivities", "2024-12-31"),
    ).toMatchObject({
      status: "available",
      value: "-80.0625",
      startDate: "2024-01-01",
      currentUseEligible: false,
    });
    expect(cell("IncomeTaxExpenseBenefit", "2024-12-31")).toMatchObject({
      status: "unavailable",
      reason: "no_report_period",
    });
    expect(cell("IncomeTaxExpenseBenefit", "2025-12-31").status).toBe(
      "available",
    );
    expect([...f.annualStatements.expectedNote].length).toBeLessThanOrEqual(
      2000,
    );
    expect(f.annualStatements.expectedNote).toContain(
      f.annualStatements.pins.parentNetIncome,
    );
    expect(f.annualStatements.expectedNote).toContain(
      "historical; current use ineligible",
    );
    expect(
      f.annualStatements.expectedNote.match(/sec-fact:[a-f0-9]{64}/gu),
    ).toHaveLength(2);
    noOtherOperations(f);
  });

  it("uses real Review handlers to fence edit/restore callbacks, preview the whole note, append once, capture all three statements and explicitly Save/fresh-load the exact Back draft", async () => {
    const { f, workspace, selection, original, before, note } =
      await fixture(false);
    expect(f.getSnapshot().annual).toBe(0);
    await workspace.annual.load();
    const source = workspace.annual.getSnapshot();
    const response = source.response!;
    expect(source.view?.canonical).toBe(response.evidence);
    const actions: ManagedAnnualStatementsReviewActions = {
      prepare: vi.fn<ManagedAnnualStatementsReviewActions["prepare"]>(
        (packet, cells, guard) =>
          workspace.prepareAnnualStatementsNote(
            selection,
            packet,
            cells,
            guard,
          ),
      ),
      isCurrent: (preview) =>
        workspace.annualStatementsPreviewIsCurrent(preview),
      append: vi.fn<ManagedAnnualStatementsReviewActions["append"]>((preview) =>
        workspace.appendAnnualStatementsNote(preview),
      ),
    };
    const props = { response, actions, blockedReason: null };
    const initialMarkup = renderToStaticMarkup(
      <ManagedAnnualStatementsReview {...props} />,
    );
    expect(initialMarkup).toContain("Standardized annual statements");
    expect(initialMarkup).toContain(
      'aria-label="Income statement reported USD table"',
    );
    expect(initialMarkup).toContain("Preview statement note");
    expect(initialMarkup).not.toContain("Complete note preview");
    const render = reviewHarness(props);
    for (const cell of f.annualStatements.selectedCells)
      reader(render()).onToggleCell(cell.concept, cell.endDate);
    click(control(render(), "Preview statement note"));
    const first = render();
    expect(renderToStaticMarkup(first)).toContain(
      f.annualStatements.expectedNote,
    );
    expect(note()).toBe(f.annualStatements.prefix);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    const staleAppend = control(first, "Add statement cells to note draft");
    const stalePrepare = control(first, "Preview statement note");
    const comparative = f.annualStatements.selectedCells[1]!;
    reader(render()).onToggleCell(comparative.concept, comparative.endDate);
    reader(render()).onToggleCell(comparative.concept, comparative.endDate);
    click(staleAppend);
    click(stalePrepare);
    expect(actions.append).not.toHaveBeenCalled();
    expect(actions.prepare).toHaveBeenCalledTimes(1);
    expect(note()).toBe(f.annualStatements.prefix);
    click(control(render(), "Preview statement note"));
    const append = control(render(), "Add statement cells to note draft");
    click(append);
    click(append);
    expect(actions.append).toHaveBeenCalledTimes(1);
    expect(note()).toBe(f.annualStatements.expectedNote);
    expect(workspace.coordinator.getSnapshot().draft!.memberships).toEqual([
      original.memberships[1],
      { ...original.memberships[0]!, note: f.annualStatements.expectedNote },
    ]);
    expect(f.getSnapshot()).toMatchObject({
      annual: 1,
      save: 0,
      load: 1,
      status: 1,
    });

    const report = prepareCompanyReport(
      selection,
      companySnapshotEvidence(
        selection,
        workspace.eod.getSnapshot(),
        source,
        workspace.filings.getSnapshot(),
        workspace.interim.getSnapshot(),
      ),
      workspace.getResearchWatchlist(selection),
      () => new Date("2026-10-16T00:00:00.000Z"),
    )!;
    const document = formatCompanyReportDocument(report)!;
    const parsed: unknown = JSON.parse(document.text);
    expect(parsed).toMatchObject({
      schemaVersion: "6.0.0",
      authoredResearch: { note: f.annualStatements.expectedNote },
      sources: { annual: { response, statements: source.view!.statements } },
    });
    expect(document.text.match(/"observations":/gu)).toHaveLength(1);
    expect(response.evidence.facts.observations).toHaveLength(95);
    const ids = new Set(
      response.evidence.facts.observations.map((row) => row.id),
    );
    for (const statement of source.view!.statements.statements)
      for (const row of statement.rows)
        for (const cell of row.cells)
          for (const id of cell.observationIds) expect(ids.has(id)).toBe(true);
    const staticStatements = renderToStaticMarkup(
      <AnnualStatementsReportView
        evidence={response.evidence}
        statements={source.view!.statements}
      />,
    );
    expect(staticStatements.match(/<table/gu)).toHaveLength(3);
    expect(staticStatements).not.toContain('type="checkbox"');
    expect(staticStatements).not.toContain("<select");
    for (const entry of registry)
      expect(staticStatements).toContain(`us-gaap:${entry.concept}`);
    for (const row of response.evidence.facts.observations)
      expect(staticStatements).toContain(row.id);
    expect(
      staticStatements.includes(
        "No admitted fact matches this date and period.",
      ),
    ).toBe(true);
    const html = renderToStaticMarkup(
      <CompanyReportHtmlView report={report} jsonText={document.text} />,
    );
    expect(html).toContain("Captured standardized annual statements");
    expect(html).toContain(f.annualStatements.pins.parentNetIncome);
    const review = renderToStaticMarkup(
      <ManagedUnsavedWatchlistReview
        state={workspace.coordinator.getSnapshot()}
      />,
    );
    expect(review).toContain("Review unsaved changes");
    expect(review).toContain(f.annualStatements.expectedNote);
    const backDraft = workspace.coordinator.getSnapshot().draft;
    workspace.closeResearch();
    workspace.setNavigationBlocked(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(backDraft);
    expect(f.getSnapshot().save).toBe(0);
    expect(workspace.canSavePayload()).toBe(true);
    await workspace.coordinator.save();
    expect(workspace.coordinator.getSnapshot().dirty).toBe(false);
    const fresh = new ManagedWorkspace(
      f.api,
      {
        ...f.session,
        sessionId: "invented-statements-fresh-session",
      },
      undefined,
      { researchCoverage: f.researchCoverage },
    );
    owners.push(fresh);
    await fresh.coordinator.load();
    expect(fresh.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 2,
      dirty: false,
      draft: {
        memberships: [
          original.memberships[1],
          {
            ...original.memberships[0]!,
            note: f.annualStatements.expectedNote,
          },
        ],
      },
    });
    expect(f.getSnapshot()).toMatchObject({
      annual: 1,
      save: 1,
      load: 2,
      status: 1,
    });
    expect(f.getSnapshot().marketsResolve).toBe(1);
    expect(formatCompanyReportDocument(report)?.text).toBe(document.text);
    noOtherOperations(f);
  });

  it("refuses unavailable/empty choices and the whole overlong proposal without writes, then fences a captured append on actual session retirement", async () => {
    const { f, workspace, selection, note } = await fixture();
    const response = workspace.annual.getSnapshot().response!;
    const prepare = (cells = f.annualStatements.selectedCells) =>
      workspace.prepareAnnualStatementsNote(
        selection,
        response,
        cells,
        () => true,
      );
    expect(prepare([]).preview).toBeNull();
    expect(
      prepare([{ concept: "IncomeTaxExpenseBenefit", endDate: "2024-12-31" }])
        .preview,
    ).toBeNull();
    workspace.note("listing-zero", "x".repeat(1900));
    expect(prepare().reason).toContain("2,000-character");
    expect(note()).toBe("x".repeat(1900));
    workspace.note("listing-zero", f.annualStatements.prefix);
    const preview = prepare().preview!;
    expect(preview).not.toBeNull();
    const oldAppend = () => workspace.appendAnnualStatementsNote(preview);
    await workspace.refreshCatalog();
    expect(workspace.coordinator.getSnapshot().phase).toBe("retired");
    expect(workspace.annual.getSnapshot()).toMatchObject({
      response: null,
      view: null,
    });
    expect(workspace.annualStatementsPreviewIsCurrent(preview)).toBe(false);
    expect(oldAppend().appended).toBe(false);
    expect(f.getSnapshot()).toMatchObject({ annual: 1, status: 2, save: 0 });
    noOtherOperations(f);
  });

  it("rejects wrong versions, premature or extra reads and incomplete/reordered-other Save payloads", async () => {
    const base = await createFixture("annual-note");
    const f = await createAnnualStatementsNativeFixture(base);
    const signal = new AbortController().signal;
    const packet = await annualStatementsPacket();
    const request = {
      schemaVersion: "6.0.0" as const,
      catalogSnapshotSha256: packet.catalogSnapshotSha256,
      listingId: "listing-zero",
      symbol: "ZERO",
    };
    expect(() => f.api.annualReport(request, signal)).toThrow(
      "Annual request or order",
    );
    const loaded = await f.api.load(signal);
    await f.api.status(signal);
    expect(() =>
      f.api.annualReport(
        { ...request, schemaVersion: "5.0.0" } as never,
        signal,
      ),
    ).toThrow("Annual request or order");
    const aborted = new AbortController();
    aborted.abort();
    expect(() => f.api.annualReport(request, aborted.signal)).toThrow(
      "Annual request or order",
    );
    await f.api.annualReport(request, signal);
    expect(() => f.api.annualReport(request, signal)).toThrow(
      "Annual request or order",
    );
    await expect(f.api.load(signal)).rejects.toThrow("watchlist read");
    for (const memberships of [
      loaded.payload.memberships,
      [
        loaded.payload.memberships[1]!,
        {
          ...loaded.payload.memberships[0]!,
          note: f.annualStatements.expectedNote.slice(0, -1),
        },
      ],
      [
        { ...loaded.payload.memberships[1]!, note: "Changed unrelated member" },
        {
          ...loaded.payload.memberships[0]!,
          note: f.annualStatements.expectedNote,
        },
      ],
    ])
      await expect(
        f.api.save(
          {
            expectedVersion: 1,
            idempotencyKey: "00000000-0000-4000-8000-000000000001",
            payload: { ...loaded.payload, memberships },
          },
          signal,
        ),
      ).rejects.toThrow("operation: save");
    expect(f.getSnapshot()).toMatchObject({ annual: 1, save: 0, load: 1 });
    expect(() => f.settleCancelledRead()).toThrow("no held Annual read");
    noOtherOperations(f);
  });
});
