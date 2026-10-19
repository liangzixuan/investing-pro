import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type {
  ManagedResearchFollowupsDto,
  ResearchFollowup,
} from "@research-cockpit/contracts";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
import type { ManagedApi } from "./managed-api";
import { TrialApiError } from "./api";
import { ManagedResearchFollowups } from "./ManagedResearchFollowups";

const hooks = vi.hoisted(() => ({ values: [] as unknown[], index: 0 }));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useRef: (initial: unknown) => ({ current: initial }),
  useLayoutEffect: () => {},
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.values))
      hooks.values[index] =
        typeof initial === "function" ? (initial as () => unknown)() : initial;
    return [
      hooks.values[index],
      (value: unknown) => {
        hooks.values[index] = value;
      },
    ];
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
}));
const workspaces: ManagedWorkspace[] = [];
beforeEach(() => {
  hooks.values = [];
  hooks.index = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T23:59:59.000Z"));
});
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
  vi.useRealTimers();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function fixture() {
  const base = await createFixture();
  const signal = new AbortController().signal;
  const catalog = await base.api.status(signal);
  const watchlist = await base.api.load(signal);
  let stored: ManagedResearchFollowupsDto = {
    version: 0,
    payload: { schemaVersion: 1, entries: [] },
  };
  const unexpected = new Error("No extra fixture request is allowed");
  const api: ManagedApi = {
    loadValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions read"),
      ),
    saveValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions write"),
      ),
    loadPortfolio: () =>
      Promise.reject(
        new Error("Portfolio requires an explicit fixture action"),
      ),
    savePortfolio: () =>
      Promise.reject(
        new Error("Portfolio requires an explicit fixture action"),
      ),
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue(catalog),
    load: vi.fn<ManagedApi["load"]>().mockResolvedValue(watchlist),
    save: vi.fn<ManagedApi["save"]>().mockRejectedValue(unexpected),
    search: vi.fn<ManagedApi["search"]>().mockRejectedValue(unexpected),
    annualReport: vi
      .fn<ManagedApi["annualReport"]>()
      .mockRejectedValue(unexpected),
    eodHistory: vi.fn<ManagedApi["eodHistory"]>().mockRejectedValue(unexpected),
    recentFilings: vi
      .fn<ManagedApi["recentFilings"]>()
      .mockRejectedValue(unexpected),
    monetaryAnnouncements: vi
      .fn<ManagedApi["monetaryAnnouncements"]>()
      .mockRejectedValue(unexpected),
    economicCalendar: vi
      .fn<ManagedApi["economicCalendar"]>()
      .mockRejectedValue(unexpected),
    resolve: vi.fn<ManagedApi["resolve"]>((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: null,
        })),
      }),
    ),
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
  };
  const session = {
    ...base.session,
    signOut: vi.fn<() => Promise<void>>().mockResolvedValue(),
  };
  const workspace = new ManagedWorkspace(
    api,
    session,
    () => "invented-followup-command",
    { researchCoverage: inventedManagedResearchCoverage },
  );
  workspaces.push(workspace);
  workspace.setView("followups");
  await workspace.refreshCatalog();
  await workspace.coordinator.load();
  const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
  const entry = (number = 1, dueOn = "2026-10-15"): ResearchFollowup => {
    const listing = {
      country: member.country,
      exchangeMic: member.exchangeMic,
      instrumentType: member.instrumentType,
      issuerId: member.issuerId,
      issuerName: member.issuerName,
      listingId: member.listingId,
      securityId: member.securityId,
      securityName: member.securityName,
      shareClassId: member.shareClassId,
      shareClassName: member.shareClassName,
      symbol: member.symbol,
    };
    return {
      id: `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
      catalogSnapshotSha256: catalog.snapshot.snapshotSha256,
      listing: {
        ...listing,
        listingId:
          number === 1 ? listing.listingId : `invented-listing-${number}`,
      },
      check: `Read filing ${number}`,
      dueOn,
      status: "open",
      completedOn: null,
      result: "",
    };
  };
  const loadEntries = async (...entries: ResearchFollowup[]) => {
    stored = {
      version: entries.length ? 1 : 0,
      payload: { schemaVersion: 1, entries },
    };
    await workspace.followups.coordinator.load();
  };
  const current = () =>
    workspace.followups.coordinator.getSnapshot().draft!.entries[0]!;
  const onResearch =
    vi.fn<(entry: ResearchFollowup, opener: HTMLButtonElement) => void>();
  return {
    workspace,
    api,
    catalog,
    member,
    entry,
    loadEntries,
    current,
    onResearch,
    session,
  };
}
function view(
  f: Awaited<ReturnType<typeof fixture>>,
  navigationPending = false,
) {
  hooks.index = 0;
  const node = ManagedResearchFollowups({
    navigationPending,
    workspace: f.workspace,
    onResearch: f.onResearch,
  });
  function find(
    value: React.ReactNode,
    id: string,
  ): React.ReactElement<Record<string, unknown>> | undefined {
    for (const child of React.Children.toArray(value)) {
      if (!React.isValidElement<Record<string, unknown>>(child)) continue;
      if (child.props.id === id) return child;
      const match = find(child.props.children as React.ReactNode, id);
      if (match) return match;
    }
  }
  const element = (id: string) => {
    const result = find(node, id);
    if (!result) throw new Error(`Missing fixture control ${id}`);
    return result;
  };
  return {
    html: renderToStaticMarkup(node),
    element,
    click: (id: string, currentTarget = {} as HTMLButtonElement) => {
      const button = element(id);
      expect(button.props.disabled).not.toBe(true);
      (
        button.props.onClick as (event: {
          currentTarget: HTMLButtonElement;
        }) => void
      )({ currentTarget });
    },
    change: (id: string, value: string) =>
      (
        element(id).props.onChange as (event: {
          currentTarget: { value: string };
        }) => void
      )({ currentTarget: { value } }),
  };
}
function noOtherRequests(f: Awaited<ReturnType<typeof fixture>>) {
  for (const method of [
    "save",
    "search",
    "annualReport",
    "eodHistory",
    "recentFilings",
    "monetaryAnnouncements",
    "economicCalendar",
  ] as const)
    expect(f.api[method]).not.toHaveBeenCalled();
  expect(f.session.signOut).not.toHaveBeenCalled();
}

it("requires explicit follow-up load and saves only the authored follow-up draft from an actual unsaved watchlist member", async () => {
  const f = await fixture();
  const initial = view(f);
  expect(initial.html).toContain("Follow-ups have not been loaded.");
  expect(initial.html).not.toContain('id="managed-followups-add"');
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
  initial.click("managed-followups-load");
  await vi.waitFor(() =>
    expect(
      f.workspace.followups.coordinator.getSnapshot().draft,
    ).not.toBeNull(),
  );
  f.workspace.note(f.member.listingId, "Unsaved watchlist note 财报");
  const watchlist = f.workspace.coordinator.getSnapshot();
  view(f).change("managed-followups-member", f.member.listingId);
  view(f).change("managed-followups-new-due", "2026-10-16");
  view(f).click("managed-followups-add");
  expect(f.current()).toMatchObject({ check: "", dueOn: "2026-10-16" });
  expect(view(f).element("managed-followups-save").props.disabled).toBe(true);
  view(f).change("managed-followup-check", "  Read the filing 财报  ");
  view(f).change("managed-followup-result", "My <assessment>");
  expect(view(f).html).toContain("My &lt;assessment&gt;");
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  view(f).click("managed-followups-save");
  await vi.waitFor(() =>
    expect(f.workspace.followups.coordinator.getSnapshot().dirty).toBe(false),
  );
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  expect(
    vi.mocked(f.api.saveFollowups).mock.calls[0]![0].payload.entries[0],
  ).toMatchObject({ check: "Read the filing 财报", result: "My <assessment>" });
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
  expect(f.api.resolve).not.toHaveBeenCalled();
  noOtherRequests(f);
});

it("keeps field constraints outside an optional native disclosure without changing drafts or making requests", async () => {
  const f = await fixture();
  await f.loadEntries(f.entry());
  f.workspace.followups.select(f.current().id);
  view(f).change("managed-followup-check", "  Review 财报  ");
  view(f).change("managed-followup-result", "My assessment é  ");
  f.workspace.note(f.member.listingId, "Separate unsaved note 财报  ");
  const followups = f.workspace.followups.getSnapshot();
  const draft = f.workspace.followups.coordinator.getSnapshot();
  const watchlist = f.workspace.coordinator.getSnapshot();
  const rendered = view(f);
  const guidance = rendered.element("managed-followup-guidance");
  expect(guidance.type).toBe("details");
  expect(guidance.props.open).toBeUndefined();
  expect(guidance.props.onToggle).toBeUndefined();
  const guidanceHtml = renderToStaticMarkup(guidance);
  expect(guidanceHtml).toContain("<summary>How follow-ups work</summary>");
  expect(guidanceHtml.match(/<li>/g)).toHaveLength(4);
  expect(guidanceHtml).not.toMatch(/<(?:label|input|textarea|button)\b/);
  const primary = rendered.html.replace(guidanceHtml, "");
  for (const field of ["check", "result"]) {
    const helpId = `managed-followup-${field}-help`;
    expect(
      rendered.element(`managed-followup-${field}`).props["aria-describedby"],
    ).toBe(helpId);
    expect(primary).toContain(`id="${helpId}"`);
    expect(guidanceHtml).not.toContain(`id="${helpId}"`);
  }
  expect(primary).toContain("Required. 1–500 characters, one line.");
  expect(primary).toContain("Optional. Up to 2,000 characters, one line.");
  expect(primary).toContain("Your assessment is not a verified source fact.");
  expect(primary).toContain('for="managed-followup-result">Your assessment');
  expect(primary).toContain(
    "Planning dates do not establish source freshness.",
  );
  expect(f.workspace.followups.getSnapshot()).toBe(followups);
  expect(f.workspace.followups.coordinator.getSnapshot()).toBe(draft);
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
  expect(f.current()).toMatchObject({
    check: "  Review 财报  ",
    result: "My assessment é  ",
  });
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.resolve).not.toHaveBeenCalled();
  noOtherRequests(f);
});

it("retains invalid raw fields and dates, blocks save, and keeps them out of valid due groups", async () => {
  const f = await fixture();
  await f.loadEntries(f.entry());
  f.workspace.followups.select(f.current().id);
  view(f).change("managed-followup-check", "Invalid\nraw line");
  view(f).change("managed-followup-result", "x".repeat(2001));
  view(f).change("managed-followup-due", "2026-02-30");
  const rendered = view(f);
  expect(rendered.html).toContain("Needs a valid due date");
  expect(rendered.element("managed-followup-due").props.value).toBe(
    "2026-02-30",
  );
  expect(rendered.element("managed-followup-check").props.value).toBe(
    "Invalid\nraw line",
  );
  expect(rendered.element("managed-followup-result").props.value).toHaveLength(
    2001,
  );
  for (const id of [
    "managed-followup-check",
    "managed-followup-result",
    "managed-followup-due",
  ])
    expect(rendered.element(id).props["aria-invalid"]).toBe(true);
  expect(rendered.element("managed-followups-save").props.disabled).toBe(true);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  noOtherRequests(f);
});

it("keeps the captured UTC planning date until explicit reassessment and records completion only in the draft", async () => {
  const f = await fixture();
  await f.loadEntries(f.entry(1, "2026-10-15"), f.entry(2, "2026-10-16"));
  f.workspace.followups.select(f.current().id);
  expect(view(f).html).toContain('aria-label="Due today"');
  vi.setSystemTime(new Date("2026-10-16T00:00:01.000Z"));
  expect(view(f).element("managed-followups-assessed-day").props.dateTime).toBe(
    "2026-10-15",
  );
  view(f).click("managed-followups-reassess");
  const reassessed = view(f);
  expect(reassessed.html).toContain('aria-label="Overdue"');
  expect(reassessed.html).toContain('aria-label="Due today"');
  expect(reassessed.html).toContain(
    "Planning dates do not establish source freshness.",
  );
  reassessed.click("managed-followup-complete");
  expect(f.current()).toMatchObject({
    status: "completed",
    completedOn: "2026-10-16",
  });
  view(f).change("managed-followups-filter", "completed");
  expect(f.workspace.followups.getSnapshot().filter).toBe("completed");
  expect(view(f).html).toContain("1 shown");
  view(f).click("managed-followup-reopen");
  expect(f.current()).toMatchObject({ status: "open", completedOn: null });
  view(f).click("managed-followup-remove");
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft?.entries,
  ).toHaveLength(1);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  noOtherRequests(f);
});

it("keeps both raw draft and loaded saved data readable during conflict, with explicit latest choices", async () => {
  const f = await fixture();
  await f.loadEntries(f.entry());
  f.workspace.followups.select(f.current().id);
  view(f).change("managed-followup-check", "My retained check");
  vi.mocked(f.api.saveFollowups).mockRejectedValueOnce(
    new TrialApiError("conflict"),
  );
  view(f).click("managed-followups-save");
  await vi.waitFor(() =>
    expect(f.workspace.followups.coordinator.getSnapshot().conflict).toBe(true),
  );
  const conflict = view(f);
  expect(conflict.element("managed-followup-check").props.readOnly).toBe(true);
  expect(conflict.html).toContain("My retained check");
  expect(conflict.html).toContain("Read filing 1");
  expect(conflict.element("managed-followups-keep-draft").props.disabled).toBe(
    true,
  );
  vi.mocked(f.api.loadFollowups).mockResolvedValueOnce({
    version: 2,
    payload: {
      schemaVersion: 1,
      entries: [{ ...f.entry(), check: "New shared check" }],
    },
  });
  conflict.click("managed-followups-load");
  await vi.waitFor(() =>
    expect(f.workspace.followups.coordinator.getSnapshot().latestLoaded).toBe(
      true,
    ),
  );
  expect(view(f).html).toContain("New shared check");
  view(f).click("managed-followups-keep-draft");
  expect(f.current().check).toBe("My retained check");
  expect(f.workspace.followups.coordinator.getSnapshot().baseVersion).toBe(2);
  expect(view(f).element("managed-followup-check").props.readOnly).toBe(false);
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  noOtherRequests(f);
});

it("reconciles the exact uncertain command and waits for explicit latest-version selection after replay", async () => {
  const f = await fixture();
  await f.loadEntries(f.entry());
  f.workspace.followups.select(f.current().id);
  view(f).change("managed-followup-result", "My retained result");
  vi.mocked(f.api.saveFollowups).mockRejectedValueOnce(
    new TrialApiError("commit_unknown"),
  );
  view(f).click("managed-followups-save");
  await vi.waitFor(() =>
    expect(f.workspace.followups.coordinator.getSnapshot().uncertain).toBe(
      true,
    ),
  );
  const command = vi.mocked(f.api.saveFollowups).mock.calls[0]![0];
  expect(view(f).element("managed-followups-load").props.disabled).toBe(true);
  vi.mocked(f.api.saveFollowups).mockResolvedValueOnce({
    version: 2,
    payload: command.payload,
    replayed: true,
  });
  view(f).click("managed-followups-reconcile");
  await vi.waitFor(() =>
    expect(f.workspace.followups.coordinator.getSnapshot().replayPending).toBe(
      true,
    ),
  );
  expect(vi.mocked(f.api.saveFollowups).mock.calls[1]![0]).toStrictEqual(
    command,
  );
  expect(view(f).element("managed-followups-use-saved").props.disabled).toBe(
    true,
  );
  vi.mocked(f.api.loadFollowups).mockResolvedValueOnce({
    version: 3,
    payload: {
      schemaVersion: 1,
      entries: [{ ...f.entry(), result: "Later shared result" }],
    },
  });
  view(f).click("managed-followups-load");
  await vi.waitFor(() =>
    expect(f.workspace.followups.coordinator.getSnapshot().latestLoaded).toBe(
      true,
    ),
  );
  view(f).click("managed-followups-use-saved");
  expect(f.current().result).toBe("Later shared result");
  expect(f.workspace.followups.coordinator.getSnapshot().replayPending).toBe(
    false,
  );
  expect(f.api.saveFollowups).toHaveBeenCalledTimes(2);
  noOtherRequests(f);
});

it("reviews four identity outcomes in one explicit batch and applies only eligible metadata without saving", async () => {
  const f = await fixture();
  const old = `sha256:${"b".repeat(64)}` as const;
  const entries = [
    f.entry(),
    { ...f.entry(2), catalogSnapshotSha256: old },
    f.entry(3),
    f.entry(4),
  ];
  await f.loadEntries(...entries);
  const updated = {
    ...entries[1]!.listing,
    symbol: "RENAMED",
    issuerName: "Renamed issuer",
  };
  vi.mocked(f.api.resolve).mockResolvedValueOnce({
    snapshotSha256: f.catalog.snapshot.snapshotSha256,
    results: entries.map((entry, i) => ({
      listingId: entry.listing.listingId,
      listing:
        i === 2
          ? null
          : i === 3
            ? { ...entry.listing, exchangeMic: "XNYS" }
            : i === 1
              ? updated
              : entry.listing,
    })),
  });
  expect(f.api.resolve).not.toHaveBeenCalled();
  view(f).click("managed-followups-review-identities");
  await vi.waitFor(() =>
    expect(f.workspace.followups.getSnapshot().review).not.toBeNull(),
  );
  const review = view(f);
  for (const label of [
    "Current identity",
    "Metadata update available",
    "Not in the current catalog",
    "Different stable identity; update refused",
    "RENAMED",
    "Renamed issuer",
  ])
    expect(review.html).toContain(label);
  expect(f.api.resolve).toHaveBeenCalledOnce();
  expect(vi.mocked(f.api.resolve).mock.calls[0]![0].listingIds).toEqual(
    entries.map((entry) => entry.listing.listingId),
  );
  review.click("managed-followups-apply-identities");
  const next = f.workspace.followups.coordinator.getSnapshot().draft!.entries;
  expect(next[1]!.listing).toEqual(updated);
  expect(next[2]).toEqual(entries[2]);
  expect(next[3]).toEqual(entries[3]);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  noOtherRequests(f);
});

it("passes an exact selected entry and opener only for a current identity and fences stale callbacks after retirement", async () => {
  const f = await fixture();
  await f.loadEntries(f.entry());
  f.workspace.followups.select(f.current().id);
  const current = f.current();
  const opener = {} as HTMLButtonElement;
  view(f).click(`managed-followup-research-${current.id}`, opener);
  expect(f.onResearch).toHaveBeenCalledExactlyOnceWith(current, opener);
  expect(f.api.resolve).not.toHaveBeenCalled();
  const old = view(f);
  f.workspace.sessionOwner.retire();
  (
    old.element(`managed-followup-research-${current.id}`).props
      .onClick as (event: { currentTarget: HTMLButtonElement }) => void
  )({ currentTarget: opener });
  expect(f.onResearch).toHaveBeenCalledOnce();
  expect(view(f).html).not.toContain('id="managed-followup-editor"');
  expect(view(f).element("managed-followups-load").props.disabled).toBe(true);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  noOtherRequests(f);
});

it("keeps old-catalog records readable and authored-editable while research remains disabled", async () => {
  const f = await fixture();
  await f.loadEntries({
    ...f.entry(),
    catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
  });
  f.workspace.followups.select(f.current().id);
  const rendered = view(f);
  expect(rendered.html).toContain("older or unavailable catalog");
  expect(rendered.element("managed-followup-check").props.readOnly).toBe(false);
  expect(
    rendered.element(`managed-followup-research-${f.current().id}`).props
      .disabled,
  ).toBe(true);
  rendered.change("managed-followup-result", "Keep this old research check");
  expect(f.current().result).toBe("Keep this old research check");
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(f.onResearch).not.toHaveBeenCalled();
  noOtherRequests(f);
});

it("disables company navigation while keeping authored follow-up edits and Save available", async () => {
  const f = await fixture();
  await f.loadEntries(f.entry());
  f.workspace.followups.select(f.current().id);
  const held = view(f, true);
  expect(
    held.element(`managed-followup-research-${f.current().id}`).props.disabled,
  ).toBe(true);
  expect(held.element("managed-followup-check").props.readOnly).toBe(false);
  held.change("managed-followup-result", "Retain the authored result");
  expect(f.current().result).toBe("Retain the authored result");
  expect(view(f, true).element("managed-followups-save").props.disabled).toBe(
    false,
  );
  expect(
    view(f).element(`managed-followup-research-${f.current().id}`).props
      .disabled,
  ).toBe(false);
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.onResearch).not.toHaveBeenCalled();
  noOtherRequests(f);
});

it("retains authored values after a failed load and fences a held load on session retirement", async () => {
  const f = await fixture();
  await f.loadEntries(f.entry());
  f.workspace.followups.select(f.current().id);
  view(f).change("managed-followup-check", "Unchanged raw draft");
  vi.mocked(f.api.loadFollowups).mockRejectedValueOnce(
    new TrialApiError("unavailable"),
  );
  view(f).click("managed-followups-load");
  await vi.waitFor(() =>
    expect(f.workspace.followups.coordinator.getSnapshot().phase).toBe("idle"),
  );
  expect(f.current().check).toBe("Unchanged raw draft");
  const held = deferred<ManagedResearchFollowupsDto>();
  vi.mocked(f.api.loadFollowups).mockReturnValueOnce(held.promise);
  view(f).click("managed-followups-load");
  const signal = vi.mocked(f.api.loadFollowups).mock.calls[2]![0];
  f.workspace.sessionOwner.retire();
  expect(signal.aborted).toBe(true);
  held.resolve({
    version: 3,
    payload: { schemaVersion: 1, entries: [f.entry()] },
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(view(f).html).not.toContain("Unchanged raw draft");
  noOtherRequests(f);
});
