import type {
  ComponentProps,
  ComponentPropsWithRef,
  MouseEvent,
  ReactElement,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  WorkspaceLink,
  WorkspaceNavigationProvider,
  WorkspaceSkipLink,
  type WorkspaceLinkProps,
  type WorkspaceNavigation,
} from "./WorkspaceNavigation";

function renderLink(
  props: WorkspaceLinkProps,
  navigation?: WorkspaceNavigation,
) {
  let anchor: ReactElement<ComponentPropsWithRef<"a">> | undefined;
  function Capture() {
    anchor = WorkspaceLink(props);
    return anchor;
  }
  const html = renderToStaticMarkup(
    navigation === undefined ? (
      <Capture />
    ) : (
      <WorkspaceNavigationProvider navigation={navigation}>
        <Capture />
      </WorkspaceNavigationProvider>
    ),
  );
  if (anchor === undefined) throw new Error("Expected a rendered link");
  return { html, anchor };
}

type ClickEvent = Omit<MouseEvent<HTMLAnchorElement>, "preventDefault"> & {
  preventDefault: (this: void) => void;
};

function click(overrides: Partial<MouseEvent<HTMLAnchorElement>> = {}) {
  const event = {
    button: 0,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    defaultPrevented: false,
    preventDefault: vi.fn(() => {
      event.defaultPrevented = true;
    }),
    ...overrides,
  };
  return event as unknown as ClickEvent;
}

function navigation() {
  return { href: vi.fn((path: string) => `#${path}`), navigate: vi.fn() };
}

