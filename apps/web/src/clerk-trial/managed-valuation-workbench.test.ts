import { describe, expect, it, vi } from "vitest";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  captureValuationCalculationGuard,
  ManagedValuationWorkbench,
  type DcfField,
  type ExitField,
  type ExitScenarioField,
} from "./managed-valuation-workbench";
import type { AuthoredValuationScenario } from "@research-cockpit/personal-market-analytics";
import { MANAGED_RESEARCH_COVERAGE } from "./managed-research-eligibility";

export function valuationSelection(
  overrides: Partial<ManagedResearchSelection> = {},
): ManagedResearchSelection {
  return {
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    listing: {
      country: "US",
      exchangeMic: "XNAS",
      instrumentType: "common_stock",
      issuerId: "issuer-example",
      issuerName: "Example issuer",
      listingId: "listing-example",
      securityId: "security-example",
      securityName: "Example common",
      shareClassId: "class-example",
      shareClassName: "Example class",
      symbol: "EXAMPLE",
    },
    cik: "0000000001",
    origin: "watchlist",
    ...overrides,
  };
}
export function fillValuation(workbench: ManagedValuationWorkbench): void {
  for (const [field, value] of Object.entries({
    startingUnleveredCashFlowUsd: "100.125",
    enterpriseToEquityBridgeUsd: "-20.25",
    dilutedShares: "10",
    waccPercent: "10",
    terminalGrowthPercent: "2",
  }))
    workbench.setDcfField(field as DcfField, value);
  for (const [scenario, value] of Object.entries({
    conservative: "0",
    base: "5",
    expansion: "10",
  }))
    workbench.setDcfScenario(scenario as AuthoredValuationScenario, value);
  for (const [field, value] of Object.entries({
    baseRevenue: "1000.125",
    cash: "20.25",
    debt: "10.125",
    dilutedShares: "10",
    discountRatePercent: "10",
  }))
    workbench.setExitField(field as ExitField, value);
  for (const [scenario, growth] of Object.entries({
    conservative: "0",
    base: "5",
    expansion: "10",
  })) {
    workbench.setExitScenario(
      scenario as AuthoredValuationScenario,
      "annualRevenueGrowthPercent",
      growth,
    );
    workbench.setExitScenario(
      scenario as AuthoredValuationScenario,
      "targetEbitdaMarginPercent",
      "20",
    );
    workbench.setExitScenario(
      scenario as AuthoredValuationScenario,
      "exitMultiple",
      "10",
    );
  }
}

