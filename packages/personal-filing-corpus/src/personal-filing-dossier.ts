import { isProxy } from "node:util/types";

import {
  PERSONAL_FILING_FACT_CONTRACTS,
  PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA,
  PERSONAL_FILING_FACT_KEYS,
  PERSONAL_FILING_FACT_NORMALIZATION_LIMITS,
  type PersonalFilingFactDerivationOperand,
  type PersonalFilingFactKey,
  type PersonalFilingFactUnit,
  type PersonalNormalizedFilingFactVersion,
} from "./personal-filing-fact-normalization";
import type { PersonalFilingSelectedFactReleaseExpectedBindings } from "./personal-filing-selected-fact-release";
import { PERSONAL_FILING_CORPUS_LIMITS } from "./personal-filing-corpus";
import {
  PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS,
  commitPersonalFilingQualityMeasurementForDossier,
  type PersonalFilingQualityMeasurementCommittedResult,
} from "./personal-filing-quality-measurement";
import { PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS } from "./personal-filing-raw-fact-extraction";

export const PERSONAL_FILING_DOSSIER_SCHEMA_VERSION = "1.0.0" as const;
export const PERSONAL_FILING_DOSSIER_PROFILE =
  "personal_single_user_local" as const;
export const PERSONAL_FILING_DOSSIER_PLAN_ROLE =
  "personal_dossier_release_plan" as const;
export const PERSONAL_FILING_DOSSIER_ROLE = "personal_dossier" as const;
export const PERSONAL_FILING_DOSSIER_SNAPSHOT_RULE =
  "exact_candidate_document_index.v1" as const;

export const PERSONAL_FILING_DOSSIER_FACT_LABELS = Object.freeze({
  assets: "Assets",
  cash: "Cash",
  debt: "Debt",
  diluted_shares: "Diluted shares",
  free_cash_flow: "Free cash flow",
  gross_profit: "Gross profit",
  net_income: "Net income",
  operating_cash_flow: "Operating cash flow",
  operating_income: "Operating income",
  revenue: "Revenue",
} as const satisfies Readonly<Record<PersonalFilingFactKey, string>>);

export type PersonalFilingDossierFactId = `fact-${string}`;
export type PersonalFilingDossierEvidenceId = `evidence-${string}`;

export interface PersonalFilingDossierPlan {
  readonly chartFactKeys: readonly PersonalFilingFactKey[];
  readonly documentIndex: number;
  readonly factKeys: readonly PersonalFilingFactKey[];
  readonly profile: typeof PERSONAL_FILING_DOSSIER_PROFILE;
  readonly role: typeof PERSONAL_FILING_DOSSIER_PLAN_ROLE;
  readonly schemaVersion: typeof PERSONAL_FILING_DOSSIER_SCHEMA_VERSION;
  readonly snapshotRule: typeof PERSONAL_FILING_DOSSIER_SNAPSHOT_RULE;
}

export interface PersonalFilingDossierInput {
  readonly declaration: Uint8Array;
  readonly dossierPlan: PersonalFilingDossierPlan;
  readonly expectedBindings: PersonalFilingSelectedFactReleaseExpectedBindings;
  readonly manifest: Uint8Array;
  readonly normalizationPlan: Uint8Array;
  readonly qualityPlan: Uint8Array;
  readonly rawFilingDocuments: readonly Uint8Array[];
  readonly sourceDocuments: readonly Uint8Array[];
}

export interface PersonalFilingDossierFact {
  readonly evidenceId: PersonalFilingDossierEvidenceId;
  readonly id: PersonalFilingDossierFactId;
  readonly key: PersonalFilingFactKey;
  readonly knownFrom: string;
  readonly knownToExclusive: string | null;
  readonly label: string;
  readonly periodEnd: string;
  readonly periodStart: string | null;
  readonly unit: PersonalFilingFactUnit;
  readonly value: string;
  readonly version: "current" | "superseded";
}

