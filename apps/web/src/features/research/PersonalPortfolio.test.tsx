import type {
  PersonalMarketOverviewDto,
  PersonalPortfolioIdentity,
  PersonalPortfolioPayload,
  PersonalPortfolioLedgerPayload,
  PersonalPortfolioStoredPayload,
} from "@research-cockpit/contracts";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "@/lib/personal-workspace-api";
import {
  PersonalPortfolio,
  type PersonalPortfolioProps,
} from "./PersonalPortfolio";
import type { PersonalPortfolioHistoryCoverageProps } from "./PersonalPortfolioHistoryCoverage";

const api = vi.hoisted(() => ({
  fetchPersonalPortfolio: vi.fn(),
  savePersonalPortfolio: vi.fn(),
  fetchPersonalMarketOverview: vi.fn(),
  searchPersonalSecurities: vi.fn(),
}));
vi.mock("./PersonalPortfolioLedgerEditor", () => ({
  PersonalPortfolioLedgerEditor: (editorProps: {
    ledger: PersonalPortfolioLedgerPayload;
    disabled: boolean;
    onChange: (next: PersonalPortfolioLedgerPayload) => void;
    onPendingEditsChange: (pending: boolean) => void;
  }) =>
    React.createElement(
      "div",
      {
        "data-ledger": editorProps.ledger,
        "data-ledger-disabled": editorProps.disabled,
      },
      React.createElement(
        "button",
        { onClick: () => editorProps.onPendingEditsChange(true) },
        "Test stage transaction",
      ),
      React.createElement(
        "button",
        { onClick: () => editorProps.onPendingEditsChange(false) },
        "Test reset staged transaction",
      ),
      React.createElement(
        "button",
        {
          onClick: () =>
            editorProps.onChange({
              ...editorProps.ledger,
              transactions: [
                ...editorProps.ledger.transactions,
                {
                  id: "test-deposit",
                  date: "2026-09-09",
                  type: "deposit",
                  listingId: null,
                  shares: null,
                  grossUsd: "25",
                  feeUsd: "0",
                },
              ],
            } as PersonalPortfolioLedgerPayload),
        },
        "Test ledger deposit",
      ),
      React.createElement(
        "button",
        {
          onClick: () =>
            editorProps.onChange({
              ...editorProps.ledger,
              schemaVersion: 3,
              transactions: [
                ...editorProps.ledger.transactions,
                {
                  id: "test-split-correction",
                  date: "2026-09-09",
                  type: "split",
                  listingId: "listing-one",
                  ratioNumerator: "2",
                  ratioDenominator: "1",
                },
              ],
            }),
        },
        "Test ledger split correction",
      ),
    ),
}));
vi.mock("./PersonalPortfolioHistoryCoverage", () => ({
  PersonalPortfolioHistoryCoverage: (
    historyProps: PersonalPortfolioHistoryCoverageProps,
  ) => {
    latestHistoryProps = historyProps;
    return React.createElement(
      "div",
      { "data-history-disabled": historyProps.disabled },
      "Test history panel",
    );
  },
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => harness.useState(initial),
  useRef: <T,>(initial: T) => harness.useRef(initial),
  useEffect: (
    effect: () => (() => void) | void,
    deps: readonly unknown[] | undefined,
  ) => harness.useEffect(effect, deps),
}));
vi.mock("@/lib/personal-portfolio-api", () => ({
  fetchPersonalPortfolio: api.fetchPersonalPortfolio,
  savePersonalPortfolio: api.savePersonalPortfolio,
}));
vi.mock("@/lib/personal-workspace-api", async () => ({
  ...(await import("../../lib/personal-workspace-api")),
  fetchPersonalMarketOverview: api.fetchPersonalMarketOverview,
  searchPersonalSecurities: api.searchPersonalSecurities,
}));

let props: PersonalPortfolioProps;
let latestHistoryProps: PersonalPortfolioHistoryCoverageProps | null = null;
beforeEach(() => {
  latestHistoryProps = null;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09T10:00:00.000Z"));
  harness.reset();
  api.fetchPersonalPortfolio.mockReset().mockResolvedValue(record());
  api.savePersonalPortfolio.mockReset().mockResolvedValue({ version: 2 });
  api.fetchPersonalMarketOverview.mockReset().mockResolvedValue(market());
  api.searchPersonalSecurities
    .mockReset()
    .mockResolvedValue(search([identity()]));
  props = {
    catalogSnapshotSha256: digest("a"),
    enabled: true,
    selectedListing: identity(),
    onSessionUnavailable: vi.fn(),
    onOpenResearch: vi.fn(),
  };
});
afterEach(() => {
  harness.unmount();
  vi.useRealTimers();
});

