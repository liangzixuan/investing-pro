import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { parseAnnualComparisonFixture } from "./test-canonical-annual-comparison-fixture";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  ManagedCompanySnapshot,
  CompanySnapshotView,
  CompanySnapshotEvidenceView,
} from "./ManagedCompanySnapshot";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { filingsResponse } from "./sec-filings-fixture";
import { eodSelection, eodResponse } from "./eod-history-fixture";
import {
  response,
  row,
} from "../features/research/test-canonical-annual-ui-fixture";
import { cashRow } from "../features/research/sec-annual-cash-fixture";
import { liquidityRow } from "../features/research/sec-annual-liquidity-fixture";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import { CompanySnapshotPrice } from "./CompanySnapshotPrice";
import { CompanySnapshotAnnual } from "./CompanySnapshotAnnual";
import { CompanySnapshotFilings } from "./CompanySnapshotFilings";
import {
  operatingResponse,
  operatingRow,
} from "../features/research/test-canonical-annual-operating-ui-fixture";

async function fixture(
  packet?: PersonalSecAnnualCanonicalResponseDto,
  pricePacket = eodResponse(),
) {
  const readPrice = vi.fn().mockResolvedValue(pricePacket);
  const readAnnual = vi.fn().mockResolvedValue(packet ?? (await response()));
  const readFilings = vi
    .fn()
    .mockResolvedValue(filingsResponse(2, "available", eodSelection));
  const price = new ManagedEodHistory(readPrice, vi.fn(), undefined, [
    eodSelection.listing,
  ]);
  const annual = new ManagedAnnualReport(readAnnual, vi.fn(), undefined, {
    coverage: inventedManagedResearchCoverage,
  });
  const filings = new ManagedCompanyFilings(readFilings, vi.fn(), undefined, {
    coverage: inventedManagedResearchCoverage,
  });
  price.open(eodSelection);
  annual.open(eodSelection);
  filings.open(eodSelection);
  const onSection = vi.fn();
  const evidence = () =>
    companySnapshotEvidence(
      eodSelection,
      price.getSnapshot(),
      annual.getSnapshot(),
      filings.getSnapshot(),
    );
  const html = () =>
    renderToStaticMarkup(
      <ManagedCompanySnapshot
        navigationPending={false}
        selection={eodSelection}
        price={price}
        annual={annual}
        filings={filings}
        onSection={onSection}
      />,
    );
  return {
    price,
    annual,
    filings,
    readPrice,
    readAnnual,
    readFilings,
    html,
    evidence,
    onSection,
  };
}

