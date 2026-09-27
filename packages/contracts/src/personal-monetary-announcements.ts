export const PERSONAL_MONETARY_ANNOUNCEMENTS_PATH =
  "/v1/personal-filing/monetary-policy-announcements" as const;
export const PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_INPUT_ITEMS = 128;
export const PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_ITEMS = 10;
export const PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_TITLE_LENGTH = 256;
export const PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_URL_LENGTH = 2_048;
export const PERSONAL_FED_MONETARY_SOURCE = Object.freeze({
  id: "federal-reserve-board",
  name: "Board of Governors of the Federal Reserve System",
  feedUrl: "https://www.federalreserve.gov/feeds/press_monetary.xml",
  directoryUrl: "https://www.federalreserve.gov/feeds/feeds.htm",
  timeZone: "America/New_York",
} as const);

export interface PersonalMonetaryAnnouncementDto {
  readonly title: string;
  readonly url: string;
  /** Source publication time at whole-second precision; absent source time is null. */
  readonly publishedAt: string | null;
}

/** A bounded, explicitly loaded announcement feed, without article contents. */
export interface PersonalMonetaryAnnouncementsDto {
  readonly schemaVersion: "1.0.0";
  readonly source: typeof PERSONAL_FED_MONETARY_SOURCE;
  /** Local time after the response body was received, before normalization. */
  readonly fetchedAt: string;
  /** Validated unique feed items before the ten-item presentation limit. */
  readonly availableItemCount: number;
  readonly items: readonly PersonalMonetaryAnnouncementDto[];
}

export function isPersonalMonetaryAnnouncementUrl(
  value: unknown,
): value is string {
  if (
    typeof value !== "string" ||
    value.length > PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_URL_LENGTH ||
    !/^https:\/\/www\.federalreserve\.gov\/newsevents\/pressreleases\/monetary[0-9]{8}[a-z]\.htm$/u.test(
      value,
    )
  )
    return false;
  try {
    const url = new URL(value);
    return (
      url.origin === "https://www.federalreserve.gov" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === "" &&
      url.href === value
    );
  } catch {
    return false;
  }
}

export function isPersonalMonetaryAnnouncementsDto(
  value: unknown,
): value is PersonalMonetaryAnnouncementsDto {
  if (
    !hasKeys(value, [
      "schemaVersion",
      "source",
      "fetchedAt",
      "availableItemCount",
      "items",
    ]) ||
    value.schemaVersion !== "1.0.0" ||
    !hasKeys(value.source, [
      "id",
      "name",
      "feedUrl",
      "directoryUrl",
      "timeZone",
    ]) ||
    value.source.id !== PERSONAL_FED_MONETARY_SOURCE.id ||
    value.source.name !== PERSONAL_FED_MONETARY_SOURCE.name ||
    value.source.feedUrl !== PERSONAL_FED_MONETARY_SOURCE.feedUrl ||
    value.source.directoryUrl !== PERSONAL_FED_MONETARY_SOURCE.directoryUrl ||
    value.source.timeZone !== PERSONAL_FED_MONETARY_SOURCE.timeZone ||
    !isUtcInstant(value.fetchedAt) ||
    typeof value.availableItemCount !== "number" ||
    !Number.isInteger(value.availableItemCount) ||
    value.availableItemCount < 0 ||
    value.availableItemCount >
      PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_INPUT_ITEMS ||
    !Array.isArray(value.items) ||
    value.items.length !==
      Math.min(
        PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_ITEMS,
        value.availableItemCount,
      )
  )
    return false;

  const urls = new Set<string>();
  let previousPublishedAt: string | undefined;
  let unknownTimeSeen = false;
  for (const item of value.items) {
    if (
      !hasKeys(item, ["title", "url", "publishedAt"]) ||
      typeof item.title !== "string" ||
      item.title.length === 0 ||
      item.title.length >
        PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_TITLE_LENGTH ||
      /^[ \t\r\n]|[ \t\r\n]$/u.test(item.title) ||
      /[\p{Cc}\p{Cf}\p{Cs}]/u.test(item.title) ||
      !isPersonalMonetaryAnnouncementUrl(item.url) ||
      urls.has(item.url)
    )
      return false;
    urls.add(item.url);

    if (item.publishedAt === null) {
      unknownTimeSeen = true;
    } else {
      if (
        !isUtcInstant(item.publishedAt) ||
        !/^[1-9][0-9]{3}-.+\.000Z$/u.test(item.publishedAt) ||
        unknownTimeSeen ||
        (previousPublishedAt !== undefined &&
          item.publishedAt > previousPublishedAt)
      )
        return false;
      previousPublishedAt = item.publishedAt;
    }
  }
  return true;
}

function hasKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function isUtcInstant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  )
    return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
