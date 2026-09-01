import { DEFAULT_KNOWN_AT } from "@research-cockpit/research-core";

import { ResearchWorkspace } from "@/features/research/ResearchWorkspace";
import { isPersonalWebMode } from "@/lib/web-mode";

interface ResearchPageProps {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ knownAt?: string | string[] }>;
}

export default async function ResearchPage({
  params,
  searchParams,
}: ResearchPageProps) {
  const [{ symbol }, query] = await Promise.all([params, searchParams]);
  const rawKnownAt = Array.isArray(query.knownAt)
    ? query.knownAt[0]
    : query.knownAt;
  const personalMode = isPersonalWebMode(process.env.RESEARCH_COCKPIT_WEB_MODE);
  return (
    <ResearchWorkspace
      symbol={symbol.toUpperCase()}
      initialKnownAt={rawKnownAt ?? DEFAULT_KNOWN_AT}
      personalMode={personalMode}
    />
  );
}
