"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SecurityDiscoveryWorkspace } from "../research/SecurityDiscoveryWorkspace";
import { MarketsHome } from "../markets/MarketsHome";
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
    <SecurityDiscoveryWorkspace
      authMode={authMode}
      route={route}
      onNavigate={(href) => router.push(href, { scroll: false })}
      renderMarkets={(props) => <MarketsHome {...props} />}
    />
  );
}
