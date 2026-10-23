import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import {
  archivedPreparedAt,
  archivedRevisitNote,
  reportRevisitDocument,
} from "../../android-tests/managed-workspace/report-revisit-fixture";
import {
  parseCompanyReportArchive,
  type CompanyReportArchive,
} from "./managed-company-report-archive";
import { CompanyReportRevisitSnapshotView } from "./CompanyReportRevisitSnapshot";
import { reopenedReport } from "./CompanyReportRevisitPanels";
import type { CompanyReportRevisitControls } from "./use-company-report-revisit";

async function admittedFixtureArchive() {
  const document = await reportRevisitDocument(
    await createFixture("company-snapshot"),
  );
  const archive = await parseCompanyReportArchive(
    document.text,
    new AbortController().signal,
  );
  expect(archive).not.toBeNull();
  return archive!;
}

function archivedControls(archive: CompanyReportArchive) {
  return {
    controller: null,
    state: {
      phase: "review",
      archive,
      current: null,
      assessment: "",
      preview: null,
      message: "",
    },
    act: () => {},
  } satisfies CompanyReportRevisitControls;
}

function renderedReopenedReport(archive: CompanyReportArchive) {
  const focus = {
    input: createRef<HTMLInputElement>(),
    heading: createRef<HTMLHeadingElement>(),
  };
  return load(
    renderToStaticMarkup(
      reopenedReport(archivedControls(archive), focus, null, false),
    ),
  );
}

const nativeIdentityValues = [
  "US",
  "XNAS",
  "common_stock",
  "issuer-zero",
  "Zero Company",
  "listing-zero",
  "security-zero",
  "Zero Class A",
  "class-zero",
  "Class A",
  "ZERO",
  "0000000001",
];

// Real fixture generation, archive admission and SSR presentation; no controller,
// browser layout, chooser delivery or Android scheduling is simulated here.
describe("actual admitted company report snapshot presentation", () => {
  it("satisfies every native post-open predicate part with no current capture", async () => {
    const archive = await admittedFixtureArchive();
    const $ = renderedReopenedReport(archive);
    const section = $('[aria-label="Archived report"]');
    const text = section.text();
    const parts = {
      heading:
        $("#managed-report-revisit-heading").text() ===
        "Reopened report · ZERO",
      wholeNote:
        section.find(".managed-company-report-note").text() ===
        archivedRevisitNote,
      preparedAt: text.includes("2026-10-15T00:00:00.000Z"),
      sourceCompletedAt: text.includes("2026-09-20T00:00:02.000Z"),
      currentCaptureAbsent:
        $('[aria-label="Current report capture"]').length === 0,
    };
    expect(parts).toEqual({
      heading: true,
      wholeNote: true,
      preparedAt: true,
      sourceCompletedAt: true,
      currentCaptureAbsent: true,
    });
    for (const value of nativeIdentityValues)
      expect(text.includes(value), `native identity value ${value}`).toBe(true);
    expect(nativeIdentityValues).toHaveLength(12);
    expect(section).toHaveLength(1);
    expect($("textarea[readonly]").text()).toBe(archive.unverifiedAppendix);
  });

  it("keeps the null visit CIK distinct from the admitted raw source CIK and original clocks", async () => {
    const archive = await admittedFixtureArchive();
    const $ = load(
      renderToStaticMarkup(
        <CompanyReportRevisitSnapshotView
          snapshot={archive}
          title="Archived report"
        />,
      ),
    );
    expect(archive.selectionCik).toBeNull();
    expect(archive.note).toBe(archivedRevisitNote);
    expect(archive.preparedAt).toBe(archivedPreparedAt);
    const visitCik = $("dt").filter((_, node) => $(node).text() === "CIK");
    expect(visitCik.next("dd").text()).toBe("Not supplied");
    const annual = $('[aria-label="Archived report annual provenance"]');
    const sourceCik = annual
      .find("dt")
      .filter((_, node) => $(node).text() === "Source CIK");
    expect(sourceCik.next("dd").text()).toBe("0000000001");
    expect(annual.text()).toContain("2026-09-20T00:00:02.000Z");
    expect(annual.text()).toContain("Loaded in this capture.");
    expect($.root().find("script,iframe")).toHaveLength(0);
  });
});
