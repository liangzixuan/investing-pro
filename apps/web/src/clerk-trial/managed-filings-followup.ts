import {
  membershipMatchesResult,
  normalizeResearchFollowupCheck,
  type ManagedSecFilingsResponseDto,
  type PersonalSecRecentFilingDto,
  type ResearchFollowup,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type {
  ManagedResearchFollowups,
  NextCheckCapture,
} from "./managed-research-followups";

export interface FilingsFollowupPort {
  readonly model: Pick<
    ManagedResearchFollowups,
    "prepareNextCheck" | "createNextCheck"
  >;
  readonly member: WatchlistMembership;
  readonly response: ManagedSecFilingsResponseDto;
  readonly filing: PersonalSecRecentFilingDto;
  readonly showingPrevious: boolean;
  /** Captures the source snapshot, both SaveStates, catalog and current visit. */
  readonly isCurrent: () => boolean;
}
export interface FilingsFollowupPreview {
  readonly check: string;
  readonly dueOn: string;
  readonly listing: NextCheckCapture["listing"];
  readonly isCurrent: () => boolean;
  readonly create: () => ResearchFollowup | null;
  readonly cancel: () => void;
}
export interface FilingsFollowupPreparation {
  readonly preview: Readonly<FilingsFollowupPreview> | null;
  readonly reason: string | null;
}
const stale =
  "The filing, question, date or drafts changed. Preview the current context again.";
const refuse = (reason: string): FilingsFollowupPreparation => ({
  preview: null,
  reason,
});

function sourceReason(port: FilingsFollowupPort): string | null {
  const { response, filing, member } = port;
  if (response.issuer.status !== "available")
    return "Choose a filing from an available, already loaded SEC result.";
  if (!response.issuer.filings.includes(filing))
    return "Choose the exact filing from the current loaded SEC result.";
  if (!membershipMatchesResult(member, response.security))
    return "Use the exact current company and share class for this filing.";
  return null;
}
function completeCheck(
  port: FilingsFollowupPort,
  question: string,
): string | null {
  if ([...question].length > 500) return null;
  if (/[\p{Cc}\p{Cf}\p{Cs}]/u.test(question)) return null;
  if (normalizeResearchFollowupCheck(question) === null) return null;
  const { filing } = port;
  const raw = `Question: ${question} | SEC filing metadata: Form ${filing.form}; accession ${filing.accessionNumber}; filed ${filing.filingDate}; ${filing.sourceUrl}`;
  if ([...raw].length > 500) return null;
  return normalizeResearchFollowupCheck(raw);
}
function permanentCurrent(
  port: FilingsFollowupPort,
  formIsCurrent: () => boolean,
): () => boolean {
  let retired = false;
  return () => {
    if (retired) return false;
    retired = !port.isCurrent() || !formIsCurrent() || !port.isCurrent();
    return !retired;
  };
}
function consumeOnce(
  port: FilingsFollowupPort,
  capture: NextCheckCapture,
  current: () => boolean,
): Readonly<FilingsFollowupPreview> {
  let consumed = false;
  const available = () => !consumed && current();
  return Object.freeze({
    check: capture.check,
    dueOn: capture.dueOn,
    listing: capture.listing,
    isCurrent: available,
    cancel: () => {
      consumed = true;
    },
    create() {
      if (!available()) return null;
      consumed = true;
      return port.model.createNextCheck(capture, current);
    },
  });
}

/** Explicit, complete metadata citation in the independent Follow-ups draft. */
export function prepareFilingsFollowup(
  port: FilingsFollowupPort,
  question: string,
  dueOn: string,
  formIsCurrent: () => boolean,
): FilingsFollowupPreparation {
  const current = permanentCurrent(port, formIsCurrent);
  if (!current()) return refuse(stale);
  const source = sourceReason(port);
  if (source) return refuse(source);
  const check = completeCheck(port, question);
  if (check === null)
    return refuse(
      "The complete question and filing citation must fit within 500 characters on one line. Nothing was clipped or changed.",
    );
  const prepared = port.model.prepareNextCheck(port.member, check, dueOn);
  if (!current()) return refuse(stale);
  if (!prepared.capture)
    return refuse(prepared.reason ?? "Review Follow-ups before creating.");
  if (prepared.capture.digest !== port.response.catalogSnapshotSha256)
    return refuse(stale);
  return {
    preview: consumeOnce(port, prepared.capture, current),
    reason: null,
  };
}
