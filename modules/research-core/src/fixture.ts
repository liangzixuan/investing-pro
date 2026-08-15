import type { SyntheticFixture } from "./model";

const PUBLIC_POLICY_ID = "rights.synthetic.display.v1";
const RESTRICTED_POLICY_ID = "rights.synthetic.restricted.v1";

export const syntheticFixture: SyntheticFixture = {
  instrument: {
    id: "instrument.synthetic.syn1",
    symbol: "SYN1",
    name: "Northwind Robotics",
    description:
      "A fictional industrial-automation company created solely to exercise the research workflow.",
    exchangeLabel: "Synthetic Exchange",
    sector: "Industrials",
    industry: "Industrial automation",
    country: "United States",
    currency: "USD",
    isSynthetic: true,
  },
  rightsPolicies: [
    {
      id: PUBLIC_POLICY_ID,
      version: "1.0.0",
      classification: "synthetic",
      allowedPurposes: ["display", "derive", "alert"],
      channels: ["api", "web", "local_alert"],
      territory: "demo_only",
      expiresAt: null,
    },
    {
      id: RESTRICTED_POLICY_ID,
      version: "1.0.0",
      classification: "synthetic",
      allowedPurposes: [],
      channels: [],
      territory: "demo_only",
      expiresAt: null,
    },
  ],
  evidence: [
    {
      id: "evidence.synthetic.history",
      title: "Synthetic historical series record",
      sourceType: "synthetic_filing",
      documentId: "SYN1-DEMO-HISTORY",
      locator: "Generated fixture series",
      excerpt:
        "Synthetic historical revenue and EBITDA series were generated for 2022 through 2024.",
      contentHash:
        "sha256:98f886f691fd3a888eea95326dbec6c359cc9ac2a63ba475a8d224522bfc7971",
      availableAt: "2025-02-20T14:30:00Z",
      knownFrom: "2025-02-20T14:30:00Z",
      knownTo: null,
      rightsPolicyId: PUBLIC_POLICY_ID,
      rightsPolicyVersion: "1.0.0",
      synthetic: true,
    },
    {
      id: "evidence.synthetic.2024-report",
      title: "Synthetic 2024 annual record",
      sourceType: "synthetic_filing",
      documentId: "SYN1-DEMO-2024",
      locator: "Financial summary, line 12",
      excerpt: "For the year ended 2024, synthetic revenue was $100.0 million.",
      contentHash:
        "sha256:d9a7f30b4dc3a3352b937c59d5170d6169be5d66fe17aff516840c451023d1a7",
      availableAt: "2025-02-20T14:30:00Z",
      knownFrom: "2025-02-20T14:30:00Z",
      knownTo: null,
      rightsPolicyId: PUBLIC_POLICY_ID,
      rightsPolicyVersion: "1.0.0",
      synthetic: true,
    },
    {
      id: "evidence.synthetic.2025-original",
      title: "Original synthetic 2025 annual record",
      sourceType: "synthetic_filing",
      documentId: "SYN1-DEMO-2025-ORIGINAL",
      locator: "Financial summary, lines 12–18",
      excerpt:
        "For the year ended 2025, revenue was $120.0 million and adjusted EBITDA was $21.6 million.",
      contentHash:
        "sha256:9efe337e8573729a7a290e16cbdb7dccb50d4a381879a1a24ede7b101970bed6",
      availableAt: "2026-02-20T14:30:00Z",
      knownFrom: "2026-02-20T14:30:00Z",
      knownTo: "2026-05-10T12:00:00Z",
      rightsPolicyId: PUBLIC_POLICY_ID,
      rightsPolicyVersion: "1.0.0",
      synthetic: true,
    },
    {
      id: "evidence.synthetic.2025-restated",
      title: "Restated synthetic 2025 annual record",
      sourceType: "synthetic_filing",
      documentId: "SYN1-DEMO-2025-RESTATED",
      locator: "Restatement note, lines 4–11",
      excerpt:
        "Following a contract-timing review, 2025 revenue was restated to $116.4 million and adjusted EBITDA to $18.624 million.",
      contentHash:
        "sha256:fb73eac6d9e700673235359bce1f568f2be48795bb2c7f793134626e568318ba",
      availableAt: "2026-05-10T12:00:00Z",
      knownFrom: "2026-05-10T12:00:00Z",
      knownTo: null,
      rightsPolicyId: PUBLIC_POLICY_ID,
      rightsPolicyVersion: "1.0.0",
      synthetic: true,
    },
    {
      id: "evidence.synthetic.balance-sheet",
      title: "Synthetic balance-sheet record",
      sourceType: "synthetic_filing",
      documentId: "SYN1-DEMO-2025-BALANCE",
      locator: "Balance sheet, lines 3 and 17",
      excerpt: "Synthetic cash was $24.0 million and debt was $40.0 million.",
      contentHash:
        "sha256:563aeb294751775d6374d3c446e528755b340a5b782424e51f3a6a0c314641b3",
      availableAt: "2026-02-20T14:30:00Z",
      knownFrom: "2026-02-20T14:30:00Z",
      knownTo: null,
      rightsPolicyId: PUBLIC_POLICY_ID,
      rightsPolicyVersion: "1.0.0",
      synthetic: true,
    },
    {
      id: "evidence.synthetic.share-record",
      title: "Synthetic diluted-share record",
      sourceType: "synthetic_filing",
      documentId: "SYN1-DEMO-2025-SHARES",
      locator: "Per-share note, line 6",
      excerpt: "Synthetic diluted shares were 25.0 million.",
      contentHash:
        "sha256:4fe6d1c4db7dcfa923ed8ef28d99dc071e61da12ff80efc6fb78f8c4c807b8dc",
      availableAt: "2026-02-20T14:30:00Z",
      knownFrom: "2026-02-20T14:30:00Z",
      knownTo: null,
      rightsPolicyId: PUBLIC_POLICY_ID,
      rightsPolicyVersion: "1.0.0",
      synthetic: true,
    },
    {
      id: "evidence.synthetic.price",
      title: "Synthetic closing-price record",
      sourceType: "synthetic_price_record",
      documentId: "SYN1-DEMO-PRICE-2026-08-15",
      locator: "Synthetic close",
      excerpt:
        "Synthetic closing price was $42.80 per share on the demo as-of date.",
      contentHash:
        "sha256:cc89bcb0a97ebbbec0648301efb7930c90a5ec0a962dcd11c3d3ec0730aa864a",
      availableAt: "2026-08-15T21:00:00Z",
      knownFrom: "2026-08-15T21:00:00Z",
      knownTo: null,
      rightsPolicyId: PUBLIC_POLICY_ID,
      rightsPolicyVersion: "1.0.0",
      synthetic: true,
    },
    {
      id: "evidence.synthetic.restricted-estimate",
      title: "Restricted synthetic estimate",
      sourceType: "synthetic_filing",
      documentId: "SYN1-RESTRICTED-ESTIMATE",
      locator: "Internal fixture",
      excerpt:
        "The synthetic vendor estimate is $135.0 million and is prohibited from display.",
      contentHash:
        "sha256:dd7d31da3db956fa4f7a106931c239a2dd25c5a6227e135588e2497d85c76582",
      availableAt: "2026-08-15T21:00:00Z",
      knownFrom: "2026-08-15T21:00:00Z",
      knownTo: null,
      rightsPolicyId: RESTRICTED_POLICY_ID,
      rightsPolicyVersion: "1.0.0",
      synthetic: true,
    },
  ],
  facts: [
    {
      id: "fact.revenue.2024",
      instrumentId: "instrument.synthetic.syn1",
      key: "prior_revenue",
      value: "100.0",
      unit: "USD_MILLIONS",
      periodEnd: "2024-12-31",
      effectiveFrom: "2025-02-20T14:30:00Z",
      effectiveTo: null,
      systemFrom: "2025-02-20T14:30:00Z",
      systemTo: null,
      availableAt: "2025-02-20T14:30:00Z",
      evidenceId: "evidence.synthetic.2024-report",
      rightsPolicyId: PUBLIC_POLICY_ID,
      qualityState: "verified_fixture",
    },
    ...financialVersion(
      "original",
      "2026-02-20T14:30:00Z",
      "2026-05-10T12:00:00Z",
      {
        revenue: "120.0",
        ebitda: "21.6",
        free_cash_flow: "14.4",
      },
    ),
    ...financialVersion("restated", "2026-05-10T12:00:00Z", null, {
      revenue: "116.4",
      ebitda: "18.624",
      free_cash_flow: "12.804",
    }),
    staticFact(
      "cash",
      "24.0",
      "USD_MILLIONS",
      "evidence.synthetic.balance-sheet",
    ),
    staticFact(
      "debt",
      "40.0",
      "USD_MILLIONS",
      "evidence.synthetic.balance-sheet",
    ),
    staticFact(
      "diluted_shares",
      "25.0",
      "MILLIONS_SHARES",
      "evidence.synthetic.share-record",
    ),
    {
      ...staticFact(
        "synthetic_price",
        "42.80",
        "USD_PER_SHARE",
        "evidence.synthetic.price",
      ),
      availableAt: "2026-08-15T21:00:00Z",
      effectiveFrom: "2026-08-15T21:00:00Z",
      systemFrom: "2026-08-15T21:00:00Z",
    },
    {
      ...staticFact(
        "restricted_forward_revenue_estimate",
        "135.0",
        "USD_MILLIONS",
        "evidence.synthetic.restricted-estimate",
      ),
      rightsPolicyId: RESTRICTED_POLICY_ID,
      availableAt: "2026-08-15T21:00:00Z",
      effectiveFrom: "2026-08-15T21:00:00Z",
      systemFrom: "2026-08-15T21:00:00Z",
    },
  ],
};

