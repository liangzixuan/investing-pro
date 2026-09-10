import type { PersonalFiscalQuarterDto } from "@research-cockpit/contracts";

export const PERSONAL_QUARTERLY_COMPATIBILITY_LIMITS = Object.freeze({
  quarters: 16,
  assessedQuarters: 4,
  decimalLength: 64,
  identityLength: 128,
  metadataLength: 160,
  sourceReferenceLength: 512,
  dimensions: 16,
});

export const PERSONAL_QUARTERLY_COMPATIBILITY_ISSUE_REASONS = Object.freeze([
  "missing_fiscal_slot",
  "unknown_value",
  "period_evidence_missing",
  "unsupported_period_basis",
  "fiscal_calendar_evidence_missing",
  "unsupported_fiscal_calendar",
  "period_calendar_mismatch",
  "fiscal_calendar_mismatch",
  "noncontiguous_periods",
  "unit_evidence_missing",
  "unsupported_unit",
  "scope_evidence_missing",
  "issuer_mismatch",
  "unsupported_scope",
  "concept_evidence_missing",
  "unsupported_sign_convention",
  "concept_mismatch",
  "source_revision_evidence_missing",
  "mixed_sources",
  "revision_set_mismatch",
] as const);

export type PersonalQuarterlyCompatibilityIssueReason =
  (typeof PERSONAL_QUARTERLY_COMPATIBILITY_ISSUE_REASONS)[number];
export type PersonalQuarterlyCompatibilityMetricKey = "revenue" | "net_income";
export type PersonalQuarterlyCompatibilityQuarantineReason =
  | "invalid_input"
  | "too_many_quarters"
  | "duplicate_fiscal_coordinate"
  | "selection_identity_mismatch";

/** These declarations permit consistency checks, not source admission. */
export interface PersonalQuarterlyCompatibilityEvidence {
  readonly period: Readonly<{
    startDate: string;
    endDate: string;
    basis: "standalone_quarter" | "year_to_date" | "annual" | "instant";
  }> | null;
  readonly fiscalCalendar: Readonly<{
    id: string;
    kind: "calendar_months" | "week_based" | "transition";
    fiscalYearStart: string;
  }> | null;
  readonly unit: Readonly<{
    currency: string;
    unit: string;
    scalePower10: number;
  }> | null;
  readonly scope: Readonly<{
    issuerId: string;
    consolidation: "consolidated" | "other";
    dimensions: readonly string[];
  }> | null;
  readonly concept: Readonly<{
    taxonomy: string;
    code: string;
    signConvention: "reported_signed" | "other";
  }> | null;
  readonly source: Readonly<{
    id: string;
    reference: string;
    revisionId: string;
    revisionSetId: string;
  }> | null;
}

export interface PersonalQuarterlyCompatibilityCellInput {
  readonly value: string | null;
  readonly evidence: PersonalQuarterlyCompatibilityEvidence | null;
}

export interface PersonalQuarterlyCompatibilityQuarterInput extends PersonalFiscalQuarterDto {
  readonly statementDate: string | null;
  readonly reported: Readonly<
    Record<
      PersonalQuarterlyCompatibilityMetricKey,
      PersonalQuarterlyCompatibilityCellInput
    >
  >;
}

export interface PersonalQuarterlyCompatibilityInput {
  readonly security: Readonly<{ issuerId: string; listingId: string }>;
  readonly anchor: PersonalFiscalQuarterDto;
  readonly quarters: readonly PersonalQuarterlyCompatibilityQuarterInput[];
}

export interface PersonalQuarterlyCompatibilityIssue {
  readonly reason: PersonalQuarterlyCompatibilityIssueReason;
  readonly coordinates: readonly PersonalFiscalQuarterDto[];
}

export interface PersonalQuarterlyCompatibilityPeriod extends PersonalFiscalQuarterDto {
  readonly status: "missing" | "unknown" | "known";
  readonly value: string | null;
  readonly statementDate: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly sourceRef: string | null;
}

