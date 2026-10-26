import {
  encodeResearchFollowupsPayload,
  parseManagedResearchFollowups,
  parseManagedResearchFollowupsCommand,
  parseManagedResearchFollowupsReceipt,
  type ManagedResearchFollowupsCommand,
  type ManagedResearchFollowupsDto,
  type ManagedResearchFollowupsReceiptDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { TrialApiError } from "../../src/clerk-trial/api";
import type { TrialSession } from "../../src/clerk-trial/session";

type ReadMode = "complete" | "hold" | "fail" | "retire";
type SaveMode = ReadMode | "lost-ack" | "conflict";
interface FollowupsFixtureState {
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
export function createResearchFollowupsFixture(
  initial: ManagedResearchFollowupsDto = {
    version: 0,
    payload: { schemaVersion: 1, entries: [] },
  },
) {
  let stored: ManagedResearchFollowupsDto = owned(initial);
  const receipts = new Map<
    string,
    {
      command: ManagedResearchFollowupsCommand;
      receipt: ManagedResearchFollowupsReceiptDto;
    }
  >();
  const held: (() => void)[] = [];
  const listeners = new Set<() => void>();
  let state: FollowupsFixtureState = Object.freeze({
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
    version: stored.version,
    nextRead: "complete",
    nextSave: "complete",
  });
  function update(patch: Partial<typeof state>) {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of listeners) listener();
  }
  function bounded(signal: AbortSignal) {
    if (signal.aborted || state.load + state.save >= 64)
      throw new Error("Unexpected cancelled or unbounded follow-up request");
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
  const api: Pick<ManagedApi, "loadFollowups" | "saveFollowups"> = {
    loadFollowups: (signal) => {
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
            : new Error("Invented follow-up read failed"),
        );
      }
    },
    saveFollowups: (input, signal) => {
      try {
        bounded(signal);
        const command = parseManagedResearchFollowupsCommand(input);
        if (!command) throw new Error("Invalid invented follow-up command");
        const mode = state.nextSave;
        if (mode === "hold" && held.length >= 4)
          throw new Error("The invented held-response queue is full");
        update({ save: state.save + 1, nextSave: "complete" });
        const prior = receipts.get(command.idempotencyKey);
        if (prior) {
          if (
            prior.command.expectedVersion !== command.expectedVersion ||
            encodeResearchFollowupsPayload(prior.command.payload) !==
              encodeResearchFollowupsPayload(command.payload)
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
            payload: stored.payload,
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
            : new Error("Invented follow-up save failed"),
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
      const sessionId = `invented-followups-session-${state.session + 1}`;
      update({
        session: state.session + 1,
        nextRead: "complete",
        nextSave: "complete",
      });
      return {
        userId: "invented-followups-user",
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
  const parsed = parseManagedResearchFollowups(value);
  if (!parsed) throw new Error("Invalid invented follow-up store");
  return parsed;
}

function receipt(value: unknown, command: ManagedResearchFollowupsCommand) {
  const parsed = parseManagedResearchFollowupsReceipt(value, command);
  if (!parsed) throw new Error("Invalid invented follow-up receipt");
  return parsed;
}
