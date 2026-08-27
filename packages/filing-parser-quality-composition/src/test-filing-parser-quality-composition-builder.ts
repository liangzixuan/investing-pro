import { createHash } from "node:crypto";

import {
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM,
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_MODE,
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_SCHEMA_VERSION,
  type FilingParserCrossEngineDirectExecutionBoundary,
  type FilingParserCrossEngineDirectExecutionConfiguration,
  type FilingParserCrossEngineDirectExecutionResult,
} from "@research-cockpit/filing-parser-cross-engine-execution";
import {
  FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS,
  FILING_QUALITY_MEASUREMENT_DECLARATIONS,
  FILING_QUALITY_MEASUREMENT_FACT_KEYS,
  FILING_QUALITY_MEASUREMENT_METRICS,
  FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
} from "@research-cockpit/filing-quality-measurement";

export const TEST_PYTHON_IMAGE = `sha256:${"a".repeat(64)}` as const;
export const TEST_NODE_IMAGE = `sha256:${"b".repeat(64)}` as const;
const PYTHON_IMPLEMENTATION = `sha256:${"c".repeat(64)}` as const;
const NODE_IMPLEMENTATION = `sha256:${"d".repeat(64)}` as const;
const ORIGINAL_ACCESSION = "SYN-0000000001-26-000001";
const AMENDMENT_ACCESSION = "SYN-0000000001-26-000002";
const ORIGINAL_ACCEPTED_AT = "2026-02-20T20:00:00.000Z";
const ORIGINAL_AVAILABLE_AT = "2026-02-20T20:00:01.000Z";
const AMENDMENT_ACCEPTED_AT = "2026-03-15T20:00:00.000Z";
const AMENDMENT_AVAILABLE_AT = "2026-03-15T20:00:01.000Z";
const DOCUMENT_DOMAIN = text(
  "research-cockpit:synthetic-filing-quality-document:v1\u0000",
);
const AGREEMENT_DOMAIN = text(
  "research-cockpit:synthetic-filing-parser-cross-engine-execution:v1\u0000",
);
const LIFECYCLE_DOMAIN = text(
  "research-cockpit:synthetic-filing-parser-direct-container-lifecycle:v1\u0000",
);
const INVOCATION_DOMAIN = text(
  "research-cockpit:synthetic-filing-parser-direct-cross-engine-invocation:v1\u0000",
);

