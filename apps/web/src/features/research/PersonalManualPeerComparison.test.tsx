import type {
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalAnnualFinancialReportedValuesDto,
  PersonalAnnualFinancialsDto,
  PersonalValuationHistoryDto,
  PersonalValuationHistoryPointDto,
} from "@research-cockpit/contracts";
import { PERSONAL_FINANCIAL_REPORTED_FIELDS } from "@research-cockpit/personal-financial-analytics";
import { isValidElement, type ReactElement, type ReactNode } from "react";
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
    const metricTable = markup.match(
      /<table class="manual-peer-table">[\s\S]*?<\/table>/u,
    )?.[0];
    expect(metricTable).toBeDefined();
    expect(metricTable!.match(/<th scope="row">/gu)).toHaveLength(15);
    expect(metricTable!.match(/scope="rowgroup"/gu)).toHaveLength(4);
    expect(text).toContain("Scale");
    expect(text).toContain("Growth & profitability");
    expect(text).toContain("Balance sheet & efficiency");
    expect(text).toContain("Market valuation");
    expect(text).toContain("Revenue");
    expect(text).toContain("Market capitalization");
    expect(text).toContain("Trailing PEG (1Y)");
    expect(metricTable!.match(/manual-peer-primary-column/gu)).toHaveLength(16);
    expect(metricTable!.match(/<details /gu)).toHaveLength(60);
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

