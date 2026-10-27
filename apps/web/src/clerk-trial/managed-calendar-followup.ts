import {
  normalizeResearchFollowupCheck,
  type ManagedBlsCalendarDto,
  type ManagedBlsCalendarEventDto,
  type PersonalEconomicCalendarDto,
  type PersonalEconomicCalendarEventDto,
  type PersonalMonetaryAnnouncementDto,
  type PersonalMonetaryAnnouncementsDto,
  type ResearchFollowup,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedBeaReleaseAgendaState } from "./managed-bea-release-agenda";
import type { ManagedBlsCalendarState } from "./managed-bls-calendar";
import type { ManagedFedAnnouncementsState } from "./managed-fed-announcements";
import type {
  ManagedResearchFollowups,
  NextCheckCapture,
} from "./managed-research-followups";

export type CalendarFollowupSource =
  | {
      readonly kind: "bls";
      readonly packet: ManagedBlsCalendarDto;
      readonly item: ManagedBlsCalendarEventDto;
      readonly showingPrevious: boolean;
    }
  | {
      readonly kind: "bea";
      readonly packet: PersonalEconomicCalendarDto;
      readonly item: PersonalEconomicCalendarEventDto;
      readonly showingPrevious: boolean;
    }
  | {
      readonly kind: "fed";
      readonly packet: PersonalMonetaryAnnouncementsDto;
      readonly item: PersonalMonetaryAnnouncementDto;
      readonly showingPrevious: boolean;
    };
