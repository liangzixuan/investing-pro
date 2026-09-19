"use client";

export interface PersonalSavedDcfAssumptionsEntry {
  readonly listingId: string;
  readonly symbol: string;
  readonly issuerName: string;
  readonly modelSupported: boolean;
  readonly isCurrentCompany: boolean;
}

export interface PersonalSavedDcfAssumptionsComparisonRow {
  readonly input: string;
  readonly label: string;
  readonly currentValue: string;
  readonly savedValue: string;
  readonly unit: "years" | "%";
  readonly state: "same" | "changed" | "unavailable";
}

export interface PersonalSavedDcfAssumptionsComparison {
  readonly rows: readonly PersonalSavedDcfAssumptionsComparisonRow[];
  readonly changedCount: number | null;
}

export interface PersonalSavedDcfAssumptionsControlsProps {
  readonly symbol: string;
  readonly busy: boolean;
  readonly loaded: boolean;
  readonly count: number;
  readonly canSave: boolean;
  readonly canRestore: boolean;
  readonly saveUnavailableReason: string | null;
  readonly message: string;
  readonly draftIsSaved: boolean;
  readonly entries: readonly PersonalSavedDcfAssumptionsEntry[];
  readonly comparison: PersonalSavedDcfAssumptionsComparison | null;
  readonly onLoad: () => void;
  readonly onSave: () => void;
  readonly onRestore: () => void;
  readonly onClear: (listingId: string) => void;
}

export function PersonalSavedDcfAssumptionsControls({
  symbol,
  busy,
  loaded,
  count,
  canSave,
  canRestore,
  saveUnavailableReason,
  message,
  draftIsSaved,
  entries,
  comparison,
  onLoad,
  onSave,
  onRestore,
  onClear,
}: PersonalSavedDcfAssumptionsControlsProps) {
  return (
    <section
      aria-busy={busy}
      aria-labelledby="saved-dcf-assumptions-title"
      className="financial-screen-saved"
    >
      <h3 id="saved-dcf-assumptions-title">Saved DCF assumptions</h3>
      <p className="company-research-note-hint" id="saved-dcf-assumptions-hint">
        Keep one set of seven assumptions per My Watchlist company, up to 20
        companies. Only assumptions and company identities are saved; prices,
        statements and calculated results are not saved here.
      </p>
      <div className="company-research-note-actions">
        <button
          className="secondary-action compact-action"
          disabled={busy}
          onClick={onLoad}
          type="button"
        >
          {loaded ? "Reload saved assumptions" : "Load saved assumptions"}
        </button>
        <button
          aria-describedby="saved-dcf-assumptions-save-guidance"
          className="secondary-action compact-action"
          disabled={busy || !loaded || !canSave}
          onClick={onSave}
          type="button"
        >
          Save assumptions for {symbol}
        </button>
        <button
          aria-describedby="saved-dcf-assumptions-restore-warning"
          className="secondary-action compact-action"
          disabled={busy || !loaded || !canRestore}
          onClick={onRestore}
          type="button"
        >
          Restore saved assumptions
        </button>
      </div>
      <p
        className="company-research-note-hint"
        id="saved-dcf-assumptions-save-guidance"
      >
        {saveUnavailableReason ??
          (loaded
            ? draftIsSaved
              ? "The current inputs match this company's saved assumptions."
              : "The current inputs are not saved for this company. Save explicitly to keep them."
            : "Load saved assumptions to check existing sets before saving or restoring.")}
      </p>
      <p
        className="company-research-note-hint"
        id="saved-dcf-assumptions-restore-warning"
      >
        Restore replaces all seven current inputs. It does not load provider
        data. Reset illustrative assumptions changes only the current inputs;
        Clear saved assumptions removes a saved set and keeps the current
        inputs.
      </p>
      <p
        aria-atomic="true"
        aria-live="polite"
        className="company-research-note-status"
        id="saved-dcf-assumptions-status"
        role="status"
      >
        {message}
      </p>
      {loaded && comparison !== null && (
        <div className="saved-dcf-input-comparison">
          <p
            className="company-research-note-hint"
            id="saved-dcf-input-comparison-summary"
          >
            {comparison.changedCount === null
              ? "Numeric comparison is unavailable. Enter a valid, complete set of all seven assumptions to compare values."
              : `${comparison.changedCount} of 7 inputs differ from the loaded saved set.`}
          </p>
          <div
            aria-describedby="saved-dcf-input-comparison-summary"
            aria-label={`${symbol} saved DCF input comparison`}
            className="saved-dcf-input-comparison-scroll"
            role="region"
            tabIndex={0}
          >
            <table>
              <caption>
                {symbol}: current draft and loaded saved DCF inputs. This
                compares assumptions, not company value.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Input</th>
                  <th scope="col">Current draft</th>
                  <th scope="col">Loaded saved</th>
                  <th scope="col">Comparison</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.input}>
                    <th scope="row">{row.label}</th>
                    <td>
                      <span className="saved-dcf-input-comparison-value">
                        {row.currentValue === "" ? (
                          <em>Not entered</em>
                        ) : (
                          row.currentValue
                        )}
                      </span>{" "}
                      <span>{row.unit}</span>
                    </td>
                    <td>
                      <span className="saved-dcf-input-comparison-value">
                        {row.savedValue}
                      </span>{" "}
                      <span>{row.unit}</span>
                    </td>
                    <td>
                      {row.state === "same"
                        ? "Same"
                        : row.state === "changed"
                          ? "Changed"
                          : "Unavailable"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {loaded && (
        <>
          <p className="company-research-note-hint">
            {count} of 20 companies saved. Replacing an existing set does not
            use another place.
          </p>
          {entries.length === 0 ? (
            <p className="company-research-note-hint">
              No DCF assumptions saved yet.
            </p>
          ) : (
            <ul
              aria-label="Companies with saved DCF assumptions"
              className="financial-comparison-saved-companies"
            >
              {entries.map((entry) => (
                <li key={entry.listingId}>
                  <p>
                    <strong>{entry.symbol}</strong> · {entry.issuerName}
                    {entry.isCurrentCompany ? " · Current company" : ""}
                  </p>
                  {!entry.modelSupported && (
                    <p className="company-research-note-hint">
                      Unsupported model version. This saved set cannot be
                      restored.
                    </p>
                  )}
                  <div className="company-research-note-actions">
                    <button
                      aria-label={`Clear saved assumptions for ${entry.symbol} (${entry.issuerName})`}
                      className="secondary-action compact-action"
                      disabled={busy || !loaded}
                      onClick={() => onClear(entry.listingId)}
                      type="button"
                    >
                      Clear saved assumptions for {entry.symbol}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