interface PersonalFilingDossierEvidenceBase {
  readonly factId: PersonalFilingDossierFactId;
  readonly id: PersonalFilingDossierEvidenceId;
  readonly sourceAcceptedAt: string;
  readonly sourceAccession: string;
  readonly sourceAvailableAt: string;
  readonly sourceContentSha256: `sha256:${string}`;
  readonly sourceDocumentSha256: `sha256:${string}`;
  readonly taxonomy: string;
}

export type PersonalFilingDossierEvidence =
  | Readonly<
      PersonalFilingDossierEvidenceBase & {
        readonly derivationFormula: null;
        readonly derivationOperands: readonly [];
        readonly sourceConcept: string;
      }
    >
  | Readonly<
      PersonalFilingDossierEvidenceBase & {
        readonly derivationFormula: typeof PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA;
        readonly derivationOperands: readonly [
          PersonalFilingDossierDerivationOperand<"minuend">,
          PersonalFilingDossierDerivationOperand<"subtrahend">,
        ];
        readonly sourceConcept: null;
      }
    >;

export interface PersonalFilingDossierDerivationOperand<
  TRole extends "minuend" | "subtrahend" = "minuend" | "subtrahend",
> {
  readonly concept: string;
  readonly periodEnd: string;
  readonly periodStart: string;
  readonly role: TRole;
  readonly unit: "USD";
  readonly value: string;
}

export interface PersonalFilingDossierLineageEvent {
  readonly effectiveAt: string;
  readonly key: PersonalFilingFactKey;
  readonly predecessorFactId: PersonalFilingDossierFactId;
  readonly successorFactId: PersonalFilingDossierFactId;
}

export interface PersonalFilingDossierLineage {
  readonly events: readonly PersonalFilingDossierLineageEvent[];
  readonly scope: "issuer_filing_versions_within_exact_frozen_manifest_only";
  readonly status:
    "amendment_supersession_observed" | "root_only_no_in_corpus_amendment";
}

export interface PersonalFilingDossierChartSeries {
  readonly key: PersonalFilingFactKey;
  readonly label: string;
  readonly points: readonly Readonly<{
    factId: PersonalFilingDossierFactId;
  }>[];
  readonly unit: PersonalFilingFactUnit;
}

export type PersonalFilingDossierChart =
  | Readonly<{
      reasonCode: "NO_OWNER_APPROVED_CHART_FACTS";
      status: "unsupported";
    }>
  | Readonly<{
      series: readonly PersonalFilingDossierChartSeries[];
      status: "ready";
    }>;

export type PersonalFilingDossierValuationInputs =
  | Readonly<{
      reasonCode: "INPUT_OUT_OF_DOMAIN" | "REQUIRED_FACTS_NOT_RELEASED";
      status: "unsupported";
    }>
  | Readonly<{
      baseRevenueFactId: PersonalFilingDossierFactId;
      cashFactId: PersonalFilingDossierFactId;
      debtFactId: PersonalFilingDossierFactId;
      dilutedSharesFactId: PersonalFilingDossierFactId;
      modelVersion: "exit-multiple-v1";
      status: "ready";
    }>;

export interface PersonalFilingDossierOmissions {
  readonly count: null;
  readonly explanation: string;
  readonly hasOmissions: boolean;
  readonly reasonCode: "OWNER_FIXED_SCOPE";
}

export interface PersonalFilingDossierPreparedResult {
  readonly asOf: string;
  readonly chart: PersonalFilingDossierChart;
  readonly evidence: readonly PersonalFilingDossierEvidence[];
  readonly facts: readonly PersonalFilingDossierFact[];
  readonly lineage: PersonalFilingDossierLineage;
  readonly omissions: PersonalFilingDossierOmissions;
  readonly profile: typeof PERSONAL_FILING_DOSSIER_PROFILE;
  readonly role: typeof PERSONAL_FILING_DOSSIER_ROLE;
  readonly schemaVersion: typeof PERSONAL_FILING_DOSSIER_SCHEMA_VERSION;
  readonly status: "prepared_personal_dossier_for_personal_use";
  readonly valuationInputs: PersonalFilingDossierValuationInputs;
}

