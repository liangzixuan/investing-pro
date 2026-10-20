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
interface EventInventory {
  uid: string;
  wall: string;
  utc: boolean;
  cancelled: boolean;
}
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

/** Validate BLS's publisher profile; node-ical remains the date/text parser. */
export async function normalizeBlsCalendar(
  text: string,
  fetchedAt: string,
): Promise<ManagedBlsCalendarDto> {
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
  const inventory: EventInventory[] = [];
  const uids = new Set<string>(),
    calendarFields = new Set<string>();
  const normalized = ["BEGIN:VCALENDAR", "VERSION:2.0"];
  let aliasAdmitted = false,
    inEvents = false;
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    requireValue(line !== undefined);
    if (line === "BEGIN:VTIMEZONE") {
      requireValue(!aliasAdmitted && !inEvents);
      requireValue(
        PUBLISHER_ZONE.every(
          (expected, offset) => lines[n + offset] === expected,
        ),
      );
      n += PUBLISHER_ZONE.length - 1;
      aliasAdmitted = true;
      continue;
    }
    if (line !== "BEGIN:VEVENT") {
      requireValue(!inEvents);
      const match = /^([A-Z][A-Z0-9-]*):(.*)$/u.exec(line);
      requireValue(match && match[1] && match[2] !== undefined);
      const [, name, value] = match;
      requireValue(name !== undefined && !calendarFields.has(name));
      calendarFields.add(name);
      requireValue(
        [
          "PRODID",
          "VERSION",
          "CALSCALE",
          "METHOD",
          "SUMMARY",
          "X-WR-CALNAME",
          "X-WR-TIMEZONE",
        ].includes(name),
      );
      if (name === "VERSION") requireValue(value === "2.0");
      if (name === "CALSCALE") requireValue(value === "GREGORIAN");
      if (name === "METHOD") requireValue(value === "PUBLISH");
      if (name === "X-WR-TIMEZONE")
        requireValue(
          value === "US-Eastern" || value === ZONE || value === "UTC",
        );
      continue;
    }
    inEvents = true;
    const fields = new Map<string, { header: string; value: string }>();
    while (lines[++n] !== "END:VEVENT") {
      const property = lines[n];
      requireValue(property !== undefined);
      const match = /^([A-Z][A-Z0-9-]*)(;[^:]*)?:(.*)$/u.exec(property);
      requireValue(match && match[1] && match[3] !== undefined);
      const name = match[1];
      requireValue(EVENT_FIELDS.has(name) && !fields.has(name));
      // Only DTSTART/DTEND support parameters in this publisher profile.
      requireValue(!match[2] || name === "DTSTART" || name === "DTEND");
      fields.set(name, { header: name + (match[2] ?? ""), value: match[3] });
    }
    requireValue(inventory.length < MAX_INPUT_EVENTS);
    const uid = fields.get("UID")?.value,
      summary = fields.get("SUMMARY")?.value;
    const start = fields.get("DTSTART"),
      status = fields.get("STATUS")?.value;
    requireValue(
      uid &&
        uid.length <= 256 &&
        !/[\s\\\p{Cc}\p{Cf}\p{Cs}]/u.test(uid) &&
        !uids.has(uid),
    );
    requireValue(summary !== undefined && start !== undefined);
    requireValue(
      status === undefined || status === "CONFIRMED" || status === "CANCELLED",
    );
    uids.add(uid);
    let wall = "",
      utc = false,
      startLine = "";
    for (const name of [
      "DTSTART",
      "DTEND",
      "DTSTAMP",
      "CREATED",
      "LAST-MODIFIED",
    ]) {
      const date = fields.get(name);
      if (!date) continue;
      const isUtc = date.header === name && /^\d{8}T\d{6}Z$/u.test(date.value);
      const legacy = date.header === `${name};TZID=US-Eastern`;
      const eastern = date.header === `${name};TZID=${ZONE}`;
      requireValue(
        isUtc ||
          ((legacy || eastern) && (name === "DTSTART" || name === "DTEND")),
      );
      if (legacy)
        requireValue(aliasAdmitted && Number(date.value.slice(0, 4)) >= 2007);
      const dateWall = wallTime(isUtc ? date.value.slice(0, -1) : date.value);
      if (name === "DTSTART") {
        wall = dateWall;
        utc = isUtc;
        startLine = isUtc
          ? `DTSTART:${date.value}`
          : `DTSTART;TZID=${ZONE}:${date.value}`;
      }
    }
    inventory.push({ uid, wall, utc, cancelled: status === "CANCELLED" });
    // Ignore publisher HTML, links and non-scheduling payloads. No URL/file parser API.
    normalized.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      startLine,
      `SUMMARY:${summary}`,
      "END:VEVENT",
    );
  }
  requireValue(calendarFields.has("VERSION") && inventory.length > 0);
  normalized.push("END:VCALENDAR");
  const parsed = await ical.parseICS(normalized.join("\r\n"));
  const parsedEvents = Object.values(parsed).filter(
    (event): event is VEvent => event?.type === "VEVENT",
  );
  requireValue(parsedEvents.length === inventory.length);
  const byUid = new Map(parsedEvents.map((event) => [event.uid, event]));
  requireValue(byUid.size === inventory.length);
  const from = new Date(fetchedAt),
    to = new Date(
      from.getTime() + MANAGED_BLS_CALENDAR_LIMITS.windowDays * 86_400_000,
    );
  const events: { series: string; scheduledAt: string }[] = [],
    seen = new Set<string>();
  for (const input of inventory) {
    const event = byUid.get(input.uid);
    requireValue(
      event &&
        event.start instanceof Date &&
        !event.start.dateOnly &&
        event.datetype === "date-time",
    );
    requireValue(
      typeof event.summary === "string" &&
        event.summary.length <= MANAGED_BLS_CALENDAR_LIMITS.seriesLength &&
        !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(event.summary),
    );
    const series = event.summary.trim();
    requireValue(series.length > 0);
    const scheduledAt = event.start.toISOString();
    if (input.utc) requireValue(scheduledAt.slice(0, 19) === input.wall);
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
    if (input.cancelled || event.start < from || event.start >= to) continue;
    const key = JSON.stringify([series, scheduledAt]);
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({ series, scheduledAt });
    requireValue(events.length <= MANAGED_BLS_CALENDAR_LIMITS.events);
  }
  events.sort((left, right) =>
    left.scheduledAt < right.scheduledAt
      ? -1
      : left.scheduledAt > right.scheduledAt
        ? 1
        : left.series < right.series
          ? -1
          : left.series > right.series
            ? 1
            : 0,
  );
  const result = parseManagedBlsCalendar({
    schemaVersion: "1.0.0",
    source: MANAGED_BLS_CALENDAR_SOURCE,
    fetchedAt,
    window: { fromInclusive: fetchedAt, toExclusive: to.toISOString() },
    events,
  });
  requireValue(result);
  return result;
}
