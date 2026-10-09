import {
  membershipMatchesResult,
  type MainWatchlistPayload,
  type WatchlistMembership,
} from "@research-cockpit/contracts";

export interface WatchlistReviewEntry {
  readonly listingId: string;
  readonly saved: WatchlistMembership | null;
  readonly draft: WatchlistMembership | null;
  readonly savedPosition: number | null;
  readonly draftPosition: number | null;
  readonly identityChanged: boolean;
  readonly noteChanged: boolean;
}

/** Compare the retained raw draft without normalizing or changing either version. */
export function reviewWatchlistVersions(
  saved: MainWatchlistPayload,
  draft: MainWatchlistPayload,
) {
  const savedEntries = new Map(
    saved.memberships.map((member, index) => [
      member.listingId,
      { member, position: index + 1 },
    ]),
  );
  const entries: WatchlistReviewEntry[] = [];
  let unchanged = 0;
  for (const [index, member] of draft.memberships.entries()) {
    const previous = savedEntries.get(member.listingId);
    savedEntries.delete(member.listingId);
    const identityChanged = previous
      ? !membershipMatchesResult(previous.member, member)
      : false;
    const noteChanged = previous ? previous.member.note !== member.note : false;
    if (
      previous &&
      previous.position === index + 1 &&
      !identityChanged &&
      !noteChanged
    ) {
      unchanged++;
      continue;
    }
    entries.push({
      listingId: member.listingId,
      saved: previous?.member ?? null,
      draft: member,
      savedPosition: previous?.position ?? null,
      draftPosition: index + 1,
      identityChanged,
      noteChanged,
    });
  }
  for (const { member, position } of savedEntries.values()) {
    entries.push({
      listingId: member.listingId,
      saved: member,
      draft: null,
      savedPosition: position,
      draftPosition: null,
      identityChanged: false,
      noteChanged: false,
    });
  }
  return {
    entries,
    unchanged,
    catalogChanged: saved.snapshotSha256 !== draft.snapshotSha256,
  };
}
