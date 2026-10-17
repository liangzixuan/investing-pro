import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eodResponse } from "./eod-history-fixture";
import {
  ManagedPriceStudies,
  ManagedPriceStudyTable,
  CapturedPriceStudies,
} from "./ManagedPriceStudies";
import {
  ManagedPriceStudiesNote,
  type ManagedPriceStudiesActions,
} from "./managed-price-studies-note";
import {
  resolveManagedPriceStudies,
  type ManagedPriceStudyKey,
} from "./managed-price-studies";

// Commit-aware callback test harness; this does not simulate real concurrent React.
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
    useId: () => (hooks.direct ? "price-study-test" : actual.useId()),
    useRef: <T,>(initial: T) => {
      if (!hooks.direct) return actual.useRef(initial);
      const index = hooks.index++;
      return (hooks.slots[index] ??= { current: initial });
    },
    useMemo: <T,>(factory: () => T, deps: React.DependencyList) => {
      if (!hooks.direct) return actual.useMemo(factory, deps);
      const index = hooks.index++;
      const old = hooks.slots[index] as
        { deps: React.DependencyList; value: T } | undefined;
      if (!old || deps.some((value, at) => !Object.is(value, old.deps[at])))
        hooks.slots[index] = { deps, value: factory() };
      return (hooks.slots[index] as { value: T }).value;
    },
    useState: (initial: unknown) => {
      if (!hooks.direct) return actual.useState(initial);
      const index = hooks.index++;
      if (!(index in hooks.slots))
        hooks.slots[index] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        hooks.slots[index],
        (value: unknown) => {
          hooks.slots[index] = value;
        },
      ];
    },
    useLayoutEffect: (
      effect: () => void | (() => void),
      deps: React.DependencyList,
    ) => {
      if (!hooks.direct) return actual.useLayoutEffect(effect, deps);
      const index = hooks.index++;
      const old = hooks.slots[index] as
        { deps: React.DependencyList; cleanup?: () => void } | undefined;
      if (!old || deps.some((value, at) => !Object.is(value, old.deps[at])))
        hooks.layouts.push(() => {
          old?.cleanup?.();
          hooks.slots[index] = { deps, cleanup: effect() };
        });
    },
  };
});
function unmount() {
  for (const slot of hooks.slots)
    if (
      slot &&
      typeof slot === "object" &&
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
function button(node: React.ReactNode, text: string) {
  return elements(node).find(
    (element) => element.type === "button" && element.props.children === text,
  )!;
}
function click(node: React.ReactElement<Record<string, unknown>>) {
  (node.props.onClick as () => void)();
}
function fixture() {
  const owner = new ManagedPriceStudiesNote();
  const applied: string[] = [];
  let note = "Exact authored <text>  東京";
  let noteRevision = Symbol("note");
  const actions: ManagedPriceStudiesActions = {
    prepare: vi.fn<ManagedPriceStudiesActions["prepare"]>(
      (response, keys, guard) => {
        const revision = noteRevision;
        return owner.prepare({
          response,
          keys,
          note,
          showingPrevious: false,
          isCurrent: () => noteRevision === revision && guard(),
          apply: (value) => {
            applied.push(value);
            note = value;
            noteRevision = Symbol("note");
          },
        });
      },
    ),
    isCurrent: vi.fn<ManagedPriceStudiesActions["isCurrent"]>((preview) =>
      owner.isCurrent(preview),
    ),
    append: vi.fn<ManagedPriceStudiesActions["append"]>((preview) =>
      owner.append(preview),
    ),
  };
  let props: Parameters<typeof ManagedPriceStudies>[0] = {
    response: eodResponse(),
    showingPrevious: false,
    blockedReason: null,
    actions,
  };
  const render = (changes: Partial<typeof props> = {}) => {
    props = { ...props, ...changes };
    hooks.direct = true;
    hooks.index = 0;
    const node = ManagedPriceStudies(props);
    for (const layout of hooks.layouts.splice(0)) layout();
    hooks.direct = false;
    return node;
  };
  const toggle = (key: ManagedPriceStudyKey = "windowChange") => {
    const node = render();
    const table = elements(node).find(
      (element) => element.type === ManagedPriceStudyTable,
    )!;
    (table.props.onToggle as (key: ManagedPriceStudyKey) => void)(key);
    return render();
  };
  const preview = () => {
    click(button(render(), "Preview complete note"));
    return render();
  };
  return {
    actions,
    applied,
    render,
    toggle,
    preview,
    props,
    changeNote: (value: string) => {
      note = value;
      noteRevision = Symbol("note");
    },
  };
}
describe("raw close study review", () => {
  it("reads exact loaded dates and independent refusals without preparing a note", () => {
    const f = fixture();
    const html = renderToStaticMarkup(
      <ManagedPriceStudies
        {...f.props}
        blockedReason="Load the watchlist draft first."
      />,
    );
    expect(html).toContain("Calculated through 2026-09-19");
    expect(html).toContain("1.2469%");
    expect(html).toContain("needs 200 observed closes");
    expect(html).toContain("Load the watchlist draft first.");
    expect(html.match(/type="checkbox"/gu)).toHaveLength(2);
    expect(f.actions.prepare).not.toHaveBeenCalled();
    expect(f.actions.append).not.toHaveBeenCalled();
    const passive = renderToStaticMarkup(
      <CapturedPriceStudies
        studies={resolveManagedPriceStudies(f.props.response)!}
        showingPrevious
      />,
    );
    expect(passive).toContain("Retained previous history");
    expect(passive).not.toContain("<input");
    expect(passive).not.toContain("<button");
  });
  it("previews the whole exact note, then appends once through the real capability owner", () => {
    const f = fixture();
    f.toggle();
    const node = f.preview();
    const apply = button(node, "Add study results to note draft");
    expect(apply.props.disabled).toBe(false);
    click(apply);
    click(apply);
    expect(f.applied).toHaveLength(1);
    expect(f.applied[0]).toMatch(/^Exact authored <text> {2}東京 /u);
    expect(f.applied[0]).toContain("1.2469%");
  });
  it("does not revive an old Append after choices, note or blocked context change and restore", () => {
    const f = fixture();
    f.toggle();
    const old = button(f.preview(), "Add study results to note draft");
    f.toggle();
    f.toggle();
    click(old);
    expect(f.applied).toHaveLength(0);
    const changedNote = button(f.preview(), "Add study results to note draft");
    f.changeNote("Changed");
    f.changeNote("Exact authored <text>  東京");
    click(changedNote);
    expect(f.applied).toHaveLength(0);
    const blocked = button(f.preview(), "Add study results to note draft");
    f.render({ blockedReason: "Price request running" });
    f.render({ blockedReason: null });
    click(blocked);
    expect(f.applied).toHaveLength(0);
  });
  it("fences a replaced source and committed unmount without applying old callbacks", () => {
    const f = fixture();
    f.toggle();
    const old = button(f.preview(), "Add study results to note draft");
    f.render({ response: eodResponse() });
    click(old);
    expect(f.applied).toHaveLength(0);
    f.toggle();
    const retired = button(f.preview(), "Add study results to note draft");
    unmount();
    click(retired);
    expect(f.applied).toHaveLength(0);
  });
});
