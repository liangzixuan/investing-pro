import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagedPortfolioGroupEdits } from "./managed-portfolio-group-edits";
import { portfolioScreenFixture } from "./test-portfolio-screen-selection-fixture";

function changeCash(owner: ManagedPortfolioGroupEdits, cashUsd = "200") {
  const candidate = owner.getSnapshot().candidate!;
  expect(
    owner.replaceCandidate(candidate, {
      ...candidate,
      opening: { ...candidate.opening, cashUsd },
    }),
  ).toBe(true);
}
it("explains blocked entry and preserves pending ordinary edits", async () => {
  const f = await fixture();
  const model = f.workspace.portfolio;
  const original = model.coordinator.getSnapshot();
  model.setPendingEditor(original.draft!, true);
  expect(f.owner.start()).toBe(false);
  expect(f.owner.getSnapshot().message).toMatch(/form/);
  expect(model.getSnapshot().pendingEditor).toBe(true);
  model.setPendingEditor(original.draft!, false);
  const activity = {};
  model.beginDraftFileActivity(activity);
  expect(f.owner.start()).toBe(false);
  expect(f.owner.getSnapshot().message).toMatch(/file/);
  model.endDraftFileActivity(activity);
  expect(model.coordinator.getSnapshot()).toBe(original);
});
it("projects a newly opened registered position without changing the registry", async () => {
  const f = await fixture();
  const model = f.workspace.portfolio;
  const original = model.coordinator.getSnapshot().draft!;
  const listing = original.ledger!.identities[2]!;
  model.replace(original, {
    ...original.ledger!,
    opening: {
      ...original.ledger!.opening,
      holdings: original.ledger!.opening.holdings.slice(0, 2),
    },
  });
  f.owner.start();
  const candidate = f.owner.getSnapshot().candidate!;
  expect(
    f.owner.replaceCandidate(candidate, {
      ...candidate,
      transactions: [
        {
          id: "buy-new",
          date: "2026-11-05",
          type: "buy",
          listingId: listing.listingId,
          shares: "1.5",
          grossUsd: "50",
          feeUsd: "1",
        },
      ],
    }),
  ).toBe(true);
  f.owner.preview();
  const preview = f.owner.getSnapshot();
  expect(
    preview.before?.portfolio.holdings.some(
      (x) => x.identity.listingId === listing.listingId,
    ),
  ).toBe(false);
  expect(
    preview.after?.portfolio.holdings.find(
      (x) => x.identity.listingId === listing.listingId,
    ),
  ).toMatchObject({ shares: "1.5", totalCostBasisUsd: "51.00" });
  expect(preview.after?.portfolio.cashUsd).toBe("49.00");
  expect(preview.candidate?.identities).toEqual(preview.baseline?.identities);
});
it.each(["draft", "file", "navigation", "catalog", "session"] as const)(
  "permanently retires on %s changes, including returning to equal values",
  async (kind) => {
    const f = await fixture();
    f.owner.start();
    changeCash(f.owner);
    f.owner.preview();
    const preview = f.owner.getSnapshot();
    const model = f.workspace.portfolio;
    if (kind === "draft") {
      const original = model.coordinator.getSnapshot().draft!;
      model.coordinator.replaceDraft({
        ledger: {
          ...original.ledger!,
          opening: { ...original.ledger!.opening, cashUsd: "2" },
        },
      });
      model.coordinator.replaceDraft(original);
    }
    if (kind === "file") {
      const token = {};
      model.beginDraftFileActivity(token);
      model.endDraftFileActivity(token);
    }
    if (kind === "navigation") {
      f.workspace.setNavigationBlocked(true);
      f.workspace.setNavigationBlocked(false);
    }
    if (kind === "catalog") {
      const original = f.workspace.getSnapshot();
      const changed = {
        ...original,
        snapshot: { ...original.snapshot!, catalogVersion: "replacement" },
      };
      const get = vi.spyOn(f.workspace, "getSnapshot").mockReturnValue(changed);
      expect(f.owner.apply(preview)).toBe(false);
      get.mockRestore();
    }
    if (kind === "session") f.workspace.sessionOwner.retire("Signed out.");
    const current = model.coordinator.getSnapshot();
    expect(f.owner.getSnapshot().phase).toBe("retired");
    expect(f.owner.apply(preview)).toBe(false);
    expect(model.coordinator.getSnapshot()).toBe(current);
  },
);
it("keeps nested pending forms local and rejects stale candidate callbacks", async () => {
  const f = await fixture();
  f.owner.start();
  const first = f.owner.getSnapshot().candidate!;
  f.owner.setEditorPending(first, true);
  expect(f.owner.preview()).toBe(false);
  changeCash(f.owner);
  const current = f.owner.getSnapshot();
  f.owner.setEditorPending(first, true);
  expect(f.owner.getSnapshot()).toBe(current);
  expect(f.owner.replaceCandidate(first, first)).toBe(false);
  f.owner.preview();
  const preview = f.owner.getSnapshot();
  f.owner.edit();
  changeCash(f.owner, "300");
  expect(f.owner.apply(preview)).toBe(false);
});
it("keeps unknown cash and basis, closed positions and exact activity order in both projections", async () => {
  const f = await fixture();
  const model = f.workspace.portfolio;
  const draft = model.coordinator.getSnapshot().draft!;
  model.replace(draft, {
    ...draft.ledger!,
    opening: {
      ...draft.ledger!.opening,
      cashUsd: null,
      holdings: draft.ledger!.opening.holdings.map((x) => ({
        ...x,
        totalCostBasisUsd: null,
      })),
    },
  });
  f.owner.start();
  const candidate = f.owner.getSnapshot().candidate!;
  const listing = candidate.identities[0]!;
  expect(
    f.owner.replaceCandidate(candidate, {
      ...candidate,
      transactions: [
        {
          id: "sell-all",
          date: "2026-11-05",
          type: "sell",
          listingId: listing.listingId,
          shares: "2.000001",
          grossUsd: "100",
          feeUsd: "0",
        },
        {
          id: "deposit-later",
          date: "2026-11-05",
          type: "deposit",
          listingId: null,
          shares: null,
          grossUsd: "10",
          feeUsd: "0",
        },
      ],
    }),
  ).toBe(true);
  f.owner.preview();
  const state = f.owner.getSnapshot();
  expect(state.before?.portfolio.cashUsd).toBeNull();
  expect(state.after?.portfolio.cashUsd).toBeNull();
  expect(state.before?.portfolio.holdings[0]?.totalCostBasisUsd).toBeNull();
  expect(
    state.after?.portfolio.holdings.some(
      (x) => x.identity.listingId === listing.listingId,
    ),
  ).toBe(false);
  expect(state.after?.realized.totalGainUsd).toBeNull();
  expect(state.candidate?.transactions.map((x) => x.id)).toEqual([
    "sell-all",
    "deposit-later",
  ]);
});
it("rejects changed registry and negative intermediate cash even if final cash would recover", async () => {
  const f = await fixture();
  f.owner.start();
  const original = f.owner.getSnapshot().candidate!;
  expect(
    f.owner.replaceCandidate(original, {
      ...original,
      identities: original.identities.slice(1),
    }),
  ).toBe(false);
  expect(
    f.owner.replaceCandidate(original, {
      ...original,
      transactions: [
        {
          id: "withdraw",
          date: "2026-11-05",
          type: "withdrawal",
          listingId: null,
          shares: null,
          grossUsd: "200",
          feeUsd: "0",
        },
        {
          id: "deposit",
          date: "2026-11-05",
          type: "deposit",
          listingId: null,
          shares: null,
          grossUsd: "300",
          feeUsd: "0",
        },
      ],
    }),
  ).toBe(false);
  expect(f.owner.getSnapshot().candidate).toBe(original);
});
it("requires a new preview after the UTC day changes", async () => {
  const f = await fixture();
  f.owner.start();
  changeCash(f.owner);
  f.owner.preview();
  const preview = f.owner.getSnapshot();
  vi.setSystemTime(new Date("2026-11-07T00:00:01Z"));
  expect(f.owner.apply(preview)).toBe(false);
  expect(f.owner.getSnapshot().phase).toBe("editing");
  expect(f.owner.preview()).toBe(true);
  expect(f.owner.apply(f.owner.getSnapshot())).toBe(true);
});
it("consumes before notification and refuses a false reentrant success", async () => {
  const f = await fixture();
  f.owner.start();
  changeCash(f.owner);
  f.owner.preview();
  const preview = f.owner.getSnapshot();
  const model = f.workspace.portfolio;
  const off = model.coordinator.subscribe(() => {
    off();
    expect(f.owner.apply(preview)).toBe(false);
    model.coordinator.replaceDraft({ ledger: preview.baseline });
  });
  expect(f.owner.apply(preview)).toBe(false);
  expect(f.owner.getSnapshot().phase).toBe("retired");
  expect(model.coordinator.getSnapshot().draft?.ledger).toEqual(
    preview.baseline,
  );
});
it("keeps Save and fresh Load separate after Apply", async () => {
  const f = await fixture();
  f.owner.start();
  changeCash(f.owner);
  f.owner.preview();
  f.owner.apply(f.owner.getSnapshot());
  const model = f.workspace.portfolio;
  const applied = model.coordinator.getSnapshot().draft!.ledger!;
  expect(f.api.savePortfolio).not.toHaveBeenCalled();
  f.api.savePortfolio.mockResolvedValueOnce({
    version: 2,
    payload: applied,
    replayed: false,
  });
  await model.coordinator.save();
  expect(f.api.savePortfolio).toHaveBeenCalledTimes(1);
  f.api.loadPortfolio.mockResolvedValueOnce({ version: 2, payload: applied });
  await model.coordinator.load();
  expect(model.coordinator.getSnapshot().draft?.ledger).toEqual(applied);
  expect(model.coordinator.getSnapshot().baseVersion).toBe(2);
});
it("clears its lease on disposal and rejects retained callbacks", async () => {
  const f = await fixture();
  const original = f.workspace.portfolio.coordinator.getSnapshot();
  f.owner.start();
  changeCash(f.owner);
  f.owner.preview();
  const preview = f.owner.getSnapshot();
  f.owner.dispose();
  expect(f.owner.apply(preview)).toBe(false);
  expect(f.owner.start()).toBe(false);
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(original);
  expect(f.workspace.portfolio.getSnapshot().pendingEditor).toBe(false);
});