export interface PersonalFilingDossierQuarantinedResult {
  readonly chart: null;
  readonly evidence: readonly [];
  readonly facts: readonly [];
  readonly lineage: readonly [];
  readonly omissions: null;
  readonly profile: typeof PERSONAL_FILING_DOSSIER_PROFILE;
  readonly role: typeof PERSONAL_FILING_DOSSIER_ROLE;
  readonly schemaVersion: typeof PERSONAL_FILING_DOSSIER_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly valuationInputs: null;
}

export type PersonalFilingDossierResult =
  PersonalFilingDossierPreparedResult | PersonalFilingDossierQuarantinedResult;

interface InputSnapshot {
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
  readonly normalizationPlan: Uint8Array;
  readonly qualityPlan: Uint8Array;
  readonly rawFilingDocuments: readonly Uint8Array[];
  readonly sourceDocuments: readonly Uint8Array[];
}

interface ControlSnapshot {
  readonly dossierPlan: PersonalFilingDossierPlan;
  readonly expectedBindings: PersonalFilingSelectedFactReleaseExpectedBindings;
}

class DossierFailure extends Error {}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const INPUT_KEYS = [
  "declaration",
  "dossierPlan",
  "expectedBindings",
  "manifest",
  "normalizationPlan",
  "qualityPlan",
  "rawFilingDocuments",
  "sourceDocuments",
] as const;
const BINDING_KEYS = [
  "candidateCommitmentSha256",
  "candidateObservationsSha256",
  "inputSetSha256",
  "ownerReviewedReferenceSha256",
  "qualityPlanSha256",
] as const;
const PLAN_KEYS = [
  "chartFactKeys",
  "documentIndex",
  "factKeys",
  "profile",
  "role",
  "schemaVersion",
  "snapshotRule",
] as const;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_BUFFER_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
);
const TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
);
const TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
);
const ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
);
const EMPTY = Object.freeze([] as const);
const QUARANTINED_RESULT: PersonalFilingDossierQuarantinedResult =
  Object.freeze({
    chart: null,
    evidence: EMPTY,
    facts: EMPTY,
    lineage: EMPTY,
    omissions: null,
    profile: PERSONAL_FILING_DOSSIER_PROFILE,
    role: PERSONAL_FILING_DOSSIER_ROLE,
    schemaVersion: PERSONAL_FILING_DOSSIER_SCHEMA_VERSION,
    status: "quarantined",
    valuationInputs: null,
  });

export function preparePersonalFilingDossier(
  input: PersonalFilingDossierInput,
): PersonalFilingDossierResult {
  let snapshot: InputSnapshot | undefined;
  try {
    if (arguments.length !== 1 || isProxy(input)) fail();
    const descriptors = exactDataDescriptors(input, INPUT_KEYS);
    if (descriptors === undefined) fail();
    const controls = snapshotControls(
      descriptors.expectedBindings?.value,
      descriptors.dossierPlan?.value,
    );
    snapshot = snapshotInputs(
      descriptors,
      controls.dossierPlan.documentIndex + 1,
    );

    const admission =
      commitPersonalFilingQualityMeasurementForDossier(snapshot);
    if (
      admission.status !== "candidate_and_normalization_committed_for_dossier"
    ) {
      fail();
    }
    const committed = admission.commitment;
    const normalized = admission.normalization;
    if (
      committed.status !== "candidate_committed_for_personal_use" ||
      committed.audit.documentCount !== snapshot.sourceDocuments.length ||
      committed.audit.succeededDocumentCount !==
        committed.audit.documentCount ||
      committed.audit.quarantinedDocumentCount !== 0 ||
      !bindingsMatch(committed, controls.expectedBindings)
    ) {
      fail();
    }

    if (
      normalized.audit.sourceDocumentCount !==
        snapshot.sourceDocuments.length ||
      normalized.factVersions.length !==
        normalized.audit.sourceDocumentCount *
          PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.factsPerDocument
    ) {
      fail();
    }

    const selectedVersions = selectedDocumentFacts(
      normalized.factVersions,
      controls.dossierPlan.documentIndex,
      controls.dossierPlan.factKeys,
    );
    if (selectedVersions.length !== controls.dossierPlan.factKeys.length)
      fail();

    return composePreparedResult(
      normalized.factVersions,
      normalized.lineage,
      controls.dossierPlan,
    );
  } catch {
    return QUARANTINED_RESULT;
  } finally {
    wipeSnapshot(snapshot);
  }
}

