import { parseManagedWatchlistCommand } from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import { createFixture } from "./fixture";
import {
  archivedRevisitNote,
  currentRevisitNote,
  archivedPreparedAt,
  reportRevisitDocument,
  revisitAssessment,
} from "./report-revisit-fixture";
import { parseCompanyReportArchive } from "../../src/clerk-trial/managed-company-report-archive";
import { prepareCompanyReportRevisitNote } from "../../src/clerk-trial/company-report-revisit-note";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import { prepareCompanyReport } from "../../src/clerk-trial/managed-company-report";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";

async function openedCurrentCompany() {
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
  const original = structuredClone(workspace.coordinator.getSnapshot().draft!);
  workspace.openWatchlistAnnual(
    workspace.coordinator.getSnapshot().draft!.memberships[0]!,
  );
  return { fixture, workspace, original };
}

async function current() {
  const { fixture, workspace, original } = await openedCurrentCompany();
  await workspace.annual.load();
  const selection = workspace.getSnapshot().research!.selection;
  const report = prepareCompanyReport(
    selection,
    companySnapshotEvidence(
      selection,
      workspace.eod.getSnapshot(),
      workspace.annual.getSnapshot(),
      workspace.filings.getSnapshot(),
    ),
    workspace.getResearchWatchlist(selection),
    () => new Date("2026-10-23T17:00:00.000Z"),
  )!;
  return { fixture, workspace, original, report };
}

async function comparisonCommand(f: Awaited<ReturnType<typeof current>>) {
  const document = await reportRevisitDocument(
    await createFixture("company-snapshot"),
  );
  const archive = (await parseCompanyReportArchive(
    document.text,
    new AbortController().signal,
  ))!;
  const proposal = prepareCompanyReportRevisitNote({
    archive,
    current: f.report,
    assessment: revisitAssessment,
    assessedAt: "2026-10-23T17:01:00.000Z",
  });
  expect(proposal.preview).not.toBeNull();
  const payload = {
    ...f.original,
    memberships: f.original.memberships.map((member, index) =>
      index === 0 ? { ...member, note: proposal.preview!.note } : member,
    ),
  };
  const command = {
    expectedVersion: 1,
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
    payload,
  };
  expect(f.fixture.getSnapshot()).toMatchObject({
    annual: 1,
    resolve: 0,
    eod: 0,
    filings: 0,
  });
  expect(parseManagedWatchlistCommand(command)).not.toBeNull();
  expect(
    proposal.preview!.note.startsWith(
      `${f.original.memberships[0]!.note} ZERO XNAS report revisit assessed `,
    ),
  ).toBe(true);
  expect(
    proposal.preview!.note.includes(
      `archived report prepared ${archivedPreparedAt}; current report prepared `,
    ),
  ).toBe(true);
  expect(
    proposal.preview!.note.includes(
      `Authored assessment: ${revisitAssessment}`,
    ),
  ).toBe(true);
  expect(
    proposal.preview!.note.endsWith(
      "The file is not authenticated; reopening renews no source dates. Imported calculations are unverified and were not used as current evidence.",
    ),
  ).toBe(true);
  expect(proposal.preview!.note.split("report revisit assessed ").length).toBe(
    2,
  );
  return command;
}

describe("isolated native report-revisit fixture", () => {
  it("keeps the exact saved company and draft with no source request until explicit Annual load", async () => {
    const f = await openedCurrentCompany();
    try {
      const { note, ...listing } = f.original.memberships[0]!;
      expect(note).toBe(currentRevisitNote);
      expect(f.workspace.getSnapshot().research).toMatchObject({
        section: "annual",
        selection: { listing, cik: null, origin: "watchlist" },
      });
      expect(f.workspace.annual.getSnapshot()).toMatchObject({
        response: null,
        view: null,
        running: false,
      });
      expect(f.fixture.getSnapshot()).toMatchObject({
        annual: 0,
        resolve: 0,
        marketsResolve: 1,
        marketsEod: 0,
        eod: 0,
        filings: 0,
        save: 0,
      });
      expect(f.workspace.coordinator.getSnapshot().draft).toEqual(f.original);
      await f.workspace.annual.load();
      expect(f.fixture.getSnapshot()).toMatchObject({
        annual: 1,
        resolve: 0,
        marketsResolve: 1,
        marketsEod: 0,
        eod: 0,
        filings: 0,
        save: 0,
      });
      expect(f.workspace.annual.getSnapshot().response).not.toBeNull();
      expect(f.workspace.getSnapshot().research!.selection.listing).toEqual(
        listing,
      );
      expect(f.workspace.coordinator.getSnapshot().draft).toEqual(f.original);
    } finally {
      f.workspace.sessionOwner.dispose();
    }
  });
  it("produces admitted format5 bytes above the old file ceiling while keeping the full note and original canonical provenance", async () => {
    const document = await reportRevisitDocument(
      await createFixture("company-snapshot"),
    );
    expect(document.byteLength).toBeGreaterThan(266_240);
    expect(document.byteLength).toBeLessThan(2_850_816);
    expect(document.byteLength).toBe(
      new TextEncoder().encode(document.text).byteLength,
    );
    const archive = await parseCompanyReportArchive(
      document.text,
      new AbortController().signal,
    );
    expect(archive).toMatchObject({
      note: archivedRevisitNote,
      preparedAt: archivedPreparedAt,
      listing: { symbol: "ZERO", listingId: "listing-zero" },
      selectionCik: null,
    });
    expect(
      archive?.sources.find((source) => source.source === "annual"),
    ).toMatchObject({
      status: "loaded",
      retainedPrevious: false,
      lastAttemptFailed: false,
    });
    expect(archive?.unverifiedAppendix).toContain(
      '"opaqueInventedPadding":"' + "x".repeat(300_000),
    );
    expect(
      (
        JSON.parse(document.text) as {
          sources: {
            annual: {
              response: { evidence: { generation: { completedAt: string } } };
            };
          };
        }
      ).sources.annual.response.evidence.generation.completedAt,
    ).toBe("2026-09-20T00:00:02.000Z");
  });
  it("saves the exact whole comparison note only once and reloads without changing identities, the other note or order", async () => {
    const f = await current();
    const command = await comparisonCommand(f);
    const payload = command.payload;
    const altered = {
      ...command,
      payload: {
        ...payload,
        memberships: payload.memberships.map((member, index) =>
          index === 1 ? { ...member, note: "Altered unrelated note" } : member,
        ),
      },
    };
    expect(() =>
      f.fixture.api.save(altered, new AbortController().signal),
    ).toThrow("another note");
    expect(f.fixture.getSnapshot()).toMatchObject({
      save: 0,
      annual: 1,
      eod: 0,
      filings: 0,
    });
    await expect(
      f.fixture.api.save(command, new AbortController().signal),
    ).resolves.toMatchObject({ version: 2, replayed: false, payload });
    expect(() =>
      f.fixture.api.save(command, new AbortController().signal),
    ).toThrow("Unexpected invented");
    await expect(
      f.fixture.api.load(new AbortController().signal),
    ).resolves.toEqual({ version: 2, payload });
    expect(payload.memberships.map((member) => member.listingId)).toEqual(
      f.original.memberships.map((member) => member.listingId),
    );
    expect(payload.memberships[1]).toEqual(f.original.memberships[1]);
    f.workspace.sessionOwner.dispose();
  });
});
