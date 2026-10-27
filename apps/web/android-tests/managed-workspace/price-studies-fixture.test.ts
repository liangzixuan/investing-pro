import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import type { ManagedEodHistoryResponseDto } from "@research-cockpit/contracts";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { CapturedPriceStudies } from "../../src/clerk-trial/ManagedPriceStudies";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import {
  prepareCompanyReport,
  type PreparedCompanyReport,
} from "../../src/clerk-trial/managed-company-report";
import { formatCompanyReportDocument } from "../../src/clerk-trial/managed-company-report-document";
import { createFixture } from "./fixture";
import { priceStudiesNoteDraft } from "./price-studies-fixture";

const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of owners.splice(0)) workspace.sessionOwner.dispose();
});
const request = {
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
  listingId: "listing-zero",
  range: "1m" as const,
};
async function setup() {
  const fixture = await createFixture("price-studies");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
    },
  );
  owners.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.note("listing-zero", "Price studies draft");
  const open = () =>
    workspace.openWatchlistEod(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
  open();
  const visit = () => workspace.getSnapshot().research!;
  const load = () => workspace.requestResearchSource(visit(), "eod");
  const command = () => ({
    expectedVersion: 1,
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
    payload: structuredClone(workspace.coordinator.getSnapshot().draft!),
  });
  return { fixture, workspace, open, visit, load, command };
}

function appendExpectedNote(
  f: Awaited<ReturnType<typeof setup>>,
  source: ManagedEodHistoryResponseDto,
) {
  const before = f.workspace.coordinator.getSnapshot().draft;
  const result = f.workspace.preparePriceStudiesNote(
    f.visit().selection,
    source,
    ["windowChange", "drawdown"],
    () => true,
  );
  expect(result.reason).toBeNull();
  expect(result.preview?.note).toBe(priceStudiesNoteDraft);
  expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
  expect(f.fixture.getSnapshot()).toMatchObject({ eod: 1, save: 0 });
  expect(f.workspace.appendPriceStudiesNote(result.preview!).appended).toBe(
    true,
  );
  expect(f.workspace.appendPriceStudiesNote(result.preview!).appended).toBe(
    false,
  );
}

function captureReport(f: Awaited<ReturnType<typeof setup>>) {
  return prepareCompanyReport(
    f.visit().selection,
    companySnapshotEvidence(
      f.visit().selection,
      f.workspace.eod.getSnapshot(),
      f.workspace.annual.getSnapshot(),
      f.workspace.filings.getSnapshot(),
      f.workspace.interim.getSnapshot(),
    ),
    f.workspace.getResearchWatchlist(f.visit().selection),
  )!;
}

function assertCalculation(report: PreparedCompanyReport) {
  expect(report.priceStudies?.calculation).toMatchObject({
    asOfDate: "2026-09-19",
    schemaVersion: "1.0.0",
    formulaSetVersion: "1.0.0",
    mode: "raw",
    inputWindow: {
      firstDate: "2026-09-17",
      lastDate: "2026-09-19",
      sessionCount: 3,
      sessionPolicy: "observed_sessions_only_no_gap_filling",
    },
    metrics: {
      selectedWindowReturn: { status: "available", valuePercent: "10.0000" },
      maximumDrawdown: { status: "available", valuePercent: "0.0000" },
      smaTrend: {
        sma20: { status: "insufficient_history", requiredSessions: 20 },
        sma50: { status: "insufficient_history", requiredSessions: 50 },
        sma200: { status: "insufficient_history", requiredSessions: 200 },
      },
      trailing20SessionAnnualizedVolatility: {
        status: "insufficient_history",
        requiredSessions: 21,
      },
      trailing252SessionCloseRangePosition: {
        status: "insufficient_history",
        requiredSessions: 200,
      },
    },
  });
}

