import type {
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalAnnualFinancialReportedValuesDto,
  PersonalAnnualFinancialsDto,
  PersonalValuationHistoryDto,
  PersonalValuationHistoryPointDto,
} from "@research-cockpit/contracts";
import { PERSONAL_FINANCIAL_REPORTED_FIELDS } from "@research-cockpit/personal-financial-analytics";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PERSONAL_MANUAL_PEER_COMPARISON_MAXIMUM_PEERS,
  PersonalManualPeerComparison,
  type PersonalManualPeerComparisonProps,
  type PersonalManualPeerSelection,
  type PersonalManualPeerState,
} from "./PersonalManualPeerComparison";

describe("PersonalManualPeerComparison", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with an explicit selected-company readiness state", () => {
    const markup = render({
      candidates: [selection("peer", "PEER", "issuer-peer")],
    });
    const text = visibleText(markup);

    expect(text).toContain("Manual peer comparison");
    expect(text).toContain("Choose the company you want to compare");
    expect(text).toContain("No company or peer is selected automatically");
    expect(markup).not.toContain("<table");
    expect(markup).not.toContain("manual-peer-picker");
  });

  it("offers only exact eligible listings and makes adding network-free", () => {
    const primary = selection("primary", "ZERO", "issuer-primary");
    const existing = peerState(selection("existing", "ONE", "issuer-one"));
    const eligible = selection("eligible", "TWO", "issuer-two");
    const markup = render({
      candidates: [primary, existing.selection, eligible, eligible],
      peers: [existing],
      selection: primary,
    });
    const text = visibleText(markup);

    expect(markup).toContain(
      'aria-label="Add a company to the manual peer sample"',
    );
    expect(markup).toContain('id="manual-peer-candidate"');
    expect(markup).toContain('value="eligible"');
    expect(text).toContain("TWO — TWO Holdings · XNAS");
    expect(text).not.toContain("ZERO — ZERO Holdings");
    expect(text).not.toContain("ONE — ONE Holdings");
    expect(text).toContain("Adding a peer is network-free");
  });

  it("enforces the visible three-peer bound and labels every remove control", () => {
    const peers = [
      peerState(selection("one", "ONE", "issuer-one")),
      peerState(selection("two", "TWO", "issuer-two")),
      peerState(selection("three", "THREE", "issuer-three")),
    ];
    const markup = render({
      candidates: [selection("four", "FOUR", "issuer-four")],
      peers,
      selection: selection("primary", "ZERO", "issuer-primary"),
    });

    expect(PERSONAL_MANUAL_PEER_COMPARISON_MAXIMUM_PEERS).toBe(3);
    expect(markup).toContain("Three-peer limit reached");
    expect(markup).toContain('aria-label="Remove ONE from manual peers"');
    expect(markup).toContain('aria-label="Remove TWO from manual peers"');
    expect(markup).toContain('aria-label="Remove THREE from manual peers"');
  });

  it("explains and disables peer loads until the primary inputs and global request slot are ready", () => {
    const primary = selection("primary", "ZERO", "issuer-primary");
    const peer = peerState(selection("peer", "PEER", "issuer-peer"));
    const beforePrimary = render({ peers: [peer], selection: primary });

    expect(visibleText(beforePrimary)).toContain(
      "Load at least one selected-company source—annual statements or valuation history—before loading peers",
    );
    expect(beforePrimary).toMatch(
      /aria-label="Load comparison data for PEER"[^>]*disabled/,
    );

    const annualOnly = render({
      annualFinancials: annualFinancials(primary, "1000"),
      peers: [peer],
      selection: primary,
    });
    expect(visibleText(annualOnly)).toContain(
      "Comparison table prepared for 2 companies",
    );
    expect(visibleText(annualOnly)).not.toContain(
      "Side-by-side comparison ready for 2 companies",
    );

    const whileLoading = render({
      annualFinancials: annualFinancials(primary, "1000"),
      peers: [
        peerState(selection("one", "ONE", "issuer-one"), {
          requestState: "loading",
        }),
        peer,
      ],
      selection: primary,
      valuationHistory: valuationHistory(primary, "10"),
    });
    expect(visibleText(whileLoading)).toContain(
      "Another peer is loading. Its two provider reads must finish before this peer can load",
    );
    expect(whileLoading).toMatch(
      /aria-label="Load comparison data for PEER"[^>]*disabled/,
    );
  });

  it("does not claim comparison availability when loaded source domains do not overlap", () => {
    const primary = selection("primary", "ZERO", "issuer-primary");
    const peer = selection("peer", "PEER", "issuer-peer");
    const markup = render({
      annualFinancials: annualFinancials(primary, "1000"),
      peers: [
        peerState(peer, {
          valuationHistory: valuationHistory(peer, "12"),
        }),
      ],
      selection: primary,
    });
    const text = visibleText(markup);

    expect(text).toContain("Comparison table prepared for 2 companies");
    expect(text).not.toContain("Partial side-by-side comparison available");
    expect(text).not.toContain("Side-by-side comparison ready");
  });

  it("does not claim readiness when aligned sources have no overlapping known metric", () => {
    const primary = selection("primary", "ZERO", "issuer-primary");
    const peer = selection("peer", "PEER", "issuer-peer");
    const markup = render({
      annualFinancials: annualFinancials(primary, "1000"),
      peers: [
        peerState(peer, {
          annualFinancials: unknownAnnualFinancials(peer),
          valuationHistory: valuationHistory(peer, "12"),
        }),
      ],
      selection: primary,
      valuationHistory: unknownValuationHistory(primary),
    });
    const text = visibleText(markup);

    expect(text).toContain("Comparison table prepared for 2 companies");
    expect(text).not.toContain("Partial side-by-side comparison available");
    expect(text).not.toContain("Side-by-side comparison ready");
  });

  it("renders the primary plus three peers across exactly fifteen grouped metrics", () => {
    const primary = selection("primary", "ZERO", "issuer-primary");
    const peers = [
      loadedPeer(selection("one", "ONE", "issuer-one"), "1100"),
      loadedPeer(selection("two", "TWO", "issuer-two"), "1200"),
      loadedPeer(selection("three", "THREE", "issuer-three"), "1300"),
    ];
    const markup = render({
      annualFinancials: annualFinancials(primary, "1000"),
      peers,
      selection: primary,
      valuationHistory: valuationHistory(primary, "10"),
    });
    const text = visibleText(markup);

    expect(text).toContain("Side-by-side comparison ready for 4 companies");
    expect(text).toContain("15 fixed metrics");
    expect(markup.match(/<th scope="row">/gu)).toHaveLength(15);
    expect(markup.match(/scope="rowgroup"/gu)).toHaveLength(4);
    expect(text).toContain("Scale");
    expect(text).toContain("Growth & profitability");
    expect(text).toContain("Balance sheet & efficiency");
    expect(text).toContain("Market valuation");
    expect(text).toContain("Revenue");
    expect(text).toContain("Market capitalization");
    expect(text).toContain("Trailing PEG (1Y)");
    expect(markup.match(/manual-peer-primary-column/gu)).toHaveLength(16);
    expect(text).toContain("Selected company");
    expect(text).toContain("Manual peer");
  });

  it("shows exact annual and valuation provenance for every company", () => {
    const primary = selection("primary", "ZERO", "issuer-primary");
    const peer = loadedPeer(selection("peer", "PEER", "issuer-peer"), "1500");
    const markup = render({
      annualFinancials: annualFinancials(primary, "1000"),
      peers: [peer],
      selection: primary,
      valuationHistory: valuationHistory(primary, "10"),
    });
    const text = visibleText(markup);

    expect(text).toContain("annual anchor FY 2029");
    expect(text).toContain("valuation anchor 2030-02-28");
    expect(text).toContain(
      "Annual: FY 2029 · statement 2029-12-31 · asOf 2030-03-01T15:00:00.000Z",
    );
    expect(text).toContain(
      "Valuation: 2030-02-28 · asOf 2030-03-01T15:00:00.000Z",
    );
  });

  it("keeps independently unavailable annual and valuation cells visible", () => {
    const primary = selection("primary", "ZERO", "issuer-primary");
    const annualOnly = peerState(
      selection("annual-only", "ANN", "issuer-ann"),
      {
        annualFinancials: annualFinancials(
          selection("annual-only", "ANN", "issuer-ann"),
          "900",
        ),
        valuationErrorCode: "not_covered",
      },
    );
    const valuationOnly = peerState(
      selection("valuation-only", "VAL", "issuer-val"),
      {
        annualErrorCode: "not_entitled",
        valuationHistory: valuationHistory(
          selection("valuation-only", "VAL", "issuer-val"),
          "12",
        ),
      },
    );
    const markup = render({
      annualFinancials: annualFinancials(primary, "1000"),
      peers: [annualOnly, valuationOnly],
      selection: primary,
      valuationHistory: valuationHistory(primary, "10"),
    });
    const text = visibleText(markup);

    expect(text).toContain("Not covered for this listing");
    expect(text).toContain("Not included for this account");
    expect(text).toContain("partial or failed comparison load");
    expect(text).toContain("Unknown");
    expect(text).toContain("Source not loaded");
    expect(text).toContain("USD 900");
    expect(text).toContain("12.0000×");
  });

  it("withholds a malformed peer-set envelope instead of crashing the panel", () => {
    const markup = render({
      peers: [
        peerState(selection("one", "ONE", "duplicate-issuer")),
        peerState(selection("two", "TWO", "duplicate-issuer")),
      ],
      selection: selection("primary", "ZERO", "issuer-primary"),
    });

    expect(visibleText(markup)).toContain(
      "Manual peer comparison was withheld",
    );
    expect(visibleText(markup)).toContain(
      "No derived metric or source coordinate is shown",
    );
    expect(markup).not.toContain("manual-peer-table");
  });

  it("uses labelled controls, live status, and a semantic scrollable table", () => {
    const primary = selection("primary", "ZERO", "issuer-primary");
    const markup = render({
      annualFinancials: annualFinancials(primary, "1000"),
      peers: [loadedPeer(selection("peer", "PEER", "issuer-peer"), "1100")],
      selection: primary,
      valuationHistory: valuationHistory(primary, "10"),
    });

    expect(markup).toContain('aria-labelledby="personal-manual-peer-title"');
    expect(markup).toContain(
      'aria-describedby="personal-manual-peer-intro personal-manual-peer-caveat"',
    );
    expect(markup).toContain(
      'aria-label="Manual peer financial and valuation comparison table"',
    );
    expect(markup).toContain('role="region"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain("<caption>");
    expect(markup).toContain('<th scope="col">Metric</th>');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-label="Refresh comparison data for PEER"');
  });

  it("does not request, store, mutate, persist, export, rank, or benchmark", () => {
    const fetch = vi.fn();
    const localStorage = {
      clear: vi.fn(),
      getItem: vi.fn(),
      key: vi.fn(),
      length: 0,
      removeItem: vi.fn(),
      setItem: vi.fn(),
    } satisfies Storage;
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("localStorage", localStorage);
    const primary = freezeDeep(selection("primary", "ZERO", "issuer-primary"));
    const primaryAnnuals = freezeDeep(annualFinancials(primary, "1000"));
    const primaryValuation = freezeDeep(valuationHistory(primary, "10"));
    const peer = freezeDeep(
      loadedPeer(selection("peer", "PEER", "issuer-peer"), "1100"),
    );
    const markup = render({
      annualFinancials: primaryAnnuals,
      peers: [peer],
      selection: primary,
      valuationHistory: primaryValuation,
    });
    const text = visibleText(markup);

    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(Object.isFrozen(primaryAnnuals)).toBe(true);
    expect(Object.isFrozen(peer)).toBe(true);
    expect(text).toContain("manually selected sample of 1 peer");
    expect(text).toContain("not a sector benchmark");
    expect(text).toContain("ranking");
    expect(text).toContain("calculation makes no additional request");
    expect(text).toContain("nothing is persisted or exported");
  });
});