function composePreparedResult(
  versions: readonly PersonalNormalizedFilingFactVersion[],
  normalizedLineage: readonly Readonly<{
    effectiveAt: string;
    key: PersonalFilingFactKey;
    predecessorFactId: `fact:sha256:${string}`;
    successorFactId: `fact:sha256:${string}`;
  }>[],
  plan: PersonalFilingDossierPlan,
): PersonalFilingDossierPreparedResult {
  const exposed: PersonalNormalizedFilingFactVersion[] = [];
  for (
    let documentIndex = 0;
    documentIndex <= plan.documentIndex;
    documentIndex += 1
  ) {
    exposed.push(
      ...selectedDocumentFacts(versions, documentIndex, plan.factKeys),
    );
  }
  if (exposed.length !== (plan.documentIndex + 1) * plan.factKeys.length) {
    fail();
  }

  const internalToResponseId = new Map<string, PersonalFilingDossierFactId>();
  const selectedAvailableAt = selectedDocumentAvailableAt(
    versions,
    plan.documentIndex,
  );
  const facts = Object.freeze(
    exposed.map((version, index) => {
      const id = responseId("fact", index);
      const evidenceId = responseId("evidence", index);
      internalToResponseId.set(version.factId, id);
      return Object.freeze({
        evidenceId,
        id,
        key: version.key,
        knownFrom: version.knownFrom,
        knownToExclusive:
          version.sourceAvailableAt === selectedAvailableAt
            ? null
            : version.knownToExclusive,
        label: PERSONAL_FILING_DOSSIER_FACT_LABELS[version.key],
        periodEnd: version.periodEnd,
        periodStart: version.periodStart,
        unit: version.unit,
        value: version.value,
        version:
          version.sourceAvailableAt === selectedAvailableAt
            ? ("current" as const)
            : ("superseded" as const),
      });
    }),
  );
  if (internalToResponseId.size !== exposed.length) fail();

  const evidence = Object.freeze(
    exposed.map((version, index) => dossierEvidence(version, index)),
  );

  const lineageEvents: PersonalFilingDossierLineageEvent[] = [];
  if (plan.documentIndex > 0) {
    for (const key of plan.factKeys) {
      const matches = normalizedLineage.filter((event) => event.key === key);
      const [event] = matches;
      if (matches.length !== 1 || event === undefined) fail();
      const predecessorFactId = internalToResponseId.get(
        event.predecessorFactId,
      );
      const successorFactId = internalToResponseId.get(event.successorFactId);
      if (predecessorFactId === undefined || successorFactId === undefined) {
        fail();
      }
      lineageEvents.push(
        Object.freeze({
          effectiveAt: event.effectiveAt,
          key,
          predecessorFactId,
          successorFactId,
        }),
      );
    }
  }
  const lineage = Object.freeze({
    events: Object.freeze(lineageEvents),
    scope: "issuer_filing_versions_within_exact_frozen_manifest_only" as const,
    status:
      plan.documentIndex > 0
        ? ("amendment_supersession_observed" as const)
        : ("root_only_no_in_corpus_amendment" as const),
  });

  const chart = composeChart(facts, plan.chartFactKeys);
  const valuationInputs = composeValuationInputs(facts);
  const hasOmissions = plan.factKeys.length < PERSONAL_FILING_FACT_KEYS.length;
  const omissions = Object.freeze({
    count: null,
    explanation: hasOmissions
      ? "The dossier contains only the exact owner-fixed fact scope."
      : "The complete bounded ten-fact snapshot is included.",
    hasOmissions,
    reasonCode: "OWNER_FIXED_SCOPE" as const,
  });

  return Object.freeze({
    asOf: selectedAvailableAt,
    chart,
    evidence,
    facts,
    lineage,
    omissions,
    profile: PERSONAL_FILING_DOSSIER_PROFILE,
    role: PERSONAL_FILING_DOSSIER_ROLE,
    schemaVersion: PERSONAL_FILING_DOSSIER_SCHEMA_VERSION,
    status: "prepared_personal_dossier_for_personal_use" as const,
    valuationInputs,
  });
}

