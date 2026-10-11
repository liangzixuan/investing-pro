import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WatchlistMembership } from "@research-cockpit/contracts";
import {
  ManagedWatchlistEditor,
  type ManagedWatchlistEditorHandle,
  type ManagedWatchlistEditorProps,
} from "./ManagedWatchlistEditor";
import { ManagedNoteEditor } from "./ManagedNoteEditor";

// Exercise the actual selection and commit-time focus guards with an invented DOM.
const hooks = vi.hoisted(() => ({
  state: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  stateIndex: 0,
  refIndex: 0,
  effects: [] as Array<() => void>,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.state)) hooks.state[index] = initial;
    return [
      hooks.state[index],
      (value: unknown) => (hooks.state[index] = value),
    ];
  },
  useRef: (initial: unknown) =>
    (hooks.refs[hooks.refIndex++] ??= { current: initial }),
  useEffect: (effect: () => void) => hooks.effects.push(effect),
  useLayoutEffect: (effect: () => void) => hooks.effects.push(effect),
  useImperativeHandle: (ref: { current: unknown }, create: () => unknown) =>
    hooks.effects.push(() => {
      ref.current = create();
    }),
}));

beforeEach(() => {
  hooks.state = [];
  hooks.refs = [];
  hooks.effects = [];
});

function member(
  listingId: string,
  symbol: string,
  note: string,
): WatchlistMembership {
  return {
    listingId,
    symbol,
    note,
    issuerId: `issuer-${listingId}`,
    issuerName: `Invented ${symbol}`,
    securityId: `security-${listingId}`,
    securityName: `Invented ${symbol} ordinary shares`,
    shareClassId: `class-${listingId}`,
    shareClassName: "Class A",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    country: "US",
  };
}

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

function fixture() {
  const ref = { current: null as ManagedWatchlistEditorHandle | null };
  let props: ManagedWatchlistEditorProps = {
    memberships: [
      member("one", "ALFA", "Keep first draft"),
      member("two", "BETA", "Second\nnote is invalid"),
    ],
    editable: true,
    active: true,
    canOpenAnnual: () => true,
    canOpenEod: () => true,
    onNote: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    onOpenAnnual: vi.fn(),
    onOpenEod: vi.fn(),
    ref,
  };
  const focus = vi.fn();
  const field = {
    isConnected: true,
    disabled: false,
    dataset: { managedNoteListingId: "" },
    value: "",
    getClientRects: () => [{}],
    focus,
  };
  const selectionFocus = vi.fn();
  const emptyFocus = vi.fn();
  let current: ReturnType<typeof elements> = [];
  const render = (changes: Partial<ManagedWatchlistEditorProps> = {}) => {
    props = { ...props, ...changes };
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    hooks.effects = [];
    current = elements(ManagedWatchlistEditor(props));
    const note = current.find((element) => element.type === ManagedNoteEditor);
    const listingId = note?.props.listingId;
    const noteValue = note?.props.note;
    field.dataset.managedNoteListingId =
      typeof listingId === "string" ? listingId : "";
    field.value = typeof noteValue === "string" ? noteValue : "";
    field.disabled = Boolean(note?.props.disabled);
    hooks.refs[0]!.current = {
      isConnected: true,
      querySelector: (selector: string) =>
        selector.startsWith("textarea")
          ? field
          : {
              isConnected: true,
              getClientRects: () => [{}],
              focus: emptyFocus,
            },
      querySelectorAll: () =>
        props.memberships.map((entry) => ({
          dataset: { watchlistSelection: entry.listingId },
          isConnected: true,
          getClientRects: () => [{}],
          focus: selectionFocus,
        })),
    };
    return current;
  };
  const commit = () => {
    for (const effect of hooks.effects) effect();
  };
  const click = (label: string, opener = {} as HTMLButtonElement) => {
    const button = current.find(
      (element) => element.props["aria-label"] === label,
    );
    expect(button?.type).toBe("button");
    (
      button!.props.onClick as (event: {
        currentTarget: HTMLButtonElement;
      }) => void
    )({ currentTarget: opener });
  };
  render();
  commit();
  return {
    ref,
    props,
    field,
    focus,
    selectionFocus,
    emptyFocus,
    render,
    commit,
    click,
  };
}

