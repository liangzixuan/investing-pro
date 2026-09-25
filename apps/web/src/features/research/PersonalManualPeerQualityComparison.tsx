import type { PersonalAnnualFinancialsDto } from "@research-cockpit/contracts";
import {
  buildPersonalFinancialQualityScorecard,
  formatPersonalFinancialRatio,
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_CHECK_IDS,
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULAS,
  PERSONAL_FINANCIAL_QUALITY_SCORECARD_GROUP_IDS,
  type PersonalFinancialQualityScorecardCheck,
  type PersonalFinancialQualityScorecardObservation,
  type PersonalFinancialQualityScorecardReadyResult,
} from "@research-cockpit/personal-financial-analytics";
import type {
  PersonalManualPeerComparisonResult,
  PersonalManualPeerComparisonSelection,
} from "@research-cockpit/personal-market-analytics";

import { mapAnnualFinancials } from "./personal-financial-quality-input";

export interface PersonalManualPeerQualityCompanyInput {
  readonly annualFinancials: PersonalAnnualFinancialsDto | null;
  readonly selection: PersonalManualPeerComparisonSelection;
}

export interface PersonalManualPeerQualityComparisonProps {
  readonly admission: PersonalManualPeerComparisonResult;
  readonly companies: readonly PersonalManualPeerQualityCompanyInput[];
}

type AdmittedCompany = PersonalManualPeerComparisonResult["companies"][number];
type QualityColumn =
  | Readonly<{
      status: "ready";
      company: AdmittedCompany;
      result: PersonalFinancialQualityScorecardReadyResult;
    }>
  | Readonly<{
      status: "unavailable";
      company: AdmittedCompany;
      reason: string;
    }>;

const groupLabels = {
  profitability_cash: "Profitability & cash",
  growth_efficiency: "Growth & efficiency",
  balance_sheet: "Balance sheet",
} as const;

