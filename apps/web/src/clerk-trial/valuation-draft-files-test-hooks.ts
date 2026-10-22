import type { DependencyList } from "react";
export interface ValuationTestEffectSlot {
  deps: DependencyList | undefined;
  cleanup: (() => void) | undefined;
}
interface HookStore {
  index: number;
  slots: unknown[];
  effects: (() => void)[];
}
type LayoutEffect = () => void | (() => void);
function initialSlot(store: HookStore, value: unknown) {
  const index = store.index++;
  if (!(index in store.slots)) store.slots[index] = value;
  return index;
}
function stateHook(store: HookStore, initial: unknown) {
  const index = initialSlot(store, initial);
  return [
    store.slots[index],
    (value: unknown) => {
      store.slots[index] = value;
    },
  ];
}
function refHook(store: HookStore, current: unknown) {
  return store.slots[initialSlot(store, { current })];
}
function sameDependencies(
  deps: DependencyList | undefined,
  previous: DependencyList | undefined,
) {
  if (!deps) return false;
  if (!previous) return false;
  if (deps.length !== previous.length) return false;
  return deps.every((value, index) => Object.is(value, previous[index]));
}
function applyEffect(
  previous: ValuationTestEffectSlot | undefined,
  slot: ValuationTestEffectSlot,
  effect: LayoutEffect,
) {
  previous?.cleanup?.();
  slot.cleanup = effect() ?? undefined;
}
function effectHook(
  store: HookStore,
  effect: LayoutEffect,
  deps: DependencyList | undefined,
) {
  const index = store.index++;
  const previous = store.slots[index] as ValuationTestEffectSlot | undefined;
  if (sameDependencies(deps, previous?.deps)) return;
  const slot: ValuationTestEffectSlot = { deps, cleanup: undefined };
  store.slots[index] = slot;
  store.effects.push(() => applyEffect(previous, slot, effect));
}
/** A direct-render scheduler retains slot identity, dependencies and cleanup. */
export function createValuationDraftTestHooks(store: HookStore) {
  return {
    useState: (initial: unknown) => stateHook(store, initial),
    useRef: (current: unknown) => refHook(store, current),
    useLayoutEffect: (effect: LayoutEffect, deps?: DependencyList) =>
      effectHook(store, effect, deps),
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
      snapshot(),
  };
}
