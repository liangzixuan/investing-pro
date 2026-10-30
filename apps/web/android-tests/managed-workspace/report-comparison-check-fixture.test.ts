import { CompanyReportRevisit } from "../../src/clerk-trial/company-report-revisit";
import { captureCompanyReportRevisit } from "../../src/clerk-trial/company-report-revisit-capture";
import { prepareCompanyReportComparisonCheck } from "../../src/clerk-trial/company-report-comparison-check";
import {
  reportCheckNote,
  reportCheckIndependentResult,
} from "./report-comparison-check-fixture-data";
import { afterEach, expect, it, vi } from "vitest";
import { encodeResearchFollowupsPayload } from "@research-cockpit/contracts";
import { createFixture } from "./fixture";
import {
  reportComparisonCheckExpected,
  reportCheckExpectedResult,
  reportCheckAssessment,
} from "./report-comparison-check-fixture-data";
import { reportRevisitDocument } from "./report-revisit-fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import { prepareCompanyReport } from "../../src/clerk-trial/managed-company-report";
import { parseCompanyReportArchive } from "../../src/clerk-trial/managed-company-report-archive";
import { companyReportComparisonExcerpt } from "../../src/clerk-trial/company-report-comparison-excerpt";
import { projectCurrentCompanyReport } from "../../src/clerk-trial/managed-company-report-archive";
const time = "2026-10-30T12:00:00.000Z";
afterEach(() => vi.useRealTimers());
async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(time));
  const fixture = await createFixture("report-comparison-check"),
    signal = new AbortController().signal,
    meta = fixture.reportComparisonCheck!;
  return {
    fixture,
    signal,
    meta,
    request: {
      schemaVersion: "6.0.0" as const,
      catalogSnapshotSha256: fixture.researchCoverage.catalogSnapshotSha256,
      listingId: "listing-zero",
      symbol: "ZERO",
    },
    command: {
      idempotencyKey: "90000000-0000-4000-8000-000000000001",
      expectedVersion: 1,
      payload: reportComparisonCheckExpected(
        fixture,
        reportCheckExpectedResult(fixture, time, time),
        "2026-10-30",
      ),
    },
  };
}
it("starts without personal loads, writes or provider requests", async () => {
  const f = await setup();
  expect(Object.values(f.meta.getSnapshot()).every((n) => n === 0)).toBe(true);
  expect(f.fixture.followups!.getSnapshot()).toMatchObject({
    session: 1,
    load: 0,
    save: 0,
    commits: 0,
  });
});
it("admits independent loads, one complete payload Save and exact fresh-session Load", async () => {
  const f = await setup();
  expect((await f.fixture.api.load(f.signal)).version).toBe(7);
  expect((await f.fixture.api.loadPortfolio(f.signal)).version).toBe(3);
  await f.fixture.api.loadFollowups(f.signal);
  await f.fixture.api.annualReport(f.request, f.signal);
  const saved = await f.fixture.api.saveFollowups(f.command, f.signal);
  expect(saved.version).toBe(2);
  f.fixture.followups!.nextSession();
  const fresh = await f.fixture.api.loadFollowups(f.signal);
  expect(encodeResearchFollowupsPayload(fresh.payload)).toBe(
    encodeResearchFollowupsPayload(f.command.payload),
  );
  expect(f.meta.getSnapshot()).toMatchObject({
    annual: 1,
    rejected: 0,
    save: 0,
    portfolioSave: 0,
    valuationSave: 0,
  });
});
it.each(["result", "question", "date", "status", "other", "order", "version"])(
  "refuses changed %s before any saved commit",
  async (kind) => {
    const f = await setup();
    await f.fixture.api.loadFollowups(f.signal);
    await f.fixture.api.annualReport(f.request, f.signal);
    const payload = {
        ...f.command.payload,
        entries: f.command.payload.entries.map((e) => ({ ...e })),
      },
      first = payload.entries[0]!;
    if (kind === "result") first.result += " changed";
    if (kind === "question") first.check += " changed";
    if (kind === "date") first.completedOn = "2026-10-29";
    if (kind === "status") {
      first.status = "open";
      first.completedOn = null;
    }
    if (kind === "other") payload.entries[1]!.result += " changed";
    if (kind === "order") payload.entries.reverse();
    expect(() =>
      f.fixture.api.saveFollowups(
        { ...f.command, expectedVersion: kind === "version" ? 0 : 1, payload },
        f.signal,
      ),
    ).toThrow();
    expect(f.fixture.followups!.getSnapshot().commits).toBe(0);
  },
);
it("refuses unrelated writes/provider calls and repeated current reads", async () => {
  const f = await setup();
  expect(() => f.fixture.api.save({} as never, f.signal)).toThrow();
  expect(() => f.fixture.api.savePortfolio({} as never, f.signal)).toThrow();
  expect(() => f.fixture.api.eodHistory({} as never, f.signal)).toThrow();
  expect(() => f.fixture.api.recentFilings({} as never, f.signal)).toThrow();
  await f.fixture.api.annualReport(f.request, f.signal);
  expect(() => f.fixture.api.annualReport(f.request, f.signal)).toThrow();
  expect(f.meta.getSnapshot().rejected).toBe(5);
});
it("compares real archive/current source projections with the independent full expected result", async () => {
  const f = await setup(),
    w = new ManagedWorkspace(f.fixture.api, f.fixture.session, undefined, {
      researchCoverage: f.fixture.researchCoverage,
      marketsCohort: f.fixture.marketsCohort,
      priceCoverage: f.fixture.priceCoverage,
    });
  try {
    await w.refreshCatalog();
    w.setNavigationBlocked(true);
    await w.setCompanyRoute({
      kind: "company",
      listingId: "listing-zero",
      section: "annual",
    });
    await w.coordinator.load();
    await w.annual.load();
    const selection = w.getSnapshot().research!.selection;
    const current = prepareCompanyReport(
      selection,
      companySnapshotEvidence(
        selection,
        w.eod.getSnapshot(),
        w.annual.getSnapshot(),
        w.filings.getSnapshot(),
        w.interim.getSnapshot(),
      ),
      w.getResearchWatchlist(selection),
      () => new Date(time),
    )!;
    const document = await reportRevisitDocument(
        await createFixture("company-snapshot"),
      ),
      archive = await parseCompanyReportArchive(document.text, f.signal);
    expect(archive).not.toBeNull();
    const prefix = f.meta.data.followups.entries[0]!.result;
    const result =
      prefix +
      " " +
      companyReportComparisonExcerpt(
        {
          archive: archive!,
          assessment: reportCheckAssessment,
          assessedAt: time,
        },
        projectCurrentCompanyReport(current)!,
        true,
      );
    expect(result).toBe(reportCheckExpectedResult(f.fixture, time, time));
    expect([...result].length).toBeLessThanOrEqual(2000);
  } finally {
    w.sessionOwner.dispose();
  }
});

