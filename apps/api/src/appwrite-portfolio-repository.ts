import {
  encodePortfolioPayload,
  isPersonalPortfolioLedgerPayload,
  parseManagedPortfolioCommand,
  parsePortfolioPayload,
  type ManagedPortfolioPayload,
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
  PortfolioRepositoryError,
  type PortfolioRepository,
} from "./portfolio-repository";

type Identity = ManagedPortfolioPayload["identities"][number];
type Catalog = PersonalSecurityMasterCatalog | ManagedSecurityMasterCatalog;
const STABLE_FIELDS = [
  "country",
  "exchangeMic",
  "instrumentType",
  "issuerId",
  "securityId",
  "shareClassId",
  "listingId",
] as const satisfies readonly (keyof Identity)[];
const DISPLAY_FIELDS = [
  "issuerName",
  "securityName",
  "shareClassName",
  "symbol",
] as const satisfies readonly (keyof Identity)[];

export interface AppwritePortfolioRepositoryOptions {
  readonly store: AppwriteVersionedRowStore;
  readonly databaseId: string;
  readonly portfoliosTableId: string;
  readonly receiptsTableId: string;
  readonly catalog: Catalog;
  readonly now?: () => Date;
}

export function createAppwritePortfolioRepository(
  options: AppwritePortfolioRepositoryOptions,
): PortfolioRepository {
  const { catalog } = options;
  const policy: ResourcePolicy<"portfolio"> = {
    kind: "portfolio",
    capture(value) {
      const command = parseManagedPortfolioCommand(value);
      if (command === null)
        throw new PortfolioRepositoryError("invalid_request");
      return {
        expectedVersion: command.expectedVersion,
        key: command.idempotencyKey,
        payload: command.payload,
        payloadJson: encodePortfolioPayload(command.payload),
      };
    },
    decodeStored(payloadJson) {
      const payload = parsePortfolioPayload(JSON.parse(payloadJson) as unknown);
      return payload !== null &&
        encodePortfolioPayload(payload) === payloadJson &&
        (payload.snapshotSha256 !== catalog.snapshotSha256 ||
          admittedIdentities(catalog, payload))
        ? payload
        : null;
    },
    admitFresh(payload, current, today) {
      if (
        payload.snapshotSha256 !== catalog.snapshotSha256 ||
        !isPersonalPortfolioLedgerPayload(payload, today) ||
        !admittedIdentities(catalog, payload)
      )
        return false;
      const retained = new Map(
        current?.identities.map((value) => [value.listingId, value]),
      );
      return payload.identities.every((identity) => {
        const previous = retained.get(identity.listingId);
        return previous === undefined || sameStableIdentity(previous, identity);
      });
    },
  };
  try {
    const repository = createAppwriteVersionedResourceRepository(
      { ...options, currentTableId: options.portfoliosTableId },
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

function sameStableIdentity(left: Identity, right: Identity): boolean {
  return STABLE_FIELDS.every((field) => left[field] === right[field]);
}
function admittedIdentities(
  catalog: Catalog,
  payload: ManagedPortfolioPayload,
): boolean {
  try {
    return payload.identities.every((identity) => {
      const found = lookupPersonalSecurityMasterListing(
        catalog,
        identity.listingId,
      );
      return (
        found !== null &&
        sameStableIdentity(identity, found) &&
        DISPLAY_FIELDS.every((field) => identity[field] === found[field])
      );
    });
  } catch {
    return false;
  }
}
function resourceError(error: unknown): PortfolioRepositoryError {
  return new PortfolioRepositoryError(
    error instanceof VersionedResourceRepositoryError
      ? error.code
      : "unavailable",
  );
}
