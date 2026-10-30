import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortfolioReportComparisonView } from "./PortfolioReportComparison";
import { PortfolioReportComparisonRows } from "./PortfolioReportComparisonRows";
import { PortfolioReviewReportSnapshot } from "./PortfolioReviewReportSnapshot";
import { PortfolioReviewReportController } from "./portfolio-review-report-controller";
import { PortfolioReportRevisit } from "./portfolio-report-revisit";
import { parsePortfolioReportArchive } from "./portfolio-report-archive";
import { comparePortfolioReports } from "./portfolio-report-comparison";
import {
  archiveBytes,
  archiveHtmlFixture,
  archiveReportFixture,
} from "./portfolio-report-archive-fixture";
import {
  portfolioReviewReportFixture,
  portfolioReviewReportInput,
} from "./portfolio-review-report-fixture";
import {
  preparePortfolioReviewReport,
  isPreparedPortfolioReviewReport,
} from "./portfolio-review-report";
import { eodResponse } from "./eod-history-fixture";
import type { ValuationTestEffectSlot } from "./valuation-draft-files-test-hooks";

const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  ...(
    await import("./valuation-draft-files-test-hooks")
  ).createValuationDraftTestHooks(hooks),
}));
type Element = React.ReactElement<Record<string, unknown>>;
type Node = { focus: ReturnType<typeof vi.fn>; isConnected: boolean };
const nodes = new Map<string, Node>();
const focusListeners = new Set<(event: { target: unknown }) => void>();
const doc: {
  activeElement: Node | null;
  body: Node;
  addEventListener: (
    type: string,
    listener: (event: { target: unknown }) => void,
  ) => unknown;
  removeEventListener: (
    type: string,
    listener: (event: { target: unknown }) => void,
  ) => unknown;
} = {
  activeElement: null,
  body: { focus: vi.fn(), isConnected: true },
  addEventListener: vi.fn(
    (_type: string, listener: (event: { target: unknown }) => void) =>
      focusListeners.add(listener),
  ),
  removeEventListener: vi.fn(
    (_type: string, listener: (event: { target: unknown }) => void) =>
      focusListeners.delete(listener),
  ),
};
function elements(value: React.ReactNode): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...elements(value.props.children as React.ReactNode)];
}
function focus(node: Node) {
  doc.activeElement = node;
  for (const listener of focusListeners) listener({ target: node });
}
function attach(tree: React.ReactNode) {
  for (const item of elements(tree)) {
    if (typeof item.props.id !== "string") continue;
    let node = nodes.get(item.props.id);
    if (!node) {
      node = { focus: vi.fn(), isConnected: true };
      node.focus.mockImplementation(() => focus(node!));
      nodes.set(item.props.id, node);
    }
    const ref = item.props.ref as { current: Node | null } | undefined;
    if (ref) ref.current = node;
  }
}
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  nodes.clear();
  focusListeners.clear();
  doc.activeElement = doc.body;
  vi.stubGlobal("document", doc);
});
afterEach(() => {
  for (const slot of hooks.slots)
    (slot as ValuationTestEffectSlot | undefined)?.cleanup?.();
  vi.unstubAllGlobals();
});
function setup() {
  const report = archiveReportFixture();
  const bytes = archiveBytes(archiveHtmlFixture(report));
  let active = true;
  const reports = new PortfolioReviewReportController(
    {
      capture: () => ({ report, current: () => active }),
      subscribe: () => () => {},
    },
    undefined,
    () => null,
  );
  const controller = new PortfolioReportRevisit(reports);
  let tree: React.ReactNode;
  const render = () => {
    hooks.index = 0;
    hooks.effects = [];
    tree = PortfolioReportComparisonView({ reports, controller });
    attach(tree);
    hooks.effects.splice(0).forEach((effect) => effect());
    return load(renderToStaticMarkup(tree));
  };
  const get = (id: string) =>
    elements(tree).find((item) => item.props.id === id)!;
  const click = (id: string) => {
    const node = get(id);
    expect(node.props.disabled).not.toBe(true);
    const opener = nodes.get(id)!;
    focus(opener);
    (node.props.onClick as (event: unknown) => void)({ currentTarget: opener });
  };
  render();
  return {
    reports,
    controller,
    bytes,
    render,
    get,
    click,
    retire: () => {
      active = false;
    },
  };
}
describe("Portfolio saved/current report UI", () => {
  it("keeps Choose, Read and Compare explicit and commits focus only with the result", async () => {
    const f = setup();
    expect(f.get("portfolio-report-read").props.disabled).toBe(true);
    expect(f.get("portfolio-report-compare").props.disabled).toBe(true);
    const arrayBuffer = vi.fn(() => Promise.resolve(f.bytes));
    const input = {
      files: [
        {
          name: "private <script>.html",
          size: f.bytes.byteLength,
          arrayBuffer,
        },
      ],
      value: "chosen",
    };
    (f.get("portfolio-report-file").props.onChange as (event: unknown) => void)(
      { currentTarget: input },
    );
    expect(input.value).toBe("");
    expect(arrayBuffer).not.toHaveBeenCalled();
    f.render();
    f.click("portfolio-report-read");
    focus(doc.body); // Native disabling can blur the initiating button.
    await Promise.resolve();
    await Promise.resolve();
    expect(nodes.has("portfolio-report-saved-heading")).toBe(false);
    const html = f.render();
    expect(doc.activeElement).toBe(nodes.get("portfolio-report-saved-heading"));
    expect(html("script")).toHaveLength(0);
    expect(html.text()).toContain("private <script>.html");
    expect(f.get("portfolio-report-compare").props.disabled).toBe(true);
    f.reports.prepare();
    f.render();
    f.click("portfolio-report-compare");
    expect(nodes.has("portfolio-report-comparison-heading")).toBe(false);
    f.render();
    expect(doc.activeElement).toBe(
      nodes.get("portfolio-report-comparison-heading"),
    );
  });
  it("does not steal delayed focus after another control received focus", async () => {
    const f = setup();
    f.controller.choose({
      name: "report.html",
      size: f.bytes.byteLength,
      arrayBuffer: () => Promise.resolve(f.bytes),
    });
    f.render();
    f.click("portfolio-report-read");
    focus({ focus: vi.fn(), isConnected: true });
    focus(doc.body);
    await Promise.resolve();
    await Promise.resolve();
    f.render();
    expect(doc.activeElement).toBe(doc.body);
  });
  it("does not focus a comparison retired before layout commit", async () => {
    const f = setup();
    f.controller.choose({
      name: "report.html",
      size: f.bytes.byteLength,
      arrayBuffer: () => Promise.resolve(f.bytes),
    });
    await f.controller.read();
    f.reports.prepare();
    f.render();
    f.click("portfolio-report-compare");
    f.retire();
    f.render();
    expect(
      nodes.get("portfolio-report-comparison-heading")?.focus,
    ).not.toHaveBeenCalled();
  });
  it("renders independently branded saved/current full reports with unique IDs and escaped text", () => {
    const current = archiveReportFixture();
    const saved = parsePortfolioReportArchive(
      archiveBytes(archiveHtmlFixture(current)),
    );
    expect(isPreparedPortfolioReviewReport(saved)).toBe(false);
    const html = load(
      renderToStaticMarkup(
        <>
          <PortfolioReviewReportSnapshot report={current} />
          <PortfolioReviewReportSnapshot
            report={saved}
            compositionId="portfolio-report-saved-composition"
          />
        </>,
      ),
    );
    const ids = html("[id]")
      .map((_i, element) => html(element).attr("id"))
      .get();
    expect(new Set(ids).size).toBe(ids.length);
    expect(html("pre")).toHaveLength(2);
    html("pre").each((_i, element) =>
      expect(JSON.parse(html(element).text())).toEqual(current),
    );
  });
  it("renders the complete union and permits Research only for exact current identities", () => {
    const base = portfolioReviewReportFixture();
    const original = base.ledger.identities[0]!;
    const report = (id: string, symbol: string, name = original.issuerName) => {
      const first = { ...original, issuerName: name };
      const extra = {
        ...original,
        listingId: id,
        securityId: id,
        shareClassId: id,
        symbol,
      };
      const ledger = {
        ...base.ledger,
        identities: [first, extra],
        opening: {
          ...base.ledger.opening,
          holdings: [
            ...base.ledger.opening.holdings,
            {
              listingId: id,
              shares: "3.000001",
              totalCostBasisUsd: null,
              confirmedOn: "2026-09-01",
            },
          ],
        },
      };
      const value = preparePortfolioReviewReport(
        portfolioReviewReportInput(ledger, "2026-09-19", [
          { ...eodResponse(), security: first },
        ]),
      );
      if (!value) throw new Error("Invented union report missing");
      return value;
    };
    const saved = parsePortfolioReportArchive(
      archiveBytes(archiveHtmlFixture(report("old", "OLD"))),
    );
    const current = report("new", "NEW", "Changed <script> & issuer");
    const comparison = comparePortfolioReports(saved, current);
    const html = load(
      renderToStaticMarkup(
        <PortfolioReportComparisonRows
          comparison={comparison}
          onResearch={() => {}}
        />,
      ),
    );
    expect(html("[data-portfolio-comparison-row]")).toHaveLength(3);
    expect(
      html("button")
        .map((_i, element) => html(element).attr("id"))
        .get(),
    ).toEqual(["portfolio-report-research-new"]);
    for (const value of [
      "Saved only",
      "Current only",
      "Identity conflict",
      "3.000001",
      "Changed <script> & issuer",
      "2026-09-20T00:00:01.000Z",
      "Unavailable",
      "Share of complete value",
      "No eligible close was loaded for this exact date.",
    ])
      expect(html.text()).toContain(value);
    expect(html("script")).toHaveLength(0);
  });
  it("uses readable changed-field labels and value qualifications while preserving raw report data", () => {
    const savedReport = archiveReportFixture();
    const saved = parsePortfolioReportArchive(
      archiveBytes(archiveHtmlFixture(savedReport)),
    );
    const input = portfolioReviewReportFixture();
    const changed = portfolioReviewReportInput(
      {
        ...input.ledger,
        opening: {
          ...input.ledger.opening,
          asOfDate: "2026-10-01",
          cashUsd: "12.00",
          holdings: input.ledger.opening.holdings.map((holding) => ({
            ...holding,
            shares: "3",
            confirmedOn: "2026-10-01",
          })),
        },
      },
      "2026-09-18",
    );
    const current = preparePortfolioReviewReport({
      ...changed,
      preparedAt: "2026-10-30T12:00:00.000Z",
    });
    if (!current) throw new Error("Invented changed report missing");
    const comparison = comparePortfolioReports(saved, current);
    const before = JSON.stringify(comparison);
    const html = load(
      renderToStaticMarkup(
        <PortfolioReportComparisonRows comparison={comparison} />,
      ),
    );
    html("pre").remove();
    for (const label of [
      "Capture time",
      "Selected close date",
      "Authored ledger",
      "Holdings and cash",
      "Dated holdings review",
      "Original sources",
      "Confirmation date",
      "Holding value (USD)",
      "Value qualification",
      "Authored balances are later than this close date.",
    ])
      expect(html.text()).toContain(label);
    for (const key of [
      "preparedAt",
      "selectedDate",
      "sourceRows",
      "confirmedOn",
      "valueUsd",
      "balance_after_close",
    ])
      expect(html.text()).not.toContain(key);
    expect(JSON.stringify(comparison)).toBe(before);
  });
});
