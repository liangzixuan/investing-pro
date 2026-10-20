import {
  MANAGED_BLS_CALENDAR_LIMITS,
  MANAGED_BLS_CALENDAR_SOURCE,
  parseManagedBlsCalendar,
  type ManagedBlsCalendarDto,
} from "@research-cockpit/contracts";
import { async as ical, type VEvent } from "node-ical";

const MAX_INPUT_EVENTS = 4_096;
const ZONE = "America/New_York";
// BLS's legacy TZID is admitted only with this complete post-2007 declaration.
const PUBLISHER_ZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:US-Eastern",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "DTSTART:20070311T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "TZNAME:EDT",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "DTSTART:20071104T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "TZNAME:EST",
  "END:STANDARD",
  "END:VTIMEZONE",
];
const EVENT_FIELDS = new Set([
  "UID",
  "DTSTART",
  "DTEND",
  "DTSTAMP",
  "CREATED",
  "LAST-MODIFIED",
  "SUMMARY",
  "STATUS",
  "DURATION",
  "SEQUENCE",
  "CLASS",
  "TRANSP",
  "CATEGORIES",
  "LOCATION",
  "DESCRIPTION",
  "URL",
  "X-ALT-DESC",
]);
const CALENDAR_FIELDS = new Map<string, readonly string[] | null>([
  ["PRODID", null],
  ["VERSION", ["2.0"]],
  ["CALSCALE", ["GREGORIAN"]],
  ["METHOD", ["PUBLISH"]],
  ["SUMMARY", null],
  ["X-WR-CALNAME", null],
  ["X-WR-TIMEZONE", ["US-Eastern", ZONE, "UTC"]],
]);
interface CalendarProperty {
  name: string;
  header: string;
  value: string;
}
type EventFields = Map<string, CalendarProperty>;
interface AdmittedDate {
  wall: string;
  utc: boolean;
}
interface EventInventory extends AdmittedDate {
  uid: string;
  cancelled: boolean;
  parserLines: readonly string[];
}
interface SourceProfile {
  readonly lines: readonly string[];
  readonly calendarFields: Set<string>;
  readonly uids: Set<string>;
  readonly events: EventInventory[];
  position: number;
  legacyEasternAdmitted: boolean;
}
type CalendarEvent = ManagedBlsCalendarDto["events"][number];

