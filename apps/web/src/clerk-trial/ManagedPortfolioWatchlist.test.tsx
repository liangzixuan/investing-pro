import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedWorkspace } from "./managed-workspace";
import type { PortfolioWatchlistPreview } from "./managed-portfolio-watchlist";
import { ManagedPortfolioWatchlist } from "./ManagedPortfolioWatchlist";
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
vi.mock("./managed-portfolio-watchlist", () => ({
  preparePortfolioWatchlist: domain.prepare,
  isPortfolioWatchlistCurrent: domain.current,
  applyPortfolioWatchlist: domain.apply,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => "holding-test",
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

const listing = eodSelection.listing;
function store(initial: Record<string, unknown>) {
  let value = initial;
  return {
    getSnapshot: () => value,
    subscribe: vi.fn(() => () => undefined),
    replace: (patch: Record<string, unknown> = {}) => {
      value = { ...value, ...patch };
    },
  };
}
function fixture() {
  const sources = {
    discovery: store({ view: "portfolio" }),
    portfolio: store({ pendingEditor: false, reviewing: false }),
    ledger: store({ draft: {} }),
    watchlist: store({ draft: {} }),
    session: store({ phase: "active" }),
  };
  let epoch = 0;
  let route = true;
  const workspace = {
    getSnapshot: sources.discovery.getSnapshot,
    subscribe: sources.discovery.subscribe,
    coordinator: sources.watchlist,
    sessionOwner: sources.session,
    portfolio: {
      ...sources.portfolio,
      coordinator: sources.ledger,
      getProjection: () => ({
        status: "valid",
        portfolio: { holdings: [{ identity: listing }] },
      }),
    },
    capturePortfolioWatchlistRoute: () => {
      const captured = epoch;
      return () => route && captured === epoch;
    },
  } as unknown as ManagedWorkspace;
  const proposal: PortfolioWatchlistPreview = {
    listing,
    status: "add",
    shares: "2.125",
    confirmedOn: "2026-10-01",
  };
  domain.prepare.mockReturnValue({ preview: proposal, reason: "" });
  const review = vi.fn();
  const defaults = {
    workspace,
    navigationPending: false,
    routeActive: () => true,
    onReviewWatchlist: review,
  };
  const render = (patch: Partial<typeof defaults> = {}, committed = true) => {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    const node = ManagedPortfolioWatchlist({ ...defaults, ...patch });
    const effects = hooks.effects.splice(0);
    if (committed) commit(effects);
    return view(node);
  };
  const choose = () => {
    const select = render().all.find((x) => x.type === "select")!;
    (select.props.onChange as (e: unknown) => void)({
      currentTarget: { value: listing.listingId },
    });
    return render();
  };
  const prepared = () => {
    choose();
    click(render().button(PREPARE));
    return render();
  };
  return {
    workspace,
    sources,
    proposal,
    review,
    render,
    choose,
    prepared,
    block: () => {
      route = false;
      epoch++;
    },
    unblock: () => {
      route = true;
      epoch++;
    },
  };
}
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
  return {
    node,
    all,
    html: () => renderToStaticMarkup(node),
    button: (label: string) => {
      const found = all.find(
        (x) =>
          x.type === "button" &&
          text(x.props.children as React.ReactNode) === label,
      );
      if (!found) throw new Error(`Missing button ${label}`);
      return found;
    },
  };
}
function click(element: Element) {
  (element.props.onClick as () => void)();
}
const PREPARE = "Review holding for My Watchlist",
  APPLY = "Add holding to Watchlist draft";
const REVIEW = "Review and save in My Watchlist",
  CANCEL = "Keep Watchlist unchanged";
function retained(v: ReturnType<typeof view>) {
  for (const label of [PREPARE, APPLY, REVIEW]) click(v.button(label));
}

describe("Portfolio holding Watchlist review", () => {
  it("keeps entry initially closed, labels the current-holding selector and makes no request or draft action on render", () => {
    const f = fixture(),
      v = f.render(),
      $ = load(v.html());
    expect($("details").first().attr("open")).toBeUndefined();
    expect($("summary").text()).toBe("Keep a holding in My Watchlist");
    expect($("label").attr("for")).toBe($("select").attr("id"));
    expect($("select option")).toHaveLength(2);
    expect(v.button(PREPARE).props.disabled).toBe(true);
    expect(domain.prepare).not.toHaveBeenCalled();
    expect(domain.apply).not.toHaveBeenCalled();
  });
  it("reviews the complete exact identity and authored provenance before append, then navigates only explicitly", () => {
    const f = fixture(),
      v = f.prepared(),
      html = v.html();
    expect(domain.prepare).toHaveBeenCalledExactlyOnceWith(
      f.workspace,
      listing.listingId,
    );
    for (const value of Object.values(listing)) expect(html).toContain(value);
    expect(html).toContain("2.125");
    expect(html).toContain("2026-10-01");
    expect(html).toContain("empty note");
    expect(html).toContain("Save each resource separately");
    click(v.button(APPLY));
    expect(domain.apply).toHaveBeenCalledExactlyOnceWith(
      f.workspace,
      f.proposal,
    );
    expect(f.render().html()).toContain(
      "One listing added to the draft. Save separately.",
    );
    expect(f.review).not.toHaveBeenCalled();
    click(f.render().button(REVIEW));
    expect(f.review).toHaveBeenCalledOnce();
  });
  it("shows refusal, existing and stale review states without an enabled addition", () => {
    const f = fixture();
    f.choose();
    domain.prepare.mockReturnValue({
      preview: null,
      reason: "Review catalog identities first.",
    });
    click(f.render().button(PREPARE));
    expect(f.render().html()).toContain("Review catalog identities first.");
    domain.prepare.mockReturnValue({
      preview: { ...f.proposal, status: "existing" },
      reason: "",
    });
    click(f.render().button(PREPARE));
    const existing = f.render();
    expect(existing.button(APPLY).props.disabled).toBe(true);
    click(existing.button(APPLY));
    expect(domain.apply).not.toHaveBeenCalled();
    domain.prepare.mockReturnValue({ preview: f.proposal, reason: "" });
    click(f.render().button(PREPARE));
    domain.current.mockReturnValue(false);
    const stale = f.render();
    expect(stale.button(APPLY).props.disabled).toBe(true);
    click(stale.button(APPLY));
    expect(domain.apply).not.toHaveBeenCalled();
  });
  it("cancels and consumes retained apply callbacks, including reentrant double clicks", () => {
    const f = fixture(),
      v = f.prepared();
    click(v.button(CANCEL));
    click(v.button(APPLY));
    expect(domain.apply).not.toHaveBeenCalled();
    const next = f.prepared();
    domain.apply.mockImplementation(() => {
      click(next.button(APPLY));
      return { added: true, message: "Added once." };
    });
    click(next.button(APPLY));
    expect(domain.apply).toHaveBeenCalledOnce();
  });
  it.each([
    "discovery",
    "portfolio",
    "ledger",
    "watchlist",
    "session",
  ] as const)(
    "rejects retained handlers after %s changes before render",
    (key) => {
      const f = fixture(),
        v = f.prepared();
      domain.prepare.mockClear();
      f.sources[key].replace();
      retained(v);
      expect(domain.prepare).not.toHaveBeenCalled();
      expect(domain.apply).not.toHaveBeenCalled();
      expect(f.review).not.toHaveBeenCalled();
    },
  );
  it.each([{ pendingEditor: true }, { reviewing: true }, { review: {} }])(
    "keeps current form/identity-review callbacks inert even if invoked directly",
    (patch) => {
      const f = fixture();
      f.sources.portfolio.replace(patch);
      const v = f.choose();
      click(v.button(PREPARE));
      click(v.button(REVIEW));
      expect(domain.prepare).not.toHaveBeenCalled();
      expect(domain.apply).not.toHaveBeenCalled();
      expect(f.review).not.toHaveBeenCalled();
    },
  );
  it("rejects navigation round trips without a render or discovery change", () => {
    const f = fixture(),
      v = f.prepared();
    domain.prepare.mockClear();
    f.block();
    f.unblock();
    retained(v);
    expect(domain.prepare).not.toHaveBeenCalled();
    expect(domain.apply).not.toHaveBeenCalled();
    expect(f.review).not.toHaveBeenCalled();
  });
  it.each([{ navigationPending: true }, { routeActive: () => false }])(
    "rejects pending or hidden root routes",
    (patch) => {
      const f = fixture();
      f.prepared();
      const v = f.render(patch);
      domain.prepare.mockClear();
      retained(v);
      expect(domain.prepare).not.toHaveBeenCalled();
      expect(domain.apply).not.toHaveBeenCalled();
      expect(f.review).not.toHaveBeenCalled();
    },
  );
  it("rejects callbacks before commit, after unmount and from abandoned or older renders", () => {
    const f = fixture();
    f.choose();
    const first = f.render({}, false);
    click(first.button(PREPARE));
    expect(domain.prepare).not.toHaveBeenCalled();
    const old = f.prepared();
    const abandoned = f.render({}, false);
    domain.prepare.mockClear();
    const writes = hooks.writes;
    retained(abandoned);
    expect(hooks.writes).toBe(writes);
    expect(domain.apply).not.toHaveBeenCalled();
    const current = f.render();
    retained(old);
    expect(domain.prepare).not.toHaveBeenCalled();
    unmount();
    retained(current);
    expect(domain.apply).not.toHaveBeenCalled();
    expect(f.review).not.toHaveBeenCalled();
  });
  it("hides private review on workspace replacement or retirement and avoids writes after reentrant retirement", () => {
    const f = fixture(),
      v = f.prepared(),
      replacement = fixture();
    expect(f.render({ workspace: replacement.workspace }).html()).not.toContain(
      "Holding addition review",
    );
    const current = f.render();
    domain.apply.mockImplementation(() => {
      f.sources.session.replace({ phase: "retired" });
      return { added: true, message: "Do not publish" };
    });
    const writes = hooks.writes;
    click(current.button(APPLY));
    expect(hooks.writes).toBe(writes);
    expect(f.render().html()).toBe("");
    click(v.button(REVIEW));
    expect(f.review).not.toHaveBeenCalled();
  });
});