function dossierEvidence(
  version: PersonalNormalizedFilingFactVersion,
  index: number,
): PersonalFilingDossierEvidence {
  const base = {
    factId: responseId("fact", index),
    id: responseId("evidence", index),
    sourceAcceptedAt: version.sourceAcceptedAt,
    sourceAccession: version.sourceAccession,
    sourceAvailableAt: version.sourceAvailableAt,
    sourceContentSha256: version.sourceContentSha256,
    sourceDocumentSha256: version.sourceDocumentSha256,
    taxonomy: version.taxonomy,
  };
  if (version.derivation === null) {
    if (version.sourceConcept === null) fail();
    return Object.freeze({
      ...base,
      derivationFormula: null,
      derivationOperands: Object.freeze([] as const),
      sourceConcept: version.sourceConcept,
    });
  }
  if (version.sourceConcept !== null) fail();
  return Object.freeze({
    ...base,
    derivationFormula: PERSONAL_FILING_FACT_FREE_CASH_FLOW_FORMULA,
    derivationOperands: Object.freeze([
      dossierDerivationOperand("minuend", version.derivation.minuend),
      dossierDerivationOperand("subtrahend", version.derivation.subtrahend),
    ] as const),
    sourceConcept: null,
  });
}

function dossierDerivationOperand<TRole extends "minuend" | "subtrahend">(
  role: TRole,
  operand: PersonalFilingFactDerivationOperand,
): PersonalFilingDossierDerivationOperand<TRole> {
  return Object.freeze({
    concept: operand.concept,
    periodEnd: operand.periodEnd,
    periodStart: operand.periodStart,
    role,
    unit: operand.unit,
    value: operand.value,
  });
}

function composeChart(
  facts: readonly PersonalFilingDossierFact[],
  chartFactKeys: readonly PersonalFilingFactKey[],
): PersonalFilingDossierChart {
  if (chartFactKeys.length === 0) {
    return Object.freeze({
      reasonCode: "NO_OWNER_APPROVED_CHART_FACTS" as const,
      status: "unsupported" as const,
    });
  }
  const series = chartFactKeys.map((key) => {
    const points = facts
      .filter((fact) => fact.key === key)
      .map((fact) => Object.freeze({ factId: fact.id }));
    const first = facts.find((fact) => fact.key === key);
    if (first === undefined || points.length === 0) fail();
    return Object.freeze({
      key,
      label: PERSONAL_FILING_DOSSIER_FACT_LABELS[key],
      points: Object.freeze(points),
      unit: first.unit,
    });
  });
  return Object.freeze({ series: Object.freeze(series), status: "ready" });
}

function composeValuationInputs(
  facts: readonly PersonalFilingDossierFact[],
): PersonalFilingDossierValuationInputs {
  const current = new Map(
    facts
      .filter((fact) => fact.version === "current")
      .map((fact) => [fact.key, fact]),
  );
  const revenue = current.get("revenue");
  const cash = current.get("cash");
  const debt = current.get("debt");
  const shares = current.get("diluted_shares");
  if (
    revenue === undefined ||
    cash === undefined ||
    debt === undefined ||
    shares === undefined
  ) {
    return Object.freeze({
      reasonCode: "REQUIRED_FACTS_NOT_RELEASED" as const,
      status: "unsupported" as const,
    });
  }
  if (
    !isPositiveDecimal(revenue.value) ||
    !isNonnegativeDecimal(cash.value) ||
    !isNonnegativeDecimal(debt.value) ||
    !isPositiveDecimal(shares.value)
  ) {
    return Object.freeze({
      reasonCode: "INPUT_OUT_OF_DOMAIN" as const,
      status: "unsupported" as const,
    });
  }
  return Object.freeze({
    baseRevenueFactId: revenue.id,
    cashFactId: cash.id,
    debtFactId: debt.id,
    dilutedSharesFactId: shares.id,
    modelVersion: "exit-multiple-v1" as const,
    status: "ready" as const,
  });
}

