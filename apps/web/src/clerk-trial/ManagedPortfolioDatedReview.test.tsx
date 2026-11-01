import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { ManagedPortfolioDatedReviewActions } from "./ManagedPortfolioDatedReviewActions";
import { ManagedPortfolioDatedReview } from "./ManagedPortfolioDatedReview";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedPortfolioCloseReview } from "./managed-portfolio-close-review";
import { preparePortfolioReviewReport } from "./portfolio-review-report";
import { portfolioReviewReportFixture } from "./portfolio-review-report-fixture";
import type { PortfolioDatedReviewReading } from "./managed-portfolio-dated-review-context";

const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  return { ...actual, ...createValuationDraftTestHooks(hooks) };
});
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
});
type Props = {
  id?: string;
  disabled?: boolean;
  onClick?: (event: { currentTarget: HTMLButtonElement }) => void;
  children?: React.ReactNode;
  ref?: React.RefObject<HTMLHeadingElement | null>;
};
function nodes(node: React.ReactNode): React.ReactElement<Props>[] {
  return React.isValidElement<Props>(node)
    ? [node, ...React.Children.toArray(node.props.children).flatMap(nodes)]
    : [];
}
function fixture() {
  const report = preparePortfolioReviewReport(portfolioReviewReportFixture())!;
  const listing = report.ledger.identities[0]!;
  const entry = {
    id: "one",
    listing,
    check: "Whole question <script> & 東京",
    result: "  Full result\nCafé  ",
    dueOn: "2026-10-29",
    status: "open",
  };
  const reading = {
    report,
    assessedOn: "2026-10-30",
    plan: { eligible: [entry] },
  } as unknown as PortfolioDatedReviewReading;
  let state = {
    reading: null as PortfolioDatedReviewReading | null,
    review: null,
    phase: "absent",
    canLoadFollowups: true,
    canTransfer: true,
    reason: null,
  };
  let price = { running: false, selectedDate: "2026-09-19" };
  let current = true;
  const transfer = vi.fn(() => {
    state = { ...state, reading, phase: "intake" };
    return reading;
  });
  const loadFollowups = vi.fn();
  const model = {
    subscribe: () => () => {},
    getSnapshot: () => state,
    transfer,
    loadFollowups,
  };
  const view = { view: "followups", research: null, companyRoute: null };
  const workspace = {
    portfolioDatedReview: model,
    subscribe: () => () => {},
    getSnapshot: () => view,
    followups: { getReviewContext: () => ({ draft: { entries: [entry] } }) },
  } as unknown as ManagedWorkspace;
  const prices = {
    getSnapshot: () => price,
  } as unknown as ManagedPortfolioCloseReview;
  const navigation = { navigate: vi.fn(() => true), transferred: vi.fn() };
  const render = (pending = false, commit = true) => {
    hooks.index = 0;
    hooks.effects = [];
    const tree = ManagedPortfolioDatedReviewActions({
      workspace,
      prices,
      current: () => current,
      navigationPending: pending,
      navigation,
    });
    if (commit) hooks.effects.forEach((effect) => effect());
    return (id: string) =>
      nodes(tree).find((node) => node.props.id === id)!.props;
  };
  return {
    workspace,
    reading,
    model,
    transfer,
    loadFollowups,
    navigation,
    render,
    retire: () => {
      current = false;
    },
    changePrice: () => {
      price = { ...price, running: true };
    },
    showFinished: () => {
      state = { ...state, reading, phase: "finished" };
    },
  };
}
const click = (props: Props) =>
  props.onClick!({ currentTarget: {} as HTMLButtonElement });
