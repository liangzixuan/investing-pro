"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PersonalWorkspaceClient } from "./PersonalWorkspaceClient";
import { parseWorkspaceRoute } from "./workspace-route";

export function PersonalWorkspaceRoutes({
  authMode,
}: {
  readonly authMode: "account" | "bootstrap" | "local";
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const route = parseWorkspaceRoute(pathname, search.get("view"));
  return (
    <PersonalWorkspaceClient
      authMode={authMode}
      route={route}
      navigation={{
        href: (path) => path,
        navigate: (path) => router.push(path, { scroll: false }),
      }}
    />
  );
}