describe("manual peer display order", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps both single-peer endpoints focusable and ignores their activation", () => {
    const onMovePeer = vi.fn(() => true);
    const props = { ...loadedComparison(), onMovePeer };
    const buttons = peerMoveButtons(props);

    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.type).toBe("button");
      expect(button.props.type).toBe("button");
      expect(button.props["aria-disabled"]).toBe(true);
      expect(button.props.disabled).toBeUndefined();
      expect(button.props.tabIndex).toBeUndefined();
      activateButton(button);
    }
    expect(onMovePeer).not.toHaveBeenCalled();
    expect(buttons.map((button) => button.props["aria-label"])).toEqual([
      "Move earlier: PEER Holdings (PEER · XNAS)",
      "Move later: PEER Holdings (PEER · XNAS)",
    ]);
  });

  it("requests only the selected adjacent move and leaves endpoint callbacks untouched", () => {
    const onMovePeer = vi.fn(() => true);
    const onAddPeer = vi.fn();
    const onLoadPeerData = vi.fn();
    const onRemovePeer = vi.fn();
    const peers = [
      peerState(selection("one", "ONE", "issuer-one")),
      peerState(selection("two", "TWO", "issuer-two")),
      peerState(selection("three", "THREE", "issuer-three")),
    ];
    const buttons = peerMoveButtons({
      selection: selection("primary", "ZERO", "issuer-primary"),
      peers,
      onAddPeer,
      onLoadPeerData,
      onMovePeer,
      onRemovePeer,
    });

    expect(buttons.map((button) => button.props["aria-disabled"])).toEqual([
      true,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(onMovePeer).not.toHaveBeenCalled();
    for (const button of buttons) activateButton(button);
    expect(onMovePeer.mock.calls).toEqual([
      ["one", "later"],
      ["two", "earlier"],
      ["two", "later"],
      ["three", "earlier"],
    ]);
    expect(onAddPeer).not.toHaveBeenCalled();
    expect(onLoadPeerData).not.toHaveBeenCalled();
    expect(onRemovePeer).not.toHaveBeenCalled();
  });

  it.each(["unloaded", "loading", "partial failure"] as const)(
    "allows a move with %s sources while provider loading remains disabled",
    (state) => {
      const props = loadedComparison();
      const onMovePeer = vi.fn(() => true);
      const peer = props.peers[0]!;
      const peers = [
        state === "unloaded"
          ? peerState(peer.selection)
          : state === "loading"
            ? { ...peer, requestState: "loading" as const }
            : {
                ...peer,
                valuationHistory: null,
                valuationErrorCode: "not_covered" as const,
              },
        peerState(selection("second", "TWO", "issuer-two")),
      ];
      const input = {
        ...props,
        annualFinancials: null,
        valuationHistory: null,
        providerStatus: null,
        peers,
        onMovePeer,
      };
      const later = peerMoveButtons(input)[1]!;
      expect(later.props["aria-disabled"]).toBe(false);
      expect(later.props.disabled).toBeUndefined();
      activateButton(later);
      expect(onMovePeer).toHaveBeenCalledExactlyOnceWith("peer", "later");
      const load = hostElements(comparisonElement(input)).find(
        (node) =>
          node.type === "button" &&
          String(node.props["aria-label"]).endsWith("data for TWO"),
      );
      expect(load?.props.disabled).toBe(true);
    },
  );

  it("does not optimistically reorder or perform IO when the controller rejects a move", () => {
    const onMovePeer = vi.fn(() => false);
    const fetch = vi.fn();
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("localStorage", storage);
    const props = freezeDeep({
      ...loadedComparison(),
      peers: [
        loadedPeer(selection("one", "ONE", "issuer-one"), "1100"),
        loadedPeer(selection("two", "TWO", "issuer-two"), "1200"),
      ],
      onMovePeer,
    });
    const before = render(props);
    activateButton(peerMoveButtons(props)[1]!);
    expect(onMovePeer).toHaveBeenCalledExactlyOnceWith("one", "later");
    expect(render(props)).toBe(before);
    expect(props.peers.map((peer) => peer.selection.listingId)).toEqual([
      "one",
      "two",
    ]);
    expect(fetch).not.toHaveBeenCalled();
    for (const method of Object.values(storage))
      expect(method).not.toHaveBeenCalled();
  });

  it("keeps company card keys and both tables' exact cells when peer order changes", () => {
    const first = loadedPeer(selection("one", "ONE", "issuer-one"), "1100");
    const second = loadedPeer(selection("two", "TWO", "issuer-two"), "2200");
    const before = { ...loadedComparison(), peers: [first, second] };
    const after = { ...before, peers: [second, first] };
    const cards = (props: typeof before) =>
      hostElements(comparisonElement(props))
        .filter((node) => node.props.className === "manual-peer-card")
        .map((node) => node.key);
    expect(cards(before)).toEqual(["one", "two"]);
    expect(cards(after)).toEqual(["two", "one"]);
    const tables = (props: typeof before) =>
      hostElements(comparisonElement(props)).filter(
        (node) => node.type === "table",
      );
    const initialTables = tables(before);
    const movedTables = tables(after);
    expect(initialTables).toHaveLength(2);
    expect(movedTables).toHaveLength(2);
    for (const [index, table] of initialTables.entries()) {
      const rows = (value: ReactNode) =>
        hostElements(value)
          .filter((node) => node.type === "tr")
          .map((row) =>
            hostElements(row)
              .filter((node) => node.type === "td")
              .map((cell) => renderToStaticMarkup(cell)),
          )
          .filter((cells) => cells.length > 0);
      const initialRows = rows(table);
      expect(initialRows).toHaveLength(index === 0 ? 15 : 12);
      expect(rows(movedTables[index])).toEqual(
        initialRows.map(([primary, one, two]) => [primary, two, one]),
      );
    }
    expect(
      peerMoveButtons(after).map((button) => button.props["aria-label"]),
    ).toEqual([
      "Move earlier: TWO Holdings (TWO · XNAS)",
      "Move later: TWO Holdings (TWO · XNAS)",
      "Move earlier: ONE Holdings (ONE · XNAS)",
      "Move later: ONE Holdings (ONE · XNAS)",
    ]);
  });

  it("preserves native metric and quality disclosure keys across peer moves", () => {
    const before = {
      ...loadedComparison(),
      peers: [
        loadedPeer(selection("one", "ONE", "issuer-one"), "1100"),
        loadedPeer(selection("two", "TWO", "issuer-two"), "2200"),
      ],
    };
    const after = { ...before, peers: [before.peers[1]!, before.peers[0]!] };
    for (const [className, expectedCount] of [
      ["manual-peer-metric-inputs", 45],
      ["manual-peer-quality-inputs", 36],
    ] as const) {
      const initial = nativeDisclosures(before, className);
      const moved = nativeDisclosures(after, className);
      expect(initial).toHaveLength(expectedCount);
      expect(moved).toHaveLength(expectedCount);
      expect(new Set(moved.map((node) => node.key))).toEqual(
        new Set(initial.map((node) => node.key)),
      );
      expect(initial.every((node) => node.key !== null)).toBe(true);
      for (const node of moved) {
        expect(node.props.open).toBeUndefined();
        expect(node.props.onToggle).toBeUndefined();
      }
    }
  });

  it("escapes company names and distinguishes shared symbols by company and exchange", () => {
    const first = {
      ...selection("one", "SAME", "issuer-one"),
      issuerName: '<First & "Company">',
    };
    const second = {
      ...selection("two", "SAME", "issuer-two"),
      exchangeMic: "XNYS",
      issuerName: "Second Company",
    };
    const props = {
      ...loadedComparison(),
      peers: [peerState(first), peerState(second)],
    };
    const labels = peerMoveButtons(props).map(
      (button) => button.props["aria-label"],
    );
    expect(new Set(labels).size).toBe(4);
    expect(labels).toContain('Move earlier: <First & "Company"> (SAME · XNAS)');
    expect(labels).toContain("Move earlier: Second Company (SAME · XNYS)");
    const markup = render(props);
    expect(markup).toContain("&lt;First &amp; &quot;Company&quot;&gt;");
    expect(markup).not.toContain('<First & "Company">');
    expect(peerMoveButtons({ ...props, peers: [] })).toHaveLength(0);
    expect(peerMoveButtons({ ...props, selection: null })).toHaveLength(0);
  });
});

