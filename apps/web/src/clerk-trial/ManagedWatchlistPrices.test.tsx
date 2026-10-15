import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseManagedEodHistoryResponse,
  type ManagedEodCloseDto,
} from "@research-cockpit/contracts";
import {
  ManagedWatchlistPrices,
  ManagedWatchlistPriceReadout,
  watchlistPriceRow,
} from "./ManagedWatchlistPrices";
import { ManagedEodHistory } from "./managed-eod-history";
import type {
  ManagedWatchlistPriceRow,
  ManagedWatchlistPricesState,
} from "./managed-watchlist-prices";
import { eodRequest, eodResponse, eodSelection } from "./eod-history-fixture";

const hooks = vi.hoisted(() => ({
  enabled: false,
  refs: [] as Array<{ current: unknown }>,
  index: 0,
  effect: undefined as undefined | (() => void),
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useRef: (initial: unknown) =>
      hooks.enabled
        ? (hooks.refs[hooks.index++] ??= { current: initial })
        : actual.useRef(initial),
    useLayoutEffect: (
      effect: () => void,
      dependencies: React.DependencyList,
    ) => {
      if (hooks.enabled) hooks.effect = effect;
      else actual.useLayoutEffect(effect, dependencies);
    },
  };
});
afterEach(() => {
  hooks.enabled = false;
  hooks.refs = [];
  hooks.index = 0;
  hooks.effect = undefined;
  vi.unstubAllGlobals();
});

const member = { ...eodSelection.listing, note: "Exact unsaved note" };
function row(rows: readonly ManagedEodCloseDto[] | null = eodResponse().rows) {
  const model = new ManagedEodHistory(vi.fn(), vi.fn(), undefined, [member]);
  const response =
    rows &&
    parseManagedEodHistoryResponse({ ...eodResponse(), rows }, eodRequest());
  if (rows && !response) throw new Error("Invalid invented price packet");
  model.open(
    { ...eodSelection, origin: "watchlist" },
    response ? { response, showingPrevious: false } : undefined,
  );
  return {
    handle: Symbol("row"),
    listing: member,
    history: model.getSnapshot(),
  } satisfies ManagedWatchlistPriceRow;
}
function state(
  rows: readonly ManagedWatchlistPriceRow[],
): ManagedWatchlistPricesState {
  return {
    active: true,
    canRead: true,
    rows,
    pending: null,
    catalogChanged: false,
  };
}
function markup(prices: ManagedWatchlistPricesState, identityReady = true) {
  return renderToStaticMarkup(
    <ManagedWatchlistPrices
      selected={member}
      state={prices}
      active
      identityReady={identityReady}
      onLoad={vi.fn()}
    />,
  );
}
function text(html: string) {
  return html.replace(/<[^>]*>/gu, "").replace(/\s+/gu, " ");
}

