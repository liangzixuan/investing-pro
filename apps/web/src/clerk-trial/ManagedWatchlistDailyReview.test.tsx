import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { ManagedFilingsReview } from "./managed-filings-review";
import { ManagedEodAccess } from "./managed-eod-access";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import {
  ManagedWatchlistDailyReview as Daily,
  type ManagedWatchlistDailyReviewProps,
} from "./ManagedWatchlistDailyReview";

interface HookHarness {
  direct: boolean;
  index: number;
  refs: Array<{ current: unknown }>;
  state: unknown;
  effects: Array<() => void | (() => void)>;
  cleanups: Array<() => void>;
}
const hooks = vi.hoisted((): HookHarness => ({
  direct: false,
  index: 0,
  refs: [],
  state: undefined,
  effects: [],
  cleanups: [],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useState: (initial: unknown) =>
      hooks.direct
        ? [
            (hooks.state ??= initial),
            (next: unknown) => {
              hooks.state = next;
            },
          ]
        : actual.useState(initial),
    useRef: (initial: unknown) =>
      hooks.direct
        ? (hooks.refs[hooks.index++] ??= { current: initial })
        : actual.useRef(initial),
    useLayoutEffect: (
      effect: () => void | (() => void),
      deps?: React.DependencyList,
    ) => {
      if (hooks.direct) hooks.effects.push(effect);
      else actual.useLayoutEffect(effect, deps);
    },
  };
});
afterEach(() => {
  hooks.direct = false;
  hooks.index = 0;
  hooks.refs = [];
  hooks.state = undefined;
  hooks.effects = [];
  hooks.cleanups = [];
  vi.unstubAllGlobals();
});
interface Props {
  id?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  checked?: boolean;
  ref?: React.RefObject<unknown>;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onChange?: () => void;
}
function elements(
  node: React.ReactNode,
  kind: string,
): React.ReactElement<Props>[] {
  if (!React.isValidElement<Props>(node)) return [];
  return [
    ...(node.type === kind ? [node] : []),
    ...React.Children.toArray(node.props.children).flatMap((child) =>
      elements(child, kind),
    ),
  ];
}
function fixture() {
  const members = [
    eodSelection.listing,
    {
      ...eodSelection.listing,
      listingId: "other-listing",
      securityId: "other-security",
      shareClassId: "other-class",
      symbol: "OTHER",
      shareClassName: "Class B",
    },
  ];
  const price = vi
    .fn<ManagedApi["eodHistory"]>()
    .mockResolvedValue(eodResponse());
  const filings = vi
    .fn<ManagedApi["recentFilings"]>()
    .mockResolvedValue(filingsResponse(3, "available", eodSelection));
  const model = new ManagedFilingsReview(filings, vi.fn(), undefined, {
    coverage: createManagedResearchCoverageFixture([
      { listing: members[0]!, cik: "0000000001" },
    ]),
    daily: {
      readPrice: price,
      priceAccess: new ManagedEodAccess(price),
      priceCoverage: [members[0]!],
    },
  });
  const draft: MainWatchlistPayload = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: eodSelection.catalogSnapshotSha256,
    memberships: members.map((member) => ({
      ...member,
      note: "Exact authored Café 😀",
    })),
  };
  model.reconcile(draft, eodSelection.catalogSnapshotSha256, true, true);
  for (const member of model.getSnapshot().memberships)
    model.choose(model.getSnapshot(), member);
  model.startDaily(model.getSnapshot());
  const onViewDaily =
    vi.fn<NonNullable<ManagedWatchlistDailyReviewProps["onViewDaily"]>>();
  const onReset = vi.fn();
  const body = {};
  const documentMock = { body, activeElement: body };
  vi.stubGlobal("document", documentMock);
  const focus = vi.fn();
  const target = { isConnected: true, getClientRects: () => [{}], focus };
  const opener = {} as HTMLButtonElement;
  const render = (commit = true, active = true) => {
    hooks.direct = true;
    hooks.index = 0;
    hooks.effects = [];
    const node = Daily({
      model,
      state: model.getSnapshot(),
      active,
      onViewDaily,
      onReset,
      dailyChecks: <p>Authored checks remain exact</p>,
    });
    hooks.direct = false;
    for (const heading of elements(node, "h4"))
      if (heading.props.ref) heading.props.ref.current = target;
    if (commit) {
      for (const cleanup of hooks.cleanups) cleanup();
      hooks.cleanups = [];
      for (const effect of hooks.effects) {
        const cleanup = effect();
        if (cleanup) hooks.cleanups.push(cleanup);
      }
    }
    return {
      node,
      button: (name: string) =>
        elements(node, "button").find(
          (button) => button.props.id === `watchlist-daily-${name}`,
        )!,
      inputs: elements(node, "input"),
    };
  };
  const click = (button: React.ReactElement<Props>) => {
    documentMock.activeElement = opener;
    button.props.onClick?.({
      currentTarget: opener,
    } as React.MouseEvent<HTMLButtonElement>);
  };
  const html = () =>
    renderToStaticMarkup(
      <Daily
        model={model}
        state={model.getSnapshot()}
        active
        onViewDaily={onViewDaily}
        onReset={onReset}
        dailyChecks={<p>Authored checks remain exact</p>}
      />,
    );
  return {
    model,
    price,
    filings,
    render,
    click,
    html,
    onViewDaily,
    focus,
    target,
    documentMock,
    opener,
  };
}
describe("Watchlist daily review UI", () => {
  it("requires explicit source choices and Preview before Run without making reads", () => {
    const f = fixture();
    let view = f.render();
    expect(view.inputs.map((i) => i.props.checked)).toEqual([false, false]);
    expect(view.button("preview").props.disabled).toBe(true);
    expect(view.button("run").props.disabled).toBe(true);
    view.inputs[0]!.props.onChange!();
    view = f.render();
    f.click(view.button("preview"));
    view = f.render();
    expect(view.button("run").props.disabled).toBe(false);
    expect(f.model.getSnapshot().daily!.outcomes.map((o) => o.status)).toEqual([
      "unattempted",
      "not-selected",
      "unsupported",
      "not-selected",
    ]);
    expect(f.price).not.toHaveBeenCalled();
    expect(f.filings).not.toHaveBeenCalled();
    expect(f.focus).toHaveBeenCalledOnce();
    view.inputs[1]!.props.onChange!();
    view = f.render();
    expect(view.button("run").props.disabled).toBe(true);
    f.click(view.button("run"));
    expect(f.price).not.toHaveBeenCalled();
  });
  it("renders all outcomes, full packets and source clocks then finishes as a passive complete reading", async () => {
    const f = fixture();
    const plan = f.model.prepareDaily(f.model.getSnapshot(), [
      "price",
      "filings",
    ])!;
    await f.model.runDaily(f.model.getSnapshot(), plan);
    const state = f.model.getSnapshot();
    expect(state.daily!.outcomes.map((o) => o.status)).toEqual([
      "loaded",
      "loaded",
      "unsupported",
      "unsupported",
    ]);
    f.model.finishDaily(state);
    const html = f.html();
    expect(html).toContain("All chosen daily review companies");
    expect(html).toContain("OTHER");
    expect(html).toContain("Complete retained price history");
    expect(html).toContain("Complete retained filing packet");
    expect(html).toContain(eodResponse().completedAt);
    expect(html).toContain(eodResponse().rows[0]!.close);
    for (const filing of filingsResponse(3, "available", eodSelection).issuer
      .filings)
      expect(html).toContain(filing.accessionNumber);
    expect(html.match(/Authored checks remain exact/g)).toHaveLength(1);
    for (const id of ["preview", "run", "inspect", "finish"])
      expect(html).not.toContain(`id="watchlist-daily-${id}"`);
    expect(html).toContain('id="watchlist-daily-reset"');
    expect(f.price).toHaveBeenCalledOnce();
    expect(f.filings).toHaveBeenCalledOnce();
  });
  it("admits only a fresh model capture to paired Research without source requests", () => {
    const f = fixture();
    const view = f.render();
    f.click(view.button("inspect"));
    expect(f.onViewDaily).toHaveBeenCalledOnce();
    const [capture, opener] = f.onViewDaily.mock.calls[0]!;
    expect(f.model.canAdmitDaily(capture)).toBe(true);
    expect(opener).toBe(f.opener);
    expect(f.price).not.toHaveBeenCalled();
    expect(f.filings).not.toHaveBeenCalled();
  });
  it("rejects pending-render and stale Inspect and Finish callbacks", () => {
    const f = fixture();
    const pending = f.render(false);
    f.click(pending.button("inspect"));
    f.click(pending.button("finish"));
    expect(f.onViewDaily).not.toHaveBeenCalled();
    expect(f.model.getSnapshot().daily!.phase).toBe("ready");
    const old = f.render();
    f.model.select(
      f.model.getSnapshot(),
      f.model.getSnapshot().memberships[1]!,
    );
    f.click(old.button("inspect"));
    f.click(old.button("finish"));
    expect(f.onViewDaily).not.toHaveBeenCalled();
    expect(f.model.getSnapshot().daily!.phase).toBe("ready");
  });
  it("focuses Finish only after its exact committed state mounts", () => {
    const f = fixture();
    f.click(f.render().button("finish"));
    expect(f.focus).not.toHaveBeenCalled();
    f.render();
    expect(f.focus).toHaveBeenCalledOnce();
  });
  it("does not focus after reentrant retirement or a disconnected target", () => {
    const f = fixture();
    const old = f.render();
    const unsubscribe = f.model.subscribe(() => {
      if (f.model.getSnapshot().daily?.phase === "finished")
        f.model.resetDaily(f.model.getSnapshot());
    });
    f.click(old.button("finish"));
    f.render();
    expect(f.focus).not.toHaveBeenCalled();
    unsubscribe();
    for (const member of f.model.getSnapshot().memberships)
      f.model.choose(f.model.getSnapshot(), member);
    f.model.startDaily(f.model.getSnapshot());
    f.click(f.render().button("finish"));
    f.target.isConnected = false;
    f.render();
    expect(f.focus).not.toHaveBeenCalled();
  });
  it("never moves focus for background source completion", async () => {
    const f = fixture();
    f.model.prepareDaily(f.model.getSnapshot(), ["price", "filings"]);
    const view = f.render();
    f.click(view.button("run"));
    await vi.waitFor(() =>
      expect(f.model.getSnapshot().daily!.phase).toBe("settled"),
    );
    f.render();
    expect(f.focus).not.toHaveBeenCalled();
  });
  it("retains distinct cancelled and unattempted outcomes and refuses hidden actions", async () => {
    const f = fixture();
    let resolve!: (value: ReturnType<typeof eodResponse>) => void;
    f.price.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const plan = f.model.prepareDaily(f.model.getSnapshot(), [
      "price",
      "filings",
    ])!;
    const running = f.model.runDaily(f.model.getSnapshot(), plan);
    const view = f.render();
    f.click(view.button("cancel"));
    resolve(eodResponse());
    await running;
    const html = f.html();
    expect(html).toContain("Cancelled");
    expect(html).toContain("Not attempted");
    expect(f.filings).not.toHaveBeenCalled();
    const inactive = f.render(true, false);
    f.click(inactive.button("inspect"));
    f.click(inactive.button("finish"));
    expect(f.onViewDaily).not.toHaveBeenCalled();
    expect(f.model.getSnapshot().daily!.phase).not.toBe("finished");
  });
});
