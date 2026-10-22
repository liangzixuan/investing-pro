import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFixture } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { ManagedWorkspaceScreen } from "../../src/clerk-trial/ManagedWorkspaceScreen";
import { ManagedResearchFollowups } from "../../src/clerk-trial/ManagedResearchFollowups";
import { ManagedFollowupsEntry } from "../../src/clerk-trial/ManagedFollowupsEntry";
import { ManagedWatchlistEditor } from "../../src/clerk-trial/ManagedWatchlistEditor";
import { ManagedNoteEditor } from "../../src/clerk-trial/ManagedNoteEditor";
import { ManagedCompanyResearch } from "../../src/clerk-trial/ManagedCompanyResearch";
import { ManagedCompanyEvidenceActions } from "../../src/clerk-trial/ManagedCompanyEvidenceActions";

// Invoke real product control callbacks; keep per-component hook state between renders.
// This checks behavior, not browser layout, focus, or React's mounting implementation.
const hooks = vi.hoisted(() => ({
  key: "",
  index: 0,
  refIndex: 0,
  states: new Map<string, unknown[]>(),
  refs: new Map<string, Array<{ current: unknown }>>(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const values = hooks.states.get(hooks.key) ?? [];
    hooks.states.set(hooks.key, values);
    const index = hooks.index++;
    if (!(index in values))
      values[index] =
        typeof initial === "function" ? (initial as () => unknown)() : initial;
    return [
      values[index],
      (value: unknown) => {
        values[index] =
          typeof value === "function"
            ? (value as (old: unknown) => unknown)(values[index])
            : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const refs = hooks.refs.get(hooks.key) ?? [];
    hooks.refs.set(hooks.key, refs);
    return (refs[hooks.refIndex++] ??= { current: initial });
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
  useEffect: () => {},
  // This renderer does not mount effects or a native Back subscription.
  useEffectEvent: (callback: unknown) => callback,
  useLayoutEffect: () => {},
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
}));
const workspaces: ManagedWorkspace[] = [];
beforeEach(() => {
  hooks.states.clear();
  hooks.refs.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
});
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
  vi.useRealTimers();
});
function render<T>(
  key: string,
  component: (props: T) => React.ReactNode,
  props: T,
) {
  hooks.key = key;
  hooks.index = 0;
  hooks.refIndex = 0;
  return component(props);
}
function nodes(
  node: React.ReactNode,
): React.ReactElement<Record<string, unknown>>[] {
  return React.Children.toArray(node).flatMap((item) =>
    React.isValidElement<Record<string, unknown>>(item)
      ? [item, ...nodes(item.props.children as React.ReactNode)]
      : [],
  );
}
function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return React.Children.toArray(node)
    .map((item) =>
      React.isValidElement<{ children?: React.ReactNode }>(item)
        ? text(item.props.children)
        : typeof item === "string" || typeof item === "number"
          ? String(item)
          : "",
    )
    .join("");
}
function child<T>(
  node: React.ReactNode,
  component: (props: T) => React.ReactNode,
): T {
  const found = nodes(node).find((entry) => entry.type === component);
  if (!found)
    throw new Error(`Missing actual product component ${component.name}`);
  return found.props as T;
}
function control(node: React.ReactNode, key: string) {
  const found = nodes(node).find(
    (entry) =>
      entry.props.id === key ||
      (entry.type === "button" &&
        text(entry.props.children as React.ReactNode) === key),
  );
  if (!found) throw new Error(`Missing actual product control ${key}`);
  return found;
}
function click(node: React.ReactNode, key: string) {
  const button = control(node, key);
  expect(button.props.disabled).not.toBe(true);
  (
    button.props.onClick as (event: {
      currentTarget: HTMLButtonElement;
    }) => void
  )({
    currentTarget: {
      isConnected: true,
      focus: vi.fn(),
    } as unknown as HTMLButtonElement,
  });
}
function change(node: React.ReactNode, key: string, value: string) {
  const input = control(node, key);
  expect(input.props.disabled).not.toBe(true);
  expect(input.props.readOnly).not.toBe(true);
  (
    input.props.onChange as (event: {
      currentTarget: { value: string };
      target: { value: string };
    }) => void
  )({ currentTarget: { value }, target: { value } });
}
async function setup() {
  const fixture = await createFixture("research-followups");
  const controls = fixture.followups!;
  let workspace: ManagedWorkspace;
  async function mount(fresh = false) {
    if (fresh) workspace.sessionOwner.dispose();
    workspace = new ManagedWorkspace(
      fixture.api,
      fresh ? controls.nextSession() : fixture.session,
      undefined,
      {
        researchCoverage: fixture.researchCoverage,
        priceCoverage: fixture.priceCoverage,
        marketsCohort: fixture.marketsCohort,
      },
    );
    workspaces.push(workspace);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
  }
  await mount();
  const screen = () =>
    render(`screen-${controls.getSnapshot().session}`, ManagedWorkspaceScreen, {
      workspace,
    });
  const followups = () =>
    render(
      `followups-${controls.getSnapshot().session}`,
      ManagedResearchFollowups,
      child(
        ManagedFollowupsEntry(child(screen(), ManagedFollowupsEntry)),
        ManagedResearchFollowups,
      ),
    );
  const entry = () =>
    workspace.followups.coordinator.getSnapshot().draft!.entries[0]!;
  const idle = () =>
    vi.waitFor(() =>
      expect(workspace.followups.coordinator.getSnapshot().phase).toBe("idle"),
    );
  const load = async () => {
    click(followups(), "managed-followups-load");
    await idle();
  };
  const note = (value: string) => {
    click(screen(), "My Watchlist");
    const props = child(screen(), ManagedWatchlistEditor);
    const member = props.memberships[0]!;
    const actualField = ManagedNoteEditor({
      id: "invented-note",
      listingId: member.listingId,
      symbol: member.symbol,
      note: member.note,
      disabled: !props.editable,
      helpId: "invented-help",
      onChange: (raw) => props.onNote(member.listingId, raw),
    });
    change(actualField, "invented-note", value);
  };
  const create = async () => {
    click(screen(), "Follow-ups");
    await load();
    change(followups(), "managed-followups-member", "listing-zero");
    change(followups(), "managed-followups-new-due", "2026-10-16");
    click(followups(), "managed-followups-add");
    change(
      followups(),
      "managed-followup-check",
      "  Read annual cash flow · 财报 café 📈  ",
    );
  };
  return {
    fixture,
    controls,
    mount,
    screen,
    followups,
    entry,
    idle,
    load,
    note,
    create,
    workspace: () => workspace,
  };
}