describe("manual peer metric input disclosures", () => {
  it("keeps exact signed and negative-zero operands distinct from rounded results", () => {
    const props = loadedComparison();
    const annual = replaceAnnualFields(props.annualFinancials, {
      gross_profit: knownCell("-12.345600"),
      operating_income: knownCell("-0.0000"),
      revenue: knownCell("1000.0000"),
    });
    const gross = disclosure(
      { ...props, annualFinancials: annual },
      "ZERO",
      "Gross margin",
    );
    const operating = disclosure(
      { ...props, annualFinancials: annual },
      "ZERO",
      "Operating margin",
    );

    expect(disclosureText(gross)).toContain("100 * gross_profit / revenue");
    expect(disclosureText(gross)).toContain("gross_margin_percent");
    expect(disclosureText(gross)).toContain("-12.345600 USD");
    expect(disclosureText(gross)).toContain("1000.0000 USD");
    expect(
      retainedInputs(gross).map((input) => [input.Field, input.Value]),
    ).toEqual([
      ["gross_profit", "-12.345600 USD"],
      ["revenue", "1000.0000 USD"],
    ]);
    expect(disclosureText(gross).indexOf("gross_profit")).toBeLessThan(
      disclosureText(gross).lastIndexOf("revenue"),
    );
    expect(disclosureText(operating)).toContain("-0.0000 USD");
    expect(disclosureText(operating)).toContain("0.00");
    expect(disclosureText(operating)).not.toContain("-0.00 percent");
  });

  it("retains unknown inputs and known zero denominators without inventing a ratio", () => {
    const props = loadedComparison();
    const annual = replaceAnnualFields(props.annualFinancials, {
      current_assets: unknownFinancialCell(),
      current_liabilities: knownCell("0.0000"),
    });
    const missing = disclosure(
      { ...props, annualFinancials: annual },
      "ZERO",
      "Current ratio",
    );
    expect(disclosureText(missing)).toContain("Missing input");
    expect(disclosureText(missing)).toContain("current_assets");
    expect(disclosureText(missing)).toContain("Unknown");
    expect(disclosureText(missing)).toContain("0.0000 USD");

    const zero = disclosure(
      {
        ...props,
        annualFinancials: replaceAnnualFields(annual, {
          current_assets: knownCell("800"),
        }),
      },
      "ZERO",
      "Current ratio",
    );
    expect(disclosureText(zero)).toContain("Nonpositive denominator");
    expect(disclosureText(zero)).toContain("800 USD");
    expect(disclosureText(zero)).toContain("0.0000 USD");
    expect(disclosureText(zero)).not.toContain("Infinity");
    expect(disclosureText(zero)).not.toContain("NaN");
  });

  it("shows both growth years with their own statement dates and one cell response timestamp", () => {
    const props = loadedComparison();
    const current = props.annualFinancials;
    const annual = {
      ...current,
      years: current.years.map((year) => ({
        ...year,
        statementDate: year.fiscalYear === 2029 ? "2030-02-15" : "2029-02-20",
      })),
    };
    const growth = disclosure(
      { ...props, annualFinancials: annual },
      "ZERO",
      "Revenue growth",
    );
    const text = disclosureText(growth);
    expect(text).toContain("100 * (revenue_fy / revenue_fy_minus_1 - 1)");
    expect(text).toContain("25.00");
    expect(text).toContain("Fiscal year 2029");
    expect(text).toContain("2030-02-15");
    expect(text).toContain("Fiscal year 2028");
    expect(text).toContain("2029-02-20");
    expect(text.indexOf("1000 USD")).toBeLessThan(text.indexOf("800 USD"));
    expect(text.match(/2030-03-01T15:00:00\.000Z/gu)).toHaveLength(1);
    expect(retainedInputs(growth)).toEqual([
      {
        Field: "revenue",
        Value: "1000 USD",
        "Listing ID": "primary",
        "Fiscal year": "2029",
        "Provider statement date": "2030-02-15",
      },
      {
        Field: "revenue",
        Value: "800 USD",
        "Listing ID": "primary",
        "Fiscal year": "2028",
        "Provider statement date": "2029-02-20",
      },
    ]);

    const peerText = disclosureText(
      disclosure(props, "PEER", "Revenue growth"),
    );
    expect(peerText).toContain("2029-12-31");
    expect(peerText).not.toContain("2030-02-15");
  });

  it("does not manufacture a missing prior-year operand", () => {
    const props = loadedComparison();
    const annual = annualWithYears(props.annualFinancials, [
      props.annualFinancials.years[0]!,
    ]);
    const text = disclosureText(
      disclosure(
        { ...props, annualFinancials: annual },
        "ZERO",
        "Revenue growth",
      ),
    );
    expect(text).toContain("Exact prior fiscal year not found");
    expect(text).toContain("1000 USD");
    expect(text).not.toContain("800 USD");
    expect(text).not.toContain("2028-12-31");
    expect(text).not.toContain("Fiscal year 2028");
  });

  it("identifies supplied P/E and its exact valuation date without EPS or filing links", () => {
    const props = loadedComparison();
    const pe = disclosure(
      {
        ...props,
        valuationHistory: valuationHistory(props.selection, "-12.345600"),
      },
      "ZERO",
      "Price / earnings",
    );
    const text = disclosureText(pe);
    expect(text).toContain("provider_price_to_earnings");
    expect(text).toContain("priceToEarnings");
    expect(text).toContain("-12.345600 ratio");
    expect(text).toContain("2030-02-28");
    expect(text).toContain("2030-03-01T15:00:00.000Z");
    expect(text).not.toContain("earnings per share");
    expect(text).not.toContain("EPS");
    expect(text).not.toContain("FY 2029");
    expect(renderToStaticMarkup(pe.element)).not.toContain("href=");
    expect(retainedInputs(pe)).toEqual([
      {
        Field: "priceToEarnings",
        Value: "-12.345600 ratio",
        "Listing ID": "primary",
        "Valuation date": "2030-02-28",
      },
    ]);
  });

  it("preserves a precise operand above the JavaScript safe-integer boundary", () => {
    const props = loadedComparison();
    const annual = replaceAnnualFields(props.annualFinancials, {
      revenue: knownCell("9007199254740993.123456"),
    });
    const revenue = disclosure(
      { ...props, annualFinancials: annual },
      "ZERO",
      "Revenue",
    );
    expect(retainedInputs(revenue)[0]?.Value).toBe(
      "9007199254740993.123456 USD",
    );
    expect(disclosureText(revenue)).toContain("9007199254740993.12 USD");
  });

  it.each(["not loaded", "quarantined", "date mismatch"] as const)(
    "does not invent references or response timestamps when valuation is %s",
    (kind) => {
      const props = loadedComparison();
      const peer = props.peers[0]!;
      const history = peer.valuationHistory!;
      const shiftedPoint = {
        ...history.history.latestPoint,
        date: "2030-02-27",
      };
      const valuation =
        kind === "not loaded"
          ? null
          : kind === "quarantined"
            ? { ...history, asOf: "invalid-response-time" }
            : {
                ...history,
                history: {
                  ...history.history,
                  latestPoint: shiftedPoint,
                  points: [shiftedPoint],
                },
              };
      const text = disclosureText(
        disclosure(
          { ...props, peers: [{ ...peer, valuationHistory: valuation }] },
          "PEER",
          "Price / earnings",
        ),
      );
      expect(text).toContain(
        kind === "not loaded"
          ? "Source not loaded"
          : kind === "quarantined"
            ? "Source quarantined"
            : "Exact valuation date not found",
      );
      expect(text).not.toContain("11 ratio");
      expect(text).not.toContain("2030-02-27");
      expect(text).not.toContain("2030-03-01T15:00:00.000Z");
      expect(text).not.toContain("invalid-response-time");
      expect(text).toContain("No source coordinate was retained");
      expect(text).toContain("No operand references were retained");
    },
  );

  it("retains the unknown provider field without substituting zero", () => {
    const props = loadedComparison();
    const text = disclosureText(
      disclosure(
        {
          ...props,
          valuationHistory: unknownValuationHistory(props.selection),
        },
        "ZERO",
        "Price / earnings",
      ),
    );
    expect(text).toContain("priceToEarnings");
    expect(text).toContain("Unknown");
    expect(text).toContain("Missing input");
    expect(text).not.toContain("0 ratio");
    expect(text).not.toContain("0.0000 ratio");
  });

  it("disambiguates native summaries by listing and escapes admitted display names", () => {
    const props = loadedComparison();
    const peer = {
      ...props.peers[0]!.selection,
      symbol: "ZERO",
      issuerName: '<Peer & "Company">',
    };
    const ready = { ...props, peers: [loadedPeer(peer, "1100")] };
    const details = nativeDisclosures(ready);
    expect(details).toHaveLength(30);
    const labels = details.map(summaryLabel);
    expect(new Set(labels).size).toBe(30);
    expect(labels).toContain("Inspect ZERO Revenue inputs (XNAS · primary)");
    expect(labels).toContain("Inspect ZERO Revenue inputs (XNAS · peer)");
    const markup = render(ready);
    expect(markup).toContain("&lt;Peer &amp; &quot;Company&quot;&gt;");
    expect(markup).not.toContain('<Peer & "Company">');
    for (const node of details) {
      expect(node.props.open).toBeUndefined();
      expect(node.props.onToggle).toBeUndefined();
      expect(node.props.onClick).toBeUndefined();
    }
  });

  it("keeps identical disclosure keys for equal-content responses and unrelated request-status renders", () => {
    const props = loadedComparison();
    const initial = nativeDisclosures(props).map((node) => node.key);
    const cloned = structuredClone(props);
    const busy = {
      ...cloned,
      peers: cloned.peers.map((peer) => ({
        ...peer,
        requestState: "loading" as const,
      })),
    };
    expect(nativeDisclosures(cloned).map((node) => node.key)).toEqual(initial);
    expect(nativeDisclosures(busy).map((node) => node.key)).toEqual(initial);
    expect(initial.every((key) => key !== null)).toBe(true);
  });

  it.each([
    ["exchangeMic", "XNYS"],
    ["issuerId", "issuer-replaced"],
    ["issuerName", "Different issuer"],
    ["listingId", "different-listing"],
    ["securityName", "Different security"],
    ["symbol", "OTHER"],
  ] as const)(
    "replaces the native disclosure key when admitted %s changes",
    (field, value) => {
      const props = loadedComparison();
      const before = disclosure(props, "PEER", "Revenue");
      const peer = { ...props.peers[0]!.selection, [field]: value };
      const after = disclosure(
        { ...props, peers: [loadedPeer(peer, "1100")] },
        peer.symbol,
        "Revenue",
      );
      expect(after.key).not.toBe(before.key);
      expect(after.props.open).toBeUndefined();
    },
  );

  it("quarantines an invalid country instead of inventing a seventh admitted identity variant", () => {
    const props = loadedComparison();
    const peer = {
      ...props.peers[0]!.selection,
      country: "CA",
    } as unknown as PersonalManualPeerSelection;
    const invalid = { ...props, peers: [loadedPeer(peer, "1100")] };
    expect(nativeDisclosures(invalid)).toEqual([]);
    expect(visibleText(render(invalid))).toContain(
      "Manual peer comparison was withheld",
    );
  });

  it.each([
    "operand spelling",
    "operand value",
    "statement date",
    "response timestamp",
    "unavailable operand",
  ] as const)(
    "replaces only affected source disclosures when the %s changes",
    (change) => {
      const props = loadedComparison();
      const annual = props.annualFinancials;
      const changed =
        change === "statement date"
          ? {
              ...annual,
              years: annual.years.map((year, index) =>
                index === 0 ? { ...year, statementDate: "2030-02-15" } : year,
              ),
            }
          : change === "response timestamp"
            ? { ...annual, asOf: "2030-03-01T16:00:00.000Z" }
            : replaceAnnualFields(annual, {
                gross_profit:
                  change === "unavailable operand"
                    ? unknownFinancialCell()
                    : knownCell(
                        change === "operand spelling" ? "500.0000" : "501",
                      ),
              });
      const next = { ...props, annualFinancials: changed };
      expect(disclosure(next, "ZERO", "Gross margin").key).not.toBe(
        disclosure(props, "ZERO", "Gross margin").key,
      );
      expect(disclosure(next, "ZERO", "Price / earnings").key).toBe(
        disclosure(props, "ZERO", "Price / earnings").key,
      );
      expect(disclosure(next, "PEER", "Gross margin").key).toBe(
        disclosure(props, "PEER", "Gross margin").key,
      );
    },
  );

  it("keys growth by its prior operand even when the rounded result is unchanged", () => {
    const props = loadedComparison();
    const annual = props.annualFinancials;
    const changed = {
      ...annual,
      years: annual.years.map((year, index) =>
        index === 1
          ? {
              ...year,
              statementDate: "2029-02-20",
              reported: { ...year.reported, revenue: knownCell("800.0000") },
            }
          : year,
      ),
    };
    const next = { ...props, annualFinancials: changed };
    expect(disclosure(next, "ZERO", "Revenue growth").key).not.toBe(
      disclosure(props, "ZERO", "Revenue growth").key,
    );
    expect(disclosure(next, "ZERO", "Gross margin").key).toBe(
      disclosure(props, "ZERO", "Gross margin").key,
    );
  });

  it.each(["remove peer", "clear company", "quarantine"] as const)(
    "removes native disclosures for %s and renders fresh uncontrolled markup on return",
    (transition) => {
      const props = loadedComparison();
      const before = disclosure(props, "PEER", "Revenue");
      const absent =
        transition === "remove peer"
          ? { ...props, peers: [] }
          : transition === "clear company"
            ? { ...props, selection: null }
            : { ...props, peers: [props.peers[0]!, props.peers[0]!] };
      expect(nativeDisclosures(absent)).toEqual([]);
      const returned = disclosure(structuredClone(props), "PEER", "Revenue");
      expect(returned.key).toBe(before.key);
      expect(returned).not.toBe(before);
      expect(renderToStaticMarkup(returned.element)).not.toMatch(
        /<details[^>]*\sopen(?:=|\s|>)/u,
      );
      // Real mounted native open-state disposal/reconciliation is covered in Brave.
      // These assertions establish the actual React key and absence/return contract.
    },
  );
});

