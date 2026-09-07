import { notFound } from "next/navigation";

import { SecurityDiscoveryWorkspace } from "@/features/research/SecurityDiscoveryWorkspace";
import { isPersonalWorkspaceWebMode } from "@/lib/web-mode";

export const dynamic = "force-dynamic";

export default function SecurityDiscoveryPage() {
  if (!isPersonalWorkspaceWebMode(process.env.RESEARCH_COCKPIT_WEB_MODE)) {
    notFound();
  }
  return <SecurityDiscoveryWorkspace />;
}
