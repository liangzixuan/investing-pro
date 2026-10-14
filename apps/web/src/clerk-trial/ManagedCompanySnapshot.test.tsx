import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  ManagedCompanySnapshot,
  CompanySnapshotView,
} from "./ManagedCompanySnapshot";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedAnnualReport } from "./managed-annual-report";
import { eodSelection, eodResponse } from "./eod-history-fixture";
import {
  response,
  row,
} from "../features/research/sec-annual-evidence-fixture";
import {
  cashGeneration,
  cashRow,
} from "../features/research/sec-annual-cash-fixture";
import {
  liquidity,
  liquidityRow,
} from "../features/research/sec-annual-liquidity-fixture";
import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import { TrialApiError } from "./api";

async function fixture(packet?: PersonalSecAnnualEvidenceResponseDto) {
  const readPrice = vi.fn().mockResolvedValue(eodResponse());
  const readAnnual = vi.fn().mockResolvedValue(packet ?? (await response()));
  const price = new ManagedEodHistory(readPrice, vi.fn(), undefined, [
    eodSelection.listing,
  ]);
  const annual = new ManagedAnnualReport(readAnnual, vi.fn());
  price.open(eodSelection);
  annual.open(eodSelection);
  const onSection = vi.fn();
  const evidence = () =>
    companySnapshotEvidence(
      eodSelection,
      price.getSnapshot(),
      annual.getSnapshot(),
    );
  const html = () =>
    renderToStaticMarkup(
      <ManagedCompanySnapshot
        selection={eodSelection}
        price={price}
        annual={annual}
        onSection={onSection}
      />,
    );
  return { price, annual, readPrice, readAnnual, html, evidence, onSection };
}