describe("manual peer annual quality integration", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps quality output behind peer presence and whole-group admission", () => {
    const props = loadedComparison();
    const noPeers = { ...props, peers: [] };
    expect(qualityTable(noPeers)).toBeUndefined();
    expect(visibleText(render(noPeers))).toContain("Add the first peer");
    const duplicateIssuer = {
      ...props.peers[0]!.selection,
      issuerId: props.selection.issuerId,
    };
    const quarantined = {
      ...props,
      peers: [loadedPeer(duplicateIssuer, "1100")],
    };
    expect(qualityTable(quarantined)).toBeUndefined();
    expect(visibleText(render(quarantined))).toContain(
      "Manual peer comparison was withheld",
    );
    expect(render(quarantined)).not.toContain("Inspect PEER");
  });

  it("requires the primary annual anchor even when valuation metrics are ready", () => {
    const props = { ...loadedComparison(), annualFinancials: null };
    expect(qualityTable(props)).toBeUndefined();
    expect(nativeDisclosures(props)).toHaveLength(30);
    expect(
      disclosureText(disclosure(props, "ZERO", "Price / earnings")),
    ).toContain("10");
  });

  it("adds twelve checks per admitted company without changing the fifteen metrics", () => {
    const props = loadedComparison();
    const table = qualityTable(props);
    expect(table).toBeDefined();
    const summaries = hostElements(table).filter(
      (node) => node.type === "summary",
    );
    expect(summaries).toHaveLength(24);
    const labels = summaries.map((node) => node.props["aria-label"]);
    expect(new Set(labels).size).toBe(24);
    expect(
      labels.filter((label) => String(label).startsWith("Inspect ZERO ")),
    ).toHaveLength(12);
    expect(
      labels.filter((label) => String(label).startsWith("Inspect PEER ")),
    ).toHaveLength(12);
    expect(nativeDisclosures(props)).toHaveLength(30);
    expect(disclosureText(disclosure(props, "PEER", "Revenue"))).toContain(
      "1100",
    );
  });

  it("uses annual-only sources and preserves each company's own statement date", () => {
    const props = loadedComparison();
    const peer = props.peers[0]!;
    const peerAnnual = peer.annualFinancials!;
    const differentDates = annualWithYears(
      peerAnnual,
      peerAnnual.years.map((year, index) => ({
        ...year,
        statementDate: index === 0 ? "2029-09-30" : "2028-09-30",
      })),
    );
    const annualOnly = {
      ...props,
      valuationHistory: null,
      peers: [
        { ...peer, annualFinancials: differentDates, valuationHistory: null },
      ],
    };
    const table = qualityTable(annualOnly);
    expect(table).toBeDefined();
    expect(
      hostElements(table).filter((node) => node.type === "details"),
    ).toHaveLength(24);
    const text = visibleText(renderToStaticMarkup(table));
    expect(text).toContain("2029-12-31");
    expect(text).toContain("2029-09-30");
    expect(text).toContain("2028-09-30");
  });

  it("withholds a newer peer's quality checks rather than rebasing its older matching year", () => {
    const props = loadedComparison();
    const peer = props.peers[0]!;
    const peerAnnual = annualWithYears(peer.annualFinancials!, [
      financialYear(2030, "1900", "2030-01-31"),
      financialYear(2029, "1100", "2029-01-31"),
    ]);
    const mismatch = {
      ...props,
      peers: [{ ...peer, annualFinancials: peerAnnual }],
    };
    const table = qualityTable(mismatch);
    expect(table).toBeDefined();
    const text = visibleText(renderToStaticMarkup(table));
    expect(text).toContain(
      "Latest annual fiscal year differs from the selected company's year",
    );
    expect(
      hostElements(table).filter((node) => node.type === "details"),
    ).toHaveLength(12);
    // The independently existing metric comparison still uses its exact FY2029 anchor.
    expect(disclosureText(disclosure(mismatch, "PEER", "Revenue"))).toContain(
      "1100",
    );
    expect(
      disclosureText(disclosure(mismatch, "PEER", "Revenue")),
    ).not.toContain("1900");
  });

  it("admits the entire source before deriving quality, including unused hidden periods", () => {
    const props = loadedComparison();
    const peer = props.peers[0]!;
    const hidden = financialYear(2027, "700", "2027-12-31");
    const malformed = {
      ...hidden,
      reported: {
        ...hidden.reported,
        cost_of_revenue: knownCell("not-a-decimal"),
      },
    };
    const source = annualWithYears(peer.annualFinancials!, [
      ...peer.annualFinancials!.years,
      malformed,
    ]);
    const input = { ...props, peers: [{ ...peer, annualFinancials: source }] };
    const table = qualityTable(input);
    expect(table).toBeDefined();
    const text = visibleText(renderToStaticMarkup(table));
    expect(text.toLowerCase()).toContain("quarantined");
    expect(text).not.toContain("not-a-decimal");
    expect(
      hostElements(table).filter((node) => node.type === "details"),
    ).toHaveLength(12);
  });

  it.each([
    ["exchangeMic", "XNYS"],
    ["issuerName", "Replacement issuer"],
    ["securityName", "Replacement security"],
    ["symbol", "NEW"],
  ] as const)(
    "does not reuse a same-listing source after %s changes",
    (field, value) => {
      const props = loadedComparison();
      const peer = props.peers[0]!;
      const changed = {
        ...props,
        peers: [{ ...peer, selection: { ...peer.selection, [field]: value } }],
      };
      const table = qualityTable(changed);
      expect(table).toBeDefined();
      expect(visibleText(renderToStaticMarkup(table)).toLowerCase()).toContain(
        "quarantined",
      );
      expect(
        hostElements(table).filter((node) => node.type === "details"),
      ).toHaveLength(12);
    },
  );

  it("drops old checks on removal, reset and restored unloaded sources without invoking IO callbacks", () => {
    const fetch = vi.fn();
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("localStorage", storage);
    const callbacks = {
      onAddPeer: vi.fn(),
      onLoadPeerData: vi.fn(),
      onRemovePeer: vi.fn(),
    };
    const props = freezeDeep({ ...loadedComparison(), ...callbacks });
    expect(
      hostElements(qualityTable(props)).filter(
        (node) => node.type === "details",
      ),
    ).toHaveLength(24);
    expect(qualityTable({ ...props, peers: [] })).toBeUndefined();
    expect(qualityTable({ ...props, selection: null })).toBeUndefined();
    const restored = {
      ...props,
      peers: [peerState(props.peers[0]!.selection)],
    };
    const table = qualityTable(restored);
    expect(table).toBeDefined();
    expect(
      hostElements(table).filter((node) => node.type === "details"),
    ).toHaveLength(12);
    expect(visibleText(renderToStaticMarkup(table)).toLowerCase()).toContain(
      "not loaded",
    );
    for (const callback of Object.values(callbacks))
      expect(callback).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    for (const method of Object.values(storage))
      expect(method).not.toHaveBeenCalled();
  });
});