describe("ManagedWatchlistEditor", () => {
  it("selects one exact listing without copying or changing its shared draft", () => {
    const f = fixture();
    f.click("Edit research note for BETA, Class A, XNAS");
    const output = f.render();
    f.commit();
    const notes = output.filter(
      (element) => element.type === ManagedNoteEditor,
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]!.props).toMatchObject({
      listingId: "two",
      id: "managed-note-1",
      note: "Second\nnote is invalid",
    });
    expect(f.props.onNote).not.toHaveBeenCalled();
    expect(f.focus).not.toHaveBeenCalled();
    (notes[0]!.props.onChange as (value: string) => void)("  Raw draft  ");
    expect(f.props.onNote).toHaveBeenCalledWith("two", "  Raw draft  ");
    expect(
      output.filter((element) => element.props["data-watchlist-selection"]),
    ).toHaveLength(2);
  });

  it("reveals the first hidden invalid note, then focuses its current textarea", () => {
    const f = fixture();
    f.ref.current!.focusFirstInvalidNote();
    expect(f.focus).not.toHaveBeenCalled();
    f.render();
    f.commit();
    expect(f.field.dataset.managedNoteListingId).toBe("two");
    expect(f.field.value).toBe("Second\nnote is invalid");
    expect(f.focus).toHaveBeenCalledOnce();
    expect(f.props.onNote).not.toHaveBeenCalled();
  });

  it.each([
    "inactive",
    "disabled",
    "changed",
    "removed",
    "hidden",
    "disconnected",
  ] as const)(
    "cancels pending invalid-note focus when the target becomes %s",
    (change) => {
      const f = fixture();
      f.ref.current!.focusFirstInvalidNote();
      const changes: Partial<ManagedWatchlistEditorProps> = {};
      if (change === "inactive") changes.active = false;
      if (change === "disabled") changes.editable = false;
      if (change === "changed")
        changes.memberships = [
          f.props.memberships[0]!,
          { ...f.props.memberships[1]!, note: "Different\ninvalid draft" },
        ];
      if (change === "removed") changes.memberships = [f.props.memberships[0]!];
      f.render(changes);
      if (change === "hidden") f.field.getClientRects = () => [];
      if (change === "disconnected") f.field.isConnected = false;
      f.commit();
      expect(f.focus).not.toHaveBeenCalled();
    },
  );

  it("does not queue focus while the editor is inactive", () => {
    const f = fixture();
    f.render({ active: false });
    f.commit();
    f.ref.current!.focusFirstInvalidNote();
    f.render({ active: true });
    f.commit();
    expect(f.focus).not.toHaveBeenCalled();
    expect(f.field.dataset.managedNoteListingId).toBe("one");
  });

  it("forwards the exact selected object and opener for research and retains selection through reorder", () => {
    const f = fixture();
    f.click("Edit research note for BETA, Class A, XNAS");
    f.render();
    f.commit();
    const opener = {} as HTMLButtonElement;
    f.click("Annual report for saved BETA", opener);
    f.click("EOD close history for saved BETA", opener);
    expect(f.props.onOpenAnnual).toHaveBeenCalledWith(
      f.props.memberships[1],
      opener,
    );
    expect(f.props.onOpenEod).toHaveBeenCalledWith(
      f.props.memberships[1],
      opener,
    );
    f.click("Move BETA up");
    expect(f.props.onMove).toHaveBeenCalledWith("two", -1);
    f.render({ memberships: [...f.props.memberships].reverse() });
    f.commit();
    expect(f.field.dataset.managedNoteListingId).toBe("two");
    expect(f.focus).not.toHaveBeenCalled();
  });

  it("moves keyboard focus to the retained listing after removal", () => {
    const f = fixture();
    f.click("Remove ALFA");
    expect(f.props.onRemove).toHaveBeenCalledWith("one");
    f.render({ memberships: [f.props.memberships[1]!] });
    f.commit();
    expect(f.field.dataset.managedNoteListingId).toBe("two");
    expect(f.selectionFocus).toHaveBeenCalledOnce();
  });

  it("retains the initially selected listing when it moves down", () => {
    const f = fixture();
    f.click("Move ALFA down");
    expect(f.props.onMove).toHaveBeenCalledWith("one", 1);
    f.render({ memberships: [...f.props.memberships].reverse() });
    f.commit();
    expect(f.field.dataset.managedNoteListingId).toBe("one");
    expect(f.focus).not.toHaveBeenCalled();
  });

  it("focuses the empty-state message after removing the last listing", () => {
    const f = fixture();
    f.render({ memberships: [f.props.memberships[0]!] });
    f.commit();
    f.click("Remove ALFA");
    f.render({ memberships: [] });
    f.commit();
    expect(f.emptyFocus).toHaveBeenCalledOnce();
    expect(f.focus).not.toHaveBeenCalled();
  });

  it("keeps edit and research availability separate", () => {
    const f = fixture();
    const output = f.render({ editable: false, canOpenAnnual: () => false });
    f.commit();
    const note = output.find((element) => element.type === ManagedNoteEditor);
    expect(note?.props.disabled).toBe(true);
    expect(
      output.find(
        (element) =>
          element.props["aria-label"] === "Annual report for saved ALFA",
      )?.props.disabled,
    ).toBe(true);
    expect(
      output.find(
        (element) =>
          element.props["aria-label"] === "EOD close history for saved ALFA",
      )?.props.disabled,
    ).toBe(false);
    expect(
      output.find((element) => element.props["aria-label"] === "Move ALFA down")
        ?.props.disabled,
    ).toBe(true);
  });
});
