import * as React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ManagedPortfolioValuationReview,
  type ManagedPortfolioValuationReviewProps,
} from "./ManagedPortfolioValuationReview";
import {
  createPortfolioValuationFixture,
  portfolioScenarioTime,
} from "./test-portfolio-valuation-fixture";
const h = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  states: [] as unknown[],
  index: 0,
  stateIndex: 0,
  effects: [] as (() => void | (() => void))[],
  cleanups: [] as (() => void)[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useRef: (v: unknown) => (h.refs[h.index++] ??= { current: v }),
    useState: (v: unknown) => {
      const i = h.stateIndex++;
      h.states[i] ??= v;
      return [
        h.states[i],
        (n: unknown) => {
          h.states[i] = n;
        },
      ];
    },
    useSyncExternalStore: (_s: unknown, get: () => unknown) => get(),
    useLayoutEffect: (e: () => void | (() => void)) => {
      h.effects.push(e);
    },
  };
});
type Props = {
  id?: string;
  children?: React.ReactNode;
  ref?: React.RefObject<unknown>;
  onClick?: (event: { currentTarget: HTMLButtonElement }) => void;
};
function elements(node: React.ReactNode): React.ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}
const fixtures: Awaited<ReturnType<typeof createPortfolioValuationFixture>>[] =
  [];
async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(portfolioScenarioTime);
  const f = await createPortfolioValuationFixture();
  fixtures.push(f);
  return f;
}
afterEach(() => {
  h.cleanups.splice(0).forEach((f) => f());
  fixtures.splice(0).forEach((f) => f.dispose());
  h.refs = [];
  h.states = [];
  h.index = 0;
  h.stateIndex = 0;
  h.effects = [];
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function render(
  f: Awaited<ReturnType<typeof setup>>,
  overrides: Partial<ManagedPortfolioValuationReviewProps> = {},
  connected = true,
) {
  h.index = 0;
  h.stateIndex = 0;
  h.effects = [];
  const onPreview = vi.fn((state: ReturnType<typeof f.model.getSnapshot>) =>
      f.model.preview(state),
    ),
    onResearch = vi.fn();
  const tree = ManagedPortfolioValuationReview({
    model: f.model,
    assumptions: f.workspace.valuationAssumptions,
    workbench: f.workspace.valuation,
    active: true,
    canPreview: true,
    onPreview,
    onResearch,
    canResearch: () => true,
    ...overrides,
  });
  const rows = elements(tree),
    focus = vi.fn();
  rows.find(
    (e) => e.props.id === "portfolio-saved-scenario-heading",
  )!.props.ref!.current = { isConnected: connected, focus };
  return {
    onPreview,
    onResearch,
    focus,
    click: (id: string, opener = {} as HTMLButtonElement) =>
      rows.find((e) => e.props.id === `portfolio-saved-scenario-${id}`)!.props
        .onClick!({ currentTarget: opener }),
    commit: () => {
      h.cleanups.splice(0).forEach((f) => f());
      h.cleanups = h.effects
        .map((f) => f())
        .filter((f): f is () => void => typeof f === "function");
    },
  };
}
it("admits only explicit committed Preview/Evaluate and guards stale callbacks, with no automatic effects", async () => {
  const f = await setup(),
    before = f.fixture.watchlistSavedScenario!.getSnapshot(),
    first = render(f);
  first.click("preview");
  expect(first.onPreview).not.toHaveBeenCalled();
  first.commit();
  expect(f.model.getSnapshot().plan).toBeNull();
  first.click("preview");
  expect(first.onPreview).toHaveBeenCalledOnce();
  const second = render(f);
  second.commit();
  expect(second.focus).toHaveBeenCalledOnce();
  first.click("preview");
  expect(first.onPreview).toHaveBeenCalledOnce();
  second.click("evaluate");
  const third = render(f);
  third.commit();
  expect(third.focus).toHaveBeenCalledOnce();
  expect(f.model.getSnapshot().reading).not.toBeNull();
  expect(f.fixture.watchlistSavedScenario!.getSnapshot()).toEqual(before);
});
it("invalidates old render callbacks even when only action props change", async () => {
  const f = await setup(),
    old = render(f);
  old.commit();
  const paused = render(f, { active: false, canPreview: false });
  paused.commit();
  old.click("preview");
  paused.click("preview");
  expect(f.model.getSnapshot().plan).toBeNull();
  expect(old.onPreview).not.toHaveBeenCalled();
});
it("passes exact retained row and opener to Research without fresh prices, and rejects a stale row after Clear", async () => {
  const f = await setup();
  f.model.preview(f.model.getSnapshot());
  const row = f.model.getSnapshot().plan!.rows[1]!,
    r = render(f, { canPreview: false });
  r.commit();
  const opener = {} as HTMLButtonElement;
  r.click("research-1", opener);
  expect(r.onResearch).toHaveBeenCalledExactlyOnceWith(row, opener);
  r.click("clear");
  expect(f.model.getSnapshot().plan).toBeNull();
  r.click("research-1", opener);
  expect(r.onResearch).toHaveBeenCalledOnce();
  const cleared = render(f);
  cleared.commit();
  expect(cleared.focus).toHaveBeenCalledOnce();
});
it("refuses unadmitted Research and reentrant retirement without focus or automatic saves", async () => {
  const f = await setup();
  f.model.preview(f.model.getSnapshot());
  const r = render(f, { canResearch: () => false }, false);
  r.commit();
  r.click("research-0");
  expect(r.onResearch).not.toHaveBeenCalled();
  const unsub = f.model.subscribe(() => {
    if (f.model.getSnapshot().reading) f.revoke();
  });
  r.click("evaluate");
  unsub();
  expect(f.model.getSnapshot().reading).toBeNull();
  const retired = render(f);
  retired.commit();
  expect(retired.focus).not.toHaveBeenCalled();
});
it("loads the saved collection only through its explicit current action", async () => {
  const f = await setup(),
    load = vi.spyOn(f.workspace.valuationAssumptions.coordinator, "load"),
    r = render(f);
  r.click("load");
  expect(load).not.toHaveBeenCalled();
  r.commit();
  expect(load).not.toHaveBeenCalled();
  r.click("load");
  expect(load).toHaveBeenCalledOnce();
  await load.mock.results[0]!.value;
});

it("does not move focus for a pending user result once the route becomes inactive", async () => {
  const f = await setup(),
    r = render(f);
  r.commit();
  r.click("preview");
  const paused = render(f, { active: false });
  paused.commit();
  expect(paused.focus).not.toHaveBeenCalled();
});