export interface PersonalQuarterlyCompatibilityMetric {
  readonly metric: PersonalQuarterlyCompatibilityMetricKey;
  readonly status: "compatible_inputs" | "blocked";
  readonly knownValues: number;
  readonly periods: readonly PersonalQuarterlyCompatibilityPeriod[];
  readonly issues: readonly PersonalQuarterlyCompatibilityIssue[];
}

type TtmUnavailable = Readonly<{
  status: "unavailable";
  reason: "source_not_admitted";
}>;

export type PersonalQuarterlyCompatibilityResult =
  | Readonly<{
      status: "quarantined";
      reason: PersonalQuarterlyCompatibilityQuarantineReason;
      ttm: TtmUnavailable;
    }>
  | Readonly<{
      status: "assessed";
      security: PersonalQuarterlyCompatibilityInput["security"];
      anchor: PersonalFiscalQuarterDto;
      slots: readonly PersonalFiscalQuarterDto[];
      metrics: readonly PersonalQuarterlyCompatibilityMetric[];
      ttm: TtmUnavailable;
    }>;

const TTM_UNAVAILABLE: TtmUnavailable = Object.freeze({
  status: "unavailable",
  reason: "source_not_admitted",
});

/** Offline internal consistency only; never admits a source or calculates a total. */
export function assessPersonalQuarterlyCompatibility(
  input: PersonalQuarterlyCompatibilityInput,
): PersonalQuarterlyCompatibilityResult {
  try {
    return assess(input);
  } catch {
    return quarantined("invalid_input");
  }
}

function quarantined(
  reason: PersonalQuarterlyCompatibilityQuarantineReason,
): PersonalQuarterlyCompatibilityResult {
  return Object.freeze({ status: "quarantined", reason, ttm: TTM_UNAVAILABLE });
}

const METRICS = ["revenue", "net_income"] as const;
const INVALID_TEXT = /[\p{Cc}\p{Cf}\p{Cs}]/u;
type Selected = Readonly<{
  coordinate: PersonalFiscalQuarterDto;
  quarter: PersonalQuarterlyCompatibilityQuarterInput | undefined;
}>;

function assess(
  input: PersonalQuarterlyCompatibilityInput,
): PersonalQuarterlyCompatibilityResult {
  if (
    !exactRecord(input, ["security", "anchor", "quarters"]) ||
    !exactRecord(input.security, ["issuerId", "listingId"]) ||
    !text(
      input.security.issuerId,
      PERSONAL_QUARTERLY_COMPATIBILITY_LIMITS.identityLength,
    ) ||
    !text(
      input.security.listingId,
      PERSONAL_QUARTERLY_COMPATIBILITY_LIMITS.identityLength,
    ) ||
    !coordinate(input.anchor) ||
    !Array.isArray(input.quarters)
  )
    return quarantined("invalid_input");
  if (input.quarters.length > PERSONAL_QUARTERLY_COMPATIBILITY_LIMITS.quarters)
    return quarantined("too_many_quarters");
  const byCoordinate = new Map<
    string,
    PersonalQuarterlyCompatibilityQuarterInput
  >();
  for (const quarter of input.quarters) {
    if (!validQuarter(quarter)) return quarantined("invalid_input");
    const key = coordinateKey(quarter);
    if (byCoordinate.has(key))
      return quarantined("duplicate_fiscal_coordinate");
    byCoordinate.set(key, quarter);
  }
  const anchorIndex =
    input.anchor.fiscalYear * 4 + input.anchor.fiscalQuarter - 1;
  if (Math.floor((anchorIndex - 3) / 4) < 1000)
    return quarantined("invalid_input");
  const slots = Array.from({ length: 4 }, (_, index) => {
    const ordinal = anchorIndex - 3 + index;
    return Object.freeze({
      fiscalYear: Math.floor(ordinal / 4),
      fiscalQuarter: ((ordinal % 4) + 1) as 1 | 2 | 3 | 4,
    });
  });
  const selected = slots.map((slot) => ({
    coordinate: slot,
    quarter: byCoordinate.get(coordinateKey(slot)),
  }));
  return Object.freeze({
    status: "assessed",
    security: Object.freeze({ ...input.security }),
    anchor: Object.freeze({ ...input.anchor }),
    slots: Object.freeze(slots),
    metrics: Object.freeze(
      METRICS.map((metric) =>
        assessMetric(metric, selected, input.security.issuerId),
      ),
    ),
    ttm: TTM_UNAVAILABLE,
  });
}