function qualityTable(props: Partial<PersonalManualPeerComparisonProps>) {
  return hostElements(comparisonElement(props)).find(
    (node) =>
      node.type === "table" &&
      node.props["aria-label"] ===
        "Annual quality checks across selected companies",
  );
}

function peerMoveButtons(props: Partial<PersonalManualPeerComparisonProps>) {
  return hostElements(comparisonElement(props)).filter(
    (node) =>
      node.type === "button" &&
      /^Move (earlier|later): /u.test(String(node.props["aria-label"])),
  );
}

function activateButton(button: HostElement): void {
  if (typeof button.props.onClick !== "function")
    throw new Error("Missing button action");
  (button.props.onClick as () => void)();
}

function render(
  overrides: Partial<PersonalManualPeerComparisonProps> = {},
): string {
  return renderToStaticMarkup(comparisonElement(overrides));
}

function comparisonElement(
  overrides: Partial<PersonalManualPeerComparisonProps>,
) {
  return (
    <PersonalManualPeerComparison
      annualFinancials={null}
      candidates={[]}
      onAddPeer={vi.fn()}
      onLoadPeerData={vi.fn()}
      onMovePeer={vi.fn(() => false)}
      onRemovePeer={vi.fn()}
      peers={[]}
      providerStatus={providerStatus()}
      range="1y"
      selection={null}
      valuationHistory={null}
      {...overrides}
    />
  );
}