function selectedDocumentFacts(
  versions: readonly PersonalNormalizedFilingFactVersion[],
  documentIndex: number,
  factKeys: readonly PersonalFilingFactKey[],
): PersonalNormalizedFilingFactVersion[] {
  const start =
    documentIndex * PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.factsPerDocument;
  const documentFacts = versions.slice(
    start,
    start + PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.factsPerDocument,
  );
  if (
    documentFacts.length !== PERSONAL_FILING_FACT_KEYS.length ||
    documentFacts.some(
      (fact, index) => fact.key !== PERSONAL_FILING_FACT_KEYS[index],
    )
  ) {
    fail();
  }
  const byKey = new Map(documentFacts.map((fact) => [fact.key, fact]));
  return factKeys.map((key) => {
    const fact = byKey.get(key);
    if (fact === undefined) fail();
    return fact;
  });
}

function selectedDocumentAvailableAt(
  versions: readonly PersonalNormalizedFilingFactVersion[],
  documentIndex: number,
): string {
  const start =
    documentIndex * PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.factsPerDocument;
  const first = versions[start];
  if (first === undefined) fail();
  const selected = versions.slice(
    start,
    start + PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.factsPerDocument,
  );
  if (
    selected.length !== PERSONAL_FILING_FACT_KEYS.length ||
    selected.some((fact) => fact.sourceAvailableAt !== first.sourceAvailableAt)
  ) {
    fail();
  }
  return first.sourceAvailableAt;
}

function bindingsMatch(
  committed: PersonalFilingQualityMeasurementCommittedResult,
  expected: PersonalFilingSelectedFactReleaseExpectedBindings,
): boolean {
  return (
    committed.candidateCommitmentSha256 ===
      expected.candidateCommitmentSha256 &&
    committed.candidateObservationsSha256 ===
      expected.candidateObservationsSha256 &&
    committed.inputSetSha256 === expected.inputSetSha256 &&
    committed.ownerReviewedReferenceSha256 ===
      expected.ownerReviewedReferenceSha256 &&
    committed.qualityPlanSha256 === expected.qualityPlanSha256
  );
}

function snapshotControls(
  expectedBindings: unknown,
  dossierPlan: unknown,
): ControlSnapshot {
  const bindingDescriptors = exactDataDescriptors(
    expectedBindings,
    BINDING_KEYS,
  );
  const planDescriptors = exactDataDescriptors(dossierPlan, PLAN_KEYS);
  if (bindingDescriptors === undefined || planDescriptors === undefined) fail();

  const bindings = Object.fromEntries(
    BINDING_KEYS.map((key) => {
      const value = bindingDescriptors[key]?.value as unknown;
      if (typeof value !== "string" || !HASH.test(value)) fail();
      return [key, value];
    }),
  ) as unknown as PersonalFilingSelectedFactReleaseExpectedBindings;
  Object.freeze(bindings);

  const documentIndex = planDescriptors.documentIndex?.value as unknown;
  if (
    !Number.isSafeInteger(documentIndex) ||
    (documentIndex as number) < 0 ||
    planDescriptors.profile?.value !== PERSONAL_FILING_DOSSIER_PROFILE ||
    planDescriptors.role?.value !== PERSONAL_FILING_DOSSIER_PLAN_ROLE ||
    planDescriptors.schemaVersion?.value !==
      PERSONAL_FILING_DOSSIER_SCHEMA_VERSION ||
    planDescriptors.snapshotRule?.value !==
      PERSONAL_FILING_DOSSIER_SNAPSHOT_RULE
  ) {
    fail();
  }
  const factKeys = snapshotFactKeys(planDescriptors.factKeys?.value, 1);
  const chartFactKeys = snapshotFactKeys(
    planDescriptors.chartFactKeys?.value,
    0,
  );
  if (chartFactKeys.some((key) => !factKeys.includes(key))) fail();
  if (chartFactKeys.length > 1) {
    const firstKey = chartFactKeys[0];
    if (firstKey === undefined) fail();
    const first = contractFor(firstKey);
    if (
      chartFactKeys.some((key) => {
        const contract = contractFor(key);
        return (
          contract.unit !== first.unit ||
          contract.periodKind !== first.periodKind
        );
      })
    ) {
      fail();
    }
  }
  return Object.freeze({
    dossierPlan: Object.freeze({
      chartFactKeys,
      documentIndex: documentIndex as number,
      factKeys,
      profile: PERSONAL_FILING_DOSSIER_PROFILE,
      role: PERSONAL_FILING_DOSSIER_PLAN_ROLE,
      schemaVersion: PERSONAL_FILING_DOSSIER_SCHEMA_VERSION,
      snapshotRule: PERSONAL_FILING_DOSSIER_SNAPSHOT_RULE,
    }),
    expectedBindings: bindings,
  });
}

