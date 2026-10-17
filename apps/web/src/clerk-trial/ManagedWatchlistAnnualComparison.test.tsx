import type * as React from "react";
import { isValidElement, type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import type { ComponentProps } from "react";
import type { ManagedWatchlistAnnualComparisonNoteAction } from "./ManagedWatchlistAnnualComparisonNoteAction";
import { TrialApiError } from "./api";
import { ManagedCatalogChangedError, type ManagedApi } from "./managed-api";
import { ManagedWatchlistAnnualComparison as Model } from "./managed-watchlist-annual-comparison";
import { ManagedWatchlistAnnualComparison } from "./ManagedWatchlistAnnualComparison";
import { SecAnnualOperatingSourceBody } from "../features/research/SecAnnualOperatingResults";
import { SecAnnualCashSourceBody } from "../features/research/SecAnnualCashGeneration";
import {
  annualComparisonMemberships as members,
  annualComparisonCashRows as cashRows,
  annualComparisonLiquidityRows as liquidityRows,
  annualComparisonOperatingRows as operatingRows,
  annualComparisonBalanceRows as reportedRows,
  annualComparisonRows as incomeRows,
  annualComparisonResponse as packet,
} from "./annual-comparison-fixture";

const noteAction = vi.hoisted(() => ({
  props: null as ComponentProps<
    typeof ManagedWatchlistAnnualComparisonNoteAction
  > | null,
}));
vi.mock("./ManagedWatchlistAnnualComparisonNoteAction", () => ({
  ManagedWatchlistAnnualComparisonNoteAction: (
    props: ComponentProps<typeof ManagedWatchlistAnnualComparisonNoteAction>,
  ) => {
    noteAction.props = props;
    return <div data-note-action="outside-table" />;
  },
}));

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  stateIndex: 0,
  refIndex: 0,
  effects: [] as Array<() => void | (() => void)>,
  cleanups: [] as Array<() => void>,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useId: () => "annual-comparison-test",
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
  useLayoutEffect: (effect: () => void | (() => void)) =>
    hooks.effects.push(effect),
  useRef: (value: unknown) =>
    (hooks.refs[hooks.refIndex++] ??= { current: value }),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [
      hooks.states[index],
      (next: unknown) => {
        hooks.states[index] =
          typeof next === "function"
            ? (next as (prior: unknown) => unknown)(hooks.states[index])
            : next;
      },
    ];
  },
}));
beforeEach(() => {
  hooks.states = [];
  hooks.refs = [];
  hooks.effects = [];
  hooks.cleanups = [];
});
afterEach(() => vi.unstubAllGlobals());

type ControlProps = {
  children?: ReactNode;
  id?: string;
  value?: string;
  disabled?: boolean;
  open?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "data-annual-comparison-cash-source"?: string;
  "data-annual-comparison-cash-margin-source"?: string;
  "data-annual-comparison-liquidity-source"?: string;
  "data-annual-comparison-operating-source"?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};
function walk(node: ReactNode): Array<ReactElement<ControlProps>> {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (!isValidElement<ControlProps>(node)) return [];
  if (typeof node.type === "function")
    return walk((node.type as (props: ControlProps) => ReactNode)(node.props));
  return [node, ...walk(node.props.children)];
}
function control(node: ReactNode, type: string, text: string) {
  const found = walk(node).find(
    (item) =>
      item.type === type &&
      (item.props.id?.endsWith(text) ||
        textContent(item.props.children) === text),
  );
  if (!found) throw new Error(`Missing ${type}: ${text}`);
  return found;
}
function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  return isValidElement<ControlProps>(node)
    ? textContent(node.props.children)
    : "";
}
function fixture() {
  const read = vi.fn<ManagedApi["annualReport"]>();
  const model = new Model(read, vi.fn());
  const digest = `sha256:${"a".repeat(64)}` as const;
  const draft: MainWatchlistPayload = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: digest,
    memberships: [members.left, members.right],
  };
  model.reconcile(draft, digest, true, true);
  const noteActions = {
    getAction: vi.fn(() => ({ canAppend: false, reason: "Choose a note." })),
    append: vi.fn(() => ({ appended: false, message: "Choose a note." })),
    review: vi.fn(),
  };
  const originalMemberships = model.getSnapshot().memberships;
  const originalDraft = structuredClone(draft);
  const onOpenReport =
    vi.fn<
      ComponentProps<typeof ManagedWatchlistAnnualComparison>["onOpenReport"]
    >();
  const render = (
    props: Partial<
      ComponentProps<typeof ManagedWatchlistAnnualComparison>
    > = {},
    commit = true,
  ) => {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    const tree = ManagedWatchlistAnnualComparison({
      model,
      active: true,
      editable: true,
      noteActions,
      memberships: draft.memberships,
      onOpenReport,
      ...props,
    });
    if (commit) {
      while (hooks.effects.length) {
        const cleanup = hooks.effects.shift()!();
        if (cleanup) hooks.cleanups.push(cleanup);
      }
    }
    return tree;
  };
  const choose = (side: "left" | "right", listingId: string) => {
    control(render(), "select", `-${side}-company`).props.onChange!({
      currentTarget: { value: listingId },
    } as React.ChangeEvent<HTMLSelectElement>);
  };
  const load = async (side: "left" | "right") => {
    await model.load(side, model.getSnapshot()[side].selected!);
  };
  return {
    read,
    model,
    draft,
    digest,
    render,
    choose,
    load,
    originalMemberships,
    originalDraft,
    noteActions,
    onOpenReport,
  };
}

