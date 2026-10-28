import { describe, expect, it, vi } from "vitest";
import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { ManagedAnnualReport } from "./managed-annual-report";
import {
  ManagedValuationWorkbench,
  type DcfField,
  type ExitField,
} from "./managed-valuation-workbench";
import {
  ManagedValuationRevenueBasis,
  annualRevenueBasisContextIsOwned,
  annualRevenueBasisExcerpt,
  resolveAnnualRevenueBasis,
} from "./managed-valuation-revenue-basis";
import { annualReportPacket } from "./test-annual-report-fixture";
import { eodSelection } from "./eod-history-fixture";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { getManagedAnnualView } from "./managed-annual-view";
import {
  bindAnnualPacket,
  replaceConceptRows,
  type TestAnnualPacket,
} from "../lib/test-personal-sec-annual-api-fixture";

function fill(model: ManagedValuationWorkbench) {
  for (const [key, value] of Object.entries({
    startingUnleveredCashFlowUsd: "100",
    enterpriseToEquityBridgeUsd: "0",
    dilutedShares: "10",
    waccPercent: "10",
    terminalGrowthPercent: "2",
  }))
    model.setDcfField(key as DcfField, value);
  for (const [key, value] of Object.entries({
    baseRevenue: "1000",
    cash: "20",
    debt: "10",
    dilutedShares: "10",
    discountRatePercent: "10",
  }))
    model.setExitField(key as ExitField, value);
  for (const scenario of ["conservative", "base", "expansion"] as const) {
    model.setDcfScenario(scenario, "5");
    model.setExitScenario(scenario, "annualRevenueGrowthPercent", "5");
    model.setExitScenario(scenario, "targetEbitdaMarginPercent", "20");
    model.setExitScenario(scenario, "exitMultiple", "10");
  }
}
async function fixture(packet?: PersonalSecAnnualCanonicalResponseDto) {
  const response = packet ?? (await annualReportPacket());
  const read = vi.fn().mockResolvedValue(response);
  const annualModel = new ManagedAnnualReport(read, vi.fn(), undefined, {
    coverage: inventedManagedResearchCoverage,
  });
  annualModel.open(eodSelection);
  await annualModel.load();
  const model = new ManagedValuationWorkbench();
  model.activate(eodSelection);
  fill(model);
  const controller = new ManagedValuationRevenueBasis(model);
  const current = { value: true };
  const annual = annualModel.getSnapshot();
  const input = {
    selection: eodSelection,
    annual,
    concept: "Revenues",
    isCurrent: () => current.value,
  };
  const prepare = () => controller.prepare(input);
  const apply = () => {
    const result = prepare();
    expect(result.reason).toBeNull();
    return controller.apply(result.preview!);
  };
  return {
    model,
    controller,
    annual,
    annualModel,
    response: annual.response!,
    read,
    current,
    input,
    prepare,
    apply,
  };
}
async function changedRevenue(value: string) {
  const packet = structuredClone(
    await annualReportPacket(),
  ) as TestAnnualPacket;
  replaceConceptRows(packet, "Revenues", [{ value }]);
  return bindAnnualPacket(packet);
}

