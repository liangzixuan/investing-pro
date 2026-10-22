import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedEodIdentity } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ScreenShortlistWatchlistPreview } from "./managed-screen-shortlist-watchlist";
import { ManagedScreenShortlistWatchlist } from "./ManagedScreenShortlistWatchlist";
import { eodSelection } from "./eod-history-fixture";

// The real component is invoked with commit-aware hook doubles and a mocked domain.
// This checks rendered markup and callback fences, not browser layout or React scheduling.
const hooks = vi.hoisted(() => ({
  stateIndex: 0,
  refIndex: 0,
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  effects: [] as (() => (() => void) | void)[],
  cleanups: [] as (() => void)[],
  writes: 0,
}));
const domain = vi.hoisted(() => ({
  prepare: vi.fn(),
  current: vi.fn(),
  apply: vi.fn(),
}));
vi.mock("./managed-screen-shortlist-watchlist", () => ({
  prepareScreenShortlistWatchlist: domain.prepare,
  isScreenShortlistWatchlistCurrent: domain.current,
  applyScreenShortlistWatchlist: domain.apply,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => "shortlist-test",
    useState: (initial: unknown) => {
      const index = hooks.stateIndex++;
      if (!(index in hooks.states)) hooks.states[index] = initial;
      return [
        hooks.states[index],
        (value: unknown) => {
          hooks.writes++;
          hooks.states[index] =
            typeof value === "function"
              ? (value as (previous: unknown) => unknown)(hooks.states[index])
              : value;
        },
      ];
    },
    useRef: (initial: unknown) =>
      (hooks.refs[hooks.refIndex++] ??= { current: initial }),
    useLayoutEffect: (effect: () => (() => void) | void) => {
      hooks.effects.push(effect);
    },
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      read: () => unknown,
    ) => {
      hooks.effects.push(() => subscribe(() => undefined));
      return read();
    },
  };
});

function unmount() {
  for (const cleanup of hooks.cleanups) cleanup();
  hooks.cleanups = [];
}
function commit(effects: typeof hooks.effects) {
  unmount();
  for (const effect of effects) {
    const cleanup = effect();
    if (cleanup) hooks.cleanups.push(cleanup);
  }
}
beforeEach(() => {
  hooks.stateIndex = 0;
  hooks.refIndex = 0;
  hooks.states = [];
  hooks.refs = [];
  hooks.effects = [];
  hooks.cleanups = [];
  hooks.writes = 0;
  domain.prepare.mockReset();
  domain.current.mockReset().mockReturnValue(true);
  domain.apply.mockReset().mockReturnValue({
    added: 1,
    message: "One listing added to the draft. Save separately.",
  });
});
afterEach(unmount);

