import {
  normalizeResearchFollowupCheck,
  parseManagedCpiHeadlines,
  type ManagedCpiHeadlineDto,
  type ManagedCpiHeadlinesDto,
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
      readonly kind: "cpi";
      readonly packet: ManagedCpiHeadlinesDto;
      readonly item: ManagedCpiHeadlineDto;
      readonly showingPrevious: boolean;
    }
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
  readonly timeKind: "scheduled" | "published" | "feed-published";
  readonly feedUpdatedAt?: string | null;
  readonly itemUpdatedAt?: string | null;
  readonly sourceId?: string;
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
type CalendarPacket = CalendarFollowupSource["packet"];
type ScheduledSource = Exclude<CalendarFollowupSource, { kind: "fed" | "cpi" }>;
type SourceFields = Pick<
  CalendarFollowupEvidence,
  "title" | "url" | "instant" | "timeKind" | "window"
>;
interface SourceAdapter<Packet extends CalendarPacket, Item> {
  readonly id: Packet["source"]["id"];
  readonly items: (packet: Packet) => readonly Item[];
  readonly key: (item: Item) => string;
  readonly capture: (
    packet: Packet,
    item: Item,
    showingPrevious: boolean,
  ) => CalendarFollowupSource;
  readonly describe: (packet: Packet, item: Item) => SourceFields;
}
function scheduledKey(kind: "bls" | "bea", item: ScheduledSource["item"]) {
  return `${kind}:${JSON.stringify([item.series, item.scheduledAt])}`;
}
function scheduledFields(
  packet: ScheduledSource["packet"],
  item: ScheduledSource["item"],
): SourceFields {
  return {
    title: item.series,
    url: packet.source.scheduleUrl,
    instant: item.scheduledAt,
    timeKind: "scheduled",
    window: packet.window,
  };
}
const blsAdapter: SourceAdapter<
  ManagedBlsCalendarDto,
  ManagedBlsCalendarEventDto
> = {
  id: "bls",
  items: (packet) => packet.events,
  key: (item) => scheduledKey("bls", item),
  capture: (packet, item, showingPrevious) => ({
    kind: "bls",
    packet,
    item,
    showingPrevious,
  }),
  describe: scheduledFields,
};
const beaAdapter: SourceAdapter<
  PersonalEconomicCalendarDto,
  PersonalEconomicCalendarEventDto
> = {
  id: "bea",
  items: (packet) => packet.events,
  key: (item) => scheduledKey("bea", item),
  capture: (packet, item, showingPrevious) => ({
    kind: "bea",
    packet,
    item,
    showingPrevious,
  }),
  describe: scheduledFields,
};
const fedAdapter: SourceAdapter<
  PersonalMonetaryAnnouncementsDto,
  PersonalMonetaryAnnouncementDto
> = {
  id: "federal-reserve-board",
  items: (packet) => packet.items,
  key: (item) => `fed:${item.url}`,
  capture: (packet, item, showingPrevious) => ({
    kind: "fed",
    packet,
    item,
    showingPrevious,
  }),
  describe: (_packet, item) => ({
    title: item.title,
    url: item.url,
    instant: item.publishedAt,
    timeKind: "published",
    window: null,
  }),
};
function resolveSource<Packet extends CalendarPacket, Item>(
  key: string,
  state: { readonly busy: boolean; readonly showingPrevious: boolean },
  packet: Packet | null,
  adapter: SourceAdapter<Packet, Item>,
): CalendarFollowupSource | null {
  if (state.busy || !packet) return null;
  const item = adapter.items(packet).find((row) => key === adapter.key(row));
  if (!item) return null;
  return Object.freeze(adapter.capture(packet, item, state.showingPrevious));
}
/** Resolve only the original item in one already admitted, idle source snapshot. */
export function resolveCalendarFollowupSource(
  key: string,
  snapshots: CalendarSnapshots,
): CalendarFollowupSource | null {
  if (key.startsWith("bls:"))
    return resolveSource(
      key,
      snapshots.bls,
      snapshots.bls.calendar,
      blsAdapter,
    );
  if (key.startsWith("bea:"))
    return resolveSource(key, snapshots.bea, snapshots.bea.agenda, beaAdapter);
  if (key.startsWith("fed:"))
    return resolveSource(
      key,
      snapshots.fed,
      snapshots.fed.announcements,
      fedAdapter,
    );
  return null;
}
function sourceEvidence<Packet extends CalendarPacket, Item>(
  source: {
    readonly packet: Packet;
    readonly item: Item;
    readonly showingPrevious: boolean;
  },
  adapter: SourceAdapter<Packet, Item>,
): CalendarFollowupEvidence | null {
  const { packet, item } = source;
  if (packet.source.id !== adapter.id || !adapter.items(packet).includes(item))
    return null;
  return Object.freeze({
    sourceName: packet.source.name,
    ...adapter.describe(packet, item),
    fetchedAt: packet.fetchedAt,
    showingPrevious: source.showingPrevious,
  });
}
/** Readout context preserves source/retrieval clocks; it does not infer company relevance. */
export function calendarFollowupEvidence(
  source: CalendarFollowupSource,
): CalendarFollowupEvidence | null {
  if (typeof source.showingPrevious !== "boolean") return null;
  if (source.kind === "cpi") {
    if (
      !parseManagedCpiHeadlines(source.packet) ||
      !source.packet.items.includes(source.item)
    )
      return null;
    return Object.freeze({
      sourceName: source.packet.source.name,
      title: source.item.title,
      url: source.item.url,
      instant: source.item.publishedAt,
      timeKind: "feed-published",
      itemUpdatedAt: source.item.updatedAt,
      feedUpdatedAt: source.packet.feedUpdatedAt,
      sourceId: source.item.sourceId,
      fetchedAt: source.packet.fetchedAt,
      window: null,
      showingPrevious: source.showingPrevious,
    });
  }
  if (source.kind === "fed") return sourceEvidence(source, fedAdapter);
  if (source.kind === "bls") return sourceEvidence(source, blsAdapter);
  if (source.kind === "bea") return sourceEvidence(source, beaAdapter);
  return null;
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
    source.kind === "cpi"
      ? `U.S. Bureau of Labor Statistics CPI headline: ${evidence.title}. Feed published: ${evidence.instant ?? "unknown"}; feed updated: ${evidence.itemUpdatedAt ?? "unknown"}. ${evidence.url}`
      : source.kind === "fed"
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
