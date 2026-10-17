import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedEodIdentity } from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { eodSelection } from "./eod-history-fixture";
import { ManagedFinancialScreen } from "./ManagedFinancialScreen";
import {
  ManagedFinancialScreen as ScreenModel,
  type ManagedFinancialScreenReportCapture,
} from "./managed-financial-screen";
import {
  reportFinancialReviewPacket,
  type ReportAnnualFixtureOptions,
} from "./managed-annual-statements-report-fixture";
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";

// Direct callbacks exercise real model guards; this is not a DOM/concurrency harness.
const hooks = vi.hoisted(() => ({
  direct: false,
  index: 0,
  slots: [] as unknown[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => (hooks.direct ? "financial-screen-test" : actual.useId()),
    useSyncExternalStore: <Snapshot,>(
      subscribe: (listener: () => void) => () => void,
      read: () => Snapshot,
      serverRead?: () => Snapshot,
    ) =>
      hooks.direct
        ? read()
        : actual.useSyncExternalStore(subscribe, read, serverRead),
    useState: (initial: unknown) => {
      if (!hooks.direct) return actual.useState(initial);
      const index = hooks.index++;
      if (!(index in hooks.slots))
        hooks.slots[index] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        hooks.slots[index],
        (value: unknown) => {
          hooks.slots[index] = value;
        },
      ];
    },
  };
});

const models = new Set<ScreenModel>();
beforeEach(() => {
  hooks.direct = false;
  hooks.index = 0;
  hooks.slots = [];
  vi.useFakeTimers({
    toFake: ["Date", "performance", "setTimeout", "clearTimeout"],
  });
  vi.setSystemTime(new Date("2026-09-20T00:00:00.000Z"));
});
afterEach(() => {
  for (const model of models) model.retire();
  models.clear();
  hooks.direct = false;
  vi.useRealTimers();
});

const first = eodSelection.listing;
const second: ManagedEodIdentity = {
  ...first,
  listingId: "listing-one",
  issuerId: "issuer-one",
  issuerName: "One Company",
  securityId: "security-one",
  securityName: "One Class A",
  shareClassId: "class-one",
  symbol: "ONE",
};
const third: ManagedEodIdentity = {
  ...second,
  listingId: "listing-two",
  issuerId: "issuer-two",
  issuerName: "Two Company",
  securityId: "security-two",
  shareClassId: "class-two",
  symbol: "TWO",
};

async function fixture(
  options: ReportAnnualFixtureOptions = {},
  listings: readonly ManagedEodIdentity[] = [first],
) {
  const source = await reportFinancialReviewPacket(options);
  const right = await annualComparisonResponse("right");
  const annualReport = vi
    .fn<ManagedApi["annualReport"]>()
    .mockImplementation((request) => {
      if (request.listingId === first.listingId) return Promise.resolve(source);
      if (request.listingId === second.listingId) return Promise.resolve(right);
      throw new Error("An unperformed company must not request a source");
    });
  const resolve = vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
    Promise.resolve({
      snapshotSha256: request.snapshotSha256,
      results: request.listingIds.map((listingId) => ({
        listingId,
        listing:
          listings.find((listing) => listing.listingId === listingId) ?? null,
      })),
    }),
  );
  const model = new ScreenModel(
    { annualReport, resolve },
    vi.fn(),
    undefined,
    listings.map((listing) => listing.listingId),
  );
  models.add(model);
  model.reconcile(eodSelection.catalogSnapshotSha256, true, true);
  const opened: ManagedFinancialScreenReportCapture[] = [];
  const onOpenReport = vi.fn((capture: ManagedFinancialScreenReportCapture) => {
    if (model.admitReport(capture)) opened.push(capture);
  });
  const props = { model, onOpenReport };
  const render = () => {
    hooks.direct = true;
    hooks.index = 0;
    try {
      return ManagedFinancialScreen(props);
    } finally {
      hooks.direct = false;
    }
  };
  const html = () =>
    renderToStaticMarkup(<ManagedFinancialScreen {...props} />);
  const load = async () => {
    click(findButton(render(), "Load screening cohort"));
    await vi.advanceTimersByTimeAsync(0);
  };
  const run = async () => {
    click(runButton(render()));
    await vi.advanceTimersByTimeAsync(0);
  };
  return {
    model,
    source,
    annualReport,
    resolve,
    onOpenReport,
    opened,
    render,
    html,
    load,
    run,
  };
}

