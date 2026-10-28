interface CpiCalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}
interface CpiClockParts extends CpiCalendarDate {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly fraction: string;
  readonly offset: string;
}
interface CpiClockValue {
  readonly utc: string;
  readonly sortKey: string;
}
class CpiSourceClock {
  constructor(readonly value: CpiClockValue) {}
  compare(other: CpiSourceClock): number {
    if (this.value.sortKey === other.value.sortKey) return 0;
    return this.value.sortKey < other.value.sortKey ? -1 : 1;
  }
}

/** Source calendar date only, independent of every other clock in the packet. */
export function isCpiCalendarDate(parts: CpiCalendarDate): boolean {
  if (parts.year < 1) return false;
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return (
    date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() === parts.month - 1 &&
    date.getUTCDate() === parts.day
  );
}
function sourceClockParts(value: unknown): CpiClockParts | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d+))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u.exec(
      value,
    );
  if (!match || match[8] === "-00:00") return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
    fraction: match[7] ?? "",
    offset: match[8]!,
  };
}
function offsetMinutes(parts: CpiClockParts): number {
  if (parts.offset === "Z") return 0;
  const hours = Number(parts.offset.slice(1, 3));
  const minutes = Number(parts.offset.slice(4));
  return (hours * 60 + minutes) * (parts.offset[0] === "+" ? 1 : -1);
}
function sourceClock(value: unknown): CpiSourceClock | null {
  const parts = sourceClockParts(value);
  if (!parts) return null;
  if (!isCpiCalendarDate(parts)) return null;
  const offset = offsetMinutes(parts);
  const local = new Date(0);
  local.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  local.setUTCHours(
    parts.hour,
    parts.minute,
    parts.second,
    Number(parts.fraction.padEnd(3, "0").slice(0, 3)),
  );
  const utc = new Date(local.getTime() - offset * 60_000).toISOString();
  if (!/^\d{4}-/u.test(utc)) return null;
  // Offsets have whole-minute precision, so conversion leaves the fraction intact.
  const sortKey = `${utc.slice(0, 19)}.${parts.fraction.padEnd(64, "0")}Z`;
  return new CpiSourceClock({ utc, sortKey });
}
/** Feed syntax only; no release, embargo or revision time is inferred. */
export function parseCpiSourceInstant(value: unknown): string | null {
  return sourceClock(value)?.value.utc ?? null;
}
/** Ascending exact comparison, including equivalent offsets and submilliseconds. */
export function compareCpiSourceInstants(left: string, right: string): number {
  const a = sourceClock(left),
    b = sourceClock(right);
  if (a === null || b === null) throw new Error("Invalid CPI source clock");
  return a.compare(b);
}