export interface CalendarSourceCapture {
  readonly source: CalendarFollowupSource;
  readonly isCurrent: () => boolean;
}
export interface CalendarFollowupPort extends CalendarSourceCapture {
  readonly model: Pick<
    ManagedResearchFollowups,
    "prepareNextCheck" | "createNextCheck"
  >;
  readonly member: WatchlistMembership;
}
export interface CalendarFollowupPreview {
  readonly check: string;
  readonly dueOn: string;
  readonly listing: NextCheckCapture["listing"];
  readonly isCurrent: () => boolean;
  readonly create: () => ResearchFollowup | null;
  readonly cancel: () => void;
}
export interface CalendarFollowupPreparation {
  readonly preview: CalendarFollowupPreview | null;
  readonly reason: string | null;
}
export interface CalendarFollowupEvidence {
  readonly sourceName: string;
  readonly title: string;
  readonly url: string;
  readonly instant: string | null;
  readonly timeKind: "scheduled" | "published";
  readonly fetchedAt: string;
  readonly window: {
    readonly fromInclusive: string;
    readonly toExclusive: string;
  } | null;
  readonly showingPrevious: boolean;
}
interface CalendarSnapshots {
  readonly bls: ManagedBlsCalendarState;
  readonly bea: ManagedBeaReleaseAgendaState;
  readonly fed: ManagedFedAnnouncementsState;
}
function resolveBls(
  key: string,
  state: ManagedBlsCalendarState,
): CalendarFollowupSource | null {
  const packet = state.calendar;
  if (state.busy || !packet) return null;
  const item = packet.events.find(
    (row) => key === `bls:${JSON.stringify([row.series, row.scheduledAt])}`,
  );
  if (!item) return null;
  return Object.freeze({
    kind: "bls",
    packet,
    item,
    showingPrevious: state.showingPrevious,
  });
}
function resolveBea(
  key: string,
  state: ManagedBeaReleaseAgendaState,
): CalendarFollowupSource | null {
  const packet = state.agenda;
  if (state.busy || !packet) return null;
  const item = packet.events.find(
    (row) => key === `bea:${JSON.stringify([row.series, row.scheduledAt])}`,
  );
  if (!item) return null;
  return Object.freeze({
    kind: "bea",
    packet,
    item,
    showingPrevious: state.showingPrevious,
  });
}
function resolveFed(
  key: string,
  state: ManagedFedAnnouncementsState,
): CalendarFollowupSource | null {
  const packet = state.announcements;
  if (state.busy || !packet) return null;
  const item = packet.items.find((row) => key === `fed:${row.url}`);
  if (!item) return null;
  return Object.freeze({
    kind: "fed",
    packet,
    item,
    showingPrevious: state.showingPrevious,
  });
}
/** Resolve only the original item in one already admitted, idle source snapshot. */
export function resolveCalendarFollowupSource(
  key: string,
  snapshots: CalendarSnapshots,
): CalendarFollowupSource | null {
  if (key.startsWith("bls:")) return resolveBls(key, snapshots.bls);
  if (key.startsWith("bea:")) return resolveBea(key, snapshots.bea);
  if (key.startsWith("fed:")) return resolveFed(key, snapshots.fed);
  return null;
}
function scheduledEvidence(
  source: Exclude<CalendarFollowupSource, { kind: "fed" }>,
): CalendarFollowupEvidence | null {
  const { packet, item } = source;
  if (packet.source.id !== source.kind || !packet.events.includes(item))
    return null;
  return Object.freeze({
    sourceName: packet.source.name,
    title: item.series,
    url: packet.source.scheduleUrl,
    instant: item.scheduledAt,
    timeKind: "scheduled",
    fetchedAt: packet.fetchedAt,
    window: packet.window,
    showingPrevious: source.showingPrevious,
  });
}
function announcementEvidence(
  source: Extract<CalendarFollowupSource, { kind: "fed" }>,
): CalendarFollowupEvidence | null {
  const { packet, item } = source;
  if (
    packet.source.id !== "federal-reserve-board" ||
    !packet.items.includes(item)
  )
    return null;
  return Object.freeze({
    sourceName: packet.source.name,
    title: item.title,
    url: item.url,
    instant: item.publishedAt,
    timeKind: "published",
    fetchedAt: packet.fetchedAt,
    window: null,
    showingPrevious: source.showingPrevious,
  });
}
/** Readout context preserves source/retrieval clocks; it does not infer company relevance. */
export function calendarFollowupEvidence(
  source: CalendarFollowupSource,
): CalendarFollowupEvidence | null {
  if (typeof source.showingPrevious !== "boolean") return null;
  if (source.kind === "fed") return announcementEvidence(source);
  return scheduledEvidence(source);
}
function validAuthoredQuestion(question: string) {
  if ([...question].length > 500) return false;
  if (/[\p{Cc}\p{Cf}\p{Cs}]/u.test(question)) return false;
  return normalizeResearchFollowupCheck(question) !== null;
}
function completeCheck(
  source: CalendarFollowupSource,
  question: string,
): string | null {
  if (!validAuthoredQuestion(question)) return null;
  const evidence = calendarFollowupEvidence(source);
  if (!evidence) return null;
  const citation =
    source.kind === "fed"
      ? `Fed announcement: ${evidence.title}; published ${evidence.instant ?? "unknown"}; ${evidence.url}`
      : `${source.kind.toUpperCase()} schedule: ${evidence.title}; scheduled ${evidence.instant}; ${evidence.url}`;
  const raw = `Question: ${question} | ${citation}`;
  if ([...raw].length > 500) return null;
  return normalizeResearchFollowupCheck(raw);
}
function samePort(port: CalendarFollowupPort, captured: CalendarFollowupPort) {
  return (
    port.model === captured.model &&
    port.member === captured.member &&
    port.source === captured.source &&
    port.isCurrent === captured.isCurrent
  );
}
function sourceFormIsCurrent(
  port: CalendarFollowupPort,
  captured: CalendarFollowupPort,
  formIsCurrent: () => boolean,
) {
  return (
    samePort(port, captured) &&
    captured.isCurrent() &&
    formIsCurrent() &&
    samePort(port, captured) &&
    captured.isCurrent()
  );
}
function permanentCurrent(
  port: CalendarFollowupPort,
  captured: CalendarFollowupPort,
  formIsCurrent: () => boolean,
) {
  let retired = false;
  let checking = false;
  return () => {
    if (retired || checking) return false;
    checking = true;
    try {
      retired = !sourceFormIsCurrent(port, captured, formIsCurrent);
      return !retired;
    } finally {
      checking = false;
    }
  };
}
function ownedPreview(
  model: CalendarFollowupPort["model"],
  capture: NextCheckCapture,
  current: () => boolean,
): CalendarFollowupPreview {
  let consumed = false;
  const preview: CalendarFollowupPreview = Object.freeze({
    check: capture.check,
    dueOn: capture.dueOn,
    listing: capture.listing,
    isCurrent() {
      return this === preview && !consumed && current() && !consumed;
    },
    cancel() {
      if (this === preview) consumed = true;
    },
    create() {
      if (this !== preview || consumed) return null;
      consumed = true;
      if (!current()) return null;
      return model.createNextCheck(capture, current);
    },
  });
  return preview;
}
const stale =
  "The source, company, question, date or drafts changed. Preview the current context again.";
const refuse = (reason: string): CalendarFollowupPreparation => ({
  preview: null,
  reason,
});
/** One complete source citation and independently chosen company/date, in the existing draft only. */
export function prepareCalendarFollowup(
  port: CalendarFollowupPort,
  rawQuestion: string,
  dueOn: string,
  formIsCurrent: () => boolean,
): CalendarFollowupPreparation {
  const captured = Object.freeze({ ...port });
  const current = permanentCurrent(port, captured, formIsCurrent);
  if (!current()) return refuse(stale);
  if (!calendarFollowupEvidence(captured.source))
    return refuse("Choose the exact item from the current loaded source.");
  const check = completeCheck(captured.source, rawQuestion);
  if (check === null)
    return refuse(
      "The complete question and source citation must fit within 500 characters on one line. Nothing was clipped or changed.",
    );
  const prepared = captured.model.prepareNextCheck(
    captured.member,
    check,
    dueOn,
  );
  if (!current()) return refuse(stale);
  if (!prepared.capture)
    return refuse(prepared.reason ?? "Review Follow-ups before creating.");
  return {
    preview: ownedPreview(captured.model, prepared.capture, current),
    reason: null,
  };
}