type Element = React.ReactElement<Record<string, unknown>>;
function elements(node: React.ReactNode): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement<Record<string, unknown>>(node)
    ? text(node.props.children as React.ReactNode)
    : "";
}
function findButton(node: React.ReactNode, label: string) {
  const found = elements(node).find(
    (element) =>
      element.type === "button" &&
      text(element.props.children as React.ReactNode) === label,
  );
  if (!found) throw new Error(`Expected button ${label}`);
  return found;
}
function runButton(node: React.ReactNode) {
  const found = elements(node).find(
    (element) =>
      element.type === "button" &&
      text(element.props.children as React.ReactNode).startsWith(
        "Run screen (",
      ),
  );
  if (!found) throw new Error("Expected explicit Run control");
  return found;
}
function click(node: Element) {
  (node.props.onClick as (event: { currentTarget: unknown }) => void)({
    currentTarget: { fixture: "no DOM" },
  });
}
function threshold(node: React.ReactNode) {
  const found = elements(node).find(
    (element) => element.type === "input" && element.props.type === "text",
  );
  if (!found) throw new Error("Expected raw decimal input");
  return found;
}
function changeThreshold(node: React.ReactNode, value: string) {
  (
    threshold(node).props.onChange as (event: {
      target: { value: string };
    }) => void
  )({ target: { value } });
}
function submit(node: React.ReactNode) {
  const form = elements(node).find((element) => element.type === "form");
  if (!form) throw new Error("Expected criteria form");
  const preventDefault = vi.fn();
  (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({
    preventDefault,
  });
  expect(preventDefault).toHaveBeenCalledOnce();
}
function resultRows(markup: string) {
  const body = /<tbody>([\s\S]*?)<\/tbody>/u.exec(markup)?.[1];
  if (!body) throw new Error("Expected financial result rows");
  return [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/gu)].map((match) => match[1]!);
}
function resultCells(row: string) {
  return [...row.matchAll(/<td>([\s\S]*?)<\/td>/gu)].map((match) => match[1]!);
}

