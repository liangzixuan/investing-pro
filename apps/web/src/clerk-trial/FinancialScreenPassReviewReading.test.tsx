import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
import { financialScreenRefinementFixture as fixture } from "./test-financial-screen-refinement-fixture";
import {
  annualComparisonResponse,
  annualComparisonCashRows,
} from "./test-canonical-annual-comparison-fixture";
import { FinancialScreenPassReviewReading } from "./FinancialScreenPassReviewReading";
import { TrialApiError } from "./api";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
const disclosure = vi.hoisted(() => ({ open: false }));
vi.mock("react", async (original) => {
  const react = await original<typeof React>();
  return {
    ...react,
    useState: (value: unknown) =>
      typeof value === "boolean"
        ? [disclosure.open, () => {}]
        : react.useState(value),
  };
});
afterEach(() => {
  disclosure.open = false;
  vi.useRealTimers();
});
it("distinguishes an in-flight cancelled request from the queued unattempted row", async () => {
  const f = await fixture();
  let resolve!: (value: PersonalSecAnnualCanonicalResponseDto) => void;
  f.read.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const token = f.screen.capturePassReview(
    f.screen.getSnapshot(),
    new Date().toISOString(),
  )!;
  const work = token.run();
  await vi.advanceTimersByTimeAsync(20000);
  token.cancel();
  await work;
  const after = f.screen.getSnapshot().run!;
  const $ = load(
    renderToStaticMarkup(
      <FinancialScreenPassReviewReading
        plan={token.plan}
        result={after}
        currentHandle={token.runHandle}
      />,
    ),
  );
  expect($("[data-pass-side=current]").eq(0).text()).toContain(
    "Cancelled after dispatch",
  );
  expect($("[data-pass-side=current]").eq(1).text()).toContain("Not attempted");
  expect($("[data-pass-side=current]").eq(1).text()).not.toContain("nonmatch");
  resolve(f.packets[0]);
  await vi.advanceTimersByTimeAsync(0);
  expect(f.screen.getSnapshot().run).toBe(after);
});
it.each([
  {
    threshold: "0.00",
    value: "-42.125",
    previous: "match",
    current: "nonmatch",
  },
  {
    threshold: "2000",
    value: "4000.001",
    previous: "nonmatch",
    current: "match",
  },
])(
  "renders complete changed periods/raw packets for $previous → $current without claiming a like-for-like delta",
  async (example) => {
    const f = await fixture();
    const changed = await annualComparisonResponse("left", {
      cashRows: annualComparisonCashRows("left").map((row) => ({
        ...row,
        startDate: "2025-01-02",
        durationDays: 364,
        value: row.metric === "operating_cash_flow" ? example.value : row.value,
      })),
    });
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
    const before = f.screen.getSnapshot().run!;
    f.read.mockResolvedValueOnce(changed);
    const token = f.screen.capturePassReview(
      f.screen.getSnapshot(),
      new Date().toISOString(),
    )!;
    const work = token.run();
    await vi.runAllTimersAsync();
    const after = (await work)!.run!;
    expect(before.rows[0]!.evaluation!.match).toBe(example.previous);
    expect(after.rows[0]!.evaluation!.match).toBe(example.current);
    expect(after.rows[0]!.report!.response).toEqual(changed);
    const render = () =>
      load(
        renderToStaticMarkup(
          <FinancialScreenPassReviewReading
            plan={token.plan}
            result={after}
            currentHandle={token.runHandle}
          />,
        ),
      );
    let $ = render();
    expect($("pre")).toHaveLength(0);
    expect($.root().text()).toContain("2025-01-01 to 2025-12-31");
    expect($.root().text()).toContain("2025-01-02 to 2025-12-31");
    expect($.root().text()).toContain(example.value);
    expect($.root().text()).toContain(
      "Different financial periods are not a like-for-like change",
    );
    disclosure.open = true;
    $ = render();
    for (const [side, run] of [
      ["previous", before],
      ["current", after],
    ] as const) {
      const rows = $('[data-pass-side="' + side + '"]');
      expect(rows).toHaveLength(2);
      rows.each((i, e) => {
        const serialized = JSON.parse($(e).find("pre").text()) as unknown;
        expect(serialized).toEqual(JSON.parse(JSON.stringify(run.rows[i])));
        expect($(e).find("[data-refinement-clause]")).toHaveLength(1);
        expect($(e).find("[data-refinement-field]")).toHaveLength(6);
      });
    }
    const all = $("details")
      .filter(
        (_, e) =>
          $(e).children("summary").text() ===
          "Complete previous pass, filters and continuation history",
      )
      .find("pre");
    expect(JSON.parse(all.text())).toEqual(JSON.parse(JSON.stringify(before)));
  },
);
it("renders a failed current read as unavailable without borrowing the complete previous packet", async () => {
  const f = await fixture();
  f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
  const token = f.screen.capturePassReview(
    f.screen.getSnapshot(),
    new Date().toISOString(),
  )!;
  const work = token.run();
  await vi.runAllTimersAsync();
  const after = (await work)!.run!;
  disclosure.open = true;
  const $ = load(
    renderToStaticMarkup(
      <FinancialScreenPassReviewReading
        plan={token.plan}
        result={after}
        currentHandle={token.runHandle}
      />,
    ),
  );
  const first = $("[data-pass-listing-id]").first(),
    current = first.find("[data-pass-side=current]");
  expect(first.find("[data-pass-side=previous]").text()).toContain(
    "Admitted evidence",
  );
  expect(current.text()).toContain("Current read: Unavailable");
  expect(current.text()).not.toContain("Current result: nonmatch");
  const raw = JSON.parse(current.find("pre").text()) as {
    report: { response: unknown };
  };
  expect(raw.report.response).toBeNull();
});
