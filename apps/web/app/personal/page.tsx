import { notFound } from "next/navigation";

import { PersonalResearchWorkspace } from "@/features/research/PersonalResearchWorkspace";
import { isPersonalDossierWebMode } from "@/lib/web-mode";

export const dynamic = "force-dynamic";

export default function PersonalResearchPage() {
  if (!isPersonalDossierWebMode(process.env.RESEARCH_COCKPIT_WEB_MODE)) {
    notFound();
  }
  return <PersonalResearchWorkspace />;
}
