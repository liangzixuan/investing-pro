import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PersonalCompanyResearchWorkspace,
  type PersonalCompanyResearchWorkspaceProps,
} from "./PersonalCompanyResearchWorkspace";

const hooks = vi.hoisted(() => {
  let refs: { current: unknown }[] = [];
  let cursor = 0;
  let effects: (() => void)[] = [];
  return {
    reset() {
      refs = [];
      cursor = 0;
      effects = [];
    },
    begin() {
      cursor = 0;
      effects = [];
    },
    ref(initial: unknown) {
      const index = cursor++;
      refs[index] ??= { current: initial };
      return refs[index];
    },
    effect(callback: () => void) {
      effects.push(callback);
    },
    commit() {
      for (const effect of effects) effect();
      effects = [];
    },
  };
});

vi.mock("react", async (original) => ({
  ...(await original()),
  useRef: (initial: unknown) => hooks.ref(initial),
  useEffect: (callback: () => void) => hooks.effect(callback),
}));

type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = React.ReactElement<ElementProps>;
let props: PersonalCompanyResearchWorkspaceProps;

beforeEach(() => {
  hooks.reset();
  props = {
    selection: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Company",
      listingId: "listing-zero",
      securityName: "Zero Class A",
      symbol: "ZERO",
    },
    activeSection: "price",
    onSectionChange: vi.fn(),
    onBack: vi.fn(),
    backLabel: "Back to financial results",
    onClear: vi.fn(),
    sections: {
      price: <article>Retained quote</article>,
      financials: <article>Retained statements</article>,
      valuation: <input aria-label="Draft" defaultValue="12.5" />,
      peers: <article>Retained peers</article>,
      sec: <article>Retained SEC evidence</article>,
    },
  };
});

afterEach(() => vi.unstubAllGlobals());

