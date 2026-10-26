import type { ManagedCompanyNavigation } from "../../src/clerk-trial/useManagedCompanyNavigation";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { ManagedHoldingFollowup } from "../../src/clerk-trial/ManagedHoldingFollowup";
import { managedCompanySourceActionsProps } from "../../src/clerk-trial/managed-company-source-actions-props";
import { afterEach, describe, expect, it } from "vitest";
import { prepareHoldingFollowup } from "../../src/clerk-trial/managed-holding-followup";
import { createResearchFollowupsFixture } from "./followups-fixture";
import { createFixture } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import {
  holdingFollowupExpected,
  holdingFollowupLedger,
  holdingFollowupOriginal,
  holdingFollowupQuestion,
  holdingFollowupDueOn,
  holdingFollowupWatchlist,
} from "./holding-followup-fixture";

const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
});
function makeWorkspace(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  fresh = false,
) {
  const workspace = new ManagedWorkspace(
    fixture.api,
    fresh ? fixture.portfolio!.nextSession() : fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      priceCoverage: fixture.priceCoverage,
      marketsCohort: fixture.marketsCohort,
    },
  );
  workspaces.push(workspace);
  return workspace;
}
async function mounted() {
  const fixture = await createFixture("holding-followup");
  const workspace = makeWorkspace(fixture);
  await workspace.refreshCatalog();
  await workspace.portfolio.coordinator.load();
  workspace.setView("portfolio");
  await workspace.portfolio.reviewCatalog();
  workspace.portfolio.applyReview();
  return { fixture, workspace };
}
type Mounted = Awaited<ReturnType<typeof mounted>>;
function openPosition({ workspace }: Mounted, listingId = "listing-one") {
  const draft = workspace.portfolio.coordinator.getSnapshot().draft!;
  workspace.openPortfolioResearch(
    draft,
    draft.ledger!.identities.find((row) => row.listingId === listingId)!,
  );
  const selection = workspace.getSnapshot().research!.selection;
  expect(workspace.getHoldingResearchPosition(selection)).toMatchObject({
    listing: { listingId },
    shares: listingId === "listing-one" ? "3" : "2",
    totalCostBasisUsd: listingId === "listing-one" ? null : "80.00",
    confirmedOn: listingId === "listing-one" ? "2026-10-03" : "2026-10-02",
  });
  return selection;
}
function prepared(f: Mounted, selection: ReturnType<typeof openPosition>) {
  const context = f.workspace.captureHoldingFollowup(selection);
  expect(context.reason).toBeNull();
  const result = prepareHoldingFollowup(
    context.port!,
    holdingFollowupQuestion,
    holdingFollowupDueOn,
    () => true,
  );
  expect(result.reason).toBeNull();
  expect(result.preview!.check).toBe(holdingFollowupQuestion);
  expect(result.preview!.dueOn).toBe(holdingFollowupDueOn);
  return result.preview!;
}
function noOtherEffects(f: Mounted, sessions = 1) {
  expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
  expect(f.fixture.getSnapshot()).toMatchObject({
    load: 0,
    save: 0,
    status: sessions,
    marketsResolve: sessions,
    resolve: 1,
    annual: 0,
    eod: 0,
    filings: 0,
    calendar: 0,
    fed: 0,
    search: 0,
    marketsEod: 0,
    token: 0,
    signOut: 0,
  });
  expect(f.fixture.portfolio!.getSnapshot()).toMatchObject({
    load: 1,
    save: 0,
    commits: 0,
    token: 0,
    signOut: 0,
  });
}
async function saveAndRestore(
  f: Mounted,
  expected: ReturnType<typeof holdingFollowupExpected>,
) {
  f.workspace.setView("followups");
  await f.workspace.followups.coordinator.save();
  expect(f.workspace.followups.coordinator.getSnapshot().saved).toEqual({
    version: 2,
    payload: expected,
  });
  f.workspace.sessionOwner.dispose();
  const fresh = makeWorkspace(f.fixture, true);
  await fresh.refreshCatalog();
  expect(fresh.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(fresh.coordinator.getSnapshot().draft).toBeNull();
  fresh.setView("followups");
  await fresh.followups.coordinator.load();
  expect(fresh.followups.coordinator.getSnapshot()).toMatchObject({
    baseVersion: 2,
    dirty: false,
    draft: expected,
    saved: { version: 2, payload: expected },
  });
  expect(f.fixture.followups!.getSnapshot()).toMatchObject({
    session: 2,
    load: 2,
    save: 1,
    commits: 1,
    replays: 0,
  });
  noOtherEffects(f, 2);
}
function companyNavigation(
  pending = false,
  invalid = false,
): ManagedCompanyNavigation {
  return {
    pending,
    invalid,
    isPending: () => pending,
    returnFocus: 0,
    open: () => {
      throw new Error("Unexpected navigation action");
    },
    section: () => {
      throw new Error("Unexpected source section change");
    },
    view: () => false,
    back: () => {
      throw new Error("Unexpected Back action");
    },
    hasCompanyRoute: () => true,
  };
}
function recordingReviewNavigation(f: Mounted) {
  const state = {
    destination: "?company=listing-one&section=price",
    transitions: 0,
  };
  const navigation = companyNavigation();
  navigation.view = (next) => {
    state.transitions++;
    expect(next).toBe("followups");
    f.workspace.setNavigationBlocked(true);
    f.workspace.setView(next);
    state.destination = "/";
    return true;
  };
  return { state, navigation };
}
describe("invented holding Follow-ups protocol", () => {
  it("keeps the full exact readout after the router settles the existing Portfolio company URL", async () => {
    const f = await mounted();
    const selection = openPosition(f, "listing-zero");
    f.workspace.setNavigationBlocked(true);
    await f.workspace.setCompanyRoute({
      kind: "company",
      listingId: "listing-zero",
      section: "eod",
    });
    expect(f.workspace.getSnapshot().companyRoute).toMatchObject({
      listingId: "listing-zero",
      section: "eod",
      status: "open",
    });
    const visit = f.workspace.getSnapshot().research!;
    expect(visit.selection).toBe(selection);
    const props = managedCompanySourceActionsProps(
      f.workspace,
      visit,
      undefined,
    );
    const html = load(
      renderToStaticMarkup(
        createElement(ManagedHoldingFollowup, {
          actions: props.holdingFollowupActions!,
          owner: selection,
          position: props.holdingPosition ?? null,
        }),
      ),
    );
    expect(html("#managed-holding-followup")).toHaveLength(1);
    expect(html("#holding-followup-shares").text()).toBe("2");
    expect(html("#holding-followup-basis").text()).toBe("80.00");
    expect(html("#holding-followup-confirmed").text()).toBe("2026-10-02");
    expect(html(".managed-holding-followup-position > p").text()).toBe(
      "ZERO · Zero CompanyClass A · XNAS · Common stock",
    );
    expect(f.workspace.canLoadHoldingFollowups(selection)).toBe(true);
    noOtherEffects(f);
  });

  it("refuses unsettled, pending, invalid and replaced company visits without loading or creating", async () => {
    const f = await mounted();
    const selection = openPosition(f, "listing-zero");
    f.workspace.setNavigationBlocked(true);
    expect(f.workspace.getHoldingResearchPosition(selection)).toBeNull();
    expect(f.workspace.canLoadHoldingFollowups(selection)).toBe(false);
    await f.workspace.setCompanyRoute({
      kind: "company",
      listingId: "listing-zero",
      section: "eod",
    });
    const visit = f.workspace.getSnapshot().research!;
    for (const navigation of [
      companyNavigation(true),
      companyNavigation(false, true),
    ]) {
      const actions = managedCompanySourceActionsProps(
        f.workspace,
        visit,
        navigation,
      ).holdingFollowupActions!;
      expect(actions.getContext().port).toBeNull();
      expect(actions.canLoad()).toBe(false);
      await actions.load(() => true);
    }
    const stale = managedCompanySourceActionsProps(
      f.workspace,
      visit,
      companyNavigation(),
    ).holdingFollowupActions!;
    f.workspace.setNavigationBlocked(false);
    f.workspace.closeResearch();
    openPosition(f, "listing-one");
    f.workspace.setNavigationBlocked(true);
    await f.workspace.setCompanyRoute({
      kind: "company",
      listingId: "listing-one",
      section: "eod",
    });
    expect(f.workspace.getHoldingResearchPosition(selection)).toBeNull();
    expect(stale.getContext().port).toBeNull();
    expect(stale.canLoad()).toBe(false);
    await stale.load(() => true);
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      load: 0,
      save: 0,
      commits: 0,
    });
    noOtherEffects(f);
  });
  it("reviews the exact existing holding check through the real props navigation bridge without saving or overwriting", async () => {
    const f = await mounted();
    const selection = openPosition(f);
    f.workspace.setNavigationBlocked(true);
    await f.workspace.setCompanyRoute({
      kind: "company",
      listingId: "listing-one",
      section: "eod",
    });
    await f.workspace.loadHoldingFollowups(selection, () => true);
    const created = prepared(f, selection).create();
    expect(created).not.toBeNull();
    const resource = f.workspace.followups.coordinator.getSnapshot();
    const visit = f.workspace.getSnapshot().research!;
    const bridge = recordingReviewNavigation(f);
    const props = managedCompanySourceActionsProps(
      f.workspace,
      visit,
      bridge.navigation,
    );
    const html = load(
      renderToStaticMarkup(
        createElement(ManagedHoldingFollowup, {
          actions: props.holdingFollowupActions!,
          owner: selection,
          position: props.holdingPosition ?? null,
        }),
      ),
    );
    expect(html(".managed-holding-followup-position > p").text()).toBe(
      "ONE · One CompanyClass A · XNAS · Common stock",
    );
    props.holdingFollowupActions!.reviewExisting();
    expect(bridge.state.transitions).toBe(1);
    expect(bridge.state.destination).toBe("/");
    expect(f.workspace.getSnapshot()).toMatchObject({
      view: "followups",
      research: null,
      companyRoute: null,
    });
    expect(f.workspace.followups.getSnapshot()).toMatchObject({
      selectedId: created!.id,
      filter: "open",
    });
    expect(f.workspace.followups.coordinator.getSnapshot()).toBe(resource);
    expect(resource.draft).toEqual(
      holdingFollowupExpected(f.fixture, created!.id),
    );
    f.workspace.setNavigationBlocked(false);
    await f.workspace.setCompanyRoute(null);
    expect(f.workspace.followups.getSnapshot()).toMatchObject({
      selectedId: created!.id,
      filter: "open",
    });
    expect(f.workspace.followups.coordinator.getSnapshot()).toBe(resource);
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      load: 1,
      save: 0,
      commits: 0,
    });
    noOtherEffects(f);
  });
  it("preserves the empty default resource and rejects a nonempty version-zero seed", async () => {
    const resource = createResearchFollowupsFixture();
    expect(resource.getSnapshot()).toMatchObject({
      version: 0,
      load: 0,
      save: 0,
    });
    expect(
      await resource.api.loadFollowups(new AbortController().signal),
    ).toEqual({ version: 0, payload: { schemaVersion: 1, entries: [] } });
    const fixture = await createFixture("holding-followup");
    expect(() =>
      createResearchFollowupsFixture({
        version: 0,
        payload: holdingFollowupOriginal(fixture),
      }),
    ).toThrow("Invalid invented follow-up store");
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      version: 1,
      load: 0,
      save: 0,
    });
  });
  it("takes an outside-Watchlist holding through explicit Load, cancel, one-time creation, retained Back and independent Save/fresh Load", async () => {
    const f = await mounted();
    const original = f.workspace.portfolio.coordinator.getSnapshot();
    expect(
      holdingFollowupWatchlist(f.fixture).payload.memberships.map(
        (row) => row.listingId,
      ),
    ).toEqual(["listing-alfa"]);
    const known = openPosition(f, "listing-zero");
    expect(f.workspace.canLoadHoldingFollowups(known)).toBe(true);
    f.workspace.closeResearch();
    const selection = openPosition(f);
    expect(f.workspace.captureHoldingFollowup(selection).port).toBeNull();
    await f.workspace.loadHoldingFollowups(selection, () => true);
    expect(
      f.workspace.canLoadHoldingFollowups(selection),
      JSON.stringify({
        resource: f.workspace.followups.coordinator.getSnapshot(),
        fixture: f.fixture.followups!.getSnapshot(),
      }),
    ).toBe(false);
    const cancelled = prepared(f, selection);
    cancelled.cancel();
    expect(cancelled.create()).toBeNull();
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toEqual(
      holdingFollowupOriginal(f.fixture),
    );
    const preview = prepared(f, selection);
    let reentrant: unknown = "not called";
    const stop = f.workspace.followups.coordinator.subscribe(() => {
      reentrant = preview.create();
    });
    const created = preview.create();
    stop();
    expect(created).not.toBeNull();
    expect(reentrant).toBeNull();
    expect(preview.create()).toBeNull();
    const expected = holdingFollowupExpected(f.fixture, created!.id);
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toEqual(
      expected,
    );
    expect(f.workspace.followups.coordinator.getSnapshot().dirty).toBe(true);
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      load: 1,
      save: 0,
      commits: 0,
    });
    f.workspace.closeResearch();
    expect(f.workspace.getSnapshot().view).toBe("portfolio");
    expect(f.workspace.getSnapshot().research).toBeNull();
    expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(original);
    noOtherEffects(f);
    await saveAndRestore(f, expected);
  });
  it("loads and approves exact authored known and unavailable positions without loading My Watchlist or reading a source", async () => {
    const { fixture, workspace } = await mounted();
    expect(workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(workspace.portfolio.coordinator.getSnapshot().saved).toEqual({
      version: 1,
      payload: { ledger: holdingFollowupLedger(fixture).payload },
    });
    expect(workspace.portfolio.getProjection()).toMatchObject({
      status: "valid",
      portfolio: {
        holdings: [
          {
            identity: { listingId: "listing-zero" },
            shares: "2",
            totalCostBasisUsd: "80.00",
            confirmedOn: "2026-10-02",
          },
          {
            identity: { listingId: "listing-one" },
            shares: "3",
            totalCostBasisUsd: null,
            confirmedOn: "2026-10-03",
          },
        ],
      },
    });
    expect(workspace.portfolio.canSavePayload()).toBe(true);
    expect(fixture.getSnapshot()).toMatchObject({
      load: 0,
      save: 0,
      status: 1,
      resolve: 1,
      marketsResolve: 1,
      eod: 0,
      annual: 0,
      filings: 0,
    });
    expect(fixture.portfolio!.getSnapshot()).toMatchObject({
      load: 1,
      save: 0,
      commits: 0,
    });
  });
  it("preserves the independent original check and admits only the complete ordered holding Save then fresh Load", async () => {
    const fixture = await createFixture("holding-followup");
    const signal = new AbortController().signal;
    expect(await fixture.api.loadFollowups(signal)).toEqual({
      version: 1,
      payload: holdingFollowupOriginal(fixture),
    });
    const payload = holdingFollowupExpected(
      fixture,
      "10000000-0000-4000-8000-000000000002",
    );
    const command = {
      expectedVersion: 1,
      idempotencyKey: "10000000-0000-4000-8000-000000000003",
      payload,
    };
    const malformed = {
      ...command,
      payload: { ...payload, entries: [...payload.entries].reverse() },
    };
    expect(() => fixture.api.saveFollowups(malformed, signal)).toThrow(
      "Unexpected invented",
    );
    expect(fixture.followups!.getSnapshot().save).toBe(0);
    expect(await fixture.api.saveFollowups(command, signal)).toEqual({
      version: 2,
      payload,
      replayed: false,
    });
    fixture.portfolio!.nextSession();
    expect(await fixture.api.loadFollowups(signal)).toEqual({
      version: 2,
      payload,
    });
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      session: 2,
      load: 2,
      save: 1,
      commits: 1,
      replays: 0,
    });
    expect(fixture.getSnapshot()).toMatchObject({
      load: 0,
      save: 0,
      eod: 0,
      annual: 0,
      filings: 0,
    });
  });
});
