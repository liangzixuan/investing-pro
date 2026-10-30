import { TrialApiError } from "./api";
import { ManagedSecFilingsError, type ManagedApi } from "./managed-api";
import { afterEach, expect, it, vi } from "vitest";
import type { ManagedPortfolioPayload } from "@research-cockpit/contracts";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";
import { prepareFilingsAssessment } from "./managed-filings-assessment";
import { filingsResponse } from "./sec-filings-fixture";

const fixtures: Awaited<ReturnType<typeof createFollowupsReviewFixture>>[] = [];
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.restoreAllMocks();
});
async function fixture() {
  const f = await createFollowupsReviewFixture();
  fixtures.push(f);
  const w = f.workspace;
  w.setView("discover");
  w.setNavigationBlocked(true);
  await w.setCompanyRoute({
    kind: "company",
    listingId: f.entries[0]!.listing.listingId,
    section: "filings",
  });
  const visit = w.getSnapshot().research!;
  expect(visit).not.toBeNull();
  expect(visit.selection.origin).toBe("route");
  const selection = visit.selection;
  const read = () => w.getCompanyResearchChecks(selection)!;
  const attach = () => {
    const c = read();
    expect(c.canAttach).toBe(true);
    const handle = c.attach(c.followups.value!);
    expect(handle?.isCurrent()).toBe(true);
    return handle!;
  };
  return { ...f, w, visit, selection, read, attach };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function current(f: Fixture) {
  return f.w.followups.currentEntry(f.entries[0]!.id)!;
}

it("joins only current exact loaded drafts and preserves unsaved raw note and check context", async () => {
  const f = await fixture();
  const note = "  Full raw note · Cafe\u0301 東京 😀 " + "detail ".repeat(100);
  f.w.note(f.selection.listing.listingId, note);
  f.w.followups.edit(current(f), "result", " Raw authored result ");
  const context = f.read();
  expect(context.watchlist.value?.note).toBe(note);
  expect(context.watchlist.saved.dirty).toBe(true);
  expect(context.followups.value?.result).toBe(" Raw authored result ");
  expect(context.followups.saved.dirty).toBe(true);
  expect(context.portfolio.status).toBe("unloaded");
  expect(context.attachment).toBeNull();
  expect(f.w.researchFollowupContext(f.selection)).toBeNull();
  const otherClass = {
    ...current(f),
    listing: { ...current(f).listing, shareClassId: "other-class" },
  };
  f.w.followups.coordinator.replaceDraft({
    schemaVersion: 1,
    entries: [otherClass],
  });
  expect(f.read().followups.status).toBe("absent");
  expect(f.read().canAttach).toBe(false);
});
it("distinguishes empty, absent, stale and ambiguous checks without selecting the first", async () => {
  const f = await fixture();
  const entry = current(f);
  f.w.followups.coordinator.replaceDraft({ schemaVersion: 1, entries: [] });
  expect(f.read().followups.status).toBe("empty");
  f.w.followups.coordinator.replaceDraft({
    schemaVersion: 1,
    entries: [{ ...entry, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` }],
  });
  expect(f.read().followups.status).toBe("stale");
  f.w.followups.coordinator.replaceDraft({
    schemaVersion: 1,
    entries: [entry, { ...entry, id: f.entries[1]!.id }],
  });
  const c = f.read();
  expect(c.followups.status).toBe("invalid");
  expect(c.followups.value).toBeNull();
  expect(c.attach(c.followups.saved.draft!.entries[0]!)).toBeNull();
});
it("shows a valid authored holding without Portfolio-origin mutation authority", async () => {
  const f = await fixture();
  const ledger: ManagedPortfolioPayload = {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: f.selection.catalogSnapshotSha256,
    basisMethod: "fifo_with_opening_pool",
    identities: [f.selection.listing],
    opening: {
      asOfDate: "2026-10-01",
      cashUsd: "100.00",
      holdings: [
        {
          listingId: f.selection.listing.listingId,
          shares: "2.000000",
          totalCostBasisUsd: "20.00",
          confirmedOn: "2026-09-30",
        },
      ],
    },
    transactions: [],
  };
  vi.spyOn(f.api, "loadPortfolio").mockResolvedValue({
    version: 2,
    payload: ledger,
  });
  await f.read().portfolio.load();
  const c = f.read().portfolio;
  expect(c.status).toBe("ready");
  expect(c.saved.baseVersion).toBe(2);
  expect(c.value).toMatchObject({
    listing: f.selection.listing,
    confirmedOn: "2026-09-30",
  });
  expect(c.canLoad).toBe(false);
  const invalid = vi.spyOn(f.w.portfolio, "getProjection").mockReturnValue({
    status: "invalid",
    error: { code: "oversell", transactionIndex: 0 },
  });
  expect(f.read().portfolio.status).toBe("invalid");
  expect(f.read().watchlist.status).toBe("ready");
  expect(f.read().followups.status).toBe("ready");
  invalid.mockRestore();
  f.w.portfolio.coordinator.replaceDraft({
    ledger: { ...ledger, snapshotSha256: "sha256:" + "b".repeat(64) },
  });
  expect(f.read().portfolio.status).toBe("stale");
  f.w.portfolio.coordinator.replaceDraft({
    ledger: {
      ...ledger,
      identities: [{ ...f.selection.listing, shareClassId: "other-class" }],
    },
  });
  expect(f.read().portfolio.status).toBe("absent");
  f.w.portfolio.coordinator.replaceDraft({
    ledger: {
      ...ledger,
      identities: [],
      opening: { ...ledger.opening, holdings: [] },
    },
  });
  expect(f.read().portfolio.status).toBe("empty");

  const before = f.w.portfolio.coordinator.getSnapshot();
  await c.load();
  expect(f.w.portfolio.coordinator.getSnapshot()).toBe(before);
});
it("attaches explicitly without requests, navigation or changing visit and source references", async () => {
  const f = await fixture();
  vi.mocked(f.api.recentFilings).mockResolvedValueOnce(
    filingsResponse(2, "available", f.selection),
  );
  await f.w.requestResearchSource(f.visit, "filings");
  const source = f.w.filings.getSnapshot();
  const route = f.w.getSnapshot().companyRoute;
  const editor = f.w.valuation.getSnapshot();
  const saved = f.w.followups.coordinator.getSnapshot();
  const handle = f.attach();
  expect(handle.entry).toBe(current(f));
  expect(f.w.getSnapshot().research).toBe(f.visit);
  expect(f.w.getSnapshot().companyRoute).toBe(route);
  expect(f.w.filings.getSnapshot()).toBe(source);
  expect(f.w.valuation.getSnapshot()).toBe(editor);
  expect(f.w.followups.coordinator.getSnapshot()).toBe(saved);
  expect(f.api.recentFilings).toHaveBeenCalledOnce();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("renews only its own edit, cites once, selects exact entry through settled router and saves independently", async () => {
  const f = await fixture();
  vi.mocked(f.api.recentFilings).mockResolvedValueOnce(
    filingsResponse(2, "available", f.selection),
  );
  await f.w.requestResearchSource(f.visit, "filings");
  const response = f.w.filings.getSnapshot().response!;
  const watchlist = f.w.coordinator.getSnapshot();
  const portfolio = f.w.portfolio.coordinator.getSnapshot();
  f.attach();
  const first = f.w.researchFollowupContext(f.selection)!;
  first.editAssessment("Assessment · Cafe\u0301 東京 😀");
  first.editAssessment("Stale");
  expect(current(f).result).toBe("Assessment · Cafe\u0301 東京 😀");
  expect(f.w.researchFollowupContext(f.selection)?.editable).toBe(true);
  expect(f.w.captureFollowupReviewNote(f.selection, () => true)).toBeNull();
  const port = f.w.captureFilingsAssessment(f.selection, response).port!;
  expect(port).not.toBeNull();
  const preview = prepareFilingsAssessment(
    port,
    response.issuer.filings[0]!,
    () => true,
  ).preview!;
  expect(preview).not.toBeNull();
  expect(preview.apply()).toBe(true);
  expect(preview.apply()).toBe(false);
  expect(f.w.researchFollowupContext(f.selection)?.editable).toBe(true);
  const review = f.w.reviewCompanyResearchCheck(f.selection, () => {
    f.w.setNavigationBlocked(true);
    f.w.setView("followups");
    return true;
  });
  expect(review).not.toBeNull();
  expect(review!.isCurrent()).toBe(false);
  f.w.setNavigationBlocked(false);
  await f.w.setCompanyRoute(null);
  expect(review!.isCurrent()).toBe(true);
  expect(f.w.followups.getSnapshot().selectedId).toBe(current(f).id);
  f.w.followups.complete(current(f), new Date("2026-10-30T00:00:00Z"));
  await f.w.followups.coordinator.save();
  const fresh = f.make();
  await fresh.refreshCatalog();
  await fresh.followups.coordinator.load();
  expect(fresh.followups.currentEntry(f.entries[0]!.id)).toMatchObject({
    result: preview.result.normalize("NFC").trim(),
    status: "completed",
    completedOn: "2026-10-30",
  });
  expect(f.w.coordinator.getSnapshot()).toBe(watchlist);
  expect(f.w.portfolio.coordinator.getSnapshot()).toBe(portfolio);
});
const changes: { name: string; run: (f: Fixture) => void }[] = [
  {
    name: "external result ABA",
    run(f) {
      const value = current(f).result;
      f.w.followups.edit(current(f), "result", "external");
      f.w.followups.edit(current(f), "result", value);
    },
  },
  {
    name: "question ABA",
    run(f) {
      const value = current(f).check;
      f.w.followups.edit(current(f), "check", "external");
      f.w.followups.edit(current(f), "check", value);
    },
  },
  {
    name: "due date ABA",
    run(f) {
      const value = current(f).dueOn;
      f.w.followups.edit(current(f), "dueOn", "2027-01-01");
      f.w.followups.edit(current(f), "dueOn", value);
    },
  },
  {
    name: "equal draft replacement",
    run(f) {
      f.w.followups.coordinator.replaceDraft({
        ...f.w.followups.coordinator.getSnapshot().draft!,
      });
    },
  },
  {
    name: "file activity ABA",
    run(f) {
      const owner = {};
      f.w.followups.beginDraftFileActivity(owner);
      f.w.followups.endDraftFileActivity(owner);
    },
  },
  {
    name: "catalog ABA",
    run(f) {
      f.w.followups.syncCatalog(`sha256:${"b".repeat(64)}`);
      f.w.followups.syncCatalog(f.selection.catalogSnapshotSha256);
    },
  },
  {
    name: "session retirement",
    run(f) {
      f.w.sessionOwner.retire();
    },
  },
];
it.each(changes)(
  "retires attachment and old edits after $name",
  async ({ run }) => {
    const f = await fixture();
    const handle = f.attach();
    const context = f.w.researchFollowupContext(f.selection)!;
    run(f);
    const saved = f.w.followups.coordinator.getSnapshot();
    context.editAssessment("Must not apply");
    expect(handle.isCurrent()).toBe(false);
    expect(f.w.researchFollowupContext(f.selection)).toBeNull();
    expect(f.w.followups.coordinator.getSnapshot()).toBe(saved);
  },
);
it("retires captured actions on section ABA while keeping the explicit company association", async () => {
  const f = await fixture();
  f.attach();
  const context = f.w.researchFollowupContext(f.selection)!;
  f.w.switchToAnnual();
  f.w.switchToFilings();
  context.editAssessment("Must not apply");
  expect(context.isCurrent()).toBe(false);
  expect(current(f).result).toBe("");
  expect(f.w.researchFollowupContext(f.selection)?.editable).toBe(true);
});
it("consumes attach and edit actions before reentrant observers and refuses an external edit during own publication", async () => {
  const f = await fixture();
  const captured = f.read();
  let reentered: unknown;
  const stopAttach = f.w.subscribe(() => {
    reentered = captured.attach(captured.followups.value!);
  });
  expect(captured.attach(captured.followups.value!)).not.toBeNull();
  stopAttach();
  expect(reentered).toBeNull();
  const context = f.w.researchFollowupContext(f.selection)!;
  let changed = false;
  const stopEdit = f.w.followups.coordinator.subscribe(() => {
    context.editAssessment("Reentrant");
    if (changed) return;
    changed = true;
    f.w.followups.edit(current(f), "check", "External question");
  });
  context.editAssessment("Own edit");
  stopEdit();
  expect(current(f).result).toBe("Own edit");
  expect(current(f).check).toBe("External question");
  expect(f.w.researchFollowupContext(f.selection)).toBeNull();
});
it("does not add another attachment to a Follow-ups-origin chosen review", async () => {
  const f = await createFollowupsReviewFixture();
  fixtures.push(f);
  f.start();
  const context = await f.open();
  const selection = f.workspace.getSnapshot().research!.selection;
  const own = f.workspace.getCompanyResearchChecks(selection)!;
  expect(own.canAttach).toBe(false);
  expect(own.attach(own.followups.value!)).toBeNull();
  expect(context.editable).toBe(true);
  expect(f.model.getSnapshot().position).toBe(0);
});
it("refuses stale load dispatch but leaves an already dispatched independent load session-owned", async () => {
  const f = await fixture();
  const stale = f.read().portfolio;
  f.w.switchToAnnual();
  await stale.load();
  await f.w.setCompanyRoute({
    kind: "company",
    listingId: f.selection.listing.listingId,
    section: "annual",
  });
  const load = vi.spyOn(f.api, "loadPortfolio");
  let resolve!: (value: { version: 0; payload: null }) => void;
  load.mockImplementation(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  const task = f.read().portfolio.load();
  f.w.closeResearch();
  resolve({ version: 0, payload: null });
  await task;
  expect(load).toHaveBeenCalledOnce();
  expect(f.w.portfolio.coordinator.getSnapshot().draft).toEqual({
    ledger: null,
  });
  expect(f.w.getSnapshot().research).toBeNull();
});

it.each(["conflict", "commit_unknown"] as const)(
  "keeps readable draft context but refuses attachment during %s recovery",
  async (code) => {
    const f = await fixture();
    f.attach();
    f.w.researchFollowupContext(f.selection)!.editAssessment("Pending result");
    vi.mocked(f.api.saveFollowups).mockRejectedValueOnce(
      new TrialApiError(code),
    );
    await f.w.followups.coordinator.save();
    const c = f.read();
    expect(c.followups.value?.result).toBe("Pending result");
    expect(c.followups.saved.dirty).toBe(true);
    expect(c.canAttach).toBe(false);
    expect(c.attachment).toBeNull();
    expect(f.w.researchFollowupContext(f.selection)).toBeNull();
  },
);
it("pauses during Save, retains the draft and never revives captured actions after settlement", async () => {
  const f = await fixture();
  f.attach();
  f.w.researchFollowupContext(f.selection)!.editAssessment("Authored result");
  const old = f.w.researchFollowupContext(f.selection)!;
  let finish!: (
    value: Awaited<ReturnType<ManagedApi["saveFollowups"]>>,
  ) => void;
  vi.mocked(f.api.saveFollowups).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const saving = f.w.followups.coordinator.save();
  expect(f.read().followups.value?.result).toBe("Authored result");
  expect(f.read().canAttach).toBe(false);
  const command = vi.mocked(f.api.saveFollowups).mock.calls[0]![0];
  finish({
    version: command.expectedVersion + 1,
    payload: command.payload,
    replayed: false,
  });
  await saving;
  old.editAssessment("Stale result");
  expect(current(f).result).toBe("Authored result");
  expect(f.read().canAttach).toBe(false);
  await f.w.followups.coordinator.load();
  expect(f.read().canAttach).toBe(true);
});
it("does not renew the association through reentrant catalog or selection ABA during its own edit", async () => {
  const f = await fixture();
  f.attach();
  const edit = f.w.researchFollowupContext(f.selection)!;
  let changed = false;
  const stop = f.w.followups.coordinator.subscribe(() => {
    if (changed) return;
    changed = true;
    f.w.followups.syncCatalog(`sha256:${"b".repeat(64)}`);
    f.w.followups.syncCatalog(f.selection.catalogSnapshotSha256);
  });
  edit.editAssessment("Own result");
  stop();
  expect(current(f).result).toBe("Own result");
  expect(f.w.researchFollowupContext(f.selection)).toBeNull();
});
it("retains the source packet after a failed refresh and retires earlier edit and citation captures", async () => {
  const f = await fixture();
  vi.mocked(f.api.recentFilings).mockResolvedValueOnce(
    filingsResponse(2, "available", f.selection),
  );
  await f.w.requestResearchSource(f.visit, "filings");
  f.attach();
  f.w.researchFollowupContext(f.selection)!.editAssessment("Authored judgment");
  const response = f.w.filings.getSnapshot().response!;
  const edit = f.w.researchFollowupContext(f.selection)!;
  const port = f.w.captureFilingsAssessment(f.selection, response).port!;
  const preview = prepareFilingsAssessment(
    port,
    response.issuer.filings[0]!,
    () => true,
  ).preview!;
  vi.mocked(f.api.recentFilings).mockRejectedValueOnce(
    new ManagedSecFilingsError("unavailable"),
  );
  await f.w.requestResearchSource(f.w.getSnapshot().research!, "filings");
  expect(f.w.filings.getSnapshot().response).toBe(response);
  expect(preview.apply()).toBe(false);
  edit.editAssessment("Stale");
  expect(current(f).result).toBe("Authored judgment");
  const next = f.w.captureFilingsAssessment(f.selection, response).port!;
  const retained = prepareFilingsAssessment(
    next,
    response.issuer.filings[0]!,
    () => true,
  ).preview!;
  expect(retained.citation).toContain("Retained previous filings response");
  expect(retained.citation).toContain(response.completedAt);
});
it("refuses a reentrant review handoff that navigates away and back", async () => {
  const f = await fixture();
  f.attach();
  const prior = f.w.followups.getSnapshot().selectedId;
  const review = f.w.reviewCompanyResearchCheck(f.selection, () => {
    f.w.setNavigationBlocked(true);
    f.w.setView("followups");
    f.w.setView("discover");
    f.w.setView("followups");
    return true;
  });
  expect(review).toBeNull();
  expect(f.w.followups.getSnapshot().selectedId).toBe(prior);
});

it("prevents an earlier captured proposal from replacing a newly attached owner", async () => {
  const f = await fixture();
  const first = f.read();
  const second = f.read();
  const attached = first.attach(first.followups.value!);
  expect(attached?.isCurrent()).toBe(true);
  expect(second.attach(second.followups.value!)).toBeNull();
  expect(attached?.isCurrent()).toBe(true);
});
