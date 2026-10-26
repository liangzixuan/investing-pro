import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ManagedFilingsFollowup,
  type ManagedFilingsFollowupActions,
} from "./ManagedFilingsFollowup";
import { ManagedResearchFollowups } from "./managed-research-followups";
import {
  prepareFilingsFollowup,
  type FilingsFollowupPreview,
  type FilingsFollowupPort,
} from "./managed-filings-followup";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";
import type { MainWatchlistPayload } from "@research-cockpit/contracts";
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
vi.mock("./managed-filings-followup", () => ({
  prepareFilingsFollowup: vi.fn(),
}));
interface ElementProps {
  id?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  onChange?: (event: { currentTarget: { value: string } }) => void;
  onToggle?: (event: { currentTarget: { open: boolean } }) => void;
}
function elements(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  return React.isValidElement<ElementProps>(node)
    ? [node, ...React.Children.toArray(node.props.children).flatMap(elements)]
    : [];
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
  vi.mocked(prepareFilingsFollowup).mockReset();
});
afterEach(unmount);

async function fixture(loaded = true, response = filingsResponse(2)) {
  const filing = response.issuer.filings[0]!;
  const member = {
    ...filingsSelection.listing,
    note: "Independent watchlist note",
  };
  const watchlist: MainWatchlistPayload = {
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
      draft: watchlist,
      catalogSnapshotSha256: watchlist.snapshotSha256,
    }),
    onRetire: vi.fn(),
    newEntryId: () => "00000000-0000-4000-8000-000000000001",
  });
  if (loaded) await model.coordinator.load();
  let routeCurrent = true;
  let previewLive = true;
  let previous = false;
  const previews: FilingsFollowupPreview[] = [];
  const port: FilingsFollowupPort = {
    model,
    member,
    response,
    filing,
    showingPrevious: false,
    isCurrent: () =>
      routeCurrent && model.coordinator.getSnapshot().phase === "idle",
  };
  vi.mocked(prepareFilingsFollowup).mockImplementation(
    (_port, question, dueOn, formCurrent) => {
      const prepared = model.prepareNextCheck(
        member,
        `${question} | Form ${filing.form}; accession ${filing.accessionNumber}; filed ${filing.filingDate}.`,
        dueOn,
      );
      if (!prepared.capture) return { preview: null, reason: prepared.reason };
      const capture = prepared.capture;
      let active = true;
      const isCurrent = () =>
        active && previewLive && routeCurrent && formCurrent();
      const preview: FilingsFollowupPreview = {
        check: capture.check,
        dueOn: capture.dueOn,
        listing: capture.listing,
        isCurrent,
        create: vi.fn(() => {
          const result = isCurrent()
            ? model.createNextCheck(capture, isCurrent)
            : null;
          active = false;
          return result;
        }),
        cancel: vi.fn(() => {
          active = false;
        }),
      };
      previews.push(preview);
      return { preview, reason: null };
    },
  );
  const actions: ManagedFilingsFollowupActions = {
    model,
    getContext: vi.fn(() => ({
      port: routeCurrent ? { ...port, showingPrevious: previous } : null,
      reason: routeCurrent ? null : "Company research is no longer current.",
    })),
    canLoad: vi.fn(() => routeCurrent && model.canLoadForNextCheck(member)),
    load: vi.fn<ManagedFilingsFollowupActions["load"]>(
      async (_response, _filing, current) => {
        await model.loadForNextCheck(member, () => routeCurrent && current());
      },
    ),
  };
  const props = { response, filing, actions };
  const render = (override: Partial<typeof props> = {}, commit = true) => {
    hooks.index = 0;
    hooks.effects = [];
    const actual = { ...props, ...override };
    const tree = ManagedFilingsFollowup(actual);
    if (commit) for (const effect of hooks.effects) effect();
    const id = `managed-filings-followup-${actual.filing.accessionNumber}`;
    const all = elements(tree);
    return {
      tree,
      all,
      html: load(renderToStaticMarkup(tree)),
      byId: (suffix: string) =>
        all.find((node) => node.props.id === `${id}-${suffix}`)!,
    };
  };
  const edit = (field: "question" | "due", value: string) => {
    render().byId(field).props.onChange!({ currentTarget: { value } });
  };
  const written = () => {
    edit("question", "  Cafe\u0301 東京 😀 capacity?  ");
    edit("due", "2026-12-31");
    return render();
  };
  const previewed = () => {
    written().byId("prepare").props.onClick!();
    return render();
  };
  return {
    response,
    filing,
    props,
    port,
    actions,
    model,
    api,
    member,
    render,
    edit,
    written,
    previewed,
    previews,
    route: (current: boolean) => {
      routeCurrent = current;
    },
    live: (current: boolean) => {
      previewLive = current;
    },
    previous: () => {
      previous = true;
    },
  };
}

