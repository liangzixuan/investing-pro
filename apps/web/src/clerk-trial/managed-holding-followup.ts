import { type ResearchFollowup } from "@research-cockpit/contracts";
import type {
  HoldingCheckCapture,
  ManagedResearchFollowups,
} from "./managed-research-followups";

export interface HoldingFollowupPosition {
  readonly listing: ResearchFollowup["listing"];
  readonly shares: string;
  readonly totalCostBasisUsd: string | null;
  readonly confirmedOn: string;
}
export interface HoldingFollowupPort {
  readonly model: Pick<
    ManagedResearchFollowups,
    "prepareHoldingCheck" | "createHoldingCheck"
  >;
  readonly position: HoldingFollowupPosition;
  readonly isCurrent: () => boolean;
}
export interface HoldingFollowupPreview {
  readonly position: HoldingFollowupPosition;
  readonly check: string;
  readonly dueOn: string;
  readonly isCurrent: () => boolean;
  readonly create: () => ResearchFollowup | null;
  readonly cancel: () => void;
}
const stale =
  "The holding, question, date or drafts changed. Preview the current context again.";

export function holdingPositionsMatch(
  a: HoldingFollowupPosition,
  b: HoldingFollowupPosition,
) {
  return (
    a.shares === b.shares &&
    a.totalCostBasisUsd === b.totalCostBasisUsd &&
    a.confirmedOn === b.confirmedOn &&
    (Object.keys(a.listing) as (keyof ResearchFollowup["listing"])[]).every(
      (key) => a.listing[key] === b.listing[key],
    ) &&
    Object.keys(a.listing).length === Object.keys(b.listing).length
  );
}

/** The position is readout context only. Only the complete authored question is saved. */
export function prepareHoldingFollowup(
  port: HoldingFollowupPort,
  rawQuestion: string,
  dueOn: string,
  formIsCurrent: () => boolean,
): { preview: HoldingFollowupPreview | null; reason: string | null } {
  const current = holdingFormLifetime(port, formIsCurrent);
  if (!current()) return { preview: null, reason: stale };
  const prepared = port.model.prepareHoldingCheck(
    port.position,
    rawQuestion,
    dueOn,
  );
  if (!current()) return { preview: null, reason: stale };
  const capture = prepared.capture;
  if (!capture) return { preview: null, reason: prepared.reason };
  return { preview: ownedHoldingPreview(port, capture, current), reason: null };
}
function holdingFormLifetime(
  port: HoldingFollowupPort,
  formIsCurrent: () => boolean,
) {
  let retired = false;
  return () => {
    if (retired) return false;
    retired = !port.isCurrent() || !formIsCurrent() || !port.isCurrent();
    return !retired;
  };
}
function ownedHoldingPreview(
  port: HoldingFollowupPort,
  capture: HoldingCheckCapture,
  current: () => boolean,
): HoldingFollowupPreview {
  let consumed = false;
  const available = () => !consumed && current();
  const preview: HoldingFollowupPreview = Object.freeze({
    position: capture.position,
    check: capture.check,
    dueOn: capture.dueOn,
    isCurrent() {
      return this === preview && available();
    },
    cancel() {
      if (this === preview) consumed = true;
    },
    create() {
      if (this !== preview || !available()) return null;
      consumed = true;
      return port.model.createHoldingCheck(capture, current);
    },
  });
  return preview;
}
