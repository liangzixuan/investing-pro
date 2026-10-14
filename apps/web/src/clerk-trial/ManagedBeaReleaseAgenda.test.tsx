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
import {
  ManagedBeaReleaseNoteAction,
  type ManagedBeaReleaseNoteContext,
} from "./ManagedBeaReleaseNoteAction";
import { TrialApiError } from "./api";

vi.mock("./ManagedBeaReleaseNoteAction", () => ({
  ManagedBeaReleaseNoteAction: () => null,
}));

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  memos: [] as Array<{ value: unknown; dependencies: readonly unknown[] }>,
  memoIndex: 0,
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
  useMemo: (factory: () => unknown, dependencies: readonly unknown[]) => {
    const index = hooks.memoIndex++;
    const previous = hooks.memos[index];
    if (
      !previous ||
      dependencies.some(
        (value, position) => !Object.is(value, previous.dependencies[position]),
      )
    )
      hooks.memos[index] = { value: factory(), dependencies };
    return hooks.memos[index]!.value;
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
  hooks.memos = [];
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
  const noteContext: ManagedBeaReleaseNoteContext = {
    members: [],
    active: true,
    editable: true,
    actions: {
      getAction: vi.fn(() => ({
        canAppend: false,
        reason: "Choose a loaded release.",
      })),
      append: vi.fn(),
    },
    onReview: vi.fn(),
  };
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
      hooks.memoIndex = 0;
      hooks.effects = [];
      hooks.changed = false;
      node = ManagedBeaReleaseAgenda({
        model: currentModel,
        headingRef,
        noteContext,
      });
      if (!hooks.changed) break;
    }
    cleanups.forEach((cleanup) => cleanup?.());
    cleanups = hooks.effects.map((effect) => effect());
    return node!;
  };
  return {
    model,
    noteContext,
    read,
    retired,
    agenda,
    render,
    view: () => render().props.filterView!,
    html: () => renderToStaticMarkup(render()),
    unmount: () => {
      cleanups.forEach((cleanup) => cleanup?.());
    },
  };
}