function assertReportDocument(
  report: PreparedCompanyReport,
  source: ManagedEodHistoryResponseDto,
) {
  const text = formatCompanyReportDocument(report)!.text;
  const parsed: unknown = JSON.parse(text);
  expect(parsed).toMatchObject({
    schemaVersion: "6.0.0",
    authoredResearch: { note: priceStudiesNoteDraft },
    sources: {
      price: {
        status: "loaded",
        response: source,
        studies: {
          status: "available",
          calculation: report.priceStudies!.calculation,
        },
      },
      annual: { status: "not_loaded" },
      filings: { status: "not_loaded" },
    },
  });
  expect(source.rows.map((row) => row.close)).toEqual([
    "100.000000000000000001",
    "107.500000000000000002",
    "110.000000000000000003",
  ]);
}

function assertPassiveHtml(report: PreparedCompanyReport) {
  const html = renderToStaticMarkup(
    createElement(CapturedPriceStudies, {
      studies: report.priceStudies!,
      showingPrevious: false,
    }),
  );
  expect(html).toContain("Calculated through 2026-09-19");
  expect(html).toContain("<strong>10.0000%</strong>");
  expect(html).toContain("<strong>0.0000%</strong>");
  expect(html).not.toMatch(/<(?:input|button|select|textarea)\b/u);
}

function assertOnlyExplicitReads(f: Awaited<ReturnType<typeof setup>>) {
  expect(f.fixture.getSnapshot()).toMatchObject({
    load: 2,
    save: 1,
    status: 1,
    marketsResolve: 1,
    eod: 2,
    annual: 0,
    filings: 0,
    calendar: 0,
    fed: 0,
    marketsEod: 0,
    search: 0,
    resolve: 0,
    token: 0,
    signOut: 0,
  });
}

