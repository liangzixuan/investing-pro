import { describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ResearchFollowup,
  ResearchFollowupsPayload,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { ManagedResearchFollowups } from "./managed-research-followups";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";
import {
  prepareFilingsFollowup,
  type FilingsFollowupPort,
} from "./managed-filings-followup";

const response = filingsResponse(1);
const filing = response.issuer.filings[0]!;
const listing = filingsSelection.listing;
const member: WatchlistMembership = { ...listing, note: "Original note" };
const dueOn = "2026-11-03";
const question = "Does liquidity still cover the next year?";
const id = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const payload = (...entries: ResearchFollowup[]): ResearchFollowupsPayload => ({
  schemaVersion: 1,
  entries,
});
function entry(index: number, currentListing = false): ResearchFollowup {
  return {
    id: id(index),
    listing: currentListing
      ? listing
      : { ...listing, listingId: `other-${index}` },
    catalogSnapshotSha256: response.catalogSnapshotSha256,
    check: "An existing question",
    dueOn,
    status: "completed",
    completedOn: "2026-10-25",
    result: "Keep this completed assessment",
  };
}
function api(initial: ResearchFollowupsPayload) {
  return {
    loadFollowups: vi.fn<ManagedApi["loadFollowups"]>(() =>
      Promise.resolve({
        version: initial.entries.length ? 1 : 0,
        payload: initial,
      }),
    ),
    saveFollowups: vi.fn<ManagedApi["saveFollowups"]>(),
    resolve: vi.fn<ManagedApi["resolve"]>(),
  };
}
function modelFixture(initial: ResearchFollowupsPayload) {
  const service = api(initial);
  const context: {
    draft: MainWatchlistPayload;
    catalogSnapshotSha256: string;
  } = {
    draft: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: response.catalogSnapshotSha256,
      memberships: [member],
    },
    catalogSnapshotSha256: response.catalogSnapshotSha256,
  };
  const model = new ManagedResearchFollowups(
    service,
    {
      userId: "invented-user",
      sessionId: "invented-session",
      getToken: vi.fn(),
      signOut: vi.fn(),
    },
    {
      getCreationContext: () => context,
      onRetire: vi.fn(),
      newEntryId: () => id(100),
    },
  );
  return { model, service, context };
}
async function fixture(initial = payload(), load = true) {
  const f = modelFixture(initial);
  if (load) await f.model.coordinator.load();
  const saved = f.model.coordinator.getSnapshot();
  const watchlist = f.context.draft;
  const original = Object.freeze({});
  const host = {
    source: original,
    route: original,
    watchlist: original,
    active: true,
  };
  const current = () =>
    host.active &&
    host.source === original &&
    host.route === original &&
    host.watchlist === original &&
    f.context.draft === watchlist &&
    f.model.coordinator.getSnapshot() === saved;
  const port: FilingsFollowupPort = {
    model: f.model,
    member,
    response,
    filing,
    showingPrevious: false,
    isCurrent: current,
  };
  let formCurrent = true;
  const prepare = (raw = question, date = dueOn) =>
    prepareFilingsFollowup(port, raw, date, () => formCurrent);
  return {
    ...f,
    host,
    port,
    prepare,
    cancelForm: () => {
      formCurrent = false;
    },
  };
}
function noWrites(f: Awaited<ReturnType<typeof fixture>>) {
  expect(f.service.saveFollowups).not.toHaveBeenCalled();
  expect(f.service.resolve).not.toHaveBeenCalled();
  expect(f.context.draft.memberships).toEqual([member]);
}

