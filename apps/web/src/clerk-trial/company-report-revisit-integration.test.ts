import { describe, expect, it, vi } from "vitest";
import { parseManagedCatalogResolveResponse } from "@research-cockpit/contracts";
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
  workspace.setNavigationBlocked(true);
  await workspace.setCompanyRoute({
    kind: "company",
    listingId: selection.listing.listingId,
    section: "annual",
  });
  let routeActive = true;
  const props: CompanyReportRevisitProps = {
    interim: workspace.interim,
    selection,
    price: workspace.eod,
    annual: workspace.annual,
    filings: workspace.filings,
    valuation: workspace.valuation,
    readWatchlist: (selected) => workspace.getResearchWatchlist(selected),
    target: () =>
      workspace.captureCompanyReportRevisitTarget(selection, () => routeActive),
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
    setRouteActive: (active: boolean) => {
      routeActive = active;
    },
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
      expect(f.workspace.getSnapshot().companyRoute).toMatchObject({
        status: "open",
        listingId: f.props.selection.listing.listingId,
        section: "annual",
      });
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
  it.each(["source", "equal-source", "draft-restored"] as const)(
    "refuses late file completion after an actual %s replacement",
    async (boundary) => {
      const f = await unopenedSourceFixture();
      try {
        if (boundary === "equal-source") await f.workspace.annual.load();
        let resolve!: (bytes: ArrayBuffer) => void;
        const pending = new Promise<ArrayBuffer>((complete) => {
          resolve = complete;
        });
        const reading = f.controller.readFile({
          size: f.bytes.byteLength,
          arrayBuffer: () => pending,
        });
        if (boundary === "source") await f.workspace.annual.load();
        else if (boundary === "equal-source") {
          const response = f.workspace.annual.getSnapshot().response!;
          const read = vi
            .spyOn(f.fixture.api, "annualReport")
            .mockResolvedValueOnce(response);
          await f.workspace.annual.load();
          expect(f.workspace.annual.getSnapshot().response).toBe(response);
          read.mockRestore();
        } else {
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

async function differentCompanyRoute(f: IntegrationFixture) {
  const listing = f.fixture.marketsCohort[1];
  const request = {
    snapshotSha256: f.props.selection.catalogSnapshotSha256,
    listingIds: [listing.listingId],
  };
  const response = parseManagedCatalogResolveResponse(
    {
      snapshotSha256: request.snapshotSha256,
      results: [{ listingId: listing.listingId, listing }],
    },
    request,
  )!;
  expect(response).not.toBeNull();
  const resolve = vi
    .spyOn(f.fixture.api, "resolve")
    .mockResolvedValueOnce(response);
  try {
    await f.workspace.setCompanyRoute({
      kind: "company",
      listingId: listing.listingId,
      section: "annual",
    });
    expect(f.workspace.getSnapshot().companyRoute).toMatchObject({
      status: "open",
      listingId: listing.listingId,
    });
  } finally {
    resolve.mockRestore();
  }
}
function expectInactiveRead(f: IntegrationFixture) {
  expect(f.file.arrayBuffer).not.toHaveBeenCalled();
  expect(f.controller.getSnapshot()).toMatchObject({
    phase: "idle",
    archive: null,
    current: null,
    preview: null,
  });
  expect(f.workspace.coordinator.getSnapshot().draft).toBe(f.original);
  expect(f.fixture.getSnapshot()).toMatchObject({
    annual: 0,
    eod: 0,
    filings: 0,
    save: 0,
  });
}
const unavailableRouteCases = [
  {
    label: "invalid/cleared company route",
    change: (f: IntegrationFixture) => f.workspace.setCompanyRoute(null),
  },
  { label: "different open company route", change: differentCompanyRoute },
  {
    label: "inactive rendered route",
    change: (f: IntegrationFixture) => {
      f.setRouteActive(false);
      return Promise.resolve();
    },
  },
];
describe("report revisit real company route lifetime", () => {
  it("invalidates captured navigation revisions even when the exact open route and all owners stay equal", async () => {
    const f = await unopenedSourceFixture();
    try {
      const captured = captureCompanyReportRevisit(f.props)!;
      const visit = f.workspace.getSnapshot().research;
      const annual = f.workspace.annual.getSnapshot();
      expect(captured.isCurrent()).toBe(true);
      f.workspace.setNavigationBlocked(true);
      expect(f.workspace.getSnapshot().research).toBe(visit);
      expect(f.workspace.annual.getSnapshot()).toBe(annual);
      expect(f.workspace.getSnapshot().companyRoute?.status).toBe("open");
      expect(captured.isCurrent()).toBe(false);
      expect(captured.append("stale note", currentRevisitNote)).toBe(false);
      expect(captureCompanyReportRevisit(f.props)!.isCurrent()).toBe(true);
      await f.controller.readFile(f.file);
      expectArchiveReview(f);
      expectNoResearchRequests(f);
    } finally {
      f.stop();
    }
  });
  it.each(unavailableRouteCases)(
    "refuses $label without reading the file or writing",
    async ({ change }) => {
      const f = await unopenedSourceFixture();
      try {
        const captured = captureCompanyReportRevisit(f.props)!;
        expect(captured.isCurrent()).toBe(true);
        await change(f);
        expect(captured.isCurrent()).toBe(false);
        expect(captured.append("stale note", currentRevisitNote)).toBe(false);
        await f.controller.readFile(f.file);
        expectInactiveRead(f);
      } finally {
        f.stop();
      }
    },
  );
  it("refuses while a different company route is resolving", async () => {
    const f = await unopenedSourceFixture();
    let reject!: (reason: Error) => void;
    const held = new Promise<never>((_, fail) => {
      reject = fail;
    });
    const resolve = vi
      .spyOn(f.fixture.api, "resolve")
      .mockReturnValueOnce(held);
    let navigation: Promise<void> | undefined;
    try {
      const captured = captureCompanyReportRevisit(f.props)!;
      expect(captured.isCurrent()).toBe(true);
      navigation = f.workspace.setCompanyRoute({
        kind: "company",
        listingId: f.original.memberships[1]!.listingId,
        section: "annual",
      });
      expect(f.workspace.getSnapshot().companyRoute?.status).toBe("resolving");
      expect(captured.isCurrent()).toBe(false);
      await f.controller.readFile(f.file);
      expectInactiveRead(f);
    } finally {
      reject(new Error("Invented pending route ended"));
      await navigation;
      resolve.mockRestore();
      f.stop();
    }
  });
  it("does not revive a captured target after navigation away and back to the equal company and draft", async () => {
    const f = await unopenedSourceFixture();
    try {
      const captured = captureCompanyReportRevisit(f.props)!;
      const selected = f.props.selection;
      expect(captured.isCurrent()).toBe(true);
      await f.workspace.setCompanyRoute(null);
      f.workspace.openWatchlistAnnual(f.original.memberships[0]!);
      f.workspace.setNavigationBlocked(true);
      await f.workspace.setCompanyRoute({
        kind: "company",
        listingId: selected.listing.listingId,
        section: "annual",
      });
      expect(f.workspace.getSnapshot().research!.selection.listing).toEqual(
        selected.listing,
      );
      expect(f.workspace.getSnapshot().research!.selection).not.toBe(selected);
      expect(f.workspace.annual.getSnapshot().response).toBeNull();
      expect(captured.isCurrent()).toBe(false);
      expect(captured.append("stale note", currentRevisitNote)).toBe(false);
      await f.controller.readFile(f.file);
      expectInactiveRead(f);
    } finally {
      f.stop();
    }
  });
});
