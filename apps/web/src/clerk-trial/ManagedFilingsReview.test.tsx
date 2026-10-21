import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedFilingsReview as Panel } from "./ManagedFilingsReview";
import { ManagedFilingsReviewPicker } from "./ManagedFilingsReviewPicker";
import { ManagedFilingsReviewVisit } from "./ManagedFilingsReviewVisit";
import { ManagedFilingsReviewSource } from "./ManagedFilingsReviewSource";
import {
  ManagedFilingsReview,
  type ManagedFilingsReviewCapture,
} from "./managed-filings-review";
import type { ManagedApi } from "./managed-api";
import type {
  ManagedSecFilingsResponseDto,
  MainWatchlistPayload,
} from "@research-cockpit/contracts";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";

const hooks = vi.hoisted(() => ({
  direct: false,
  index: 0,
  refs: [] as Array<{ current: unknown }>,
  effects: [] as Array<() => void | (() => void)>,
  cleanups: [] as Array<() => void>,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => (hooks.direct ? "review-fixture" : actual.useId()),
    useRef: (initial: unknown) =>
      hooks.direct
        ? (hooks.refs[hooks.index++] ??= { current: initial })
        : actual.useRef(initial),
    useLayoutEffect: (
      effect: () => void | (() => void),
      dependencies?: React.DependencyList,
    ) => {
      if (hooks.direct) hooks.effects.push(effect);
      else actual.useLayoutEffect(effect, dependencies);
    },
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      get: () => unknown,
      server: () => unknown,
    ) =>
      hooks.direct
        ? get()
        : actual.useSyncExternalStore(subscribe, get, server),
  };
});
afterEach(() => {
  hooks.direct = false;
  hooks.refs = [];
  hooks.effects = [];
  hooks.cleanups = [];
  vi.unstubAllGlobals();
});
interface ControlProps {
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: (event: { currentTarget: HTMLButtonElement }) => void;
  onChange?: () => void;
}
function elements(
  node: React.ReactNode,
  kind: string,
): React.ReactElement<ControlProps>[] {
  if (
    React.isValidElement<
      React.ComponentProps<typeof ManagedFilingsReviewPicker>
    >(node) &&
    node.type === ManagedFilingsReviewPicker
  )
    return elements(ManagedFilingsReviewPicker(node.props), kind);
  if (
    React.isValidElement<
      React.ComponentProps<typeof ManagedFilingsReviewVisit>
    >(node) &&
    node.type === ManagedFilingsReviewVisit
  )
    return elements(ManagedFilingsReviewVisit(node.props), kind);
  if (
    React.isValidElement<
      React.ComponentProps<typeof ManagedFilingsReviewSource>
    >(node) &&
    node.type === ManagedFilingsReviewSource
  )
    return elements(ManagedFilingsReviewSource(node.props), kind);
  if (!React.isValidElement<ControlProps>(node)) return [];
  return [
    ...(node.type === kind ? [node] : []),
    ...React.Children.toArray(node.props.children).flatMap((child) =>
      elements(child, kind),
    ),
  ];
}
function text(node: React.ReactNode): string {
  return typeof node === "string"
    ? node
    : Array.isArray(node)
      ? node.map(text).join("")
      : React.isValidElement<ControlProps>(node)
        ? text(node.props.children)
        : "";
}
function fixture() {
  const read = vi
    .fn<ManagedApi["recentFilings"]>()
    .mockResolvedValue(filingsResponse());
  const model = new ManagedFilingsReview(read, vi.fn(), undefined, {
    coverage: inventedManagedResearchCoverage,
  });
  const draft: MainWatchlistPayload = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: filingsSelection.catalogSnapshotSha256,
    memberships: [{ ...filingsSelection.listing, note: "Keep exact Café 😀" }],
  };
  model.reconcile(draft, filingsSelection.catalogSnapshotSha256, true, true);
  const onView =
    vi.fn<
      (capture: ManagedFilingsReviewCapture, opener: HTMLButtonElement) => void
    >();
  const body = {};
  const documentMock = { body, activeElement: body };
  vi.stubGlobal("document", documentMock);
  const focus = vi.fn();
  const headingFocus = vi.fn<(target: "group" | "company") => void>();
  const loadButton = {
    disabled: false,
    isConnected: true,
    getClientRects: () => [{}],
    focus,
  };
  const render = (active = true) => {
    hooks.direct = true;
    hooks.index = 0;
    hooks.effects = [];
    const node = Panel({ model, active, onView });
    hooks.direct = false;
    hooks.refs[1]!.current = loadButton;
    hooks.refs[3]!.current = {
      isConnected: true,
      getClientRects: () => [{}],
      focus: () => headingFocus("group"),
    };
    hooks.refs[4]!.current = {
      isConnected: true,
      getClientRects: () => [{}],
      focus: () => headingFocus("company"),
    };
    const controls = elements(node, "button");
    loadButton.disabled = Boolean(
      controls.find((button) =>
        [
          "Load review filings",
          "Refresh review filings",
          "Loading filings…",
        ].includes(text(button.props.children)),
      )?.props.disabled,
    );
    return {
      html: renderToStaticMarkup(node),
      inputs: elements(node, "input"),
      button: (label: string) => {
        const button = controls.find(
          (control) => text(control.props.children) === label,
        );
        expect(button).toBeDefined();
        return button!;
      },
    };
  };
  const commit = () => {
    hooks.cleanups.forEach((cleanup) => cleanup());
    hooks.cleanups = hooks.effects.flatMap((effect) => {
      const cleanup = effect();
      return cleanup ? [cleanup] : [];
    });
  };
  const click = (
    button: React.ReactElement<ControlProps>,
    control = {} as HTMLButtonElement,
  ) => button.props.onClick?.({ currentTarget: control });
  const start = () => {
    let page = render();
    commit();
    page.inputs[0]!.props.onChange?.();
    page = render();
    commit();
    click(page.button("Start filing review"));
    page = render();
    commit();
    return page;
  };
  return {
    read,
    model,
    onView,
    documentMock,
    focus,
    headingFocus,
    render,
    commit,
    click,
    start,
    unmount: () => hooks.cleanups.forEach((cleanup) => cleanup()),
  };
}

