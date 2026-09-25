"use client";

import { useEffect, useRef, useState } from "react";
import {
  PersonalWorkspaceApiError,
  type PersonalWorkspaceApiErrorCode,
} from "../../lib/personal-workspace-api";
import type { OwnerSessionActivityStart } from "../research/owner-session-lifecycle";
import {
  createMarketBoardRefreshBudget,
  loadMarketBoard,
  type MarketBoardSnapshot,
} from "./market-board-loader";

export interface MarketsSnapshotContext {
  readonly active: boolean;
  readonly enabled: boolean;
  readonly catalogSnapshotSha256: string | null;
  readonly sessionKey: number;
  readonly isCurrent: () => boolean;
  readonly onActivityStart: OwnerSessionActivityStart;
  readonly onSessionUnavailable: () => void;
}
interface State {
  readonly snapshot: MarketBoardSnapshot | null;
  readonly selectedListingId: string | null;
  readonly busy: boolean;
  readonly attempted: boolean;
  readonly error: PersonalWorkspaceApiErrorCode | "refresh_deferred" | null;
  readonly nextRefreshAt: number | null;
}
const initial: State = {
  snapshot: null,
  selectedListingId: null,
  busy: false,
  attempted: false,
  error: null,
  nextRefreshAt: null,
};

/** Mounted by the common workspace shell, so route changes preserve its snapshot. */
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
  if (changed || retired || prior.active !== context.active) {
    current.current.epoch += 1;
    current.current.controller?.abort();
    current.current.controller = null;
    current.current.state = changed
      ? initial
      : retired
        ? {
            ...initial,
            attempted: current.current.state.attempted,
            nextRefreshAt: current.current.state.nextRefreshAt,
          }
        : { ...current.current.state, busy: false };
    setState(current.current.state);
  } else current.current.state = state;
  current.current.context = context;
  current.current.contextCurrent = contextCurrent;
  const epoch = current.current.epoch;
  const visible = current.current.state;

  function publish(next: State) {
    current.current.state = next;
    setState(next);
  }
  function valid(expectedEpoch = epoch) {
    return (
      current.current.mounted &&
      expectedEpoch === current.current.epoch &&
      context.active &&
      current.current.context.active &&
      context.enabled &&
      current.current.context.enabled &&
      context.sessionKey === current.current.context.sessionKey &&
      context.catalogSnapshotSha256 ===
        current.current.context.catalogSnapshotSha256 &&
      context.catalogSnapshotSha256 !== null &&
      context.isCurrent() &&
      current.current.context.isCurrent()
    );
  }
  async function perform(expectedEpoch = epoch) {
    if (!valid(expectedEpoch) || current.current.controller !== null) return;
    const complete = context.onActivityStart();
    if (complete === undefined || !valid(expectedEpoch)) return;
    const now = Date.now();
    if (!current.current.budget.start(now)) {
      publish({
        ...current.current.state,
        attempted: true,
        error: "refresh_deferred",
        nextRefreshAt: current.current.budget.nextAllowedAt(now),
      });
      return;
    }
    const controller = new AbortController();
    current.current.controller = controller;
    const requestCurrent = () =>
      valid(expectedEpoch) &&
      !controller.signal.aborted &&
      current.current.controller === controller;
    publish({
      ...current.current.state,
      busy: true,
      attempted: true,
      error: null,
      nextRefreshAt: current.current.budget.nextAllowedAt(now),
    });
    try {
      const snapshot = await loadMarketBoard(
        context.catalogSnapshotSha256!,
        controller.signal,
      );
      if (!requestCurrent()) return;
      if (!complete()) {
        publish(initial);
        context.onSessionUnavailable();
        return;
      }
      const selected = current.current.state.selectedListingId;
      publish({
        ...current.current.state,
        snapshot,
        busy: false,
        error: null,
        selectedListingId: snapshot.rows.some(
          (row) => row.identity?.listingId === selected,
        )
          ? selected
          : (snapshot.rows.find((row) => row.identity !== null)?.identity
              ?.listingId ?? null),
      });
    } catch (error) {
      if (!requestCurrent()) return;
      const code =
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable";
      const sessionValid = complete();
      if (code === "session_unavailable" || !sessionValid) {
        publish(initial);
        context.onSessionUnavailable();
      } else
        publish({
          ...current.current.state,
          snapshot: code === "conflict" ? null : current.current.state.snapshot,
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
  useEffect(() => {
    let cancelled = false;
    // Effect replay or a route change can cancel entry before it starts any IO.
    void Promise.resolve().then(() => {
      if (!cancelled && !current.current.state.attempted)
        return perform(current.current.epoch);
    });
    return () => {
      cancelled = true;
    };
  }, [
    context.active,
    context.enabled,
    context.catalogSnapshotSha256,
    context.sessionKey,
  ]);

  return {
    ...visible,
    snapshot: context.enabled && contextCurrent ? visible.snapshot : null,
    onRefresh: () => void perform(),
    onSelect: (listingId: string) => {
      if (
        !valid() ||
        !current.current.state.snapshot?.rows.some(
          (row) => row.identity?.listingId === listingId,
        )
      )
        return false;
      publish({ ...current.current.state, selectedListingId: listingId });
      return true;
    },
  };
}
