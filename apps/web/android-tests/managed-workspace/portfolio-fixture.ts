import {
  encodePortfolioPayload,
  encodeMainWatchlistPayload,
  parseManagedWatchlistCommand,
  type ManagedWatchlistDto,
  parseManagedPortfolio,
  parseManagedPortfolioCommand,
  parseManagedPortfolioReceipt,
  type ManagedPortfolioCommand,
  type ManagedPortfolioDto,
  type ManagedPortfolioReceiptDto,
  parseManagedCatalogResolveResponse,
  type ManagedCatalogSnapshotDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { TrialApiError } from "../../src/clerk-trial/api";
import type { TrialSession } from "../../src/clerk-trial/session";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";

type ReadMode = "complete" | "hold" | "fail" | "retire";
type SaveMode = ReadMode | "lost-ack" | "conflict";
interface PortfolioFixtureState {
  readonly session: number;
  readonly load: number;
  readonly save: number;
  readonly commits: number;
  readonly replays: number;
  readonly conflicts: number;
  readonly keyConflicts: number;
  readonly otherClientCommits: number;
  readonly failures: number;
  readonly retirements: number;
  readonly aborted: number;
  readonly settled: number;
  readonly held: number;
  readonly signOut: number;
  readonly token: number;
  readonly version: number;
  readonly nextRead: ReadMode;
  readonly nextSave: SaveMode;
}

/** One invented account, independent RAM resource, and explicit failure controls. */
export function createPortfolioResource() {
  let stored: ManagedPortfolioDto = owned({
    version: 0,
    payload: null,
  });
  const receipts = new Map<
    string,
    {
      command: ManagedPortfolioCommand;
      receipt: ManagedPortfolioReceiptDto;
    }
  >();
  const held: (() => void)[] = [];
  const listeners = new Set<() => void>();
  let state: PortfolioFixtureState = Object.freeze({
    session: 0,
    load: 0,
    save: 0,
    commits: 0,
    replays: 0,
    conflicts: 0,
    keyConflicts: 0,
    otherClientCommits: 0,
    failures: 0,
    retirements: 0,
    aborted: 0,
    settled: 0,
    held: 0,
    signOut: 0,
    token: 0,
    version: 0,
    nextRead: "complete",
    nextSave: "complete",
  });
  function update(patch: Partial<typeof state>) {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of listeners) listener();
  }
  function bounded(signal: AbortSignal) {
    if (signal.aborted || state.load + state.save >= 64)
      throw new Error("Unexpected cancelled or unbounded portfolio request");
  }
  function delayed<T>(packet: T, signal: AbortSignal): Promise<T> {
    // The caller admitted capacity before committing. Abort cannot undo a commit.
    return new Promise((resolve) => {
      const aborted = () => update({ aborted: state.aborted + 1 });
      signal.addEventListener("abort", aborted, { once: true });
      held.push(() => {
        signal.removeEventListener("abort", aborted);
        resolve(packet);
      });
      update({ held: held.length });
    });
  }
  function failed(mode: "fail" | "retire"): never {
    update(
      mode === "retire"
        ? { retirements: state.retirements + 1 }
        : { failures: state.failures + 1 },
    );
    throw new TrialApiError(
      mode === "retire" ? "unauthenticated" : "unavailable",
    );
  }
  const api: Pick<ManagedApi, "loadPortfolio" | "savePortfolio"> = {
    loadPortfolio: (signal) => {
      try {
        bounded(signal);
        const mode = state.nextRead;
        if (mode === "hold" && held.length >= 4)
          throw new Error("The invented held-response queue is full");
        const captured = owned(stored);
        update({ load: state.load + 1, nextRead: "complete" });
        if (mode === "fail" || mode === "retire") failed(mode);
        return mode === "hold"
          ? delayed(captured, signal)
          : Promise.resolve(captured);
      } catch (error) {
        return Promise.reject(
          error instanceof Error
            ? error
            : new Error("Invented portfolio read failed"),
        );
      }
    },
    savePortfolio: (input, signal) => {
      try {
        bounded(signal);
        const command = parseManagedPortfolioCommand(input);
        if (!command) throw new Error("Invalid invented portfolio command");
        const mode = state.nextSave;
        if (mode === "hold" && held.length >= 4)
          throw new Error("The invented held-response queue is full");
        update({ save: state.save + 1, nextSave: "complete" });
        const prior = receipts.get(command.idempotencyKey);
        if (prior) {
          if (
            prior.command.expectedVersion !== command.expectedVersion ||
            encodePortfolioPayload(prior.command.payload) !==
              encodePortfolioPayload(command.payload)
          ) {
            update({ keyConflicts: state.keyConflicts + 1 });
            throw new TrialApiError("idempotency_conflict");
          }
          const replay = receipt({ ...prior.receipt, replayed: true }, command);
          update({ replays: state.replays + 1 });
          return Promise.resolve(replay);
        }
        if (mode === "fail" || mode === "retire") failed(mode);
        if (mode === "conflict") {
          stored = owned({
            version: stored.version + 1,
            payload: stored.payload ?? command.payload,
          });
          update({
            version: stored.version,
            otherClientCommits: state.otherClientCommits + 1,
          });
        }
        if (command.expectedVersion !== stored.version) {
          update({ conflicts: state.conflicts + 1 });
          throw new TrialApiError("conflict");
        }
        if (receipts.size >= 32)
          throw new Error("The invented receipt store is full");
        const accepted = receipt(
          {
            version: stored.version + 1,
            payload: command.payload,
            replayed: false,
          },
          command,
        );
        stored = owned({
          version: accepted.version,
          payload: accepted.payload,
        });
        receipts.set(command.idempotencyKey, { command, receipt: accepted });
        update({ commits: state.commits + 1, version: stored.version });
        if (mode === "lost-ack") throw new TrialApiError("commit_unknown");
        // Commit is complete before a held acknowledgement; retirement only fences the reply.
        return mode === "hold"
          ? delayed(accepted, signal)
          : Promise.resolve(accepted);
      } catch (error) {
        return Promise.reject(
          error instanceof Error
            ? error
            : new Error("Invented portfolio save failed"),
        );
      }
    },
  };
  return {
    api,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    nextSession(): TrialSession {
      if (state.session >= 8) throw new Error("Too many invented sessions");
      const sessionId = `invented-portfolio-session-${state.session + 1}`;
      update({
        session: state.session + 1,
        nextRead: "complete",
        nextSave: "complete",
      });
      return {
        userId: "invented-portfolio-user",
        sessionId,
        getToken: () => {
          update({ token: state.token + 1 });
          return Promise.reject(new Error("No fixture token is available"));
        },
        signOut: () => {
          update({ signOut: state.signOut + 1 });
          return Promise.resolve();
        },
      };
    },
    setNextRead(mode: ReadMode) {
      if (!["complete", "hold", "fail", "retire"].includes(mode))
        throw new Error("Unknown invented read mode");
      update({ nextRead: mode });
    },
    setNextSave(mode: SaveMode) {
      if (
        ![
          "complete",
          "hold",
          "fail",
          "retire",
          "lost-ack",
          "conflict",
        ].includes(mode)
      )
        throw new Error("Unknown invented save mode");
      update({ nextSave: mode });
    },
    settleHeld() {
      const settle = held.shift();
      if (!settle) throw new Error("No invented held response is pending");
      update({ held: held.length, settled: state.settled + 1 });
      settle();
    },
  };
}

