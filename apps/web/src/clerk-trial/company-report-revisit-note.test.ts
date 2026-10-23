import { beforeAll, describe, expect, it } from "vitest";
import { eodSelection, eodResponse } from "./eod-history-fixture";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import {
  prepareCompanyReport,
  type PreparedCompanyReport,
} from "./managed-company-report";
import { formatCompanyReportDocument } from "./managed-company-report-document";
import {
  parseCompanyReportArchive,
  type CompanyReportArchive,
} from "./managed-company-report-archive";
import { prepareCompanyReportRevisitNote } from "./company-report-revisit-note";

const assessedAt = "2026-10-23T12:34:56.789Z";
const assessment =
  "I will review whether the original demand claim still holds.";
let current: PreparedCompanyReport;
let archive: CompanyReportArchive;
async function fixture() {
  const price = new ManagedEodHistory(
    () => Promise.resolve(eodResponse()),
    () => {},
    undefined,
    [eodSelection.listing],
  );
  const annual = new ManagedAnnualReport(
    () => Promise.reject(new Error("No source request")),
    () => {},
  );
  const filings = new ManagedCompanyFilings(
    () => Promise.reject(new Error("No source request")),
    () => {},
  );
  price.open(eodSelection);
  await price.load();
  const evidence = companySnapshotEvidence(
    eodSelection,
    price.getSnapshot(),
    annual.getSnapshot(),
    filings.getSnapshot(),
  );
  const result = prepareCompanyReport(
    eodSelection,
    evidence,
    {
      member: { ...eodSelection.listing, note: "Current authored note" },
      canEdit: true,
      canAdd: false,
      reason: null,
    },
    () => new Date("2026-10-23T12:00:00.000Z"),
  )!;
  const original = {
    ...result,
    preparedAt: "2026-10-01T01:02:03.000Z",
    note: "Archived claim",
  };
  const archived = await parseCompanyReportArchive(
    formatCompanyReportDocument(original)!.text,
    new AbortController().signal,
  );
  expect(archived).not.toBeNull();
  return { current: result, archive: archived! };
}
function proposal(
  overrides: Partial<
    Parameters<typeof prepareCompanyReportRevisitNote>[0]
  > = {},
) {
  return prepareCompanyReportRevisitNote({
    archive,
    current,
    assessment,
    assessedAt,
    ...overrides,
  });
}
beforeAll(async () => {
  ({ current, archive } = await fixture());
});

describe("company report revisit authored whole-note proposal", () => {
  it("keeps the complete current note and authored assessment with full report and assessment dates", () => {
    const result = proposal();
    expect(result.reason).toBeNull();
    const preview = result.preview!;
    expect(preview.note).toBe(`${current.note} ${preview.excerpt}`);
    expect(preview.excerpt).toContain(assessment);
    expect(preview.excerpt).toContain(assessedAt);
    expect(preview.excerpt).toContain(archive.preparedAt);
    expect(preview.excerpt).toContain(current.preparedAt);
    expect(preview.excerpt).toContain("ZERO XNAS");
    expect(preview.excerpt).toContain("2026-09-20T00:00:01.000Z");
    expect(preview.excerpt).toContain("2026-08-20 through 2026-09-20");
    expect(preview.excerpt).toContain("annual not loaded");
    expect(preview.excerpt).toContain("file is not authenticated");
    expect(preview.excerpt).toContain("unverified");
    expect(Object.isFrozen(preview)).toBe(true);
    expect(current.note).toBe("Current authored note");
    expect(archive.note).toBe("Archived claim");
    expect(Object.keys(preview)).toEqual(["note", "excerpt"]);
  });
  it("preserves an empty existing note but refuses an absent Watchlist note", () => {
    const empty = proposal({ current: { ...current, note: "" } });
    expect(empty.preview!.note).toBe(empty.preview!.excerpt);
    expect(proposal({ current: { ...current, note: null } }).reason).toContain(
      "Add this company",
    );
  });
  it("requires the exact parsed archive/company/nullable CIK and a live owned current source", () => {
    expect(proposal({ archive: { ...archive } }).preview).toBeNull();
    expect(
      proposal({
        current: { ...current, selection: { ...current.selection, cik: null } },
      }).preview,
    ).toBeNull();
    expect(
      proposal({
        current: {
          ...current,
          selection: {
            ...current.selection,
            listing: {
              ...current.selection.listing,
              issuerName: "Other issuer",
            },
          },
        },
      }).preview,
    ).toBeNull();
    expect(
      proposal({
        current: { ...current, kind: "other" as PreparedCompanyReport["kind"] },
      }).preview,
    ).toBeNull();
  });
  it.each([
    "",
    "   ",
    "two\nlines",
    "hidden\u200btext",
    "broken\ud800",
    "x".repeat(2_001),
  ])("refuses invalid or empty assessment %j without clipping", (value) => {
    expect(proposal({ assessment: value }).preview).toBeNull();
  });
  it.each([
    "two\nlines",
    "hidden\u200btext",
    "broken\ud800",
    "x".repeat(2_001),
  ])("preserves but refuses invalid current raw note %j", (note) => {
    expect(proposal({ current: { ...current, note } }).preview).toBeNull();
  });
  it("refuses the entire over-limit candidate while accepting the exact codepoint bound", () => {
    const excerpt = proposal({ current: { ...current, note: "" } }).preview!
      .excerpt;
    const fitting = "📈".repeat(2_000 - [...excerpt].length - 1);
    const accepted = proposal({
      current: { ...current, note: fitting },
    }).preview!;
    expect([...accepted.note]).toHaveLength(2_000);
    expect(accepted.note).toBe(`${fitting} ${excerpt}`);
    expect(
      proposal({ current: { ...current, note: `${fitting}x` } }).preview,
    ).toBeNull();
  });
  it("refuses duplicate suffix and invalid comparison time", () => {
    const prepared = proposal().preview!;
    expect(
      proposal({ current: { ...current, note: prepared.note } }).reason,
    ).toContain("already");
    expect(
      proposal({ assessedAt: "2026-02-30T00:00:00.000Z" }).preview,
    ).toBeNull();
  });
  it("leaves archived raw invalid notes separate from the valid destination note", async () => {
    const original = { ...current, note: "Archived raw\n<unverified> 📈  " };
    const value = (await parseCompanyReportArchive(
      formatCompanyReportDocument(original)!.text,
      new AbortController().signal,
    ))!;
    const prepared = proposal({ archive: value }).preview!;
    expect(prepared.note).not.toContain("<unverified>");
    expect(value.note).toBe(original.note);
  });
});
