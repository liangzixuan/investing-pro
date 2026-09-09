"use client";

import type {
  PersonalAnnualFinancialsDto,
  PersonalMarketDataRangeDto,
  PersonalMarketDataStatusDto,
  PersonalValuationHistoryDto,
} from "@research-cockpit/contracts";
import {
  buildPersonalManualPeerComparison,
  type PersonalManualPeerComparisonCompanyInput,
} from "@research-cockpit/personal-market-analytics";
import type { FormEvent } from "react";

import type { PersonalWorkspaceApiErrorCode } from "@/lib/personal-workspace-api";

export const PERSONAL_MANUAL_PEER_COMPARISON_MAXIMUM_PEERS = 3 as const;

export type PersonalManualPeerSelection =
  PersonalManualPeerComparisonCompanyInput["selection"];

export interface PersonalManualPeerState {
  readonly annualErrorCode: PersonalWorkspaceApiErrorCode | null;
  readonly annualFinancials: PersonalAnnualFinancialsDto | null;
  readonly requestState: "idle" | "loading";
  readonly selection: PersonalManualPeerSelection;
  readonly valuationErrorCode: PersonalWorkspaceApiErrorCode | null;
  readonly valuationHistory: PersonalValuationHistoryDto | null;
}

export interface PersonalManualPeerComparisonProps {
  readonly annualFinancials: PersonalAnnualFinancialsDto | null;
  readonly candidates: readonly PersonalManualPeerSelection[];
  readonly onAddPeer: (selection: PersonalManualPeerSelection) => void;
  readonly onLoadPeerData: (listingId: string) => void;
  readonly onRemovePeer: (listingId: string) => void;
  readonly peers: readonly PersonalManualPeerState[];
  readonly providerStatus: PersonalMarketDataStatusDto | null;
  readonly range: PersonalMarketDataRangeDto;
  readonly selection: PersonalManualPeerSelection | null;
  readonly valuationHistory: PersonalValuationHistoryDto | null;
}

type ComparisonResult = ReturnType<typeof buildPersonalManualPeerComparison>;
type ReadyComparison = Extract<ComparisonResult, { status: "ready" }>;
type ComparisonViewResult =
  ComparisonResult | Readonly<{ status: "quarantined" }>;
type ComparisonCompany = ReadyComparison["companies"][number];
type ComparisonRow = ReadyComparison["rows"][number];
type ComparisonCell = ComparisonRow["cells"][number];

const metricGroups = [
  {
    label: "Scale",
    metricIds: ["revenue", "market_capitalization", "enterprise_value"],
  },
  {
    label: "Growth & profitability",
    metricIds: [
      "revenue_growth",
      "gross_margin",
      "operating_margin",
      "net_margin",
      "free_cash_flow_margin",
    ],
  },
  {
    label: "Balance sheet & efficiency",
    metricIds: [
      "net_debt",
      "debt_to_assets",
      "current_ratio",
      "revenue_to_ending_assets",
    ],
  },
  {
    label: "Market valuation",
    metricIds: ["price_to_earnings", "price_to_book", "trailing_peg_1y"],
  },
] as const;

