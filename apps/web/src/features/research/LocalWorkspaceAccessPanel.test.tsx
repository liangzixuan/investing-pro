import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const dependencies: Array<readonly unknown[]> = [];
  const cleanups = new Map<number, () => void>();
  let pending: Array<() => void> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  return {
    reset() {
      states.splice(0);
      refs.splice(0);
      dependencies.splice(0);
      cleanups.clear();
      pending = [];
    },
    begin() {
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    effects() {
      const work = pending;
      pending = [];
      work.forEach((run) => run());
    },
    unmount() {
      cleanups.forEach((cleanup) => cleanup());
      cleanups.clear();
    },
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (value: unknown) => {
          states[index] = value;
        },
      ];
    },
    useRef(initial: unknown) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useEffect(effect: () => () => void, next: readonly unknown[]) {
      const index = effectIndex++;
      if (dependencies[index]?.every((value, i) => Object.is(value, next[i])))
        return;
      dependencies[index] = next;
      pending.push(() => {
        cleanups.get(index)?.();
        cleanups.set(index, effect());
      });
    },
  };
});
const probe = vi.hoisted(() =>
  vi.fn<(signal: AbortSignal) => Promise<boolean>>(),
);
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => hooks.useState(initial),
  useRef: (initial: unknown) => hooks.useRef(initial),
  useEffect: (effect: () => () => void, next: readonly unknown[]) =>
    hooks.useEffect(effect, next),
}));
vi.mock("@/lib/personal-api", () => ({ fetchLocalWorkspaceAccess: probe }));

import {
  LocalWorkspaceAccessPanel,
  type LocalWorkspaceAccessPanelProps,
} from "./LocalWorkspaceAccessPanel";
import type { OwnerSessionActivityStart } from "./owner-session-lifecycle";

let props: LocalWorkspaceAccessPanelProps;
const session = vi.fn<LocalWorkspaceAccessPanelProps["onSessionChange"]>();
const activity = vi.fn<(start: OwnerSessionActivityStart | null) => void>();
let visibility: "visible" | "hidden";
let windowEvents: Map<string, Set<() => void>>;
let documentEvents: Map<string, Set<() => void>>;

