import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  normalizeResearchFollowupCheck,
  type ResearchFollowup,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import {
  ManagedHoldingFollowup,
  type ManagedHoldingFollowupActions,
} from "./ManagedHoldingFollowup";
import { ManagedResearchFollowups } from "./managed-research-followups";
import {
  prepareHoldingFollowup,
  type HoldingFollowupPort,
  type HoldingFollowupPreview,
} from "./managed-holding-followup";
import { isResearchFollowupDueDate } from "./managed-research-followups-date";
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
vi.mock("./managed-holding-followup", () => ({
  prepareHoldingFollowup: vi.fn(),
}));
interface ElementProps {
  id?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  ref?: { current: unknown };
  onClick?: (event?: { currentTarget: HTMLButtonElement }) => void;
  onChange?: (event: { currentTarget: { value: string } }) => void;
  onToggle?: (event: { currentTarget: { open: boolean } }) => void;
}
function elements(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  if (!React.isValidElement<ElementProps>(node)) return [];
  if (typeof node.type === "function") {
    const component = node.type as (props: ElementProps) => React.ReactNode;
    return elements(component(node.props));
  }
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
  for (const slot of hooks.slots) if (hasCleanup(slot)) slot.cleanup();
}
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  vi.mocked(prepareHoldingFollowup).mockReset();
});
afterEach(unmount);
const digest = `sha256:${"a".repeat(64)}` as const;
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const original: ResearchFollowup = {
  id: id(1),
  catalogSnapshotSha256: digest,
  listing: { ...filingsSelection.listing, listingId: "listing-other" },
  check: "Keep the complete earlier question",
  dueOn: "2026-01-01",
  status: "completed",
  completedOn: "2026-01-02",
  result: "Keep the complete earlier assessment.",
};
function fixtureApi() {
  let stored = {
    version: 1,
    payload: {
      schemaVersion: 1,
      entries: [original],
    } as ResearchFollowupsPayload,
  };
  return {
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
}
function modelFactory(
  api: ConstructorParameters<typeof ManagedResearchFollowups>[0],
) {
  const session: TrialSession = {
    userId: "invented",
    sessionId: "invented",
    getToken: vi.fn(),
    signOut: vi.fn(),
  };
  return () =>
    new ManagedResearchFollowups(api, session, {
      getCreationContext: () => ({
        draft: null,
        catalogSnapshotSha256: digest,
      }),
      onRetire: vi.fn(),
      newKey: () => id(99),
    });
}
function fixturePosition(
  basis: string | null,
): HoldingFollowupPreview["position"] {
  return {
    listing: filingsSelection.listing,
    shares: "12345678901234567890.123456",
    totalCostBasisUsd: basis,
    confirmedOn: "2026-10-03",
  };
}
interface FixtureLifetime {
  routeCurrent: boolean;
  previewLive: boolean;
}
function fixturePreview(
  model: ManagedResearchFollowups,
  source: HoldingFollowupPort,
  question: string,
  dueOn: string,
  formCurrent: () => boolean,
  lifetime: FixtureLifetime,
): HoldingFollowupPreview {
  const saved = model.coordinator.getSnapshot();
  const state = model.getSnapshot();
  let active = true;
  const current = () => {
    if (!active || !lifetime.previewLive) return false;
    if (!source.isCurrent() || !formCurrent()) return false;
    return (
      model.coordinator.getSnapshot() === saved && model.getSnapshot() === state
    );
  };
  return {
    position: source.position,
    check: question,
    dueOn,
    isCurrent: current,
    cancel: vi.fn(() => {
      active = false;
    }),
    create: vi.fn(() => {
      if (!current()) return null;
      active = false;
      const entry: ResearchFollowup = {
        id: id(2),
        catalogSnapshotSha256: digest,
        listing: source.position.listing,
        check: question,
        dueOn,
        status: "open",
        completedOn: null,
        result: "",
      };
      model.coordinator.replaceDraft({
        ...saved.draft!,
        entries: [...saved.draft!.entries, entry],
      });
      return entry;
    }),
  };
}
function fixtureQuestion(raw: string, dueOn: string) {
  if ([...raw].length > 500) return null;
  const question = normalizeResearchFollowupCheck(raw);
  if (!isResearchFollowupDueDate(dueOn)) return null;
  return question;
}
function installPreviewFixture(
  model: ManagedResearchFollowups,
  lifetime: FixtureLifetime,
) {
  const previews: HoldingFollowupPreview[] = [];
  vi.mocked(prepareHoldingFollowup).mockImplementation(
    (source, raw, dueOn, formCurrent) => {
      if (!source.isCurrent() || !formCurrent())
        return { preview: null, reason: "The holding is no longer current." };
      const question = fixtureQuestion(raw, dueOn);
      if (question === null)
        return {
          preview: null,
          reason:
            "Review the complete question and UTC date. Nothing was clipped.",
        };
      const saved = model.coordinator.getSnapshot();
      if (!saved.draft)
        return { preview: null, reason: "Load Follow-ups explicitly." };
      if (
        saved.draft.entries.some(
          (entry) =>
            entry.listing.listingId === source.position.listing.listingId,
        )
      )
        return { preview: null, reason: "Review the existing check." };
      const preview = fixturePreview(
        model,
        source,
        question,
        dueOn,
        formCurrent,
        lifetime,
      );
      previews.push(preview);
      return { preview, reason: null };
    },
  );
  return previews;
}
function fixtureActions(
  model: ManagedResearchFollowups,
  port: HoldingFollowupPort,
  lifetime: FixtureLifetime,
): ManagedHoldingFollowupActions {
  return {
    model,
    getContext: vi.fn(() => ({
      port: lifetime.routeCurrent ? port : null,
      reason: lifetime.routeCurrent ? null : "The holding is unavailable.",
    })),
    canLoad: vi.fn(() => {
      if (!lifetime.routeCurrent) return false;
      const saved = model.coordinator.getSnapshot();
      return saved.draft === null && saved.phase === "idle";
    }),
    load: vi.fn<ManagedHoldingFollowupActions["load"]>(async (current) => {
      if (lifetime.routeCurrent && current()) await model.coordinator.load();
    }),
    reviewExisting: vi.fn(),
  };
}
interface FixtureProps {
  actions: ManagedHoldingFollowupActions;
  owner: object;
  position: HoldingFollowupPreview["position"] | null;
}
function fixtureRenderer(props: FixtureProps) {
  const render = (override: Partial<FixtureProps> = {}, commit = true) => {
    hooks.index = 0;
    hooks.effects = [];
    const tree = ManagedHoldingFollowup({ ...props, ...override });
    if (commit) for (const effect of hooks.effects) effect();
    const all = elements(tree);
    return {
      tree,
      all,
      html: load(renderToStaticMarkup(tree)),
      byId: (suffix: string) =>
        all.find((node) => node.props.id === `holding-followup-${suffix}`),
      close: () =>
        all.find((node) => node.type === "details" && node.props.onToggle)!
          .props.onToggle!({ currentTarget: { open: false } }),
    };
  };
  const edit = (field: "question" | "due", raw: string) =>
    render().byId(field)!.props.onChange!({ currentTarget: { value: raw } });
  const written = () => {
    edit("question", "  Cafe\u0301 東京 😀 capacity?  ");
    edit("due", "2026-12-31");
    return render();
  };
  const previewed = () => {
    written().byId("preview")!.props.onClick!();
    return render();
  };
  return { render, edit, written, previewed };
}
async function fixture(
  loaded = true,
  basis: string | null = "12345678901234567890.01",
) {
  const api = fixtureApi();
  const makeModel = modelFactory(api);
  const model = makeModel();
  if (loaded) await model.coordinator.load();
  const position = fixturePosition(basis);
  const lifetime = { routeCurrent: true, previewLive: true };
  const port: HoldingFollowupPort = {
    model,
    position,
    isCurrent: () =>
      lifetime.routeCurrent && model.coordinator.getSnapshot().phase === "idle",
  };
  const previews = installPreviewFixture(model, lifetime);
  const actions = fixtureActions(model, port, lifetime);
  const props: FixtureProps = { actions, owner: {}, position };
  return {
    model,
    api,
    actions,
    props,
    port,
    position,
    previews,
    makeModel,
    ...fixtureRenderer(props),
    route: (current: boolean) => {
      lifetime.routeCurrent = current;
    },
    live: (current: boolean) => {
      lifetime.previewLive = current;
    },
  };
}

it("shows the complete authored position before an initially closed disclosure and makes no implicit Load", async () => {
  const f = await fixture(false);
  const view = f.render();
  expect(
    view.html("#managed-holding-followup > details").attr("open"),
  ).toBeUndefined();
  expect(
    view.html("#managed-holding-followup > details > summary").text(),
  ).toBe("Review holding and keep a next check");
  expect(view.html("#holding-followup-shares").text()).toBe(f.position.shares);
  expect(view.html("#holding-followup-basis").text()).toBe(
    f.position.totalCostBasisUsd,
  );
  expect(view.html("#holding-followup-confirmed").text()).toBe("2026-10-03");
  const text = view.html.root().text();
  for (const exact of Object.values(f.position.listing))
    expect(text).toContain(exact);
  expect(text).toContain("Authored Portfolio draft position");
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(prepareHoldingFollowup).not.toHaveBeenCalled();
  expect(view.byId("preview")!.props.disabled).toBe(true);
});
it("labels a missing cost basis unavailable and preserves a known zero basis", async () => {
  const f = await fixture(true, null);
  expect(f.render().html("#holding-followup-basis").text()).toBe("Unavailable");
  expect(
    f
      .render({ position: { ...f.position, totalCostBasisUsd: "0.00" } })
      .html("#holding-followup-basis")
      .text(),
  ).toBe("0.00");
});
it("keeps invalid oversized multiline raw input and passes it unchanged to explicit Preview", async () => {
  const f = await fixture();
  const raw = "  Café 東京\n" + "😀".repeat(501);
  f.edit("question", raw);
  f.edit("due", "2026-02-29");
  const written = f.render();
  expect(written.byId("question")!.props).toHaveProperty("value", raw);
  expect(
    written.html("#holding-followup-question").attr("maxlength"),
  ).toBeUndefined();
  expect(written.byId("due")!.props).toHaveProperty("aria-invalid", true);
  written.byId("preview")!.props.onClick!();
  expect(vi.mocked(prepareHoldingFollowup).mock.lastCall?.slice(0, 3)).toEqual([
    f.port,
    raw,
    "2026-02-29",
  ]);
  expect(f.render().byId("check")).toBeUndefined();
  expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([original]);
});
it("shows the complete normalized question, UTC date and position without an automatic position citation", async () => {
  const f = await fixture();
  const view = f.previewed();
  expect(view.byId("check")!.props).toMatchObject({
    readOnly: true,
    value: "Café 東京 😀 capacity?",
  });
  expect(view.html("#holding-followup-preview-shares").text()).toBe(
    f.position.shares,
  );
  expect(view.html.root().text()).toContain("2026-12-31");
  expect(view.html.root().text()).toContain(
    "The position context is not saved with this check.",
  );
  expect(f.previews[0]!.create).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("creates once through double and reentrant callbacks, preserving the other complete check and independent Save", async () => {
  const f = await fixture();
  const view = f.previewed();
  const preview = f.previews[0]!;
  const click = view.byId("create")!.props.onClick!;
  const originalCreate = vi.mocked(preview.create).getMockImplementation()!;
  vi.mocked(preview.create).mockImplementation(() => {
    click();
    return originalCreate();
  });
  click();
  click();
  expect(preview.create).toHaveBeenCalledOnce();
  const draft = f.model.coordinator.getSnapshot().draft!;
  expect(draft.entries[0]).toEqual(original);
  expect(draft.entries[1]).toEqual({
    id: id(2),
    listing: f.position.listing,
    catalogSnapshotSha256: digest,
    check: "Café 東京 😀 capacity?",
    dueOn: "2026-12-31",
    status: "open",
    completedOn: null,
    result: "",
  });
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(f.render().html.root().text()).toContain(
    "Portfolio and My Watchlist are unchanged.",
  );
  await f.model.coordinator.save();
  const fresh = f.makeModel();
  await fresh.coordinator.load();
  expect(fresh.coordinator.getSnapshot().draft).toEqual(draft);
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
});
it("keeps successful feedback through synchronous resource publication", async () => {
  const f = await fixture();
  const view = f.previewed();
  const unsubscribe = f.model.coordinator.subscribe(() => {
    f.render();
  });
  try {
    view.byId("create")!.props.onClick!();
  } finally {
    unsubscribe();
  }
  expect(f.render().html.root().text()).toContain(
    "Created in the Follow-ups draft.",
  );
});
it("reviews an existing check without replacing it or saving", async () => {
  const f = await fixture();
  const current = { ...original, id: id(3), listing: f.position.listing };
  f.model.coordinator.replaceDraft({
    schemaVersion: 1,
    entries: [original, current],
  });
  const view = f.render();
  expect(view.byId("preview")!.props.disabled).toBe(true);
  view.byId("review")!.props.onClick!();
  view.byId("review")!.props.onClick!();
  expect(f.actions.reviewExisting).toHaveBeenCalledOnce();
  expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([
    original,
    current,
  ]);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it.each(["cancel", "close", "question", "date", "unmount", "owner", "model"])(
  "permanently fences captured Create after %s",
  async (boundary) => {
    const f = await fixture();
    const view = f.previewed();
    const click = view.byId("create")!.props.onClick!;
    if (boundary === "cancel") view.byId("cancel")!.props.onClick!();
    if (boundary === "close") view.close();
    if (boundary === "question")
      view.byId("question")!.props.onChange!({
        currentTarget: { value: "Changed question" },
      });
    if (boundary === "date")
      view.byId("due")!.props.onChange!({
        currentTarget: { value: "2027-01-01" },
      });
    if (boundary === "unmount") unmount();
    if (boundary === "owner") f.render({ owner: {} });
    if (boundary === "model")
      f.render({ actions: { ...f.actions, model: f.makeModel() } });
    click();
    expect(f.previews[0]!.create).not.toHaveBeenCalled();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([
      original,
    ]);
  },
);
it("retires a stale preview once and never revives it when the external predicate returns", async () => {
  const f = await fixture();
  const first = f.previewed();
  const old = first.byId("create")!.props.onClick!;
  f.live(false);
  expect(f.render().byId("check")).toBeUndefined();
  f.live(true);
  expect(f.render().byId("check")).toBeUndefined();
  old();
  expect(f.previews[0]!.cancel).toHaveBeenCalledOnce();
  expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([original]);
  f.render().byId("preview")!.props.onClick!();
  expect(f.render().byId("check")).toBeDefined();
});
it("invalidates old previews across resource publication and restored identical values", async () => {
  const f = await fixture();
  const first = f.previewed();
  const before = f.model.coordinator.getSnapshot().draft!;
  f.model.coordinator.replaceDraft({ ...before, entries: [...before.entries] });
  f.render();
  f.model.coordinator.replaceDraft(before);
  first.byId("create")!.props.onClick!();
  expect(f.render().byId("check")).toBeUndefined();
  expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([original]);
});
it("allows fresh position readout objects without clearing the same owner's fields or capture", async () => {
  const f = await fixture();
  f.previewed();
  const view = f.render({
    position: { ...f.position, listing: { ...f.position.listing } },
  });
  expect(view.byId("question")!.props).toHaveProperty(
    "value",
    "  Cafe\u0301 東京 😀 capacity?  ",
  );
  expect(view.byId("check")).toBeDefined();
});
it("clears form ownership on a new visit without reviving an earlier owner's preview", async () => {
  const f = await fixture();
  const old = f.previewed();
  const owner = {};
  f.render({ owner });
  const next = f.render({ owner });
  expect(next.byId("question")!.props).toHaveProperty("value", "");
  expect(next.byId("due")!.props).toHaveProperty("value", "");
  old.byId("create")!.props.onClick!();
  expect(f.render().byId("check")).toBeUndefined();
  expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([original]);
});
it("ignores abandoned and superseded Preview callbacks", async () => {
  const f = await fixture();
  const view = f.written();
  const abandoned = f.render({ owner: {} }, false);
  abandoned.byId("preview")!.props.onClick!();
  expect(prepareHoldingFollowup).not.toHaveBeenCalled();
  view.byId("preview")!.props.onClick!();
  view.byId("preview")!.props.onClick!();
  expect(prepareHoldingFollowup).toHaveBeenCalledOnce();
});
it("retains the exact fields and readout during explicit initial Load and its publications", async () => {
  const f = await fixture(false);
  const view = f.written();
  let finish!: (
    value: Awaited<ReturnType<ManagedApi["loadFollowups"]>>,
  ) => void;
  f.api.loadFollowups.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const click = view.byId("load")!.props.onClick!;
  click();
  click();
  const pending = f.render();
  expect(pending.byId("load")!.props.disabled).toBe(true);
  expect(pending.byId("question")!.props).toHaveProperty(
    "value",
    "  Cafe\u0301 東京 😀 capacity?  ",
  );
  expect(pending.html("#holding-followup-shares").text()).toBe(
    f.position.shares,
  );
  expect(vi.mocked(f.actions.load).mock.calls[0]![0]()).toBe(true);
  finish({ version: 1, payload: { schemaVersion: 1, entries: [original] } });
  await vi.waitFor(() =>
    expect(f.model.coordinator.getSnapshot().draft).not.toBeNull(),
  );
  await Promise.resolve();
  const ready = f.render();
  expect(ready.byId("due")!.props).toHaveProperty("value", "2026-12-31");
  expect(ready.byId("load")).toBeUndefined();
  expect(ready.byId("preview")!.props.disabled).toBe(false);
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(prepareHoldingFollowup).not.toHaveBeenCalled();
});
it("retains both fields after failed initial Load and requires a fresh explicit retry", async () => {
  const f = await fixture(false);
  f.api.loadFollowups.mockRejectedValueOnce(new Error("Invented load failure"));
  const old = f.written().byId("load")!.props.onClick!;
  old();
  await vi.waitFor(() =>
    expect(f.model.coordinator.getSnapshot().phase).toBe("idle"),
  );
  await Promise.resolve();
  old();
  const failed = f.render();
  expect(failed.byId("question")!.props).toHaveProperty(
    "value",
    "  Cafe\u0301 東京 😀 capacity?  ",
  );
  expect(failed.byId("due")!.props).toHaveProperty("value", "2026-12-31");
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  failed.byId("load")!.props.onClick!();
  await vi.waitFor(() =>
    expect(f.model.coordinator.getSnapshot().draft).not.toBeNull(),
  );
  expect(f.api.loadFollowups).toHaveBeenCalledTimes(2);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it.each(["close", "cancel", "edit", "owner", "unmount"])(
  "retires held Load UI continuation after %s",
  async (boundary) => {
    const f = await fixture(false);
    let finish!: () => void;
    vi.mocked(f.actions.load).mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    f.written().byId("load")!.props.onClick!();
    const pending = f.render();
    const current = vi.mocked(f.actions.load).mock.calls[0]![0];
    if (boundary === "close") pending.close();
    if (boundary === "cancel") pending.byId("cancel")!.props.onClick!();
    if (boundary === "edit")
      pending.byId("question")!.props.onChange!({
        currentTarget: { value: "New question" },
      });
    if (boundary === "owner") f.render({ owner: {} });
    if (boundary === "unmount") unmount();
    expect(current()).toBe(false);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(prepareHoldingFollowup).not.toHaveBeenCalled();
    expect(f.model.coordinator.getSnapshot().draft).toBeNull();
  },
);
