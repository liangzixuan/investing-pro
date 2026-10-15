import { renderToStaticMarkup } from "react-dom/server";
import { parseManagedEodHistoryResponse } from "@research-cockpit/contracts";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedEodHistory as Panel } from "./ManagedEodHistory";
import { CloseHistoryChart } from "../features/research/CloseHistoryChart";
import { ManagedPriceNoteAction } from "./ManagedPriceNoteAction";
import { ManagedEodHistory } from "./managed-eod-history";
import {
  ManagedCatalogChangedError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";
import { eodRequest, eodResponse, eodSelection } from "./eod-history-fixture";

const focusHooks = vi.hoisted(() => ({
  enabled: false,
  refs: [] as Array<{ current: unknown }>,
  index: 0,
  layout: undefined as undefined | (() => void),
  effect: undefined as undefined | (() => void),
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useRef: (value: unknown) => {
      if (!focusHooks.enabled) return actual.useRef(value);
      const index = focusHooks.index++;
      return (focusHooks.refs[index] ??= { current: value });
    },
    useEffect: (effect: () => void, dependencies: React.DependencyList) => {
      if (focusHooks.enabled) focusHooks.effect = effect;
      else actual.useEffect(effect, dependencies);
    },
    useLayoutEffect: (
      effect: () => void,
      dependencies: React.DependencyList,
    ) => {
      if (focusHooks.enabled) focusHooks.layout = effect;
      else actual.useLayoutEffect(effect, dependencies);
    },
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      getSnapshot: () => unknown,
      getServerSnapshot: () => unknown,
    ) =>
      focusHooks.enabled
        ? getSnapshot()
        : actual.useSyncExternalStore(
            subscribe,
            getSnapshot,
            getServerSnapshot,
          ),
  };
});
afterEach(() => {
  focusHooks.enabled = false;
  focusHooks.refs = [];
  focusHooks.index = 0;
  focusHooks.layout = undefined;
  focusHooks.effect = undefined;
  vi.unstubAllGlobals();
});
interface ButtonProps {
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: (event: { currentTarget: unknown }) => void;
}
function buttons(node: React.ReactNode): React.ReactElement<ButtonProps>[] {
  if (!React.isValidElement<ButtonProps>(node)) return [];
  return [
    ...(node.type === "button" ? [node] : []),
    ...React.Children.toArray(node.props.children).flatMap(buttons),
  ];
}

