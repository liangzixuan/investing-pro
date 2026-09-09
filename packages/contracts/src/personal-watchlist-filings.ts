export const PERSONAL_WATCHLIST_FILINGS_LIMITS = {
  selectedListings: 20,
  responseFilings: 1_000,
  lookbackDays: [7, 30, 90],
} as const;

export interface PersonalSecRecentFilingDto {
  readonly cik: string;
  readonly accessionNumber: string;
  readonly form: string;
  readonly filingDate: string;
  readonly reportDate: string | null;
  readonly sourceUrl: string;
}

export interface PersonalSecIssuerFilingsDto {
  readonly cik: string;
  readonly status:
    | "available"
    | "not_covered"
    | "rate_limited"
    | "upstream_unavailable"
    | "invalid_response";
  readonly fetchedAt: string;
  readonly sourceUrl: string;
  readonly olderHistoryAvailable: boolean;
  readonly matchingFilings: number;
  readonly truncated: boolean;
  readonly filings: readonly PersonalSecRecentFilingDto[];
}

export interface PersonalWatchlistFilingsRequestDto {
  readonly schemaVersion: "1.0.0";
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly watchlistVersion: number;
  readonly listingIds: readonly string[];
  readonly lookbackDays: 7 | 30 | 90;
}

export interface PersonalWatchlistFilingListingDto {
  readonly listingId: string;
  readonly symbol: string;
  readonly issuerName: string;
}

export interface PersonalWatchlistFilingDto extends PersonalSecRecentFilingDto {
  readonly listings: readonly PersonalWatchlistFilingListingDto[];
}

export interface PersonalWatchlistFilingsResponseDto {
  readonly schemaVersion: "1.0.0";
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly watchlistVersion: number;
  readonly lookbackDays: 7 | 30 | 90;
  readonly fromDate: string;
  readonly throughDate: string;
  readonly fetchedAt: string;
  readonly totalWatchlistListings: number;
  readonly selectedListingIds: readonly string[];
  readonly issuers: readonly (Omit<PersonalSecIssuerFilingsDto, "filings"> & {
    readonly listings: readonly PersonalWatchlistFilingListingDto[];
  })[];
  readonly matchingFilings: number;
  readonly truncated: boolean;
  readonly filings: readonly PersonalWatchlistFilingDto[];
}