describe("PersonalPortfolio", () => {
  it("reopens V3 split holdings and applies current catalog admission before pricing", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(
      record({
        ...ledger(),
        schemaVersion: 3,
        transactions: [
          {
            id: "manual-split",
            date: "2026-09-09",
            type: "split",
            listingId: "listing-one",
            ratioNumerator: "2",
            ratioDenominator: "1",
          },
        ],
      }),
    );
    await load();
    expect(input(render(), "Shares for ONE").props.value).toBe("4");
    expect(input(render(), "Total cost basis for ONE").props.value).toBe(
      "80.00",
    );
    click(render(), "Refresh portfolio prices");
    await flush();
    expect(api.searchPersonalSecurities).toHaveBeenCalled();
    expect(metric(render(), "Total value including cash")).toBe("210.00 USD");
  });

  it("retains known split warnings outside a shorter review and withholds affected values", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(record(ledger()));
    await load();
    click(render(), "Refresh portfolio prices");
    await flush();
    expect(metric(render(), "Total value including cash")).toBe("135.00 USD");
    reportHistory(["2026-09-09"], ["2026-09-09"]);
    expect(metric(render(), "Total value including cash")).toBe("Unavailable");
    expect(text(render())).toContain(
      "History review found split discrepancies",
    );
    expect(latestHistoryProps?.priorSplitReviewDates).toEqual({
      "listing-one": ["2026-09-09"],
    });
    reportHistory(["2026-09-10"], []);
    expect(metric(render(), "Total value including cash")).toBe("Unavailable");
    click(render(), "Refresh portfolio prices");
    await flush();
    expect(metric(render(), "Total value including cash")).toBe("Unavailable");
    reportHistory(["2026-09-09"], []);
    expect(metric(render(), "Total value including cash")).toBe("135.00 USD");
  });

  it("ignores a history callback from an old ledger and clears private history on session loss", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(record(ledger()));
    await load();
    text(render());
    const oldHistory = latestHistoryProps;
    if (!oldHistory) throw new Error("History props unavailable");
    click(render(), "Test ledger deposit");
    text(render());
    reportHistory(["2026-09-09"], ["2026-09-09"], oldHistory);
    expect(text(render())).not.toContain(
      "History review found split discrepancies",
    );
    latestHistoryProps?.onSessionUnavailable();
    expect(props.onSessionUnavailable).toHaveBeenCalledOnce();
    expect(text(render())).not.toContain("Test history panel");
  });

  it("retains known split warnings across an unrelated deposit and a successful save", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(record(ledger()));
    await load();
    text(render());
    reportHistory(["2026-09-09"], ["2026-09-09"]);
    click(render(), "Test ledger deposit");
    expect(text(render())).toContain(
      "History review found split discrepancies",
    );
    click(render(), "Refresh portfolio prices");
    await flush();
    expect(metric(render(), "Total value including cash")).toBe("Unavailable");
    click(render(), "Save My Portfolio");
    await flush();
    expect(text(render())).toContain("Saved version 2");
    expect(text(render())).toContain(
      "History review found split discrepancies",
    );
    click(render(), "Refresh portfolio prices");
    await flush();
    expect(metric(render(), "Total value including cash")).toBe("Unavailable");
    reportHistory(["2026-09-09"], []);
    expect(metric(render(), "Total value including cash")).toBe("160.00 USD");
  });

  it("requires a fresh assessment of the affected date after correcting a split", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(record(ledger()));
    await load();
    text(render());
    reportHistory(["2026-09-09"], ["2026-09-09"]);
    click(render(), "Test ledger split correction");
    expect(input(render(), "Shares for ONE").props.value).toBe("4");
    click(render(), "Refresh portfolio prices");
    await flush();
    expect(metric(render(), "Total value including cash")).toBe("Unavailable");
    reportHistory(["2026-09-10"], []);
    expect(metric(render(), "Total value including cash")).toBe("Unavailable");
    reportHistory(["2026-09-09"], []);
    expect(metric(render(), "Total value including cash")).toBe("235.00 USD");
  });

  it("keeps a visible valuation warning after discarding conversion back to a manual snapshot", async () => {
    await load();
    change(render(), "Opening balances as of", "2026-09-08");
    click(render(), "Start transaction ledger");
    text(render());
    reportHistory(["2026-09-09"], ["2026-09-09"]);
    click(render(), "Discard edits and reload");
    await flush();
    expect(text(render())).not.toContain("Test history panel");
    const rendered = text(render());
    expect(rendered).toContain("History review found split discrepancies");
    expect(
      rendered.indexOf("History review found split discrepancies"),
    ).toBeLessThan(rendered.indexOf("Portfolio overview"));
    click(render(), "Refresh portfolio prices");
    await flush();
    expect(metric(render(), "Total value including cash")).toBe("Unavailable");
    click(render(), "Remove ONE");
    expect(text(render())).not.toContain(
      "History review found split discrepancies",
    );
    click(render(), "Add selected holding");
    expect(text(render())).toContain(
      "History review found split discrepancies",
    );
  });

  it("clears known split warnings only with private session state", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(record(ledger()));
    await load();
    text(render());
    reportHistory(["2026-09-09"], ["2026-09-09"]);
    expect(text(render())).toContain(
      "History review found split discrepancies",
    );
    latestHistoryProps?.onSessionUnavailable();
    await load();
    expect(text(render())).not.toContain(
      "History review found split discrepancies",
    );
    click(render(), "Refresh portfolio prices");
    await flush();
    expect(metric(render(), "Total value including cash")).toBe("135.00 USD");
  });

  it("disables history review while ledger inputs are staged", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(record(ledger()));
    await load();
    click(render(), "Test stage transaction");
    text(render());
    expect(latestHistoryProps?.disabled).toBe(true);
    click(render(), "Test reset staged transaction");
    text(render());
    expect(latestHistoryProps?.disabled).toBe(false);
  });
  it("requires staged ledger inputs to be applied or reset before save and reload", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(record(ledger()));
    await load();
    click(render(), "Test ledger deposit");
    click(render(), "Test stage transaction");
    expect(button(render(), "Save My Portfolio").props.disabled).toBe(true);
    expect(button(render(), "Reload saved portfolio").props.disabled).toBe(
      true,
    );
    expect(text(render())).toContain("Apply or reset the staged transaction");
    click(render(), "Test reset staged transaction");
    expect(button(render(), "Save My Portfolio").props.disabled).toBe(false);
    click(render(), "Test stage transaction");
    click(render(), "Discard edits and reload");
    await flush();
    expect(input(render(), "Portfolio cash balance").props.value).toBe("35.00");
    expect(text(render())).not.toContain(
      "Apply or reset the staged transaction",
    );
  });
  it("converts explicitly, preserves unknown opening values, and saves the ledger only on Save", async () => {
    const snapshot = portfolio();
    api.fetchPersonalPortfolio.mockResolvedValue(
      record({
        ...snapshot,
        cashUsd: null,
        holdings: snapshot.holdings.map((holding) => ({
          ...holding,
          totalCostBasisUsd: null,
        })),
      }),
    );
    await load();
    change(render(), "Opening balances as of", "2026-09-08");
    click(render(), "Start transaction ledger");
    expect(api.savePersonalPortfolio).not.toHaveBeenCalled();
    expect(text(render())).toContain("Transaction ledger");
    expect(input(render(), "Shares for ONE").props).toMatchObject({
      value: "2",
      readOnly: true,
    });
    click(render(), "Test ledger deposit");
    expect(input(render(), "Portfolio cash balance").props.value).toBe("");
    click(render(), "Save My Portfolio");
    await flush();
    expect(api.savePersonalPortfolio.mock.calls[0]?.[0]).toMatchObject({
      schemaVersion: 2,
      basisMethod: "fifo_with_opening_pool",
      opening: {
        asOfDate: "2026-09-08",
        cashUsd: null,
        holdings: [
          {
            listingId: "listing-one",
            shares: "2",
            totalCostBasisUsd: null,
            confirmedOn: "2026-09-08",
          },
        ],
      },
      transactions: [{ id: "test-deposit" }],
    });
    expect(api.savePersonalPortfolio.mock.calls[0]?.[0]).not.toHaveProperty(
      "holdings",
    );
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
  });

  it("rejects opening conversion before confirmation or in the future", async () => {
    await load();
    for (const date of ["2026-09-07", "2026-09-10", "2026-02-30"]) {
      change(render(), "Opening balances as of", date);
      click(render(), "Start transaction ledger");
      expect(text(render())).toContain("Enter a real opening date");
      expect(text(render())).toContain("Holdings snapshot");
    }
  });

  it("reopens a saved ledger, prices only current admitted identities, and derives cash", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(record(ledger()));
    await load();
    expect(button(render(), "Save My Portfolio").props.disabled).toBe(true);
    expect(button(render(), "Research ONE").props.disabled).toBe(true);
    expect(input(render(), "Portfolio cash balance").props.value).toBe("35.00");
    click(render(), "Refresh portfolio prices");
    await flush();
    expect(api.searchPersonalSecurities).toHaveBeenCalledWith(
      "ONE",
      expect.any(AbortSignal),
      25,
    );
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    expect(metric(render(), "Total value including cash")).toBe("135.00 USD");
    click(render(), "Research ONE");
    expect(props.onOpenResearch).toHaveBeenCalledWith(identity());
  });

  it("retains unmatched historical identities through catalog review without pricing a changed security", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(
      record({ ...ledger(), snapshotSha256: digest("b") }),
    );
    api.searchPersonalSecurities.mockResolvedValue(
      search([{ ...identity(), securityId: "different-security" }]),
    );
    await load();
    click(render(), "Preview portfolio reconciliation");
    await flush();
    expect(text(render())).toContain("Unmatched; preserved");
    click(render(), "Apply ledger identity review");
    click(render(), "Refresh portfolio prices");
    await flush();
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(text(render())).toContain(
      "Historical identity is not available in the current catalog",
    );
    expect(button(render(), "Research ONE").props.disabled).toBe(true);
    click(render(), "Save My Portfolio");
    await flush();
    expect(api.savePersonalPortfolio.mock.calls[0]?.[0]).toEqual(ledger());
  });

  it("cancels historical admission reads and clears the ledger on owner session loss", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(record(ledger()));
    const pending = deferred<ReturnType<typeof search>>();
    api.searchPersonalSecurities.mockReturnValue(pending.promise);
    await load();
    click(render(), "Refresh portfolio prices");
    const signal = api.searchPersonalSecurities.mock
      .calls[0]?.[1] as AbortSignal;
    props = { ...props, enabled: false };
    render();
    pending.resolve(search([identity()]));
    await flush();
    expect(signal.aborted).toBe(true);
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    expect(text(render())).not.toContain("Transaction ledger");
    expect(
      elements(render()).some((element) => element.props["data-ledger"]),
    ).toBe(false);
  });

  it("requires explicit load, creates a manual snapshot, and saves only owner-entered holdings", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(null);
    await mount();
    expect(api.fetchPersonalPortfolio).not.toHaveBeenCalled();
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
    click(render(), "Load My Portfolio");
    await flush();
    click(render(), "Add selected holding");
    expect(button(render(), "Save My Portfolio").props.disabled).toBe(true);
    change(render(), "Shares for ONE", "2.500000");
    change(render(), "Total cost basis for ONE", "100.25");
    change(render(), "Portfolio cash balance", "0");
    click(render(), "Save My Portfolio");
    await flush();
    expect(api.savePersonalPortfolio).toHaveBeenCalledWith(
      {
        schemaVersion: 1,
        name: "My Portfolio",
        currency: "USD",
        snapshotSha256: digest("a"),
        cashUsd: "0",
        holdings: [
          {
            identity: identity(),
            shares: "2.500000",
            totalCostBasisUsd: "100.25",
            confirmedOn: "2026-09-09",
          },
        ],
      },
      null,
      expect.any(String),
      expect.any(AbortSignal),
    );
    expect(text(render())).toContain(
      "My Portfolio saved to encrypted local storage.",
    );
    expect(api.fetchPersonalMarketOverview).not.toHaveBeenCalled();
  });

  it("keeps unknown money separate from explicit zero and routes research with the admitted identity", async () => {
    await load();
    change(render(), "Total cost basis for ONE", "");
    change(render(), "Portfolio cash balance", "");
    click(render(), "Research ONE");
    expect(props.onOpenResearch).toHaveBeenCalledWith(identity());
    click(render(), "Save My Portfolio");
    await flush();
    expect(api.savePersonalPortfolio.mock.calls[0]?.[0]).toMatchObject({
      cashUsd: null,
      holdings: [{ totalCostBasisUsd: null }],
    });
    expect(text(render())).toContain(
      "Blank means unknown. Enter 0 when there is no cash.",
    );
  });

  it.each([
    ["Shares for ONE", "0"],
    ["Shares for ONE", "-1"],
    ["Shares for ONE", "1000000000.000001"],
    ["Shares for ONE", "0.0000001"],
    ["Shares for ONE", "1e2"],
    ["Shares for ONE", "01"],
    ["Total cost basis for ONE", "-1"],
    ["Total cost basis for ONE", "1.001"],
    ["Portfolio cash balance", "1000000000000.01"],
    ["Shares confirmed on for ONE", "2026-02-30"],
    ["Shares confirmed on for ONE", "2026-09-10"],
    ["Shares confirmed on for ONE", "0001-01-01"],
  ])(
    "rejects invalid manual input in %s (%s) before saving or valuation",
    async (label, value) => {
      await load();
      change(render(), label, value);
      expect(() => render()).not.toThrow();
      expect(button(render(), "Save My Portfolio").props.disabled).toBe(true);
      expect(button(render(), "Refresh portfolio prices").props.disabled).toBe(
        true,
      );
      expect(api.savePersonalPortfolio).not.toHaveBeenCalled();
    },
  );

  it("caps the snapshot at twenty holdings and rejects adding the same listing twice", async () => {
    await load();
    expect(button(render(), "Add selected holding").props.disabled).toBe(true);
    const payload = portfolio(20);
    api.fetchPersonalPortfolio.mockResolvedValue(record(payload));
    click(render(), "Reload saved portfolio");
    await flush();
    props = { ...props, selectedListing: identity(21) };
    expect(button(render(), "Add selected holding").props.disabled).toBe(true);
    expect(text(render())).toContain("20 of 20 holdings");
  });

  it("preserves edits on a save conflict until explicit discard and reload", async () => {
    api.savePersonalPortfolio.mockRejectedValue(
      new PersonalWorkspaceApiError("conflict"),
    );
    await load();
    change(render(), "Shares for ONE", "9");
    click(render(), "Save My Portfolio");
    await flush();
    expect(input(render(), "Shares for ONE").props.value).toBe("9");
    expect(text(render())).toContain("Your edits are preserved.");
    expect(button(render(), "Save My Portfolio").props.disabled).toBe(true);
    expect(button(render(), "Reload saved portfolio").props.disabled).toBe(
      true,
    );
    click(render(), "Discard edits and reload");
    await flush();
    expect(input(render(), "Shares for ONE").props.value).toBe("2");
    expect(api.fetchPersonalPortfolio).toHaveBeenCalledTimes(2);
  });

  it("reuses the idempotency key after an uncertain save and changes it for different edits", async () => {
    api.savePersonalPortfolio.mockRejectedValue(
      new PersonalWorkspaceApiError("unavailable"),
    );
    await load();
    change(render(), "Shares for ONE", "3");
    click(render(), "Save My Portfolio");
    await flush();
    click(render(), "Save My Portfolio");
    await flush();
    expect(api.savePersonalPortfolio.mock.calls[1]?.[2]).toBe(
      api.savePersonalPortfolio.mock.calls[0]?.[2],
    );
    expect(api.savePersonalPortfolio.mock.calls[1]?.[1]).toBe(1);
    change(render(), "Shares for ONE", "4");
    click(render(), "Save My Portfolio");
    await flush();
    expect(api.savePersonalPortfolio.mock.calls[2]?.[2]).not.toBe(
      api.savePersonalPortfolio.mock.calls[0]?.[2],
    );
  });

  it("requests prices sequentially and labels a partial priced subtotal without inventing a complete total", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(record(portfolio(2)));
    const first = deferred<PersonalMarketOverviewDto>();
    api.fetchPersonalMarketOverview
      .mockReturnValueOnce(first.promise)
      .mockRejectedValueOnce(new PersonalWorkspaceApiError("not_covered"));
    await load();
    click(render(), "Refresh portfolio prices");
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    first.resolve(market());
    await flush();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(2);
    expect(api.fetchPersonalMarketOverview.mock.calls[0]?.[0]).toEqual({
      listingId: "listing-one",
      symbol: "ONE",
      range: "1m",
    });
    expect(text(render())).toContain(
      "1 of 2 holdings priced · 0 stale · 1 unavailable",
    );
    expect(metric(render(), "Priced holdings subtotal")).toBe("100.00 USD");
    expect(metric(render(), "Cost basis of priced holdings")).toBe("80.00 USD");
    expect(metric(render(), "Unrealized gain / loss of priced holdings")).toBe(
      "20.00 USD (25.00%)",
    );
    expect(metric(render(), "Total value including cash")).toBe("Unavailable");
    expect(text(render())).toContain("Price request unavailable");
    expect(text(render())).toContain("Source 2026-09-09 09:59:00.000 UTC");
    expect(api.savePersonalPortfolio).not.toHaveBeenCalled();
  });

  it("ages reference quotes out of complete totals without fetching again", async () => {
    const observation = market();
    api.fetchPersonalMarketOverview.mockResolvedValue({
      ...observation,
      quote: { ...observation.quote, sourceTime: "2026-09-07T22:00:30.000Z" },
    });
    await load();
    click(render(), "Refresh portfolio prices");
    await flush();
    expect(metric(render(), "Total value including cash")).toBe("110.00 USD");
    vi.advanceTimersByTime(60_000);
    expect(text(render())).toContain(
      "0 of 1 holdings priced · 1 stale · 0 unavailable",
    );
    expect(metric(render(), "Total value including cash")).toBe("Unavailable");
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
  });

  it.each([
    "not_configured",
    "credentials_invalid",
    "not_entitled",
    "rate_limited",
  ] as const)("stops the batch when provider access is %s", async (code) => {
    api.fetchPersonalPortfolio.mockResolvedValue(record(portfolio(2)));
    api.fetchPersonalMarketOverview.mockRejectedValue(
      new PersonalWorkspaceApiError(code),
    );
    await load();
    click(render(), "Refresh portfolio prices");
    await flush();
    expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
    expect(text(render())).toContain(
      code === "not_configured"
        ? "Tiingo is not configured"
        : code === "rate_limited"
          ? "Tiingo rate limited the price check"
          : "Tiingo access was not accepted",
    );
    expect(button(render(), "Refresh portfolio prices").props.disabled).toBe(
      false,
    );
  });

  it.each(["edit", "remove", "cancel", "catalog", "session", "unmount"])(
    "aborts a price request and ignores its late result after %s",
    async (kind) => {
      api.fetchPersonalPortfolio.mockResolvedValue(record(portfolio(2)));
      const pending = deferred<PersonalMarketOverviewDto>();
      api.fetchPersonalMarketOverview.mockReturnValue(pending.promise);
      await load();
      click(render(), "Refresh portfolio prices");
      const signal = api.fetchPersonalMarketOverview.mock
        .calls[0]?.[1] as AbortSignal;
      if (kind === "edit") change(render(), "Shares for ONE", "8");
      if (kind === "remove") click(render(), "Remove ONE");
      if (kind === "cancel") click(render(), "Cancel portfolio operation");
      if (kind === "catalog")
        props = { ...props, catalogSnapshotSha256: digest("b") };
      if (kind === "session") props = { ...props, enabled: false };
      if (kind === "unmount") harness.unmount();
      else render();
      expect(signal.aborted).toBe(true);
      pending.resolve(market());
      await flush();
      expect(api.fetchPersonalMarketOverview).toHaveBeenCalledTimes(1);
      if (kind !== "unmount")
        expect(text(render())).not.toContain("Current reference quote");
      if (kind === "session")
        expect(text(render())).not.toContain("Shares confirmed on");
    },
  );

  it.each(["load", "save"])(
    "ignores a late %s result after the owner session becomes unavailable",
    async (kind) => {
      const pending = deferred<unknown>();
      if (kind === "load") {
        api.fetchPersonalPortfolio.mockReturnValue(pending.promise);
        await mount();
        click(render(), "Load My Portfolio");
      } else {
        await load();
        change(render(), "Shares for ONE", "8");
        api.savePersonalPortfolio.mockReturnValue(pending.promise);
        click(render(), "Save My Portfolio");
      }
      const mock =
        kind === "load"
          ? api.fetchPersonalPortfolio
          : api.savePersonalPortfolio;
      const signal = mock.mock.calls.at(-1)?.[
        kind === "load" ? 0 : 3
      ] as AbortSignal;
      props = { ...props, enabled: false };
      render();
      expect(signal.aborted).toBe(true);
      pending.resolve(kind === "load" ? record() : { version: 2 });
      await flush();
      expect(text(render())).not.toContain("Shares confirmed on");
    },
  );

  it("clears private holdings and prices when the source reports session loss", async () => {
    api.fetchPersonalMarketOverview.mockRejectedValue(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    await load();
    click(render(), "Refresh portfolio prices");
    await flush();
    expect(props.onSessionUnavailable).toHaveBeenCalledOnce();
    expect(text(render())).not.toContain("Shares confirmed on");
    expect(text(render())).toContain("The owner session expired");
  });

  it("preserves unmatched identities and never reconciles by ticker or listing alone", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(
      record({ ...portfolio(), snapshotSha256: digest("b") }),
    );
    api.searchPersonalSecurities.mockResolvedValue(
      search([{ ...identity(), securityId: "different-security" }]),
    );
    await load();
    expect(button(render(), "Refresh portfolio prices").props.disabled).toBe(
      true,
    );
    click(render(), "Preview portfolio reconciliation");
    await flush();
    expect(text(render())).toContain("Unmatched; preserved");
    expect(input(render(), "Shares for ONE").props.value).toBe("2");
    expect(button(render(), "Apply matched identities").props.disabled).toBe(
      true,
    );
    expect(api.savePersonalPortfolio).not.toHaveBeenCalled();
    click(render(), "Remove ONE");
    click(render(), "Preview portfolio reconciliation");
    await flush();
    click(render(), "Apply matched identities");
    expect(text(render())).not.toContain("older catalog");
    expect(text(render())).toContain("0 of 20 holdings");
  });

  it("previews exact identity updates and preserves quantity, basis, and confirmation date until explicit save", async () => {
    api.fetchPersonalPortfolio.mockResolvedValue(
      record({ ...portfolio(), snapshotSha256: digest("b") }),
    );
    api.searchPersonalSecurities.mockResolvedValue(
      search([
        { ...identity(), symbol: "RENAMED", issuerName: "Renamed issuer" },
      ]),
    );
    await load();
    click(render(), "Preview portfolio reconciliation");
    await flush();
    expect(text(render())).toContain("RENAMED · Renamed issuer");
    expect(input(render(), "Shares for ONE").props.value).toBe("2");
    click(render(), "Apply matched identities");
    expect(input(render(), "Shares for RENAMED").props.value).toBe("2");
    expect(input(render(), "Total cost basis for RENAMED").props.value).toBe(
      "80",
    );
    expect(input(render(), "Shares confirmed on for RENAMED").props.value).toBe(
      "2026-09-08",
    );
    expect(api.savePersonalPortfolio).not.toHaveBeenCalled();
    click(render(), "Save My Portfolio");
    await flush();
    expect(api.savePersonalPortfolio.mock.calls[0]?.[0]).toMatchObject({
      snapshotSha256: digest("a"),
      holdings: [
        {
          identity: { symbol: "RENAMED", listingId: "listing-one" },
          shares: "2",
          totalCostBasisUsd: "80",
          confirmedOn: "2026-09-08",
        },
      ],
    });
  });

  it("skips catalog search names longer than 128 characters and still tries a later short name", async () => {
    const savedIdentity = { ...identity(), issuerName: "A".repeat(129) };
    const payload = {
      ...portfolio(),
      snapshotSha256: digest("b"),
      holdings: [{ ...portfolio().holdings[0]!, identity: savedIdentity }],
    };
    api.fetchPersonalPortfolio.mockResolvedValue(record(payload));
    api.searchPersonalSecurities
      .mockResolvedValueOnce(search([]))
      .mockResolvedValueOnce(search([savedIdentity]));
    await load();
    click(render(), "Preview portfolio reconciliation");
    await flush();
    expect(
      api.searchPersonalSecurities.mock.calls.map((call) => String(call[0])),
    ).toEqual(["ONE", "Security one"]);
    expect(button(render(), "Apply matched identities").props.disabled).toBe(
      false,
    );
    expect(input(render(), "Shares for ONE").props.value).toBe("2");
  });

  it("keeps a newly confirmed date valid across the UTC midnight render boundary", async () => {
    await load();
    vi.setSystemTime(new Date("2026-09-10T00:00:00.001Z"));
    change(render(), "Shares confirmed on for ONE", "2026-09-10");
    expect(() => render()).not.toThrow();
    expect(button(render(), "Save My Portfolio").props.disabled).toBe(false);
  });
});