describe("managed close history panel", () => {
  it("keeps the focusable heading and plain unavailable explanation without price controls or claims", async () => {
    const read = vi.fn<ManagedApi["eodHistory"]>();
    const model = new ManagedEodHistory(read, vi.fn(), undefined, []);
    const noteActions = { getAction: vi.fn(), append: vi.fn() };
    model.open(
      { ...eodSelection, origin: "markets" },
      { response: eodResponse(), showingPrevious: true },
    );
    const output = renderToStaticMarkup(
      <Panel model={model} noteActions={noteActions} />,
    );
    expect(output).toContain('id="managed-eod-heading" tabindex="-1"');
    expect(output).toContain("EOD close history");
    expect(output).toContain(
      "Price history is not available for this listing in this workspace.",
    );
    for (const omitted of [
      "<button",
      "<table",
      "Tiingo",
      "Load",
      "Refresh",
      "Source and request dates",
      "managed-eod-previous",
      "managed-eod-origin",
    ])
      expect(output).not.toContain(omitted);
    expect(noteActions.getAction).not.toHaveBeenCalled();
    expect(noteActions.append).not.toHaveBeenCalled();
    await model.load();
    expect(read).not.toHaveBeenCalled();
    focusHooks.enabled = true;
    Panel({ model });
    const focus = vi.fn();
    focusHooks.refs[0]!.current = { focus };
    focusHooks.effect!();
    expect(focus).toHaveBeenCalledOnce();
  });
  it.each([
    ["markets", false],
    ["markets", true],
    ["watchlist", false],
    ["watchlist", true],
  ] as const)(
    "shows %s provenance and original dates until company refresh (previous: %s)",
    async (origin, showingPrevious) => {
      const response = eodResponse();
      const read = vi
        .fn<ManagedApi["eodHistory"]>()
        .mockResolvedValue(response);
      const model = new ManagedEodHistory(read, vi.fn(), undefined, [
        eodSelection.listing,
      ]);
      model.open(
        { ...eodSelection, origin, cik: null },
        {
          response,
          showingPrevious,
        },
      );
      const html = () => renderToStaticMarkup(<Panel model={model} />);
      const carried = html();
      expect(carried).toContain('class="managed-eod-origin"');
      expect(carried).toContain(
        `Showing history loaded in ${origin === "watchlist" ? "My Watchlist" : "Markets"}. Original dates and request times are unchanged.`,
      );
      expect(carried.includes('class="managed-eod-previous"')).toBe(
        showingPrevious,
      );
      expect(carried).toContain("2026-08-20 to 2026-09-20");
      expect(carried).toContain("2026-09-20T00:00:00.000Z");
      expect(carried).toContain("2026-09-20T00:00:01.000Z");
      expect(carried).toMatch(/<td(?:\s[^>]*)?>100\.25<\/td>/u);
      expect(carried).toMatch(/<td(?:\s[^>]*)?>101\.5<\/td>/u);
      expect(carried).toContain("Refresh close history");
      expect(read).not.toHaveBeenCalled();
      await model.load();
      const refreshed = html();
      expect(model.getSnapshot().selection?.origin).toBe(origin);
      expect(refreshed).not.toContain('class="managed-eod-origin"');
      expect(refreshed).not.toContain('class="managed-eod-previous"');
      expect(refreshed).toMatch(/<td(?:\s[^>]*)?>100\.25<\/td>/u);
      expect(refreshed).toMatch(/<td(?:\s[^>]*)?>101\.5<\/td>/u);
      expect(read).toHaveBeenCalledOnce();
    },
  );

  it("keeps a rejected seed unloaded without a Markets provenance claim", () => {
    const read = vi.fn<ManagedApi["eodHistory"]>();
    const model = new ManagedEodHistory(read, vi.fn(), undefined, [
      eodSelection.listing,
    ]);
    model.open(
      { ...eodSelection, origin: "markets" },
      {
        response: {
          ...eodResponse(),
          catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
        },
        showingPrevious: true,
      },
    );
    const output = renderToStaticMarkup(<Panel model={model} />);
    expect(output).toContain("The loaded Markets history could not be reused.");
    expect(output).toContain("Load one-month close history");
    expect(output).not.toContain('class="managed-eod-origin"');
    expect(output).not.toContain('class="managed-eod-previous"');
    expect(output).not.toContain("<table>");
    expect(read).not.toHaveBeenCalled();
  });

  it("focuses the heading on initial mount and loaded return without an implicit read", async () => {
    focusHooks.enabled = true;
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockResolvedValue(eodResponse());
    const model = new ManagedEodHistory(read, vi.fn(), undefined, [
      eodSelection.listing,
    ]);
    const render = () => {
      focusHooks.index = 0;
      return buttons(Panel({ model }));
    };
    model.open(eodSelection);
    expect(render()[0]!.props.children).toBe("Load one-month close history");
    const initialFocus = vi.fn();
    focusHooks.refs[0]!.current = { focus: initialFocus };
    focusHooks.effect?.();
    expect(initialFocus).toHaveBeenCalledOnce();
    expect(read).not.toHaveBeenCalled();
    await model.load();
    const retained = model.getSnapshot().response;
    focusHooks.refs = [];
    expect(render()[0]!.props.children).toBe("Refresh close history");
    const returnFocus = vi.fn();
    focusHooks.refs[0]!.current = { focus: returnFocus };
    focusHooks.effect?.();
    expect(returnFocus).toHaveBeenCalledOnce();
    expect(model.getSnapshot().response).toBe(retained);
    expect(read).toHaveBeenCalledOnce();
  });
  it("disables loading after the selected catalog changes", async () => {
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockRejectedValue(new ManagedCatalogChangedError());
    const model = new ManagedEodHistory(read, vi.fn(), undefined, [
      eodSelection.listing,
    ]);
    model.open(eodSelection);
    await model.load();
    const html = renderToStaticMarkup(<Panel model={model} />);
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Load one-month close history<\/button>/u,
    );
    expect(html).toContain("Refresh the catalog");
    expect(read).toHaveBeenCalledOnce();
  });
  it.each([
    { focused: true, loaded: false },
    { focused: false, loaded: false },
    { focused: true, loaded: true },
    { focused: false, loaded: true },
  ])(
    "restores Cancel focus after commit (focused: $focused, previous history: $loaded)",
    async ({ focused, loaded }) => {
      focusHooks.enabled = true;
      let settle!: (value: ReturnType<typeof eodResponse>) => void;
      const read = vi.fn<ManagedApi["eodHistory"]>().mockImplementation(
        () =>
          new Promise((resolve) => {
            settle = resolve;
          }),
      );
      if (loaded) read.mockResolvedValueOnce(eodResponse());
      const model = new ManagedEodHistory(read, vi.fn(), undefined, [
        eodSelection.listing,
      ]);
      model.open(eodSelection);
      if (loaded) await model.load();
      const pending = model.load();
      const render = () => {
        focusHooks.index = 0;
        return Panel({ model });
      };
      const initial = buttons(render());
      expect(
        initial.find(
          (button) =>
            button.props.children ===
            (loaded ? "Refreshing close history…" : "Loading close history…"),
        )?.props.disabled,
      ).toBe(true);
      const cancel = initial.find(
        (button) => button.props.children === "Cancel close history",
      )!;
      const target = {};
      const focus = vi.fn();
      focusHooks.refs[1]!.current = { focus };
      vi.stubGlobal("document", { activeElement: focused ? target : {} });
      cancel.props.onClick!({ currentTarget: target });
      expect(model.getSnapshot().running).toBe(false);
      expect(focus).not.toHaveBeenCalled();
      focusHooks.layout?.();
      expect(focus).not.toHaveBeenCalled();
      const committed = buttons(render());
      expect(
        committed.find(
          (button) =>
            button.props.children ===
            (loaded ? "Refresh close history" : "Load one-month close history"),
        )?.props.disabled,
      ).toBe(false);
      focusHooks.layout?.();
      expect(focus).toHaveBeenCalledTimes(focused ? 1 : 0);
      focusHooks.layout?.();
      expect(focus).toHaveBeenCalledTimes(focused ? 1 : 0);
      settle(eodResponse());
      await pending;
      expect(model.getSnapshot().response).toEqual(
        loaded ? eodResponse() : null,
      );
    },
  );
  it("labels raw USD closes, exact dates and completion without a live or adjusted claim", async () => {
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockResolvedValue(eodResponse());
    const model = new ManagedEodHistory(read, vi.fn(), undefined, [
      eodSelection.listing,
    ]);
    const html = () => renderToStaticMarkup(<Panel model={model} />);
    expect(html()).toBe("");
    model.open(eodSelection);
    expect(html()).toContain("Load one-month close history");
    expect(html()).not.toContain("<table>");
    expect(read).not.toHaveBeenCalled();
    await model.load();
    const output = html();
    for (const text of [
      "EOD close history",
      "company visit",
      "Tiingo",
      "not adjusted",
      "not live quotes",
      "Last raw close (USD)",
      "Last trading date",
      "2026-09-19",
      "101.5",
      "Source request completed",
      "2026-09-20T00:00:01.000Z",
      "Raw closing prices in USD",
      "Refresh close history",
    ])
      expect(output).toContain(text);
    expect(output).toMatch(/<td(?:\s[^>]*)?>100\.25<\/td>/u);
    expect(output).toMatch(/<td(?:\s[^>]*)?>101\.5<\/td>/u);
    const metadata = Array.from(
      output.matchAll(
        /<dl class="managed-metadata(?: managed-eod-quote)?">(.*?)<\/dl>/gu,
      ),
      (match) => match[1]!,
    );
    expect(metadata).toEqual([
      "<dt>Last raw close (USD)</dt><dd>101.5</dd><dt>Last trading date</dt><dd>2026-09-19</dd>",
      "<dt>Requested window</dt><dd>2026-08-20 to 2026-09-20</dd><dt>Request started</dt><dd>2026-09-20T00:00:00.000Z</dd><dt>Source request completed</dt><dd>2026-09-20T00:00:01.000Z</dd>",
    ]);
    expect(output).toContain(
      '<details class="managed-eod-source"><summary>Source and request dates</summary>',
    );
    expect(
      output.indexOf('class="managed-metadata managed-eod-quote"'),
    ).toBeLessThan(output.indexOf('class="managed-eod-chart"'));
    expect(output.indexOf('class="managed-eod-chart"')).toBeLessThan(
      output.indexOf('class="managed-eod-source"'),
    );
    expect(
      output.slice(output.indexOf('class="managed-eod-source"')),
    ).toContain(
      "Data provided by Tiingo. Completion time records this request, not a live market update.",
    );
    expect(output).not.toContain("Volume");
    model.close();
    expect(html()).toBe("");
  });
  it.each([
    {
      error: new ManagedEodHistoryError("unavailable"),
      message: "The close history refresh failed. Try again when ready.",
    },
    {
      error: new ManagedEodHistoryError("source_rate_limited"),
      message:
        "Tiingo is limiting requests. Try again later; no reset time was provided.",
    },
  ])(
    "keeps the dated table through pending, $error, Cancel and explicit recovery",
    async ({ error, message }) => {
      const previous = eodResponse();
      const read = vi
        .fn<ManagedApi["eodHistory"]>()
        .mockResolvedValueOnce(previous)
        .mockRejectedValueOnce(error);
      const model = new ManagedEodHistory(read, vi.fn(), undefined, [
        eodSelection.listing,
      ]);
      const html = () => renderToStaticMarkup(<Panel model={model} />);
      const expectPrevious = () => {
        const output = html();
        expect(output).toContain('class="managed-eod-previous"');
        expect(output).toContain(
          "Showing previous close history, completed 2026-09-20T00:00:01.000Z.",
        );
        expect(output).toContain(
          "This refresh has not confirmed newer prices.",
        );
        expect(output).toContain(
          "Trading dates, requested window and request times are unchanged.",
        );
        expect(output).toContain("2026-08-20 to 2026-09-20");
        expect(output).toContain("2026-09-20T00:00:00.000Z");
        expect(output).toMatch(/<td(?:\s[^>]*)?>100\.25<\/td>/u);
        expect(output).toMatch(/<td(?:\s[^>]*)?>101\.5<\/td>/u);
        expect(model.getSnapshot().response).toBe(previous);
        return output;
      };
      model.open(eodSelection);
      await model.load();
      expect(html()).not.toContain('class="managed-eod-previous"');
      const pending = model.load();
      const refreshing = expectPrevious();
      expect(refreshing).toContain('aria-busy="true"');
      expect(refreshing).toContain("Refreshing close history…");
      expect(refreshing).toContain("Refreshing close history for ZERO…");
      await pending;
      const failed = expectPrevious();
      expect(failed).toContain('role="alert"');
      expect(failed).toContain(message);
      expect(failed).toContain("Refresh close history");
      let settle!: (value: ReturnType<typeof eodResponse>) => void;
      read.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            settle = resolve;
          }),
      );
      const next = model.load();
      model.cancel();
      settle({
        ...eodResponse(),
        rows: [{ date: "2026-09-19", close: "999.75" }],
      });
      await next;
      const cancelled = expectPrevious();
      expect(cancelled).toContain(
        "Close history refresh cancelled. Try again when ready.",
      );
      expect(cancelled).not.toContain("999.75");
      expect(cancelled).not.toContain('role="alert"');
      const recovered = parseManagedEodHistoryResponse(
        {
          ...previous,
          window: { startDate: "2026-08-21", endDate: "2026-09-21" },
          requestStartedAt: "2026-09-21T00:00:00.000Z",
          completedAt: "2026-09-21T00:00:01.000Z",
          rows: [{ date: "2026-09-20", close: "102.75" }],
        },
        eodRequest(),
      );
      if (!recovered) throw new Error("Invalid invented recovery response");
      read.mockResolvedValueOnce(recovered);
      await model.load();
      const refreshed = html();
      expect(refreshed).not.toContain('class="managed-eod-previous"');
      expect(refreshed).not.toMatch(/<td(?:\s[^>]*)?>100\.25<\/td>/u);
      expect(refreshed).not.toContain("2026-09-20T00:00:01.000Z");
      expect(refreshed).toContain("2026-08-21 to 2026-09-21");
      expect(refreshed).toContain("2026-09-21T00:00:01.000Z");
      expect(refreshed).toMatch(/<td(?:\s[^>]*)?>102\.75<\/td>/u);
      expect(refreshed).not.toContain('role="alert"');
      expect(read).toHaveBeenCalledTimes(4);
    },
  );
  it("keeps first-load failure empty without a previous-history notice", async () => {
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockRejectedValue(new ManagedEodHistoryError("unavailable"));
    const model = new ManagedEodHistory(read, vi.fn(), undefined, [
      eodSelection.listing,
    ]);
    model.open(eodSelection);
    await model.load();
    const output = renderToStaticMarkup(<Panel model={model} />);
    expect(output).toContain(
      "Close history could not be loaded. Try again when ready.",
    );
    expect(output).toContain("Load one-month close history");
    expect(output).not.toContain('class="managed-eod-previous"');
    expect(output).not.toContain("<table>");
    expect(output).not.toContain("Source request completed");
  });
});