function snapshotFactKeys(
  value: unknown,
  minimumLength: number,
): readonly PersonalFilingFactKey[] {
  const descriptors = exactArrayDescriptors(
    value,
    minimumLength,
    PERSONAL_FILING_FACT_KEYS.length,
  );
  if (descriptors === undefined) fail();
  const length = descriptors.length?.value as number;
  const keys: PersonalFilingFactKey[] = [];
  let previousIndex = -1;
  for (let index = 0; index < length; index += 1) {
    const key = descriptors[String(index)]?.value as unknown;
    const canonicalIndex = PERSONAL_FILING_FACT_KEYS.indexOf(
      key as PersonalFilingFactKey,
    );
    if (canonicalIndex <= previousIndex) fail();
    keys.push(key as PersonalFilingFactKey);
    previousIndex = canonicalIndex;
  }
  return Object.freeze(keys);
}

function snapshotInputs(
  descriptors: Record<string, PropertyDescriptor>,
  documentCount: number,
): InputSnapshot {
  const seenBuffers = new Set<object>();
  return Object.freeze({
    declaration: byteSnapshot(
      descriptors.declaration?.value,
      PERSONAL_FILING_CORPUS_LIMITS.declarationBytes,
      seenBuffers,
    ),
    manifest: byteSnapshot(
      descriptors.manifest?.value,
      PERSONAL_FILING_CORPUS_LIMITS.manifestBytes,
      seenBuffers,
    ),
    normalizationPlan: byteSnapshot(
      descriptors.normalizationPlan?.value,
      PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.normalizationPlanBytes,
      seenBuffers,
    ),
    qualityPlan: byteSnapshot(
      descriptors.qualityPlan?.value,
      PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.qualityPlanBytes,
      seenBuffers,
    ),
    rawFilingDocuments: snapshotDocumentArray(
      descriptors.rawFilingDocuments?.value,
      PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS.rawFilingDocumentBytes,
      seenBuffers,
      documentCount,
    ),
    sourceDocuments: snapshotDocumentArray(
      descriptors.sourceDocuments?.value,
      PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.parserResultBytes,
      seenBuffers,
      documentCount,
    ),
  });
}

function snapshotDocumentArray(
  value: unknown,
  maximumBytes: number,
  seenBuffers: Set<object>,
  documentCount: number,
): readonly Uint8Array[] {
  const descriptors = prefixArrayDescriptors(value, documentCount);
  if (descriptors === undefined) fail();
  return Object.freeze(
    Array.from({ length: documentCount }, (_, index) =>
      byteSnapshot(
        descriptors[String(index)]?.value,
        maximumBytes,
        seenBuffers,
      ),
    ),
  );
}

function prefixArrayDescriptors(
  value: unknown,
  documentCount: number,
): Record<string, PropertyDescriptor> | undefined {
  try {
    if (
      !Number.isSafeInteger(documentCount) ||
      documentCount < 1 ||
      documentCount > PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.documents ||
      isProxy(value) ||
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      return undefined;
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    const length = lengthDescriptor?.value as unknown;
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < documentCount
    ) {
      return undefined;
    }
    const descriptors: Record<string, PropertyDescriptor> = {
      length: lengthDescriptor,
    };
    for (let index = 0; index < documentCount; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      ) {
        return undefined;
      }
      descriptors[String(index)] = descriptor;
    }
    return descriptors;
  } catch {
    return undefined;
  }
}