describe("managed BEA date selection", () => {
  it("passes the accepted pair alongside the unchanged current filter and note response across retained attempts", async () => {
    const h = harness();
    await h.model.load();
    await h.model.load();
    const pair = h.model.getSnapshot().refreshComparison!;
    h.view().onDateChange("2026-11-02");
    h.view().onQueryChange("November");
    const node = h.render();
    expect(node.props.refreshComparison).toBe(pair);
    expect(node.props.filterView!.view.response).toBe(pair.current);
    expect(node.props.filterView!.view.visibleGroups[0]!.events[0]).toBe(
      h.agenda.events[1],
    );
    h.read.mockRejectedValueOnce(new TrialApiError("invalid_response"));
    await h.model.load();
    expect(h.render().props.refreshComparison).toBe(pair);
    expect(h.view().view.query).toBe("November");
    expect(h.view().view.selectedDate).toBe("2026-11-02");
    h.model.retire();
    expect(h.render().props.refreshComparison).toBeNull();
  });
  it("passes the current packet, resolved date and exact note context through the managed-only slot", async () => {
    const h = harness();
    await h.model.load();
    h.view().onDateChange("2026-11-02");
    h.view().onQueryChange("  NOVEMBER ");
    const node = h.render();
    const slot = node.props.noteAction as React.ReactElement<
      React.ComponentProps<typeof ManagedBeaReleaseNoteAction>
    >;
    expect(slot.type).toBe(ManagedBeaReleaseNoteAction);
    expect(slot.props.state).toBe(h.model.getSnapshot());
    expect(slot.props.view.selectedDate).toBe("2026-11-02");
    expect(slot.props.view).toBe(node.props.filterView!.view);
    expect(slot.props.view.response).toBe(h.agenda);
    expect(slot.props.view.query).toBe("  NOVEMBER ");
    expect(slot.props.view.visibleGroups[0]!.events[0]).toBe(
      h.agenda.events[1],
    );
    expect(h.view().view).toBe(slot.props.view);
    expect(slot.props.actions).toBe(h.noteContext.actions);
    expect(slot.props.members).toBe(h.noteContext.members);
    expect(slot.props.onReview).toBe(h.noteContext.onReview);
    expect(h.noteContext.actions.append).not.toHaveBeenCalled();
    expect(h.read).toHaveBeenCalledOnce();
  });
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
    expect(view.props.filterView?.view.selectedDate).toBe("2026-10-30");
    expect(h.read).toHaveBeenCalledOnce();
  });
  it("starts unloaded without a read; explicit load permits local date selection and All loaded dates", async () => {
    const h = harness();
    expect(h.html()).not.toContain('id="managed-bea-release-date"');
    expect(h.read).not.toHaveBeenCalled();
    await h.model.load();
    expect(h.view().view.selectedDate).toBe("");
    expect(h.view().resetNotice).toBe(false);
    const focus = vi.fn();
    vi.stubGlobal("document", { activeElement: { focus } });
    h.view().onDateChange("2026-10-30");
    expect(h.view().view.selectedDate).toBe("2026-10-30");
    expect(h.html()).toContain("1 of 2 loaded BEA releases.");
    expect(h.html()).not.toContain("Invented November release");
    h.view().onDateChange("");
    expect(h.html()).toContain("Invented November release");
    expect(h.model.getSnapshot().agenda).toBe(h.agenda);
    expect(h.read).toHaveBeenCalledOnce();
    expect(focus).not.toHaveBeenCalled();
  });
  it.each(["unavailable", "invalid_response"] as const)(
    "retains both filters and original clocks through pending and %s",
    async (code) => {
      const h = harness();
      await h.model.load();
      h.view().onDateChange("2026-10-30");
      h.view().onQueryChange(" OCTOBER ");
      const view = h.view().view;
      const held = deferred<PersonalEconomicCalendarDto>();
      h.read.mockReturnValueOnce(held.promise);
      const pending = h.model.load();
      expect(h.view().view.selectedDate).toBe("2026-10-30");
      expect(h.view().view).toBe(view);
      expect(h.render().props.showingPrevious).toBe(true);
      held.reject(new TrialApiError(code));
      await pending;
      expect(h.view().view.selectedDate).toBe("2026-10-30");
      expect(h.view().view).toBe(view);
      expect(h.view().view.query).toBe(" OCTOBER ");
      expect(h.render().props.agenda).toBe(h.agenda);
      expect(h.html()).toContain("Tue, Oct 20, 2026, 2:00 PM EDT");
      expect(h.read).toHaveBeenCalledTimes(2);
    },
  );
  it("retains the date after keyboard Cancel, restores Load focus and ignores a late authentication failure", async () => {
    const h = harness();
    await h.model.load();
    h.view().onDateChange("2026-10-30");
    h.view().onQueryChange("october");
    const view = h.view().view;
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
    expect(h.view().view.selectedDate).toBe("2026-10-30");
    expect(h.view().view).toBe(view);
    expect(load.focus).toHaveBeenCalledOnce();
    expect(h.read.mock.calls[1]![0].aborted).toBe(true);
    held.reject(new TrialApiError("unauthenticated"));
    await pending;
    expect(h.view().view.selectedDate).toBe("2026-10-30");
    expect(h.view().view.query).toBe("october");
    expect(h.view().view).toBe(view);
    expect(h.retired).not.toHaveBeenCalled();
    expect(h.read).toHaveBeenCalledTimes(2);
  });
  it.each(["equal", "empty"])(
    "resets on a successful %s replacement and fences its preceding callback before rerender",
    async (kind) => {
      const h = harness();
      await h.model.load();
      h.view().onDateChange("2026-10-30");
      h.view().onQueryChange("october");
      const old = h.view().onDateChange;
      const oldQuery = h.view().onQueryChange;
      const replacement = parseManagedEconomicCalendar({
        ...h.agenda,
        events: kind === "empty" ? [] : h.agenda.events,
      })!;
      expect(replacement).not.toBe(h.agenda);
      h.read.mockResolvedValueOnce(replacement);
      await h.model.load();
      const before = hooks.states[0];
      old("2026-11-02");
      oldQuery("november");
      expect(hooks.states[0]).toBe(before);
      expect(h.view().view.selectedDate).toBe("");
      expect(h.view().view.query).toBe("");
      expect(h.view().view.response).toBe(replacement);
      expect(h.view().resetNotice).toBe(true);
      expect(h.html()).toContain(
        "Agenda response changed; showing all loaded releases.",
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
    expect(h.view().view.selectedDate).toBe("2026-10-30");
    h.view().onDateChange("2026-10-29");
    expect(h.view().view.selectedDate).toBe("2026-10-30");
    expect(h.read).toHaveBeenCalledOnce();
  });
  it("preserves a mounted choice through leave/enter without reading, but resets when unmounted", async () => {
    const h = harness();
    await h.model.load();
    h.view().onDateChange("2026-11-02");
    h.view().onQueryChange("november");
    h.model.leave();
    h.model.enter();
    expect(h.view().view.selectedDate).toBe("2026-11-02");
    expect(h.view().view.query).toBe("november");
    expect(h.read).toHaveBeenCalledOnce();
    const stale = h.view().onDateChange;
    const staleQuery = h.view().onQueryChange;
    h.unmount();
    const before = hooks.states[0];
    stale("2026-10-30");
    staleQuery("october");
    expect(hooks.states[0]).toBe(before);
    hooks.states = [];
    hooks.refs = [];
    hooks.memos = [];
    expect(h.view().view.selectedDate).toBe("");
    expect(h.view().view.query).toBe("");
    expect(h.view().resetNotice).toBe(false);
    expect(h.read).toHaveBeenCalledOnce();
  });
  it("clears on retirement and rejects an old handler even before its next render", async () => {
    const h = harness();
    await h.model.load();
    h.view().onDateChange("2026-10-30");
    h.view().onQueryChange("october");
    const old = h.view().onDateChange;
    const oldQuery = h.view().onQueryChange;
    h.model.retire();
    const before = hooks.states[0];
    old("2026-11-02");
    oldQuery("november");
    expect(hooks.states[0]).toBe(before);
    expect(h.render().props.agenda).toBeNull();
    expect(h.view().view.selectedDate).toBe("");
    expect(h.view().view.query).toBe("");
    expect(h.html()).not.toContain('id="managed-bea-release-date"');
    expect(h.read).toHaveBeenCalledOnce();
  });
  it("resets when the model owner changes even with the same packet object", async () => {
    const h = harness();
    await h.model.load();
    h.view().onDateChange("2026-10-30");
    h.view().onQueryChange("october");
    const old = h.view().onDateChange;
    const oldQuery = h.view().onQueryChange;
    const other = new Model(
      vi.fn<ManagedApi["economicCalendar"]>().mockResolvedValue(h.agenda),
      vi.fn(),
    );
    await other.load();
    const next = h.render(other).props.filterView!.view;
    expect(next.selectedDate).toBe("");
    expect(next.query).toBe("");
    const before = hooks.states[0];
    old("2026-11-02");
    oldQuery("november");
    expect(hooks.states[0]).toBe(before);
  });

  it("keeps date and query independent, including Clear, without reading, appending or moving focus", async () => {
    const h = harness();
    await h.model.load();
    const focus = vi.fn();
    const scrollIntoView = vi.fn();
    vi.stubGlobal("document", { activeElement: { focus, scrollIntoView } });
    h.view().onQueryChange("  nOvEmBeR \t");
    expect(h.view().view.visibleCount).toBe(1);
    h.view().onDateChange("2026-10-30");
    expect(h.view().view.visibleCount).toBe(0);
    expect(h.view().view.query).toBe("  nOvEmBeR \t");
    expect(h.view().view.groups).toHaveLength(2);
    h.view().onQueryChange("");
    expect(h.view().view.selectedDate).toBe("2026-10-30");
    expect(h.view().view.visibleGroups[0]!.events[0]).toBe(h.agenda.events[0]);
    h.view().onDateChange("");
    expect(h.view().view.visibleCount).toBe(2);
    expect(h.model.getSnapshot().agenda).toBe(h.agenda);
    expect(h.read).toHaveBeenCalledOnce();
    expect(h.noteContext.actions.append).not.toHaveBeenCalled();
    expect(h.noteContext.onReview).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it.each(["query", "date"] as const)(
    "rejects old handlers before and after a newer %s choice commits",
    async (first) => {
      const h = harness();
      await h.model.load();
      const old = h.view();
      if (first === "query") old.onQueryChange("november");
      else old.onDateChange("2026-10-30");
      const before = hooks.states[0];
      old.onQueryChange("october");
      old.onDateChange("2026-11-02");
      expect(hooks.states[0]).toBe(before);
      h.render();
      old.onQueryChange("income");
      old.onDateChange("");
      expect(hooks.states[0]).toBe(before);
      expect(h.view().view.query).toBe(first === "query" ? "november" : "");
      expect(h.view().view.selectedDate).toBe(
        first === "date" ? "2026-10-30" : "",
      );
      expect(h.read).toHaveBeenCalledOnce();
    },
  );

  it("keeps reading filters usable while note editing is paused", async () => {
    const h = harness();
    await h.model.load();
    h.noteContext.editable = false;
    h.view().onQueryChange("november");
    h.view().onDateChange("2026-11-02");
    const node = h.render();
    const slot = node.props.noteAction as React.ReactElement<
      React.ComponentProps<typeof ManagedBeaReleaseNoteAction>
    >;
    expect(slot.props.editable).toBe(false);
    expect(slot.props.view).toBe(node.props.filterView!.view);
    expect(slot.props.view.visibleCount).toBe(1);
    expect(h.read).toHaveBeenCalledOnce();
    expect(h.noteContext.actions.append).not.toHaveBeenCalled();
    expect(h.noteContext.onReview).not.toHaveBeenCalled();
  });
});
