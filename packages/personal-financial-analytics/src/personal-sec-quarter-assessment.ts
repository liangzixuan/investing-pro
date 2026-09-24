import {
  isPersonalSecQuarterAssessmentInput,
  PERSONAL_SEC_QUARTERLY_CONCEPTS,
  type AssessmentReason,
  type PersonalSecQuarterAssessmentInputDto,
  type PersonalSecQuarterCompanyFactDto,
  type PersonalSecQuarterConceptDecisionDto,
  type PersonalSecQuarterEngineResultDto,
  type PersonalSecQuarterMembershipDto,
  type PersonalSecQuarterMetricDecisionDto,
  type PersonalSecQuarterPairDecisionDto,
  type PersonalSecQuarterWitnessDto,
  type QuarterPrimaryOccurrence,
} from "@research-cockpit/contracts";
import {
  canonicalQuarterDecimal,
  QuarterProfiles,
  quarterDate,
  readQuarterContext,
  readQuarterUnit,
  supportedGaap,
} from "./personal-sec-quarter-profiles";

const TTM = { status: "unavailable", reason: "source_not_admitted" } as const;
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
type Concept = PersonalSecQuarterConceptDecisionDto["concept"];
type Membership = PersonalSecQuarterMembershipDto;

/** One selected as-filed quarter. This function neither acquires sources nor authorizes TTM. */
export function assessPersonalSecQuarterEvidence(
  input: PersonalSecQuarterAssessmentInputDto,
): PersonalSecQuarterEngineResultDto {
  try {
    if (
      !isPersonalSecQuarterAssessmentInput(input) ||
      input.evidence.primary.status !== "complete"
    )
      return invalid();
    const profiles = new QuarterProfiles(input);
    const witnesses: PersonalSecQuarterWitnessDto[] = [];
    const concepts = PERSONAL_SEC_QUARTERLY_CONCEPTS.map((concept) =>
      assessConcept(input, profiles, concept, witnesses),
    );
    const revenuePossible = concepts.filter(
      (c) =>
        c.concept !== "NetIncomeLoss" &&
        c.memberships.some((m) => m.disposition !== "excluded"),
    );
    const revenue =
      revenuePossible.length === 1
        ? metric("revenue", revenuePossible[0]!, witnesses)
        : heldMetric(
            "revenue",
            revenuePossible.length > 1
              ? ["competing_revenue_concepts"]
              : ["concept_absent"],
            null,
          );
    const net = metric(
      "net_income",
      concepts.find((c) => c.concept === "NetIncomeLoss")!,
      witnesses,
    );
    const pair = pairDecision(revenue, net);
    return freeze({
      status: "assessed",
      analysis: {
        schemaVersion: "1.0.0",
        predicates: profiles.predicates,
        witnesses,
        concepts,
        metrics: [revenue, net],
        pair,
        ttm: { ...TTM },
      },
    });
  } catch {
    return invalid();
  }
}
function invalid(): PersonalSecQuarterEngineResultDto {
  return freeze({
    status: "unavailable",
    reason: "invalid_evidence_graph",
    ttm: { ...TTM },
  });
}
function primaryMembership(
  profiles: QuarterProfiles,
  fact: QuarterPrimaryOccurrence,
): Membership {
  const refs = [
    fact.id,
    ...(fact.contextRecordId ? [fact.contextRecordId] : []),
  ];
  const context = readQuarterContext(
    profiles.contexts.get(fact.contextRecordId ?? ""),
  );
  const base = {
    reference: fact.id,
    source: "primary" as const,
    evidenceIds: refs,
  };
  if (!context || !supportedGaap(fact.concept.namespace))
    return {
      ...base,
      disposition: "unresolved",
      reason: "membership_unresolved",
    };
  if (context.cik !== profiles.input.cik)
    return { ...base, disposition: "excluded", reason: "other_entity" };
  if (context.dimensioned)
    return { ...base, disposition: "excluded", reason: "dimensioned_scope" };
  if (
    context.kind !== "duration" ||
    context.endDate !== profiles.input.selection.reportDate ||
    (profiles.calendar && context.startDate !== profiles.calendar.start)
  )
    return { ...base, disposition: "excluded", reason: "other_period" };
  if (!profiles.calendar)
    return {
      ...base,
      disposition: "unresolved",
      reason: "membership_unresolved",
    };
  return { ...base, disposition: "possible_current", reason: "current_period" };
}
function companyMembership(
  profiles: QuarterProfiles,
  fact: PersonalSecQuarterCompanyFactDto,
): Membership {
  const base = {
    reference: fact.id,
    source: "company_facts" as const,
    evidenceIds: [fact.id],
  };
  if (
    fact.accessionMembership !== "selected" ||
    fact.accessionNumber !== profiles.input.selection.accessionNumber ||
    fact.form !== "10-Q" ||
    !fact.startDate ||
    !fact.endDate ||
    !quarterDate(fact.startDate) ||
    !quarterDate(fact.endDate) ||
    fact.startDate > fact.endDate ||
    fact.nonObjectRow !== null ||
    fact.issues.some(
      (r) =>
        !["invalid_numeric", "decimal_limit", "invalid_unit_key"].includes(r),
    )
  )
    return {
      ...base,
      disposition: "unresolved",
      reason: "membership_unresolved",
    };
  if (
    fact.endDate !== profiles.input.selection.reportDate ||
    (profiles.calendar && fact.startDate !== profiles.calendar.start)
  )
    return { ...base, disposition: "excluded", reason: "other_period" };
  if (!profiles.calendar)
    return {
      ...base,
      disposition: "unresolved",
      reason: "membership_unresolved",
    };
  return { ...base, disposition: "possible_current", reason: "current_period" };
}
function assessConcept(
  input: PersonalSecQuarterAssessmentInputDto,
  profiles: QuarterProfiles,
  concept: Concept,
  witnesses: PersonalSecQuarterWitnessDto[],
): PersonalSecQuarterConceptDecisionDto {
  const primary = input.evidence.primary.concepts.find(
    (p) => p.concept === concept,
  )!.occurrences;
  const company = input.evidence.companyFacts.occurrences.filter(
    (f) => f.concept === concept,
  );
  const memberships = [
    ...company.map((f) => companyMembership(profiles, f)),
    ...primary.map((f) => primaryMembership(profiles, f)),
  ];
  const byReference = new Map(memberships.map((m) => [m.reference, m]));
  const currentPrimary = primary.filter(
    (f) => byReference.get(f.id)!.disposition === "possible_current",
  );
  const currentCompany = company.filter(
    (f) => byReference.get(f.id)!.disposition === "possible_current",
  );
  const reasons: AssessmentReason[] = [];
  const predicateIds: string[] = [],
    witnessIds: string[] = [];
  if (!memberships.some((m) => m.disposition !== "excluded"))
    return {
      concept,
      status: "absent",
      reasons: ["concept_absent"],
      companyFactsRefs: company.map((f) => f.id),
      primaryRefs: primary.map((f) => f.id),
      memberships,
      predicateIds,
      witnessIds,
    };
  reasons.push(...profiles.globalReasons);
  if (memberships.some((m) => m.disposition === "unresolved"))
    reasons.push("membership_unresolved");
  if (!currentCompany.length) reasons.push("no_current_company_facts_row");
  if (!currentPrimary.length) reasons.push("no_current_primary_row");
  if (
    currentCompany.some((f) => f.unitKey !== "USD") ||
    currentPrimary.some(
      (f) =>
        readQuarterUnit(profiles.units.get(f.unitRecordId ?? "")) === "other",
    )
  )
    reasons.push("current_non_usd");
  if (
    currentPrimary.some(
      (f) => readQuarterUnit(profiles.units.get(f.unitRecordId ?? "")) === null,
    )
  )
    reasons.push("display_unit_unresolved");
  const allValues = [...currentCompany, ...currentPrimary].map((f) => f.value);
  if (
    allValues.some(
      (value) => value === null || canonicalQuarterDecimal(value) !== value,
    ) ||
    currentCompany.some((f) => f.issues.length) ||
    currentPrimary.some((f) => f.issues.length)
  )
    reasons.push("display_amount_unresolved");
  const comparable = [
    ...currentCompany.filter(
      (f) => f.unitKey === "USD" && f.issues.length === 0,
    ),
    ...currentPrimary.filter(
      (f) =>
        readQuarterUnit(profiles.units.get(f.unitRecordId ?? "")) === "USD" &&
        f.issues.length === 0,
    ),
  ];
  const usableValues = unique(
    comparable
      .map((f) => f.value)
      .filter(
        (value): value is string =>
          value !== null && canonicalQuarterDecimal(value) === value,
      ),
  );
  if (usableValues.length > 1) reasons.push("current_value_conflict");
  for (const fact of currentPrimary) {
    if (
      fact.issues.length ||
      !fact.value ||
      readQuarterUnit(profiles.units.get(fact.unitRecordId ?? "")) !== "USD"
    )
      continue;
    const matching = currentCompany
      .filter(
        (f) =>
          f.unitKey === "USD" &&
          f.issues.length === 0 &&
          f.value === fact.value,
      )
      .map((f) => f.id);
    const result = profiles.witness(fact, matching);
    predicateIds.push(...result.predicateIds);
    if (result.witness) {
      witnesses.push(result.witness);
      witnessIds.push(result.witness.id);
    }
  }
  if (!witnessIds.length) reasons.push("principal_witness_unresolved");
  const mapped = new Set(
    witnesses
      .filter((w) => witnessIds.includes(w.id))
      .flatMap((w) => w.companyFactsRefs),
  );
  if (currentCompany.some((f) => !mapped.has(f.id)))
    reasons.push("unwitnessed_company_facts_reference");
  const predicateReasons = profiles.predicates
    .filter((p) => predicateIds.includes(p.id))
    .flatMap((p) => p.reasons);
  // An agreeing off-table duplicate needs no second visible witness. Required
  // source predicates remain attached to unsuccessful attempts for inspection.
  if (!witnessIds.length) reasons.push(...predicateReasons);
  return {
    concept,
    status: reasons.includes("current_value_conflict")
      ? "conflicted"
      : reasons.length
        ? "held"
        : "supported_as_filed",
    reasons: unique(reasons),
    companyFactsRefs: company.map((f) => f.id),
    primaryRefs: primary.map((f) => f.id),
    memberships,
    predicateIds: unique(predicateIds),
    witnessIds,
  };
}
function heldMetric(
  metric: "revenue" | "net_income",
  reasons: readonly AssessmentReason[],
  concept: Concept | null,
  status: "held" | "conflicted" = "held",
): PersonalSecQuarterMetricDecisionDto {
  return {
    metric,
    status,
    reasons: [...reasons],
    concept,
    witnessIds: [],
    value: null,
    unit: null,
    period: null,
  };
}
function metric(
  metricName: "revenue" | "net_income",
  concept: PersonalSecQuarterConceptDecisionDto,
  witnesses: readonly PersonalSecQuarterWitnessDto[],
): PersonalSecQuarterMetricDecisionDto {
  if (concept.status !== "supported_as_filed")
    return heldMetric(
      metricName,
      concept.reasons,
      concept.concept,
      concept.status === "conflicted" ? "conflicted" : "held",
    );
  const witness = witnesses.find((w) => concept.witnessIds.includes(w.id))!;
  return {
    metric: metricName,
    status: "supported_as_filed",
    reasons: [],
    concept: concept.concept,
    witnessIds: [...concept.witnessIds],
    value: witness.value,
    unit: "USD",
    period: { ...witness.period },
  };
}
function pairDecision(
  revenue: PersonalSecQuarterMetricDecisionDto,
  net: PersonalSecQuarterMetricDecisionDto,
): PersonalSecQuarterPairDecisionDto {
  if (
    revenue.status === "supported_as_filed" &&
    net.status === "supported_as_filed"
  ) {
    if (
      revenue.period.startDate === net.period.startDate &&
      revenue.period.endDate === net.period.endDate
    )
      return {
        status: "supported_as_filed",
        reasons: [],
        revenue: revenue.value,
        netIncome: net.value,
        unit: "USD",
        period: { ...revenue.period },
      };
    return {
      status: "held",
      reasons: ["pair_period_mismatch"],
      revenue: null,
      netIncome: null,
      unit: null,
      period: null,
    };
  }
  return {
    status:
      revenue.status === "conflicted" || net.status === "conflicted"
        ? "conflicted"
        : "held",
    reasons: unique([
      ...revenue.reasons,
      ...net.reasons,
      "metric_not_supported",
    ] as AssessmentReason[]),
    revenue: null,
    netIncome: null,
    unit: null,
    period: null,
  };
}