describe("fixed native Price studies scenario", () => {
  it("composes explicit load, exact whole-note Preview/Append, Save, fresh read and schema4 passive report", async () => {
    const f = await setup();
    expect(f.fixture.getSnapshot()).toMatchObject({
      load: 1,
      status: 1,
      marketsResolve: 1,
      eod: 0,
      save: 0,
    });
    expect(f.workspace.eod.getSnapshot().response).toBeNull();
    await f.load();
    const source = f.workspace.eod.getSnapshot().response!;
    appendExpectedNote(f, source);
    f.workspace.closeResearch();
    expect(f.fixture.getSnapshot()).toMatchObject({ eod: 1, save: 0 });
    await f.workspace.coordinator.save();
    expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 2,
      dirty: false,
    });
    await f.workspace.coordinator.load();
    expect(
      f.workspace.coordinator
        .getSnapshot()
        .draft!.memberships.map((member) => [member.symbol, member.note]),
    ).toEqual([
      ["ZERO", priceStudiesNoteDraft],
      ["ONE", "Invented second note"],
    ]);
    f.open();
    expect(f.workspace.eod.getSnapshot().response).toBeNull();
    expect(f.fixture.getSnapshot()).toMatchObject({ eod: 1, save: 1, load: 2 });
    await f.load();
    expect(f.workspace.eod.getSnapshot().response).toEqual(source);
    const report = captureReport(f);
    assertCalculation(report);
    assertReportDocument(report, source);
    assertPassiveHtml(report);
    assertOnlyExplicitReads(f);
    expect(() =>
      f.fixture.api.eodHistory(request, new AbortController().signal),
    ).toThrow("Unexpected invented price studies read or order");
    expect(f.fixture.getSnapshot().eod).toBe(2);
  });

  it("keeps the native exact expected note equal to the fixture and generated whole note", () => {
    const java = readFileSync(
      new URL(
        "../../android/app/src/androidTest/java/local/investment/personal/ManagedWorkspaceInstrumentedTest.java",
        import.meta.url,
      ),
      "utf8",
    );
    const initializer =
      /private static final String PRICE_STUDIES_NOTE = ([\s\S]*?);\r?\n/u.exec(
        java,
      )?.[1];
    expect(initializer).toBeDefined();
    const literals = initializer!.match(/"(?:[^"\\]|\\.)*"/gu)!;
    const nativeNote = literals
      .map((literal) => JSON.parse(literal) as string)
      .join("");
    expect(nativeNote).toBe(priceStudiesNoteDraft);
  });

  it("publishes wrapper diagnostics, owns the reused packet and keeps inherited Annual refusal", async () => {
    const f = await setup();
    const observations: number[][] = [];
    const stop = f.fixture.subscribe(() => {
      const state = f.fixture.getSnapshot();
      observations.push([state.eod, state.save, state.load]);
    });
    const first = await f.fixture.api.eodHistory(
      request,
      new AbortController().signal,
    );
    const original = structuredClone(first);
    Object.defineProperty(first.rows[0], "close", { value: "999.25" });
    f.workspace.note("listing-zero", priceStudiesNoteDraft);
    await f.workspace.coordinator.save();
    await f.workspace.coordinator.load();
    const second = await f.fixture.api.eodHistory(
      request,
      new AbortController().signal,
    );
    expect(second).toEqual(original);
    expect(second).not.toBe(first);
    expect(observations).toEqual(
      expect.arrayContaining([
        [1, 0, 1],
        [1, 1, 1],
        [1, 1, 2],
        [2, 1, 2],
      ]),
    );
    expect(() =>
      f.fixture.api.annualReport(
        {
          schemaVersion: "6.0.0",
          catalogSnapshotSha256: request.catalogSnapshotSha256,
          listingId: request.listingId,
          symbol: "ZERO",
        },
        new AbortController().signal,
      ),
    ).toThrow("Unexpected fixture price note Annual read");
    expect(f.fixture.getSnapshot().annual).toBe(0);
    stop();
    const published = observations.length;
    await f.fixture.api.status(new AbortController().signal);
    expect(f.fixture.getSnapshot().status).toBe(2);
    expect(observations).toHaveLength(published);
  });

  it("refuses a source read before startup admission and a second read before Save and fresh load", async () => {
    const fixture = await createFixture("price-studies");
    expect(() =>
      fixture.api.eodHistory(request, new AbortController().signal),
    ).toThrow("Unexpected invented price studies read or order");
    expect(fixture.getSnapshot().eod).toBe(0);
    const f = await setup();
    await f.load();
    expect(() =>
      f.fixture.api.eodHistory(request, new AbortController().signal),
    ).toThrow("Unexpected invented price studies read or order");
    expect(f.fixture.getSnapshot().eod).toBe(1);
  });

  it.each(["catalog", "listing", "range", "aborted"] as const)(
    "refuses a mismatched %s request without consuming the first explicit read",
    async (fault) => {
      const f = await setup();
      const controller = new AbortController();
      if (fault === "aborted") controller.abort();
      expect(() =>
        f.fixture.api.eodHistory(
          {
            ...request,
            ...(fault === "catalog"
              ? { catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const }
              : {}),
            ...(fault === "listing" ? { listingId: "listing-one" } : {}),
            ...(fault === "range" ? { range: "1y" as const } : {}),
          },
          controller.signal,
        ),
      ).toThrow("Unexpected invented price studies read or order");
      expect(f.fixture.getSnapshot().eod).toBe(0);
      await f.load();
      expect(f.fixture.getSnapshot().eod).toBe(1);
    },
  );

  it.each([
    "before source",
    "wrong complete note",
    "other note",
    "member order",
  ] as const)("refuses an unexpected whole-list Save: %s", async (fault) => {
    const f = await setup();
    if (fault !== "before source") await f.load();
    f.workspace.note("listing-zero", priceStudiesNoteDraft);
    const original = f.command();
    const members = original.payload.memberships.map((member, index) =>
      fault === "wrong complete note" && index === 0
        ? { ...member, note: `${priceStudiesNoteDraft} changed` }
        : fault === "other note" && index === 1
          ? { ...member, note: "Changed independent note" }
          : member,
    );
    const command = {
      ...original,
      payload: {
        ...original.payload,
        memberships: fault === "member order" ? members.reverse() : members,
      },
    };
    await expect(
      f.fixture.api.save(command, new AbortController().signal),
    ).rejects.toThrow("Unexpected fixture operation: save");
    // Diagnostics count the refused attempt; the durable watchlist stays at version one.
    expect(f.fixture.getSnapshot().save).toBe(1);
    expect(await f.fixture.api.load(new AbortController().signal)).toEqual(
      f.workspace.coordinator.getSnapshot().saved,
    );
  });
});