function digest(character: string): `sha256:${string}` {
  return `sha256:${character.repeat(64)}`;
}
function reportHistory(
  observedDates: readonly string[],
  splitReviewDates: readonly string[],
  historyProps = latestHistoryProps,
) {
  if (!historyProps) throw new Error("History props unavailable");
  historyProps.onAssessment(
    historyProps.ledgerContext,
    "listing-one",
    splitReviewDates.length > 0,
    {
      listingId: "listing-one",
      firstObservedDate: observedDates[0] ?? null,
      lastObservedDate: observedDates.at(-1) ?? null,
      observationCount: observedDates.length,
      openingDateObserved: false,
      activityDateCount: 0,
      observedActivityDateCount: 0,
      manualSplitsOutsideWindow: 0,
      actions: [],
      requiresSplitReview: splitReviewDates.length > 0,
      observedDates,
      splitReviewDates,
    },
  );
}
function identity(index = 0): PersonalPortfolioIdentity {
  const suffix = index === 0 ? "one" : String(index);
  return {
    country: "US",
    exchangeMic: "XNYS",
    instrumentType: "common_stock",
    issuerId: `issuer-${suffix}`,
    issuerName: `Issuer ${suffix}`,
    listingId: `listing-${suffix}`,
    securityId: `security-${suffix}`,
    securityName: `Security ${suffix}`,
    shareClassId: `class-${suffix}`,
    shareClassName: "Common stock",
    symbol: index === 0 ? "ONE" : `ONE${String(index)}`,
  };
}
function portfolio(count = 1): PersonalPortfolioPayload {
  return {
    schemaVersion: 1,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: digest("a"),
    cashUsd: "10",
    holdings: Array.from({ length: count }, (_, index) => ({
      identity: identity(index),
      shares: "2",
      totalCostBasisUsd: "80",
      confirmedOn: "2026-09-08",
    })),
  };
}
function ledger(): PersonalPortfolioLedgerPayload {
  return {
    schemaVersion: 2,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: digest("a"),
    basisMethod: "fifo_with_opening_pool",
    identities: [identity()],
    opening: {
      asOfDate: "2026-09-08",
      cashUsd: "10",
      holdings: [
        {
          listingId: "listing-one",
          shares: "2",
          totalCostBasisUsd: "80",
          confirmedOn: "2026-09-08",
        },
      ],
    },
    transactions: [
      {
        id: "prior-deposit",
        date: "2026-09-09",
        type: "deposit",
        listingId: null,
        shares: null,
        grossUsd: "25",
        feeUsd: "0",
      },
    ],
  };
}
function record(payload: PersonalPortfolioStoredPayload = portfolio()) {
  return {
    profile: "personal_single_user_local_vault",
    kind: "portfolio",
    id: "main",
    version: 1,
    payload,
    payloadSha256: digest("c"),
    createdAt: "2026-09-08T10:00:00.000Z",
    updatedAt: "2026-09-08T10:00:00.000Z",
  };
}
function search(results: readonly PersonalPortfolioIdentity[]) {
  return { snapshot: { snapshotSha256: digest("a") }, results };
}
function market(index = 0): PersonalMarketOverviewDto {
  const listing = identity(index);
  return {
    schemaVersion: "1.0.0",
    profile: "personal_single_user_local_market_data",
    status: "available",
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      historyFeed: "tiingo_eod_composite",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      quoteFeed: "tiingo_iex_derived_reference",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
    },
    security: {
      country: listing.country,
      exchangeMic: listing.exchangeMic,
      issuerName: listing.issuerName,
      listingId: listing.listingId,
      securityName: listing.securityName,
      symbol: listing.symbol,
    },
    quote: {
      change: "1",
      changePercent: "2.04",
      currency: "USD",
      freshness: "current",
      ingestedAt: "2026-09-09T10:00:00.000Z",
      kind: "derived_realtime_reference",
      previousClose: "49",
      price: "50",
      sourceTime: "2026-09-09T09:59:00.000Z",
    },
    history: {
      bars: [],
      endDate: "2026-09-09",
      startDate: "2026-08-09",
      range: "1m",
    },
  };
}