describe("loaded company snapshot", () => {
  it.each(["1m", "1y"] as const)(
    "shares exact observed extrema for a loaded %s packet without another source read",
    async (range) => {
      const packet = eodResponse(range);
      const f = await fixture(undefined, packet);
      f.price.selectRange(range);
      await f.price.load();
      const html = f.html();
      const summary = html
        .split('aria-label="Observed raw-close range">')[1]
        ?.split("</dl>")[0];
      expect(summary).toContain("Highest reported close · USD");
      expect(summary).toContain("Lowest reported close · USD");
      expect(summary).toContain("101.5");
      expect(summary).toContain("2026-09-19");
      expect(summary).toContain(range === "1y" ? "90.125" : "100.25");
      expect(summary).toContain(range === "1y" ? "2025-09-22" : "2026-09-18");
      expect(html).toContain(
        `Loaded request range: ${range === "1y" ? "One year" : "One month"}.`,
      );
      expect(f.readPrice).toHaveBeenCalledOnce();
      expect(f.readAnnual).not.toHaveBeenCalled();
      expect(f.readFilings).not.toHaveBeenCalled();
    },
  );
  it("keeps operating results current when net income is missing, without labelling independent measures historical", async () => {
    const f = await fixture(
      await operatingResponse(
        [operatingRow("-25.125")],
        [row("Revenues", "1000")],
      ),
    );
    await f.annual.load();
    const html = f.html();
    expect(html).toContain(
      "Revenue and net income cannot form a current-use pair at this load.",
    );
    expect(html).toContain(
      "Independent measures retain their own eligibility below.",
    );
    expect(html).toContain("Snapshot operating results");
    expect(html).toContain("-25.125");
    expect(html).toContain("-2.51%");
    expect(html).toContain("Within current-use limits at this load.");
    expect(html).not.toContain(
      "Any valid reported amounts below are historical.",
    );
    expect(f.readAnnual).toHaveBeenCalledOnce();
    expect(f.readPrice).not.toHaveBeenCalled();
    expect(f.readFilings).not.toHaveBeenCalled();
  });
  it("starts closed with three independent empty states and makes no read or navigation", async () => {
    const f = await fixture();
    expect(f.html()).toContain("No close history loaded");
    expect(f.html()).toContain("No annual evidence loaded");
    expect(f.html()).toContain("No filing metadata loaded");
    expect(f.html()).not.toContain("<details open");
    expect(f.readPrice).not.toHaveBeenCalled();
    expect(f.readAnnual).not.toHaveBeenCalled();
    expect(f.readFilings).not.toHaveBeenCalled();
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

  it("shows loaded filing coordinates and their own original window and source clocks", async () => {
    const f = await fixture();
    await f.filings.load();
    const html = f.html();
    for (const text of [
      "Newest observed filing",
      "Form 10-Q",
      "2026-10-11",
      "0000000001-26-000001",
      "https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm",
      "2 loaded filings",
      "2026-07-15 to 2026-10-12",
      "2026-10-12T00:00:00.000Z",
      "2026-10-12T00:00:00.500Z",
      "2026-10-12T00:00:01.000Z",
      "Older continuation files and filing bodies were not loaded",
      "does not establish complete coverage",
      "No close history loaded",
      "No annual evidence loaded",
    ])
      expect(html).toContain(text);
    expect(f.readFilings).toHaveBeenCalledTimes(1);
    expect(f.readPrice).not.toHaveBeenCalled();
    expect(f.readAnnual).not.toHaveBeenCalled();
  });

  it("keeps an empty checked list distinct from an unloaded source", async () => {
    const f = await fixture();
    f.readFilings.mockResolvedValueOnce(
      filingsResponse(0, "available", eodSelection),
    );
    await f.filings.load();
    expect(f.html()).toContain(
      "No matching filings were observed in the checked source object.",
    );
    expect(f.html()).toContain("0 loaded filings");
    expect(f.html()).not.toContain("No filing metadata loaded");
    expect(f.html()).not.toContain("Newest observed filing");
  });

  it.each([
    "not_covered",
    "rate_limited",
    "upstream_unavailable",
    "invalid_response",
  ] as const)(
    "keeps the checked %s source unavailable instead of reporting an empty successful list",
    async (status) => {
      const f = await fixture();
      f.readFilings.mockResolvedValueOnce(
        filingsResponse(0, status, eodSelection),
      );
      await f.filings.load();
      const html = f.html();
      expect(html).toContain("its contents were not successfully validated");
      expect(html).toContain("2026-10-12T00:00:00.500Z");
      expect(html).not.toContain("0 loaded filings");
      expect(html).not.toContain("No matching filings were observed");
      expect(html).not.toContain("Newest observed filing");
      expect(html).not.toContain("No filing metadata loaded");
    },
  );

  it("preserves the admitted truncation and older-history limits", async () => {
    const f = await fixture();
    const packet = filingsResponse(1000, "available", eodSelection);
    f.readFilings.mockResolvedValueOnce({
      ...packet,
      issuer: { ...packet.issuer, matchingFilings: 1001, truncated: true },
    });
    await f.filings.load();
    expect(f.html()).toContain("Showing 1000 of 1001 matching entries");
    expect(f.html()).toContain("The source lists older continuation files.");
    expect(f.html()).toContain("does not establish complete coverage");
  });

  it("retains original filing metadata during refresh and failure, then clears it on invalid replacement", async () => {
    const f = await fixture();
    await f.filings.load();
    let finish!: (value: ReturnType<typeof filingsResponse>) => void;
    f.readFilings.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const loading = f.filings.load();
    expect(f.html()).toContain("Showing previous filings metadata");
    expect(f.html()).toContain("2026-10-12T00:00:01.000Z");
    finish(filingsResponse(2, "available", eodSelection));
    await loading;
    expect(f.html()).not.toContain("Showing previous filings metadata");
    f.readFilings.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.filings.load();
    expect(f.html()).toContain("Showing previous filings metadata");
    expect(f.html()).toContain("Newest observed filing");
    f.readFilings.mockResolvedValueOnce({
      ...filingsResponse(2, "available", eodSelection),
      security: { ...eodSelection.listing, cik: "0000000002" },
    });
    await f.filings.load();
    expect(f.html()).toContain("No filing metadata loaded");
    expect(f.html()).not.toContain("Newest observed filing");
    expect(f.readPrice).not.toHaveBeenCalled();
    expect(f.readAnnual).not.toHaveBeenCalled();
  });

  it.each(["close", "retire"] as const)(
    "%s clears filings while other loaded evidence remains",
    async (action) => {
      const f = await fixture();
      await f.price.load();
      await f.annual.load();
      await f.filings.load();
      f.filings[action]();
      expect(f.html()).toContain("No filing metadata loaded");
      expect(f.html()).not.toContain("Newest observed filing");
      expect(f.html()).toContain("101.5");
      expect(f.html()).toContain("1000");
    },
  );

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
    const packet = await parseAnnualComparisonFixture(
      base,
      [cashRow("operating_cash_flow", "250"), cashRow("ppe_purchases", "75")],
      [
        liquidityRow("current_assets", "800"),
        liquidityRow("current_liabilities", "400"),
      ],
    );
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
    const packet = await parseAnnualComparisonFixture(
      base,
      [cashRow("operating_cash_flow", "250"), cashRow("ppe_purchases", "75")],
      [
        liquidityRow("current_assets", "800"),
        liquidityRow("current_liabilities", "400"),
      ],
    );
    const f = await fixture(packet);
    await f.annual.load();
    const html = f.html();
    expect(html).toContain(
      "Independent measures retain their own eligibility below.",
    );
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
      await f.filings.load();
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
          f.filings.getSnapshot(),
        ),
      ).toEqual({ price: null, annual: null, filings: null });
      expect(f.evidence().price?.response).not.toBeNull();
      expect(f.evidence().annual?.response).not.toBeNull();
      expect(f.evidence().filings?.response).not.toBeNull();
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
        { ...f.filings.getSnapshot(), catalogChanged: true },
      ),
    ).toEqual({ price: null, annual: null, filings: null });
  });

  it("section actions only delegate explicit navigation", async () => {
    const f = await fixture();
    const node = CompanySnapshotView({
      navigationPending: false,
      evidence: f.evidence(),
      onSection: f.onSection,
    });
    function elements(
      n: React.ReactNode,
    ): React.ReactElement<Record<string, unknown>>[] {
      if (!React.isValidElement<Record<string, unknown>>(n)) return [];
      if (n.type === CompanySnapshotEvidenceView)
        return elements(
          CompanySnapshotEvidenceView(
            n.props as React.ComponentProps<typeof CompanySnapshotEvidenceView>,
          ),
        );
      if (n.type === CompanySnapshotPrice)
        return elements(
          CompanySnapshotPrice(
            n.props as React.ComponentProps<typeof CompanySnapshotPrice>,
          ),
        );
      if (n.type === CompanySnapshotAnnual)
        return elements(
          CompanySnapshotAnnual(
            n.props as React.ComponentProps<typeof CompanySnapshotAnnual>,
          ),
        );
      if (n.type === CompanySnapshotFilings)
        return elements(
          CompanySnapshotFilings(
            n.props as React.ComponentProps<typeof CompanySnapshotFilings>,
          ),
        );
      return [
        n,
        ...React.Children.toArray(n.props.children as React.ReactNode).flatMap(
          elements,
        ),
      ];
    }
    const buttons = elements(node).filter((n) => n.type === "button");
    expect(buttons).toHaveLength(3);
    const held = CompanySnapshotView({
      navigationPending: true,
      evidence: f.evidence(),
      onSection: f.onSection,
    });
    expect(
      elements(held)
        .filter((n) => n.type === "button")
        .map((n) => n.props.disabled),
    ).toEqual([true, true, true]);
    expect(renderToStaticMarkup(held).replaceAll(' disabled=""', "")).toBe(
      renderToStaticMarkup(node),
    );
    expect(f.onSection).not.toHaveBeenCalled();
    for (const button of buttons) (button.props.onClick as () => void)();
    expect(f.onSection.mock.calls).toEqual([["eod"], ["annual"], ["filings"]]);
    expect(f.readAnnual).not.toHaveBeenCalled();
    expect(f.readPrice).not.toHaveBeenCalled();
    expect(f.readFilings).not.toHaveBeenCalled();
  });

  it("keeps an unsupported listing's Price coverage message instead of offering a load", async () => {
    const f = await fixture();
    const selection = {
      ...eodSelection,
      listing: {
        ...eodSelection.listing,
        listingId: "listing-unsupported",
        symbol: "OTHER",
      },
    };
    f.price.open(selection);
    const html = renderToStaticMarkup(
      <ManagedCompanySnapshot
        navigationPending={false}
        selection={selection}
        price={f.price}
        annual={f.annual}
        filings={f.filings}
        onSection={f.onSection}
      />,
    );
    expect(html).toContain(
      "Price history is not available for this listing in this workspace.",
    );
    expect(html).not.toContain("No close history loaded");
    expect(f.readPrice).not.toHaveBeenCalled();
  });
});
