import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonalSecInterimCanonicalResponseDto } from "@research-cockpit/contracts";
import { buildInterimFixture } from "../../android-tests/managed-workspace/interim-report-packet";
import { parseSecInterimCanonicalResponse } from "../lib/sec-interim-canonical-response";
import { getManagedInterimView } from "./managed-interim-view";
import {
  ManagedInterimStatementsReview,
  type ManagedInterimStatementsActions,
} from "./ManagedInterimStatementsReview";
import { InterimStatementRows } from "./InterimStatementsReportView";
import {
  prepareManagedInterimStatementsNote,
  appendManagedInterimStatementsNote,
  isManagedInterimStatementsNoteCurrent,
  retireManagedInterimStatementsNote,
} from "./managed-interim-statements-note";
const hooks = vi.hoisted(() => ({
  direct: false,
  index: 0,
  slots: [] as unknown[],
  layouts: [] as Array<() => void>,
}));
function directReference<T>(initial: T) {
  const i = hooks.index++;
  if (!(i in hooks.slots)) hooks.slots[i] = { current: initial };
  return hooks.slots[i] as { current: T };
}
function directMemo<T>(factory: () => T, deps: React.DependencyList) {
  const i = hooks.index++,
    old = hooks.slots[i] as
      { deps: React.DependencyList; value: T } | undefined;
  if (!old || deps.some((value, at) => !Object.is(value, old.deps[at])))
    hooks.slots[i] = { deps, value: factory() };
  return (hooks.slots[i] as { value: T }).value;
}
function directState(initial: unknown) {
  const i = hooks.index++;
  if (!(i in hooks.slots))
    hooks.slots[i] =
      typeof initial === "function" ? (initial as () => unknown)() : initial;
  return [
    hooks.slots[i],
    (value: unknown) => {
      hooks.slots[i] = value;
    },
  ] as const;
}
function directLayout(
  effect: () => void | (() => void),
  deps: React.DependencyList,
) {
  const i = hooks.index++,
    old = hooks.slots[i] as
      | { kind: "layout"; deps: React.DependencyList; cleanup?: () => void }
      | undefined;
  if (!old || deps.some((value, at) => !Object.is(value, old.deps[at])))
    hooks.layouts.push(() => {
      old?.cleanup?.();
      const cleanup = effect();
      hooks.slots[i] = { kind: "layout", deps, cleanup };
    });
}
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => (hooks.direct ? "statement-review-test" : actual.useId()),
    useRef: <T,>(initial: T) =>
      hooks.direct ? directReference(initial) : actual.useRef(initial),
    useMemo: <T,>(factory: () => T, deps: React.DependencyList) =>
      hooks.direct ? directMemo(factory, deps) : actual.useMemo(factory, deps),
    useState: (initial: unknown) =>
      hooks.direct ? directState(initial) : actual.useState(initial),
    useLayoutEffect: (
      effect: () => void | (() => void),
      deps: React.DependencyList,
    ) =>
      hooks.direct
        ? directLayout(effect, deps)
        : actual.useLayoutEffect(effect, deps),
  };
});
function unmount() {
  for (const slot of hooks.slots)
    if (
      slot &&
      typeof slot === "object" &&
      "kind" in slot &&
      slot.kind === "layout" &&
      "cleanup" in slot &&
      typeof slot.cleanup === "function"
    )
      (slot.cleanup as () => void)();
}
beforeEach(() => {
  unmount();
  hooks.direct = false;
  hooks.index = 0;
  hooks.slots = [];
  hooks.layouts = [];
});

let admitted: PersonalSecInterimCanonicalResponseDto;
beforeAll(async () => {
  const raw = await buildInterimFixture();
  admitted = (await parseSecInterimCanonicalResponse(
    raw,
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: raw.catalogSnapshotSha256,
      listingId: raw.security.listingId,
      symbol: raw.security.symbol,
    },
    new AbortController().signal,
  ))!;
});
function elements(
  node: React.ReactNode,
): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (
    typeof node.type === "function" &&
    ["InterimNotePanel", "PreparedInterimNote"].includes(node.type.name)
  ) {
    const render = node.type as (
      props: Record<string, unknown>,
    ) => React.ReactNode;
    return [node, ...elements(render(node.props))];
  }
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function byId(node: React.ReactNode, id: string) {
  const result = elements(node).find((element) => element.props.id === id);
  if (!result) throw new Error(`Missing ${id}`);
  return result;
}
const click = (node: React.ReactElement<Record<string, unknown>>) =>
  (node.props.onClick as () => void)();
