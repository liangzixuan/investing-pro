"use client";

import {
  PERSONAL_SAVED_DCF_MAXIMUM_ENTRIES,
  PERSONAL_SAVED_DCF_MODEL_VERSION,
  isPersonalSavedDcfPayload,
  isPersonalSavedDcfSupportedEntry,
  normalizePersonalSavedDcfAssumptions,
  type PersonalSavedDcfBindingDto,
  type PersonalSavedDcfIdentityDto,
  type PersonalSavedDcfPayloadDto,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";

import {
  fetchPersonalSavedDcfAssumptions,
  putPersonalSavedDcfAssumptions,
  resolvePersonalSavedDcfAssumptions,
  samePersonalSavedDcfAssumptions,
  samePersonalSavedDcfEntry,
  samePersonalSavedDcfIdentity,
  type PersonalSavedDcfAssumptions,
} from "@/lib/personal-saved-dcf-assumptions-api";
import { PersonalWorkspaceApiError } from "@/lib/personal-workspace-api";

import {
  PersonalFcffDcfValuation,
  createPersonalFcffDcfAssumptionDraft,
  type PersonalFcffDcfAssumptionDraft,
  type PersonalFcffDcfValuationProps,
} from "./PersonalFcffDcfValuation";
import { PersonalSavedDcfAssumptionsControls } from "./PersonalSavedDcfAssumptionsControls";

export interface PersonalSavedDcfContext {
  readonly workspaceKey: string;
  readonly contextKey: string;
  readonly enabled: boolean;
  readonly identity: PersonalSavedDcfIdentityDto | null;
  readonly watchlistBinding: PersonalSavedDcfBindingDto | null;
  readonly isCurrent: () => boolean;
  readonly onSessionUnavailable: () => void;
}
export interface PersonalSavedFcffDcfValuationProps extends Omit<
  PersonalFcffDcfValuationProps,
  "assumptionControl" | "savedAssumptionsControls"
> {
  readonly savedContext: PersonalSavedDcfContext;
}
interface State {
  readonly record: PersonalSavedDcfAssumptions | null;
  readonly loaded: boolean;
  readonly busy: boolean;
  readonly message: string;
}
const initial: State = {
  record: null,
  loaded: false,
  busy: false,
  message: "Load saved assumptions to see sets stored on this machine.",
};

/** Explicit settings requests never load providers or overwrite newer editor input. */
export function PersonalSavedFcffDcfValuation({
  savedContext: context,
  ...sources
}: PersonalSavedFcffDcfValuationProps) {
  const [draft, setDraft] = useState<PersonalFcffDcfAssumptionDraft>(() =>
    createPersonalFcffDcfAssumptionDraft(),
  );
  const [state, setState] = useState<State>(initial);
  const current = useRef({
    context,
    state,
    draft,
    draftEpoch: 0,
    epoch: 0,
    mounted: true,
    controller: null as AbortController | null,
  });
  const prior = current.current.context;
  if (
    prior.workspaceKey !== context.workspaceKey ||
    prior.contextKey !== context.contextKey ||
    prior.enabled !== context.enabled
  ) {
    current.current.epoch += 1;
    current.current.controller?.abort();
    current.current.controller = null;
    const next = {
      ...initial,
      message:
        "The company or watchlist context changed. Reload saved assumptions before continuing.",
    };
    current.current.state = next;
    setState(next);
    // The parent disposes the editor on an actual company/session transition.
    // A changed watchlist binding only invalidates saved metadata, never this draft.
  } else current.current.state = state;
  current.current.context = context;
  current.current.draft = draft;
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
      context.workspaceKey === current.current.context.workspaceKey &&
      context.contextKey === current.current.context.contextKey &&
      context.isCurrent()
    );
  }
  function changeDraft(
    update: (
      value: PersonalFcffDcfAssumptionDraft,
    ) => PersonalFcffDcfAssumptionDraft,
  ) {
    if (!currentContext()) return;
    const next = update(current.current.draft);
    current.current.draftEpoch += 1;
    current.current.draft = next;
    setDraft(next);
  }
  const entries = visible.record?.payload.entries ?? [];
  const identity = context.identity;
  const selected =
    identity === null
      ? undefined
      : entries.find(
          (entry) => entry.identity.listingId === identity.listingId,
        );
  const exactSelected =
    selected !== undefined &&
    identity !== null &&
    samePersonalSavedDcfIdentity(selected.identity, identity);
  const assumptions = normalizeDraft(draft);
  const eligible = identity !== null && context.watchlistBinding !== null;
  const hasCapacity =
    selected !== undefined ||
    entries.length < PERSONAL_SAVED_DCF_MAXIMUM_ENTRIES;
  const canSave =
    context.enabled &&
    visible.loaded &&
    !visible.busy &&
    eligible &&
    hasCapacity &&
    (selected === undefined ||
      (exactSelected && isPersonalSavedDcfSupportedEntry(selected))) &&
    assumptions !== null;
  const canRestore =
    context.enabled &&
    visible.loaded &&
    !visible.busy &&
    eligible &&
    exactSelected &&
    isPersonalSavedDcfSupportedEntry(selected);
  const draftIsSaved =
    visible.loaded &&
    exactSelected &&
    isPersonalSavedDcfSupportedEntry(selected) &&
    assumptions !== null &&
    samePersonalSavedDcfAssumptions(assumptions, selected.assumptions);
  const saveUnavailableReason = !context.enabled
    ? "The local workspace must be active."
    : !visible.loaded
      ? "Load saved assumptions first."
      : !eligible
        ? "Save requires this exact company in the current, reconciled My Watchlist."
        : selected !== undefined && !exactSelected
          ? "A different company identity is saved under this listing. Clear that entry before saving."
          : selected !== undefined &&
              !isPersonalSavedDcfSupportedEntry(selected)
            ? "This saved set uses an unsupported model version. Clear it before saving a new set."
            : !hasCapacity
              ? "Twenty companies are already saved. Clear one before adding another."
              : assumptions === null
                ? "Use valid DCF assumptions: 5–10 whole years, rates within the displayed bounds, ordered scenarios and WACC above terminal growth."
                : null;

  async function perform(
    action: "load" | "save" | "restore" | "clear",
    listingId?: string,
  ) {
    if (
      !currentContext() ||
      renderEpoch !== current.current.epoch ||
      visible !== current.current.state ||
      current.current.controller !== null ||
      (action !== "load" && !visible.loaded)
    )
      return;
    const latestAssumptions = normalizeDraft(current.current.draft);
    if (
      action === "save" &&
      (!eligible ||
        !hasCapacity ||
        latestAssumptions === null ||
        (selected !== undefined &&
          (!exactSelected || !isPersonalSavedDcfSupportedEntry(selected))))
    )
      return;
    if (action === "restore" && !canRestore) return;
    if (
      action === "clear" &&
      (listingId === undefined ||
        !entries.some((entry) => entry.identity.listingId === listingId))
    )
      return;
    const version = visible.record?.version ?? 0;
    const binding = context.watchlistBinding;
    const editEpoch = current.current.draftEpoch;
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
          ? "Checking the saved company and assumptions…"
          : "Updating saved assumptions…",
    });
    try {
      if (action === "restore") {
        if (selected === undefined || identity === null || binding === null)
          return;
        const resolved = await resolvePersonalSavedDcfAssumptions(
          version,
          identity,
          binding,
          controller.signal,
        );
        if (!valid()) return;
        if (
          resolved.savedAssumptionsVersion !== version ||
          resolved.watchlistVersion !== binding.watchlistVersion ||
          resolved.catalogSnapshotSha256 !== binding.catalogSnapshotSha256 ||
          !samePersonalSavedDcfEntry(resolved.entry, selected)
        )
          throw new PersonalWorkspaceApiError("invalid_response");
        if (editEpoch !== current.current.draftEpoch) {
          publish({
            ...visible,
            busy: false,
            message:
              "Your assumptions changed while Restore was checking. The current draft was kept; choose Restore again to replace it.",
          });
          return;
        }
        const restored = createPersonalFcffDcfAssumptionDraft(
          resolved.entry.assumptions,
        );
        current.current.draftEpoch += 1;
        current.current.draft = restored;
        setDraft(restored);
        publish({
          ...visible,
          busy: false,
          message:
            "Saved assumptions restored. Calculations use only the financial and price inputs already loaded.",
        });
      } else {
        let record: PersonalSavedDcfAssumptions | null;
        if (action === "load")
          record = await fetchPersonalSavedDcfAssumptions(controller.signal);
        else {
          let payload: PersonalSavedDcfPayloadDto;
          if (action === "clear")
            payload = {
              schemaVersion: 1,
              entries: entries.filter(
                (entry) => entry.identity.listingId !== listingId,
              ),
            };
          else {
            if (
              identity === null ||
              binding === null ||
              latestAssumptions === null
            )
              return;
            const entry = {
              identity,
              createdAgainstCatalogSnapshotSha256:
                binding.catalogSnapshotSha256,
              modelVersion: PERSONAL_SAVED_DCF_MODEL_VERSION,
              assumptions: latestAssumptions,
            };
            payload = {
              schemaVersion: 1,
              entries:
                selected === undefined
                  ? [...entries, entry]
                  : entries.map((old) => (old === selected ? entry : old)),
            };
          }
          if (!isPersonalSavedDcfPayload(payload))
            throw new PersonalWorkspaceApiError("invalid_request");
          record = await putPersonalSavedDcfAssumptions(
            version,
            action === "clear"
              ? {
                  operation: "clear",
                  listingId: listingId!,
                  payload,
                  context: null,
                }
              : {
                  operation: "save",
                  listingId: identity!.listingId,
                  payload,
                  context: binding!,
                },
            controller.signal,
          );
        }
        if (!valid()) return;
        publish({
          record,
          loaded: true,
          busy: false,
          message:
            action === "save"
              ? "Assumptions saved. Any newer edits remain in the current draft."
              : action === "clear"
                ? "Saved set cleared. The current assumption draft is unchanged."
                : "Saved assumptions loaded. Choose Restore to replace the current draft.",
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
            ? "Saved assumptions, My Watchlist or the catalog changed. Reload saved assumptions before continuing. Your draft was kept."
            : "Saved assumptions could not be verified. Reload before retrying. Your current draft was kept.",
      });
    } finally {
      if (current.current.controller === controller) {
        current.current.controller = null;
        if (current.current.mounted && current.current.state.busy)
          publish({
            ...current.current.state,
            busy: false,
            loaded: false,
            message:
              "The company or watchlist context changed. Reload saved assumptions before continuing.",
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
          ? "The saved-assumptions request was interrupted. Reload saved assumptions before continuing."
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

  return (
    <PersonalFcffDcfValuation
      {...sources}
      assumptionControl={{ value: draft, onChange: changeDraft }}
      savedAssumptionsControls={
        sources.selection === null ? undefined : (
          <PersonalSavedDcfAssumptionsControls
            symbol={sources.selection.symbol}
            busy={visible.busy}
            loaded={visible.loaded}
            count={entries.length}
            canSave={canSave}
            canRestore={canRestore}
            saveUnavailableReason={saveUnavailableReason}
            message={visible.message}
            draftIsSaved={draftIsSaved}
            entries={entries.map((entry) => ({
              listingId: entry.identity.listingId,
              symbol: entry.identity.symbol,
              issuerName: entry.identity.issuerName,
              modelSupported: isPersonalSavedDcfSupportedEntry(entry),
              isCurrentCompany:
                identity !== null &&
                samePersonalSavedDcfIdentity(entry.identity, identity),
            }))}
            onLoad={() => void perform("load")}
            onSave={() => void perform("save")}
            onRestore={() => void perform("restore")}
            onClear={(listingId) => void perform("clear", listingId)}
          />
        )
      }
    />
  );
}

function normalizeDraft(draft: PersonalFcffDcfAssumptionDraft) {
  if (!/^(?:[5-9]|10)$/u.test(draft.forecastYears)) return null;
  return normalizePersonalSavedDcfAssumptions({
    ...draft,
    forecastYears: Number(draft.forecastYears),
  });
}
