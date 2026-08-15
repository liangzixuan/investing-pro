import type {
  DossierDto,
  EvidencePassportDto,
  HistoricalPointDto,
  TimelineEventDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";

import { syntheticFixture } from "./fixture";
import { evaluateMetrics } from "./metric-engine";
import type { FinancialFact } from "./model";
import { getPolicy, isPurposeAllowed } from "./rights";

export const DEFAULT_KNOWN_AT = "2026-08-15T21:00:00Z";
export const PRE_RESTATEMENT_KNOWN_AT = "2026-04-15T12:00:00Z";

export function buildDossier(
  symbol: string,
  knownAt = DEFAULT_KNOWN_AT,
): DossierDto | null {
  if (symbol.toUpperCase() !== syntheticFixture.instrument.symbol) return null;
  assertIsoDateTime(knownAt);

  const eligibleFacts = factsAsKnown(syntheticFixture.facts, knownAt);
  const allowedFacts = eligibleFacts.filter((fact) =>
    isPurposeAllowed(
      getPolicy(syntheticFixture.rightsPolicies, fact.rightsPolicyId),
      "display",
    ),
  );
  const deniedCount = eligibleFacts.length - allowedFacts.length;
  const metrics = evaluateMetrics(allowedFacts);
  const history = buildHistory(allowedFacts);
  const timeline = buildTimeline(knownAt);
  const valuationDefaults = buildValuationDefaults(allowedFacts);
  const referencedEvidenceIds = new Set([
    ...metrics.flatMap((metric) => metric.evidenceIds),
    ...history.flatMap((point) => point.evidenceIds),
    ...timeline.flatMap((event) => event.evidenceIds),
    ...valuationDefaults.evidenceIds,
  ]);
  const evidence = syntheticFixture.evidence.filter(
    (item) =>
      referencedEvidenceIds.has(item.id) && isEvidenceDisplayAllowed(item),
  );

  return {
    schemaVersion: "1.0.0",
    dataMode: "synthetic",
    demoDisclosure:
      "All companies, prices, filings, metrics, and scenarios on this page are deterministic synthetic fixtures for product development—not investment information.",
    requestedKnownAt: new Date(knownAt).toISOString(),
    generatedAt: "2026-08-15T21:00:00Z",
    instrument: syntheticFixture.instrument,
    metrics,
    history,
    timeline,
    evidence,
    valuationDefaults,
    omissions: {
      count: deniedCount,
      reasonCode: "RIGHTS_DENIED",
      explanation:
        deniedCount > 0
          ? "One or more fields were removed by the server-side rights policy before serialization."
          : "No eligible fields were removed for this historical view.",
    },
  };
}

function buildValuationDefaults(
  facts: FinancialFact[],
): DossierDto["valuationDefaults"] {
  const revenue = requiredFact(facts, "revenue");
  const cash = requiredFact(facts, "cash");
  const debt = requiredFact(facts, "debt");
  const shares = requiredFact(facts, "diluted_shares");
  return {
    baseRevenue: revenue.value,
    cash: cash.value,
    debt: debt.value,
    dilutedShares: shares.value,
    evidenceIds: [
      ...new Set([
        revenue.evidenceId,
        cash.evidenceId,
        debt.evidenceId,
        shares.evidenceId,
      ]),
    ],
    modelVersion: "exit-multiple-v1",
  };
}

export function getEvidencePassport(id: string): EvidencePassportDto | null {
  const evidence = syntheticFixture.evidence.find((item) => item.id === id);
  return evidence && isEvidenceDisplayAllowed(evidence) ? evidence : null;
}

function factsAsKnown(
  facts: FinancialFact[],
  knownAt: string,
): FinancialFact[] {
  const instant = Date.parse(knownAt);
  const candidates = facts.filter((fact) => {
    const starts =
      Date.parse(fact.systemFrom) <= instant &&
      Date.parse(fact.effectiveFrom) <= instant;
    const systemOpen =
      fact.systemTo === null || instant < Date.parse(fact.systemTo);
    const effectiveOpen =
      fact.effectiveTo === null || instant < Date.parse(fact.effectiveTo);
    return (
      starts &&
      systemOpen &&
      effectiveOpen &&
      Date.parse(fact.availableAt) <= instant
    );
  });

  const latestByKey = new Map<string, FinancialFact>();
  for (const fact of candidates) {
    const current = latestByKey.get(fact.key);
    if (!current || current.systemFrom < fact.systemFrom)
      latestByKey.set(fact.key, fact);
  }
  return [...latestByKey.values()];
}

function buildHistory(facts: FinancialFact[]): HistoricalPointDto[] {
  const currentRevenue = requiredFact(facts, "revenue");
  const currentEbitda = requiredFact(facts, "ebitda");
  const historicEvidence = ["evidence.synthetic.history"];
  const fixed = [
    ["2022", "74.0", "10.4"],
    ["2023", "86.0", "13.8"],
    ["2024", "100.0", "16.5"],
  ] as const;

  return [
    ...fixed.map(([period, revenue, ebitda]) =>
      historyPoint(period, revenue, ebitda, historicEvidence),
    ),
    historyPoint("2025", currentRevenue.value, currentEbitda.value, [
      currentRevenue.evidenceId,
      currentEbitda.evidenceId,
    ]),
  ];
}

function historyPoint(
  period: string,
  revenue: string,
  ebitda: string,
  evidenceIds: string[],
): HistoricalPointDto {
  return {
    period,
    revenue,
    ebitda,
    revenueDisplay: `$${new Decimal(revenue).toFixed(1)}M`,
    ebitdaDisplay: `$${new Decimal(ebitda).toFixed(1)}M`,
    evidenceIds: [...new Set(evidenceIds)],
  };
}

function buildTimeline(knownAt: string): TimelineEventDto[] {
  const allEvents: TimelineEventDto[] = [
    {
      id: "timeline.original-filing",
      occurredAt: "2026-02-20T14:30:00Z",
      kind: "filing",
      title: "Original synthetic annual record",
      summary:
        "Initial 2025 fixture became available to the demo research system.",
      evidenceIds: ["evidence.synthetic.2025-original"],
    },
    {
      id: "timeline.restatement",
      occurredAt: "2026-05-10T12:00:00Z",
      kind: "restatement",
      title: "Synthetic revenue recognition restatement",
      summary:
        "Revenue, EBITDA, and free cash flow were revised for the 2025 fixture period.",
      evidenceIds: ["evidence.synthetic.2025-restated"],
    },
  ];
  const instant = Date.parse(knownAt);
  return allEvents.filter((event) => Date.parse(event.occurredAt) <= instant);
}

function requiredFact(facts: FinancialFact[], key: string): FinancialFact {
  const fact = facts.find((candidate) => candidate.key === key);
  if (!fact)
    throw new Error(`Synthetic fixture is missing required fact: ${key}`);
  return fact;
}

function isEvidenceDisplayAllowed(evidence: EvidencePassportDto): boolean {
  return isPurposeAllowed(
    getPolicy(syntheticFixture.rightsPolicies, evidence.rightsPolicyId),
    "display",
  );
}

function assertIsoDateTime(value: string): void {
  if (!value.includes("T") || Number.isNaN(Date.parse(value))) {
    throw new RangeError("knownAt must be an RFC 3339 date-time");
  }
}