describe("transient authored valuation workbench", () => {
  it("publishes stable immutable snapshots and stops notifications after unsubscribe", () => {
    const workbench = new ManagedValuationWorkbench();
    workbench.activate(valuationSelection());
    const before = workbench.getSnapshot();
    const listener = vi.fn();
    const unsubscribe = workbench.subscribe(listener);
    workbench.setDcfField("waccPercent", "10");
    const edited = workbench.getSnapshot();
    expect(edited).not.toBe(before);
    expect(workbench.getSnapshot()).toBe(edited);
    expect(before.dcfDraft.waccPercent).toBe("");
    expect(Object.isFrozen(edited.dcfDraft.scenarios)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    workbench.setDcfField("waccPercent", "10");
    expect(workbench.getSnapshot()).toBe(edited);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    workbench.setDcfField("waccPercent", "11");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("rebinds an untouched company and rejects stale discard actions", () => {
    const workbench = new ManagedValuationWorkbench();
    const first = valuationSelection();
    const second = valuationSelection({
      listing: { ...first.listing, listingId: "other" },
    });
    workbench.activate(first);
    workbench.calculate();
    expect(workbench.hasDraft()).toBe(false);
    workbench.activate(second);
    expect(workbench.getSnapshot()).toMatchObject({
      owner: second,
      context: second,
      editable: true,
      calculation: null,
    });
    workbench.setDcfField("waccPercent", "10");
    const before = workbench.getSnapshot();
    workbench.discardAndUse(first);
    expect(workbench.getSnapshot()).toBe(before);
    workbench.activate(null);
    workbench.discardAndUse(second);
    expect(workbench.getSnapshot().dcfDraft.waccPercent).toBe("10");
  });
  it("starts blank, not dirty; only Calculate runs both models and freezes full raw inputs and outputs", () => {
    const workbench = new ManagedValuationWorkbench();
    expect(workbench.hasDraft()).toBe(false);
    expect(workbench.calculate()).toBeNull();
    workbench.activate(valuationSelection());
    expect(workbench.getSnapshot()).toMatchObject({
      editable: true,
      dirty: false,
      calculation: null,
      dcfDraft: {
        startingUnleveredCashFlowUsd: "",
        enterpriseToEquityBridgeUsd: "",
        forecastYears: "5",
      },
      exitDraft: { cash: "", debt: "", horizonYears: "5" },
    });
    expect(workbench.hasDraft()).toBe(false);
    const blank = workbench.calculate()!;
    expect(blank.dcfResult).toMatchObject({
      status: "unavailable",
      reason: "invalid_input",
    });
    expect(blank.exitResult).toMatchObject({
      status: "unavailable",
      reason: "invalid_input",
    });
    fillValuation(workbench);
    expect(workbench.getSnapshot().calculation).toBeNull();
    const capture = workbench.calculate()!;
    expect(capture.dcfResult.status).toBe("available");
    expect(capture.exitResult.status).toBe("available");
    expect(capture.dcfInput.startingUnleveredCashFlowUsd).toBe("100.125");
    expect(capture.dcfInput.forecastYears).toBe(5);
    expect(capture.dcfDraft.forecastYears).toBe("5");
    expect(capture.explanation).toContain("USD");
    if (capture.dcfResult.status === "available") {
      expect(capture.dcfResult.scenarios.base.projection).toHaveLength(5);
      expect(capture.dcfResult.sensitivity.cells).toHaveLength(25);
    }
    if (capture.exitResult.status === "available")
      expect(capture.exitResult.sensitivity.cells).toHaveLength(25);
    expect(Object.isFrozen(capture)).toBe(true);
    expect(Object.isFrozen(capture.dcfInput.scenarios.base)).toBe(true);
    expect(Object.isFrozen(capture.exitResult.methodology)).toBe(true);
    const json = JSON.stringify(capture);
    workbench.setDcfField("startingUnleveredCashFlowUsd", "200");
    expect(JSON.stringify(capture)).toBe(json);
    expect(workbench.getSnapshot().calculation).toBeNull();
  });

  it("retains one owner across Back and same complete identity return; different company/catalog cannot edit or calculate", () => {
    const workbench = new ManagedValuationWorkbench();
    const first = valuationSelection();
    workbench.activate(first);
    fillValuation(workbench);
    const result = workbench.calculate()!;
    const guard = captureValuationCalculationGuard(result)!;
    expect(guard()).toBe(true);
    workbench.activate(null);
    expect(workbench.getSnapshot()).toMatchObject({
      context: null,
      editable: false,
      calculation: null,
      dirty: true,
    });
    expect(guard()).toBe(false);
    workbench.activate({ ...first, origin: "route" });
    expect(workbench.getSnapshot().calculation).toBe(result);
    expect(guard()).toBe(false);
    const second = valuationSelection({
      listing: {
        ...first.listing,
        listingId: "other",
        shareClassId: "other-class",
      },
    });
    workbench.activate(second);
    expect(workbench.getSnapshot().owner!.listing.listingId).toBe(
      first.listing.listingId,
    );
    expect(workbench.getSnapshot()).toMatchObject({
      editable: false,
      calculation: null,
    });
    expect(workbench.calculate()).toBeNull();
    expect(workbench.setDcfField("waccPercent", "20")).toBe(false);
    expect(workbench.setExitScenario("base", "exitMultiple", "20")).toBe(false);
    workbench.activate(
      valuationSelection({ catalogSnapshotSha256: `sha256:${"b".repeat(64)}` }),
    );
    expect(workbench.getSnapshot().editable).toBe(false);
    expect(workbench.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd).toBe(
      "100.125",
    );
    workbench.discardAndUse(second);
    expect(workbench.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd).toBe(
      "100.125",
    );
    workbench.activate(second);
    workbench.discardAndUse(second);
    expect(workbench.getSnapshot()).toMatchObject({
      owner: second,
      context: second,
      editable: true,
      dirty: false,
      calculation: null,
      dcfDraft: { startingUnleveredCashFlowUsd: "" },
    });
    expect(workbench.hasDraft()).toBe(false);
    workbench.activate(first);
    expect(workbench.getSnapshot().owner).toEqual(first);
    expect(workbench.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd).toBe(
      "",
    );
  });

  it.each([
    "exchangeMic",
    "instrumentType",
    "issuerId",
    "issuerName",
    "listingId",
    "securityId",
    "securityName",
    "shareClassId",
    "shareClassName",
    "symbol",
  ] as const)("checks the full listing identity including %s", (field) => {
    const workbench = new ManagedValuationWorkbench();
    const selection = valuationSelection();
    workbench.activate(selection);
    workbench.setDcfField("waccPercent", "10");
    const value =
      field === "exchangeMic"
        ? "XNYS"
        : field === "instrumentType"
          ? "adr"
          : field === "symbol"
            ? "OTHER"
            : "other";
    workbench.activate({
      ...selection,
      listing: { ...selection.listing, [field]: value },
    });
    expect(workbench.getSnapshot().editable).toBe(false);
  });

  it("rejects malformed runtime fields, scenarios and oversized text without a mutation", () => {
    const workbench = new ManagedValuationWorkbench();
    workbench.activate(valuationSelection());
    const original = workbench.getSnapshot();
    for (const field of ["__proto__", "constructor", "toString", {}, null]) {
      expect(workbench.setDcfField(field as DcfField, "1")).toBe(false);
      expect(workbench.setExitField(field as ExitField, "1")).toBe(false);
      expect(
        workbench.setDcfScenario(field as AuthoredValuationScenario, "1"),
      ).toBe(false);
      expect(
        workbench.setExitScenario("base", field as ExitScenarioField, "1"),
      ).toBe(false);
    }
    expect(workbench.setDcfField("waccPercent", {} as string)).toBe(false);
    expect(workbench.getSnapshot()).toBe(original);
    expect(workbench.setDcfField("waccPercent", "😀".repeat(513))).toBe(false);
    expect(workbench.getSnapshot().inputIssue).toContain("exceeds 512");
    expect(workbench.calculate()).toBeNull();
    expect(workbench.setDcfField("waccPercent", "😀".repeat(512))).toBe(true);
    expect(workbench.getSnapshot().inputIssue).toBeNull();
    expect(workbench.calculate()!.dcfResult.status).toBe("unavailable");
  });
  it("blocks calculation after a rejected paste until that field is corrected or inputs are discarded", () => {
    const workbench = new ManagedValuationWorkbench();
    workbench.activate(valuationSelection());
    fillValuation(workbench);
    workbench.calculate();
    expect(workbench.setExitField("cash", "9".repeat(513))).toBe(false);
    expect(workbench.getSnapshot().calculation).toBeNull();
    expect(workbench.getSnapshot().inputIssue).toContain("Exit multiple cash");
    workbench.setDcfField("waccPercent", "9".repeat(513));
    workbench.setExitField("cash", "25");
    expect(workbench.calculate()).toBeNull();
    expect(workbench.getSnapshot().inputIssue).toContain("DCF WACC");
    workbench.setDcfField("waccPercent", "12");
    expect(workbench.getSnapshot().inputIssue).toBeNull();
    expect(workbench.calculate()!.exitResult.status).toBe("available");
  });
  it("retains an oversized numeric lexeme and refuses it instead of calculating the prior valid amount", () => {
    const workbench = new ManagedValuationWorkbench();
    workbench.activate(valuationSelection());
    fillValuation(workbench);
    expect(workbench.calculate()!.dcfResult.status).toBe("available");
    const pasted = "9".repeat(65);
    expect(workbench.setDcfField("startingUnleveredCashFlowUsd", pasted)).toBe(
      true,
    );
    expect(workbench.getSnapshot().calculation).toBeNull();
    expect(workbench.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd).toBe(
      pasted,
    );
    expect(workbench.calculate()!.dcfResult).toMatchObject({
      status: "unavailable",
      reason: "invalid_input",
    });
  });

  it("preserves invalid year lexemes and domain bounds without converting blank operands to zero", () => {
    const workbench = new ManagedValuationWorkbench();
    workbench.activate(valuationSelection());
    fillValuation(workbench);
    workbench.setDcfField("forecastYears", "");
    workbench.setExitField("horizonYears", "5.0");
    const invalid = workbench.calculate()!;
    expect(invalid.dcfDraft.forecastYears).toBe("");
    expect(invalid.exitDraft.horizonYears).toBe("5.0");
    expect(invalid.dcfInput.forecastYears).toBeNull();
    expect(invalid.exitInput.horizonYears).toBeNull();
    expect(JSON.parse(JSON.stringify(invalid)) as unknown).toEqual(invalid);
    expect(invalid.dcfResult.status).toBe("unavailable");
    expect(invalid.exitResult.status).toBe("unavailable");
    workbench.setDcfField("forecastYears", "4");
    expect(workbench.calculate()!.dcfResult).toMatchObject({
      status: "unavailable",
      reason: "forecast_years_out_of_bounds",
    });
    workbench.setDcfField("forecastYears", "5");
    workbench.setDcfField("waccPercent", "2");
    expect(workbench.calculate()!.dcfResult).toMatchObject({
      status: "unavailable",
      reason: "discount_rate_not_above_terminal_growth",
    });
    workbench.setExitField("horizonYears", "5");
    workbench.setExitField("cash", "-1");
    expect(workbench.calculate()!.exitResult.status).toBe("unavailable");
  });

  it("copies admitted identity, rejects malformed selections, notifies changes and retires all raw inputs", () => {
    const workbench = new ManagedValuationWorkbench();
    const listener = vi.fn();
    const unsubscribe = workbench.subscribe(listener);
    const selection = valuationSelection();
    workbench.activate(selection);
    expect(Object.isFrozen(selection)).toBe(false);
    expect(workbench.getSnapshot().owner).not.toBe(selection);
    const before = workbench.getSnapshot();
    workbench.activate(Object.create(selection) as ManagedResearchSelection);
    expect(workbench.getSnapshot()).toBe(before);
    fillValuation(workbench);
    const capture = workbench.calculate()!;
    const guard = captureValuationCalculationGuard(capture)!;
    listener.mockClear();
    workbench.retire();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(workbench.getSnapshot()).toMatchObject({
      retired: true,
      owner: null,
      context: null,
      dirty: false,
      editable: false,
      calculation: null,
      dcfDraft: { startingUnleveredCashFlowUsd: "", forecastYears: "" },
      exitDraft: { horizonYears: "", baseRevenue: "" },
    });
    expect(workbench.hasDraft()).toBe(false);
    expect(guard()).toBe(false);
    workbench.activate(selection);
    workbench.discardAndUse(selection);
    expect(workbench.setDcfField("waccPercent", "10")).toBe(false);
    expect(workbench.calculate()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe("complete authored input capture and restore", () => {
  it("captures exact invalid and incomplete raw maps without calculating and blocks rejected overlength input", () => {
    const workbench = new ManagedValuationWorkbench();
    workbench.activate(valuationSelection());
    workbench.setDcfField("waccPercent", " 12.. 😀\n");
    workbench.setExitField("horizonYears", "5.0");
    const capture = workbench.captureInputs()!;
    expect(capture.entry.dcf.inputs.waccPercent).toBe(" 12.. 😀\n");
    expect(capture.entry.exit.inputs.horizonYears).toBe("5.0");
    expect(capture.entry.dcf.inputs.startingUnleveredCashFlowUsd).toBe("");
    expect(Object.isFrozen(capture.entry.exit.inputs.scenarios.base)).toBe(
      true,
    );
    expect(workbench.getSnapshot().calculation).toBeNull();
    workbench.setDcfField("waccPercent", "9".repeat(513));
    expect(workbench.captureInputs()).toBeNull();
    workbench.setDcfField("waccPercent", " 12.. 😀\n");
    expect(workbench.isInputCaptureCurrent(capture)).toBe(false);
    expect(workbench.acknowledgeSavedInputs(capture)).toBe(false);
  });

  it("acknowledges only the saved editor revision and keeps clean inputs bound to their company", () => {
    const workbench = new ManagedValuationWorkbench();
    const owner = valuationSelection();
    workbench.activate(owner);
    fillValuation(workbench);
    const old = workbench.captureInputs()!;
    workbench.setDcfField("waccPercent", "11");
    expect(workbench.acknowledgeSavedInputs(old)).toBe(false);
    expect(workbench.hasDraft()).toBe(true);
    const current = workbench.captureInputs()!;
    expect(workbench.acknowledgeSavedInputs({ ...current })).toBe(false);
    expect(workbench.acknowledgeSavedInputs(current)).toBe(true);
    expect(workbench.hasDraft()).toBe(false);
    const other = valuationSelection({
      listing: { ...owner.listing, listingId: "other" },
    });
    workbench.activate(other);
    expect(workbench.getSnapshot().owner).toEqual(owner);
    expect(workbench.getSnapshot().editable).toBe(false);
    workbench.discardAndUse(other);
    expect(workbench.getSnapshot().owner).toEqual(other);
    expect(workbench.getSnapshot().dcfDraft.waccPercent).toBe("");
  });

  it.each([true, false])(
    "restores the same full company across known/null CIK and origins (%s)",
    (knownFirst) => {
      const workbench = new ManagedValuationWorkbench();
      const first = valuationSelection({
        cik: knownFirst ? "0000000001" : null,
        origin: "discover",
      });
      workbench.activate(first);
      fillValuation(workbench);
      const entry = workbench.captureInputs()!.entry;
      const calculation = workbench.calculate()!;
      const guard = captureValuationCalculationGuard(calculation)!;
      const context = valuationSelection({
        cik: knownFirst ? null : "0000000001",
        origin: "watchlist",
      });
      workbench.activate(context);
      const before = workbench.getSnapshot();
      const listener = vi.fn();
      workbench.subscribe(listener);
      expect(workbench.restoreInputs(entry, before)).toBe(true);
      expect(listener).toHaveBeenCalledOnce();
      expect(workbench.getSnapshot().owner).toEqual(context);
      expect(workbench.getSnapshot().context).toEqual(context);
      expect(workbench.getSnapshot().dcfDraft).toEqual(entry.dcf.inputs);
      expect(workbench.getSnapshot().exitDraft).toEqual(entry.exit.inputs);
      expect(workbench.getSnapshot().calculation).toBeNull();
      expect(workbench.hasDraft()).toBe(false);
      expect(guard()).toBe(false);
      expect(workbench.calculate()!.dcfResult.status).toBe("available");
    },
  );

  it("refuses changed nonnull CIK, catalog, listing and stale restore snapshots", () => {
    const workbench = new ManagedValuationWorkbench();
    const owner = valuationSelection();
    workbench.activate(owner);
    const entry = workbench.captureInputs()!.entry;
    for (const change of [
      { cik: "0000000002" },
      { catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const },
      { listing: { ...owner.listing, shareClassId: "other-class" } },
    ]) {
      workbench.activate(valuationSelection(change));
      const before = workbench.getSnapshot();
      expect(workbench.restoreInputs(entry, before)).toBe(false);
      expect(workbench.getSnapshot()).toBe(before);
    }
    workbench.activate(owner);
    const stale = workbench.getSnapshot();
    workbench.setExitField("cash", "newer");
    expect(workbench.restoreInputs(entry, stale)).toBe(false);
    expect(workbench.getSnapshot().exitDraft.cash).toBe("newer");
  });

  it("rejects a known roster issuer conflict even when the other claim is null", () => {
    const row = MANAGED_RESEARCH_COVERAGE.listings[0]!;
    const workbench = new ManagedValuationWorkbench();
    workbench.activate({
      catalogSnapshotSha256: MANAGED_RESEARCH_COVERAGE.catalogSnapshotSha256,
      listing: row.listing,
      cik: null,
      origin: "watchlist",
    });
    const entry = workbench.captureInputs()!.entry;
    const before = workbench.getSnapshot();
    expect(
      workbench.restoreInputs({ ...entry, cik: "9999999999" }, before),
    ).toBe(false);
    expect(workbench.getSnapshot()).toBe(before);
  });

  it("cannot revive inputs when a listener retires during rejected-input correction", () => {
    const workbench = new ManagedValuationWorkbench();
    workbench.activate(valuationSelection());
    workbench.setDcfField("waccPercent", "9".repeat(513));
    let armed = true;
    workbench.subscribe(() => {
      if (!armed) return;
      if (workbench.getSnapshot().inputIssue !== null) return;
      armed = false;
      workbench.retire();
    });
    expect(workbench.setDcfField("waccPercent", "12")).toBe(false);
    expect(workbench.getSnapshot().retired).toBe(true);
    expect(workbench.getSnapshot().dcfDraft.waccPercent).toBe("");
    expect(workbench.captureInputs()).toBeNull();
  });
});

describe("opaque starting-revenue field lifetime", () => {
  it("keeps the field capture through other input edits and Calculate but rejects forged captures", () => {
    const model = new ManagedValuationWorkbench();
    model.activate(valuationSelection());
    fillValuation(model);
    const capture = model.captureBaseRevenue()!;
    model.setDcfField("waccPercent", "11");
    model.setExitField("cash", "21");
    model.calculate();
    expect(model.isBaseRevenueCaptureCurrent(capture)).toBe(true);
    expect(model.isBaseRevenueCaptureCurrent({ ...capture })).toBe(false);
  });
  it("allows only the exact next field transition after Apply", () => {
    const model = new ManagedValuationWorkbench();
    model.activate(valuationSelection());
    const first = model.captureBaseRevenue()!;
    model.setExitField("baseRevenue", "100");
    const after = model.captureBaseRevenueAfterApply(first, "100")!;
    expect(model.isBaseRevenueCaptureCurrent(after)).toBe(true);
    model.setExitField("baseRevenue", "101");
    model.setExitField("baseRevenue", "100");
    expect(model.isBaseRevenueCaptureCurrent(after)).toBe(false);
    expect(model.captureBaseRevenueAfterApply(first, "100")).toBeNull();
  });
  it("retires a rejected oversized starting-revenue edit without reviving its original text", () => {
    const model = new ManagedValuationWorkbench();
    model.activate(valuationSelection());
    model.setExitField("baseRevenue", "100");
    const capture = model.captureBaseRevenue()!;
    expect(model.setExitField("baseRevenue", "1".repeat(513))).toBe(false);
    model.setExitField("baseRevenue", "100");
    expect(model.isBaseRevenueCaptureCurrent(capture)).toBe(false);
  });
  it("retires same-text restores and context out-and-back while preserving saved input schema", () => {
    const model = new ManagedValuationWorkbench();
    const selection = valuationSelection();
    model.activate(selection);
    fillValuation(model);
    const first = model.captureBaseRevenue()!,
      inputs = model.captureInputs()!;
    expect(model.restoreDraftInputs(inputs.entry, model.getSnapshot())).toBe(
      true,
    );
    expect(model.isBaseRevenueCaptureCurrent(first)).toBe(false);
    const second = model.captureBaseRevenue()!;
    model.activate(null);
    model.activate(selection);
    expect(model.isBaseRevenueCaptureCurrent(second)).toBe(false);
    expect(Object.keys(model.captureInputs()!.entry)).toEqual(
      Object.keys(inputs.entry),
    );
  });
});
