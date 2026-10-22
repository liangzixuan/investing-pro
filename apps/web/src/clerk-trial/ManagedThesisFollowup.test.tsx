import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedThesisFollowup } from "./ManagedThesisFollowup";
import { ManagedResearchFollowups } from "./managed-research-followups";
import { filingsSelection } from "./sec-filings-fixture";
import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import type { TrialSession } from "./session";

const hooks = vi.hoisted(() => ({
  direct: false,
  stateIndex: 0,
  refIndex: 0,
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  effects: [] as (() => (() => void) | void)[],
  cleanups: [] as (() => void)[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      if (!hooks.direct) return actual.useState(initial);
      const index = hooks.stateIndex++;
      if (!(index in hooks.states)) hooks.states[index] = initial;
      return [
        hooks.states[index],
        (value: unknown) => {
          hooks.states[index] = value;
        },
      ];
    },
    useRef: (initial: unknown) =>
      hooks.direct
        ? (hooks.refs[hooks.refIndex++] ??= { current: initial })
        : actual.useRef(initial),
    useLayoutEffect: (
      effect: () => void | (() => void),
      deps?: React.DependencyList,
    ) => {
      if (hooks.direct) hooks.effects.push(effect);
      else actual.useLayoutEffect(effect, deps);
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
  hooks.states = [];
  hooks.refs = [];
  hooks.effects = [];
  hooks.cleanups = [];
});
interface Props {
  id?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  onChange?: (event: { currentTarget: { value: string } }) => void;
  onToggle?: (event: { currentTarget: { open: boolean } }) => void;
}
function elements(node: React.ReactNode): React.ReactElement<Props>[] {
  return React.isValidElement<Props>(node)
    ? [node, ...React.Children.toArray(node.props.children).flatMap(elements)]
    : [];
}
async function fixture(loaded = true) {
  const member = {
    ...filingsSelection.listing,
    note: "Independent authored note",
  };
  const draft: MainWatchlistPayload = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: filingsSelection.catalogSnapshotSha256,
    memberships: [member],
  };
  const api = {
    loadFollowups: vi.fn().mockResolvedValue({
      version: 0,
      payload: { schemaVersion: 1, entries: [] },
    }),
    saveFollowups: vi.fn(),
    resolve: vi.fn(),
  };
  const session: TrialSession = {
    userId: "invented",
    sessionId: "invented",
    getToken: vi.fn(),
    signOut: vi.fn(),
  };
  const model = new ManagedResearchFollowups(api, session, {
    getCreationContext: () => ({
      draft,
      catalogSnapshotSha256: draft.snapshotSha256,
    }),
    onRetire: vi.fn(),
    newEntryId: () => "00000000-0000-4000-8000-000000000001",
  });
  if (loaded) await model.coordinator.load();
  const isCurrent = vi.fn(() => true);
  const context = { model, member, isCurrent };
  const render = (next = "  Cafe\u0301 東京 😀 next  ", disabled = false) => {
    hooks.direct = true;
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    for (const cleanup of hooks.cleanups) cleanup();
    hooks.cleanups = [];
    const node = ManagedThesisFollowup({ id: "qa", next, disabled, context });
    for (const effect of hooks.effects) {
      const cleanup = effect();
      if (cleanup) hooks.cleanups.push(cleanup);
    }
    hooks.effects = [];
    const all = elements(node);
    return {
      node,
      all,
      create: all.find((element) => element.props.id === "qa-followup-create")!,
      date: all.find((element) => element.props.id === "qa-followup-date")!,
      cancel: all.find(
        (element) =>
          element.type === "button" &&
          element.props.children === "Cancel follow-up",
      )!,
    };
  };
  const dated = () => {
    const first = render();
    first.date.props.onChange!({ currentTarget: { value: "2026-10-22" } });
    return render();
  };
  return { model, api, draft, context, render, dated, isCurrent };
}
describe("authored thesis next-check action", () => {
  it("keeps authored check and date through one explicit inline initial read and never reloads a draft", async () => {
    const f = await fixture(false);
    let resolve!: (value: unknown) => void;
    f.api.loadFollowups.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const initial = f.dated();
    const load = initial.all.find(
      (element) => element.props.id === "qa-followup-load",
    )!;
    expect(f.api.loadFollowups).not.toHaveBeenCalled();
    load.props.onClick!();
    expect(f.api.loadFollowups).toHaveBeenCalledOnce();
    const pending = f.render();
    expect(pending.date.props).toHaveProperty("value", "2026-10-22");
    expect(
      pending.all.find((element) => element.props.id === "qa-followup-check")!
        .props.children,
    ).toContain("東京 😀 next");
    expect(
      pending.all.find((element) => element.props.id === "qa-followup-load")!
        .props.disabled,
    ).toBe(true);
    load.props.onClick!();
    resolve({ version: 0, payload: { schemaVersion: 1, entries: [] } });
    await vi.waitFor(() =>
      expect(f.model.coordinator.getSnapshot().phase).toBe("idle"),
    );
    const ready = f.render();
    expect(
      ready.all.some((element) => element.props.id === "qa-followup-load"),
    ).toBe(false);
    expect(ready.create.props.disabled).toBe(false);
    ready.create.props.onClick!();
    expect(f.api.loadFollowups).toHaveBeenCalledOnce();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(f.api.resolve).not.toHaveBeenCalled();
  });
  it("does not issue an inline read from an unmounted or stale host and retains fields after a failed read", async () => {
    const f = await fixture(false);
    const initial = f.dated();
    const load = initial.all.find(
      (element) => element.props.id === "qa-followup-load",
    )!;
    for (const cleanup of hooks.cleanups) cleanup();
    load.props.onClick!();
    expect(f.api.loadFollowups).not.toHaveBeenCalled();
    f.api.loadFollowups.mockRejectedValueOnce(
      new Error("Invented failed read"),
    );
    f.render().all.find((element) => element.props.id === "qa-followup-load")!
      .props.onClick!();
    await vi.waitFor(() =>
      expect(f.model.coordinator.getSnapshot().phase).toBe("idle"),
    );
    const failed = f.render();
    expect(failed.date.props).toHaveProperty("value", "2026-10-22");
    expect(failed.create.props.disabled).toBe(true);
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  });
  it("starts closed and requires an explicit date, then creates the entire displayed check without loading or saving", async () => {
    const f = await fixture();
    const initial = f.render();
    expect(initial.create.props.disabled).toBe(true);
    hooks.direct = false;
    const html = renderToStaticMarkup(
      <ManagedThesisFollowup
        id="qa"
        next="Check & assess"
        disabled={false}
        context={f.context}
      />,
    );
    expect(html).not.toContain("<details open");
    expect(html).toContain("Check &amp; assess");
    const current = f.dated();
    expect(current.create.props.disabled).toBe(false);
    current.create.props.onClick!();
    expect(f.model.coordinator.getSnapshot().draft!.entries[0]).toMatchObject({
      check: "Café 東京 😀 next",
      dueOn: "2026-10-22",
      listing: filingsSelection.listing,
    });
    expect(f.draft.memberships[0]!.note).toBe("Independent authored note");
    expect(f.api.loadFollowups).toHaveBeenCalledOnce();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(f.api.resolve).not.toHaveBeenCalled();
    expect(f.render().create.props.disabled).toBe(true);
  });
  it.each(["cancel", "close", "edit", "unmount", "host"])(
    "refuses an old rendered Create after %s",
    async (boundary) => {
      const f = await fixture();
      const current = f.dated();
      if (boundary === "cancel") current.cancel.props.onClick!();
      if (boundary === "close")
        current.all.find((element) => element.type === "details")!.props
          .onToggle!({ currentTarget: { open: false } });
      if (boundary === "edit") f.render("Changed next check");
      if (boundary === "unmount")
        for (const cleanup of hooks.cleanups) cleanup();
      if (boundary === "host") f.isCurrent.mockReturnValue(false);
      current.create.props.onClick!();
      expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
      expect(f.api.saveFollowups).not.toHaveBeenCalled();
      expect(f.api.resolve).not.toHaveBeenCalled();
    },
  );
  it("blocks paused or oversized text and shows the entire input for correction", async () => {
    const f = await fixture();
    f.dated();
    expect(f.render("Valid check", true).create.props.disabled).toBe(true);
    const long = "😀".repeat(501);
    const view = f.render(long);
    expect(view.create.props.disabled).toBe(true);
    expect(
      view.all.find((element) => element.props.id === "qa-followup-check")!
        .props.children,
    ).toBe(long);
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
  });
  it("uses the existing editable date pattern and retains invalid raw input for correction", async () => {
    const f = await fixture();
    const first = f.render();
    expect(first.date.props).toMatchObject({
      type: "text",
      placeholder: "YYYY-MM-DD",
    });
    first.date.props.onChange!({ currentTarget: { value: "2026-02-29" } });
    const invalid = f.render();
    expect(invalid.date.props).toMatchObject({
      value: "2026-02-29",
      "aria-invalid": true,
    });
    expect(invalid.create.props.disabled).toBe(true);
    invalid.date.props.onChange!({ currentTarget: { value: "2028-02-29" } });
    expect(f.render().create.props.disabled).toBe(false);
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  });
});