function render(
  overrides: Partial<PersonalManualPeerComparisonProps> = {},
): string {
  return renderToStaticMarkup(
    <PersonalManualPeerComparison
      annualFinancials={null}
      candidates={[]}
      onAddPeer={vi.fn()}
      onLoadPeerData={vi.fn()}
      onRemovePeer={vi.fn()}
      peers={[]}
      providerStatus={providerStatus()}
      range="1y"
      selection={null}
      valuationHistory={null}
      {...overrides}
    />,
  );
}

function selection(
  listingId: string,
  symbol: string,
  issuerId: string,
): PersonalManualPeerSelection {
  return {
    country: "US",
    exchangeMic: "XNAS",
    issuerId,
    issuerName: `${symbol} Holdings`,
    listingId,
    securityName: `${symbol} Common Stock`,
    symbol,
  };
}

function peerState(
  peerSelection: PersonalManualPeerSelection,
  overrides: Partial<PersonalManualPeerState> = {},
): PersonalManualPeerState {
  return {
    annualErrorCode: null,
    annualFinancials: null,
    requestState: "idle",
    selection: peerSelection,
    valuationErrorCode: null,
    valuationHistory: null,
    ...overrides,
  };
}

function loadedPeer(
  peerSelection: PersonalManualPeerSelection,
  revenue: string,
): PersonalManualPeerState {
  return peerState(peerSelection, {
    annualFinancials: annualFinancials(peerSelection, revenue),
    valuationHistory: valuationHistory(peerSelection, "11"),
  });
}

