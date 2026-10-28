import { describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ResearchFollowup,
  ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { eodSelection } from "./eod-history-fixture";
import { ManagedResearchFollowups } from "./managed-research-followups";
import {
  ManagedValuationWorkbench,
  VALUATION_SCENARIOS,
  type DcfField,
  type ExitField,
  type ManagedValuationCalculation,
} from "./managed-valuation-workbench";
import {
  prepareValuationFollowup,
  resolveValuationFollowupScenario,
  type ValuationFollowupPort,
} from "./managed-valuation-followup";

const selection = eodSelection;
const member = { ...selection.listing, note: "Keep this company note" };
const question = "Will the next report support this assumption? · Café 東京 😀";
const dueOn = "2026-12-31";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function existing(n: number, same = false): ResearchFollowup {
  return {
    id: id(n),
    listing: same
      ? selection.listing
      : { ...selection.listing, listingId: `other-${n}` },
    catalogSnapshotSha256: selection.catalogSnapshotSha256,
    check: "Previous completed question",
    dueOn,
    status: "completed",
    completedOn: "2026-10-25",
    result: "Keep previous result",
  };
}
function calculationFixture() {
  const workbench = new ManagedValuationWorkbench();
  workbench.activate(selection);
  for (const [key, value] of Object.entries({
    startingUnleveredCashFlowUsd: "100.125",
    enterpriseToEquityBridgeUsd: "-20.25",
    dilutedShares: "10",
    waccPercent: "10",
    terminalGrowthPercent: "2",
  }))
    workbench.setDcfField(key as DcfField, value);
  for (const [key, value] of Object.entries({
    baseRevenue: "1000.125",
    cash: "20.25",
    debt: "10.125",
    dilutedShares: "10",
    discountRatePercent: "10",
  }))
    workbench.setExitField(key as ExitField, value);
  for (const [index, scenario] of VALUATION_SCENARIOS.entries()) {
    workbench.setDcfScenario(scenario, String(index * 5));
    workbench.setExitScenario(
      scenario,
      "annualRevenueGrowthPercent",
      String(index * 5),
    );
    workbench.setExitScenario(scenario, "targetEbitdaMarginPercent", "20");
    workbench.setExitScenario(scenario, "exitMultiple", "10");
  }
  return { workbench, calculation: workbench.calculate()! };
}
async function fixture(entries: readonly ResearchFollowup[] = [], load = true) {
  const valuation = calculationFixture();
  const initial: ResearchFollowupsPayload = { schemaVersion: 1, entries };
  const api = {
    loadFollowups: vi
      .fn<ManagedApi["loadFollowups"]>()
      .mockResolvedValue({ version: entries.length ? 1 : 0, payload: initial }),
    saveFollowups: vi.fn<ManagedApi["saveFollowups"]>(),
    resolve: vi.fn<ManagedApi["resolve"]>(),
  };
  const context: {
    draft: MainWatchlistPayload;
    catalogSnapshotSha256: string;
  } = {
    draft: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: selection.catalogSnapshotSha256,
      memberships: [member],
    },
    catalogSnapshotSha256: selection.catalogSnapshotSha256,
  };
  const newEntryId = vi.fn(() => id(100));
  const model = new ManagedResearchFollowups(
    api,
    {
      userId: "invented-valuation-user",
      sessionId: "invented-valuation-session",
      getToken: vi.fn(),
      signOut: vi.fn(),
    },
    { getCreationContext: () => context, onRetire: vi.fn(), newEntryId },
  );
  if (load) await model.coordinator.load();
  const saved = model.coordinator.getSnapshot();
  const watchlist = context.draft;
  const host = { active: true, revision: {}, form: {} };
  const revision = host.revision,
    form = host.form;
  const port: ValuationFollowupPort = {
    model,
    member,
    calculation: valuation.calculation,
    isCurrent: () =>
      host.active &&
      host.revision === revision &&
      context.draft === watchlist &&
      model.coordinator.getSnapshot() === saved,
  };
  const formCurrent = () => host.form === form;
  const prepare = (
    raw = question,
    date = dueOn,
    kind = "dcf",
    scenario = "base",
  ) =>
    prepareValuationFollowup(
      port,
      { model: kind, scenario: scenario, question: raw, dueOn: date },
      formCurrent,
    );
  return {
    ...valuation,
    model,
    port,
    api,
    context,
    host,
    formCurrent,
    prepare,
    newEntryId,
  };
}
function noEffects(f: Awaited<ReturnType<typeof fixture>>) {
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(f.context.draft.memberships).toEqual([member]);
}