export function PersonalManualPeerQualityComparison({
  admission,
  companies,
}: PersonalManualPeerQualityComparisonProps) {
  // These carriers are the same ordered inputs used by the parent's single
  // peer-engine call. A changed identity/order cannot reuse another admission.
  if (
    companies.length < 2 ||
    companies.length > 4 ||
    companies.length !== admission.companies.length ||
    companies.some((carrier, index) => {
      const admitted = admission.companies[index];
      return (
        admitted === undefined ||
        admitted.role !== (index === 0 ? "primary" : "peer") ||
        !sameSelection(carrier.selection, admitted.selection)
      );
    })
  ) {
    return null;
  }

  const anchor = admission.anchors.annualFiscalYear;
  const columns =
    anchor === null
      ? []
      : companies.map((carrier, index) =>
          qualityColumn(admission.companies[index]!, carrier, anchor),
        );

  return (
    <section
      aria-describedby="manual-peer-quality-caveat"
      aria-labelledby="manual-peer-quality-title"
      className="manual-peer-quality-comparison"
    >
      <h3 id="manual-peer-quality-title">Annual quality checks</h3>
      <p className="market-scope-note">
        Twelve existing checks use each company&apos;s latest annual statements.
        That latest fiscal year must equal the selected company&apos;s year;
        older matching years are not substituted. Valuation data is not
        required.
      </p>
      {anchor === null ? (
        <p className="market-scope-note">
          Load valid annual statements for the selected company to establish an
          annual quality comparison year.
        </p>
      ) : (
        <div
          aria-label="Annual quality comparison table scroll area"
          className="financial-table-scroll"
          role="region"
          tabIndex={0}
        >
          <table
            aria-label="Annual quality checks across selected companies"
            className="manual-peer-table manual-peer-quality-table"
          >
            <caption>
              Annual quality checks · FY {anchor} · selected company and chosen
              peers
            </caption>
            <thead>
              <tr>
                <th scope="col">Check</th>
                {columns.map((column) => (
                  <th
                    className={
                      column.company.role === "primary"
                        ? "manual-peer-primary-column"
                        : undefined
                    }
                    key={column.company.selection.listingId}
                    scope="col"
                  >
                    <span>
                      {column.company.selection.symbol} ·{" "}
                      {column.company.role === "primary"
                        ? "Selected company"
                        : "Peer"}
                    </span>
                    <small>
                      {column.company.selection.issuerName} ·{" "}
                      {column.company.selection.exchangeMic}
                    </small>
                    {column.status === "ready" ? (
                      <small>
                        Source response as of {column.result.asOf} · formula set{" "}
                        {column.result.formulaSetVersion}
                      </small>
                    ) : (
                      <small>{column.reason}</small>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            {PERSONAL_FINANCIAL_QUALITY_SCORECARD_GROUP_IDS.map((groupId) => (
              <tbody key={groupId}>
                <tr className="manual-peer-group-row">
                  <th colSpan={columns.length + 1} scope="rowgroup">
                    {groupLabels[groupId]}
                  </th>
                </tr>
                {PERSONAL_FINANCIAL_QUALITY_SCORECARD_CHECK_IDS.filter(
                  (id) =>
                    PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULAS[id]
                      .groupId === groupId,
                ).map((id) => {
                  const definition =
                    PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULAS[id];
                  return (
                    <tr key={id}>
                      <th scope="row">
                        <span>{definition.label}</span>
                      </th>
                      {columns.map((column) => {
                        const check =
                          column.status === "ready"
                            ? column.result.groups
                                .flatMap((group) => group.checks)
                                .find((item) => item.checkId === id)
                            : undefined;
                        return (
                          <td
                            className={
                              column.company.role === "primary"
                                ? "manual-peer-primary-column"
                                : undefined
                            }
                            data-status={check?.status ?? "unavailable"}
                            key={column.company.selection.listingId}
                          >
                            <strong>
                              {statusLabel(check?.status ?? "unavailable")}
                            </strong>
                            {check === undefined ? (
                              <span className="manual-peer-quality-reason">
                                {column.status === "unavailable"
                                  ? column.reason
                                  : "Annual quality check unavailable"}
                              </span>
                            ) : (
                              <>
                                {check.status === "unavailable" ? (
                                  <span className="manual-peer-quality-reason">
                                    {reasonLabel(check.reason)} ({check.reason})
                                  </span>
                                ) : null}
                                <QualityDisclosure
                                  check={check}
                                  company={column.company}
                                  asOf={
                                    column.status === "ready"
                                      ? column.result.asOf
                                      : ""
                                  }
                                  formulaSetVersion={
                                    column.status === "ready"
                                      ? column.result.formulaSetVersion
                                      : ""
                                  }
                                  key={JSON.stringify([
                                    column.company.selection,
                                    column.company.role,
                                    column.status === "ready"
                                      ? column.result.asOf
                                      : null,
                                    column.status === "ready"
                                      ? column.result.formulaSetVersion
                                      : null,
                                    check,
                                  ])}
                                />
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
      <p
        className="fcff-dcf-caveat"
        id="manual-peer-quality-caveat"
        role="note"
      >
        Met describes one published test, not a grade, ranking, total or
        buy/sell signal. These checks are not sector-adjusted or a Piotroski
        F-Score, Altman Z-Score or Beneish M-Score. Fiscal-year labels align;
        provider statement/release dates may differ. Loaded provider-most-recent
        data is not point-in-time filing verification. Observations are derived
        values; references identify facts and do not supply every raw operand
        value. No additional request is made and nothing is saved or exported.
      </p>
    </section>
  );
}

function qualityColumn(
  company: AdmittedCompany,
  carrier: PersonalManualPeerQualityCompanyInput,
  anchor: number,
): QualityColumn {
  const unavailable = (reason: string): QualityColumn => ({
    status: "unavailable",
    company,
    reason,
  });
  if (company.annual.status === "not_loaded")
    return unavailable("Annual source not loaded");
  if (company.annual.status === "quarantined")
    return unavailable("Annual source quarantined");
  const financials = carrier.annualFinancials;
  if (financials === null || financials.asOf !== company.annual.asOf)
    return unavailable(
      "Annual source no longer matches this company comparison",
    );
  if (financials.years[0]?.fiscalYear !== anchor)
    return unavailable(
      "Latest annual fiscal year differs from the selected company's year",
    );
  const result = buildPersonalFinancialQualityScorecard(
    mapAnnualFinancials(financials),
  );
  return result.status === "ready"
    ? { status: "ready", company, result }
    : unavailable(
        `Annual quality source withheld (${result.issues.map((issue) => issue.reason).join(", ")})`,
      );
}

function sameSelection(
  first: PersonalManualPeerComparisonSelection,
  second: PersonalManualPeerComparisonSelection,
): boolean {
  return (
    first.country === second.country &&
    first.exchangeMic === second.exchangeMic &&
    first.issuerId === second.issuerId &&
    first.issuerName === second.issuerName &&
    first.listingId === second.listingId &&
    first.securityName === second.securityName &&
    first.symbol === second.symbol
  );
}

function QualityDisclosure({
  check,
  company,
  asOf,
  formulaSetVersion,
}: {
  readonly check: PersonalFinancialQualityScorecardCheck;
  readonly company: AdmittedCompany;
  readonly asOf: string;
  readonly formulaSetVersion: string;
}) {
  const identity = company.selection;
  return (
    <details className="manual-peer-quality-inputs">
      <summary
        aria-label={`Inspect ${identity.symbol} ${check.label} quality check (${identity.exchangeMic} · ${identity.listingId})`}
      >
        Inspect {identity.symbol} {check.label} check
      </summary>
      <div className="manual-peer-metric-inputs-body">
        <p>
          <strong>Company identity</strong>
        </p>
        <dl>
          <div>
            <dt>Symbol</dt>
            <dd>{identity.symbol}</dd>
          </div>
          <div>
            <dt>Issuer</dt>
            <dd>{identity.issuerName}</dd>
          </div>
          <div>
            <dt>Security</dt>
            <dd>{identity.securityName}</dd>
          </div>
          <div>
            <dt>Exchange</dt>
            <dd>{identity.exchangeMic}</dd>
          </div>
          <div>
            <dt>Country</dt>
            <dd>{identity.country}</dd>
          </div>
          <div>
            <dt>Issuer ID</dt>
            <dd>{identity.issuerId}</dd>
          </div>
          <div>
            <dt>Listing ID</dt>
            <dd>{identity.listingId}</dd>
          </div>
          <div>
            <dt>Result</dt>
            <dd>
              {statusLabel(check.status)}
              {check.status === "unavailable"
                ? ` · ${reasonLabel(check.reason)} (${check.reason})`
                : ""}
            </dd>
          </div>
          <div>
            <dt>Exact test</dt>
            <dd>
              <code>{check.expression}</code>
            </dd>
          </div>
          <div>
            <dt>Formula</dt>
            <dd>
              {check.formulaId} · version {check.formulaVersion}
            </dd>
          </div>
          <div>
            <dt>Formula set version</dt>
            <dd>{formulaSetVersion}</dd>
          </div>
          <div>
            <dt>Source response as of</dt>
            <dd>{asOf}</dd>
          </div>
        </dl>
        <QualityObservation
          label="Current observation"
          observation={check.currentObservation}
        />
        <QualityObservation
          label="Prior observation"
          observation={check.priorObservation}
        />
        <p>
          References identify reported facts; missing raw operand values are not
          reconstructed. Each observation keeps its own fiscal year and provider
          statement date.
        </p>
      </div>
    </details>
  );
}

function QualityObservation({
  label,
  observation,
}: {
  readonly label: string;
  readonly observation: PersonalFinancialQualityScorecardObservation | null;
}) {
  const ratio =
    observation?.unit === "ratio" && observation.value !== null
      ? formatPersonalFinancialRatio(observation.value)
      : null;
  return (
    <div>
      <p>
        <strong>{label}</strong>
      </p>
      {observation === null ? (
        <p>No observation retained.</p>
      ) : (
        <>
          <dl>
            <div>
              <dt>Value</dt>
              <dd>
                {observation.unit === "ratio" && observation.value !== null
                  ? (ratio?.label ?? "Unavailable ratio")
                  : `${observation.value ?? "Unavailable"} ${observation.unit}`}
                {ratio !== null &&
                  (ratio.rounded || ratio.notation === "scientific") && (
                    <details className="financial-ratio-details">
                      <summary>Calculation details</summary>
                      <p className="financial-exact-value">
                        {ratio.exactValue} ratio
                      </p>
                      <p>
                        Display uses up to four decimal places, or scientific
                        notation for large ratios. Checks use the full
                        calculation value.
                      </p>
                    </details>
                  )}
              </dd>
            </div>
            <div>
              <dt>Fiscal year</dt>
              <dd>{observation.fiscalYear}</dd>
            </div>
            <div>
              <dt>Provider statement date</dt>
              <dd>{observation.statementDate}</dd>
            </div>
          </dl>
          <p>
            <strong>Source references</strong>
          </p>
          {observation.inputRefs.length === 0 ? (
            <p>No admitted source reference.</p>
          ) : (
            <ol>
              {observation.inputRefs.map((input, index) => (
                <li
                  key={`${input.factKey}:${input.sourceRef}:${String(index)}`}
                >
                  <code>{input.factKey}</code> ← <code>{input.sourceRef}</code>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

function statusLabel(
  status: PersonalFinancialQualityScorecardCheck["status"],
): string {
  return status === "met"
    ? "Met"
    : status === "not_met"
      ? "Not met"
      : "Unavailable";
}

function reasonLabel(reason: string): string {
  return reason
    .split("_")
    .map((word, index) =>
      index === 0 ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word,
    )
    .join(" ");
}
