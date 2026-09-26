"use client";

import { useEffect, useRef, useState } from "react";
import {
  PersonalWorkspaceApiError,
  type PersonalWorkspaceApiErrorCode,
} from "../../lib/personal-workspace-api";
import type { OwnerSessionActivityStart } from "../research/owner-session-lifecycle";
import {
  admitMarketBoard,
  createMarketBoardRefreshBudget,
  loadMarketBoard,
  marketBoardCohortKey,
  marketBoardIdentityKey,
  type MarketBoardDefinition,
  type MarketBoardDraft,
  type MarketBoardMember,
  type MarketBoardSnapshot,
  type MarketBoardWatchlist,
} from "./market-board-loader";

export interface MarketsSnapshotContext {
  readonly active: boolean;
  readonly enabled: boolean;
  readonly catalogSnapshotSha256: string | null;
  readonly sessionKey: number;
  readonly isCurrent: () => boolean;
  readonly isActive: () => boolean;
  readonly watchlist: MarketBoardWatchlist;
  readonly isWatchlistCurrent: (
    members: readonly MarketBoardMember[],
  ) => boolean;
  readonly onActivityStart: OwnerSessionActivityStart;
  readonly onSessionUnavailable: () => void;
}
interface State {
  readonly draft: MarketBoardDraft;
  readonly snapshot: MarketBoardSnapshot | null;
  readonly selectedListingId: string | null;
  readonly busy: boolean;
  readonly attempted: boolean;
  readonly error: PersonalWorkspaceApiErrorCode | "refresh_deferred" | null;
  readonly nextRefreshAt: number | null;
}
const initial: State = {
  draft: { mode: "default", watchlistMembers: [] },
  snapshot: null,
  selectedListingId: null,
  busy: false,
  attempted: false,
  error: null,
  nextRefreshAt: null,
};
function definition(draft: MarketBoardDraft): MarketBoardDefinition {
  return draft.mode === "default"
    ? { kind: "default" }
    : { kind: "watchlist", members: draft.watchlistMembers };
}
function authorized(
  context: MarketsSnapshotContext,
  board: MarketBoardDefinition,
) {
  return (
    board.kind === "default" ||
    (context.watchlist.status === "available" &&
      context.isWatchlistCurrent(board.members))
  );
}
function hasHistory(snapshot: MarketBoardSnapshot) {
  return snapshot.rows.some(
    (row) =>
      row.identity !== null &&
      row.error === null &&
      row.overview?.history.status === "available" &&
      row.overview.history.value.bars.length > 0,
  );
}
function failedSnapshotCode(
  snapshot: MarketBoardSnapshot,
): PersonalWorkspaceApiErrorCode {
  const code =
    snapshot.stoppedBy ??
    snapshot.rows.find((row) => row.error !== null)?.error;
  return code === undefined ||
    code === null ||
    code === "not_in_catalog" ||
    code === "not_requested" ||
    code === "unsupported_listing" ||
    code === "identity_mismatch"
    ? "unavailable"
    : code;
}