it("uses real UI controls across three explicit sessions, independent saves and the P9 source visit", async () => {
  const f = await setup();
  expect(f.controls.getSnapshot()).toMatchObject({ load: 0, save: 0 });
  f.note("Unsaved watchlist · café 東京 📈");
  await f.create();
  expect(f.entry().check.startsWith("  Read")).toBe(true);
  const watchlist1 = f.workspace().coordinator.getSnapshot().draft;
  click(f.followups(), "managed-followups-save");
  await f.idle();
  expect(f.entry().check).toBe("Read annual cash flow · 财报 café 📈");
  expect(f.workspace().coordinator.getSnapshot().draft).toBe(watchlist1);
  expect(f.fixture.getSnapshot()).toMatchObject({
    save: 0,
    resolve: 0,
    annual: 0,
    eod: 0,
    filings: 0,
  });
  expect(f.controls.getSnapshot()).toMatchObject({ commits: 1, version: 1 });

  await f.mount(true);
  expect(f.workspace().followups.coordinator.getSnapshot().draft).toBeNull();
  expect(
    f.workspace().coordinator.getSnapshot().draft?.memberships[0]?.note,
  ).not.toBe("Unsaved watchlist · café 東京 📈");
  expect(f.controls.getSnapshot().load).toBe(1);
  f.note("Second unsaved watchlist · 東京 📈");
  click(f.screen(), "Follow-ups");
  await f.load();
  click(f.followups(), `managed-followup-select-${f.entry().id}`);
  change(f.followups(), "managed-followups-filter", "all");
  change(
    f.followups(),
    "managed-followup-result",
    "Unfinished assessment · 财报",
  );
  const beforeWatchlist = f.workspace().coordinator.getSnapshot().draft;
  const beforeFollowups = f
    .workspace()
    .followups.coordinator.getSnapshot().draft;
  const selected = f.workspace().followups.getSnapshot().selectedId;
  click(f.followups(), `managed-followup-research-${f.entry().id}`);
  await vi.waitFor(() =>
    expect(f.workspace().getSnapshot().research).not.toBeNull(),
  );
  expect(f.fixture.getSnapshot()).toMatchObject({
    resolve: 1,
    annual: 0,
    eod: 0,
    filings: 0,
    save: 0,
  });

  const sourceActions = () => {
    const research = render(
      "research",
      ManagedCompanyResearch,
      child(f.screen(), ManagedCompanyResearch),
    );
    const actions = render(
      "sources",
      ManagedCompanyEvidenceActions,
      child(research, ManagedCompanyEvidenceActions),
    );
    return nodes(actions)
      .filter((node) => typeof node.type === "function")
      .map((node) =>
        (node.type as (props: Record<string, unknown>) => React.ReactNode)(
          node.props,
        ),
      );
  };
  for (const [label, model] of [
    ["Load Price · One month", f.workspace().eod],
    ["Load Annual", f.workspace().annual],
    ["Load Filings", f.workspace().filings],
  ] as const) {
    click(sourceActions(), label);
    await vi.waitFor(() => expect(model.getSnapshot().response).not.toBeNull());
  }
  expect(f.fixture.getSnapshot()).toMatchObject({
    resolve: 1,
    annual: 1,
    eod: 1,
    filings: 1,
    save: 0,
  });
  const research = render(
    "research",
    ManagedCompanyResearch,
    child(f.screen(), ManagedCompanyResearch),
  );
  click(research, "Back to workspace");
  expect(f.workspace().getSnapshot().research).toBeNull();
  expect(f.workspace().followups.getSnapshot()).toMatchObject({
    selectedId: selected,
    filter: "all",
  });
  expect(f.workspace().coordinator.getSnapshot().draft).toBe(beforeWatchlist);
  expect(f.workspace().followups.coordinator.getSnapshot().draft).toBe(
    beforeFollowups,
  );
  change(
    f.followups(),
    "managed-followup-result",
    "My assessment · cash flow needs another review 财报",
  );
  click(f.followups(), "managed-followup-complete");
  expect(f.entry()).toMatchObject({
    status: "completed",
    completedOn: "2026-10-15",
  });
  expect(f.controls.getSnapshot().commits).toBe(1);
  click(f.followups(), "managed-followups-save");
  await f.idle();
  await f.mount(true);
  click(f.screen(), "Follow-ups");
  await f.load();
  change(f.followups(), "managed-followups-filter", "completed");
  expect(f.entry()).toMatchObject({
    status: "completed",
    completedOn: "2026-10-15",
    result: "My assessment · cash flow needs another review 财报",
  });
  expect(renderToStaticMarkup(f.followups())).toContain(
    "Read annual cash flow · 财报 café 📈",
  );
  expect(f.controls.getSnapshot()).toMatchObject({
    session: 3,
    load: 3,
    save: 2,
    commits: 2,
    version: 2,
    signOut: 0,
    token: 0,
  });
  expect(f.fixture.getSnapshot()).toMatchObject({
    load: 3,
    status: 3,
    save: 0,
    resolve: 1,
    annual: 1,
    eod: 1,
    filings: 1,
  });
});

