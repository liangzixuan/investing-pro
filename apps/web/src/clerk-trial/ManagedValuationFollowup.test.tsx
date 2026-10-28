import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  WatchlistMembership,
  ResearchFollowup,
  ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import {
  ManagedValuationFollowup,
  type ManagedValuationFollowupActions,
} from "./ManagedValuationFollowup";
import {
  ManagedValuationWorkbench,
  type DcfField,
  type ExitField,
} from "./managed-valuation-workbench";
import { ManagedResearchFollowups } from "./managed-research-followups";
import {
  resolveValuationFollowupScenario,
  type ValuationFollowupPort,
} from "./managed-valuation-followup";
import { filingsSelection } from "./sec-filings-fixture";
import type { ManagedApi } from "./managed-api";
import type { TrialSession } from "./session";
const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  return { ...actual, ...createValuationDraftTestHooks(hooks) };
});
interface ElementProps {
  id?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  value?: string;
  ref?: { current: unknown };
  onClick?: (event?: { currentTarget: HTMLButtonElement }) => void;
  onChange?: (event: { currentTarget: { value: string } }) => void;
  onToggle?: (event: { currentTarget: { open: boolean } }) => void;
}
function elements(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  if (!React.isValidElement<ElementProps>(node)) return [];
  if (typeof node.type === "function")
    return elements(
      (node.type as (props: ElementProps) => React.ReactNode)(node.props),
    );
  return [
    node,
    ...React.Children.toArray(node.props.children).flatMap(elements),
  ];
}
function hasCleanup(slot: unknown): slot is { cleanup: () => void } {
  return Boolean(
    slot &&
    typeof slot === "object" &&
    "cleanup" in slot &&
    typeof slot.cleanup === "function",
  );
}
function unmount() {
  for (const slot of hooks.slots) {
    if (hasCleanup(slot)) slot.cleanup();
  }
}
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
});
afterEach(unmount);
const digest = filingsSelection.catalogSnapshotSha256;
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const original: ResearchFollowup = {
  id: id(1),
  catalogSnapshotSha256: digest,
  listing: { ...filingsSelection.listing, listingId: "listing-other" },
  check: "Keep the earlier question",
  dueOn: "2026-01-01",
  status: "completed",
  completedOn: "2026-01-02",
  result: "Keep the complete earlier assessment.",
};
function fill(valuation: ManagedValuationWorkbench) {
  for (const [field, value] of Object.entries({
    startingUnleveredCashFlowUsd: "100",
    enterpriseToEquityBridgeUsd: "0",
    dilutedShares: "10",
    waccPercent: "10",
    terminalGrowthPercent: "2",
  }))
    valuation.setDcfField(field as DcfField, value);
  for (const [field, value] of Object.entries({
    baseRevenue: "1000",
    cash: "20",
    debt: "10",
    dilutedShares: "10",
    discountRatePercent: "10",
  }))
    valuation.setExitField(field as ExitField, value);
  for (const scenario of ["conservative", "base", "expansion"] as const) {
    valuation.setDcfScenario(scenario, "5");
    valuation.setExitScenario(scenario, "annualRevenueGrowthPercent", "5");
    valuation.setExitScenario(scenario, "targetEbitdaMarginPercent", "20");
    valuation.setExitScenario(scenario, "exitMultiple", "10");
  }
}
interface Props {
  valuation: ManagedValuationWorkbench;
  actions: ManagedValuationFollowupActions;
  owner: object;
  navigationPending: boolean;
}
function renderer(props: Props) {
  const document = { activeElement: null as unknown };
  const nodes = new Map<
    string,
    {
      isConnected: boolean;
      ownerDocument: typeof document;
      focus: () => void;
      scrollIntoView: () => void;
    }
  >();
  function node(id: string) {
    if (!nodes.has(id)) {
      const element = {
        isConnected: true,
        ownerDocument: document,
        focus: vi.fn(() => {
          document.activeElement = element;
        }),
        scrollIntoView: vi.fn(),
      };
      nodes.set(id, element);
    }
    return nodes.get(id)!;
  }
  const render = (override: Partial<Props> = {}, commit = true) => {
    hooks.index = 0;
    hooks.effects = [];
    const tree = ManagedValuationFollowup({ ...props, ...override });
    const all = elements(tree);
    for (const element of all)
      if (element.props.ref)
        element.props.ref.current = node(
          element.props.id ?? String(element.type),
        );
    if (commit) for (const effect of hooks.effects) effect();
    return {
      all,
      html: load(renderToStaticMarkup(tree)),
      byId: (suffix: string) =>
        all.find(
          (element) => element.props.id === `valuation-followup-${suffix}`,
        ),
      close: () =>
        all.find(
          (element) => element.type === "details" && element.props.onToggle,
        )!.props.onToggle!({ currentTarget: { open: false } }),
    };
  };
  const edit = (field: string, value: string) =>
    render().byId(field)!.props.onChange!({ currentTarget: { value } });
  const written = () => {
    edit("model", "dcf");
    edit("scenario", "base");
    edit("question", "  Cafe\u0301 東京 😀 capacity?  ");
    edit("due", "2026-12-31");
    return render();
  };
  const previewed = () => {
    written().byId("preview")!.props.onClick!();
    return render();
  };
  return { render, edit, written, previewed, node, document };
}
interface FixtureActionsInput {
  model: ManagedResearchFollowups;
  valuation: ManagedValuationWorkbench;
  member: WatchlistMembership;
  lifetime: { current: boolean };
}
function fixtureCurrent(input: FixtureActionsInput) {
  return (
    input.lifetime.current &&
    !input.valuation.hasDraftFileActivity() &&
    !input.model.hasDraftFileActivity()
  );
}
function fixturePort(input: FixtureActionsInput): ValuationFollowupPort | null {
  const calculation = input.valuation.getSnapshot().calculation;
  if (!calculation) return null;
  if (!fixtureCurrent(input)) return null;
  return {
    model: input.model,
    member: input.member,
    calculation,
    isCurrent: () => fixtureCurrent(input),
  };
}
function fixtureActions(
  input: FixtureActionsInput,
): ManagedValuationFollowupActions {
  return {
    model: input.model,
    getContext: vi.fn(() => {
      const port = fixturePort(input);
      return { port, reason: port ? null : "The valuation is unavailable." };
    }),
    canLoad: () =>
      input.lifetime.current && input.model.canLoadForNextCheck(input.member),
    load: vi.fn<ManagedValuationFollowupActions["load"]>((current) =>
      input.model.loadForNextCheck(input.member, current),
    ),
  };
}
async function fixture(loaded = true) {
  const member = { ...filingsSelection.listing, note: "Keep Watchlist note" };
  const watchlist: MainWatchlistPayload = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: digest,
    memberships: [member],
  };
  let stored = {
    version: 1,
    payload: {
      schemaVersion: 1,
      entries: [original],
    } as ResearchFollowupsPayload,
  };
  const api = {
    loadFollowups: vi.fn<ManagedApi["loadFollowups"]>(() =>
      Promise.resolve(stored),
    ),
    saveFollowups: vi.fn<ManagedApi["saveFollowups"]>((command) => {
      stored = {
        version: command.expectedVersion + 1,
        payload: command.payload,
      };
      return Promise.resolve({ ...stored, replayed: false });
    }),
    resolve: vi.fn<ManagedApi["resolve"]>(),
  };
  const session: TrialSession = {
    userId: "invented",
    sessionId: "invented",
    getToken: vi.fn(),
    signOut: vi.fn(),
  };
  const makeModel = () =>
    new ManagedResearchFollowups(api, session, {
      getCreationContext: () => ({
        draft: watchlist,
        catalogSnapshotSha256: digest,
      }),
      onRetire: vi.fn(),
      newKey: () => id(99),
      newEntryId: () => id(2),
    });
  const model = makeModel();
  if (loaded) await model.coordinator.load();
  const valuation = new ManagedValuationWorkbench();
  valuation.activate(filingsSelection);
  fill(valuation);
  valuation.calculate();
  const calculate = vi.spyOn(valuation, "calculate");
  const lifetime = { current: true };
  const actions = fixtureActions({ model, valuation, member, lifetime });
  const props: Props = {
    valuation,
    actions,
    owner: {},
    navigationPending: false,
  };
  return {
    model,
    valuation,
    actions,
    props,
    api,
    calculate,
    makeModel,
    watchlist,
    lifetime,
    ...renderer(props),
  };
}
it("starts closed with two empty explicit choices and no side effects", async () => {
  const f = await fixture(false),
    view = f.render();
  expect(view.html("details").first().attr("open")).toBeUndefined();
  expect(view.byId("model")!.props.value).toBe("");
  expect(view.byId("scenario")!.props.value).toBe("");
  expect(view.byId("preview")!.props.disabled).toBe(true);
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.calculate).not.toHaveBeenCalled();
});
it("previews the full normalized Unicode question, exact estimate, date and every listing field", async () => {
  const f = await fixture(),
    view = f.previewed();
  const summary = resolveValuationFollowupScenario(
    f.valuation.getSnapshot().calculation,
    "dcf",
    "base",
  ).summary!;
  expect(view.byId("check")!.props).toMatchObject({
    readOnly: true,
    value: `Question:   Café 東京 😀 capacity?   | ${summary.text}`,
  });
  for (const value of Object.values(filingsSelection.listing))
    expect(view.html.root().text()).toContain(value);
  expect(view.html.root().text()).toContain("2026-12-31");
  expect(view.html("#valuation-followup-catalog").text()).toBe(digest);
  expect(view.html("#valuation-followup-catalog").prev("dt").text()).toBe(
    "Catalog snapshot",
  );
  expect(view.html.root().text()).toContain(
    "Inputs and source evidence are not included.",
  );
  expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([original]);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.calculate).not.toHaveBeenCalled();
});
it("creates once in only the Follow-ups draft, then uses a separate Save and fresh Load", async () => {
  const f = await fixture(),
    view = f.previewed();
  const check = view.byId("check")!.props.value;
  const beforeInputs = f.valuation.captureInputs()!.entry;
  const click = view.byId("create")!.props.onClick!;
  const unsubscribe = f.model.coordinator.subscribe(() => {
    f.render();
    click();
  });
  try {
    click();
    click();
  } finally {
    unsubscribe();
  }
  const draft = f.model.coordinator.getSnapshot().draft!;
  expect(draft.entries).toHaveLength(2);
  expect(draft.entries[0]).toEqual(original);
  expect(draft.entries[1]).toMatchObject({
    check,
    dueOn: "2026-12-31",
    listing: filingsSelection.listing,
    result: "",
    status: "open",
  });
  expect(f.valuation.captureInputs()!.entry).toEqual(beforeInputs);
  expect(f.watchlist.memberships[0]!.note).toBe("Keep Watchlist note");
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.render().html.root().text()).toContain(
    "Save follow-ups separately.",
  );
  await f.model.coordinator.save();
  const fresh = f.makeModel();
  await fresh.coordinator.load();
  expect(fresh.coordinator.getSnapshot().draft).toEqual(draft);
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(f.calculate).not.toHaveBeenCalled();
});
it.each(["", "\n", "\u0000", "\u200d", "\ud800", "😀".repeat(501)])(
  "retains and refuses invalid raw question %j without clipping",
  async (raw) => {
    const f = await fixture();
    f.written();
    f.edit("question", raw);
    const view = f.render();
    expect(view.byId("question")!.props.value).toBe(raw);
    expect(
      view.html("#valuation-followup-question").attr("maxlength"),
    ).toBeUndefined();
    view.byId("preview")!.props.onClick!();
    expect(f.render().byId("check")).toBeUndefined();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([
      original,
    ]);
  },
);
it("admits exactly 500 combined code points and refuses 501 without clipping", async () => {
  const f = await fixture();
  f.written();
  const summary = resolveValuationFollowupScenario(
    f.valuation.getSnapshot().calculation,
    "dcf",
    "base",
  ).summary!;
  const size = 500 - [...`Question:  | ${summary.text}`].length;
  f.edit("question", "😀".repeat(size));
  f.render().byId("preview")!.props.onClick!();
  expect([...f.render().byId("check")!.props.value!]).toHaveLength(500);
  f.edit("question", "😀".repeat(size + 1));
  f.render().byId("preview")!.props.onClick!();
  expect(f.render().byId("check")).toBeUndefined();
  expect(f.render().byId("question")!.props.value).toBe("😀".repeat(size + 1));
});
it("retains invalid dates and refuses unavailable models and scenarios", async () => {
  const f = await fixture();
  f.written();
  f.edit("due", "2026-02-29");
  expect(f.render().byId("due")!.props).toHaveProperty("aria-invalid", true);
  f.render().byId("preview")!.props.onClick!();
  expect(f.render().byId("check")).toBeUndefined();
  f.edit("due", "2026-12-31");
  f.valuation.setDcfField("waccPercent", "");
  f.valuation.calculate();
  expect(f.render().byId("preview")!.props.disabled).toBe(true);
  f.edit("model", "exit");
  expect(f.render().byId("preview")!.props.disabled).toBe(false);
  f.edit("scenario", "unknown");
  expect(f.render().byId("preview")!.props.disabled).toBe(true);
});
it("shows an available rounded zero exactly", async () => {
  const f = await fixture();
  f.valuation.setDcfField(
    "startingUnleveredCashFlowUsd",
    "0.000000000000000001",
  );
  f.valuation.calculate();
  const view = f.previewed();
  expect(view.html("#valuation-followup-estimate").text()).toContain(
    "USD/share 0.00.",
  );
  expect(view.byId("check")!.props.value).toContain("USD/share 0.00.");
});
it.each([
  "question",
  "due",
  "model",
  "scenario",
  "cancel",
  "close",
  "owner",
  "modelOwner",
  "valuationOwner",
  "navigation",
  "unmount",
])("permanently fences captured Create after %s", async (boundary) => {
  const f = await fixture(),
    view = f.previewed(),
    click = view.byId("create")!.props.onClick!;
  if (["question", "due", "model", "scenario"].includes(boundary))
    f.edit(boundary, "changed");
  if (boundary === "cancel")
    view.byId("cancel")!.props.onClick!({
      currentTarget: f.node("cancel") as unknown as HTMLButtonElement,
    });
  if (boundary === "close") view.close();
  if (boundary === "owner") f.render({ owner: {} });
  if (boundary === "modelOwner")
    f.render({ actions: { ...f.actions, model: f.makeModel() } });
  if (boundary === "valuationOwner")
    f.render({ valuation: new ManagedValuationWorkbench() });
  if (boundary === "navigation") {
    f.render({ navigationPending: true });
    f.render();
  }
  if (boundary === "unmount") unmount();
  click();
  expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([original]);
});
it("does not revive a preview after valuation, draft or route ABA", async () => {
  const f = await fixture(),
    view = f.previewed(),
    before = f.model.coordinator.getSnapshot().draft!;
  f.model.coordinator.replaceDraft({ ...before, entries: [...before.entries] });
  f.model.coordinator.replaceDraft(before);
  view.byId("create")!.props.onClick!();
  expect(f.render().byId("check")).toBeUndefined();
  const next = f.previewed();
  f.valuation.activate(null);
  f.valuation.activate(filingsSelection);
  next.byId("create")!.props.onClick!();
  expect(f.render().byId("check")).toBeUndefined();
  const third = f.previewed();
  f.lifetime.current = false;
  f.render();
  f.lifetime.current = true;
  third.byId("create")!.props.onClick!();
  expect(f.render().byId("check")).toBeUndefined();
  expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([original]);
});
it("keeps a valid form when actions objects are recreated and refuses superseded or abandoned handlers", async () => {
  const f = await fixture(),
    view = f.written();
  const abandoned = f.render({ owner: {} }, false);
  abandoned.byId("preview")!.props.onClick!();
  const current = f.render({ actions: { ...f.actions } });
  view.byId("preview")!.props.onClick!();
  current.byId("preview")!.props.onClick!();
  expect(f.render().byId("check")).toBeDefined();
  expect(f.render().byId("question")!.props.value).toBe(
    "  Cafe\u0301 東京 😀 capacity?  ",
  );
});
it("retains all fields through explicit initial Load and its publications", async () => {
  const f = await fixture(false);
  let finish!: (
    value: Awaited<ReturnType<ManagedApi["loadFollowups"]>>,
  ) => void;
  f.api.loadFollowups.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const click = f.written().byId("load")!.props.onClick!;
  click();
  click();
  const pending = f.render();
  expect(pending.byId("load")!.props.disabled).toBe(true);
  expect(pending.byId("question")!.props.value).toBe(
    "  Cafe\u0301 東京 😀 capacity?  ",
  );
  expect(pending.byId("model")!.props.value).toBe("dcf");
  finish({ version: 1, payload: { schemaVersion: 1, entries: [original] } });
  await vi.waitFor(() =>
    expect(f.model.coordinator.getSnapshot().draft).not.toBeNull(),
  );
  await Promise.resolve();
  const ready = f.render();
  expect(ready.byId("due")!.props.value).toBe("2026-12-31");
  expect(ready.byId("load")).toBeUndefined();
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.calculate).not.toHaveBeenCalled();
});
it("retains fields after failed Load and requires a fresh explicit retry", async () => {
  const f = await fixture(false);
  f.api.loadFollowups.mockRejectedValueOnce(new Error("invented"));
  const old = f.written().byId("load")!.props.onClick!;
  old();
  await vi.waitFor(() =>
    expect(f.model.coordinator.getSnapshot().phase).toBe("idle"),
  );
  await Promise.resolve();
  old();
  const view = f.render();
  expect(view.byId("question")!.props.value).toBe(
    "  Cafe\u0301 東京 😀 capacity?  ",
  );
  expect(view.byId("scenario")!.props.value).toBe("base");
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  view.byId("load")!.props.onClick!();
  await vi.waitFor(() =>
    expect(f.model.coordinator.getSnapshot().draft).not.toBeNull(),
  );
  expect(f.api.loadFollowups).toHaveBeenCalledTimes(2);
});
it.each(["edit", "cancel", "close", "navigation", "owner", "unmount"])(
  "refuses late initial Load after %s",
  async (boundary) => {
    const f = await fixture(false);
    let finish!: (
      value: Awaited<ReturnType<ManagedApi["loadFollowups"]>>,
    ) => void;
    f.api.loadFollowups.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    f.written().byId("load")!.props.onClick!();
    const pending = f.render();
    const current = vi.mocked(f.actions.load).mock.calls[0]![0];
    if (boundary === "edit") f.edit("question", "new question");
    if (boundary === "cancel")
      pending.byId("cancel")!.props.onClick!({
        currentTarget: f.node("cancel") as unknown as HTMLButtonElement,
      });
    if (boundary === "close") pending.close();
    if (boundary === "navigation") f.render({ navigationPending: true });
    if (boundary === "owner") f.render({ owner: {} });
    if (boundary === "unmount") unmount();
    expect(current()).toBe(false);
    finish({ version: 1, payload: { schemaVersion: 1, entries: [original] } });
    await vi.waitFor(() =>
      expect(f.model.coordinator.getSnapshot().phase).toBe("idle"),
    );
    expect(f.model.coordinator.getSnapshot().draft).toBeNull();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  },
);
it("never reloads an existing dirty draft", async () => {
  const f = await fixture();
  const draft = {
    schemaVersion: 1,
    entries: [{ ...original, check: "unsaved correction" }],
  } as ResearchFollowupsPayload;
  f.model.coordinator.replaceDraft(draft);
  const view = f.written();
  expect(view.byId("load")).toBeUndefined();
  expect(f.model.coordinator.getSnapshot().draft).toEqual(draft);
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
});
it("focuses the complete preview after keyboard activation and restores the Preview control on Cancel", async () => {
  const f = await fixture();
  const written = f.written(),
    source = f.node("valuation-followup-preview");
  source.focus();
  written.byId("preview")!.props.onClick!({
    currentTarget: source as unknown as HTMLButtonElement,
  });
  const view = f.render();
  expect(f.document.activeElement).toBe(f.node("h4"));
  const cancel = f.node("valuation-followup-cancel");
  cancel.focus();
  view.byId("cancel")!.props.onClick!({
    currentTarget: cancel as unknown as HTMLButtonElement,
  });
  expect(f.document.activeElement).toBe(source);
  expect(f.render().byId("check")).toBeUndefined();
});
it("disables controls during pending navigation and leaves raw input visible", async () => {
  const f = await fixture();
  f.written();
  const view = f.render({ navigationPending: true });
  for (const field of [
    "model",
    "scenario",
    "question",
    "due",
    "preview",
    "cancel",
  ])
    expect(view.byId(field)!.props.disabled).toBe(true);
  expect(view.byId("question")!.props.value).toBe(
    "  Cafe\u0301 東京 😀 capacity?  ",
  );
  view.byId("preview")!.props.onClick!();
  expect(f.render().byId("check")).toBeUndefined();
});

