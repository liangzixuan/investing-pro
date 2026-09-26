"use client";

import type { PersonalEconomicCalendarDto } from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";
import {
  fetchPersonalEconomicCalendar,
  PersonalWorkspaceApiError,
  type PersonalWorkspaceApiErrorCode,
} from "../../lib/personal-workspace-api";
import type { OwnerSessionActivityStart } from "../research/owner-session-lifecycle";

export interface BeaReleaseAgendaContext {
  readonly active: boolean;
  readonly enabled: boolean;
  readonly sessionKey: number;
  readonly isCurrent: () => boolean;
  readonly isActive: () => boolean;
  readonly onActivityStart: OwnerSessionActivityStart;
  readonly onSessionUnavailable: () => void;
}
interface State {
  readonly agenda: PersonalEconomicCalendarDto | null;
  readonly busy: boolean;
  readonly error: PersonalWorkspaceApiErrorCode | null;
}
const initial: State = { agenda: null, busy: false, error: null };

/** Explicit requests only; the persistent Markets mount retains accepted data on Back. */
export function useBeaReleaseAgenda(context: BeaReleaseAgendaContext) {
  const [state, setState] = useState<State>(initial);
  const contextCurrent = context.isCurrent();
  const current = useRef({
    context,
    contextCurrent,
    state,
    mounted: true,
    epoch: 0,
    controller: null as AbortController | null,
  });
  const prior = current.current.context;
  const changed =
    prior.sessionKey !== context.sessionKey ||
    prior.enabled !== context.enabled;
  const retired = current.current.contextCurrent && !contextCurrent;
  if (changed || retired || prior.active !== context.active) {
    current.current.epoch += 1;
    current.current.controller?.abort();
    current.current.controller = null;
    current.current.state =
      changed || retired ? initial : { ...current.current.state, busy: false };
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
  function valid() {
    return (
      current.current.mounted &&
      epoch === current.current.epoch &&
      context.active &&
      current.current.context.active &&
      context.enabled &&
      current.current.context.enabled &&
      context.sessionKey === current.current.context.sessionKey &&
      context.isCurrent() &&
      current.current.context.isCurrent() &&
      context.isActive() &&
      current.current.context.isActive()
    );
  }
  function endSession() {
    current.current.epoch += 1;
    current.current.controller?.abort();
    current.current.controller = null;
    publish(initial);
    context.onSessionUnavailable();
  }
  async function load() {
    if (!valid() || current.current.controller !== null) return;
    const complete = context.onActivityStart();
    if (complete === undefined || !valid()) return;
    const controller = new AbortController();
    current.current.controller = controller;
    const requestCurrent = () =>
      valid() &&
      !controller.signal.aborted &&
      current.current.controller === controller;
    publish({ ...current.current.state, busy: true, error: null });
    try {
      const agenda = await fetchPersonalEconomicCalendar(controller.signal);
      if (!requestCurrent()) return;
      if (!complete()) {
        endSession();
        return;
      }
      publish({ agenda, busy: false, error: null });
    } catch (error) {
      if (!requestCurrent()) return;
      const code =
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable";
      const sessionValid = complete();
      if (code === "session_unavailable" || !sessionValid) endSession();
      else publish({ ...current.current.state, busy: false, error: code });
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
    agenda: context.enabled && contextCurrent ? visible.agenda : null,
    onLoad: () => void load(),
  };
}