function providerStatus() {
  return {
    profile: "personal_single_user_local_market_data" as const,
    provider: {
      attribution: "Tiingo" as const,
      export: "prohibited" as const,
      historyFeed: "tiingo_eod_composite" as const,
      id: "tiingo" as const,
      name: "Tiingo" as const,
      persistence: "none" as const,
      quoteFeed: "tiingo_iex_derived_reference" as const,
      redistribution: "prohibited" as const,
      retention: "active_owner_session_memory_only" as const,
    },
    schemaVersion: "1.0.0" as const,
    status: "configured" as const,
  };
}

function annualFinancials(
  company: PersonalManualPeerSelection,
  revenue: string,
): PersonalAnnualFinancialsDto {
  const years = [
    financialYear(2029, revenue, "2029-12-31"),
    financialYear(2028, "800", "2028-12-31"),
  ];
  return {
    asOf: "2030-03-01T15:00:00.000Z",
    coverage: {
      earliestFiscalYear: 2028,
      knownReportedCells:
        years.length * PERSONAL_FINANCIAL_REPORTED_FIELDS.length,
      latestFiscalYear: 2029,
      missingFiscalYears: [2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020],
      requestedAnnualYears: 10,
      returnedAnnualYears: 2,
      status: "partial",
      unknownReportedCells: 0,
    },
    profile: "personal_single_user_local_fundamentals",
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
      revisionBasis: "provider_most_recent",
      statementFeed: "tiingo_fundamentals_statements",
      valueCurrency: "USD",
    },
    schemaVersion: "1.1.0",
    security: marketIdentity(company),
    status: "available",
    years,
  };
}