describe("watchlist annual comparison controls and presentation", () => {
  const reportButton = (tree: ReactNode, side: "left" | "right" = "left") =>
    walk(tree).filter((node) =>
      node.props.className?.includes("managed-annual-report-opener"),
    )[side === "left" ? 0 : 1]!;
  const clickReport = (
    button: ReactElement<ControlProps>,
    opener = {} as HTMLButtonElement,
  ) =>
    button.props.onClick!({
      currentTarget: opener,
    } as React.MouseEvent<HTMLButtonElement>);

  it("keeps the committed report action across interrupted renders and refuses after unmount", async () => {
    const f = fixture();
    f.choose("left", members.left.listingId);
    f.read.mockResolvedValueOnce(await packet("left"));
    await f.load("left");
    const committed = reportButton(f.render());
    const replacement = vi.fn<typeof f.onOpenReport>();
    const abandoned = f.render(
      { active: false, onOpenReport: replacement },
      false,
    );
    expect(reportButton(abandoned).props.disabled).toBe(true);
    clickReport(committed);
    expect(f.onOpenReport).toHaveBeenCalledOnce();
    expect(replacement).not.toHaveBeenCalled();
    hooks.effects = [];
    f.render({ active: false });
    const uncommitted = f.render(
      { active: true, onOpenReport: replacement },
      false,
    );
    expect(reportButton(uncommitted).props.disabled).toBe(false);
    clickReport(committed);
    expect(f.onOpenReport).toHaveBeenCalledOnce();
    expect(replacement).not.toHaveBeenCalled();
    hooks.effects = [];
    f.render({ active: true, onOpenReport: replacement });
    clickReport(committed);
    expect(replacement).toHaveBeenCalledOnce();
    hooks.cleanups.at(-1)!();
    clickReport(committed);
    expect(replacement).toHaveBeenCalledOnce();
    expect(f.read).toHaveBeenCalledOnce();
    expect(f.noteActions.append).not.toHaveBeenCalled();
  });

  it("keeps explicit full-report controls outside the results and unavailable until loaded", () => {
    const f = fixture();
    const empty = f.render();
    expect(reportButton(empty).props.disabled).toBe(true);
    expect(reportButton(empty, "right").props.disabled).toBe(true);
    f.choose("left", members.left.listingId);
    const chosen = f.render();
    expect(reportButton(chosen).props["aria-label"]).toBe(
      "Open full Annual report for ZERO (Zero Company; Class A; XNAS)",
    );
    expect(reportButton(chosen).props.disabled).toBe(true);
    clickReport(reportButton(chosen));
    const html = renderToStaticMarkup(chosen);
    expect(html.indexOf("managed-annual-report-opener")).toBeLessThan(
      html.indexOf('class="managed-annual-comparison-scroll"'),
    );
    expect(f.onOpenReport).not.toHaveBeenCalled();
    expect(f.read).not.toHaveBeenCalled();
    expect(f.noteActions.append).not.toHaveBeenCalled();
  });

  it.each([
    "income-invalid",
    "current-use-unavailable",
    "source-unavailable",
  ] as const)(
    "opens exact %s reports without requiring editable notes or income eligibility",
    async (mode) => {
      const f = fixture();
      f.choose("left", members.left.listingId);
      f.read.mockResolvedValueOnce(await packet("left", { mode }));
      await f.load("left");
      const state = f.model.getSnapshot();
      const button = reportButton(f.render({ editable: false }));
      const opener = {} as HTMLButtonElement;
      expect(button.props.disabled).toBe(false);
      clickReport(button, opener);
      expect(f.onOpenReport).toHaveBeenCalledExactlyOnceWith(
        {
          side: "left",
          member: state.left.selected,
          response: state.left.report.response,
        },
        opener,
      );
      expect(f.read).toHaveBeenCalledTimes(1);
      expect(f.noteActions.append).not.toHaveBeenCalled();
      expect(f.draft).toEqual(f.originalDraft);
    },
  );

  it("opens a retained report and leaves pending comparison cancellation to the handoff owner", async () => {
    const f = fixture();
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    f.read.mockResolvedValueOnce(await packet("left"));
    await f.load("left");
    f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.load("left");
    const response = f.model.getSnapshot().left.report.response;
    expect(f.model.getSnapshot().left.report.showingPrevious).toBe(true);
    let release!: (value: Awaited<ReturnType<typeof packet>>) => void;
    f.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = f.load("right");
    const operation = f.model.getSnapshot().pending;
    const button = reportButton(f.render());
    expect(button.props.disabled).toBe(false);
    clickReport(button);
    expect(f.onOpenReport.mock.calls[0]![0].response).toBe(response);
    expect(f.model.getSnapshot().pending).toBe(operation);
    expect(f.read).toHaveBeenCalledTimes(3);
    expect(f.noteActions.append).not.toHaveBeenCalled();
    operation!.cancel();
    release(await packet("right"));
    await pending;
  });

  it("fences equal-content response replacement and remove/re-add callbacks before rerender", async () => {
    const f = fixture();
    f.choose("left", members.left.listingId);
    const report = await packet("left");
    f.read
      .mockResolvedValueOnce(report)
      .mockResolvedValueOnce(structuredClone(report));
    await f.load("left");
    const old = reportButton(f.render());
    await f.load("left");
    clickReport(old);
    expect(f.onOpenReport).not.toHaveBeenCalled();
    const replaced = reportButton(f.render());
    f.model.reconcile(
      { ...f.draft, memberships: [members.right] },
      f.digest,
      true,
      true,
    );
    f.model.reconcile(f.draft, f.digest, true, true);
    f.choose("left", members.left.listingId);
    clickReport(replaced);
    expect(f.onOpenReport).not.toHaveBeenCalled();
    expect(f.read).toHaveBeenCalledTimes(2);
  });

  it("uses the latest view guard and action port while retaining admitted note/reorder captures", async () => {
    const f = fixture();
    f.choose("left", members.left.listingId);
    f.read.mockResolvedValueOnce(await packet("left"));
    await f.load("left");
    const old = reportButton(f.render());
    f.render({ active: false });
    clickReport(old);
    expect(f.onOpenReport).not.toHaveBeenCalled();
    const latest =
      vi.fn<
        ComponentProps<typeof ManagedWatchlistAnnualComparison>["onOpenReport"]
      >();
    f.model.reconcile(
      {
        ...f.draft,
        memberships: [...f.draft.memberships]
          .reverse()
          .map((m) => ({ ...m, note: "Updated note" })),
      },
      f.digest,
      true,
      false,
    );
    f.render({ active: true, editable: false, onOpenReport: latest });
    clickReport(old);
    expect(latest).toHaveBeenCalledOnce();
    expect(f.onOpenReport).not.toHaveBeenCalled();
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(f.noteActions.append).not.toHaveBeenCalled();
  });

  it("refuses captured controls after catalog availability, activity or session retirement changes", async () => {
    const f = fixture();
    f.choose("left", members.left.listingId);
    f.read.mockResolvedValueOnce(await packet("left"));
    await f.load("left");
    const old = reportButton(f.render());
    f.read.mockRejectedValueOnce(new ManagedCatalogChangedError());
    await f.load("left");
    clickReport(old);
    expect(reportButton(f.render()).props.disabled).toBe(true);
    f.model.reconcile(f.draft, f.digest, false, true);
    clickReport(old);
    f.model.retire();
    clickReport(old);
    expect(f.onOpenReport).not.toHaveBeenCalled();
    expect(f.read).toHaveBeenCalledTimes(2);
  });

  it("forwards the exact current pair, projected basis and action port outside the scrolling table", async () => {
    const f = fixture();
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    f.read
      .mockResolvedValueOnce(await packet("left", { mode: "multiple-bases" }))
      .mockResolvedValueOnce(await packet("right"));
    await f.load("left");
    await f.load("right");
    const before = renderToStaticMarkup(f.render());
    expect(before.indexOf('data-note-action="outside-table"')).toBeGreaterThan(
      before.indexOf("</table>"),
    );
    expect(noteAction.props?.state).toBe(f.model.getSnapshot());
    expect(noteAction.props?.actions).toBe(f.noteActions);
    expect(noteAction.props?.memberships).toBe(f.draft.memberships);
    expect(noteAction.props?.active).toBe(true);
    expect(noteAction.props?.editable).toBe(true);
    expect(noteAction.props?.bases.right).toBe("SalesRevenueNet");
    control(f.render(), "select", "-left-basis").props.onChange!({
      currentTarget: { value: "Revenues" },
    } as React.ChangeEvent<HTMLSelectElement>);
    renderToStaticMarkup(f.render());
    expect(noteAction.props?.bases.left).toBe("Revenues");
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.noteActions.append).not.toHaveBeenCalled();
  });

  it("starts with empty labelled choices and makes no request through selection or rendering", () => {
    const f = fixture();
    const html = renderToStaticMarkup(f.render());
    expect(html).toContain("First annual company");
    expect(html).toContain("Second annual company");
    expect(html).toContain("First company not selected");
    expect(html).toContain("Second company not selected");
    expect(html).toContain('aria-label="Watchlist annual comparison results"');
    expect(html).toContain('tabindex="0"');
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    const selected = renderToStaticMarkup(f.render());
    expect(selected).toContain("Zero Company");
    expect(selected).toContain("One Company");
    expect(selected).toContain("Common stock");
    expect(f.read).not.toHaveBeenCalled();
  });

  it("keeps complete methods closed between visible qualified values and the note action", async () => {
    const f = fixture();
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    f.read
      .mockResolvedValueOnce(
        await packet("left", { balanceRows: reportedRows("left") }),
      )
      .mockResolvedValueOnce(
        await packet("right", { balanceRows: reportedRows("right") }),
      );
    await f.load("left");
    await f.load("right");
    const tree = f.render();
    const methods = walk(tree).filter(
      (node) =>
        node.type === "details" &&
        node.props.className === "managed-annual-comparison-methods",
    );
    expect(methods).toHaveLength(1);
    expect(methods[0]!.props.open).toBeUndefined();
    const contents = walk(methods[0]!.props.children);
    expect(contents[0]!.type).toBe("summary");
    expect(textContent(contents[0]!.props.children)).toBe(
      "Calculation methods and comparison limits",
    );
    expect(
      contents
        .filter((node) => node.type === "p")
        .map((node) => textContent(node.props.children)),
    ).toEqual([
      "Operating margin divides reported operating income by the selected positive revenue for the same filing and exact period, then multiplies by 100. It is rounded to two decimal places, half up. Revenue bases stay separate; negative operating income is valid. This does not establish adjusted earnings, EBIT or EBITDA.",
      "The app calculation subtracts purchases of property, plant and equipment from operating cash flow for the same filing and period. It does not adjust for leases, acquisitions or other investing cash flows. Cash generation relative to revenue divides that exact subtraction by each positive reported revenue basis and multiplies by 100, rounded once to two decimal places, half up. All three inputs must have the same filing and exact period within that company. The three named bases stay separate from the selected income basis. Each company keeps its own fiscal period; these percentages do not rank companies or establish like-for-like performance.",
      "Working capital subtracts current liabilities from current assets. Current ratio divides current assets by current liabilities and rounds to two decimal places, half up. Both calculations require nonnegative balances from the same filing and date; the ratio requires positive liabilities. Current assets are not all cash.",
      "Balance sheet totals are independent reported amounts at each company’s own balance date. Parent equity excludes noncontrolling interests. Different fiscal dates and accounting policies can limit comparison. No balance equation or cross-company difference is inferred.",
    ]);
    const html = renderToStaticMarkup(tree);
    const disclosure = html.indexOf(
      '<details class="managed-annual-comparison-methods">',
    );
    expect(disclosure).toBeGreaterThan(html.indexOf("</table>"));
    expect(html.indexOf('data-note-action="outside-table"')).toBeGreaterThan(
      html.indexOf("</details>", disclosure),
    );
    const visible = html.slice(0, disclosure);
    expect(visible).toContain(
      "Fiscal periods and balance dates can differ. Parent equity excludes noncontrolling interests.",
    );
    expect(reportedAmounts(visible, "totalAssets")).toEqual([
      "1000.125",
      `1000.${"0".repeat(58)}1`,
    ]);
    expect(reportedRowHtml(visible, "totalAssets")).toContain("At 2025-12-31");
    expect(reportedRowHtml(visible, "totalAssets")).toContain("At 2025-06-30");
    expect(reportedRowHtml(visible, "shareholdersEquity")).toContain(
      "Unavailable",
    );
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.noteActions.append).not.toHaveBeenCalled();
    expect(f.draft).toEqual(f.originalDraft);
  });

  it("renders each exact fiscal period, basis and original source dates with closed complete details", async () => {
    const f = fixture();
    const left = await packet("left", { mode: "exact-decimal" });
    const right = await packet("right");
    f.read.mockResolvedValueOnce(left).mockResolvedValueOnce(right);
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    await f.load("left");
    await f.load("right");
    const html = renderToStaticMarkup(f.render());
    const table = html
      .split('<table class="managed-annual-comparison-table">')[1]!
      .split("</table>")[0]!;
    expect(table).toContain("2025-01-01");
    expect(table).toContain("2024-07-01");
    expect(table).toContain("2025-06-30");
    expect(table).toContain("<td>Revenue</td>");
    expect(table).toContain("<td>Net sales revenue</td>");
    expect(html).toContain(
      'data-annual-comparison-source-basis="left">Selected SEC revenue concept: <code>Revenues</code>',
    );
    expect(html).toContain(
      'data-annual-comparison-source-basis="right">Selected SEC revenue concept: <code>SalesRevenueNet</code>',
    );
    expect(table).toContain(`1000.${"0".repeat(58)}1`);
    expect(table).toContain("750");
    expect(table).toContain("20%");
    for (const wire of [left, right]) {
      expect(html).toContain(wire.evidence.generation.completedAt);
      expect(html).toContain(wire.evidence.generation.sha256);
      for (const item of wire.evidence.observations)
        expect(html).toContain(item.id);
    }
    expect(html).toContain("<details><summary>First company source");
    expect(html).toContain("<details><summary>Second company source");
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.model.getSnapshot().memberships).toHaveLength(2);
  });

  it("keeps an explicitly chosen missing basis unavailable after replacement and resets it for a new company", async () => {
    const f = fixture();
    f.choose("left", members.left.listingId);
    f.read.mockResolvedValueOnce(
      await packet("left", { mode: "multiple-bases" }),
    );
    await f.load("left");
    const concept = "RevenueFromContractWithCustomerExcludingAssessedTax";
    control(f.render(), "select", "-left-basis").props.onChange!({
      currentTarget: { value: concept },
    } as React.ChangeEvent<HTMLSelectElement>);
    expect(renderToStaticMarkup(f.render())).toContain("500");
    const chosen = f.render();
    const basis = control(chosen, "select", "-left-basis");
    const description = control(chosen, "p", "-left-selected-basis");
    expect(basis.props["aria-describedby"]).toBe(description.props.id);
    expect(textContent(description.props.children)).toBe(
      "Selected basis: Customer contract revenue, excluding assessed tax",
    );
    expect(
      walk(basis)
        .filter((item) => item.type === "option")
        .map((item) => [item.props.value, textContent(item.props.children)]),
    ).toEqual([
      [concept, "Customer contract revenue, excluding assessed tax"],
      ["Revenues", "Revenue"],
      [
        "SalesRevenueNet",
        "Net sales revenue · revenue/net-income pair unavailable",
      ],
    ]);
    f.read.mockResolvedValueOnce(await packet("left"));
    await f.load("left");
    const replaced = renderToStaticMarkup(f.render());
    expect(control(f.render(), "select", "-left-basis").props.value).toBe(
      concept,
    );
    expect(replaced).toContain("revenue/net-income pair unavailable");
    expect(replaced).toContain("Revenue and net income unavailable");
    expect(replaced).toContain(
      `Selected SEC revenue concept: <code>${concept}</code>`,
    );
    expect(
      textContent(
        control(f.render(), "p", "-left-selected-basis").props.children,
      ),
    ).toBe(textContent(description.props.children));
    expect(
      replaced
        .split('<th scope="row">Revenue · USD</th>')[1]!
        .split("</tr>")[0],
    ).not.toContain("1000");
    f.choose("left", members.right.listingId);
    f.read.mockResolvedValueOnce(await packet("right"));
    await f.load("left");
    expect(control(f.render(), "select", "-left-basis").props.value).toBe(
      "SalesRevenueNet",
    );
    expect(
      textContent(
        control(f.render(), "p", "-left-selected-basis").props.children,
      ),
    ).toBe("Selected basis: Net sales revenue");
    expect(f.read).toHaveBeenCalledTimes(3);
    expect(
      f.model
        .getSnapshot()
        .memberships.map((member) => member.listing.listingId),
    ).toEqual(f.draft.memberships.map((member) => member.listingId));
  });

  it("retains an unknown selected key verbatim and unavailable without substituting a known basis", async () => {
    const f = fixture();
    f.choose("left", members.left.listingId);
    f.read.mockResolvedValueOnce(await packet("left"));
    await f.load("left");
    const key = "UnknownRetainedRevenueConcept";
    control(f.render(), "select", "-left-basis").props.onChange!({
      currentTarget: { value: key },
    } as React.ChangeEvent<HTMLSelectElement>);
    const tree = f.render();
    const html = renderToStaticMarkup(tree);
    expect(control(tree, "select", "-left-basis").props.value).toBe(key);
    expect(
      textContent(control(tree, "p", "-left-selected-basis").props.children),
    ).toBe(`Selected basis: ${key}`);
    expect(html).toContain(`${key} · revenue/net-income pair unavailable`);
    expect(html).toContain(`Selected SEC revenue concept: <code>${key}</code>`);
    expect(html).toContain("Revenue and net income unavailable");
    expect(
      html.split('<th scope="row">Revenue · USD</th>')[1]!.split("</tr>")[0],
    ).not.toContain("1000");
    expect(f.read).toHaveBeenCalledTimes(1);
  });

  it.each(["another company", "empty choice"])(
    "resets the basis after leaving for %s and returning to the same membership",
    async (destination) => {
      const f = fixture();
      f.choose("left", members.left.listingId);
      f.read.mockResolvedValue(await packet("left"));
      await f.load("left");
      const originalHandle = f.model.getSnapshot().left.selected!.handle;
      const alternate = "RevenueFromContractWithCustomerExcludingAssessedTax";
      control(f.render(), "select", "-left-basis").props.onChange!({
        currentTarget: { value: alternate },
      } as React.ChangeEvent<HTMLSelectElement>);
      expect(control(f.render(), "select", "-left-basis").props.value).toBe(
        alternate,
      );
      f.choose(
        "left",
        destination === "another company" ? members.right.listingId : "",
      );
      f.render();
      f.choose("left", members.left.listingId);
      await f.load("left");
      expect(f.model.getSnapshot().left.selected!.handle).toBe(originalHandle);
      expect(control(f.render(), "select", "-left-basis").props.value).toBe(
        "Revenues",
      );
    },
  );

  it("shows retained original dates after a failed refresh and guards hidden basis events", async () => {
    const f = fixture();
    f.choose("left", members.left.listingId);
    const wire = await packet("left");
    f.read.mockResolvedValueOnce(wire);
    await f.load("left");
    const staleBasis = control(f.render(), "select", "-left-basis");
    f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.load("left");
    expect(renderToStaticMarkup(f.render())).toContain(
      `Previous report, loaded <time dateTime="${wire.evidence.generation.completedAt}">`,
    );
    f.model.reconcile(f.draft, f.digest, false, false);
    staleBasis.props.onChange!({
      currentTarget: { value: "missing" },
    } as React.ChangeEvent<HTMLSelectElement>);
    expect(control(f.render(), "select", "-left-basis").props.value).toBe(
      "Revenues",
    );
  });

  it.each(["restore", "moved", "hidden", "detached"])(
    "restores focused Cancel only when its visible load control still owns focus: %s",
    (mode) => {
      const f = fixture();
      f.choose("left", members.left.listingId);
      f.read.mockImplementation(() => new Promise(() => undefined));
      void f.load("left");
      const cancel = {} as HTMLButtonElement;
      const button = {
        isConnected: mode !== "detached",
        disabled: false,
        closest: () => (mode === "hidden" ? {} : null),
        getClientRects: () => [1],
        focus: vi.fn(),
      };
      const doc = { activeElement: cancel as unknown, body: {} };
      vi.stubGlobal("document", doc);
      const tree = f.render();
      hooks.refs[0]!.current = { left: button, right: null };
      control(tree, "button", "Cancel first annual report").props.onClick!({
        currentTarget: cancel,
      } as React.MouseEvent<HTMLButtonElement>);
      doc.activeElement = mode === "moved" ? {} : doc.body;
      f.render();
      expect(button.focus).toHaveBeenCalledTimes(mode === "restore" ? 1 : 0);
      expect(f.read.mock.calls[0]![1].aborted).toBe(true);
    },
  );
});

