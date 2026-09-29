"use client";

import { MarketsHome } from "../markets/MarketsHome";
import { SecurityDiscoveryWorkspace } from "../research/SecurityDiscoveryWorkspace";
import {
  WorkspaceNavigationProvider,
  type WorkspaceNavigation,
} from "./WorkspaceNavigation";
import type { WorkspaceRoute } from "./workspace-route";

export interface PersonalWorkspaceClientProps {
  readonly authMode: "account" | "bootstrap" | "local";
  readonly route: WorkspaceRoute;
  readonly navigation: WorkspaceNavigation;
}

export function PersonalWorkspaceClient({
  authMode,
  route,
  navigation,
}: PersonalWorkspaceClientProps) {
  return (
    <WorkspaceNavigationProvider navigation={navigation}>
      <SecurityDiscoveryWorkspace
        authMode={authMode}
        route={route}
        onNavigate={navigation.navigate}
        renderMarkets={(props) => <MarketsHome {...props} />}
      />
    </WorkspaceNavigationProvider>
  );
}