it("offers the company action with the displayed response, both exact endpoints and current-selection guard", async () => {
  focusHooks.enabled = true;
  const response = eodResponse();
  const read = vi.fn<ManagedApi["eodHistory"]>().mockResolvedValue(response);
  const model = new ManagedEodHistory(read, vi.fn(), undefined, [
    eodSelection.listing,
  ]);
  model.open(eodSelection);
  await model.load();
  const noteActions = {
    getAction: vi.fn(() => ({ canAppend: true, reason: null })),
    append: vi.fn(() => ({ appended: true, message: "Draft changed" })),
  };
  function all(
    node: React.ReactNode,
  ): React.ReactElement<{ children?: React.ReactNode }>[] {
    if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
    return [node, ...React.Children.toArray(node.props.children).flatMap(all)];
  }
  const chart = all(Panel({ model, noteActions })).find(
    (node) => node.type === CloseHistoryChart,
  ) as React.ReactElement<React.ComponentProps<typeof CloseHistoryChart>>;
  const isCurrent = () => true;
  const action = chart.props.renderAction!(
    response.rows[0]!,
    response.rows.at(-1)!,
    isCurrent,
  ) as React.ReactElement<React.ComponentProps<typeof ManagedPriceNoteAction>>;
  expect(action.type).toBe(ManagedPriceNoteAction);
  expect(action.props.isCurrent).toBe(isCurrent);
  expect(noteActions.getAction).toHaveBeenCalledWith(
    response,
    response.rows[0],
    response.rows.at(-1),
  );
  expect(noteActions.append).not.toHaveBeenCalled();
  expect(action.props.onAppend()).toEqual({
    appended: true,
    message: "Draft changed",
  });
  expect(noteActions.append).toHaveBeenCalledWith(
    response,
    response.rows[0],
    response.rows.at(-1),
  );
  expect(action.key).toBe(
    `${response.rows[0]!.date}:${response.rows.at(-1)!.date}`,
  );
  expect(read).toHaveBeenCalledOnce();
  focusHooks.index = 0;
  const plain = all(Panel({ model })).find(
    (node) => node.type === CloseHistoryChart,
  ) as React.ReactElement<React.ComponentProps<typeof CloseHistoryChart>>;
  expect(plain.props.renderAction).toBeUndefined();
});

