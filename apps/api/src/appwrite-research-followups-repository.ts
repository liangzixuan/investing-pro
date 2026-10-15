import {
  encodeResearchFollowupsPayload,
  parseManagedResearchFollowupsCommand,
  parseResearchFollowupsPayload,
  type ResearchFollowup,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import {
  lookupPersonalSecurityMasterListing,
  type ManagedSecurityMasterCatalog,
  type PersonalSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";

import {
  createAppwriteVersionedResourceRepository,
  VersionedResourceRepositoryError,
  type ResourcePolicy,
} from "./appwrite-versioned-resource-repository";
import type { AppwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import {
  ResearchFollowupsRepositoryError,
  type ResearchFollowupsRepository,
} from "./research-followups-repository";

type Listing = ResearchFollowup["listing"];
type Catalog = PersonalSecurityMasterCatalog | ManagedSecurityMasterCatalog;
const STABLE_FIELDS = [
  "country",
  "exchangeMic",
  "instrumentType",
  "listingId",
  "issuerId",
  "securityId",
  "shareClassId",
] as const satisfies readonly (keyof Listing)[];
const DISPLAY_FIELDS = [
  "issuerName",
  "securityName",
  "shareClassName",
  "symbol",
] as const satisfies readonly (keyof Listing)[];

export interface AppwriteResearchFollowupsRepositoryOptions {
  readonly store: AppwriteVersionedRowStore;
  readonly databaseId: string;
  readonly followupsTableId: string;
  readonly receiptsTableId: string;
  readonly catalog: Catalog;
  readonly now?: () => Date;
}

export function createAppwriteResearchFollowupsRepository(
  options: AppwriteResearchFollowupsRepositoryOptions,
): ResearchFollowupsRepository {
  const { catalog } = options;
  const policy: ResourcePolicy<"research-followups"> = {
    kind: "research-followups",
    capture(value) {
      const command = parseManagedResearchFollowupsCommand(value);
      if (command === null)
        throw new ResearchFollowupsRepositoryError("invalid_request");
      return {
        expectedVersion: command.expectedVersion,
        key: command.idempotencyKey,
        payload: command.payload,
        payloadJson: encodeResearchFollowupsPayload(command.payload),
      };
    },
    decodeStored(payloadJson) {
      const value: unknown = JSON.parse(payloadJson);
      const payload = parseResearchFollowupsPayload(value);
      if (
        payload === null ||
        encodeResearchFollowupsPayload(payload) !== payloadJson ||
        !payload.entries.every(
          (entry) =>
            entry.catalogSnapshotSha256 !== catalog.snapshotSha256 ||
            currentlyAdmitted(catalog, entry),
        )
      )
        return null;
      return payload;
    },
    admitFresh: (payload, current, today) =>
      admittedFresh(catalog, payload, current, today),
  };
  try {
    const repository = createAppwriteVersionedResourceRepository(
      { ...options, currentTableId: options.followupsTableId },
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

function resourceError(error: unknown): ResearchFollowupsRepositoryError {
  return new ResearchFollowupsRepositoryError(
    error instanceof VersionedResourceRepositoryError
      ? error.code
      : "unavailable",
  );
}

function sameStableIdentity(left: Listing, right: Listing): boolean {
  return STABLE_FIELDS.every((field) => left[field] === right[field]);
}

function sameListing(left: Listing, right: Listing): boolean {
  return (
    sameStableIdentity(left, right) &&
    DISPLAY_FIELDS.every((field) => left[field] === right[field])
  );
}

function currentlyAdmitted(catalog: Catalog, entry: ResearchFollowup): boolean {
  const found = lookupPersonalSecurityMasterListing(
    catalog,
    entry.listing.listingId,
  );
  return (
    entry.catalogSnapshotSha256 === catalog.snapshotSha256 &&
    found !== null &&
    sameListing(entry.listing, found)
  );
}

function admittedFresh(
  catalog: Catalog,
  payload: ResearchFollowupsPayload,
  current: ResearchFollowupsPayload | null,
  today: string,
): boolean {
  try {
    const retained = new Map(
      current?.entries.map((entry) => [entry.id, entry]),
    );
    return payload.entries.every((entry) => {
      const previous = retained.get(entry.id);
      if (
        entry.status === "completed" &&
        entry.completedOn !== previous?.completedOn &&
        entry.completedOn > today
      )
        return false;
      if (previous === undefined) return currentlyAdmitted(catalog, entry);
      if (!sameStableIdentity(previous.listing, entry.listing)) return false;
      if (
        previous.catalogSnapshotSha256 === entry.catalogSnapshotSha256 &&
        sameListing(previous.listing, entry.listing)
      )
        return true;
      return currentlyAdmitted(catalog, entry);
    });
  } catch {
    return false;
  }
}
