import { describe, expect, it, vi } from "vitest";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import {
  archivedPreparedAt,
  archivedRevisitNote,
  currentRevisitNote,
  reportRevisitDocument,
  revisitAssessment,
} from "../../android-tests/managed-workspace/report-revisit-fixture";
import { ManagedWorkspace } from "./managed-workspace";
import {
  captureCompanyReportRevisit,
  type CompanyReportRevisitProps,
} from "./company-report-revisit-capture";
import { CompanyReportRevisit } from "./company-report-revisit";

async function unopenedSourceFixture() {
  const fixture = await createFixture("report-revisit");
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
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  const original = workspace.coordinator.getSnapshot().draft!;
  workspace.openWatchlistAnnual(original.memberships[0]!);
  const selection = workspace.getSnapshot().research!.selection;
  const props: CompanyReportRevisitProps = {
    selection,
    price: workspace.eod,
    annual: workspace.annual,
    filings: workspace.filings,
    valuation: workspace.valuation,
    readWatchlist: (selected) => workspace.getResearchWatchlist(selected),
    target: () =>
      workspace.captureCompanyReportRevisitTarget(selection, () => true),
  };
  const controller = new CompanyReportRevisit({
    selection,
    active: () => props.target()?.isCurrent() === true,
    capture: () => captureCompanyReportRevisit(props),
    now: () => new Date("2026-10-23T18:00:00.000Z"),
  });
  const document = await reportRevisitDocument(
    await createFixture("company-snapshot"),
  );
  const bytes = new TextEncoder().encode(document.text).buffer;
  const file = {
    size: bytes.byteLength,
    arrayBuffer: vi.fn().mockResolvedValue(bytes),
  };
  const stop = () => {
    controller.dispose();
    workspace.sessionOwner.dispose();
  };
  return {
    fixture,
    workspace,
    original,
    props,
    controller,
    document,
    bytes,
    file,
    stop,
  };
}
type IntegrationFixture = Awaited<ReturnType<typeof unopenedSourceFixture>>;
function expectNoResearchRequests(f: IntegrationFixture) {
  expect(f.fixture.getSnapshot()).toMatchObject({
    load: 1,
    save: 0,
    resolve: 0,
    marketsResolve: 1,
    marketsEod: 0,
    annual: 0,
    eod: 0,
    filings: 0,
    token: 0,
    signOut: 0,
  });
  expect(f.workspace.annual.getSnapshot()).toMatchObject({
    response: null,
    view: null,
    running: false,
  });
  expect(f.workspace.eod.getSnapshot().response).toBeNull();
  expect(f.workspace.filings.getSnapshot().response).toBeNull();
  expect(f.workspace.coordinator.getSnapshot().draft).toBe(f.original);
}
function expectArchiveReview(f: IntegrationFixture) {
  const state = f.controller.getSnapshot();
  expect(state.phase).toBe("review");
  expect(state.archive).toMatchObject({
    kind: "company_report_archive",
    preparedAt: archivedPreparedAt,
    listing: f.props.selection.listing,
    selectionCik: null,
    note: archivedRevisitNote,
    byteLength: f.document.byteLength,
  });
  expect(
    state.archive!.sources.find((source) => source.source === "annual")!.fields,
  ).toContainEqual({ label: "Completed", value: "2026-09-20T00:00:02.000Z" });
  expect(
    state.archive!.sources.find((source) => source.source === "annual")!.fields,
  ).toContainEqual({ label: "Source CIK", value: "0000000001" });
  expect(state.current).toBeNull();
  expect(state.preview).toBeNull();
}

describe("report revisit actual workspace with unloaded current sources", () => {
  it("admits the large real archived format5 file with a current null-report capture and no implicit research read", async () => {
    const f = await unopenedSourceFixture();
    try {
      expect(f.document.byteLength).toBeGreaterThan(266_240);
      expect(f.document.byteLength).toBeLessThan(2_850_816);
      expectNoResearchRequests(f);
      const capture = captureCompanyReportRevisit(f.props)!;
      expect(capture).not.toBeNull();
      expect(capture.report).toBeNull();
      expect(capture.isCurrent()).toBe(true);
      expect(capture.reason).toContain("Load at least one company source");
      await f.controller.readFile(f.file);
      expect(f.file.arrayBuffer).toHaveBeenCalledOnce();
      expectArchiveReview(f);
      expectNoResearchRequests(f);
    } finally {
      f.stop();
    }
  });
  it("retains the archive across synchronous reconcile notifications, then needs explicit source load and capture before a separate Save", async () => {
    const f = await unopenedSourceFixture();
    const phases: string[] = [];
    const unsubscribe = f.controller.subscribe(() => {
      phases.push(f.controller.getSnapshot().phase);
      f.controller.reconcile();
    });
    const annualUnsubscribe = f.workspace.annual.subscribe(() =>
      f.controller.reconcile(),
    );
    try {
      await f.controller.readFile(f.file);
      expect(phases).toEqual(["idle", "reading", "review"]);
      expectArchiveReview(f);
      expectNoResearchRequests(f);
      const archive = f.controller.getSnapshot().archive;
      f.controller.captureCurrent();
      expect(f.controller.getSnapshot().current).toBeNull();
      expect(f.controller.getSnapshot().message).toContain(
        "Load at least one company source",
      );
      await f.workspace.annual.load();
      expect(f.controller.getSnapshot().archive).toBe(archive);
      f.controller.captureCurrent();
      expect(f.controller.getSnapshot().current?.note).toBe(currentRevisitNote);
      expect(f.controller.getSnapshot().archive?.note).toBe(
        archivedRevisitNote,
      );
      f.controller.setAssessment(revisitAssessment);
      f.controller.prepareNote();
      const candidate = f.controller.getSnapshot().preview!.note;
      expect(candidate).toContain(revisitAssessment);
      expect(f.controller.append()).toBe(true);
      expect(f.controller.append()).toBe(false);
      expect(f.fixture.getSnapshot().save).toBe(0);
      expect(f.workspace.coordinator.getSnapshot().draft!.memberships).toEqual([
        { ...f.original.memberships[0]!, note: candidate },
        f.original.memberships[1],
      ]);
      await f.workspace.coordinator.save();
      expect(f.fixture.getSnapshot()).toMatchObject({
        save: 1,
        annual: 1,
        resolve: 0,
        marketsResolve: 1,
        marketsEod: 0,
        eod: 0,
        filings: 0,
      });
    } finally {
      unsubscribe();
      annualUnsubscribe();
      f.stop();
    }
  });
  it.each(["source", "draft-restored"] as const)(
    "refuses late file completion after an actual %s replacement",
    async (boundary) => {
      const f = await unopenedSourceFixture();
      try {
        let resolve!: (bytes: ArrayBuffer) => void;
        const pending = new Promise<ArrayBuffer>((complete) => {
          resolve = complete;
        });
        const reading = f.controller.readFile({
          size: f.bytes.byteLength,
          arrayBuffer: () => pending,
        });
        if (boundary === "source") await f.workspace.annual.load();
        else {
          const other = f.original.memberships[1]!;
          f.workspace.note(other.listingId, "Intervening note");
          f.workspace.note(other.listingId, other.note);
        }
        resolve(f.bytes);
        await reading;
        expect(f.controller.getSnapshot().archive).toBeNull();
        expect(f.controller.getSnapshot().current).toBeNull();
        expect(f.controller.getSnapshot().phase).toBe("idle");
        expect(f.fixture.getSnapshot().save).toBe(0);
        expect(f.workspace.coordinator.getSnapshot().draft).toEqual(f.original);
      } finally {
        f.stop();
      }
    },
  );
});