type HostElement = ReactElement<
  Record<string, unknown> & { readonly children?: ReactNode }
>;
interface Disclosure {
  readonly element: HostElement;
  readonly key: string | null;
  readonly props: HostElement["props"];
}

function hostElements(node: ReactNode): HostElement[] {
  if (Array.isArray(node)) return node.flatMap(hostElements);
  if (!isValidElement<HostElement["props"]>(node)) return [];
  if (typeof node.type === "function") {
    return hostElements(
      (node.type as (props: HostElement["props"]) => ReactNode)(node.props),
    );
  }
  return [node, ...hostElements(node.props.children)];
}

function nativeDisclosures(
  props: Partial<PersonalManualPeerComparisonProps>,
  className = "manual-peer-metric-inputs",
): Disclosure[] {
  // Inspect real React keys at the boundary that mounts each native details node.
  // This does not emulate DOM reconciliation or native open-state behavior.
  function visit(node: ReactNode, ancestorKey: string | null): Disclosure[] {
    if (Array.isArray(node))
      return (node as ReactNode[]).flatMap((child) =>
        visit(child, ancestorKey),
      );
    if (!isValidElement<HostElement["props"]>(node)) return [];
    const key = node.key ?? ancestorKey;
    if (typeof node.type === "function") {
      return visit(
        (node.type as (props: HostElement["props"]) => ReactNode)(node.props),
        key,
      );
    }
    if (node.type === "details" && node.props.className === className)
      return [{ element: node, key, props: node.props }];
    return visit(node.props.children, key);
  }
  return visit(comparisonElement(props), null);
}

