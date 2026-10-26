import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FollowupsReviewReportInput } from "./followups-review-report";
import { prepareFollowupsReviewReport } from "./followups-review-report";
import { FollowupsReviewReportSnapshot } from "./FollowupsReviewReportSnapshot";
import { followupsReviewReportFixture } from "./followups-review-report-fixture";

function render(input: FollowupsReviewReportInput) {
  const report = prepareFollowupsReviewReport(input)!;
  expect(report).not.toBeNull();
  return load(
    renderToStaticMarkup(<FollowupsReviewReportSnapshot report={report} />),
  );
}
function metadata(input: FollowupsReviewReportInput) {
  return [
    input.capturedAt,
    String(input.baseVersion),
    input.dirty ? "Yes" : "No",
    input.currentCatalogSnapshotSha256 ?? "Unavailable",
    String(input.draft.entries.length),
  ];
}
// Expected appendix uses the original input, not the capture or rendered output.
function appendix(input: FollowupsReviewReportInput) {
  return JSON.stringify({ kind: "followups_review", ...input }, null, 2);
}

describe("complete passive Follow-ups reading snapshot", () => {
  it("shows full mixed resource text and exact appendix independently of due/status filtering", () => {
    const input = followupsReviewReportFixture();
    const $ = render(input);
    expect($("h2").text()).toBe("Follow-ups review report");
    expect(
      $("article > dl > dd")
        .map((_, node) => $(node).text())
        .get(),
    ).toEqual(metadata(input));
    expect($("section.fact")).toHaveLength(3);
    expect(
      $("section.fact h3")
        .map((_, node) => $(node).text())
        .get(),
    ).toEqual([
      "1. Invented issuer 1 · INV1",
      "2. Invented issuer 2 · INV2",
      "3. Invented issuer 3 · INV3",
    ]);
    expect(
      $("section.fact p.note")
        .map((_, node) => $(node).text())
        .get(),
    ).toEqual([
      "Question 1: inspect stated capacity · Café 東京 📈",
      "No authored assessment.",
      "Question 2: inspect stated capacity · Café 東京 📈",
      "Authored assessment: compare the original dates.",
      "Question 3: inspect stated capacity · Café 東京 📈",
      "No authored assessment.",
    ]);
    expect(
      $("section.fact")
        .eq(1)
        .find("dd")
        .map((_, node) => $(node).text())
        .get(),
    ).toEqual([
      "00000000-0000-4000-8000-000000000002",
      `sha256:${"1".repeat(64)}`,
      "US",
      "XNAS",
      "common_stock",
      "invented-issuer-1",
      "Invented issuer 2",
      "invented-listing-1",
      "invented-security-1",
      "Invented security 2",
      "invented-class-1",
      "Class 2",
      "INV2",
      "completed",
      "2026-10-20",
      "2026-10-22",
    ]);
    expect($("pre")).toHaveLength(1);
    expect($("pre").text()).toBe(appendix(input));
    expect(JSON.parse($("pre").text())).toEqual({
      kind: "followups_review",
      ...input,
    });
    expect($("article").text()).toContain(
      "Save follow-ups remains a separate online action.",
    );
    expect($("article").text()).toContain("Due dates are planning dates");
  });
  it("keeps all20 entries in resource order with maximum Unicode questions, assessments and identity names", () => {
    const fixture = followupsReviewReportFixture(20);
    const input: FollowupsReviewReportInput = {
      ...fixture,
      draft: {
        ...fixture.draft,
        entries: fixture.draft.entries.map((entry, index) => ({
          ...entry,
          check: `${index + 1}:` + "📈".repeat(499 - String(index + 1).length),
          result: "東京".repeat(1000),
          listing: {
            ...entry.listing,
            issuerName: "é".repeat(512),
            securityName: "東".repeat(512),
            shareClassName: "京".repeat(512),
          },
        })),
      },
    };
    const $ = render(input);
    expect($("section.fact")).toHaveLength(20);
    $("section.fact").each((index, section) => {
      const entry = input.draft.entries[index]!;
      expect(
        $(section)
          .find("p.note")
          .map((_, node) => $(node).text())
          .get(),
      ).toEqual([entry.check, entry.result]);
      expect(
        $(section)
          .find("dd")
          .map((_, node) => $(node).text())
          .get(),
      ).toEqual([
        entry.id,
        entry.catalogSnapshotSha256,
        entry.listing.country,
        entry.listing.exchangeMic,
        entry.listing.instrumentType,
        entry.listing.issuerId,
        entry.listing.issuerName,
        entry.listing.listingId,
        entry.listing.securityId,
        entry.listing.securityName,
        entry.listing.shareClassId,
        entry.listing.shareClassName,
        entry.listing.symbol,
        entry.status,
        entry.dueOn,
        entry.completedOn ?? "Not completed",
      ]);
    });
    expect($("pre").text()).toBe(appendix(input));
  });
  it("renders hostile markup, URLs and supplementary Unicode only as complete inert text", () => {
    const fixture = followupsReviewReportFixture(1);
    const hostile =
      '</pre><script>alert("x")</script><img src="https://invalid.example/a" onerror="x"><a href="javascript:x">東京 & 📈</a>';
    const input = {
      ...fixture,
      draft: {
        ...fixture.draft,
        entries: [
          {
            ...fixture.draft.entries[0]!,
            check: hostile,
            result: hostile,
            listing: {
              ...fixture.draft.entries[0]!.listing,
              issuerName: hostile,
            },
          },
        ],
      },
    };
    const $ = render(input);
    expect(
      $("script,img,a,form,input,textarea,iframe,link,object,embed,svg,style"),
    ).toHaveLength(0);
    expect($("[href],[src],[onclick],[onerror],[style]")).toHaveLength(0);
    expect(
      $("section.fact p.note")
        .map((_, node) => $(node).text())
        .get(),
    ).toEqual([hostile, hostile]);
    expect($("pre").text()).toBe(appendix(input));
  });
  it("represents an empty draft and unavailable catalog with a complete empty appendix", () => {
    const input = {
      ...followupsReviewReportFixture(0),
      baseVersion: 0,
      dirty: false,
      currentCatalogSnapshotSha256: null,
    };
    const $ = render(input);
    expect($("section.fact")).toHaveLength(0);
    expect($("article").text()).toContain("No captured follow-ups.");
    expect(
      $("article > dl > dd")
        .map((_, node) => $(node).text())
        .get(),
    ).toEqual(["2026-10-26T03:04:05.678Z", "0", "No", "Unavailable", "0"]);
    expect($("pre").text()).toBe(appendix(input));
  });
  it("does not render an unowned report-shaped object", () => {
    expect(
      renderToStaticMarkup(
        <FollowupsReviewReportSnapshot
          report={{
            kind: "followups_review",
            ...followupsReviewReportFixture(),
          }}
        />,
      ),
    ).toBe("");
  });
});