function assessMetric(
  metric: PersonalQuarterlyCompatibilityMetricKey,
  selected: readonly Selected[],
  issuerId: string,
): PersonalQuarterlyCompatibilityMetric {
  const issueCoordinates = new Map<
    PersonalQuarterlyCompatibilityIssueReason,
    Set<string>
  >();
  const add = (
    reason: PersonalQuarterlyCompatibilityIssueReason,
    ...coordinates: PersonalFiscalQuarterDto[]
  ) => {
    const keys = issueCoordinates.get(reason) ?? new Set<string>();
    for (const current of coordinates) keys.add(coordinateKey(current));
    issueCoordinates.set(reason, keys);
  };
  const periods = selected.map(({ coordinate: slot, quarter }) => {
    const cell = quarter?.reported[metric];
    const evidence = cell?.evidence;
    if (!quarter) add("missing_fiscal_slot", slot);
    else {
      if (cell!.value === null) add("unknown_value", slot);
      const period = evidence?.period;
      const calendar = evidence?.fiscalCalendar;
      if (!period) add("period_evidence_missing", slot);
      else if (period.basis !== "standalone_quarter")
        add("unsupported_period_basis", slot);
      if (!calendar) add("fiscal_calendar_evidence_missing", slot);
      else if (calendar.kind !== "calendar_months")
        add("unsupported_fiscal_calendar", slot);
      else if (
        calendar.fiscalYearStart.slice(-2) !== "01" ||
        ![slot.fiscalYear, slot.fiscalYear - 1].includes(
          Number(calendar.fiscalYearStart.slice(0, 4)),
        )
      )
        add("period_calendar_mismatch", slot);
      else if (period && period.basis === "standalone_quarter") {
        const expectedStart = addMonths(
          calendar.fiscalYearStart,
          3 * (slot.fiscalQuarter - 1),
        );
        const nextStart = addMonths(
          calendar.fiscalYearStart,
          3 * slot.fiscalQuarter,
        );
        if (
          period.startDate !== expectedStart ||
          nextDay(period.endDate) !== nextStart
        )
          add("period_calendar_mismatch", slot);
      }
      if (!evidence?.unit) add("unit_evidence_missing", slot);
      else if (
        evidence.unit.currency !== "USD" ||
        evidence.unit.unit !== "USD" ||
        evidence.unit.scalePower10 !== 0
      )
        add("unsupported_unit", slot);
      if (!evidence?.scope) add("scope_evidence_missing", slot);
      else {
        if (evidence.scope.issuerId !== issuerId) add("issuer_mismatch", slot);
        if (
          evidence.scope.consolidation !== "consolidated" ||
          evidence.scope.dimensions.length !== 0
        )
          add("unsupported_scope", slot);
      }
      if (!evidence?.concept) add("concept_evidence_missing", slot);
      else if (evidence.concept.signConvention !== "reported_signed")
        add("unsupported_sign_convention", slot);
      if (!evidence?.source) add("source_revision_evidence_missing", slot);
    }
    return Object.freeze({
      ...slot,
      status:
        quarter === undefined
          ? ("missing" as const)
          : cell!.value === null
            ? ("unknown" as const)
            : ("known" as const),
      value: cell?.value ?? null,
      statementDate: quarter?.statementDate ?? null,
      periodStart: evidence?.period?.startDate ?? null,
      periodEnd: evidence?.period?.endDate ?? null,
      sourceRef: evidence?.source?.reference ?? null,
    });
  });
  // Check every supplied pair, even when a different selected slot lacks evidence.
  // Matching declared IDs establishes consistency only, never provenance truth.
  for (let leftIndex = 0; leftIndex < selected.length; leftIndex += 1) {
    const left = selected[leftIndex]!;
    const leftEvidence = left.quarter?.reported[metric].evidence;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < selected.length;
      rightIndex += 1
    ) {
      const right = selected[rightIndex]!;
      const rightEvidence = right.quarter?.reported[metric].evidence;
      const coordinates = [left.coordinate, right.coordinate];
      const leftCalendar = leftEvidence?.fiscalCalendar;
      const rightCalendar = rightEvidence?.fiscalCalendar;
      if (
        leftCalendar &&
        rightCalendar &&
        (leftCalendar.id !== rightCalendar.id ||
          leftCalendar.kind !== rightCalendar.kind ||
          addMonths(
            leftCalendar.fiscalYearStart,
            12 * (right.coordinate.fiscalYear - left.coordinate.fiscalYear),
          ) !== rightCalendar.fiscalYearStart)
      )
        add("fiscal_calendar_mismatch", ...coordinates);
      const leftConcept = leftEvidence?.concept;
      const rightConcept = rightEvidence?.concept;
      if (
        leftConcept &&
        rightConcept &&
        (leftConcept.taxonomy !== rightConcept.taxonomy ||
          leftConcept.code !== rightConcept.code ||
          leftConcept.signConvention !== rightConcept.signConvention)
      )
        add("concept_mismatch", ...coordinates);
      const leftSource = leftEvidence?.source;
      const rightSource = rightEvidence?.source;
      if (leftSource && rightSource) {
        if (leftSource.id !== rightSource.id)
          add("mixed_sources", ...coordinates);
        if (leftSource.revisionSetId !== rightSource.revisionSetId)
          add("revision_set_mismatch", ...coordinates);
      }
      if (
        rightIndex === leftIndex + 1 &&
        leftEvidence?.period &&
        rightEvidence?.period &&
        nextDay(leftEvidence.period.endDate) !== rightEvidence.period.startDate
      )
        add("noncontiguous_periods", ...coordinates);
    }
  }
  const issues = PERSONAL_QUARTERLY_COMPATIBILITY_ISSUE_REASONS.filter(
    (reason) => issueCoordinates.has(reason),
  ).map((reason) =>
    Object.freeze({
      reason,
      coordinates: Object.freeze(
        selected
          .filter(({ coordinate: slot }) =>
            issueCoordinates.get(reason)!.has(coordinateKey(slot)),
          )
          .map(({ coordinate: slot }) => slot),
      ),
    }),
  );
  return Object.freeze({
    metric,
    status: issues.length === 0 ? "compatible_inputs" : "blocked",
    knownValues: periods.filter((period) => period.status === "known").length,
    periods: Object.freeze(periods),
    issues: Object.freeze(issues),
  });
}

