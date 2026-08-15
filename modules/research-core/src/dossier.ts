import type {
  DossierDto,
  EvidencePassportDto,
  HistoricalPointDto,
  TimelineEventDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";

import { syntheticFixture } from "./fixture";
import { evaluateMetrics } from "./metric-engine";
import type {
  FinancialFact,
  HistoricalPointRecord,
  ResearchSnapshot,
  TimelineEventRecord,
} from "./model";
import {
  getPolicy,
  isRightsAllowed,
  type RightsDecisionContext,
} from "./rights";

export const DEFAULT_KNOWN_AT = "2026-08-15T21:00:00Z";
export const PRE_RESTATEMENT_KNOWN_AT = "2026-04-15T12:00:00Z";
const ISO_UTC_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/;

/**
 * Closed, complete-synthetic-fixture seam for the current demo only.
 * PostgreSQL/RLS adapters must use OperationScopedProjectionSource instead.
 */
export interface CompleteSyntheticSnapshotRepository {
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
    private readonly repository: CompleteSyntheticSnapshotRepository,
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
 * Database adapters must not implement the complete-fixture seam above.
 */
export function buildDossier(
  symbol: string,
  knownAt = DEFAULT_KNOWN_AT,
): DossierDto | null {
  if (symbol.toUpperCase() !== syntheticFixture.instrument.symbol) return null;
  return composeDossier(syntheticFixture, knownAt);
}

/**
 * Pure deterministic composition for a synthetic instrument snapshot.
 * `authorizationAt` is a trusted server-clock input; request handlers should
 * enter through GetDossier. The composer only projects history and timeline
 * records supplied by that snapshot.
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
  const evidenceOrder = instrumentEvidenceOrder(snapshot);
  const boundEvidenceIds = new Set(evidenceOrder.keys());
  const displayableEvidence = uniqueEvidence(snapshot.evidence).filter(
    (evidence) =>
      boundEvidenceIds.has(evidence.id) &&
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
  const eligibleHistoryRecords = historicalPointsAsKnown(
    snapshot.historicalPoints.filter(
      (point) => point.instrumentId === snapshot.instrument.id,
    ),
    knownAt,
  );
  const history = eligibleHistoryRecords
    .filter((point) =>
      point.evidenceIds.every((id) => displayableEvidenceIds.has(id)),
    )
    .map(toHistoricalPointDto);
  const candidateTimeline = timelineEventsAsKnown(
    snapshot.timelineEvents.filter(
      (event) => event.instrumentId === snapshot.instrument.id,
    ),
    knownAt,
  );
  const timeline = candidateTimeline
    .filter((event) =>
      event.evidenceIds.every((id) => displayableEvidenceIds.has(id)),
    )
    .map(toTimelineEventDto);
  const deniedCount =
    eligibleFacts.length -
    allowedFacts.length +
    (eligibleHistoryRecords.length - history.length) +
    (candidateTimeline.length - timeline.length);
  const hasOmissions = deniedCount > 0;
  const valuationDefaults = buildValuationDefaults(allowedFacts);
  const referencedEvidenceIds = new Set([
    ...metrics.flatMap((metric) => metric.evidenceIds),
    ...history.flatMap((point) => point.evidenceIds),
    ...timeline.flatMap((event) => event.evidenceIds),
    ...valuationDefaults.evidenceIds,
  ]);
  const evidence = displayableEvidence
    .filter((item) => referencedEvidenceIds.has(item.id))
    .sort(
      (left, right) =>
        (evidenceOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (evidenceOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
        compareStrings(left.id, right.id),
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
  if (!instrumentEvidenceOrder(snapshot).has(id)) return null;
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

function toHistoricalPointDto(
  point: HistoricalPointRecord,
): HistoricalPointDto {
  return {
    period: point.period,
    revenue: point.revenue,
    ebitda: point.ebitda,
    revenueDisplay: `$${new Decimal(point.revenue).toFixed(1)}M`,
    ebitdaDisplay: `$${new Decimal(point.ebitda).toFixed(1)}M`,
    evidenceIds: [...new Set(point.evidenceIds)],
  };
}

function historicalPointsAsKnown(
  points: HistoricalPointRecord[],
  knownAt: string,
): HistoricalPointRecord[] {
  const instant = Date.parse(knownAt);
  const candidates = points.filter((point) => {
    const starts =
      Date.parse(point.systemRecordedFrom) <= instant &&
      Date.parse(point.publicKnownFrom) <= instant;
    const systemOpen =
      point.systemRecordedTo === null ||
      instant < Date.parse(point.systemRecordedTo);
    const publicKnowledgeOpen =
      point.publicKnownTo === null || instant < Date.parse(point.publicKnownTo);
    return (
      starts &&
      systemOpen &&
      publicKnowledgeOpen &&
      Date.parse(point.sourceAvailableAt) <= instant
    );
  });

  const uniqueByPeriod = new Map<string, HistoricalPointRecord>();
  const identifiers = new Set<string>();
  for (const point of candidates) {
    if (identifiers.has(point.id))
      throw new Error(`Ambiguous historical point identifier: ${point.id}`);
    if (uniqueByPeriod.has(point.period))
      throw new Error(
        `Ambiguous active historical points for period: ${point.period}`,
      );
    identifiers.add(point.id);
    uniqueByPeriod.set(point.period, point);
  }
  return [...uniqueByPeriod.values()].sort(
    (left, right) =>
      compareStrings(left.period, right.period) ||
      compareStrings(left.id, right.id),
  );
}

function timelineEventsAsKnown(
  events: TimelineEventRecord[],
  knownAt: string,
): TimelineEventRecord[] {
  const instant = Date.parse(knownAt);
  const candidates = events.filter(
    (event) => Date.parse(event.occurredAt) <= instant,
  );
  const identifiers = new Set<string>();
  for (const event of candidates) {
    if (identifiers.has(event.id))
      throw new Error(`Ambiguous timeline event identifier: ${event.id}`);
    identifiers.add(event.id);
  }
  return candidates.sort(
    (left, right) =>
      compareStrings(left.occurredAt, right.occurredAt) ||
      compareStrings(left.id, right.id),
  );
}

function toTimelineEventDto(event: TimelineEventRecord): TimelineEventDto {
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    kind: event.kind,
    title: event.title,
    summary: event.summary,
    evidenceIds: [...new Set(event.evidenceIds)],
  };
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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

function instrumentEvidenceOrder(
  snapshot: ResearchSnapshot,
): ReadonlyMap<string, number> {
  return new Map(
    snapshot.evidenceBindings
      .filter((binding) => binding.instrumentId === snapshot.instrument.id)
      .map((binding) => [binding.evidenceId, binding.projectionOrder]),
  );
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
    ) ||
    !Array.isArray(candidate.evidenceBindings) ||
    !hasValidEvidenceBindings(candidate.evidenceBindings) ||
    !Array.isArray(candidate.historicalPoints) ||
    !candidate.historicalPoints.every(
      (point) =>
        point !== null &&
        typeof point === "object" &&
        typeof point.id === "string" &&
        typeof point.instrumentId === "string" &&
        point.synthetic === true &&
        typeof point.period === "string" &&
        typeof point.revenue === "string" &&
        typeof point.ebitda === "string" &&
        typeof point.sourceAvailableAt === "string" &&
        typeof point.publicKnownFrom === "string" &&
        (point.publicKnownTo === null ||
          typeof point.publicKnownTo === "string") &&
        typeof point.systemRecordedFrom === "string" &&
        (point.systemRecordedTo === null ||
          typeof point.systemRecordedTo === "string") &&
        isNonEmptyUniqueStringArray(point.evidenceIds),
    ) ||
    !Array.isArray(candidate.timelineEvents) ||
    !candidate.timelineEvents.every(
      (event) =>
        event !== null &&
        typeof event === "object" &&
        typeof event.id === "string" &&
        typeof event.instrumentId === "string" &&
        event.synthetic === true &&
        typeof event.occurredAt === "string" &&
        (event.kind === "filing" || event.kind === "restatement") &&
        typeof event.title === "string" &&
        typeof event.summary === "string" &&
        isNonEmptyUniqueStringArray(event.evidenceIds),
    )
  ) {
    throw new Error("Only complete synthetic research snapshots are accepted.");
  }
}

function isNonEmptyUniqueStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const identifiers = new Set<string>();
  for (const identifier of value) {
    if (
      typeof identifier !== "string" ||
      identifier.trim().length === 0 ||
      identifiers.has(identifier)
    )
      return false;
    identifiers.add(identifier);
  }
  return true;
}

function hasValidEvidenceBindings(
  value: ResearchSnapshot["evidenceBindings"],
): boolean {
  const keys = new Set<string>();
  const orderKeys = new Set<string>();
  for (const binding of value) {
    if (
      binding === null ||
      typeof binding !== "object" ||
      typeof binding.instrumentId !== "string" ||
      binding.instrumentId.trim().length === 0 ||
      typeof binding.evidenceId !== "string" ||
      binding.evidenceId.trim().length === 0 ||
      !Number.isSafeInteger(binding.projectionOrder) ||
      binding.projectionOrder < 0 ||
      binding.synthetic !== true
    )
      return false;
    const key = `${binding.instrumentId}\u0000${binding.evidenceId}`;
    const orderKey = `${binding.instrumentId}\u0000${binding.projectionOrder}`;
    if (keys.has(key) || orderKeys.has(orderKey)) return false;
    keys.add(key);
    orderKeys.add(orderKey);
  }
  return true;
}