export function PersonalManualPeerComparison({
  annualFinancials,
  candidates,
  onAddPeer,
  onLoadPeerData,
  onRemovePeer,
  peers,
  providerStatus,
  range,
  selection,
  valuationHistory,
}: PersonalManualPeerComparisonProps) {
  const eligibleCandidates = peerCandidates(candidates, selection, peers);
  const atPeerLimit =
    peers.length >= PERSONAL_MANUAL_PEER_COMPARISON_MAXIMUM_PEERS;
  const primarySourceReady =
    selection !== null &&
    (annualFinancials !== null ||
      (valuationHistory !== null && valuationHistory.history.range === range));
  const peerLoadInProgress = peers.some(
    (peer) => peer.requestState === "loading",
  );
  const result =
    selection === null
      ? null
      : safelyBuildComparison({
          peers: peers.map((peer) => ({
            annualFinancials: peer.annualFinancials,
            selection: peer.selection,
            valuationHistory: peer.valuationHistory,
          })),
          primary: {
            annualFinancials,
            selection,
            valuationHistory,
          },
        });

  function addPeer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (atPeerLimit) return;
    const field = event.currentTarget.elements.namedItem(
      "manual-peer-candidate",
    );
    if (!(field instanceof HTMLSelectElement)) return;
    const candidate = eligibleCandidates.find(
      ({ listingId }) => listingId === field.value,
    );
    if (candidate === undefined) return;
    onAddPeer(candidate);
    event.currentTarget.reset();
  }

  return (
    <section
      aria-describedby="personal-manual-peer-intro personal-manual-peer-caveat"
      aria-labelledby="personal-manual-peer-title"
      className="personal-financials-panel personal-manual-peer-comparison"
    >
      <div className="discovery-section-heading personal-financials-heading manual-peer-heading">
        <div>
          <p className="eyebrow">Owner-selected company comparison</p>
          <h2 id="personal-manual-peer-title">Manual peer comparison</h2>
        </div>
        <span aria-live="polite" className="personal-quality-scorecard-summary">
          {selection === null ? "Choose a company" : "1 selected"} ·{" "}
          {peers.length} / {PERSONAL_MANUAL_PEER_COMPARISON_MAXIMUM_PEERS} peers
        </span>
      </div>

      <p
        className="market-scope-note manual-peer-intro"
        id="personal-manual-peer-intro"
      >
        Choose up to three companies yourself, then explicitly load each
        peer&apos;s annual and valuation data. The fixed comparison keeps exact
        fiscal, statement-date, valuation-date, and source-response coordinates
        visible; it never chooses or ranks peers for you.
      </p>

      {selection === null ? (
        <ReadinessState
          detail="Use “View market” in search results or My Watchlist. No company or peer is selected automatically."
          title="Choose the company you want to compare."
        />
      ) : (
        <>
          <PrimaryReadiness
            annualFinancials={annualFinancials}
            range={range}
            selection={selection}
            valuationHistory={valuationHistory}
          />

          <form
            aria-label="Add a company to the manual peer sample"
            className="manual-peer-picker"
            onSubmit={addPeer}
          >
            <label htmlFor="manual-peer-candidate">
              Peer from current search or My Watchlist
            </label>
            <div>
              <select
                defaultValue=""
                disabled={atPeerLimit || eligibleCandidates.length === 0}
                id="manual-peer-candidate"
                name="manual-peer-candidate"
              >
                <option value="">
                  {atPeerLimit
                    ? "Three-peer limit reached"
                    : eligibleCandidates.length === 0
                      ? "Search for or save another company first"
                      : "Choose an exact admitted listing"}
                </option>
                {eligibleCandidates.map((candidate) => (
                  <option key={candidate.listingId} value={candidate.listingId}>
                    {candidate.symbol} — {candidate.issuerName} ·{" "}
                    {candidate.exchangeMic}
                  </option>
                ))}
              </select>
              <button
                className="secondary-action compact-action"
                disabled={atPeerLimit || eligibleCandidates.length === 0}
                type="submit"
              >
                Add peer
              </button>
            </div>
            <small>
              Adding a peer is network-free. Data loads only from that
              peer&apos;s separate button below.
            </small>
          </form>

          <PeerRoster
            onLoadPeerData={onLoadPeerData}
            onRemovePeer={onRemovePeer}
            peers={peers}
            peerLoadInProgress={peerLoadInProgress}
            primarySourceReady={primarySourceReady}
            providerStatus={providerStatus}
            range={range}
          />

          {peers.length === 0 ? (
            <ReadinessState
              detail="Search for another admitted listing or use a current My Watchlist entry, add it above, and then load its comparison data."
              title={`Add the first peer for ${selection.symbol}.`}
            />
          ) : result?.status === "ready" &&
            (result.anchors.annualFiscalYear !== null ||
              result.anchors.valuationDate !== null) ? (
            <ComparisonTable result={result} />
          ) : result?.status === "ready" ? (
            <ReadinessState
              detail="Load annual statements, valuation history, or both for the selected company. At least one valid source is required before peer data can load."
              title={`Load a comparison source for ${selection.symbol}.`}
            />
          ) : result === null ? null : (
            <QuarantinedComparison />
          )}
        </>
      )}

      <p
        className="fcff-dcf-caveat manual-peer-caveat"
        id="personal-manual-peer-caveat"
        role="note"
      >
        This is a manually selected sample of {peers.length} peer
        {peers.length === 1 ? "" : "s"}. It is not a sector benchmark,
        representative average, ranking, percentile, health grade, price target,
        or buy/sell signal. Provider-most-recent values can reflect different
        statement dates, which remain visible. The calculation makes no
        additional request. Each explicit peer load requests the two disclosed
        read-only sources. Inputs and results stay in active-session memory;
        nothing is persisted or exported.
      </p>
    </section>
  );
}

function safelyBuildComparison(
  input: Parameters<typeof buildPersonalManualPeerComparison>[0],
): ComparisonViewResult {
  try {
    return buildPersonalManualPeerComparison(input);
  } catch {
    return Object.freeze({ status: "quarantined" });
  }
}

