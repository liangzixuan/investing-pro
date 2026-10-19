import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ManagedAnnualReport as Panel } from "./ManagedAnnualReport";
import { ManagedAnnualReport } from "./managed-annual-report";
import type { ManagedAnnualStatementsReviewActions } from "./ManagedAnnualStatementsReview";
import type { ResearchWatchlistState } from "./managed-workspace";
import { annualReportPacket } from "./test-annual-report-fixture";
import { eodSelection } from "./eod-history-fixture";

const watchlist: ResearchWatchlistState = {
  revision: Symbol(),
  member: { ...eodSelection.listing, note: "Authored note." },
  canAdd: false,
  canEdit: true,
  reason: null,
};
function actions() {
  return {
    prepare: vi.fn<ManagedAnnualStatementsReviewActions["prepare"]>(),
    isCurrent: vi.fn<ManagedAnnualStatementsReviewActions["isCurrent"]>(),
    append: vi.fn<ManagedAnnualStatementsReviewActions["append"]>(),
  };
}
async function loaded() {
  const response = await annualReportPacket();
  const read = vi.fn(() => Promise.resolve(response));
  const model = new ManagedAnnualReport(read, vi.fn(), undefined, {
    coverage: inventedManagedResearchCoverage,
  });
  model.open({ ...eodSelection, origin: "watchlist", cik: null });
  await model.load();
  return { model, read, response };
}

describe("canonical Annual workspace panel connection", () => {
  it("renders statement reading and selected-cell review from the actual loaded model without an automatic action", async () => {
    const { model, read, response } = await loaded();
    const statementActions = actions();
    const state = model.getSnapshot();
    const html = renderToStaticMarkup(
      <Panel
        model={model}
        statementActions={statementActions}
        watchlist={watchlist}
      />,
    );
    expect(html).toContain(
      '<option value="balance_sheet">Balance sheet</option>',
    );
    expect(html).toContain('<option value="cash_flow">Cash flow</option>');
    expect(html).toContain("Review selected statement cells (0)");
    expect(html.indexOf("Standardized annual statements")).toBeLessThan(
      html.indexOf('class="sec-quarterly-comparison managed-annual-overview"'),
    );
    expect(html).toContain("9007199254740993.000000000000000001");
    expect(html).toContain("OperatingIncomeLoss");
    expect(html).toContain("StockholdersEquity");
    expect(html).toContain("NetCashProvidedByUsedInOperatingActivities");
    expect(state.view?.canonical).toBe(state.response?.evidence);
    expect(state.response).toBe(response);
    expect(model.getSnapshot()).toBe(state);
    expect(read).toHaveBeenCalledOnce();
    expect(statementActions.prepare).not.toHaveBeenCalled();
    expect(statementActions.append).not.toHaveBeenCalled();
    model.retire();
  });
  it("keeps reading and inspection while workspace editing is blocked", async () => {
    const { model, read } = await loaded();
    const html = renderToStaticMarkup(
      <Panel
        model={model}
        statementActions={actions()}
        watchlist={{
          ...watchlist,
          canEdit: false,
          reason: "Resolve the saved-version conflict before editing.",
        }}
      />,
    );
    expect(html).toContain(
      "Resolve the saved-version conflict before editing.",
    );
    expect(html).toContain(
      '<option value="balance_sheet">Balance sheet</option>',
    );
    expect(html).toContain("Inspect");
    const inputs = html.match(/<input[^>]*type="checkbox"[^>]*>/gu) ?? [];
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((input) => input.includes('disabled=""'))).toBe(true);
    expect(read).toHaveBeenCalledOnce();
    model.retire();
  });
});