function byteSnapshot(
  value: unknown,
  maximumBytes: number,
  seenBuffers: Set<object>,
): Uint8Array {
  try {
    if (typeof value !== "object" || value === null || isProxy(value)) fail();
    const tag = TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR?.get?.call(
      value,
    ) as unknown;
    const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR?.get?.call(value) as unknown;
    const byteLength = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      value,
    ) as unknown;
    const backingByteLength = ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      buffer,
    ) as unknown;
    if (
      tag !== "Uint8Array" ||
      typeof byteLength !== "number" ||
      typeof backingByteLength !== "number" ||
      Object.getPrototypeOf(value) !== Uint8Array.prototype ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype ||
      byteLength < 1 ||
      byteLength > maximumBytes ||
      seenBuffers.has(buffer as object)
    ) {
      fail();
    }
    seenBuffers.add(buffer as object);
    const snapshot = new Uint8Array(byteLength);
    Uint8Array.prototype.set.call(snapshot, value as Uint8Array);
    return snapshot;
  } catch (error) {
    if (error instanceof DossierFailure) throw error;
    fail();
  }
}

function exactDataDescriptors(
  value: unknown,
  keys: readonly string[],
): Record<string, PropertyDescriptor> | undefined {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      isProxy(value) ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    const expected = [...keys].sort();
    if (
      ownKeys.some((key) => typeof key !== "string") ||
      ownKeys.length !== expected.length ||
      (ownKeys as string[]).sort().some((key, index) => key !== expected[index])
    ) {
      return undefined;
    }
    for (const key of expected) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      ) {
        return undefined;
      }
    }
    return descriptors;
  } catch {
    return undefined;
  }
}

function exactArrayDescriptors(
  value: unknown,
  minimumLength: number,
  maximumLength: number,
): Record<string, PropertyDescriptor> | undefined {
  try {
    if (
      isProxy(value) ||
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(
      value,
    ) as unknown as Record<string, PropertyDescriptor>;
    const lengthDescriptor = descriptors.length;
    const length = lengthDescriptor?.value as unknown;
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < minimumLength ||
      length > maximumLength
    ) {
      return undefined;
    }
    const expectedKeys = [
      ...Array.from({ length }, (_, index) => String(index)),
      "length",
    ].sort();
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.some((key) => typeof key !== "string") ||
      ownKeys.length !== expectedKeys.length ||
      (ownKeys as string[])
        .sort()
        .some((key, index) => key !== expectedKeys[index])
    ) {
      return undefined;
    }
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      ) {
        return undefined;
      }
    }
    return descriptors;
  } catch {
    return undefined;
  }
}

function contractFor(key: PersonalFilingFactKey) {
  const contract = PERSONAL_FILING_FACT_CONTRACTS.find(
    (candidate) => candidate.key === key,
  );
  if (contract === undefined) fail();
  return contract;
}

function responseId(
  kind: "evidence",
  index: number,
): PersonalFilingDossierEvidenceId;
function responseId(kind: "fact", index: number): PersonalFilingDossierFactId;
function responseId(
  kind: "evidence" | "fact",
  index: number,
): PersonalFilingDossierEvidenceId | PersonalFilingDossierFactId {
  return `${kind}-${String(index + 1).padStart(4, "0")}`;
}

function isPositiveDecimal(value: string): boolean {
  return !value.startsWith("-") && /[1-9]/u.test(value);
}

function isNonnegativeDecimal(value: string): boolean {
  return !value.startsWith("-");
}

function wipeSnapshot(snapshot: InputSnapshot | undefined): void {
  if (snapshot === undefined) return;
  for (const bytes of [
    snapshot.declaration,
    snapshot.manifest,
    snapshot.normalizationPlan,
    snapshot.qualityPlan,
    ...snapshot.rawFilingDocuments,
    ...snapshot.sourceDocuments,
  ]) {
    bytes.fill(0);
  }
}

function fail(): never {
  throw new DossierFailure();
}
