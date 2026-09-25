import { getPersonalMarketHistory } from "../../lib/personal-market-snapshot";
import type {
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalAnnualFinancialsDto,
  PersonalMarketDataIdentityDto,
  PersonalMarketOverviewDto,
  PersonalValuationHistoryDto,
} from "@research-cockpit/contracts";
import {
  PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
  PERSONAL_FCFF_DCF_MAXIMUM_DECIMAL_LENGTH,
  type PersonalFcffDcfAssumptions,
  type PersonalFcffDcfInput,
} from "@research-cockpit/personal-market-analytics";
import * as analytics from "@research-cockpit/personal-market-analytics";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPersonalFcffDcfAssumptionDraft,
  PersonalFcffDcfValuation,
  type PersonalFcffDcfAssumptionDraft,
  type PersonalFcffDcfValuationProps,
} from "./PersonalFcffDcfValuation";
import {
  PersonalDcfOutcomeComparison,
  type PersonalDcfOutcomeComparisonProps,
} from "./PersonalDcfOutcomeComparison";

const stateHarness = vi.hoisted(() => {
  let state: unknown;
  const memos: Array<{ dependencies: readonly unknown[]; value: unknown }> = [];
  let memoIndex = 0;
  return {
    beginRender() {
      memoIndex = 0;
    },
    reset() {
      state = undefined;
      memos.splice(0);
      memoIndex = 0;
    },
    set(next: unknown) {
      state = next;
    },
    useState: (initial: unknown) => {
      if (state === undefined) {
        state =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      }
      return [
        state,
        (next: unknown) => {
          state =
            typeof next === "function"
              ? (next as (current: unknown) => unknown)(state)
              : next;
        },
      ];
    },
    useMemo<T>(
      this: void,
      calculate: () => T,
      dependencies: readonly unknown[],
    ): T {
      const index = memoIndex++;
      const prior = memos[index];
      if (
        prior !== undefined &&
        prior.dependencies.length === dependencies.length &&
        dependencies.every((value, position) =>
          Object.is(value, prior.dependencies[position]),
        )
      )
        return prior.value as T;
      const value = calculate();
      memos[index] = { dependencies: [...dependencies], value };
      return value;
    },
  };
});

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal()),
  useState: (initial: unknown) => stateHarness.useState(initial),
  useMemo: stateHarness.useMemo,
}));