/** One explicit cohort load; the mounted shell retains the shared request budget. */
export function useMarketsSnapshot(context: MarketsSnapshotContext) {
  const [state, setState] = useState<State>(initial);
  const contextCurrent = context.isCurrent();
  const current = useRef({
    context,
    contextCurrent,
    state,
    mounted: true,
    epoch: 0,
    controller: null as AbortController | null,
    budget: createMarketBoardRefreshBudget(),
  });
  const prior = current.current.context;
  const changed =
    prior.sessionKey !== context.sessionKey ||
    prior.catalogSnapshotSha256 !== context.catalogSnapshotSha256 ||
    prior.enabled !== context.enabled;
  const retired = current.current.contextCurrent && !contextCurrent;
  // Only invalid selected identities retire a draft. Notes, versions and unrelated
  // memberships are not authority, and replacements are never silently selected.
  const members =
    context.watchlist.status === "available"
      ? state.draft.watchlistMembers.filter((member) =>
          context.watchlist.members.some(
            (candidate) =>
              marketBoardIdentityKey(candidate) ===
              marketBoardIdentityKey(member),
          ),
        )
      : state.draft.watchlistMembers;
  const selectionChanged =
    members.length !== state.draft.watchlistMembers.length;
  const draftUnauthorized = !authorized(context, definition(state.draft));
  const snapshotUnauthorized =
    state.snapshot !== null && !authorized(context, state.snapshot.definition);
  const activeSelectionChanged =
    selectionChanged && state.draft.mode === "watchlist";
  const retireRequest =
    changed ||
    retired ||
    prior.active !== context.active ||
    activeSelectionChanged ||
    (state.busy && draftUnauthorized);
  if (retireRequest || selectionChanged || snapshotUnauthorized) {
    if (retireRequest) {
      current.current.epoch += 1;
      current.current.controller?.abort();
      current.current.controller = null;
    }
    current.current.state =
      changed || retired
        ? initial
        : {
            ...state,
            draft: selectionChanged
              ? { ...state.draft, watchlistMembers: Object.freeze(members) }
              : state.draft,
            snapshot: snapshotUnauthorized ? null : state.snapshot,
            selectedListingId: snapshotUnauthorized
              ? null
              : state.selectedListingId,
            busy: retireRequest ? false : state.busy,
            error:
              activeSelectionChanged ||
              (snapshotUnauthorized && state.draft.mode === "watchlist")
                ? null
                : state.error,
            attempted: activeSelectionChanged ? false : state.attempted,
          };
    setState(current.current.state);
  } else current.current.state = state;
  current.current.context = context;
  current.current.contextCurrent = contextCurrent;
  const epoch = current.current.epoch;
  const visible = current.current.state;
  const draft = definition(visible.draft);
  const cohortKey =
    context.catalogSnapshotSha256 === null
      ? null
      : marketBoardCohortKey(draft, context.catalogSnapshotSha256);
  const snapshot =
    context.enabled &&
    contextCurrent &&
    visible.snapshot?.cohortKey === cohortKey &&
    authorized(context, visible.snapshot.definition)
      ? visible.snapshot
      : null;

  function publish(next: State) {
    current.current.state = next;
    setState(next);
  }
  function valid() {
    return (
      current.current.mounted &&
      epoch === current.current.epoch &&
      context.active &&
      current.current.context.active &&
      context.enabled &&
      current.current.context.enabled &&
      context.sessionKey === current.current.context.sessionKey &&
      context.catalogSnapshotSha256 ===
        current.current.context.catalogSnapshotSha256 &&
      context.catalogSnapshotSha256 !== null &&
      context.isCurrent() &&
      current.current.context.isCurrent() &&
      context.isActive() &&
      current.current.context.isActive()
    );
  }
  function boardCurrent(board: MarketBoardDefinition) {
    return (
      valid() &&
      authorized(context, board) &&
      authorized(current.current.context, board)
    );
  }
  function isSnapshotCurrent() {
    return (
      snapshot !== null &&
      boardCurrent(snapshot.definition) &&
      current.current.state.snapshot === snapshot &&
      marketBoardCohortKey(
        definition(current.current.state.draft),
        context.catalogSnapshotSha256!,
      ) === snapshot.cohortKey
    );
  }
  function endSession() {
    current.current.epoch += 1;
    current.current.controller?.abort();
    current.current.controller = null;
    publish(initial);
    context.onSessionUnavailable();
  }
  function changeDraft(next: MarketBoardDraft) {
    current.current.epoch += 1;
    current.current.controller?.abort();
    current.current.controller = null;
    publish({
      ...current.current.state,
      draft: next,
      busy: false,
      attempted: false,
      error: null,
    });
  }
  const canLoad =
    boardCurrent(draft) &&
    !visible.busy &&
    (draft.kind === "default" || draft.members.length > 0);
  async function perform() {
    if (
      !boardCurrent(draft) ||
      current.current.controller !== null ||
      (draft.kind === "watchlist" && draft.members.length === 0)
    )
      return;
    const now = Date.now();
    if (current.current.budget.nextAllowedAt(now) > now) {
      publish({
        ...current.current.state,
        attempted: true,
        error: "refresh_deferred",
        nextRefreshAt: current.current.budget.nextAllowedAt(now),
      });
      return;
    }
    const complete = context.onActivityStart();
    if (complete === undefined || !boardCurrent(draft)) return;
    const controller = new AbortController();
    current.current.controller = controller;
    const requestCurrent = () =>
      boardCurrent(draft) &&
      !controller.signal.aborted &&
      current.current.controller === controller;
    publish({
      ...current.current.state,
      busy: true,
      attempted: true,
      error: null,
    });
    try {
      const admission = await admitMarketBoard(
        draft,
        context.catalogSnapshotSha256!,
        controller.signal,
      );
      if (!requestCurrent()) return;
      // Admission has no provider IO. Charge only the acquisition that follows,
      // and never refund a started request after failure or cancellation.
      if (
        admission.rows.some(
          (row) => row.identity !== null && row.error === null,
        )
      ) {
        const startedAt = Date.now();
        if (!current.current.budget.start(startedAt)) {
          publish({
            ...current.current.state,
            busy: false,
            error: "refresh_deferred",
            nextRefreshAt: current.current.budget.nextAllowedAt(startedAt),
          });
          return;
        }
        publish({
          ...current.current.state,
          nextRefreshAt: current.current.budget.nextAllowedAt(startedAt),
        });
      }
      const result = await loadMarketBoard(admission, controller.signal);
      if (!requestCurrent()) return;
      if (!complete()) {
        endSession();
        return;
      }
      if (!requestCurrent()) return;
      const usable = hasHistory(result);
      const priorSnapshot = current.current.state.snapshot;
      const accepted =
        !usable &&
        priorSnapshot?.cohortKey === result.cohortKey &&
        hasHistory(priorSnapshot)
          ? priorSnapshot
          : result;
      const selected = current.current.state.selectedListingId;
      publish({
        ...current.current.state,
        snapshot: accepted,
        busy: false,
        error: usable ? null : failedSnapshotCode(result),
        selectedListingId: accepted.rows.some(
          (row) => row.identity?.listingId === selected,
        )
          ? selected
          : (accepted.rows.find((row) => row.identity !== null)?.identity
              ?.listingId ?? null),
      });
    } catch (error) {
      if (!requestCurrent()) return;
      const code =
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable";
      const sessionValid = complete();
      if (!requestCurrent()) return;
      if (code === "session_unavailable" || !sessionValid) endSession();
      else
        publish({
          ...current.current.state,
          snapshot: code === "conflict" ? null : current.current.state.snapshot,
          selectedListingId:
            code === "conflict"
              ? null
              : current.current.state.selectedListingId,
          busy: false,
          error: code,
        });
    } finally {
      if (current.current.controller === controller) {
        current.current.controller = null;
        if (current.current.mounted && current.current.state.busy)
          publish({ ...current.current.state, busy: false });
      }
    }
  }
  useEffect(() => {
    const reactivated = !current.current.mounted;
    current.current.mounted = true;
    if (reactivated) publish({ ...current.current.state, busy: false });
    return () => {
      current.current.mounted = false;
      current.current.epoch += 1;
      current.current.controller?.abort();
      current.current.controller = null;
    };
  }, []);

  return {
    ...visible,
    draft,
    snapshot,
    selectedListingId: snapshot === null ? null : visible.selectedListingId,
    canLoad,
    isSnapshotCurrent,
    onLoad: () => void perform(),
    onModeChange: (mode: MarketBoardDraft["mode"]) => {
      if (!valid() || mode === current.current.state.draft.mode) return;
      changeDraft({ ...current.current.state.draft, mode });
    },
    onToggleWatchlist: (listingId: string, selected: boolean) => {
      if (!valid() || current.current.context.watchlist.status !== "available")
        return;
      const retained = current.current.state.draft.watchlistMembers;
      const member = context.watchlist.members.find(
        (entry) => entry.listingId === listingId,
      );
      if (
        selected &&
        (member === undefined ||
          member.instrumentType !== "common_stock" ||
          !context.isWatchlistCurrent([member]) ||
          !current.current.context.isWatchlistCurrent([member]) ||
          retained.length >= 6 ||
          retained.some((entry) => entry.listingId === listingId))
      )
        return;
      if (!selected && !retained.some((entry) => entry.listingId === listingId))
        return;
      const chosen =
        selected && member !== undefined
          ? [...retained, Object.freeze({ ...member })]
          : retained.filter((entry) => entry.listingId !== listingId);
      const ordered = current.current.context.watchlist.members.flatMap(
        (entry) =>
          chosen.filter(
            (member) =>
              marketBoardIdentityKey(member) === marketBoardIdentityKey(entry),
          ),
      );
      changeDraft({
        ...current.current.state.draft,
        watchlistMembers: Object.freeze(ordered),
      });
    },
    onSelect: (listingId: string) => {
      if (
        !isSnapshotCurrent() ||
        !snapshot?.rows.some((row) => row.identity?.listingId === listingId)
      )
        return false;
      publish({ ...current.current.state, selectedListingId: listingId });
      return true;
    },
  };
}
