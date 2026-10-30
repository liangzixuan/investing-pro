import { describe, expect, it } from "vitest";
import type { PersonalPortfolioIdentity } from "@research-cockpit/contracts";
import { comparePortfolioReports } from "./portfolio-report-comparison";
import { parsePortfolioReportArchive } from "./portfolio-report-archive";
import {
  archiveBytes,
  archiveHtmlFixture,
} from "./portfolio-report-archive-fixture";
import { preparePortfolioReviewReport } from "./portfolio-review-report";
import {
  portfolioReviewReportFixture,
  portfolioReviewReportInput,
} from "./portfolio-review-report-fixture";
import { eodResponse, eodSelection } from "./eod-history-fixture";

const identity = (
  suffix: string,
  symbol = suffix.toUpperCase(),
): PersonalPortfolioIdentity => ({
  ...eodSelection.listing,
  listingId: `listing-${suffix}`,
  securityId: `security-${suffix}`,
  shareClassId: `class-${suffix}`,
  shareClassName: `Class ${suffix}`,
  symbol,
});
function capture(
  identities: PersonalPortfolioIdentity[],
  options: {
    cash?: string | null;
    shares?: string;
    date?: string;
    count?: number;
    preparedAt?: string;
    snapshot?: `sha256:${string}`;
  } = {},
) {
  const base = portfolioReviewReportFixture().ledger;
  const snapshot = options.snapshot ?? eodSelection.catalogSnapshotSha256;
  const ledger = {
    ...base,
    snapshotSha256: snapshot,
    identities,
    opening: {
      ...base.opening,
      cashUsd: options.cash === undefined ? "10.00" : options.cash,
      holdings: identities.map((member) => ({
        ...base.opening.holdings[0]!,
        listingId: member.listingId,
        shares: options.shares ?? "2",
      })),
    },
  };
  const responses = identities
    .slice(0, options.count ?? identities.length)
    .map((member) => ({
      ...eodResponse(),
      catalogSnapshotSha256: snapshot,
      security: member,
    }));
  const input = portfolioReviewReportInput(
    ledger,
    options.date ?? "2026-09-19",
    responses,
  );
  input.preparedAt = options.preparedAt ?? input.preparedAt;
  const report = preparePortfolioReviewReport(input);
  if (!report) throw new Error("Invalid invented comparison capture");
  return report;
}
const archive = (report: ReturnType<typeof capture>) =>
  parsePortfolioReportArchive(archiveBytes(archiveHtmlFixture(report)));