beforeEach(() => stateHarness.reset());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PersonalFcffDcfValuation", () => {
  it("preserves DCF history inputs when the independent quote feed refuses access", () => {
    const props = defaultProps();
    const expected = render(props);
    expect(
      render({
        ...props,
        marketOverview: {
          ...marketOverview(),
          quote: { status: "unavailable", reason: "access_denied" },
        },
      }),
    ).toBe(expected);
  });
  it("starts with explicit selection guidance and the permanent decision limits", () => {
    const markup = render({
      annualFinancials: null,
      marketOverview: null,
      selection: null,
      valuationHistory: null,
    });

    expect(markup).toContain("Choose a security to build cash-flow scenarios");
    expect(markup).toContain("starting unlevered FCF proxy is mechanical");
    expect(markup).toContain("not audited FCFF");
    expect(markup).toContain("not appropriate for banks or insurers");
    expect(markup).toContain("REITs");
    expect(markup).toContain("not point-in-time or as-reported history");
    expect(markup).toContain("makes no fetch, persists nothing");
    expect(markup).toContain('aria-live="polite"');
  });

  it("shows each missing source and links back to its explicit loader", () => {
    const markup = render(
      defaultProps({
        annualFinancials: null,
        marketOverview: null,
        valuationHistory: null,
      }),
    );

    expect(markup).toContain("Load ZERO price history");
    expect(markup.match(/Not loaded/gu)).toHaveLength(3);
    expect(markup).toContain('href="#personal-market-overview"');
    expect(markup).toContain('href="#personal-valuation-history-title"');
    expect(markup).toContain('href="#personal-annual-financials-title"');
    expect(markup).toContain(
      "No DCF value, implied growth, sensitivity value, or recommendation was substituted",
    );
  });

  it.each(
    (["issuerName", "securityName"] as const).flatMap((field) =>
      [257, 486, 512].map((length) => ({ field, length })),
    ),
  )(
    "withholds only DCF for a decoder-admitted $length-character $field before any source load",
    ({ field, length }) => {
      const props = defaultProps({
        annualFinancials: null,
        marketOverview: null,
        valuationHistory: null,
      });
      const selection = { ...props.selection!, [field]: "N".repeat(length) };
      const selectedProps = { ...props, selection };
      const before = structuredClone(selectedProps);

      const markup = render(selectedProps);

      expect(markup).toContain(
        "Cash-flow valuation is unavailable for these inputs.",
      );
      expect(markup).toContain("Other company research remains available");
      expect(markup).toContain("no identity was shortened or substituted");
      expect(markup.match(/Not loaded/gu)).toHaveLength(3);
      expect(markup).not.toContain("Conservative scenario");
      expect(markup).not.toContain("Base-scenario implied price");
      expect(selectedProps).toEqual(before);
    },
  );

  it.each(["issuerName", "securityName"] as const)(
    "preserves exact loaded %s above the model limit and withholds calculated outputs",
    (field) => {
      const loadedIdentity = identity({ [field]: "L".repeat(486) });
      const props = defaultProps({
        annualFinancials: annualFinancials(loadedIdentity),
        marketOverview: marketOverview(loadedIdentity),
        selection: { ...loadedIdentity, issuerId: "issuer-zero" },
        valuationHistory: valuationHistory(loadedIdentity),
      });
      const before = structuredClone(props);

      const markup = render(props);

      expect(markup).toContain(
        "Cash-flow valuation is unavailable for these inputs.",
      );
      expect(markup.match(/<dd>Loaded<\/dd>/gu)).toHaveLength(3);
      expect(markup).not.toContain("Conservative scenario");
      expect(markup).not.toContain("WACC × terminal-growth sensitivity");
      expect(props).toEqual(before);
    },
  );

  it("keeps exact boundary-valid identity names and the normal model result", () => {
    const boundaryIdentity = identity({
      issuerName: "I".repeat(256),
      securityName: "S".repeat(256),
    });
    const markup = render(
      defaultProps({
        annualFinancials: annualFinancials(boundaryIdentity),
        marketOverview: marketOverview(boundaryIdentity),
        selection: { ...boundaryIdentity, issuerId: "issuer-zero" },
        valuationHistory: valuationHistory(boundaryIdentity),
      }),
    );

    expect(markup).toContain("Conservative scenario");
    expect(markup).toContain("$1,079.00");
    expect(markup.match(/<td/gu)).toHaveLength(25);
    expect(markup).not.toContain(
      "Cash-flow valuation is unavailable for these inputs.",
    );
  });

  it("recomputes after selecting another company without fetching or retaining an unavailable result", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const longSelection = {
      ...defaultProps().selection!,
      issuerName: "L".repeat(486),
    };
    expect(render(defaultProps({ selection: longSelection }))).toContain(
      "Cash-flow valuation is unavailable for these inputs.",
    );

    const selectedWithoutSources = render(
      defaultProps({
        annualFinancials: null,
        marketOverview: null,
        valuationHistory: null,
      }),
    );
    expect(selectedWithoutSources).toContain("Load ZERO price history");
    expect(selectedWithoutSources).not.toContain("Conservative scenario");

    const loaded = render(defaultProps());
    expect(loaded).toContain("Conservative scenario");
    expect(loaded).not.toContain(
      "Cash-flow valuation is unavailable for these inputs.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not disguise an unexpected model failure as invalid input", () => {
    const failure = new Error("Synthetic unexpected model failure");
    vi.spyOn(
      analytics,
      "calculatePersonalFcffDcfValuation",
    ).mockImplementationOnce(() => {
      throw failure;
    });

    expect(() => render(defaultProps())).toThrow(failure);
  });

  it("renders all forward, reverse, sensitivity, provenance, and formula context from exact loaded inputs", () => {
    const markup = render(defaultProps());

    expect(markup).toContain("Starting unlevered FCF proxy");
    expect(markup).toContain("$1,079.00");
    expect(markup).toContain("Market reference");
    expect(markup).toContain("$100.00");
    expect(markup).not.toContain("$999.00");
    expect(markup).toContain("Quote-consistent share-count proxy");
    expect(markup).toContain("100.000000");
    expect(markup).toContain("Conservative scenario");
    expect(markup).toContain("Base scenario");
    expect(markup).toContain("Expansion scenario");
    expect(markup).toContain("Projection and present-value bridge");
    expect(markup).toContain("Market-implied constant annual FCF-proxy growth");
    expect(markup).toContain("Cent-tie-out solver rate (audit)");
    expect(markup).toContain("It is not a forecast");
    expect(markup).toContain("WACC × terminal-growth sensitivity");
    expect(markup).toContain(
      "Base-scenario implied price per share; WACC by terminal growth",
    );
    expect(markup.match(/<td/gu)).toHaveLength(25);
    expect(markup).toContain('aria-label="Selected assumptions:');
    expect(markup).toContain("Signed reported FCF");
    expect(markup).toContain("−$100.00");
    expect(markup).toContain("its magnitude is $100.00");
    expect(markup).toContain("marginal tax-shield rate assumption");
    expect(markup).toContain("Provider EV-to-equity bridge");
    expect(markup).toContain("Exact source operands");
    expect(markup).toContain("<code>100</code> USD");
    expect(markup).toContain("provider statement date Dec 31, 2029");
    expect(markup).toContain(
      "reported_fcf_plus_after_tax_interest_mechanical_proxy",
    );
    expect(markup).toContain("perpetual_growth_terminal_value");
    expect(markup).toContain("Formula set 1.0.0 · result schema 1.0.0");
    expect(markup).toContain(
      'aria-label="ZERO unlevered FCF-proxy DCF scenarios"',
    );
    expect(markup).toContain('aria-label="ZERO base DCF sensitivity table"');
    expect(markup).toContain('role="region"');
    expect(markup).toContain("Reset illustrative assumptions");
    expect(markup).toContain('id="fcff-dcf-horizon"');
    expect(markup).toContain('value="5"');
    expect(markup).toContain('id="fcff-dcf-tax-rate"');
    expect(markup).toContain('value="21"');
    expect(markup).toContain("Allowed: 1 to 30 %; up to 4 decimal places.");
    expect(markup).toContain("WACC assumption");
    expect(markup).toContain("Allowed: -2 to 5 %; up to 4 decimal places.");
    expect(markup).toContain(
      'aria-describedby="fcff-dcf-wacc-range personal-fcff-dcf-assumption-guidance"',
    );
    expect(markup).toMatch(/id="fcff-dcf-wacc"[^>]*type="text"/u);
    expect(markup).toMatch(/id="fcff-dcf-horizon"[^>]*maxLength="2"/u);
    expect(markup).toMatch(/id="fcff-dcf-wacc"[^>]*maxLength="64"/u);
    expect(markup).toContain('id="fcff-dcf-conservative-growth"');
    expect(markup).toContain('id="fcff-dcf-base-growth"');
    expect(markup).toContain('id="fcff-dcf-expansion-growth"');
  });

  it("fails closed when the three loaded DTOs agree with each other but not the selected listing", () => {
    const other = identity({
      issuerName: "Other Issuer, Inc.",
      listingId: "lst-other",
      securityName: "OTHER Common Stock",
      symbol: "OTHER",
    });
    const markup = render(
      defaultProps({
        annualFinancials: annualFinancials(other),
        marketOverview: marketOverview(other),
        valuationHistory: valuationHistory(other),
      }),
    );

    expect(markup).toContain("Loaded inputs describe different listings");
    expect(markup.match(/Different listing/gu)).toHaveLength(3);
    expect(markup).not.toContain("Conservative scenario");
    expect(markup).not.toContain("WACC × terminal-growth sensitivity");
  });

  it("names unavailable annual inputs without substituting zero", () => {
    const annuals = annualFinancials();
    const markup = render(
      defaultProps({
        annualFinancials: {
          ...annuals,
          years: [
            {
              ...annuals.years[0]!,
              reported: {
                ...annuals.years[0]!.reported,
                interest_expense: unknownAnnualCell(),
              },
            },
          ],
        },
      }),
    );

    expect(markup).toContain("A required annual input is unavailable");
    expect(markup).toContain("Missing annual inputs: interest expense");
    expect(markup).not.toContain("Conservative scenario");
  });

  it("rejects annual information that occurs after the exact market reference date", () => {
    const annuals = annualFinancials();
    const markup = render(
      defaultProps({
        annualFinancials: {
          ...annuals,
          asOf: "2030-01-16T21:00:00.000Z",
          years: [{ ...annuals.years[0]!, statementDate: "2030-01-16" }],
        },
      }),
    );

    expect(markup).toContain(
      "annual statement is later than the market reference date",
    );
    expect(markup).toContain("will not combine a future annual statement");
    expect(markup).not.toContain("Base-scenario implied price");
  });

  it("warns when the computed WACC spread is valid but narrower than one percentage point", () => {
    stateHarness.set(
      draftAssumptions({
        terminalGrowthPercent: "5",
        waccPercent: "5.5",
      }),
    );

    const markup = render(defaultProps());

    expect(markup).toContain(
      "WACC is less than 1.00 percentage point above terminal growth",
    );
    expect(markup).toContain("valid but highly sensitive");
    expect(markup).toContain("Computed DCF assumptions");
    expect(markup).toContain("5.5000%");
    expect(markup).toContain("5.0000%");
    expect(markup).toContain(
      "Unavailable sensitivity: WACC must be greater than terminal growth.",
    );
    expect(markup).toContain(
      "Unavailable sensitivity: WACC or terminal growth is outside the global model bounds.",
    );
    expect(markup).toContain(
      "when either sensitivity rate leaves the global model bounds",
    );
  });

  it.each([
    { expected: false, terminalGrowthPercent: "3.1", waccPercent: "4.1" },
    { expected: true, terminalGrowthPercent: "3.1", waccPercent: "4.0999" },
  ])(
    "handles the exact one-percentage-point warning boundary without binary-float drift: $waccPercent vs $terminalGrowthPercent",
    ({ expected, terminalGrowthPercent, waccPercent }) => {
      stateHarness.set(
        draftAssumptions({
          terminalGrowthPercent,
          waccPercent,
        }),
      );

      const markup = render(defaultProps());
      const warning =
        "WACC is less than 1.00 percentage point above terminal growth";

      if (expected) expect(markup).toContain(warning);
      else expect(markup).not.toContain(warning);
    },
  );

  it("requires ordered independently editable scenario growth rates without auto-sorting", () => {
    stateHarness.set(
      draftAssumptions({
        scenarios: {
          conservative: { annualFcfProxyGrowthPercent: "10" },
          base: { annualFcfProxyGrowthPercent: "5" },
          expansion: { annualFcfProxyGrowthPercent: "0" },
        },
      }),
    );

    const markup = render(defaultProps());

    expect(markup).toContain(
      "Order growth from conservative through expansion",
    );
    expect(markup).toContain("does not auto-sort owner assumptions");
    expect(markup).not.toContain("Conservative scenario");
  });

  it("does not call the strict model with an incomplete editable decimal", () => {
    stateHarness.set(
      draftAssumptions({
        scenarios: {
          ...PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS.scenarios,
          base: { annualFcfProxyGrowthPercent: "" },
        },
      }),
    );

    const markup = render(defaultProps());

    expect(markup).toContain("Finish entering valid assumptions");
    expect(markup).toContain("no stale result is retained while you edit");
    expect(markup).not.toContain("Base-scenario implied price");
  });

  it("does not call the strict model with an oversized or over-precise editable rate", () => {
    for (const waccPercent of [
      "1".repeat(PERSONAL_FCFF_DCF_MAXIMUM_DECIMAL_LENGTH + 1),
      "5.00001",
    ]) {
      stateHarness.set(
        draftAssumptions({
          waccPercent,
        }),
      );

      const markup = render(defaultProps());

      expect(markup).toContain("Finish entering valid assumptions");
      expect(markup).toContain("ordinary decimal notation");
      expect(markup).toContain("no more than four decimal places");
      expect(markup).not.toContain("Base-scenario implied price");
    }
  });

  it("wires editable drafts, valid resumption, and reset through the actual control callbacks", () => {
    const props = defaultProps();
    changeControl(props, "fcff-dcf-wacc", "-");

    let markup = render(props);
    expect(markup).toContain("Finish entering valid assumptions");
    expect(markup).toContain('id="fcff-dcf-wacc"');
    expect(markup).toContain('value="-"');
    expect(markup).not.toContain("Base-scenario implied price");

    changeControl(props, "fcff-dcf-wacc", "9.5");
    markup = render(props);
    expect(markup).toContain("Base-scenario implied price");
    expect(markup).toContain('value="9.5"');

    changeControl(props, "fcff-dcf-horizon", "");
    markup = render(props);
    expect(markup).toContain("Finish entering valid assumptions");
    expect(markup).not.toContain('value="NaN"');
    expect(markup).not.toContain("Base-scenario implied price");

    changeControl(props, "fcff-dcf-horizon", "10");
    markup = render(props);
    expect(markup).toContain("Base-scenario implied price");
    expect(markup).toContain('value="10"');

    clickControl(props, "Reset illustrative assumptions");
    markup = render(props);
    expect(markup).toMatch(/id="fcff-dcf-horizon"[^>]*value="5"/u);
    expect(markup).toMatch(/id="fcff-dcf-wacc"[^>]*value="10"/u);
    expect(markup).toContain("Base-scenario implied price");
  });

  it("keeps controlled raw edits and Reset separate from saved-setting actions", () => {
    let draft = createPersonalFcffDcfAssumptionDraft();
    const onChange = vi.fn(
      (
        update: (
          current: PersonalFcffDcfAssumptionDraft,
        ) => PersonalFcffDcfAssumptionDraft,
      ) => {
        draft = update(draft);
      },
    );
    const onSave = vi.fn();
    const onClear = vi.fn();
    const props = () =>
      defaultProps({
        assumptionControl: { value: draft, onChange },
        savedAssumptionsControls: (
          <div>
            <button onClick={onSave}>Save test assumptions</button>
            <button onClick={onClear}>Clear test assumptions</button>
          </div>
        ),
      });
    changeControl(props(), "fcff-dcf-wacc", "-");
    expect(draft.waccPercent).toBe("-");
    expect(render(props())).toContain("Finish entering valid assumptions");
    changeControl(props(), "fcff-dcf-horizon", "");
    expect(draft.forecastYears).toBe("");
    changeControl(props(), "fcff-dcf-base-growth", "2.");
    expect(draft.scenarios.base.annualFcfProxyGrowthPercent).toBe("2.");
    expect(render(props())).not.toContain("Base-scenario implied price");

    clickControl(props(), "Reset illustrative assumptions");
    expect(draft).toEqual(createPersonalFcffDcfAssumptionDraft());
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(onSave).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
    expect(render(props())).toContain("Base-scenario implied price");
  });

  it("applies functional controlled edits to the latest draft without losing other fields", () => {
    let draft = createPersonalFcffDcfAssumptionDraft();
    const props = defaultProps({
      assumptionControl: {
        value: draft,
        onChange: (update) => {
          draft = update(draft);
        },
      },
    });
    const staleWacc = findHostElement(
      renderTree(props),
      (element) =>
        element.type === "input" && element.props.id === "fcff-dcf-wacc",
    )!;
    draft = {
      ...draft,
      forecastYears: "8",
      scenarios: {
        ...draft.scenarios,
        base: { annualFcfProxyGrowthPercent: "6" },
      },
    };
    (
      staleWacc.props.onChange as (event: { target: { value: string } }) => void
    )({ target: { value: "12" } });
    expect(draft.waccPercent).toBe("12");
    expect(draft.forecastYears).toBe("8");
    expect(draft.scenarios.base.annualFcfProxyGrowthPercent).toBe("6");
  });

  it("uses all seven explicitly restored controlled inputs together without fetching or restoring itself", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const calculate = vi.spyOn(analytics, "calculatePersonalFcffDcfValuation");
    const onChange = vi.fn();
    const restored = {
      forecastYears: "8",
      taxShieldRatePercent: "21.0000",
      waccPercent: "11.0000",
      terminalGrowthPercent: "2.0000",
      scenarios: {
        conservative: { annualFcfProxyGrowthPercent: "-2.0000" },
        base: { annualFcfProxyGrowthPercent: "4.0000" },
        expansion: { annualFcfProxyGrowthPercent: "9.0000" },
      },
    } satisfies PersonalFcffDcfAssumptionDraft;
    const props = defaultProps({
      assumptionControl: { value: restored, onChange },
    });
    const markup = render(props);
    expect(calculate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        assumptions: { ...restored, forecastYears: 8 },
      }),
    );
    expect(markup).toContain("Base-scenario implied price");
    for (const [id, value] of [
      ["fcff-dcf-horizon", "8"],
      ["fcff-dcf-tax-rate", "21.0000"],
      ["fcff-dcf-wacc", "11.0000"],
      ["fcff-dcf-terminal-growth", "2.0000"],
      ["fcff-dcf-conservative-growth", "-2.0000"],
      ["fcff-dcf-base-growth", "4.0000"],
      ["fcff-dcf-expansion-growth", "9.0000"],
    ]) {
      expect(
        findHostElement(
          renderTree(props),
          (element) => element.type === "input" && element.props.id === id,
        )?.props.value,
      ).toBe(value);
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows the saved-controls slot only for a selection and describes its persistence separately", () => {
    const controls = <aside>Explicit saved-assumption controls</aside>;
    const withSelection = render(
      defaultProps({ savedAssumptionsControls: controls }),
    );
    expect(withSelection).toContain("Explicit saved-assumption controls");
    expect(withSelection.indexOf("Illustrative assumptions")).toBeLessThan(
      withSelection.indexOf("Explicit saved-assumption controls"),
    );
    expect(withSelection).toContain(
      "Only assumptions can be saved through the explicit controls",
    );
    expect(withSelection).toContain("saves no source data or results");
    expect(withSelection).not.toContain("persists nothing");
    expect(
      render(
        defaultProps({ selection: null, savedAssumptionsControls: controls }),
      ),
    ).not.toContain("Explicit saved-assumption controls");
    expect(render(defaultProps())).toContain(
      "makes no fetch, persists nothing",
    );
  });

  it("initializes independent raw drafts without changing numeric strings or sharing scenario objects", () => {
    const source = structuredClone(PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS);
    const first = createPersonalFcffDcfAssumptionDraft(source);
    const second = createPersonalFcffDcfAssumptionDraft(source);
    expect(first.forecastYears).toBe(String(source.forecastYears));
    expect(first.waccPercent).toBe(source.waccPercent);
    expect(first.scenarios).not.toBe(source.scenarios);
    for (const name of ["conservative", "base", "expansion"] as const) {
      expect(first.scenarios[name]).not.toBe(source.scenarios[name]);
      expect(first.scenarios[name]).not.toBe(second.scenarios[name]);
      expect(first.scenarios[name]).toEqual(source.scenarios[name]);
    }
  });

  it.each(["", "-", "5.5", "1e1", "0xA", " 10"])(
    "keeps invalid forecast-horizon draft %j visible and out of the strict model",
    (forecastYears) => {
      stateHarness.set(draftAssumptions({ forecastYears }));

      const markup = render(defaultProps());

      expect(markup).toContain("Finish entering valid assumptions");
      expect(markup).toContain(
        "forecast horizon with an ordinary whole number",
      );
      expect(markup).toContain("no stale result is retained while you edit");
      expect(markup).not.toContain("Base-scenario implied price");
      expect(markup).not.toContain('value="NaN"');
    },
  );

  it("explains nonpositive residual-equity sensitivity cells", () => {
    const valuation = valuationHistory();
    const point = {
      ...valuation.history.points[0]!,
      enterpriseValue: knownMoney("1000000"),
    };
    const markup = render(
      defaultProps({
        valuationHistory: {
          ...valuation,
          history: {
            ...valuation.history,
            latestPoint: point,
            points: [point],
          },
        },
      }),
    );

    expect(markup).toContain(
      "Unavailable sensitivity: modeled residual equity value is not positive.",
    );
    expect(markup).toContain("No positive residual equity value");
  });
});