describe("watchlist price presentation", () => {
  it("shows exact dated last-two changes and original source coordinates without a chart", () => {
    const html = markup(state([row()]));
    expect(text(html)).toContain(
      "$101.5USD raw close · 2026-09-19Raw close change: +$1.25 (+1.2469%)",
    );
    expect(text(html)).toContain("2026-09-18 to 2026-09-19");
    expect(text(html)).toContain("not adjusted for splits or dividends");
    expect(text(html)).toContain("2026-08-20 to 2026-09-20");
    expect(html).toContain("2026-09-20T00:00:00.000Z");
    expect(html).toContain("2026-09-20T00:00:01.000Z");
    expect(text(html)).toContain("Refresh ZERO price");
    expect(html).not.toMatch(/<canvas|<svg|<table/u);
  });

  it.each([
    [
      "100",
      "100.000000000000000001",
      "+$0.000000000000000001 (less than 0.0001% higher)",
    ],
    [
      "100.000000000000000001",
      "100",
      "-$0.000000000000000001 (less than 0.0001% lower)",
    ],
    ["100", "100", "$0 (0.0000%)"],
  ])("keeps exact change from %s to %s", (first, last, expected) => {
    const prices = row([
      { date: "2026-09-18", close: first },
      { date: "2026-09-19", close: last },
    ]);
    expect(text(markup(state([prices])))).toContain(expected);
    expect(text(markup(state([prices])))).toContain(`$${last}USD raw close`);
  });

  it("distinguishes one observation, unloaded, retained failure and unsupported identity", () => {
    const one = row([{ date: "2026-09-19", close: "1.23" }]);
    expect(text(markup(state([one])))).toContain(
      "$1.23USD raw close · 2026-09-19",
    );
    expect(text(markup(state([one])))).toContain(
      "Raw close change unavailable: two dated closes needed.",
    );
    const unloaded = text(markup(state([row(null)])));
    expect(unloaded).toContain("Price not loaded");
    expect(unloaded).toContain("Load ZERO price");
    const retained = {
      ...one,
      history: {
        ...one.history,
        showingPrevious: true,
        error: true,
        message: "The close history refresh failed. Try again when ready.",
      },
    };
    const html = markup(state([retained]));
    expect(html).toContain('role="alert"');
    expect(text(html)).toContain(
      "Showing previous history completed 2026-09-20T00:00:01.000Z",
    );
    expect(html).toContain("1.23");
    for (const ready of [true, false]) {
      const unavailable = markup(state([]), ready);
      expect(unavailable).not.toContain("<button");
      expect(unavailable).not.toContain("Tiingo");
      expect(text(unavailable)).toContain(
        ready
          ? "No price request is made."
          : "confirmed in the current catalog",
      );
    }
  });

  it("matches every identity field while ignoring notes and does not nest an action in a readout", () => {
    const original = row();
    expect(
      watchlistPriceRow(state([original]), { ...member, note: "Changed note" }),
    ).toBe(original);
    for (const field of [
      "listingId",
      "issuerId",
      "issuerName",
      "securityId",
      "securityName",
      "shareClassId",
      "shareClassName",
      "symbol",
      "exchangeMic",
      "country",
    ] as const)
      expect(
        watchlistPriceRow(state([original]), { ...member, [field]: "OTHER" }),
      ).toBeUndefined();
    expect(
      watchlistPriceRow(state([original]), {
        ...member,
        instrumentType: "adr",
      }),
    ).toBeUndefined();
    const html = renderToStaticMarkup(
      <ManagedWatchlistPriceReadout row={original} id="quote" />,
    );
    expect(html).not.toContain("<button");
    expect(html).not.toContain("role=");
  });

  it("keeps pending identity and Cancel visible when a different unsupported listing is selected", () => {
    const pending = {
      listing: { ...member, symbol: "OTHER", shareClassName: "Class C" },
      cancel: vi.fn(),
    };
    const html = markup({ ...state([]), pending });
    expect(text(html)).toContain("Loading OTHER price · Class C · XNAS");
    expect(text(html)).toContain("Cancel OTHER price");
    expect(text(html)).not.toContain("Load ZERO price");
    expect(pending.cancel).not.toHaveBeenCalled();
  });
});