const first = eodSelection.listing;
const second: ManagedEodIdentity = {
  ...first,
  listingId: "listing-zero-b",
  securityId: "security-zero-b",
  securityName: "Zero Class B & ordinary shares",
  shareClassId: "class-zero-b",
  shareClassName: "Class B",
  exchangeMic: "XNYS",
};
function preview(): ScreenShortlistWatchlistPreview {
  return {
    rows: [
      { listing: first, status: "existing" },
      { listing: second, status: "add" },
    ],
    additions: 1,
    runStartedAt: "2026-10-22T10:00:00.000Z",
    runCompletedAt: "2026-10-22T10:01:00.000Z",
  };
}
function store(initial: Record<string, unknown>) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    replace: (patch: Record<string, unknown> = {}) => {
      snapshot = { ...snapshot, ...patch };
      emit();
    },
    emit,
  };
}
function workspaceFixture() {
  const sources = {
    screen: store({ shortlist: [first.listingId, second.listingId] }),
    discovery: store({ view: "discover", research: null, companyRoute: null }),
    saved: store({ phase: "ready" }),
    session: store({ phase: "active" }),
  };
  const canNavigate = vi.fn(() => true);
  const workspace = {
    financialScreen: sources.screen,
    getSnapshot: sources.discovery.getSnapshot,
    subscribe: sources.discovery.subscribe,
    coordinator: sources.saved,
    sessionOwner: sources.session,
    canNavigate,
  } as unknown as ManagedWorkspace;
  return { workspace, sources, canNavigate };
}
type Props = Parameters<typeof ManagedScreenShortlistWatchlist>[0];
type Element = React.ReactElement<Record<string, unknown>>;
function elements(node: React.ReactNode): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function text(node: React.ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (React.isValidElement<Record<string, unknown>>(node))
    return text(node.props.children as React.ReactNode);
  return typeof node === "string" || typeof node === "number"
    ? String(node)
    : "";
}
function view(node: React.ReactNode) {
  const all = elements(node);
  const button = (label: string) => {
    const found = all.find(
      (element) =>
        element.type === "button" &&
        text(element.props.children as React.ReactNode) === label,
    );
    if (!found) throw new Error(`Expected button: ${label}`);
    return found;
  };
  return { node, all, button, html: () => renderToStaticMarkup(node) };
}
function click(button: Element) {
  (button.props.onClick as () => void)();
}
const PREPARE = "Review shortlist for My Watchlist";
const REVIEW = "Review and save in My Watchlist";
const APPLY = "Add 1 listings to Watchlist draft";
const CANCEL = "Keep Watchlist unchanged";
function fixture() {
  const owned = workspaceFixture();
  const onReviewWatchlist = vi.fn();
  const proposal = preview();
  domain.prepare.mockReturnValue({ preview: proposal, reason: "" });
  const defaults: Props = {
    workspace: owned.workspace,
    navigationPending: false,
    onReviewWatchlist,
  };
  const render = (updates: Partial<Props> = {}, committed = true) => {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    const node = ManagedScreenShortlistWatchlist({ ...defaults, ...updates });
    const effects = hooks.effects.splice(0);
    if (committed) commit(effects);
    return view(node);
  };
  const prepared = () => {
    click(render().button(PREPARE));
    return render();
  };
  return { ...owned, onReviewWatchlist, proposal, render, prepared };
}
function expectRowIdentity(
  html: string,
  index: number,
  listing: ManagedEodIdentity,
) {
  const $ = load(html);
  const row = $("ol > li").eq(index);
  for (const value of Object.values(listing))
    expect(row.text()).toContain(value);
  expect(
    row
      .find("dt")
      .map((_, item) => $(item).text())
      .get(),
  ).toEqual([
    "Security name",
    "Country",
    "Instrument type",
    "Listing ID",
    "Issuer ID",
    "Security ID",
    "Share class ID",
  ]);
}
function expectNoDomainActions() {
  expect(domain.prepare).not.toHaveBeenCalled();
  expect(domain.apply).not.toHaveBeenCalled();
}
function clickRetainedActions(current: ReturnType<typeof view>) {
  click(current.button(PREPARE));
  click(current.button(REVIEW));
  click(current.button(APPLY));
}