describe("explicit Annual revenue model basis", () => {
  it.each(PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS)(
    "previews exact %s independently without changing inputs or calculating",
    async (concept) => {
      const f = await fixture();
      f.input.concept = concept;
      const calculate = vi.spyOn(f.model, "calculate");
      const before = f.model.captureInputs()!;
      const source = f.annual.response!;
      const result = f.prepare();
      expect(result.reason).toBeNull();
      const preview = result.preview!;
      const revenue = getManagedAnnualView(
        source,
      )!.operatingResults.resolution.margins.find(
        (row) => row.concept === concept,
      )!.revenue;
      expect(revenue.status).toBe("available");
      expect(preview.source.concept).toBe(concept);
      expect(preview.source.cik).toBe(source.evidence.cik);
      expect(preview.source.cik).toBe(source.security.cik);
      expect(preview.before).toEqual(before.entry);
      expect(preview.after.dcf).toBe(preview.before.dcf);
      expect(preview.after.exit.inputs).toEqual({
        ...preview.before.exit.inputs,
        baseRevenue: preview.source.value,
      });
      expect(f.model.captureInputs()!.entry).toEqual(before.entry);
      expect(f.model.getSnapshot().dirty).toBe(true);
      expect(calculate).not.toHaveBeenCalled();
      expect(f.read).toHaveBeenCalledTimes(1);
      expect(preview.source.cutoffAt).toBe(source.evidence.generation.cutoffAt);
      expect(preview.source.completedAt).toBe(
        source.evidence.generation.completedAt,
      );
      expect(preview.source.companyFactsCapturedAt).toBe(
        source.evidence.generation.sources.companyFacts.fetchedAt,
      );
      expect(preview.source.submissionsCapturedAt).toBe(
        source.evidence.generation.sources.submissions.fetchedAt,
      );
      expect(Object.isFrozen(preview)).toBe(true);
      expect(Object.isFrozen(preview.after.exit.inputs)).toBe(true);
    },
  );
  it("attaches the reference once without changing exact matching raw inputs or their current calculation", async () => {
    const f = await fixture();
    const value = f.prepare().preview!.source.value;
    f.model.setExitField("baseRevenue", value);
    const calculation = f.model.calculate()!;
    const before = f.model.captureInputs()!.entry;
    const calculate = vi.spyOn(f.model, "calculate");
    const preview = f.prepare().preview!;
    expect(preview.beforeRevenue).toBe(value);
    expect(preview.afterRevenue).toBe(value);
    expect(f.controller.apply(preview).applied).toBe(true);
    expect(f.controller.apply(preview).applied).toBe(false);
    expect(f.model.captureInputs()!.entry).toEqual(before);
    expect(f.model.getSnapshot().calculation).toBe(calculation);
    expect(calculate).not.toHaveBeenCalled();
    expect(
      annualRevenueBasisContextIsOwned(
        f.controller.getApplied(eodSelection)!,
        eodSelection,
        calculation,
      ),
    ).toBe(true);
    expect(f.read).toHaveBeenCalledOnce();
  });
  it("uses admitted revenue even when operating income is unavailable", async () => {
    const packet = structuredClone(
      await annualReportPacket(),
    ) as TestAnnualPacket;
    replaceConceptRows(packet, "OperatingIncomeLoss", []);
    const f = await fixture(await bindAnnualPacket(packet));
    expect(
      getManagedAnnualView(f.response)!.operatingResults.resolution
        .operatingIncome.status,
    ).toBe("unavailable");
    expect(f.prepare().preview).not.toBeNull();
    expect(f.apply().applied).toBe(true);
  });
  it("applies only baseRevenue once and retains exact immutable source provenance", async () => {
    const f = await fixture();
    const before = f.model.captureInputs()!.entry;
    const preview = f.prepare().preview!;
    expect(f.controller.apply({ ...preview }).applied).toBe(false);
    expect(f.controller.apply(preview).applied).toBe(true);
    expect(f.controller.apply(preview).applied).toBe(false);
    const after = f.model.captureInputs()!.entry;
    expect(after.dcf).toEqual(before.dcf);
    expect(after.exit.inputs).toEqual({
      ...before.exit.inputs,
      baseRevenue: preview.source.value,
    });
    expect(f.model.getSnapshot().calculation).toBeNull();
    expect(f.read).toHaveBeenCalledTimes(1);
    const context = f.controller.getApplied(eodSelection)!;
    expect(context.source).toBe(preview.source);
    expect(annualRevenueBasisExcerpt(context)).toBe(preview.excerpt);
    expect(annualRevenueBasisExcerpt({ ...context })).toBeNull();
    expect(context.excerpt).toContain(preview.source.filingUrl);
    const calculation = f.model.calculate()!;
    expect(
      annualRevenueBasisContextIsOwned(context, eodSelection, calculation),
    ).toBe(true);
    expect(
      annualRevenueBasisContextIsOwned(
        { ...context },
        eodSelection,
        calculation,
      ),
    ).toBe(false);
    expect(f.model.captureInputs()!.entry).not.toHaveProperty("source");
  });
  it("keeps retained and historical qualifications with their original clocks", async () => {
    const f = await fixture(
      await annualReportPacket("left", { mode: "current-use-unavailable" }),
    );
    f.input.annual = { ...f.annual, showingPrevious: true, error: true };
    const preview = f.prepare().preview!;
    expect(preview.source.currentUseEligible).toBe(false);
    expect(preview.source.showingPrevious).toBe(true);
    expect(preview.excerpt).toContain("Historical evidence");
    expect(preview.excerpt).toContain("Retained previous report");
    expect(preview.excerpt).toContain(
      f.response.evidence.generation.completedAt,
    );
    expect(f.controller.apply(preview).applied).toBe(true);
  });
  it.each([
    "",
    "OperatingIncomeLoss",
    "NetCashProvidedByUsedInOperatingActivities",
  ])(
    "refuses undeclared concept %j without selecting a fallback",
    async (concept) => {
      const f = await fixture();
      f.input.concept = concept;
      expect(f.prepare().preview).toBeNull();
      expect(f.model.getSnapshot().exitDraft.baseRevenue).toBe("1000");
    },
  );
  it.each(["supported", "running", "checkingSeed", "catalogChanged"] as const)(
    "refuses non-ready Annual %s state",
    async (field) => {
      const f = await fixture();
      const annual = { ...f.annual, [field]: field !== "supported" };
      expect(
        resolveAnnualRevenueBasis(eodSelection, annual, "Revenues").source,
      ).toBeNull();
    },
  );
  it.each(["origin", "cik", "catalog", "shareClass"] as const)(
    "requires exact source %s identity",
    async (field) => {
      const f = await fixture();
      const selection = {
        ...eodSelection,
        listing: { ...eodSelection.listing },
      };
      if (field === "origin") selection.origin = "route";
      if (field === "cik") selection.cik = "0000000002";
      if (field === "catalog")
        selection.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
      if (field === "shareClass")
        selection.listing.shareClassId = "another-class";
      expect(
        resolveAnnualRevenueBasis(selection, f.annual, "Revenues").source,
      ).toBeNull();
    },
  );
  it("refuses unowned packets, unavailable sources and absent revenue", async () => {
    const f = await fixture();
    expect(
      resolveAnnualRevenueBasis(
        eodSelection,
        { ...f.annual, response: structuredClone(f.response) },
        "Revenues",
      ).source,
    ).toBeNull();
    const unavailable = await fixture(
      await annualReportPacket("left", { mode: "source-unavailable" }),
    );
    expect(unavailable.prepare().preview).toBeNull();
    const packet = structuredClone(f.response) as TestAnnualPacket;
    replaceConceptRows(packet, "Revenues", []);
    expect(
      (await fixture(await bindAnnualPacket(packet))).prepare().preview,
    ).toBeNull();
  });
  it.each([
    "0",
    "-1",
    "1000000000000000000000000000001",
    "0.0000000000000000001",
  ])("refuses model-ineligible source decimal %s", async (value) => {
    const f = await fixture(await changedRevenue(value));
    expect(f.prepare().preview).toBeNull();
    expect(f.model.getSnapshot().exitDraft.baseRevenue).toBe("1000");
  });
  it("preserves the maximum authored operand without Number conversion", async () => {
    const f = await fixture(
      await changedRevenue("1000000000000000000000000000000"),
    );
    const preview = f.prepare().preview!;
    expect(preview.source.value).toBe("1000000000000000000000000000000");
    expect(f.controller.apply(preview).applied).toBe(true);
  });
  it("replaces previews and retires choice-only previews while preserving an applied basis", async () => {
    const f = await fixture();
    const first = f.prepare().preview!;
    const second = f.prepare().preview!;
    expect(f.controller.apply(first).applied).toBe(false);
    expect(f.controller.apply(second).applied).toBe(true);
    const context = f.controller.getApplied(eodSelection);
    const third = f.prepare().preview!;
    f.controller.retirePreview();
    expect(f.controller.apply(third).applied).toBe(false);
    expect(f.controller.getApplied(eodSelection)).toBe(context);
  });
  it.each(["dcf", "exit", "scenario", "calculate"] as const)(
    "withdraws a complete preview after %s changes, including exact text return",
    async (action) => {
      const f = await fixture();
      const preview = f.prepare().preview!;
      if (action === "dcf") {
        f.model.setDcfField("waccPercent", "11");
        f.model.setDcfField("waccPercent", "10");
      }
      if (action === "exit") {
        f.model.setExitField("cash", "21");
        f.model.setExitField("cash", "20");
      }
      if (action === "scenario") {
        f.model.setExitScenario("base", "exitMultiple", "11");
        f.model.setExitScenario("base", "exitMultiple", "10");
      }
      if (action === "calculate") f.model.calculate();
      expect(f.controller.isCurrent(preview)).toBe(false);
      expect(f.controller.apply(preview).applied).toBe(false);
    },
  );
  it("retains applied provenance through other inputs, scenarios, calculations and separate input captures", async () => {
    const f = await fixture();
    expect(f.apply().applied).toBe(true);
    const context = f.controller.getApplied(eodSelection)!;
    const old = f.model.calculate()!;
    f.model.setDcfField("waccPercent", "11");
    f.model.setExitField("cash", "21");
    f.model.setExitScenario("base", "exitMultiple", "11");
    expect(f.controller.getApplied(eodSelection)).toBe(context);
    expect(annualRevenueBasisContextIsOwned(context, eodSelection, old)).toBe(
      false,
    );
    const calculation = f.model.calculate()!;
    expect(
      annualRevenueBasisContextIsOwned(context, eodSelection, calculation),
    ).toBe(true);
    const inputs = f.model.captureInputs()!;
    expect(f.model.acknowledgeSavedInputs(inputs)).toBe(true);
    expect(f.controller.getApplied(eodSelection)).toBe(context);
  });
  it.each([
    "field",
    "restore",
    "draftRestore",
    "discard",
    "context",
    "origin",
    "retire",
  ] as const)(
    "permanently retires applied provenance after %s, including a return",
    async (action) => {
      const f = await fixture();
      expect(f.apply().applied).toBe(true);
      const context = f.controller.getApplied(eodSelection)!;
      const entry = f.model.captureInputs()!.entry;
      if (action === "field") {
        f.model.setExitField("baseRevenue", "1");
        f.model.setExitField("baseRevenue", context.baseRevenue);
      }
      if (action === "restore")
        f.model.restoreInputs(entry, f.model.getSnapshot());
      if (action === "draftRestore")
        f.model.restoreDraftInputs(entry, f.model.getSnapshot());
      if (action === "discard") {
        f.model.discardAndUse(eodSelection);
        f.model.setExitField("baseRevenue", context.baseRevenue);
      }
      if (action === "context") {
        f.model.activate(null);
        f.model.activate(eodSelection);
      }
      if (action === "origin") {
        f.model.activate({ ...eodSelection, origin: "route" });
        f.model.activate(eodSelection);
      }
      if (action === "retire") f.model.retire();
      expect(f.controller.getApplied(eodSelection)).toBeNull();
      expect(annualRevenueBasisExcerpt(context)).toBeNull();
    },
  );
  it("retires observed visit/source refusals permanently and clears explicit source invalidation", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    f.current.value = false;
    f.controller.reconcile();
    f.current.value = true;
    expect(f.controller.apply(preview).applied).toBe(false);
    expect(f.apply().applied).toBe(true);
    const context = f.controller.getApplied(eodSelection)!;
    f.controller.invalidate();
    expect(f.controller.getApplied(eodSelection)).toBeNull();
    expect(annualRevenueBasisExcerpt(context)).toBeNull();
  });
  it("consumes before callbacks and refuses a callback that invalidates the source", async () => {
    const f = await fixture();
    const shouldInvalidate = { value: false };
    f.input.isCurrent = () => {
      if (shouldInvalidate.value) f.controller.invalidate();
      return true;
    };
    const preview = f.prepare().preview!;
    const setter = vi.spyOn(f.model, "setExitField");
    shouldInvalidate.value = true;
    expect(f.controller.apply(preview).applied).toBe(false);
    expect(setter).not.toHaveBeenCalled();
  });
  it("does not attach provenance after a reentrant base change and exact return", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    const listener = { ran: false };
    f.model.subscribe(() => {
      if (listener.ran) return;
      listener.ran = true;
      f.model.setExitField("baseRevenue", "2");
      f.model.setExitField("baseRevenue", preview.source.value);
    });
    expect(f.controller.apply(preview).applied).toBe(false);
    expect(f.model.getSnapshot().exitDraft.baseRevenue).toBe(
      preview.source.value,
    );
    expect(f.controller.getApplied(eodSelection)).toBeNull();
  });
  it("preserves newer reentrant authored work without attaching retired source context", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    const listener = { ran: false };
    f.model.subscribe(() => {
      if (listener.ran) return;
      listener.ran = true;
      f.controller.invalidate();
      f.model.setDcfField("waccPercent", "12");
    });
    expect(f.controller.apply(preview).applied).toBe(false);
    expect(f.model.getSnapshot().dcfDraft.waccPercent).toBe("12");
    expect(f.controller.getApplied(eodSelection)).toBeNull();
  });
  it("cannot replay from a synchronous model notification", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    const replays: boolean[] = [];
    f.model.subscribe(() => replays.push(f.controller.apply(preview).applied));
    expect(f.controller.apply(preview).applied).toBe(true);
    expect(replays).toEqual([false]);
  });
  it("refuses a throwing visit guard without changing the model", async () => {
    const f = await fixture();
    f.input.isCurrent = () => {
      throw new Error("invented refusal");
    };
    expect(f.prepare().preview).toBeNull();
    expect(f.model.getSnapshot().exitDraft.baseRevenue).toBe("1000");
  });
  it.each(["edit-return", "calculate"] as const)(
    "does not attach after reentrant %s during the field publication",
    async (action) => {
      const f = await fixture();
      const preview = f.prepare().preview!;
      const listener = { ran: false };
      f.model.subscribe(() => {
        if (listener.ran) return;
        listener.ran = true;
        if (action === "calculate") {
          f.model.calculate();
          return;
        }
        f.model.setDcfField("waccPercent", "12");
        f.model.setDcfField("waccPercent", "10");
      });
      expect(f.controller.apply(preview).applied).toBe(false);
      expect(f.controller.getApplied(eodSelection)).toBeNull();
      expect(f.model.getSnapshot().exitDraft.baseRevenue).toBe(
        preview.source.value,
      );
    },
  );
  it("refuses an error state that is not qualified as retained previous evidence", async () => {
    const f = await fixture();
    expect(
      resolveAnnualRevenueBasis(
        eodSelection,
        { ...f.annual, error: true, showingPrevious: false },
        "Revenues",
      ).source,
    ).toBeNull();
  });
  it.each(["request", "watchlist-comparison", "financial-screen"] as const)(
    "captures admitted %s origin without renewing source clocks",
    async (responseOrigin) => {
      const f = await fixture();
      f.input.annual = { ...f.annual, responseOrigin };
      const preview = f.prepare().preview!;
      expect(preview.source.responseOrigin).toBe(responseOrigin);
      expect(preview.source.completedAt).toBe(
        f.response.evidence.generation.completedAt,
      );
      expect(f.controller.apply(preview).applied).toBe(true);
      expect(f.controller.getApplied(eodSelection)!.source.responseOrigin).toBe(
        responseOrigin,
      );
    },
  );
  it("refuses a source state with no admitted response origin", async () => {
    const f = await fixture();
    expect(
      resolveAnnualRevenueBasis(
        eodSelection,
        { ...f.annual, responseOrigin: null },
        "Revenues",
      ).source,
    ).toBeNull();
  });
  it("retains the exact SEC source CIK without inferring an unknown model CIK", async () => {
    const f = await fixture();
    const selection = { ...eodSelection, cik: null };
    f.annualModel.open(selection);
    await f.annualModel.load();
    f.model.activate(selection);
    f.model.discardAndUse(selection);
    fill(f.model);
    f.input.selection = selection;
    f.input.annual = f.annualModel.getSnapshot();
    const preview = f.prepare().preview!;
    expect(preview.source.cik).toBe("0000000001");
    expect(preview.before.cik).toBeNull();
    expect(preview.after.cik).toBeNull();
    expect(preview.excerpt).toContain("SEC source CIK 0000000001;");
    expect(f.controller.apply(preview).applied).toBe(true);
    const context = f.controller.getApplied(selection)!;
    expect(context.source.cik).toBe("0000000001");
    expect(context.selection.cik).toBeNull();
    expect(f.model.getSnapshot().owner!.cik).toBeNull();
    expect(f.model.captureInputs()!.entry.cik).toBeNull();
    const calculation = f.model.calculate()!;
    expect(calculation.owner.cik).toBeNull();
    expect(
      annualRevenueBasisContextIsOwned(context, selection, calculation),
    ).toBe(true);
  });
});
