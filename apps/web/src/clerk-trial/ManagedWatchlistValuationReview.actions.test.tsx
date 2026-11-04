import * as React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ManagedWatchlistValuationReview } from "./ManagedWatchlistValuationReview";
import { createWatchlistValuationFixture } from "./test-watchlist-valuation-review-fixture";
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
    useRef: (value: unknown) => (h.refs[h.index++] ??= { current: value }),
    useState: (value: unknown) => {
      const i = h.stateIndex++;
      h.states[i] ??= value;
      return [
        h.states[i],
        (next: unknown) => {
          h.states[i] = next;
        },
      ];
    },
    useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
    useLayoutEffect: (effect: () => void | (() => void)) => {
      h.effects.push(effect);
    },
  };
});
type ElementProps = {
  id?: string;
  children?: React.ReactNode;
  ref?: React.RefObject<unknown>;
  onClick?: () => void;
};
function elements(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
const fixtures: Awaited<ReturnType<typeof createWatchlistValuationFixture>>[] =
  [];
afterEach(() => {
  h.cleanups.splice(0).forEach((f) => f());
  fixtures.splice(0).forEach((f) => f.dispose());
  h.refs = [];
  h.states = [];
  h.index = 0;
  h.stateIndex = 0;
  h.effects = [];
});
function render(
  f: Awaited<ReturnType<typeof createWatchlistValuationFixture>>,
  connected = true,
) {
  h.index = 0;
  h.stateIndex = 0;
  h.effects = [];
  const tree = ManagedWatchlistValuationReview({
    workspace: f.workspace,
    active: true,
  });
  const rows = elements(tree),
    focus = vi.fn();
  const heading = rows.find(
    (e) => e.props.id === "watchlist-saved-scenario-heading",
  )!;
  heading.props.ref!.current = { isConnected: connected, focus };
  return {
    focus,
    button: (id: string) => rows.find((e) => e.props.id === id)!.props.onClick!,
    commit: () => {
      h.cleanups.splice(0).forEach((f) => f());
      h.cleanups = h.effects
        .map((f) => f())
        .filter((f): f is () => void => typeof f === "function");
    },
  };
}
it("refuses uncommitted and stale callbacks and focuses only the exact committed Preview/Evaluate result", async () => {
  const f = await createWatchlistValuationFixture();
  fixtures.push(f);
  await f.workspace.valuationAssumptions.coordinator.load();
  const first = render(f),
    preview = first.button("watchlist-saved-scenario-preview");
  preview();
  expect(f.model.getSnapshot().plan).toBeNull();
  first.commit();
  preview();
  expect(f.model.getSnapshot().plan).not.toBeNull();
  const second = render(f);
  second.commit();
  expect(second.focus).toHaveBeenCalledOnce();
  const plan = f.model.getSnapshot().plan;
  preview();
  expect(f.model.getSnapshot().plan).toBe(plan);
  second.button("watchlist-saved-scenario-evaluate")();
  const third = render(f);
  third.commit();
  expect(third.focus).toHaveBeenCalledOnce();
  f.group.finishDaily(f.group.getSnapshot());
  const finished = render(f);
  finished.commit();
  expect(finished.focus).not.toHaveBeenCalled();
});
it("does not move focus when the committed heading disconnects or evaluation retires reentrantly", async () => {
  const f = await createWatchlistValuationFixture();
  fixtures.push(f);
  await f.workspace.valuationAssumptions.coordinator.load();
  const first = render(f);
  first.commit();
  first.button("watchlist-saved-scenario-preview")();
  const detached = render(f, false);
  detached.commit();
  expect(detached.focus).not.toHaveBeenCalled();
  const unsubscribe = f.model.subscribe(() => {
    if (f.model.getSnapshot().reading) f.group.leave();
  });
  detached.button("watchlist-saved-scenario-evaluate")();
  unsubscribe();
  expect(f.model.getSnapshot().reading).toBeNull();
  expect(detached.focus).not.toHaveBeenCalled();
});