const cashMetrics = [
  "operatingCashFlow",
  "ppePurchases",
  "operatingCashFlowLessPpePurchases",
] as const;
function cashRowHtml(html: string, metric: (typeof cashMetrics)[number]) {
  return html
    .split(`data-annual-comparison-cash="${metric}"`)[1]!
    .split("</tr>")[0]!;
}
function cashAmounts(html: string, metric: (typeof cashMetrics)[number]) {
  return Array.from(
    cashRowHtml(html, metric).matchAll(
      /class="sec-annual-cash-amount">([^<]+)</gu,
    ),
    (match) => match[1],
  );
}

describe("cash in the existing annual comparison", () => {
  it("keeps three semantic cash rows mounted and unloaded without a source request", () => {
    const f = fixture();
    const html = renderToStaticMarkup(f.render());
    expect(html).toContain('<th scope="row">Revenue / net income period</th>');
    expect(html).toContain(
      '<th scope="row">Operating cash flow<small>Reported · USD</small>',
    );
    expect(html).toContain(
      '<th scope="row">PP&amp;E purchases<small>Reported · USD</small>',
    );
    expect(html).toContain(
      "Operating cash flow less PP&amp;E purchases<small>App calculation · USD</small>",
    );
    for (const metric of cashMetrics) {
      expect(
        cashRowHtml(html, metric).match(/<td>Not loaded<\/td>/gu),
      ).toHaveLength(2);
    }
    expect(
      html.split("<tbody>")[1]!.split("</tbody>")[0]!.match(/<tr/gu),
    ).toHaveLength(22);
    expect(
      html.match(
        /It does not adjust for leases, acquisitions or other investing cash flows\./gu,
      ),
    ).toHaveLength(1);
    expect(f.read).not.toHaveBeenCalled();
  });

  it("shows each company's exact amounts, own periods and original cash inputs in existing disclosures", async () => {
    const f = fixture();
    const left = await packet("left");
    const right = await packet("right");
    f.read.mockResolvedValueOnce(left).mockResolvedValueOnce(right);
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    await f.load("left");
    await f.load("right");
    const html = renderToStaticMarkup(f.render());
    expect(cashAmounts(html, "operatingCashFlow")).toEqual(["1000", "900"]);
    expect(cashAmounts(html, "ppePurchases")).toEqual(["250", "300"]);
    expect(cashAmounts(html, "operatingCashFlowLessPpePurchases")).toEqual([
      "750",
      "600",
    ]);
    for (const metric of cashMetrics) {
      const row = cashRowHtml(html, metric);
      expect(row).toContain("2025-01-01 to 2025-12-31");
      expect(row).toContain("2024-07-01 to 2025-06-30");
      expect(
        row.match(/Within current-use limits at this load\./gu),
      ).toHaveLength(2);
    }
    for (const [side, wire] of [
      ["left", left],
      ["right", right],
    ] as const) {
      const source = walk(f.render()).find(
        (item) => item.props["data-annual-comparison-cash-source"] === side,
      );
      expect(source).toBeDefined();
      const section = renderToStaticMarkup(source);
      const cash = wire.evidence.cashGeneration;
      for (const metric of [cash.operatingCashFlow, cash.ppePurchases]) {
        for (const row of metric.observations) {
          for (const text of [
            row.id,
            row.concept,
            row.sourceLocator,
            row.accessionNumber,
          ])
            expect(section).toContain(text);
        }
      }
      expect(section).toContain(wire.evidence.generation.completedAt);
      expect(section).toContain(
        "Scanned 1 rows: 0 invalid, 0 identical duplicates",
      );
      expect(section).toContain("Calculation references:");
    }
    expect(html).toContain(
      "<details><summary>First company source and validation details</summary>",
    );
    expect(html).toContain(
      "<details><summary>Second company source and validation details</summary>",
    );
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.model.getSnapshot().memberships).toEqual(f.originalMemberships);
    expect(f.draft).toEqual(f.originalDraft);
  });

  it.each(["missing basis", "missing income", "invalid income"])(
    "keeps valid cash independent of %s and revenue-basis changes",
    async (mode) => {
      const f = fixture();
      const response = await packet(
        "left",
        mode === "missing income"
          ? { rows: [] }
          : mode === "invalid income"
            ? { mode: "income-invalid" }
            : {},
      );
      f.read.mockResolvedValueOnce(response);
      f.choose("left", members.left.listingId);
      await f.load("left");
      const original = renderToStaticMarkup(f.render());
      control(f.render(), "select", "-left-basis").props.onChange!({
        currentTarget: { value: "SalesRevenueNet" },
      } as React.ChangeEvent<HTMLSelectElement>);
      const html = renderToStaticMarkup(f.render());
      expect(html).toContain("Revenue and net income unavailable");
      expect(html).not.toContain("Annual amounts unavailable");
      for (const metric of cashMetrics)
        expect(cashRowHtml(html, metric)).toBe(cashRowHtml(original, metric));
      expect(cashAmounts(html, "operatingCashFlowLessPpePurchases")).toEqual([
        "750",
      ]);
      expect(f.read).toHaveBeenCalledTimes(1);
      expect(f.model.getSnapshot().memberships).toEqual(f.originalMemberships);
      expect(f.draft).toEqual(f.originalDraft);
    },
  );

  it("keeps a missing cash operand unavailable while retaining the other operand and income", async () => {
    const f = fixture();
    const response = await packet("left", {
      cashRows: cashRows().filter((row) => row.metric === "ppe_purchases"),
    });
    f.read.mockResolvedValueOnce(response);
    f.choose("left", members.left.listingId);
    await f.load("left");
    const html = renderToStaticMarkup(f.render());
    expect(cashRowHtml(html, "operatingCashFlow")).toContain(
      "This reported cash concept is absent from the source.",
    );
    expect(cashAmounts(html, "ppePurchases")).toEqual(["250"]);
    expect(cashRowHtml(html, "operatingCashFlowLessPpePurchases")).toContain(
      "Unavailable.",
    );
    expect(html).toContain('<th scope="row">Revenue · USD</th><td>1000</td>');
  });

  it("retains each operand period and withholds only incompatible subtraction", async () => {
    const f = fixture();
    f.read.mockResolvedValueOnce(
      await packet("left", {
        cashRows: cashRows().map((row) =>
          row.metric === "ppe_purchases"
            ? { ...row, startDate: "2024-12-25", durationDays: 372 }
            : row,
        ),
      }),
    );
    f.choose("left", members.left.listingId);
    await f.load("left");
    const html = renderToStaticMarkup(f.render());
    expect(cashRowHtml(html, "operatingCashFlow")).toContain(
      "2025-01-01 to 2025-12-31",
    );
    expect(cashRowHtml(html, "ppePurchases")).toContain(
      "2024-12-25 to 2025-12-31",
    );
    expect(cashAmounts(html, "ppePurchases")).toEqual(["250"]);
    expect(cashRowHtml(html, "operatingCashFlowLessPpePurchases")).toContain(
      "The reported cash amounts cover different periods.",
    );
    expect(cashAmounts(html, "operatingCashFlowLessPpePurchases")).toEqual([]);
  });

  it("keeps historical cash qualified per side while the other company's amounts remain current", async () => {
    const f = fixture();
    f.read
      .mockResolvedValueOnce(
        await packet("left", { mode: "current-use-unavailable" }),
      )
      .mockResolvedValueOnce(await packet("right"));
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    await f.load("left");
    await f.load("right");
    const html = renderToStaticMarkup(f.render());
    for (const metric of cashMetrics) {
      const row = cashRowHtml(html, metric);
      expect(row).toContain(
        'class="discovery-warning">Historical amount; outside current-use limits at this load.',
      );
      expect(row).toContain("Within current-use limits at this load.");
    }
    expect(cashAmounts(html, "operatingCashFlowLessPpePurchases")).toEqual([
      "750",
      "600",
    ]);
    expect(html).toContain(
      "Revenue and net income are unavailable under the current-use policy",
    );
  });

  it.each([
    ["negative and zero", "-1000", "0", "-1000"],
    ["long exact", `${"9".repeat(61)}.12`, "0.01", `${"9".repeat(61)}.11`],
    [
      "tiny exact",
      "0.00000000000000000002",
      "0.00000000000000000001",
      "0.00000000000000000001",
    ],
  ])(
    "preserves %s cash strings without display arithmetic or rounding",
    async (_name, operating, purchases, difference) => {
      const f = fixture();
      f.read.mockResolvedValueOnce(
        await packet("left", {
          cashRows: cashRows().map((row) => ({
            ...row,
            value: row.metric === "operating_cash_flow" ? operating : purchases,
          })),
        }),
      );
      f.choose("left", members.left.listingId);
      await f.load("left");
      const html = renderToStaticMarkup(f.render());
      expect(cashAmounts(html, "operatingCashFlow")).toEqual([operating]);
      expect(cashAmounts(html, "ppePurchases")).toEqual([purchases]);
      expect(cashAmounts(html, "operatingCashFlowLessPpePurchases")).toEqual([
        difference,
      ]);
    },
  );

  it("keeps negative purchases visible with their actual calculation refusal", async () => {
    const f = fixture();
    f.read.mockResolvedValueOnce(
      await packet("left", {
        cashRows: cashRows().map((row) =>
          row.metric === "ppe_purchases" ? { ...row, value: "-250" } : row,
        ),
      }),
    );
    f.choose("left", members.left.listingId);
    await f.load("left");
    const html = renderToStaticMarkup(f.render());
    expect(cashAmounts(html, "ppePurchases")).toEqual(["-250"]);
    expect(cashRowHtml(html, "operatingCashFlowLessPpePurchases")).toContain(
      "Reported PP&amp;E purchases are negative; this subtraction is unavailable.",
    );
  });

  it("replaces exact cash from the current response, retains failures and clears retired rows without adding focus behavior", async () => {
    const f = fixture();
    f.choose("left", members.left.listingId);
    const initial = await packet("left");
    f.read.mockResolvedValueOnce(initial);
    await f.load("left");
    const before = renderToStaticMarkup(f.render());
    const focusedRegion = { focus: vi.fn() };
    const doc = { activeElement: focusedRegion, body: {} };
    vi.stubGlobal("document", doc);
    const next = await packet("left", {
      cashRows: cashRows().map((row) =>
        row.metric === "operating_cash_flow" ? { ...row, value: "1250" } : row,
      ),
      cutoffAt: "2026-09-21T00:00:00.000Z",
    });
    f.read.mockResolvedValueOnce(next);
    await f.load("left");
    const replaced = renderToStaticMarkup(f.render());
    expect(cashAmounts(replaced, "operatingCashFlow")).toEqual(["1250"]);
    expect(cashAmounts(replaced, "operatingCashFlowLessPpePurchases")).toEqual([
      "1000",
    ]);
    expect(doc.activeElement).toBe(focusedRegion);
    expect(focusedRegion.focus).not.toHaveBeenCalled();
    expect(before).toContain(
      'role="region" aria-label="Watchlist annual comparison results"',
    );
    expect(replaced).toContain(
      'role="region" aria-label="Watchlist annual comparison results"',
    );
    f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.load("left");
    const retained = renderToStaticMarkup(f.render());
    for (const metric of cashMetrics)
      expect(cashRowHtml(retained, metric)).toBe(cashRowHtml(replaced, metric));
    expect(retained).toContain(next.evidence.generation.completedAt);
    expect(retained).toContain("Previous report, loaded");
    f.model.retire();
    const retired = renderToStaticMarkup(f.render());
    for (const metric of cashMetrics)
      expect(
        cashRowHtml(retired, metric).match(/<td>Not loaded<\/td>/gu),
      ).toHaveLength(2);
    expect(retired).not.toContain("data-annual-comparison-cash-source");
    expect(f.read).toHaveBeenCalledTimes(3);
  });
});

