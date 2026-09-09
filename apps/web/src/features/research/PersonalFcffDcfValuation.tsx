"use client";

import type {
  PersonalAnnualFinancialsDto,
  PersonalMarketDataIdentityDto,
  PersonalMarketOverviewDto,
  PersonalValuationHistoryDto,
} from "@research-cockpit/contracts";
import {
  calculatePersonalFcffDcfValuation,
  PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
  PERSONAL_FCFF_DCF_MAXIMUM_DECIMAL_LENGTH,
  PERSONAL_FCFF_DCF_ROUNDING,
  type PersonalFcffDcfAssumptions,
} from "@research-cockpit/personal-market-analytics";
import { type ReactNode, useState } from "react";

import type { PersonalMarketSelection } from "./PersonalMarketOverview";

export interface PersonalFcffDcfValuationProps {
  readonly annualFinancials: PersonalAnnualFinancialsDto | null;
  readonly marketOverview: PersonalMarketOverviewDto | null;
  readonly selection: PersonalMarketSelection | null;
  readonly valuationHistory: PersonalValuationHistoryDto | null;
}

type ModelResult = ReturnType<typeof calculatePersonalFcffDcfValuation>;
type AvailableResult = Extract<ModelResult, { status: "available" }>;
type UnavailableResult = Extract<ModelResult, { status: "unavailable" }>;
type ScenarioName = keyof AvailableResult["scenarios"];
type ScenarioResult = AvailableResult["scenarios"][ScenarioName];
type SensitivityCell = AvailableResult["sensitivity"]["cells"][number];
type AssumptionDraft = Omit<PersonalFcffDcfAssumptions, "forecastYears"> & {
  readonly forecastYears: string;
};

const scenarioOrder = ["conservative", "base", "expansion"] as const;

const scenarioLabels = {
  conservative: "Conservative",
  base: "Base",
  expansion: "Expansion",
} as const satisfies Readonly<Record<ScenarioName, string>>;