const ORIGINAL_VALUES: Readonly<Record<FactKey, string>> = Object.freeze({
  assets: "250000000",
  cash: "24000000",
  debt: "40000000",
  diluted_shares: "25000000",
  free_cash_flow: "15000000",
  gross_profit: "60000000",
  net_income: "12000000",
  operating_cash_flow: "20000000",
  operating_income: "18000000",
  revenue: "120000000",
});
const AMENDMENT_VALUES: Readonly<Record<FactKey, string>> = Object.freeze({
  assets: "250000000",
  cash: "24000000",
  debt: "40000000",
  diluted_shares: "25000000",
  free_cash_flow: "14000000",
  gross_profit: "57000000",
  net_income: "10000000",
  operating_cash_flow: "20000000",
  operating_income: "16000000",
  revenue: "116400000",
});
const CONTRACTS = Object.freeze({
  assets: Object.freeze({
    concept: "rc-synthetic:Assets",
    periodStart: null,
    unit: "USD",
  }),
  cash: Object.freeze({
    concept: "rc-synthetic:CashAndCashEquivalents",
    periodStart: null,
    unit: "USD",
  }),
  debt: Object.freeze({
    concept: "rc-synthetic:Debt",
    periodStart: null,
    unit: "USD",
  }),
  diluted_shares: Object.freeze({
    concept: "rc-synthetic:WeightedAverageDilutedShares",
    periodStart: "2025-01-01",
    unit: "shares",
  }),
  free_cash_flow: Object.freeze({
    concept: "rc-synthetic:FreeCashFlow",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  gross_profit: Object.freeze({
    concept: "rc-synthetic:GrossProfit",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  net_income: Object.freeze({
    concept: "rc-synthetic:NetIncome",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  operating_cash_flow: Object.freeze({
    concept: "rc-synthetic:OperatingCashFlow",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  operating_income: Object.freeze({
    concept: "rc-synthetic:OperatingIncome",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
  revenue: Object.freeze({
    concept: "rc-synthetic:Revenue",
    periodStart: "2025-01-01",
    unit: "USD",
  }),
} satisfies Readonly<
  Record<
    FactKey,
    Readonly<{ concept: string; periodStart: string | null; unit: string }>
  >
>);

type FactKey = (typeof FILING_QUALITY_MEASUREMENT_FACT_KEYS)[number];

export interface FilingParserQualityCompositionTestHarness {
  readonly amendmentArchive: Uint8Array;
  readonly boundary: StaticDirectExecutionBoundary;
  readonly configuration: FilingParserCrossEngineDirectExecutionConfiguration;
  readonly declaredReference: Uint8Array;
  readonly declaredReferenceSha256: `sha256:${string}`;
  readonly directResult: FilingParserCrossEngineDirectExecutionResult;
  readonly normalization: Record<string, unknown>;
  readonly originalArchive: Uint8Array;
  readonly plan: Uint8Array;
}

export interface FilingParserQualityCompositionDirectResultTestOverrides {
  readonly nodeEngineId?: string;
  readonly nodeExecutionBindingSha256?: `sha256:${string}`;
  readonly pythonEngineId?: string;
  readonly pythonExecutionBindingSha256?: `sha256:${string}`;
}

export class StaticDirectExecutionBoundary implements FilingParserCrossEngineDirectExecutionBoundary {
  public readonly calls: Array<{
    amendment: Uint8Array;
    original: Uint8Array;
  }> = [];
  public defer = false;
  public outcome: FilingParserCrossEngineDirectExecutionResult;
  readonly #releasePromise: Promise<void>;
  readonly #resolveRelease: () => void;
  readonly started: Promise<void>;
  readonly #resolveStarted: () => void;

  public constructor(outcome: FilingParserCrossEngineDirectExecutionResult) {
    this.outcome = outcome;
    let resolveRelease = (): void => undefined;
    let resolveStarted = (): void => undefined;
    this.#releasePromise = new Promise((resolve) => {
      resolveRelease = resolve;
    });
    this.started = new Promise((resolve) => {
      resolveStarted = resolve;
    });
    this.#resolveRelease = resolveRelease;
    this.#resolveStarted = resolveStarted;
  }

  public release(): void {
    this.#resolveRelease();
  }

  public async execute(
    originalArchive: unknown,
    amendmentArchive: unknown,
  ): Promise<FilingParserCrossEngineDirectExecutionResult> {
    if (
      !(originalArchive instanceof Uint8Array) ||
      !(amendmentArchive instanceof Uint8Array)
    )
      throw new TypeError();
    this.calls.push({
      amendment: Uint8Array.from(amendmentArchive),
      original: Uint8Array.from(originalArchive),
    });
    this.#resolveStarted();
    if (this.defer) await this.#releasePromise;
    return this.outcome;
  }
}

export function buildFilingParserQualityCompositionTestHarness(): FilingParserQualityCompositionTestHarness {
  const originalArchive = text("synthetic-original-archive-v1");
  const amendmentArchive = text("synthetic-amendment-archive-v1");
  const normalization = buildNormalization(originalArchive, amendmentArchive);
  const directResult = buildDirectResult(
    normalization,
    originalArchive,
    amendmentArchive,
  );
  const boundary = new StaticDirectExecutionBoundary(directResult);
  const plan = canonicalTestDocument(buildPlan());
  const planSha256 = sha256(plan);
  const declaredReference = canonicalTestDocument(buildReference(planSha256));
  return Object.freeze({
    amendmentArchive,
    boundary,
    configuration: Object.freeze({
      nodeSecondary: Object.freeze({
        engineId: "node-24-secondary-v1",
        imageSha256: TEST_NODE_IMAGE,
        implementationSha256: NODE_IMPLEMENTATION,
        role: "node-secondary" as const,
      }),
      pythonPrimary: Object.freeze({
        engineId: "python-3.12-primary-v1",
        imageSha256: TEST_PYTHON_IMAGE,
        implementationSha256: PYTHON_IMPLEMENTATION,
        role: "python-primary" as const,
      }),
    }),
    declaredReference,
    declaredReferenceSha256: sha256(declaredReference),
    directResult,
    normalization,
    originalArchive,
    plan,
  });
}

export function buildDirectResultForTest(
  normalization: Record<string, unknown>,
  originalArchive: Uint8Array,
  amendmentArchive: Uint8Array,
  invocationNonce = "default",
  overrides: FilingParserQualityCompositionDirectResultTestOverrides = {},
): FilingParserCrossEngineDirectExecutionResult {
  return buildDirectResult(
    normalization,
    originalArchive,
    amendmentArchive,
    invocationNonce,
    overrides,
  );
}

export function canonicalTestDocument(value: unknown): Uint8Array {
  return text(`${canonicalJson(value)}\n`);
}

export function decodeTestDocument(bytes: Uint8Array): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

export function sha256ForTest(value: Uint8Array): `sha256:${string}` {
  return sha256(value);
}

function buildPlan(): Record<string, unknown> {
  return {
    assertionKinds: FILING_QUALITY_MEASUREMENT_ASSERTION_KINDS,
    assertionTarget: 2_000,
    candidateStatuses: ["quarantined", "succeeded"],
    declaredAdjudicators:
      FILING_QUALITY_MEASUREMENT_DECLARATIONS.declaredAdjudicators,
    declaredCandidate: FILING_QUALITY_MEASUREMENT_DECLARATIONS.candidate,
    documentRole: "synthetic_pilot_plan",
    documentTarget: 100,
    factKeys: FILING_QUALITY_MEASUREMENT_FACT_KEYS,
    factTarget: 1_000,
    frozenAt: "2026-01-01T00:00:00.000Z",
    metrics: FILING_QUALITY_MEASUREMENT_METRICS,
    planId: "synthetic-filing-quality-plan.v1",
    planVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    referenceDeclaration:
      "declared_synthetic_reference_not_independently_adjudicated",
    schemaVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    synthetic: true,
    thresholds: {
      dateToleranceDays: 0,
      documentSuccessMinimum: "0.95",
      factPrecisionMinimum: "0.99",
      factRecallMinimum: "0.99",
      maximumQuarantineRate: "0.05",
      maximumSilentCriticalFailures: 0,
      unitTolerancePolicy: "exact_canonical_unit.v1",
    },
  };
}

function buildReference(
  planSha256: `sha256:${string}`,
): Record<string, unknown> {
  return {
    criticalAssertionCount: 2_000,
    declaredAdjudicators:
      FILING_QUALITY_MEASUREMENT_DECLARATIONS.declaredAdjudicators,
    declaredAt: "2026-01-02T00:00:00.000Z",
    declaration: "declared_synthetic_reference_not_independently_adjudicated",
    documentCount: 100,
    documentRole: "declared_reference",
    documents: Array.from({ length: 100 }, (_, index) => {
      const ordinal = index + 1;
      const documentId = `synthetic-filing-${String(ordinal).padStart(4, "0")}`;
      const values =
        ordinal === 1
          ? ORIGINAL_VALUES
          : ordinal === 2
            ? AMENDMENT_VALUES
            : undefined;
      return {
        documentId,
        documentSha256: domainSha256(DOCUMENT_DOMAIN, documentId),
        facts: FILING_QUALITY_MEASUREMENT_FACT_KEYS.map(
          (factKey, factIndex) => {
            const contract = CONTRACTS[factKey];
            return {
              concept: contract.concept,
              dimensions: [],
              factKey,
              periodEnd: "2025-12-31",
              periodStart: contract.periodStart,
              unit: contract.unit,
              value:
                values?.[factKey] ??
                String(1_000_000 + ordinal * 100 + factIndex),
            };
          },
        ),
      };
    }),
    factCount: 1_000,
    populationId: "synthetic-filing-quality-reference.v1",
    populationVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    planSha256,
    schemaVersion: FILING_QUALITY_MEASUREMENT_SCHEMA_VERSION,
    synthetic: true,
  };
}

function buildNormalization(
  originalArchive: Uint8Array,
  amendmentArchive: Uint8Array,
): Record<string, unknown> {
  const originalDocumentSha256 = sha256(
    text("synthetic-original-parser-document-v1"),
  );
  const amendmentDocumentSha256 = sha256(
    text("synthetic-amendment-parser-document-v1"),
  );
  const originalIds = FILING_QUALITY_MEASUREMENT_FACT_KEYS.map((key) =>
    factId("original", key),
  );
  const amendmentIds = FILING_QUALITY_MEASUREMENT_FACT_KEYS.map((key) =>
    factId("amendment", key),
  );
  const facts = [
    ...buildNormalizedFacts(
      "original",
      ORIGINAL_VALUES,
      originalArchive,
      originalDocumentSha256,
      originalIds,
      amendmentIds,
      ORIGINAL_ACCESSION,
      ORIGINAL_ACCEPTED_AT,
      ORIGINAL_AVAILABLE_AT,
      AMENDMENT_AVAILABLE_AT,
    ),
    ...buildNormalizedFacts(
      "amendment",
      AMENDMENT_VALUES,
      amendmentArchive,
      amendmentDocumentSha256,
      amendmentIds,
      originalIds,
      AMENDMENT_ACCESSION,
      AMENDMENT_ACCEPTED_AT,
      AMENDMENT_AVAILABLE_AT,
      null,
    ),
  ];
  return {
    amendmentDocumentSha256,
    audit: { factVersionCount: 20, lineageCount: 10, outcome: "normalized" },
    claim:
      "bounded_synthetic_ten_fact_normalization_and_amendment_supersession_lineage",
    factVersions: facts,
    lineage: FILING_QUALITY_MEASUREMENT_FACT_KEYS.map((key, index) => ({
      effectiveAt: AMENDMENT_AVAILABLE_AT,
      key,
      predecessorFactId: originalIds[index],
      successorFactId: amendmentIds[index],
    })),
    originalDocumentSha256,
    schemaVersion: "1.0.0",
    status: "normalized",
    synthetic: true,
  };
}

function buildNormalizedFacts(
  role: "amendment" | "original",
  values: Readonly<Record<FactKey, string>>,
  archive: Uint8Array,
  documentSha256: `sha256:${string}`,
  ids: readonly `fact:sha256:${string}`[],
  counterparts: readonly `fact:sha256:${string}`[],
  accession: string,
  acceptedAt: string,
  availableAt: string,
  knownToExclusive: string | null,
): readonly Record<string, unknown>[] {
  return FILING_QUALITY_MEASUREMENT_FACT_KEYS.map((key, index) => {
    const contract = CONTRACTS[key];
    return {
      dimensions: {},
      factId: ids[index],
      key,
      knownFrom: availableAt,
      knownToExclusive,
      parserVersion: "synthetic-ten-fact-producer-v1",
      periodEnd: "2025-12-31",
      periodStart: contract.periodStart,
      predecessorFactId: role === "original" ? null : counterparts[index],
      sourceAcceptedAt: acceptedAt,
      sourceAccession: accession,
      sourceAvailableAt: availableAt,
      sourceConcept: contract.concept,
      sourceContentSha256: sha256(archive),
      sourceDocumentSha256: documentSha256,
      successorFactId: role === "original" ? counterparts[index] : null,
      synthetic: true,
      taxonomyFamily: "rc-synthetic-ten-fact",
      taxonomyVersion: "1.0.0",
      unit: contract.unit,
      value: values[key],
    };
  });
}

function buildDirectResult(
  normalization: Record<string, unknown>,
  originalArchive: Uint8Array,
  amendmentArchive: Uint8Array,
  invocationNonce = "default",
  overrides: FilingParserQualityCompositionDirectResultTestOverrides = {},
): FilingParserCrossEngineDirectExecutionResult {
  const originalArchiveSha256 = sha256(originalArchive);
  const amendmentArchiveSha256 = sha256(amendmentArchive);
  const normalizationSha256 = sha256(canonicalTestDocument(normalization));
  const engines = [
    {
      engineId: overrides.pythonEngineId ?? "python-3.12-primary-v1",
      executionBindingSha256:
        overrides.pythonExecutionBindingSha256 ??
        sha256(text(`python-execution-binding-v1:${invocationNonce}`)),
      imageSha256: TEST_PYTHON_IMAGE,
      implementationSha256: PYTHON_IMPLEMENTATION,
      role: "python-primary",
    },
    {
      engineId: overrides.nodeEngineId ?? "node-24-secondary-v1",
      executionBindingSha256:
        overrides.nodeExecutionBindingSha256 ??
        sha256(text(`node-execution-binding-v1:${invocationNonce}`)),
      imageSha256: TEST_NODE_IMAGE,
      implementationSha256: NODE_IMPLEMENTATION,
      role: "node-secondary",
    },
  ] as const;
  const agreementSha256 = cycle2kAgreementSha256({
    amendmentArchiveSha256,
    engines,
    normalizationSha256,
    originalArchiveSha256,
  });
  const publicKeySpkiSha256 = sha256(
    text(`ephemeral-public-key-v1:${invocationNonce}`),
  );
  const documents = [
    {
      archiveSha256: originalArchiveSha256,
      documentRole: "original" as const,
      documentSha256:
        normalization.originalDocumentSha256 as `sha256:${string}`,
    },
    {
      archiveSha256: amendmentArchiveSha256,
      documentRole: "amendment" as const,
      documentSha256:
        normalization.amendmentDocumentSha256 as `sha256:${string}`,
    },
  ] as const;
  const engineLifecycles = engines.map((engine, engineIndex) => ({
    engine,
    lifecycles: documents.map((document, documentIndex) => {
      const preimage = {
        ...document,
        containerIdSha256: sha256(
          text(`container-${engineIndex}-${documentIndex}:${invocationNonce}`),
        ),
        engineId: engine.engineId,
        imageSha256: engine.imageSha256,
        implementationSha256: engine.implementationSha256,
        keyId: "cycle2m-ephemeral-ed25519-v1",
        publicKeySpkiSha256,
        role: engine.role,
        zeroResidue: true,
      };
      return {
        ...preimage,
        lifecycleBindingSha256: domainSha256(LIFECYCLE_DOMAIN, preimage),
      };
    }),
    role: engine.role,
  }));
  const lifecycleReceipts = engineLifecycles.flatMap(
    ({ lifecycles }) => lifecycles,
  );
  const invocationBindingSha256 = domainSha256(INVOCATION_DOMAIN, {
    agreementSha256,
    executionMode: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_MODE,
    keyId: "cycle2m-ephemeral-ed25519-v1",
    lifecycleReceipts,
    normalizationSha256,
    publicKeySpkiSha256,
  });
  return {
    claim: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM,
    normalization: normalization as never,
    provenance: {
      agreement: {
        agreementSha256,
        amendmentArchiveSha256,
        engineCount: 2,
        engines,
        originalArchiveSha256,
      },
      engineLifecycles: engineLifecycles as never,
      ephemeralPublicKeySpkiSha256: publicKeySpkiSha256,
      executionMode: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_MODE,
      invocationBindingSha256,
      keyId: "cycle2m-ephemeral-ed25519-v1",
      normalizationSha256,
    },
    schemaVersion: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_SCHEMA_VERSION,
    status: "agreed",
    synthetic: true,
  };
}

function factId(role: string, key: string): `fact:sha256:${string}` {
  return `fact:${sha256(text(`${role}:${key}`))}`;
}

function canonicalBytes(value: unknown): Uint8Array {
  return text(canonicalJson(value));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null) throw new TypeError();
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}

function domainSha256(domain: Uint8Array, value: unknown): `sha256:${string}` {
  const content =
    typeof value === "string" ? text(value) : canonicalBytes(value);
  return sha256(Buffer.concat([domain, content]));
}

function cycle2kAgreementSha256(value: unknown): `sha256:${string}` {
  return sha256(
    Buffer.concat([AGREEMENT_DOMAIN, canonicalTestDocument(value)]),
  );
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
