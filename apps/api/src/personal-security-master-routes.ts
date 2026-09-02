import type {
  PersonalSecurityMasterSearchResponseDto,
  PersonalSecurityMasterSnapshotReceiptDto,
  PersonalSecurityMasterStatusDto,
  ProblemDetailsDto,
} from "@research-cockpit/contracts";
import {
  PERSONAL_SECURITY_MASTER_LIMITS,
  searchPersonalSecurityMaster,
  type PersonalSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { DemoApiListenOptions } from "./listen-options";
import {
  isPersonalOwnerSessionAuthority,
  type PersonalOwnerSessionAuthority,
} from "./personal-owner-session";
import {
  authorizePersonalRouteRequest,
  sendPersonalOwnerSessionProblem,
} from "./personal-owner-session-routes";

export const PERSONAL_SECURITY_MASTER_STATUS_PATH =
  "/v1/personal-filing/security-master/status" as const;
export const PERSONAL_SECURITY_MASTER_SEARCH_PATH =
  "/v1/personal-filing/security-master/search" as const;

const DEFAULT_SEARCH_LIMIT = 10;
const MAXIMUM_RAW_SEARCH_URL_CODE_UNITS = 2_048;
const CONTROL_FORMAT_OR_SURROGATE_CHARACTER = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const parsedSearchRequests = new WeakMap<FastifyRequest, ParsedSearchRequest>();

interface ParsedSearchRequest {
  readonly canonicalUrl: string;
  readonly limit: number;
  readonly query: string;
}

export function registerPersonalSecurityMasterRoutes(
  app: FastifyInstance,
  catalog: PersonalSecurityMasterCatalog,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: DemoApiListenOptions,
): void {
  if (!isPersonalOwnerSessionAuthority(ownerSession)) {
    throw new TypeError("Personal owner session is unavailable.");
  }

  app.get(
    PERSONAL_SECURITY_MASTER_STATUS_PATH,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        if (
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            PERSONAL_SECURITY_MASTER_STATUS_PATH,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
      },
    },
    (_request, reply) => {
      const response: PersonalSecurityMasterStatusDto = {
        snapshot: snapshotReceipt(catalog),
      };
      return reply.type("application/json; charset=utf-8").send(response);
    },
  );

  app.get(
    PERSONAL_SECURITY_MASTER_SEARCH_PATH,
    {
      exposeHeadRoute: false,
      onRequest: async (request, reply) => {
        const parsed = parseCanonicalSearchUrl(request.url);
        if (
          parsed === undefined ||
          !authorizePersonalRouteRequest(
            request,
            ownerSession,
            listenOptions,
            parsed.canonicalUrl,
          )
        ) {
          return sendPersonalOwnerSessionProblem(reply, request);
        }
        parsedSearchRequests.set(request, parsed);
      },
    },
    (request, reply) => {
      const parsed = parsedSearchRequests.get(request);
      parsedSearchRequests.delete(request);
      if (parsed === undefined) return sendSearchProblem(reply, request);
      try {
        const result = searchPersonalSecurityMaster(catalog, {
          limit: parsed.limit,
          query: parsed.query,
        });
        const response: PersonalSecurityMasterSearchResponseDto = {
          limitApplied: result.limitApplied,
          normalizedQuery: result.normalizedQuery,
          results: result.results.map((entry) => ({
            cik: entry.cik,
            country: entry.country,
            exchangeMic: entry.exchangeMic,
            instrumentType: entry.instrumentType,
            issuerId: entry.issuerId,
            issuerName: entry.issuerName,
            listingId: entry.listingId,
            matchKind: entry.matchKind,
            matchedValue: entry.matchedValue,
            securityId: entry.securityId,
            securityName: entry.securityName,
            shareClassId: entry.shareClassId,
            shareClassName: entry.shareClassName,
            symbol: entry.symbol,
          })),
          snapshot: snapshotReceipt(catalog),
          totalMatches: result.totalMatches,
        };
        return reply.type("application/json; charset=utf-8").send(response);
      } catch {
        return sendSearchProblem(reply, request);
      }
    },
  );
}

export function parseCanonicalSecurityMasterSearchUrl(
  value: string,
): Readonly<{ limit: number; query: string }> | undefined {
  const parsed = parseCanonicalSearchUrl(value);
  return parsed === undefined
    ? undefined
    : Object.freeze({ limit: parsed.limit, query: parsed.query });
}