function validQuarter(
  value: unknown,
): value is PersonalQuarterlyCompatibilityQuarterInput {
  if (
    !exactRecord(value, [
      "fiscalYear",
      "fiscalQuarter",
      "statementDate",
      "reported",
    ]) ||
    !fiscalCoordinate(value) ||
    !(value.statementDate === null || calendarDate(value.statementDate)) ||
    !exactRecord(value.reported, METRICS)
  )
    return false;
  for (const metric of METRICS) {
    const cell = value.reported[metric];
    if (
      !exactRecord(cell, ["value", "evidence"]) ||
      !(
        cell.value === null ||
        (typeof cell.value === "string" &&
          cell.value.length <= 64 &&
          /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(cell.value))
      ) ||
      !(cell.evidence === null || validEvidence(cell.evidence))
    )
      return false;
  }
  return true;
}

function validEvidence(
  value: unknown,
): value is PersonalQuarterlyCompatibilityEvidence {
  if (
    !exactRecord(value, [
      "period",
      "fiscalCalendar",
      "unit",
      "scope",
      "concept",
      "source",
    ])
  )
    return false;
  const { period, fiscalCalendar, unit, scope, concept, source } = value;
  if (
    period !== null &&
    (!exactRecord(period, ["startDate", "endDate", "basis"]) ||
      !calendarDate(period.startDate) ||
      !calendarDate(period.endDate) ||
      period.startDate > period.endDate ||
      !["standalone_quarter", "year_to_date", "annual", "instant"].includes(
        period.basis as string,
      ))
  )
    return false;
  if (
    fiscalCalendar !== null &&
    (!exactRecord(fiscalCalendar, ["id", "kind", "fiscalYearStart"]) ||
      !text(fiscalCalendar.id) ||
      !calendarDate(fiscalCalendar.fiscalYearStart) ||
      !["calendar_months", "week_based", "transition"].includes(
        fiscalCalendar.kind as string,
      ))
  )
    return false;
  if (
    unit !== null &&
    (!exactRecord(unit, ["currency", "unit", "scalePower10"]) ||
      typeof unit.currency !== "string" ||
      !/^[A-Z]{3}$/u.test(unit.currency) ||
      !text(unit.unit) ||
      !Number.isSafeInteger(unit.scalePower10) ||
      (unit.scalePower10 as number) < -18 ||
      (unit.scalePower10 as number) > 18)
  )
    return false;
  if (
    scope !== null &&
    (!exactRecord(scope, ["issuerId", "consolidation", "dimensions"]) ||
      !text(
        scope.issuerId,
        PERSONAL_QUARTERLY_COMPATIBILITY_LIMITS.identityLength,
      ) ||
      !["consolidated", "other"].includes(scope.consolidation as string) ||
      !Array.isArray(scope.dimensions) ||
      scope.dimensions.length > 16 ||
      !Array.from(scope.dimensions).every((dimension: unknown) =>
        text(dimension),
      ) ||
      new Set(scope.dimensions).size !== scope.dimensions.length)
  )
    return false;
  if (
    concept !== null &&
    (!exactRecord(concept, ["taxonomy", "code", "signConvention"]) ||
      !text(concept.taxonomy) ||
      !text(concept.code) ||
      !["reported_signed", "other"].includes(concept.signConvention as string))
  )
    return false;
  if (
    source !== null &&
    (!exactRecord(source, ["id", "reference", "revisionId", "revisionSetId"]) ||
      !text(source.id) ||
      !text(source.reference, 512) ||
      !text(source.revisionId) ||
      !text(source.revisionSetId))
  )
    return false;
  return true;
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function text(value: unknown, maximum = 160): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    [...value].length <= maximum &&
    !INVALID_TEXT.test(value)
  );
}

