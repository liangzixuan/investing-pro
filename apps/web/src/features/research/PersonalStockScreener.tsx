"use client";

import type {
  PersonalScreenerSavedColumnDto,
  PersonalScreenerSavedViewDto,
  PersonalScreenerSavedViewsPayloadDto,
  PersonalSecurityMasterScreenQueryDto,
  PersonalSecurityMasterScreenRequestDto,
  PersonalSecurityMasterScreenResponseDto,
  PersonalSecurityMasterScreenRowDto,
  PersonalSecurityMasterScreenSortDirectionDto,
  PersonalSecurityMasterScreenSortFieldDto,
  PersonalSecurityMasterSnapshotReceiptDto,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  createEmptyPersonalScreenerSavedViews,
  fetchPersonalScreenerSavedViews,
  normalizePersonalScreenerSavedViewName,
  PersonalWorkspaceApiError,
  savePersonalScreenerSavedViews,
  screenPersonalSecurities,
} from "@/lib/personal-workspace-api";

export const PERSONAL_STOCK_SCREENER_PAGE_SIZE = 25 as const;

const allColumns = [
  "symbol",
  "issuer_name",
  "exchange_mic",
  "instrument_type",
  "cik",
] as const satisfies readonly PersonalScreenerSavedColumnDto[];

const columnLabels: Readonly<Record<PersonalScreenerSavedColumnDto, string>> = {
  cik: "CIK",
  exchange_mic: "Exchange MIC",
  instrument_type: "Instrument",
  issuer_name: "Company",
  symbol: "Symbol",
};

const sortLabels: Readonly<
  Record<PersonalSecurityMasterScreenSortFieldDto, string>
> = columnLabels;

type InstrumentDraft = "adr" | "all" | "common_stock";
type RequestState = "idle" | "loading" | "saving";

export interface PersonalStockScreenerProps {
  readonly canAddToWatchlist: boolean;
  readonly onAddToWatchlist: (row: PersonalSecurityMasterScreenRowDto) => void;
  readonly onOpenResearch: (row: PersonalSecurityMasterScreenRowDto) => void;
  readonly onSessionUnavailable: () => void;
  readonly savedListingIds: ReadonlySet<string>;
  readonly snapshot: PersonalSecurityMasterSnapshotReceiptDto;
}

