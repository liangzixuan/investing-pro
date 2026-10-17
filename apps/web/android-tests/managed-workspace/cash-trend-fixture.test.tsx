import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  PersonalSecAnnualCashObservationDto,
  PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";

import { createFixture } from "./fixture";
import {
  annualCashHistoryRows,
  cashResponse,
} from "../../src/features/research/test-canonical-annual-cash-ui-fixture";
import { viewOf } from "../../src/features/research/test-canonical-annual-ui-fixture";
function request() {
  return {
    schemaVersion: "6.0.0" as const,
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
    listingId: "listing-zero",
    symbol: "ZERO",
  };
}
import { parseSecAnnualCanonicalResponse } from "../../src/lib/sec-annual-canonical-response";
import { projectManagedAnnualCashTrend } from "../../src/features/research/managed-annual-cash-trend-input";
import { SecAnnualCashHistory } from "../../src/features/research/SecAnnualCashHistory";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { TrialApiError } from "../../src/clerk-trial/api";

const metrics = [
  "operatingCashFlow",
  "ppePurchases",
  "operatingCashFlowLessPpePurchases",
] as const;

async function admittedCash(
  rows: readonly PersonalSecAnnualCashObservationDto[],
  cutoffAt?: string,
) {
  const candidate = await cashResponse(rows, cutoffAt);
  const admitted = await parseSecAnnualCanonicalResponse(
    candidate,
    request(),
    new AbortController().signal,
  );
  if (!admitted) throw new Error("Invented comparative cash packet refused");
  expect(admitted).toEqual(candidate);
  return admitted;
}

function heldRead() {
  let finish!: (packet: PersonalSecAnnualCanonicalResponseDto) => void;
  const promise = new Promise<PersonalSecAnnualCanonicalResponseDto>(
    (resolve) => {
      finish = resolve;
    },
  );
  return { promise, finish };
}

function replacementRows() {
  return annualCashHistoryRows()
    .filter((row) => row.endDate !== "2023-12-31")
    .map((row) =>
      row.endDate === "2025-12-31"
        ? {
            ...row,
            value: row.metric === "operating_cash_flow" ? "200.125" : "100.025",
          }
        : row,
    );
}

async function setupJourney() {
  const fixture = await createFixture("research-followups");
  const first = await admittedCash(annualCashHistoryRows());
  const replacement = await admittedCash(
    replacementRows(),
    "2026-09-21T00:00:00.000Z",
  );
  const cancelled = heldRead(),
    changedCompany = heldRead(),
    retired = heldRead();
  const annual = vi
    .fn<ManagedApi["annualReport"]>()
    .mockResolvedValueOnce(first)
    .mockRejectedValueOnce(new TrialApiError("unavailable"))
    .mockReturnValueOnce(cancelled.promise)
    .mockResolvedValueOnce(replacement)
    .mockReturnValueOnce(changedCompany.promise)
    .mockReturnValueOnce(retired.promise);
  const workspace = new ManagedWorkspace(
    { ...fixture.api, annualReport: annual },
    fixture.session,
    undefined,
    {
      priceCoverage: fixture.priceCoverage,
      marketsCohort: fixture.marketsCohort,
    },
  );
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  await workspace.followups.coordinator.load();
  workspace.setView("watchlist");
  workspace.note("listing-zero", "Cash trend · Café 東京 📈  ");
  const watchlist = workspace.coordinator.getSnapshot().draft!;
  workspace.followups.add(watchlist.memberships[0]!, "2026-10-30");
  const entryId = workspace.followups.getSnapshot().selectedId!;
  workspace.followups.edit(
    workspace.followups.currentEntry(entryId)!,
    "check",
    "Keep independent cash check  ",
  );
  const followups = workspace.followups.coordinator.getSnapshot().draft;
  return {
    fixture,
    first,
    replacement,
    cancelled,
    changedCompany,
    retired,
    annual,
    workspace,
    watchlist,
    followups,
  };
}
type Journey = Awaited<ReturnType<typeof setupJourney>>;

