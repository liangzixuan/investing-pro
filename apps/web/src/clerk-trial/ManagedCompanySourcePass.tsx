import { useState, useSyncExternalStore } from "react";
import type {
  ManagedCompanySourcePass as SourcePassModel,
  CompanySourcePassPreview,
} from "./managed-company-source-pass";
import type { CompanySnapshotLoadSource } from "./managed-company-snapshot-load-sources";
import "./managed-company-source-pass.css";

import {
  CompanySourcePassChoices,
  CompanySourcePassActions,
  CompanySourcePassPlan,
  CompanySourcePassResults,
} from "./ManagedCompanySourcePassControls";

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
      <CompanySourcePassChoices
        selected={selected}
        blocked={busy || navigationPending}
        onChange={(names) => {
          onClear();
          setSelected(names);
        }}
      />
      <CompanySourcePassActions
        blocked={busy || navigationPending}
        busy={busy}
        selected={selected}
        preview={preview}
        onPreview={onPreview}
        onRun={onRun}
        onCancel={onCancel}
      />
      <CompanySourcePassPlan preview={preview} />
      <CompanySourcePassResults rows={state.rows} message={state.message} />
    </section>
  );
}
