import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedEodHistory as Panel } from "./ManagedEodHistory";
import { ManagedEodHistory } from "./managed-eod-history";
import {
  ManagedCatalogChangedError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";
import { eodResponse, eodSelection } from "./eod-history-fixture";

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
  it("focuses the selected heading and exposes Annual switching without loading, including during a read", async () => {
    focusHooks.enabled = true;
    let settle!: (value: ReturnType<typeof eodResponse>) => void;
    const read = vi.fn<ManagedApi["eodHistory"]>().mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    const model = new ManagedEodHistory(read, vi.fn());
    const onAnnualReport = vi.fn();
    const onBack = vi.fn();
    const render = () => {
      focusHooks.index = 0;
      return buttons(Panel({ model, onBack, onAnnualReport }));
    };
    model.open(eodSelection);
    const controls = render();
    const focus = vi.fn();
    focusHooks.refs[0]!.current = { focus };
    focusHooks.effect?.();
    expect(focus).toHaveBeenCalledOnce();
    const switchButton = controls.find(
      (button) => button.props.children === "Annual report",
    )!;
    expect(switchButton.props.disabled).toBe(false);
    switchButton.props.onClick!({ currentTarget: {} });
    expect(onAnnualReport).toHaveBeenCalledOnce();
    expect(onBack).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    const pending = model.load();
    const pendingSwitch = render().find(
      (button) => button.props.children === "Annual report",
    )!;
    expect(pendingSwitch.props.disabled).toBe(false);
    pendingSwitch.props.onClick!({ currentTarget: {} });
    expect(onAnnualReport).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenCalledOnce();
    model.close();
    settle(eodResponse());
    await pending;
  });
  it("disables the Annual switch after the selected catalog changes", async () => {
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockRejectedValue(new ManagedCatalogChangedError());
    const model = new ManagedEodHistory(read, vi.fn());
    model.open(eodSelection);
    await model.load();
    const html = renderToStaticMarkup(
      <Panel model={model} onBack={vi.fn()} onAnnualReport={vi.fn()} />,
    );
    expect(html).toMatch(
      /<button[^>]*aria-label="Annual report for ZERO"[^>]*disabled=""[^>]*>Annual report<\/button>/u,
    );
    expect(html).toContain("Refresh the catalog");
    expect(read).toHaveBeenCalledOnce();
  });
  it.each([true, false])(
    "restores focused Cancel only after Load is enabled at commit (Cancel focused: %s)",
    async (focused) => {
      focusHooks.enabled = true;
      let settle!: (value: ReturnType<typeof eodResponse>) => void;
      const read = vi.fn<ManagedApi["eodHistory"]>().mockImplementation(
        () =>
          new Promise((resolve) => {
            settle = resolve;
          }),
      );
      const model = new ManagedEodHistory(read, vi.fn());
      model.open(eodSelection);
      const pending = model.load();
      const render = () => {
        focusHooks.index = 0;
        return Panel({ model, onBack: vi.fn(), onAnnualReport: vi.fn() });
      };
      const initial = buttons(render());
      expect(
        initial.find(
          (button) => button.props.children === "Loading close history…",
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
          (button) => button.props.children === "Load one-month close history",
        )?.props.disabled,
      ).toBe(false);
      focusHooks.layout?.();
      expect(focus).toHaveBeenCalledTimes(focused ? 1 : 0);
      focusHooks.layout?.();
      expect(focus).toHaveBeenCalledTimes(focused ? 1 : 0);
      settle(eodResponse());
      await pending;
      expect(model.getSnapshot().response).toBeNull();
    },
  );
  it("labels raw USD closes, exact dates and completion without a live or adjusted claim", async () => {
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockResolvedValue(eodResponse());
    const model = new ManagedEodHistory(read, vi.fn());
    const html = () =>
      renderToStaticMarkup(
        <Panel
          model={model}
          onBack={() => model.close()}
          onAnnualReport={vi.fn()}
        />,
      );
    expect(html()).toBe("");
    model.open(eodSelection);
    expect(html()).toContain("Load one-month close history");
    expect(html()).not.toContain("<table>");
    expect(read).not.toHaveBeenCalled();
    await model.load();
    const output = html();
    for (const text of [
      "EOD close history · ZERO",
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
  it("removes exact values/metadata while refreshing, after failure and after cancellation", async () => {
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockResolvedValueOnce(eodResponse())
      .mockRejectedValueOnce(new ManagedEodHistoryError("source_rate_limited"));
    const model = new ManagedEodHistory(read, vi.fn());
    const html = () =>
      renderToStaticMarkup(
        <Panel model={model} onBack={vi.fn()} onAnnualReport={vi.fn()} />,
      );
    model.open(eodSelection);
    await model.load();
    const pending = model.load();
    expect(html()).toContain('aria-busy="true"');
    expect(html()).toContain("Cancel close history");
    expect(html()).not.toContain("<table>");
    expect(html()).not.toContain("Source request completed");
    await pending;
    expect(html()).toContain('role="alert"');
    expect(html()).toContain("no reset time was provided");
    expect(html()).not.toContain("<table>");
    let settle!: (value: ReturnType<typeof eodResponse>) => void;
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    const next = model.load();
    model.cancel();
    settle(eodResponse());
    await next;
    expect(html()).toContain("request cancelled");
    expect(html()).not.toContain("<table>");
  });
});
