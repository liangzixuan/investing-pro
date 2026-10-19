import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedEodIdentity } from "@research-cockpit/contracts";
import { ManagedFinancialScreenComparison } from "./ManagedFinancialScreenComparison";
import { ManagedFinancialScreen as Screen } from "./ManagedFinancialScreen";
import {
  ManagedFinancialScreen,
  type ManagedFinancialScreenReportCapture,
} from "./managed-financial-screen";
import type { ManagedApi } from "./managed-api";
import { eodSelection } from "./eod-history-fixture";
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";

// Exercise component callbacks against the real screen model; SSR covers passive output.
const hooks = vi.hoisted(() => ({ direct: false, value: "income_statement" }));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => (hooks.direct ? "comparison-test" : actual.useId()),
    useState: (initial: unknown) =>
      hooks.direct
        ? [hooks.value, (next: string) => (hooks.value = next)]
        : actual.useState(initial),
  };
});

const models = new Set<ManagedFinancialScreen>();
beforeEach(() => {
  hooks.value = "income_statement";
  vi.useFakeTimers({
    toFake: ["Date", "performance", "setTimeout", "clearTimeout"],
  });
  vi.setSystemTime(new Date("2026-09-20T00:00:00.000Z"));
});
afterEach(() => {
  models.forEach((model) => model.retire());
  models.clear();
  hooks.direct = false;
  vi.useRealTimers();
});

const left = eodSelection.listing;
const right: ManagedEodIdentity = {
  ...left,
  listingId: "listing-one",
  issuerId: "issuer-one",
  issuerName: "One Company",
  securityId: "security-one",
  securityName: "One Class A",
  shareClassId: "class-one",
  symbol: "ONE",
};

async function fixture(historical = false) {
  const sources = await Promise.all([
    annualComparisonResponse("left"),
    annualComparisonResponse(
      "right",
      historical ? { mode: "current-use-unavailable" } : {},
    ),
  ]);
  const listings = [left, right];
  const annualReport = vi
    .fn<ManagedApi["annualReport"]>()
    .mockImplementation((request) =>
      Promise.resolve(sources[request.listingId === left.listingId ? 0 : 1]),
    );
  const resolve = vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
    Promise.resolve({
      snapshotSha256: request.snapshotSha256,
      results: request.listingIds.map((listingId) => ({
        listingId,
        listing: listings.find((item) => item.listingId === listingId) ?? null,
      })),
    }),
  );
  const model = new ManagedFinancialScreen(
    { resolve, annualReport },
    vi.fn(),
    undefined,
    {
      listingIds: listings.map((item) => item.listingId),
      coverage: createManagedResearchCoverageFixture(
        listings.map((listing, index) => ({
          listing,
          cik:
            listing.issuerId === left.issuerId
              ? "0000000001"
              : listing.issuerId === right.issuerId
                ? "0000000002"
                : String(index + 10).padStart(10, "0"),
        })),
      ),
    },
  );
  models.add(model);
  model.reconcile(eodSelection.catalogSnapshotSha256, true, true);
  await model.loadUniverse(model.getSnapshot());
  const pending = model.run(model.getSnapshot());
  await vi.advanceTimersByTimeAsync(20_000);
  await pending;
  const opened: ManagedFinancialScreenReportCapture[] = [];
  const onOpenReport = vi.fn((capture: ManagedFinancialScreenReportCapture) => {
    if (model.admitReport(capture)) opened.push(capture);
  });
  const props = () => ({ model, state: model.getSnapshot(), onOpenReport });
  const render = () => {
    hooks.direct = true;
    try {
      return ManagedFinancialScreenComparison(props());
    } finally {
      hooks.direct = false;
    }
  };
  const html = () => renderToStaticMarkup(render());
  const choose = () => {
    model.selectComparison(
      model.getSnapshot(),
      "left",
      model.getSnapshot().run!.rows[0]!,
    );
    model.selectComparison(
      model.getSnapshot(),
      "right",
      model.getSnapshot().run!.rows[1]!,
    );
  };
  return { model, sources, annualReport, opened, props, render, html, choose };
}

type Element = React.ReactElement<Record<string, unknown>>;
function elements(node: React.ReactNode): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === "function") {
    hooks.direct = true;
    try {
      return elements(
        (node.type as (props: Record<string, unknown>) => React.ReactNode)(
          node.props,
        ),
      );
    } finally {
      hooks.direct = false;
    }
  }
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return React.isValidElement<Record<string, unknown>>(node)
    ? React.Children.toArray(node.props.children as React.ReactNode)
        .map(text)
        .join("")
    : "";
}
function button(tree: React.ReactNode, name: string) {
  const found = elements(tree).find(
    (item) => item.type === "button" && text(item) === name,
  );
  if (!found) throw new Error(`Missing button: ${name}`);
  return found;
}