function summaryLabel(node: Disclosure): string {
  const summary = hostElements(node.props.children).find(
    (child) => child.type === "summary",
  );
  if (!summary) throw new Error("Missing native summary");
  const label = summary.props["aria-label"];
  return typeof label === "string"
    ? label
    : visibleText(renderToStaticMarkup(summary));
}

function disclosure(
  props: Partial<PersonalManualPeerComparisonProps>,
  symbol: string,
  metric: string,
): Disclosure {
  const result = nativeDisclosures(props).find((node) =>
    summaryLabel(node).startsWith(`Inspect ${symbol} ${metric} inputs`),
  );
  if (!result) throw new Error(`Missing ${symbol} ${metric} disclosure`);
  return result;
}

function disclosureText(node: Disclosure): string {
  return visibleText(renderToStaticMarkup(node.element));
}

function retainedInputs(node: Disclosure): Record<string, string>[] {
  return hostElements(node.props.children)
    .filter((element) => element.type === "li")
    .map((item) => {
      const terms = hostElements(item.props.children).filter(
        (element) => element.type === "dt" || element.type === "dd",
      );
      return Object.fromEntries(
        terms.flatMap((term, index) =>
          term.type === "dt"
            ? [
                [
                  visibleText(renderToStaticMarkup(term)),
                  visibleText(renderToStaticMarkup(terms[index + 1])),
                ],
              ]
            : [],
        ),
      );
    });
}