describe("shared workspace links", () => {
  it("keeps an ordinary anchor when there is no platform navigation", () => {
    const { html, anchor } = renderLink({
      href: "/discover?view=watchlist",
      children: "My Watchlist",
      className: "watchlist-link",
      "aria-label": "Open My Watchlist",
    });
    const event = click();
    anchor.props.onClick?.(event);
    expect(html).toContain('href="/discover?view=watchlist"');
    expect(html).toContain('class="watchlist-link"');
    expect(html).toContain('aria-label="Open My Watchlist"');
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it.each([
    "/markets",
    "/discover",
    "/discover?view=watchlist",
    "/company/listing%3Aone",
  ])("routes a normal activation once using canonical path %s", (href) => {
    const adapter = navigation();
    const { anchor } = renderLink({ href, children: "Open" }, adapter);
    expect(anchor.props.href).toBe(`#${href}`);
    expect(adapter.navigate).not.toHaveBeenCalled();
    const event = click();
    anchor.props.onClick?.(event);
    expect(event.preventDefault).toHaveBeenCalledExactlyOnceWith();
    expect(adapter.navigate).toHaveBeenCalledExactlyOnceWith(href);
  });

  it.each([
    { button: 1 },
    { button: 2 },
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
  ])("leaves modified or nonprimary activation to the browser: %j", (keys) => {
    const adapter = navigation();
    const { anchor } = renderLink({ href: "/markets" }, adapter);
    const event = click(keys);
    anchor.props.onClick?.(event);
    expect(anchor.props.href).toBe("#/markets");
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(adapter.navigate).not.toHaveBeenCalled();
  });

  it.each([
    { target: "_blank" },
    { target: "research-window" },
    { download: "report" },
  ])("preserves explicit browser destination behavior: %j", (attributes) => {
    const adapter = navigation();
    const { anchor } = renderLink({ href: "/markets", ...attributes }, adapter);
    const event = click();
    anchor.props.onClick?.(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(adapter.navigate).not.toHaveBeenCalled();
  });

  it("honors a caller that cancels navigation", () => {
    const adapter = navigation();
    const onClick = vi.fn((event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
    });
    const { anchor } = renderLink({ href: "/markets", onClick }, adapter);
    const event = click();
    anchor.props.onClick?.(event);
    expect(onClick).toHaveBeenCalledExactlyOnceWith(event);
    expect(adapter.navigate).not.toHaveBeenCalled();
  });

  it("preserves explicit self navigation and invokes the caller before routing", () => {
    const order: string[] = [];
    const adapter = {
      href: (path: string) => path,
      navigate: () => order.push("route"),
    };
    const { anchor } = renderLink(
      { href: "/markets", target: "_self", onClick: () => order.push("click") },
      adapter,
    );
    anchor.props.onClick?.(click());
    expect(order).toEqual(["click", "route"]);
  });

  it.each([
    "https://example.org/markets",
    "//example.org/markets",
    "#main-content",
    "/unknown",
    "/company/UPPERCASE",
    "/discover?view=watchlist&view=portfolio",
  ])("does not reinterpret a non-workspace destination: %s", (href) => {
    const adapter = navigation();
    const { anchor } = renderLink({ href }, adapter);
    const event = click();
    anchor.props.onClick?.(event);
    expect(anchor.props.href).toBe(href);
    expect(adapter.href).not.toHaveBeenCalled();
    expect(adapter.navigate).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

function renderSkipLink(
  props: ComponentProps<typeof WorkspaceSkipLink>,
): ReactElement<ComponentPropsWithRef<"a">> {
  return WorkspaceSkipLink(props);
}

describe("workspace skip link", () => {
  function skipClick(
    target: object | null,
    overrides: Partial<MouseEvent<HTMLAnchorElement>> = {},
  ) {
    const getElementById = vi.fn(() => target);
    const event = click({
      currentTarget: {
        ownerDocument: { getElementById },
      } as unknown as HTMLAnchorElement,
      ...overrides,
    });
    return { event, getElementById };
  }

  it("focuses and scrolls the main landmark without changing the route fragment", () => {
    const target = { focus: vi.fn(), scrollIntoView: vi.fn() };
    const { event, getElementById } = skipClick(target);
    const anchor = renderSkipLink({
      targetId: "main-content",
      children: "Skip to content",
    });
    expect(renderToStaticMarkup(anchor)).toContain('href="#main-content"');
    anchor.props.onClick?.(event);
    expect(event.preventDefault).toHaveBeenCalledExactlyOnceWith();
    expect(getElementById).toHaveBeenCalledExactlyOnceWith("main-content");
    expect(target.focus).toHaveBeenCalledExactlyOnceWith({
      preventScroll: true,
    });
    expect(target.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      block: "start",
    });
  });

  it("keeps a missing target inert instead of replacing the route fragment", () => {
    const { event, getElementById } = skipClick(null);
    const anchor = renderSkipLink({ targetId: "missing" });
    anchor.props.onClick?.(event);
    expect(event.preventDefault).toHaveBeenCalledExactlyOnceWith();
    expect(getElementById).toHaveBeenCalledExactlyOnceWith("missing");
  });

  it.each([
    { button: 1 },
    { button: 2 },
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
  ])("preserves modified or nonprimary anchor activation: %j", (overrides) => {
    const { event, getElementById } = skipClick(null, overrides);
    renderSkipLink({ targetId: "main-content" }).props.onClick?.(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(getElementById).not.toHaveBeenCalled();
  });

  it.each([{ target: "_blank" }, { download: "content" }])(
    "preserves explicit browser destination behavior: %j",
    (attributes) => {
      const { event, getElementById } = skipClick(null);
      renderSkipLink({
        targetId: "main-content",
        ...attributes,
      }).props.onClick?.(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(getElementById).not.toHaveBeenCalled();
    },
  );

  it("honors a caller that cancels the skip action", () => {
    const { event, getElementById } = skipClick(null);
    renderSkipLink({
      targetId: "main-content",
      onClick: (clickEvent) => clickEvent.preventDefault(),
    }).props.onClick?.(event);
    expect(event.preventDefault).toHaveBeenCalledExactlyOnceWith();
    expect(getElementById).not.toHaveBeenCalled();
  });
});
