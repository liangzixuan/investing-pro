import {
  membershipMatchesResult,
  normalizeResearchFollowupCheck,
  type ResearchFollowup,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type {
  ManagedResearchFollowups,
  NextCheckCapture,
} from "./managed-research-followups";
import {
  resolveValuationFollowupScenario,
  type ValuationFollowupScenarioSummary,
} from "./managed-valuation-followup-scenario";
import {
  captureValuationCalculationGuard,
  type ManagedValuationCalculation,
} from "./managed-valuation-workbench";
export {
  resolveValuationFollowupScenario,
  type ValuationFollowupScenarioSummary,
  type ValuationFollowupScenarioResolution,
} from "./managed-valuation-followup-scenario";

export interface ValuationFollowupPort {
  readonly model: Pick<
    ManagedResearchFollowups,
    "prepareNextCheck" | "createNextCheck"
  >;
  readonly member: WatchlistMembership;
  readonly calculation: ManagedValuationCalculation;
  readonly isCurrent: () => boolean;
}
export interface ValuationFollowupPreview {
  readonly summary: ValuationFollowupScenarioSummary;
  readonly listing: NextCheckCapture["listing"];
  readonly catalogSnapshotSha256: NextCheckCapture["digest"];
  readonly check: string;
  readonly dueOn: string;
  readonly isCurrent: () => boolean;
  readonly create: () => ResearchFollowup | null;
  readonly cancel: () => void;
}
export interface ValuationFollowupPreparation {
  readonly preview: ValuationFollowupPreview | null;
  readonly reason: string | null;
}
const stale =
  "The scenario, question, date or research context changed. Preview the current check again.";
const refuse = (reason: string): ValuationFollowupPreparation => ({
  preview: null,
  reason,
});

/** Compose only the saved authored summary; full model inputs remain separate. */
function completeCheck(
  question: string,
  summary: ValuationFollowupScenarioSummary,
) {
  if (typeof question !== "string" || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(question))
    return null;
  if (normalizeResearchFollowupCheck(question) === null) return null;
  const raw = `Question: ${question} | ${summary.text}`;
  if ([...raw].length > 500) return null;
  return normalizeResearchFollowupCheck(raw);
}
function permanentCurrent(
  calculationCurrent: () => boolean,
  hostCurrent: () => boolean,
  formCurrent: () => boolean,
) {
  let retired = false;
  const contextMatches = () => {
    if (!calculationCurrent()) return false;
    if (!hostCurrent()) return false;
    if (!formCurrent()) return false;
    if (!hostCurrent()) return false;
    return calculationCurrent();
  };
  return () => {
    if (retired) return false;
    try {
      retired = !contextMatches();
    } catch {
      retired = true;
    }
    return !retired;
  };
}
function ownedPreview(
  summary: ValuationFollowupScenarioSummary,
  capture: NextCheckCapture,
  current: () => boolean,
  create: (
    capture: NextCheckCapture,
    current: () => boolean,
  ) => ResearchFollowup | null,
): ValuationFollowupPreview {
  let consumed = false;
  const available = () => !consumed && current();
  const preview: ValuationFollowupPreview = Object.freeze({
    summary,
    listing: capture.listing,
    catalogSnapshotSha256: capture.digest,
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
      try {
        return create(capture, current);
      } catch {
        return null;
      }
    },
  });
  return preview;
}

export function prepareValuationFollowup(
  port: ValuationFollowupPort,
  model: string,
  scenario: string,
  question: string,
  dueOn: string,
  formIsCurrent: () => boolean,
): ValuationFollowupPreparation {
  const { calculation, member, isCurrent } = port;
  const prepare = port.model.prepareNextCheck.bind(port.model);
  const create = port.model.createNextCheck.bind(port.model);
  const guard = captureValuationCalculationGuard(calculation);
  const current = permanentCurrent(
    () => Boolean(guard?.()),
    isCurrent,
    formIsCurrent,
  );
  if (!current()) return refuse(stale);
  if (!membershipMatchesResult(member, calculation.owner.listing))
    return refuse(
      "Use the exact current Watchlist company and share class for this scenario.",
    );
  const selected = resolveValuationFollowupScenario(
    calculation,
    model,
    scenario,
  );
  if (!selected.summary) return refuse(selected.reason!);
  const check = completeCheck(question, selected.summary);
  if (check === null)
    return refuse(
      "The complete question and scenario summary must fit within 500 characters on one line. Nothing was clipped or changed.",
    );
  const prepared = prepare(member, check, dueOn);
  if (!current()) return refuse(stale);
  if (!prepared.capture)
    return refuse(prepared.reason ?? "Review Follow-ups before creating.");
  if (prepared.capture.digest !== calculation.owner.catalogSnapshotSha256)
    return refuse(stale);
  return {
    preview: ownedPreview(selected.summary, prepared.capture, current, create),
    reason: null,
  };
}
