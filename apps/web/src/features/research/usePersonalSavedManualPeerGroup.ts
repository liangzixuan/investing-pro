"use client";

import {
  isPersonalSavedManualPeerGroup,
  type PersonalSavedManualPeerBindingDto,
  type PersonalSavedManualPeerGroupDto,
  type PersonalSavedManualPeerIdentityDto,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";

import {
  fetchPersonalSavedManualPeerGroup,
  putPersonalSavedManualPeerGroup,
  resolvePersonalSavedManualPeerGroup,
  samePersonalSavedManualPeerGroup,
  samePersonalSavedManualPeerIdentity,
  type PersonalSavedManualPeerGroup,
} from "@/lib/personal-saved-manual-peer-group-api";
import { PersonalWorkspaceApiError } from "@/lib/personal-workspace-api";

export interface PersonalSavedManualPeerContext {
  readonly workspaceKey: string;
  readonly contextKey: string;
  readonly enabled: boolean;
  readonly identity: PersonalSavedManualPeerIdentityDto | null;
  readonly watchlistBinding: PersonalSavedManualPeerBindingDto | null;
  readonly isCurrent: () => boolean;
  readonly onSessionUnavailable: () => void;
  readonly getSaveGroup: () => PersonalSavedManualPeerGroupDto | null;
  readonly getEditGeneration: () => number;
  readonly onRestore: (
    group: PersonalSavedManualPeerGroupDto,
    generation: number,
  ) => boolean;
}

interface State {
  readonly record: PersonalSavedManualPeerGroup | null;
  readonly loaded: boolean;
  readonly busy: boolean;
  readonly message: string;
}
const initial: State = {
  record: null,
  loaded: false,
  busy: false,
  message: "Load saved peer group to see the group stored on this machine.",
};
const contextChanged =
  "The company or watchlist context changed. Reload saved peer group before continuing.";

/** Explicit settings operations; roster/source changes belong to the guarded root. */
export function usePersonalSavedManualPeerGroup(
  context: PersonalSavedManualPeerContext,
) {
  const [state, setState] = useState<State>(initial);
  const current = useRef({
    context,
    state,
    epoch: 0,
    mounted: true,
    controller: null as AbortController | null,
  });
  if (!sameContext(current.current.context, context)) {
    current.current.epoch += 1;
    current.current.controller?.abort();
    current.current.controller = null;
    current.current.state = { ...initial, message: contextChanged };
    setState(current.current.state);
  } else current.current.state = state;
  current.current.context = context;
  const visible = current.current.state;
  const renderEpoch = current.current.epoch;

  function publish(next: State) {
    current.current.state = next;
    setState(next);
  }
  function currentContext() {
    return (
      current.current.mounted &&
      context.enabled &&
      current.current.context.enabled &&
      sameContext(context, current.current.context) &&
      context.isCurrent()
    );
  }
  const enabled = currentContext();
  const loaded = enabled && visible.loaded;
  const group = loaded ? (visible.record?.payload.group ?? null) : null;
  const identity = context.identity;
  const binding = context.watchlistBinding;
  const saveGroup = enabled ? context.getSaveGroup() : null;
  const restoreEligible =
    group !== null &&
    identity !== null &&
    binding !== null &&
    samePersonalSavedManualPeerIdentity(group.primary, identity);
  const canSave = loaded && !visible.busy && saveGroup !== null;
  const canRestore = loaded && !visible.busy && restoreEligible;
  const canClear = loaded && !visible.busy && group !== null;

  async function perform(action: "load" | "save" | "restore" | "clear") {
    if (
      !currentContext() ||
      renderEpoch !== current.current.epoch ||
      visible !== current.current.state ||
      current.current.controller !== null ||
      (action !== "load" && !visible.loaded)
    )
      return;
    // Read the synchronous roster at the action boundary, including edits before render.
    const latest = action === "save" ? context.getSaveGroup() : null;
    if (
      action === "save" &&
      (latest === null ||
        !isPersonalSavedManualPeerGroup(latest) ||
        identity === null ||
        binding === null ||
        !samePersonalSavedManualPeerIdentity(latest.primary, identity) ||
        latest.createdAgainstCatalogSnapshotSha256 !==
          binding.catalogSnapshotSha256)
    )
      return;
    if (action === "restore" && !restoreEligible) return;
    if (action === "clear" && group === null) return;
    const captured = latest === null ? null : structuredClone(latest);
    const version = visible.record?.version ?? 0;
    const generation = context.getEditGeneration();
    const controller = new AbortController();
    current.current.controller = controller;
    const operation = ++current.current.epoch;
    const valid = () =>
      !controller.signal.aborted &&
      currentContext() &&
      current.current.controller === controller &&
      operation === current.current.epoch;
    publish({
      ...visible,
      busy: true,
      message:
        action === "restore"
          ? "Checking the saved primary and every peer…"
          : "Updating saved peer group…",
    });
    try {
      if (action === "restore") {
        if (identity === null || binding === null || group === null) return;
        const resolved = await resolvePersonalSavedManualPeerGroup(
          version,
          identity,
          binding,
          controller.signal,
        );
        if (!valid()) return;
        if (
          resolved.savedPeerGroupVersion !== version ||
          resolved.watchlistVersion !== binding.watchlistVersion ||
          resolved.catalogSnapshotSha256 !== binding.catalogSnapshotSha256 ||
          !samePersonalSavedManualPeerGroup(resolved.group, group)
        )
          throw new PersonalWorkspaceApiError("invalid_response");
        if (
          generation !== context.getEditGeneration() ||
          !context.onRestore(resolved.group, generation)
        ) {
          publish({
            ...visible,
            busy: false,
            message:
              "Your peers changed while Restore was checking. The current group was kept; choose Restore again to replace it.",
          });
          return;
        }
        publish({
          ...visible,
          busy: false,
          message:
            "Saved peer group restored. Peer sources are unloaded; choose Load for each peer when ready.",
        });
      } else {
        let record: PersonalSavedManualPeerGroup | null;
        if (action === "load")
          record = await fetchPersonalSavedManualPeerGroup(controller.signal);
        else
          record = await putPersonalSavedManualPeerGroup(
            version,
            action === "clear"
              ? {
                  operation: "clear",
                  payload: { schemaVersion: 1, group: null },
                  context: null,
                }
              : {
                  operation: "save",
                  payload: { schemaVersion: 1, group: captured! },
                  context: binding!,
                },
            controller.signal,
          );
        if (!valid()) return;
        publish({
          record,
          loaded: true,
          busy: false,
          message:
            action === "save"
              ? "Peer group saved. Any newer peer edits remain in the current group."
              : action === "clear"
                ? "Saved peer group cleared. Current peers and their loaded sources are unchanged."
                : "Saved peer group loaded. Choose Restore to replace the current peers.",
        });
      }
    } catch (error) {
      if (!valid()) return;
      if (
        error instanceof PersonalWorkspaceApiError &&
        error.code === "session_unavailable"
      ) {
        publish(initial);
        context.onSessionUnavailable();
        return;
      }
      publish({
        ...visible,
        loaded: false,
        busy: false,
        message:
          error instanceof PersonalWorkspaceApiError &&
          error.code === "conflict"
            ? "Saved peer group, My Watchlist or the catalog changed. Reload saved peer group before continuing. Current peers were kept."
            : "Saved peer group could not be verified. Reload before retrying. Current peers were kept.",
      });
    } finally {
      if (current.current.controller === controller) {
        current.current.controller = null;
        if (current.current.mounted && current.current.state.busy)
          publish({
            ...current.current.state,
            busy: false,
            loaded: false,
            message: contextChanged,
          });
      }
    }
  }

  useEffect(() => {
    const reactivated = !current.current.mounted;
    current.current.mounted = true;
    if (reactivated) {
      const retained = current.current.state;
      publish({
        ...retained,
        busy: false,
        loaded: retained.busy ? false : retained.loaded,
        message: retained.busy
          ? "The saved-peer request was interrupted. Reload saved peer group before continuing."
          : retained.message,
      });
    }
    return () => {
      current.current.mounted = false;
      current.current.epoch += 1;
      current.current.controller?.abort();
      current.current.controller = null;
    };
  }, []);

  return {
    enabled,
    loaded,
    busy: visible.busy,
    message: visible.message,
    savedGroup: group,
    canSave,
    canRestore,
    canClear,
    saveUnavailableReason: !enabled
      ? "The local workspace and a researched company must be active."
      : !loaded
        ? "Load saved peer group first."
        : saveGroup === null
          ? "Save requires the exact primary and one to three distinct peers in the current, reconciled My Watchlist."
          : null,
    restoreUnavailableReason: !loaded
      ? "Load saved peer group first."
      : group === null
        ? "No peer group is saved."
        : !restoreEligible
          ? "Restore requires the same exact primary in the current, reconciled My Watchlist. Every saved peer will also be checked."
          : null,
    onLoad: () => void perform("load"),
    onSave: () => void perform("save"),
    onRestore: () => void perform("restore"),
    onClear: () => void perform("clear"),
  };
}

function sameContext(
  left: PersonalSavedManualPeerContext,
  right: PersonalSavedManualPeerContext,
) {
  return (
    left.workspaceKey === right.workspaceKey &&
    left.contextKey === right.contextKey &&
    left.enabled === right.enabled &&
    (left.identity === null || right.identity === null
      ? left.identity === right.identity
      : samePersonalSavedManualPeerIdentity(left.identity, right.identity)) &&
    left.watchlistBinding?.catalogSnapshotSha256 ===
      right.watchlistBinding?.catalogSnapshotSha256 &&
    left.watchlistBinding?.watchlistVersion ===
      right.watchlistBinding?.watchlistVersion
  );
}