it("starts closed, keeps unclipped raw multiline input and requires an explicit full preview", async () => {
  const f = await fixture();
  let view = f.render();
  expect(
    view.html("details.managed-filings-followup").attr("open"),
  ).toBeUndefined();
  expect(view.html("summary").first().text()).toBe(
    "Keep a dated research question",
  );
  expect(prepareFilingsFollowup).not.toHaveBeenCalled();
  const raw = "  Cafe\u0301 東京\n" + "😀".repeat(510);
  f.edit("question", raw);
  f.edit("due", "2026-02-29");
  view = f.render();
  expect(view.byId("question").props).toMatchObject({ value: raw, rows: 3 });
  expect(view.html("textarea").attr("maxlength")).toBeUndefined();
  expect(view.byId("due").props).toMatchObject({
    type: "text",
    value: "2026-02-29",
    "aria-invalid": true,
  });
  view.byId("prepare").props.onClick!();
  const call = vi.mocked(prepareFilingsFollowup).mock.lastCall;
  expect(call?.slice(0, 3)).toEqual([f.port, raw, "2026-02-29"]);
  expect(typeof call?.[3]).toBe("function");
  view = f.render();
  expect(view.byId("preview")).toBeUndefined();
  expect(view.byId("question").props).toHaveProperty("value", raw);
  expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
});
it("shows the full cited check, exact identity/date and original metadata beside the preview", async () => {
  const response = filingsResponse(2);
  const f = await fixture(true, {
    ...response,
    issuer: { ...response.issuer, truncated: true, matchingFilings: 9 },
  });
  f.previous();
  const view = f.previewed();
  const preview = f.previews[0]!;
  expect(view.byId("preview").props).toMatchObject({
    readOnly: true,
    value: preview.check,
  });
  const text = view.html.root().text();
  for (const exact of [
    "Complete cited check preview",
    "ZERO · Class A · XNAS",
    "listing-zero",
    "security-zero",
    "class-zero",
    "2026-12-31",
    f.filing.accessionNumber,
    f.filing.filingDate,
    f.filing.reportDate!,
    f.response.requestStartedAt,
    f.response.completedAt,
    f.response.issuer.fetchedAt,
    "Filing metadata only",
    "retained previous Filings response",
    "Showing 2 of 9",
    "complete 90-day coverage is not established",
    "planning date, not an evidence refresh",
  ])
    expect(text).toContain(exact);
  expect(preview.create).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.resolve).not.toHaveBeenCalled();
});
it("creates the complete preview once, fences double and reentrant callbacks, and does not Save or alter the note", async () => {
  const f = await fixture();
  const view = f.previewed();
  const preview = f.previews[0]!;
  const click = view.byId("create").props.onClick!;
  const capture = f.model.prepareNextCheck(
    f.member,
    preview.check,
    preview.dueOn,
  ).capture!;
  vi.mocked(preview.create).mockImplementation(() => {
    click();
    return f.model.createNextCheck(capture, preview.isCurrent);
  });
  click();
  click();
  expect(preview.create).toHaveBeenCalledOnce();
  expect(f.model.coordinator.getSnapshot().draft!.entries).toHaveLength(1);
  expect(f.model.coordinator.getSnapshot().draft!.entries[0]).toMatchObject({
    check: preview.check,
    dueOn: "2026-12-31",
    listing: preview.listing,
  });
  expect(f.member.note).toBe("Independent watchlist note");
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(f.render().html.root().text()).toContain(
    "Save follow-ups. My Watchlist is unchanged",
  );
});
it.each([
  "cancel",
  "close",
  "question",
  "date",
  "unmount",
  "response",
  "filing",
  "route",
])("permanently refuses the captured Create after %s", async (boundary) => {
  const f = await fixture();
  const view = f.previewed();
  const preview = f.previews[0]!;
  const click = view.byId("create").props.onClick!;
  if (boundary === "cancel") view.byId("cancel").props.onClick!();
  if (boundary === "close")
    (view.tree.props as ElementProps).onToggle!({
      currentTarget: { open: false },
    });
  if (boundary === "question")
    view.byId("question").props.onChange!({
      currentTarget: { value: "Changed question" },
    });
  if (boundary === "date")
    view.byId("due").props.onChange!({
      currentTarget: { value: "2027-01-01" },
    });
  if (boundary === "unmount") unmount();
  if (boundary === "response") f.render({ response: { ...f.response } });
  if (boundary === "filing") f.render({ filing: { ...f.filing } });
  if (boundary === "route") f.route(false);
  click();
  expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
  if (boundary !== "route") expect(preview.create).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("does not restore a retired preview when its external predicate becomes true again", async () => {
  const f = await fixture();
  f.previewed();
  f.live(false);
  expect(f.render().byId("preview")).toBeUndefined();
  f.live(true);
  expect(f.render().byId("preview")).toBeUndefined();
  expect(f.previews[0]!.cancel).toHaveBeenCalledOnce();
  expect(prepareFilingsFollowup).toHaveBeenCalledOnce();
});
it("allows a fresh explicit Preview after stale content retires during the commit", async () => {
  const f = await fixture();
  const original = f.previewed();
  const oldCreate = original.byId("create").props.onClick!;
  f.live(false);
  const stale = f.render();
  f.live(true);
  stale.byId("prepare").props.onClick!();
  expect(prepareFilingsFollowup).toHaveBeenCalledTimes(2);
  oldCreate();
  expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
  expect(f.render().byId("preview")).toBeDefined();
});
it("admits fresh field edits and Preview after response replacement without renewing old callbacks", async () => {
  const f = await fixture();
  const old = f.previewed();
  const replacement = { response: { ...f.response } };
  const next = f.render(replacement);
  next.byId("question").props.onChange!({
    currentTarget: { value: "Replacement packet question" },
  });
  const written = f.render(replacement);
  expect(written.byId("question").props).toHaveProperty(
    "value",
    "Replacement packet question",
  );
  written.byId("prepare").props.onClick!();
  expect(prepareFilingsFollowup).toHaveBeenCalledTimes(2);
  old.byId("create").props.onClick!();
  expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
  expect(f.render(replacement).byId("preview")).toBeDefined();
});
it("keeps successful creation feedback through synchronous model notifications", async () => {
  const f = await fixture();
  const view = f.previewed();
  const unsubscribe = f.model.coordinator.subscribe(() => {
    f.render();
  });
  try {
    view.byId("create").props.onClick!();
  } finally {
    unsubscribe();
  }
  expect(f.model.coordinator.getSnapshot().draft!.entries).toHaveLength(1);
  expect(f.render().html.root().text()).toContain(
    "Created in the Follow-ups draft.",
  );
});
it("ignores actions from an abandoned render and an old Prepare callback", async () => {
  const f = await fixture();
  const view = f.written();
  const abandoned = f.render({ response: { ...f.response } }, false);
  abandoned.byId("prepare").props.onClick!();
  expect(prepareFilingsFollowup).not.toHaveBeenCalled();
  view.byId("prepare").props.onClick!();
  view.byId("prepare").props.onClick!();
  expect(prepareFilingsFollowup).toHaveBeenCalledOnce();
});
it("requires explicit initial Load, survives its loading-state render and retains raw fields", async () => {
  const f = await fixture(false);
  const view = f.written();
  let finish!: (value: unknown) => void;
  f.api.loadFollowups.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
  expect(view.byId("prepare").props.disabled).toBe(true);
  const click = view.byId("load").props.onClick!;
  click();
  click();
  const loading = f.render();
  expect(loading.byId("load").props.disabled).toBe(true);
  expect(loading.byId("question").props).toHaveProperty(
    "value",
    "  Cafe\u0301 東京 😀 capacity?  ",
  );
  expect(f.port.isCurrent()).toBe(false);
  const current = vi.mocked(f.actions.load).mock.calls[0]![2];
  expect(current()).toBe(true);
  finish({ version: 0, payload: { schemaVersion: 1, entries: [] } });
  await vi.waitFor(() =>
    expect(f.model.coordinator.getSnapshot().draft).not.toBeNull(),
  );
  const ready = f.render();
  expect(ready.byId("load")).toBeUndefined();
  expect(ready.byId("prepare").props.disabled).toBe(false);
  expect(ready.byId("due").props).toHaveProperty("value", "2026-12-31");
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(prepareFilingsFollowup).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("keeps both raw fields after failed Load, consumes its old callback and allows a fresh explicit attempt", async () => {
  const f = await fixture(false);
  f.api.loadFollowups.mockRejectedValueOnce(new Error("Invented load failure"));
  const view = f.written();
  const old = view.byId("load").props.onClick!;
  old();
  await vi.waitFor(() =>
    expect(f.model.coordinator.getSnapshot().phase).toBe("idle"),
  );
  await Promise.resolve();
  old();
  let failed = f.render();
  expect(failed.byId("question").props).toHaveProperty(
    "value",
    "  Cafe\u0301 東京 😀 capacity?  ",
  );
  expect(failed.byId("due").props).toHaveProperty("value", "2026-12-31");
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(failed.byId("prepare").props.disabled).toBe(true);
  failed.byId("load").props.onClick!();
  await vi.waitFor(() =>
    expect(f.model.coordinator.getSnapshot().draft).not.toBeNull(),
  );
  failed = f.render();
  expect(failed.byId("load")).toBeUndefined();
  expect(f.api.loadFollowups).toHaveBeenCalledTimes(2);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it.each(["close", "cancel", "edit", "unmount", "response", "route"])(
  "retires a held Load UI after %s without automatically previewing or creating",
  async (boundary) => {
    const f = await fixture(false);
    let finish!: (value: unknown) => void;
    f.api.loadFollowups.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    f.written().byId("load").props.onClick!();
    const view = f.render();
    if (boundary === "close")
      (view.tree.props as ElementProps).onToggle!({
        currentTarget: { open: false },
      });
    if (boundary === "cancel") view.byId("cancel").props.onClick!();
    if (boundary === "edit")
      view.byId("question").props.onChange!({
        currentTarget: { value: "Corrected question" },
      });
    if (boundary === "unmount") unmount();
    if (boundary === "response") f.render({ response: { ...f.response } });
    if (boundary === "route") f.route(false);
    finish({ version: 0, payload: { schemaVersion: 1, entries: [] } });
    await vi.waitFor(() =>
      expect(f.model.coordinator.getSnapshot().phase).toBe("idle"),
    );
    if (boundary !== "route")
      expect(vi.mocked(f.actions.load).mock.calls[0]![2]()).toBe(false);
    // The existing shared-resource loader retains a valid read already dispatched.
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(prepareFilingsFollowup).not.toHaveBeenCalled();
  },
);