describe("managed financial screening surface", () => {
  it("makes no automatic reads on entry, render, criteria editing or explicit cohort resolution", async () => {
    const f = await fixture();
    expect(f.html()).toContain("Annual financial screen");
    expect(f.html()).toContain("not a whole-market universe");
    f.render();
    expect(f.resolve).not.toHaveBeenCalled();
    expect(f.annualReport).not.toHaveBeenCalled();
    click(findButton(f.render(), "Add criterion"));
    changeThreshold(f.render(), "250.125");
    submit(f.render());
    await f.load();
    expect(f.resolve).toHaveBeenCalledOnce();
    expect(f.annualReport).not.toHaveBeenCalled();
    expect(f.model.getSnapshot().run).toBeNull();
    expect(runButton(f.render()).props.disabled).toBe(false);
  });

  it("shows six independent exact values and actual periods, with research and inspection in the company column", async () => {
    const exact = "9007199254740993.000000000000000001";
    const f = await fixture({ operatingIncome: exact });
    await f.load();
    await f.run();
    const markup = f.html();
    const row = resultRows(markup)[0]!;
    const company = /<th scope="row">([\s\S]*?)<\/th>/u.exec(row)?.[1];
    expect(company).toContain("ZERO");
    expect(company).toContain("Shortlist ZERO");
    expect(company).toContain("Research ZERO");
    expect(company).toContain("Inspect ZERO evidence");
    const cells = resultCells(row);
    expect(cells).toHaveLength(7);
    expect(cells[0]).toBe("match");
    for (const [index, value] of [
      exact,
      "120.125",
      "-80.125",
      "0",
      "-7.5",
      "1.00",
    ].entries())
      expect(cells[index + 1]).toContain(`<span>${value}<small>`);
    for (const cell of cells.slice(1, 4))
      expect(cell).toContain("2025-01-01 to 2025-12-31");
    for (const cell of cells.slice(4))
      expect(cell).toContain("As of 2025-12-31");
    for (const cell of cells)
      expect(cell).not.toMatch(/<(?:input|button|details|summary)(?:\s|>)/u);
    const captured = f.model.getSnapshot().run!.rows[0]!;
    expect(
      captured.report!.view!.income.resolution.selectedReportPairEligible,
    ).toBe(false);
    expect(company).toContain(f.source.evidence.generation.cutoffAt);
    expect(company).toContain(f.source.evidence.generation.completedAt);
    expect(company).toContain(f.source.evidence.generation.sha256);
    expect(company).toContain("Reported operating income source");
    expect(company).toContain("Working capital source");
    expect(company).toContain("Current assets / current liabilities source");
    const references = new Set(
      Object.values(captured.evaluation!.metrics).flatMap(
        (metric) => metric.observationIds,
      ),
    );
    for (const id of references) {
      const observation = f.source.evidence.facts.observations.find(
        (item) => item.id === id,
      )!;
      expect(company).toContain(id);
      expect(company).toContain(observation.sourceLocator);
      expect(company).toContain(`USD ${observation.value}`);
      expect(company).toContain(observation.accessionNumber);
      expect(company).toContain(observation.filing.sourceUrl!);
    }
    f.html();
    expect(f.annualReport).toHaveBeenCalledOnce();
  });

  it("keeps missing and invalid-denominator fields distinct from signed and zero sibling values", async () => {
    const f = await fixture({
      operatingIncome: null,
      operatingCashFlow: "0",
      ppePurchases: null,
      currentAssets: "100",
      currentLiabilities: "0",
    });
    await f.load();
    await f.run();
    const cells = resultCells(resultRows(f.html())[0]!);
    expect(cells[1]).toContain("Unknown: concept missing");
    expect(cells[2]).toContain("<span>0<small>2025-01-01 to 2025-12-31");
    expect(cells[3]).toContain("Unknown: concept missing");
    expect(cells[4]).toContain("<span>100<small>As of 2025-12-31");
    expect(cells[5]).toContain("<span>-7.5<small>As of 2025-12-31");
    expect(cells[6]).toContain("Unknown: nonpositive current liabilities");
    expect(f.annualReport).toHaveBeenCalledOnce();
  });

  it("labels historical values with their original dates and current-filter exclusion", async () => {
    const f = await fixture({ cutoffAt: "2027-10-17T00:00:00.000Z" });
    await f.load();
    f.model.setCriteria(f.model.getSnapshot(), {
      clauses: [{ field: "operatingCashFlow", operator: "gte", value: "0" }],
      sort: { field: "symbol", direction: "asc" },
    });
    await f.run();
    const cells = resultCells(resultRows(f.html())[0]!);
    expect(cells[0]).toBe("unknown");
    expect(cells[2]).toContain("120.125");
    expect(cells[2]).toContain("2025-01-01 to 2025-12-31");
    expect(cells[2]).toContain(
      "Historical evidence; excluded from current filters.",
    );
  });

  it("does not count queued or unperformed companies as failures or financial unknowns", async () => {
    const f = await fixture({}, [first, second, third]);
    await f.load();
    await f.run();
    expect(f.model.getSnapshot().pending?.kind).toBe("waiting");
    const rows = resultRows(f.html());
    expect(
      resultCells(
        rows.find((row) => row.includes("Inspect ZERO evidence"))!,
      )[0],
    ).toBe("match");
    expect(
      resultCells(rows.find((row) => row.includes("Research ONE"))!)[0],
    ).toBe("Waiting or loading");
    expect(
      resultCells(rows.find((row) => row.includes("Research TWO"))!)[0],
    ).toBe("Not loaded");
    expect(f.html()).toContain(
      "1 matches, 0 nonmatches, 0 unknown, 0 failed or incomplete reads, 2 not loaded",
    );
    const pending = f.render();
    expect(findButton(pending, "Research ZERO").props.disabled).toBe(true);
    click(findButton(pending, "Cancel screen"));
    await vi.advanceTimersByTimeAsync(100_000);
    expect(f.model.getSnapshot().run!.status).toBe("cancelled");
    expect(f.annualReport).toHaveBeenCalledOnce();
    const untouched = f.model.getSnapshot().run!.rows.slice(1);
    expect(
      untouched.every(
        (row) =>
          row.report === null &&
          row.evaluation === null &&
          row.failure === null,
      ),
    ).toBe(true);
    expect(f.html()).toContain(
      "0 unknown, 0 failed or incomplete reads, 2 not loaded",
    );
  });

  it("keeps completed criteria captured while raw invalid edits block Run until valid Apply", async () => {
    const f = await fixture();
    await f.load();
    click(findButton(f.render(), "Add criterion"));
    submit(f.render());
    await f.run();
    const captured = f.model.getSnapshot().run!;
    const originalCriteria = captured.criteria;
    const originalRunButton = runButton(f.render());
    changeThreshold(f.render(), "1e");
    expect(threshold(f.render()).props.value).toBe("1e");
    expect(f.model.getSnapshot().criteriaStaged).toBe(true);
    expect(runButton(f.render()).props.disabled).toBe(true);
    submit(f.render());
    expect(text(f.render())).toContain(
      "Enter valid decimal thresholds in at most seven criteria, then apply them.",
    );
    expect(f.model.getSnapshot().criteriaStaged).toBe(true);
    click(originalRunButton);
    await vi.advanceTimersByTimeAsync(100_000);
    expect(f.annualReport).toHaveBeenCalledOnce();
    changeThreshold(f.render(), "0");
    expect(f.model.getSnapshot().criteriaStaged).toBe(true);
    expect(runButton(f.render()).props.disabled).toBe(true);
    expect(f.model.getSnapshot().run).toBe(captured);
    expect(captured.criteria).toBe(originalCriteria);
    expect(captured.criteria.clauses[0]).toEqual({
      field: "operatingCashFlow",
      operator: "gte",
      value: "0",
    });
    submit(f.render());
    expect(f.model.getSnapshot().criteriaStaged).toBe(false);
    expect(runButton(f.render()).props.disabled).toBe(false);
    expect(f.model.getSnapshot().run).toBe(captured);
    expect(f.model.getSnapshot().criteria).not.toBe(originalCriteria);
    expect(f.html()).toContain("Reported operating cash flow at least 0");
    expect(f.annualReport).toHaveBeenCalledOnce();
  });

  it("admits exact research captures through the model and fences forged, stale and retired callbacks", async () => {
    const f = await fixture();
    await f.load();
    click(findButton(f.render(), "Add criterion"));
    submit(f.render());
    await f.run();
    const before = f.render();
    const research = findButton(before, "Research ZERO");
    expect(research.props.disabled).toBe(false);
    click(research);
    const capture = f.opened[0]!;
    expect(capture.response).toBe(f.source);
    expect(capture.run).toBe(f.model.getSnapshot().run);
    expect(capture.row).toBe(capture.run.rows[0]);
    for (const forged of [
      { ...capture, run: { ...capture.run } },
      { ...capture, row: { ...capture.row } },
      { ...capture, response: structuredClone(capture.response) },
    ]) {
      expect(f.model.canAdmitReport(forged)).toBe(false);
      expect(f.model.admitReport(forged)).toBeNull();
    }
    const shortlist = elements(before).find(
      (element) =>
        element.type === "input" &&
        element.props.type === "checkbox" &&
        element.props.disabled === false,
    );
    if (!shortlist) throw new Error("Expected actionable shortlist control");
    // Stage and restore the same raw form. The completed run's old authority stays stale.
    changeThreshold(f.render(), "5");
    changeThreshold(f.render(), "0");
    submit(f.render());
    click(research);
    (shortlist.props.onChange as () => void)();
    expect(f.opened).toHaveLength(1);
    expect(f.model.getSnapshot().shortlist).toEqual([]);
    expect(f.model.canAdmitReport(capture)).toBe(false);
    expect(findButton(f.render(), "Research ZERO").props.disabled).toBe(true);
    f.model.retire();
    click(research);
    expect(f.opened).toHaveLength(1);
    expect(runButton(f.render()).props.disabled).toBe(true);
    expect(f.annualReport).toHaveBeenCalledOnce();
  });
});