function requireValue(condition: unknown): asserts condition {
  if (!condition) throw new Error("Invalid BLS schedule");
}
function wallTime(value: string): string {
  requireValue(/^\d{8}T\d{6}$/u.test(value));
  const wall = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}`;
  const date = new Date(wall + "Z");
  requireValue(
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === wall,
  );
  return wall;
}
const localFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
function localWall(date: Date): string {
  const parts = Object.fromEntries(
    localFormat.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function calendarLines(text: string): string[] {
  requireValue(Buffer.byteLength(text, "utf8") <= 256 * 1_024);
  requireValue(!/\r(?!\n)/u.test(text));
  const lines = text
    .replaceAll("\r\n", "\n")
    .replace(/\n[ \t]/gu, "")
    .split("\n")
    .filter((line) => line !== "");
  requireValue(
    lines.shift() === "BEGIN:VCALENDAR" && lines.pop() === "END:VCALENDAR",
  );
  return lines;
}

function admitCalendarProperty(profile: SourceProfile): void {
  const line = profile.lines[profile.position];
  requireValue(line !== undefined);
  const match = /^([A-Z][A-Z0-9-]*):(.*)$/u.exec(line);
  requireValue(match !== null);
  const name = match[1],
    value = match[2];
  requireValue(name !== undefined && value !== undefined);
  requireValue(!profile.calendarFields.has(name) && CALENDAR_FIELDS.has(name));
  const allowed = CALENDAR_FIELDS.get(name);
  if (allowed) requireValue(allowed.includes(value));
  profile.calendarFields.add(name);
}

function admitEventProperty(line: string, fields: EventFields): void {
  const match = /^([A-Z][A-Z0-9-]*)(;[^:]*)?:(.*)$/u.exec(line);
  requireValue(match !== null);
  const name = match[1],
    value = match[3],
    parameters = match[2];
  requireValue(name !== undefined && value !== undefined);
  requireValue(EVENT_FIELDS.has(name) && !fields.has(name));
  // Only DTSTART/DTEND support parameters in this publisher profile.
  if (parameters) requireValue(["DTSTART", "DTEND"].includes(name));
  fields.set(name, { name, header: name + (parameters ?? ""), value });
}

function eventFields(profile: SourceProfile): EventFields {
  const fields: EventFields = new Map();
  profile.position++;
  while (profile.lines[profile.position] !== "END:VEVENT") {
    const line = profile.lines[profile.position];
    requireValue(line !== undefined);
    admitEventProperty(line, fields);
    profile.position++;
  }
  return fields;
}

function admitDate(
  date: CalendarProperty,
  profile: SourceProfile,
): AdmittedDate {
  const name = date.name;
  const utc = date.header === name && /^\d{8}T\d{6}Z$/u.test(date.value);
  if (utc) return { utc, wall: wallTime(date.value.slice(0, -1)) };
  requireValue(["DTSTART", "DTEND"].includes(name));
  const legacy = date.header === `${name};TZID=US-Eastern`;
  requireValue(legacy || date.header === `${name};TZID=${ZONE}`);
  if (legacy)
    requireValue(
      profile.legacyEasternAdmitted && Number(date.value.slice(0, 4)) >= 2007,
    );
  return { utc, wall: wallTime(date.value) };
}

function admitUid(fields: EventFields, seen: Set<string>): string {
  const uid = fields.get("UID")?.value;
  requireValue(uid !== undefined && uid.length > 0);
  requireValue(uid.length <= 256 && !/[\s\\\p{Cc}\p{Cf}\p{Cs}]/u.test(uid));
  requireValue(!seen.has(uid));
  seen.add(uid);
  return uid;
}

function admitEvent(
  fields: EventFields,
  profile: SourceProfile,
): EventInventory {
  const uid = admitUid(fields, profile.uids);
  const summary = fields.get("SUMMARY")?.value,
    start = fields.get("DTSTART");
  requireValue(summary !== undefined && start !== undefined);
  const status = fields.get("STATUS")?.value;
  if (status !== undefined)
    requireValue(["CONFIRMED", "CANCELLED"].includes(status));
  const date = admitDate(start, profile);
  for (const name of ["DTEND", "DTSTAMP", "CREATED", "LAST-MODIFIED"]) {
    const property = fields.get(name);
    if (property) admitDate(property, profile);
  }
  const startLine = date.utc
    ? `DTSTART:${start.value}`
    : `DTSTART;TZID=${ZONE}:${start.value}`;
  // Ignore publisher HTML, links and non-scheduling payloads. No URL/file parser API.
  return {
    uid,
    ...date,
    cancelled: status === "CANCELLED",
    parserLines: [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      startLine,
      `SUMMARY:${summary}`,
      "END:VEVENT",
    ],
  };
}

function sourceInventory(text: string): EventInventory[] {
  const profile: SourceProfile = {
    lines: calendarLines(text),
    calendarFields: new Set(),
    uids: new Set(),
    events: [],
    position: 0,
    legacyEasternAdmitted: false,
  };
  while (profile.position < profile.lines.length) {
    const line = profile.lines[profile.position];
    requireValue(line !== undefined);
    if (line === "BEGIN:VTIMEZONE") {
      requireValue(
        !profile.legacyEasternAdmitted && profile.events.length === 0,
      );
      requireValue(
        PUBLISHER_ZONE.every(
          (expected, offset) =>
            profile.lines[profile.position + offset] === expected,
        ),
      );
      profile.position += PUBLISHER_ZONE.length - 1;
      profile.legacyEasternAdmitted = true;
    } else if (line === "BEGIN:VEVENT") {
      const fields = eventFields(profile);
      requireValue(profile.events.length < MAX_INPUT_EVENTS);
      profile.events.push(admitEvent(fields, profile));
    } else {
      requireValue(profile.events.length === 0);
      admitCalendarProperty(profile);
    }
    profile.position++;
  }
  requireValue(
    profile.calendarFields.has("VERSION") && profile.events.length > 0,
  );
  return profile.events;
}

async function parseInventory(
  inventory: readonly EventInventory[],
): Promise<Map<string, VEvent>> {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    ...inventory.flatMap((event) => event.parserLines),
    "END:VCALENDAR",
  ];
  const parsed = await ical.parseICS(lines.join("\r\n"));
  const events = Object.values(parsed).filter(
    (event): event is VEvent => event?.type === "VEVENT",
  );
  requireValue(events.length === inventory.length);
  const byUid = new Map(events.map((event) => [event.uid, event]));
  requireValue(byUid.size === inventory.length);
  return byUid;
}

function parsedSeries(event: VEvent): string {
  requireValue(typeof event.summary === "string");
  requireValue(
    event.summary.length <= MANAGED_BLS_CALENDAR_LIMITS.seriesLength,
  );
  requireValue(!/[\p{Cc}\p{Cf}\p{Cs}]/u.test(event.summary));
  const series = event.summary.trim();
  requireValue(series.length > 0);
  return series;
}

function parsedInstant(event: VEvent, input: EventInventory): string {
  requireValue(event.start instanceof Date);
  requireValue(!event.start.dateOnly && event.datetype === "date-time");
  const instant = event.start.toISOString();
  if (input.utc) requireValue(instant.slice(0, 19) === input.wall);
  else {
    requireValue(localWall(event.start) === input.wall);
    // An ambiguous fall-back local time has two instants; do not guess which.
    requireValue(
      [-3_600_000, 3_600_000].every(
        (delta) =>
          localWall(new Date(event.start.getTime() + delta)) !== input.wall,
      ),
    );
  }
  return instant;
}

function compareEvents(left: CalendarEvent, right: CalendarEvent): number {
  for (const field of ["scheduledAt", "series"] as const) {
    if (left[field] < right[field]) return -1;
    if (left[field] > right[field]) return 1;
  }
  return 0;
}

function windowEvents(
  inventory: readonly EventInventory[],
  parsed: ReadonlyMap<string, VEvent>,
  from: Date,
  to: Date,
): CalendarEvent[] {
  const events: CalendarEvent[] = [],
    seen = new Set<string>();
  for (const input of inventory) {
    const event = parsed.get(input.uid);
    requireValue(event !== undefined);
    const series = parsedSeries(event),
      scheduledAt = parsedInstant(event, input);
    if (input.cancelled) continue;
    if (event.start < from || event.start >= to) continue;
    const key = JSON.stringify([series, scheduledAt]);
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({ series, scheduledAt });
    requireValue(events.length <= MANAGED_BLS_CALENDAR_LIMITS.events);
  }
  return events.sort(compareEvents);
}

/** Validate BLS's publisher profile; node-ical remains the date/text parser. */
export async function normalizeBlsCalendar(
  text: string,
  fetchedAt: string,
): Promise<ManagedBlsCalendarDto> {
  const inventory = sourceInventory(text),
    parsed = await parseInventory(inventory);
  const from = new Date(fetchedAt),
    to = new Date(
      from.getTime() + MANAGED_BLS_CALENDAR_LIMITS.windowDays * 86_400_000,
    );
  const result = parseManagedBlsCalendar({
    schemaVersion: "1.0.0",
    source: MANAGED_BLS_CALENDAR_SOURCE,
    fetchedAt,
    window: { fromInclusive: fetchedAt, toExclusive: to.toISOString() },
    events: windowEvents(inventory, parsed, from, to),
  });
  requireValue(result);
  return result;
}