describe("current and loaded saved DCF outcomes", () => {
  it.each([
    ["forecast years", { forecastYears: 8 }],
    ["tax shield", { taxShieldRatePercent: "45.0000" }],
    ["WACC", { waccPercent: "13.0000" }],
    ["terminal growth", { terminalGrowthPercent: "3.0000" }],
    [
      "conservative growth",
      { scenarios: scenarioInputs("-5.0000", "5.0000", "10.0000") },
    ],
    [
      "base growth",
      { scenarios: scenarioInputs("0.0000", "7.0000", "10.0000") },
    ],
    [
      "expansion growth",
      { scenarios: scenarioInputs("0.0000", "5.0000", "15.0000") },
    ],
  ] satisfies Array<[string, Partial<PersonalFcffDcfAssumptions>]>)(
    "matches independent unchanged-engine calculations when saved %s differs",
    (_name, patch) => {
      const saved = canonicalAssumptions(patch);
      const props = comparedProps(saved);
      const before = structuredClone(props);
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const comparison = outcomeProps(props);
      expect(comparison.current).toMatchObject({
        status: "available",
        result: analytics.calculatePersonalFcffDcfValuation(
          independentInput(PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS),
        ),
      });
      expect(comparison.saved).toMatchObject({
        status: "available",
        result: analytics.calculatePersonalFcffDcfValuation(
          independentInput(saved),
        ),
      });
      if (
        comparison.current.status !== "available" ||
        comparison.saved.status !== "available"
      )
        throw new Error("Expected both model results");
      expect(comparison.current.result.scenarios).not.toEqual(
        comparison.saved.result.scenarios,
      );
      expect(comparison.current.result.reference.sourceOperands).toEqual(
        comparison.saved.result.reference.sourceOperands,
      );
      expect(props).toEqual(before);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("keeps raw negative-zero echoes while equivalent canonical inputs give equal numerical outcomes", () => {
    const raw = {
      ...PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
      taxShieldRatePercent: "-0.0000",
      terminalGrowthPercent: "-0",
      scenarios: scenarioInputs("-0.000", "5.0", "10.00"),
    };
    const saved = canonicalAssumptions({
      taxShieldRatePercent: "0.0000",
      terminalGrowthPercent: "0.0000",
    });
    const props = comparedProps(saved, {
      assumptionControl: {
        value: createPersonalFcffDcfAssumptionDraft(raw),
        onChange: vi.fn(),
      },
    });
    const comparison = outcomeProps(props);
    if (
      comparison.current.status !== "available" ||
      comparison.saved.status !== "available"
    )
      throw new Error("Expected equivalent available results");
    expect(comparison.current.result.assumptions).toEqual(raw);
    expect(comparison.saved.result.assumptions).toEqual(saved);
    expect({ ...comparison.current.result, assumptions: saved }).toEqual(
      comparison.saved.result,
    );
    expect(props.assumptionControl!.value.taxShieldRatePercent).toBe("-0.0000");
    expect(props.assumptionControl!.onChange).not.toHaveBeenCalled();
  });

  it("shares exact source operands and coordinates without equating tax-derived starting proxies", () => {
    const comparison = outcomeProps(
      comparedProps(canonicalAssumptions({ taxShieldRatePercent: "50.0000" })),
    );
    if (
      comparison.current.status !== "available" ||
      comparison.saved.status !== "available"
    )
      throw new Error("Expected tax comparison");
    const current = comparison.current.result.reference;
    const saved = comparison.saved.result.reference;
    expect(current.sourceOperands).toEqual(saved.sourceOperands);
    expect(current).not.toEqual(saved);
    expect(comparison.current.result).toEqual(
      analytics.calculatePersonalFcffDcfValuation(
        independentInput(PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS),
      ),
    );
    expect(comparison.saved.result).toEqual(
      analytics.calculatePersonalFcffDcfValuation(
        independentInput(
          canonicalAssumptions({ taxShieldRatePercent: "50.0000" }),
        ),
      ),
    );
  });

  it.each([true, false])(
    "withholds the whole invalid current side independently of source readiness (%s)",
    (loaded) => {
      const props = comparedProps(canonicalAssumptions(), {
        ...(loaded
          ? {}
          : {
              annualFinancials: null,
              marketOverview: null,
              valuationHistory: null,
            }),
        assumptionControl: {
          value: {
            ...createPersonalFcffDcfAssumptionDraft(),
            waccPercent: "31",
          },
          onChange: vi.fn(),
        },
        savedAssumptionsComparison: {
          assumptions: canonicalAssumptions(),
          currentDraftValid: false,
        },
      });
      const comparison = outcomeProps(props);
      expect(comparison.current.status).toBe("unavailable");
      expect(comparison.current).not.toHaveProperty("result");
      if (comparison.current.status !== "unavailable")
        throw new Error("Expected invalid draft");
      expect(comparison.current.reason).toContain(
        "complete valid current draft",
      );
      expect(comparison.saved.status).toBe(
        loaded ? "available" : "unavailable",
      );
    },
  );

  it.each([
    "missing annuals",
    "wrong range",
    "mismatched identity",
    "no shared date",
    "unknown cash flow",
    "long identity",
  ] as const)(
    "replaces both prior available sides with unavailable outcomes for %s",
    (reason) => {
      const saved = canonicalAssumptions();
      const initial = comparedProps(saved);
      expect(outcomeProps(initial).saved.status).toBe("available");
      let props = initial;
      if (reason === "missing annuals")
        props = { ...props, annualFinancials: null };
      if (reason === "wrong range")
        props = {
          ...props,
          marketOverview: {
            ...props.marketOverview!,
            history: {
              status: "available",
              value: {
                ...getPersonalMarketHistory(props.marketOverview)!,
                range: "1m",
              },
            },
          },
        };
      if (reason === "mismatched identity")
        props = {
          ...props,
          valuationHistory: valuationHistory(
            identity({ issuerName: "Different exact issuer" }),
          ),
        };
      if (reason === "no shared date")
        props = {
          ...props,
          marketOverview: {
            ...props.marketOverview!,
            history: {
              status: "available",
              value: {
                ...getPersonalMarketHistory(props.marketOverview)!,
                startDate: "2030-01-14",
                endDate: "2030-01-14",
                bars: [
                  {
                    ...getPersonalMarketHistory(props.marketOverview)!.bars[0]!,
                    date: "2030-01-14",
                  },
                ],
              },
            },
          },
        };
      if (reason === "unknown cash flow")
        props = {
          ...props,
          annualFinancials: {
            ...props.annualFinancials!,
            years: [
              {
                ...props.annualFinancials!.years[0]!,
                reported: {
                  ...props.annualFinancials!.years[0]!.reported,
                  free_cash_flow: unknownAnnualCell(),
                },
              },
            ],
          },
        };
      if (reason === "long identity")
        props = {
          ...props,
          selection: { ...props.selection!, issuerName: "X".repeat(257) },
        };
      const comparison = outcomeProps(props);
      for (const side of [comparison.current, comparison.saved]) {
        expect(side.status).toBe("unavailable");
        if (side.status !== "unavailable")
          throw new Error("Expected unavailable source outcome");
        expect(side.reason.length).toBeGreaterThan(0);
      }
      expect(comparison.current).not.toHaveProperty("result");
      expect(comparison.saved).not.toHaveProperty("result");
    },
  );

  it.each(["current", "saved"] as const)(
    "allows only the %s side to be unavailable when tax makes its starting proxy nonpositive",
    (unavailableSide) => {
      const annual = annualFinancials();
      const props = comparedProps(
        canonicalAssumptions({
          taxShieldRatePercent:
            unavailableSide === "saved" ? "50.0000" : "0.0000",
        }),
        {
          annualFinancials: {
            ...annual,
            years: [
              {
                ...annual.years[0]!,
                reported: {
                  ...annual.years[0]!.reported,
                  free_cash_flow: knownAnnualCell("-90"),
                },
              },
            ],
          },
          assumptionControl: {
            value: createPersonalFcffDcfAssumptionDraft({
              ...PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
              taxShieldRatePercent: unavailableSide === "current" ? "50" : "0",
            }),
            onChange: vi.fn(),
          },
        },
      );
      const comparison = outcomeProps(props);
      expect(comparison[unavailableSide].status).toBe("unavailable");
      expect(
        comparison[unavailableSide === "current" ? "saved" : "current"].status,
      ).toBe("available");
    },
  );

  it("preserves unavailable residual-equity scenarios without discarding available scenarios", () => {
    const valuation = valuationHistory();
    const point = {
      ...valuation.history.points[0]!,
      enterpriseValue: knownMoney("24000"),
    };
    const comparison = outcomeProps(
      comparedProps(canonicalAssumptions(), {
        valuationHistory: {
          ...valuation,
          history: {
            ...valuation.history,
            latestPoint: point,
            points: [point],
          },
        },
      }),
    );
    for (const side of [comparison.current, comparison.saved]) {
      if (side.status !== "available")
        throw new Error("Expected globally available result");
      expect(side.result.scenarios.conservative.status).toBe("unavailable");
      expect(side.result.scenarios.expansion.status).toBe("available");
      const input = independentInput(side.result.assumptions);
      expect(side.result).toEqual(
        analytics.calculatePersonalFcffDcfValuation({
          ...input,
          valuation: {
            ...input.valuation!,
            points: [
              {
                ...input.valuation!.points[0]!,
                enterpriseValue: knownMoney("24000"),
              },
            ],
          },
        }),
      );
    }
  });

  it("memoizes only the saved evaluation across ordinary draft/status renders and invalidates on source, selection and eligibility replacement", () => {
    const calculate = vi.spyOn(analytics, "calculatePersonalFcffDcfValuation");
    const saved = canonicalAssumptions();
    let props = comparedProps(saved);
    const savedCalls = () =>
      calculate.mock.calls.filter(([input]) => input.assumptions === saved)
        .length;
    const first = outcomeProps(props);
    expect(savedCalls()).toBe(1);
    const currentDraft = {
      ...createPersonalFcffDcfAssumptionDraft(),
      waccPercent: "13",
    };
    props = {
      ...props,
      selection: { ...props.selection! },
      assumptionControl: { value: currentDraft, onChange: vi.fn() },
      savedAssumptionsComparison: {
        assumptions: saved,
        currentDraftValid: true,
      },
      savedAssumptionsControls: <p>Saving assumptions</p>,
    };
    const edited = outcomeProps(props);
    expect(savedCalls()).toBe(1);
    expect(edited.saved).toEqual(first.saved);
    expect(edited.current).not.toEqual(first.current);
    props = {
      ...props,
      savedAssumptionsComparison: {
        assumptions: saved,
        currentDraftValid: false,
      },
    };
    expect(outcomeProps(props).current.status).toBe("unavailable");
    expect(savedCalls()).toBe(1);
    const market = props.marketOverview!;
    props = {
      ...props,
      marketOverview: {
        ...market,
        history: {
          status: "available",
          value: {
            ...getPersonalMarketHistory(market)!,
            bars: [
              {
                ...getPersonalMarketHistory(market)!.bars[0]!,
                raw: ohlcv("50"),
              },
            ],
          },
        },
      },
    };
    const replacement = outcomeProps(props);
    expect(savedCalls()).toBe(2);
    expect(replacement.saved).not.toEqual(first.saved);
    props = {
      ...props,
      annualFinancials: structuredClone(props.annualFinancials),
      valuationHistory: structuredClone(props.valuationHistory),
    };
    outcomeProps(props);
    expect(savedCalls()).toBe(3);
    props = {
      ...props,
      selection: { ...props.selection!, issuerName: "New exact selection" },
    };
    expect(outcomeProps(props).saved.status).toBe("unavailable");
    expect(savedCalls()).toBe(4);
    props = { ...props, savedAssumptionsComparison: undefined };
    expect(findOutcome(renderTree(props))).toBeUndefined();
    props = {
      ...props,
      savedAssumptionsComparison: {
        assumptions: saved,
        currentDraftValid: true,
      },
    };
    outcomeProps(props);
    expect(savedCalls()).toBe(5);
    const replacedSaved = structuredClone(saved);
    outcomeProps({
      ...props,
      savedAssumptionsComparison: {
        assumptions: replacedSaved,
        currentDraftValid: true,
      },
    });
    expect(
      calculate.mock.calls.filter(
        ([input]) => input.assumptions === replacedSaved,
      ),
    ).toHaveLength(1);
  });

  it("never adds a saved calculation or comparison when the optional input is absent", () => {
    const calculate = vi.spyOn(analytics, "calculatePersonalFcffDcfValuation");
    expect(findOutcome(renderTree(defaultProps()))).toBeUndefined();
    expect(calculate).toHaveBeenCalledTimes(1);
  });
});

function canonicalAssumptions(
  patch: Partial<PersonalFcffDcfAssumptions> = {},
): PersonalFcffDcfAssumptions {
  return {
    forecastYears: 5,
    taxShieldRatePercent: "21.0000",
    waccPercent: "10.0000",
    terminalGrowthPercent: "2.0000",
    scenarios: scenarioInputs("0.0000", "5.0000", "10.0000"),
    ...patch,
  };
}
function scenarioInputs(conservative: string, base: string, expansion: string) {
  return {
    conservative: { annualFcfProxyGrowthPercent: conservative },
    base: { annualFcfProxyGrowthPercent: base },
    expansion: { annualFcfProxyGrowthPercent: expansion },
  };
}
function comparedProps(
  assumptions: PersonalFcffDcfAssumptions,
  overrides: Partial<PersonalFcffDcfValuationProps> = {},
): PersonalFcffDcfValuationProps {
  return defaultProps({
    savedAssumptionsComparison: { assumptions, currentDraftValid: true },
    ...overrides,
  });
}
function findOutcome(
  node: React.ReactNode,
): PersonalDcfOutcomeComparisonProps | undefined {
  if (Array.isArray(node))
    return (node as readonly React.ReactNode[])
      .map((child) => findOutcome(child))
      .find((value) => value !== undefined);
  if (!React.isValidElement<{ children?: React.ReactNode }>(node))
    return undefined;
  if (node.type === PersonalDcfOutcomeComparison)
    return node.props as PersonalDcfOutcomeComparisonProps;
  return findOutcome(node.props.children);
}
function outcomeProps(props: PersonalFcffDcfValuationProps) {
  const comparison = findOutcome(renderTree(props));
  if (comparison === undefined)
    throw new Error("Expected eligible saved outcome comparison");
  return comparison;
}
// Independent fixed fixture values, not the child mapping functions or captured calls.
function independentInput(
  assumptions: PersonalFcffDcfAssumptions,
): PersonalFcffDcfInput {
  const security = identity();
  return {
    assumptions,
    selection: security,
    market: {
      security,
      range: "1y",
      priceCurrency: "USD",
      bars: [{ date: "2030-01-15", raw: { close: "100" } }],
    },
    valuation: {
      security,
      range: "1y",
      asOf: "2030-01-15T22:00:00.000Z",
      points: [
        {
          date: "2030-01-15",
          enterpriseValue: knownMoney("15000"),
          marketCapitalization: knownMoney("10000"),
        },
      ],
    },
    annuals: {
      security,
      asOf: "2030-01-15T21:00:00.000Z",
      valueCurrency: "USD",
      years: [
        {
          fiscalYear: 2029,
          statementDate: "2029-12-31",
          reported: {
            free_cash_flow: knownAnnualCell("1000"),
            interest_expense: knownAnnualCell("-100"),
          },
        },
      ],
    },
  };
}

function render(props: PersonalFcffDcfValuationProps): string {
  stateHarness.beginRender();
  return renderToStaticMarkup(<PersonalFcffDcfValuation {...props} />);
}

function renderTree(props: PersonalFcffDcfValuationProps) {
  stateHarness.beginRender();
  return PersonalFcffDcfValuation(props);
}

function changeControl(
  props: PersonalFcffDcfValuationProps,
  id: string,
  value: string,
): void {
  const input = findHostElement(
    renderTree(props),
    (element) => element.type === "input" && element.props.id === id,
  );
  const onChange = input?.props.onChange;
  if (typeof onChange !== "function") throw new TypeError();
  (onChange as (event: { target: { value: string } }) => void)({
    target: { value },
  });
}

function clickControl(
  props: PersonalFcffDcfValuationProps,
  label: string,
): void {
  const button = findHostElement(
    renderTree(props),
    (element) => element.type === "button" && element.props.children === label,
  );
  const onClick = button?.props.onClick;
  if (typeof onClick !== "function") throw new TypeError();
  (onClick as () => void)();
}

function findHostElement(
  node: React.ReactNode,
  matches: (element: React.ReactElement<Record<string, unknown>>) => boolean,
): React.ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const child of node as readonly React.ReactNode[]) {
      const match = findHostElement(child, matches);
      if (match !== null) return match;
    }
    return null;
  }
  if (!React.isValidElement(node)) return null;
  const element = node as React.ReactElement<Record<string, unknown>>;
  if (typeof element.type === "function") {
    return findHostElement(
      (element.type as (props: Record<string, unknown>) => React.ReactNode)(
        element.props,
      ),
      matches,
    );
  }
  if (matches(element)) return element;
  return findHostElement(element.props.children as React.ReactNode, matches);
}

