import { isProxy } from "node:util/types";

import { PERSONAL_FILING_CORPUS_LIMITS } from "./personal-filing-corpus";
import {
  PERSONAL_FILING_FACT_KEYS,
  PERSONAL_FILING_FACT_NORMALIZATION_LIMITS,
  normalizePersonalFilingFacts,
  type PersonalFilingFactKey,
  type PersonalFilingFactUnit,
} from "./personal-filing-fact-normalization";
import {
  PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS,
  createPersonalFilingQualityMeasurementProtocol,
} from "./personal-filing-quality-measurement";
import { PERSONAL_FILING_RAW_FACT_EXTRACTION_LIMITS } from "./personal-filing-raw-fact-extraction";

export const PERSONAL_FILING_SELECTED_FACT_RELEASE_SCHEMA_VERSION =
  "1.0.0" as const;
export const PERSONAL_FILING_SELECTED_FACT_RELEASE_PROFILE =
  "personal_single_user_local" as const;
export const PERSONAL_FILING_SELECTED_FACT_RELEASE_PLAN_ROLE =
  "personal_selected_fact_release_plan" as const;
export const PERSONAL_FILING_SELECTED_FACT_RELEASE_ROLE =
  "personal_selected_fact_release" as const;
export const PERSONAL_FILING_SELECTED_FACT_RELEASE_SELECTION_RULE =
  "exact_candidate_document_index_and_fact_key.v1" as const;

export interface PersonalFilingSelectedFactReleaseExpectedBindings {
  readonly candidateCommitmentSha256: `sha256:${string}`;
  readonly candidateObservationsSha256: `sha256:${string}`;
  readonly inputSetSha256: `sha256:${string}`;
  readonly ownerReviewedReferenceSha256: `sha256:${string}`;
  readonly qualityPlanSha256: `sha256:${string}`;
}

export interface PersonalFilingSelectedFactReleasePlan {
  readonly documentIndex: number;
  readonly factKeys: readonly PersonalFilingFactKey[];
  readonly profile: typeof PERSONAL_FILING_SELECTED_FACT_RELEASE_PROFILE;
  readonly role: typeof PERSONAL_FILING_SELECTED_FACT_RELEASE_PLAN_ROLE;
  readonly schemaVersion: typeof PERSONAL_FILING_SELECTED_FACT_RELEASE_SCHEMA_VERSION;
  readonly selectionRule: typeof PERSONAL_FILING_SELECTED_FACT_RELEASE_SELECTION_RULE;
}

export interface PersonalFilingSelectedFactReleaseInput {
  readonly declaration: Uint8Array;
  readonly expectedBindings: PersonalFilingSelectedFactReleaseExpectedBindings;
  readonly manifest: Uint8Array;
  readonly normalizationPlan: Uint8Array;
  readonly qualityPlan: Uint8Array;
  readonly rawFilingDocuments: readonly Uint8Array[];
  readonly releasePlan: PersonalFilingSelectedFactReleasePlan;
  readonly sourceDocuments: readonly Uint8Array[];
}

export interface PersonalFilingSelectedFact {
  readonly key: PersonalFilingFactKey;
  readonly periodEnd: string;
  readonly periodStart: string | null;
  readonly unit: PersonalFilingFactUnit;
  readonly value: string;
}

export interface PersonalFilingSelectedFactReleasePreparedResult {
  readonly facts: readonly PersonalFilingSelectedFact[];
  readonly profile: typeof PERSONAL_FILING_SELECTED_FACT_RELEASE_PROFILE;
  readonly role: typeof PERSONAL_FILING_SELECTED_FACT_RELEASE_ROLE;
  readonly schemaVersion: typeof PERSONAL_FILING_SELECTED_FACT_RELEASE_SCHEMA_VERSION;
  readonly status: "prepared_selected_facts_for_personal_use";
}

export interface PersonalFilingSelectedFactReleaseQuarantinedResult {
  readonly facts: readonly [];
  readonly profile: typeof PERSONAL_FILING_SELECTED_FACT_RELEASE_PROFILE;
  readonly role: typeof PERSONAL_FILING_SELECTED_FACT_RELEASE_ROLE;
  readonly schemaVersion: typeof PERSONAL_FILING_SELECTED_FACT_RELEASE_SCHEMA_VERSION;
  readonly status: "quarantined";
}

