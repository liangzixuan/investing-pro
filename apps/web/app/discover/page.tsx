import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SecurityDiscoveryWorkspace } from "@/features/research/SecurityDiscoveryWorkspace";
import {
  isPersonalWorkspaceWebMode,
  resolveOwnerAuthMode,
} from "@/lib/web-mode";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research Cockpit — Personal Research",
  description:
    "Personal company research, financial screening and comparisons.",
};

export default function SecurityDiscoveryPage() {
  if (!isPersonalWorkspaceWebMode(process.env.RESEARCH_COCKPIT_WEB_MODE)) {
    notFound();
  }
  return (
    <SecurityDiscoveryWorkspace
      authMode={resolveOwnerAuthMode(process.env.RESEARCH_COCKPIT_WEB_AUTH)}
    />
  );
}