function expectDraftsAndReads(journey: Journey, annualReads: number) {
  const { workspace, watchlist, followups, fixture, annual } = journey;
  expect(workspace.coordinator.getSnapshot().draft).toBe(watchlist);
  expect(workspace.followups.coordinator.getSnapshot().draft).toBe(followups);
  expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
  expect(workspace.followups.coordinator.getSnapshot().dirty).toBe(true);
  expect(annual).toHaveBeenCalledTimes(annualReads);
  expect(fixture.getSnapshot()).toMatchObject({
    load: 1,
    status: 1,
    save: 0,
    annual: 0,
    eod: 0,
    filings: 0,
    calendar: 0,
    fed: 0,
    token: 0,
    signOut: 0,
  });
  expect(fixture.followups!.getSnapshot()).toMatchObject({
    load: 1,
    save: 0,
    commits: 0,
  });
}

function inspectCash(
  journey: Journey,
  packet: PersonalSecAnnualCanonicalResponseDto,
) {
  const before = journey.fixture.getSnapshot(),
    reads = journey.annual.mock.calls.length;
  const exactPacket = JSON.stringify(packet);
  const projection = projectManagedAnnualCashTrend(packet, viewOf(packet));
  const history = viewOf(packet).cashGeneration.history;
  if (projection.status !== "ready" || history.status !== "available")
    throw new Error("Expected comparative cash history");
  const markup = renderToStaticMarkup(
    <SecAnnualCashHistory response={packet} view={viewOf(packet)} />,
  );
  expect(projection.periods).toEqual([...history.periods].reverse());
  expect(projection.completedAt).toBe(packet.evidence.generation.completedAt);
  expect(projection.accessionNumber).toBe(history.accessionNumber);
  expect(projection.stoppedReason).toBe(history.stoppedReason);
  expect(markup).toContain("<summary>Reported cash history</summary>");
  expect(markup).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/u);
  const table = markup.slice(
    markup.indexOf("<table>"),
    markup.indexOf("</table>") + 8,
  );
  const rows = [
    ...table.slice(table.indexOf("<tbody>")).matchAll(/<tr>(.*?)<\/tr>/gu),
  ];
  expect(
    rows.map((row) =>
      [...row[1]!.matchAll(/<td>(.*?)<\/td>/gu)].map((cell) => cell[1]),
    ),
  ).toEqual(metrics.map((key) => history.periods.map((period) => period[key])));
  let last = -1;
  for (const period of history.periods) {
    const next = table.indexOf(period.endDate);
    expect(next).toBeGreaterThan(last);
    last = next;
    expect(table).toContain(period.startDate);
    for (const id of period.observationIds) expect(markup).toContain(id);
  }
  expect(markup).toContain(history.accessionNumber);
  expect(markup).toContain(packet.evidence.generation.completedAt);
  expect(JSON.stringify(packet)).toBe(exactPacket);
  expect(journey.fixture.getSnapshot()).toEqual(before);
  expect(journey.annual).toHaveBeenCalledTimes(reads);
  return projection;
}

async function loadFirst(journey: Journey) {
  const { workspace, watchlist, annual, first } = journey;
  workspace.openWatchlistAnnual(watchlist.memberships[0]!);
  expect(workspace.annual.getSnapshot().response).toBeNull();
  expect(annual).not.toHaveBeenCalled();
  await workspace.annual.load();
  expect(workspace.annual.getSnapshot().response).toBe(first);
  expect(annual.mock.calls[0]![0]).toEqual(request());
  const projection = inspectCash(journey, first);
  expect(projection.periods.map((period) => period.endDate)).toEqual([
    "2023-12-31",
    "2024-12-31",
    "2025-12-31",
  ]);
  expect(projection.plots).toEqual({
    operatingCashFlow: { status: "ready", values: [500, -50, 120.125] },
    ppePurchases: { status: "ready", values: [750, 0, 20.025] },
    operatingCashFlowLessPpePurchases: {
      status: "ready",
      values: [-250, -50, 100.1],
    },
  });
  expect(projection.completedAt).toBe("2026-09-20T00:00:02.000Z");
  expectDraftsAndReads(journey, 1);
  return projection;
}