describe("dated authored filing question", () => {
  it("previews the complete citation and creates precisely that check in the separate draft once", async () => {
    const f = await fixture();
    const original = f.context.draft;
    const source = structuredClone(response);
    const preview = f.prepare().preview!;
    const expected = `Question: ${question} | SEC filing metadata: Form 10-Q; accession ${filing.accessionNumber}; filed ${filing.filingDate}; ${filing.sourceUrl}`;
    expect(preview.check).toBe(expected);
    expect(preview.dueOn).toBe(dueOn);
    expect(preview.listing).toEqual(listing);
    expect(Object.isFrozen(preview)).toBe(true);
    const created = preview.create()!;
    expect(created).toMatchObject({
      check: expected,
      dueOn,
      status: "open",
      completedOn: null,
      result: "",
    });
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([created]);
    expect(preview.create()).toBeNull();
    expect(preview.isCurrent()).toBe(false);
    expect(f.context.draft).toBe(original);
    expect(response).toEqual(source);
    expect(f.service.loadFollowups).toHaveBeenCalledOnce();
    noWrites(f);
  });

  it("consumes before synchronous coordinator and model notifications", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    const nested: (ResearchFollowup | null)[] = [];
    const stopSaved = f.model.coordinator.subscribe(() =>
      nested.push(preview.create()),
    );
    const stopModel = f.model.subscribe(() => nested.push(preview.create()));
    expect(preview.create()).not.toBeNull();
    stopSaved();
    stopModel();
    expect(nested.length).toBeGreaterThan(0);
    expect(nested.every((value) => value === null)).toBe(true);
    expect(f.model.coordinator.getSnapshot().draft!.entries).toHaveLength(1);
    noWrites(f);
  });

  it("refuses a second independently prepared capability after the first creates", async () => {
    const f = await fixture();
    const first = f.prepare().preview!;
    const second = f.prepare("A separate authored question").preview!;
    expect(first.create()).not.toBeNull();
    expect(second.create()).toBeNull();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toHaveLength(1);
    noWrites(f);
  });

  it("keeps retained-response context and original dates without refreshing metadata", async () => {
    const f = await fixture();
    const preview = prepareFilingsFollowup(
      { ...f.port, showingPrevious: true },
      question,
      dueOn,
      () => true,
    ).preview!;
    expect(preview.check).toBe(f.prepare().preview!.check);
    expect(preview.check).toContain(
      `filed ${filing.filingDate}; ${filing.sourceUrl}`,
    );
    expect(response.requestStartedAt).toBe("2026-10-12T00:00:00.000Z");
    expect(response.issuer.fetchedAt).toBe("2026-10-12T00:00:00.500Z");
    expect(response.completedAt).toBe("2026-10-12T00:00:01.000Z");
    noWrites(f);
  });

  it("Cancel consumes without changing either draft", async () => {
    const f = await fixture();
    const saved = f.model.coordinator.getSnapshot();
    const preview = f.prepare().preview!;
    preview.cancel();
    expect(preview.isCurrent()).toBe(false);
    expect(preview.create()).toBeNull();
    expect(f.model.coordinator.getSnapshot()).toBe(saved);
    noWrites(f);
  });

  it("requires explicit initial Follow-ups Load without performing it", async () => {
    const f = await fixture(payload(), false);
    expect(f.prepare().preview).toBeNull();
    expect(f.prepare().reason).toContain("Load follow-ups");
    expect(f.service.loadFollowups).not.toHaveBeenCalled();
    noWrites(f);
  });

  it.each([
    "",
    " ",
    "line\nbreak",
    "tab\tcheck",
    "control\u0000",
    "format\u200d",
    "surrogate\ud800",
    "😀".repeat(501),
  ])(
    "refuses invalid complete authored question %j without mutation",
    async (raw) => {
      const f = await fixture();
      const saved = f.model.coordinator.getSnapshot();
      expect(f.prepare(raw).preview).toBeNull();
      expect(f.model.coordinator.getSnapshot()).toBe(saved);
      noWrites(f);
    },
  );

  it("checks the raw complete code-point boundary before normalization and never clips", async () => {
    const f = await fixture();
    const citationLength = [...f.prepare("a").preview!.check].length - 1;
    const room = 500 - citationLength;
    const exact = f.prepare("😀".repeat(room)).preview!;
    expect([...exact.check]).toHaveLength(500);
    expect(exact.check).toContain("😀".repeat(room));
    expect(f.prepare("😀".repeat(room + 1)).preview).toBeNull();
    expect(
      f.prepare("e\u0301".repeat(Math.floor(room / 2) + 1)).preview,
    ).toBeNull();
    noWrites(f);
  });

  it("shows the same complete normalized check which creation stores", async () => {
    const f = await fixture();
    const preview = f.prepare("  Cafe\u0301 東京 😀  ").preview!;
    expect(preview.check).toContain(
      "Question:   Café 東京 😀   | SEC filing metadata:",
    );
    expect(preview.create()!.check).toBe(preview.check);
    noWrites(f);
  });

  it.each([
    "",
    "2026-02-29",
    "0000-01-01",
    "10000-01-01",
    "2026-11-03T00:00:00Z",
  ])("refuses invalid UTC planning date %j", async (date) => {
    const f = await fixture();
    expect(f.prepare(question, date).preview).toBeNull();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
    noWrites(f);
  });

  it("accepts an early real UTC planning date without changing source clocks", async () => {
    const f = await fixture();
    expect(f.prepare(question, "0001-01-01").preview!.dueOn).toBe("0001-01-01");
    expect(filing.filingDate).toBe("2026-10-11");
    expect(response.completedAt).toBe("2026-10-12T00:00:01.000Z");
  });

  it("does not replace an existing completed entry", async () => {
    const existing = entry(1, true);
    const f = await fixture(payload(existing));
    const draft = f.model.coordinator.getSnapshot().draft;
    expect(f.prepare().reason).toContain("already has a follow-up");
    expect(f.prepare().preview).toBeNull();
    expect(f.model.coordinator.getSnapshot().draft).toBe(draft);
    expect(draft!.entries).toEqual([existing]);
    noWrites(f);
  });

  it("retains the twenty-entry limit", async () => {
    const f = await fixture(
      payload(...Array.from({ length: 20 }, (_, i) => entry(i))),
    );
    expect(f.prepare().reason).toContain("20 entries");
    expect(f.prepare().preview).toBeNull();
    noWrites(f);
  });

  it.each(["source", "route", "watchlist"] as const)(
    "permanently retires an observed %s round trip",
    async (boundary) => {
      const f = await fixture();
      const preview = f.prepare().preview!;
      const original = f.host[boundary];
      f.host[boundary] = Object.freeze({});
      expect(preview.isCurrent()).toBe(false);
      f.host[boundary] = original;
      expect(preview.create()).toBeNull();
      expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
      noWrites(f);
    },
  );

  it("retires after a real Follow-ups draft edit and identical-content restoration", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    const original = f.model.coordinator.getSnapshot().draft!;
    f.model.coordinator.replaceDraft(payload(entry(2)));
    f.model.coordinator.replaceDraft(original);
    expect(preview.create()).toBeNull();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
    noWrites(f);
  });

  it.each(["form", "session"])(
    "retires after %s cancellation",
    async (boundary) => {
      const f = await fixture();
      const preview = f.prepare().preview!;
      if (boundary === "form") f.cancelForm();
      else f.host.active = false;
      expect(preview.create()).toBeNull();
      expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
      noWrites(f);
    },
  );

  it("rechecks lifetime after preparation and before draft creation", async () => {
    const f = await fixture();
    const original = f.model.prepareNextCheck.bind(f.model);
    const prepare = vi
      .spyOn(f.model, "prepareNextCheck")
      .mockImplementation((...args) => {
        const prepared = original(...args);
        f.host.active = false;
        return prepared;
      });
    expect(f.prepare().preview).toBeNull();
    prepare.mockRestore();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
    noWrites(f);
  });

  it("refuses cloned or foreign filing rows and changed share-class identity", async () => {
    const f = await fixture();
    for (const port of [
      { ...f.port, filing: { ...filing } },
      { ...f.port, filing: filingsResponse(1).issuer.filings[0]! },
      { ...f.port, member: { ...member, shareClassId: "changed" } },
      {
        ...f.port,
        response: {
          ...response,
          issuer: {
            ...response.issuer,
            status: "upstream_unavailable" as const,
          },
        },
      },
    ])
      expect(
        prepareFilingsFollowup(port, question, dueOn, () => true).preview,
      ).toBeNull();
    noWrites(f);
  });

  it("refuses a packet from another catalog even with the same listing", async () => {
    const f = await fixture();
    const foreign = {
      ...response,
      catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const,
    };
    expect(
      prepareFilingsFollowup(
        { ...f.port, response: foreign },
        question,
        dueOn,
        () => true,
      ).preview,
    ).toBeNull();
    noWrites(f);
  });
});