describe("one explicit authored valuation scenario in Follow-ups", () => {
  it.each(["dcf", "exit"] as const)(
    "keeps all three %s engine strings and the complete saved summary without calculation or Save",
    async (model) => {
      const f = await fixture([existing(1)]);
      const calculate = vi.spyOn(f.workbench, "calculate");
      const before = f.workbench.getSnapshot();
      const result =
        model === "dcf" ? f.calculation.dcfResult : f.calculation.exitResult;
      expect(result.status).toBe("available");
      if (result.status !== "available")
        throw new Error("Fixture must calculate");
      for (const scenario of VALUATION_SCENARIOS) {
        const summary = resolveValuationFollowupScenario(
          f.calculation,
          model,
          scenario,
        ).summary!;
        const row = result.scenarios[scenario];
        const value =
          "valuePerShareUsd" in row
            ? row.valuePerShareUsd
            : "valuePerShare" in row
              ? row.valuePerShare
              : null;
        expect(summary.valuePerShareUsd).toBe(value);
        expect(summary.text).toBe(
          `Authored estimate: ${model === "dcf" ? "DCF" : "Exit multiple"} ${result.modelVersion}; ${summary.scenarioLabel} scenario; USD/share ${value}. Summary only; inputs and source evidence not included.`,
        );
        expect(summary.text).not.toContain("schema");
        expect(Object.isFrozen(summary)).toBe(true);
        const preview = f.prepare(question, dueOn, model, scenario).preview!;
        expect(preview.check).toBe(`Question: ${question} | ${summary.text}`);
        expect(preview.listing).toEqual(selection.listing);
        expect(preview.catalogSnapshotSha256).toBe(
          selection.catalogSnapshotSha256,
        );
        expect(preview.dueOn).toBe(dueOn);
        expect(Object.isFrozen(preview)).toBe(true);
        preview.cancel();
      }
      expect(calculate).not.toHaveBeenCalled();
      expect(f.workbench.getSnapshot()).toBe(before);
      expect(f.api.loadFollowups).toHaveBeenCalledOnce();
      noEffects(f);
    },
  );
  it("creates only the precise preview once, preserves another completed entry and consumes before synchronous notifications", async () => {
    const previous = existing(1),
      f = await fixture([previous]);
    const preview = f.prepare().preview!,
      second = f.prepare().preview!;
    let reentrant: unknown = "not called";
    const stop = f.model.coordinator.subscribe(() => {
      reentrant = preview.create();
    });
    const created = preview.create();
    stop();
    expect(reentrant).toBeNull();
    expect(created).toMatchObject({
      listing: preview.listing,
      check: preview.check,
      dueOn,
      status: "open",
      result: "",
      completedOn: null,
    });
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([
      previous,
      created,
    ]);
    expect(preview.create()).toBeNull();
    expect(second.create()).toBeNull();
    expect(f.newEntryId).toHaveBeenCalledOnce();
    noEffects(f);
  });
  it.each([
    ["", "base"],
    ["fcff", "base"],
    ["DCF", "base"],
    ["exit", ""],
    ["dcf", "Base"],
    ["exit", "unknown"],
  ])(
    "requires an explicit recognized model/scenario %j %j",
    async (model, scenario) => {
      const f = await fixture();
      expect(f.prepare(question, dueOn, model, scenario).preview).toBeNull();
      expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
      noEffects(f);
    },
  );
  it("rejects null, forged and stale calculations", async () => {
    const f = await fixture();
    expect(
      resolveValuationFollowupScenario(null, "dcf", "base").summary,
    ).toBeNull();
    expect(
      resolveValuationFollowupScenario({ ...f.calculation }, "dcf", "base")
        .summary,
    ).toBeNull();
    expect(
      prepareValuationFollowup(
        { ...f.port, calculation: structuredClone(f.calculation) },
        { model: "dcf", scenario: "base", question: question, dueOn: dueOn },
        () => true,
      ).preview,
    ).toBeNull();
    f.workbench.calculate();
    expect(f.prepare().preview).toBeNull();
  });
  it.each(["dcf", "exit"] as const)(
    "refuses an unavailable %s scenario, including Exit's retained numeric output",
    async (model) => {
      const f = await fixture();
      f.workbench.setDcfField("enterpriseToEquityBridgeUsd", "1000000");
      f.workbench.setExitField("debt", "1000000");
      const calculation = f.workbench.calculate()!;
      const result =
        model === "dcf" ? calculation.dcfResult : calculation.exitResult;
      expect(result.status).toBe("available");
      if (result.status !== "available")
        throw new Error("Fixture must calculate");
      expect(result.scenarios.base.status).toBe("unavailable");
      if (model === "exit") {
        const exit = calculation.exitResult;
        if (exit.status !== "available")
          throw new Error("Fixture must calculate");
        expect(typeof exit.scenarios.base.valuePerShare).toBe("string");
      }
      expect(
        resolveValuationFollowupScenario(calculation, model, "base").summary,
      ).toBeNull();
      expect(
        prepareValuationFollowup(
          { ...f.port, calculation },
          { model: model, scenario: "base", question: question, dueOn: dueOn },
          () => true,
        ).preview,
      ).toBeNull();
      noEffects(f);
    },
  );
  it.each(["dcf", "exit"] as const)(
    "preserves an available %s value rounded to exactly 0.00",
    async (model) => {
      const f = await fixture();
      f.workbench.setDcfField("startingUnleveredCashFlowUsd", "0.000000000001");
      f.workbench.setDcfField("enterpriseToEquityBridgeUsd", "0");
      f.workbench.setDcfField("dilutedShares", "1000000000000");
      f.workbench.setExitField("baseRevenue", "0.000000000001");
      f.workbench.setExitField("cash", "0");
      f.workbench.setExitField("debt", "0");
      f.workbench.setExitField("dilutedShares", "1000000000000");
      const calculation = f.workbench.calculate()!;
      const preview = prepareValuationFollowup(
        { ...f.port, calculation },
        { model: model, scenario: "base", question: question, dueOn: dueOn },
        () => true,
      ).preview!;
      expect(preview.summary.valuePerShareUsd).toBe("0.00");
      expect(preview.create()!.check).toContain("USD/share 0.00.");
    },
  );
  it.each(["dcf", "exit"] as const)(
    "admits %s independently of the other model's unavailable inputs",
    async (model) => {
      const f = await fixture();
      if (model === "exit") f.workbench.setDcfField("waccPercent", "invalid");
      else f.workbench.setExitField("debt", "invalid");
      const calculation = f.workbench.calculate()!;
      const other =
        model === "dcf" ? calculation.exitResult : calculation.dcfResult;
      expect(other.status).toBe("unavailable");
      expect(
        resolveValuationFollowupScenario(calculation, model, "base").summary,
      ).not.toBeNull();
      expect(
        resolveValuationFollowupScenario(
          calculation,
          model === "dcf" ? "exit" : "dcf",
          "base",
        ).summary,
      ).toBeNull();
    },
  );
  it.each([
    "",
    " ",
    "line\nbreak",
    "tab\tquestion",
    "control\u0000",
    "format\u200d",
    "bad\ud800",
    "😀".repeat(501),
  ])("refuses invalid raw authored question %j", async (raw) => {
    const f = await fixture();
    expect(f.prepare(raw).preview).toBeNull();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
    noEffects(f);
  });
  it("checks the complete raw code-point bound before NFC normalization without clipping", async () => {
    const f = await fixture();
    const overhead = [...f.prepare("a").preview!.check].length - 1;
    const room = 500 - overhead;
    const exact = f.prepare("😀".repeat(room)).preview!;
    expect([...exact.check]).toHaveLength(500);
    expect(exact.check).toContain("😀".repeat(room));
    expect(f.prepare("😀".repeat(room + 1)).preview).toBeNull();
    expect(
      f.prepare("e\u0301".repeat(Math.floor(room / 2) + 1)).preview,
    ).toBeNull();
    const normalized = f.prepare("  Cafe\u0301 東京 😀  ").preview!;
    expect(normalized.check).toContain(
      "Question:   Café 東京 😀   | Authored estimate:",
    );
    expect(normalized.create()!.check).toBe(normalized.check);
  });
  it.each([
    "",
    "2026-02-29",
    "0000-01-01",
    "10000-01-01",
    "2026-12-31T00:00:00Z",
  ])("refuses an invalid planning date %j", async (date) => {
    const f = await fixture();
    expect(f.prepare(question, date).preview).toBeNull();
    noEffects(f);
  });
  it("accepts an early real planning date without inventing a model capture time", async () => {
    const f = await fixture();
    const preview = f.prepare(question, "0001-01-01").preview!;
    expect(preview.dueOn).toBe("0001-01-01");
    expect(preview.check).not.toContain("0001");
  });
  it("requires explicit initial Load and preserves duplicate and whole-resource capacity refusals", async () => {
    const unloaded = await fixture([], false);
    expect(unloaded.prepare().preview).toBeNull();
    expect(unloaded.api.loadFollowups).not.toHaveBeenCalled();
    const duplicate = await fixture([existing(1, true)]);
    expect(duplicate.prepare().reason).toContain("already has a follow-up");
    const full = await fixture(
      Array.from({ length: 20 }, (_, i) => existing(i)),
    );
    expect(full.prepare().reason).toContain("20 entries");
    for (const f of [unloaded, duplicate, full]) noEffects(f);
  });
  it("requires exact member share class and calculation catalog digest", async () => {
    const f = await fixture();
    expect(
      prepareValuationFollowup(
        { ...f.port, member: { ...member, shareClassId: "foreign" } },
        { model: "dcf", scenario: "base", question: question, dueOn: dueOn },
        () => true,
      ).preview,
    ).toBeNull();
    const foreign = `sha256:${"b".repeat(64)}` as const;
    f.context.catalogSnapshotSha256 = foreign;
    f.context.draft = { ...f.context.draft, snapshotSha256: foreign };
    f.model.syncCatalog(foreign);
    const port = { ...f.port, isCurrent: () => true };
    expect(
      prepareValuationFollowup(
        port,
        { model: "dcf", scenario: "base", question: question, dueOn: dueOn },
        () => true,
      ).preview,
    ).toBeNull();
  });
  it("owns the frozen preview receiver and consumes Cancel without mutation", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!,
      forged = { ...preview };
    expect(forged.isCurrent()).toBe(false);
    expect(forged.create()).toBeNull();
    forged.cancel();
    expect(preview.isCurrent()).toBe(true);
    preview.cancel();
    expect(preview.create()).toBeNull();
    expect(f.newEntryId).not.toHaveBeenCalled();
  });
  it.each([
    "model",
    "recalculate",
    "restore",
    "discard",
    "visit",
    "rejected",
    "retire",
  ])(
    "permanently fences %s transitions even when values return",
    async (kind) => {
      const f = await fixture();
      const preview = f.prepare().preview!;
      if (kind === "model") {
        f.workbench.setExitField("cash", "99");
        f.workbench.setExitField("cash", "20.25");
      }
      if (kind === "recalculate") f.workbench.calculate();
      if (kind === "restore") {
        const entry = f.workbench.captureInputs()!.entry;
        expect(
          f.workbench.restoreDraftInputs(entry, f.workbench.getSnapshot()),
        ).toBe(true);
      }
      if (kind === "discard") f.workbench.discardAndUse(selection);
      if (kind === "visit") {
        f.workbench.activate(null);
        f.workbench.activate(selection);
      }
      if (kind === "rejected") {
        expect(f.workbench.setExitField("cash", "9".repeat(513))).toBe(false);
        f.workbench.setExitField("cash", "20.25");
      }
      if (kind === "retire") f.workbench.retire();
      expect(preview.isCurrent()).toBe(false);
      expect(preview.create()).toBeNull();
      expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
    },
  );
  it.each(["host", "form", "draft"])(
    "retires an observed %s change and return",
    async (kind) => {
      const f = await fixture();
      const preview = f.prepare().preview!;
      if (kind === "host") {
        f.host.active = false;
        expect(preview.isCurrent()).toBe(false);
        f.host.active = true;
      }
      if (kind === "form") {
        const original = f.host.form;
        f.host.form = {};
        expect(preview.isCurrent()).toBe(false);
        f.host.form = original;
      }
      if (kind === "draft") {
        const original = f.model.coordinator.getSnapshot().draft!;
        f.model.coordinator.replaceDraft({
          schemaVersion: 1,
          entries: [existing(1)],
        });
        f.model.coordinator.replaceDraft(original);
      }
      expect(preview.create()).toBeNull();
      noEffects(f);
    },
  );
  it("captures original callbacks and does not retarget after caller mutation", async () => {
    const f = await fixture();
    const mutable = { ...f.port };
    const preview = prepareValuationFollowup(
      mutable,
      { model: "dcf", scenario: "base", question: question, dueOn: dueOn },
      f.formCurrent,
    ).preview!;
    mutable.isCurrent = () => false;
    mutable.calculation = {} as ManagedValuationCalculation;
    const replacement = vi
      .spyOn(f.model, "createNextCheck")
      .mockReturnValue(null);
    expect(preview.create()).not.toBeNull();
    expect(replacement).not.toHaveBeenCalled();
    noEffects(f);
  });
  it("rechecks after preparation and during UUID creation, then refuses reentrant lifetime changes", async () => {
    const f = await fixture();
    const original = f.model.prepareNextCheck.bind(f.model);
    const stop = vi
      .spyOn(f.model, "prepareNextCheck")
      .mockImplementation((...args) => {
        const result = original(...args);
        f.host.active = false;
        return result;
      });
    expect(f.prepare().preview).toBeNull();
    stop.mockRestore();
    f.host.active = true;
    const preview = f.prepare().preview!;
    f.newEntryId.mockImplementation(() => {
      f.workbench.calculate();
      return id(100);
    });
    expect(preview.create()).toBeNull();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
    noEffects(f);
  });
  it("rechecks calculation ownership after a host callback at the final UUID admission", async () => {
    const f = await fixture();
    let armed = false;
    const port = {
      ...f.port,
      isCurrent: () => {
        if (armed) {
          armed = false;
          f.workbench.calculate();
        }
        return f.port.isCurrent();
      },
    };
    const preview = prepareValuationFollowup(
      port,
      { model: "dcf", scenario: "base", question: question, dueOn: dueOn },
      f.formCurrent,
    ).preview!;
    f.newEntryId.mockImplementation(() => {
      armed = true;
      return id(100);
    });
    expect(preview.create()).toBeNull();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
    noEffects(f);
  });
  it("retires throwing lifetime callbacks and consumes a failed creation before reentry", async () => {
    const f = await fixture();
    const port = {
      ...f.port,
      isCurrent: () => {
        throw new Error("Invented guard failure");
      },
    };
    expect(
      prepareValuationFollowup(
        port,
        { model: "dcf", scenario: "base", question: question, dueOn: dueOn },
        () => true,
      ).preview,
    ).toBeNull();
    const create = vi
      .spyOn(f.model, "createNextCheck")
      .mockImplementation(() => {
        throw new Error("Invented create failure");
      });
    const preview = f.prepare().preview!;
    expect(preview.create()).toBeNull();
    expect(preview.create()).toBeNull();
    expect(create).toHaveBeenCalledOnce();
    noEffects(f);
  });
});

it("captures authored choice values before caller callbacks can mutate their object", async () => {
  const f = await fixture();
  const choice = { model: "dcf", scenario: "base", question, dueOn };
  const prepared = prepareValuationFollowup(f.port, choice, () => {
    choice.model = "exit";
    choice.scenario = "expansion";
    choice.question = "Changed outside the captured form";
    choice.dueOn = "2027-01-01";
    return true;
  });
  expect(prepared.reason).toBeNull();
  const preview = prepared.preview!;
  expect(preview.summary.model).toBe("dcf");
  expect(preview.summary.scenario).toBe("base");
  expect(preview.check).toContain(`Question: ${question} |`);
  expect(preview.check).not.toContain("Changed outside");
  expect(preview.dueOn).toBe(dueOn);
  expect(preview.create()).toMatchObject({ check: preview.check, dueOn });
  noEffects(f);
});
