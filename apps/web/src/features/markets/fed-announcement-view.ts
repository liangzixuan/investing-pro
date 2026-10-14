import type {
  PersonalMonetaryAnnouncementDto,
  PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";

export interface FedAnnouncementView {
  readonly response: PersonalMonetaryAnnouncementsDto | null;
  readonly query: string;
  readonly visibleItems: readonly PersonalMonetaryAnnouncementDto[];
}

export type FedAnnouncementRefreshView = "all" | "new";

const normalize = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/gu, " ");

export function projectFedAnnouncementView(
  response: PersonalMonetaryAnnouncementsDto | null,
  query: string,
): FedAnnouncementView {
  const phrase = normalize(query);
  const items = response?.items ?? [];
  return {
    response,
    query,
    visibleItems: phrase
      ? items.filter((item) => normalize(item.title).includes(phrase))
      : items,
  };
}
