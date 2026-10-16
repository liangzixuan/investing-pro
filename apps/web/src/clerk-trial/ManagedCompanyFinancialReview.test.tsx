import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ManagedCompanyFinancialReview } from "./ManagedCompanyFinancialReview";
import { ManagedAnnualReport as AnnualPanel } from "./ManagedAnnualReport";
import { ManagedAnnualReport } from "./managed-annual-report";
import { financialReviewResponse } from "./financial-review-fixture";
import { eodSelection } from "./eod-history-fixture";
import type { ManagedFinancialReviewActions } from "./managed-financial-review";

const actions = (): ManagedFinancialReviewActions => ({
  prepare: vi.fn().mockReturnValue({ preview: null, reason: null }),
  isCurrent: vi.fn().mockReturnValue(false),
  append: vi.fn().mockReturnValue({ appended: false, message: "" }),
});

describe("Company Financial review rendering", () => {
  it("shows independent exact facts without income pairs and starts with no choices or preview", async () => {
    const response = await financialReviewResponse();
    const action = actions();
    const inspect = vi.fn();
    const html = renderToStaticMarkup(
      <ManagedCompanyFinancialReview
        response={response}
        actions={action}
        watchlist={{
          member: { ...eodSelection.listing, note: "My thesis" },
          canAdd: false,
          canEdit: true,
          reason: null,
        }}
        running={false}
        onInspect={inspect}
      />,
    );
    for (const amount of ["250.125", "120.125", "-80.125", ">0<", "-7.5"])
      expect(html).toContain(amount);
    for (const sign of ["positive", "zero", "negative"])
      expect(html).toContain(`Amount sign: ${sign}`);
    expect(html.match(/type="checkbox"/gu)).toHaveLength(5);
    expect(html).not.toContain("checked=");
    expect(html).not.toContain("<details open");
    expect(html).toContain("Select at least one fact to preview.");
    expect(html).toContain("Preview financial review</button>");
    expect(html).not.toContain("Complete note preview");
    expect(html.match(/>Inspect /gu)).toHaveLength(5);
    expect(inspect).not.toHaveBeenCalled();
    expect(action.prepare).not.toHaveBeenCalled();
    expect(action.append).not.toHaveBeenCalled();
  });

  it("keeps missing and historical facts readable while note editing is paused", async () => {
    const response = await financialReviewResponse({
      operatingIncome: null,
      cutoffAt: "2028-02-01T00:00:00.000Z",
    });
    const html = renderToStaticMarkup(
      <ManagedCompanyFinancialReview
        response={response}
        actions={actions()}
        watchlist={{
          member: null,
          canAdd: false,
          canEdit: false,
          reason: "Resolve the conflict in My Watchlist before editing.",
        }}
        running={false}
        onInspect={vi.fn()}
      />,
    );
    expect(html).toContain("Unavailable.");
    expect(html).toContain(
      "Historical value; outside current-use limits at this load.",
    );
    expect(html).toContain("-7.5");
    expect(html).toContain("<fieldset disabled=");
    expect(html).toContain(
      "Resolve the conflict in My Watchlist before editing.",
    );
  });

  it("mounts within the actual managed Annual panel only after an explicit load", async () => {
    const read = vi.fn().mockResolvedValue(await financialReviewResponse());
    const model = new ManagedAnnualReport(read, vi.fn());
    model.open(eodSelection);
    const panel = () =>
      renderToStaticMarkup(
        <AnnualPanel
          model={model}
          financialReviewActions={actions()}
          watchlist={{
            member: { ...eodSelection.listing, note: "" },
            canAdd: false,
            canEdit: true,
            reason: null,
          }}
        />,
      );
    expect(panel()).not.toContain("Five independent facts");
    expect(read).not.toHaveBeenCalled();
    await model.load();
    const html = panel();
    expect(html).toContain("Five independent facts");
    expect(html).toContain("Balance sheet totals");
    expect(html).toContain('data-annual-report-target="operating"');
    expect(html).toContain('data-annual-report-target="cash"');
    expect(html).toContain('data-annual-report-target="liquidity"');
    expect(html).toContain('data-annual-report-target="balanceSheet"');
    expect(read).toHaveBeenCalledOnce();
  });
});