it("keeps explicit load separate and only reports the committed transfer", () => {
  const f = fixture();
  const buttons = f.render();
  click(buttons("portfolio-dated-load-followups"));
  expect(f.loadFollowups).toHaveBeenCalledWith(f.model.getSnapshot());
  expect(f.transfer).not.toHaveBeenCalled();
  click(buttons("portfolio-dated-review-transfer"));
  expect(f.transfer).toHaveBeenCalledOnce();
  expect(f.navigation.transferred).toHaveBeenCalledWith(
    f.reading,
    expect.any(Object),
  );
});
it("refuses callbacks from discarded, superseded, pending and unmounted renders", () => {
  const f = fixture();
  const discarded = f.render(false, false);
  click(discarded("portfolio-dated-review-transfer"));
  expect(f.transfer).not.toHaveBeenCalled();
  const old = f.render();
  const pending = f.render(true);
  click(old("portfolio-dated-review-transfer"));
  click(pending("portfolio-dated-review-transfer"));
  expect(f.transfer).not.toHaveBeenCalled();
  const live = f.render();
  for (const slot of hooks.slots as { cleanup?: () => void }[])
    slot?.cleanup?.();
  click(live("portfolio-dated-review-transfer"));
  expect(f.transfer).not.toHaveBeenCalled();
});
it("refuses a changed close frame or retired owner before the next render", () => {
  const f = fixture();
  const buttons = f.render();
  f.changePrice();
  click(buttons("portfolio-dated-review-transfer"));
  expect(f.transfer).not.toHaveBeenCalled();
  f.retire();
  click(buttons("portfolio-dated-review-transfer"));
  expect(f.transfer).not.toHaveBeenCalled();
});
it("does not request focus after a rejected transfer", () => {
  const f = fixture();
  f.transfer.mockImplementation(() => null as never);
  click(f.render()("portfolio-dated-review-transfer"));
  expect(f.navigation.transferred).not.toHaveBeenCalled();
});
it("renders the whole original passive report and other open checks after Finish", () => {
  const f = fixture();
  f.showFinished();
  const html = renderToStaticMarkup(
    ManagedPortfolioDatedReview({
      workspace: f.workspace,
      navigationPending: false,
      focusRequest: null,
    }),
  );
  expect(html).toContain('id="portfolio-dated-review-composition"');
  expect(html).not.toContain('id="portfolio-report-composition"');
  expect(html).toContain("Original dated Portfolio reading");
  expect(html).toContain("2026-10-30 (UTC)");
  expect(html).toContain("Whole question &lt;script&gt; &amp; 東京");
  expect(html).toContain("  Full result\nCafé  ");
  expect(html).toContain("Complete authored ledger");
  expect(html).toContain("Complete report document and source packets");
  expect(html).not.toMatch(/<button|<input|<select|<script|<iframe/iu);
});
it("hides passive reading while navigation is pending", () => {
  const f = fixture();
  f.showFinished();
  expect(
    ManagedPortfolioDatedReview({
      workspace: f.workspace,
      navigationPending: true,
      focusRequest: null,
    }),
  ).toBeNull();
});

it("waits for the committed route, focuses once, and leaves another control alone", () => {
  const f = fixture();
  f.showFinished();
  const opener = {} as HTMLButtonElement;
  const focusRequest = { reading: f.reading, opener };
  const focus = vi.fn();
  const document = { activeElement: opener, body: {} };
  const target = {
    isConnected: true,
    closest: () => null,
    ownerDocument: document,
    focus,
  };
  const render = (pending: boolean) => {
    hooks.index = 0;
    hooks.effects = [];
    ManagedPortfolioDatedReview({
      workspace: f.workspace,
      navigationPending: pending,
      focusRequest,
    });
    (hooks.slots[0] as { current: unknown }).current = target;
    hooks.effects.forEach((effect) => effect());
  };
  render(true);
  expect(focus).not.toHaveBeenCalled();
  render(false);
  expect(focus).toHaveBeenCalledOnce();
  render(false);
  expect(focus).toHaveBeenCalledOnce();
  hooks.slots = [];
  document.activeElement = {} as HTMLButtonElement;
  render(false);
  expect(focus).toHaveBeenCalledOnce();
});

it("does not focus a later publication or an unmounted reading", () => {
  const f = fixture();
  f.showFinished();
  const opener = {} as HTMLButtonElement;
  const focus = vi.fn();
  const target = {
    isConnected: true,
    closest: () => null,
    ownerDocument: { activeElement: opener, body: {} },
    focus,
  };
  hooks.index = 0;
  hooks.effects = [];
  ManagedPortfolioDatedReview({
    workspace: f.workspace,
    navigationPending: false,
    focusRequest: { reading: f.reading, opener },
  });
  (hooks.slots[0] as { current: unknown }).current = target;
  f.showFinished();
  hooks.effects.forEach((effect) => effect());
  expect(focus).not.toHaveBeenCalled();
  hooks.slots = [];
  hooks.index = 0;
  hooks.effects = [];
  target.isConnected = false;
  ManagedPortfolioDatedReview({
    workspace: f.workspace,
    navigationPending: false,
    focusRequest: { reading: f.reading, opener },
  });
  (hooks.slots[0] as { current: unknown }).current = target;
  hooks.effects.forEach((effect) => effect());
  expect(focus).not.toHaveBeenCalled();
});
