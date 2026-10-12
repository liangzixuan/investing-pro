import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => vi.unstubAllGlobals());

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
    ...(typeof node.type === "function" && node.type !== ManagedNoteEditor
      ? elements(
          (node.type as (props: Record<string, unknown>) => React.ReactNode)(
            node.props,
          ),
        )
      : []),
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}

const choices = (output: ReturnType<typeof elements>) =>
  output.flatMap((entry) =>
    typeof entry.props["data-watchlist-selection"] === "string"
      ? [entry.props["data-watchlist-selection"]]
      : [],
  );
const searchValue = (output: ReturnType<typeof elements>) =>
  output.find((entry) => entry.props.id === "managed-watchlist-search")?.props
    .value;
function textContent(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  return React.isValidElement<{ children?: React.ReactNode }>(node)
    ? textContent(node.props.children)
    : "";
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
  const searchFocus = vi.fn();
  const searchField = {
    isConnected: true,
    disabled: false,
    getClientRects: () => [{}],
    focus: searchFocus,
  };
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
          : selector === "[data-watchlist-search]"
            ? searchField
            : {
                isConnected: true,
                getClientRects: () => [{}],
                focus: emptyFocus,
              },
      querySelectorAll: () =>
        current
          .filter((entry) => entry.props["data-watchlist-selection"])
          .map((entry) => ({
            dataset: {
              watchlistSelection: entry.props["data-watchlist-selection"],
            },
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
  const search = (value: string) => {
    const input = current.find(
      (entry) => entry.props.id === "managed-watchlist-search",
    )!;
    (input.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value },
    });
    return render();
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
    searchFocus,
    searchField,
    search,
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
    expect(choices(f.search("ALFA"))).toEqual(["one"]);
    f.ref.current!.focusFirstInvalidNote();
    expect(f.focus).not.toHaveBeenCalled();
    const output = f.render();
    f.commit();
    expect(searchValue(output)).toBe("");
    expect(choices(output)).toEqual(["one", "two"]);
    expect(f.field.dataset.managedNoteListingId).toBe("two");
    expect(f.field.value).toBe("Second\nnote is invalid");
    expect(f.focus).toHaveBeenCalledOnce();
    expect(f.props.onNote).not.toHaveBeenCalled();
  });

  it("matches a normalized phrase within each identity field and keeps share classes distinct", () => {
    const f = fixture();
    const common = { issuerName: "Nova   Group", exchangeMic: "XNYS" };
    const memberships = [
      { ...member("one", "NOVA", "private needle"), ...common },
      {
        ...member("two", "NOVC", "second"),
        ...common,
        shareClassName: "Class C",
      },
      member("three", "ELSE", "third"),
    ];
    f.render({ memberships });
    for (const [query, expected] of [
      ["  NoVa  GROUP ", ["one", "two"]],
      ["  class   a ", ["one", "three"]],
      ["CLASS C", ["two"]],
      ["novc", ["two"]],
      [" xnyS ", ["one", "two"]],
      ["nova class c", []],
      ["private needle", []],
      ["ordinary shares", []],
      ["issuer-one", []],
    ] as const) {
      expect(choices(f.search(query))).toEqual(expected);
    }
    expect(memberships.map((entry) => entry.note)).toEqual([
      "private needle",
      "second",
      "third",
    ]);
    expect(f.props.onNote).not.toHaveBeenCalled();
  });

  it("keeps the exact selected raw note and full index outside a filter, including no results", () => {
    const f = fixture();
    f.click("Edit research note for BETA, Class A, XNAS");
    for (const query of ["ALFA", "no matches"]) {
      const output = f.search(query);
      const note = output.find((entry) => entry.type === ManagedNoteEditor)!;
      expect(note.props).toMatchObject({
        listingId: "two",
        id: "managed-note-1",
        note: "Second\nnote is invalid",
      });
      expect(
        output.some((entry) =>
          textContent(entry).includes("Selected BETA is outside this search."),
        ),
      ).toBe(true);
      expect(choices(output)).toEqual(query === "ALFA" ? ["one"] : []);
      const count = output.find(
        (entry) => entry.props.id === "managed-watchlist-search-count",
      )!;
      expect(textContent(count)).toBe(
        `${query === "ALFA" ? 1 : 0} of 2 listings`,
      );
    }
    for (const handler of [
      f.props.onNote,
      f.props.onMove,
      f.props.onRemove,
      f.props.onOpenAnnual,
      f.props.onOpenEod,
    ])
      expect(handler).not.toHaveBeenCalled();
    const show = f
      .render()
      .find(
        (entry) =>
          entry.type === "button" &&
          textContent(entry) === "Show selected listing",
      )!;
    (show.props.onClick as () => void)();
    expect(searchValue(f.render())).toBe("");
    expect(f.searchFocus).toHaveBeenCalledOnce();
    expect(f.field.dataset.managedNoteListingId).toBe("two");
  });

  it("guards full-order moves while filtered, treats whitespace as empty and clears to the search field", () => {
    const f = fixture();
    const output = f.search("ALFA");
    for (const label of ["Move ALFA up", "Move ALFA down"]) {
      expect(
        output.find((entry) => entry.props["aria-label"] === label)?.props
          .disabled,
      ).toBe(true);
      f.click(label);
    }
    expect(f.props.onMove).not.toHaveBeenCalled();
    const whitespace = f.search("  \t ");
    expect(choices(whitespace)).toEqual(["one", "two"]);
    expect(
      whitespace.find((entry) => entry.props["aria-label"] === "Move ALFA down")
        ?.props.disabled,
    ).toBe(false);
    f.click("Move ALFA down");
    expect(f.props.onMove).toHaveBeenCalledWith("one", 1);
    f.click("Clear watchlist search");
    expect(searchValue(f.render())).toBe("");
    expect(f.searchFocus).toHaveBeenCalledOnce();
  });

  it("retains query and explicit selection while inactive, then starts a new editor without a query", () => {
    const f = fixture();
    f.search("BETA");
    f.click("Edit research note for BETA, Class A, XNAS");
    f.render({ active: false });
    f.commit();
    const returned = f.render({ active: true });
    expect(searchValue(returned)).toBe("BETA");
    expect(f.field.dataset.managedNoteListingId).toBe("two");
    hooks.state = [];
    hooks.refs = [];
    const fresh = fixture();
    expect(searchValue(fresh.render())).toBe("");
    expect(fresh.field.dataset.managedNoteListingId).toBe("one");
  });

  it.each(["first", "middle", "last", "outside"] as const)(
    "removes the %s selection and focuses the next match, prior match or first match when outside",
    (position) => {
      const f = fixture();
      const memberships = [
        member("one", "MATCH1", "one"),
        member("hidden", "OTHER", "keep hidden"),
        member("two", "MATCH2", "two"),
        member("three", "MATCH3", "three"),
      ];
      f.render({ memberships });
      const selected = {
        first: memberships[0]!,
        middle: memberships[2]!,
        last: memberships[3]!,
        outside: memberships[1]!,
      }[position];
      f.click(`Edit research note for ${selected.symbol}, Class A, XNAS`);
      f.search("MATCH");
      f.click(`Remove ${selected.symbol}`);
      const output = f.render({
        memberships: memberships.filter((entry) => entry !== selected),
      });
      f.commit();
      expect(f.field.dataset.managedNoteListingId).toBe(
        { first: "two", middle: "three", last: "two", outside: "one" }[
          position
        ],
      );
      expect(f.selectionFocus).toHaveBeenCalledOnce();
      expect(searchValue(output)).toBe("MATCH");
      expect(f.props.onRemove).toHaveBeenCalledWith(selected.listingId);
      expect(f.props.onNote).not.toHaveBeenCalled();
    },
  );

  it("focuses the persistent search when the last match is removed and keeps hidden membership bytes", () => {
    const f = fixture();
    f.search("ALFA");
    f.click("Remove ALFA");
    const output = f.render({ memberships: [f.props.memberships[1]!] });
    f.commit();
    expect(choices(output)).toEqual([]);
    expect(searchValue(output)).toBe("ALFA");
    expect(f.searchFocus).toHaveBeenCalledOnce();
    expect(f.emptyFocus).not.toHaveBeenCalled();
    expect(f.field.value).toBe("Second\nnote is invalid");
  });

  it.each([
    "failed",
    "query",
    "selection",
    "inactive",
    "disabled",
    "other focus",
  ] as const)(
    "consumes removal focus without stealing focus after %s",
    (change) => {
      const f = fixture();
      const origin = {};
      const page = { activeElement: origin, body: {} };
      vi.stubGlobal("document", page);
      f.click("Remove ALFA");
      if (change === "query") f.search("BETA");
      if (change === "selection")
        f.click("Edit research note for BETA, Class A, XNAS");
      if (change === "other focus") page.activeElement = {};
      f.render({
        memberships:
          change === "failed" ? f.props.memberships : [f.props.memberships[1]!],
        active: change !== "inactive",
        editable: change !== "disabled",
      });
      f.commit();
      expect(f.selectionFocus).not.toHaveBeenCalled();
      page.activeElement = origin;
      f.render({
        memberships: [f.props.memberships[1]!],
        active: true,
        editable: true,
      });
      f.commit();
      expect(f.selectionFocus).not.toHaveBeenCalled();
    },
  );

  it("does not reclaim focus for correction after another visible control receives it", () => {
    const f = fixture();
    const origin = {};
    const page = { activeElement: origin, body: {} };
    vi.stubGlobal("document", page);
    f.search("ALFA");
    f.ref.current!.focusFirstInvalidNote();
    page.activeElement = {};
    f.render();
    f.commit();
    expect(f.focus).not.toHaveBeenCalled();
    page.activeElement = origin;
    f.render();
    f.commit();
    expect(f.focus).not.toHaveBeenCalled();
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
