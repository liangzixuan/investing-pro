import type { ReactNode } from "react";
import type { AuthoredCashFlowDcfResult } from "@research-cockpit/personal-market-analytics";
import type { AuthoredExitMultipleResult } from "@research-cockpit/research-core/valuation";
import {
  VALUATION_SCENARIOS,
  type ManagedValuationCalculation,
} from "./managed-valuation-workbench";

export const valuationScenarioLabels = {
  conservative: "Conservative",
  base: "Base",
  expansion: "Expansion",
} as const;

const refusalText: Readonly<Record<string, string>> = {
  invalid_input:
    "Complete every input with a valid decimal and keep each value within the model limits.",
  starting_cash_flow_nonpositive:
    "Starting unlevered cash flow must be greater than zero.",
  shares_nonpositive: "Diluted shares must be greater than zero.",
  wacc_out_of_bounds: "WACC must be from 1% to 30%.",
  terminal_growth_out_of_bounds: "Terminal growth must be from -2% to 5%.",
  forecast_years_out_of_bounds:
    "Forecast years must be a whole number from 5 to 10.",
  scenario_growth_out_of_bounds:
    "Annual cash flow growth must be from -50% to 50%.",
  scenario_growth_not_ordered:
    "Cash flow growth must follow conservative ≤ base ≤ expansion.",
  discount_rate_not_above_terminal_growth:
    "The discount rate must be greater than terminal growth.",
  nonpositive_equity_value:
    "Equity value is zero or negative. A positive value per share is unavailable.",
  sensitivity_rate_out_of_bounds:
    "This sensitivity rate is outside the model limits.",
  sensitivity_input_out_of_bounds:
    "This sensitivity input is outside the model limits.",
};
export function valuationRefusal(reason: string) {
  return refusalText[reason] ?? reason;
}