beforeEach(() => {
  hooks.reset();
  probe.mockReset().mockResolvedValue(true);
  session.mockReset().mockImplementation((active) => Promise.resolve(active));
  activity.mockReset();
  visibility = "visible";
  windowEvents = new Map();
  documentEvents = new Map();
  const target = (events: Map<string, Set<() => void>>) => ({
    addEventListener(type: string, callback: () => void) {
      const listeners = events.get(type) ?? new Set<() => void>();
      listeners.add(callback);
      events.set(type, listeners);
    },
    removeEventListener(type: string, callback: () => void) {
      events.get(type)?.delete(callback);
    },
  });
  vi.stubGlobal("window", target(windowEvents));
  vi.stubGlobal("document", {
    ...target(documentEvents),
    get visibilityState() {
      return visibility;
    },
  });
  props = { onSessionChange: session, onActivityHandlerChange: activity };
});
afterEach(() => {
  hooks.unmount();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("LocalWorkspaceAccessPanel", () => {
  it("keeps compact status presentation distinct across checking, ready and paused states", async () => {
    const checking = render();
    expect(checking.props.className).toBe(
      "owner-session-panel local-access-panel",
    );
    expect(checking.props["data-access-state"]).toBe("checking");
    expect(statusMessage(checking).props.role).toBe("status");
    expect(text(statusMessage(checking))).toContain("Checking local access");
    await flush();
    const ready = render();
    expect(ready.props["data-access-state"]).toBe("ready");
    expect(ready.props["aria-labelledby"]).toBe("local-access-title");
    expect(text(statusMessage(ready))).toContain(
      "The local workspace is available",
    );
    expect(text(ready)).toContain("Login disabled on this computer");
    hide();
    const paused = render();
    expect(paused.props["data-access-state"]).toBe("paused");
    expect(text(paused)).toContain("Paused");
    expect(text(statusMessage(paused))).toContain("data is cleared");
    expect(statusMessage(paused).props["aria-live"]).toBe("polite");
    expect(probe).toHaveBeenCalledOnce();
  });

  it("keeps the unavailable alert and retry outside the compact ready treatment", async () => {
    probe.mockResolvedValueOnce(false);
    render();
    await flush();
    const unavailable = render();
    expect(unavailable.props["data-access-state"]).toBe("unavailable");
    expect(statusMessage(unavailable).props.role).toBe("alert");
    expect(text(unavailable)).toContain("Retry connection");
    expect(text(statusMessage(unavailable))).toContain("could not be verified");
    clickRetry();
    await flush();
    expect(render().props["data-access-state"]).toBe("ready");
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it("loads automatically only after exact local access is confirmed and publishes a guard after the private load", async () => {
    const admitted = deferred<boolean>();
    const loaded = deferred<boolean>();
    probe.mockReturnValueOnce(admitted.promise);
    session.mockImplementation((active) => (active ? loaded.promise : false));
    render();
    expect(probe).toHaveBeenCalledOnce();
    expect(session.mock.calls.map(([active]) => active)).toEqual([false]);
    expect(activity).toHaveBeenLastCalledWith(null);
    admitted.resolve(true);
    await flush();
    expect(session).toHaveBeenLastCalledWith(true, probe.mock.calls[0]?.[0]);
    expect(activity).toHaveBeenLastCalledWith(null);
    loaded.resolve(true);
    await flush();
    expect(text(render())).toContain("Login disabled on this computer");
    expect(text(render())).toContain("Ready");
    expect(text(render())).not.toMatch(
      /Sign in|Sign out|Start session|Rotate|Revoke|ACTIVE/iu,
    );
    const start = activity.mock.calls.at(-1)?.[0];
    const complete = start?.();
    expect(complete?.()).toBe(true);
    expect(complete?.()).toBe(false);
  });

  it.each([false, "throw"])(
    "clears private data and offers manual retry when the probe yields %s",
    async (result) => {
      if (result === false) probe.mockResolvedValueOnce(false);
      else probe.mockRejectedValueOnce(new Error("PRIVATE_PROBE_CANARY"));
      render();
      await flush();
      expect(session.mock.calls.every(([active]) => !active)).toBe(true);
      expect(probe.mock.calls[0]?.[0].aborted).toBe(true);
      expect(text(render())).toContain("could not be verified");
      expect(text(render())).not.toContain("PRIVATE_PROBE_CANARY");
      clickRetry();
      await flush();
      expect(probe).toHaveBeenCalledTimes(2);
      expect(text(render())).toContain("The local workspace is available");
    },
  );

  it.each([false, "throw"])(
    "clears again when private loading yields %s",
    async (result) => {
      session.mockImplementation((active) =>
        !active
          ? false
          : result === false
            ? false
            : Promise.reject(new Error("PRIVATE_LOAD_CANARY")),
      );
      render();
      await flush();
      expect(session.mock.calls.map(([active]) => active)).toEqual([
        false,
        true,
        false,
      ]);
      expect(activity).toHaveBeenLastCalledWith(null);
      expect(probe.mock.calls[0]?.[0].aborted).toBe(true);
      expect(text(render())).toContain("Retry connection");
      expect(text(render())).not.toContain("PRIVATE_LOAD_CANARY");
    },
  );

  it("does not load while initially hidden and deduplicates simultaneous wake events", async () => {
    visibility = "hidden";
    render();
    expect(probe).not.toHaveBeenCalled();
    show();
    dispatch("focus");
    dispatch("pageshow");
    expect(probe).toHaveBeenCalledOnce();
    await flush();
    expect(text(render())).toContain("Ready");
  });

  it("aborts hidden requests and ignores a late probe without disturbing a newer successful wake", async () => {
    const old = deferred<boolean>();
    probe.mockReturnValueOnce(old.promise);
    render();
    const signal = probe.mock.calls[0]![0];
    hide();
    expect(signal.aborted).toBe(true);
    expect(activity).toHaveBeenLastCalledWith(null);
    show();
    await flush();
    const before = session.mock.calls.length;
    old.resolve(true);
    await flush();
    expect(session).toHaveBeenCalledTimes(before);
    expect(text(render())).toContain("Ready");
  });

  it("invalidates pending private loads and existing completion guards on pagehide", async () => {
    const loaded = deferred<boolean>();
    session
      .mockImplementationOnce(() => false)
      .mockImplementationOnce(() => loaded.promise);
    render();
    await flush();
    const signal = probe.mock.calls[0]![0];
    dispatch("pagehide");
    expect(signal.aborted).toBe(true);
    expect(session.mock.calls.at(-1)?.[0]).toBe(false);
    dispatch("pageshow");
    await flush();
    const start = activity.mock.calls.at(-1)?.[0];
    const complete = start?.();
    loaded.resolve(false);
    await flush();
    expect(text(render())).toContain("Ready");
    hide();
    expect(start?.()).toBeUndefined();
    expect(complete?.()).toBe(false);
    expect(session.mock.calls.at(-1)?.[0]).toBe(false);
  });

  it.each(["probe", "private load"])(
    "aborts and clears on unmount during a pending %s",
    async (stage) => {
      const pending = deferred<boolean>();
      if (stage === "probe") probe.mockReturnValueOnce(pending.promise);
      else
        session.mockImplementation((active) =>
          active ? pending.promise : false,
        );
      render();
      await flush();
      const signal = probe.mock.calls[0]![0];
      hooks.unmount();
      expect(signal.aborted).toBe(true);
      expect(activity).toHaveBeenLastCalledWith(null);
      expect(session.mock.calls.at(-1)?.[0]).toBe(false);
      const before = session.mock.calls.length;
      pending.resolve(true);
      await flush();
      dispatch("focus");
      show();
      expect(session).toHaveBeenCalledTimes(before);
      expect(probe).toHaveBeenCalledOnce();
      expect(
        [...windowEvents.values(), ...documentEvents.values()].every(
          (listeners) => listeners.size === 0,
        ),
      ).toBe(true);
    },
  );

  it("has no idle/absolute lease and revalidates a visible wake rather than pretending to sign in", async () => {
    vi.useFakeTimers();
    render();
    await flush();
    const old = activity.mock.calls.at(-1)?.[0];
    vi.advanceTimersByTime(75 * 60 * 1000);
    expect(old?.()?.()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    dispatch("focus");
    expect(old?.()).toBeUndefined();
    await flush();
    expect(probe).toHaveBeenCalledTimes(2);
    expect(text(render())).toContain("Ready");
  });

  it("revalidates after an active workspace operation reports unavailable access", async () => {
    render();
    await flush();
    const old = activity.mock.calls.at(-1)?.[0];
    probe.mockResolvedValueOnce(false);
    props = { ...props, invalidationKey: 1 };
    render();
    expect(old?.()).toBeUndefined();
    await flush();
    expect(probe).toHaveBeenCalledTimes(2);
    expect(activity).toHaveBeenLastCalledWith(null);
    expect(text(render())).toContain("Retry connection");
  });
});

function render(): React.ReactElement<{
  className: string;
  "data-access-state": string;
  "aria-labelledby": string;
}> {
  hooks.begin();
  const view = LocalWorkspaceAccessPanel(props);
  hooks.effects();
  return view;
}
async function flush() {
  for (let count = 0; count < 6; count++) await Promise.resolve();
}
function dispatch(type: string) {
  windowEvents.get(type)?.forEach((handler) => handler());
}
function show() {
  visibility = "visible";
  documentEvents.get("visibilitychange")?.forEach((handler) => handler());
}
function hide() {
  visibility = "hidden";
  documentEvents.get("visibilitychange")?.forEach((handler) => handler());
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(text).join(" ");
  return React.isValidElement<{ children?: unknown }>(value)
    ? text(value.props.children)
    : "";
}
function statusMessage(value: React.ReactElement) {
  const children = React.Children.toArray(
    (value.props as { children: React.ReactNode }).children,
  );
  const message = children.find(
    (child) =>
      React.isValidElement<{ className?: string }>(child) &&
      child.props.className === "local-access-message",
  );
  if (!React.isValidElement<{ role: string; "aria-live": string }>(message))
    throw new Error("Expected local access status message.");
  return message;
}
function clickRetry() {
  function find(
    value: unknown,
  ): React.ReactElement<{ onClick: () => void }> | undefined {
    if (Array.isArray(value))
      return value.map(find).find((item) => item !== undefined);
    if (
      !React.isValidElement<{ children?: unknown; onClick: () => void }>(value)
    )
      return undefined;
    return value.type === "button" ? value : find(value.props.children);
  }
  const button = find(render());
  expect(button).toBeDefined();
  button?.props.onClick();
}