interface NoteState {
  note: string;
  revision: symbol;
  applied: string[];
}
function noteActions(state: NoteState): ManagedInterimStatementsActions {
  return {
    prepare: vi.fn<ManagedInterimStatementsActions["prepare"]>(
      (response, selection, current) => {
        const capture = state.revision;
        return prepareManagedInterimStatementsNote({
          response,
          selection,
          note: state.note,
          showingPrevious: false,
          isCurrent: () => capture === state.revision && current(),
          apply: (value) => {
            state.applied.push(value);
            state.note = value;
            state.revision = Symbol();
          },
        });
      },
    ),
    isCurrent: isManagedInterimStatementsNoteCurrent,
    append: vi.fn(appendManagedInterimStatementsNote),
    cancel: vi.fn(retireManagedInterimStatementsNote),
  };
}
function setup() {
  const state: NoteState = {
    note: "Thèse café 📈",
    revision: Symbol(),
    applied: [],
  };
  const actions = noteActions(state),
    applied = state.applied;
  let props: React.ComponentProps<typeof ManagedInterimStatementsReview> = {
    response: admitted,
    actions,
    blockedReason: null,
  };
  const render = (change: Partial<typeof props> = {}) => {
    props = { ...props, ...change };
    hooks.direct = true;
    hooks.index = 0;
    const node = ManagedInterimStatementsReview(props);
    for (const effect of hooks.layouts.splice(0)) effect();
    hooks.direct = false;
    return node;
  };
  const select = () => {
    const node = render(),
      reader = elements(node).find(
        (element) => element.type === InterimStatementRows,
      )!;
    const rows =
      getManagedInterimView(admitted)!.statements.statements[0]!.rows;
    const period = rows.find((row) => row.concept === "NetIncomeLoss")!
      .cells[0]!.period.key;
    (reader.props.onToggle as (concept: string, key: string) => void)(
      "NetIncomeLoss",
      period,
    );
    return render();
  };
  const preview = () => {
    click(byId(render(), "interim-note-preview"));
    return render();
  };
  const close = (node: React.ReactNode) => {
    const details = elements(node).find(
      (element) => element.type === "details",
    )!;
    const target = { open: false };
    (details.props.onToggle as (event: unknown) => void)({
      currentTarget: target,
      target,
    });
  };
  return {
    actions,
    applied,
    render,
    select,
    preview,
    close,
    changeNote: (value: string) => {
      state.note = value;
      state.revision = Symbol();
    },
  };
}
describe("interim selected-cell UI", () => {
  it("shows all32 concepts across three views without selecting or preparing", () => {
    const f = setup();
    const html = renderToStaticMarkup(f.render());
    expect(html).toContain("Review selected interim cells (0)");
    expect(html).toContain("interim-view-income");
    expect(html).toContain("interim-view-balance");
    expect(html).toContain("interim-view-cash");
    expect(f.actions.prepare).not.toHaveBeenCalled();
    expect(f.applied).toEqual([]);
  });
  it("previews complete text and consumes double invocation before append reentry", () => {
    const f = setup();
    f.select();
    const node = f.preview(),
      append = byId(node, "interim-note-append");
    expect(append.props.disabled).toBe(false);
    click(append);
    click(append);
    expect(f.actions.append).toHaveBeenCalledOnce();
    expect(f.applied).toHaveLength(1);
    expect(f.applied[0]).toContain("Thèse café 📈 Interim CompanyFacts-only:");
    expect(f.applied[0]).toContain("USD 4");
  });
  it("permanently retires on current details close and allows a new preview", () => {
    const f = setup();
    f.select();
    const old = f.preview(),
      append = byId(old, "interim-note-append");
    f.close(old);
    f.render();
    click(append);
    expect(f.applied).toEqual([]);
    expect(f.actions.cancel).toHaveBeenCalledOnce();
    const fresh = f.preview();
    expect(byId(fresh, "interim-note-append").props.disabled).toBe(false);
    click(byId(fresh, "interim-note-append"));
    expect(f.applied).toHaveLength(1);
  });
  it("refuses a stale details callback after a newer preview is committed", () => {
    const f = setup();
    f.select();
    const old = f.preview(),
      fresh = f.preview();
    f.close(old);
    expect(f.actions.cancel).not.toHaveBeenCalled();
    click(byId(fresh, "interim-note-append"));
    expect(f.applied).toHaveLength(1);
  });
  it("retires selection edit then restore and cannot append with an old callback", () => {
    const f = setup();
    f.select();
    const old = f.preview();
    f.select();
    f.select();
    click(byId(old, "interim-note-append"));
    expect(f.applied).toEqual([]);
    expect(byId(f.preview(), "interim-note-append").props.disabled).toBe(false);
  });
  it("retires a note edit then restore and explicit cancellation", () => {
    const f = setup();
    f.select();
    const old = f.preview();
    f.changeNote("Changed");
    expect(byId(f.render(), "interim-note-append").props.disabled).toBe(true);
    f.changeNote("Thèse café 📈");
    click(byId(old, "interim-note-append"));
    expect(f.applied).toEqual([]);
    const fresh = f.preview();
    click(byId(fresh, "interim-note-cancel"));
    click(byId(fresh, "interim-note-append"));
    expect(f.applied).toEqual([]);
  });
  it("retires blocked/load state even when the previous response is retained", () => {
    const f = setup();
    f.select();
    const old = f.preview();
    f.render({ blockedReason: "Wait for refresh" });
    f.render({ blockedReason: null });
    click(byId(old, "interim-note-append"));
    expect(f.applied).toEqual([]);
    expect(f.actions.append).not.toHaveBeenCalled();
  });
  it("makes unmounted old handlers inert", () => {
    const f = setup();
    f.select();
    const old = f.preview();
    unmount();
    click(byId(old, "interim-note-append"));
    f.close(old);
    expect(f.applied).toEqual([]);
    expect(f.actions.cancel).not.toHaveBeenCalled();
  });
});
