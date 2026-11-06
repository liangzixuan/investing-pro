import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { financialScreenRefinementFixture as fixture } from "./test-financial-screen-refinement-fixture";
import {
  annualComparisonCashRows,
  annualComparisonResponse,
} from "./test-canonical-annual-comparison-fixture";
import { FinancialScreenPassReviewController } from "./financial-screen-pass-review-controller";
import { prepareScreenPassReviewReport } from "./screen-pass-review-report";
import { ScreenPassReviewReportSnapshot } from "./ScreenPassReviewReportSnapshot";
import { OfflineResearchReading } from "./ManagedScreenResearchReading";
import { ManagedAnnualReportError } from "./managed-api";
import { TrialApiError } from "./api";
afterEach(() => vi.useRealTimers());
function controller(f: Awaited<ReturnType<typeof fixture>>) {
  return new FinancialScreenPassReviewController(f.screen, {
    captureOwner: () => ({ isCurrent: () => true }),
  });
}
function reading(
  f: Awaited<ReturnType<typeof fixture>>,
  c: FinancialScreenPassReviewController,
) {
  const report = prepareScreenPassReviewReport(
    c.getSnapshot(),
    f.digest,
    new Date().toISOString(),
  )!;
  expect(report).not.toBeNull();
  const $ = load(
    renderToStaticMarkup(
      <OfflineResearchReading value={true}>
        <ScreenPassReviewReportSnapshot report={report} />
      </OfflineResearchReading>,
    ),
  );
  expect(JSON.parse($("pre[data-screen-pass-report-payload]").text())).toEqual(
    report,
  );
  return { report, $ };
}
it.each([
  { threshold: "0", value: "-42.125", previous: "match", current: "nonmatch" },
  {
    threshold: "2000",
    value: "4000.001",
    previous: "nonmatch",
    current: "match",
  },
])(
  "exports differing periods and raw evidence for $previous to $current without changing evaluation clocks",
  async (example) => {
    const f = await fixture();
    const criteria = {
      clauses: [
        {
          field: "operatingCashFlow" as const,
          operator: "gte" as const,
          value: example.threshold,
        },
      ],
      sort: { field: "symbol" as const, direction: "asc" as const },
    };
    f.screen
      .captureRefinement(
        f.screen.getSnapshot(),
        criteria,
        new Date().toISOString(),
      )!
      .apply();
    const changed = await annualComparisonResponse("left", {
      cashRows: annualComparisonCashRows("left").map((row) => ({
        ...row,
        startDate: "2025-01-02",
        durationDays: 364,
        value: row.metric === "operating_cash_flow" ? example.value : row.value,
      })),
    });
    f.read.mockResolvedValueOnce(changed);
    const c = controller(f),
      preview = c.preview(c.getSnapshot())!,
      pending = c.run(preview);
    await vi.runAllTimersAsync();
    await pending;
    const { report, $ } = reading(f, c);
    expect(report.plan.sourceRun.rows[0]!.evaluation!.match).toBe(
      example.previous,
    );
    expect(report.current.rows[0]!.evaluation!.match).toBe(example.current);
    expect(report.current.rows[0]!.report!.response).toEqual(changed);
    expect(report.current.rows[0]!.evaluatedAt).toBe(
      c.getSnapshot().result!.rows[0]!.evaluatedAt,
    );
    expect($.root().text()).toContain("2025-01-01 to 2025-12-31");
    expect($.root().text()).toContain("2025-01-02 to 2025-12-31");
    expect($.root().text()).toContain(example.value);
    for (const [side, run] of [
      ["previous", report.plan.sourceRun],
      ["current", report.current],
    ] as const)
      $("[data-pass-side=" + side + "]").each((i, e) =>
        expect(JSON.parse($(e).find("pre").text())).toEqual(run.rows[i]),
      );
    c.retire();
  },
);
it("exports failed current evidence without filling it from the complete baseline", async () => {
  const f = await fixture("partial");
  f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
  const c = controller(f),
    preview = c.preview(c.getSnapshot())!,
    pending = c.run(preview);
  await vi.runAllTimersAsync();
  await pending;
  const { report, $ } = reading(f, c);
  expect(report.plan.sourceRun.rows[0]!.report!.response).not.toBeNull();
  expect(report.current.rows[0]!.report?.response).toBeNull();
  expect(report.current.rows[0]!.evaluation).toBeNull();
  expect($("[data-pass-side=current]").first().text()).toContain("Unavailable");
  expect(report.plan.sourceRun.rows[1]).toEqual(
    JSON.parse(JSON.stringify(preview.plan!.sourceRun.rows[1])),
  );
  c.retire();
});
it("keeps cancelled in-flight and never-attempted rows distinct, ignoring late response", async () => {
  const f = await fixture();
  let resolve!: (value: (typeof f.packets)[0]) => void;
  f.read.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const c = controller(f),
    preview = c.preview(c.getSnapshot())!,
    pending = c.run(preview);
  await vi.advanceTimersByTimeAsync(20000);
  c.cancel(c.getSnapshot());
  await pending;
  const { report, $ } = reading(f, c);
  expect(report.current.status).toBe("cancelled");
  expect($("[data-pass-side=current]").eq(0).text()).toContain(
    "Cancelled after dispatch",
  );
  expect($("[data-pass-side=current]").eq(1).text()).toContain("Not attempted");
  expect(report.current.rows[0]!.attempt!.status).toBe("cancelled");
  expect(report.current.rows[1]!.attempt).toBeUndefined();
  const state = c.getSnapshot();
  resolve(f.packets[0]);
  await vi.advanceTimersByTimeAsync(0);
  expect(c.getSnapshot()).toBe(state);
  c.retire();
});
it("retains previous refinement and complete missing-read attempt history without source-clock substitution", async () => {
  const f = await fixture("cancelled");
  const continuation = f.screen.captureContinuation(
    f.screen.getSnapshot(),
    new Date().toISOString(),
  )!;
  const work = continuation.run();
  await vi.runAllTimersAsync();
  await work;
  const criteria = {
    clauses: [
      {
        field: "operatingCashFlow" as const,
        operator: "gte" as const,
        value: "0.00",
      },
    ],
    sort: { field: "symbol" as const, direction: "asc" as const },
  };
  f.screen
    .captureRefinement(
      f.screen.getSnapshot(),
      criteria,
      new Date().toISOString(),
    )!
    .apply();
  const c = controller(f),
    preview = c.preview(c.getSnapshot())!,
    pending = c.run(preview);
  await vi.runAllTimersAsync();
  await pending;
  const { report } = reading(f, c);
  expect(report.plan.sourceRun.refinedAt).toBe(
    preview.plan!.sourceRun.refinedAt,
  );
  expect(report.plan.sourceRun.continuations).toEqual(
    JSON.parse(JSON.stringify(preview.plan!.sourceRun.continuations)),
  );
  expect(report.plan.sourceRun.continuations!.length).toBe(1);
  expect(report.current).toEqual(
    JSON.parse(JSON.stringify(c.getSnapshot().result)),
  );
  c.retire();
});
it("refuses malformed UTF16 and an oversized entire passive capture", async () => {
  const f = await fixture();
  const c = controller(f),
    preview = c.preview(c.getSnapshot())!,
    pending = c.run(preview);
  await vi.runAllTimersAsync();
  await pending;
  const state = c.getSnapshot(),
    run = state.result!;
  for (const message of ["\ud800", "a".repeat(8 * 1024 * 1024)]) {
    const changed = {
      ...state,
      result: {
        ...run,
        rows: run.rows.map((row, i) =>
          i === 0 ? { ...row, failure: message } : row,
        ),
      },
    };
    expect(
      prepareScreenPassReviewReport(
        changed,
        f.digest,
        new Date().toISOString(),
      ),
    ).toBeNull();
  }
  c.retire();
});

it("exports a stopped dispatched failure and all unattempted rows without calling them nonmatches", async () => {
  const f = await fixture();
  f.read.mockRejectedValueOnce(new ManagedAnnualReportError("not_configured"));
  const c = controller(f),
    preview = c.preview(c.getSnapshot())!,
    pending = c.run(preview);
  await vi.runAllTimersAsync();
  await pending;
  const { report, $ } = reading(f, c);
  expect(report.current.status).toBe("stopped");
  expect(report.current.rows[0]!.failure).toBe("not_configured");
  expect(report.current.rows[0]!.evaluation).toBeNull();
  expect(report.current.rows[1]!.attempt).toBeUndefined();
  expect($("[data-pass-side=current]").eq(0).text()).toContain("Unavailable");
  expect($("[data-pass-side=current]").eq(1).text()).toContain("Not attempted");
  c.retire();
});
