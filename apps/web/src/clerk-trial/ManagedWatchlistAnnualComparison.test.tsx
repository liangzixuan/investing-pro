import type * as React from "react";
import { isValidElement, type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { ManagedWatchlistAnnualComparison as Model } from "./managed-watchlist-annual-comparison";
import { ManagedWatchlistAnnualComparison } from "./ManagedWatchlistAnnualComparison";
import {
  annualComparisonMemberships as members,
  annualComparisonResponse as packet,
} from "./annual-comparison-fixture";

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
  const render = () => {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    const tree = ManagedWatchlistAnnualComparison({ model });
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
  return { read, model, draft, digest, render, choose, load };
}

describe("watchlist annual comparison controls and presentation", () => {
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
    expect(replaced).toContain("Annual amounts unavailable");
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
        .split('<table class="managed-annual-comparison-table">')[1]!
        .split("</table>")[0],
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
    expect(html).toContain("Annual amounts unavailable");
    expect(
      html
        .split('<table class="managed-annual-comparison-table">')[1]!
        .split("</table>")[0],
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