export function PersonalFcffDcfValuation({
  annualFinancials,
  marketOverview,
  selection,
  valuationHistory,
}: PersonalFcffDcfValuationProps) {
  const [assumptionDraft, setAssumptionDraft] = useState<AssumptionDraft>(() =>
    createAssumptionDraft(PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS),
  );
  const draftIssue = assumptionDraftIssue(assumptionDraft);
  const assumptions =
    draftIssue === null ? materializeAssumptions(assumptionDraft) : null;
  const result =
    selection === null || assumptions === null
      ? null
      : calculatePersonalFcffDcfValuation({
          annuals: mapAnnualFinancials(annualFinancials),
          assumptions,
          market: mapMarketOverview(marketOverview),
          selection: mapSelection(selection),
          valuation: mapValuationHistory(valuationHistory),
        });

  function updateCommon(
    key:
      | "forecastYears"
      | "taxShieldRatePercent"
      | "terminalGrowthPercent"
      | "waccPercent",
    value: string,
  ) {
    setAssumptionDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateScenarioGrowth(scenario: ScenarioName, value: string) {
    setAssumptionDraft((current) => ({
      ...current,
      scenarios: {
        ...current.scenarios,
        [scenario]: {
          ...current.scenarios[scenario],
          annualFcfProxyGrowthPercent: value,
        },
      },
    }));
  }

  return (
    <section
      aria-describedby="personal-fcff-dcf-summary personal-fcff-dcf-caveat"
      aria-labelledby="personal-fcff-dcf-title"
      className="personal-fcff-dcf"
    >
      <div className="fcff-dcf-heading">
        <div>
          <p className="eyebrow">Browser-local cash-flow valuation</p>
          <h2 id="personal-fcff-dcf-title">
            Unlevered FCF-proxy DCF and reverse DCF
          </h2>
        </div>
        <span>3 scenarios · 25 sensitivity cases</span>
      </div>

      <p
        className="fcff-dcf-intro"
        id="personal-fcff-dcf-summary"
        aria-live="polite"
      >
        {summaryCopy(selection, result, draftIssue)}
      </p>

      {selection === null ? (
        <ReadinessState
          detail="Use “View market” in search results or My Watchlist. The model will not load or infer a company automatically."
          title="Choose a security to build cash-flow scenarios."
        />
      ) : (
        <>
          <SourceReadiness
            annualFinancials={annualFinancials}
            marketOverview={marketOverview}
            selection={selection}
            valuationHistory={valuationHistory}
          />
          <AssumptionEditor
            assumptions={assumptionDraft}
            onCommonChange={updateCommon}
            onReset={() =>
              setAssumptionDraft(
                createAssumptionDraft(PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS),
              )
            }
            onScenarioGrowthChange={updateScenarioGrowth}
          />
          {draftIssue !== null ? (
            <ReadinessState
              detail={draftIssue}
              title="Finish entering valid assumptions."
            />
          ) : result?.status === "available" ? (
            <AvailableValuation result={result} symbol={selection.symbol} />
          ) : result === null ? null : (
            <UnavailableValuation result={result} symbol={selection.symbol} />
          )}
        </>
      )}

      <p className="fcff-dcf-caveat" id="personal-fcff-dcf-caveat" role="note">
        The starting unlevered FCF proxy is mechanical: provider-reported free
        cash flow plus after-tax absolute interest expense. It is not audited
        FCFF. This constant-growth, constant-WACC, Gordon-growth screen omits
        explicit revenue, margins, reinvestment, working capital, stub periods,
        dilution, and changing capital structure. It is not appropriate for
        banks or insurers and can be weak for REITs, finite-life assets,
        distressed companies, or structurally negative-FCF issuers. It is not
        intrinsic certainty, a price target, or a buy/sell recommendation.
        Inputs use provider-most-recent history, not point-in-time or
        as-reported history. This view makes no fetch, persists nothing, and
        provides no export.
      </p>
    </section>
  );
}

function SourceReadiness({
  annualFinancials,
  marketOverview,
  selection,
  valuationHistory,
}: PersonalFcffDcfValuationProps & {
  readonly selection: PersonalMarketSelection;
}) {
  return (
    <dl aria-label="DCF source readiness" className="fcff-dcf-readiness">
      <ReadinessItem
        href="#personal-market-overview"
        label="Price history"
        state={sourceState(marketOverview?.security ?? null, selection)}
      />
      <ReadinessItem
        href="#personal-valuation-history-title"
        label="Daily valuation"
        state={sourceState(valuationHistory?.security ?? null, selection)}
      />
      <ReadinessItem
        href="#personal-annual-financials-title"
        label="Annual statements"
        state={sourceState(annualFinancials?.security ?? null, selection)}
      />
    </dl>
  );
}

function ReadinessItem({
  href,
  label,
  state,
}: {
  readonly href: string;
  readonly label: string;
  readonly state: "loaded" | "missing" | "wrong_listing";
}) {
  return (
    <div data-state={state}>
      <dt>{label}</dt>
      <dd>
        {state === "loaded"
          ? "Loaded"
          : state === "missing"
            ? "Not loaded"
            : "Different listing"}
        {state === "loaded" ? null : (
          <>
            {" · "}
            <a href={href}>Review source panel</a>
          </>
        )}
      </dd>
    </div>
  );
}

function AssumptionEditor({
  assumptions,
  onCommonChange,
  onReset,
  onScenarioGrowthChange,
}: {
  readonly assumptions: AssumptionDraft;
  readonly onCommonChange: (
    key:
      | "forecastYears"
      | "taxShieldRatePercent"
      | "terminalGrowthPercent"
      | "waccPercent",
    value: string,
  ) => void;
  readonly onReset: () => void;
  readonly onScenarioGrowthChange: (
    scenario: ScenarioName,
    value: string,
  ) => void;
}) {
  return (
    <div className="fcff-dcf-assumption-panel">
      <div className="fcff-dcf-subheading">
        <div>
          <h3>Illustrative assumptions</h3>
          <p>One common discount framework; one growth rate per scenario.</p>
        </div>
        <button
          className="secondary-action compact-action"
          onClick={onReset}
          type="button"
        >
          Reset illustrative assumptions
        </button>
      </div>
      <div className="fcff-dcf-common-inputs">
        <NumberField
          id="fcff-dcf-horizon"
          integerOnly
          label="Forecast horizon"
          max="10"
          min="5"
          onChange={(value) => onCommonChange("forecastYears", value)}
          suffix="years"
          value={assumptions.forecastYears}
        />
        <NumberField
          id="fcff-dcf-tax-rate"
          label="Marginal tax-shield rate assumption"
          max="50"
          min="0"
          onChange={(value) => onCommonChange("taxShieldRatePercent", value)}
          suffix="%"
          value={assumptions.taxShieldRatePercent}
        />
        <NumberField
          id="fcff-dcf-wacc"
          label="WACC assumption"
          max="30"
          min="1"
          onChange={(value) => onCommonChange("waccPercent", value)}
          suffix="%"
          value={assumptions.waccPercent}
        />
        <NumberField
          id="fcff-dcf-terminal-growth"
          label="Terminal growth"
          max="5"
          min="-2"
          onChange={(value) => onCommonChange("terminalGrowthPercent", value)}
          suffix="%"
          value={assumptions.terminalGrowthPercent}
        />
      </div>
      <fieldset className="fcff-dcf-growth-inputs">
        <legend>Annual FCF-proxy growth by scenario</legend>
        {scenarioOrder.map((scenario) => (
          <NumberField
            id={`fcff-dcf-${scenario}-growth`}
            key={scenario}
            label={scenarioLabels[scenario]}
            max="50"
            min="-50"
            onChange={(value) => onScenarioGrowthChange(scenario, value)}
            suffix="%"
            value={assumptions.scenarios[scenario].annualFcfProxyGrowthPercent}
          />
        ))}
      </fieldset>
      <p
        className="fcff-dcf-field-note"
        id="personal-fcff-dcf-assumption-guidance"
      >
        These defaults are generic examples, not company-specific forecasts.
        WACC must remain strictly above terminal growth.
      </p>
    </div>
  );
}

function NumberField({
  id,
  integerOnly = false,
  label,
  max,
  min,
  onChange,
  suffix,
  value,
}: {
  readonly id: string;
  readonly integerOnly?: boolean;
  readonly label: string;
  readonly max: string;
  readonly min: string;
  readonly onChange: (value: string) => void;
  readonly suffix: string;
  readonly value: string;
}) {
  return (
    <div className="fcff-dcf-number-field">
      <label htmlFor={id}>{label}</label>
      <div>
        <input
          aria-describedby={`${id}-range personal-fcff-dcf-assumption-guidance`}
          autoComplete="off"
          id={id}
          inputMode={integerOnly ? "numeric" : "decimal"}
          maxLength={integerOnly ? 2 : PERSONAL_FCFF_DCF_MAXIMUM_DECIMAL_LENGTH}
          onChange={(event) => onChange(event.target.value)}
          pattern={integerOnly ? "[0-9]*" : "-?[0-9]*(?:[.][0-9]*)?"}
          spellCheck={false}
          type="text"
          value={value}
        />
        <em>{suffix}</em>
      </div>
      <small id={`${id}-range`}>
        Allowed: {min} to {max} {suffix};{" "}
        {integerOnly
          ? "whole numbers only."
          : `up to ${PERSONAL_FCFF_DCF_ROUNDING.rateDecimalPlaces} decimal places.`}
      </small>
    </div>
  );
}

function AvailableValuation({
  result,
  symbol,
}: {
  readonly result: AvailableResult;
  readonly symbol: string;
}) {
  return (
    <div className="fcff-dcf-result">
      <ReferenceStrip result={result} symbol={symbol} />
      <ComputedAssumptions result={result} />
      <RateGapWarning result={result} />
      <div
        aria-label={`${symbol} unlevered FCF-proxy DCF scenarios`}
        className="fcff-dcf-scenario-grid"
      >
        {scenarioOrder.map((scenario) => (
          <ScenarioCard
            key={scenario}
            result={result.scenarios[scenario]}
            scenario={scenario}
          />
        ))}
      </div>
      <ReverseDcf result={result} symbol={symbol} />
      <SensitivityTable result={result} symbol={symbol} />
      <InputProvenance result={result} />
      <MethodologyDetails result={result} />
    </div>
  );
}

function ComputedAssumptions({ result }: { readonly result: AvailableResult }) {
  const { assumptions } = result;
  return (
    <dl
      aria-label="Computed DCF assumptions"
      className="fcff-dcf-computed-assumptions"
    >
      <div>
        <dt>Forecast horizon</dt>
        <dd>{String(assumptions.forecastYears)} years</dd>
      </div>
      <div>
        <dt>Tax-shield rate</dt>
        <dd>{formatPercent(assumptions.taxShieldRatePercent)}</dd>
      </div>
      <div>
        <dt>WACC assumption</dt>
        <dd>{formatPercent(assumptions.waccPercent)}</dd>
      </div>
      <div>
        <dt>Terminal growth</dt>
        <dd>{formatPercent(assumptions.terminalGrowthPercent)}</dd>
      </div>
    </dl>
  );
}

function RateGapWarning({ result }: { readonly result: AvailableResult }) {
  const gap =
    rateTenThousandths(result.assumptions.waccPercent) -
    rateTenThousandths(result.assumptions.terminalGrowthPercent);
  return gap < 10_000 ? (
    <p className="fcff-dcf-rate-gap-warning" role="note">
      WACC is less than 1.00 percentage point above terminal growth. The
      Gordon-growth terminal value is valid but highly sensitive to small rate
      changes.
    </p>
  ) : null;
}

function ReferenceStrip({
  result,
  symbol,
}: {
  readonly result: AvailableResult;
  readonly symbol: string;
}) {
  const { reference } = result;
  return (
    <dl
      aria-label={`${symbol} DCF reference inputs`}
      className="fcff-dcf-reference-grid"
    >
      <div>
        <dt>Market reference</dt>
        <dd>{formatUsd(reference.rawCloseUsd)}</dd>
        <small>{formatDate(reference.date)} · raw close</small>
      </div>
      <div>
        <dt>Starting unlevered FCF proxy</dt>
        <dd>{formatUsd(reference.startingUnleveredFcfProxyUsd)}</dd>
        <small>Mechanical · FY {String(reference.annualFiscalYear)}</small>
      </div>
      <div>
        <dt>Provider enterprise value</dt>
        <dd>{formatUsd(reference.enterpriseValueUsd)}</dd>
        <small>{formatDate(reference.date)}</small>
      </div>
      <div>
        <dt>Quote-consistent share-count proxy</dt>
        <dd>{formatDecimal(reference.impliedShareCount)}</dd>
        <small>Market cap ÷ same-date raw close</small>
      </div>
    </dl>
  );
}

function ScenarioCard({
  result,
  scenario,
}: {
  readonly result: ScenarioResult;
  readonly scenario: ScenarioName;
}) {
  return (
    <article
      className={`fcff-dcf-scenario-card${scenario === "base" ? " fcff-dcf-scenario-card-base" : ""}`}
    >
      <span>{scenarioLabels[scenario]} scenario</span>
      {result.status === "available" ? (
        <>
          <strong title={`${result.impliedPriceUsd} USD`}>
            {formatUsd(result.impliedPriceUsd)}
          </strong>
          <small>
            {formatSignedPercent(result.differencePercent)} vs reference raw
            close
          </small>
        </>
      ) : (
        <>
          <strong>Unavailable</strong>
          <small>No positive residual equity value.</small>
        </>
      )}
      <dl>
        <div>
          <dt>Annual proxy growth</dt>
          <dd>{formatPercent(result.annualFcfProxyGrowthPercent)}</dd>
        </div>
        <div>
          <dt>Enterprise value</dt>
          <dd>{formatUsd(result.enterpriseValueUsd)}</dd>
        </div>
        <div>
          <dt>Equity value</dt>
          <dd>{formatUsd(result.equityValueUsd)}</dd>
        </div>
        <div>
          <dt>Terminal-value share</dt>
          <dd>{formatPercent(result.terminalValuePercentOfEnterpriseValue)}</dd>
        </div>
      </dl>
      {Number(result.terminalValuePercentOfEnterpriseValue) > 80 ? (
        <p className="fcff-dcf-terminal-warning" role="note">
          More than 80% of enterprise value comes from the terminal value.
        </p>
      ) : null}
      <details>
        <summary>Projection and present-value bridge</summary>
        <ol>
          {result.projection.map((year) => (
            <li key={year.year}>
              <span>Year {String(year.year)}</span>
              <span>FCF proxy {formatUsd(year.fcfProxyUsd)}</span>
              <span>PV {formatUsd(year.presentValueUsd)}</span>
            </li>
          ))}
        </ol>
        <p>
          Explicit-period proxy PV{" "}
          {formatUsd(result.presentValueOfExplicitFcfProxyUsd)} · terminal value{" "}
          {formatUsd(result.terminalValueUsd)} · terminal-value PV{" "}
          {formatUsd(result.presentValueOfTerminalValueUsd)}
        </p>
      </details>
    </article>
  );
}

function ReverseDcf({
  result,
  symbol,
}: {
  readonly result: AvailableResult;
  readonly symbol: string;
}) {
  const reverse = result.reverseDcf;
  return (
    <section
      aria-labelledby="personal-reverse-dcf-title"
      className="fcff-dcf-reverse"
    >
      <div>
        <p className="eyebrow">What the market price implies</p>
        <h3 id="personal-reverse-dcf-title">Reverse DCF</h3>
        <p>
          Solves one market-implied constant annual FCF-proxy growth rate
          against {symbol}&apos;s same-date provider enterprise value while
          holding the common horizon, WACC, and terminal growth fixed. It is not
          a forecast.
        </p>
      </div>
      {reverse.status === "available" ? (
        <div className="fcff-dcf-reverse-result" aria-live="polite">
          <span>Market-implied constant annual FCF-proxy growth (rounded)</span>
          <strong>
            {formatPercent(reverse.impliedAnnualFcfProxyGrowthPercent)}
          </strong>
          <small>
            Target EV {formatUsd(reverse.targetEnterpriseValueUsd)} · solved EV{" "}
            {formatUsd(reverse.solvedEnterpriseValueUsd)} · bounded search{" "}
            {formatPercent(reverse.searchLowerBoundPercent)} to{" "}
            {formatPercent(reverse.searchUpperBoundPercent)}
          </small>
          <details>
            <summary>Cent-tie-out solver rate (audit)</summary>
            <code>{reverse.resolvedAnnualFcfProxyGrowthPercent}</code>%
          </details>
        </div>
      ) : (
        <div
          className="fcff-dcf-reverse-result fcff-dcf-reverse-unavailable"
          aria-live="polite"
        >
          <span>Market-implied constant annual FCF-proxy growth</span>
          <strong>
            {reverse.reason === "target_money_precision_not_resolved"
              ? "Exact result unavailable"
              : "Outside modeled range"}
          </strong>
          <small>
            {reverseUnavailableCopy(
              reverse.reason,
              reverse.searchLowerBoundPercent,
              reverse.searchUpperBoundPercent,
            )}
          </small>
        </div>
      )}
    </section>
  );
}

function SensitivityTable({
  result,
  symbol,
}: {
  readonly result: AvailableResult;
  readonly symbol: string;
}) {
  const rows = unique(result.sensitivity.cells.map((cell) => cell.waccPercent));
  const columns = unique(
    result.sensitivity.cells.map((cell) => cell.terminalGrowthPercent),
  );
  const byCoordinate = new Map(
    result.sensitivity.cells.map((cell) => [
      `${cell.waccPercent}:${cell.terminalGrowthPercent}`,
      cell,
    ]),
  );
  const selectedRow =
    rows[result.sensitivity.waccDeltasPercentagePoints.indexOf("0")];
  const selectedColumn =
    columns[
      result.sensitivity.terminalGrowthDeltasPercentagePoints.indexOf("0")
    ];

  return (
    <section
      aria-labelledby="personal-fcff-sensitivity-title"
      className="fcff-dcf-sensitivity"
    >
      <div className="fcff-dcf-subheading">
        <div>
          <p className="eyebrow">Base-scenario uncertainty</p>
          <h3 id="personal-fcff-sensitivity-title">
            WACC × terminal-growth sensitivity
          </h3>
        </div>
        <span>Implied value per share</span>
      </div>
      <div
        aria-label={`${symbol} base DCF sensitivity table`}
        className="fcff-dcf-table-scroll"
        role="region"
        tabIndex={0}
      >
        <table>
          <caption>
            Base-scenario implied price per share; WACC by terminal growth
          </caption>
          <thead>
            <tr>
              <th scope="col">WACC ↓ / terminal growth →</th>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {formatPercent(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <th scope="row">{formatPercent(row)}</th>
                {columns.map((column) => {
                  const cell = byCoordinate.get(`${row}:${column}`);
                  return (
                    <SensitivityValue
                      cell={cell}
                      key={column}
                      selected={
                        row === selectedRow && column === selectedColumn
                      }
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Cells show N/A when WACC is less than or equal to terminal growth, when
        either sensitivity rate leaves the global model bounds, or when modeled
        residual equity is not positive; no number is substituted.
      </p>
    </section>
  );
}

function SensitivityValue({
  cell,
  selected,
}: {
  readonly cell: SensitivityCell | undefined;
  readonly selected: boolean;
}) {
  if (cell === undefined || cell.status === "unavailable") {
    const explanation = sensitivityUnavailableCopy(cell?.reason);
    const label = `${selected ? "Selected assumptions. " : ""}Unavailable sensitivity: ${explanation}`;
    return (
      <td
        aria-label={label}
        className={`${selected ? "fcff-dcf-cell-selected " : ""}fcff-dcf-cell-unavailable`}
        title={label}
      >
        N/A
      </td>
    );
  }
  return (
    <td
      aria-label={
        selected
          ? `Selected assumptions: ${formatUsd(cell.impliedPriceUsd)}`
          : undefined
      }
      className={selected ? "fcff-dcf-cell-selected" : undefined}
      title={`${cell.impliedPriceUsd} USD`}
    >
      {formatUsd(cell.impliedPriceUsd)}
    </td>
  );
}

function sensitivityUnavailableCopy(
  reason:
    Extract<SensitivityCell, { status: "unavailable" }>["reason"] | undefined,
): string {
  switch (reason) {
    case "discount_rate_not_above_terminal_growth":
      return "WACC must be greater than terminal growth.";
    case "nonpositive_equity_value":
      return "modeled residual equity value is not positive.";
    case "sensitivity_rate_out_of_bounds":
      return "WACC or terminal growth is outside the global model bounds.";
    default:
      return "the sensitivity cell is missing.";
  }
}

function InputProvenance({ result }: { readonly result: AvailableResult }) {
  const { reference } = result;
  return (
    <dl aria-label="DCF input provenance" className="fcff-dcf-provenance">
      <div>
        <dt>Annual source</dt>
        <dd>
          FY {String(reference.annualFiscalYear)} · provider statement date{" "}
          {formatDate(reference.annualStatementDate)} · response as of{" "}
          <time dateTime={reference.annualsAsOf}>
            {formatInstant(reference.annualsAsOf)}
          </time>
        </dd>
      </div>
      <div>
        <dt>Market source</dt>
        <dd>
          Raw close, market capitalization, and enterprise value joined on{" "}
          {formatDate(reference.date)} · valuation response as of{" "}
          <time dateTime={reference.valuationAsOf}>
            {formatInstant(reference.valuationAsOf)}
          </time>
        </dd>
      </div>
      <div>
        <dt>Exact source operands</dt>
        <dd>
          Raw close <code>{reference.sourceOperands.rawCloseUsd}</code> USD ·
          market capitalization{" "}
          <code>{reference.sourceOperands.marketCapitalizationUsd}</code> USD ·
          enterprise value{" "}
          <code>{reference.sourceOperands.enterpriseValueUsd}</code> USD ·
          reported FCF{" "}
          <code>{reference.sourceOperands.reportedFreeCashFlowUsd}</code> USD ·
          reported interest expense{" "}
          <code>{reference.sourceOperands.reportedInterestExpenseUsd}</code> USD
        </dd>
      </div>
      <div>
        <dt>Proxy bridge</dt>
        <dd>
          Signed reported FCF {formatUsd(reference.reportedFreeCashFlowUsd)} +
          after-tax interest add-back{" "}
          {formatUsd(reference.afterTaxInterestAddBackUsd)}. Signed reported
          interest expense is {formatUsd(reference.reportedInterestExpenseUsd)};
          its magnitude is{" "}
          {formatUsd(reference.reportedInterestExpenseMagnitudeUsd)}. The owner
          tax-shield assumption is{" "}
          {formatPercent(result.assumptions.taxShieldRatePercent)}.
        </dd>
      </div>
      <div>
        <dt>EV-to-equity bridge</dt>
        <dd>
          Provider EV-to-equity bridge (enterprise value minus market
          capitalization): {formatUsd(reference.providerEvToEquityBridgeUsd)}.
          This same-date observed bridge is held constant across scenarios.
        </dd>
      </div>
    </dl>
  );
}

function MethodologyDetails({ result }: { readonly result: AvailableResult }) {
  return (
    <details className="fcff-dcf-methodology">
      <summary>Methodology, formulas, and rounding</summary>
      <div>
        <p>
          <strong>Starting unlevered FCF proxy (mechanical)</strong> = reported
          free cash flow + |reported interest expense| × (1 − marginal
          tax-shield rate assumption). Formula{" "}
          <code>
            {result.methodology.formulas.startingUnleveredFcfProxy.formulaId}
          </code>
          , version{" "}
          {result.methodology.formulas.startingUnleveredFcfProxy.formulaVersion}
          .
        </p>
        <p>
          <strong>Enterprise value</strong> = sum of each forecast FCF proxy
          discounted by WACC + discounted Gordon-growth terminal value.
          Present-value formula{" "}
          <code>{result.methodology.formulas.presentValue.formulaId}</code>.
        </p>
        <p>
          <strong>Terminal value</strong> = final forecast FCF proxy × (1 +
          terminal growth) ÷ (WACC − terminal growth). WACC must be strictly
          greater than terminal growth. Formula{" "}
          <code>{result.methodology.formulas.terminalValue.formulaId}</code>.
        </p>
        <p>
          <strong>Equity value</strong> = modeled enterprise value − the
          same-date provider EV-to-equity bridge. Quote-consistent share-count
          proxy = same-date market capitalization ÷ raw close. Implied price =
          equity value ÷ that proxy. Formula{" "}
          <code>{result.methodology.formulas.impliedPrice.formulaId}</code>.
        </p>
        <p>
          <strong>Reverse DCF</strong> solves the market-implied constant annual
          FCF-proxy growth whose modeled enterprise value matches the same-date
          provider enterprise value within the bounded search. It is an
          implication, not a forecast. Formula{" "}
          <code>{result.methodology.formulas.reverseGrowth.formulaId}</code>.
        </p>
        <p>
          Formula set {result.formulaSetVersion} · result schema{" "}
          {result.schemaVersion}. Decimal arithmetic and rounding are defined by
          the versioned model.
        </p>
      </div>
    </details>
  );
}

function UnavailableValuation({
  result,
  symbol,
}: {
  readonly result: UnavailableResult;
  readonly symbol: string;
}) {
  const copy = unavailableCopy(result, symbol);
  return (
    <ReadinessState detail={copy.detail} title={copy.title}>
      {result.missingAnnualInputs.length === 0 ? null : (
        <span>
          Missing annual inputs:{" "}
          {result.missingAnnualInputs.map(annualInputLabel).join(", ")}.
        </span>
      )}
    </ReadinessState>
  );
}

function ReadinessState({
  children,
  detail,
  title,
}: {
  readonly children?: ReactNode;
  readonly detail: string;
  readonly title: string;
}) {
  return (
    <div aria-live="polite" className="fcff-dcf-state" role="status">
      <strong>{title}</strong>
      <span>{detail}</span>
      {children}
      <small>
        No DCF value, implied growth, sensitivity value, or recommendation was
        substituted.
      </small>
    </div>
  );
}

function unavailableCopy(
  result: UnavailableResult,
  symbol: string,
): Readonly<{ detail: string; title: string }> {
  switch (result.reason) {
    case "selection_not_loaded":
      return {
        title: "Choose a security before calculating.",
        detail:
          "The model requires the exact admitted listing identity and never infers it from loaded responses.",
      };
    case "market_not_loaded":
      return {
        title: `Load ${symbol} price history.`,
        detail:
          "Use the market panel above. A raw close is required for the exact-date per-share bridge.",
      };
    case "valuation_history_not_loaded":
      return {
        title: `Load ${symbol} daily valuation history.`,
        detail:
          "Market capitalization and enterprise value must be observed on the same date as the raw close.",
      };
    case "annual_financials_not_loaded":
      return {
        title: `Load ${symbol} annual financials.`,
        detail:
          "The model requires reported free cash flow and interest expense from one annual period.",
      };
    case "identity_mismatch":
      return {
        title: "Loaded inputs describe different listings.",
        detail:
          "Reload every source for the exact admitted listing; stale company data is never mixed.",
      };
    case "range_mismatch":
      return {
        title: "Price and valuation ranges do not match.",
        detail: "Choose one market range and reload both daily histories.",
      };
    case "no_common_date":
      return {
        title: "No common market reference date is available.",
        detail:
          "The raw price and provider valuation histories must share an exact date.",
      };
    case "reference_price_nonpositive":
      return {
        title: "The reference raw close is not usable.",
        detail:
          "A strictly positive raw close is required; no adjusted or nearby price is substituted.",
      };
    case "reference_market_cap_unavailable":
      return {
        title: "Reference-date market capitalization is unavailable.",
        detail:
          "No share-count proxy or per-share value is inferred without the provider field.",
      };
    case "reference_market_cap_nonpositive":
      return {
        title: "Reference-date market capitalization is nonpositive.",
        detail:
          "A strictly positive provider market capitalization is required.",
      };
    case "reference_enterprise_value_unavailable":
      return {
        title: "Reference-date enterprise value is unavailable.",
        detail:
          "The reverse DCF and EV-to-equity bridge require the observed provider field.",
      };
    case "reference_enterprise_value_nonpositive":
      return {
        title: "Reference-date enterprise value is nonpositive.",
        detail:
          "A strictly positive provider enterprise value is required for this bounded model.",
      };
    case "no_annual_periods":
      return {
        title: "No annual period is available.",
        detail:
          "Reload annual financials; no prior or quarterly period is silently substituted.",
      };
    case "annual_statement_after_reference_date":
      return {
        title: "The annual statement is later than the market reference date.",
        detail:
          "The model will not combine a future annual statement with an earlier market observation.",
      };
    case "required_annual_input_unavailable":
      return {
        title: "A required annual input is unavailable.",
        detail:
          "Reported free cash flow and interest expense must both be known in the selected annual period.",
      };
    case "starting_unlevered_fcf_proxy_nonpositive":
      return {
        title: "The starting unlevered FCF proxy (mechanical) is nonpositive.",
        detail:
          "The signed reported cash flow and after-tax interest add-back do not produce a positive model base.",
      };
    case "tax_shield_rate_out_of_bounds":
      return {
        title: "Enter a marginal tax-shield rate from 0% through 50%.",
        detail:
          "Correct the illustrative owner assumption; the previous result is not retained.",
      };
    case "scenario_growth_out_of_bounds":
      return {
        title: "Enter every scenario growth rate from −50% through 50%.",
        detail:
          "All three scenario inputs must be valid before the shared result is shown.",
      };
    case "scenario_growth_not_ordered":
      return {
        title: "Order growth from conservative through expansion.",
        detail:
          "Conservative growth must be at or below base, and base must be at or below expansion. The model does not auto-sort owner assumptions.",
      };
    case "wacc_out_of_bounds":
      return {
        title: "Enter a WACC from 1% through 30%.",
        detail: "Use a discount rate within the bounded model.",
      };
    case "terminal_growth_out_of_bounds":
      return {
        title: "Enter terminal growth from −2% through 5%.",
        detail: "Use a terminal rate within the bounded model.",
      };
    case "forecast_years_out_of_bounds":
      return {
        title: "Enter a forecast horizon from 5 through 10 years.",
        detail: "The horizon must be a whole number inside the bounded model.",
      };
    case "discount_rate_not_above_terminal_growth":
      return {
        title: "WACC must be above terminal growth.",
        detail:
          "Increase WACC or reduce terminal growth before calculating a Gordon-growth terminal value.",
      };
  }
}

function reverseUnavailableCopy(
  reason: AvailableResult["reverseDcf"] extends infer Reverse
    ? Reverse extends { status: "unavailable"; reason: infer Reason }
      ? Reason
      : never
    : never,
  lower: string,
  upper: string,
): string {
  if (reason === "target_below_growth_search_bound") {
    return `The provider enterprise value implies growth below the ${formatPercent(lower)} search floor.`;
  }
  if (reason === "target_above_growth_search_bound") {
    return `The provider enterprise value implies growth above the ${formatPercent(upper)} search ceiling.`;
  }
  if (reason === "target_money_precision_not_resolved") {
    return "The bounded solver could not reproduce the provider enterprise value to the displayed cent, so it withheld the implied rate.";
  }
  return `The provider enterprise value was not bracketed between the ${formatPercent(lower)} and ${formatPercent(upper)} modeled growth bounds.`;
}

function annualInputLabel(value: string): string {
  return value === "free_cash_flow"
    ? "free cash flow"
    : value === "interest_expense"
      ? "interest expense"
      : value;
}

function summaryCopy(
  selection: PersonalMarketSelection | null,
  result: ModelResult | null,
  draftIssue: string | null,
): string {
  if (selection === null)
    return "Choose a security, then explicitly load its market, valuation, and annual-statement inputs.";
  if (draftIssue !== null)
    return `${selection.symbol} cash-flow valuation is paused while an assumption field is incomplete.`;
  if (result?.status === "available")
    return `${selection.symbol} forward and reverse cash-flow scenarios are available from exact-date market inputs and the latest annual model inputs.`;
  return `${selection.symbol} cash-flow valuation is unavailable; the exact missing or invalid input is shown below.`;
}

function sourceState(
  identity: PersonalMarketDataIdentityDto | null,
  selection: PersonalMarketSelection,
): "loaded" | "missing" | "wrong_listing" {
  if (identity === null) return "missing";
  return identityMatchesSelection(identity, selection)
    ? "loaded"
    : "wrong_listing";
}

function identityMatchesSelection(
  identity: PersonalMarketDataIdentityDto,
  selection: PersonalMarketSelection,
): boolean {
  return (
    identity.country === "US" &&
    identity.exchangeMic === selection.exchangeMic &&
    identity.issuerName === selection.issuerName &&
    identity.listingId === selection.listingId &&
    identity.securityName === selection.securityName &&
    identity.symbol === selection.symbol
  );
}

function mapIdentity(identity: PersonalMarketDataIdentityDto) {
  return {
    country: identity.country,
    exchangeMic: identity.exchangeMic,
    issuerName: identity.issuerName,
    listingId: identity.listingId,
    securityName: identity.securityName,
    symbol: identity.symbol,
  };
}

function mapSelection(selection: PersonalMarketSelection) {
  return {
    country: "US" as const,
    exchangeMic: selection.exchangeMic,
    issuerName: selection.issuerName,
    listingId: selection.listingId,
    securityName: selection.securityName,
    symbol: selection.symbol,
  };
}

function mapMarketOverview(overview: PersonalMarketOverviewDto | null) {
  if (overview === null) return null;
  return {
    bars: overview.history.bars.map((bar) => ({
      date: bar.date,
      raw: { close: bar.raw.close },
    })),
    priceCurrency: overview.quote.currency,
    range: overview.history.range,
    security: mapIdentity(overview.security),
  };
}

function mapValuationHistory(history: PersonalValuationHistoryDto | null) {
  if (history === null) return null;
  return {
    asOf: history.asOf,
    points: history.history.points.map((point) => ({
      date: point.date,
      enterpriseValue: point.enterpriseValue,
      marketCapitalization: point.marketCapitalization,
    })),
    range: history.history.range,
    security: mapIdentity(history.security),
  };
}

function mapAnnualFinancials(financials: PersonalAnnualFinancialsDto | null) {
  if (financials === null) return null;
  return {
    asOf: financials.asOf,
    security: mapIdentity(financials.security),
    valueCurrency: financials.provider.valueCurrency,
    years: financials.years.map((year) => ({
      fiscalYear: year.fiscalYear,
      reported: {
        free_cash_flow: year.reported.free_cash_flow,
        interest_expense: year.reported.interest_expense,
      },
      statementDate: year.statementDate,
    })),
  };
}

function assumptionDraftIssue(assumptions: AssumptionDraft): string | null {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(assumptions.forecastYears)) {
    return "Complete the forecast horizon with an ordinary whole number; no stale result is retained while you edit.";
  }
  const values = [
    assumptions.taxShieldRatePercent,
    assumptions.terminalGrowthPercent,
    assumptions.waccPercent,
    ...scenarioOrder.map(
      (scenario) => assumptions.scenarios[scenario].annualFcfProxyGrowthPercent,
    ),
  ];
  return values.every((value) => {
    if (value.length > PERSONAL_FCFF_DCF_MAXIMUM_DECIMAL_LENGTH) return false;
    const fractional = value.split(".")[1];
    return (
      (fractional === undefined ||
        fractional.length <= PERSONAL_FCFF_DCF_ROUNDING.rateDecimalPlaces) &&
      /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value)
    );
  })
    ? null
    : "Complete every numeric field using ordinary decimal notation with no more than four decimal places; no stale result is retained while you edit.";
}

function createAssumptionDraft(
  assumptions: PersonalFcffDcfAssumptions,
): AssumptionDraft {
  return {
    ...assumptions,
    forecastYears: String(assumptions.forecastYears),
    scenarios: {
      base: { ...assumptions.scenarios.base },
      conservative: { ...assumptions.scenarios.conservative },
      expansion: { ...assumptions.scenarios.expansion },
    },
  };
}

function materializeAssumptions(
  assumptions: AssumptionDraft,
): PersonalFcffDcfAssumptions {
  return {
    ...assumptions,
    forecastYears: Number(assumptions.forecastYears),
  };
}

function unique(values: readonly string[]): readonly string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function formatUsd(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${negative ? "−" : ""}$${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
}

function formatDecimal(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${negative ? "−" : ""}${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
}

function formatPercent(value: string): string {
  return `${formatDecimal(value)}%`;
}

function formatSignedPercent(value: string): string {
  return value.startsWith("-") || /^0(?:\.0*)?$/u.test(value)
    ? `${formatDecimal(value)}%`
    : `+${formatDecimal(value)}%`;
}

function rateTenThousandths(value: string): number {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction = ""] = unsigned.split(".");
  const scaled =
    Number(integer) * 10_000 + Number(fraction.padEnd(4, "0").slice(0, 4));
  return negative ? -scaled : scaled;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function formatInstant(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}
