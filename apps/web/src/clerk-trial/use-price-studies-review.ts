import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ManagedEodHistoryResponseDto } from "@research-cockpit/contracts";
import {
  resolveManagedPriceStudies,
  type ManagedPriceStudyKey,
} from "./managed-price-studies";
import type {
  ManagedPriceStudiesActions,
  PreparedPriceStudiesNote,
  PriceStudiesNotePreparation,
} from "./managed-price-studies-note";

interface Context {
  readonly response: ManagedEodHistoryResponseDto;
  readonly blockedReason: string | null;
  live: boolean;
  choiceRevision: symbol;
  previewRevision: symbol;
}
interface Preparation {
  readonly response: ManagedEodHistoryResponseDto;
  readonly guard: () => boolean;
  readonly value: PriceStudiesNotePreparation;
}
const empty: readonly ManagedPriceStudyKey[] = Object.freeze([]);

/** Temporary choices have a committed lifetime; the workspace owns draft changes. */
export function usePriceStudiesReview({
  response,
  blockedReason,
  actions,
}: {
  readonly response: ManagedEodHistoryResponseDto;
  readonly blockedReason: string | null;
  readonly actions: ManagedPriceStudiesActions;
}) {
  const studies = useMemo(
    () => resolveManagedPriceStudies(response),
    [response],
  );
  const context = useMemo<Context>(
    () => ({
      response,
      blockedReason,
      live: false,
      choiceRevision: Symbol("study choices"),
      previewRevision: Symbol("study preview"),
    }),
    [response, blockedReason],
  );
  const active = useRef<Context | null>(null);
  const consumed = useRef(new WeakSet<PreparedPriceStudiesNote>());
  const [choice, setChoice] = useState<{
    response: ManagedEodHistoryResponseDto;
    keys: readonly ManagedPriceStudyKey[];
  }>(() => ({ response, keys: empty }));
  const [prepared, setPrepared] = useState<Preparation | null>(null);
  const [feedback, setFeedback] = useState<{
    context: Context;
    message: string;
  } | null>(null);
  useLayoutEffect(() => {
    context.live = true;
    active.current = context;
    return () => {
      context.live = false;
      if (active.current === context) active.current = null;
    };
  }, [context]);

  const keys = choice.response === response ? choice.keys : empty;
  const revision = context.choiceRevision;
  const canAct = () =>
    context.live &&
    active.current === context &&
    context.blockedReason === null &&
    context.choiceRevision === revision;
  const preparation = prepared?.response === response ? prepared : null;
  const preview = preparation?.value.preview ?? null;
  const current =
    studies !== null &&
    isCurrent(preparation, actions) &&
    (preview === null || !consumed.current.has(preview));
  const message = feedback?.context === context ? feedback.message : "";
  const status =
    blockedReason ||
    message ||
    (preview && !current
      ? "The study choices, history, note or review context changed. Preview the complete note again."
      : preparation?.value.reason) ||
    "";

  const onToggle = (key: ManagedPriceStudyKey) => {
    if (
      !canAct() ||
      !studies?.rows.some((row) => row.key === key && row.available)
    )
      return;
    context.choiceRevision = Symbol("study choices");
    context.previewRevision = Symbol("study preview");
    setChoice({
      response,
      keys: Object.freeze(
        keys.includes(key)
          ? keys.filter((entry) => entry !== key)
          : [...keys, key],
      ),
    });
    setPrepared(null);
    setFeedback(null);
  };
  const onPrepare = () => {
    if (!studies || !canAct()) return;
    context.previewRevision = Symbol("study preview");
    const previewRevision = context.previewRevision;
    const guard = () => canAct() && context.previewRevision === previewRevision;
    const value = tryPrepare(actions, response, keys, guard);
    setPrepared({ response, guard, value });
    setFeedback(null);
  };
  const onAppend = () => {
    if (
      !studies ||
      !canAct() ||
      !preparation ||
      !preview ||
      !isCurrent(preparation, actions) ||
      consumed.current.has(preview)
    )
      return;
    consumed.current.add(preview);
    const result = tryAppend(actions, preview);
    context.previewRevision = Symbol("study preview consumed");
    setPrepared(null);
    setFeedback({ context, message: result.message });
  };

  return {
    studies,
    keys,
    preview,
    current,
    status,
    onToggle,
    onPrepare,
    onAppend,
  };
}

function isCurrent(
  prepared: Preparation | null,
  actions: ManagedPriceStudiesActions,
) {
  try {
    return Boolean(
      prepared?.value.preview &&
      prepared.guard() &&
      actions.isCurrent(prepared.value.preview),
    );
  } catch {
    return false;
  }
}

function tryPrepare(
  actions: ManagedPriceStudiesActions,
  response: ManagedEodHistoryResponseDto,
  keys: readonly ManagedPriceStudyKey[],
  guard: () => boolean,
): PriceStudiesNotePreparation {
  try {
    return actions.prepare(response, keys, guard);
  } catch {
    return {
      preview: null,
      reason:
        "The study note could not be prepared. Review the current price history and draft.",
    };
  }
}

function tryAppend(
  actions: ManagedPriceStudiesActions,
  preview: PreparedPriceStudiesNote,
): { readonly message: string } {
  try {
    return actions.append(preview);
  } catch {
    return {
      message:
        "The study note could not be applied. Review the draft and prepare a new preview.",
    };
  }
}