export type PersonalFilingSelectedFactReleaseResult =
  | PersonalFilingSelectedFactReleasePreparedResult
  | PersonalFilingSelectedFactReleaseQuarantinedResult;

interface InputSnapshot {
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
  readonly normalizationPlan: Uint8Array;
  readonly qualityPlan: Uint8Array;
  readonly rawFilingDocuments: readonly Uint8Array[];
  readonly sourceDocuments: readonly Uint8Array[];
}

interface ControlSnapshot {
  readonly expectedBindings: PersonalFilingSelectedFactReleaseExpectedBindings;
  readonly releasePlan: PersonalFilingSelectedFactReleasePlan;
}

class ReleaseFailure extends Error {}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const INPUT_KEYS = [
  "declaration",
  "expectedBindings",
  "manifest",
  "normalizationPlan",
  "qualityPlan",
  "rawFilingDocuments",
  "releasePlan",
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
  "documentIndex",
  "factKeys",
  "profile",
  "role",
  "schemaVersion",
  "selectionRule",
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
const EMPTY_FACTS: readonly [] = Object.freeze([]);
const QUARANTINED_RESULT = Object.freeze({
  facts: EMPTY_FACTS,
  profile: PERSONAL_FILING_SELECTED_FACT_RELEASE_PROFILE,
  role: PERSONAL_FILING_SELECTED_FACT_RELEASE_ROLE,
  schemaVersion: PERSONAL_FILING_SELECTED_FACT_RELEASE_SCHEMA_VERSION,
  status: "quarantined" as const,
});

export function preparePersonalFilingSelectedFactRelease(
  input: PersonalFilingSelectedFactReleaseInput,
): PersonalFilingSelectedFactReleaseResult {
  let snapshot: InputSnapshot | undefined;
  try {
    if (arguments.length !== 1 || isProxy(input)) fail();
    const descriptors = exactDataDescriptors(input, INPUT_KEYS);
    if (descriptors === undefined) fail();
    const controls = snapshotControls(
      descriptors.expectedBindings?.value,
      descriptors.releasePlan?.value,
    );
    snapshot = snapshotInputs(descriptors);

    const protocol = createPersonalFilingQualityMeasurementProtocol();
    const committed = protocol.commit(snapshot);
    if (
      committed.status !== "candidate_committed_for_personal_use" ||
      !bindingsMatch(committed, controls.expectedBindings)
    ) {
      fail();
    }

    const normalization = normalizePersonalFilingFacts({
      declaration: snapshot.declaration,
      manifest: snapshot.manifest,
      normalizationPlan: snapshot.normalizationPlan,
      sourceDocuments: snapshot.sourceDocuments,
    });
    if (
      normalization.status !== "normalized_for_personal_use" ||
      normalization.audit.sourceDocumentCount !==
        committed.audit.documentCount ||
      committed.audit.succeededDocumentCount !==
        committed.audit.documentCount ||
      committed.audit.quarantinedDocumentCount !== 0 ||
      controls.releasePlan.documentIndex >= committed.audit.documentCount ||
      normalization.factVersions.length !==
        committed.audit.documentCount *
          PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument
    ) {
      fail();
    }

    const start =
      controls.releasePlan.documentIndex *
      PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument;
    const documentFacts = normalization.factVersions.slice(
      start,
      start + PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.factsPerDocument,
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
    const facts = Object.freeze(
      controls.releasePlan.factKeys.map((key) => {
        const fact = byKey.get(key);
        if (fact === undefined) fail();
        return Object.freeze({
          key: fact.key,
          periodEnd: fact.periodEnd,
          periodStart: fact.periodStart,
          unit: fact.unit,
          value: fact.value,
        });
      }),
    );
    return Object.freeze({
      facts,
      profile: PERSONAL_FILING_SELECTED_FACT_RELEASE_PROFILE,
      role: PERSONAL_FILING_SELECTED_FACT_RELEASE_ROLE,
      schemaVersion: PERSONAL_FILING_SELECTED_FACT_RELEASE_SCHEMA_VERSION,
      status: "prepared_selected_facts_for_personal_use" as const,
    });
  } catch {
    return QUARANTINED_RESULT;
  } finally {
    wipeSnapshot(snapshot);
  }
}

function snapshotControls(
  expectedBindings: unknown,
  releasePlan: unknown,
): ControlSnapshot {
  const bindingDescriptors = exactDataDescriptors(
    expectedBindings,
    BINDING_KEYS,
  );
  const planDescriptors = exactDataDescriptors(releasePlan, PLAN_KEYS);
  if (bindingDescriptors === undefined || planDescriptors === undefined) fail();

  const bindings = Object.fromEntries(
    BINDING_KEYS.map((key) => {
      const value = bindingDescriptors[key]?.value as unknown;
      if (typeof value !== "string" || !HASH.test(value)) fail();
      return [key, value];
    }),
  ) as unknown as PersonalFilingSelectedFactReleaseExpectedBindings;

  const documentIndex = planDescriptors.documentIndex?.value as unknown;
  if (
    !Number.isSafeInteger(documentIndex) ||
    (documentIndex as number) < 0 ||
    planDescriptors.profile?.value !==
      PERSONAL_FILING_SELECTED_FACT_RELEASE_PROFILE ||
    planDescriptors.role?.value !==
      PERSONAL_FILING_SELECTED_FACT_RELEASE_PLAN_ROLE ||
    planDescriptors.schemaVersion?.value !==
      PERSONAL_FILING_SELECTED_FACT_RELEASE_SCHEMA_VERSION ||
    planDescriptors.selectionRule?.value !==
      PERSONAL_FILING_SELECTED_FACT_RELEASE_SELECTION_RULE
  ) {
    fail();
  }
  const factKeys = snapshotFactKeys(planDescriptors.factKeys?.value);
  return Object.freeze({
    expectedBindings: Object.freeze(bindings),
    releasePlan: Object.freeze({
      documentIndex: documentIndex as number,
      factKeys,
      profile: PERSONAL_FILING_SELECTED_FACT_RELEASE_PROFILE,
      role: PERSONAL_FILING_SELECTED_FACT_RELEASE_PLAN_ROLE,
      schemaVersion: PERSONAL_FILING_SELECTED_FACT_RELEASE_SCHEMA_VERSION,
      selectionRule: PERSONAL_FILING_SELECTED_FACT_RELEASE_SELECTION_RULE,
    }),
  });
}

function snapshotFactKeys(value: unknown): readonly PersonalFilingFactKey[] {
  const descriptors = exactArrayDescriptors(
    value,
    1,
    PERSONAL_FILING_FACT_KEYS.length,
  );
  if (descriptors === undefined) fail();
  const keys: PersonalFilingFactKey[] = [];
  let priorIndex = -1;
  const length = descriptors.length?.value as number;
  for (let index = 0; index < length; index += 1) {
    const key = descriptors[String(index)]?.value as unknown;
    const canonicalIndex = PERSONAL_FILING_FACT_KEYS.indexOf(
      key as PersonalFilingFactKey,
    );
    if (canonicalIndex <= priorIndex) fail();
    keys.push(key as PersonalFilingFactKey);
    priorIndex = canonicalIndex;
  }
  return Object.freeze(keys);
}

function snapshotInputs(
  descriptors: Record<string, PropertyDescriptor>,
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
    ),
    sourceDocuments: snapshotDocumentArray(
      descriptors.sourceDocuments?.value,
      PERSONAL_FILING_FACT_NORMALIZATION_LIMITS.parserResultBytes,
      seenBuffers,
    ),
  });
}

function snapshotDocumentArray(
  value: unknown,
  maximumBytes: number,
  seenBuffers: Set<object>,
): readonly Uint8Array[] {
  const descriptors = exactArrayDescriptors(
    value,
    1,
    PERSONAL_FILING_QUALITY_MEASUREMENT_LIMITS.documents,
  );
  if (descriptors === undefined) fail();
  const length = descriptors.length?.value as number;
  return Object.freeze(
    Array.from({ length }, (_, index) =>
      byteSnapshot(
        descriptors[String(index)]?.value,
        maximumBytes,
        seenBuffers,
      ),
    ),
  );
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
    if (error instanceof ReleaseFailure) throw error;
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

function bindingsMatch(
  actual: PersonalFilingSelectedFactReleaseExpectedBindings,
  expected: PersonalFilingSelectedFactReleaseExpectedBindings,
): boolean {
  return BINDING_KEYS.every((key) => actual[key] === expected[key]);
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
  throw new ReleaseFailure();
}
