import { renderToStaticMarkup } from "react-dom/server";
import { parseManagedEodHistoryResponse } from "@research-cockpit/contracts";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedEodHistory as Panel } from "./ManagedEodHistory";
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
  it("focuses the heading on initial mount and loaded return without an implicit read", async () => {
    focusHooks.enabled = true;
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockResolvedValue(eodResponse());
    const model = new ManagedEodHistory(read, vi.fn());
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
    const model = new ManagedEodHistory(read, vi.fn());
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
      const model = new ManagedEodHistory(read, vi.fn());
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
    const model = new ManagedEodHistory(read, vi.fn());
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
      "One-month raw closing prices in USD",
      "Refresh close history",
    ])
      expect(output).toContain(text);
    expect(output).toContain("<td>100.25</td>");
    expect(output).toContain("<td>101.5</td>");
    expect(output).not.toContain("Volume");
    model.close();
    expect(html()).toBe("");
  });
  it.each([
    {
      error: new ManagedEodHistoryError("unavailable"),
      message: "The close history refresh failed. Select Refresh to try again.",
    },
    {
      error: new ManagedEodHistoryError("source_rate_limited"),
      message:
        "Tiingo is limiting requests. Try refreshing again later; no reset time was provided.",
    },
  ])(
    "keeps the dated table through pending, $error, Cancel and explicit recovery",
    async ({ error, message }) => {
      const previous = eodResponse();
      const read = vi
        .fn<ManagedApi["eodHistory"]>()
        .mockResolvedValueOnce(previous)
        .mockRejectedValueOnce(error);
      const model = new ManagedEodHistory(read, vi.fn());
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
        expect(output).toContain("<td>100.25</td>");
        expect(output).toContain("<td>101.5</td>");
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
        "Close history refresh cancelled. Refresh again when ready.",
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
      expect(refreshed).not.toContain("<td>100.25</td>");
      expect(refreshed).not.toContain("2026-09-20T00:00:01.000Z");
      expect(refreshed).toContain("2026-08-21 to 2026-09-21");
      expect(refreshed).toContain("2026-09-21T00:00:01.000Z");
      expect(refreshed).toContain("<td>102.75</td>");
      expect(refreshed).not.toContain('role="alert"');
      expect(read).toHaveBeenCalledTimes(4);
    },
  );
  it("keeps first-load failure empty without a previous-history notice", async () => {
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockRejectedValue(new ManagedEodHistoryError("unavailable"));
    const model = new ManagedEodHistory(read, vi.fn());
    model.open(eodSelection);
    await model.load();
    const output = renderToStaticMarkup(<Panel model={model} />);
    expect(output).toContain(
      "Close history could not be loaded. Select Load to try again.",
    );
    expect(output).toContain("Load one-month close history");
    expect(output).not.toContain('class="managed-eod-previous"');
    expect(output).not.toContain("<table>");
    expect(output).not.toContain("Source request completed");
  });
});