describe("loaded company snapshot", () => {
  it("starts closed with two independent empty states and makes no read or navigation", async () => {
    const f = await fixture();
    expect(f.html()).toContain("No close history loaded");
    expect(f.html()).toContain("No annual evidence loaded");
    expect(f.html()).not.toContain("<details open");
    expect(f.readPrice).not.toHaveBeenCalled();
    expect(f.readAnnual).not.toHaveBeenCalled();
    expect(f.onSection).not.toHaveBeenCalled();
  });

  it("keeps the exact raw close, trading date and request dates when only Price is loaded", async () => {
    const f = await fixture();
    await f.price.load();
    const html = f.html();
    for (const text of [
      "101.5",
      "2026-09-19",
      "Tiingo",
      "2026-08-20",
      "2026-09-20T00:00:00.000Z",
      "2026-09-20T00:00:01.000Z",
      "unadjusted",
      "not a live quote",
      "No annual evidence loaded",
    ])
      expect(html).toContain(text);
    expect(f.readPrice).toHaveBeenCalledTimes(1);
    expect(f.readAnnual).not.toHaveBeenCalled();
  });

  it("shows every revenue basis without choosing a winner or substituting missing cash", async () => {
    const packet = await response([
      row(),
      row("SalesRevenueNet", "900"),
      row("NetIncomeLoss", "100"),
    ]);
    const f = await fixture(packet);
    await f.annual.load();
    const html = f.html();
    for (const text of [
      "Snapshot revenue basis Revenues",
      "Snapshot revenue basis SalesRevenueNet",
      "Snapshot revenue basis RevenueFromContractWithCustomerExcludingAssessedTax",
      "1000",
      "900",
      "10%",
      "11.11%",
      "Revenue and income are missing from this report&#x27;s loaded evidence.",
      "2025-01-01",
      "2025-12-31",
      "2026-09-20T00:00:02.000Z",
      "No close history loaded",
    ])
      expect(html).toContain(text);
    expect(f.readAnnual).toHaveBeenCalledTimes(1);
    expect(f.readPrice).not.toHaveBeenCalled();
  });

  it("keeps cash and liquidity independently available when income cannot form a pair", async () => {
    const base = await response([row()]);
    const packet = {
      ...base,
      evidence: {
        ...base.evidence,
        cashGeneration: await cashGeneration(base.evidence, [
          cashRow("operating_cash_flow", "250"),
          cashRow("ppe_purchases", "75"),
        ]),
        liquidity: await liquidity(base.evidence, [
          liquidityRow("current_assets", "800"),
          liquidityRow("current_liabilities", "400"),
        ]),
      },
    };
    const f = await fixture(packet);
    await f.annual.load();
    const html = f.html();
    for (const text of [
      "Revenue and income cannot form a valid annual pair.",
      "250",
      "175",
      "400",
      "2.00×",
      "At 2025-12-31",
      "Within current-use limits at this load.",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("Net margin</dt>");
  });

  it("retains historical income and independently flags historical cash and liquidity", async () => {
    const base = await response(undefined, "2027-09-20T00:00:00.000Z");
    const packet = {
      ...base,
      evidence: {
        ...base.evidence,
        cashGeneration: await cashGeneration(base.evidence, [
          cashRow("operating_cash_flow", "250"),
          cashRow("ppe_purchases", "75"),
        ]),
        liquidity: await liquidity(base.evidence, [
          liquidityRow("current_assets", "800"),
          liquidityRow("current_liabilities", "400"),
        ]),
      },
    };
    const f = await fixture(packet);
    await f.annual.load();
    const html = f.html();
    expect(html).toContain("Any valid reported amounts below are historical.");
    expect(html).toContain("Historical amount; outside current-use limits");
    expect(html).toContain("Historical value; outside current-use limits");
    expect(html).toContain("1000");
    expect(html).not.toContain("Within current-use limits at this load.");
  });

  it("keeps both accepted responses through a failed refresh and admits an explicit replacement", async () => {
    const f = await fixture();
    await f.price.load();
    await f.annual.load();
    f.readPrice.mockRejectedValueOnce(new TrialApiError("unavailable"));
    f.readAnnual.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.price.load();
    await f.annual.load();
    expect(f.html()).toContain("Showing previous close history.");
    expect(f.html()).toContain("Showing previous annual evidence.");
    expect(f.html()).toContain("101.5");
    f.readAnnual.mockResolvedValueOnce(
      await response([row("Revenues", "2000"), row("NetIncomeLoss", "500")]),
    );
    await f.annual.load();
    expect(f.html()).toContain("2000");
    expect(f.html()).not.toContain("Showing previous annual evidence.");
    expect(f.readPrice).toHaveBeenCalledTimes(2);
    expect(f.readAnnual).toHaveBeenCalledTimes(3);
  });

  it("hides accepted data when either model closes or retires", async () => {
    const f = await fixture();
    await f.price.load();
    await f.annual.load();
    f.price.close();
    expect(f.html()).toContain("No close history loaded");
    expect(f.html()).toContain("1000");
    f.annual.retire();
    expect(f.html()).toContain("No annual evidence loaded");
    expect(f.html()).not.toContain("1000");
  });

  it.each(["catalog", "listing", "shareClass", "issuer", "origin", "cik"])(
    "refuses a different %s selection without changing the models",
    async (field) => {
      const f = await fixture();
      await f.price.load();
      await f.annual.load();
      const selection = { ...eodSelection };
      if (field === "catalog")
        selection.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
      if (field === "listing")
        selection.listing = {
          ...selection.listing,
          listingId: "listing-other",
        };
      if (field === "shareClass")
        selection.listing = {
          ...selection.listing,
          shareClassId: "class-other",
        };
      if (field === "issuer")
        selection.listing = { ...selection.listing, issuerId: "issuer-other" };
      if (field === "origin") selection.origin = "watchlist";
      if (field === "cik") selection.cik = null;
      expect(
        companySnapshotEvidence(
          selection,
          f.price.getSnapshot(),
          f.annual.getSnapshot(),
        ),
      ).toEqual({ price: null, annual: null });
      expect(f.evidence().price?.response).not.toBeNull();
      expect(f.evidence().annual?.response).not.toBeNull();
    },
  );

  it("does not show a catalog-invalidated response", async () => {
    const f = await fixture();
    await f.price.load();
    await f.annual.load();
    expect(
      companySnapshotEvidence(
        eodSelection,
        { ...f.price.getSnapshot(), catalogChanged: true },
        { ...f.annual.getSnapshot(), catalogChanged: true },
      ),
    ).toEqual({ price: null, annual: null });
  });

  it("section actions only delegate explicit navigation", async () => {
    const f = await fixture();
    const node = CompanySnapshotView({
      evidence: f.evidence(),
      onSection: f.onSection,
    });
    function elements(
      n: React.ReactNode,
    ): React.ReactElement<Record<string, unknown>>[] {
      if (!React.isValidElement<Record<string, unknown>>(n)) return [];
      return [
        n,
        ...React.Children.toArray(n.props.children as React.ReactNode).flatMap(
          elements,
        ),
      ];
    }
    const buttons = elements(node).filter((n) => n.type === "button");
    expect(buttons).toHaveLength(2);
    for (const button of buttons) (button.props.onClick as () => void)();
    expect(f.onSection.mock.calls).toEqual([["eod"], ["annual"]]);
    expect(f.readAnnual).not.toHaveBeenCalled();
    expect(f.readPrice).not.toHaveBeenCalled();
  });
});