function coordinate(value: unknown): value is PersonalFiscalQuarterDto {
  return (
    exactRecord(value, ["fiscalYear", "fiscalQuarter"]) &&
    fiscalCoordinate(value)
  );
}

function fiscalCoordinate(value: Record<string, unknown>): boolean {
  return (
    Number.isSafeInteger(value.fiscalYear) &&
    (value.fiscalYear as number) >= 1000 &&
    (value.fiscalYear as number) <= 9998 &&
    Number.isSafeInteger(value.fiscalQuarter) &&
    (value.fiscalQuarter as number) >= 1 &&
    (value.fiscalQuarter as number) <= 4
  );
}

function coordinateKey(value: PersonalFiscalQuarterDto): string {
  return `${String(value.fiscalYear)}-${String(value.fiscalQuarter)}`;
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(value))
    return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
}

function addMonths(value: string, months: number): string | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  const month = date.getUTCMonth() + months;
  date.setUTCFullYear(
    date.getUTCFullYear() + Math.floor(month / 12),
    ((month % 12) + 12) % 12,
    date.getUTCDate(),
  );
  const result = date.toISOString().slice(0, 10);
  return calendarDate(result) ? result : null;
}

function nextDay(value: string): string | null {
  const result = new Date(Date.parse(`${value}T00:00:00.000Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  return calendarDate(result) ? result : null;
}
