import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { FollowupsEvidenceControls } from "./followups-review-evidence-fixture";
import { evidenceAssessments } from "./followups-review-evidence-fixture";

/** Read-only invented data bridge; it exposes no model actions. */
export function FollowupsEvidenceDiagnostics({
  workspace: w,
  fixture: f,
}: {
  workspace: ManagedWorkspace;
  fixture: FollowupsEvidenceControls;
}) {
  const counts = useSyncExternalStore(f.subscribe, f.getSnapshot),
    view = useSyncExternalStore(w.subscribe, w.getSnapshot),
    review = useSyncExternalStore(
      w.followupsReview.subscribe,
      w.followupsReview.getSnapshot,
    ),
    evidence = useSyncExternalStore(
      w.reviewEvidence.subscribe,
      w.reviewEvidence.getSnapshot,
    ),
    pass = useSyncExternalStore(
      w.companySourcePass.subscribe,
      w.companySourcePass.getSnapshot,
    ),
    followups = useSyncExternalStore(
      w.followups.coordinator.subscribe,
      w.followups.coordinator.getSnapshot,
    ),
    watchlist = useSyncExternalStore(
      w.coordinator.subscribe,
      w.coordinator.getSnapshot,
    );
  return (
    <pre id="fixture-followups-evidence" hidden>
      {JSON.stringify({
        counts,
        view,
        review,
        evidence,
        pass,
        followups,
        watchlist,
        original: f.original,
        assessments: evidenceAssessments,
        saved: f.saved(),
        packets: {
          price: f.price,
          annual: f.annual,
          filings: f.filings,
          interim: f.interim,
        },
      })}
    </pre>
  );
}