function financialVersion(
  version: "original" | "restated",
  knownFrom: string,
  knownTo: string | null,
  values: Record<"revenue" | "ebitda" | "free_cash_flow", string>,
) {
  const evidenceId = `evidence.synthetic.2025-${version}`;
  return Object.entries(values).map(([key, value]) => ({
    id: `fact.${key}.2025.${version}`,
    instrumentId: "instrument.synthetic.syn1",
    key,
    value,
    unit: "USD_MILLIONS" as const,
    periodEnd: "2025-12-31",
    effectiveFrom: knownFrom,
    effectiveTo: knownTo,
    systemFrom: knownFrom,
    systemTo: knownTo,
    availableAt: knownFrom,
    evidenceId,
    rightsPolicyId: PUBLIC_POLICY_ID,
    qualityState:
      version === "restated"
        ? ("restated_fixture" as const)
        : ("verified_fixture" as const),
  }));
}

function staticFact(
  key: string,
  value: string,
  unit: "USD_MILLIONS" | "USD_PER_SHARE" | "MILLIONS_SHARES",
  evidenceId: string,
) {
  return {
    id: `fact.${key}.2025`,
    instrumentId: "instrument.synthetic.syn1",
    key,
    value,
    unit,
    periodEnd: "2025-12-31",
    effectiveFrom: "2026-02-20T14:30:00Z",
    effectiveTo: null,
    systemFrom: "2026-02-20T14:30:00Z",
    systemTo: null,
    availableAt: "2026-02-20T14:30:00Z",
    evidenceId,
    rightsPolicyId: PUBLIC_POLICY_ID,
    qualityState: "verified_fixture" as const,
  };
}