function PrimaryReadiness({
  annualFinancials,
  range,
  selection,
  valuationHistory,
}: Pick<
  PersonalManualPeerComparisonProps,
  "annualFinancials" | "range" | "selection" | "valuationHistory"
> & { readonly selection: PersonalManualPeerSelection }) {
  const valuationRangeMatches = valuationHistory?.history.range === range;
  return (
    <dl
      aria-label={`${selection.symbol} primary comparison source readiness`}
      className="fcff-dcf-readiness manual-peer-primary-readiness"
    >
      <div data-state="loaded">
        <dt>Selected company</dt>
        <dd>
          {selection.symbol} · {selection.issuerName} · {selection.exchangeMic}
        </dd>
      </div>
      <div data-state={annualFinancials === null ? "missing" : "loaded"}>
        <dt>Annual statements</dt>
        <dd>
          {annualFinancials === null ? "Not loaded" : "Loaded for validation"}
          {annualFinancials === null ? (
            <>
              {" · "}
              <a href="#personal-annual-financials-title">
                Review source panel
              </a>
            </>
          ) : null}
        </dd>
      </div>
      <div data-state={valuationRangeMatches ? "loaded" : "missing"}>
        <dt>{rangeLabel(range)} valuation history</dt>
        <dd>
          {valuationHistory === null
            ? "Not loaded"
            : valuationRangeMatches
              ? "Loaded for validation"
              : `Loaded for ${rangeLabel(valuationHistory.history.range)}; reload ${rangeLabel(range)}`}
          {!valuationRangeMatches ? (
            <>
              {" · "}
              <a href="#personal-valuation-history-title">
                Review source panel
              </a>
            </>
          ) : null}
        </dd>
      </div>
    </dl>
  );
}