describe("company Price range presentation", () => {
  it("keeps a retained packet labelled by its own range while staging, loading and cancelling another range", async () => {
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockResolvedValueOnce(eodResponse());
    const model = new ManagedEodHistory(read, vi.fn(), undefined, [
      eodSelection.listing,
    ]);
    model.open(eodSelection);
    await model.load();
    model.selectRange("1y");
    const html = () => renderToStaticMarkup(<Panel model={model} />);
    expect(html()).toContain('for="managed-eod-range"');
    expect(html()).toContain(
      '<option value="1y" selected="">One year</option>',
    );
    expect(html()).toContain("Load one-year close history");
    expect(html()).toContain("Loaded request range: One month.");
    expect(html()).toContain("2 reported closes from 2026-09-18 to 2026-09-19");
    expect(read).toHaveBeenCalledOnce();
    let resolve!: (value: ReturnType<typeof eodResponse>) => void;
    read.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const pending = model.load();
    expect(html()).toContain('<select id="managed-eod-range" disabled="">');
    expect(html()).toContain("Loaded request range: One month.");
    model.cancel();
    resolve(eodResponse("1y"));
    await pending;
    expect(html()).toContain("Loaded request range: One month.");
    expect(html()).toContain("2026-08-20 to 2026-09-20");
    read.mockResolvedValueOnce(eodResponse("1y"));
    await model.load();
    const year = html();
    expect(year).toContain("Loaded request range: One year.");
    expect(year).toContain("3 reported closes from 2025-09-22 to 2026-09-19");
    expect(year).toContain("2025-09-20 to 2026-09-20");
    expect(year).not.toContain("one-month raw close history");
    expect(year).not.toContain("One-month raw closing prices");
    expect(year).toContain("Raw closing prices in USD");
    expect(read).toHaveBeenCalledTimes(3);
  });
});
