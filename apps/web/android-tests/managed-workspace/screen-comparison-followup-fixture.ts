import {
  encodeResearchFollowupsPayload,
  parseManagedCatalogResolveResponse,
  parseManagedResearchFollowupsCommand,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { annualComparisonMemberships } from "../../src/clerk-trial/test-canonical-annual-comparison-fixture";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import { createScreenComparisonReportNativeFixture } from "./screen-comparison-report-fixture";
import {
  comparisonFollowupExpected,
  comparisonFollowupOriginal,
} from "./screen-comparison-followup-fixture-data";

type Screen = Awaited<
  ReturnType<typeof createScreenComparisonReportNativeFixture>
>;
type Followups = ReturnType<typeof createResearchFollowupsFixture>;
type State = ReturnType<SharedNativeFixture["getSnapshot"]>;
export interface ScreenComparisonFollowupNativeMetadata {
  readonly packets: Screen["screenComparisonReport"]["packets"];
  readonly getSnapshot: () => Readonly<{
    researchResolve: number;
    rejected: number;
  }>;
  readonly subscribe: (listener: () => void) => () => void;
}

class ComparisonFollowupTransport {
  private researchResolve = 0;
  private rejected = 0;
  private state: State;
  private metadata: Readonly<{ researchResolve: number; rejected: number }> =
    Object.freeze({ researchResolve: 0, rejected: 0 });
  private readonly listeners = new Set<() => void>();
  constructor(
    private readonly base: SharedNativeFixture,
    private readonly screen: Screen,
    private readonly followups: Followups,
  ) {
    this.state = screen.getSnapshot();
    screen.subscribe(this.publish);
  }
  readonly getSnapshot = () => this.state;
  readonly getMetadata = () => this.metadata;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private readonly publish = () => {
    const screen = this.screen.getSnapshot();
    this.state = { ...screen, resolve: screen.resolve + this.researchResolve };
    this.metadata = Object.freeze({
      researchResolve: this.researchResolve,
      rejected: this.rejected,
    });
    for (const listener of this.listeners) listener();
  };
  private refuse(): never {
    this.rejected++;
    this.publish();
    throw new Error("Unexpected invented screen-comparison-followup operation");
  }
  private readonly load: ManagedApi["load"] = async (signal) => {
    const state = this.base.getSnapshot();
    if (
      signal.aborted ||
      state.load >= this.followups.getSnapshot().session ||
      state.load >= 2
    )
      return this.refuse();
    if (state.load === 1 && this.followups.getSnapshot().commits !== 1)
      return this.refuse();
    const saved = await this.base.api.load(signal);
    return {
      ...saved,
      payload: {
        ...saved.payload,
        memberships: saved.payload.memberships.map((member) => {
          const exact =
            member.listingId === "listing-zero"
              ? annualComparisonMemberships.left
              : annualComparisonMemberships.right;
          if (member.listingId !== exact.listingId) return this.refuse();
          return { ...exact, note: member.note };
        }),
      },
    };
  };
  private readonly status: ManagedApi["status"] = (signal) => {
    if (
      signal.aborted ||
      this.base.getSnapshot().status >= this.followups.getSnapshot().session
    )
      return this.refuse();
    return this.base.api.status(signal);
  };
  private readonly resolve: ManagedApi["resolve"] = (request, signal) => {
    const ids = request.listingIds.join("|");
    const cohort = this.base.marketsCohort
      .map((row) => row.listingId)
      .join("|");
    if (ids === cohort && this.followups.getSnapshot().session === 2) {
      if (signal.aborted || this.base.getSnapshot().marketsResolve !== 1)
        return this.refuse();
      return this.base.api.resolve(request, signal);
    }
    if (ids !== "listing-one") return this.screen.api.resolve(request, signal);
    return this.resolveResearch(request, signal);
  };
  private resolveResearch(
    request: Parameters<ManagedApi["resolve"]>[0],
    signal: AbortSignal,
  ) {
    if (
      signal.aborted ||
      this.researchResolve !== 0 ||
      this.followups.getSnapshot().load !== 1
    )
      return this.refuse();
    const { note: _note, ...listing } = annualComparisonMemberships.right;
    void _note;
    const parsed = parseManagedCatalogResolveResponse(
      {
        snapshotSha256: request.snapshotSha256,
        results: [{ listingId: listing.listingId, listing }],
      },
      request,
    );
    if (
      !parsed ||
      request.snapshotSha256 !==
        this.base.researchCoverage.catalogSnapshotSha256
    )
      return this.refuse();
    this.researchResolve++;
    this.publish();
    return Promise.resolve(parsed);
  }
  private readonly loadFollowups: ManagedApi["loadFollowups"] = (signal) => {
    const state = this.followups.getSnapshot();
    if (
      signal.aborted ||
      this.screen.getSnapshot().annual !== 2 ||
      state.load >= 2
    )
      return this.refuse();
    if (state.load === 1 && (state.commits !== 1 || state.session !== 2))
      return this.refuse();
    return this.followups.api.loadFollowups(signal);
  };
  private readonly saveFollowups: ManagedApi["saveFollowups"] = (
    input,
    signal,
  ) => {
    const command = parseManagedResearchFollowupsCommand(input);
    const entry = command?.payload.entries[2];
    const expected = entry
      ? comparisonFollowupExpected(this.base, entry)
      : null;
    if (
      signal.aborted ||
      !command ||
      !expected ||
      this.researchResolve !== 1 ||
      this.followups.getSnapshot().save !== 0 ||
      command.expectedVersion !== 1 ||
      encodeResearchFollowupsPayload(command.payload) !==
        encodeResearchFollowupsPayload(expected)
    )
      return this.refuse();
    return this.followups.api.saveFollowups(command, signal);
  };
  api(): ManagedApi {
    return {
      ...this.screen.api,
      load: this.load,
      status: this.status,
      resolve: this.resolve,
      loadFollowups: this.loadFollowups,
      saveFollowups: this.saveFollowups,
    };
  }
}

/** Separate invented store and source fixture; all prior native cases stay untouched. */
export async function createScreenComparisonFollowupNativeFixture(
  base: SharedNativeFixture,
): Promise<ManagedNativeFixture> {
  const screen = await createScreenComparisonReportNativeFixture(base);
  const followups = createResearchFollowupsFixture({
    version: 1,
    payload: comparisonFollowupOriginal(base),
  });
  const transport = new ComparisonFollowupTransport(base, screen, followups);
  return {
    ...screen,
    api: transport.api(),
    followups,
    session: followups.nextSession(),
    screenComparisonFollowup: Object.freeze({
      packets: screen.screenComparisonReport.packets,
      getSnapshot: transport.getMetadata,
      subscribe: transport.subscribe,
    }),
    getSnapshot: transport.getSnapshot,
    subscribe: transport.subscribe,
  };
}
