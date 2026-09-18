"use client";

import type {
  PersonalFinancialComparisonSelectionBindingDto,
  PersonalFinancialComparisonSelectionPayloadDto,
  PersonalFinancialComparisonSelectionResolvedDto,
  PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";

import {
  fetchPersonalFinancialComparisonSelection,
  isPersonalFinancialComparisonSelectionPayload,
  resolvePersonalFinancialComparisonSelection,
  samePersonalFinancialComparisonMembers,
  savePersonalFinancialComparisonSelection,
  type PersonalFinancialComparisonSelection,
} from "@/lib/personal-financial-comparison-selection-api";
import { PersonalWorkspaceApiError } from "@/lib/personal-workspace-api";

interface Props {
  readonly enabled: boolean;
  readonly workspaceKey: string;
  readonly contextKey: string;
  readonly watchlistBinding: PersonalFinancialComparisonSelectionBindingDto | null;
  readonly saveMembers: readonly PersonalSecurityMasterScreenRowDto[] | null;
  readonly isCurrent: () => boolean;
  readonly onRestore: (
    resolved: PersonalFinancialComparisonSelectionResolvedDto,
  ) => boolean;
  readonly onDefinitionChange: () => void;
  readonly onSessionUnavailable: () => void;
}
interface State {
  readonly record: PersonalFinancialComparisonSelection | null;
  readonly available: boolean;
  readonly busy: boolean;
  readonly message: string;
}
const initial: State = {
  record: null,
  available: false,
  busy: false,
  message: "Loading saved comparison companies…",
};

/** Only this identity definition is saved. Results and provider values never enter it. */
export function usePersonalFinancialComparisonSelection(props: Props) {
  const [state, setState] = useState<State>(initial);
  const current = useRef({
    state,
    props,
    epoch: 0,
    mounted: true,
    controller: null as AbortController | null,
  });
  const prior = current.current.props;
  if (
    prior.workspaceKey !== props.workspaceKey ||
    prior.contextKey !== props.contextKey
  ) {
    current.current.epoch += 1;
    current.current.controller?.abort();
    current.current.controller = null;
    if (prior.workspaceKey !== props.workspaceKey || state.busy) {
      const next =
        prior.workspaceKey !== props.workspaceKey
          ? initial
          : {
              ...state,
              available: false,
              busy: false,
              message:
                "The comparison context changed. Reload saved companies before continuing.",
            };
      current.current.state = next;
      setState(next);
    }
  } else current.current.state = state;
  current.current.props = props;
  const visible = current.current.state;
  const renderEpoch = current.current.epoch;

  function publish(next: State) {
    current.current.state = next;
    setState(next);
  }
  function reset() {
    current.current.epoch += 1;
    current.current.controller?.abort();
    current.current.controller = null;
    publish({
      ...initial,
      message: "Saved comparison companies were cleared from this session.",
    });
  }
  function isCurrent() {
    return (
      current.current.mounted &&
      props.enabled &&
      current.current.props.enabled &&
      renderEpoch === current.current.epoch &&
      visible === current.current.state &&
      props.workspaceKey === current.current.props.workspaceKey &&
      props.contextKey === current.current.props.contextKey &&
      props.isCurrent()
    );
  }
  const selection = visible.record?.payload.selection ?? null;
  const payload: PersonalFinancialComparisonSelectionPayloadDto = {
    schemaVersion: 1,
    selection:
      props.watchlistBinding !== null && props.saveMembers !== null
        ? {
            createdAgainstCatalogSnapshotSha256:
              props.watchlistBinding.catalogSnapshotSha256,
            members: props.saveMembers.map(copyIdentity),
          }
        : null,
  };
  const canSave =
    visible.available &&
    !visible.busy &&
    payload.selection !== null &&
    isPersonalFinancialComparisonSelectionPayload(payload);
  const canRestore =
    visible.available &&
    !visible.busy &&
    selection !== null &&
    props.watchlistBinding !== null;
  const canClear = visible.available && !visible.busy && selection !== null;

  async function perform(
    action: "reload" | "save" | "clear" | "restore",
    boundary = false,
  ) {
    if (
      !props.enabled ||
      !current.current.mounted ||
      (!boundary && !isCurrent()) ||
      current.current.controller !== null ||
      (action === "save" && !canSave) ||
      (action === "restore" && !canRestore) ||
      (action === "clear" && !canClear)
    )
      return;
    const controller = new AbortController();
    current.current.controller = controller;
    const operation = ++current.current.epoch;
    const version = visible.record?.version ?? 0;
    const binding = props.watchlistBinding;
    props.onDefinitionChange();
    publish({
      ...visible,
      busy: true,
      message:
        action === "restore"
          ? "Checking every saved company against My Watchlist…"
          : "Updating saved comparison companies…",
    });
    const valid = () =>
      !controller.signal.aborted &&
      current.current.mounted &&
      current.current.controller === controller &&
      operation === current.current.epoch &&
      props.workspaceKey === current.current.props.workspaceKey &&
      props.contextKey === current.current.props.contextKey &&
      current.current.props.enabled &&
      (action === "reload" || props.isCurrent());
    try {
      if (action === "restore") {
        if (selection === null || binding === null) return;
        const resolved = await resolvePersonalFinancialComparisonSelection(
          version,
          binding,
          controller.signal,
        );
        if (!valid()) return;
        if (
          resolved.savedSelectionVersion !== version ||
          resolved.catalogSnapshotSha256 !== binding.catalogSnapshotSha256 ||
          resolved.watchlistVersion !== binding.watchlistVersion ||
          !samePersonalFinancialComparisonMembers(
            resolved.members,
            selection.members,
          )
        )
          throw new PersonalWorkspaceApiError("invalid_response");
        if (!props.onRestore(resolved)) return;
        publish({
          ...visible,
          busy: false,
          message:
            "Saved companies restored. Run financial screen, then Compare saved companies. Prices still require Load prices.",
        });
      } else {
        const submitted =
          action === "clear"
            ? { schemaVersion: 1 as const, selection: null }
            : payload;
        const record =
          action === "reload"
            ? await fetchPersonalFinancialComparisonSelection(controller.signal)
            : await savePersonalFinancialComparisonSelection(
                version,
                submitted,
                action === "clear" ? null : binding,
                controller.signal,
              );
        if (!valid()) return;
        publish({
          record,
          available: true,
          busy: false,
          message:
            action === "save"
              ? "Comparison companies saved in order. Only their identities are stored."
              : action === "clear"
                ? "Saved companies cleared. My Watchlist and financial views are unchanged."
                : record?.payload.selection
                  ? "Saved comparison companies loaded. Restore them to choose this group."
                  : "No comparison companies saved. Open a My Watchlist comparison, then Save these companies.",
        });
      }
    } catch (error) {
      if (!valid()) return;
      if (
        error instanceof PersonalWorkspaceApiError &&
        error.code === "session_unavailable"
      ) {
        reset();
        props.onSessionUnavailable();
        return;
      }
      const conflict =
        error instanceof PersonalWorkspaceApiError && error.code === "conflict";
      publish({
        ...visible,
        busy: false,
        available: action === "restore" && !conflict,
        message: conflict
          ? "Saved companies, My Watchlist or the catalog changed. Reload saved companies and try again."
          : action === "restore"
            ? "Every saved company must still match My Watchlist and the current catalog. No companies were restored. You can replace or clear this selection."
            : "Saved companies could not be updated. Reload saved companies before retrying.",
      });
    } finally {
      if (current.current.controller === controller) {
        current.current.controller = null;
        if (current.current.state.busy)
          publish({
            ...current.current.state,
            busy: false,
            available: false,
            message:
              "The comparison context changed. Reload saved companies before continuing.",
          });
      }
    }
  }

  useEffect(() => {
    current.current.mounted = true;
    reset();
    if (props.enabled) void perform("reload", true);
    return () => {
      current.current.mounted = false;
      current.current.epoch += 1;
      current.current.controller?.abort();
      current.current.controller = null;
    };
  }, [props.workspaceKey, props.enabled]);

  return {
    ...visible,
    selection,
    canSave,
    canRestore,
    canClear,
    save: () => perform("save"),
    restore: () => perform("restore"),
    clear: () => perform("clear"),
    reload: () => perform("reload"),
    clearSession: reset,
  };
}

function copyIdentity(
  member: PersonalSecurityMasterScreenRowDto,
): PersonalSecurityMasterScreenRowDto {
  const {
    cik,
    country,
    exchangeMic,
    instrumentType,
    issuerId,
    issuerName,
    listingId,
    securityId,
    securityName,
    shareClassId,
    shareClassName,
    symbol,
  } = member;
  return {
    cik,
    country,
    exchangeMic,
    instrumentType,
    issuerId,
    issuerName,
    listingId,
    securityId,
    securityName,
    shareClassId,
    shareClassName,
    symbol,
  };
}
