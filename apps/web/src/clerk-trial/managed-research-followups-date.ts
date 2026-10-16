import type { ResearchFollowup } from "@research-cockpit/contracts";

export interface ResearchFollowupDueGroups {
  readonly assessedOn: string;
  readonly overdue: readonly ResearchFollowup[];
  readonly today: readonly ResearchFollowup[];
  readonly later: readonly ResearchFollowup[];
  readonly completed: readonly ResearchFollowup[];
  readonly invalidDates: readonly ResearchFollowup[];
}

export function isResearchFollowupDueDate(value: string): boolean {
  if (!/^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
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
    invalidDates: ResearchFollowup[];
  } = { overdue: [], today: [], later: [], completed: [], invalidDates: [] };
  for (const entry of entries) {
    if (!isResearchFollowupDueDate(entry.dueOn))
      groups.invalidDates.push(entry);
    else if (entry.status === "completed") groups.completed.push(entry);
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
    invalidDates: Object.freeze(groups.invalidDates),
  });
}