function PeerRoster({
  onLoadPeerData,
  onRemovePeer,
  peers,
  peerLoadInProgress,
  primarySourceReady,
  providerStatus,
  range,
}: Pick<
  PersonalManualPeerComparisonProps,
  "onLoadPeerData" | "onRemovePeer" | "peers" | "providerStatus" | "range"
> & {
  readonly peerLoadInProgress: boolean;
  readonly primarySourceReady: boolean;
}) {
  if (peers.length === 0) return null;
  const configured = providerStatus?.status === "configured";
  return (
    <ol aria-label="Manual peer sample" className="manual-peer-roster">
      {peers.map((peer, index) => {
        const hasError =
          peer.annualErrorCode !== null || peer.valuationErrorCode !== null;
        const hasLoadedSource =
          peer.annualFinancials !== null || peer.valuationHistory !== null;
        return (
          <li
            aria-busy={peer.requestState === "loading"}
            className="manual-peer-card"
            key={peer.selection.listingId}
          >
            <div className="manual-peer-card-heading">
              <div>
                <span>Manual peer {index + 1}</span>
                <strong>{peer.selection.symbol}</strong>
                <small>
                  {peer.selection.issuerName} · {peer.selection.exchangeMic}
                </small>
              </div>
              <button
                aria-label={`Remove ${peer.selection.symbol} from manual peers`}
                className="text-button"
                onClick={() => onRemovePeer(peer.selection.listingId)}
                type="button"
              >
                Remove peer
              </button>
            </div>

            <dl
              aria-label={`${peer.selection.symbol} comparison source status`}
            >
              <PeerSourceStatus
                errorCode={peer.annualErrorCode}
                label="Annual statements"
                loaded={peer.annualFinancials !== null}
              />
              <PeerSourceStatus
                errorCode={peer.valuationErrorCode}
                label={`${rangeLabel(range)} valuation`}
                loaded={peer.valuationHistory !== null}
              />
            </dl>

            <p aria-live="polite" className="discovery-status">
              {peer.requestState === "loading"
                ? `Loading annual and ${rangeLabel(range)} valuation data for ${peer.selection.symbol}…`
                : hasError
                  ? `${peer.selection.symbol} has a partial or failed comparison load. Available domains remain visible; unavailable cells are not estimated.`
                  : hasLoadedSource
                    ? `Comparison data loaded for ${peer.selection.symbol}.`
                    : !primarySourceReady
                      ? "Load at least one selected-company source—annual statements or valuation history—before loading peers."
                      : peerLoadInProgress
                        ? "Another peer is loading. Its two provider reads must finish before this peer can load."
                        : configured
                          ? `No comparison-data request has been made for ${peer.selection.symbol}.`
                          : providerStatus?.status === "not_configured"
                            ? "Configure the owner-local Tiingo credential before loading this peer."
                            : "Provider status is unavailable. Revalidate the owner session before loading this peer."}
            </p>

            <button
              aria-label={`${loadButtonLabel(peer)} for ${peer.selection.symbol}`}
              className="primary-action compact-action"
              disabled={
                !configured || !primarySourceReady || peerLoadInProgress
              }
              onClick={() => onLoadPeerData(peer.selection.listingId)}
              type="button"
            >
              {loadButtonLabel(peer)}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function PeerSourceStatus({
  errorCode,
  label,
  loaded,
}: {
  readonly errorCode: PersonalWorkspaceApiErrorCode | null;
  readonly label: string;
  readonly loaded: boolean;
}) {
  return (
    <div
      data-state={loaded ? "loaded" : errorCode === null ? "missing" : "error"}
    >
      <dt>{label}</dt>
      <dd>
        {loaded
          ? "Loaded"
          : errorCode === null
            ? "Not loaded"
            : errorLabel(errorCode)}
      </dd>
    </div>
  );
}

function ComparisonTable({ result }: { readonly result: ReadyComparison }) {
  const rowsByMetric = new Map(result.rows.map((row) => [row.metricId, row]));
  const fullyComparable =
    result.anchors.annualFiscalYear !== null &&
    result.anchors.valuationDate !== null &&
    result.companies.every(
      (company) =>
        company.annual.status === "ready" &&
        company.annual.coordinate !== null &&
        company.valuation.status === "ready" &&
        company.valuation.coordinate !== null,
    );
  const hasComparablePeerCell = result.rows.some(
    (row) =>
      row.cells[0]?.status === "available" &&
      row.cells.slice(1).some((cell) => cell.status === "available"),
  );
  return (
    <div className="manual-peer-result">
      <p className="financials-ttm-gate manual-peer-ready-note" role="status">
        <strong>
          {fullyComparable && hasComparablePeerCell
            ? "Side-by-side comparison ready"
            : hasComparablePeerCell
              ? "Partial side-by-side comparison available"
              : "Comparison table prepared"}{" "}
          for {result.companies.length} companies.
        </strong>
        <span>
          Formula set {result.formulaSetVersion} · annual anchor{" "}
          {result.anchors.annualFiscalYear === null
            ? "unavailable"
            : `FY ${result.anchors.annualFiscalYear}`}{" "}
          · valuation anchor {result.anchors.valuationDate ?? "unavailable"}
        </span>
      </p>
      <div
        aria-label="Manual peer financial and valuation comparison table"
        className="financial-table-scroll manual-peer-table-scroll"
        role="region"
        tabIndex={0}
      >
        <table className="manual-peer-table">
          <caption>
            Selected company and {result.companies.length - 1} manually selected{" "}
            peer{result.companies.length === 2 ? "" : "s"} · 15 fixed metrics
          </caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              {result.companies.map((company) => (
                <CompanyHeading
                  company={company}
                  key={company.selection.listingId}
                />
              ))}
            </tr>
          </thead>
          {metricGroups.map((group) => (
            <tbody key={group.label}>
              <tr className="manual-peer-group-row">
                <th colSpan={result.companies.length + 1} scope="rowgroup">
                  {group.label}
                </th>
              </tr>
              {group.metricIds.map((metricId) => {
                const row = rowsByMetric.get(metricId);
                return row === undefined ? null : (
                  <MetricRow key={metricId} row={row} result={result} />
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

function CompanyHeading({ company }: { readonly company: ComparisonCompany }) {
  return (
    <th
      className={
        company.role === "primary" ? "manual-peer-primary-column" : undefined
      }
      scope="col"
    >
      <span>{company.selection.symbol}</span>
      <small>
        {company.role === "primary" ? "Selected company" : "Manual peer"}
      </small>
      <small>{annualProvenance(company)}</small>
      <small>{valuationProvenance(company)}</small>
    </th>
  );
}

function MetricRow({
  result,
  row,
}: {
  readonly result: ReadyComparison;
  readonly row: ComparisonRow;
}) {
  return (
    <tr>
      <th scope="row">
        <span>{row.label}</span>
        <small>
          {row.formulaId} · formula {row.formulaVersion}
        </small>
      </th>
      {row.cells.map((cell, index) => (
        <MetricCell
          cell={cell}
          key={cell.listingId}
          primary={result.companies[index]?.role === "primary"}
          row={row}
        />
      ))}
    </tr>
  );
}

function MetricCell({
  cell,
  primary,
  row,
}: {
  readonly cell: ComparisonCell;
  readonly primary: boolean;
  readonly row: ComparisonRow;
}) {
  return (
    <td className={primary ? "manual-peer-primary-column" : undefined}>
      {cell.status === "available" ? (
        <span title={`${cell.value} ${row.unit}`}>
          {formatMetricValue(cell.value, row.unit)}
        </span>
      ) : (
        <span className="financial-cell-unknown">
          Unknown
          <small>{unavailableReason(cell.reason)}</small>
        </span>
      )}
    </td>
  );
}

function QuarantinedComparison() {
  return (
    <div className="market-message market-message-error" role="alert">
      <strong>Manual peer comparison was withheld.</strong>
      <span>
        The selected company or peer-set envelope failed validation. No derived
        metric or source coordinate is shown.
      </span>
    </div>
  );
}

function ReadinessState({
  detail,
  title,
}: {
  readonly detail: string;
  readonly title: string;
}) {
  return (
    <div className="discovery-empty-state market-empty-state manual-peer-readiness">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function peerCandidates(
  candidates: readonly PersonalManualPeerSelection[],
  selection: PersonalManualPeerSelection | null,
  peers: readonly PersonalManualPeerState[],
): readonly PersonalManualPeerSelection[] {
  const excludedListings = new Set(
    peers.map((peer) => peer.selection.listingId),
  );
  const excludedIssuers = new Set(peers.map((peer) => peer.selection.issuerId));
  if (selection !== null) {
    excludedListings.add(selection.listingId);
    excludedIssuers.add(selection.issuerId);
  }
  const seenListings = new Set<string>();
  const seenIssuers = new Set<string>();
  return candidates.filter((candidate) => {
    if (
      excludedListings.has(candidate.listingId) ||
      excludedIssuers.has(candidate.issuerId) ||
      seenListings.has(candidate.listingId) ||
      seenIssuers.has(candidate.issuerId)
    ) {
      return false;
    }
    seenListings.add(candidate.listingId);
    seenIssuers.add(candidate.issuerId);
    return true;
  });
}

function loadButtonLabel(peer: PersonalManualPeerState): string {
  if (peer.requestState === "loading") return "Loading comparison data…";
  if (peer.annualErrorCode !== null || peer.valuationErrorCode !== null) {
    return "Retry comparison data";
  }
  if (peer.annualFinancials !== null || peer.valuationHistory !== null) {
    return "Refresh comparison data";
  }
  return "Load comparison data";
}

function errorLabel(code: PersonalWorkspaceApiErrorCode): string {
  switch (code) {
    case "not_entitled":
      return "Not included for this account";
    case "not_covered":
      return "Not covered for this listing";
    case "credentials_invalid":
      return "Provider credential rejected";
    case "rate_limited":
      return "Provider rate limit reached";
    case "not_configured":
      return "Provider not configured";
    case "provider_unavailable":
      return "Provider unavailable";
    case "invalid_response":
      return "Provider response rejected";
    case "session_unavailable":
      return "Owner session unavailable";
    default:
      return "Request unavailable";
  }
}

function annualProvenance(company: ComparisonCompany): string {
  if (company.annual.status === "not_loaded") return "Annual: not loaded";
  if (company.annual.status === "quarantined") {
    return `Annual: withheld (${company.annual.issues.map(({ reason }) => reason).join(", ")})`;
  }
  return company.annual.coordinate === null ||
    company.annual.coordinate.kind !== "annual"
    ? `Annual: anchor unavailable · asOf ${company.annual.asOf}`
    : `Annual: FY ${company.annual.coordinate.fiscalYear} · statement ${company.annual.coordinate.statementDate} · asOf ${company.annual.asOf}`;
}

function valuationProvenance(company: ComparisonCompany): string {
  if (company.valuation.status === "not_loaded") {
    return "Valuation: not loaded";
  }
  if (company.valuation.status === "quarantined") {
    return `Valuation: withheld (${company.valuation.issues.map(({ reason }) => reason).join(", ")})`;
  }
  return company.valuation.coordinate === null ||
    company.valuation.coordinate.kind !== "valuation"
    ? `Valuation: anchor unavailable · asOf ${company.valuation.asOf}`
    : `Valuation: ${company.valuation.coordinate.date} · asOf ${company.valuation.asOf}`;
}

function unavailableReason(reason: string): string {
  return reason
    .split("_")
    .map((word, index) =>
      index === 0 ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word,
    )
    .join(" ");
}

function formatMetricValue(value: string, unit: ComparisonRow["unit"]): string {
  if (unit === "USD") return `USD ${groupDecimal(value)}`;
  if (unit === "percent") return `${value}%`;
  return `${value}×`;
}

function groupDecimal(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${negative ? "-" : ""}${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
}

function rangeLabel(range: PersonalMarketDataRangeDto): string {
  return range.toUpperCase();
}
