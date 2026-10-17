import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PersonalSecAnnualCanonicalResponseDto,
  PersonalSecAnnualStatementConcept,
} from "@research-cockpit/contracts";
import {
  canonicalAnnualPacket,
  canonicalAnnualRequest,
} from "../features/research/sec-annual-canonical-fixture";
import { parseSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";
import {
  ManagedAnnualStatements,
  type ManagedAnnualStatementsProps,
} from "./ManagedAnnualStatements";
import {
  ManagedAnnualStatementsReview,
  type ManagedAnnualStatementsReviewActions,
  type ManagedAnnualStatementsReviewProps,
} from "./ManagedAnnualStatementsReview";
import {
  appendManagedAnnualStatementsNote,
  isManagedAnnualStatementsNoteCurrent,
  prepareManagedAnnualStatementsNote,
} from "./managed-annual-statements-note";

const hooks = vi.hoisted(() => ({
  direct: false,
  index: 0,
  slots: [] as unknown[],
  layouts: [] as Array<() => void>,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => (hooks.direct ? "statement-review-test" : actual.useId()),
    useRef: <T,>(initial: T) => {
      if (!hooks.direct) return actual.useRef(initial);
      const i = hooks.index++;
      if (!(i in hooks.slots)) hooks.slots[i] = { current: initial };
      return hooks.slots[i];
    },
    useMemo: <T,>(factory: () => T, deps: React.DependencyList) => {
      if (!hooks.direct) return actual.useMemo(factory, deps);
      const i = hooks.index++;
      const old = hooks.slots[i] as
        { deps: React.DependencyList; value: T } | undefined;
      if (!old || deps.some((value, at) => !Object.is(value, old.deps[at])))
        hooks.slots[i] = { deps, value: factory() };
      return (hooks.slots[i] as { value: T }).value;
    },
    useState: (initial: unknown) => {
      if (!hooks.direct) return actual.useState(initial);
      const i = hooks.index++;
      if (!(i in hooks.slots))
        hooks.slots[i] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        hooks.slots[i],
        (value: unknown) => {
          hooks.slots[i] = value;
        },
      ];
    },
    useLayoutEffect: (
      effect: () => void | (() => void),
      deps: React.DependencyList,
    ) => {
      if (!hooks.direct) return actual.useLayoutEffect(effect, deps);
      const i = hooks.index++;
      const old = hooks.slots[i] as
        | { kind: "layout"; deps: React.DependencyList; cleanup?: () => void }
        | undefined;
      if (!old || deps.some((value, at) => !Object.is(value, old.deps[at])))
        hooks.layouts.push(() => {
          old?.cleanup?.();
          const cleanup = effect();
          hooks.slots[i] = { kind: "layout", deps, cleanup };
        });
    },
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
let admitted: PersonalSecAnnualCanonicalResponseDto;
let empty: PersonalSecAnnualCanonicalResponseDto;
async function admit(packet: PersonalSecAnnualCanonicalResponseDto) {
  const response = await parseSecAnnualCanonicalResponse(
    packet,
    canonicalAnnualRequest,
    new AbortController().signal,
  );
  if (!response) throw new Error("Invented canonical packet was not admitted");
  return response;
}
beforeAll(async () => {
  admitted = await admit(await canonicalAnnualPacket());
  empty = await admit(await canonicalAnnualPacket({ rowsPerConcept: 0 }));
});
function elements(
  node: React.ReactNode,
): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
const button = (node: React.ReactNode, text: string) =>
  elements(node).find(
    (element) => element.type === "button" && element.props.children === text,
  )!;
const click = (node: React.ReactElement<Record<string, unknown>>) =>
  (node.props.onClick as () => void)();
function reader(node: React.ReactNode) {
  return elements(node).find(
    (element) => element.type === ManagedAnnualStatements,
  )!.props as unknown as ManagedAnnualStatementsProps;
}
function setup(initialNote = "  My <exact> thesis  ", response = admitted) {
  let note = initialNote;
  let workspaceRevision = Symbol("note state");
  const applied: string[] = [];
  const actions: ManagedAnnualStatementsReviewActions = {
    prepare: vi.fn<ManagedAnnualStatementsReviewActions["prepare"]>(
      (packet, selection, selectionIsCurrent) => {
        const revision = workspaceRevision;
        return prepareManagedAnnualStatementsNote({
          response: packet,
          selection,
          note,
          showingPrevious: false,
          isCurrent: () =>
            workspaceRevision === revision && selectionIsCurrent(),
          apply: (value) => {
            applied.push(value);
            note = value;
            workspaceRevision = Symbol("note state");
          },
        });
      },
    ),
    isCurrent: vi.fn(isManagedAnnualStatementsNoteCurrent),
    append: vi.fn(appendManagedAnnualStatementsNote),
  };
  let props: ManagedAnnualStatementsReviewProps = {
    response,
    actions,
    blockedReason: null,
  };
  const render = (
    changes: Partial<ManagedAnnualStatementsReviewProps> = {},
  ) => {
    props = { ...props, ...changes };
    hooks.direct = true;
    hooks.index = 0;
    const node = ManagedAnnualStatementsReview(props);
    for (const layout of hooks.layouts.splice(0)) layout();
    hooks.direct = false;
    return node;
  };
  const select = (
    concept: PersonalSecAnnualStatementConcept = "NetIncomeLoss",
    endDate = "2025-12-31",
  ) => {
    const node = render();
    reader(node).onToggleCell(concept, endDate);
    return render();
  };
  const preview = () => {
    click(button(render(), "Preview statement note"));
    return render();
  };
  return {
    actions,
    applied,
    render,
    select,
    preview,
    get note() {
      return note;
    },
    changeNote(value: string) {
      note = value;
      workspaceRevision = Symbol("note state");
    },
  };
}
describe("annual statement cell review", () => {
  it("reads the admitted canonical response and starts with no selection or automatic preparation", () => {
    const f = setup();
    const html = renderToStaticMarkup(
      <ManagedAnnualStatementsReview
        response={admitted}
        actions={f.actions}
        blockedReason={null}
      />,
    );
    expect(html).toContain("USD -9007199254740993.000000000000000001");
    expect(html).toContain("Review selected statement cells (0)");
    expect(html).toContain(
      "Select at least one available statement cell to preview.",
    );
    expect(html).not.toContain("<details open");
    expect(html).not.toContain("Complete note preview");
    expect(f.actions.prepare).not.toHaveBeenCalled();
    expect(f.actions.append).not.toHaveBeenCalled();
  });
  it("selects exact cells, previews the full escaped note and appends once through the real capability", () => {
    const f = setup();
    f.select();
    expect(f.applied).toEqual([]);
    const tree = f.preview();
    const call = vi.mocked(f.actions.prepare).mock.calls[0]!;
    expect(call[0]).toBe(admitted);
    expect(call[1]).toEqual([
      { concept: "NetIncomeLoss", endDate: "2025-12-31" },
    ]);
    expect(Object.isFrozen(call[1])).toBe(true);
    expect(Object.isFrozen(call[1][0])).toBe(true);
    expect(call[2]()).toBe(true);
    const prepared = vi.mocked(f.actions.prepare).mock.results[0]!
      .value as ReturnType<ManagedAnnualStatementsReviewActions["prepare"]>;
    expect(prepared.reason).toBeNull();
    expect(renderToStaticMarkup(tree)).toContain("My &lt;exact&gt; thesis");
    expect(renderToStaticMarkup(tree)).toContain(
      prepared
        .preview!.note.replace(/&/gu, "&amp;")
        .replace(/</gu, "&lt;")
        .replace(/>/gu, "&gt;")
        .replace(/"/gu, "&quot;")
        .replace(/'/gu, "&#x27;"),
    );
    expect(f.applied).toEqual([]);
    const append = button(tree, "Add statement cells to note draft");
    expect(append.props.disabled).toBe(false);
    click(append);
    click(append);
    expect(f.actions.append).toHaveBeenCalledExactlyOnceWith(prepared.preview);
    expect(f.applied).toEqual([prepared.preview!.note]);
    expect(f.note).toBe(prepared.preview!.note);
    expect(call[2]()).toBe(false);
    const html = renderToStaticMarkup(f.render());
    expect(html).toContain("Statement cells added to the note draft.");
    expect(html).not.toContain("Complete note preview");
  });
  it("permanently fences old selection and append handlers through selection edit then restore", () => {
    const f = setup();
    const oldReader = reader(f.render());
    oldReader.onToggleCell("NetIncomeLoss", "2025-12-31");
    const oldPreview = f.preview();
    const oldAppend = button(oldPreview, "Add statement cells to note draft");
    const oldGuard = vi.mocked(f.actions.prepare).mock.calls[0]![2];
    f.select();
    f.select();
    expect(reader(f.render()).selectedCells).toEqual([
      { concept: "NetIncomeLoss", endDate: "2025-12-31" },
    ]);
    oldReader.onToggleCell("Assets", "2025-12-31");
    click(oldAppend);
    expect(oldGuard()).toBe(false);
    expect(reader(f.render()).selectedCells).toEqual([
      { concept: "NetIncomeLoss", endDate: "2025-12-31" },
    ]);
    expect(f.actions.append).not.toHaveBeenCalled();
    expect(f.applied).toEqual([]);
  });
  it("replacing a preview fences its old append handler without changing the choices", () => {
    const f = setup();
    f.select();
    const oldAppend = button(f.preview(), "Add statement cells to note draft");
    const guard = vi.mocked(f.actions.prepare).mock.calls[0]![2];
    const latest = f.preview();
    expect(guard()).toBe(false);
    click(oldAppend);
    expect(f.actions.append).not.toHaveBeenCalled();
    click(button(latest, "Add statement cells to note draft"));
    expect(f.actions.append).toHaveBeenCalledOnce();
    expect(f.applied).toHaveLength(1);
  });
  it("blocks note actions while preserving local reading, then requires a new preview after unblocking", () => {
    const f = setup();
    f.select();
    const initial = f.preview();
    const oldAppend = button(initial, "Add statement cells to note draft");
    const oldPrepare = button(initial, "Preview statement note");
    const oldToggle = reader(initial).onToggleCell;
    const guard = vi.mocked(f.actions.prepare).mock.calls[0]![2];
    const blocked = f.render({
      blockedReason: "Wait for the source refresh to finish.",
    });
    expect(reader(blocked).disabled).toBe(true);
    const html = renderToStaticMarkup(blocked);
    expect(html).toContain("Wait for the source refresh to finish.");
    expect(html).toContain("Inspect filing and original source references");
    expect(html).not.toMatch(/<select[^>]*disabled/gu);
    expect(button(blocked, "Preview statement note").props.disabled).toBe(true);
    oldToggle("Assets", "2025-12-31");
    click(oldPrepare);
    click(oldAppend);
    const restored = f.render({ blockedReason: null });
    expect(reader(restored).selectedCells).toHaveLength(1);
    expect(
      button(restored, "Add statement cells to note draft").props.disabled,
    ).toBe(true);
    expect(renderToStaticMarkup(restored)).toContain("Previous note preview");
    expect(guard()).toBe(false);
    click(oldAppend);
    expect(f.actions.append).not.toHaveBeenCalled();
    expect(f.actions.prepare).toHaveBeenCalledOnce();
    click(button(f.preview(), "Add statement cells to note draft"));
    expect(f.applied).toHaveLength(1);
  });
  it("clears source-owned choices and fences old callbacks through response replacement then restoration", () => {
    const f = setup();
    f.select();
    const first = f.preview();
    const oldToggle = reader(first).onToggleCell;
    const oldPrepare = button(first, "Preview statement note");
    const oldAppend = button(first, "Add statement cells to note draft");
    const guard = vi.mocked(f.actions.prepare).mock.calls[0]![2];
    const replacement = f.render({ response: empty });
    expect(reader(replacement).selectedCells).toEqual([]);
    expect(renderToStaticMarkup(replacement)).not.toContain(
      "Complete annual statement note preview",
    );
    const restored = f.render({ response: admitted });
    oldToggle("NetIncomeLoss", "2025-12-31");
    click(oldPrepare);
    click(oldAppend);
    expect(reader(restored).selectedCells).toEqual([]);
    expect(guard()).toBe(false);
    expect(f.actions.prepare).toHaveBeenCalledOnce();
    expect(f.actions.append).not.toHaveBeenCalled();
  });
  it("rejects empty and unavailable choices before preparing a note", () => {
    const f = setup("My note", empty);
    const first = f.render();
    expect(button(first, "Preview statement note").props.disabled).toBe(true);
    click(button(first, "Preview statement note"));
    reader(first).onToggleCell("NetIncomeLoss", "2025-12-31");
    expect(reader(f.render()).selectedCells).toEqual([]);
    expect(f.actions.prepare).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(f.render())).not.toContain('type="checkbox"');
  });
  it.each(["Unfinished\nnote", "x".repeat(2000)])(
    "shows the complete-note refusal without clipping or append: %j",
    (note) => {
      const f = setup(note);
      f.select();
      const tree = f.preview();
      const html = renderToStaticMarkup(tree);
      expect(html).toContain(
        note.includes("\n")
          ? "Correct the current note before adding statement cells."
          : "The complete note must fit the existing single-line, 2,000-character limit.",
      );
      expect(html).not.toContain("Complete annual statement note preview");
      expect(
        elements(tree).some(
          (element) =>
            element.type === "button" &&
            element.props.children === "Add statement cells to note draft",
        ),
      ).toBe(false);
      expect(f.applied).toEqual([]);
      expect(f.actions.append).not.toHaveBeenCalled();
    },
  );
  it("combines the caller's opaque note revision with the UI guard, including note edit then restore", () => {
    const f = setup();
    f.select();
    const tree = f.preview();
    const note = f.note;
    f.changeNote("Changed note");
    f.changeNote(note);
    expect(renderToStaticMarkup(f.render())).toContain("Previous note preview");
    click(button(tree, "Add statement cells to note draft"));
    expect(f.applied).toEqual([]);
    expect(f.actions.append).not.toHaveBeenCalled();
  });
  it("retires preparation, selection and append callbacks permanently on unmount", () => {
    const f = setup();
    f.select();
    const tree = f.preview();
    const guard = vi.mocked(f.actions.prepare).mock.calls[0]![2];
    unmount();
    reader(tree).onToggleCell("Assets", "2025-12-31");
    click(button(tree, "Preview statement note"));
    click(button(tree, "Add statement cells to note draft"));
    expect(guard()).toBe(false);
    expect(f.actions.prepare).toHaveBeenCalledOnce();
    expect(f.actions.append).not.toHaveBeenCalled();
    expect(f.applied).toEqual([]);
  });
});