const harness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const dependencies: Array<readonly unknown[] | undefined> = [];
  const cleanup = new Map<number, () => void>();
  let pending: Array<() => void> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  return {
    reset() {
      states.splice(0);
      refs.splice(0);
      dependencies.splice(0);
      cleanup.clear();
      pending = [];
    },
    begin() {
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    effects() {
      const effects = pending;
      pending = [];
      effects.forEach((effect) => effect());
    },
    unmount() {
      cleanup.forEach((fn) => fn());
      cleanup.clear();
    },
    useEffect(
      effect: () => (() => void) | void,
      next: readonly unknown[] | undefined,
    ) {
      const index = effectIndex++;
      const previous = dependencies[index];
      if (
        previous !== undefined &&
        next !== undefined &&
        previous.length === next.length &&
        next.every((item, i) => Object.is(item, previous[i]))
      )
        return;
      dependencies[index] = next;
      pending.push(() => {
        cleanup.get(index)?.();
        const returned = effect();
        if (returned) cleanup.set(index, returned);
      });
    },
    useRef<T>(initial: T) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (next: unknown) => {
          states[index] =
            typeof next === "function"
              ? (next as (previous: unknown) => unknown)(states[index])
              : next;
        },
      ];
    },
  };
});
function render() {
  harness.begin();
  const view = PersonalPortfolio(props);
  harness.effects();
  return view;
}
async function mount() {
  render();
  await flush();
  return render();
}
async function load() {
  await mount();
  click(render(), "Load My Portfolio");
  await flush();
  return render();
}
async function flush() {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value))
    return value.map(text).join(" ").replace(/\s+/gu, " ");
  if (!React.isValidElement(value)) return "";
  const element = value as React.ReactElement<Record<string, unknown>>;
  return typeof element.type === "function"
    ? text(Reflect.apply(element.type, undefined, [element.props]) as unknown)
    : text(element.props.children);
}
function elements(
  value: unknown,
): Array<React.ReactElement<Record<string, unknown>>> {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement(value)) return [];
  const element = value as React.ReactElement<Record<string, unknown>>;
  return [
    element,
    ...elements(
      typeof element.type === "function"
        ? (Reflect.apply(element.type, undefined, [element.props]) as unknown)
        : element.props.children,
    ),
  ];
}
function input(value: unknown, label: string) {
  const found = elements(value).find(
    (element) => element.props["aria-label"] === label,
  );
  if (!found) throw new Error(`Missing input: ${label}`);
  return found as React.ReactElement<{
    value: unknown;
    onChange: (event: { target: { value: string } }) => void;
  }>;
}
function change(value: unknown, label: string, next: string) {
  input(value, label).props.onChange({ target: { value: next } });
}
function button(value: unknown, label: string) {
  const found = elements(value).find(
    (element) => element.type === "button" && text(element) === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found as React.ReactElement<{
    disabled?: boolean;
    onClick?: () => void;
  }>;
}
function click(value: unknown, label: string) {
  const found = button(value, label);
  if (found.props.disabled) throw new Error(`Disabled button: ${label}`);
  found.props.onClick?.();
}
function metric(value: unknown, label: string) {
  const found = elements(value).find(
    (element) =>
      element.type === "div" &&
      elements(element).some(
        (child) => child.type === "dt" && text(child) === label,
      ) &&
      elements(element).filter((child) => child.type === "dt").length === 1,
  );
  return text(elements(found).find((element) => element.type === "dd"));
}
