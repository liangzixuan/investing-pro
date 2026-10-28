import { ManagedValuationRevenueBasisPanel } from "./ManagedValuationRevenueBasisPanel";
import type { ManagedValuationRevenueBasisActions } from "./use-valuation-revenue-basis-review";
import type { ManagedAnnualReport } from "./managed-annual-report";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { membershipMatchesResult } from "@research-cockpit/contracts";
import type { AuthoredValuationScenario } from "@research-cockpit/personal-market-analytics";
import {
  AUTHORED_VALUATION_EXPLANATION,
  VALUATION_SCENARIOS,
  type ManagedValuationWorkbench as WorkbenchModel,
  type ManagedValuationSnapshot,
  type DcfField,
  type ExitField,
} from "./managed-valuation-workbench";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedEodHistory } from "./managed-eod-history";
import { resolveManagedValuationPrice } from "./managed-valuation-price";
import {
  ManagedValuationPriceContext,
  valuationPriceRefusal,
} from "./ManagedValuationPriceContext";
import type { ResearchWatchlistState } from "./managed-workspace";
import type {
  PreparedValuationNote,
  ValuationNotePreparation,
} from "./valuation-note";
import {
  ManagedValuationResults,
  valuationScenarioLabels,
} from "./ManagedValuationResults";
import "./managed-valuation-workbench.css";

export interface ManagedValuationNoteActions {
  prepare: (
    model: "dcf" | "exit",
    scenario: AuthoredValuationScenario,
    includePriceComparison?: boolean,
  ) => ValuationNotePreparation;
  isCurrent: (preview: PreparedValuationNote) => boolean;
  append: (preview: PreparedValuationNote) => {
    readonly appended: boolean;
    readonly message: string;
  };
}
export interface ManagedValuationWorkbenchProps {
  readonly model: WorkbenchModel;
  readonly selection: ManagedResearchSelection;
  readonly navigationPending: boolean;
  readonly noteActions: ManagedValuationNoteActions;
  readonly watchlist: ResearchWatchlistState;
  readonly price?: ManagedEodHistory;
  readonly annual?: ManagedAnnualReport;
  readonly revenueBasisActions?: ManagedValuationRevenueBasisActions;
  readonly onOpenPrice?: () => void;
}
const subscribeWithoutPrice = () => () => {};
const snapshotWithoutPrice = () => null;
import {
  dcfFields,
  exitFields,
  exitScenarioFields,
} from "./valuation-input-labels";