describe("complete exact-identity Portfolio comparison", () => {
  it("keeps the full union and distinct share classes in stable saved-first order", () => {
    const a = identity("a"),
      b = identity("b"),
      c = identity("c"),
      d = identity("d");
    const saved = archive(capture([a, b, c]));
    const current = capture([d, c, a]);
    const result = comparePortfolioReports(saved, current);
    expect(result.rows.map((row) => [row.listingId, row.status])).toEqual([
      [a.listingId, "both"],
      [b.listingId, "saved-only"],
      [c.listingId, "both"],
      [d.listingId, "current-only"],
    ]);
    expect(result.saved).toBe(saved);
    expect(result.current).toBe(current);
    expect(result.rows[1]!.current).toBeNull();
    expect(result.rows[3]!.saved).toBeNull();
    expect(result.rows[0]!.saved!.sourceRow).toBe(saved.sourceRows[0]);
    expect(result.rows[2]!.current!.sourceRow).toBe(current.sourceRows[1]);
    expect(Object.isFrozen(result.rows[0])).toBe(true);
    expect(result.rows.every((row) => row.conflictsWith.length === 0)).toBe(
      true,
    );
  });
  it.each([
    ["exchangeMic", "XNYS"],
    ["instrumentType", "adr"],
    ["issuerId", "other-issuer"],
    ["issuerName", "Other issuer name"],
    ["securityId", "other-security"],
    ["securityName", "Other security name"],
    ["shareClassId", "other-class"],
    ["shareClassName", "Other class name"],
    ["symbol", "OTHER"],
  ])("refuses to equate a shared listing when %s differs", (key, value) => {
    const member = identity("a");
    const changed = { ...member, [key]: value };
    const result = comparePortfolioReports(
      archive(capture([member])),
      capture([changed]),
    );
    expect(result.rows[0]!.status).toBe("identity-conflict");
    expect(result.rows[0]!.changedFields).toContain("identity");
  });
  it("keeps renamed listing IDs separate and marks ticker+MIC conflicts on both rows", () => {
    const member = identity("a"),
      renamed = { ...member, listingId: "listing-renamed" };
    const result = comparePortfolioReports(
      archive(capture([member])),
      capture([renamed]),
    );
    expect(result.rows.map((row) => [row.status, row.conflictsWith])).toEqual([
      ["identity-conflict", [renamed.listingId]],
      ["identity-conflict", [member.listingId]],
    ]);
    expect(result.rows[0]!.current).toBeNull();
    expect(result.rows[1]!.saved).toBeNull();
  });
  it("keeps same symbols on different MICs separate without ticker matching", () => {
    const member = identity("a"),
      other = { ...identity("b", member.symbol), exchangeMic: "XNYS" };
    expect(
      comparePortfolioReports(
        archive(capture([member])),
        capture([other]),
      ).rows.map((row) => row.status),
    ).toEqual(["saved-only", "current-only"]);
  });
  it("preserves missing values, unknown cash and incomplete totals without zero substitution", () => {
    const members = [identity("a"), identity("b")];
    const saved = archive(capture(members, { cash: null, count: 1 }));
    const current = capture(members, { cash: "0.00", shares: "3.000000" });
    const result = comparePortfolioReports(saved, current);
    expect(result.saved.review.cashUsd).toBeNull();
    expect(result.current.review.cashUsd).toBe("0.00");
    expect(result.saved.review.totalValueUsd).toBeNull();
    expect(result.rows[1]!.saved!.line).toMatchObject({
      status: "unavailable",
      reason: "close_not_loaded",
      close: null,
      valueUsd: null,
    });
    expect(result.rows[1]!.saved!.composition.percent).toBeNull();
    expect(result.rows[0]!.current!.line.shares).toBe(
      current.portfolio.holdings[0]!.shares,
    );
    expect(result.rows[0]!.changedFields).toContain("shares");
    expect(Object.keys(result)).toEqual([
      "saved",
      "current",
      "rows",
      "changedFields",
    ]);
  });
  it("retains clocks and date direction without inference; catalog change is reported separately", () => {
    const member = identity("a");
    const saved = archive(
      capture([member], {
        date: "2026-09-19",
        preparedAt: "2026-10-25T00:00:00.000Z",
      }),
    );
    const current = capture([member], {
      date: "2026-09-18",
      preparedAt: "2026-10-24T00:00:00.000Z",
      snapshot: `sha256:${"b".repeat(64)}`,
    });
    const result = comparePortfolioReports(saved, current);
    expect(result.rows[0]!.status).toBe("both");
    expect(result.changedFields).toEqual(
      expect.arrayContaining([
        "preparedAt",
        "selectedDate",
        "portfolio",
        "sourceRows",
      ]),
    );
    expect(result.rows[0]!.saved!.sourceRow.response!.completedAt).toBe(
      "2026-09-20T00:00:01.000Z",
    );
    expect(result.rows[0]!.current!.line.close).toBe("100.25");
    expect(result.rows[0]!.saved!.line.close).toBe("101.5");
  });
  it("reports an identical capture with no changed fields and rejects unowned or reversed roles", () => {
    const current = capture([identity("a")]),
      saved = archive(current);
    const result = comparePortfolioReports(saved, current);
    expect(result.changedFields).toEqual([]);
    expect(result.rows[0]!.changedFields).toEqual([]);
    expect(() => comparePortfolioReports(current, saved)).toThrow(TypeError);
    expect(() =>
      comparePortfolioReports(structuredClone(saved), current),
    ).toThrow(TypeError);
    expect(() =>
      comparePortfolioReports(saved, structuredClone(current)),
    ).toThrow(TypeError);
  });
});
