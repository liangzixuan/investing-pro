import { afterEach, expect, it } from "vitest";
import { prepareManagedWatchlistScreenSelection } from "./managed-watchlist-screen-selection-plan";
import {
  watchlistScreenFixture,
  watchlistScreenListing,
} from "./test-watchlist-screen-selection-fixture";
const fixtures: Awaited<ReturnType<typeof watchlistScreenFixture>>[] = [];
afterEach(() => fixtures.splice(0).forEach((f) => f.dispose()));
async function fixture() {
  const f = await watchlistScreenFixture();
  fixtures.push(f);
  return f;
}
function input(f: Awaited<ReturnType<typeof fixture>>) {
  const screen = f.workspace.financialScreen.getSnapshot();
  return {
    watchlist: f.workspace.coordinator.getSnapshot().draft!,
    screen,
    coveredMembers: screen.memberships.filter((member) =>
      f.workspace.financialScreen.hasCoverage(member),
    ),
  };
}
it("retains every raw membership and exclusion in order and requires a watched share class", async () => {
  const f = await fixture();
  const i = input(f);
  const raw = JSON.stringify(i.watchlist);
  const pending = prepareManagedWatchlistScreenSelection(i);
  expect(pending.canApply).toBe(false);
  expect(pending.rows.map((r) => r.status)).toEqual([
    "choice_required",
    "choice_required",
    "outside_cohort",
    "uncovered",
  ]);
  const plan = prepareManagedWatchlistScreenSelection({
    ...i,
    choices: [f.choice()],
  });
  expect(plan.canApply).toBe(true);
  expect(plan.rows.map((r) => r.status)).toEqual([
    "other_share_class",
    "included",
    "outside_cohort",
    "uncovered",
  ]);
  plan.rows.forEach((row, index) =>
    expect(row.membership).toBe(i.watchlist.memberships[index]),
  );
  expect(plan.rows[0]!.membership.note).toBe(
    "Unsaved note Ω and precise 2.000001",
  );
  expect(plan.members).toEqual([f.choice()]);
  expect(JSON.stringify(i.watchlist)).toBe(raw);
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.save).not.toHaveBeenCalled();
});
it("refuses unwatched, foreign, duplicate and two-class choices", async () => {
  const f = await fixture();
  const i = input(f);
  for (const choices of [
    [{ ...f.choice() }],
    [f.choice(), f.choice()],
    [f.choice(), f.choice(false)],
    [i.screen.memberships[2]!],
  ])
    expect(
      prepareManagedWatchlistScreenSelection({ ...i, choices }).canApply,
    ).toBe(false);
  const watchlist = {
    ...i.watchlist,
    memberships: i.watchlist.memberships.filter(
      (m) => m.listingId !== f.choice().listing.listingId,
    ),
  };
  expect(
    prepareManagedWatchlistScreenSelection({
      ...i,
      watchlist,
      choices: [f.choice()],
    }).canApply,
  ).toBe(false);
});
it.each([
  "country",
  "exchangeMic",
  "instrumentType",
  "issuerId",
  "issuerName",
  "securityId",
  "securityName",
  "shareClassId",
  "shareClassName",
  "symbol",
] as const)(
  "blocks complete selection for changed identity field %s",
  async (key) => {
    const f = await fixture();
    const i = input(f);
    const changed = { ...i.watchlist.memberships[0]!, [key]: "changed" };
    const plan = prepareManagedWatchlistScreenSelection({
      ...i,
      watchlist: {
        ...i.watchlist,
        memberships: [changed, ...i.watchlist.memberships.slice(1)],
      },
    });
    expect(plan.canApply).toBe(false);
    expect(plan.rows[0]!.status).toBe("identity_mismatch");
    expect(plan.rows).toHaveLength(4);
  },
);
it("refuses null, empty, wholly unsupported and stale catalog without clearing a selection", async () => {
  const f = await fixture();
  const i = input(f);
  const selected = i.screen.selected;
  for (const watchlist of [
    null,
    { ...i.watchlist, memberships: [] },
    { ...i.watchlist, memberships: i.watchlist.memberships.slice(2) },
    { ...i.watchlist, snapshotSha256: `sha256:${"b".repeat(64)}` },
  ])
    expect(
      prepareManagedWatchlistScreenSelection({ ...i, watchlist }).canApply,
    ).toBe(false);
  expect(f.workspace.financialScreen.getSnapshot().selected).toBe(selected);
});
it("accounts for all10000 membership rows with full raw notes and complete exclusions", async () => {
  const f = await fixture();
  const i = input(f);
  const memberships = Array.from({ length: 10000 }, (_, index) => ({
    ...watchlistScreenListing,
    listingId: `outside-${index}`,
    note: `Raw ${index} 東京 0.00001`,
  }));
  memberships[9999] = { ...i.watchlist.memberships[0]! };
  const plan = prepareManagedWatchlistScreenSelection({
    ...i,
    watchlist: { ...i.watchlist, memberships },
  });
  expect(plan.canApply).toBe(true);
  expect(plan.rows).toHaveLength(10000);
  expect(plan.rows.filter((r) => r.status === "outside_cohort")).toHaveLength(
    9999,
  );
  expect(plan.rows[4321]!.membership).toBe(memberships[4321]);
  expect(plan.members).toEqual([f.choice(false)]);
});
