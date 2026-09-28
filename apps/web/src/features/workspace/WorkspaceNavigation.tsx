"use client";

import {
  createContext,
  useContext,
  type ComponentPropsWithRef,
  type ReactNode,
} from "react";
import { parseWorkspaceRoute, workspaceRouteKey } from "./workspace-route";

export interface WorkspaceNavigation {
  readonly href: (path: string) => string;
  readonly navigate: (path: string) => void;
}

const NavigationContext = createContext<WorkspaceNavigation | null>(null);

export function WorkspaceNavigationProvider({
  navigation,
  children,
}: {
  readonly navigation: WorkspaceNavigation;
  readonly children: ReactNode;
}) {
  return (
    <NavigationContext.Provider value={navigation}>
      {children}
    </NavigationContext.Provider>
  );
}

export type WorkspaceLinkProps = ComponentPropsWithRef<"a"> & {
  readonly href: string;
};

export function WorkspaceLink({
  href,
  onClick,
  ...attributes
}: WorkspaceLinkProps) {
  const navigation = useContext(NavigationContext);
  const internal = isWorkspaceHref(href);
  return (
    <a
      {...attributes}
      href={internal && navigation !== null ? navigation.href(href) : href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          navigation === null ||
          !internal ||
          event.button !== 0 ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          attributes.download !== undefined ||
          (attributes.target !== undefined && attributes.target !== "_self")
        )
          return;
        event.preventDefault();
        navigation.navigate(href);
      }}
    />
  );
}

export function WorkspaceSkipLink({
  targetId,
  onClick,
  ...attributes
}: Omit<WorkspaceLinkProps, "href"> & { readonly targetId: string }) {
  return (
    <a
      {...attributes}
      href={`#${targetId}`}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          attributes.download !== undefined ||
          (attributes.target !== undefined && attributes.target !== "_self")
        )
          return;
        event.preventDefault();
        const target =
          event.currentTarget.ownerDocument.getElementById(targetId);
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "start" });
      }}
    />
  );
}

function isWorkspaceHref(href: string): boolean {
  if (!href.startsWith("/")) return false;
  const queryStart = href.indexOf("?");
  const pathname = queryStart < 0 ? href : href.slice(0, queryStart);
  const query = queryStart < 0 ? "" : href.slice(queryStart + 1);
  const route = parseWorkspaceRoute(
    pathname,
    new URLSearchParams(query).get("view"),
  );
  return (
    route.kind !== "invalid" &&
    (route.kind === "markets" ? "/markets" : workspaceRouteKey(route)) === href
  );
}
