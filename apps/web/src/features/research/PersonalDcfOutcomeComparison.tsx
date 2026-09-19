"use client";

import type { PersonalFcffDcfAvailableResult } from "@research-cockpit/personal-market-analytics";

export type PersonalDcfOutcomeSide =
  | {
      readonly status: "available";
      readonly result: PersonalFcffDcfAvailableResult;
      readonly smallRateGap: boolean;
    }
  | { readonly status: "unavailable"; readonly reason: string };

export interface PersonalDcfOutcomeComparisonProps {
  readonly symbol: string;
  readonly current: PersonalDcfOutcomeSide;
  readonly saved: PersonalDcfOutcomeSide;
}

const scenarios = [
  ["conservative", "Conservative"],
  ["base", "Base"],
  ["expansion", "Expansion"],
] as const;

export function PersonalDcfOutcomeComparison({
  symbol,
  current,
  saved,
}: PersonalDcfOutcomeComparisonProps) {
  const validatedResult =
    current.status === "available"
      ? current.result
      : saved.status === "available"
        ? saved.result
        : null;

  return (
    <section
      aria-labelledby="dcf-outcome-comparison-title"
      className="dcf-outcome-comparison"
    >
      <h3 id="dcf-outcome-comparison-title">DCF outcome comparison</h3>
      <p id="dcf-outcome-comparison-summary">
        Both assumption sets are recalculated using the same currently loaded
        data. Loaded saved assumptions are the set you explicitly loaded, not
        results from when you saved or a guarantee of the latest saved version.
        This comparison does not change your current inputs or load source data.
      </p>
      <div
        aria-describedby="dcf-outcome-comparison-summary"
        aria-label={`${symbol} DCF outcome comparison`}
        className="dcf-outcome-comparison-scroll"
        role="region"
        tabIndex={0}
      >
        <table>
          <caption>
            {symbol}: current and loaded saved DCF outcomes, recalculated from
            the same currently loaded data.
          </caption>
          <thead>
            <tr>
              <th scope="col">Scenario</th>
              <th scope="col">Current assumptions</th>
              <th scope="col">Loaded saved assumptions</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map(([scenario, label]) => (
              <tr key={scenario}>
                <th scope="row">{label}</th>
                <td>{outcome(current, scenario)}</td>
                <td>{outcome(saved, scenario)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rateGapWarning(current, "Current assumptions")}
      {rateGapWarning(saved, "Loaded saved assumptions")}
      {validatedResult === null ? (
        <p>
          No validated common reference is available. Resolve the unavailable
          inputs above; no reference price or date has been substituted.
        </p>
      ) : (
        <SharedProvenance result={validatedResult} />
      )}
      <p className="dcf-outcome-comparison-caveat" role="note">
        This is a mechanical unlevered FCF-proxy model, not audited FCFF. Inputs
        use provider-most-recent history, not point-in-time or as-reported
        history. Tax-shield assumptions can change each starting proxy and
        after-tax interest add-back even with the same source operands. Equal
        displayed outcomes do not establish equal assumptions; inspect the
        seven-input comparison. These scenarios are not price targets or
        buy/sell recommendations. Calculated results are not saved or exported.
      </p>
    </section>
  );
}

function outcome(
  side: PersonalDcfOutcomeSide,
  scenario: (typeof scenarios)[number][0],
) {
  if (side.status === "unavailable") {
    return (
      <div className="dcf-outcome-comparison-cell">
        <strong>Unavailable</strong>
        <span>{side.reason}</span>
      </div>
    );
  }
  const result = side.result.scenarios[scenario];
  return (
    <div className="dcf-outcome-comparison-cell">
      {result.status === "available" ? (
        <>
          <strong title={`${result.impliedPriceUsd} USD`}>
            {formatUsd(result.impliedPriceUsd)}
          </strong>
          <span>
            {formatSignedPercent(result.differencePercent)} vs reference raw
            close
          </span>
        </>
      ) : (
        <>
          <strong>Unavailable</strong>
          <span>No positive residual equity value.</span>
        </>
      )}
      <span>
        Terminal-value share: {result.terminalValuePercentOfEnterpriseValue}%
      </span>
      {Number(result.terminalValuePercentOfEnterpriseValue) > 80 ? (
        <p className="fcff-dcf-terminal-warning" role="note">
          More than 80% of enterprise value comes from the terminal value.
        </p>
      ) : null}
    </div>
  );
}

function rateGapWarning(side: PersonalDcfOutcomeSide, label: string) {
  return side.status === "available" && side.smallRateGap ? (
    <p className="fcff-dcf-rate-gap-warning" role="note">
      <strong>{label}: </strong>WACC is less than 1.00 percentage point above
      terminal growth. The Gordon-growth terminal value is valid but highly
      sensitive to small rate changes.
    </p>
  ) : null;
}

function SharedProvenance({
  result,
}: {
  readonly result: PersonalFcffDcfAvailableResult;
}) {
  const { reference } = result;
  return (
    <details className="dcf-outcome-comparison-provenance">
      <summary>Shared source inputs and provenance</summary>
      <dl>
        <div>
          <dt>Reference raw close</dt>
          <dd>
            {formatUsd(reference.rawCloseUsd)} USD on{" "}
            <time dateTime={reference.date}>{reference.date}</time>. Raw price,
            market capitalization and enterprise value share this exact date.
          </dd>
        </div>
        <div>
          <dt>Annual source</dt>
          <dd>
            FY {reference.annualFiscalYear} · statement date{" "}
            <time dateTime={reference.annualStatementDate}>
              {reference.annualStatementDate}
            </time>{" "}
            · response as of{" "}
            <time dateTime={reference.annualsAsOf}>
              {reference.annualsAsOf}
            </time>
          </dd>
        </div>
        <div>
          <dt>Valuation response as of</dt>
          <dd>
            <time dateTime={reference.valuationAsOf}>
              {reference.valuationAsOf}
            </time>
          </dd>
        </div>
        <div>
          <dt>Exact source operands (USD)</dt>
          <dd>
            Raw close <code>{reference.sourceOperands.rawCloseUsd}</code> ·
            market capitalization{" "}
            <code>{reference.sourceOperands.marketCapitalizationUsd}</code> ·
            enterprise value{" "}
            <code>{reference.sourceOperands.enterpriseValueUsd}</code> ·
            reported FCF{" "}
            <code>{reference.sourceOperands.reportedFreeCashFlowUsd}</code> ·
            reported interest expense{" "}
            <code>{reference.sourceOperands.reportedInterestExpenseUsd}</code>
          </dd>
        </div>
        <div>
          <dt>Model version</dt>
          <dd>
            Formula set {result.formulaSetVersion} · result schema{" "}
            {result.schemaVersion}
          </dd>
        </div>
      </dl>
    </details>
  );
}

function formatDecimal(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${negative ? "−" : ""}${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
}

function formatUsd(value: string): string {
  return `$${formatDecimal(value)}`;
}

function formatSignedPercent(value: string): string {
  const prefix =
    value.startsWith("-") || /^0(?:\.0*)?$/u.test(value) ? "" : "+";
  return `${prefix}${formatDecimal(value)}%`;
}
