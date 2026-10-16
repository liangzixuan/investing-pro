import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ManagedMarketsNavigation,
  type ManagedMarketsNavigationTargets,
} from "./ManagedMarketsNavigation";

const hooks = vi.hoisted(() => ({
  direct: false,
  ref: { current: null },
  pending: undefined as (() => void | (() => void)) | undefined,
  cleanup: undefined as (() => void) | undefined,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useRef: (value: unknown) =>
      hooks.direct ? hooks.ref : actual.useRef(value),
    useLayoutEffect: (
      effect: () => void | (() => void),
      deps: React.DependencyList,
    ) => {
      if (hooks.direct) hooks.pending = effect;
      else actual.useLayoutEffect(effect, deps);
    },
  };
});
afterEach(() => {
  hooks.cleanup?.();
  hooks.direct = false;
  hooks.ref.current = null;
  hooks.pending = undefined;
  hooks.cleanup = undefined;
});

const sections = [
  "board",
  "review",
  "day",
  "calendar",
  "announcements",
] as const;
type Section = (typeof sections)[number];
type Props = React.ComponentProps<typeof ManagedMarketsNavigation>;
type Link = React.ReactElement<
  React.ComponentProps<"a"> & { "data-markets-jump": Section }
>;
function links(node: React.ReactNode): Link[] {
  if (Array.isArray(node)) return node.flatMap(links);
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
  return [
    ...(node.type === "a" ? [node as Link] : []),
    ...links(node.props.children),
  ];
}

function harness() {
  const document = {
    activeElement: null as unknown,
    defaultView: {
      getComputedStyle: vi.fn(() => ({ visibility: "visible" })),
    },
  };
  function target(id: string) {
    const node = {
      id,
      isConnected: true,
      ownerDocument: document,
      getClientRects: vi.fn((): object[] => [{}]),
      closest: vi.fn((): object | null => null),
      focus: vi.fn(() => {
        document.activeElement = node;
      }),
      scrollIntoView: vi.fn(),
    };
    return node;
  }
  const nodes = {
    board: target("managed-markets-heading"),
    review: target("managed-daily-research-heading"),
    day: target("managed-markets-day-heading"),
    calendar: target("bea-agenda-title"),
    announcements: target("fed-announcements-title"),
  };
  const targets = Object.fromEntries(
    sections.map((section) => [
      section,
      {
        id: nodes[section].id,
        ref: { current: nodes[section] as unknown as HTMLHeadingElement },
      },
    ]),
  ) as ManagedMarketsNavigationTargets;
  const container = {
    ...target("markets-content"),
    contains: vi.fn((node: unknown) =>
      Object.values(nodes).includes(node as typeof nodes.board),
    ),
  };
  const props: Props = {
    targets,
    containerRef: { current: container as unknown as HTMLElement },
    isCurrent: vi.fn(() => true),
  };
  function commit() {
    hooks.cleanup?.();
    hooks.cleanup = hooks.pending?.() ?? undefined;
    hooks.pending = undefined;
  }
  function render(next: Props = props, committed = true) {
    hooks.direct = true;
    const node = ManagedMarketsNavigation(next);
    hooks.direct = false;
    if (committed) commit();
    return links(node);
  }
  function activate(controls: Link[], section: Section) {
    const preventDefault = vi.fn();
    controls.find((link) => link.props["data-markets-jump"] === section)!.props
      .onClick!({
      preventDefault,
    } as unknown as React.MouseEvent<HTMLAnchorElement>);
    expect(preventDefault).toHaveBeenCalledOnce();
  }
  return {
    nodes,
    targets,
    container,
    document,
    props,
    render,
    commit,
    activate,
  };
}