export function PersonalStockScreener({
  canAddToWatchlist,
  onAddToWatchlist,
  onOpenResearch,
  onSessionUnavailable,
  savedListingIds,
  snapshot,
}: PersonalStockScreenerProps) {
  const [identityText, setIdentityText] = useState("");
  const [exchangeMics, setExchangeMics] = useState("");
  const [instrumentType, setInstrumentType] = useState<InstrumentDraft>("all");
  const [cik, setCik] = useState("");
  const [sortField, setSortField] =
    useState<PersonalSecurityMasterScreenSortFieldDto>("symbol");
  const [sortDirection, setSortDirection] =
    useState<PersonalSecurityMasterScreenSortDirectionDto>("asc");
  const [columns, setColumns] =
    useState<readonly PersonalScreenerSavedColumnDto[]>(allColumns);
  const [response, setResponse] =
    useState<PersonalSecurityMasterScreenResponseDto | null>(null);
  const [resultsStale, setResultsStale] = useState(false);
  const [screenState, setScreenState] = useState<RequestState>("idle");
  const [screenMessage, setScreenMessage] = useState(
    "Set any identity filters you need, then run the local screen.",
  );
  const [savedPayload, setSavedPayload] =
    useState<PersonalScreenerSavedViewsPayloadDto>(
      createEmptyPersonalScreenerSavedViews(),
    );
  const [savedVersion, setSavedVersion] = useState(0);
  const [savedState, setSavedState] = useState<RequestState>("loading");
  const [savedMessage, setSavedMessage] = useState(
    "Loading saved screen definitions…",
  );
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [savedName, setSavedName] = useState("");
  const screenController = useRef<AbortController | null>(null);
  const screenEpoch = useRef(0);
  const savedController = useRef<AbortController | null>(null);
  const mutationController = useRef<AbortController | null>(null);
  const sessionUnavailable = useRef(onSessionUnavailable);
  sessionUnavailable.current = onSessionUnavailable;

  useEffect(() => {
    screenEpoch.current += 1;
    screenController.current?.abort();
    screenController.current = null;
    mutationController.current?.abort();
    mutationController.current = null;
    setResponse(null);
    setResultsStale(false);
    setScreenState("idle");
    setSelectedSavedId("");
    setSavedName("");
    setSavedPayload(createEmptyPersonalScreenerSavedViews());
    setSavedVersion(0);
    const controller = new AbortController();
    savedController.current = controller;
    setSavedState("loading");
    void fetchPersonalScreenerSavedViews(controller.signal)
      .then((record) => {
        if (controller.signal.aborted) return;
        setSavedPayload(
          record?.payload ?? createEmptyPersonalScreenerSavedViews(),
        );
        setSavedVersion(record?.version ?? 0);
        setSavedState("idle");
        setSavedMessage(
          record === null
            ? "No saved screens yet. Only definitions—not result rows—are stored."
            : `${String(record.payload.views.length)} saved screen definition${record.payload.views.length === 1 ? "" : "s"}.`,
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSavedState("idle");
        if (isSessionUnavailable(error)) {
          sessionUnavailable.current();
          return;
        }
        setSavedMessage(
          "Saved screens are unavailable. You can still run an unsaved local screen.",
        );
      });
    return () => controller.abort();
  }, [snapshot.snapshotSha256]);

  useEffect(
    () => () => {
      screenController.current?.abort();
      savedController.current?.abort();
      mutationController.current?.abort();
    },
    [],
  );

  const selectedSavedView = savedPayload.views.find(
    (view) => view.id === selectedSavedId,
  );
  const selectedViewIsFromOlderSnapshot =
    selectedSavedView !== undefined &&
    selectedSavedView.createdAgainstSnapshotSha256 !== snapshot.snapshotSha256;

  function changeDraft(update: () => void) {
    invalidateScreenRequest();
    update();
    if (response !== null) setResultsStale(true);
  }

  function invalidateScreenRequest() {
    screenEpoch.current += 1;
    screenController.current?.abort();
    screenController.current = null;
    setScreenState("idle");
  }

  function runScreen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void requestScreen(0);
  }

  async function requestScreen(offset: number) {
    const request = buildPersonalStockScreenRequest({
      cik,
      exchangeMics,
      identityText,
      instrumentType,
      limit: PERSONAL_STOCK_SCREENER_PAGE_SIZE,
      offset,
      snapshotSha256: snapshot.snapshotSha256,
      sortDirection,
      sortField,
    });
    if (request === null) {
      setScreenMessage(
        "Use a 10-digit CIK and comma-separated four-character exchange MICs.",
      );
      return;
    }
    invalidateScreenRequest();
    const epoch = screenEpoch.current;
    const controller = new AbortController();
    screenController.current = controller;
    setScreenState("loading");
    setScreenMessage(
      offset === 0 ? "Running the local identity screen…" : "Loading page…",
    );
    try {
      const next = await screenPersonalSecurities(request, controller.signal);
      if (
        controller.signal.aborted ||
        screenController.current !== controller ||
        screenEpoch.current !== epoch
      ) {
        return;
      }
      setResponse(next);
      setResultsStale(false);
      setScreenMessage(
        next.totalMatches === 0
          ? "No listed identities match these exact identity filters."
          : `${formatCount(next.totalMatches)} match${next.totalMatches === 1 ? "" : "es"} in ${formatCount(next.totalUniverse)} admitted listed identities.`,
      );
    } catch (error) {
      if (
        controller.signal.aborted ||
        screenController.current !== controller ||
        screenEpoch.current !== epoch
      ) {
        return;
      }
      if (isSessionUnavailable(error)) {
        sessionUnavailable.current();
        return;
      }
      setScreenMessage(screenFailureMessage(error));
    } finally {
      if (screenController.current === controller) {
        screenController.current = null;
        setScreenState("idle");
      }
    }
  }

  function loadSavedView() {
    if (selectedSavedView === undefined) {
      setSavedMessage("Choose a saved screen definition first.");
      return;
    }
    invalidateScreenRequest();
    const draft = draftFromSavedView(selectedSavedView);
    setIdentityText(draft.identityText);
    setExchangeMics(draft.exchangeMics);
    setInstrumentType(draft.instrumentType);
    setCik(draft.cik);
    setSortField(selectedSavedView.sort.field);
    setSortDirection(selectedSavedView.sort.direction);
    setColumns(selectedSavedView.columns);
    setSavedName(selectedSavedView.name);
    if (response !== null) setResultsStale(true);
    setSavedMessage(
      selectedViewIsFromOlderSnapshot
        ? "Loaded older-snapshot criteria. Review them, then rerun against the current snapshot."
        : "Saved criteria loaded. Run screen to refresh results.",
    );
  }

  async function saveView(saveAsNew: boolean) {
    const name = normalizePersonalScreenerSavedViewName(savedName);
    const query = buildPersonalStockScreenQuery({
      cik,
      exchangeMics,
      identityText,
      instrumentType,
    });
    if (name === null || query === null) {
      setSavedMessage(
        "Enter a screen name and use valid CIK and exchange MIC filters before saving.",
      );
      return;
    }
    const updating = !saveAsNew && selectedSavedView !== undefined;
    if (!updating && savedPayload.views.length >= 20) {
      setSavedMessage("The 20 saved-screen limit is reached.");
      return;
    }
    const duplicateName = savedPayload.views.some(
      (candidate) =>
        candidate.id !== (updating ? selectedSavedView.id : "") &&
        candidate.name.toLocaleLowerCase("en-US") ===
          name.toLocaleLowerCase("en-US"),
    );
    if (duplicateName) {
      setSavedMessage("Saved screen names must be unique.");
      return;
    }
    let id: string;
    try {
      id = updating
        ? selectedSavedView.id
        : `screen-${globalThis.crypto.randomUUID()}`;
    } catch {
      setSavedMessage("A new saved-screen identifier could not be created.");
      return;
    }
    const view: PersonalScreenerSavedViewDto = Object.freeze({
      columns: Object.freeze([...columns]),
      createdAgainstSnapshotSha256: snapshot.snapshotSha256,
      id,
      name,
      query,
      sort: Object.freeze({ direction: sortDirection, field: sortField }),
    });
    const views = updating
      ? savedPayload.views.map((candidate) =>
          candidate.id === id ? view : candidate,
        )
      : [...savedPayload.views, view];
    await persistSavedViews(
      Object.freeze({ schemaVersion: 1, views: Object.freeze(views) }),
      id,
      updating ? `${name} was updated.` : `${name} was saved.`,
    );
  }

  async function deleteView() {
    if (selectedSavedView === undefined) return;
    const retained = savedPayload.views.filter(
      (view) => view.id !== selectedSavedView.id,
    );
    await persistSavedViews(
      Object.freeze({ schemaVersion: 1, views: Object.freeze(retained) }),
      "",
      `${selectedSavedView.name} was deleted.`,
    );
  }

  async function persistSavedViews(
    payload: PersonalScreenerSavedViewsPayloadDto,
    nextSelectedId: string,
    successMessage: string,
  ) {
    if (savedState === "saving") return;
    mutationController.current?.abort();
    const controller = new AbortController();
    mutationController.current = controller;
    setSavedState("saving");
    setSavedMessage("Saving screen definitions…");
    try {
      const saved = await savePersonalScreenerSavedViews(
        savedVersion,
        payload,
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        mutationController.current !== controller
      ) {
        return;
      }
      setSavedPayload(saved.payload);
      setSavedVersion(saved.version);
      setSelectedSavedId(nextSelectedId);
      setSavedMessage(successMessage);
    } catch (error) {
      if (
        controller.signal.aborted ||
        mutationController.current !== controller
      ) {
        return;
      }
      if (isSessionUnavailable(error)) {
        sessionUnavailable.current();
        return;
      }
      if (
        error instanceof PersonalWorkspaceApiError &&
        error.code === "conflict"
      ) {
        try {
          const latest = await fetchPersonalScreenerSavedViews(
            controller.signal,
          );
          if (
            controller.signal.aborted ||
            mutationController.current !== controller
          ) {
            return;
          }
          setSavedPayload(
            latest?.payload ?? createEmptyPersonalScreenerSavedViews(),
          );
          setSavedVersion(latest?.version ?? 0);
          setSelectedSavedId("");
          setSavedMessage(
            "Saved screens changed elsewhere. The latest definitions are now shown; try your change again.",
          );
          return;
        } catch (reloadError) {
          if (controller.signal.aborted) return;
          if (isSessionUnavailable(reloadError)) {
            sessionUnavailable.current();
            return;
          }
          setSavedMessage(
            "Saved screens changed elsewhere and the latest definitions could not be reloaded.",
          );
          return;
        }
      }
      setSavedMessage("The saved-screen change could not be stored.");
    } finally {
      if (mutationController.current === controller) {
        mutationController.current = null;
        setSavedState("idle");
      }
    }
  }

  function toggleColumn(column: PersonalScreenerSavedColumnDto) {
    setColumns((current) => {
      if (column === "symbol") return current;
      if (current.includes(column)) {
        return current.filter((candidate) => candidate !== column);
      }
      return allColumns.filter(
        (candidate) =>
          candidate === "symbol" ||
          current.includes(candidate) ||
          candidate === column,
      );
    });
  }

  function resetCriteria() {
    invalidateScreenRequest();
    setIdentityText("");
    setExchangeMics("");
    setInstrumentType("all");
    setCik("");
    setSortField("symbol");
    setSortDirection("asc");
    if (response !== null) setResultsStale(true);
    setScreenMessage(
      "Identity filters were reset. Run the screen to refresh results.",
    );
  }

  return (
    <section
      aria-busy={screenState === "loading" || savedState !== "idle"}
      aria-describedby="personal-stock-screener-intro personal-stock-screener-note"
      aria-labelledby="personal-stock-screener-title"
      className="security-search-panel personal-stock-screener"
    >
      <div className="discovery-section-heading">
        <div>
          <p className="eyebrow">Local universe screener</p>
          <h2 id="personal-stock-screener-title">Screen listed companies</h2>
        </div>
        <span>
          {formatCount(snapshot.coverage.activeListings)} active listings ·{" "}
          {formatDate(snapshot.asOf)}
        </span>
      </div>
      <p className="market-scope-note" id="personal-stock-screener-intro">
        Narrow the admitted snapshot by identity, exchange, instrument type, or
        CIK. This first slice uses local catalog identity fields only—no
        financial metric or market-provider request is made.
      </p>

      <SavedViews
        loadSavedView={loadSavedView}
        onDelete={() => void deleteView()}
        onSave={() => void saveView(false)}
        onSaveAs={() => void saveView(true)}
        savedMessage={savedMessage}
        savedName={savedName}
        savedPayload={savedPayload}
        savedState={savedState}
        selectedSavedId={selectedSavedId}
        selectedViewIsFromOlderSnapshot={selectedViewIsFromOlderSnapshot}
        setSavedName={setSavedName}
        setSelectedSavedId={setSelectedSavedId}
      />

      <form className="personal-stock-screener-form" onSubmit={runScreen}>
        <div className="personal-stock-screener-filters">
          <label>
            <span>Symbol or company identity</span>
            <input
              maxLength={128}
              onChange={(event) =>
                changeDraft(() => setIdentityText(event.target.value))
              }
              placeholder="Example: Apple or AAPL"
              value={identityText}
            />
          </label>
          <label>
            <span>Exchange MICs</span>
            <input
              autoCapitalize="characters"
              onChange={(event) =>
                changeDraft(() => setExchangeMics(event.target.value))
              }
              placeholder="XNAS, XNYS"
              value={exchangeMics}
            />
          </label>
          <label>
            <span>Instrument type</span>
            <select
              aria-label="Instrument type"
              onChange={(event) =>
                changeDraft(() =>
                  setInstrumentType(event.target.value as InstrumentDraft),
                )
              }
              value={instrumentType}
            >
              <option value="all">Common stocks and ADRs</option>
              <option value="common_stock">Common stocks</option>
              <option value="adr">ADRs</option>
            </select>
          </label>
          <label>
            <span>Exact SEC CIK</span>
            <input
              inputMode="numeric"
              maxLength={10}
              onChange={(event) =>
                changeDraft(() => setCik(event.target.value))
              }
              placeholder="10 digits"
              value={cik}
            />
          </label>
        </div>

        <div className="personal-stock-screener-options">
          <label>
            <span>Sort by</span>
            <select
              onChange={(event) =>
                changeDraft(() =>
                  setSortField(
                    event.target
                      .value as PersonalSecurityMasterScreenSortFieldDto,
                  ),
                )
              }
              value={sortField}
            >
              {allColumns.map((column) => (
                <option key={column} value={column}>
                  {sortLabels[column]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Direction</span>
            <select
              onChange={(event) =>
                changeDraft(() =>
                  setSortDirection(
                    event.target
                      .value as PersonalSecurityMasterScreenSortDirectionDto,
                  ),
                )
              }
              value={sortDirection}
            >
              <option value="asc">A to Z</option>
              <option value="desc">Z to A</option>
            </select>
          </label>
          <fieldset>
            <legend>Visible columns</legend>
            <div>
              {allColumns.map((column) => (
                <label key={column}>
                  <input
                    checked={columns.includes(column)}
                    disabled={column === "symbol"}
                    onChange={() => toggleColumn(column)}
                    type="checkbox"
                  />
                  <span>{columnLabels[column]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="personal-stock-screener-run-actions">
          <button
            className="primary-action compact-action"
            disabled={screenState === "loading"}
            type="submit"
          >
            {screenState === "loading" ? "Running screen…" : "Run screen"}
          </button>
          <button
            className="secondary-action compact-action"
            disabled={screenState === "loading"}
            onClick={resetCriteria}
            type="button"
          >
            Reset criteria
          </button>
        </div>
      </form>

      <p
        aria-live="polite"
        className="discovery-status personal-stock-screener-status"
      >
        {resultsStale
          ? `Criteria changed. Previous results are stale. ${screenMessage}`
          : screenMessage}
      </p>

      {response === null ? (
        <div className="discovery-empty-state">
          <strong>No screen has run in this owner session.</strong>
          <span>Results appear only after the explicit Run screen action.</span>
        </div>
      ) : response.rows.length === 0 ? (
        <div className="discovery-empty-state">
          <strong>No matching listed identities</strong>
          <span>
            Broaden one or more identity filters and run the screen again.
          </span>
        </div>
      ) : (
        <ScreenResults
          canAddToWatchlist={canAddToWatchlist}
          columns={columns}
          onAddToWatchlist={onAddToWatchlist}
          onOpenResearch={onOpenResearch}
          onPage={(offset) => void requestScreen(offset)}
          response={response}
          resultsStale={resultsStale}
          savedListingIds={savedListingIds}
          screenState={screenState}
          sortDirection={sortDirection}
          sortField={sortField}
        />
      )}

      <p
        className="fcff-dcf-caveat"
        id="personal-stock-screener-note"
        role="note"
      >
        Screen results are a current local identity lookup, not a financial,
        valuation, quality, risk, or buy/sell screen. Saved screens retain
        definitions only. Result rows remain in active-session memory and are
        cleared when this view or owner session ends.
      </p>
    </section>
  );
}

interface ScreenDraft {
  readonly cik: string;
  readonly exchangeMics: string;
  readonly identityText: string;
  readonly instrumentType: InstrumentDraft;
}

export function buildPersonalStockScreenQuery(
  draft: ScreenDraft,
): PersonalSecurityMasterScreenQueryDto | null {
  const clauses: PersonalSecurityMasterScreenQueryDto["clauses"][number][] = [];
  const identityText = draft.identityText.trim().normalize("NFC");
  if (identityText.length > 0) {
    if (
      [...identityText].length > 128 ||
      /[\p{Cc}\p{Cf}\p{Cs}]/u.test(identityText) ||
      normalizeIdentityTextForMatch(identityText).length === 0 ||
      [...normalizeIdentityTextForMatch(identityText)].length > 512
    )
      return null;
    clauses.push({
      field: "identity_text",
      operator: "matches",
      value: identityText,
    });
  }
  const exchangeValues = [
    ...new Set(
      draft.exchangeMics
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  if (exchangeValues.length > 0) {
    if (
      exchangeValues.length > 16 ||
      exchangeValues.some((value) => !/^[A-Z0-9]{4}$/u.test(value))
    )
      return null;
    clauses.push({
      field: "exchange_mic",
      operator: "in",
      values: Object.freeze(exchangeValues),
    });
  }
  if (draft.instrumentType !== "all") {
    clauses.push({
      field: "instrument_type",
      operator: "in",
      values: Object.freeze([draft.instrumentType]),
    });
  }
  const cik = draft.cik.trim();
  if (cik.length > 0) {
    if (!/^[0-9]{10}$/u.test(cik)) return null;
    clauses.push({ field: "cik", operator: "equals", value: cik });
  }
  return Object.freeze({ clauses: Object.freeze(clauses), operator: "and" });
}

export function buildPersonalStockScreenRequest(
  draft: ScreenDraft &
    Readonly<{
      limit: number;
      offset: number;
      snapshotSha256: `sha256:${string}`;
      sortDirection: PersonalSecurityMasterScreenSortDirectionDto;
      sortField: PersonalSecurityMasterScreenSortFieldDto;
    }>,
): PersonalSecurityMasterScreenRequestDto | null {
  const query = buildPersonalStockScreenQuery(draft);
  if (query === null) return null;
  return Object.freeze({
    page: Object.freeze({ limit: draft.limit, offset: draft.offset }),
    query,
    schemaVersion: "1.0.0",
    snapshotSha256: draft.snapshotSha256,
    sort: Object.freeze({
      direction: draft.sortDirection,
      field: draft.sortField,
    }),
  });
}

function SavedViews(
  props: Readonly<{
    loadSavedView: () => void;
    onDelete: () => void;
    onSave: () => void;
    onSaveAs: () => void;
    savedMessage: string;
    savedName: string;
    savedPayload: PersonalScreenerSavedViewsPayloadDto;
    savedState: RequestState;
    selectedSavedId: string;
    selectedViewIsFromOlderSnapshot: boolean;
    setSavedName: (value: string) => void;
    setSelectedSavedId: (value: string) => void;
  }>,
) {
  const busy = props.savedState !== "idle";
  return (
    <div className="personal-stock-screener-saved">
      <div className="personal-stock-screener-saved-controls">
        <label>
          <span>Saved screen</span>
          <select
            aria-label="Saved screen definition"
            disabled={busy}
            onChange={(event) => props.setSelectedSavedId(event.target.value)}
            value={props.selectedSavedId}
          >
            <option value="">New screen</option>
            {props.savedPayload.views.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary-action compact-action"
          disabled={busy || props.selectedSavedId === ""}
          onClick={props.loadSavedView}
          type="button"
        >
          Load
        </button>
        <label>
          <span>Screen name</span>
          <input
            maxLength={80}
            onChange={(event) => props.setSavedName(event.target.value)}
            placeholder="My local screen"
            value={props.savedName}
          />
        </label>
        <button
          className="secondary-action compact-action"
          disabled={busy}
          onClick={props.onSave}
          type="button"
        >
          {props.selectedSavedId === "" ? "Save" : "Update"}
        </button>
        <button
          className="text-button"
          disabled={busy || props.selectedSavedId === ""}
          onClick={props.onSaveAs}
          type="button"
        >
          Save as new
        </button>
        <button
          className="text-button personal-stock-screener-delete"
          disabled={busy || props.selectedSavedId === ""}
          onClick={props.onDelete}
          type="button"
        >
          Delete
        </button>
      </div>
      {props.selectedViewIsFromOlderSnapshot ? (
        <div className="discovery-warning" role="alert">
          This definition was saved against an older security snapshot. Load it
          to review the criteria, then rerun against the current snapshot.
        </div>
      ) : null}
      <p aria-live="polite" className="discovery-status">
        {props.savedMessage}
      </p>
    </div>
  );
}

function ScreenResults(
  props: Readonly<{
    canAddToWatchlist: boolean;
    columns: readonly PersonalScreenerSavedColumnDto[];
    onAddToWatchlist: (row: PersonalSecurityMasterScreenRowDto) => void;
    onOpenResearch: (row: PersonalSecurityMasterScreenRowDto) => void;
    onPage: (offset: number) => void;
    response: PersonalSecurityMasterScreenResponseDto;
    resultsStale: boolean;
    savedListingIds: ReadonlySet<string>;
    screenState: RequestState;
    sortDirection: PersonalSecurityMasterScreenSortDirectionDto;
    sortField: PersonalSecurityMasterScreenSortFieldDto;
  }>,
) {
  const first = props.response.offset + 1;
  const last = props.response.offset + props.response.rows.length;
  return (
    <div
      aria-label="Stock screener results"
      className="financial-table-scroll personal-stock-screener-table-scroll"
      role="region"
      tabIndex={0}
    >
      <table className="personal-stock-screener-table">
        <caption>
          Rows {formatCount(first)}–{formatCount(last)} of{" "}
          {formatCount(props.response.totalMatches)} exact listed-identity
          matches
        </caption>
        <thead>
          <tr>
            {props.columns.map((column) => (
              <th
                aria-sort={
                  props.sortField === column
                    ? props.sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
                key={column}
                scope="col"
              >
                {columnLabels[column]}
              </th>
            ))}
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {props.response.rows.map((row) => {
            const saved = props.savedListingIds.has(row.listingId);
            return (
              <tr key={row.listingId}>
                {props.columns.map((column) => (
                  <td key={column}>{screenCell(row, column)}</td>
                ))}
                <td>
                  <div className="security-result-actions">
                    <button
                      className="secondary-action compact-action"
                      disabled={props.resultsStale}
                      onClick={() => props.onOpenResearch(row)}
                      type="button"
                    >
                      Open research
                    </button>
                    <button
                      className="secondary-action compact-action"
                      disabled={
                        props.resultsStale || saved || !props.canAddToWatchlist
                      }
                      onClick={() => props.onAddToWatchlist(row)}
                      type="button"
                    >
                      {saved ? "In watchlist" : "Add"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div
        className="personal-stock-screener-pagination"
        aria-label="Stock screener pages"
      >
        <button
          className="secondary-action compact-action"
          disabled={
            props.resultsStale ||
            props.screenState === "loading" ||
            props.response.offset === 0
          }
          onClick={() =>
            props.onPage(
              Math.max(0, props.response.offset - props.response.limitApplied),
            )
          }
          type="button"
        >
          Previous
        </button>
        <span>
          Showing {formatCount(first)}–{formatCount(last)}
        </span>
        <button
          className="secondary-action compact-action"
          disabled={
            props.resultsStale ||
            props.screenState === "loading" ||
            !props.response.hasMore
          }
          onClick={() =>
            props.onPage(props.response.offset + props.response.limitApplied)
          }
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function draftFromSavedView(view: PersonalScreenerSavedViewDto): ScreenDraft {
  const identity = view.query.clauses.find(
    (clause) => clause.field === "identity_text",
  );
  const exchanges = view.query.clauses.find(
    (clause) => clause.field === "exchange_mic",
  );
  const instruments = view.query.clauses.find(
    (clause) => clause.field === "instrument_type",
  );
  const cik = view.query.clauses.find((clause) => clause.field === "cik");
  return {
    cik: cik?.value ?? "",
    exchangeMics: exchanges?.values.join(", ") ?? "",
    identityText: identity?.value ?? "",
    instrumentType:
      instruments?.values.length === 1 ? instruments.values[0]! : "all",
  };
}

function screenCell(
  row: PersonalSecurityMasterScreenRowDto,
  column: PersonalScreenerSavedColumnDto,
): string {
  if (column === "cik") return row.cik;
  if (column === "exchange_mic") return row.exchangeMic;
  if (column === "instrument_type")
    return row.instrumentType === "adr" ? "ADR" : "Common stock";
  if (column === "issuer_name") return row.issuerName;
  return row.symbol;
}

function isSessionUnavailable(error: unknown): boolean {
  return (
    error instanceof PersonalWorkspaceApiError &&
    error.code === "session_unavailable"
  );
}

function normalizeIdentityTextForMatch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function screenFailureMessage(error: unknown): string {
  return error instanceof PersonalWorkspaceApiError &&
    error.code === "invalid_request"
    ? "The screen criteria were not accepted. Review the identity filters."
    : "The local stock screen is temporarily unavailable. Previous results, if any, were not replaced.";
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}