const fixtures: Awaited<ReturnType<typeof portfolioScreenFixture>>[] = [];
const owners: ManagedPortfolioGroupEdits[] = [];
it("releases a lease if the host disposes during its opening notification", async () => {
  const f = await fixture();
  const off = f.workspace.portfolio.subscribe(() => {
    if (f.workspace.portfolio.getSnapshot().groupedEditing) f.owner.dispose();
  });
  expect(f.owner.start()).toBe(false);
  expect(f.workspace.portfolio.getSnapshot().groupedEditing).toBe(false);
  expect(f.workspace.portfolio.getSnapshot().pendingEditor).toBe(false);
  off();
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
});
afterEach(() => {
  owners.splice(0).forEach((owner) => owner.dispose());
  fixtures.splice(0).forEach((fixture) => fixture.dispose());
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function fixture() {
  const f = await portfolioScreenFixture(true, false);
  fixtures.push(f);
  f.workspace.setView("portfolio");
  const owner = new ManagedPortfolioGroupEdits(f.workspace);
  owners.push(owner);
  return { ...f, owner };
}
it("keeps multiple edits isolated, previews both ledgers, and applies once without saving", async () => {
  const f = await fixture();
  const model = f.workspace.portfolio;
  const original = model.coordinator.getSnapshot();
  expect(f.owner.start()).toBe(true);
  let candidate = f.owner.getSnapshot().candidate!;
  expect(
    f.owner.replaceCandidate(candidate, {
      ...candidate,
      opening: { ...candidate.opening, cashUsd: "200" },
    }),
  ).toBe(true);
  candidate = f.owner.getSnapshot().candidate!;
  expect(
    f.owner.replaceCandidate(candidate, {
      ...candidate,
      transactions: [
        {
          id: "deposit-one",
          date: "2026-11-05",
          type: "deposit",
          listingId: null,
          shares: null,
          grossUsd: "25",
          feeUsd: "0",
        },
      ],
    }),
  ).toBe(true);
  expect(model.coordinator.getSnapshot()).toBe(original);
  model.setPendingEditor(original.draft!, false);
  expect(model.getSnapshot().pendingEditor).toBe(true);
  expect(model.canSavePayload()).toBe(false);
  expect(f.owner.preview()).toBe(true);
  const preview = f.owner.getSnapshot();
  expect(preview.before?.portfolio.cashUsd).toBe("100.00");
  expect(preview.after?.portfolio.cashUsd).toBe("225.00");
  expect(f.owner.apply(preview)).toBe(true);
  expect(f.owner.apply(preview)).toBe(false);
  expect(
    model.coordinator.getSnapshot().draft?.ledger?.transactions,
  ).toHaveLength(1);
  expect(model.getSnapshot().groupedEditing).toBe(false);
  expect(f.api.savePortfolio).not.toHaveBeenCalled();
  expect(f.unexpected).not.toHaveBeenCalled();
});
it("cancels without changing the original draft or saved base", async () => {
  const f = await fixture();
  const original = f.workspace.portfolio.coordinator.getSnapshot();
  f.owner.start();
  const candidate = f.owner.getSnapshot().candidate!;
  f.owner.replaceCandidate(candidate, {
    ...candidate,
    opening: { ...candidate.opening, cashUsd: null },
  });
  f.owner.cancel();
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(original);
  expect(f.workspace.portfolio.getSnapshot().pendingEditor).toBe(false);
});
it("settles cancellation before a subscriber can acquire another lease", async () => {
  const f = await fixture();
  const model = f.workspace.portfolio;
  const original = model.coordinator.getSnapshot();
  expect(f.owner.start()).toBe(true);
  const restarted: boolean[] = [];
  const offModel = model.subscribe(() => {
    if (!model.getSnapshot().groupedEditing) restarted.push(f.owner.start());
  });
  const offOwner = f.owner.subscribe(() => {
    if (f.owner.getSnapshot().phase === "idle") restarted.push(f.owner.start());
  });
  f.owner.cancel();
  offModel();
  offOwner();
  expect(restarted).toEqual([false, false]);
  expect(f.owner.getSnapshot().phase).toBe("idle");
  expect(model.getSnapshot().groupedEditing).toBe(false);
  expect(model.getSnapshot().pendingEditor).toBe(false);
  expect(model.coordinator.getSnapshot()).toBe(original);
  expect(f.owner.start()).toBe(true);
});
