import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagedPortfolioCloseReview } from "./ManagedPortfolioCloseReview";
import {
  ManagedPortfolioCloseReview as ReviewModel,
  type PortfolioCloseContext,
} from "./managed-portfolio-close-review";
import { ManagedEodAccess } from "./managed-eod-access";
import type { ManagedApi } from "./managed-api";
import type { ManagedWorkspace } from "./managed-workspace";
import { eodResponse, eodSelection } from "./eod-history-fixture";

// Committed hook doubles exercise rendered controls, ownership and effect replay.
// They do not establish React scheduling, browser layout or physical-device results.
type Effect = { run: () => (() => void) | void; deps: readonly unknown[] };
const hooks = vi.hoisted(() => ({
  index: 0,
  effects: [] as Effect[],
  slots: [] as (Effect & { cleanup: (() => void) | void })[],
  states: [] as unknown[],
}));
const capture = vi.hoisted(() => ({
  current: null as PortfolioCloseContext | null,
}));
vi.mock("./portfolio-close-review-context", () => ({
  capturePortfolioCloseContext: () => capture.current,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useMemo: (create: () => unknown) => create(),
  useState: (initial: unknown) => {
    const i = hooks.index++;
    if (!(i in hooks.states)) hooks.states[i] = initial;
    return [
      hooks.states[i],
      (value: unknown) => {
        hooks.states[i] = value;
      },
    ];
  },
  useLayoutEffect: (run: Effect["run"], deps: readonly unknown[]) => {
    hooks.effects.push({ run, deps });
  },
  useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read(),
}));
function commit() {
  hooks.effects.forEach((effect, i) => {
    const prior = hooks.slots[i];
    if (!prior || effect.deps.some((value, j) => value !== prior.deps[j])) {
      prior?.cleanup?.();
      hooks.slots[i] = { ...effect, cleanup: effect.run() };
    }
  });
}
function cleanup() {
  for (const slot of hooks.slots) slot.cleanup?.();
  hooks.slots = [];
}
beforeEach(() => {
  hooks.index = 0;
  hooks.states = [];
  hooks.effects = [];
  hooks.slots = [];
  capture.current = null;
});
afterEach(cleanup);
type Element = React.ReactElement<Record<string, unknown>>;
function nodes(node: React.ReactNode, expand = false): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (expand && typeof node.type === "function") {
    return nodes(
      (node.type as (props: Record<string, unknown>) => Element)(node.props),
      true,
    );
  }
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      (child) => nodes(child, expand),
    ),
  ];
}
function text(node: React.ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (React.isValidElement<Record<string, unknown>>(node))
    return text(node.props.children as React.ReactNode);
  return typeof node === "string" || typeof node === "number"
    ? String(node)
    : "";
}
function button(node: React.ReactNode, label: string) {
  const result = nodes(node, true).find(
    (item) =>
      item.type === "button" &&
      text(item.props.children as React.ReactNode) === label,
  );
  if (!result) throw new Error("Expected holding review control");
  return result;
}
function click(node: Element, event: unknown = { currentTarget: {} }) {
  (node.props.onClick as (event: unknown) => void)(event);
}
function fixture(cashUsd: string | null = "10.00") {
  let active = true;
  const listing = {
    ...eodSelection.listing,
    issuerName: "Issuer <script> & 東京",
  };
  const context: PortfolioCloseContext = {
    current: () => active,
    ledger: {
      schemaVersion: 3,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: eodSelection.catalogSnapshotSha256,
      basisMethod: "fifo_with_opening_pool",
      identities: [listing],
      opening: {
        asOfDate: "2026-09-01",
        cashUsd,
        holdings: [
          {
            listingId: listing.listingId,
            shares: "2",
            totalCostBasisUsd: null,
            confirmedOn: "2026-09-01",
          },
        ],
      },
      transactions: [],
    },
    portfolio: {
      schemaVersion: 1,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: eodSelection.catalogSnapshotSha256,
      cashUsd,
      holdings: [
        {
          identity: listing,
          shares: "2",
          totalCostBasisUsd: null,
          confirmedOn: "2026-09-01",
        },
      ],
    },
  };
  capture.current = context;
  const read = vi
    .fn<ManagedApi["eodHistory"]>()
    .mockResolvedValue({ ...eodResponse(), security: listing });
  const models: ReviewModel[] = [];
  const saved = { draft: { ledger: context.ledger } },
    state = {},
    session = { phase: "active" },
    view = {};
  const workspace = {
    subscribe: () => () => {},
    getSnapshot: () => view,
    sessionOwner: { subscribe: () => () => {}, getSnapshot: () => session },
    portfolio: {
      subscribe: () => () => {},
      getSnapshot: () => state,
      coordinator: { subscribe: () => () => {}, getSnapshot: () => saved },
    },
    createPortfolioCloseReview: () => {
      const model = new ReviewModel(
        new ManagedEodAccess(read),
        vi.fn(),
        vi.fn(),
        [listing],
      );
      models.push(model);
      return model;
    },
  } as unknown as ManagedWorkspace;
  const onResearch = vi.fn(),
    props = { workspace, navigationPending: false, onResearch };
  // Open the actual outer disclosure; only then invoke its mounted inner element.
  const outer = ManagedPortfolioCloseReview(props) as Element;
  expect(nodes(outer).some((node) => typeof node.type === "function")).toBe(
    false,
  );
  (outer.props.onToggle as (event: unknown) => void)({
    currentTarget: { open: true },
  });
  hooks.index = 0;
  const opened = ManagedPortfolioCloseReview(props);
  const inner = nodes(opened).find((node) => typeof node.type === "function")!;
  const Component = inner.type as (props: typeof inner.props) => Element;
  hooks.states = [];
  const render = (pending = false, apply = true) => {
    hooks.index = 0;
    hooks.effects = [];
    const node = Component({ ...inner.props, navigationPending: pending });
    if (apply) commit();
    return node;
  };
  render();
  return {
    render,
    read,
    models,
    onResearch,
    context,
    saved,
    invalidate: () => {
      active = false;
    },
  };
}
describe("Dated holdings review committed UI", () => {
  it("closes the retained disclosure before exact-company research so Back requires explicit reopening", () => {
    const onResearch = vi.fn();
    const props = {
      workspace: {} as ManagedWorkspace,
      navigationPending: false,
      onResearch,
    };
    const render = () => {
      hooks.index = 0;
      return ManagedPortfolioCloseReview(props) as Element;
    };
    const closed = render();
    expect(closed.props.open).toBe(false);
    (closed.props.onToggle as (event: unknown) => void)({
      currentTarget: { open: true },
    });
    const opened = render();
    expect(opened.props.open).toBe(true);
    const inner = nodes(opened).find(
      (node) => typeof node.type === "function",
    )!;
    const draft = {},
      listing = {},
      opener = {};
    (inner.props.onResearch as (...args: unknown[]) => void)(
      draft,
      listing,
      opener,
    );
    expect(onResearch).toHaveBeenCalledExactlyOnceWith(draft, listing, opener);
    const returned = render();
    expect(returned.props.open).toBe(false);
    expect(
      nodes(returned).some((node) => typeof node.type === "function"),
    ).toBe(false);
  });
  it("opens without reads, then displays exact identity, selected-date values and original provenance", async () => {
    const f = fixture();
    let node = f.render();
    expect(f.read).not.toHaveBeenCalled();
    expect(button(node, "Load holding closes").props.disabled).toBe(false);
    const loading = vi.spyOn(f.models[0]!, "load");
    click(button(node, "Load holding closes"));
    await loading.mock.results[0]!.value;
    node = f.render();
    const html = renderToStaticMarkup(node);
    expect(html).toContain("203.00");
    expect(html).toContain("213.00");
    expect(html).toContain("2026-09-19");
    expect(html).toContain("raw_close");
    expect(html).toContain("2026-08-20");
    expect(html).toContain("2026-09-20T00:00:01.000Z");
    expect(html).toContain("Issuer &lt;script&gt; &amp; 東京");
    expect(html).not.toContain("<script>");
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('scope="col"');
    const select = nodes(node, true).find((item) => item.type === "select")!;
    expect(select.props.id).toBe("managed-portfolio-close-date");
    (select.props.onChange as (event: unknown) => void)({
      currentTarget: { value: "2026-09-18" },
    });
    node = f.render();
    expect(renderToStaticMarkup(node)).toContain("200.50");
    const opener = {} as HTMLButtonElement;
    click(button(node, "Research ZERO"), { currentTarget: opener });
    expect(f.onResearch).toHaveBeenCalledExactlyOnceWith(
      f.saved.draft,
      f.context.ledger.identities[0],
      opener,
    );
    expect(f.read).toHaveBeenCalledTimes(1);
  });
  it("keeps unknown authored cash and the complete total unavailable", async () => {
    const f = fixture(null);
    await f.models[0]!.load();
    const html = renderToStaticMarkup(f.render());
    expect(html).toContain("203.00");
    expect(html).toContain("Unknown");
    expect(html).toContain("complete prices and known cash are required");
    expect(html).not.toContain("213.00");
  });
  it("hides a stale frame before effects and refuses retained callbacks", async () => {
    const f = fixture();
    await f.models[0]!.load();
    const old = f.render();
    f.invalidate();
    capture.current = null;
    const next = f.render(false, false);
    expect(renderToStaticMarkup(next)).not.toContain("203.00");
    click(button(old, "Load holding closes"));
    click(button(old, "Research ZERO"));
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(f.onResearch).not.toHaveBeenCalled();
    commit();
    expect(f.models[0]!.getSnapshot().rows).toEqual([]);
  });
  it("retires on cleanup and creates an active new controller when effects replay", async () => {
    const f = fixture();
    await f.models[0]!.load();
    cleanup();
    expect(f.models[0]!.getSnapshot().rows).toEqual([]);
    f.render();
    const node = f.render();
    expect(f.models).toHaveLength(2);
    expect(button(node, "Load holding closes").props.disabled).toBe(false);
    expect(renderToStaticMarkup(node)).not.toContain("203.00");
    await f.models[1]!.load();
    expect(renderToStaticMarkup(f.render())).toContain("203.00");
  });
  it("gates actions while navigation is pending", async () => {
    const f = fixture();
    await f.models[0]!.load();
    const pending = f.render(true, false);
    expect(button(pending, "Load holding closes").props.disabled).toBe(true);
    expect(renderToStaticMarkup(pending)).not.toContain("203.00");
    click(button(pending, "Load holding closes"));
    expect(f.read).toHaveBeenCalledTimes(1);
  });
});
