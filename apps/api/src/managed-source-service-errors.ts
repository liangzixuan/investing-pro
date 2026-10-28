import { ManagedCpiHeadlinesServiceError } from "./managed-cpi-headlines-service";
import { ManagedSecAnnualServiceError } from "./managed-sec-annual-service";
import { ManagedSecInterimServiceError } from "./managed-sec-interim-service";
import { ManagedSecFilingsServiceError } from "./managed-sec-filings-service";
import { ManagedEodServiceError } from "./managed-eod-service";
import { ManagedEconomicCalendarServiceError } from "./managed-economic-calendar-service";
import { ManagedMonetaryAnnouncementsServiceError } from "./managed-monetary-announcements-service";
type DataError =
  | ManagedSecAnnualServiceError
  | ManagedSecInterimServiceError
  | ManagedSecFilingsServiceError
  | ManagedEodServiceError;
type SourceError =
  | DataError
  | ManagedEconomicCalendarServiceError
  | ManagedMonetaryAnnouncementsServiceError
  | ManagedCpiHeadlinesServiceError;
const DATA_ERRORS = [
  ManagedSecAnnualServiceError,
  ManagedSecInterimServiceError,
  ManagedSecFilingsServiceError,
  ManagedEodServiceError,
] as const;
const SOURCE_ERRORS = [
  ...DATA_ERRORS,
  ManagedEconomicCalendarServiceError,
  ManagedMonetaryAnnouncementsServiceError,
  ManagedCpiHeadlinesServiceError,
] as const;
export function isManagedSecDataServiceError(
  error: unknown,
): error is DataError {
  return DATA_ERRORS.some((kind) => error instanceof kind);
}
export function isManagedSourceServiceError(
  error: unknown,
): error is SourceError {
  return SOURCE_ERRORS.some((kind) => error instanceof kind);
}
