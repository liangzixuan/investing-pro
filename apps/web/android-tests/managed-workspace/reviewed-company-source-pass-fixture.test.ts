import { afterEach, describe, expect, it, vi } from "vitest";
import type { ManagedResearchSelection } from "../../src/clerk-trial/managed-research-selection";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import { prepareCompanyReport } from "../../src/clerk-trial/managed-company-report";
import { formatCompanyReportDocument } from "../../src/clerk-trial/managed-company-report-document";
import { createFixture } from "./fixture";

const all = ["eod", "annual", "filings", "interim"] as const;
afterEach(() => vi.useRealTimers());
async function opened() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-20T12:00:00.000Z"));
  const fixture = await createFixture("reviewed-company-source-pass");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      priceCoverage: fixture.priceCoverage,
      interimIssuers: fixture.interimReview!.issuers,
    },
  );
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.note("listing-zero", fixture.interimReview!.prefix);
  workspace.openWatchlistAnnual(
    workspace.coordinator.getSnapshot().draft!.memberships[0]!,
  );
  return { fixture, workspace, visit: workspace.getSnapshot().research! };
}
type Opened = Awaited<ReturnType<typeof opened>>;
type Draft = NonNullable<
  ReturnType<ManagedWorkspace["coordinator"]["getSnapshot"]>["draft"]
>;
async function pendingAnnual({ fixture, workspace, visit }: Opened) {
  const preview = workspace.prepareCompanySourcePass(visit, all);
  expect(preview).not.toBeNull();
  const running = workspace.runCompanySourcePass(visit, preview!);
  await vi.waitFor(() =>
    expect(workspace.annual.getSnapshot().running).toBe(true),
  );
  await vi.waitFor(() =>
    expect(fixture.reviewedCompanySourcePass!.getSnapshot().order).toEqual([
      "eod",
      "annual",
    ]),
  );
  // Let the fixture install its deliberately abort-ignoring held reply.
  await Promise.resolve();
  await Promise.resolve();
  return { running, preview: preview! };
}
async function cancelFirstRead(value: Opened) {
  const { running } = await pendingAnnual(value);
  const price = value.workspace.eod.getSnapshot().response;
  value.workspace.cancelCompanySourcePass(value.visit);
  expect(value.fixture.reviewedCompanySourcePass!.getSnapshot().aborted).toBe(
    1,
  );
  value.fixture.reviewedCompanySourcePass!.settleCancelledAnnual();
  await running;
  expect(value.workspace.annual.getSnapshot().response).toBeNull();
  expect(value.fixture.getSnapshot()).toMatchObject({
    eod: 1,
    annual: 1,
    filings: 0,
    interimReport: 0,
    save: 0,
  });
  expect(
    value.workspace.companySourcePass
      .getSnapshot()
      .rows.map((row) => row.disposition),
  ).toEqual(["loaded", "cancelled", "not_attempted", "not_attempted"]);
  return price;
}

function previewMissingSources({ fixture, workspace, visit }: Opened) {
  const defaults = workspace.prepareCompanySourcePass(visit, all.slice(0, 3));
  expect(defaults?.names).toEqual(["eod", "annual", "filings"]);
  expect(
    defaults?.rows.map((row) => [row.name, row.selected, row.disposition]),
  ).toEqual([
    ["eod", true, "missing"],
    ["annual", true, "missing"],
    ["filings", true, "missing"],
    ["interim", false, "not_attempted"],
  ]);
  expect(fixture.getSnapshot()).toMatchObject({
    eod: 0,
    annual: 0,
    filings: 0,
    interimReport: 0,
    save: 0,
  });
}

async function completeReviewedSources(
  { fixture, workspace, visit }: Opened,
  price: ReturnType<ManagedWorkspace["eod"]["getSnapshot"]>["response"],
) {
  const reviewed = workspace.prepareCompanySourcePass(visit, [
    "interim",
    "filings",
    "annual",
    "eod",
  ]);
  expect(reviewed?.names).toEqual(all);
  expect(reviewed?.rows[0]).toMatchObject({
    disposition: "retained",
    evidence: { completedAt: price!.completedAt },
  });
  expect(fixture.getSnapshot().annual).toBe(1);
  await workspace.runCompanySourcePass(visit, reviewed!);
  expect(fixture.reviewedCompanySourcePass!.getSnapshot()).toEqual({
    order: ["eod", "annual", "annual", "filings", "interimReport"],
    aborted: 1,
    late: 1,
  });
  expect(workspace.companySourcePass.getSnapshot()).toMatchObject({
    phase: "finished",
    rows: [
      { disposition: "retained" },
      { disposition: "loaded" },
      { disposition: "loaded" },
      { disposition: "loaded" },
    ],
  });
  expect(workspace.eod.getSnapshot().response).toBe(price);
}

async function retainCompleteSources({ fixture, workspace, visit }: Opened) {
  const responses = [
    workspace.eod.getSnapshot().response,
    workspace.annual.getSnapshot().response,
    workspace.filings.getSnapshot().response,
    workspace.interim.getSnapshot().response,
  ];
  const retained = workspace.prepareCompanySourcePass(visit, all)!;
  expect(retained.rows.every((row) => row.disposition === "retained")).toBe(
    true,
  );
  await workspace.runCompanySourcePass(visit, retained);
  expect([
    workspace.eod.getSnapshot().response,
    workspace.annual.getSnapshot().response,
    workspace.filings.getSnapshot().response,
    workspace.interim.getSnapshot().response,
  ]).toEqual(responses);
  expect(fixture.getSnapshot()).toMatchObject({
    eod: 1,
    annual: 2,
    filings: 1,
    interimReport: 1,
    save: 0,
  });
}

