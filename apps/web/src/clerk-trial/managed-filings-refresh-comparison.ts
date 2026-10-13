import {
  membershipMatchesResult,
  type ManagedSecFilingsResponseDto,
} from "@research-cockpit/contracts";

export interface ManagedFilingsRefreshComparison {
  readonly previous: ManagedSecFilingsResponseDto;
  readonly current: ManagedSecFilingsResponseDto;
  readonly newAccessions: readonly string[];
}

/** Compare already admitted lists, without claiming complete filing coverage. */
export function compareManagedFilingsResponses(
  previous: ManagedSecFilingsResponseDto | null,
  current: ManagedSecFilingsResponseDto,
): ManagedFilingsRefreshComparison | null {
  if (
    previous?.issuer.status !== "available" ||
    current.issuer.status !== "available" ||
    previous.catalogSnapshotSha256 !== current.catalogSnapshotSha256 ||
    previous.issuer.cik !== current.issuer.cik ||
    !membershipMatchesResult(
      { ...previous.security, note: "" },
      current.security,
    )
  )
    return null;

  const priorAccessions = new Set(
    previous.issuer.filings.map((filing) => filing.accessionNumber),
  );
  return Object.freeze({
    previous,
    current,
    newAccessions: Object.freeze(
      current.issuer.filings
        .filter((filing) => !priorAccessions.has(filing.accessionNumber))
        .map((filing) => filing.accessionNumber),
    ),
  });
}
