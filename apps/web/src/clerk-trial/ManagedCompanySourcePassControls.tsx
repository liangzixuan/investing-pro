import type { ComponentProps } from "react";
import type { ManagedCompanySourcePass } from "./ManagedCompanySourcePass";
import type {
  CompanySourcePassPreview,
  CompanySourcePassRow,
  CompanySourceDisposition,
} from "./managed-company-source-pass";
import type { CompanySnapshotLoadSource } from "./managed-company-snapshot-load-sources";

type Actions = ComponentProps<typeof ManagedCompanySourcePass>;
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
export function CompanySourcePassChoices({
  selected,
  blocked,
  onChange,
}: {
  selected: readonly CompanySnapshotLoadSource[];
  blocked: boolean;
  onChange: (names: readonly CompanySnapshotLoadSource[]) => void;
}) {
  const change = (name: CompanySnapshotLoadSource, checked: boolean) => {
    const next = checked
      ? [...selected, name]
      : selected.filter((id) => id !== name);
    onChange(sources.map(([id]) => id).filter((id) => next.includes(id)));
  };
  return (
    <fieldset disabled={blocked}>
      <legend>Sources to review</legend>
      <div className="managed-company-source-pass-choices">
        {sources.map(([name, label]) => (
          <label key={name}>
            <input
              type="checkbox"
              checked={selected.includes(name)}
              onChange={(event) => change(name, event.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function CompanySourcePassActions({
  blocked,
  busy,
  selected,
  preview,
  onPreview,
  onRun,
  onCancel,
}: {
  blocked: boolean;
  busy: boolean;
  selected: readonly CompanySnapshotLoadSource[];
  preview: CompanySourcePassPreview | null;
  onPreview: Actions["onPreview"];
  onRun: Actions["onRun"];
  onCancel: Actions["onCancel"];
}) {
  const run = () => {
    if (preview) void onRun(preview);
  };
  return (
    <div className="managed-company-source-pass-actions">
      <button
        disabled={blocked || selected.length === 0}
        onClick={() => onPreview(selected)}
      >
        Preview company source pass
      </button>
      <button disabled={blocked || !preview} onClick={run}>
        Run reviewed company source pass
      </button>
      {(busy || preview) && (
        <button className="trial-secondary" onClick={onCancel}>
          Cancel reviewed company source pass
        </button>
      )}
    </div>
  );
}
export function CompanySourcePassPlan({
  preview,
}: {
  preview: CompanySourcePassPreview | null;
}) {
  if (!preview) return null;
  const missing = preview.rows.filter(
    (row) => row.selected && row.disposition === "missing",
  );
  const order =
    missing.map((row) => row.label).join(" → ") || "No missing reads";
  const listing = preview.selection.listing;
  return (
    <p>
      Plan for {listing.issuerName} · {listing.symbol} ·{" "}
      {listing.shareClassName} · {listing.exchangeMic}. Read order: {order}.
    </p>
  );
}
export function CompanySourcePassResults({
  rows,
  message,
}: {
  rows: readonly CompanySourcePassRow[];
  message: string;
}) {
  return (
    <>
      {message && <p role="status">{message}</p>}
      {rows.length > 0 && (
        <ul className="managed-company-source-pass-results">
          {rows.map((row) => (
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
    </>
  );
}
