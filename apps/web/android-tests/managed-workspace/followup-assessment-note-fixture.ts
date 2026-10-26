import {
  encodeMainWatchlistPayload,
  membershipMatchesResult,
  parseManagedResearchFollowupsCommand,
  parseManagedWatchlistCommand,
  parseManagedWatchlistReceipt,
  type ManagedWatchlistDto,
} from "@research-cockpit/contracts";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import {
  reviewSessionDueOn,
  reviewSessionQuestions,
  reviewSessionResults,
} from "./followups-review-session-fixture";

export const assessmentNotePrefix = "Independent company note before review";

/** Handwritten fixture expectation, separate from the product formatter. */
export function assessmentNoteGolden(recordedAt: string): string {
  return `${assessmentNotePrefix} Follow-up assessment for ZERO (Class A, XNAS). Question: ${reviewSessionQuestions[0]} | Due date (UTC): ${reviewSessionDueOn} | State: open | My assessment: ${reviewSessionResults[0]} | Authored assessment recorded at (UTC): ${recordedAt}. Authored text; original source dates remain unchanged.`;
}

type Api = SharedNativeFixture["api"];
function refuse(): never {
  throw new Error("Unexpected invented assessment-to-note action");
}

/** Two explicit independent saves. The underlying Follow-ups RAM store is unchanged. */
class AssessmentNoteFixture {
  private original: ManagedWatchlistDto | null = null;
  private stored: ManagedWatchlistDto | null = null;
  private saves = 0;
  private readonly sourceAttempts = { eod: 0, annual: 0, filings: 0 };
  private state: ReturnType<SharedNativeFixture["getSnapshot"]>;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly base: SharedNativeFixture) {
    this.state = base.getSnapshot();
    base.subscribe(this.publish);
  }
  readonly getSnapshot = () => this.state;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private readonly publish = () => {
    this.state = {
      ...this.base.getSnapshot(),
      save: this.saves,
      ...this.sourceAttempts,
    };
    for (const listener of this.listeners) listener();
  };
  readonly load: Api["load"] = async (signal) => {
    const count = this.base.getSnapshot().load;
    if (signal.aborted || count >= 2) refuse();
    if (count === 1 && this.saves !== 1) refuse();
    const result = await this.base.api.load(signal);
    this.original ??= structuredClone(result);
    return structuredClone(this.stored ?? result);
  };
  source(kind: keyof typeof this.sourceAttempts): never {
    this.sourceAttempts[kind]++;
    this.publish();
    return refuse();
  }
  private requireSaveState(signal: AbortSignal) {
    const state = this.base.getSnapshot();
    if (signal.aborted || !this.original) refuse();
    if (state.load !== 1 || state.status !== 1 || state.resolve !== 1) refuse();
    if (Object.values(this.sourceAttempts).some((count) => count !== 0))
      refuse();
    if (state.marketsEod || state.calendar || state.fed) refuse();
  }
  readonly saveFollowups: Api["saveFollowups"] = (input, signal) => {
    this.requireSaveState(signal);
    if (this.saves !== 0 || this.base.followups!.getSnapshot().save !== 0)
      refuse();
    const command = parseManagedResearchFollowupsCommand(input);
    if (!command || command.expectedVersion !== 0) return refuse();
    const entries = command.payload.entries;
    if (entries.length !== 2) refuse();
    entries.forEach((entry, index) => {
      const member = this.original!.payload.memberships[index];
      if (!member || !membershipMatchesResult(member, entry.listing)) refuse();
      if (
        entry.catalogSnapshotSha256 !== this.original!.payload.snapshotSha256 ||
        entry.check !== reviewSessionQuestions[index] ||
        entry.result !== (index === 0 ? reviewSessionResults[0] : "") ||
        entry.dueOn !== reviewSessionDueOn ||
        entry.status !== "open" ||
        entry.completedOn !== null
      )
        refuse();
    });
    return this.base.api.saveFollowups(command, signal);
  };
  readonly save: Api["save"] = (input, signal) => {
    this.requireSaveState(signal);
    if (this.saves !== 0 || this.base.followups!.getSnapshot().commits !== 1)
      refuse();
    const command = parseManagedWatchlistCommand(input);
    if (!command || command.expectedVersion !== 1) return refuse();
    const note = command.payload.memberships[0]?.note ?? "";
    const stamp =
      / \| Authored assessment recorded at \(UTC\): (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\. Authored text; original source dates remain unchanged\.$/u.exec(
        note,
      )?.[1];
    if (!stamp || !Number.isFinite(Date.parse(stamp))) return refuse();
    if (new Date(stamp).toISOString() !== stamp) refuse();
    const expected = {
      ...this.original!.payload,
      memberships: this.original!.payload.memberships.map((member, index) =>
        index === 0 ? { ...member, note: assessmentNoteGolden(stamp) } : member,
      ),
    };
    if (
      encodeMainWatchlistPayload(command.payload) !==
      encodeMainWatchlistPayload(expected)
    )
      refuse();
    const receipt = parseManagedWatchlistReceipt(
      { version: 2, payload: command.payload, replayed: false },
      command,
    );
    if (!receipt) return refuse();
    this.stored = { version: receipt.version, payload: receipt.payload };
    this.saves++;
    this.publish();
    return Promise.resolve(structuredClone(receipt));
  };
}

export function createFollowupAssessmentNoteNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const store = new AssessmentNoteFixture(base);
  return {
    ...base,
    financialReview: null,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    api: {
      ...base.api,
      load: store.load,
      save: store.save,
      saveFollowups: store.saveFollowups,
      eodHistory: () => store.source("eod"),
      annualReport: () => store.source("annual"),
      recentFilings: () => store.source("filings"),
    },
  };
}