async function retainAndCancel(
  journey: Journey,
  initial: ReturnType<typeof inspectCash>,
) {
  const { workspace, annual, first, cancelled, replacement } = journey;
  await workspace.annual.load();
  expect(workspace.annual.getSnapshot()).toMatchObject({
    response: first,
    showingPrevious: true,
    error: true,
  });
  expect(
    inspectCash(journey, workspace.annual.getSnapshot().response!),
  ).toEqual(initial);
  expectDraftsAndReads(journey, 2);
  const pending = workspace.annual.load();
  expect(workspace.annual.getSnapshot()).toMatchObject({
    response: first,
    running: true,
    showingPrevious: true,
  });
  expect(
    inspectCash(journey, workspace.annual.getSnapshot().response!),
  ).toEqual(initial);
  workspace.annual.cancel();
  expect(annual.mock.calls[2]![1].aborted).toBe(true);
  cancelled.finish(replacement);
  await pending;
  expect(workspace.annual.getSnapshot()).toMatchObject({
    response: first,
    running: false,
    showingPrevious: true,
  });
  expect(
    inspectCash(journey, workspace.annual.getSnapshot().response!),
  ).toEqual(initial);
  expectDraftsAndReads(journey, 3);
}

async function acceptReplacement(journey: Journey, oldKey: string) {
  const { workspace, replacement } = journey;
  await workspace.annual.load();
  expect(workspace.annual.getSnapshot()).toMatchObject({
    response: replacement,
    showingPrevious: false,
    error: false,
  });
  const projection = inspectCash(journey, replacement);
  expect(projection.periods.map((period) => period.endDate)).toEqual([
    "2024-12-31",
    "2025-12-31",
  ]);
  expect(projection.plots).toEqual({
    operatingCashFlow: { status: "ready", values: [-50, 200.125] },
    ppePurchases: { status: "ready", values: [0, 100.025] },
    operatingCashFlowLessPpePurchases: {
      status: "ready",
      values: [-50, 100.1],
    },
  });
  expect(projection.completedAt).toBe("2026-09-21T00:00:02.000Z");
  expect(projection.stoppedReason).toBe("no_report_period");
  expect(projection.contentKey).not.toBe(oldKey);
  expectDraftsAndReads(journey, 4);
}

async function leaveAndRetire(journey: Journey) {
  const {
    workspace,
    watchlist,
    annual,
    changedCompany,
    retired,
    first,
    replacement,
  } = journey;
  const pendingCompany = workspace.annual.load();
  workspace.closeResearch();
  workspace.openWatchlistAnnual(watchlist.memberships[1]!);
  expect(annual.mock.calls[4]![1].aborted).toBe(true);
  changedCompany.finish(first);
  await pendingCompany;
  expect(workspace.annual.getSnapshot()).toMatchObject({
    response: null,
    selection: { listing: { listingId: "listing-one" } },
  });
  expectDraftsAndReads(journey, 5);
  workspace.closeResearch();
  workspace.openWatchlistAnnual(watchlist.memberships[0]!);
  expect(workspace.annual.getSnapshot().response).toBeNull();
  expectDraftsAndReads(journey, 5);
  const pendingRetire = workspace.annual.load();
  workspace.sessionOwner.retire("Invented cash trend session ended");
  expect(annual.mock.calls[5]![1].aborted).toBe(true);
  retired.finish(replacement);
  await pendingRetire;
  expect(workspace.annual.getSnapshot()).toMatchObject({
    response: null,
    selection: null,
  });
  for (const coordinator of [
    workspace.coordinator,
    workspace.followups.coordinator,
  ])
    expect(coordinator.getSnapshot()).toMatchObject({
      phase: "retired",
      draft: null,
    });
  expect(annual).toHaveBeenCalledTimes(6);
  expect(journey.fixture.getSnapshot()).toMatchObject({
    annual: 0,
    eod: 0,
    filings: 0,
    save: 0,
    signOut: 0,
  });
  expect(journey.fixture.followups!.getSnapshot()).toMatchObject({
    save: 0,
    commits: 0,
  });
}

describe("reported cash trend in the real managed workspace", () => {
  it("keeps exact table/plots and two dirty drafts through explicit loads, retained failure, Cancel/late, replacement and retirement", async () => {
    const journey = await setupJourney();
    try {
      const initial = await loadFirst(journey);
      await retainAndCancel(journey, initial);
      await acceptReplacement(journey, initial.contentKey);
      await leaveAndRetire(journey);
    } finally {
      journey.workspace.sessionOwner.retire("Invented test cleanup");
    }
  });
});
