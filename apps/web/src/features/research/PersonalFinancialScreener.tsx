"use client";

import {
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_FINANCIAL_REVENUE_BASES,
  type PersonalFinancialRevenueBasisDto,
  type PersonalFinancialScreenCellDto,
  type PersonalFinancialScreenClauseDto,
  type PersonalFinancialScreenCriteriaDto,
  type PersonalFinancialScreenMetricDto,
  type PersonalFinancialScreenResponseDto,
  type PersonalFinancialSavedViewsPayloadDto,
  type PersonalSecurityMasterScreenRowDto,
  type PersonalSecurityMasterSnapshotReceiptDto,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";

import {
  fetchPersonalFinancialSavedViews,
  isPersonalFinancialScreenCriteria,
  personalFinancialSourceUrl,
  savePersonalFinancialSavedViews,
  screenPersonalFinancials,
} from "@/lib/personal-financial-screen-api";
import {
  normalizePersonalScreenerSavedViewName,
  PersonalWorkspaceApiError,
} from "@/lib/personal-workspace-api";

export const PERSONAL_FINANCIAL_SCREENER_PAGE_SIZE = 25;
const metrics = PERSONAL_FINANCIAL_SCREEN_METRICS;
const revenueBasisLabels: Readonly<
  Record<PersonalFinancialRevenueBasisDto, string>
> = {
  agreement: "Require agreement",
  Revenues: "Revenues (broad concept)",
  RevenueFromContractWithCustomerExcludingAssessedTax:
    "Customer-contract revenue, excluding tax",
  SalesRevenueNet: "Net sales and services (legacy)",
};
const labels: Readonly<Record<PersonalFinancialScreenMetricDto, string>> = {
  revenue: "Revenue",
  grossProfit: "Gross profit",
  netIncome: "Net income",
  operatingIncome: "Operating income",
  operatingCashFlow: "Operating cash flow",
  netMargin: "Net margin",
  operatingMargin: "Operating margin",
  operatingCashFlowMargin: "Operating cash flow margin",
};
const formulas: Readonly<Record<PersonalFinancialScreenMetricDto, string>> = {
  revenue:
    "Reported revenue. Available revenue concepts must agree on value and reporting period.",
  grossProfit:
    "Reported GrossProfit in USD, independent of the revenue basis. Missing or unresolved reported amounts stay unknown.",
  netIncome: "Reported net income (loss).",
  operatingIncome: "Reported operating income (loss).",
  operatingCashFlow:
    "Reported net cash provided by (used in) operating activities.",
  netMargin:
    "Net income / revenue × 100. Requires positive revenue and identical source periods.",
  operatingMargin:
    "Operating income / revenue × 100. Requires positive revenue and identical source periods.",
  operatingCashFlowMargin:
    "Operating cash flow / revenue × 100. Requires positive revenue and identical source periods.",
};
function revenueExplanation(basis: PersonalFinancialRevenueBasisDto): string {
  return basis === "agreement"
    ? "All available revenue concepts must agree on value and reporting period. Different definitions can produce different amounts."
    : "Uses this one concept for every company and all three margin denominators, without substituting another revenue concept.";
}
function formulaFor(
  metric: PersonalFinancialScreenMetricDto,
  basis: PersonalFinancialRevenueBasisDto,
): string {
  return metric === "revenue" && basis !== "agreement"
    ? `Reported ${revenueBasisLabels[basis]}. Missing or unresolved selected facts stay unknown.`
    : formulas[metric];
}
const emptySaved: PersonalFinancialSavedViewsPayloadDto = {
  schemaVersion: 1,
  views: [],
};
function defaultCriteria(): PersonalFinancialScreenCriteriaDto {
  return {
    calendarYear: new Date().getUTCFullYear() - 1,
    identityText: "",
    clauses: [],
    sort: { field: "symbol", direction: "asc" },
  };
}

export interface PersonalFinancialScreenerProps {
  readonly snapshot: PersonalSecurityMasterSnapshotReceiptDto;
  readonly canAddToWatchlist: boolean;
  readonly onAddToWatchlist: (row: PersonalSecurityMasterScreenRowDto) => void;
  readonly onOpenResearch: (row: PersonalSecurityMasterScreenRowDto) => void;
  readonly onSessionUnavailable: () => void;
  readonly savedListingIds: ReadonlySet<string>;
  readonly disabled?: boolean;
  readonly workspaceReady?: boolean;
}

export function PersonalFinancialScreener({
  snapshot,
  canAddToWatchlist,
  onAddToWatchlist,
  onOpenResearch,
  onSessionUnavailable,
  savedListingIds,
  disabled = false,
  workspaceReady = true,
}: PersonalFinancialScreenerProps) {
  const [criteria, setCriteria] =
    useState<PersonalFinancialScreenCriteriaDto>(defaultCriteria());
  const [response, setResponse] =
    useState<PersonalFinancialScreenResponseDto | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(
    "Choose annual financial criteria, then run the screen.",
  );
  const [savedPayload, setSavedPayload] =
    useState<PersonalFinancialSavedViewsPayloadDto>(emptySaved);
  const [savedVersion, setSavedVersion] = useState(0);
  const [savedBusy, setSavedBusy] = useState(false);
  const [savedAvailable, setSavedAvailable] = useState(false);
  const [savedMessage, setSavedMessage] = useState(
    "Loading saved financial screens…",
  );
  const [selectedId, setSelectedId] = useState("");
  const [savedName, setSavedName] = useState("");
  const epoch = useRef(0);
  const screenEpoch = useRef(0);
  const screenController = useRef<AbortController | null>(null);
  const savedController = useRef<AbortController | null>(null);
  const sessionCallback = useRef(onSessionUnavailable);
  sessionCallback.current = onSessionUnavailable;
  const enabled = !disabled && workspaceReady;

  useEffect(() => {
    epoch.current += 1;
    screenEpoch.current += 1;
    screenController.current?.abort();
    savedController.current?.abort();
    setCriteria(defaultCriteria());
    setResponse(null);
    setRunning(false);
    setSavedPayload(emptySaved);
    setSavedVersion(0);
    setSavedAvailable(false);
    setSelectedId("");
    setSavedName("");
    setMessage("Choose annual financial criteria, then run the screen.");
    if (enabled) void reloadSaved();
    else {
      setSavedBusy(false);
      setSavedMessage(
        "Validate the owner session to load saved financial screens.",
      );
    }
    return () => {
      epoch.current += 1;
      screenEpoch.current += 1;
      screenController.current?.abort();
      savedController.current?.abort();
    };
    // The snapshot/session boundary owns all in-memory results and pending operations.
  }, [snapshot.snapshotSha256, enabled]);

  function clearSession() {
    epoch.current += 1;
    screenEpoch.current += 1;
    screenController.current?.abort();
    savedController.current?.abort();
    setResponse(null);
    setCriteria(defaultCriteria());
    setSavedPayload(emptySaved);
    setSavedAvailable(false);
    setSavedVersion(0);
    setSelectedId("");
    setSavedName("");
    setRunning(false);
    setSavedBusy(false);
    setMessage(
      "The owner session expired. Revalidate it to run another screen.",
    );
    setSavedMessage("Saved financial screens were cleared from this session.");
    sessionCallback.current();
  }

  function changeCriteria(next: PersonalFinancialScreenCriteriaDto) {
    screenEpoch.current += 1;
    screenController.current?.abort();
    screenController.current = null;
    setRunning(false);
    setResponse(null);
    setCriteria(next);
    setMessage("Criteria changed. Run screen to load matching annual data.");
  }

  function changeClause(
    index: number,
    update: Partial<PersonalFinancialScreenClauseDto>,
  ) {
    changeCriteria({
      ...criteria,
      clauses: criteria.clauses.map((clause, position) =>
        position === index ? { ...clause, ...update } : clause,
      ),
    });
  }

  async function runScreen(offset = 0, refresh = false, paginate = false) {
    if (!enabled) return;
    const normalized = {
      ...criteria,
      identityText: criteria.identityText.trim().normalize("NFC"),
    };
    if (!isPersonalFinancialScreenCriteria(normalized)) {
      setMessage(
        "Use a completed calendar year since 2009, up to seven filters, and plain decimal thresholds (USD or percentage points). Blank thresholds are invalid.",
      );
      return;
    }
    if (paginate && response === null) return;
    screenController.current?.abort();
    const controller = new AbortController();
    screenController.current = controller;
    const operation = ++screenEpoch.current;
    const session = epoch.current;
    const financialSnapshotSha256 =
      paginate && !refresh ? (response?.financialSnapshotSha256 ?? null) : null;
    setResponse(null);
    setRunning(true);
    setMessage(
      refresh
        ? "Refreshing SEC annual data…"
        : "Screening SEC annual financials…",
    );
    try {
      const result = await screenPersonalFinancials(
        {
          schemaVersion: "2.0.0",
          catalogSnapshotSha256: snapshot.snapshotSha256,
          financialSnapshotSha256,
          criteria: normalized,
          page: { offset, limit: PERSONAL_FINANCIAL_SCREENER_PAGE_SIZE },
          refresh,
        },
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        session !== epoch.current ||
        operation !== screenEpoch.current
      )
        return;
      setCriteria(normalized);
      setResponse(result);
      setMessage(
        result.totalMatches === 0
          ? "No listings satisfy every selected criterion. Review unknown coverage or broaden the filters."
          : `${String(result.totalMatches)} listings satisfy every selected criterion.`,
      );
    } catch (error) {
      if (
        controller.signal.aborted ||
        session !== epoch.current ||
        operation !== screenEpoch.current
      )
        return;
      if (isSessionError(error)) {
        clearSession();
        return;
      }
      setResponse(null);
      setMessage(screenErrorMessage(error));
    } finally {
      if (session === epoch.current && operation === screenEpoch.current) {
        screenController.current = null;
        setRunning(false);
      }
    }
  }

  async function reloadSaved() {
    if (!enabled) return;
    savedController.current?.abort();
    const controller = new AbortController();
    savedController.current = controller;
    const session = epoch.current;
    setSavedBusy(true);
    setSavedAvailable(false);
    try {
      const record = await fetchPersonalFinancialSavedViews(controller.signal);
      if (controller.signal.aborted || session !== epoch.current) return;
      setSavedPayload(record?.payload ?? emptySaved);
      setSavedVersion(record?.version ?? 0);
      setSavedAvailable(true);
      setSavedMessage(
        `${String(record?.payload.views.length ?? 0)} saved financial screens. Save criteria after running a screen.`,
      );
    } catch (error) {
      if (controller.signal.aborted || session !== epoch.current) return;
      if (isSessionError(error)) {
        clearSession();
        return;
      }
      setSavedPayload(emptySaved);
      setSavedVersion(0);
      setSavedMessage(
        "Saved financial screens are unavailable. Reload them to save changes.",
      );
    } finally {
      if (session === epoch.current && !controller.signal.aborted) {
        savedController.current = null;
        setSavedBusy(false);
      }
    }
  }

  function loadSaved() {
    const view = savedPayload.views.find((item) => item.id === selectedId);
    if (view === undefined) return;
    changeCriteria(structuredClone(view.criteria));
    setSavedName(view.name);
    setMessage(
      "Saved criteria loaded. Run screen against the current catalog and SEC data.",
    );
  }

  async function mutateSaved(action: "save" | "saveAs" | "delete") {
    if (!enabled || !savedAvailable || savedBusy) return;
    const selected = savedPayload.views.find((view) => view.id === selectedId);
    let next: PersonalFinancialSavedViewsPayloadDto;
    let nextId: string;
    if (action === "delete") {
      if (selected === undefined) return;
      next = {
        schemaVersion: 1,
        views: savedPayload.views.filter((view) => view.id !== selected.id),
      };
      nextId = "";
    } else {
      if (response === null || running) return;
      const name = normalizePersonalScreenerSavedViewName(savedName);
      if (name === null) {
        setSavedMessage("Give the financial screen a name of 1–80 characters.");
        return;
      }
      const replacing = action === "save" && selected !== undefined;
      if (
        (!replacing && savedPayload.views.length >= 20) ||
        savedPayload.views.some(
          (view) =>
            view.name.toLocaleLowerCase("en-US") ===
              name.toLocaleLowerCase("en-US") &&
            (!replacing || view.id !== selected.id),
        )
      ) {
        setSavedMessage(
          "Use a unique screen name. Up to 20 financial screens can be saved.",
        );
        return;
      }
      try {
        nextId = replacing
          ? selected.id
          : `financial-screen-${globalThis.crypto.randomUUID()}`;
      } catch {
        setSavedMessage("The saved-screen change could not be prepared.");
        return;
      }
      const view = {
        id: nextId,
        name,
        criteria: structuredClone(criteria),
        createdAgainstCatalogSnapshotSha256: response.catalogSnapshotSha256,
        createdAgainstFinancialSnapshotSha256: response.financialSnapshotSha256,
      };
      next = {
        schemaVersion: 1,
        views: replacing
          ? savedPayload.views.map((item) =>
              item.id === selected.id ? view : item,
            )
          : [...savedPayload.views, view],
      };
    }
    savedController.current?.abort();
    const controller = new AbortController();
    savedController.current = controller;
    const session = epoch.current;
    setSavedBusy(true);
    try {
      const saved = await savePersonalFinancialSavedViews(
        savedVersion,
        next,
        controller.signal,
      );
      if (controller.signal.aborted || session !== epoch.current) return;
      setSavedPayload(saved.payload);
      setSavedVersion(saved.version);
      setSelectedId(nextId);
      if (action === "delete") setSavedName("");
      setSavedMessage(
        action === "delete"
          ? "Financial screen deleted."
          : "Financial screen criteria saved. Result rows are not stored in saved views.",
      );
    } catch (error) {
      if (controller.signal.aborted || session !== epoch.current) return;
      if (isSessionError(error)) {
        clearSession();
        return;
      }
      if (
        error instanceof PersonalWorkspaceApiError &&
        error.code === "conflict"
      ) {
        setSavedAvailable(false);
        setSelectedId("");
        setSavedMessage(
          "Saved financial screens changed elsewhere. Reload saved screens, review the latest definitions, then save again.",
        );
      } else
        setSavedMessage(
          "The financial screen could not be saved. Reload saved screens before retrying.",
        );
    } finally {
      if (session === epoch.current && !controller.signal.aborted) {
        savedController.current = null;
        setSavedBusy(false);
      }
    }
  }

  const selected = savedPayload.views.find((view) => view.id === selectedId);
  return (
    <section
      className="security-search-panel personal-financial-screener"
      aria-labelledby="personal-financial-screener-title"
      aria-busy={running || savedBusy}
    >
      <div className="discovery-section-heading">
        <div>
          <p className="eyebrow">SEC annual financials</p>
          <h2 id="personal-financial-screener-title">
            Annual financial screen
          </h2>
        </div>
        <span>Annual · USD and margins</span>
      </div>
      <p className="market-scope-note">
        Compare calendar-aligned annual SEC facts across the current local
        catalog. Actual company reporting periods can differ; inspect each value
        before comparing companies. All numeric filters must pass. Missing or
        conflicting facts stay unknown.
      </p>
      <form
        className="personal-stock-screener-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runScreen();
        }}
      >
        <fieldset disabled={!enabled} className="financial-screen-controls">
          <legend>Financial screen criteria</legend>
          <div className="personal-stock-screener-filters">
            <label>
              <span>Calendar year</span>
              <input
                aria-label="Financial calendar year"
                type="number"
                min={2009}
                max={new Date().getUTCFullYear() - 1}
                step={1}
                value={criteria.calendarYear}
                onChange={(event) =>
                  changeCriteria({
                    ...criteria,
                    calendarYear: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              <span>Symbol or company</span>
              <input
                aria-label="Financial company filter"
                maxLength={120}
                value={criteria.identityText}
                onChange={(event) =>
                  changeCriteria({
                    ...criteria,
                    identityText: event.target.value,
                  })
                }
                placeholder="All listed companies"
              />
            </label>
            <label>
              <span>Revenue basis</span>
              <select
                aria-label="Revenue basis"
                aria-describedby="financial-revenue-basis-help"
                value={criteria.revenueBasis ?? "agreement"}
                onChange={(event) =>
                  changeCriteria({
                    ...criteria,
                    revenueBasis: event.target
                      .value as PersonalFinancialRevenueBasisDto,
                  })
                }
              >
                {PERSONAL_FINANCIAL_REVENUE_BASES.map((basis) => (
                  <option key={basis} value={basis}>
                    {revenueBasisLabels[basis]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort financial results by</span>
              <select
                aria-label="Financial sort field"
                value={criteria.sort.field}
                onChange={(event) =>
                  changeCriteria({
                    ...criteria,
                    sort: {
                      ...criteria.sort,
                      field: event.target
                        .value as PersonalFinancialScreenCriteriaDto["sort"]["field"],
                    },
                  })
                }
              >
                <option value="symbol">Symbol</option>
                {metrics.map((metric) => (
                  <option value={metric} key={metric}>
                    {metric === "grossProfit"
                      ? "Gross profit (USD)"
                      : labels[metric]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Direction</span>
              <select
                aria-label="Financial sort direction"
                value={criteria.sort.direction}
                onChange={(event) =>
                  changeCriteria({
                    ...criteria,
                    sort: {
                      ...criteria.sort,
                      direction: event.target.value as "asc" | "desc",
                    },
                  })
                }
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
          </div>
          <p id="financial-revenue-basis-help" className="market-scope-note">
            {revenueExplanation(criteria.revenueBasis ?? "agreement")} Revenue
            definitions are not interchangeable. This choice applies to revenue
            and all three margins. Run the screen to apply it.
          </p>
          <div className="financial-screen-clauses">
            {criteria.clauses.map((clause, index) => (
              <div className="financial-screen-clause" key={index}>
                <label>
                  <span>Metric {index + 1}</span>
                  <select
                    aria-label={`Financial metric ${String(index + 1)}`}
                    value={clause.field}
                    onChange={(event) =>
                      changeClause(index, {
                        field: event.target
                          .value as PersonalFinancialScreenMetricDto,
                      })
                    }
                  >
                    {metrics.map((metric) => (
                      <option value={metric} key={metric}>
                        {metric === "grossProfit"
                          ? "Gross profit (USD)"
                          : labels[metric]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Comparison</span>
                  <select
                    aria-label={`Financial comparison ${String(index + 1)}`}
                    value={clause.operator}
                    onChange={(event) =>
                      changeClause(index, {
                        operator: event.target.value as "gte" | "lte",
                      })
                    }
                  >
                    <option value="gte">At least (≥)</option>
                    <option value="lte">At most (≤)</option>
                  </select>
                </label>
                <label>
                  <span>
                    Threshold ({clause.field.endsWith("Margin") ? "%" : "USD"})
                  </span>
                  <input
                    aria-label={`Financial threshold ${String(index + 1)}`}
                    inputMode="decimal"
                    maxLength={64}
                    value={clause.value}
                    onChange={(event) =>
                      changeClause(index, { value: event.target.value })
                    }
                    placeholder={
                      clause.field.endsWith("Margin")
                        ? "15 = 15%"
                        : "1000000000 = $1 billion"
                    }
                  />
                </label>
                <button
                  className="secondary-action compact-action"
                  type="button"
                  aria-label={`Remove financial filter ${String(index + 1)}`}
                  onClick={() =>
                    changeCriteria({
                      ...criteria,
                      clauses: criteria.clauses.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="personal-stock-screener-run-actions">
            <button
              className="secondary-action compact-action"
              type="button"
              disabled={criteria.clauses.length >= 7}
              onClick={() =>
                changeCriteria({
                  ...criteria,
                  clauses: [
                    ...criteria.clauses,
                    { field: "revenue", operator: "gte", value: "" },
                  ],
                })
              }
            >
              Add financial filter
            </button>
            <button
              className="primary-action compact-action"
              type="submit"
              disabled={running}
            >
              {running ? "Running financial screen…" : "Run financial screen"}
            </button>
            <button
              className="secondary-action compact-action"
              type="button"
              disabled={running}
              onClick={() => void runScreen(0, true)}
            >
              Refresh SEC data
            </button>
            <button
              className="secondary-action compact-action"
              type="button"
              onClick={() => changeCriteria(defaultCriteria())}
            >
              Reset financial criteria
            </button>
          </div>
        </fieldset>
      </form>
      <p className="discovery-status" aria-live="polite">
        {message}
      </p>
      {response === null ? (
        <div className="discovery-empty-state">
          <strong>
            {running
              ? "Loading annual financial results…"
              : "Run a financial screen to see results."}
          </strong>
          <span>
            Amounts use USD; a margin threshold of 15 means 15%. Negative
            profits and cash flows keep their reported sign.
          </span>
        </div>
      ) : (
        <FinancialResults
          response={response}
          running={running}
          canAddToWatchlist={canAddToWatchlist && enabled}
          onAddToWatchlist={onAddToWatchlist}
          onOpenResearch={onOpenResearch}
          savedListingIds={savedListingIds}
          onPage={(offset) => void runScreen(offset, false, true)}
        />
      )}
      <fieldset
        className="financial-screen-saved"
        disabled={!enabled || savedBusy}
      >
        <legend>Saved financial screens</legend>
        <p className="market-scope-note">
          Store up to 20 named criteria definitions. Loading one requires an
          explicit run against current data.
        </p>
        <div className="personal-stock-screener-filters">
          <label>
            <span>Choose a financial screen</span>
            <select
              aria-label="Saved financial screen"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="">New financial screen</option>
              {savedPayload.views.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Financial screen name</span>
            <input
              aria-label="Financial screen name"
              maxLength={80}
              value={savedName}
              onChange={(event) => setSavedName(event.target.value)}
            />
          </label>
        </div>
        <div className="personal-stock-screener-run-actions">
          <button
            className="secondary-action compact-action"
            type="button"
            disabled={!selected || !savedAvailable}
            onClick={loadSaved}
          >
            Load financial criteria
          </button>
          <button
            className="secondary-action compact-action"
            type="button"
            disabled={!savedAvailable || response === null || running}
            onClick={() => void mutateSaved("save")}
          >
            Save financial screen
          </button>
          <button
            className="secondary-action compact-action"
            type="button"
            disabled={
              !savedAvailable ||
              response === null ||
              running ||
              savedPayload.views.length >= 20
            }
            onClick={() => void mutateSaved("saveAs")}
          >
            Save financial screen as new
          </button>
          <button
            className="secondary-action compact-action"
            type="button"
            disabled={!selected || !savedAvailable}
            onClick={() => void mutateSaved("delete")}
          >
            Delete financial screen
          </button>
          <button
            className="secondary-action compact-action"
            type="button"
            onClick={() => void reloadSaved()}
          >
            Reload saved screens
          </button>
        </div>
        {selected &&
          selected.createdAgainstCatalogSnapshotSha256 !==
            snapshot.snapshotSha256 && (
            <p className="market-scope-note">
              This definition was created against an older catalog. Running it
              uses the current catalog.
            </p>
          )}
      </fieldset>
      <p className="discovery-status" aria-live="polite">
        {savedMessage}
      </p>
      <p className="fcff-dcf-caveat">
        SEC annual frames select facts aligned to a calendar year. These are
        historical reported annual values, with no prices, trailing-twelve-month
        estimates, growth forecasts, or historical universe reconstruction.
        Sources can be amended; the fetch time describes the current SEC
        snapshot. Result rows remain in this active session.
      </p>
    </section>
  );
}

function FinancialResults({
  response,
  running,
  canAddToWatchlist,
  onAddToWatchlist,
  onOpenResearch,
  savedListingIds,
  onPage,
}: Pick<
  PersonalFinancialScreenerProps,
  | "canAddToWatchlist"
  | "onAddToWatchlist"
  | "onOpenResearch"
  | "savedListingIds"
> & {
  readonly response: PersonalFinancialScreenResponseDto;
  readonly running: boolean;
  readonly onPage: (offset: number) => void;
}) {
  const revenueBasis = response.revenueBasis ?? "agreement";
  return (
    <div className="financial-screen-results">
      <p className="market-scope-note">
        <strong>Revenue basis: {revenueBasisLabels[revenueBasis]}.</strong>{" "}
        {revenueExplanation(revenueBasis)}
      </p>
      <dl className="financial-screen-counts">
        <div>
          <dt>Matches · all filters pass</dt>
          <dd>{response.totalMatches.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>Excluded · a filter fails</dt>
          <dd>{response.totalNonMatches.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>Unknown · unresolved criteria</dt>
          <dd>{response.totalUnknown.toLocaleString("en-US")}</dd>
        </div>
      </dl>
      <p className="market-scope-note">
        {response.identityMatches.toLocaleString("en-US")} identity matches of{" "}
        {response.totalUniverse.toLocaleString("en-US")} current listed
        identities. With no numeric filters, all identity matches pass. A known
        failing filter excludes a listing even if another fact is unknown.
      </p>
      <details className="financial-screen-source-details">
        <summary>Coverage, sources, and calculation details</summary>
        <p>
          Calendar-aligned year {response.calendarYear}. Fetched{" "}
          {response.fetchedAt}; cache expires {response.expiresAt}. Formula
          version {response.formulaVersion}. Coverage is measured across
          identity matches, before numeric filters.
        </p>
        <ul>
          {metrics.map((metric) => (
            <li key={metric}>
              {labels[metric]}:{" "}
              {response.metricCoverage[metric].known.toLocaleString("en-US")}{" "}
              known /{" "}
              {response.metricCoverage[metric].unknown.toLocaleString("en-US")}{" "}
              unknown. {formulaFor(metric, revenueBasis)}
            </li>
          ))}
        </ul>
        <ul>
          {response.sources.map((source) => (
            <li key={source.concept}>
              <a
                href={personalFinancialSourceUrl(
                  source.concept,
                  response.calendarYear,
                )}
                target="_blank"
                rel="noreferrer noopener"
              >
                SEC {source.concept}
              </a>
              : {source.status.replaceAll("_", " ")}
            </li>
          ))}
        </ul>
        <p>
          {revenueBasis === "agreement"
            ? "Revenue considers customer-contract revenue excluding tax, Revenues, and SalesRevenueNet. All available concepts must agree on value and period; a failed concept request leaves agreement unresolved."
            : `Revenue uses only ${revenueBasis}. Other concept statuses remain visible here; they do not replace missing or unresolved selected facts.`}{" "}
          Unresolved facts and mismatched periods do not become zero. Source
          signs are preserved; positive cash flow is provided by operations and
          negative cash flow is used in operations.
        </p>
        <p className="financial-screen-digests">
          Catalog: {response.catalogSnapshotSha256}
          <br />
          Financial data: {response.financialSnapshotSha256}
        </p>
      </details>
      {response.sources.some((source) => source.status !== "available") && (
        <p className="market-scope-note" role="status">
          {response.sources.every(
            (source) =>
              source.status !== "available" && source.status !== "not_covered",
          )
            ? "SEC source data is unavailable. All concept requests failed; inspect source statuses and try refreshing later."
            : "SEC source coverage is partial. Some concepts were unavailable; inspect source statuses and unknown counts before using these results."}
        </p>
      )}
      <div className="personal-stock-screener-table-wrap">
        <table className="personal-stock-screener-table financial-screen-table">
          <caption>
            Matching annual financials for calendar-aligned{" "}
            {response.calendarYear}. Expand a value to inspect its reporting
            period and sources.
          </caption>
          <thead>
            <tr>
              <th scope="col">Company</th>
              {metrics.map((metric) => (
                <th scope="col" key={metric}>
                  {labels[metric]}
                  <br />
                  <small>{metric.endsWith("Margin") ? "%" : "USD"}</small>
                </th>
              ))}
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {response.rows.map((row) => (
              <tr key={row.identity.listingId}>
                <th scope="row">
                  <strong>{row.identity.symbol}</strong>
                  <br />
                  {row.identity.issuerName}
                  <br />
                  <small>
                    {row.identity.exchangeMic} · {row.identity.cik}
                  </small>
                </th>
                {metrics.map((metric) => (
                  <td key={metric}>
                    <FinancialCell
                      cell={row.metrics[metric]}
                      metric={metric}
                      cik={row.identity.cik}
                      symbol={row.identity.symbol}
                      revenueBasis={revenueBasis}
                      revenueUnresolved={
                        row.metrics.revenue.status === "unavailable"
                      }
                    />
                  </td>
                ))}
                <td>
                  <div className="financial-screen-row-actions">
                    <button
                      className="secondary-action compact-action"
                      type="button"
                      disabled={running}
                      onClick={() => onOpenResearch(row.identity)}
                    >
                      Open {row.identity.symbol}
                    </button>
                    <button
                      className="secondary-action compact-action"
                      type="button"
                      disabled={
                        running ||
                        !canAddToWatchlist ||
                        savedListingIds.has(row.identity.listingId)
                      }
                      onClick={() => onAddToWatchlist(row.identity)}
                    >
                      {savedListingIds.has(row.identity.listingId)
                        ? "In watchlist"
                        : `Add ${row.identity.symbol}`}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {response.rows.length === 0 && (
              <tr>
                <td colSpan={metrics.length + 2}>
                  No matching financial results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="personal-stock-screener-run-actions">
        <button
          className="secondary-action compact-action"
          type="button"
          disabled={running || response.offset === 0}
          onClick={() =>
            onPage(
              Math.max(
                0,
                response.offset - PERSONAL_FINANCIAL_SCREENER_PAGE_SIZE,
              ),
            )
          }
        >
          Previous financial page
        </button>
        <span>
          Showing {response.rows.length === 0 ? 0 : response.offset + 1}–
          {response.offset + response.rows.length} of {response.totalMatches}
        </span>
        <button
          className="secondary-action compact-action"
          type="button"
          disabled={running || !response.hasMore}
          onClick={() => onPage(response.offset + response.limitApplied)}
        >
          Next financial page
        </button>
      </div>
    </div>
  );
}

function FinancialCell({
  cell,
  metric,
  cik,
  symbol,
  revenueBasis,
  revenueUnresolved,
}: {
  readonly cell: PersonalFinancialScreenCellDto;
  readonly metric: PersonalFinancialScreenMetricDto;
  readonly cik: string;
  readonly symbol: string;
  readonly revenueBasis: PersonalFinancialRevenueBasisDto;
  readonly revenueUnresolved: boolean;
}) {
  const display =
    cell.status === "available"
      ? cell.unit === "percent"
        ? `${Number(cell.value).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`
        : Number(cell.value).toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            notation: "compact",
            maximumFractionDigits: 2,
          })
      : "Unknown";
  return (
    <details className="financial-screen-cell">
      <summary
        aria-label={`${symbol} ${labels[metric]}: ${display}. Show source details`}
      >
        {display}
      </summary>
      <div>
        <p>
          {cell.status === "available"
            ? `Exact value: ${cell.value} ${cell.unit}`
            : `Unavailable: ${cell.reason.replaceAll("_", " ")}.`}
        </p>
        <p>{formulaFor(metric, revenueBasis)}</p>
        {metric === "revenue" &&
          cell.status === "unavailable" &&
          cell.reason === "conflicting" && (
            <p>
              {revenueBasis === "agreement" &&
              new Set(cell.sources.map((source) => source.concept)).size > 1
                ? "Revenue inputs remain unresolved. Retained concepts can describe different definitions; compare their amounts and reporting periods below. This screen does not select a value from conflicting inputs."
                : "Revenue inputs remain unresolved. Any retained source references are shown below; this screen does not select a value from ambiguous or conflicting inputs."}
            </p>
          )}
        {metric.endsWith("Margin") && (
          <p>
            Revenue denominator: {revenueBasisLabels[revenueBasis]}.
            {revenueUnresolved &&
              " This margin remains unknown because revenue is unresolved."}
          </p>
        )}
        {cell.sources.map((source, index) => (
          <p key={`${source.concept}-${String(index)}`}>
            {source.concept}
            <br />
            {source.startDate} through {source.endDate}
            <br />
            Reported: {source.value} USD
            <br />
            <a
              href={`https://www.sec.gov/Archives/edgar/data/${String(Number(cik))}/${source.accessionNumber.replaceAll("-", "")}/${source.accessionNumber}-index.html`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Filing {source.accessionNumber}
            </a>
          </p>
        ))}
      </div>
    </details>
  );
}

function isSessionError(error: unknown) {
  return (
    error instanceof PersonalWorkspaceApiError &&
    error.code === "session_unavailable"
  );
}
function screenErrorMessage(error: unknown): string {
  if (error instanceof PersonalWorkspaceApiError) {
    if (error.code === "conflict")
      return "The catalog or SEC snapshot changed or expired. Results were cleared. Run financial screen again to use current data; revalidate the owner session if the catalog changed.";
    if (error.code === "not_configured")
      return "SEC financial screening is not configured. Configure the SEC contact identity in the local API, then run again.";
    if (error.code === "rate_limited")
      return "Another SEC screen is running. Try again shortly.";
    if (error.code === "invalid_request")
      return "The financial criteria were not accepted. Check the calendar year and decimal thresholds.";
    if (error.code === "invalid_response")
      return "The financial response failed validation. Results were cleared; run the screen again.";
  }
  return "SEC annual financial screening is temporarily unavailable. Run the screen again later.";
}
