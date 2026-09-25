export type WorkspaceTask =
  "discover" | "screens" | "watchlist" | "portfolio" | "updates";
export type WorkspaceRoute =
  | Readonly<{ kind: "markets" }>
  | Readonly<{ kind: "discover"; task: WorkspaceTask }>
  | Readonly<{ kind: "company"; listingId: string }>
  | Readonly<{ kind: "invalid" }>;

const tasks: readonly string[] = [
  "discover",
  "screens",
  "watchlist",
  "portfolio",
  "updates",
];
export function parseWorkspaceRoute(
  pathname: string,
  view: string | null,
): WorkspaceRoute {
  if (pathname === "/markets") return { kind: "markets" };
  if (pathname === "/discover") {
    return view === null || tasks.includes(view)
      ? { kind: "discover", task: (view ?? "discover") as WorkspaceTask }
      : { kind: "invalid" };
  }
  const match = /^\/company\/([^/]+)$/u.exec(pathname);
  if (match?.[1] !== undefined) {
    try {
      const listingId = decodeURIComponent(match[1]);
      if (
        /^[a-z0-9][a-z0-9._:-]{2,127}$/u.test(listingId) &&
        encodeURIComponent(listingId) === match[1]
      )
        return { kind: "company", listingId };
    } catch {
      /* An invalid URL cannot select an identity. */
    }
  }
  return { kind: "invalid" };
}
export function workspaceTaskHref(task: WorkspaceTask | "markets"): string {
  if (task === "markets") return "/markets";
  return task === "discover" ? "/discover" : `/discover?view=${task}`;
}
export function companyHref(listingId: string): string {
  return `/company/${encodeURIComponent(listingId)}`;
}
export function workspaceRouteKey(route: WorkspaceRoute): string {
  return route.kind === "company"
    ? companyHref(route.listingId)
    : route.kind === "discover"
      ? workspaceTaskHref(route.task)
      : route.kind;
}
