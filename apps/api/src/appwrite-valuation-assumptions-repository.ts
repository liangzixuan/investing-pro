import {
  encodeValuationAssumptionsPayload,
  parseManagedValuationAssumptionsCommand,
  parseValuationAssumptionsPayload,
  type ValuationAssumptionEntry,
  type ValuationAssumptionsPayload,
} from "@research-cockpit/contracts";
import type { ManagedValuationAssumptionsCatalog } from "./managed-workspace-catalog";
import {
  createAppwriteVersionedResourceRepository,
  VersionedResourceRepositoryError,
  type ResourcePolicy,
} from "./appwrite-versioned-resource-repository";
import type { AppwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import {
  ValuationAssumptionsRepositoryError,
  type ValuationAssumptionsRepository,
} from "./valuation-assumptions-repository";

type Catalog = ManagedValuationAssumptionsCatalog;
type Listing = ValuationAssumptionEntry["listing"];
const stableFields = [
  "country",
  "exchangeMic",
  "instrumentType",
  "listingId",
  "issuerId",
  "securityId",
  "shareClassId",
] as const satisfies readonly (keyof Listing)[];
const displayFields = [
  "issuerName",
  "securityName",
  "shareClassName",
  "symbol",
] as const satisfies readonly (keyof Listing)[];
export interface AppwriteValuationAssumptionsRepositoryOptions {
  readonly store: AppwriteVersionedRowStore;
  readonly databaseId: string;
  readonly assumptionsTableId: string;
  readonly receiptsTableId: string;
  readonly catalog: Catalog;
  readonly now?: () => Date;
}

/** Dedicated policy; replay/CAS/commit uncertainty remain owned by the atomic engine. */
export function createAppwriteValuationAssumptionsRepository(
  options: AppwriteValuationAssumptionsRepositoryOptions,
): ValuationAssumptionsRepository {
  const { catalog } = options;
  const policy: ResourcePolicy<"valuation-assumptions"> = {
    kind: "valuation-assumptions",
    capture(value) {
      const command = parseManagedValuationAssumptionsCommand(value);
      if (command === null)
        throw new ValuationAssumptionsRepositoryError("invalid_request");
      return {
        expectedVersion: command.expectedVersion,
        key: command.idempotencyKey,
        payload: command.payload,
        payloadJson: encodeValuationAssumptionsPayload(command.payload),
      };
    },
    decodeStored(payloadJson) {
      const payload = parseValuationAssumptionsPayload(JSON.parse(payloadJson));
      if (
        payload === null ||
        encodeValuationAssumptionsPayload(payload) !== payloadJson
      )
        return null;
      return payload.entries.every(
        (entry) =>
          entry.catalogSnapshotSha256 !== catalog.snapshotSha256 ||
          currentlyAdmitted(catalog, entry),
      )
        ? payload
        : null;
    },
    admitFresh: (payload, current) => admittedFresh(catalog, payload, current),
  };
  try {
    const repository = createAppwriteVersionedResourceRepository(
      { ...options, currentTableId: options.assumptionsTableId },
      policy,
    );
    return {
      async get(principal) {
        try {
          const record = await repository.get(principal);
          return record === null ? null : Object.freeze(record);
        } catch (error) {
          throw resourceError(error);
        }
      },
      async put(principal, command) {
        try {
          return Object.freeze(await repository.put(principal, command));
        } catch (error) {
          throw resourceError(error);
        }
      },
    };
  } catch (error) {
    throw resourceError(error);
  }
}
function resourceError(error: unknown): ValuationAssumptionsRepositoryError {
  return new ValuationAssumptionsRepositoryError(
    error instanceof VersionedResourceRepositoryError
      ? error.code
      : "unavailable",
  );
}
function sameStableIdentity(left: Listing, right: Listing): boolean {
  return stableFields.every((field) => left[field] === right[field]);
}
function sameListing(left: Listing, right: Listing): boolean {
  return (
    sameStableIdentity(left, right) &&
    displayFields.every((field) => left[field] === right[field])
  );
}
function currentlyAdmitted(
  catalog: Catalog,
  entry: ValuationAssumptionEntry,
): boolean {
  const found = catalog.lookup(entry.listing.listingId);
  return (
    entry.catalogSnapshotSha256 === catalog.snapshotSha256 &&
    found !== null &&
    sameListing(entry.listing, found) &&
    (entry.cik === null || entry.cik === found.cik)
  );
}
function admittedEntry(
  catalog: Catalog,
  entry: ValuationAssumptionEntry,
  previous: ValuationAssumptionEntry | undefined,
): boolean {
  if (!previous) return currentlyAdmitted(catalog, entry);
  if (!sameStableIdentity(previous.listing, entry.listing)) return false;
  if (!compatibleClaim(previous.cik, entry.cik)) return false;
  const sameContext =
    previous.catalogSnapshotSha256 === entry.catalogSnapshotSha256 &&
    sameListing(previous.listing, entry.listing);
  const retainedClaim = entry.cik === null || entry.cik === previous.cik;
  return (sameContext && retainedClaim) || currentlyAdmitted(catalog, entry);
}
function compatibleClaim(
  previous: string | null,
  next: string | null,
): boolean {
  return previous === null || next === null || previous === next;
}
function admittedFresh(
  catalog: Catalog,
  payload: ValuationAssumptionsPayload,
  current: ValuationAssumptionsPayload | null,
): boolean {
  const retained = new Map(
    current?.entries.map((entry) => [entry.listing.listingId, entry]),
  );
  return payload.entries.every((entry) =>
    admittedEntry(catalog, entry, retained.get(entry.listing.listingId)),
  );
}
