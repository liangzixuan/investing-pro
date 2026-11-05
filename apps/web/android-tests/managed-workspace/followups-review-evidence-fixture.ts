import {
  encodeResearchFollowupsPayload,
  parseManagedCatalogResolveRequest,
  parseManagedCatalogResolveResponse,
  parseManagedResearchFollowupsCommand,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import {
  ManagedSecFilingsError,
  type ManagedApi,
} from "../../src/clerk-trial/managed-api";
import { annualReportPacket } from "../../src/clerk-trial/test-annual-report-fixture";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../../src/lib/test-personal-sec-annual-api-fixture";
import { eodResponse } from "../../src/clerk-trial/eod-history-fixture";
import { filingsResponse } from "../../src/clerk-trial/sec-filings-fixture";
import { createManagedResearchCoverageFixture } from "../../src/clerk-trial/test-managed-research-coverage-fixture";
import { buildInterimFixture } from "./interim-report-packet";
import { reviewFilingsIdentities } from "./review-filings-evidence-fixture-data";
import { createResearchFollowupsFixture } from "./followups-fixture";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";

export const evidenceAssessments = [
  "Class C assessment keeps the original partial and complete source clocks. Café 東京 📈",
  "Class A assessment is independent; retained evidence does not imply a new source read.",
] as const;
export type FollowupsEvidenceNativeFixture = Awaited<
  ReturnType<typeof evidenceData>
>;

async function evidenceData(base: SharedNativeFixture) {
  const listings = reviewFilingsIdentities().slice(0, 4);
  const digest = base.researchCoverage.catalogSnapshotSha256;
  const original: ResearchFollowupsPayload = {
    schemaVersion: 1,
    entries: listings.map((listing, i) => ({
      id: `76000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      catalogSnapshotSha256: digest,
      listing,
      check: `Read the complete ${listing.symbol} question, exact share class and raw evidence. <script>invented</script> Café 東京 📈`,
      dueOn: i === 3 ? "2099-12-31" : "2000-01-01",
      status: "open",
      completedOn: null,
      result: i === 3 ? "Preserve this unrelated future check exactly." : "",
    })),
  };
  const annual = await Promise.all(
    listings.slice(0, 2).map(async (listing) => {
      const packet = structuredClone(
        await annualReportPacket("left", { mode: "exact-decimal" }),
      ) as TestAnnualPacket;
      packet.security = {
        country: listing.country,
        exchangeMic: listing.exchangeMic,
        issuerId: listing.issuerId,
        issuerName: listing.issuerName,
        listingId: listing.listingId,
        securityName: listing.securityName,
        symbol: listing.symbol,
        cik: "0000000001",
      };
      return bindAnnualPacket(packet);
    }),
  );
  const interim = await Promise.all(
    annual.map((packet) =>
      buildInterimFixture({
        catalogSnapshotSha256: digest,
        security: packet.security,
      }),
    ),
  );
  const price = listings
    .slice(0, 2)
    .map((security) => ({ ...eodResponse("1m"), security }));
  const filings = listings.slice(0, 2).map((listing) =>
    filingsResponse(3, "available", {
      listing,
      catalogSnapshotSha256: digest,
      cik: "0000000001",
      origin: "followups",
    }),
  );
  return { listings, digest, original, annual, interim, price, filings };
}
export interface FollowupsEvidenceControls extends FollowupsEvidenceNativeFixture {
  readonly getSnapshot: () => {
    readonly requests: readonly string[];
    readonly rejected: number;
    readonly status: number;
    readonly resolve: number;
  };
  readonly subscribe: (listener: () => void) => () => void;
  readonly saved: () => ResearchFollowupsPayload;
}

/** Strict invented Follow-ups-only transport. Sources and Save remain explicit. */
export async function createFollowupsEvidenceNativeFixture(
  base: SharedNativeFixture,
  expectedResearchVisits: 2 | 3 = 3,
): Promise<ManagedNativeFixture> {
  const data = await evidenceData(base),
    followups = createResearchFollowupsFixture({
      version: 7,
      payload: data.original,
    });
  let saved = structuredClone(data.original),
    counts = {
      requests: [] as readonly string[],
      rejected: 0,
      status: 0,
      resolve: 0,
    },
    state = base.getSnapshot();
  const listeners = new Set<() => void>();
  const publish = () => {
    state = {
      ...base.getSnapshot(),
      status: counts.status,
      resolve: counts.resolve,
    };
    for (const l of listeners) l();
  };
  base.subscribe(publish);
  followups.subscribe(publish);
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  function refuse(reason: string): never {
    counts = { ...counts, rejected: counts.rejected + 1 };
    publish();
    throw new Error("Unexpected source-connected fixture operation: " + reason);
  }
  function admit(value: unknown, reason: string): asserts value {
    if (!value) refuse(reason);
  }
  const sequence = [
    "eod:0",
    "annual:0",
    "filings:0",
    "filings:0",
    "interim:0",
    "eod:1",
    "annual:1",
    "filings:1",
    "interim:1",
  ];
  const source = (
    kind: string,
    request: { listingId: string; catalogSnapshotSha256: string },
    signal: AbortSignal,
  ) => {
    const index = data.listings.findIndex(
      (l) => l.listingId === request.listingId,
    );
    admit(
      !signal.aborted &&
        index >= 0 &&
        index < 2 &&
        request.catalogSnapshotSha256 === data.digest &&
        followups.getSnapshot().load === 1 &&
        followups.getSnapshot().commits === 0,
      "source identity/lifetime",
    );
    const next = kind + ":" + index;
    admit(sequence[counts.requests.length] === next, "source order");
    counts = { ...counts, requests: [...counts.requests, next] };
    publish();
    return index;
  };
  const forbidden = Object.fromEntries(
    Object.keys(base.api).map((key) => [
      key,
      () => Promise.resolve().then(() => refuse(key)),
    ]),
  );
  const api: ManagedApi = {
    ...base.api,
    ...forbidden,
    status: async (signal) => {
      admit(
        !signal.aborted && counts.status < followups.getSnapshot().session,
        "status",
      );
      counts = { ...counts, status: counts.status + 1 };
      const result = await base.api.status(signal);
      publish();
      return result;
    },
    resolve: (input, signal) =>
      Promise.resolve().then(() => {
        const r = parseManagedCatalogResolveRequest(input);
        admit(
          r && !signal.aborted && r.snapshotSha256 === data.digest,
          "resolve",
        );
        if (
          r.listingIds.join("|") ===
          base.marketsCohort.map((l) => l.listingId).join("|")
        )
          return base.api.resolve(r, signal);
        admit(
          r.listingIds.length === 1 &&
            counts.resolve < 3 &&
            r.listingIds[0] === data.listings[counts.resolve]!.listingId,
          "chosen-order resolve",
        );
        const response = parseManagedCatalogResolveResponse(
          {
            snapshotSha256: data.digest,
            results: [
              {
                listingId: r.listingIds[0],
                listing: data.listings[counts.resolve],
              },
            ],
          },
          r,
        );
        admit(response, "resolve response");
        counts = { ...counts, resolve: counts.resolve + 1 };
        publish();
        return response;
      }),
    loadFollowups: (signal) => {
      admit(
        !signal.aborted &&
          followups.getSnapshot().load < followups.getSnapshot().session,
        "explicit Follow-ups Load",
      );
      return followups.api.loadFollowups(signal);
    },
    eodHistory: (r, s) =>
      Promise.resolve().then(() => {
        admit(r.range === "1m", "price range");
        return data.price[source("eod", r, s)]!;
      }),
    annualReport: (r, s) =>
      Promise.resolve().then(() => data.annual[source("annual", r, s)]!),
    recentFilings: (r, s) =>
      Promise.resolve().then(() => {
        const i = source("filings", r, s);
        admit(r.symbol === data.listings[i]!.symbol, "filing symbol");
        if (counts.requests.length === 3)
          throw new ManagedSecFilingsError("unavailable");
        return data.filings[i]!;
      }),
    interimReport: (r, s) =>
      Promise.resolve().then(() => data.interim[source("interim", r, s)]!),
    saveFollowups: async (input, signal) => {
      const command = parseManagedResearchFollowupsCommand(input);
      admit(
        command &&
          !signal.aborted &&
          command.expectedVersion === 7 &&
          followups.getSnapshot().save === 0 &&
          counts.requests.length === sequence.length &&
          counts.resolve === expectedResearchVisits &&
          counts.rejected === 0,
        "explicit complete Save",
      );
      const expected: ResearchFollowupsPayload = {
        ...data.original,
        entries: data.original.entries.map((entry, i) =>
          i === 0
            ? {
                ...entry,
                result: evidenceAssessments[0],
                status: "completed",
                completedOn: new Date().toISOString().slice(0, 10),
              }
            : i === 1
              ? {
                  ...entry,
                  result: evidenceAssessments[1],
                  status: "open",
                  completedOn: null,
                }
              : entry,
        ),
      };
      admit(
        encodeResearchFollowupsPayload(command.payload) ===
          encodeResearchFollowupsPayload(expected),
        "all fields and unrelated check",
      );
      const receipt = await followups.api.saveFollowups(command, signal);
      saved = structuredClone(receipt.payload);
      publish();
      return receipt;
    },
  };
  return {
    ...base,
    api,
    followups,
    session: followups.nextSession(),
    priceCoverage: data.listings.slice(0, 2),
    researchCoverage: createManagedResearchCoverageFixture(
      data.listings
        .slice(0, 2)
        .map((listing) => ({ listing, cik: "0000000001" })),
      data.digest,
    ),
    financialReview: null,
    getSnapshot: () => state,
    subscribe,
    followupsEvidence: {
      ...data,
      getSnapshot: () => counts,
      subscribe,
      saved: () => structuredClone(saved),
    },
  };
}