function owned(value: unknown) {
  const parsed = parseManagedPortfolio(value);
  if (!parsed) throw new Error("Invalid invented portfolio store");
  return parsed;
}

function receipt(value: unknown, command: ManagedPortfolioCommand) {
  const parsed = parseManagedPortfolioReceipt(value, command);
  if (!parsed) throw new Error("Invalid invented portfolio receipt");
  return parsed;
}

export type PortfolioNativeControls = ReturnType<
  typeof createPortfolioResource
>;

/** Add only the Portfolio resource; shared catalog/Watchlist/Follow-ups stay independent. */
export function createPortfolioNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  if (!base.followups)
    throw new Error("Portfolio journey needs independent Follow-ups");
  const portfolio = createPortfolioResource();
  const listing = base.priceCoverage.find(
    (row) => row.listingId === "listing-zero",
  );
  if (!listing) throw new Error("Missing invented Portfolio listing");
  let catalog: ManagedCatalogSnapshotDto | null = null;
  let resolves = 0;
  let snapshot = base.getSnapshot();
  const listeners = new Set<() => void>();
  const publish = () => {
    snapshot = {
      ...base.getSnapshot(),
      resolve: resolves,
      save: base.getSnapshot().save + watchlist.saves(),
    };
    for (const listener of listeners) listener();
  };
  const watchlist = createHoldingWatchlist(base, publish);
  base.subscribe(publish);
  const originalNextSession = portfolio.nextSession.bind(portfolio);
  const wrapSession = (
    session: TrialSession,
    own: TrialSession,
  ): TrialSession => ({
    ...session,
    getToken: () => own.getToken(),
    signOut: async () => {
      await own.signOut();
      await session.signOut();
    },
  });
  // One session in each independent fixture, with the shared principal/lifetime.
  const session = wrapSession(base.session, originalNextSession());
  portfolio.nextSession = () => {
    const next = originalNextSession();
    return wrapSession(base.followups!.nextSession(), next);
  };
  return {
    ...base,
    session,
    financialReview: null,
    portfolio,
    api: {
      ...base.api,
      ...portfolio.api,
      load: watchlist.load,
      save: watchlist.save,
      status: async (signal) => {
        const result = await base.api.status(signal);
        catalog = result.snapshot;
        return result;
      },
      resolve: (request, signal) => {
        try {
          if (
            signal.aborted ||
            !catalog ||
            resolves >= 16 ||
            request.snapshotSha256 !== catalog.snapshotSha256 ||
            request.listingIds.length !== 1 ||
            request.listingIds[0] !== listing.listingId
          )
            throw new Error(
              "Unexpected invented Portfolio identity resolution",
            );
          resolves += 1;
          publish();
          const result = parseManagedCatalogResolveResponse(
            {
              snapshotSha256: catalog.snapshotSha256,
              results: [{ listingId: listing.listingId, listing }],
            },
            request,
          );
          if (!result)
            throw new Error("Invalid invented Portfolio identity result");
          return Promise.resolve(result);
        } catch (error) {
          return Promise.reject(
            error instanceof Error
              ? error
              : new Error("Invented Portfolio resolution failed"),
          );
        }
      },
    },
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function holdingWatchlistCommand(
  original: ManagedWatchlistDto | null,
  input: Parameters<ManagedApi["save"]>[0],
) {
  const command = parseManagedWatchlistCommand(input);
  if (!command) return null;
  if (!original) return null;
  if (original.version !== 1) return null;
  const members = original.payload.memberships;
  if (
    members.map((member) => member.listingId).join("|") !==
    "listing-zero|listing-one"
  )
    return null;
  if (command.expectedVersion !== 1) return null;
  const expected = {
    ...original.payload,
    memberships: [
      { ...members[1]!, note: "Holding research list note" },
      { ...members[0]!, note: "" },
    ],
  };
  return encodeMainWatchlistPayload(command.payload) ===
    encodeMainWatchlistPayload(expected)
    ? command
    : null;
}
/** Admit only the declared native holding handoff; every other Watchlist write keeps the original refusal. */
function createHoldingWatchlist(
  base: SharedNativeFixture,
  publish: () => void,
) {
  let original: ManagedWatchlistDto | null = null;
  let stored: ManagedWatchlistDto | null = null;
  let saves = 0;
  const load: ManagedApi["load"] = async (signal) => {
    const result = await base.api.load(signal);
    original ??= structuredClone(result);
    return structuredClone(stored ?? result);
  };
  const save: ManagedApi["save"] = (input, signal) => {
    const command = holdingWatchlistCommand(original, input);
    if (signal.aborted) return base.api.save(input, signal);
    if (saves !== 0) return base.api.save(input, signal);
    if (base.getSnapshot().save !== 0) return base.api.save(input, signal);
    if (!command) return base.api.save(input, signal);
    stored = { version: 2, payload: structuredClone(command.payload) };
    saves += 1;
    publish();
    return Promise.resolve({ ...structuredClone(stored), replayed: false });
  };
  return { load, save, saves: () => saves };
}
