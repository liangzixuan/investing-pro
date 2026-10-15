import {
  encodeMainWatchlistPayload,
  isMainWatchlistPayload,
  membershipMatchesResult,
  type MainWatchlistPayload,
} from "@research-cockpit/contracts";
import {
  lookupPersonalSecurityMasterListing,
  type ManagedSecurityMasterCatalog,
  type PersonalSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";
import type { TablesDB } from "node-appwrite";
import {
  appwriteVersionedRowStore,
  type AppwriteVersionedRowStore,
} from "./appwrite-versioned-row-store";
import {
  createAppwriteVersionedResourceRepository,
  VersionedResourceRepositoryError,
  type ResourcePolicy,
} from "./appwrite-versioned-resource-repository";
import {
  WatchlistRepositoryError,
  type MainWatchlistRepository,
  type PutMainWatchlistCommand,
} from "./watchlist-repository";

const KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const MAX_PAYLOAD_BYTES = 256 * 1024;
export interface AppwriteWatchlistRepositoryOptions {
  readonly store: AppwriteVersionedRowStore;
  readonly databaseId: string;
  readonly watchlistsTableId: string;
  readonly receiptsTableId: string;
  readonly catalog:
    PersonalSecurityMasterCatalog | ManagedSecurityMasterCatalog;
  readonly now?: () => Date;
}
/** Active watchlist construction API; the six-method port has a resource-neutral type. */
export function appwriteWatchlistStore(
  tables: TablesDB,
): AppwriteVersionedRowStore {
  return appwriteVersionedRowStore(tables);
}
export function createAppwriteWatchlistRepository(
  options: AppwriteWatchlistRepositoryOptions,
): MainWatchlistRepository {
  const { catalog } = options;
  const policy: ResourcePolicy<"watchlist"> = {
    kind: "watchlist",
    capture: captureCommand,
    decodeStored(payloadJson) {
      const payload: unknown = JSON.parse(payloadJson);
      return isMainWatchlistPayload(payload) &&
        encodeMainWatchlistPayload(payload) === payloadJson &&
        (payload.snapshotSha256 !== catalog.snapshotSha256 ||
          admitted(catalog, payload))
        ? payload
        : null;
    },
    admitFresh: (payload) =>
      payload.snapshotSha256 === catalog.snapshotSha256 &&
      admitted(catalog, payload),
  };
  try {
    const repository = createAppwriteVersionedResourceRepository(
      { ...options, currentTableId: options.watchlistsTableId },
      policy,
    );
    return {
      async get(principal) {
        try {
          return await repository.get(principal);
        } catch (error) {
          throw resourceError(error);
        }
      },
      async put(principal, command) {
        try {
          return await repository.put(principal, command);
        } catch (error) {
          throw resourceError(error);
        }
      },
    };
  } catch (error) {
    throw resourceError(error);
  }
}
function resourceError(error: unknown): WatchlistRepositoryError {
  return new WatchlistRepositoryError(
    error instanceof VersionedResourceRepositoryError
      ? error.code
      : "unavailable",
  );
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function captureCommand(command: PutMainWatchlistCommand) {
  if (
    !object(command) ||
    Object.keys(command).sort().join(",") !==
      "expectedVersion,idempotencyKey,payload" ||
    !Number.isSafeInteger(command.expectedVersion) ||
    command.expectedVersion < 0 ||
    command.expectedVersion >= Number.MAX_SAFE_INTEGER ||
    typeof command.idempotencyKey !== "string" ||
    !KEY.test(command.idempotencyKey) ||
    !isMainWatchlistPayload(command.payload)
  )
    throw new WatchlistRepositoryError("invalid_request");
  const payloadJson = encodeMainWatchlistPayload(command.payload);
  const payload: unknown = JSON.parse(payloadJson);
  if (
    Buffer.byteLength(payloadJson, "utf8") > MAX_PAYLOAD_BYTES ||
    !isMainWatchlistPayload(payload)
  )
    throw new WatchlistRepositoryError("invalid_request");
  return {
    expectedVersion: command.expectedVersion,
    key: command.idempotencyKey,
    payload,
    payloadJson,
  };
}

function admitted(
  catalog: AppwriteWatchlistRepositoryOptions["catalog"],
  payload: MainWatchlistPayload,
): boolean {
  try {
    return payload.memberships.every((membership) => {
      const result = lookupPersonalSecurityMasterListing(
        catalog,
        membership.listingId,
      );
      return result !== null && membershipMatchesResult(membership, result);
    });
  } catch {
    return false;
  }
}