function appendCitedInterimCells(
  { fixture, workspace }: Opened,
  original: Draft,
) {
  workspace.switchToInterim();
  const selected = workspace.getSnapshot().research!.selection;
  const packet = workspace.interim.getSnapshot().response!;
  expect(
    packet.evidence.facts.observations
      .filter(
        (row) =>
          row.concept === "RevenueFromContractWithCustomerExcludingAssessedTax",
      )
      .map((row) => [row.startDate, row.endDate, row.value]),
  ).toEqual([
    ["2026-04-01", "2026-06-30", "40"],
    ["2026-01-01", "2026-06-30", "75"],
  ]);
  const proposal = workspace.prepareInterimStatementsNote(
    selected,
    packet,
    fixture.interimReview!.selectedCells,
    () => true,
  );
  expect(proposal.preview?.note).toBe(fixture.interimReview!.expectedNote);
  expect(workspace.coordinator.getSnapshot().draft).toEqual(original);
  expect(
    workspace.appendInterimStatementsNote(proposal.preview!).appended,
  ).toBe(true);
  const expected = {
    ...original,
    memberships: original.memberships.map((member, index) =>
      index === 0
        ? { ...member, note: fixture.interimReview!.expectedNote }
        : member,
    ),
  };
  expect(workspace.coordinator.getSnapshot().draft).toEqual(expected);
  return { selected, expected };
}

function captureDatedReport(
  { fixture, workspace }: Opened,
  selected: ManagedResearchSelection,
) {
  const evidence = companySnapshotEvidence(
    selected,
    workspace.eod.getSnapshot(),
    workspace.annual.getSnapshot(),
    workspace.filings.getSnapshot(),
    workspace.interim.getSnapshot(),
  );
  const report = prepareCompanyReport(
    selected,
    evidence,
    workspace.getResearchWatchlist(selected),
    () => new Date("2026-09-21T12:00:00.000Z"),
  );
  const document = formatCompanyReportDocument(report!);
  expect(document).not.toBeNull();
  const captured = JSON.parse(document!.text) as {
    authoredResearch: { note: unknown };
    sources: { interim: unknown };
  };
  expect(captured.authoredResearch.note).toBe(
    fixture.interimReview!.expectedNote,
  );
  expect(document!.text).toContain("2026-08-01T12:00:03.000Z");
  expect(document!.text).toContain("2026-09-20T00:00:02.000Z");
  expect(captured.sources.interim).not.toBeNull();
}

async function backAndSaveSeparately(
  { fixture, workspace }: Opened,
  expected: Draft,
) {
  workspace.closeResearch();
  expect(workspace.coordinator.getSnapshot()).toMatchObject({
    draft: expected,
    baseVersion: 1,
    dirty: true,
  });
  expect(fixture.getSnapshot().save).toBe(0);
  await workspace.coordinator.save();
  await workspace.coordinator.load();
  expect(workspace.coordinator.getSnapshot()).toMatchObject({
    draft: expected,
    baseVersion: 2,
    dirty: false,
  });
  expect(fixture.getSnapshot()).toMatchObject({
    load: 2,
    save: 1,
    eod: 1,
    annual: 2,
    filings: 1,
    interimReport: 1,
    token: 0,
    signOut: 0,
    interimPortfolioLoad: 0,
    interimFollowupsLoad: 0,
  });
}

describe("invented reviewed company source pass native journey", () => {
  it("previews without reads, cancels remaining work, retains clocks, and continues through cited cells, report, Back and separate Save", async () => {
    const value = await opened();
    const { workspace } = value;
    try {
      const original = structuredClone(
        workspace.coordinator.getSnapshot().draft!,
      );
      previewMissingSources(value);
      const price = await cancelFirstRead(value);
      await completeReviewedSources(value, price);
      await retainCompleteSources(value);
      const { selected, expected } = appendCitedInterimCells(value, original);
      captureDatedReport(value, selected);
      await backAndSaveSeparately(value, expected);
    } finally {
      workspace.sessionOwner.dispose();
    }
  });

  it.each(["Back", "session retirement"] as const)(
    "fences a pending Annual reply and remaining sources after %s",
    async (change) => {
      const value = await opened();
      try {
        const { running, preview } = await pendingAnnual(value);
        if (change === "Back") value.workspace.closeResearch();
        else value.workspace.sessionOwner.dispose();
        expect(
          value.fixture.reviewedCompanySourcePass!.getSnapshot().aborted,
        ).toBe(1);
        value.fixture.reviewedCompanySourcePass!.settleCancelledAnnual();
        await running;
        await value.workspace.runCompanySourcePass(value.visit, preview);
        expect(value.fixture.getSnapshot()).toMatchObject({
          eod: 1,
          annual: 1,
          filings: 0,
          interimReport: 0,
          save: 0,
        });
        expect(value.workspace.annual.getSnapshot().response).toBeNull();
      } finally {
        value.workspace.sessionOwner.dispose();
      }
    },
  );

  it("retires a preview after a section change and refuses unreviewed or foreign handles", async () => {
    const { fixture, workspace, visit } = await opened();
    try {
      const preview = workspace.prepareCompanySourcePass(visit, all)!;
      await workspace.runCompanySourcePass(visit, { ...preview });
      expect(fixture.getSnapshot().eod).toBe(0);
      workspace.switchToInterim();
      await workspace.runCompanySourcePass(visit, preview);
      expect(fixture.getSnapshot()).toMatchObject({
        eod: 0,
        annual: 0,
        filings: 0,
        interimReport: 0,
        save: 0,
      });
      expect(() =>
        fixture.reviewedCompanySourcePass!.settleCancelledAnnual(),
      ).toThrow();
    } finally {
      workspace.sessionOwner.dispose();
    }
  });
});
