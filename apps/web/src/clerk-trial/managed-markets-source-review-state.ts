import type {
  MarketsSourceOutcome,
  MarketsSourceReviewPort,
  MarketsSourceReviewRow,
  MarketsSourceView,
} from "./managed-markets-source-review-types";

interface RowState {
  source: MarketsSourceReviewPort;
  view: MarketsSourceView;
  selected: boolean;
  outcome: MarketsSourceOutcome | undefined;
}

/** Public evidence and choices exclude private operation tokens. */
export function sourceReviewRow({
  source,
  view,
  selected,
  outcome,
}: RowState): MarketsSourceReviewRow {
  return Object.freeze({
    id: source.id,
    label: view.label,
    identity: view.identity,
    eligible: view.eligible,
    busy: view.busy,
    loaded: view.loaded,
    evidence: view.evidence,
    selected,
    mode: view.loaded ? "refresh" : "load",
    outcome: outcome ?? (view.loaded ? "retained" : "not_attempted"),
  });
}