describe("filing review controls", () => {
  it.each([true, false])(
    "Start and Finish move focus only for the initiating control (%s)",
    (keepFocus) => {
      const f = fixture();
      let page = f.render();
      f.commit();
      page.inputs[0]!.props.onChange?.();
      page = f.render();
      f.commit();
      const startControl = {} as HTMLButtonElement;
      f.documentMock.activeElement = startControl;
      f.click(page.button("Start filing review"), startControl);
      if (!keepFocus) f.documentMock.activeElement = {};
      page = f.render();
      f.commit();
      expect(f.headingFocus.mock.calls).toEqual(keepFocus ? [["company"]] : []);
      const finishControl = {} as HTMLButtonElement;
      f.documentMock.activeElement = finishControl;
      f.click(page.button("Finish filing review"), finishControl);
      if (!keepFocus) f.documentMock.activeElement = {};
      f.render();
      f.commit();
      expect(f.headingFocus.mock.calls).toEqual(
        keepFocus ? [["company"], ["group"]] : [],
      );
      expect(f.read).not.toHaveBeenCalled();
    },
  );
  it("chooses and starts without reading; only Load reads and Inspect reuses the admitted packet", async () => {
    const f = fixture();
    let page = f.start();
    expect(page.html).toContain("No response loaded");
    expect(f.read).not.toHaveBeenCalled();
    f.click(page.button("Load review filings"));
    await vi.waitFor(() =>
      expect(f.model.getSnapshot().rows[0]!.filings.running).toBe(false),
    );
    page = f.render();
    f.commit();
    expect(page.html).toContain("26 loaded filings");
    for (const value of [
      filingsResponse().issuer.sourceUrl,
      filingsResponse().window.fromDate,
      filingsResponse().completedAt,
    ])
      expect(page.html).toContain(value);
    f.click(page.button("Inspect filings and write note"));
    expect(f.onView).toHaveBeenCalledOnce();
    expect(f.onView.mock.calls[0]![0].response).toBe(
      f.model.getSnapshot().rows[0]!.filings.response,
    );
    expect(f.read).toHaveBeenCalledOnce();
    expect(f.focus).not.toHaveBeenCalled();
  });
  it("refuses controls from an old commit or unmounted panel", () => {
    const f = fixture();
    const old = f.start();
    f.render(false);
    f.commit();
    f.click(old.button("Load review filings"));
    expect(f.read).not.toHaveBeenCalled();
    const fresh = f.render();
    f.commit();
    f.unmount();
    f.click(fresh.button("Load review filings"));
    expect(f.read).not.toHaveBeenCalled();
  });
  it("distinguishes a source refusal from an empty available list", async () => {
    const f = fixture();
    f.start();
    f.read.mockResolvedValueOnce(filingsResponse(0, "not_covered"));
    await f.model.load(f.model.getSnapshot());
    let page = f.render();
    f.commit();
    expect(page.html).toContain("Source result: not covered");
    f.read.mockResolvedValueOnce(filingsResponse(0, "available"));
    await f.model.load(f.model.getSnapshot());
    page = f.render();
    f.commit();
    expect(page.html).toContain("0 filings in retained response");
    expect(page.html).not.toContain("Source result: not covered");
  });
  it.each([true, false])(
    "Cancel aborts and restores focus only if the user still owns the cancel control (%s)",
    async (keepFocus) => {
      const f = fixture();
      let resolve!: (value: ManagedSecFilingsResponseDto) => void;
      f.read.mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      );
      let page = f.start();
      f.click(page.button("Load review filings"));
      page = f.render();
      f.commit();
      const control = {} as HTMLButtonElement;
      f.documentMock.activeElement = control;
      f.click(page.button("Cancel review check"), control);
      expect(f.read.mock.calls[0]![1].aborted).toBe(true);
      if (!keepFocus) f.documentMock.activeElement = {};
      f.render();
      f.commit();
      expect(f.focus).toHaveBeenCalledTimes(keepFocus ? 1 : 0);
      resolve(filingsResponse());
      await Promise.resolve();
      expect(f.model.getSnapshot().rows[0]!.filings.response).toBeNull();
    },
  );
});
