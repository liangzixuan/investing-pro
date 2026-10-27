import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ToggleEvent,
} from "react";
import type {
  PersonalSecInterimCanonicalResponseDto as Response,
  PersonalSecInterimStatementConcept as Concept,
} from "@research-cockpit/contracts";
import { getManagedInterimView } from "./managed-interim-view";
import type {
  ManagedInterimCellSelection as Selection,
  ManagedInterimNotePreparation,
  PreparedManagedInterimStatementsNote as Preview,
} from "./managed-interim-statements-note";
export interface ManagedInterimStatementsActions {
  readonly prepare: (
    response: Response,
    selection: readonly Selection[],
    current: () => boolean,
  ) => ManagedInterimNotePreparation;
  readonly isCurrent: (preview: Preview) => boolean;
  readonly append: (preview: Preview) => {
    readonly appended: boolean;
    readonly message: string;
  };
  readonly cancel: (preview: Preview) => void;
}
interface Context {
  readonly response: Response;
  readonly blocked: string | null;
  live: boolean;
  revision: symbol;
  previewRevision: symbol;
}
interface Preparation {
  readonly context: Context;
  readonly value: ManagedInterimNotePreparation;
  readonly guard: () => boolean;
}
function currentPreview(
  prepared: Preparation | null,
  actions: ManagedInterimStatementsActions,
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
function useContext(response: Response, blocked: string | null) {
  const context = useMemo<Context>(
    () => ({
      response,
      blocked,
      live: false,
      revision: Symbol(),
      previewRevision: Symbol(),
    }),
    [response, blocked],
  );
  const active = useRef<Context | null>(null);
  useLayoutEffect(() => {
    context.live = true;
    active.current = context;
    return () => {
      context.live = false;
      if (active.current === context) active.current = null;
    };
  }, [context]);
  const revision = context.revision;
  const committed = () => context.live && active.current === context;
  const canAct = () =>
    committed() && context.blocked === null && context.revision === revision;
  return { context, committed, canAct };
}
function useChoices(owner: ReturnType<typeof useContext>) {
  const { context, canAct } = owner,
    response = context.response;
  const [choice, setChoice] = useState<{
    response: Response;
    keys: readonly Selection[];
  }>({ response, keys: [] });
  const keys = choice.response === response ? choice.keys : [];
  const toggle = (concept: Concept, periodKey: string) => {
    if (!canAct()) return;
    const cell = getManagedInterimView(response)!
      .statements.statements.flatMap((s) => s.rows)
      .find((r) => r.concept === concept)
      ?.cells.find((c) => c.period.key === periodKey);
    if (cell?.status !== "available") return;
    const already = keys.some(
      (key) => key.concept === concept && key.periodKey === periodKey,
    );
    context.revision = Symbol();
    context.previewRevision = Symbol();
    const next = already
      ? keys.filter(
          (key) => key.concept !== concept || key.periodKey !== periodKey,
        )
      : [...keys, Object.freeze({ concept, periodKey })];
    setChoice({ response, keys: Object.freeze(next) });
  };
  return { keys, toggle };
}
function usePreparation(
  owner: ReturnType<typeof useContext>,
  keys: readonly Selection[],
  actions: ManagedInterimStatementsActions,
) {
  const { context, committed, canAct } = owner;
  const [prepared, setPrepared] = useState<Preparation | null>(null),
    [message, setMessage] = useState("");
  const consumed = useRef(new WeakSet<Preview>());
  const visible = prepared?.context === context ? prepared : null,
    preview = visible?.value.preview ?? null;
  const reset = (message: string) => {
    context.previewRevision = Symbol();
    setPrepared(null);
    setMessage(message);
  };
  const prepare = () => {
    if (!canAct()) return;
    context.previewRevision = Symbol();
    const captured = context.previewRevision;
    const guard = () => canAct() && context.previewRevision === captured;
    const value = actions.prepare(context.response, keys, guard);
    if (!guard()) return;
    setPrepared({ context, value, guard });
    setMessage("");
  };
  const append = () => {
    if (!visible?.guard()) return;
    if (!currentPreview(visible, actions) || !preview) return;
    if (consumed.current.has(preview)) return;
    consumed.current.add(preview);
    const result = actions.append(preview);
    if (committed()) reset(result.message);
  };
  const cancel = () => {
    if (!committed()) return;
    context.previewRevision = Symbol();
    if (preview) actions.cancel(preview);
    reset("Interim note preview cancelled. The draft is unchanged.");
  };
  return {
    preview,
    current: currentPreview(visible, actions),
    reason: visible?.value.reason ?? null,
    message,
    prepare,
    append,
    cancel,
    reset,
  };
}
function useDetailsClose(
  owner: ReturnType<typeof useContext>,
  prepared: ReturnType<typeof usePreparation>,
  actions: ManagedInterimStatementsActions,
) {
  const active = useRef<object | null>(null),
    render = {};
  useLayoutEffect(() => {
    active.current = render;
    return () => {
      if (active.current === render) active.current = null;
    };
  }, [render]);
  return (event: ToggleEvent<HTMLDetailsElement>) => {
    if (event.target !== event.currentTarget || event.currentTarget.open)
      return;
    if (active.current !== render || !owner.committed()) return;
    owner.context.previewRevision = Symbol();
    if (prepared.preview) actions.cancel(prepared.preview);
    prepared.reset(
      "Interim note preview closed. Preview again before appending.",
    );
  };
}
export function useInterimStatementsReview(
  response: Response,
  blocked: string | null,
  actions: ManagedInterimStatementsActions,
) {
  const owner = useContext(response, blocked),
    choice = useChoices(owner),
    prepared = usePreparation(owner, choice.keys, actions),
    close = useDetailsClose(owner, prepared, actions);
  const toggle = (concept: Concept, periodKey: string) => {
    if (!owner.canAct()) return;
    choice.toggle(concept, periodKey);
    prepared.reset("");
  };
  return { ...prepared, keys: choice.keys, toggle, close };
}
