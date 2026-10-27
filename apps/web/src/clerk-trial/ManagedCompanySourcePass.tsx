import { useState, useSyncExternalStore } from "react";
import type {
  ManagedCompanySourcePass as SourcePassModel,
  CompanySourcePassPreview,
  CompanySourceDisposition,
} from "./managed-company-source-pass";
import type { CompanySnapshotLoadSource } from "./managed-company-snapshot-load-sources";
import "./managed-company-source-pass.css";

const sources = [
  ["eod", "Price"],
  ["annual", "Annual"],
  ["filings", "Filings"],
  ["interim", "Interim"],
] as const;
const dispositions: Record<CompanySourceDisposition, string> = {
  missing: "Missing read",
  retained: "Retained",
  unsupported: "Unsupported",
  running: "Running",
  loaded: "Loaded",
  failed: "Failed",
  cancelled: "Cancelled",
  not_attempted: "Not attempted",
};

export function ManagedCompanySourcePass({
  model,
  navigationPending,
  onPreview,
  onRun,
  onCancel,
  onClear,
}: {
  model: SourcePassModel;
  navigationPending: boolean;
  onPreview: (names: readonly CompanySnapshotLoadSource[]) => void;
  onRun: (preview: CompanySourcePassPreview) => Promise<void>;
  onCancel: () => void;
  onClear: () => void;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const [selected, setSelected] = useState<
    readonly CompanySnapshotLoadSource[]
  >(["eod", "annual", "filings"]);
  const busy = state.phase === "running";
  const preview = state.preview;
  return (
    <section
      className="managed-company-source-pass"
      aria-label="Reviewed company source pass"
    >
      <h3>Reviewed company source pass</h3>
      <p>
        Choose sources, preview the missing reads, then run them one at a time.
        Interim is optional. Loaded responses keep their original dates and are
        not refreshed.
      </p>
      <fieldset disabled={busy || navigationPending}>
        <legend>Sources to review</legend>
        <div className="managed-company-source-pass-choices">
          {sources.map(([name, label]) => (
            <label key={name}>
              <input
                type="checkbox"
                checked={selected.includes(name)}
                onChange={(event) => {
                  onClear();
                  const next = event.target.checked
                    ? [...selected, name]
                    : selected.filter((item) => item !== name);
                  setSelected(
                    sources.map(([id]) => id).filter((id) => next.includes(id)),
                  );
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="managed-company-source-pass-actions">
        <button
          disabled={busy || navigationPending || selected.length === 0}
          onClick={() => onPreview(selected)}
        >
          Preview company source pass
        </button>
        <button
          disabled={busy || navigationPending || !preview}
          onClick={() => {
            if (preview) void onRun(preview);
          }}
        >
          Run reviewed company source pass
        </button>
        {(busy || preview) && (
          <button className="trial-secondary" onClick={onCancel}>
            Cancel reviewed company source pass
          </button>
        )}
      </div>
      {preview && (
        <p>
          Plan for {preview.selection.listing.issuerName} ·{" "}
          {preview.selection.listing.symbol} ·{" "}
          {preview.selection.listing.shareClassName} ·{" "}
          {preview.selection.listing.exchangeMic}. Read order:{" "}
          {sources
            .filter(([id]) =>
              preview.rows.some(
                (row) =>
                  row.name === id &&
                  row.selected &&
                  row.disposition === "missing",
              ),
            )
            .map(([, label]) => label)
            .join(" → ") || "No missing reads"}
          .
        </p>
      )}
      {state.message && <p role="status">{state.message}</p>}
      {state.rows.length > 0 && (
        <ul className="managed-company-source-pass-results">
          {state.rows.map((row) => (
            <li key={row.id}>
              <strong>{row.label}</strong>
              <span>
                {row.selected ? "Selected" : "Not selected"} ·{" "}
                {dispositions[row.disposition]}
              </span>
              <span>
                {row.evidence.completedAt
                  ? `Source completed: ${row.evidence.completedAt}`
                  : "No source completion time"}
              </span>
              {row.evidence.message && <span>{row.evidence.message}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