it("runs the strict invented native API through real generic attachment, comparison apply, separate completion/save and fresh session", async () => {
  const f = await setup();
  const options = {
    researchCoverage: f.fixture.researchCoverage,
    marketsCohort: f.fixture.marketsCohort,
    priceCoverage: f.fixture.priceCoverage,
  };
  const w = new ManagedWorkspace(
    f.fixture.api,
    f.fixture.session,
    undefined,
    options,
  );
  let controller: CompanyReportRevisit | null = null,
    fresh: ManagedWorkspace | null = null;
  try {
    await w.refreshCatalog();
    w.setNavigationBlocked(true);
    await w.setCompanyRoute({
      kind: "company",
      listingId: "listing-zero",
      section: "annual",
    });
    await w.coordinator.load();
    await w.portfolio.coordinator.load();
    await w.followups.coordinator.load();
    w.note("listing-zero", reportCheckNote);
    w.portfolio.coordinator.replaceDraft({
      ledger: {
        ...f.meta.data.portfolio,
        opening: { ...f.meta.data.portfolio.opening, cashUsd: "1500.00" },
      },
    });
    w.followups.edit(
      w.followups.coordinator.getSnapshot().draft!.entries[1]!,
      "result",
      reportCheckIndependentResult,
    );
    const selection = w.getSnapshot().research!.selection;
    const props = {
      selection,
      price: w.eod,
      annual: w.annual,
      interim: w.interim,
      filings: w.filings,
      valuation: w.valuation,
      readWatchlist: (selected: typeof selection) =>
        w.getResearchWatchlist(selected),
      target: () => w.captureCompanyReportRevisitTarget(selection, () => true),
    };
    controller = new CompanyReportRevisit({
      selection,
      active: () => props.target()?.isCurrent() === true,
      capture: () => captureCompanyReportRevisit(props),
    });
    const document = await reportRevisitDocument(
        await createFixture("company-snapshot"),
      ),
      bytes = new TextEncoder().encode(document.text).buffer;
    await controller.readFile({
      size: bytes.byteLength,
      arrayBuffer: () => Promise.resolve(bytes),
    });
    expect(controller.getSnapshot().archive).not.toBeNull();
    expect(w.annual.getSnapshot().response).toBeNull();
    await w.annual.load();
    controller.captureCurrent();
    expect(controller.comparisonIsCurrent()).toBe(true);
    expect(
      w.captureCompanyReportComparisonCheckTarget(selection, () => true),
    ).toBeNull();
    const checks = w.getCompanyResearchChecks(selection)!;
    expect(checks.attach(checks.followups.value!)?.isCurrent()).toBe(true);
    expect(controller.comparisonIsCurrent()).toBe(true);
    controller.setAssessment(reportCheckAssessment);
    const target = w.captureCompanyReportComparisonCheckTarget(
      selection,
      () => true,
    )!;
    const watchlist = w.coordinator.getSnapshot(),
      portfolio = w.portfolio.coordinator.getSnapshot(),
      editor = w.valuation.getSnapshot(),
      annual = w.annual.getSnapshot(),
      visit = w.getSnapshot().research;
    const preview = prepareCompanyReportComparisonCheck(
      controller.captureComparison()!,
      target,
      () => true,
      time,
    ).preview!;
    expect(preview).not.toBeNull();
    expect(preview.result).toBe(
      reportCheckExpectedResult(f.fixture, time, time),
    );
    expect(preview.apply()).toBe(true);
    expect(preview.apply()).toBe(false);
    expect(w.coordinator.getSnapshot()).toBe(watchlist);
    expect(w.portfolio.coordinator.getSnapshot()).toBe(portfolio);
    expect(w.valuation.getSnapshot()).toBe(editor);
    expect(w.annual.getSnapshot()).toBe(annual);
    expect(w.getSnapshot().research).toBe(visit);
    expect(controller.comparisonIsCurrent()).toBe(true);
    const duplicate = prepareCompanyReportComparisonCheck(
      controller.captureComparison()!,
      w.captureCompanyReportComparisonCheckTarget(selection, () => true)!,
      () => true,
      "2026-10-30T12:01:00.000Z",
    );
    expect(duplicate.preview).toBeNull();
    expect(duplicate.reason).toBe(
      "This comparison is already in the current Follow-ups assessment.",
    );
    expect(
      w.reviewCompanyResearchCheck(selection, () => {
        w.setNavigationBlocked(true);
        w.setView("followups");
        return true;
      }),
    ).not.toBeNull();
    w.setNavigationBlocked(false);
    await w.setCompanyRoute(null);
    w.followups.complete(
      w.followups.currentEntry(target.entry.id)!,
      new Date(time),
    );
    await w.followups.coordinator.save();
    expect(w.followups.coordinator.getSnapshot().baseVersion).toBe(2);
    fresh = new ManagedWorkspace(
      f.fixture.api,
      f.fixture.followups!.nextSession(),
      undefined,
      options,
    );
    await fresh.refreshCatalog();
    await fresh.followups.coordinator.load();
    expect(
      encodeResearchFollowupsPayload(
        fresh.followups.coordinator.getSnapshot().draft!,
      ),
    ).toBe(encodeResearchFollowupsPayload(f.command.payload));
    expect(f.meta.getSnapshot()).toMatchObject({
      load: 1,
      portfolioLoad: 1,
      resolve: 1,
      annual: 1,
      rejected: 0,
      save: 0,
      portfolioSave: 0,
      valuationSave: 0,
    });
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      session: 2,
      load: 2,
      save: 1,
      commits: 1,
    });
  } finally {
    controller?.dispose();
    w.sessionOwner.dispose();
    fresh?.sessionOwner.dispose();
  }
});