describe("managed Markets section navigation", () => {
  it("renders five named native links without running guards or moving focus", () => {
    const h = harness();
    const html = renderToStaticMarkup(
      <ManagedMarketsNavigation {...h.props} />,
    );
    expect(html).toContain('aria-label="On Markets"><p>On Markets</p>');
    expect(html).toContain(
      'href="#managed-markets-heading" data-markets-jump="board">Company board</a>',
    );
    expect(html).toContain(
      'href="#bea-agenda-title" data-markets-jump="calendar">Economic calendar</a>',
    );
    expect(html).toContain(
      'href="#fed-announcements-title" data-markets-jump="announcements">Fed announcements</a>',
    );
    expect(html).toContain(
      'href="#managed-daily-research-heading" data-markets-jump="review">Research checks due</a>',
    );
    expect(html).toContain(
      'href="#managed-markets-day-heading" data-markets-jump="day">Markets day view</a>',
    );
    expect(h.props.isCurrent).not.toHaveBeenCalled();
    for (const node of Object.values(h.nodes)) {
      expect(node.focus).not.toHaveBeenCalled();
      expect(node.scrollIntoView).not.toHaveBeenCalled();
    }
  });

  it.each(sections)(
    "focuses only the owned %s heading, then scrolls instantly",
    (section) => {
      const h = harness();
      h.activate(h.render(), section);
      const target = h.nodes[section];
      expect(target.focus).toHaveBeenCalledExactlyOnceWith({
        preventScroll: true,
      });
      expect(target.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
        block: "start",
        behavior: "instant",
      });
      expect(target.focus.mock.invocationCallOrder[0]).toBeLessThan(
        target.scrollIntoView.mock.invocationCallOrder[0]!,
      );
      for (const other of sections.filter((key) => key !== section)) {
        expect(h.nodes[other].focus).not.toHaveBeenCalled();
        expect(h.nodes[other].scrollIntoView).not.toHaveBeenCalled();
      }
    },
  );

  it("requires committed props and retires old handlers after replacement or unmount", () => {
    const h = harness();
    const before = h.render(h.props, false);
    h.activate(before, "calendar");
    expect(h.nodes.calendar.focus).not.toHaveBeenCalled();
    h.commit();
    const next = h.render({ ...h.props, targets: { ...h.targets } }, false);
    h.activate(next, "calendar");
    expect(h.nodes.calendar.focus).not.toHaveBeenCalled();
    h.commit();
    h.activate(before, "calendar");
    expect(h.nodes.calendar.focus).not.toHaveBeenCalled();
    h.activate(next, "calendar");
    expect(h.nodes.calendar.focus).toHaveBeenCalledOnce();
    hooks.cleanup?.();
    h.activate(next, "calendar");
    expect(h.nodes.calendar.focus).toHaveBeenCalledOnce();
  });

  it.each(["target", "container"] as const)(
    "refuses a missing, disconnected, hidden or inert %s",
    (kind) => {
      const h = harness();
      const controls = h.render();
      const node = kind === "target" ? h.nodes.calendar : h.container;
      const ref =
        kind === "target" ? h.targets.calendar.ref : h.props.containerRef;
      const current = ref.current;
      ref.current = null;
      h.activate(controls, "calendar");
      ref.current = current;
      node.isConnected = false;
      h.activate(controls, "calendar");
      node.isConnected = true;
      for (const blocked of [{ hidden: true }, { inert: true }]) {
        node.closest.mockReturnValue(blocked);
        h.activate(controls, "calendar");
      }
      node.closest.mockReturnValue(null);
      node.getClientRects.mockReturnValue([]);
      h.activate(controls, "calendar");
      expect(h.nodes.calendar.focus).not.toHaveBeenCalled();
      expect(h.nodes.calendar.scrollIntoView).not.toHaveBeenCalled();
    },
  );

  it("refuses a false current guard, foreign heading, changed id or CSS-hidden heading", () => {
    const h = harness();
    let allowed = false;
    const controls = h.render({ ...h.props, isCurrent: () => allowed });
    h.activate(controls, "calendar");
    allowed = true;
    h.container.contains.mockReturnValue(false);
    h.activate(controls, "calendar");
    h.container.contains.mockReturnValue(true);
    h.nodes.calendar.id = "foreign-heading";
    h.activate(controls, "calendar");
    h.nodes.calendar.id = h.targets.calendar.id;
    h.document.defaultView.getComputedStyle.mockReturnValue({
      visibility: "hidden",
    });
    h.activate(controls, "calendar");
    expect(h.nodes.calendar.focus).not.toHaveBeenCalled();
    expect(h.nodes.calendar.scrollIntoView).not.toHaveBeenCalled();
  });

  it.each([
    "guard",
    "unmount",
    "target ref",
    "container ref",
    "focus moved",
  ] as const)("does not scroll when focus changes %s", (change) => {
    const h = harness();
    let current = true;
    const controls = h.render({ ...h.props, isCurrent: () => current });
    h.nodes.calendar.focus.mockImplementation(() => {
      h.document.activeElement = h.nodes.calendar;
      if (change === "guard") current = false;
      if (change === "unmount") hooks.cleanup?.();
      if (change === "target ref")
        h.targets.calendar.ref.current = h.nodes
          .board as unknown as HTMLHeadingElement;
      if (change === "container ref")
        h.props.containerRef.current = h.nodes.board as unknown as HTMLElement;
      if (change === "focus moved") h.document.activeElement = h.nodes.board;
    });
    h.activate(controls, "calendar");
    expect(h.nodes.calendar.focus).toHaveBeenCalledOnce();
    expect(h.nodes.calendar.scrollIntoView).not.toHaveBeenCalled();
  });
});