function parseCanonicalSearchUrl(
  value: string,
): ParsedSearchRequest | undefined {
  if (
    value.length > MAXIMUM_RAW_SEARCH_URL_CODE_UNITS ||
    !value.startsWith(`${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?`) ||
    value.includes("#")
  ) {
    return undefined;
  }
  const rawQuery = value.slice(PERSONAL_SECURITY_MASTER_SEARCH_PATH.length + 1);
  const fields = rawQuery.split("&");
  if (fields.length < 1 || fields.length > 2) return undefined;
  const rawQ = exactField(fields[0], "q");
  const rawLimit =
    fields.length === 2 ? exactField(fields[1], "limit") : undefined;
  if (rawQ === undefined || (fields.length === 2 && rawLimit === undefined)) {
    return undefined;
  }

  let query: string;
  try {
    query = decodeURIComponent(rawQ);
  } catch {
    return undefined;
  }
  let encodedQuery: string;
  try {
    encodedQuery = encodeURIComponent(query);
    if (
      query.length === 0 ||
      query !== query.trim() ||
      query !== query.normalize("NFC") ||
      CONTROL_FORMAT_OR_SURROGATE_CHARACTER.test(query) ||
      [...query].length >
        PERSONAL_SECURITY_MASTER_LIMITS.searchQueryCodePoints ||
      encodedQuery !== rawQ
    ) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  const limit =
    rawLimit === undefined ? DEFAULT_SEARCH_LIMIT : canonicalLimit(rawLimit);
  if (limit === undefined) return undefined;
  const canonicalUrl = `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=${encodedQuery}${
    rawLimit === undefined ? "" : `&limit=${String(limit)}`
  }`;
  if (canonicalUrl !== value) return undefined;
  return Object.freeze({ canonicalUrl, limit, query });
}

function exactField(
  value: string | undefined,
  name: string,
): string | undefined {
  if (value === undefined) return undefined;
  const prefix = `${name}=`;
  if (!value.startsWith(prefix)) return undefined;
  const fieldValue = value.slice(prefix.length);
  return fieldValue.length > 0 ? fieldValue : undefined;
}

function canonicalLimit(value: string): number | undefined {
  if (!/^[1-9][0-9]?$/u.test(value)) return undefined;
  const limit = Number(value);
  return Number.isSafeInteger(limit) &&
    limit <= PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap
    ? limit
    : undefined;
}

function snapshotReceipt(
  catalog: PersonalSecurityMasterCatalog,
): PersonalSecurityMasterSnapshotReceiptDto {
  return {
    asOf: catalog.asOf,
    catalogId: catalog.catalogId,
    catalogVersion: catalog.catalogVersion,
    claim: catalog.claim,
    coverage: {
      activeEligibleSecurities: catalog.coverage.activeEligibleSecurities,
      activeListings: catalog.coverage.activeListings,
      admittedSourceRecords: catalog.coverage.admittedSourceRecords,
      basis: catalog.coverage.basis,
      eligibleSecurityBand: catalog.coverage.eligibleSecurityBand,
      formerTickerEntries: catalog.coverage.formerTickerEntries,
      ineligibleSourceRecords: catalog.coverage.ineligibleSourceRecords,
      inactiveSecurities: catalog.coverage.inactiveSecurities,
      issuers: catalog.coverage.issuers,
      providerMappings: catalog.coverage.providerMappings,
      quarantinedSourceRecords: catalog.coverage.quarantinedSourceRecords,
      sourceRecords: catalog.coverage.sourceRecords,
      staleSourceRecords: catalog.coverage.staleSourceRecords,
      shareClasses: catalog.coverage.shareClasses,
      totalSecurities: catalog.coverage.totalSecurities,
      unsupportedSourceRecords: catalog.coverage.unsupportedSourceRecords,
    },
    generatedAt: catalog.generatedAt,
    profile: catalog.profile,
    provenance: {
      acquiredAt: catalog.provenance.acquiredAt,
      artifacts: catalog.provenance.artifacts.map((artifact) => ({
        acquiredAt: artifact.acquiredAt,
        artifactId: artifact.artifactId,
        contentSha256: artifact.contentSha256,
        mediaType: artifact.mediaType,
        sourceUri: artifact.sourceUri,
        sourceVersion: artifact.sourceVersion,
      })),
      attribution: catalog.provenance.attribution,
      contentKind: catalog.provenance.contentKind,
      sourceId: catalog.provenance.sourceId,
      sourceRevision: catalog.provenance.sourceRevision,
    },
    schemaVersion: catalog.schemaVersion,
    snapshotSha256: catalog.snapshotSha256,
    sourcePolicyCompatibility: {
      attribution: catalog.sourcePolicyCompatibility.attribution,
      cache: catalog.sourcePolicyCompatibility.cache,
      decision: catalog.sourcePolicyCompatibility.decision,
      deleteOnRequest: catalog.sourcePolicyCompatibility.deleteOnRequest,
      display: catalog.sourcePolicyCompatibility.display,
      effectiveAt: catalog.sourcePolicyCompatibility.effectiveAt,
      expiresAt: catalog.sourcePolicyCompatibility.expiresAt,
      export: catalog.sourcePolicyCompatibility.export,
      intendedUse: catalog.sourcePolicyCompatibility.intendedUse,
      localOnly: catalog.sourcePolicyCompatibility.localOnly,
      operation: catalog.sourcePolicyCompatibility.operation,
      policyDocumentSha256:
        catalog.sourcePolicyCompatibility.policyDocumentSha256,
      policyId: catalog.sourcePolicyCompatibility.policyId,
      policyProfile: catalog.sourcePolicyCompatibility.policyProfile,
      policySchemaVersion:
        catalog.sourcePolicyCompatibility.policySchemaVersion,
      policyVersion: catalog.sourcePolicyCompatibility.policyVersion,
      redistribution: catalog.sourcePolicyCompatibility.redistribution,
      retention: catalog.sourcePolicyCompatibility.retention,
      reviewedAt: catalog.sourcePolicyCompatibility.reviewedAt,
      revocationCheck: catalog.sourcePolicyCompatibility.revocationCheck,
      revokedAt: catalog.sourcePolicyCompatibility.revokedAt,
      rightsBasis: catalog.sourcePolicyCompatibility.rightsBasis,
      search: catalog.sourcePolicyCompatibility.search,
      sourceId: catalog.sourcePolicyCompatibility.sourceId,
    },
    status: catalog.status,
  };
}

function sendSearchProblem(reply: FastifyReply, request: FastifyRequest) {
  const problem: ProblemDetailsDto = {
    type: "https://research-cockpit.local/problems/400",
    title: "Invalid request",
    status: 400,
    detail: "The personal security-master search request was not accepted.",
    instance: PERSONAL_SECURITY_MASTER_SEARCH_PATH,
    traceId: request.id,
  };
  return reply.status(400).type("application/problem+json").send(problem);
}
