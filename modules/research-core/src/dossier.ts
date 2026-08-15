import type {
  DossierDto,
  EvidencePassportDto,
  HistoricalPointDto,
  TimelineEventDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";

import { syntheticFixture } from "./fixture";
import { evaluateMetrics } from "./metric-engine";
import type { FinancialFact, ResearchSnapshot } from "./model";
import {
  getPolicy,
  isRightsAllowed,
  type RightsDecisionContext,
} from "./rights";

export const DEFAULT_KNOWN_AT = "2026-08-15T21:00:00Z";
export const PRE_RESTATEMENT_KNOWN_AT = "2026-04-15T12:00:00Z";
const ISO_UTC_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/;

export interface ResearchSnapshotRepository {
  findBySymbol(symbol: string): Promise<ResearchSnapshot | null>;
}

export interface AuthorizationClock {
  now(): string;
}

const deterministicAuthorizationClock: AuthorizationClock = {
  now: () => DEFAULT_KNOWN_AT,
};

export class GetDossier {
  public constructor(
    private readonly repository: ResearchSnapshotRepository,
    private readonly authorizationClock: AuthorizationClock = deterministicAuthorizationClock,
  ) {}

  public async execute(
    symbol: string,
    knownAt = DEFAULT_KNOWN_AT,
  ): Promise<DossierDto | null> {
    const snapshot = await this.repository.findBySymbol(symbol);
    if (!snapshot) return null;
    assertSyntheticSnapshot(snapshot);
    if (snapshot.instrument.symbol.toUpperCase() !== symbol.toUpperCase()) {
      throw new Error("Repository returned a snapshot for a different symbol.");
    }
    return composeDossier(snapshot, knownAt, this.authorizationClock.now());
  }
}

/**
 * Compatibility wrapper for the current synchronous, in-memory demo API.
 * Persistence adapters should use the repository/use-case seam above.
 */
export function buildDossier(
  symbol: string,
  knownAt = DEFAULT_KNOWN_AT,
): DossierDto | null {
  if (symbol.toUpperCase() !== syntheticFixture.instrument.symbol) return null;
  return composeDossier(syntheticFixture, knownAt);
}

/**
 * Pure deterministic composition for the single synthetic fixture.
 * `authorizationAt` is a trusted server-clock input; request handlers should
 * enter through GetDossier. Fixed history/timeline records move into the
 * snapshot contract before a multi-instrument adapter is allowed.
 */
export function composeDossier(
  snapshot: ResearchSnapshot,
  knownAt = DEFAULT_KNOWN_AT,
  authorizationAt = DEFAULT_KNOWN_AT,
): DossierDto {
  assertSyntheticSnapshot(snapshot);
  assertIsoDateTime(knownAt, "knownAt");
  assertIsoDateTime(snapshot.generatedAt, "snapshot.generatedAt");
  assertIsoDateTime(authorizationAt, "authorizationAt");
  if (Date.parse(knownAt) > Date.parse(snapshot.generatedAt)) {
    throw new RangeError("knownAt cannot be later than snapshot.generatedAt");
  }
  if (Date.parse(snapshot.generatedAt) > Date.parse(authorizationAt)) {
    throw new RangeError(
      "snapshot.generatedAt cannot be later than the trusted authorization clock",
    );
  }

  const displayContext = syntheticDisplayContext(authorizationAt);
  const eligibleFacts = factsAsKnown(
    snapshot.facts.filter(
      (fact) => fact.instrumentId === snapshot.instrument.id,
    ),
    knownAt,
  );
  const displayableEvidence = uniqueEvidence(snapshot.evidence).filter(
    (evidence) =>
      isEvidenceAvailableBy(evidence, knownAt) &&
      isEvidenceDisplayAllowed(snapshot, evidence, displayContext),
  );
  const displayableEvidenceIds = new Set(
    displayableEvidence.map((evidence) => evidence.id),
  );
  const allowedFacts = eligibleFacts.filter((fact) =>
    isFactDisplayAllowed(
      snapshot,
      fact,
      displayContext,
      displayableEvidenceIds,
    ),
  );
  const metrics = evaluateMetrics(allowedFacts);
  const availableEvidenceIds = new Set(
    snapshot.evidence
      .filter((evidence) => isEvidenceAvailableBy(evidence, knownAt))
      .map((evidence) => evidence.id),
  );
  const candidateHistory = buildHistory(eligibleFacts, availableEvidenceIds);
  const history = buildHistory(allowedFacts, displayableEvidenceIds);
  const candidateTimeline = buildTimeline(knownAt);
  const timeline = candidateTimeline.filter((event) =>
    event.evidenceIds.every((id) => displayableEvidenceIds.has(id)),
  );
  const deniedCount =
    eligibleFacts.length -
    allowedFacts.length +
    (candidateHistory.length - history.length) +
    (candidateTimeline.length - timeline.length);
  const hasOmissions = deniedCount > 0;
  const valuationDefaults = buildValuationDefaults(allowedFacts);
  const referencedEvidenceIds = new Set([
    ...metrics.flatMap((metric) => metric.evidenceIds),
    ...history.flatMap((point) => point.evidenceIds),
    ...timeline.flatMap((event) => event.evidenceIds),
    ...valuationDefaults.evidenceIds,
  ]);
  const evidence = displayableEvidence.filter((item) =>
    referencedEvidenceIds.has(item.id),
  );

  const dossier: DossierDto = {
    schemaVersion: "1.0.0",
    dataMode: snapshot.dataMode,
    demoDisclosure:
      "All companies, prices, filings, metrics, and scenarios on this page are deterministic synthetic fixtures for product development—not investment information.",
    requestedKnownAt: new Date(knownAt).toISOString(),
    generatedAt: snapshot.generatedAt,
    instrument: snapshot.instrument,
    metrics,
    history,
    timeline,
    evidence,
    valuationDefaults,
    omissions: {
      hasOmissions,
      count: deniedCount,
      reasonCode: "RIGHTS_DENIED",
      explanation: hasOmissions
        ? "One or more fields were removed by the server-side rights policy before serialization."
        : "No eligible fields were removed for this historical view.",
    },
  };
  return structuredClone(dossier);
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

/** Compatibility wrapper for the current in-memory evidence endpoint. */
export function getEvidencePassport(id: string): EvidencePassportDto | null {
  return getEvidencePassportFromSnapshot(syntheticFixture, id);
}

export function getEvidencePassportFromSnapshot(
  snapshot: ResearchSnapshot,
  id: string,
  authorizationAt = DEFAULT_KNOWN_AT,
): EvidencePassportDto | null {
  assertSyntheticSnapshot(snapshot);
  assertIsoDateTime(snapshot.generatedAt, "snapshot.generatedAt");
  assertIsoDateTime(authorizationAt, "authorizationAt");
  if (Date.parse(snapshot.generatedAt) > Date.parse(authorizationAt)) {
    throw new RangeError(
      "snapshot.generatedAt cannot be later than the trusted authorization clock",
    );
  }
  const matches = snapshot.evidence.filter((item) => item.id === id);
  const [evidence] = matches;
  if (matches.length !== 1 || !evidence) return null;
  return isEvidenceDisplayAllowed(
    snapshot,
    evidence,
    syntheticDisplayContext(authorizationAt),
  ) && isEvidenceAvailableBy(evidence, snapshot.generatedAt)
    ? structuredClone(evidence)
    : null;
}

function factsAsKnown(
  facts: FinancialFact[],
  knownAt: string,
): FinancialFact[] {
  const instant = Date.parse(knownAt);
  const candidates = facts.filter((fact) => {
    const starts =
      Date.parse(fact.systemRecordedFrom) <= instant &&
      Date.parse(fact.publicKnownFrom) <= instant;
    const systemOpen =
      fact.systemRecordedTo === null ||
      instant < Date.parse(fact.systemRecordedTo);
    const publicKnowledgeOpen =
      fact.publicKnownTo === null || instant < Date.parse(fact.publicKnownTo);
    return (
      starts &&
      systemOpen &&
      publicKnowledgeOpen &&
      Date.parse(fact.sourceAvailableAt) <= instant
    );
  });

  const latestByKey = new Map<string, FinancialFact>();
  for (const fact of candidates) {
    const current = latestByKey.get(fact.key);
    if (current)
      throw new Error(`Ambiguous active facts for metric key: ${fact.key}`);
    latestByKey.set(fact.key, fact);
  }
  return [...latestByKey.values()];
}

function buildHistory(
  facts: FinancialFact[],
  displayableEvidenceIds: ReadonlySet<string>,
): HistoricalPointDto[] {
  const currentRevenue = requiredFact(facts, "revenue");
  const currentEbitda = requiredFact(facts, "ebitda");
  const historicEvidence = ["evidence.synthetic.history"];
  const fixed = [
    ["2022", "74.0", "10.4"],
    ["2023", "86.0", "13.8"],
    ["2024", "100.0", "16.5"],
  ] as const;

  const fixedHistory = displayableEvidenceIds.has(historicEvidence[0]!)
    ? fixed.map(([period, revenue, ebitda]) =>
        historyPoint(period, revenue, ebitda, historicEvidence),
      )
    : [];
  return [
    ...fixedHistory,
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

function isFactDisplayAllowed(
  snapshot: ResearchSnapshot,
  fact: FinancialFact,
  context: RightsDecisionContext,
  displayableEvidenceIds: ReadonlySet<string>,
): boolean {
  const policy = getPolicy(
    snapshot.rightsPolicies,
    fact.rightsPolicyId,
    fact.rightsPolicyVersion,
  );
  const requiredUses: RightsDecisionContext[] = [
    context,
    { ...context, purpose: "derive", channel: "api" },
    { ...context, purpose: "alert", channel: "local_alert" },
  ];
  return (
    requiredUses.every((requiredUse) => isRightsAllowed(policy, requiredUse)) &&
    displayableEvidenceIds.has(fact.evidenceId)
  );
}

function uniqueEvidence(
  evidence: EvidencePassportDto[],
): EvidencePassportDto[] {
  const counts = new Map<string, number>();
  for (const item of evidence)
    counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  return evidence.filter((item) => counts.get(item.id) === 1);
}

// A superseded document remains citeable for historical timeline events; its
// linked fact/event interval decides whether the version is current.
function isEvidenceAvailableBy(
  evidence: EvidencePassportDto,
  knownAt: string,
): boolean {
  const instant = Date.parse(knownAt);
  return (
    Date.parse(evidence.availableAt) <= instant &&
    Date.parse(evidence.knownFrom) <= instant
  );
}

function isEvidenceDisplayAllowed(
  snapshot: ResearchSnapshot,
  evidence: EvidencePassportDto,
  context: RightsDecisionContext,
): boolean {
  return isRightsAllowed(
    getPolicy(
      snapshot.rightsPolicies,
      evidence.rightsPolicyId,
      evidence.rightsPolicyVersion,
    ),
    context,
  );
}

function syntheticDisplayContext(evaluatedAt: string): RightsDecisionContext {
  return {
    purpose: "display",
    channel: "api",
    territory: "demo_only",
    evaluatedAt,
  };
}

function assertIsoDateTime(value: string, field: string): void {
  if (typeof value !== "string")
    throw new RangeError(`${field} must be an RFC 3339 date-time`);
  const match = ISO_UTC_PATTERN.exec(value);
  if (!match) throw new RangeError(`${field} must be an RFC 3339 date-time`);
  const canonical = `${match[1]}.${(match[2] ?? "").padEnd(3, "0")}Z`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== canonical)
    throw new RangeError(`${field} must be an RFC 3339 date-time`);
}

function assertSyntheticSnapshot(snapshot: ResearchSnapshot): void {
  const candidate = snapshot as Partial<ResearchSnapshot>;
  if (
    !candidate ||
    candidate.dataMode !== "synthetic" ||
    candidate.instrument?.isSynthetic !== true ||
    typeof candidate.instrument.id !== "string" ||
    typeof candidate.instrument.symbol !== "string" ||
    !Array.isArray(candidate.rightsPolicies) ||
    !candidate.rightsPolicies.every(
      (policy) =>
        policy?.classification === "synthetic" &&
        Array.isArray(policy.grants) &&
        policy.grants.every(
          (grant) =>
            grant !== null &&
            typeof grant === "object" &&
            typeof grant.purpose === "string" &&
            typeof grant.channel === "string" &&
            typeof grant.allowed === "boolean",
        ),
    ) ||
    !Array.isArray(candidate.facts) ||
    !candidate.facts.every(
      (fact) =>
        fact !== null &&
        typeof fact === "object" &&
        typeof fact.instrumentId === "string" &&
        typeof fact.key === "string" &&
        typeof fact.evidenceId === "string" &&
        typeof fact.rightsPolicyId === "string" &&
        typeof fact.rightsPolicyVersion === "string",
    ) ||
    !Array.isArray(candidate.evidence) ||
    !candidate.evidence.every(
      (evidence) =>
        evidence?.synthetic === true &&
        (evidence.sourceType === "synthetic_filing" ||
          evidence.sourceType === "synthetic_price_record"),
    )
  ) {
    throw new Error("Only complete synthetic research snapshots are accepted.");
  }
}
