import type { PersonalFilingMonitorPolicyDto } from "@research-cockpit/contracts";

export function filingMonitorLocalTime(
  now: Date,
  timeZone: string,
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (name: string) => parts.find((part) => part.type === name)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** A date watermark avoids a second run in the repeated autumn hour. */
export function nextFilingMonitorCheck(
  now: Date,
  policy: Pick<PersonalFilingMonitorPolicyDto, "dailyTime" | "timeZone">,
): string {
  const consumedDate = filingMonitorLocalTime(now, policy.timeZone).date;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: policy.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  let candidate = Math.floor(now.getTime() / 60_000) * 60_000 + 60_000;
  for (let n = 0; n < 4_320; n++, candidate += 60_000) {
    const parts = formatter.formatToParts(candidate);
    const get = (name: string) =>
      parts.find((part) => part.type === name)!.value;
    const date = `${get("year")}-${get("month")}-${get("day")}`;
    if (
      date > consumedDate &&
      `${get("hour")}:${get("minute")}` >= policy.dailyTime
    )
      return new Date(candidate).toISOString();
  }
  throw new Error("Filing monitor schedule is unavailable.");
}

export function filingMonitorQuiet(
  now: Date,
  policy: Pick<PersonalFilingMonitorPolicyDto, "quietHours" | "timeZone">,
): boolean {
  if (!policy.quietHours) return false;
  const local = filingMonitorLocalTime(now, policy.timeZone).time;
  return local >= "22:00" || local < "08:00";
}
