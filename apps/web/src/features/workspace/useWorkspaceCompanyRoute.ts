"use client";

import { useEffect, useRef, useState } from "react";
import type { PersonalSecurityMasterScreenRowDto } from "@research-cockpit/contracts";
import {
  fetchPersonalSecurityMasterListing,
  PersonalWorkspaceApiError,
} from "@/lib/personal-workspace-api";
import type { OwnerSessionActivityStart } from "../research/owner-session-lifecycle";
import { workspaceRouteKey, type WorkspaceRoute } from "./workspace-route";

export interface WorkspaceCompanyRouteInput {
  readonly route: WorkspaceRoute | undefined;
  readonly enabled: boolean;
  readonly catalogSnapshotSha256: string | null;
  readonly sessionKey: number;
  readonly selectedListingId: string | null;
  readonly isCurrent: () => boolean;
  readonly onActivityStart: OwnerSessionActivityStart;
  readonly onSessionUnavailable: () => void;
  readonly onView: (route: WorkspaceRoute) => void;
  readonly onResolved: (
    row: PersonalSecurityMasterScreenRowDto,
    isCurrent: () => boolean,
  ) => void;
}
type Status = "idle" | "loading" | "ready" | "missing" | "unavailable";
export function useWorkspaceCompanyRoute(
  input: WorkspaceCompanyRouteInput,
): Status {
  const routeKey =
    input.route === undefined ? "none" : workspaceRouteKey(input.route);
  const key = JSON.stringify([
    routeKey,
    input.enabled,
    input.catalogSnapshotSha256,
    input.sessionKey,
  ]);
  const latest = useRef(input);
  latest.current = input;
  const currentKey = useRef(key);
  currentKey.current = key;
  const lifetime = useRef<object | null>(null);
  const [state, setState] = useState<{ key: string; status: Status }>({
    key,
    status: "idle",
  });
  useEffect(() => {
    const incarnation = {};
    lifetime.current = incarnation;
    const abort = new AbortController();
    const captured = latest.current;
    const current = () =>
      lifetime.current === incarnation &&
      currentKey.current === key &&
      !abort.signal.aborted &&
      latest.current.isCurrent();
    const retire = () => {
      if (lifetime.current === incarnation) lifetime.current = null;
      abort.abort();
    };
    if (captured.route === undefined) return retire;
    captured.onView(captured.route);
    if (
      captured.route.kind !== "company" ||
      !captured.enabled ||
      captured.catalogSnapshotSha256 === null
    )
      return retire;
    const listingId = captured.route.listingId;
    if (captured.selectedListingId === listingId) {
      setState({ key, status: "ready" });
      return retire;
    }
    setState({ key, status: "loading" });
    const complete = captured.onActivityStart();
    if (complete === undefined) {
      if (current()) captured.onSessionUnavailable();
      return retire;
    }
    let completed = false;
    const finish = () => {
      completed = true;
      return complete();
    };
    void fetchPersonalSecurityMasterListing(listingId, abort.signal)
      .then((result) => {
        if (!current()) return;
        if (!finish()) {
          captured.onSessionUnavailable();
          return;
        }
        if (
          result.snapshot.snapshotSha256 !== captured.catalogSnapshotSha256 ||
          (result.listing !== null && result.listing.listingId !== listingId)
        ) {
          setState({ key, status: "unavailable" });
          return;
        }
        if (result.listing === null) {
          setState({ key, status: "missing" });
          return;
        }
        latest.current.onResolved(result.listing, current);
        if (current()) setState({ key, status: "ready" });
      })
      .catch((error: unknown) => {
        if (!current()) return;
        if (
          error instanceof PersonalWorkspaceApiError &&
          error.code === "session_unavailable"
        )
          captured.onSessionUnavailable();
        else if (!completed && !finish()) captured.onSessionUnavailable();
        else setState({ key, status: "unavailable" });
      });
    return retire;
  }, [key]);
  return state.key === key ? state.status : "idle";
}