describe("PersonalCompanyResearchWorkspace", () => {
  it("keeps every panel at a stable keyed position while exposing only the chosen panel", () => {
    const before = render();
    const panels = elements(before).filter(
      (node) => node.props.role === "tabpanel",
    );
    expect(panels).toHaveLength(5);
    expect(
      panels.filter((node) => !node.props.hidden).map((node) => node.props.id),
    ).toEqual(["company-research-panel-price"]);
    props = { ...props, activeSection: "valuation" };
    const after = elements(render()).filter(
      (node) => node.props.role === "tabpanel",
    );
    expect(
      after.map((node) => [node.type, node.key, node.props.children]),
    ).toEqual(panels.map((node) => [node.type, node.key, node.props.children]));
    expect(
      after.filter((node) => !node.props.hidden).map((node) => node.props.id),
    ).toEqual(["company-research-panel-valuation"]);
    expect(props.onSectionChange).not.toHaveBeenCalled();
    const markup = renderToStaticMarkup(after[0]);
    expect(markup).toContain('hidden=""');
  });

  it("connects each tab to its panel and puts only the active tab in the tab order", () => {
    const view = render();
    const tabs = elements(view).filter((node) => node.props.role === "tab");
    expect(tabs).toHaveLength(5);
    expect(tabs.filter((node) => node.props.tabIndex === 0)).toHaveLength(1);
    for (const tab of tabs) {
      const panel = elements(view).find(
        (node) => node.props.id === tab.props["aria-controls"],
      );
      expect(panel?.props["aria-labelledby"]).toBe(tab.props.id);
      expect(tab.props["aria-selected"]).toBe(tab.props.tabIndex === 0);
    }
  });

  it.each([
    ["price", "ArrowLeft", "sec"],
    ["sec", "ArrowRight", "price"],
    ["price", "ArrowRight", "financials"],
    ["valuation", "Home", "price"],
    ["financials", "End", "sec"],
  ])("moves from %s using %s to %s and focuses that tab", (from, key, to) => {
    const view = render();
    const tab = elementById(view, `company-research-tab-${from}`);
    const focus = vi.fn();
    const querySelector = vi.fn().mockReturnValue({ focus });
    const preventDefault = vi.fn();
    invoke(tab, "onKeyDown", {
      key,
      preventDefault,
      currentTarget: { parentElement: { querySelector } },
    });
    expect(props.onSectionChange).toHaveBeenCalledExactlyOnceWith(to);
    expect(querySelector).toHaveBeenCalledWith(`#company-research-tab-${to}`);
    expect(focus).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("leaves unrelated keyboard shortcuts alone", () => {
    const preventDefault = vi.fn();
    invoke(elementById(render(), "company-research-tab-price"), "onKeyDown", {
      key: "Tab",
      preventDefault,
    });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(props.onSectionChange).not.toHaveBeenCalled();
  });

  it("separates Back from Clear company without requesting a section change", () => {
    const buttons = elements(render()).filter((node) => node.type === "button");
    invoke(
      buttons.find((node) => node.props.children === props.backLabel)!,
      "onClick",
    );
    expect(props.onBack).toHaveBeenCalledOnce();
    expect(props.onClear).not.toHaveBeenCalled();
    invoke(
      buttons.find((node) => node.props.children === "Clear company")!,
      "onClick",
    );
    expect(props.onClear).toHaveBeenCalledOnce();
    expect(props.onSectionChange).not.toHaveBeenCalled();
  });

  it("places optional company navigation after the heading actions and before the shared note and tabs", () => {
    const navigation = (
      <nav id="navigation-slot">
        <p id="navigation-description">Company sequence</p>
      </nav>
    );
    const note = <aside id="note-slot">Shared research note</aside>;
    props = {
      ...props,
      navigation,
      navigationDescriptionId: "navigation-description",
      researchNote: note,
    };
    const view = render();
    expect(elementById(view, "navigation-slot")).toBe(navigation);
    const heading = elementById(view, "personal-company-research-title");
    expect(heading.props["aria-describedby"]).toBe("navigation-description");
    expect(
      elementById(view, heading.props["aria-describedby"] as string).props
        .children,
    ).toBe("Company sequence");
    const markup = renderToStaticMarkup(view);
    expect(markup.indexOf("Clear company")).toBeLessThan(
      markup.indexOf('id="navigation-slot"'),
    );
    expect(markup.indexOf('id="navigation-slot"')).toBeLessThan(
      markup.indexOf('id="note-slot"'),
    );
    expect(markup.indexOf('id="note-slot"')).toBeLessThan(
      markup.indexOf('role="tablist"'),
    );
    expect(
      elements(view)
        .filter((node) => node.props.role === "tabpanel")
        .flatMap((panel) => elements(panel.props.children))
        .some((node) => node.props.id === "navigation-slot"),
    ).toBe(false);
    expect(props.onBack).not.toHaveBeenCalled();
    expect(props.onClear).not.toHaveBeenCalled();
    expect(props.onSectionChange).not.toHaveBeenCalled();
  });

  it("keeps the active section before the retained overview without remounting panel content", () => {
    const overview = (
      <aside id="overview-slot">Same annual and price data</aside>
    );
    props = { ...props, overview };
    const before = render();
    expect(elementById(before, "overview-slot")).toBe(overview);
    const markup = renderToStaticMarkup(before);
    expect(markup.indexOf('id="overview-slot"')).toBeGreaterThan(
      markup.lastIndexOf('role="tabpanel"'),
    );
    const panels = elements(before).filter(
      (node) => node.props.role === "tabpanel",
    );
    props = { ...props, activeSection: "financials" };
    const after = render();
    expect(elementById(after, "overview-slot")).toBe(overview);
    expect(
      elements(after)
        .filter((node) => node.props.role === "tabpanel")
        .map((node) => [node.key, node.props.children]),
    ).toEqual(panels.map((node) => [node.key, node.props.children]));
    expect(props.onSectionChange).not.toHaveBeenCalled();
  });

  it("does not expose a retained overview when the company selection is cleared", () => {
    props = {
      ...props,
      selection: null,
      overview: <aside id="overview-slot">Previous company data</aside>,
    };
    expect(
      elements(render()).some((node) => node.props.id === "overview-slot"),
    ).toBe(false);
  });

  it("omits a supplied navigation description when the navigation slot is absent", () => {
    props = { ...props, navigationDescriptionId: "absent-navigation" };
    expect(
      elementById(render(), "personal-company-research-title").props[
        "aria-describedby"
      ],
    ).toBeUndefined();
  });

  it("retains the supplied navigation across sections without changing panel keys or contents", () => {
    const navigation = <nav id="navigation-slot">Company 2 of 3</nav>;
    props = { ...props, navigation };
    const panels = elements(render()).filter(
      (node) => node.props.role === "tabpanel",
    );
    for (const activeSection of [
      "financials",
      "valuation",
      "peers",
      "sec",
    ] as const) {
      props = { ...props, activeSection };
      const view = render();
      expect(elements(view).filter((node) => node === navigation)).toHaveLength(
        1,
      );
      expect(
        elements(view)
          .filter((node) => node.props.role === "tabpanel")
          .map((node) => [node.type, node.key, node.props.children]),
      ).toEqual(
        panels.map((node) => [node.type, node.key, node.props.children]),
      );
    }
    expect(props.onSectionChange).not.toHaveBeenCalled();
  });

  it("omits navigation when selection is cleared and renders only the latest parent-supplied slot", () => {
    const selection = props.selection;
    props = {
      ...props,
      navigation: <nav id="navigation-slot">Old company sequence</nav>,
      navigationDescriptionId: "navigation-description",
      selection: null,
    };
    const cleared = render();
    expect(
      elements(cleared).some((node) => node.props.id === "navigation-slot"),
    ).toBe(false);
    expect(renderToStaticMarkup(cleared)).not.toContain("Old company sequence");
    expect(
      elementById(cleared, "personal-company-research-title").props[
        "aria-describedby"
      ],
    ).toBeUndefined();
    props = {
      ...props,
      selection,
      navigation: <nav id="navigation-slot">New company sequence</nav>,
    };
    expect(elementById(render(), "navigation-slot").props.children).toBe(
      "New company sequence",
    );
  });

  it("places an optional research note after company actions and before the five tabs", () => {
    const note = <aside id="note-slot">Shared research note</aside>;
    props = { ...props, researchNote: note };
    const view = render();
    expect(elementById(view, "note-slot")).toBe(note);
    const markup = renderToStaticMarkup(view);
    expect(markup.indexOf("Clear company")).toBeLessThan(
      markup.indexOf('id="note-slot"'),
    );
    expect(markup.indexOf('id="note-slot"')).toBeLessThan(
      markup.indexOf('role="tablist"'),
    );
    const panels = elements(view).filter(
      (node) => node.props.role === "tabpanel",
    );
    expect(panels).toHaveLength(5);
    expect(
      panels
        .flatMap((panel) => elements(panel.props.children))
        .some((node) => node.props.id === "note-slot"),
    ).toBe(false);
    expect(props.onSectionChange).not.toHaveBeenCalled();
    expect(props.onBack).not.toHaveBeenCalled();
    expect(props.onClear).not.toHaveBeenCalled();
  });

  it("keeps the shared note mounted inside a closed native disclosure across research sections", () => {
    const note = (
      <textarea
        aria-label="Shared draft"
        value="  Keep this exact draft  "
        readOnly
      />
    );
    props = { ...props, researchNote: note };
    const before = render();
    const disclosure = elements(before).find(
      (node) =>
        node.type === "details" && elements(node.props.children).includes(note),
    );
    expect(disclosure).toBeDefined();
    expect(disclosure!.props.open).not.toBe(true);
    expect(
      elements(disclosure).find((node) => node.type === "summary")?.props
        .children,
    ).toBe("Watchlist and research note");
    expect(elements(disclosure).filter((node) => node === note)).toHaveLength(
      1,
    );
    for (const activeSection of [
      "financials",
      "valuation",
      "peers",
      "sec",
      "price",
    ] as const) {
      props = { ...props, activeSection };
      const next = render();
      const currentDisclosure = elements(next).find(
        (node) =>
          node.type === "details" &&
          elements(node.props.children).includes(note),
      );
      expect(currentDisclosure?.type).toBe(disclosure?.type);
      expect(currentDisclosure?.key).toBe(disclosure?.key);
      expect(
        elements(currentDisclosure).filter((node) => node === note),
      ).toHaveLength(1);
      expect(renderToStaticMarkup(next)).toContain("  Keep this exact draft  ");
    }
    expect(props.onBack).not.toHaveBeenCalled();
    expect(props.onClear).not.toHaveBeenCalled();
    expect(props.onSectionChange).not.toHaveBeenCalled();
  });

  it("retains the same note outside every section while keeping panels mounted", () => {
    const note = (
      <textarea aria-label="Shared note" value="Raw draft" readOnly />
    );
    props = { ...props, researchNote: note };
    const panels = elements(render()).filter(
      (node) => node.props.role === "tabpanel",
    );
    for (const activeSection of [
      "financials",
      "valuation",
      "peers",
      "sec",
      "price",
    ] as const) {
      props = { ...props, activeSection };
      const view = render();
      const currentPanels = elements(view).filter(
        (node) => node.props.role === "tabpanel",
      );
      expect(elements(view).filter((node) => node === note)).toHaveLength(1);
      expect(
        currentPanels.map((node) => [node.type, node.key, node.props.children]),
      ).toEqual(
        panels.map((node) => [node.type, node.key, node.props.children]),
      );
      expect(
        currentPanels
          .filter((node) => !node.props.hidden)
          .map((node) => node.props.id),
      ).toEqual([`company-research-panel-${activeSection}`]);
    }
    expect(props.onSectionChange).not.toHaveBeenCalled();
  });

  it("omits the note when company selection is cleared without exposing a hidden duplicate", () => {
    const selection = props.selection;
    props = {
      ...props,
      researchNote: (
        <textarea id="note-slot" defaultValue="Retained by parent" />
      ),
      selection: null,
    };
    const cleared = render();
    expect(
      elements(cleared).some((node) => node.props.id === "note-slot"),
    ).toBe(false);
    expect(renderToStaticMarkup(cleared)).not.toContain("Retained by parent");
    props = { ...props, selection };
    expect(elementById(render(), "note-slot").props.defaultValue).toBe(
      "Retained by parent",
    );
  });

  it("hides all company content and navigation when selection is cleared", () => {
    props = { ...props, selection: null };
    const view = render();
    expect(
      elements(view).filter((node) => node.props.role === "tab"),
    ).toHaveLength(0);
    expect(
      elements(view)
        .filter((node) => node.props.role === "tabpanel")
        .every((node) => node.props.hidden),
    ).toBe(true);
    expect(renderToStaticMarkup(view)).toContain("Explore a company");
  });

  it("reveals a linked source section before focusing the source heading", () => {
    props = { ...props, activeSection: "valuation" };
    const source = sourceHarness();
    const view = render();
    const event = anchorEvent("#personal-annual-financials-title");
    invoke(view, "onClickCapture", event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(props.onSectionChange).toHaveBeenCalledExactlyOnceWith("financials");
    expect(source.focus).not.toHaveBeenCalled();
    props = { ...props, activeSection: "financials" };
    render();
    hooks.commit();
    expect(source.focus).toHaveBeenCalledExactlyOnceWith({
      preventScroll: true,
    });
    expect(source.scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "instant",
    });
    expect(source.tabIndex).toBe(-1);
  });

  it("discards pending source focus when company identity changes before the section commits", () => {
    props = { ...props, activeSection: "valuation" };
    const source = sourceHarness();
    invoke(
      render(),
      "onClickCapture",
      anchorEvent("#personal-market-overview"),
    );
    props = {
      ...props,
      selection: { ...props.selection!, listingId: "other" },
      activeSection: "price",
    };
    render();
    hooks.commit();
    expect(source.focus).not.toHaveBeenCalled();
  });

  it("reveals valuation history from the peer comparison source link", () => {
    props = { ...props, activeSection: "peers" };
    const source = sourceHarness();
    invoke(
      render(),
      "onClickCapture",
      anchorEvent("#personal-valuation-history-title"),
    );
    expect(props.onSectionChange).toHaveBeenCalledExactlyOnceWith("valuation");
    props = { ...props, activeSection: "valuation" };
    render();
    hooks.commit();
    expect(source.focus).toHaveBeenCalledOnce();
  });

  it("ignores callbacks retained from the previous company", () => {
    const previous = render();
    props = { ...props, selection: null };
    render();
    invoke(elementById(previous, "company-research-tab-sec"), "onClick");
    const event = anchorEvent("#personal-market-overview");
    invoke(previous, "onClickCapture", event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(props.onSectionChange).not.toHaveBeenCalled();
  });

  it.each([
    ["https://example.invalid/#personal-market-overview", false],
    ["#unrelated-heading", false],
    ["#personal-market-overview", true],
  ])(
    "leaves external, unrelated or modified source links alone: %s",
    (href, ctrlKey) => {
      const event = anchorEvent(href, ctrlKey);
      invoke(render(), "onClickCapture", event);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(props.onSectionChange).not.toHaveBeenCalled();
    },
  );
});

function render() {
  hooks.begin();
  return PersonalCompanyResearchWorkspace(props);
}
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function elementById(view: ReactNode, id: string) {
  const element = elements(view).find((node) => node.props.id === id);
  if (!element) throw new Error(`Missing ${id}`);
  return element;
}
function invoke(node: Element, name: string, event?: unknown) {
  (node.props[name] as (event?: unknown) => void)(event);
}
function sourceHarness() {
  const source = {
    tabIndex: 0,
    closest: vi.fn().mockReturnValue(null),
    focus: vi.fn(),
    scrollIntoView: vi.fn(),
  };
  vi.stubGlobal("document", {
    getElementById: vi.fn().mockReturnValue(source),
  });
  return source;
}
function anchorEvent(href: string, ctrlKey = false) {
  class Link {
    closest() {
      return this;
    }
    getAttribute() {
      return href;
    }
  }
  vi.stubGlobal("Element", Link);
  return {
    target: new Link(),
    currentTarget: { contains: () => true },
    button: 0,
    ctrlKey,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
  };
}
