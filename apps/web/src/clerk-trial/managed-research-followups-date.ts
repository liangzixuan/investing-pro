import type { ResearchFollowup } from "@research-cockpit/contracts";

export interface ResearchFollowupDueGroups {
  readonly assessedOn: string;
  readonly overdue: readonly ResearchFollowup[];
  readonly today: readonly ResearchFollowup[];
  readonly later: readonly ResearchFollowup[];
  readonly completed: readonly ResearchFollowup[];
}

/** The caller captures the assessment clock; grouping never reads a new clock. */
export function groupResearchFollowupsByDueDate(
  entries: readonly ResearchFollowup[],
  assessmentClock: Date,
): Readonly<ResearchFollowupDueGroups> | null {
  if (!Number.isFinite(assessmentClock.getTime())) return null;
  const year = assessmentClock.getUTCFullYear();
  if (year < 1 || year > 9999) return null;
  const assessedOn = assessmentClock.toISOString().slice(0, 10);
  const groups: {
    overdue: ResearchFollowup[];
    today: ResearchFollowup[];
    later: ResearchFollowup[];
    completed: ResearchFollowup[];
  } = { overdue: [], today: [], later: [], completed: [] };
  for (const entry of entries) {
    if (entry.status === "completed") groups.completed.push(entry);
    else if (entry.dueOn < assessedOn) groups.overdue.push(entry);
    else if (entry.dueOn === assessedOn) groups.today.push(entry);
    else groups.later.push(entry);
  }
  return Object.freeze({
    assessedOn,
    overdue: Object.freeze(groups.overdue),
    today: Object.freeze(groups.today),
    later: Object.freeze(groups.later),
    completed: Object.freeze(groups.completed),
  });
}
