import { DEFAULT_KNOWN_AT } from "@research-cockpit/research-core";

import { ResearchWorkspace } from "@/features/research/ResearchWorkspace";

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
  return (
    <ResearchWorkspace
      symbol={symbol.toUpperCase()}
      initialKnownAt={rawKnownAt ?? DEFAULT_KNOWN_AT}
    />
  );
}