function unknownAnnualFinancials(
  company: PersonalManualPeerSelection,
): PersonalAnnualFinancialsDto {
  const known = annualFinancials(company, "1000");
  const years = known.years.map((year) => ({
    ...year,
    reported: Object.fromEntries(
      PERSONAL_FINANCIAL_REPORTED_FIELDS.map(({ fieldKey }) => [
        fieldKey,
        unknownFinancialCell(),
      ]),
    ) as PersonalAnnualFinancialReportedValuesDto,
  }));
  return {
    ...known,
    coverage: {
      ...known.coverage,
      knownReportedCells: 0,
      status: "partial",
      unknownReportedCells:
        years.length * PERSONAL_FINANCIAL_REPORTED_FIELDS.length,
    },
    years,
  };
}

function financialYear(
  fiscalYear: number,
  revenue: string,
  statementDate: string,
): PersonalAnnualFinancialsDto["years"][number] {
  const values: Partial<
    Record<PersonalAnnualFinancialReportedFieldKeyDto, string>
  > = {
    assets: "2000",
    cash: "400",
    current_assets: "800",
    current_liabilities: "400",
    debt: "300",
    free_cash_flow: "180",
    gross_profit: "500",
    net_income: "150",
    operating_cash_flow: "240",
    operating_income: "220",
    revenue,
  };
  const reported = Object.fromEntries(
    PERSONAL_FINANCIAL_REPORTED_FIELDS.map(({ fieldKey }) => [
      fieldKey,
      knownCell(values[fieldKey] ?? "1"),
    ]),
  ) as PersonalAnnualFinancialReportedValuesDto;
  return { fiscalYear, reported, statementDate };
}

