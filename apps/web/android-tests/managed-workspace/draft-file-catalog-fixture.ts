import {
  parseManagedCatalogResolveResponse,
  type MainWatchlistPayload,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";

interface DraftCatalogFixture {
  readonly scenario: string;
  readonly api: ManagedApi;
  readonly snapshotSha256: `sha256:${string}`;
  readonly savedDraft: () => MainWatchlistPayload;
  readonly resolveCount: () => number;
  readonly recordResolve: () => void;
  readonly refuseResolve: () => Promise<never>;
}

function resolveDraftFileCatalogReview(
  context: DraftCatalogFixture,
  request: Parameters<ManagedApi["resolve"]>[0],
  signal: AbortSignal,
) {
  if (signal.aborted) return context.refuseResolve();
  if (context.resolveCount() !== 0) return context.refuseResolve();
  if (request.snapshotSha256 !== context.snapshotSha256)
    return context.refuseResolve();
  const results = context
    .savedDraft()
    .memberships.map(({ note: discardedNote, ...listing }) => {
      void discardedNote;
      return { listingId: listing.listingId, listing };
    });
  const resolved = parseManagedCatalogResolveResponse(
    { snapshotSha256: context.snapshotSha256, results },
    request,
  );
  if (!resolved) throw new Error("Invalid invented draft catalog review");
  context.recordResolve();
  return Promise.resolve(resolved);
}

/** Add one exact invented Watchlist review while retaining the normal Markets resolver. */
export function withDraftFileCatalogFixture(
  context: DraftCatalogFixture,
): ManagedApi {
  if (context.scenario !== "watchlist-draft-file") return context.api;
  return {
    ...context.api,
    resolve(request, signal) {
      if (request.listingIds.join("|") === "listing-zero|listing-one")
        return resolveDraftFileCatalogReview(context, request, signal);
      return context.api.resolve(request, signal);
    },
  };
}