it("keeps raw edits through real conflict and lost-ack recovery controls without saving My Watchlist", async () => {
  const f = await setup();
  f.note("Independent unsaved note");
  await f.create();
  change(f.followups(), "managed-followup-check", "Invalid\nraw 财报");
  expect(control(f.followups(), "managed-followups-save").props.disabled).toBe(
    true,
  );
  expect(control(f.followups(), "managed-followup-check").props.value).toBe(
    "Invalid\nraw 财报",
  );
  expect(f.controls.getSnapshot().save).toBe(0);
  change(
    f.followups(),
    "managed-followup-check",
    "  Read annual cash flow · 财报 café 📈  ",
  );
  const watchlist = f.workspace().coordinator.getSnapshot().draft;
  f.controls.setNextSave("conflict");
  click(f.followups(), "managed-followups-save");
  await f.idle();
  const raw = f.workspace().followups.coordinator.getSnapshot().draft;
  expect(f.workspace().followups.canEdit()).toBe(false);
  expect(control(f.followups(), "managed-followup-check").props.readOnly).toBe(
    true,
  );
  await f.load();
  click(f.followups(), "managed-followups-keep-draft");
  expect(f.workspace().followups.coordinator.getSnapshot().draft).toBe(raw);
  expect(f.entry().check).toBe("Read annual cash flow · 财报 café 📈");
  f.controls.setNextSave("lost-ack");
  click(f.followups(), "managed-followups-save");
  await f.idle();
  expect(f.workspace().followups.coordinator.getSnapshot().uncertain).toBe(
    true,
  );
  expect(f.controls.getSnapshot()).toMatchObject({ commits: 1, version: 2 });
  click(f.followups(), "managed-followups-reconcile");
  await f.idle();
  expect(f.workspace().followups.coordinator.getSnapshot().replayPending).toBe(
    true,
  );
  await f.load();
  click(f.followups(), "managed-followups-use-saved");
  expect(f.workspace().followups.coordinator.getSnapshot()).toMatchObject({
    dirty: false,
    uncertain: false,
    conflict: false,
    baseVersion: 2,
  });
  expect(f.workspace().coordinator.getSnapshot().draft).toBe(watchlist);
  expect(f.controls.getSnapshot()).toMatchObject({
    commits: 1,
    replays: 1,
    conflicts: 1,
  });
  expect(f.fixture.getSnapshot()).toMatchObject({
    save: 0,
    resolve: 0,
    annual: 0,
    eod: 0,
    filings: 0,
  });
});

it("a held committed acknowledgement cannot restore retired drafts and a new explicit Load sees the commit", async () => {
  const f = await setup();
  await f.create();
  f.controls.setNextSave("hold");
  click(f.followups(), "managed-followups-save");
  expect(f.controls.getSnapshot()).toMatchObject({ held: 1, commits: 1 });
  const prior = f.workspace();
  await f.mount(true);
  click(f.screen(), "Follow-ups");
  await f.load();
  expect(f.entry().check).toBe("Read annual cash flow · 财报 café 📈");
  const loaded = f.workspace().followups.coordinator.getSnapshot();
  f.controls.settleHeld();
  await vi.waitFor(() =>
    expect(prior.followups.coordinator.getSnapshot().phase).toBe("retired"),
  );
  expect(prior.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace().followups.coordinator.getSnapshot()).toBe(loaded);
  expect(f.controls.getSnapshot()).toMatchObject({
    commits: 1,
    aborted: 1,
    settled: 1,
  });
  expect(f.fixture.getSnapshot().save).toBe(0);
});
