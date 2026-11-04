import { afterEach, expect, it, vi } from "vitest";
import {
  inspectPortfolioValuationPrice,
  evaluatePortfolioValuationPrice,
} from "./portfolio-valuation-price";
import {
  createPortfolioValuationFixture,
  portfolioScenarioTime,
} from "./test-portfolio-valuation-fixture";
import { portfolioReviewReportInput } from "./portfolio-review-report-fixture";
import { preparePortfolioReviewReport } from "./portfolio-review-report";
const fixtures: Awaited<ReturnType<typeof createPortfolioValuationFixture>>[] =
  [];
async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(portfolioScenarioTime);
  const f = await createPortfolioValuationFixture();
  fixtures.push(f);
  return f;
}
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.useRealTimers();
});
it("keeps the chosen close and full original packet despite a newer bar and failed-refresh disclosure", async () => {
  const f = await setup();
  const report = preparePortfolioReviewReport({
    ...f.input,
    state: {
      ...f.input.state,
      rows: f.input.state.rows.map((row, i) =>
        i === 0
          ? {
              ...row,
              showingPrevious: true,
              message: "Refresh failed. Original packet retained.",
            }
          : row,
      ),
    },
  })!;
  expect(report).not.toBeNull();
  const row = report.sourceRows[0]!,
    price = inspectPortfolioValuationPrice(report, row);
  expect(price.reference).toMatchObject({
    date: "2026-11-02",
    rawCloseUsd: "120.5",
    showingPrevious: true,
  });
  expect(price.reference!.response).toBe(row.response);
  expect(row.message).toContain("Refresh failed");
  expect(price.reference!.response.rows.at(-1)!.close).toBe("130");
});
it("keeps missing selected date distinct from unloaded and unsupported without latest fallback", async () => {
  const f = await setup();
  const responses = f.input.state.rows.slice(0, 2).map((row) => row.response!);
  responses[1] = { ...responses[1]!, rows: responses[1]!.rows.slice(1) };
  const report = preparePortfolioReviewReport({
    ...portfolioReviewReportInput(f.input.ledger, "2026-11-02", responses),
    preparedAt: portfolioScenarioTime,
  })!;
  expect(report).not.toBeNull();
  expect(inspectPortfolioValuationPrice(report, report.sourceRows[1]!)).toEqual(
    { reference: null, reason: "selected_close_missing" },
  );
  expect(
    inspectPortfolioValuationPrice(report, report.sourceRows[2]!).reason,
  ).toBe("price_unsupported");
  const unloadedInput = {
    ...portfolioReviewReportInput(f.input.ledger, "2026-11-02", [
      responses[0]!,
    ]),
    preparedAt: portfolioScenarioTime,
  };
  const unloaded = preparePortfolioReviewReport({
    ...unloadedInput,
    state: {
      ...unloadedInput.state,
      rows: unloadedInput.state.rows.map((r, i) =>
        i === 1 ? { ...r, available: true } : r,
      ),
    },
  })!;
  expect(unloaded).not.toBeNull();
  expect(
    inspectPortfolioValuationPrice(unloaded, unloaded.sourceRows[1]!).reason,
  ).toBe("price_not_loaded");
  const result = f.model.evaluate(f.model.preview(f.model.getSnapshot())!)!
    .reading!.rows[1]!;
  const comparison = evaluatePortfolioValuationPrice(
    report,
    report.sourceRows[1]!,
    result.row.selection,
    result.calculation!,
  );
  expect(comparison.rows).toHaveLength(6);
  expect(
    comparison.rows
      .filter((r) => r.model === "dcf")
      .every(
        (r) =>
          r.result.status === "unavailable" &&
          r.result.reason === "selected_close_missing",
      ),
  ).toBe(true);
  expect(result.calculation!.dcfResult.status).toBe("available");
});
it.each(["0", "bad close", ""])(
  "refuses invalid selected close %j at report admission instead of using a newer bar",
  async (close) => {
    const f = await setup();
    const responses = f.input.state.rows
      .slice(0, 2)
      .map((row) => row.response!);
    responses[0] = {
      ...responses[0]!,
      rows: responses[0]!.rows.map((bar, i) =>
        i === 0 ? { ...bar, close } : bar,
      ),
    };
    const input = {
      ...f.input,
      state: {
        ...f.input.state,
        rows: f.input.state.rows.map((row, i) =>
          i === 0 ? { ...row, response: responses[0]! } : row,
        ),
      },
    };
    expect(preparePortfolioReviewReport(input)).toBeNull();
    const forged = { ...f.report, sourceRows: input.state.rows };
    expect(
      inspectPortfolioValuationPrice(forged, forged.sourceRows[0]!),
    ).toEqual({ reference: null, reason: "portfolio_report_unowned" });
  },
);
it("refuses equal-looking source rows and mismatched report, share class, catalog or CIK", async () => {
  const f = await setup(),
    r = f.model.evaluate(f.model.preview(f.model.getSnapshot())!)!.reading!
      .rows[0]!;
  expect(
    inspectPortfolioValuationPrice(f.report, { ...r.row.source }).reason,
  ).toBe("price_identity_mismatch");
  expect(
    inspectPortfolioValuationPrice({ ...f.report }, r.row.source).reason,
  ).toBe("portfolio_report_unowned");
  for (const selection of [
    { ...r.row.selection, cik: null },
    { ...r.row.selection, cik: "0000000099" },
    { ...r.row.selection, listing: f.report.sourceRows[1]!.holding.identity },
    {
      ...r.row.selection,
      catalogSnapshotSha256: `sha256:${"f".repeat(64)}` as const,
    },
  ])
    expect(
      evaluatePortfolioValuationPrice(
        f.report,
        r.row.source,
        selection,
        r.calculation!,
      ).reason,
    ).toBe("price_identity_mismatch");
});
