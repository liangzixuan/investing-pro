import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseManagedEconomicCalendar,
  type PersonalEconomicCalendarDto,
} from "@research-cockpit/contracts";
import type { BeaReleaseAgendaProps } from "../features/markets/BeaReleaseAgenda";
import { ManagedBeaReleaseAgenda } from "./ManagedBeaReleaseAgenda";
import { ManagedBeaReleaseAgenda as Model } from "./managed-bea-release-agenda";
import type { ManagedApi } from "./managed-api";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { TrialApiError } from "./api";

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  effects: [] as Array<() => void | (() => void)>,
  stateIndex: 0,
  refIndex: 0,
  changed: false,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.states))
      hooks.states[index] =
        typeof initial === "function" ? (initial as () => unknown)() : initial;
    return [
      hooks.states[index],
      (next: unknown) => {
        const value =
          typeof next === "function"
            ? (next as (current: unknown) => unknown)(hooks.states[index])
            : next;
        hooks.changed ||= value !== hooks.states[index];
        hooks.states[index] = value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = hooks.refIndex++;
    return (hooks.refs[index] ??= { current: initial });
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
  useLayoutEffect: (effect: () => void | (() => void)) => {
    hooks.effects.push(effect);
  },
}));
afterEach(() => {
  hooks.states = [];
  hooks.refs = [];
  hooks.effects = [];
  vi.unstubAllGlobals();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function harness() {
  const agenda = parseManagedEconomicCalendar(economicCalendarFixture())!;
  const read = vi
    .fn<ManagedApi["economicCalendar"]>()
    .mockResolvedValue(agenda);
  const retired = vi.fn();
  const model = new Model(read, retired);
  let cleanups: Array<void | (() => void)> = [];
  const render = (
    currentModel = model,
    headingRef?: React.Ref<HTMLHeadingElement>,
  ) => {
    let node: React.ReactElement<BeaReleaseAgendaProps>;
    for (let i = 0; i < 5; i++) {
      hooks.stateIndex = 0;
      hooks.refIndex = 0;
      hooks.effects = [];
      hooks.changed = false;
      node = ManagedBeaReleaseAgenda({ model: currentModel, headingRef });
      if (!hooks.changed) break;
    }
    cleanups.forEach((cleanup) => cleanup?.());
    cleanups = hooks.effects.map((effect) => effect());
    return node!;
  };
  return {
    model,
    read,
    retired,
    agenda,
    render,
    view: () => render().props.dateView!,
    html: () => renderToStaticMarkup(render()),
    unmount: () => {
      cleanups.forEach((cleanup) => cleanup?.());
    },
  };
}

describe("managed BEA date selection", () => {
  it("passes the owned heading ref without loading or changing the date choice", async () => {
    const h = harness();
    const headingRef = { current: null };
    expect(h.render(h.model, headingRef).props.headingRef).toBe(headingRef);
    expect(h.read).not.toHaveBeenCalled();
    await h.model.load();
    h.view().onDateChange("2026-10-30");
    const view = h.render(h.model, headingRef);
    expect(view.props.headingRef).toBe(headingRef);
    expect(view.props.agenda).toBe(h.agenda);
    expect(view.props.dateView?.selectedDate).toBe("2026-10-30");
    expect(h.read).toHaveBeenCalledOnce();
  });
  it("starts unloaded without a read; explicit load permits local date selection and All loaded dates", async () => {
    const h = harness();
    expect(h.html()).not.toContain('id="managed-bea-release-date"');
    expect(h.read).not.toHaveBeenCalled();
    await h.model.load();
    expect(h.view().selectedDate).toBe("");
    expect(h.view().resetNotice).toBe(false);
    const focus = vi.fn();
    vi.stubGlobal("document", { activeElement: { focus } });
    h.view().onDateChange("2026-10-30");
    expect(h.view().selectedDate).toBe("2026-10-30");
    expect(h.html()).toContain("1 of 2 loaded BEA releases.");
    expect(h.html()).not.toContain("Invented November release");
    h.view().onDateChange("");
    expect(h.html()).toContain("Invented November release");
    expect(h.model.getSnapshot().agenda).toBe(h.agenda);
    expect(h.read).toHaveBeenCalledOnce();
    expect(focus).not.toHaveBeenCalled();
  });
  it.each(["unavailable", "invalid_response"] as const)(
    "retains the date and original clocks through pending and %s",
    async (code) => {
      const h = harness();
      await h.model.load();
      h.view().onDateChange("2026-10-30");
      const held = deferred<PersonalEconomicCalendarDto>();
      h.read.mockReturnValueOnce(held.promise);
      const pending = h.model.load();
      expect(h.view().selectedDate).toBe("2026-10-30");
      expect(h.render().props.showingPrevious).toBe(true);
      held.reject(new TrialApiError(code));
      await pending;
      expect(h.view().selectedDate).toBe("2026-10-30");
      expect(h.render().props.agenda).toBe(h.agenda);
      expect(h.html()).toContain("Tue, Oct 20, 2026, 2:00 PM EDT");
      expect(h.read).toHaveBeenCalledTimes(2);
    },
  );
  it("retains the date after keyboard Cancel, restores Load focus and ignores a late authentication failure", async () => {
    const h = harness();
    await h.model.load();
    h.view().onDateChange("2026-10-30");
    const held = deferred<PersonalEconomicCalendarDto>();
    h.read.mockReturnValueOnce(held.promise);
    const pending = h.model.load();
    const node = h.render();
    const load = { focus: vi.fn() };
    const cancel = {};
    (node.props.loadButtonRef as React.RefObject<typeof load | null>).current =
      load;
    vi.stubGlobal("document", { activeElement: cancel });
    node.props.onCancel!({
      currentTarget: cancel,
    } as React.MouseEvent<HTMLButtonElement>);
    expect(h.view().selectedDate).toBe("2026-10-30");
    expect(load.focus).toHaveBeenCalledOnce();
    expect(h.read.mock.calls[1]![0].aborted).toBe(true);
    held.reject(new TrialApiError("unauthenticated"));
    await pending;
    expect(h.view().selectedDate).toBe("2026-10-30");
    expect(h.retired).not.toHaveBeenCalled();
    expect(h.read).toHaveBeenCalledTimes(2);
  });
  it.each(["equal", "empty"])(
    "resets on a successful %s replacement and fences its preceding callback before rerender",
    async (kind) => {
      const h = harness();
      await h.model.load();
      h.view().onDateChange("2026-10-30");
      const old = h.view().onDateChange;
      const replacement = parseManagedEconomicCalendar({
        ...h.agenda,
        events: kind === "empty" ? [] : h.agenda.events,
      })!;
      expect(replacement).not.toBe(h.agenda);
      h.read.mockResolvedValueOnce(replacement);
      await h.model.load();
      const before = hooks.states[0];
      old("2026-11-02");
      expect(hooks.states[0]).toBe(before);
      expect(h.view().selectedDate).toBe("");
      expect(h.view().resetNotice).toBe(true);
      expect(h.html()).toContain(
        "Agenda response changed; showing All loaded dates.",
      );
      if (kind === "empty")
        expect(h.html()).toContain("No BEA releases are listed");
      else {
        expect(h.html()).toContain("2 of 2 loaded BEA releases.");
        h.view().onDateChange("2026-11-02");
        expect(h.view().resetNotice).toBe(false);
      }
    },
  );
  it("rejects foreign dates and stale handlers after a newer choice", async () => {
    const h = harness();
    await h.model.load();
    const old = h.view().onDateChange;
    old("2026-10-30");
    h.render();
    old("2026-11-02");
    expect(h.view().selectedDate).toBe("2026-10-30");
    h.view().onDateChange("2026-10-29");
    expect(h.view().selectedDate).toBe("2026-10-30");
    expect(h.read).toHaveBeenCalledOnce();
  });
  it("preserves a mounted choice through leave/enter without reading, but resets when unmounted", async () => {
    const h = harness();
    await h.model.load();
    h.view().onDateChange("2026-11-02");
    h.model.leave();
    h.model.enter();
    expect(h.view().selectedDate).toBe("2026-11-02");
    expect(h.read).toHaveBeenCalledOnce();
    const stale = h.view().onDateChange;
    h.unmount();
    const before = hooks.states[0];
    stale("2026-10-30");
    expect(hooks.states[0]).toBe(before);
    hooks.states = [];
    hooks.refs = [];
    expect(h.view().selectedDate).toBe("");
    expect(h.view().resetNotice).toBe(false);
    expect(h.read).toHaveBeenCalledOnce();
  });
  it("clears on retirement and rejects an old handler even before its next render", async () => {
    const h = harness();
    await h.model.load();
    h.view().onDateChange("2026-10-30");
    const old = h.view().onDateChange;
    h.model.retire();
    const before = hooks.states[0];
    old("2026-11-02");
    expect(hooks.states[0]).toBe(before);
    expect(h.render().props.agenda).toBeNull();
    expect(h.view().selectedDate).toBe("");
    expect(h.html()).not.toContain('id="managed-bea-release-date"');
    expect(h.read).toHaveBeenCalledOnce();
  });
  it("resets when the model owner changes even with the same packet object", async () => {
    const h = harness();
    await h.model.load();
    h.view().onDateChange("2026-10-30");
    const old = h.view().onDateChange;
    const other = new Model(
      vi.fn<ManagedApi["economicCalendar"]>().mockResolvedValue(h.agenda),
      vi.fn(),
    );
    await other.load();
    expect(h.render(other).props.dateView?.selectedDate).toBe("");
    const before = hooks.states[0];
    old("2026-11-02");
    expect(hooks.states[0]).toBe(before);
  });
});
