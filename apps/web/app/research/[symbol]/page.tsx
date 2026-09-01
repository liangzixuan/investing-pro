import { redirect } from "next/navigation";

import { isPersonalDossierWebMode, isPersonalWebMode } from "@/lib/web-mode";

interface ResearchPageProps {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ knownAt?: string | string[] }>;
}

export default async function ResearchPage({
  params,
  searchParams,
}: ResearchPageProps) {
  const configuredMode = process.env.RESEARCH_COCKPIT_WEB_MODE;
  if (isPersonalDossierWebMode(configuredMode)) {
    redirect("/personal");
  }

  const [{ symbol }, query, { DEFAULT_KNOWN_AT }, { ResearchWorkspace }] =
    await Promise.all([
      params,
      searchParams,
      import("@research-cockpit/research-core"),
      import("@/features/research/ResearchWorkspace"),
    ]);
  const rawKnownAt = Array.isArray(query.knownAt)
    ? query.knownAt[0]
    : query.knownAt;
  return (
    <ResearchWorkspace
      symbol={symbol.toUpperCase()}
      initialKnownAt={rawKnownAt ?? DEFAULT_KNOWN_AT}
      personalMode={isPersonalWebMode(configuredMode)}
    />
  );
}
