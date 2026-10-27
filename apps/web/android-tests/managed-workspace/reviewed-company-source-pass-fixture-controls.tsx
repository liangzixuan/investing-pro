import { encodeMainWatchlistPayload } from "@research-cockpit/contracts";
import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { NativeInterimStatementsMetadata } from "./interim-statements-fixture";
import type { ReviewedCompanySourcePassControls } from "./reviewed-company-source-pass-fixture";

/** Only invented setup, a cancelled late reply and read-only observations live outside the product frame. */
export function ReviewedCompanySourcePassFixtureControls({
  workspace,
  controls,
  metadata,
}: {
  workspace: ManagedWorkspace;
  controls: ReviewedCompanySourcePassControls;
  metadata: NativeInterimStatementsMetadata;
}) {
  const counts = useSyncExternalStore(controls.subscribe, controls.getSnapshot);
  const draft = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
  );
  const price = useSyncExternalStore(
    workspace.eod.subscribe,
    workspace.eod.getSnapshot,
  );
  const annual = useSyncExternalStore(
    workspace.annual.subscribe,
    workspace.annual.getSnapshot,
  );
  const filings = useSyncExternalStore(
    workspace.filings.subscribe,
    workspace.filings.getSnapshot,
  );
  const interim = useSyncExternalStore(
    workspace.interim.subscribe,
    workspace.interim.getSnapshot,
  );
  const pass = useSyncExternalStore(
    workspace.companySourcePass.subscribe,
    workspace.companySourcePass.getSnapshot,
  );
  return (
    <aside aria-label="Invented reviewed company source pass controls">
      <button
        id="fixture-company-pass-author-note"
        disabled={draft.baseVersion !== 1 || draft.dirty}
        onClick={() => workspace.note("listing-zero", metadata.prefix)}
      >
        Author invented company source pass note
      </button>
      <button
        id="fixture-company-pass-settle-late"
        disabled={counts.aborted !== 1 || counts.late !== 0}
        onClick={controls.settleCancelledAnnual}
      >
        Settle cancelled invented company pass Annual
      </button>
      <pre id="fixture-company-pass-evidence" hidden>
        {JSON.stringify({
          counts,
          pass,
          draft: draft.draft,
          encodedDraft: draft.draft
            ? encodeMainWatchlistPayload(draft.draft)
            : null,
          price: price.response,
          annual: annual.response,
          filings: filings.response,
          interim: interim.response,
          annualRunning: annual.running,
        })}
      </pre>
    </aside>
  );
}
