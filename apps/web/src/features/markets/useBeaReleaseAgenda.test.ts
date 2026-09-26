import {
  PERSONAL_BEA_CALENDAR_SOURCE,
  type PersonalEconomicCalendarDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import type * as Api from "../../lib/personal-workspace-api";
import {
  useBeaReleaseAgenda,
  type BeaReleaseAgendaContext,
} from "./useBeaReleaseAgenda";
const hooks = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const effects: Array<{
    dependencies: readonly unknown[] | undefined;
    setup: () => void | (() => void);
    cleanup: (() => void) | undefined;
  }> = [];
  const pending: Array<() => void> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  let scheduledRender = false;
  return {
    beginRender() {
      scheduledRender = false;
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    reset() {
      states.splice(0);
      refs.splice(0);
      effects.splice(0);
      pending.splice(0);
      stateIndex = refIndex = effectIndex = 0;
      scheduledRender = false;
    },
    commit() {
      pending.splice(0).forEach((run) => run());
    },
    replayCommittedEffects() {
      if (pending.length !== 0)
        throw new Error("Commit effects before replaying their lifetime.");
      effects.forEach((effect) => effect.cleanup?.());
      effects.forEach((effect) => {
        effect.cleanup = effect.setup() ?? undefined;
      });
    },
    hasScheduledRender() {
      return scheduledRender;
    },
    unmount() {
      pending.splice(0);
      effects.forEach((effect) => effect.cleanup?.());
    },
    useState(this: void, initial: unknown) {
      const index = stateIndex++;
      if (!(index in states))
        states[index] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        states[index],
        (next: unknown) => {
          const value =
            typeof next === "function"
              ? (next as (current: unknown) => unknown)(states[index])
              : next;
          if (!Object.is(value, states[index])) scheduledRender = true;
          states[index] = value;
        },
      ];
    },
    useRef<T>(this: void, initial: T) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useEffect(
      this: void,
      callback: () => void | (() => void),
      dependencies?: readonly unknown[],
    ) {
      const index = effectIndex++;
      const old = effects[index];
      if (
        old !== undefined &&
        dependencies !== undefined &&
        old.dependencies !== undefined &&
        dependencies.length === old.dependencies.length &&
        dependencies.every((value, i) => Object.is(value, old.dependencies![i]))
      )
        return;
      const effect = {
        dependencies: dependencies?.slice(),
        setup: callback,
        cleanup: old?.cleanup,
      };
      effects[index] = effect;
      pending.push(() => {
        effect.cleanup?.();
        effect.cleanup = callback() ?? undefined;
      });
    },
  };
});
const client = vi.hoisted(() => ({
  load: vi.fn<typeof Api.fetchPersonalEconomicCalendar>(),
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: hooks.useState,
  useRef: hooks.useRef,
  useEffect: hooks.useEffect,
}));
vi.mock("../../lib/personal-workspace-api", async () => ({
  ...(await vi.importActual<typeof Api>("../../lib/personal-workspace-api")),
  fetchPersonalEconomicCalendar: client.load,
}));
const complete = vi.fn<() => boolean>();
const activity = vi.fn<BeaReleaseAgendaContext["onActivityStart"]>();
const unavailable = vi.fn();
const unexpectedFetch = vi.fn();
let context: BeaReleaseAgendaContext;
let current = true;
beforeEach(() => {
  hooks.reset();
  vi.clearAllMocks();
  vi.useFakeTimers();
  current = true;
  complete.mockReset().mockReturnValue(true);
  activity.mockReset().mockImplementation(() => complete);
  client.load.mockReset().mockResolvedValue(fixture());
  unexpectedFetch.mockReset().mockImplementation(() => {
    throw new Error("Unexpected network request");
  });
  vi.stubGlobal("fetch", unexpectedFetch);
  context = {
    active: true,
    enabled: true,
    sessionKey: 1,
    isCurrent: () => current,
    isActive: () => true,
    onActivityStart: activity,
    onSessionUnavailable: unavailable,
  };
});
afterEach(() => {
  hooks.unmount();
  expect(unexpectedFetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("BEA agenda request lifetime", () => {
  it("rejects a queued action immediately when its captured view epoch retires", () => {
    let viewEpoch = 1;
    context = { ...context, isActive: () => viewEpoch === 1 };
    const old = render();
    viewEpoch = 2;
    old.onLoad();
    expect(client.load).not.toHaveBeenCalled();
    expect(activity).not.toHaveBeenCalled();
  });
  it("ignores completion after synchronous hide and return while retaining accepted data", async () => {
    let viewEpoch = 1;
    context = { ...context, isActive: () => viewEpoch === 1 };
    await loaded();
    const held = deferred<PersonalEconomicCalendarDto>();
    client.load.mockReturnValue(held.promise);
    const old = render();
    old.onLoad();
    viewEpoch = 2;
    viewEpoch = 3;
    context = { ...context, isActive: () => viewEpoch === 3 };
    render();
    held.resolve({ ...fixture(), events: [] });
    await flush();
    expect(render()).toMatchObject({
      agenda: fixture(),
      busy: false,
      error: null,
    });
    expect(complete).toHaveBeenCalledTimes(1);
    old.onLoad();
    expect(client.load).toHaveBeenCalledTimes(2);
    render().onLoad();
    expect(client.load).toHaveBeenCalledTimes(3);
    await flush();
  });
  it("never loads on entry, effect replay, activation or the passage of time", async () => {
    render();
    hooks.replayCommittedEffects();
    context = { ...context, active: false };
    render();
    context = { ...context, active: true };
    render();
    await vi.advanceTimersByTimeAsync(90 * 86_400_000);
    expect(client.load).not.toHaveBeenCalled();
    expect(activity).not.toHaveBeenCalled();
  });
  it("deduplicates rapid clicks until a single explicit request completes", async () => {
    const held = deferred<PersonalEconomicCalendarDto>();
    client.load.mockReturnValue(held.promise);
    const first = render();
    first.onLoad();
    first.onLoad();
    render().onLoad();
    expect(client.load).toHaveBeenCalledTimes(1);
    expect(activity).toHaveBeenCalledTimes(1);
    expect(render().busy).toBe(true);
    held.resolve(fixture());
    await flush();
    expect(render()).toMatchObject({
      agenda: fixture(),
      busy: false,
      error: null,
    });
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it("retains accepted data across Research and Back without another request", async () => {
    const old = await loaded();
    context = { ...context, active: false };
    expect(render().agenda).toEqual(fixture());
    old.onLoad();
    render().onLoad();
    context = { ...context, active: true };
    expect(render().agenda).toEqual(fixture());
    old.onLoad();
    expect(client.load).toHaveBeenCalledTimes(1);
    expect(activity).toHaveBeenCalledTimes(1);
  });
  it.each([
    "provider_unavailable",
    "invalid_response",
    "rate_limited",
    "conflict",
  ] as const)(
    "retains the exact prior successful snapshot after %s without retry",
    async (code) => {
      const first = await loaded();
      client.load.mockRejectedValue(new PersonalWorkspaceApiError(code));
      first.onLoad();
      await flush();
      expect(render()).toMatchObject({
        agenda: fixture(),
        busy: false,
        error: code,
      });
      await vi.advanceTimersByTimeAsync(86_400_000);
      expect(client.load).toHaveBeenCalledTimes(2);
    },
  );
  it("keeps old events visible during refresh and replaces them only on success", async () => {
    await loaded();
    const held = deferred<PersonalEconomicCalendarDto>();
    client.load.mockReturnValue(held.promise);
    render().onLoad();
    expect(render()).toMatchObject({ busy: true, agenda: fixture() });
    const next = { ...fixture(), events: [] };
    held.resolve(next);
    await flush();
    expect(render()).toMatchObject({ busy: false, agenda: next });
  });
  it.each([{ active: false }, { enabled: false }, { isCurrent: () => false }])(
    "refuses requests in an unavailable context %j",
    async (change) => {
      context = { ...context, ...change };
      render().onLoad();
      await flush();
      expect(client.load).not.toHaveBeenCalled();
      expect(activity).not.toHaveBeenCalled();
    },
  );
  it("does not send a request when activity cannot start or retires the context", () => {
    activity.mockReturnValueOnce(undefined).mockImplementationOnce(() => {
      current = false;
      return complete;
    });
    render().onLoad();
    render().onLoad();
    expect(client.load).not.toHaveBeenCalled();
  });
  it.each([{ enabled: false }, { sessionKey: 2 }, { isCurrent: () => false }])(
    "immediately clears retained data and rejects old handlers on lifetime change %j",
    async (change) => {
      const old = await loaded();
      context = { ...context, ...change };
      expect(render(false).agenda).toBeNull();
      old.onLoad();
      expect(client.load).toHaveBeenCalledTimes(1);
      hooks.commit();
    },
  );
  it("does not resurrect an accepted snapshot after isCurrent false then true", async () => {
    const old = await loaded();
    current = false;
    expect(render().agenda).toBeNull();
    current = true;
    expect(render().agenda).toBeNull();
    old.onLoad();
    expect(client.load).toHaveBeenCalledTimes(1);
  });
  it.each(["resolve", "reject"] as const)(
    "ignores a late %s after route hide and retains earlier data",
    async (outcome) => {
      await loaded();
      const held = deferred<PersonalEconomicCalendarDto>();
      client.load.mockReturnValue(held.promise);
      render().onLoad();
      const signal = client.load.mock.calls[1]![0];
      context = { ...context, active: false };
      expect(render()).toMatchObject({ agenda: fixture(), busy: false });
      expect(signal.aborted).toBe(true);
      context = { ...context, active: true };
      render();
      if (outcome === "resolve") held.resolve({ ...fixture(), events: [] });
      else held.reject(new PersonalWorkspaceApiError("session_unavailable"));
      await flush();
      expect(render()).toMatchObject({
        agenda: fixture(),
        busy: false,
        error: null,
      });
      expect(unavailable).not.toHaveBeenCalled();
      expect(client.load).toHaveBeenCalledTimes(2);
    },
  );
  it("ignores a pending result if current authority retires before any new render", async () => {
    const held = deferred<PersonalEconomicCalendarDto>();
    client.load.mockReturnValue(held.promise);
    render().onLoad();
    current = false;
    held.resolve(fixture());
    await flush();
    expect(render()).toMatchObject({ agenda: null, busy: false });
    expect(complete).not.toHaveBeenCalled();
  });
  it("uses the latest authority callback while allowing an equivalent shell callback replacement", async () => {
    const held = deferred<PersonalEconomicCalendarDto>();
    client.load.mockReturnValue(held.promise);
    render().onLoad();
    context = { ...context, isCurrent: () => true };
    render();
    held.resolve(fixture());
    await flush();
    expect(render().agenda).toEqual(fixture());
    expect(client.load).toHaveBeenCalledTimes(1);
  });
  it.each(["error", "completion"] as const)(
    "clears data and retires handlers when session fails at %s",
    async (cause) => {
      const old = await loaded();
      if (cause === "error")
        client.load.mockRejectedValue(
          new PersonalWorkspaceApiError("session_unavailable"),
        );
      else complete.mockReturnValue(false);
      old.onLoad();
      await flush();
      expect(render()).toMatchObject({ agenda: null, busy: false });
      expect(unavailable).toHaveBeenCalledTimes(1);
      old.onLoad();
      expect(client.load).toHaveBeenCalledTimes(2);
    },
  );
  it("aborts and clears pending busy state on StrictMode replay without background retry", async () => {
    const held = deferred<PersonalEconomicCalendarDto>();
    client.load.mockReturnValue(held.promise);
    const old = render();
    old.onLoad();
    const signal = client.load.mock.calls[0]![0];
    hooks.replayCommittedEffects();
    expect(render()).toMatchObject({ busy: false, agenda: null });
    old.onLoad();
    held.resolve(fixture());
    await flush();
    expect(signal.aborted).toBe(true);
    expect(client.load).toHaveBeenCalledTimes(1);
    expect(render().agenda).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });
  it("does not accept a late result after unmount", async () => {
    const held = deferred<PersonalEconomicCalendarDto>();
    client.load.mockReturnValue(held.promise);
    const old = render();
    old.onLoad();
    hooks.unmount();
    held.reject(new Error("Late failure"));
    await flush();
    old.onLoad();
    expect(client.load).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    expect(unavailable).not.toHaveBeenCalled();
  });
});

function render(commit = true) {
  hooks.beginRender();
  const view = useBeaReleaseAgenda(context);
  if (commit) hooks.commit();
  return view;
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
async function loaded() {
  render().onLoad();
  await flush();
  return render();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(): PersonalEconomicCalendarDto {
  return {
    schemaVersion: "1.0.0",
    source: PERSONAL_BEA_CALENDAR_SOURCE,
    fetchedAt: "2026-09-26T18:00:00.000Z",
    window: {
      fromInclusive: "2026-09-26T18:00:00.000Z",
      toExclusive: "2026-10-26T18:00:00.000Z",
    },
    events: [
      { series: "Synthetic GDP", scheduledAt: "2026-09-30T12:30:00.000Z" },
    ],
  };
}
