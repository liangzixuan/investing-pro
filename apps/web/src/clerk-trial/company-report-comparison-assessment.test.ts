import { beforeAll, describe, expect, it } from "vitest";
import { reportAnnualPacket } from "./managed-annual-statements-report-fixture";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { companyReportComparisonExcerpt } from "./company-report-comparison-excerpt";
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
  projectCurrentCompanyReport,
  type CompanyReportArchive,
} from "./managed-company-report-archive";
import { prepareCompanyReportComparisonAssessment } from "./company-report-comparison-assessment";

const assessedAt = "2026-10-23T12:34:56.789Z";
const assessment =
  "I will review whether the original demand claim still holds.";
let current: PreparedCompanyReport;
let archive: CompanyReportArchive;
async function fixture(withAnnual = false) {
  const annualPacket = withAnnual ? await reportAnnualPacket() : null;
  const price = new ManagedEodHistory(
    () => Promise.resolve(eodResponse()),
    () => {},
    undefined,
    [eodSelection.listing],
  );
  const annual = new ManagedAnnualReport(
    () =>
      annualPacket
        ? Promise.resolve(annualPacket)
        : Promise.reject(new Error("No source request")),
    () => {},
    undefined,
    { coverage: inventedManagedResearchCoverage },
  );
  const filings = new ManagedCompanyFilings(
    () => Promise.reject(new Error("No source request")),
    () => {},
  );
  price.open(eodSelection);
  await price.load();
  if (withAnnual) {
    annual.open(eodSelection);
    await annual.load();
  }
  const evidence = companySnapshotEvidence(
    eodSelection,
    price.getSnapshot(),
    annual.getSnapshot(),
    filings.getSnapshot(),
    null,
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
    Parameters<typeof prepareCompanyReportComparisonAssessment>[0]
  > = {},
) {
  return prepareCompanyReportComparisonAssessment({
    archive,
    current,
    assessment,
    assessedAt,
    currentResult: "Existing authored result",
    ...overrides,
  });
}
beforeAll(async () => {
  ({ current, archive } = await fixture());
});

describe("complete report comparison assessment proposal", () => {
  it("preserves raw authored text, complete dates, references and file caveats", () => {
    const raw = "  Cafe\u0301 <strong>私の確認</strong>  ";
    const authored = "  Demand is still unknown 📈  ";
    const value = proposal({
      currentResult: raw,
      assessment: authored,
    }).preview!;
    expect(value.result).toBe(`${raw} ${value.excerpt}`);
    for (const text of [
      authored,
      archive.preparedAt,
      current.preparedAt,
      assessedAt,
      "annual not loaded",
      "2026-08-20 through 2026-09-20",
      "file is not authenticated",
      "reopening renews no source dates",
      "Imported calculations are unverified",
      "Archived source references",
      "Current source dates and raw-close windows",
    ])
      expect(value.excerpt).toContain(text);
    expect(Object.isFrozen(value)).toBe(true);
    expect(current.note).toBe("Current authored note");
    expect(archive.note).toBe("Archived claim");
  });
  it("accepts an empty result without copying either report note", () => {
    const value = proposal({
      currentResult: "",
      current: { ...current, note: null },
    }).preview!;
    expect(value.result).toBe(value.excerpt);
    expect(value.result).not.toContain("Archived claim");
  });
  it.each(["two\nlines", "hidden\u200btext", "broken\ud800", "x".repeat(2001)])(
    "refuses invalid raw result or authored assessment %j",
    (value) => {
      expect(proposal({ currentResult: value }).preview).toBeNull();
      expect(proposal({ assessment: value }).preview).toBeNull();
    },
  );
  it.each(["", "   "])("requires authored assessment %j", (assessment) => {
    expect(proposal({ assessment }).reason).toContain("Write your assessment");
  });
  it("accepts exactly 2000 code points and refuses the complete overflow", () => {
    const excerpt = proposal({ currentResult: "" }).preview!.excerpt;
    const fitting = "📈".repeat(2000 - [...excerpt].length - 1);
    const accepted = proposal({ currentResult: fitting }).preview!;
    expect([...accepted.result]).toHaveLength(2000);
    expect(accepted.result).toBe(`${fitting} ${excerpt}`);
    expect(proposal({ currentResult: `${fitting}x` }).reason).toContain(
      "Nothing was clipped",
    );
  });
  it("does not use normalization to squeeze a raw over-limit candidate into the limit", () => {
    const excerpt = proposal({ currentResult: "" }).preview!.excerpt;
    const space = 2000 - [...excerpt].length - 1;
    const raw =
      "e\u0301".repeat(Math.floor(space / 2)) + "x".repeat((space % 2) + 1);
    expect(proposal({ currentResult: raw }).preview).toBeNull();
  });
  it("refuses duplicate comparisons even after later preview time or appended author text", () => {
    const first = proposal().preview!.result;
    expect(proposal({ currentResult: first }).reason).toContain("already");
    expect(
      proposal({
        currentResult: `${first} More authored context.`,
        assessedAt: "2026-10-24T00:00:00.000Z",
      }).reason,
    ).toContain("already");
  });
  it("refuses unadmitted archive, exact listing/CIK mismatch, invalid report and date", () => {
    expect(proposal({ archive: { ...archive } }).preview).toBeNull();
    expect(
      proposal({
        current: { ...current, selection: { ...current.selection, cik: null } },
      }).reason,
    ).toContain("exact company and CIK");
    expect(
      proposal({
        current: {
          ...current,
          selection: {
            ...current.selection,
            listing: {
              ...current.selection.listing,
              shareClassName: "Other class",
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
    expect(
      proposal({ assessedAt: "2026-02-30T00:00:00.000Z" }).preview,
    ).toBeNull();
  });
});

describe("complete comparison references", () => {
  it("keeps every archive and current URL while preserving the old note formatter", async () => {
    const pair = await fixture(true);
    const captured = projectCurrentCompanyReport(pair.current)!;
    const urls = captured.sources.flatMap((source) =>
      source.references.map((ref) => ref.url),
    );
    expect(urls.length).toBeGreaterThan(1);
    const value = prepareCompanyReportComparisonAssessment({
      ...pair,
      assessment,
      assessedAt,
      currentResult: "",
    }).preview!;
    expect(value).not.toBeNull();
    for (const url of urls) {
      expect(value.excerpt.split(" Current source references:")[0]).toContain(
        url,
      );
      expect(value.excerpt.split(" Current source references:")[1]).toContain(
        url,
      );
    }
    const old = companyReportComparisonExcerpt(
      { ...pair, assessment, assessedAt },
      captured,
    );
    expect(old).not.toContain("Archived source references");
    expect(old).toContain(urls[0]);
    expect(old).not.toContain(urls[1]);
  });
  it("retains unknown and retained-previous caveats in the shared pure formatter", async () => {
    const pair = await fixture(true);
    const captured = projectCurrentCompanyReport(pair.current)!;
    const sources = captured.sources.map((source) => ({
      ...source,
      retainedPrevious: source.status !== "not_loaded",
    }));
    const excerpt = companyReportComparisonExcerpt(
      { ...pair, assessment, assessedAt },
      { ...captured, sources },
      true,
    );
    expect(excerpt).toContain("retained previous, latest attempt unconfirmed");
    expect(excerpt).toContain("interim not loaded");
  });
});
