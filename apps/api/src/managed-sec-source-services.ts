import {
  MANAGED_SEC_ANNUAL_EVIDENCE_PATH,
  MANAGED_SEC_INTERIM_EVIDENCE_PATH,
  MANAGED_SEC_FILINGS_PATH,
} from "@research-cockpit/contracts";
import {
  createManagedSecAnnualService,
  awaitManagedSecAnnual,
  ManagedSecAnnualServiceError,
} from "./managed-sec-annual-service";
import {
  createManagedSecInterimService,
  awaitManagedSecInterim,
  ManagedSecInterimServiceError,
} from "./managed-sec-interim-service";
import {
  createManagedSecFilingsService,
  awaitManagedSecFilings,
  ManagedSecFilingsServiceError,
} from "./managed-sec-filings-service";
type Options = Parameters<typeof createManagedSecAnnualService>[0];
/** Closed route composition; no provider/period policy is selected by request data. */
export function createManagedSecRouteServices(path: string, options: Options) {
  switch (path) {
    case MANAGED_SEC_ANNUAL_EVIDENCE_PATH:
      return { annual: createManagedSecAnnualService(options) };
    case MANAGED_SEC_INTERIM_EVIDENCE_PATH:
      return { interim: createManagedSecInterimService(options) };
    case MANAGED_SEC_FILINGS_PATH:
      return { filings: createManagedSecFilingsService(options) };
    default:
      return {};
  }
}
export function awaitManagedSecRoute<T>(
  path: string,
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  switch (path) {
    case MANAGED_SEC_ANNUAL_EVIDENCE_PATH:
      return awaitManagedSecAnnual(work, signal);
    case MANAGED_SEC_INTERIM_EVIDENCE_PATH:
      return awaitManagedSecInterim(work, signal);
    case MANAGED_SEC_FILINGS_PATH:
      return awaitManagedSecFilings(work, signal);
    default:
      throw new TypeError("Unknown managed SEC route.");
  }
}
export function managedSecRouteTimeout(path: string): Error {
  switch (path) {
    case MANAGED_SEC_ANNUAL_EVIDENCE_PATH:
      return new ManagedSecAnnualServiceError("request_timeout");
    case MANAGED_SEC_INTERIM_EVIDENCE_PATH:
      return new ManagedSecInterimServiceError("request_timeout");
    case MANAGED_SEC_FILINGS_PATH:
      return new ManagedSecFilingsServiceError("request_timeout");
    default:
      throw new TypeError("Unknown managed SEC route.");
  }
}