function valuationHistory(
  company: PersonalManualPeerSelection,
  priceToEarnings: string,
): PersonalValuationHistoryDto {
  const latestPoint = valuationPoint(priceToEarnings);
  return {
    asOf: "2030-03-01T15:00:00.000Z",
    coverage: {
      knownCells: 5,
      observationCount: 1,
      status: "complete",
      unknownCells: 0,
    },
    history: {
      endDate: "2030-03-01",
      latestPoint,
      points: [latestPoint],
      range: "1y",
      startDate: "2029-03-01",
    },
    profile: "personal_single_user_local_valuation",
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
      revisionBasis: "provider_most_recent",
      valuationFeed: "tiingo_fundamentals_daily",
      valueCurrency: "USD",
    },
    schemaVersion: "1.0.0",
    security: marketIdentity(company),
    status: "available",
  };
}

function unknownValuationHistory(
  company: PersonalManualPeerSelection,
): PersonalValuationHistoryDto {
  const known = valuationHistory(company, "10");
  const point: PersonalValuationHistoryPointDto = {
    date: known.history.latestPoint.date,
    enterpriseValue: unknownValuationCell("USD"),
    marketCapitalization: unknownValuationCell("USD"),
    priceToBook: unknownValuationCell("ratio"),
    priceToEarnings: unknownValuationCell("ratio"),
    trailingPeg1Y: unknownValuationCell("ratio"),
  };
  return {
    ...known,
    coverage: {
      knownCells: 0,
      observationCount: 1,
      status: "partial",
      unknownCells: 5,
    },
    history: {
      ...known.history,
      latestPoint: point,
      points: [point],
    },
  };
}

function valuationPoint(
  priceToEarnings: string,
): PersonalValuationHistoryPointDto {
  return {
    date: "2030-02-28",
    enterpriseValue: moneyCell("1200000"),
    marketCapitalization: moneyCell("1000000"),
    priceToBook: ratioCell("3"),
    priceToEarnings: ratioCell(priceToEarnings),
    trailingPeg1Y: ratioCell("1.5"),
  };
}

function marketIdentity(company: PersonalManualPeerSelection) {
  return {
    country: "US" as const,
    exchangeMic: company.exchangeMic,
    issuerName: company.issuerName,
    listingId: company.listingId,
    securityName: company.securityName,
    symbol: company.symbol,
  };
}

function knownCell(value: string) {
  return { status: "known" as const, value };
}

function unknownFinancialCell() {
  return {
    reason: "not_supplied_by_provider" as const,
    status: "unknown" as const,
    value: null,
  };
}

function moneyCell(value: string) {
  return { status: "known" as const, unit: "USD" as const, value };
}

function ratioCell(value: string) {
  return { status: "known" as const, unit: "ratio" as const, value };
}

function unknownValuationCell<Unit extends "USD" | "ratio">(unit: Unit) {
  return {
    reason: "not_supplied_by_provider" as const,
    status: "unknown" as const,
    unit,
    value: null,
  };
}

function visibleText(markup: string): string {
  return decodeEntities(markup.replace(/<[^>]*>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&apos;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&quot;", '"');
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