describe("screen-owned annual statement comparison", () => {
  it("requires explicit independent choices and exposes result controls without source requests", async () => {
    const f = await fixture();
    expect(f.html()).toContain("Choose a loaded result for the left company.");
    expect(f.html()).toContain("Choose a loaded result for the right company.");
    expect(f.html()).not.toContain("reported USD table");
    const markup = renderToStaticMarkup(
      <Screen model={f.model} onOpenReport={f.props().onOpenReport} />,
    );
    expect(markup).toContain("Compare left ZERO");
    expect(markup).toContain("Compare right ONE");
    const $ = load(markup);
    const selector = $(".managed-screen-comparison > label select");
    const selectorId = selector.attr("id");
    expect(selector).toHaveLength(1);
    expect(selectorId).toBeTruthy();
    expect(selector.parent().attr("for")).toBe(selectorId);
    expect(selector.attr("disabled")).toBeUndefined();
    expect(
      $("[id]").filter((_, element) => $(element).attr("id") === selectorId),
    ).toHaveLength(1);
    expect(
      selector
        .find("option")
        .map((_, option) => $(option).attr("value"))
        .get(),
    ).toEqual(["income_statement", "balance_sheet", "cash_flow"]);
    f.choose();
    expect(f.model.getSnapshot().shortlist).toEqual([]);
    expect(f.html()).toContain("Left company: ZERO · Zero Company");
    expect(f.html()).toContain("Right company: ONE · One Company");
    expect(f.annualReport).toHaveBeenCalledTimes(2);
  });

  it("reads all three canonical groups with independent periods, refusals and original sources", async () => {
    const f = await fixture();
    f.choose();
    for (const [group, label, leftValue, rightValue] of [
      ["income_statement", "Income statement", "1000", "750"],
      ["balance_sheet", "Balance sheet", "1500", "900"],
      ["cash_flow", "Cash flow", "1000", "900"],
    ]) {
      const select = elements(f.render()).find(
        (item) => item.type === "select",
      )!;
      (select.props.onChange as (event: unknown) => void)({
        currentTarget: { value: group },
      });
      const markup = f.html();
      expect(
        markup.match(new RegExp(`${label} reported USD table`, "gu")),
      ).toHaveLength(2);
      expect(markup).toContain("2025-12-31");
      expect(markup).toContain("2025-06-30");
      expect(markup).toContain("The dates are not aligned.");
      expect(markup).toContain("Unavailable.");
      expect(markup).not.toContain("Select for note");
      expect(markup).not.toContain('type="checkbox"');
      for (const source of f.sources) {
        expect(markup).toContain(source.evidence.generation.cutoffAt);
        expect(markup).toContain(source.evidence.generation.completedAt);
        expect(markup).toContain(
          source.evidence.generation.sources.companyFacts.sourceUrl,
        );
        expect(markup).toContain(source.evidence.generation.sha256);
      }
      expect(markup).toContain('tabindex="0"');
      const cards = markup.match(/<article\b[\s\S]*?<\/article>/gu)!;
      expect(cards).toHaveLength(2);
      expect(cards[0]).toContain(`USD ${leftValue}`);
      expect(cards[1]).toContain(`USD ${rightValue}`);
      expect(cards[0]).toContain("2025-12-31");
      expect(cards[1]).toContain("2025-06-30");
      if (group === "income_statement") {
        expect(cards[0]).toContain("2024-12-31");
        expect(cards[1]).toContain("2024-06-30");
      }
    }
    expect(f.html()).toContain("Original reported amount");
    expect(f.html()).toContain("Source pointer");
    expect(f.annualReport).toHaveBeenCalledTimes(2);
  });

  it("keeps a historical company's own qualification without changing the other company's current values", async () => {
    const f = await fixture(true);
    f.choose();
    const cards = f.html().match(/<article\b[\s\S]*?<\/article>/gu)!;
    expect(cards[0]).toContain("Within current-use limits at this load.");
    expect(cards[1]).toContain(
      "Historical value; not eligible for current use at this load.",
    );
    expect(cards[1]).not.toContain("Within current-use limits at this load.");
    expect(cards[1]).toContain("USD 750");
    expect(f.annualReport).toHaveBeenCalledTimes(2);
  });

  it("opens either exact captured company and rejects a stale research callback after criteria edits", async () => {
    const f = await fixture();
    f.choose();
    const first = button(f.render(), "Research ZERO from comparison");
    const second = button(f.render(), "Research ONE from comparison");
    const open = (control: Element) =>
      (control.props.onClick as (event: unknown) => void)({
        currentTarget: {},
      });
    open(first);
    open(second);
    expect(f.opened.map((capture) => capture.response)).toEqual(f.sources);
    expect(
      f.opened.every(
        (capture) =>
          capture.run === f.model.getSnapshot().run &&
          capture.run.rows.includes(capture.row),
      ),
    ).toBe(true);
    f.model.stageCriteria(f.model.getSnapshot());
    open(first);
    expect(f.opened).toHaveLength(2);
    expect(f.annualReport).toHaveBeenCalledTimes(2);
  });

  it("retains passive reading while inactive and requires an explicit current clear action", async () => {
    const f = await fixture();
    f.choose();
    const before = f.model.getSnapshot().comparison;
    const select = elements(f.render()).find((item) => item.type === "select")!;
    (select.props.onChange as (event: unknown) => void)({
      currentTarget: { value: "cash_flow" },
    });
    const clear = button(f.render(), "Clear left company");
    f.model.reconcile(eodSelection.catalogSnapshotSha256, false, true);
    expect(f.model.getSnapshot().comparison).toBe(before);
    expect(f.html()).toContain("Left company: ZERO");
    expect(f.html()).toContain("Cash flow reported USD table");
    expect(
      button(f.render(), "Research ZERO from comparison").props.disabled,
    ).toBe(true);
    (clear.props.onClick as () => void)();
    expect(f.model.getSnapshot().comparison).toBe(before);
    f.model.reconcile(eodSelection.catalogSnapshotSha256, true, true);
    (button(f.render(), "Clear left company").props.onClick as () => void)();
    expect(f.model.getSnapshot().comparison.left).toBeNull();
    expect(f.model.getSnapshot().comparison.right).toBe(before.right);
    expect(f.annualReport).toHaveBeenCalledTimes(2);
  });

  it("retires captured research actions when a pair is cleared, restored or replaced", async () => {
    const f = await fixture();
    f.choose();
    const original = f.model.getSnapshot();
    const row = original.comparison.left!;
    const other = original.comparison.right!;
    const capture = {
      run: original.run!,
      row,
      response: row.report!.response!,
    };
    const oldLeft = button(f.render(), "Research ZERO from comparison");
    const oldRight = button(f.render(), "Research ONE from comparison");
    const open = (control: Element) =>
      (control.props.onClick as (event: unknown) => void)({
        currentTarget: {},
      });
    f.model.selectComparison(f.model.getSnapshot(), "left", null);
    expect(f.model.canAdmitReport(capture)).toBe(true);
    open(oldLeft);
    open(oldRight);
    expect(f.props().onOpenReport).not.toHaveBeenCalled();
    f.model.selectComparison(f.model.getSnapshot(), "left", row);
    expect(f.model.getSnapshot().comparison.left).toBe(row);
    expect(f.model.getSnapshot().comparison.right).toBe(other);
    open(oldLeft);
    open(oldRight);
    expect(f.props().onOpenReport).not.toHaveBeenCalled();
    open(button(f.render(), "Research ZERO from comparison"));
    expect(f.opened).toHaveLength(1);
    expect(f.opened[0]!.response).toBe(f.sources[0]);
    const beforeReplacement = button(
      f.render(),
      "Research ZERO from comparison",
    );
    f.model.selectComparison(f.model.getSnapshot(), "left", null);
    f.model.selectComparison(f.model.getSnapshot(), "right", null);
    f.model.selectComparison(f.model.getSnapshot(), "left", other);
    f.model.selectComparison(f.model.getSnapshot(), "right", row);
    open(beforeReplacement);
    expect(f.opened).toHaveLength(1);
    open(button(f.render(), "Research ONE from comparison"));
    expect(f.opened).toHaveLength(2);
    expect(f.opened[1]!.response).toBe(f.sources[1]);
    const beforeVisit = button(f.render(), "Research ZERO from comparison");
    const pair = f.model.getSnapshot().comparison;
    f.model.reconcile(eodSelection.catalogSnapshotSha256, false, false);
    f.model.reconcile(eodSelection.catalogSnapshotSha256, true, true);
    expect(f.model.getSnapshot().comparison).toBe(pair);
    expect(f.model.canAdmitReport(capture)).toBe(true);
    open(beforeVisit);
    expect(f.opened).toHaveLength(2);
    open(button(f.render(), "Research ZERO from comparison"));
    expect(f.opened).toHaveLength(3);
    expect(f.opened[2]!.response).toBe(f.sources[0]);
    expect(f.annualReport).toHaveBeenCalledTimes(2);
  });
});