function draftAssumptions(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    ...structuredClone(PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS),
    forecastYears: String(PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS.forecastYears),
    ...overrides,
  };
}

function defaultProps(
  overrides: Partial<PersonalFcffDcfValuationProps> = {},
): PersonalFcffDcfValuationProps {
  return {
    annualFinancials: annualFinancials(),
    marketOverview: marketOverview(),
    selection: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "ZERO Common Stock",
      symbol: "ZERO",
    },
    valuationHistory: valuationHistory(),
    ...overrides,
  };
}

function identity(
  overrides: Partial<PersonalMarketDataIdentityDto> = {},
): PersonalMarketDataIdentityDto {
  return {
    country: "US",
    exchangeMic: "XNAS",
    issuerName: "Zero Alpha, Inc.",
    listingId: "lst-zero",
    securityName: "ZERO Common Stock",
    symbol: "ZERO",
    ...overrides,
  };
}

function marketOverview(
  security: PersonalMarketDataIdentityDto = identity(),
): PersonalMarketOverviewDto {
  return {
    history: {
      status: "available",
      value: {
        currency: "USD",
        bars: [
          {
            adjusted: ohlcv("999"),
            date: "2030-01-15",
            dividendCash: "0",
            raw: ohlcv("100"),
            splitFactor: "1",
          },
        ],
        endDate: "2030-01-15",
        range: "1y",
        startDate: "2030-01-15",
      },
    },
    profile: "personal_single_user_local_market_data",
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
    quote: {
      status: "available",
      value: {
        change: "0",
        changePercent: "0",
        currency: "USD",
        freshness: "current",
        ingestedAt: "2030-01-15T22:01:00.000Z",
        kind: "derived_realtime_reference",
        previousClose: "100",
        price: "100",
        sourceTime: "2030-01-15T22:00:00.000Z",
      },
    },
    schemaVersion: "2.0.0",
    security,
    ingestedAt: "2030-01-15T22:01:00.000Z",
    window: { range: "1y", startDate: "2030-01-15", endDate: "2030-01-15" },
  };
}