it("keeps a valid preview when only the actions object changes", async () => {
  const f = await fixture();
  const view = f.previewed();
  const check = view.byId("check")!.props.value;
  expect(
    f.render({ actions: { ...f.actions } }).byId("check")!.props.value,
  ).toBe(check);
});
it("retires old previews through field edit and reversion", async () => {
  const f = await fixture();
  const old = f.previewed();
  f.edit("question", "different");
  f.edit("question", "  Cafe\u0301 東京 😀 capacity?  ");
  old.byId("create")!.props.onClick!();
  expect(f.render().byId("check")).toBeUndefined();
  expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([original]);
});
it.each(["valuation", "followups"])(
  "retires a preview across %s draft-file recovery without replacing its draft",
  async (resource) => {
    const f = await fixture();
    const old = f.previewed();
    const draft = f.model.coordinator.getSnapshot().draft;
    const activity = {};
    const model = resource === "valuation" ? f.valuation : f.model;
    model.beginDraftFileActivity(activity);
    const paused = f.render();
    expect(paused.byId("preview")!.props.disabled).toBe(true);
    expect(paused.byId("load")).toBeUndefined();
    expect(paused.byId("question")!.props.value).toBe(
      "  Cafe\u0301 東京 😀 capacity?  ",
    );
    model.endDraftFileActivity(activity);
    old.byId("create")!.props.onClick!();
    expect(f.render().byId("check")).toBeUndefined();
    expect(f.model.coordinator.getSnapshot().draft).toBe(draft);
    expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  },
);
it("ignores a stale Preview on source replacement and refuses a double Preview callback", async () => {
  const f = await fixture();
  const old = f.written();
  const prepare = vi.spyOn(f.model, "prepareNextCheck");
  f.valuation.calculate();
  old.byId("preview")!.props.onClick!();
  expect(prepare).not.toHaveBeenCalled();
  const fresh = f.render();
  const click = fresh.byId("preview")!.props.onClick!;
  click();
  click();
  expect(prepare).toHaveBeenCalledOnce();
  expect(f.render().byId("check")).toBeDefined();
});
it("fences creation when the Follow-ups session retires", async () => {
  const f = await fixture();
  const view = f.previewed();
  f.model.coordinator.retire();
  view.byId("create")!.props.onClick!();
  const retired = f.render();
  expect(retired.byId("check")).toBeUndefined();
  expect(retired.byId("preview")!.props.disabled).toBe(true);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