function loadedComparison() {
  const primary = selection("primary", "ZERO", "issuer-primary");
  return {
    selection: primary,
    annualFinancials: annualFinancials(primary, "1000"),
    valuationHistory: valuationHistory(primary, "10"),
    peers: [loadedPeer(selection("peer", "PEER", "issuer-peer"), "1100")],
  };
}

function replaceAnnualFields(
  annual: PersonalAnnualFinancialsDto,
  fields: Partial<PersonalAnnualFinancialReportedValuesDto>,
): PersonalAnnualFinancialsDto {
  return annualWithYears(
    annual,
    annual.years.map((year, index) =>
      index === 0
        ? { ...year, reported: { ...year.reported, ...fields } }
        : year,
    ),
  );
}

function annualWithYears(
  annual: PersonalAnnualFinancialsDto,
  years: PersonalAnnualFinancialsDto["years"],
): PersonalAnnualFinancialsDto {
  const known = years
    .flatMap((year) => Object.values(year.reported))
    .filter((cell) => cell.status === "known").length;
  return {
    ...annual,
    years,
    coverage: {
      ...annual.coverage,
      earliestFiscalYear: Math.min(...years.map((year) => year.fiscalYear)),
      latestFiscalYear: Math.max(...years.map((year) => year.fiscalYear)),
      knownReportedCells: known,
      unknownReportedCells:
        years.length * PERSONAL_FINANCIAL_REPORTED_FIELDS.length - known,
      returnedAnnualYears: years.length,
      missingFiscalYears: Array.from(
        { length: 10 },
        (_, index) => Math.max(...years.map((year) => year.fiscalYear)) - index,
      ).filter(
        (year) => !years.some((candidate) => candidate.fiscalYear === year),
      ),
      status: "partial",
    },
  };
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