describe("screening shortlist Watchlist review", () => {
  it("renders an accessible explicit entry without domain actions on render, commit or subscription", () => {
    const f = fixture();
    const initial = f.render();
    const $ = load(initial.html());
    expect($("section").first().attr("aria-labelledby")).toBe(
      $("h3").attr("id"),
    );
    expect($("h3").text()).toBe("Keep your screening shortlist");
    expect(
      $("button")
        .toArray()
        .every((button) => $(button).attr("type") === "button"),
    ).toBe(true);
    expect(initial.html()).toContain("Save My Watchlist separately");
    expect(
      initial.all.some(
        (element) => text(element.props.children as React.ReactNode) === APPLY,
      ),
    ).toBe(false);
    for (const source of Object.values(f.sources)) {
      expect(source.subscribe).toHaveBeenCalledOnce();
      source.emit();
    }
    f.render();
    expectNoDomainActions();
    expect(f.onReviewWatchlist).not.toHaveBeenCalled();
  });
  it("requires Prepare before Apply and exposes every exact identity within each reviewed row", () => {
    const f = fixture();
    const review = f.prepared();
    expect(domain.prepare).toHaveBeenCalledExactlyOnceWith(f.workspace);
    expect(domain.apply).not.toHaveBeenCalled();
    const $ = load(review.html());
    expect($("h4").attr("id")).toBe(
      $("section section").attr("aria-labelledby"),
    );
    const rows = $("ol > li").toArray();
    expect(rows).toHaveLength(2);
    for (const [index, listing] of [first, second].entries())
      expectRowIdentity(review.html(), index, listing);
    expect($(rows[0]).text()).toContain("Keep its note and position");
    expect($(rows[1]).text()).toContain("Add to draft with an empty note");
    expect(review.html()).toContain(f.proposal.runStartedAt);
    expect(review.html()).toContain(f.proposal.runCompletedAt!);
    expect(review.html()).toContain("does not refresh evidence");
    click(review.button(APPLY));
    expect(domain.apply).toHaveBeenCalledExactlyOnceWith(
      f.workspace,
      f.proposal,
    );
    expect(f.render().html()).toContain(
      "One listing added to the draft. Save separately.",
    );
    expect(f.onReviewWatchlist).not.toHaveBeenCalled();
  });
  it("shows an unavailable preparation reason without offering Apply", () => {
    const f = fixture();
    domain.prepare.mockReturnValue({
      preview: null,
      reason: "Complete the screening run first.",
    });
    click(f.render().button(PREPARE));
    const next = f.render();
    expect(next.html()).toContain('role="status"');
    expect(next.html()).toContain("Complete the screening run first.");
    expect(next.html()).not.toContain("Shortlist addition review");
    expect(domain.apply).not.toHaveBeenCalled();
  });
  it("cancels without applying and makes the retained Apply callback inert", () => {
    const f = fixture();
    const review = f.prepared();
    click(review.button(CANCEL));
    click(review.button(APPLY));
    expect(domain.apply).not.toHaveBeenCalled();
    expect(f.render().html()).not.toContain("Shortlist addition review");
  });
  it("disables an out-of-date proposal and never offers an empty addition", () => {
    const f = fixture();
    f.prepared();
    domain.current.mockReturnValue(false);
    expect(f.render().button(APPLY).props.disabled).toBe(true);
    expect(f.render().html()).toContain("This review is out of date");
    domain.current.mockReturnValue(true);
    domain.prepare.mockReturnValue({
      preview: { ...f.proposal, additions: 0 },
      reason: "",
    });
    click(f.render().button(PREPARE));
    expect(
      f.render().button("Add 0 listings to Watchlist draft").props.disabled,
    ).toBe(true);
    expect(domain.apply).not.toHaveBeenCalled();
  });
  it("keeps disabled navigation-pending callbacks inert before preparation and while reviewing", () => {
    const f = fixture();
    const pending = f.render({ navigationPending: true });
    expect(pending.button(PREPARE).props.disabled).toBe(true);
    expect(pending.button(REVIEW).props.disabled).toBe(true);
    click(pending.button(PREPARE));
    click(pending.button(REVIEW));
    expectNoDomainActions();
    f.prepared();
    const review = f.render({ navigationPending: true });
    expect(review.button(APPLY).props.disabled).toBe(true);
    clickRetainedActions(review);
    expect(domain.apply).not.toHaveBeenCalled();
    expect(domain.prepare).toHaveBeenCalledOnce();
    expect(f.onReviewWatchlist).not.toHaveBeenCalled();
  });
  it.each(["screen", "discovery", "saved", "session"] as const)(
    "refuses retained actions after a %s snapshot replacement before rerender",
    (source) => {
      const f = fixture();
      const review = f.prepared();
      f.sources[source].replace();
      domain.prepare.mockClear();
      clickRetainedActions(review);
      expectNoDomainActions();
      expect(f.onReviewWatchlist).not.toHaveBeenCalled();
    },
  );
  it("refuses retained actions when navigation admission changes without a snapshot replacement", () => {
    const f = fixture();
    const current = f.prepared();
    f.canNavigate.mockReturnValue(false);
    domain.prepare.mockClear();
    clickRetainedActions(current);
    expectNoDomainActions();
    expect(f.onReviewWatchlist).not.toHaveBeenCalled();
  });
  it("refuses old actions after a committed rerender and before an initial commit", () => {
    const f = fixture();
    const uncommitted = f.render({}, false);
    click(uncommitted.button(PREPARE));
    click(uncommitted.button(REVIEW));
    expectNoDomainActions();
    const old = f.prepared();
    f.render();
    domain.prepare.mockClear();
    clickRetainedActions(old);
    expectNoDomainActions();
    expect(f.onReviewWatchlist).not.toHaveBeenCalled();
  });
  it("rejects callbacks from an abandoned render while retaining the last committed review", () => {
    const f = fixture();
    const current = f.prepared();
    const abandoned = f.render({}, false);
    const writes = hooks.writes;
    domain.prepare.mockClear();
    clickRetainedActions(abandoned);
    click(abandoned.button(CANCEL));
    expectNoDomainActions();
    expect(f.onReviewWatchlist).not.toHaveBeenCalled();
    expect(hooks.writes).toBe(writes);
    click(current.button(APPLY));
    expect(domain.apply).toHaveBeenCalledExactlyOnceWith(
      f.workspace,
      f.proposal,
    );
  });
  it("does not carry an old workspace preview into its replacement or admit its old callbacks", () => {
    const f = fixture();
    const old = f.prepared();
    const replacement = workspaceFixture();
    expect(f.render({ workspace: replacement.workspace }).html()).not.toContain(
      "Shortlist addition review",
    );
    domain.prepare.mockClear();
    clickRetainedActions(old);
    expectNoDomainActions();
    expect(f.onReviewWatchlist).not.toHaveBeenCalled();
  });
  it("keeps the new workspace review when an old Cancel callback is invoked", () => {
    const f = fixture();
    const old = f.prepared();
    const replacement = workspaceFixture();
    click(f.render({ workspace: replacement.workspace }).button(PREPARE));
    f.render({ workspace: replacement.workspace });
    click(old.button(CANCEL));
    expect(f.render({ workspace: replacement.workspace }).html()).toContain(
      "Shortlist addition review",
    );
    expect(domain.apply).not.toHaveBeenCalled();
  });
  it("makes all retained callbacks inert after unmount without writing hook state", () => {
    const f = fixture();
    const old = f.prepared();
    unmount();
    const writes = hooks.writes;
    domain.prepare.mockClear();
    clickRetainedActions(old);
    click(old.button(CANCEL));
    expectNoDomainActions();
    expect(f.onReviewWatchlist).not.toHaveBeenCalled();
    expect(hooks.writes).toBe(writes);
  });
  it("does not write state after Apply synchronously unmounts the component", () => {
    const f = fixture();
    const current = f.prepared();
    const writes = hooks.writes;
    domain.apply.mockImplementation(() => {
      unmount();
      return { added: 1, message: "Unmounted completion." };
    });
    click(current.button(APPLY));
    expect(domain.apply).toHaveBeenCalledExactlyOnceWith(
      f.workspace,
      f.proposal,
    );
    expect(hooks.writes).toBe(writes);
  });
  it("keeps a replacement workspace review when an older Apply completes after a synchronous commit", () => {
    const f = fixture();
    const current = f.prepared();
    const replacement = workspaceFixture();
    domain.apply.mockImplementation(() => {
      click(f.render({ workspace: replacement.workspace }).button(PREPARE));
      f.render({ workspace: replacement.workspace });
      return { added: 1, message: "Old workspace completion." };
    });
    click(current.button(APPLY));
    const next = f.render({ workspace: replacement.workspace });
    expect(next.html()).toContain("Shortlist addition review");
    expect(next.html()).not.toContain("Old workspace completion.");
    expect(next.button(APPLY).props.disabled).toBe(false);
    expect(domain.apply).toHaveBeenCalledExactlyOnceWith(
      f.workspace,
      f.proposal,
    );
  });
  it("consumes Apply before calling the domain so reentrant and repeated callbacks apply once", () => {
    const f = fixture();
    const current = f.prepared();
    domain.apply.mockImplementation(() => {
      click(current.button(APPLY));
      return { added: 1, message: "Applied once." };
    });
    click(current.button(APPLY));
    click(current.button(APPLY));
    expect(domain.apply).toHaveBeenCalledExactlyOnceWith(
      f.workspace,
      f.proposal,
    );
    expect(f.render().html()).toContain("Applied once.");
  });
  it("navigates only through a separate current explicit review action", () => {
    const f = fixture();
    const current = f.render();
    expect(f.onReviewWatchlist).not.toHaveBeenCalled();
    click(current.button(REVIEW));
    expect(f.onReviewWatchlist).toHaveBeenCalledOnce();
    expectNoDomainActions();
  });
});
