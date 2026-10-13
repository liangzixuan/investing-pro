import type * as React from "react";
import { isValidElement, type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import type { ComponentProps } from "react";
import type { ManagedWatchlistAnnualComparisonNoteAction } from "./ManagedWatchlistAnnualComparisonNoteAction";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { ManagedWatchlistAnnualComparison as Model } from "./managed-watchlist-annual-comparison";
import { ManagedWatchlistAnnualComparison } from "./ManagedWatchlistAnnualComparison";
import {
  annualComparisonMemberships as members,
  annualComparisonCashRows as cashRows,
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
  effects: [] as Array<() => void>,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useId: () => "annual-comparison-test",
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
  useLayoutEffect: (effect: () => void) => hooks.effects.push(effect),
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
});
afterEach(() => vi.unstubAllGlobals());

type ControlProps = {
  children?: ReactNode;
  id?: string;
  value?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
  "data-annual-comparison-cash-source"?: string;
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
  };
  const originalMemberships = model.getSnapshot().memberships;
  const originalDraft = structuredClone(draft);
  const render = () => {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    const tree = ManagedWatchlistAnnualComparison({
      model,
      active: true,
      editable: true,
      noteActions,
    });
    while (hooks.effects.length) hooks.effects.shift()!();
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
  };
}

describe("watchlist annual comparison controls and presentation", () => {
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
      ["SalesRevenueNet", "Net sales revenue · unavailable in this report"],
    ]);
    f.read.mockResolvedValueOnce(await packet("left"));
    await f.load("left");
    const replaced = renderToStaticMarkup(f.render());
    expect(control(f.render(), "select", "-left-basis").props.value).toBe(
      concept,
    );
    expect(replaced).toContain("unavailable in this report");
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
    expect(html).toContain(`${key} · unavailable in this report`);
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
    ).toHaveLength(9);
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