export function ValuationInput({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="managed-valuation-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}
export function ValuationInputs({
  id,
  state,
  disabled,
  model,
  canAct,
}: {
  readonly id: string;
  readonly state: ManagedValuationSnapshot;
  readonly disabled: boolean;
  readonly model: WorkbenchModel;
  readonly canAct: () => boolean;
}) {
  const field = (
    key: DcfField | ExitField,
    label: string,
    kind: "dcf" | "exit",
  ) => (
    <ValuationInput
      key={key}
      id={`${id}-${kind}-${key}`}
      label={label}
      value={
        kind === "dcf"
          ? state.dcfDraft[key as DcfField]
          : state.exitDraft[key as ExitField]
      }
      disabled={disabled}
      onChange={(value) => {
        if (!canAct()) return;
        if (kind === "dcf") model.setDcfField(key as DcfField, value);
        else model.setExitField(key as ExitField, value);
      }}
    />
  );
  return (
    <>
      <fieldset disabled={disabled}>
        <legend>Cash flow DCF assumptions</legend>
        <p>
          Enter your own starting unlevered cash flow. Reported operating cash
          flow and cash after PP&amp;E purchases are not automatically treated
          as FCFF.
        </p>
        <p>
          A positive bridge is subtracted from enterprise value. A negative
          bridge adds net cash. Enter 0 explicitly if your bridge is zero.
        </p>
        <div className="managed-valuation-fields">
          {dcfFields.map(([key, label]) => field(key, label, "dcf"))}
        </div>
        <p>
          WACC: 1–30%. Terminal growth: -2–5%, below WACC. Scenario growth:
          -50–50%, in conservative ≤ base ≤ expansion order.
        </p>
        <div className="managed-valuation-scenarios">
          {VALUATION_SCENARIOS.map((scenario) => (
            <fieldset key={scenario}>
              <legend>{valuationScenarioLabels[scenario]}</legend>
              <ValuationInput
                id={`${id}-dcf-${scenario}`}
                label="Annual cash flow growth (%)"
                value={
                  state.dcfDraft.scenarios[scenario].annualCashFlowGrowthPercent
                }
                disabled={disabled}
                onChange={(value) => {
                  if (canAct()) model.setDcfScenario(scenario, value);
                }}
              />
            </fieldset>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>Exit multiple assumptions</legend>
        <p>
          Discounts terminal enterprise value at year end. Intermediate cash
          distributions are excluded. Cash and debt form the present equity
          bridge.
        </p>
        <div className="managed-valuation-fields">
          {exitFields.map(([key, label]) => field(key, label, "exit"))}
        </div>
        <p>
          Revenue and shares must be positive; cash and debt must be zero or
          positive. Growth: -50–100%. Margin: -20–80%. Discount rate: 0.1–80%.
          Exit multiple must be positive.
        </p>
        <div className="managed-valuation-scenarios">
          {VALUATION_SCENARIOS.map((scenario) => (
            <fieldset key={scenario}>
              <legend>{valuationScenarioLabels[scenario]}</legend>
              {exitScenarioFields.map(([key, label]) => (
                <ValuationInput
                  key={key}
                  id={`${id}-exit-${scenario}-${key}`}
                  label={label}
                  value={state.exitDraft.scenarios[scenario][key]}
                  disabled={disabled}
                  onChange={(value) => {
                    if (canAct()) model.setExitScenario(scenario, key, value);
                  }}
                />
              ))}
            </fieldset>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export function ValuationNotePreview({
  preview,
  current,
  disabled,
  onAppend,
}: {
  readonly preview: PreparedValuationNote;
  readonly current: boolean;
  readonly disabled: boolean;
  readonly onAppend: () => void;
}) {
  return (
    <div
      className="managed-valuation-note-preview"
      aria-label="Complete valuation note preview"
    >
      <h4>{current ? "Complete note preview" : "Previous note preview"}</h4>
      <p className="trial-saved-note">{preview.note}</p>
      <button
        type="button"
        className="trial-secondary"
        disabled={disabled || !current}
        onClick={onAppend}
      >
        Add valuation to note draft
      </button>
    </div>
  );
}

function sameOwner(
  owner: ManagedResearchSelection | null,
  selection: ManagedResearchSelection,
) {
  return (
    owner !== null &&
    owner.catalogSnapshotSha256 === selection.catalogSnapshotSha256 &&
    owner.cik === selection.cik &&
    membershipMatchesResult({ ...owner.listing, note: "" }, selection.listing)
  );
}
export function ManagedValuationWorkbench({
  model,
  selection,
  navigationPending,
  noteActions,
  watchlist,
  price,
  onOpenPrice,
  annual,
  revenueBasisActions,
}: ManagedValuationWorkbenchProps) {
  const id = useId();
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const priceState = useSyncExternalStore(
    price?.subscribe ?? subscribeWithoutPrice,
    price?.getSnapshot ?? snapshotWithoutPrice,
    price?.getSnapshot ?? snapshotWithoutPrice,
  );
  const [noteModel, setNoteModel] = useState<"dcf" | "exit">("dcf");
  const [scenario, setScenario] = useState<AuthoredValuationScenario>("base");
  const [preparation, setPreparation] =
    useState<ValuationNotePreparation | null>(null);
  const [message, setMessage] = useState("");
  const [includePriceComparison, setIncludePriceComparison] = useState(false);
  const preparedPrice = useRef<typeof priceState | undefined>(undefined);
  const live = useRef(false);
  const choiceRevision = useRef(0);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const owned = sameOwner(state.owner, selection);
  const disabled =
    navigationPending ||
    !state.editable ||
    !owned ||
    !sameOwner(state.context, selection);
  const revision = choiceRevision.current;
  const canAct = () =>
    live.current &&
    !disabled &&
    model.getSnapshot() === state &&
    choiceRevision.current === revision;
  const noteBlock =
    !watchlist.canEdit || !watchlist.member
      ? (watchlist.reason ??
        "Add this company to My Watchlist before preparing a note.")
      : null;
  const priceContext = resolveManagedValuationPrice(
    selection,
    state.calculation,
    priceState,
  );
  const selectedComparison = priceContext?.rows.find(
    (row) => row.model === noteModel && row.scenario === scenario,
  );
  const comparisonAvailable = selectedComparison?.result.status === "available";
  const baseNoteDisabled = disabled || noteBlock !== null || !state.calculation;
  const noteDisabled =
    baseNoteDisabled || (includePriceComparison && !comparisonAvailable);
  const preview = preparation?.preview ?? null;
  const current =
    preview !== null &&
    preparedPrice.current === priceState &&
    noteActions.isCurrent(preview);
  const priceIsCurrent = () => (price?.getSnapshot() ?? null) === priceState;
  const resetPreview = () => {
    choiceRevision.current++;
    preparedPrice.current = undefined;
    setPreparation(null);
    setMessage("");
  };
  return (
    <details className="managed-valuation-workbench">
      <summary>Authored valuation workbench</summary>
      <h3>My valuation assumptions</h3>
      <p>{AUTHORED_VALUATION_EXPLANATION}</p>
      <p>
        Save editable inputs separately in Saved valuation inputs. Reload and
        sign-out clear the local editor and calculated results. To keep a
        selected result in a note, preview and append it, then Review and Save
        the Watchlist.
      </p>
      {state.retired ? (
        <p role="status">
          This valuation session has ended. Its inputs and results were cleared.
        </p>
      ) : (
        <>
          <p>
            Inputs belong to{" "}
            {state.owner?.listing.symbol ?? selection.listing.symbol} ·{" "}
            {state.owner?.listing.securityName ??
              selection.listing.securityName}{" "}
            ·{" "}
            {state.owner?.listing.exchangeMic ?? selection.listing.exchangeMic}{" "}
            · {state.owner?.listing.listingId ?? selection.listing.listingId}.
          </p>
          {!owned && (
            <div className="managed-valuation-retained">
              <p>
                These inputs are retained for another company or catalog.
                Discard them to start assumptions for {selection.listing.symbol}
                .
              </p>
              <button
                type="button"
                className="trial-secondary"
                disabled={navigationPending}
                onClick={() => {
                  if (
                    !live.current ||
                    navigationPending ||
                    model.getSnapshot() !== state
                  )
                    return;
                  resetPreview();
                  model.discardAndUse(selection);
                }}
              >
                Discard inputs and use {selection.listing.symbol}
              </button>
            </div>
          )}
          {navigationPending && (
            <p role="status">
              Wait for company navigation to finish before editing or
              calculating.
            </p>
          )}
          {annual && revenueBasisActions && (
            <ManagedValuationRevenueBasisPanel
              model={model}
              annual={annual}
              selection={selection}
              actions={revenueBasisActions}
              disabled={disabled}
            />
          )}
          <ValuationInputs
            id={id}
            state={state}
            disabled={disabled}
            model={model}
            canAct={canAct}
          />
          <button
            type="button"
            className="trial-secondary"
            disabled={disabled || Boolean(state.inputIssue)}
            onClick={() => {
              if (!canAct()) return;
              resetPreview();
              model.calculate();
            }}
          >
            Calculate authored scenarios
          </button>
          {state.inputIssue && <p role="status">{state.inputIssue}</p>}
          {owned && (state.dirty || state.calculation) && (
            <button
              type="button"
              className="trial-secondary"
              disabled={disabled}
              onClick={() => {
                if (!canAct()) return;
                resetPreview();
                model.discardAndUse(selection);
              }}
            >
              Discard valuation inputs
            </button>
          )}
          <p>
            No calculation runs while you type. Blank inputs remain missing. Use
            plain decimals without commas, currency symbols or scientific
            notation; rates have at most four decimal places.
          </p>
          {state.calculation && (
            <ManagedValuationResults calculation={state.calculation} />
          )}
          <ManagedValuationPriceContext context={priceContext} />
          {onOpenPrice && (
            <button
              type="button"
              className="trial-secondary"
              disabled={navigationPending}
              onClick={() => {
                if (
                  !live.current ||
                  navigationPending ||
                  model.getSnapshot() !== state ||
                  !priceIsCurrent()
                )
                  return;
                onOpenPrice();
              }}
            >
              Open Price section
            </button>
          )}
          <p>
            Use the existing Price section to load or refresh raw closing prices
            explicitly. Viewing this comparison and preparing a note make no
            source request.
          </p>
          <details className="managed-valuation-note">
            <summary>Add a valuation result to the note draft</summary>
            <p>
              Choose one calculated model and scenario. The preview includes the
              complete existing note and proposed addition. The whole proposal
              is refused if it exceeds the note limit; nothing is clipped or
              saved here.
            </p>
            <fieldset disabled={baseNoteDisabled}>
              <legend>Valuation to include</legend>
              <div className="managed-valuation-fields">
                <label
                  className="managed-valuation-field"
                  htmlFor={`${id}-note-model`}
                >
                  <span>Calculated model</span>
                  <select
                    id={`${id}-note-model`}
                    value={noteModel}
                    disabled={baseNoteDisabled}
                    onChange={(event) => {
                      if (
                        !canAct() ||
                        baseNoteDisabled ||
                        !priceIsCurrent() ||
                        !["dcf", "exit"].includes(event.currentTarget.value)
                      )
                        return;
                      resetPreview();
                      setNoteModel(event.currentTarget.value as "dcf" | "exit");
                    }}
                  >
                    <option value="dcf">Cash flow DCF</option>
                    <option value="exit">Exit multiple</option>
                  </select>
                </label>
                <label
                  className="managed-valuation-field"
                  htmlFor={`${id}-note-scenario`}
                >
                  <span>Calculated scenario</span>
                  <select
                    id={`${id}-note-scenario`}
                    value={scenario}
                    disabled={baseNoteDisabled}
                    onChange={(event) => {
                      if (
                        !canAct() ||
                        baseNoteDisabled ||
                        !priceIsCurrent() ||
                        !VALUATION_SCENARIOS.includes(
                          event.currentTarget
                            .value as AuthoredValuationScenario,
                        )
                      )
                        return;
                      resetPreview();
                      setScenario(
                        event.currentTarget.value as AuthoredValuationScenario,
                      );
                    }}
                  >
                    {VALUATION_SCENARIOS.map((s) => (
                      <option key={s} value={s}>
                        {valuationScenarioLabels[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label
                className="managed-valuation-price-opt-in"
                htmlFor={`${id}-include-price`}
              >
                <input
                  id={`${id}-include-price`}
                  type="checkbox"
                  aria-describedby={`${id}-include-price-help`}
                  checked={includePriceComparison}
                  disabled={
                    baseNoteDisabled ||
                    (!comparisonAvailable && !includePriceComparison)
                  }
                  onChange={(event) => {
                    if (
                      !canAct() ||
                      baseNoteDisabled ||
                      !priceIsCurrent() ||
                      (event.currentTarget.checked && !comparisonAvailable)
                    )
                      return;
                    resetPreview();
                    setIncludePriceComparison(event.currentTarget.checked);
                  }}
                />
                <span>Include dated price comparison</span>
              </label>
              <p id={`${id}-include-price-help`}>
                {comparisonAvailable
                  ? "Adds this selected scenario's dated raw-close comparison and original source qualifications to the complete note preview."
                  : selectedComparison?.result.status === "unavailable"
                    ? valuationPriceRefusal(selectedComparison.result.reason)
                    : "Calculate an available scenario and explicitly load Price before including a comparison."}
              </p>
            </fieldset>
            <button
              type="button"
              className="trial-secondary"
              disabled={noteDisabled}
              onClick={() => {
                if (!canAct() || noteDisabled || !priceIsCurrent()) return;
                preparedPrice.current = priceState;
                setPreparation(
                  includePriceComparison
                    ? noteActions.prepare(noteModel, scenario, true)
                    : noteActions.prepare(noteModel, scenario),
                );
                setMessage("");
              }}
            >
              Preview valuation note
            </button>
            {preview && (
              <ValuationNotePreview
                preview={preview}
                current={current}
                disabled={noteDisabled}
                onAppend={() => {
                  if (
                    !canAct() ||
                    noteDisabled ||
                    !current ||
                    !priceIsCurrent() ||
                    !noteActions.isCurrent(preview)
                  )
                    return;
                  const result = noteActions.append(preview);
                  setMessage(result.message);
                  if (result.appended) {
                    choiceRevision.current++;
                    setPreparation(null);
                  }
                }}
              />
            )}
            <p role="status" aria-live="polite">
              {message ||
                noteBlock ||
                (preview && !current
                  ? "The assumptions, note, source or visit changed. Preview the valuation note again."
                  : preparation?.reason) ||
                (!state.calculation
                  ? "Calculate your assumptions before preparing a note."
                  : "Preview the complete note before adding this result.")}
            </p>
          </details>
        </>
      )}
    </details>
  );
}
