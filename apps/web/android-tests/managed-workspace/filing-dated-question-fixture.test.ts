import { afterEach, describe, expect, it } from "vitest";
import {
  ManagedWorkspace,
  listingIdentity,
} from "../../src/clerk-trial/managed-workspace";
import { prepareFilingsFollowup } from "../../src/clerk-trial/managed-filings-followup";
import { createFixture } from "./fixture";
import {
  filingDatedQuestion,
  filingDatedQuestionCheck,
  filingDatedQuestionDueOn,
} from "./filing-dated-question-fixture";

const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
});
type Fixture = Awaited<ReturnType<typeof createFixture>>;
async function mount(fixture: Fixture, fresh = false) {
  const workspace = new ManagedWorkspace(
    fixture.api,
    fresh ? fixture.followups!.nextSession() : fixture.session,
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
  return workspace;
}
async function openFiling() {
  const fixture = await createFixture("filing-dated-question");
  const workspace = await mount(fixture);
  const group = workspace.filingsReview;
  workspace.setView("watchlist");
  for (const member of group.getSnapshot().memberships)
    group.choose(group.getSnapshot(), member);
  group.start(group.getSnapshot());
  expect(fixture.getSnapshot().filings).toBe(0);
  await group.load(group.getSnapshot());
  const row = group.getSnapshot().rows[0]!;
  const retainedResponse = row.filings.response!;
  expect(
    retainedResponse,
    JSON.stringify(fixture.getSnapshot()),
  ).not.toBeNull();
  workspace.openFilingsReview({
    member: row.member,
    response: retainedResponse,
  });
  const response = workspace.filings.getSnapshot().response!;
  const selection = workspace.getSnapshot().research!.selection;
  const filing = response.issuer.filings[0]!;
  return { fixture, workspace, group, row, response, filing, selection };
}
type Opened = Awaited<ReturnType<typeof openFiling>>;
async function loadAndPreview(opened: Opened) {
  const { workspace, selection, response, filing } = opened;
  await workspace.loadFilingsFollowups(selection, response, filing, () => true);
  const context = workspace.captureFilingsFollowup(selection, response, filing);
  expect(context.reason).toBeNull();
  const prepared = prepareFilingsFollowup(
    context.port!,
    filingDatedQuestion,
    filingDatedQuestionDueOn,
    () => true,
  );
  expect(prepared.reason).toBeNull();
  expect(prepared.preview!.check).toBe(filingDatedQuestionCheck);
  expect(prepared.preview!.dueOn).toBe(filingDatedQuestionDueOn);
  return prepared.preview!;
}
function reversedKeys<T extends object>(value: T): T {
  const copy = { ...value };
  for (const key of Object.keys(value).reverse()) {
    Reflect.deleteProperty(copy, key);
    Reflect.set(copy, key, Reflect.get(value, key));
  }
  return copy;
}
function command(opened: Opened) {
  return {
    expectedVersion: 0,
    idempotencyKey: "10000000-0000-4000-8000-000000000003",
    payload: structuredClone(
      opened.workspace.followups.coordinator.getSnapshot().draft!,
    ),
  };
}
function requireNoWrites(opened: Opened) {
  expect(opened.fixture.getSnapshot().save).toBe(0);
  expect(opened.fixture.followups!.getSnapshot().save).toBe(0);
  expect(opened.fixture.followups!.getSnapshot().commits).toBe(0);
}
function requireSourceBudget(fixture: Fixture, sessions: number) {
  const counts = fixture.getSnapshot();
  expect({
    load: counts.load,
    status: counts.status,
    marketsResolve: counts.marketsResolve,
    resolve: counts.resolve,
    filings: counts.filings,
    save: counts.save,
    annual: counts.annual,
    eod: counts.eod,
    calendar: counts.calendar,
    fed: counts.fed,
    search: counts.search,
    marketsEod: counts.marketsEod,
    token: counts.token,
    signOut: counts.signOut,
  }).toEqual({
    load: sessions,
    status: sessions,
    marketsResolve: sessions,
    resolve: 0,
    filings: 1,
    save: 0,
    annual: 0,
    eod: 0,
    calendar: 0,
    fed: 0,
    search: 0,
    marketsEod: 0,
    token: 0,
    signOut: 0,
  });
}

async function cancelCompletePreview(opened: Opened) {
  const { fixture, workspace } = opened;
  expect(fixture.followups!.getSnapshot().load).toBe(0);
  const cancelled = await loadAndPreview(opened);
  cancelled.cancel();
  expect(cancelled.create()).toBeNull();
  expect(workspace.followups.coordinator.getSnapshot().draft).toEqual({
    schemaVersion: 1,
    entries: [],
  });
  requireNoWrites(opened);
}
function createExactQuestion(
  opened: Opened,
  watchlist: NonNullable<
    ReturnType<ManagedWorkspace["coordinator"]["getSnapshot"]>["draft"]
  >,
) {
  const { workspace, response } = opened;
  const context = workspace.captureFilingsFollowup(
    opened.selection,
    response,
    opened.filing,
  );
  const next = prepareFilingsFollowup(
    context.port!,
    filingDatedQuestion,
    filingDatedQuestionDueOn,
    () => true,
  ).preview!;
  const created = next.create();
  expect(created).not.toBeNull();
  expect(next.create()).toBeNull();
  const listing = listingIdentity(watchlist.memberships[0]!);
  const expected = {
    schemaVersion: 1,
    entries: [
      {
        id: created!.id,
        catalogSnapshotSha256: watchlist.snapshotSha256,
        listing,
        check: filingDatedQuestionCheck,
        dueOn: filingDatedQuestionDueOn,
        result: "",
        status: "open",
        completedOn: null,
      },
    ],
  };
  return expected;
}
type ExpectedQuestion = ReturnType<typeof createExactQuestion>;
function retainChosenGroup(opened: Opened) {
  const { fixture, workspace, group, row } = opened;
  workspace.closeResearch();
  expect(group.getSnapshot().selected).toBe(row.member);
  expect(
    group.getSnapshot().rows.map((item) => item.member.listing.listingId),
  ).toEqual(["listing-zero", "listing-one"]);
  expect(group.getSnapshot().rows[0]!.filings.response).toBe(
    row.filings.response,
  );
  expect(group.getSnapshot().rows[1]!.filings.response).toBeNull();
  requireNoWrites(opened);
  requireSourceBudget(fixture, 1);
}
async function saveIndependentQuestion(
  opened: Opened,
  expected: ExpectedQuestion,
) {
  const { fixture, workspace } = opened;
  workspace.setView("followups");
  await workspace.followups.coordinator.save();
  expect(workspace.followups.coordinator.getSnapshot().saved).toEqual({
    version: 1,
    payload: expected,
  });
  expect(fixture.followups!.getSnapshot()).toMatchObject({
    load: 1,
    save: 1,
    commits: 1,
  });
}
async function restoreFreshQuestion(
  opened: Opened,
  expected: ExpectedQuestion,
  watchlist: NonNullable<
    ReturnType<ManagedWorkspace["coordinator"]["getSnapshot"]>["draft"]
  >,
) {
  const { fixture, workspace } = opened;
  workspace.sessionOwner.dispose();
  const fresh = await mount(fixture, true);
  expect(fresh.coordinator.getSnapshot().draft).toEqual(watchlist);
  expect(fresh.followups.coordinator.getSnapshot().draft).toBeNull();
  await fresh.followups.coordinator.load();
  expect(fresh.followups.coordinator.getSnapshot().draft).toEqual(expected);
  expect(fresh.followups.coordinator.getSnapshot().saved).toEqual({
    version: 1,
    payload: expected,
  });
  expect(fresh.filingsReview.getSnapshot().rows).toEqual([]);
  requireSourceBudget(fixture, 2);
  expect(fixture.followups!.getSnapshot()).toMatchObject({
    load: 2,
    save: 1,
    commits: 1,
    replays: 0,
  });
}

type SavedCommand = ReturnType<typeof command>;
function patchSavedEntry(value: SavedCommand, patch: object) {
  Object.assign(value.payload.entries[0]!, patch);
}
function replaceCitation(
  value: SavedCommand,
  change: readonly [string, string],
) {
  patchSavedEntry(value, {
    check: value.payload.entries[0]!.check.replace(...change),
  });
}
const invalidSavedCommands: readonly {
  name: string;
  mutate: (value: SavedCommand) => void;
}[] = [
  {
    name: "question",
    mutate: (value) =>
      replaceCitation(value, [filingDatedQuestion, "Shortened question"]),
  },
  {
    name: "form",
    mutate: (value) => replaceCitation(value, ["Form 10-Q", "Form 8-K"]),
  },
  {
    name: "accession",
    mutate: (value) =>
      replaceCitation(value, ["0000000001-26-000001", "0000000001-26-000002"]),
  },
  {
    name: "filed date",
    mutate: (value) =>
      replaceCitation(value, ["filed 2026-09-19", "filed 2026-09-20"]),
  },
  {
    name: "source URL",
    mutate: (value) => replaceCitation(value, ["/data/1/", "/data/2/"]),
  },
  {
    name: "due date",
    mutate: (value) => patchSavedEntry(value, { dueOn: "2027-01-01" }),
  },
  {
    name: "assessment",
    mutate: (value) =>
      patchSavedEntry(value, { result: "Unrelated assessment" }),
  },
  {
    name: "completion",
    mutate: (value) =>
      patchSavedEntry(value, {
        status: "completed",
        completedOn: "2026-10-26",
      }),
  },
  {
    name: "listing",
    mutate: (value) => {
      Object.assign(value.payload.entries[0]!.listing, {
        shareClassId: "other-class",
      });
    },
  },
  {
    name: "digest",
    mutate: (value) =>
      patchSavedEntry(value, {
        catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
      }),
  },
  {
    name: "extra entry",
    mutate: (value) => {
      const entry = value.payload.entries[0]!;
      Object.assign(value.payload, {
        entries: [
          entry,
          { ...entry, id: "10000000-0000-4000-8000-000000000004" },
        ],
      });
    },
  },
  {
    name: "extra key",
    mutate: (value) => patchSavedEntry(value, { sourceRefreshed: true }),
  },
  {
    name: "expected version",
    mutate: (value) => {
      value.expectedVersion = 1;
    },
  },
];

describe("isolated filing dated-question native fixture", () => {
  it("cancels one complete preview, creates once, retains exact group source, and restores the whole independently saved resource", async () => {
    const opened = await openFiling();
    const watchlist = structuredClone(
      opened.workspace.coordinator.getSnapshot().draft!,
    );
    const source = structuredClone(opened.response);
    await cancelCompletePreview(opened);
    const expected = createExactQuestion(opened, watchlist);
    expect(opened.workspace.followups.coordinator.getSnapshot().draft).toEqual(
      expected,
    );
    expect(opened.workspace.coordinator.getSnapshot().draft).toEqual(watchlist);
    expect(opened.response).toEqual(source);
    retainChosenGroup(opened);
    await saveIndependentQuestion(opened, expected);
    await restoreFreshQuestion(opened, expected, watchlist);
  });
  it.each(invalidSavedCommands)(
    "refuses changed complete saved $name without a resource commit",
    async ({ mutate }) => {
      const opened = await openFiling();
      const preview = await loadAndPreview(opened);
      expect(preview.create()).not.toBeNull();
      const altered = command(opened);
      mutate(altered);
      expect(() =>
        opened.fixture.api.saveFollowups(altered, new AbortController().signal),
      ).toThrow("Unexpected invented");
      requireNoWrites(opened);
    },
  );
  it("accepts complete structural equality when command, entry and listing object keys are reordered", async () => {
    const opened = await openFiling();
    (await loadAndPreview(opened)).create();
    const original = command(opened);
    const entry = original.payload.entries[0]!;
    const reordered = reversedKeys({
      ...original,
      payload: reversedKeys({
        ...original.payload,
        entries: [
          reversedKeys({ ...entry, listing: reversedKeys(entry.listing) }),
        ],
      }),
    });
    expect(Object.keys(reordered)).toEqual(Object.keys(original).reverse());
    expect(Object.keys(reordered.payload.entries[0]!.listing)).toEqual(
      Object.keys(entry.listing).reverse(),
    );
    await expect(
      opened.fixture.api.saveFollowups(reordered, new AbortController().signal),
    ).resolves.toEqual({
      version: 1,
      payload: original.payload,
      replayed: false,
    });
  });
  it("refuses initial Follow-ups Load before a filing and never reads it implicitly", async () => {
    const fixture = await createFixture("filing-dated-question");
    await mount(fixture);
    expect(() =>
      fixture.api.loadFollowups(new AbortController().signal),
    ).toThrow("Unexpected invented");
    expect(fixture.followups!.getSnapshot().load).toBe(0);
  });
  it.each([
    "Watchlist Save",
    "Annual",
    "Price",
    "calendar",
    "Fed",
    "Portfolio",
    "valuation",
  ])(
    "refuses unexpected %s and closes subsequent commit admission",
    async (operation) => {
      const opened = await openFiling();
      (await loadAndPreview(opened)).create();
      const { api } = opened.fixture;
      const signal = new AbortController().signal;
      const actions: Record<string, () => unknown> = {
        "Watchlist Save": () => api.save({} as never, signal),
        Annual: () => api.annualReport({} as never, signal),
        Price: () => api.eodHistory({} as never, signal),
        calendar: () => api.blsCalendar(signal),
        Fed: () => api.monetaryAnnouncements(signal),
        Portfolio: () => api.loadPortfolio(signal),
        valuation: () => api.loadValuationAssumptions(signal),
      };
      expect(actions[operation]).toThrow("Unexpected invented");
      expect(() => api.saveFollowups(command(opened), signal)).toThrow(
        "Unexpected invented",
      );
      expect(opened.fixture.followups!.getSnapshot().commits).toBe(0);
    },
  );
  it("refuses cancelled saves and extra source reads without a commit", async () => {
    const opened = await openFiling();
    (await loadAndPreview(opened)).create();
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      opened.fixture.api.saveFollowups(command(opened), controller.signal),
    ).toThrow("Unexpected invented");
    expect(() =>
      opened.fixture.api.recentFilings(
        {} as never,
        new AbortController().signal,
      ),
    ).toThrow("Unexpected invented");
    requireNoWrites(opened);
  });
});
