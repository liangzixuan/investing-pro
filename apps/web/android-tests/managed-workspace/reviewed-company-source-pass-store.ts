import {
  encodeMainWatchlistPayload,
  parseManagedWatchlistCommand,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import type { SharedNativeFixture } from "./fixture";
import type { ReviewedCompanySourcePassControls } from "./reviewed-company-source-pass-fixture";
import {
  refuseCompanyPassFixture as refuse,
  type reviewedCompanyPassEvidence,
} from "./reviewed-company-source-pass-evidence";

type State = ReturnType<SharedNativeFixture["getSnapshot"]>;
type Api = SharedNativeFixture["api"];
type Stored = Awaited<ReturnType<Api["load"]>>;
type Evidence = Awaited<ReturnType<typeof reviewedCompanyPassEvidence>>;
type Source = "eod" | "annual" | "filings" | "interimReport";

/** Owns fixed RAM storage, admitted request order and one deliberately late Annual reply. */
export class ReviewedCompanySourcePassStore {
  private stored: Stored | null = null;
  private original: Stored | null = null;
  private annual: PersonalSecAnnualCanonicalResponseDto | null = null;
  private pending:
    ((value: PersonalSecAnnualCanonicalResponseDto) => void) | null = null;
  private state: State;
  private observations = {
    order: [] as readonly string[],
    aborted: 0,
    late: 0,
  };
  private readonly overrides: Partial<State> = {};
  private readonly listeners = new Set<() => void>();
  constructor(
    private readonly base: SharedNativeFixture,
    private readonly evidence: Evidence,
  ) {
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
    this.state = { ...this.base.getSnapshot(), ...this.overrides };
    for (const listener of this.listeners) listener();
  };
  private record(name: Source) {
    this.overrides[name] = this.state[name] + 1;
    this.observations = {
      ...this.observations,
      order: [...this.observations.order, name],
    };
    this.publish();
  }
  private admitVisit(signal: AbortSignal) {
    if (signal.aborted) refuse();
    if (!this.original) refuse();
    if (this.state.load !== 1) refuse();
    if (this.state.status !== 1) refuse();
    if (this.state.save !== 0) refuse();
  }
  private admitSource(
    signal: AbortSignal,
    input: { catalogSnapshotSha256: string; listingId: string },
  ) {
    this.admitVisit(signal);
    if (
      input.catalogSnapshotSha256 !== this.evidence.packet.catalogSnapshotSha256
    )
      refuse();
    if (input.listingId !== this.evidence.packet.security.listingId) refuse();
  }
  private cancelledReply() {
    if (!this.pending) return refuse();
    if (!this.annual) return refuse();
    if (this.observations.aborted !== 1) return refuse();
    if (this.observations.late !== 0) return refuse();
    return { resolve: this.pending, packet: this.annual };
  }
  private readonly settleCancelledAnnual = () => {
    const { resolve, packet } = this.cancelledReply();
    this.pending = null;
    resolve(structuredClone(packet));
    void Promise.resolve().then(() => {
      this.observations = { ...this.observations, late: 1 };
      this.publish();
    });
  };
  readonly controls: ReviewedCompanySourcePassControls = {
    subscribe: this.subscribe,
    getSnapshot: () => this.observations,
    settleCancelledAnnual: this.settleCancelledAnnual,
  };
  private admitLoad(signal: AbortSignal) {
    if (signal.aborted) refuse();
    if (this.state.load > 1) refuse();
    if (this.state.load === 1 && this.state.save !== 1) refuse();
  }
  readonly load: Api["load"] = async (signal) => {
    this.admitLoad(signal);
    const count = this.state.load;
    if (!this.stored) {
      this.stored = structuredClone(await this.base.api.load(signal));
      this.original = structuredClone(this.stored);
    }
    this.overrides.load = count + 1;
    this.publish();
    return structuredClone(this.stored);
  };
  readonly eodHistory: Api["eodHistory"] = (input, signal) => {
    this.admitSource(signal, input);
    if (this.state.eod !== 0) return refuse();
    if (this.state.annual !== 0) return refuse();
    this.record("eod");
    return this.base.api.eodHistory(input, signal);
  };
  private continuedAnnual() {
    if (!this.annual) return refuse();
    if (this.pending) return refuse();
    if (this.observations.late !== 1) return refuse();
    this.record("annual");
    return structuredClone(this.annual);
  }
  private admitAnnual(
    signal: AbortSignal,
    input: Parameters<Api["annualReport"]>[0],
  ) {
    this.admitSource(signal, input);
    if (this.state.eod !== 1) refuse();
    if (this.state.annual > 1) refuse();
    if (this.state.filings !== 0) refuse();
  }
  private holdAnnual(signal: AbortSignal) {
    return new Promise<PersonalSecAnnualCanonicalResponseDto>((resolve) => {
      this.pending = resolve;
      signal.addEventListener(
        "abort",
        () => {
          this.observations = {
            ...this.observations,
            aborted: this.observations.aborted + 1,
          };
          this.publish();
        },
        { once: true },
      );
      this.publish();
    });
  }
  readonly annualReport: Api["annualReport"] = async (input, signal) => {
    this.admitAnnual(signal, input);
    if (this.state.annual === 1) return this.continuedAnnual();
    this.record("annual");
    this.annual = await this.base.api.annualReport(input, signal);
    return this.holdAnnual(signal);
  };
  readonly recentFilings: Api["recentFilings"] = (input, signal) => {
    this.admitSource(signal, input);
    if (this.state.annual !== 2) return refuse();
    if (this.state.filings !== 0) return refuse();
    if (this.pending) return refuse();
    this.record("filings");
    return this.base.api.recentFilings(input, signal);
  };
  readonly interimReport: Api["interimReport"] = (input, signal) => {
    this.admitSource(signal, input);
    if (input.symbol !== this.evidence.packet.security.symbol) return refuse();
    if (this.state.filings !== 1) return refuse();
    if (this.state.interimReport !== 0) return refuse();
    this.record("interimReport");
    return Promise.resolve(structuredClone(this.evidence.packet));
  };
  private saveBase(signal: AbortSignal) {
    if (!this.original) return refuse();
    if (!this.stored) return refuse();
    if (signal.aborted) return refuse();
    if (this.state.save !== 0) return refuse();
    if (this.state.interimReport !== 1) return refuse();
    return this.original;
  }
  private expectedSavedPayload(original: Stored) {
    return {
      ...original.payload,
      memberships: original.payload.memberships.map((member, index) =>
        index === 0
          ? { ...member, note: this.evidence.metadata.expectedNote }
          : member,
      ),
    };
  }
  private captureSave(input: Parameters<Api["save"]>[0], signal: AbortSignal) {
    const command = parseManagedWatchlistCommand(input);
    const original = this.saveBase(signal);
    if (!command) return refuse();
    if (command.expectedVersion !== 1) return refuse();
    const expected = this.expectedSavedPayload(original);
    if (
      encodeMainWatchlistPayload(command.payload) !==
      encodeMainWatchlistPayload(expected)
    )
      return refuse();
    return command;
  }
  readonly save: Api["save"] = (input, signal) => {
    const command = this.captureSave(input, signal);
    this.stored = { version: 2, payload: structuredClone(command.payload) };
    this.overrides.save = 1;
    this.publish();
    return Promise.resolve({
      ...structuredClone(this.stored),
      replayed: false,
    });
  };
}
