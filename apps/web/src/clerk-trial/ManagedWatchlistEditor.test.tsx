import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WatchlistMembership } from "@research-cockpit/contracts";
import {
  ManagedWatchlistEditor,
  type ManagedWatchlistEditorHandle,
  type ManagedWatchlistEditorProps,
  type ManagedWatchlistNoteReviewRequest,
} from "./ManagedWatchlistEditor";
import { ManagedNoteEditor } from "./ManagedNoteEditor";
import { ManagedWatchlistComparison } from "./ManagedWatchlistComparison";
import { ManagedWatchlistFilings } from "./ManagedWatchlistFilings";
import { ManagedWatchlistFilings as FilingsModel } from "./managed-watchlist-filings";
import { ManagedEodHistory } from "./managed-eod-history";
import { eodResponse, eodSelection } from "./eod-history-fixture";

// Exercise the actual selection and commit-time focus guards with an invented DOM.
const hooks = vi.hoisted(() => ({
  state: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  stateIndex: 0,
  refIndex: 0,
  effects: [] as Array<() => void | (() => void)>,
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
    ...(typeof node.type === "function" &&
    node.type !== ManagedNoteEditor &&
    node.type !== ManagedWatchlistFilings &&
    node.type !== ManagedWatchlistComparison
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
const scopeValue = (output: ReturnType<typeof elements>) =>
  output.find((entry) => entry.props.id === "managed-watchlist-search-scope")
    ?.props.value;
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
    filings: new FilingsModel(vi.fn(), vi.fn()),
    onSelectedMember: vi.fn(),
    onViewFilings: vi.fn(),
    comparisonNoteActions: {
      getAction: vi.fn(() => ({ canAppend: false, reason: "Choose a note." })),
      append: vi.fn(() => ({ appended: false, message: "Choose a note." })),
    },
    prices: {
      active: true,
      canRead: true,
      rows: [],
      pending: null,
      catalogChanged: false,
    },
    onLoadPrice: vi.fn(),
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
  const summaryFocus = vi.fn(() => {
    const page = document as unknown as { activeElement: unknown };
    page.activeElement = summary;
  });
  const summary = {
    isConnected: true,
    getClientRects: () => [{}],
    focus: summaryFocus,
    scrollIntoView: vi.fn(),
  };
  const reader = {
    isConnected: true,
    open: false,
    getClientRects: () => [{}],
    querySelector: () => summary,
  };
  const panel = {
    isConnected: true,
    getClientRects: () => [{}],
    querySelector: (selector: string) =>
      selector.startsWith("textarea")
        ? field
        : selector === "[data-watchlist-search]"
          ? searchField
          : selector ===
              "#managed-watchlist-selected-note .managed-note-reading"
            ? reader
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
    hooks.refs[0]!.current = panel;
    return current;
  };
  let cleanups: Array<() => void> = [];
  const commit = () => {
    cleanups = hooks.effects.flatMap((effect) => {
      const cleanup = effect();
      return cleanup ? [cleanup] : [];
    });
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
  const scope = (value: string) => {
    const select = current.find(
      (entry) => entry.props.id === "managed-watchlist-search-scope",
    );
    expect(select?.type).toBe("select");
    (select!.props.onChange as (event: { target: { value: string } }) => void)({
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
    panel,
    reader,
    summary,
    summaryFocus,
    unmount: () => cleanups.forEach((cleanup) => cleanup()),
    focus,
    selectionFocus,
    emptyFocus,
    searchFocus,
    searchField,
    search,
    scope,
    render,
    commit,
    click,
  };
}

describe("ManagedWatchlistEditor", () => {
  it("describes each matching listing with its exact raw note context beside the unchanged price description", () => {
    const f = fixture();
    const memberships = [
      member("one", "ALFA", "Company draft captured in research"),
      member("two", "BETA", "  Captured\nIN research <b>raw</b>  "),
      member("three", "HIDDEN", "Hidden complete note"),
    ];
    f.render({ memberships });
    f.search("CAPTURED in research");
    const output = f.scope("notes");
    expect(choices(output)).toEqual(["one", "two"]);
    for (const selected of memberships.slice(0, 2)) {
      const choice = output.find(
        (entry) =>
          entry.props["data-watchlist-selection"] === selected.listingId,
      )!;
      const context = output.find(
        (entry) =>
          entry.props["data-watchlist-note-context"] === selected.listingId,
      )!;
      expect(choice.props["aria-label"]).toBe(
        `Edit research note for ${selected.symbol}, Class A, XNAS`,
      );
      expect(choice.props["aria-describedby"]).toBe(
        `managed-watchlist-price-${selected.listingId} managed-watchlist-note-context-${selected.listingId}`,
      );
      expect(context.props.id).toBe(
        `managed-watchlist-note-context-${selected.listingId}`,
      );
      expect(textContent(context)).toBe(`Note: ${selected.note}`);
      expect(context.props.dangerouslySetInnerHTML).toBeUndefined();
    }
    const raw = output.find(
      (entry) => entry.props["data-watchlist-note-context"] === "two",
    )!;
    expect(renderToStaticMarkup(raw)).toContain("&lt;b&gt;raw&lt;/b&gt;");
    expect(
      output.some((entry) => textContent(entry) === "Note needs correction"),
    ).toBe(true);
    expect(
      output.find((entry) => entry.type === ManagedWatchlistComparison)?.props
        .memberships,
    ).toBe(memberships);
    expect(
      output.find((entry) => entry.type === ManagedNoteEditor)?.props.note,
    ).toBe(memberships[0]!.note);
    for (const handler of [
      f.props.onNote,
      f.props.onMove,
      f.props.onRemove,
      f.props.onLoadPrice,
      f.props.onViewFilings,
      f.props.onOpenAnnual,
      f.props.onOpenEod,
    ])
      expect(handler).not.toHaveBeenCalled();
  });

  it("omits note context and its description for empty queries, identity scope and retired membership bytes", () => {
    const f = fixture();
    f.scope("notes");
    expect(
      f
        .search("Keep")
        .some((entry) => entry.props["data-watchlist-note-context"]),
    ).toBe(true);
    for (const output of [
      f.search(" \t "),
      f.search(""),
      f.scope("identity"),
      f.search("ALFA"),
      f.render({ memberships: [] }),
    ]) {
      expect(
        output.some((entry) => entry.props["data-watchlist-note-context"]),
      ).toBe(false);
      for (const choice of output.filter(
        (entry) => entry.props["data-watchlist-selection"],
      ))
        expect(choice.props["aria-describedby"]).toBe(
          `managed-watchlist-price-${String(choice.props["data-watchlist-selection"])}`,
        );
    }
  });

  it("updates context from the current draft while keeping selection, field focus and complete raw note intent", () => {
    const f = fixture();
    f.scope("notes");
    const before = f.search("Keep");
    const note = before.find((entry) => entry.type === ManagedNoteEditor)!;
    const page = { activeElement: f.field, body: {} };
    vi.stubGlobal("document", page);
    const raw = `Keep latest ${"exact 🧭 ".repeat(40)} ending`;
    (note.props.onChange as (value: string) => void)(raw);
    expect(f.props.onNote).toHaveBeenCalledExactlyOnceWith("one", raw);
    const memberships = [
      { ...f.props.memberships[0]!, note: raw },
      f.props.memberships[1]!,
    ];
    const output = f.render({ memberships });
    f.commit();
    const context = output.find(
      (entry) => entry.props["data-watchlist-note-context"] === "one",
    )!;
    expect(textContent(context)).toBe(
      `Note: ${Array.from(raw).slice(0, 180).join("")}…`,
    );
    expect(
      output.find((entry) => entry.type === ManagedNoteEditor)?.props.note,
    ).toBe(raw);
    expect(output.find((entry) => entry.type === ManagedNoteEditor)?.key).toBe(
      note.key,
    );
    expect(
      output.find((entry) => entry.type === ManagedWatchlistComparison)?.props
        .memberships,
    ).toBe(memberships);
    expect(memberships[1]).toBe(f.props.memberships[1]);
    expect(page.activeElement).toBe(f.field);
    expect(f.focus).not.toHaveBeenCalled();
    expect(f.props.onLoadPrice).not.toHaveBeenCalled();
    expect(f.props.onViewFilings).not.toHaveBeenCalled();
  });

  it("publishes only committed selected detail and forwards its filings owner without loading or changing notes", () => {
    const f = fixture();
    expect(f.props.onSelectedMember).toHaveBeenLastCalledWith(
      f.props.memberships[0],
    );
    const calls = vi.mocked(f.props.onSelectedMember).mock.calls.length;
    f.click("Edit research note for BETA, Class A, XNAS");
    const output = f.render();
    expect(vi.mocked(f.props.onSelectedMember).mock.calls).toHaveLength(calls);
    const filings = output.find(
      (entry) => entry.type === ManagedWatchlistFilings,
    )!;
    expect(filings.props).toMatchObject({
      selected: f.props.memberships[1],
      model: f.props.filings,
      active: true,
      onViewFilings: f.props.onViewFilings,
    });
    f.commit();
    expect(f.props.onSelectedMember).toHaveBeenLastCalledWith(
      f.props.memberships[1],
    );
    expect(f.props.onNote).not.toHaveBeenCalled();
    expect(f.props.onLoadPrice).not.toHaveBeenCalled();
    expect(f.props.onViewFilings).not.toHaveBeenCalled();
    expect(f.focus).not.toHaveBeenCalled();
  });

  it("keeps filings bound to the selected editor outside search and notifies replacement, removal and empty selection", () => {
    const f = fixture();
    const output = f.search("BETA");
    expect(
      output.find((entry) => entry.type === ManagedWatchlistFilings)?.props
        .selected,
    ).toBe(f.props.memberships[0]);
    f.commit();
    const replacement = {
      ...f.props.memberships[0]!,
      shareClassName: "Class C",
    };
    f.render({ memberships: [replacement, f.props.memberships[1]!] });
    f.commit();
    expect(f.props.onSelectedMember).toHaveBeenLastCalledWith(replacement);
    f.render({ memberships: [f.props.memberships[1]!] });
    f.commit();
    expect(f.props.onSelectedMember).toHaveBeenLastCalledWith(
      f.props.memberships[1],
    );
    f.render({ memberships: [] });
    f.commit();
    expect(f.props.onSelectedMember).toHaveBeenLastCalledWith(null);
    expect(f.props.onNote).not.toHaveBeenCalled();
    expect(f.props.onViewFilings).not.toHaveBeenCalled();
  });

  it("keeps the full comparison cohort available through search and edit locks", () => {
    const f = fixture();
    const filtered = f.search("BETA");
    expect(choices(filtered)).toEqual(["two"]);
    const comparison = filtered.find(
      (entry) => entry.type === ManagedWatchlistComparison,
    )!;
    expect(comparison.props.memberships).toBe(f.props.memberships);
    expect(comparison.props.prices).toBe(f.props.prices);
    expect(comparison.props.active).toBe(true);
    expect(comparison.props.editable).toBe(true);
    expect(comparison.props.comparisonNoteActions).toBe(
      f.props.comparisonNoteActions,
    );
    const locked = f.render({ editable: false });
    expect(
      locked.find((entry) => entry.type === ManagedWatchlistComparison)?.props,
    ).toMatchObject({
      memberships: f.props.memberships,
      prices: f.props.prices,
      active: true,
      editable: false,
      comparisonNoteActions: f.props.comparisonNoteActions,
    });
    const hidden = f.render({ active: false });
    expect(
      hidden.find((entry) => entry.type === ManagedWatchlistComparison)?.props
        .active,
    ).toBe(false);
    expect(f.props.onLoadPrice).not.toHaveBeenCalled();
    expect(f.props.comparisonNoteActions.append).not.toHaveBeenCalled();
    expect(f.props.onNote).not.toHaveBeenCalled();
    expect(f.props.onMove).not.toHaveBeenCalled();
    expect(f.props.onRemove).not.toHaveBeenCalled();
  });

  it("keeps exact price readouts with their identity while search and note selection make no load", () => {
    const f = fixture();
    const first = f.props.memberships[0]!;
    const model = new ManagedEodHistory(vi.fn(), vi.fn(), undefined, [first]);
    model.open(
      { ...eodSelection, origin: "watchlist", listing: first },
      {
        response: { ...eodResponse(), security: first },
        showingPrevious: true,
      },
    );
    const handle = Symbol("first");
    const prices = {
      active: true,
      canRead: true,
      rows: [{ handle, listing: first, history: model.getSnapshot() }],
      pending: null,
      catalogChanged: false,
    };
    const output = f.render({ prices });
    const choice = output.find(
      (entry) => entry.props["data-watchlist-selection"] === first.listingId,
    )!;
    expect(choice.props["aria-describedby"]).toBe(
      "managed-watchlist-price-one",
    );
    expect(
      output.some((entry) => entry.props.id === "managed-watchlist-price-one"),
    ).toBe(true);
    const searched = f.search("BETA");
    expect(choices(searched)).toEqual(["two"]);
    expect(
      searched.some(
        (entry) => entry.props.id === "managed-watchlist-selected-price",
      ),
    ).toBe(true);
    expect(
      searched.find((entry) => entry.type === ManagedNoteEditor)?.props.note,
    ).toBe(first.note);
    f.click("Edit research note for BETA, Class A, XNAS");
    const second = f.render();
    expect(
      second.find((entry) => entry.type === ManagedNoteEditor)?.props.note,
    ).toBe(f.props.memberships[1]!.note);
    expect(f.props.onLoadPrice).not.toHaveBeenCalled();
    expect(f.props.onNote).not.toHaveBeenCalled();
  });

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

  it("searches complete raw notes only in the labelled notes scope without rewriting them", () => {
    const f = fixture();
    const memberships = [
      {
        ...member("one", "NOVA", "Private\n\tRESEARCH — 東京 🧭"),
        issuerName: "Nova Group",
      },
      {
        ...member("two", "NOVC", "  private research café  "),
        issuerName: "Nova Group",
        shareClassName: "Class C",
      },
      member("three", "LONG", `${"x".repeat(4_000)} final needle`),
      member("four", "EMPTY", ""),
    ];
    const original = structuredClone(memberships);
    const initial = f.render({ memberships });
    expect(scopeValue(initial)).toBe("identity");
    expect(
      initial.find(
        (entry) => entry.props.htmlFor === "managed-watchlist-search-scope",
      )?.props.children,
    ).toBe("Search in");
    expect(choices(f.search("  PRIVATE   research "))).toEqual([]);
    const notes = f.scope("notes");
    expect(searchValue(notes)).toBe("  PRIVATE   research ");
    expect(choices(notes)).toEqual(["one", "two"]);
    expect(
      textContent(
        notes.find(
          (entry) => entry.props.id === "managed-watchlist-search-help",
        ),
      ),
    ).toBe(
      "Complete research notes, including unsaved changes. Searches this draft only.",
    );
    for (const [query, expected] of [
      ["東京 🧭", ["one"]],
      ["CAFÉ", ["two"]],
      ["final needle", ["three"]],
      ["Nova Group", []],
      ["Class C", []],
      ["XNAs", []],
      ["private café", []],
      ["  \t ", ["one", "two", "three", "four"]],
    ] as const)
      expect(choices(f.search(query))).toEqual(expected);
    expect(memberships).toEqual(original);
    for (const handler of [
      f.props.onNote,
      f.props.onMove,
      f.props.onRemove,
      f.props.onLoadPrice,
      f.props.onOpenAnnual,
      f.props.onOpenEod,
    ])
      expect(handler).not.toHaveBeenCalled();
  });

  it("keeps the selected note mounted when typing removes its note match", () => {
    const f = fixture();
    f.scope("notes");
    const before = f
      .search("Keep first")
      .find((entry) => entry.type === ManagedNoteEditor)!;
    const page = { activeElement: f.field, body: {} };
    vi.stubGlobal("document", page);
    const changed = "Revised unsaved note — 東京 🧭";
    (before.props.onChange as (note: string) => void)(changed);
    expect(f.props.onNote).toHaveBeenCalledExactlyOnceWith("one", changed);
    const memberships = [
      { ...f.props.memberships[0]!, note: changed },
      f.props.memberships[1]!,
    ];
    const output = f.render({ memberships });
    f.commit();
    const after = output.find((entry) => entry.type === ManagedNoteEditor)!;
    expect(after.type).toBe(before.type);
    expect(after.key).toBe(before.key);
    expect(after.props).toMatchObject({
      id: "managed-note-0",
      listingId: "one",
      note: changed,
    });
    expect(choices(output)).toEqual([]);
    expect(
      output.some((entry) => entry.props["data-watchlist-note-context"]),
    ).toBe(false);
    expect(
      textContent(
        output.find(
          (entry) => entry.props.className === "managed-watchlist-no-matches",
        ),
      ),
    ).toBe("No research notes match this search.");
    expect(
      output.some((entry) =>
        textContent(entry).includes("Selected ALFA is outside this search."),
      ),
    ).toBe(true);
    expect(page.activeElement).toBe(f.field);
    expect(f.focus).not.toHaveBeenCalled();
    expect(f.searchFocus).not.toHaveBeenCalled();
    expect(f.selectionFocus).not.toHaveBeenCalled();
    expect(
      output.find((entry) => entry.type === ManagedWatchlistComparison)?.props
        .memberships,
    ).toBe(memberships);
    expect(f.props.onLoadPrice).not.toHaveBeenCalled();
  });

  it.each(["Clear", "Show selected listing"])(
    "%s clears only the query in notes scope",
    (action) => {
      const f = fixture();
      f.scope("notes");
      const output = f.search("no match");
      const button = output.find(
        (entry) => entry.type === "button" && textContent(entry) === action,
      )!;
      (button.props.onClick as () => void)();
      const cleared = f.render();
      expect(scopeValue(cleared)).toBe("notes");
      expect(searchValue(cleared)).toBe("");
      expect(choices(cleared)).toEqual(["one", "two"]);
      expect(f.field.dataset.managedNoteListingId).toBe("one");
      expect(f.searchFocus).toHaveBeenCalledOnce();
    },
  );

  it("reveals a hidden invalid raw note without resetting notes scope", () => {
    const f = fixture();
    f.scope("notes");
    expect(choices(f.search("Keep first draft"))).toEqual(["one"]);
    f.ref.current!.focusFirstInvalidNote();
    const output = f.render();
    f.commit();
    expect(scopeValue(output)).toBe("notes");
    expect(searchValue(output)).toBe("");
    expect(f.field.dataset.managedNoteListingId).toBe("two");
    expect(f.field.value).toBe("Second\nnote is invalid");
    expect(f.focus).toHaveBeenCalledOnce();
    expect(f.props.onNote).not.toHaveBeenCalled();
  });

  it("lets a new scope consume pending correction focus", () => {
    const f = fixture();
    f.ref.current!.focusFirstInvalidNote();
    f.scope("notes");
    f.commit();
    expect(f.field.dataset.managedNoteListingId).toBe("two");
    expect(f.focus).not.toHaveBeenCalled();
    f.render();
    f.commit();
    expect(f.focus).not.toHaveBeenCalled();
  });

  it("keeps scope and query through edit locks and inactive visits, but resets a new editor", () => {
    const f = fixture();
    f.render({ editable: false });
    f.search("Second");
    expect(choices(f.scope("notes"))).toEqual(["two"]);
    f.click("Edit research note for BETA, Class A, XNAS");
    f.render({ active: false });
    f.scope("identity");
    f.search("ALFA");
    const returned = f.render({ active: true });
    expect(scopeValue(returned)).toBe("notes");
    expect(searchValue(returned)).toBe("Second");
    expect(f.field.dataset.managedNoteListingId).toBe("two");
    expect(scopeValue(f.scope("unexpected"))).toBe("notes");
    expect(choices(f.render())).toEqual(["two"]);
    hooks.state = [];
    hooks.refs = [];
    const fresh = fixture().render();
    expect(scopeValue(fresh)).toBe("identity");
    expect(searchValue(fresh)).toBe("");
    for (const handler of [
      f.props.onNote,
      f.props.onMove,
      f.props.onRemove,
      f.props.onLoadPrice,
    ])
      expect(handler).not.toHaveBeenCalled();
  });

  it("removes note matches in draft order and returns focus to search after the last match", () => {
    const f = fixture();
    const hidden = member("hidden", "HIDDEN", "Preserve\nraw note 東京");
    const memberships = [
      member("one", "ALFA", "research phrase"),
      hidden,
      member("two", "BETA", "RESEARCH phrase"),
    ];
    f.render({ memberships });
    f.scope("notes");
    f.search("research phrase");
    f.click("Remove ALFA");
    const afterFirst = f.render({ memberships: [hidden, memberships[2]!] });
    f.commit();
    expect(choices(afterFirst)).toEqual(["two"]);
    expect(f.field.dataset.managedNoteListingId).toBe("two");
    expect(f.selectionFocus).toHaveBeenCalledOnce();
    f.click("Remove BETA");
    const afterLast = f.render({ memberships: [hidden] });
    f.commit();
    expect(choices(afterLast)).toEqual([]);
    expect(scopeValue(afterLast)).toBe("notes");
    expect(searchValue(afterLast)).toBe("research phrase");
    expect(f.field.value).toBe(hidden.note);
    expect(f.searchFocus).toHaveBeenCalledOnce();
    expect(f.props.onRemove).toHaveBeenNthCalledWith(1, "one");
    expect(f.props.onRemove).toHaveBeenNthCalledWith(2, "two");
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
    "scope",
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
      if (change === "scope") f.scope("notes");
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

describe("exact destination note review", () => {
  function setup() {
    const f = fixture();
    const origin = {} as Element;
    const page = { activeElement: origin as unknown, body: {} };
    vi.stubGlobal("document", page);
    let live = true;
    const request: ManagedWatchlistNoteReviewRequest = {
      member: f.props.memberships[1]!,
      origin,
      isCurrent: () => live,
    };
    return {
      ...f,
      page,
      request,
      retire: () => {
        live = false;
      },
    };
  }

  it("opens the exact full invalid raw note read-only outside the retained note search, without changing draft intent", () => {
    const f = setup();
    const raw = `  Exact e\u0301 東京 🧭\n${"raw ".repeat(510)}  `;
    const target = { ...f.request.member, note: raw };
    const memberships = [f.props.memberships[0]!, target];
    f.render({ memberships, editable: false });
    f.scope("notes");
    f.search("Keep first");
    f.commit();
    const request = { ...f.request, member: target };
    expect(f.ref.current!.reviewNote(request)).toBe(true);
    expect(f.ref.current!.reviewNote(request)).toBe(false);
    expect(f.reader.open).toBe(false);
    const output = f.render();
    f.commit();
    expect(searchValue(output)).toBe("Keep first");
    expect(scopeValue(output)).toBe("notes");
    expect(choices(output)).toEqual(["one"]);
    expect(
      output.some((entry) =>
        textContent(entry).includes("Selected BETA is outside this search."),
      ),
    ).toBe(true);
    expect(
      output.find((entry) => entry.type === ManagedNoteEditor)?.props,
    ).toMatchObject({
      listingId: "two",
      note: raw,
      disabled: true,
      id: "managed-note-1",
    });
    expect(
      output.find((entry) => entry.type === ManagedWatchlistComparison)?.props
        .memberships,
    ).toBe(memberships);
    expect(f.props.onSelectedMember).toHaveBeenLastCalledWith(target);
    expect(f.reader.open).toBe(true);
    expect(f.summaryFocus).toHaveBeenCalledExactlyOnceWith({
      preventScroll: true,
    });
    expect(f.summary.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      behavior: "instant",
      block: "start",
    });
    expect(f.page.activeElement).toBe(f.summary);
    expect(f.ref.current!.reviewNote(request)).toBe(false);
    f.render();
    f.commit();
    expect(f.summaryFocus).toHaveBeenCalledOnce();
    for (const handler of [
      f.props.onNote,
      f.props.onMove,
      f.props.onRemove,
      f.props.onLoadPrice,
      f.props.onViewFilings,
      f.props.onOpenAnnual,
      f.props.onOpenEod,
      f.props.comparisonNoteActions.append,
    ])
      expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    "stale predicate",
    "copied member",
    "inactive",
    "hidden",
    "detached",
    "other focus",
    "unmounted",
  ] as const)("refuses a %s request without selecting a fallback", (change) => {
    const f = setup();
    const handle = f.ref.current!;
    let request = f.request;
    if (change === "stale predicate") f.retire();
    if (change === "copied member")
      request = { ...request, member: { ...request.member } };
    if (change === "inactive") {
      f.render({ active: false });
      f.commit();
    }
    if (change === "hidden") f.panel.getClientRects = () => [];
    if (change === "detached") f.panel.isConnected = false;
    if (change === "other focus") f.page.activeElement = {};
    if (change === "unmounted") f.unmount();
    expect(handle.reviewNote(request)).toBe(false);
    expect(f.field.dataset.managedNoteListingId).toBe("one");
    expect(f.reader.open).toBe(false);
    expect(f.summaryFocus).not.toHaveBeenCalled();
  });

  it.each([
    "retired",
    "replaced member",
    "removed member",
    "inactive",
    "hidden panel",
    "detached panel",
    "hidden reader",
    "detached reader",
    "hidden summary",
    "detached summary",
    "wrong field",
    "other focus",
    "query",
    "scope",
    "selection",
    "unmount",
  ] as const)(
    "consumes pending review after %s without opening or focusing another note",
    (change) => {
      const f = setup();
      expect(f.ref.current!.reviewNote(f.request)).toBe(true);
      const changes: Partial<ManagedWatchlistEditorProps> = {};
      if (change === "retired") f.retire();
      if (change === "replaced member")
        changes.memberships = [
          f.props.memberships[0]!,
          { ...f.request.member },
        ];
      if (change === "removed member")
        changes.memberships = [f.props.memberships[0]!];
      if (change === "inactive") changes.active = false;
      if (change === "query") f.search("ALFA");
      if (change === "scope") f.scope("notes");
      if (change === "selection")
        f.click("Edit research note for ALFA, Class A, XNAS");
      f.render(changes);
      if (change === "hidden panel") f.panel.getClientRects = () => [];
      if (change === "detached panel") f.panel.isConnected = false;
      if (change === "hidden reader") f.reader.getClientRects = () => [];
      if (change === "detached reader") f.reader.isConnected = false;
      if (change === "hidden summary") f.summary.getClientRects = () => [];
      if (change === "detached summary") f.summary.isConnected = false;
      if (change === "wrong field")
        f.field.dataset.managedNoteListingId = "one";
      if (change === "other focus") f.page.activeElement = {};
      if (change === "unmount") f.unmount();
      else f.commit();
      expect(f.reader.open).toBe(false);
      expect(f.summaryFocus).not.toHaveBeenCalled();
      expect(f.summary.scrollIntoView).not.toHaveBeenCalled();
      if (change !== "unmount") {
        f.render({ active: true });
        f.commit();
      }
      expect(f.summaryFocus).not.toHaveBeenCalled();
    },
  );

  it("uses committed members rather than an abandoned render and accepts a fresh request after the previous one was consumed", () => {
    const f = setup();
    const handle = f.ref.current!;
    const replacement = {
      ...f.request.member,
      note: "Uncommitted replacement",
    };
    f.render({ memberships: [f.props.memberships[0]!, replacement] });
    expect(handle.reviewNote({ ...f.request, member: replacement })).toBe(
      false,
    );
    f.render({ memberships: f.props.memberships });
    f.commit();
    expect(handle.reviewNote(f.request)).toBe(true);
    f.render();
    f.commit();
    const first = {
      ...f.request,
      member: f.props.memberships[0]!,
      origin: f.summary as unknown as Element,
    };
    expect(f.ref.current!.reviewNote(first)).toBe(true);
    f.render();
    f.commit();
    expect(f.field.dataset.managedNoteListingId).toBe("one");
    expect(f.summaryFocus).toHaveBeenCalledTimes(2);
    expect(f.ref.current!.reviewNote(first)).toBe(false);
  });

  it("lets the latest request own selection and allows unchanged member handles through a reorder", () => {
    const f = setup();
    expect(f.ref.current!.reviewNote(f.request)).toBe(true);
    const latest = { ...f.request, member: f.props.memberships[0]! };
    expect(f.ref.current!.reviewNote(latest)).toBe(true);
    f.render({ memberships: [...f.props.memberships].reverse() });
    f.commit();
    expect(f.field.dataset.managedNoteListingId).toBe("one");
    expect(f.field.value).toBe("Keep first draft");
    expect(f.summaryFocus).toHaveBeenCalledOnce();
  });

  it.each(["selection callback", "focus callback"] as const)(
    "checks the live predicate after a synchronous %s retires the visit",
    (phase) => {
      const f = setup();
      if (phase === "selection callback") {
        vi.mocked(f.props.onSelectedMember).mockImplementation((selected) => {
          if (selected === f.request.member) f.retire();
        });
      } else {
        f.summaryFocus.mockImplementation(() => {
          f.page.activeElement = f.summary;
          f.retire();
        });
      }
      expect(f.ref.current!.reviewNote(f.request)).toBe(true);
      f.render();
      f.commit();
      expect(f.reader.open).toBe(phase === "focus callback");
      expect(f.summaryFocus).toHaveBeenCalledTimes(
        phase === "focus callback" ? 1 : 0,
      );
      expect(f.summary.scrollIntoView).not.toHaveBeenCalled();
      expect(f.props.onNote).not.toHaveBeenCalled();
    },
  );

  it.each(["moved focus", "unmount", "hidden", "detached"] as const)(
    "does not scroll after focus synchronously causes %s",
    (change) => {
      const f = setup();
      f.summaryFocus.mockImplementation(() => {
        f.page.activeElement = f.summary;
        if (change === "moved focus") f.page.activeElement = {};
        if (change === "unmount") f.unmount();
        if (change === "hidden") f.summary.getClientRects = () => [];
        if (change === "detached") f.summary.isConnected = false;
      });
      expect(f.ref.current!.reviewNote(f.request)).toBe(true);
      f.render();
      f.commit();
      expect(f.summaryFocus).toHaveBeenCalledOnce();
      expect(f.summary.scrollIntoView).not.toHaveBeenCalled();
    },
  );
});
