import type { PersonalMonetaryAnnouncementsDto } from "@research-cockpit/contracts";

export interface ManagedFedRefreshComparison {
  readonly previous: PersonalMonetaryAnnouncementsDto;
  readonly current: PersonalMonetaryAnnouncementsDto;
  readonly newUrls: readonly string[];
}

/** Compare admitted loaded lists, without claiming new publication or complete history. */
export function compareManagedFedResponses(
  previous: PersonalMonetaryAnnouncementsDto | null,
  current: PersonalMonetaryAnnouncementsDto,
): ManagedFedRefreshComparison | null {
  if (previous === null) return null;
  const previousUrls = new Set(previous.items.map((item) => item.url));
  return Object.freeze({
    previous,
    current,
    newUrls: Object.freeze(
      current.items
        .filter((item) => !previousUrls.has(item.url))
        .map((item) => item.url),
    ),
  });
}