const liquidityMetrics = [
  "currentAssets",
  "currentLiabilities",
  "workingCapital",
  "currentRatio",
] as const;
function liquidityRowHtml(
  html: string,
  metric: (typeof liquidityMetrics)[number],
) {
  return html
    .split(`data-annual-comparison-liquidity="${metric}"`)[1]!
    .split("</tr>")[0]!;
}
function liquidityAmounts(
  html: string,
  metric: (typeof liquidityMetrics)[number],
) {
  return Array.from(
    liquidityRowHtml(html, metric).matchAll(
      /class="sec-annual-liquidity-amount">([^<]+)</gu,
    ),
    (match) => match[1],
  );
}
function balanceRows(
  assets: string,
  liabilities: string,
  side: "left" | "right" = "left",
) {
  return liquidityRows(side).map((row) => ({
    ...row,
    value: row.metric === "current_assets" ? assets : liabilities,
  }));
}

describe("liquidity in the existing annual comparison", () => {
  it("keeps four labelled unloaded rows and explicit units without a request", () => {
    const f = fixture();
    const html = renderToStaticMarkup(f.render());
    for (const metric of liquidityMetrics)
      expect(
        liquidityRowHtml(html, metric).match(/<td>Not loaded<\/td>/gu),
      ).toHaveLength(2);
    expect(html).toContain("Current assets<small>Reported · USD</small>");
    expect(html).toContain("Current liabilities<small>Reported · USD</small>");
    expect(html).toContain(
      "Working capital<small>App calculation · USD</small>",
    );
    expect(html).toContain(
      "Current ratio<small>App calculation · multiple</small>",
    );
    expect(html).toContain("current ratio is a rounded multiple");
    expect(html.match(/Both calculations require nonnegative/gu)).toHaveLength(
      1,
    );
    expect(
      html.indexOf('data-annual-comparison-liquidity="currentAssets"'),
    ).toBeGreaterThan(
      html.indexOf(
        'data-annual-comparison-cash="operatingCashFlowLessPpePurchases"',
      ),
    );
    expect(f.read).not.toHaveBeenCalled();
    expect(f.noteActions.append).not.toHaveBeenCalled();
  });

  it("shows exact per-company balances, negative capital, separate dates and original source inputs", async () => {
    const f = fixture();
    const left = await packet("left");
    const right = await packet("right");
    f.read.mockResolvedValueOnce(left).mockResolvedValueOnce(right);
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    await f.load("left");
    const single = renderToStaticMarkup(f.render());
    for (const metric of liquidityMetrics)
      expect(
        liquidityRowHtml(single, metric).match(/<td>Not loaded<\/td>/gu),
      ).toHaveLength(1);
    await f.load("right");
    const html = renderToStaticMarkup(f.render());
    expect(liquidityAmounts(html, "currentAssets")).toEqual(["1500", "900"]);
    expect(liquidityAmounts(html, "currentLiabilities")).toEqual([
      "600",
      "1200",
    ]);
    expect(liquidityAmounts(html, "workingCapital")).toEqual(["900", "-300"]);
    expect(liquidityAmounts(html, "currentRatio")).toEqual(["2.50×", "0.75×"]);
    for (const metric of liquidityMetrics) {
      const row = liquidityRowHtml(html, metric);
      expect(row).toContain("At 2025-12-31");
      expect(row).toContain("At 2025-06-30");
      expect(
        row.match(/Within current-use limits at this load\./gu),
      ).toHaveLength(2);
    }
    for (const [side, wire] of [
      ["left", left],
      ["right", right],
    ] as const) {
      const source = walk(f.render()).find(
        (item) =>
          item.props["data-annual-comparison-liquidity-source"] === side,
      );
      expect(source).toBeDefined();
      const section = renderToStaticMarkup(source);
      const { liquidity, generation } = wire.evidence;
      for (const metric of [
        liquidity.currentAssets,
        liquidity.currentLiabilities,
      ])
        for (const row of metric.observations)
          for (const text of [
            row.id,
            row.concept,
            row.sourceLocator,
            row.accessionNumber,
            row.filing.sourceUrl!,
          ])
            expect(section).toContain(text);
      for (const clock of [
        generation.cutoffAt,
        generation.completedAt,
        generation.sources.companyFacts.fetchedAt!,
        generation.sources.submissions.fetchedAt!,
      ])
        expect(section).toContain(clock);
      expect(section).toContain(
        "Not supplied; an instant balance requires no duration.",
      );
      expect(section).toContain("Working capital references:");
      expect(section).toContain("Current ratio references:");
    }
    expect(html).not.toContain("<details open");
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.draft).toEqual(f.originalDraft);
    expect(f.noteActions.append).not.toHaveBeenCalled();
  });

  it.each(["missing income", "invalid income", "missing cash"])(
    "keeps liquidity independent of %s and a missing selected revenue basis",
    async (mode) => {
      const f = fixture();
      f.read.mockResolvedValueOnce(
        await packet(
          "left",
          mode === "missing income"
            ? { rows: [] }
            : mode === "invalid income"
              ? { mode: "income-invalid" }
              : { cashRows: [] },
        ),
      );
      f.choose("left", members.left.listingId);
      await f.load("left");
      const before = renderToStaticMarkup(f.render());
      control(f.render(), "select", "-left-basis").props.onChange!({
        currentTarget: { value: "SalesRevenueNet" },
      } as React.ChangeEvent<HTMLSelectElement>);
      const after = renderToStaticMarkup(f.render());
      for (const metric of liquidityMetrics)
        expect(liquidityRowHtml(after, metric)).toBe(
          liquidityRowHtml(before, metric),
        );
      expect(liquidityAmounts(after, "currentRatio")).toEqual(["2.50×"]);
      expect(after).toContain("Revenue and net income unavailable");
      expect(f.read).toHaveBeenCalledOnce();
      expect(f.draft).toEqual(f.originalDraft);
    },
  );

  it.each([
    {
      assets: "10",
      liabilities: "0",
      capital: ["10"],
      ratio: [],
      reason: "Current ratio requires current liabilities greater than zero.",
    },
    {
      assets: "-10",
      liabilities: "20",
      capital: [],
      ratio: [],
      reason: "This calculation requires nonnegative reported balances.",
    },
    {
      assets: "10",
      liabilities: "-20",
      capital: [],
      ratio: [],
      reason: "Current ratio requires current liabilities greater than zero.",
    },
    {
      assets: "0",
      liabilities: "20",
      capital: ["-20"],
      ratio: ["0.00×"],
      reason: null,
    },
  ])(
    "preserves independent amounts and checked calculation results for $assets / $liabilities",
    async ({ assets, liabilities, capital, ratio, reason }) => {
      const f = fixture();
      f.read.mockResolvedValueOnce(
        await packet("left", {
          liquidityRows: balanceRows(assets, liabilities),
        }),
      );
      f.choose("left", members.left.listingId);
      await f.load("left");
      const html = renderToStaticMarkup(f.render());
      expect(liquidityAmounts(html, "currentAssets")).toEqual([assets]);
      expect(liquidityAmounts(html, "currentLiabilities")).toEqual([
        liabilities,
      ]);
      expect(liquidityAmounts(html, "workingCapital")).toEqual(capital);
      expect(liquidityAmounts(html, "currentRatio")).toEqual(ratio);
      if (reason)
        expect(liquidityRowHtml(html, "currentRatio")).toContain(reason);
      if (capital.length === 0)
        expect(liquidityRowHtml(html, "workingCapital")).toContain(
          "This calculation requires nonnegative reported balances.",
        );
      expect(cashAmounts(html, "operatingCashFlow")).toEqual(["1000"]);
      expect(html).toContain('<th scope="row">Revenue · USD</th><td>1000</td>');
    },
  );

  it("preserves a missing balance and rejected instant independently of the other side", async () => {
    const f = fixture();
    f.read
      .mockResolvedValueOnce(
        await packet("left", {
          liquidityRows: liquidityRows().filter(
            (row) => row.metric === "current_liabilities",
          ),
        }),
      )
      .mockResolvedValueOnce(
        await packet("right", {
          liquidityRows: liquidityRows("right").map((row) =>
            row.metric === "current_assets"
              ? { ...row, startDate: "2024-07-01", durationDays: 365 }
              : row,
          ),
        }),
      );
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    await f.load("left");
    await f.load("right");
    const html = renderToStaticMarkup(f.render());
    expect(liquidityRowHtml(html, "currentAssets")).toContain(
      "This reported balance concept is absent from the source.",
    );
    expect(liquidityRowHtml(html, "currentAssets")).toContain(
      "The source observation has a period rather than a balance at one date.",
    );
    expect(liquidityAmounts(html, "currentLiabilities")).toEqual([
      "600",
      "1200",
    ]);
    expect(liquidityAmounts(html, "workingCapital")).toEqual([]);
    expect(liquidityAmounts(html, "currentRatio")).toEqual([]);
  });

  it("preserves full long derived values and distinguishes each side's historical qualification", async () => {
    const f = fixture();
    const large = "9".repeat(64);
    const tiny = `0.${"0".repeat(61)}1`;
    f.read
      .mockResolvedValueOnce(
        await packet("left", {
          mode: "current-use-unavailable",
          liquidityRows: balanceRows(large, tiny),
        }),
      )
      .mockResolvedValueOnce(
        await packet("right", {
          liquidityRows: balanceRows(tiny, large, "right"),
        }),
      );
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    await f.load("left");
    await f.load("right");
    const html = renderToStaticMarkup(f.render());
    expect(liquidityAmounts(html, "workingCapital")).toEqual([
      `${"9".repeat(63)}8.${"9".repeat(62)}`,
      `-${"9".repeat(63)}8.${"9".repeat(62)}`,
    ]);
    expect(liquidityAmounts(html, "currentRatio")).toEqual([
      `${large}${"0".repeat(62)}.00×`,
      "0.00×",
    ]);
    for (const metric of liquidityMetrics) {
      const row = liquidityRowHtml(html, metric);
      expect(
        row.match(
          /Historical value; outside current-use limits at this load\./gu,
        ),
      ).toHaveLength(1);
      expect(
        row.match(/Within current-use limits at this load\./gu),
      ).toHaveLength(1);
    }
  });

  it("replaces and retains liquidity with its response, then clears a removed selection and retired session", async () => {
    const f = fixture();
    f.choose("left", members.left.listingId);
    f.read.mockResolvedValueOnce(await packet("left"));
    await f.load("left");
    const focused = { focus: vi.fn() };
    const doc = { activeElement: focused, body: {} };
    vi.stubGlobal("document", doc);
    const next = await packet("left", {
      liquidityRows: balanceRows("120.125", "20.025"),
      cutoffAt: "2026-09-21T00:00:00.000Z",
    });
    f.read.mockResolvedValueOnce(next);
    await f.load("left");
    const replaced = renderToStaticMarkup(f.render());
    expect(liquidityAmounts(replaced, "workingCapital")).toEqual(["100.1"]);
    expect(liquidityAmounts(replaced, "currentRatio")).toEqual(["6.00×"]);
    f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.load("left");
    const retained = renderToStaticMarkup(f.render());
    for (const metric of liquidityMetrics)
      expect(liquidityRowHtml(retained, metric)).toBe(
        liquidityRowHtml(replaced, metric),
      );
    expect(retained).toContain("Previous report, loaded");
    expect(retained).toContain(next.evidence.generation.completedAt);
    expect(doc.activeElement).toBe(focused);
    expect(focused.focus).not.toHaveBeenCalled();
    f.choose("left", "");
    const cleared = renderToStaticMarkup(f.render());
    for (const metric of liquidityMetrics)
      expect(
        liquidityRowHtml(cleared, metric).match(/<td>Not loaded<\/td>/gu),
      ).toHaveLength(2);
    expect(cleared).not.toContain("data-annual-comparison-liquidity-source");
    f.choose("left", members.left.listingId);
    f.read.mockResolvedValueOnce(next);
    await f.load("left");
    f.model.retire();
    const retired = renderToStaticMarkup(f.render());
    for (const metric of liquidityMetrics)
      expect(
        liquidityRowHtml(retired, metric).match(/<td>Not loaded<\/td>/gu),
      ).toHaveLength(2);
    expect(retired).not.toContain("data-annual-comparison-liquidity-source");
    expect(f.read).toHaveBeenCalledTimes(4);
    expect(f.noteActions.append).not.toHaveBeenCalled();
    expect(f.draft).toEqual(f.originalDraft);
  });
});