interface ButtonProps {
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: (event: { currentTarget: HTMLButtonElement }) => void;
}
function buttons(node: React.ReactNode): React.ReactElement<ButtonProps>[] {
  if (!React.isValidElement<ButtonProps>(node)) return [];
  return [
    ...(node.type === "button" ? [node] : []),
    ...React.Children.toArray(node.props.children).flatMap(buttons),
  ];
}
function focusFixture() {
  hooks.enabled = true;
  const priceRow = row(null);
  let prices = state([priceRow]);
  const onLoad = vi.fn();
  let props = {
    selected: member,
    state: prices,
    active: true,
    identityReady: true,
    onLoad,
  };
  const load = {
    isConnected: true,
    disabled: false,
    getClientRects: () => [{}],
    focus: vi.fn(),
  };
  const cancel = {} as HTMLButtonElement;
  const documentState = { activeElement: load as unknown, body: {} };
  vi.stubGlobal("document", documentState);
  let output: ReturnType<typeof buttons> = [];
  const render = (changes: Partial<typeof props> = {}) => {
    props = { ...props, ...changes };
    hooks.index = 0;
    output = buttons(ManagedWatchlistPrices(props));
    load.disabled = Boolean(output[0]?.props.disabled);
    hooks.effect?.();
    return output;
  };
  render();
  const clickLoad = () =>
    output[0]!.props.onClick!({
      currentTarget: load as unknown as HTMLButtonElement,
    });
  const start = () => {
    clickLoad();
    const pending = { listing: member, cancel: vi.fn() };
    prices = { ...prices, pending };
    render({ state: prices });
    documentState.activeElement = cancel;
    return { pending, cancelAction: output[1]!.props.onClick! };
  };
  const finish = (changes: Partial<typeof props> = {}) => {
    load.disabled = false;
    render({ state: { ...prices, pending: null }, ...changes });
  };
  return {
    priceRow,
    props,
    render,
    start,
    finish,
    clickLoad,
    onLoad,
    load,
    cancel,
    documentState,
  };
}

describe("watchlist price explicit actions and focus", () => {
  it("loads only through the exact row handle, then restores Cancel focus once", () => {
    const f = focusFixture();
    expect(f.onLoad).not.toHaveBeenCalled();
    const { pending, cancelAction } = f.start();
    expect(f.onLoad).toHaveBeenCalledExactlyOnceWith(f.priceRow.handle);
    cancelAction({ currentTarget: f.cancel });
    expect(pending.cancel).toHaveBeenCalledOnce();
    f.finish();
    expect(f.load.focus).toHaveBeenCalledOnce();
    f.finish();
    expect(f.load.focus).toHaveBeenCalledOnce();
  });

  it.each(["blocked", "inactive", "catalog", "pending"])(
    "does not dispatch a load while %s",
    (reason) => {
      const f = focusFixture();
      const prices = {
        ...f.props.state,
        canRead: reason !== "blocked",
        active: reason !== "inactive",
        catalogChanged: reason === "catalog",
        pending:
          reason === "pending" ? { listing: member, cancel: vi.fn() } : null,
      };
      const output = f.render({ state: prices });
      expect(output[0]!.props.disabled).toBe(true);
      f.clickLoad();
      expect(f.onLoad).not.toHaveBeenCalled();
    },
  );

  it.each([
    "different selection",
    "replacement handle",
    "hidden origin",
    "disconnected origin",
    "inactive editor",
    "user focus",
  ])("does not restore after Cancel with %s", (reason) => {
    const f = focusFixture();
    const { cancelAction } = f.start();
    cancelAction({ currentTarget: f.cancel });
    if (reason === "hidden origin") f.load.getClientRects = () => [];
    if (reason === "disconnected origin") f.load.isConnected = false;
    if (reason === "user focus") f.documentState.activeElement = {};
    f.finish({
      active: reason !== "inactive editor",
      selected:
        reason === "different selection"
          ? { ...member, listingId: "other" }
          : member,
      state: state([
        {
          ...f.priceRow,
          handle:
            reason === "replacement handle"
              ? Symbol("replacement")
              : f.priceRow.handle,
        },
      ]),
    });
    expect(f.load.focus).not.toHaveBeenCalled();
  });

  it("does not steal focus on ordinary completion or a stale Cancel closure", () => {
    const f = focusFixture();
    const { pending, cancelAction } = f.start();
    f.finish();
    expect(f.load.focus).not.toHaveBeenCalled();
    cancelAction({ currentTarget: f.cancel });
    expect(pending.cancel).not.toHaveBeenCalled();
    f.finish();
    expect(f.load.focus).not.toHaveBeenCalled();
  });
});