function valuationHistory(
  security: PersonalMarketDataIdentityDto = identity(),
): PersonalValuationHistoryDto {
  const point = {
    date: "2030-01-15",
    enterpriseValue: knownMoney("15000"),
    marketCapitalization: knownMoney("10000"),
    priceToBook: knownRatio("2"),
    priceToEarnings: knownRatio("20"),
    trailingPeg1Y: knownRatio("1.5"),
  } as const;
  return {
    asOf: "2030-01-15T22:00:00.000Z",
    coverage: {
      knownCells: 5,
      observationCount: 1,
      status: "complete",
      unknownCells: 0,
    },
    history: {
      endDate: point.date,
      latestPoint: point,
      points: [point],
      range: "1y",
      startDate: point.date,
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
    security,
    status: "available",
  };
}

function annualFinancials(
  security: PersonalMarketDataIdentityDto = identity(),
): PersonalAnnualFinancialsDto {
  const reported = Object.fromEntries(
    annualFieldKeys.map((key) => [key, knownAnnualCell("1")]),
  ) as PersonalAnnualFinancialsDto["years"][number]["reported"];
  const exactReported = {
    ...reported,
    free_cash_flow: knownAnnualCell("1000"),
    interest_expense: knownAnnualCell("-100"),
  };
  return {
    asOf: "2030-01-15T21:00:00.000Z",
    coverage: {
      earliestFiscalYear: 2029,
      knownReportedCells: 30,
      latestFiscalYear: 2029,
      missingFiscalYears: [
        2028, 2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020,
      ],
      requestedAnnualYears: 10,
      returnedAnnualYears: 1,
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
    security,
    status: "available",
    years: [
      {
        fiscalYear: 2029,
        reported: exactReported,
        statementDate: "2029-12-31",
      },
    ],
  };
}

function ohlcv(close: string) {
  return { close, high: close, low: close, open: close, volume: "1000" };
}

function knownMoney(value: string) {
  return { status: "known", unit: "USD", value } as const;
}

function knownRatio(value: string) {
  return { status: "known", unit: "ratio", value } as const;
}

function knownAnnualCell(value: string) {
  return { status: "known", value } as const;
}

function unknownAnnualCell() {
  return {
    reason: "not_supplied_by_provider",
    status: "unknown",
    value: null,
  } as const;
}

const annualFieldKeys = [
  "accounts_receivable",
  "assets",
  "capital_expenditures",
  "cash",
  "cost_of_revenue",
  "current_assets",
  "current_liabilities",
  "debt",
  "depreciation_and_amortization",
  "ebitda",
  "financing_cash_flow",
  "free_cash_flow",
  "gross_profit",
  "income_tax_expense",
  "intangibles",
  "inventory",
  "investing_cash_flow",
  "liabilities",
  "net_income",
  "operating_cash_flow",
  "operating_expenses",
  "operating_income",
  "pretax_income",
  "property_plant_equipment_net",
  "research_and_development",
  "revenue",
  "selling_general_and_administrative",
  "share_based_compensation",
  "shareholders_equity",
  "interest_expense",
] as const satisfies readonly PersonalAnnualFinancialReportedFieldKeyDto[];
