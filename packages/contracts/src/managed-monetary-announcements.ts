import {
  isPersonalMonetaryAnnouncementsDto,
  PERSONAL_FED_MONETARY_SOURCE,
  type PersonalMonetaryAnnouncementsDto,
} from "./personal-monetary-announcements";

export const MANAGED_MONETARY_ANNOUNCEMENTS_PATH =
  "/v1/managed/monetary-policy-announcements" as const;
export const MANAGED_MONETARY_ANNOUNCEMENTS_LIMITS = Object.freeze({
  responseBytes: 64 * 1_024,
  operationMs: 10_000,
});

/** Preserve the existing Fed source contract and detach caller-owned data. */
export function parseManagedMonetaryAnnouncements(
  value: unknown,
): PersonalMonetaryAnnouncementsDto | null {
  if (!isPersonalMonetaryAnnouncementsDto(value)) return null;
  return Object.freeze({
    schemaVersion: value.schemaVersion,
    source: PERSONAL_FED_MONETARY_SOURCE,
    fetchedAt: value.fetchedAt,
    availableItemCount: value.availableItemCount,
    items: Object.freeze(value.items.map((item) => Object.freeze({ ...item }))),
  });
}