function Facts({
  rows,
}: {
  readonly rows: readonly (readonly [string, ReactNode])[];
}) {
  return (
    <dl className="managed-valuation-facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function Table({
  label,
  headings,
  rows,
}: {
  readonly label: string;
  readonly headings: readonly string[];
  readonly rows: readonly (readonly ReactNode[])[];
}) {
  return (
    <div
      className="managed-valuation-table"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table>
        <caption>{label}</caption>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, column) =>
                column === 0 ? (
                  <th key={column} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={column}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function DcfResults({
  result,
}: {
  readonly result: AuthoredCashFlowDcfResult;
}) {
  if (result.status === "unavailable")
    return <p>Cash flow DCF unavailable. {valuationRefusal(result.reason)}</p>;
  return (
    <section aria-label="Cash flow DCF calculated scenarios">
      <h4>Cash flow DCF results</h4>
      {rateTenThousandths(result.inputs.waccPercent) -
        rateTenThousandths(result.inputs.terminalGrowthPercent) <
        10_000 && (
        <p role="note">
          WACC is less than 1.00 percentage point above terminal growth. The
          Gordon-growth terminal value is valid but highly sensitive to small
          rate changes.
        </p>
      )}
      {VALUATION_SCENARIOS.map((key) =>
        Number(result.scenarios[key].terminalValuePercentOfEnterpriseValue) >
        80 ? (
          <p key={key} role="note">
            {valuationScenarioLabels[key]}:{" "}
            {result.scenarios[key].terminalValuePercentOfEnterpriseValue}% of
            enterprise value comes from the terminal value. More than 80%
            depends on assumptions beyond the explicit forecast.
          </p>
        ) : null,
      )}
      <Table
        label="Cash flow DCF scenarios"
        headings={[
          "Scenario",
          "Annual growth (%)",
          "Enterprise value (USD)",
          "Equity value (USD)",
          "Value per share (USD/share)",
          "Terminal present value / enterprise value (%)",
        ]}
        rows={VALUATION_SCENARIOS.map((key) => {
          const s = result.scenarios[key];
          return [
            valuationScenarioLabels[key],
            s.annualCashFlowGrowthPercent,
            s.enterpriseValueUsd,
            s.equityValueUsd,
            s.status === "available"
              ? s.valuePerShareUsd
              : valuationRefusal(s.reason),
            s.terminalValuePercentOfEnterpriseValue,
          ];
        })}
      />
      <details>
        <summary>DCF projections and terminal value</summary>
        {VALUATION_SCENARIOS.map((key) => {
          const s = result.scenarios[key];
          return (
            <section
              key={key}
              aria-label={`${valuationScenarioLabels[key]} cash flow projection`}
            >
              <h5>{valuationScenarioLabels[key]}</h5>
              <Table
                label={`${valuationScenarioLabels[key]} cash flow projection`}
                headings={["Year", "Cash flow (USD)", "Present value (USD)"]}
                rows={s.projection.map((p) => [
                  p.year,
                  p.cashFlowUsd,
                  p.presentValueUsd,
                ])}
              />
              <Facts
                rows={[
                  [
                    "Explicit cash flow present value (USD)",
                    s.presentValueOfExplicitCashFlowUsd,
                  ],
                  ["Terminal value (USD)", s.terminalValueUsd],
                  [
                    "Terminal value present value (USD)",
                    s.presentValueOfTerminalValueUsd,
                  ],
                  [
                    "Terminal present value / enterprise value (%)",
                    s.terminalValuePercentOfEnterpriseValue,
                  ],
                ]}
              />
            </section>
          );
        })}
      </details>
      <details>
        <summary>DCF sensitivity: 25 base-scenario combinations</summary>
        <p>
          Each row changes WACC and terminal growth together. All other base
          inputs stay fixed.
        </p>
        <Table
          label="DCF sensitivity — value per share in USD/share"
          headings={[
            "WACC (%)",
            "Terminal growth (%)",
            "Enterprise value (USD)",
            "Equity value (USD)",
            "Value per share (USD/share) or refusal",
          ]}
          rows={result.sensitivity.cells.map((c) => [
            c.waccPercent,
            c.terminalGrowthPercent,
            "enterpriseValueUsd" in c ? c.enterpriseValueUsd : "Unavailable",
            "equityValueUsd" in c ? c.equityValueUsd : "Unavailable",
            c.status === "available"
              ? c.valuePerShareUsd
              : valuationRefusal(c.reason),
          ])}
        />
      </details>
    </section>
  );
}
function rateTenThousandths(value: string): number {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const scaled = Number(whole) * 10_000 + Number(fraction.padEnd(4, "0"));
  return negative ? -scaled : scaled;
}
function ExitResults({
  result,
}: {
  readonly result: AuthoredExitMultipleResult;
}) {
  if (result.status === "unavailable")
    return <p>Exit multiple unavailable. {valuationRefusal(result.reason)}</p>;
  return (
    <section aria-label="Exit multiple calculated scenarios">
      <h4>Exit multiple results</h4>
      <Table
        label="Exit multiple scenarios"
        headings={[
          "Scenario",
          "Year N revenue (USD)",
          "Year N EBITDA (USD)",
          "Enterprise value today (USD)",
          "Equity value (USD)",
          "Value per share (USD/share)",
        ]}
        rows={VALUATION_SCENARIOS.map((key) => {
          const s = result.scenarios[key];
          return [
            valuationScenarioLabels[key],
            s.yearNRevenue,
            s.yearNEbitda,
            s.presentEnterpriseValue,
            s.equityValue,
            s.status === "available"
              ? s.valuePerShare
              : valuationRefusal(s.reason),
          ];
        })}
      />
      <details>
        <summary>Exit multiple calculations and formulas</summary>
        {VALUATION_SCENARIOS.map((key) => {
          const s = result.scenarios[key];
          return (
            <section key={key}>
              <h5>{valuationScenarioLabels[key]}</h5>
              <Facts
                rows={[
                  [
                    "Terminal enterprise value (USD)",
                    s.terminalEnterpriseValue,
                  ],
                ]}
              />
              <ol>
                {s.formulaTrace.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ol>
              <pre>{JSON.stringify(s.inputs, null, 2)}</pre>
            </section>
          );
        })}
      </details>
      <details>
        <summary>
          Exit multiple sensitivity: 25 base-scenario combinations
        </summary>
        <p>
          Each row changes the discount rate and exit multiple together. All
          other base inputs stay fixed.
        </p>
        <Table
          label="Exit multiple sensitivity — value per share in USD/share"
          headings={[
            "Discount rate (%)",
            "Exit multiple (times)",
            "Enterprise value today (USD)",
            "Equity value (USD)",
            "Value per share (USD/share) or refusal",
          ]}
          rows={result.sensitivity.cells.map((c) => [
            c.discountRatePercent,
            c.exitMultiple,
            "result" in c ? c.result.presentEnterpriseValue : "Unavailable",
            "result" in c ? c.result.equityValue : "Unavailable",
            c.status === "available"
              ? c.result.valuePerShare
              : valuationRefusal(c.reason),
          ])}
        />
      </details>
    </section>
  );
}

/** A passive view of one frozen calculation, also used in the offline report. */
export function ManagedValuationResults({
  calculation,
}: {
  readonly calculation: ManagedValuationCalculation;
}) {
  const identity = calculation.owner.listing;
  return (
    <section
      className="managed-valuation-results"
      aria-label="Authored valuation results"
    >
      <h3>Calculated authored scenarios</h3>
      <p>
        {identity.symbol} · {identity.securityName} · {identity.exchangeMic} ·{" "}
        {identity.listingId}
      </p>
      <p>{calculation.explanation}</p>
      <p>
        USD amounts are full dollars, not thousands or millions. Shares are
        actual share counts. Separately loaded prices keep their own dates and
        share-basis limits.
      </p>
      <DcfResults result={calculation.dcfResult} />
      <ExitResults result={calculation.exitResult} />
      <details>
        <summary>Complete authored inputs and model methods</summary>
        <h4>Cash flow DCF inputs</h4>
        <pre>{JSON.stringify(calculation.dcfDraft, null, 2)}</pre>
        <h4>Cash flow DCF method</h4>
        <pre>{JSON.stringify(calculation.dcfResult.methodology, null, 2)}</pre>
        <h4>Exit multiple inputs</h4>
        <pre>{JSON.stringify(calculation.exitDraft, null, 2)}</pre>
        <h4>Exit multiple method</h4>
        <pre>{JSON.stringify(calculation.exitResult.methodology, null, 2)}</pre>
        <p>Blank or invalid inputs remain visible exactly as entered.</p>
      </details>
    </section>
  );
}
