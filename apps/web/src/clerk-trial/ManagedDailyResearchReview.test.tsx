import { ManagedMarketsDatedChecks } from "./ManagedMarketsDatedChecks";
import { ManagedFollowupAssessment } from "./ManagedFollowupAssessment";
import { ManagedResearchFollowup } from "./ManagedResearchFollowup";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
import { ManagedWorkspaceScreen } from "./ManagedWorkspaceScreen";
import { ManagedResearchFollowups } from "./ManagedResearchFollowups";
import { ManagedFollowupsEntry } from "./ManagedFollowupsEntry";
import { ManagedDailyResearchReview } from "./ManagedDailyResearchReview";
import { ManagedWatchlistEditor } from "./ManagedWatchlistEditor";
import { ManagedNoteEditor } from "./ManagedNoteEditor";
import { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import { ManagedCompanyEvidenceActions } from "./ManagedCompanyEvidenceActions";

// Invoke real product control callbacks; keep per-component hook state between renders.
// This checks behavior, not browser layout, focus, or React's mounting implementation.
const hooks = vi.hoisted(() => ({
  key: "",
  index: 0,
  refIndex: 0,
  layout: [] as Array<() => void>,
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
  useLayoutEffect: (effect: () => void) => {
    hooks.layout.push(effect);
  },
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
  hooks.layout = [];
  return component(props);
}
function nodes(
  node: React.ReactNode,
): React.ReactElement<Record<string, unknown>>[] {
  return React.Children.toArray(node).flatMap((item) => {
    if (!React.isValidElement<Record<string, unknown>>(item)) return [];
    if (item.type === ManagedMarketsDatedChecks) {
      return [
        item,
        ...nodes(
          ManagedMarketsDatedChecks(
            item.props as unknown as React.ComponentProps<
              typeof ManagedMarketsDatedChecks
            >,
          ),
        ),
      ];
    }
    if (item.type === ManagedFollowupAssessment) {
      return nodes(
        ManagedFollowupAssessment(
          item.props as React.ComponentProps<typeof ManagedFollowupAssessment>,
        ),
      );
    }
    return [item, ...nodes(item.props.children as React.ReactNode)];
  });
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
        researchCoverage: inventedManagedResearchCoverage,
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
  const daily = () =>
    render(
      "daily",
      ManagedDailyResearchReview,
      child(screen(), ManagedDailyResearchReview),
    );
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
    if (!workspace.followups.coordinator.getSnapshot().draft) await load();
    change(followups(), "managed-followups-member", "listing-zero");
    change(followups(), "managed-followups-new-due", "2026-10-15");
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
    daily,
    entry,
    idle,
    load,
    note,
    create,
    workspace: () => workspace,
  };
}

it("connects an explicit Markets load to exact review, one source read, Back, completion and independent save/reload", async () => {
  const f = await setup();
  expect(renderToStaticMarkup(f.daily())).toContain("Follow-ups not loaded.");
  expect(f.controls.getSnapshot().load).toBe(0);
  click(f.daily(), "managed-daily-followups-load");
  await f.idle();
  expect(renderToStaticMarkup(f.daily())).toContain(
    "No follow-ups in this draft.",
  );
  f.note("Unsaved watchlist · café 東京 📈");
  await f.create();
  const rawCheck = f.entry().check;
  const beforeWatchlist = f.workspace().coordinator.getSnapshot().draft;
  const beforeFollowups = f
    .workspace()
    .followups.coordinator.getSnapshot().draft;
  click(f.screen(), "Markets");
  expect(renderToStaticMarkup(f.daily())).toContain(rawCheck);
  expect(renderToStaticMarkup(f.daily())).toContain("1 due");
  expect(renderToStaticMarkup(f.daily())).toContain(
    "Unsaved follow-up changes.",
  );
  click(f.daily(), `managed-daily-review-${f.entry().id}`);
  expect(f.workspace().getSnapshot().view).toBe("followups");
  expect(f.workspace().followups.getSnapshot()).toMatchObject({
    selectedId: f.entry().id,
    filter: "open",
  });
  expect(f.workspace().followups.coordinator.getSnapshot().draft).toBe(
    beforeFollowups,
  );
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
  const research = () =>
    render(
      "research",
      ManagedCompanyResearch,
      child(f.screen(), ManagedCompanyResearch),
    );
  const sourceTree = render(
    "sources",
    ManagedCompanyEvidenceActions,
    child(research(), ManagedCompanyEvidenceActions),
  );
  const sourceControls = nodes(sourceTree)
    .filter((node) => typeof node.type === "function")
    .map((node) =>
      (node.type as (props: Record<string, unknown>) => React.ReactNode)(
        node.props,
      ),
    );
  click(sourceControls, "Load Annual");
  await vi.waitFor(() =>
    expect(f.workspace().annual.getSnapshot().response).not.toBeNull(),
  );
  const response = f.workspace().annual.getSnapshot().response;
  expect(response?.evidence.generation.completedAt).toBe(
    "2026-09-20T00:00:02.000Z",
  );
  click(research(), "Back to workspace");
  expect(f.workspace().followups.coordinator.getSnapshot().draft).toBe(
    beforeFollowups,
  );
  expect(f.workspace().coordinator.getSnapshot().draft).toBe(beforeWatchlist);
  change(
    f.followups(),
    "managed-followup-result",
    "My assessment · source reviewed 財報",
  );
  click(f.followups(), "managed-followup-complete");
  click(f.screen(), "Markets");
  expect(renderToStaticMarkup(f.daily())).toContain(
    "0 due · 0 later · 1 completed",
  );
  expect(f.controls.getSnapshot()).toMatchObject({ save: 0, commits: 0 });
  click(f.daily(), "managed-daily-followups-manage");
  click(f.followups(), "managed-followups-save");
  await f.idle();
  expect(f.workspace().coordinator.getSnapshot().draft).toBe(beforeWatchlist);
  await f.mount(true);
  click(f.daily(), "managed-daily-followups-load");
  await f.idle();
  expect(f.entry()).toMatchObject({
    status: "completed",
    completedOn: "2026-10-15",
    result: "My assessment · source reviewed 財報",
  });
  expect(renderToStaticMarkup(f.daily())).toContain(
    "0 due · 0 later · 1 completed",
  );
  expect(f.controls.getSnapshot()).toMatchObject({
    load: 2,
    save: 1,
    commits: 1,
  });
  expect(f.fixture.getSnapshot()).toMatchObject({
    resolve: 1,
    annual: 1,
    eod: 0,
    filings: 0,
    save: 0,
  });
});

it("shares one captured UTC day through remounts and reassesses without reads or writes", async () => {
  const f = await setup();
  await f.create();
  click(f.screen(), "Markets");
  vi.setSystemTime(new Date("2026-10-16T00:00:01Z"));
  expect(renderToStaticMarkup(f.daily())).toContain('dateTime="2026-10-15"');
  const before = f.controls.getSnapshot();
  click(f.daily(), "managed-daily-followups-reassess");
  expect(renderToStaticMarkup(f.daily())).toContain('aria-label="Overdue"');
  click(f.daily(), "managed-daily-followups-manage");
  expect(renderToStaticMarkup(f.followups())).toContain(
    'dateTime="2026-10-16"',
  );
  expect(f.controls.getSnapshot()).toBe(before);
  f.workspace().followups.reassessDueDate(new Date("invalid"));
  click(f.screen(), "Markets");
  expect(renderToStaticMarkup(f.daily())).toContain(
    "Due status is unavailable",
  );
  expect(renderToStaticMarkup(f.daily())).not.toContain('aria-label="Overdue"');
});

it("retains raw invalid authorship and gives invalid dates an exact correction path", async () => {
  const f = await setup();
  await f.create();
  change(f.followups(), "managed-followup-check", "raw \ud800 question");
  change(f.followups(), "managed-followup-due", "2026-02-29");
  const raw = f.entry();
  click(f.screen(), "Markets");
  const daily = f.daily();
  expect(text(daily)).toContain("raw \ud800 question");
  expect(text(daily)).toContain(
    "0 due · 0 later · 0 completed · 1 need a valid due date",
  );
  expect(text(daily)).toContain("2026-02-29");
  click(daily, `managed-daily-review-${raw.id}`);
  expect(f.entry()).toBe(raw);
  expect(control(f.followups(), "managed-followup-due").props.value).toBe(
    "2026-02-29",
  );
  expect(control(f.followups(), "managed-followups-save").props.disabled).toBe(
    true,
  );
});

it("opens a completed check with an invalid due date without reopening or hiding it", async () => {
  const f = await setup();
  await f.create();
  change(f.followups(), "managed-followup-result", "My recorded assessment");
  click(f.followups(), "managed-followup-complete");
  change(f.followups(), "managed-followups-filter", "completed");
  change(f.followups(), "managed-followup-due", "2026-02-29");
  const entry = f.entry();
  const draft = f.workspace().followups.coordinator.getSnapshot().draft;
  click(f.screen(), "Markets");
  expect(text(f.daily())).toContain("Needs a valid due date");
  click(f.daily(), `managed-daily-review-${entry.id}`);
  expect(f.workspace().followups.getSnapshot()).toMatchObject({
    selectedId: entry.id,
    filter: "completed",
  });
  expect(f.workspace().followups.coordinator.getSnapshot().draft).toBe(draft);
  expect(f.entry()).toBe(entry);
  const editor = f.followups();
  expect(control(editor, "managed-followup-editor-heading")).toBeDefined();
  expect(control(editor, "managed-followup-due").props.value).toBe(
    "2026-02-29",
  );
  expect(control(editor, "managed-followup-result").props.value).toBe(
    "My recorded assessment",
  );
  expect(control(editor, "managed-followups-save").props.disabled).toBe(true);
  change(editor, "managed-followup-due", "2026-10-14");
  expect(f.entry()).toMatchObject({
    status: "completed",
    completedOn: "2026-10-15",
    result: "My recorded assessment",
    dueOn: "2026-10-14",
  });
  expect(control(f.followups(), "managed-followups-save").props.disabled).toBe(
    false,
  );
  expect(f.controls.getSnapshot()).toMatchObject({ save: 0, commits: 0 });
  expect(f.fixture.getSnapshot()).toMatchObject({
    resolve: 0,
    annual: 0,
    eod: 0,
    filings: 0,
    save: 0,
  });
});

it("retains its draft after failed/latest reads and routes conflicts and uncertain saves to the existing recovery", async () => {
  const f = await setup();
  await f.create();
  const draft = f.workspace().followups.coordinator.getSnapshot().draft;
  click(f.screen(), "Markets");
  f.controls.setNextRead("fail");
  click(f.daily(), "managed-daily-followups-load");
  await f.idle();
  expect(f.workspace().followups.coordinator.getSnapshot().draft).toBe(draft);
  expect(renderToStaticMarkup(f.daily())).toContain("1 due");
  expect(f.workspace().followups.coordinator.getSnapshot().message).toMatch(
    /failed|could not|unavailable/i,
  );
  click(f.daily(), "managed-daily-followups-load");
  await f.idle();
  expect(renderToStaticMarkup(f.daily())).toContain(
    "This queue continues to show your draft",
  );
  click(f.daily(), "managed-daily-followups-manage");
  click(f.followups(), "managed-followups-keep-draft");
  f.controls.setNextSave("lost-ack");
  click(f.followups(), "managed-followups-save");
  await f.idle();
  click(f.screen(), "Markets");
  expect(renderToStaticMarkup(f.daily())).toContain("save is uncertain");
  expect(
    control(f.daily(), "managed-daily-followups-load").props.disabled,
  ).toBe(true);
  click(f.daily(), "managed-daily-followups-manage");
  click(f.followups(), "managed-followups-reconcile");
  await f.idle();
  click(f.screen(), "Markets");
  expect(renderToStaticMarkup(f.daily())).toContain(
    "original save is confirmed",
  );
  expect(f.controls.getSnapshot()).toMatchObject({ commits: 1, replays: 1 });
});

it("retirement aborts a held explicit load and fences its late response and stale queue actions", async () => {
  const f = await setup();
  await f.create();
  click(f.screen(), "Markets");
  const row = control(f.daily(), `managed-daily-review-${f.entry().id}`);
  f.controls.setNextRead("hold");
  click(f.daily(), "managed-daily-followups-load");
  expect(f.controls.getSnapshot().held).toBe(1);
  f.workspace().sessionOwner.retire("Invented expiry");
  f.controls.settleHeld();
  await Promise.resolve();
  await Promise.resolve();
  (row.props.onClick as () => void)();
  expect(f.workspace().followups.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace().followups.getSnapshot().assessmentTime).toBeNull();
  expect(f.workspace().getSnapshot().research).toBeNull();
  expect(f.controls.getSnapshot()).toMatchObject({
    aborted: 1,
    settled: 1,
    save: 0,
  });
});

it("accepts the normal workspace-route readiness transition and fences later navigation", async () => {
  const f = await setup();
  await f.create();
  click(f.screen(), "Markets");
  const workspace = f.workspace();
  const entry = f.entry();
  const request = workspace.reviewFollowup(entry, () => {
    workspace.setNavigationBlocked(true);
    workspace.setView("followups");
    workspace.setNavigationBlocked(false);
    return true;
  });
  expect(request?.entry).toBe(entry);
  expect(request?.isCurrent()).toBe(true);
  workspace.setNavigationBlocked(true);
  workspace.setNavigationBlocked(false);
  expect(request?.isCurrent()).toBe(false);
  expect(f.controls.getSnapshot()).toMatchObject({ save: 0, commits: 0 });
});

it.each(["draft", "retire", "view", "pending", "selection"] as const)(
  "refuses a stale or reentrant %s review handoff",
  async (mode) => {
    const f = await setup();
    await f.create();
    click(f.screen(), "Markets");
    const entry = f.entry();
    const workspace = f.workspace();
    let stop = () => {};
    if (mode === "selection")
      stop = workspace.followups.subscribe(() => {
        if (workspace.followups.getSnapshot().selectedId === entry.id) {
          stop();
          workspace.setView("markets");
        }
      });
    const request = workspace.reviewFollowup(entry, () => {
      workspace.setView("followups");
      if (mode === "draft")
        workspace.followups.edit(entry, "check", "Replacement question");
      if (mode === "retire") workspace.sessionOwner.retire("Invented expiry");
      if (mode === "view") {
        workspace.setView("markets");
        workspace.setView("followups");
      }
      if (mode === "pending") workspace.setNavigationBlocked(true);
      return true;
    });
    expect(request).toBeNull();
    stop();
    expect(f.fixture.getSnapshot()).toMatchObject({
      resolve: 0,
      annual: 0,
      eod: 0,
      filings: 0,
      save: 0,
    });
    expect(f.controls.getSnapshot().save).toBe(0);
  },
);

it("focuses only the committed exact editor and stops scrolling if focus retires its session", async () => {
  const f = await setup();
  await f.create();
  click(f.screen(), "Markets");
  click(f.daily(), `managed-daily-review-${f.entry().id}`);
  void f.followups();
  const effects = [...hooks.layout];
  const document = { activeElement: null as unknown };
  const target = {
    isConnected: true,
    closest: () => null,
    getClientRects: () => [{}],
    ownerDocument: document,
    focus: vi.fn(() => {
      document.activeElement = target;
    }),
    scrollIntoView: vi.fn(),
  };
  hooks.refs.get(`followups-${f.controls.getSnapshot().session}`)![0]!.current =
    target;
  effects.forEach((effect) => effect());
  expect(target.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  expect(target.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
    block: "start",
    behavior: "instant",
  });
  target.scrollIntoView.mockClear();
  target.focus.mockImplementation(() => {
    f.workspace().sessionOwner.retire("Focus changed session");
  });
  effects.forEach((effect) => effect());
  expect(target.scrollIntoView).not.toHaveBeenCalled();
});

it("keeps removed and old-catalog checks readable without ticker transfer or a research resolve", async () => {
  const f = await setup();
  await f.create();
  const coordinator = f.workspace().followups.coordinator;
  const draft = coordinator.getSnapshot().draft!;
  coordinator.replaceDraft({
    ...draft,
    entries: [
      {
        ...draft.entries[0]!,
        catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
      },
    ],
  });
  const watchlist = f.workspace().coordinator.getSnapshot().draft!;
  f.workspace().coordinator.replaceDraft({ ...watchlist, memberships: [] });
  click(f.screen(), "Markets");
  expect(renderToStaticMarkup(f.daily())).toContain(
    "Older or unavailable catalog identity",
  );
  click(f.daily(), `managed-daily-review-${f.entry().id}`);
  expect(
    control(f.followups(), `managed-followup-research-${f.entry().id}`).props
      .disabled,
  ).toBe(true);
  expect(f.workspace().followups.getSnapshot().selectedId).toBe(f.entry().id);
  expect(f.fixture.getSnapshot()).toMatchObject({
    resolve: 0,
    annual: 0,
    eod: 0,
    filings: 0,
    save: 0,
  });
});

it("stale row callbacks cannot select a replacement draft or run while navigation is pending", async () => {
  const f = await setup();
  await f.create();
  click(f.screen(), "Markets");
  const stale = control(f.daily(), `managed-daily-review-${f.entry().id}`);
  f.workspace().followups.edit(f.entry(), "check", "new question");
  (stale.props.onClick as () => void)();
  expect(f.workspace().getSnapshot().view).toBe("markets");
  f.workspace().setNavigationBlocked(true);
  click(f.daily(), `managed-daily-review-${f.entry().id}`);
  expect(f.workspace().getSnapshot().view).toBe("markets");
  f.workspace().setNavigationBlocked(false);
  click(f.daily(), `managed-daily-review-${f.entry().id}`);
  expect(f.workspace().getSnapshot().view).toBe("followups");
});

it("states matching versions once and keeps explicit draft and saved versions when a latest read differs", async () => {
  const f = await setup();
  const status = () => {
    const node = nodes(f.daily()).find(
      (item) =>
        item.props.className === "managed-daily-research-status" &&
        item.props.role === "status",
    );
    if (!node) throw new Error("Missing queue status");
    return text(node.props.children as React.ReactNode).trim();
  };
  const coordinator = f.workspace().followups.coordinator;
  expect(status()).toBe(
    `Follow-ups not loaded. ${coordinator.getSnapshot().message}`,
  );
  click(f.daily(), "managed-daily-followups-load");
  await f.idle();
  expect(coordinator.getSnapshot()).toMatchObject({
    baseVersion: 0,
    saved: { version: 0 },
    dirty: false,
    message: "Loaded version 0.",
  });
  expect(status()).toBe("Loaded version 0.");
  await f.create();
  click(f.screen(), "Markets");
  expect(status()).toBe(
    `Unsaved follow-up changes. ${coordinator.getSnapshot().message}`,
  );
  expect(status().match(/version 0/gu)).toHaveLength(1);
  f.controls.setNextRead("fail");
  click(f.daily(), "managed-daily-followups-load");
  await f.idle();
  expect(status()).toBe(
    `Unsaved follow-up changes. ${coordinator.getSnapshot().message}`,
  );
  expect(status()).toContain("could not be loaded");
  click(f.daily(), "managed-daily-followups-manage");
  f.controls.setNextSave("conflict");
  click(f.followups(), "managed-followups-save");
  await f.idle();
  click(f.screen(), "Markets");
  expect(status()).toBe(
    `Unsaved follow-up changes. ${coordinator.getSnapshot().message}`,
  );
  click(f.daily(), "managed-daily-followups-load");
  await f.idle();
  expect(coordinator.getSnapshot()).toMatchObject({
    baseVersion: 0,
    saved: { version: 1 },
    dirty: true,
    conflict: true,
  });
  expect(status()).toBe(
    `Current draft based on version 0. Loaded saved version 1. Unsaved follow-up changes. ${coordinator.getSnapshot().message}`,
  );
  expect(text(f.daily())).toContain(
    "Open Manage follow-ups to choose which version to keep. This queue continues to show your draft.",
  );
});

function companyAndCheck(
  f: Awaited<ReturnType<typeof setup>>,
  options: {
    navigationPending?: boolean;
    routeActive?: () => boolean;
    onReview?: () => void;
  } = {},
) {
  const research = () =>
    render(
      "assessment-company",
      ManagedCompanyResearch,
      child(f.screen(), ManagedCompanyResearch),
    );
  const check = () => {
    const props = child(research(), ManagedResearchFollowup);
    return render("assessment-check", ManagedResearchFollowup, {
      ...props,
      ...(options.navigationPending === undefined
        ? {}
        : { navigationPending: options.navigationPending }),
      ...(options.routeActive ? { routeActive: options.routeActive } : {}),
      ...(options.onReview ? { onReview: options.onReview } : {}),
    });
  };
  return { research, check };
}

async function openAssessmentCompany(f: Awaited<ReturnType<typeof setup>>) {
  await f.create();
  click(f.followups(), `managed-followup-research-${f.entry().id}`);
  await vi.waitFor(() =>
    expect(f.workspace().getSnapshot().research).not.toBeNull(),
  );
  return companyAndCheck(f);
}

it("authors the due check assessment beside its company evidence, then returns for completion and independent Save", async () => {
  const f = await setup();
  f.note("Independent Watchlist draft · 東京");
  const c = await openAssessmentCompany(f);
  const watchlist = f.workspace().coordinator.getSnapshot().draft;
  const entry = f.entry();
  const firstCheck = c.check();
  expect(renderToStaticMarkup(firstCheck)).toContain(entry.check);
  expect(renderToStaticMarkup(firstCheck)).toContain(
    `Due date (UTC): ${entry.dueOn}`,
  );
  expect(
    control(firstCheck, "managed-research-followup-assessment").props.open,
  ).toBeUndefined();
  const sourceTree = render(
    "assessment-sources",
    ManagedCompanyEvidenceActions,
    child(c.research(), ManagedCompanyEvidenceActions),
  );
  const sourceControls = nodes(sourceTree)
    .filter((node) => typeof node.type === "function")
    .map((node) =>
      (node.type as (props: Record<string, unknown>) => React.ReactNode)(
        node.props,
      ),
    );
  click(sourceControls, "Load Annual");
  await vi.waitFor(() =>
    expect(f.workspace().annual.getSnapshot().response).not.toBeNull(),
  );
  expect(
    f.workspace().annual.getSnapshot().response?.evidence.generation
      .completedAt,
  ).toBe("2026-09-20T00:00:02.000Z");
  const raw = "  My assessment · reviewed 財報 café 📈  ";
  const stale = control(c.check(), "managed-research-followup-result");
  change(c.check(), "managed-research-followup-result", raw);
  expect(f.entry()).toEqual({ ...entry, result: raw });
  expect(
    control(c.check(), "managed-research-followup-result").props.value,
  ).toBe(raw);
  expect(f.workspace().coordinator.getSnapshot().draft).toBe(watchlist);
  expect(f.controls.getSnapshot()).toMatchObject({ save: 0, commits: 0 });
  expect(f.fixture.getSnapshot()).toMatchObject({
    resolve: 1,
    annual: 1,
    eod: 0,
    filings: 0,
    save: 0,
  });
  click(c.check(), "managed-research-followup-review");
  expect(f.workspace().getSnapshot()).toMatchObject({
    view: "followups",
    research: null,
  });
  expect(f.workspace().followups.getSnapshot()).toMatchObject({
    selectedId: entry.id,
    filter: "open",
  });
  expect(control(f.followups(), "managed-followup-result").props.value).toBe(
    raw,
  );
  (
    stale.props.onChange as (event: {
      currentTarget: { value: string };
    }) => void
  )({ currentTarget: { value: "late stale result" } });
  expect(f.entry().result).toBe(raw);
  click(f.followups(), "managed-followup-complete");
  click(f.followups(), "managed-followups-save");
  await f.idle();
  expect(f.workspace().coordinator.getSnapshot().draft).toBe(watchlist);
  await f.mount(true);
  click(f.daily(), "managed-daily-followups-load");
  await f.idle();
  expect(f.entry()).toMatchObject({
    check: entry.check.trim(),
    result: raw.trim(),
    status: "completed",
    completedOn: "2026-10-15",
  });
  expect(f.controls.getSnapshot()).toMatchObject({ save: 1, commits: 1 });
  expect(f.fixture.getSnapshot()).toMatchObject({
    resolve: 1,
    annual: 1,
    eod: 0,
    filings: 0,
    save: 0,
  });
});

it("retains invalid contextual assessment text for correction and refuses the whole Follow-ups Save", async () => {
  const f = await setup();
  const c = await openAssessmentCompany(f);
  const raw = "📈".repeat(2001);
  change(c.check(), "managed-research-followup-result", raw);
  expect(f.entry().result).toBe(raw);
  const field = control(c.check(), "managed-research-followup-result");
  expect(field.props.value).toBe(raw);
  expect(field.props["aria-invalid"]).toBe(true);
  click(c.check(), "managed-research-followup-review");
  expect(control(f.followups(), "managed-followup-result").props.value).toBe(
    raw,
  );
  expect(control(f.followups(), "managed-followups-save").props.disabled).toBe(
    true,
  );
  expect(f.controls.getSnapshot()).toMatchObject({ save: 0, commits: 0 });
  expect(f.fixture.getSnapshot()).toMatchObject({
    annual: 0,
    eod: 0,
    filings: 0,
    save: 0,
  });
});

it("pauses contextual controls during external navigation and refuses retained callbacks after it stops being current", async () => {
  const f = await setup();
  await openAssessmentCompany(f);
  let routeActive = true;
  const onReview = vi.fn();
  const c = companyAndCheck(f, { routeActive: () => routeActive, onReview });
  const current = c.check();
  const raw = f.entry().result;
  routeActive = false;
  (
    control(current, "managed-research-followup-result").props
      .onChange as (event: { currentTarget: { value: string } }) => void
  )({ currentTarget: { value: "late route edit" } });
  (
    control(current, "managed-research-followup-review").props
      .onClick as () => void
  )();
  expect(f.entry().result).toBe(raw);
  expect(onReview).not.toHaveBeenCalled();
  const pending = companyAndCheck(f, {
    navigationPending: true,
    onReview,
  }).check();
  expect(
    control(pending, "managed-research-followup-result").props.readOnly,
  ).toBe(true);
  expect(
    control(pending, "managed-research-followup-review").props.disabled,
  ).toBe(true);
});
