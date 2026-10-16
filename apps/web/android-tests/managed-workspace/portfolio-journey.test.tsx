import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ManagedPortfolio } from "../../src/clerk-trial/ManagedPortfolio";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { createFixture } from "./fixture";

const active: ManagedWorkspace[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T12:00:00.000Z"));
});
afterEach(() => {
  for (const workspace of active.splice(0)) workspace.sessionOwner.dispose();
  vi.useRealTimers();
});
async function setup() {
  const fixture = await createFixture("portfolio-ledger");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
    },
  );
  active.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  return {
    fixture,
    workspace,
    model: workspace.portfolio,
    controls: fixture.portfolio!,
  };
}
function current(model: ManagedWorkspace["portfolio"]) {
  const draft = model.coordinator.getSnapshot().draft;
  if (!draft) throw new Error("Load the Portfolio draft");
  return draft;
}
async function author(f: Awaited<ReturnType<typeof setup>>) {
  f.workspace.setView("portfolio");
  await f.model.coordinator.load();
  f.model.start("2026-10-01", "1000.00");
  await f.model.register(f.fixture.priceCoverage[0]!);
  const draft = current(f.model);
  if (!draft.ledger) throw new Error("Start the Portfolio draft");
  f.model.replace(draft, {
    ...draft.ledger,
    transactions: [
      {
        id: "invented-buy",
        date: "2026-10-02",
        type: "buy",
        listingId: "listing-zero",
        shares: "2.000000",
        grossUsd: "200.00",
        feeUsd: "1.00",
      },
      {
        id: "invented-sell",
        date: "2026-10-03",
        type: "sell",
        listingId: "listing-zero",
        shares: "1.000000",
        grossUsd: "150.00",
        feeUsd: "1.00",
      },
    ],
  });
}
function exact(model: ManagedWorkspace["portfolio"]) {
  const result = model.getProjection();
  expect(result?.status).toBe("valid");
  if (result?.status !== "valid") throw new Error("Expected projected ledger");
  expect(result.portfolio.cashUsd).toBe("948.00");
  expect(result.portfolio.holdings).toHaveLength(1);
  expect(result.portfolio.holdings[0]).toMatchObject({
    shares: "1",
    totalCostBasisUsd: "100.50",
  });
  expect(result.realized.totalGainUsd).toBe("48.50");
}
it("authors the exact FIFO ledger, preserves both other drafts, returns from research and reconciles/reopens only explicitly", async () => {
  const f = await setup();
  const watchlist = f.workspace.coordinator.getSnapshot().draft!;
  f.workspace.coordinator.replaceDraft({
    ...watchlist,
    memberships: watchlist.memberships.map((member) => ({
      ...member,
      note: "Independent Watchlist note",
    })),
  });
  await f.workspace.followups.coordinator.load();
  f.workspace.followups.add(
    f.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    "2026-10-20",
  );
  const entry =
    f.workspace.followups.coordinator.getSnapshot().draft!.entries[0]!;
  f.workspace.followups.edit(entry, "check", "Independent Follow-ups check");
  const watchDraft = f.workspace.coordinator.getSnapshot().draft;
  const followDraft = f.workspace.followups.coordinator.getSnapshot().draft;
  expect(f.controls.getSnapshot().load).toBe(0);
  await author(f);
  exact(f.model);
  const drafted = current(f.model);
  f.model.setPendingEditor(drafted, true);
  f.workspace.setView("markets");
  expect(f.workspace.getSnapshot().view).toBe("portfolio");
  expect(f.model.canSavePayload()).toBe(false);
  f.model.setPendingEditor(drafted, false);
  f.workspace.openPortfolioResearch(drafted, drafted.ledger!.identities[0]!);
  expect(f.workspace.getSnapshot().research?.selection.origin).toBe(
    "portfolio",
  );
  expect(f.fixture.getSnapshot()).toMatchObject({
    eod: 0,
    annual: 0,
    filings: 0,
    save: 0,
  });
  f.workspace.closeResearch();
  expect(f.workspace.getSnapshot().view).toBe("portfolio");
  expect(current(f.model)).toBe(drafted);
  const before = f.fixture.getSnapshot();
  const markup = renderToStaticMarkup(
    <ManagedPortfolio
      workspace={f.workspace}
      navigationPending={false}
      onResearch={() => {
        throw new Error("No render-time research action");
      }}
    />,
  );
  expect(markup).toContain("USD 948.00");
  expect(markup).toContain("USD 100.50");
  expect(markup).toContain("USD 48.50");
  const holdings = markup
    .split('<section aria-label="Current authored holdings">')[1]
    ?.split("</section>")[0];
  expect(holdings).toBeDefined();
  expect(
    [...holdings!.matchAll(/<dd>(.*?)<\/dd>/g)]
      .map((match) => match[1])
      .join("|"),
  ).toBe("USD 948.00|USD 48.50|USD 48.50|0 of 1");
  expect(holdings).toContain("<td>1</td><td>USD 100.50</td>");
  expect(f.fixture.getSnapshot()).toBe(before);
  f.controls.setNextSave("lost-ack");
  await f.model.coordinator.save();
  expect(f.model.coordinator.getSnapshot().uncertain).toBe(true);
  await f.model.coordinator.reconcile();
  expect(f.model.coordinator.getSnapshot().replayPending).toBe(true);
  expect(f.controls.getSnapshot()).toMatchObject({
    save: 2,
    commits: 1,
    replays: 1,
  });
  await f.model.coordinator.load();
  f.model.coordinator.useSaved();
  exact(f.model);
  expect(f.workspace.coordinator.getSnapshot().draft).toBe(watchDraft);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(
    followDraft,
  );
  expect(f.fixture.followups!.getSnapshot().save).toBe(0);
  await f.workspace.sessionOwner.signOut();
  expect(f.model.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  const fresh = new ManagedWorkspace(f.fixture.api, f.controls.nextSession());
  active.push(fresh);
  expect(fresh.portfolio.coordinator.getSnapshot().draft).toBeNull();
  await fresh.portfolio.coordinator.load();
  exact(fresh.portfolio);
  expect(f.controls.getSnapshot()).toMatchObject({
    load: 3,
    save: 2,
    commits: 1,
    replays: 1,
    session: 2,
    signOut: 1,
    token: 0,
  });
});
it("retains a dirty ledger on conflict and fences a captured reply after whole-session retirement", async () => {
  const f = await setup();
  await author(f);
  const draft = current(f.model);
  f.controls.setNextSave("conflict");
  await f.model.coordinator.save();
  expect(f.model.coordinator.getSnapshot()).toMatchObject({
    conflict: true,
    dirty: true,
  });
  expect(current(f.model)).toEqual(draft);
  expect(f.controls.getSnapshot()).toMatchObject({ commits: 0, conflicts: 1 });
  f.controls.setNextRead("hold");
  const held = f.model.coordinator.load();
  expect(f.controls.getSnapshot().held).toBe(1);
  f.workspace.sessionOwner.retire();
  f.controls.settleHeld();
  await held;
  expect(f.model.coordinator.getSnapshot().draft).toBeNull();
  expect(f.model.getProjection()).toBeNull();
  expect(f.controls.getSnapshot()).toMatchObject({
    aborted: 1,
    settled: 1,
    commits: 0,
  });
});