const operatingMetrics = [
  "operatingIncome",
  "revenue",
  "operatingMargin",
] as const;
function operatingRowHtml(
  html: string,
  metric: (typeof operatingMetrics)[number],
) {
  return html
    .split(`data-annual-comparison-operating="${metric}"`)[1]!
    .split("</tr>")[0]!;
}
function operatingAmounts(
  html: string,
  metric: (typeof operatingMetrics)[number],
) {
  return Array.from(
    operatingRowHtml(html, metric).matchAll(
      /class="sec-annual-liquidity-amount">([^<]+)</gu,
    ),
    (match) => match[1],
  );
}
function chooseOperatingBasis(
  f: ReturnType<typeof fixture>,
  side: "left" | "right",
  value: string,
) {
  control(f.render(), "select", `-${side}-basis`).props.onChange!({
    currentTarget: { value },
  } as React.ChangeEvent<HTMLSelectElement>);
}

describe("operating results in the existing annual comparison", () => {
  it("keeps three explicitly labelled rows unloaded without reads or note actions", () => {
    const f = fixture();
    const html = renderToStaticMarkup(f.render());
    for (const metric of operatingMetrics)
      expect(
        operatingRowHtml(html, metric).match(/<td>Not loaded<\/td>/gu),
      ).toHaveLength(2);
    expect(html).toContain("Operating income<small>Reported · USD</small>");
    expect(html).toContain(
      "Operating revenue basis<small>Reported · USD</small>",
    );
    expect(html).toContain(
      "Operating margin<small>App calculation · %</small>",
    );
    expect(f.read).not.toHaveBeenCalled();
    expect(f.noteActions.append).not.toHaveBeenCalled();
    expect(f.draft).toEqual(f.originalDraft);
  });

  it("shows independent exact operating values and per-company periods without either net-income pair", async () => {
    const f = fixture();
    const left = await packet("left", {
      rows: incomeRows("left").filter((row) => row.metric === "revenue"),
      operatingRows: operatingRows("left"),
    });
    const right = await packet("right", {
      rows: incomeRows("right").filter((row) => row.metric === "revenue"),
      operatingRows: operatingRows("right"),
    });
    f.read.mockResolvedValueOnce(left).mockResolvedValueOnce(right);
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    await f.load("left");
    chooseOperatingBasis(f, "left", "Revenues");
    const single = renderToStaticMarkup(f.render());
    for (const metric of operatingMetrics)
      expect(
        operatingRowHtml(single, metric).match(/<td>Not loaded<\/td>/gu),
      ).toHaveLength(1);
    await f.load("right");
    chooseOperatingBasis(f, "right", "SalesRevenueNet");
    const tree = f.render();
    const html = renderToStaticMarkup(tree);
    expect(operatingAmounts(html, "operatingIncome")).toEqual([
      "-250.125",
      "125.25",
    ]);
    expect(operatingAmounts(html, "revenue")).toEqual(["1000", "750"]);
    expect(operatingAmounts(html, "operatingMargin")).toEqual([
      "-25.01%",
      "16.7%",
    ]);
    expect(operatingRowHtml(html, "revenue")).toContain(
      "<small>Revenue</small>",
    );
    expect(operatingRowHtml(html, "revenue")).toContain(
      "<small>Net sales revenue</small>",
    );
    for (const metric of operatingMetrics) {
      expect(operatingRowHtml(html, metric)).toContain(
        "2025-01-01 to 2025-12-31",
      );
      expect(operatingRowHtml(html, metric)).toContain(
        "2024-07-01 to 2025-06-30",
      );
      expect(
        operatingRowHtml(html, metric).match(
          /Within current-use limits at this load\./gu,
        ),
      ).toHaveLength(2);
    }
    expect(html).toContain("Revenue and net income unavailable.");
    const leftOptions = textContent(
      control(tree, "select", "-left-basis").props.children,
    );
    expect(leftOptions).toContain(
      "Revenue · revenue/net-income pair unavailable",
    );
    for (const [side, response] of [
      ["left", left],
      ["right", right],
    ] as const) {
      const source = walk(tree).find(
        (node) =>
          node.props["data-annual-comparison-operating-source"] === side,
      );
      expect(source).toBeDefined();
      expect(renderToStaticMarkup(source)).toContain(
        renderToStaticMarkup(
          <SecAnnualOperatingSourceBody response={response} />,
        ),
      );
      for (const id of response.evidence.operatingResults.operatingIncome.observations.map(
        (row) => row.id,
      ))
        expect(renderToStaticMarkup(source)).toContain(id);
    }
    expect(html).not.toContain("<details open");
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.noteActions.append).not.toHaveBeenCalled();
    expect(f.draft).toEqual(f.originalDraft);
  });

  it("changes only the selected column's revenue and margin without replacing independent operands", async () => {
    const f = fixture();
    f.read
      .mockResolvedValueOnce(
        await packet("left", {
          mode: "multiple-bases",
          operatingRows: operatingRows(),
        }),
      )
      .mockResolvedValueOnce(
        await packet("right", { operatingRows: operatingRows("right") }),
      );
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    await f.load("left");
    await f.load("right");
    chooseOperatingBasis(f, "left", "Revenues");
    const before = renderToStaticMarkup(f.render());
    chooseOperatingBasis(
      f,
      "left",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
    );
    const after = renderToStaticMarkup(f.render());
    expect(operatingAmounts(before, "revenue")).toEqual(["1000", "750"]);
    expect(operatingAmounts(after, "revenue")).toEqual(["500", "750"]);
    expect(operatingAmounts(after, "operatingMargin")).toEqual([
      "-50.03%",
      "16.7%",
    ]);
    expect(operatingRowHtml(after, "revenue")).toContain(
      "Customer contract revenue, excluding assessed tax",
    );
    expect(operatingRowHtml(after, "operatingIncome")).toBe(
      operatingRowHtml(before, "operatingIncome"),
    );
    for (const metric of cashMetrics)
      expect(cashRowHtml(after, metric)).toBe(cashRowHtml(before, metric));
    for (const metric of liquidityMetrics)
      expect(liquidityRowHtml(after, metric)).toBe(
        liquidityRowHtml(before, metric),
      );
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.noteActions.append).not.toHaveBeenCalled();
  });

  it.each(["SalesRevenueNet", "UnknownRetainedRevenueConcept"])(
    "refuses selected %s without fallback while keeping reported operating income",
    async (basis) => {
      const f = fixture();
      f.read.mockResolvedValueOnce(
        await packet("left", { operatingRows: operatingRows() }),
      );
      f.choose("left", members.left.listingId);
      await f.load("left");
      chooseOperatingBasis(f, "left", basis);
      const html = renderToStaticMarkup(f.render());
      expect(control(f.render(), "select", "-left-basis").props.value).toBe(
        basis,
      );
      expect(operatingAmounts(html, "operatingIncome")).toEqual(["-250.125"]);
      expect(operatingAmounts(html, "revenue")).toEqual([]);
      expect(operatingAmounts(html, "operatingMargin")).toEqual([]);
      expect(operatingRowHtml(html, "operatingMargin")).toContain(
        "Unavailable.",
      );
      expect(f.read).toHaveBeenCalledOnce();
    },
  );

  it("keeps a disappeared operating basis selected and refuses replacement values without fallback", async () => {
    const f = fixture();
    const concept = "RevenueFromContractWithCustomerExcludingAssessedTax";
    f.read.mockResolvedValueOnce(
      await packet("left", {
        mode: "multiple-bases",
        operatingRows: operatingRows(),
      }),
    );
    f.choose("left", members.left.listingId);
    await f.load("left");
    chooseOperatingBasis(f, "left", concept);
    const before = renderToStaticMarkup(f.render());
    expect(operatingAmounts(before, "revenue")).toEqual(["500"]);
    expect(operatingAmounts(before, "operatingMargin")).toEqual(["-50.03%"]);
    f.read.mockResolvedValueOnce(
      await packet("left", { operatingRows: operatingRows() }),
    );
    await f.load("left");
    const after = renderToStaticMarkup(f.render());
    expect(control(f.render(), "select", "-left-basis").props.value).toBe(
      concept,
    );
    expect(operatingAmounts(after, "operatingIncome")).toEqual(["-250.125"]);
    expect(operatingAmounts(after, "revenue")).toEqual([]);
    expect(operatingAmounts(after, "operatingMargin")).toEqual([]);
    expect(operatingRowHtml(after, "revenue")).toContain(
      "No observation covers the selected annual filing&#x27;s period.",
    );
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.noteActions.append).not.toHaveBeenCalled();
    expect(f.draft).toEqual(f.originalDraft);
  });

  it.each(["0", "-1"])(
    "preserves reported revenue %s while refusing its margin",
    async (value) => {
      const f = fixture();
      f.read.mockResolvedValueOnce(
        await packet("left", {
          rows: incomeRows().map((row) =>
            row.metric === "revenue" ? { ...row, value } : row,
          ),
          operatingRows: operatingRows(),
        }),
      );
      f.choose("left", members.left.listingId);
      await f.load("left");
      chooseOperatingBasis(f, "left", "Revenues");
      const html = renderToStaticMarkup(f.render());
      expect(operatingAmounts(html, "revenue")).toEqual([value]);
      expect(operatingAmounts(html, "operatingIncome")).toEqual(["-250.125"]);
      expect(operatingAmounts(html, "operatingMargin")).toEqual([]);
      expect(operatingRowHtml(html, "operatingMargin")).toContain(
        "Operating margin requires revenue greater than zero.",
      );
    },
  );

  it("keeps independent operands and distinct refusals for conflicting income and mismatched periods", async () => {
    const f = fixture();
    const leftRows = operatingRows();
    f.read
      .mockResolvedValueOnce(
        await packet("left", {
          operatingRows: [
            ...leftRows,
            {
              ...leftRows[0]!,
              value: "-251",
              sourceLocator: "/facts/us-gaap/OperatingIncomeLoss/units/USD/1",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        await packet("right", {
          operatingRows: operatingRows("right").map((row) => ({
            ...row,
            startDate: "2024-07-02",
            durationDays: 364,
          })),
        }),
      );
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    await f.load("left");
    await f.load("right");
    const html = renderToStaticMarkup(f.render());
    expect(operatingAmounts(html, "revenue")).toEqual(["1000", "750"]);
    expect(operatingAmounts(html, "operatingIncome")).toEqual(["125.25"]);
    expect(operatingRowHtml(html, "operatingIncome")).toContain(
      "The source contains conflicting reported amounts.",
    );
    expect(operatingRowHtml(html, "operatingIncome")).toContain(
      "2024-07-02 to 2025-06-30",
    );
    expect(operatingAmounts(html, "operatingMargin")).toEqual([]);
    expect(operatingRowHtml(html, "operatingMargin")).toContain(
      "The reported amounts cover different periods.",
    );
  });

  it("keeps historical eligibility on each amount and preserves 64-character reported operands", async () => {
    const f = fixture();
    const exact = `-1.${"0".repeat(60)}1`;
    const revenue = `1000.${"0".repeat(58)}1`;
    expect(exact).toHaveLength(64);
    f.read
      .mockResolvedValueOnce(
        await packet("left", {
          mode: "exact-decimal",
          cutoffAt: "2028-09-20T00:00:00.000Z",
          operatingRows: operatingRows().map((row) => ({
            ...row,
            value: exact,
          })),
        }),
      )
      .mockResolvedValueOnce(
        await packet("right", { operatingRows: operatingRows("right") }),
      );
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    await f.load("left");
    await f.load("right");
    const html = renderToStaticMarkup(f.render());
    expect(operatingAmounts(html, "operatingIncome")).toEqual([
      exact,
      "125.25",
    ]);
    expect(operatingAmounts(html, "revenue")).toEqual([revenue, "750"]);
    for (const metric of operatingMetrics) {
      expect(operatingRowHtml(html, metric)).toContain(
        "Historical value; outside current-use limits at this load.",
      );
      expect(operatingRowHtml(html, metric)).toContain(
        "Within current-use limits at this load.",
      );
    }
    expect(f.read).toHaveBeenCalledTimes(2);
  });
});

const reportedMetrics = [
  "totalAssets",
  "totalLiabilities",
  "shareholdersEquity",
] as const;
function reportedRowHtml(
  html: string,
  metric: (typeof reportedMetrics)[number],
) {
  return html
    .split(`data-annual-comparison-balance-sheet="${metric}"`)[1]!
    .split("</tr>")[0]!;
}
function reportedAmounts(
  html: string,
  metric: (typeof reportedMetrics)[number],
) {
  return Array.from(
    reportedRowHtml(html, metric).matchAll(
      /class="sec-annual-liquidity-amount">([^<]+)</gu,
    ),
    (match) => match[1],
  );
}

describe("reported balance sheet totals in the existing annual comparison", () => {
  it("keeps all three rows unloaded without requests or note actions", () => {
    const f = fixture(),
      html = renderToStaticMarkup(f.render());
    for (const metric of reportedMetrics)
      expect(
        reportedRowHtml(html, metric).match(/<td>Not loaded<\/td>/gu),
      ).toHaveLength(2);
    expect(
      html.indexOf('data-annual-comparison-balance-sheet="totalAssets"'),
    ).toBeGreaterThan(
      html.indexOf('data-annual-comparison-liquidity="currentRatio"'),
    );
    expect(f.read).not.toHaveBeenCalled();
    expect(f.noteActions.append).not.toHaveBeenCalled();
  });

  it("keeps own dates and complete closed provenance independent of income failure and selected basis", async () => {
    const f = fixture();
    const left = await packet("left", {
      mode: "income-invalid",
      balanceRows: reportedRows("left"),
    });
    const right = await packet("right", { balanceRows: reportedRows("right") });
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    f.read.mockResolvedValueOnce(left).mockResolvedValueOnce(right);
    await f.load("left");
    expect(
      reportedRowHtml(renderToStaticMarkup(f.render()), "totalAssets"),
    ).toContain("<td>Not loaded</td>");
    await f.load("right");
    const original = renderToStaticMarkup(f.render());
    for (const [side, wire] of [
      ["left", left],
      ["right", right],
    ] as const) {
      const source = original
        .split(`data-annual-comparison-balance-sheet-source="${side}">`)[1]!
        .split("</details></section>")[0]!;
      expect(source).toContain(wire.evidence.generation.completedAt);
      expect(source).toContain(wire.evidence.generation.cutoffAt);
      for (const metric of reportedMetrics)
        for (const observation of wire.evidence.balanceSheet[metric]
          .observations) {
          for (const value of [
            observation.id,
            observation.sourceLocator,
            observation.accessionNumber,
            observation.endDate,
            observation.value,
            observation.filing.sourceUrl!,
          ])
            expect(source).toContain(value);
        }
      expect(original).toContain(
        `<details><summary>${side === "left" ? "First" : "Second"} company source and validation details</summary>`,
      );
    }
    expect(reportedAmounts(original, "totalAssets")).toEqual([
      "1000.125",
      `1000.${"0".repeat(58)}1`,
    ]);
    expect(reportedAmounts(original, "totalLiabilities")).toEqual([
      "0",
      "1200.25",
    ]);
    expect(reportedAmounts(original, "shareholdersEquity")).toEqual([
      "-200.125",
    ]);
    expect(reportedRowHtml(original, "totalAssets")).toContain("At 2025-12-31");
    expect(reportedRowHtml(original, "totalAssets")).toContain("At 2025-06-30");
    chooseOperatingBasis(f, "left", "UnknownExplicitBasis");
    const changed = renderToStaticMarkup(f.render());
    for (const metric of reportedMetrics)
      expect(reportedRowHtml(changed, metric)).toBe(
        reportedRowHtml(original, metric),
      );
    expect(changed).toContain("Revenue and net income unavailable.");
    expect(changed).toContain(
      "Parent equity excludes noncontrolling interests.",
    );
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.noteActions.append).not.toHaveBeenCalled();
    expect(f.draft).toEqual(f.originalDraft);
  });

  it("retains original balances on failure and Cancel, replaces only one side and fences selection/session late replies", async () => {
    const f = fixture();
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    const initial = await packet("left", { balanceRows: reportedRows() }),
      right = await packet("right", { balanceRows: reportedRows("right") });
    f.read.mockResolvedValueOnce(initial).mockResolvedValueOnce(right);
    await f.load("left");
    await f.load("right");
    const original = renderToStaticMarkup(f.render());
    f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.load("left");
    for (const metric of reportedMetrics)
      expect(reportedRowHtml(renderToStaticMarkup(f.render()), metric)).toBe(
        reportedRowHtml(original, metric),
      );
    const next = await packet("left", {
      balanceRows: reportedRows().map((row) => ({
        ...row,
        value: row.metric === "total_assets" ? "2000.875" : row.value,
      })),
      cutoffAt: "2026-09-21T00:00:00.000Z",
    });
    let release!: (value: typeof next) => void;
    f.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const held = f.load("left");
    const pending = f.model.getSnapshot().pending!;
    pending.cancel();
    release(next);
    await held;
    for (const metric of reportedMetrics)
      expect(reportedRowHtml(renderToStaticMarkup(f.render()), metric)).toBe(
        reportedRowHtml(original, metric),
      );
    expect(f.model.getSnapshot().right.report.response).toEqual(right);
    f.read.mockResolvedValueOnce(next);
    await f.load("left");
    const replaced = renderToStaticMarkup(f.render());
    expect(reportedAmounts(replaced, "totalAssets")).toEqual([
      "2000.875",
      `1000.${"0".repeat(58)}1`,
    ]);
    expect(f.model.getSnapshot().right.report.response).toEqual(right);
    expect(replaced).toContain(next.evidence.generation.completedAt);
    f.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const selected = f.load("left");
    f.choose("left", "");
    release(initial);
    await selected;
    expect(
      reportedAmounts(renderToStaticMarkup(f.render()), "totalAssets"),
    ).toEqual([`1000.${"0".repeat(58)}1`]);
    f.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const retired = f.load("right");
    f.model.retire();
    release(right);
    await retired;
    const final = renderToStaticMarkup(f.render());
    for (const metric of reportedMetrics)
      expect(
        reportedRowHtml(final, metric).match(/<td>Not loaded<\/td>/gu),
      ).toHaveLength(2);
    expect(final).not.toContain("data-annual-comparison-balance-sheet-source");
    expect(f.read).toHaveBeenCalledTimes(7);
    expect(f.noteActions.append).not.toHaveBeenCalled();
    expect(f.draft).toEqual(f.originalDraft);
  });
});

describe("cash margins in the existing Annual comparison", () => {
  function marginRows(html: string) {
    return [
      ...html.matchAll(
        /<tr data-annual-comparison-cash-margin="[^"]+">.*?<\/tr>/gu,
      ),
    ].map((match) => match[0]);
  }

  it("keeps fixed bases independent of income choices, retained response lifetime and unchanged note actions", async () => {
    const f = fixture();
    const left = await packet("left", { mode: "multiple-bases" });
    const right = await packet("right");
    f.read.mockResolvedValueOnce(left).mockResolvedValueOnce(right);
    f.choose("left", members.left.listingId);
    f.choose("right", members.right.listingId);
    await f.load("left");
    await f.load("right");
    const original = renderToStaticMarkup(f.render());
    const originalMargins = marginRows(original);
    expect(originalMargins).toHaveLength(3);
    expect(originalMargins[0]).toContain(">150.00%<");
    expect(originalMargins[1]).toContain(">75.00%<");
    expect(originalMargins[2]).toContain(">80.00%<");
    for (const [side, response] of [
      ["left", left],
      ["right", right],
    ] as const) {
      const tree = f.render();
      const source = walk(tree).find(
        (node) => node.props["data-annual-comparison-cash-source"] === side,
      )!;
      expect(renderToStaticMarkup(source)).toBe(
        `<div class="managed-annual-comparison-cash-source" data-annual-comparison-cash-source="${side}"><h4>Cash sources and calculation inputs</h4>${renderToStaticMarkup(<SecAnnualCashSourceBody response={response} />)}</div>`,
      );
      const marginSource = walk(tree).find(
        (node) =>
          node.props["data-annual-comparison-cash-margin-source"] === side,
      )!;
      expect(renderToStaticMarkup(marginSource)).toContain(
        "Cash generation relative to revenue inputs",
      );
      expect(renderToStaticMarkup(marginSource)).toContain(
        response.evidence.generation.completedAt,
      );
      expect(renderToStaticMarkup(source)).not.toContain("Cash margin inputs");
    }
    control(f.render(), "select", "-left-basis").props.onChange!({
      currentTarget: { value: "SalesRevenueNet" },
    } as React.ChangeEvent<HTMLSelectElement>);
    expect(marginRows(renderToStaticMarkup(f.render()))).toEqual(
      originalMargins,
    );
    f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.load("left");
    const retained = renderToStaticMarkup(f.render());
    expect(retained).toContain("Previous report, loaded");
    expect(marginRows(retained)).toEqual(originalMargins);
    const replacement = await packet("left", {
      rows: incomeRows("left").map((row) => ({
        ...row,
        value:
          row.metric === "revenue" && row.endDate === "2025-12-31"
            ? "500"
            : row.value,
      })),
    });
    f.read.mockResolvedValueOnce(replacement);
    await f.load("left");
    const replaced = marginRows(renderToStaticMarkup(f.render()));
    expect(replaced[1]).toContain(">150.00%<");
    expect(replaced[2]).toBe(originalMargins[2]);
    expect(f.read).toHaveBeenCalledTimes(4);
    expect(f.draft).toEqual(f.originalDraft);
    expect(f.noteActions.append).not.toHaveBeenCalled();
    expect(f.noteActions.review).not.toHaveBeenCalled();
    f.model.retire();
    const retired = marginRows(renderToStaticMarkup(f.render()));
    expect(retired).toHaveLength(3);
    expect(retired.join("").match(/<td>Not loaded<\/td>/gu)).toHaveLength(6);
    expect(f.read).toHaveBeenCalledTimes(4);
  });
});
