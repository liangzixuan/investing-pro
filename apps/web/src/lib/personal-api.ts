import type {
  PersonalFilingDossierDto,
  PersonalFilingReadinessDto,
  PersonalFilingSelectedFactsDto,
} from "@research-cockpit/contracts";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3100";
const ownerSessionPath = "/v1/personal-filing/session" as const;
const ownerBootstrapSecretPattern = /^[0-9a-f]{64}$/u;
const literalLoopbackHttpOriginPattern =
  /^http:\/\/(?:127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})$/u;

const ownerSessionRequestOptions = Object.freeze({
  cache: "no-store",
  credentials: "include",
  redirect: "error",
  referrerPolicy: "no-referrer",
} satisfies Pick<
  RequestInit,
  "cache" | "credentials" | "redirect" | "referrerPolicy"
>);

const personalFilingReadinessKeys = [
  "dataPlane",
  "profile",
  "schemaVersion",
  "status",
] as const;

const personalFactKeys = [
  "assets",
  "cash",
  "debt",
  "diluted_shares",
  "free_cash_flow",
  "gross_profit",
  "net_income",
  "operating_cash_flow",
  "operating_income",
  "revenue",
] as const;
const selectedFactsKeys = [
  "facts",
  "profile",
  "schemaVersion",
  "status",
] as const;
const selectedFactKeys = [
  "key",
  "periodEnd",
  "periodStart",
  "unit",
  "value",
] as const;
const personalDossierKeys = [
  "asOf",
  "chart",
  "dataMode",
  "evidence",
  "facts",
  "lineage",
  "omissions",
  "profile",
  "schemaVersion",
  "status",
  "valuationInputs",
] as const;
const personalDossierFactKeys = [
  "evidenceId",
  "id",
  "key",
  "knownFrom",
  "knownToExclusive",
  "label",
  "periodEnd",
  "periodStart",
  "unit",
  "value",
  "version",
] as const;
const personalDossierEvidenceKeys = [
  "derivationFormula",
  "derivationOperands",
  "factId",
  "id",
  "sourceAcceptedAt",
  "sourceAccession",
  "sourceAvailableAt",
  "sourceConcept",
  "sourceContentSha256",
  "sourceDocumentSha256",
  "taxonomy",
] as const;
const personalDossierDerivationOperandKeys = [
  "concept",
  "periodEnd",
  "periodStart",
  "role",
  "unit",
  "value",
] as const;
const personalDossierLineageKeys = ["events", "scope", "status"] as const;
const personalDossierLineageEventKeys = [
  "effectiveAt",
  "key",
  "predecessorFactId",
  "successorFactId",
] as const;
const personalDossierChartReadyKeys = ["series", "status"] as const;
const personalDossierChartUnsupportedKeys = ["reasonCode", "status"] as const;
const personalDossierSeriesKeys = ["key", "label", "points", "unit"] as const;
const personalDossierPointKeys = ["factId"] as const;
const personalDossierValuationReadyKeys = [
  "baseRevenueFactId",
  "cashFactId",
  "debtFactId",
  "dilutedSharesFactId",
  "modelVersion",
  "status",
] as const;
const personalDossierValuationUnsupportedKeys = [
  "reasonCode",
  "status",
] as const;
const personalDossierOmissionKeys = [
  "count",
  "explanation",
  "hasOmissions",
  "reasonCode",
] as const;
const canonicalDecimal = /^(?:0|-?[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?$/u;
const isoDate = /^\d{4}-\d{2}-\d{2}$/u;
const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const personalFactId = /^fact-[0-9]{4}$/u;
const personalEvidenceId = /^evidence-[0-9]{4}$/u;
const accession = /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u;
const qname = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}:[A-Za-z_][A-Za-z0-9_.-]{0,127}$/u;
const taxonomy = /^[a-z][a-z0-9.-]{2,63}$/u;
const sha256 = /^sha256:[0-9a-f]{64}$/u;
const decimalScale = 12;
const partialOmissionExplanation =
  "The dossier contains only the exact owner-fixed fact scope.";
const completeOmissionExplanation =
  "The complete bounded ten-fact snapshot is included.";

const personalFactLabels = Object.freeze({
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
} satisfies Record<(typeof personalFactKeys)[number], string>);

function isPersonalFilingReadinessDto(
  value: unknown,
): value is PersonalFilingReadinessDto {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value).sort();
  if (
    keys.length !== personalFilingReadinessKeys.length ||
    !keys.every((key, index) => key === personalFilingReadinessKeys[index])
  ) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === "1.0.0" &&
    candidate.profile === "personal_single_user_local" &&
    candidate.status === "quality_gate_ready" &&
    candidate.dataPlane === "disabled"
  );
}

export async function fetchPersonalFilingReadiness(
  signal: AbortSignal,
): Promise<boolean> {
  const personalBaseUrl = getPersonalApiBaseUrl();
  if (personalBaseUrl === null) return false;
  const url = new URL("/v1/personal-filing/readiness", personalBaseUrl);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "include",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal,
    });
    if (!response.ok) return false;

    return isPersonalFilingReadinessDto(await response.json());
  } catch {
    if (signal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    return false;
  }
}

export async function fetchPersonalFilingSelectedFacts(
  signal: AbortSignal,
): Promise<PersonalFilingSelectedFactsDto | null> {
  const personalBaseUrl = getPersonalApiBaseUrl();
  if (personalBaseUrl === null) return null;
  const url = new URL("/v1/personal-filing/selected-facts", personalBaseUrl);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "include",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal,
    });
    if (!response.ok) return null;
    return parsePersonalFilingSelectedFacts(await response.json());
  } catch {
    if (signal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    return null;
  }
}

export async function fetchPersonalFilingDossier(
  signal: AbortSignal,
): Promise<PersonalFilingDossierDto | null> {
  const personalBaseUrl = getPersonalApiBaseUrl();
  if (personalBaseUrl === null) return null;
  const url = new URL("/v1/personal-filing/dossier", personalBaseUrl);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "include",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal,
    });
    if (!response.ok) return null;
    return parsePersonalFilingDossier(await response.json());
  } catch {
    if (signal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    return null;
  }
}

export function fetchOwnerSession(signal: AbortSignal): Promise<boolean> {
  return requestOwnerSession(ownerSessionPath, { method: "GET", signal });
}

export function bootstrapOwnerSession(
  bootstrapSecret: string,
  signal: AbortSignal,
): Promise<boolean> {
  if (!ownerBootstrapSecretPattern.test(bootstrapSecret)) {
    return Promise.resolve(false);
  }
  return requestOwnerSession(`${ownerSessionPath}/bootstrap`, {
    method: "POST",
    headers: {
      "X-Research-Cockpit-Bootstrap": bootstrapSecret,
      "X-Research-Cockpit-Intent": "bootstrap",
    },
    signal,
  });
}

export function logoutOwnerSession(signal: AbortSignal): Promise<boolean> {
  return requestOwnerSession(`${ownerSessionPath}/logout`, {
    method: "POST",
    headers: { "X-Research-Cockpit-Intent": "logout" },
    signal,
  });
}

export function rotateOwnerSession(signal: AbortSignal): Promise<boolean> {
  return requestOwnerSession(`${ownerSessionPath}/rotate`, {
    method: "POST",
    headers: { "X-Research-Cockpit-Intent": "rotate" },
    signal,
  });
}

export function revokeOwnerSession(signal: AbortSignal): Promise<boolean> {
  return requestOwnerSession(`${ownerSessionPath}/revoke`, {
    method: "POST",
    headers: { "X-Research-Cockpit-Intent": "revoke" },
    signal,
  });
}

async function requestOwnerSession(
  path: string,
  options: Pick<RequestInit, "headers" | "method" | "signal">,
): Promise<boolean> {
  const signal = options.signal;
  const personalBaseUrl = getPersonalApiBaseUrl();
  if (personalBaseUrl === null) return false;
  try {
    const response = await fetch(new URL(path, personalBaseUrl), {
      ...ownerSessionRequestOptions,
      ...options,
    });
    return response.status === 204;
  } catch {
    if (signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    return false;
  }
}

function getPersonalApiBaseUrl(): string | null {
  if (hasControllingServiceWorker()) return null;
  const match = literalLoopbackHttpOriginPattern.exec(apiBaseUrl);
  if (match?.[0] !== apiBaseUrl) return null;

  const port = Number(match[1]);
  return port >= 1 && port <= 65_535 ? apiBaseUrl : null;
}

function hasControllingServiceWorker(): boolean {
  if (typeof navigator === "undefined") return false;
  try {
    return navigator.serviceWorker?.controller != null;
  } catch {
    return true;
  }
}

function parsePersonalFilingSelectedFacts(
  value: unknown,
): PersonalFilingSelectedFactsDto | null {
  if (!hasExactKeys(value, selectedFactsKeys)) return null;
  if (
    value.schemaVersion !== "1.0.0" ||
    value.profile !== "personal_single_user_local" ||
    value.status !== "selected_facts_released" ||
    !Array.isArray(value.facts) ||
    value.facts.length < 1 ||
    value.facts.length > personalFactKeys.length
  ) {
    return null;
  }

  const facts: PersonalFilingSelectedFactsDto["facts"][number][] = [];
  let previousIndex = -1;
  for (const rawFact of value.facts) {
    if (!hasExactKeys(rawFact, selectedFactKeys)) return null;
    const keyIndex = personalFactKeys.indexOf(
      rawFact.key as (typeof personalFactKeys)[number],
    );
    if (
      keyIndex <= previousIndex ||
      typeof rawFact.value !== "string" ||
      !canonicalDecimal.test(rawFact.value) ||
      typeof rawFact.periodEnd !== "string" ||
      !isRealIsoDate(rawFact.periodEnd) ||
      !isValidFactContract(rawFact, keyIndex)
    ) {
      return null;
    }
    previousIndex = keyIndex;
    facts.push(
      Object.freeze({
        key: rawFact.key,
        periodEnd: rawFact.periodEnd,
        periodStart: rawFact.periodStart,
        unit: rawFact.unit,
        value: rawFact.value,
      }) as PersonalFilingSelectedFactsDto["facts"][number],
    );
  }

  return Object.freeze({
    schemaVersion: "1.0.0",
    profile: "personal_single_user_local",
    status: "selected_facts_released",
    facts: Object.freeze(facts),
  });
}

export function parsePersonalFilingDossier(
  value: unknown,
): PersonalFilingDossierDto | null {
  if (!hasExactKeys(value, personalDossierKeys)) return null;
  if (
    value.schemaVersion !== "1.0.0" ||
    value.profile !== "personal_single_user_local" ||
    value.dataMode !== "personal" ||
    value.status !== "personal_dossier_released" ||
    !isRealIsoInstant(value.asOf) ||
    !Array.isArray(value.facts) ||
    value.facts.length < 1 ||
    value.facts.length > personalFactKeys.length * 2 ||
    !Array.isArray(value.evidence) ||
    value.evidence.length !== value.facts.length
  ) {
    return null;
  }

  const facts: PersonalFilingDossierDto["facts"][number][] = [];
  const factsById = new Map<
    string,
    PersonalFilingDossierDto["facts"][number]
  >();
  const evidenceIds = new Set<string>();
  for (const [factIndex, rawFact] of value.facts.entries()) {
    if (!hasExactKeys(rawFact, personalDossierFactKeys)) return null;
    const keyIndex = personalFactKeys.indexOf(
      rawFact.key as (typeof personalFactKeys)[number],
    );
    if (keyIndex < 0) return null;
    const key = personalFactKeys[keyIndex];
    if (
      key === undefined ||
      !isPersonalFactId(rawFact.id) ||
      rawFact.id !== `fact-${String(factIndex + 1).padStart(4, "0")}` ||
      factsById.has(rawFact.id) ||
      !isPersonalEvidenceId(rawFact.evidenceId) ||
      rawFact.evidenceId !==
        `evidence-${String(factIndex + 1).padStart(4, "0")}` ||
      evidenceIds.has(rawFact.evidenceId) ||
      rawFact.label !== personalFactLabels[key] ||
      typeof rawFact.value !== "string" ||
      !canonicalDecimal.test(rawFact.value) ||
      !isRealIsoDateValue(rawFact.periodEnd) ||
      !isRealIsoInstant(rawFact.knownFrom) ||
      (rawFact.knownToExclusive !== null &&
        (!isRealIsoInstant(rawFact.knownToExclusive) ||
          rawFact.knownToExclusive <= rawFact.knownFrom)) ||
      (rawFact.version !== "current" && rawFact.version !== "superseded") ||
      (rawFact.version === "current") !== (rawFact.knownToExclusive === null) ||
      !isValidFactContract(rawFact, keyIndex)
    ) {
      return null;
    }
    const fact = Object.freeze({
      evidenceId: rawFact.evidenceId,
      id: rawFact.id,
      key: rawFact.key,
      knownFrom: rawFact.knownFrom,
      knownToExclusive: rawFact.knownToExclusive,
      label: rawFact.label,
      periodEnd: rawFact.periodEnd,
      periodStart: rawFact.periodStart,
      unit: rawFact.unit,
      value: rawFact.value,
      version: rawFact.version,
    }) as PersonalFilingDossierDto["facts"][number];
    facts.push(fact);
    factsById.set(fact.id, fact);
    evidenceIds.add(fact.evidenceId);
  }
  if (!validateFactVersionSets(facts)) return null;

  const evidence: PersonalFilingDossierDto["evidence"][number][] = [];
  const evidenceById = new Map<
    string,
    PersonalFilingDossierDto["evidence"][number]
  >();
  const evidenceFactIds = new Set<string>();
  for (const [evidenceIndex, rawEvidence] of value.evidence.entries()) {
    if (!hasExactKeys(rawEvidence, personalDossierEvidenceKeys)) return null;
    const fact =
      typeof rawEvidence.factId === "string"
        ? factsById.get(rawEvidence.factId)
        : undefined;
    if (
      fact === undefined ||
      !isPersonalEvidenceId(rawEvidence.id) ||
      rawEvidence.id !==
        `evidence-${String(evidenceIndex + 1).padStart(4, "0")}` ||
      rawEvidence.factId !==
        `fact-${String(evidenceIndex + 1).padStart(4, "0")}` ||
      rawEvidence.id !== fact.evidenceId ||
      evidenceById.has(rawEvidence.id) ||
      evidenceFactIds.has(fact.id) ||
      typeof rawEvidence.sourceAccession !== "string" ||
      !accession.test(rawEvidence.sourceAccession) ||
      !isRealIsoInstant(rawEvidence.sourceAcceptedAt) ||
      !isRealIsoInstant(rawEvidence.sourceAvailableAt) ||
      rawEvidence.sourceAcceptedAt > rawEvidence.sourceAvailableAt ||
      fact.periodEnd >= rawEvidence.sourceAcceptedAt.slice(0, 10) ||
      rawEvidence.sourceAvailableAt !== fact.knownFrom ||
      (rawEvidence.sourceConcept !== null &&
        (typeof rawEvidence.sourceConcept !== "string" ||
          !qname.test(rawEvidence.sourceConcept))) ||
      typeof rawEvidence.taxonomy !== "string" ||
      !taxonomy.test(rawEvidence.taxonomy) ||
      typeof rawEvidence.sourceContentSha256 !== "string" ||
      !sha256.test(rawEvidence.sourceContentSha256) ||
      typeof rawEvidence.sourceDocumentSha256 !== "string" ||
      !sha256.test(rawEvidence.sourceDocumentSha256) ||
      !isValidDerivation(rawEvidence, fact)
    ) {
      return null;
    }
    const item = Object.freeze({
      derivationFormula: rawEvidence.derivationFormula,
      derivationOperands: Object.freeze(
        (
          rawEvidence.derivationOperands as readonly Record<string, unknown>[]
        ).map((operand) =>
          Object.freeze({
            concept: operand.concept as string,
            periodEnd: operand.periodEnd as string,
            periodStart: operand.periodStart as string,
            role: operand.role as "minuend" | "subtrahend",
            unit: "USD" as const,
            value: operand.value as string,
          }),
        ),
      ),
      factId: rawEvidence.factId,
      id: rawEvidence.id,
      sourceAcceptedAt: rawEvidence.sourceAcceptedAt,
      sourceAccession: rawEvidence.sourceAccession,
      sourceAvailableAt: rawEvidence.sourceAvailableAt,
      sourceConcept: rawEvidence.sourceConcept,
      sourceContentSha256: rawEvidence.sourceContentSha256,
      sourceDocumentSha256: rawEvidence.sourceDocumentSha256,
      taxonomy: rawEvidence.taxonomy,
    }) as PersonalFilingDossierDto["evidence"][number];
    evidence.push(item);
    evidenceById.set(item.id, item);
    evidenceFactIds.add(item.factId);
  }
  if (
    evidenceIds.size !== evidenceById.size ||
    [...evidenceIds].some((id) => !evidenceById.has(id))
  ) {
    return null;
  }

  const lineage = parseDossierLineage(value.lineage, factsById);
  if (
    lineage === null ||
    !validateCanonicalDossierSnapshot(facts, evidence, lineage)
  ) {
    return null;
  }
  const chart = parseDossierChart(value.chart, factsById);
  const valuationInputs = parseDossierValuation(
    value.valuationInputs,
    factsById,
  );
  const omissions = parseDossierOmissions(value.omissions, facts);
  if (chart === null || valuationInputs === null || omissions === null) {
    return null;
  }
  const currentFacts = facts.filter((fact) => fact.version === "current");
  if (
    currentFacts.some((fact) => fact.knownFrom !== value.asOf) ||
    !validateLineageCompleteness(facts, lineage)
  ) {
    return null;
  }

  return Object.freeze({
    asOf: value.asOf,
    chart,
    dataMode: "personal",
    evidence: Object.freeze(evidence),
    facts: Object.freeze(facts),
    lineage,
    omissions,
    profile: "personal_single_user_local",
    schemaVersion: "1.0.0",
    status: "personal_dossier_released",
    valuationInputs,
  });
}

function validateLineageCompleteness(
  facts: readonly PersonalFilingDossierDto["facts"][number][],
  lineage: PersonalFilingDossierDto["lineage"],
): boolean {
  const representedKeys = new Set(facts.map((fact) => fact.key));
  if (lineage.status === "root_only_no_in_corpus_amendment") {
    return facts.every((fact) => fact.version === "current");
  }
  return (
    lineage.events.length === representedKeys.size &&
    [...representedKeys].every(
      (key) => facts.filter((fact) => fact.key === key).length === 2,
    )
  );
}

function validateCanonicalDossierSnapshot(
  facts: readonly PersonalFilingDossierDto["facts"][number][],
  evidence: readonly PersonalFilingDossierDto["evidence"][number][],
  lineage: PersonalFilingDossierDto["lineage"],
): boolean {
  const documentCount =
    lineage.status === "amendment_supersession_observed" ? 2 : 1;
  if (facts.length % documentCount !== 0) return false;
  const factsPerDocument = facts.length / documentCount;
  if (factsPerDocument < 1 || factsPerDocument > personalFactKeys.length) {
    return false;
  }

  const canonicalKeys: (typeof personalFactKeys)[number][] = [];
  let previousKeyIndex = -1;
  for (let index = 0; index < factsPerDocument; index += 1) {
    const fact = facts[index];
    if (fact === undefined) return false;
    const keyIndex = personalFactKeys.indexOf(fact.key);
    if (keyIndex <= previousKeyIndex) return false;
    canonicalKeys.push(fact.key);
    previousKeyIndex = keyIndex;
  }

  const documentEvidence: PersonalFilingDossierDto["evidence"][number][] = [];
  for (
    let documentIndex = 0;
    documentIndex < documentCount;
    documentIndex += 1
  ) {
    const offset = documentIndex * factsPerDocument;
    const firstFact = facts[offset];
    const firstEvidence = evidence[offset];
    if (firstFact === undefined || firstEvidence === undefined) return false;
    documentEvidence.push(firstEvidence);
    const expectedVersion =
      documentIndex === documentCount - 1 ? "current" : "superseded";
    let durationPeriodStart: string | undefined;

    for (let keyIndex = 0; keyIndex < factsPerDocument; keyIndex += 1) {
      const fact = facts[offset + keyIndex];
      const passport = evidence[offset + keyIndex];
      const previousVersion =
        documentIndex === 0
          ? undefined
          : facts[offset - factsPerDocument + keyIndex];
      if (
        fact === undefined ||
        passport === undefined ||
        fact.key !== canonicalKeys[keyIndex] ||
        fact.version !== expectedVersion ||
        fact.knownFrom !== firstFact.knownFrom ||
        fact.periodEnd !== firstFact.periodEnd ||
        passport.sourceAccession !== firstEvidence.sourceAccession ||
        passport.sourceAcceptedAt !== firstEvidence.sourceAcceptedAt ||
        passport.sourceAvailableAt !== firstEvidence.sourceAvailableAt ||
        passport.sourceContentSha256 !== firstEvidence.sourceContentSha256 ||
        passport.sourceDocumentSha256 !== firstEvidence.sourceDocumentSha256 ||
        passport.taxonomy !== firstEvidence.taxonomy ||
        (previousVersion !== undefined &&
          (fact.periodStart !== previousVersion.periodStart ||
            fact.periodEnd !== previousVersion.periodEnd))
      ) {
        return false;
      }
      if (fact.periodStart !== null) {
        durationPeriodStart ??= fact.periodStart;
        if (fact.periodStart !== durationPeriodStart) return false;
      }
    }

    if (
      !validateCrossFactDerivation(facts, evidence, offset, factsPerDocument)
    ) {
      return false;
    }
  }

  if (
    documentEvidence.some(
      (item) => item.taxonomy !== documentEvidence[0]?.taxonomy,
    )
  ) {
    return false;
  }
  if (documentCount === 2) {
    const predecessor = documentEvidence[0];
    const successor = documentEvidence[1];
    if (
      predecessor === undefined ||
      successor === undefined ||
      predecessor.sourceAccession.slice(0, 10) !==
        successor.sourceAccession.slice(0, 10) ||
      predecessor.sourceAccession >= successor.sourceAccession ||
      predecessor.sourceAcceptedAt >= successor.sourceAcceptedAt ||
      predecessor.sourceAvailableAt >= successor.sourceAvailableAt ||
      predecessor.sourceContentSha256 === successor.sourceContentSha256 ||
      predecessor.sourceDocumentSha256 === successor.sourceDocumentSha256
    ) {
      return false;
    }
  }
  return true;
}

function validateCrossFactDerivation(
  facts: readonly PersonalFilingDossierDto["facts"][number][],
  evidence: readonly PersonalFilingDossierDto["evidence"][number][],
  offset: number,
  factsPerDocument: number,
): boolean {
  const group = facts.slice(offset, offset + factsPerDocument);
  const freeCashFlowIndex = group.findIndex(
    (fact) => fact.key === "free_cash_flow",
  );
  const operatingCashFlowIndex = group.findIndex(
    (fact) => fact.key === "operating_cash_flow",
  );
  if (freeCashFlowIndex < 0 || operatingCashFlowIndex < 0) return true;
  const freeCashFlowEvidence = evidence[offset + freeCashFlowIndex];
  const operatingCashFlowFact = group[operatingCashFlowIndex];
  const operatingCashFlowEvidence = evidence[offset + operatingCashFlowIndex];
  const minuend = freeCashFlowEvidence?.derivationOperands[0];
  return (
    minuend !== undefined &&
    operatingCashFlowFact !== undefined &&
    operatingCashFlowEvidence !== undefined &&
    minuend.value === operatingCashFlowFact.value &&
    minuend.concept === operatingCashFlowEvidence.sourceConcept
  );
}

function validateFactVersionSets(
  facts: readonly PersonalFilingDossierDto["facts"][number][],
): boolean {
  const byKey = new Map<string, typeof facts>();
  for (const key of personalFactKeys) {
    const versions = facts.filter((fact) => fact.key === key);
    if (versions.length > 2) return false;
    if (versions.length > 0) byKey.set(key, versions);
  }
  for (const versions of byKey.values()) {
    const ordered = [...versions].sort((left, right) =>
      left.knownFrom.localeCompare(right.knownFrom),
    );
    if (ordered.some((fact, index) => fact !== versions[index])) return false;
    if (ordered.at(-1)?.version !== "current") return false;
    if (ordered.filter((fact) => fact.version === "current").length !== 1) {
      return false;
    }
  }
  return true;
}

function parseDossierLineage(
  value: unknown,
  factsById: ReadonlyMap<string, PersonalFilingDossierDto["facts"][number]>,
): PersonalFilingDossierDto["lineage"] | null {
  if (!hasExactKeys(value, personalDossierLineageKeys)) return null;
  if (
    value.scope !==
      "issuer_filing_versions_within_exact_frozen_manifest_only" ||
    (value.status !== "root_only_no_in_corpus_amendment" &&
      value.status !== "amendment_supersession_observed") ||
    !Array.isArray(value.events) ||
    value.events.length > personalFactKeys.length
  ) {
    return null;
  }
  if (
    (value.status === "root_only_no_in_corpus_amendment") !==
    (value.events.length === 0)
  ) {
    return null;
  }
  const events: PersonalFilingDossierDto["lineage"]["events"][number][] = [];
  const predecessorIds = new Set<string>();
  const successorIds = new Set<string>();
  let previousKeyIndex = -1;
  for (const rawEvent of value.events) {
    if (!hasExactKeys(rawEvent, personalDossierLineageEventKeys)) return null;
    const keyIndex = personalFactKeys.indexOf(
      rawEvent.key as (typeof personalFactKeys)[number],
    );
    const predecessor =
      typeof rawEvent.predecessorFactId === "string"
        ? factsById.get(rawEvent.predecessorFactId)
        : undefined;
    const successor =
      typeof rawEvent.successorFactId === "string"
        ? factsById.get(rawEvent.successorFactId)
        : undefined;
    if (
      predecessor === undefined ||
      successor === undefined ||
      keyIndex <= previousKeyIndex ||
      predecessor.id === successor.id ||
      predecessor.key !== successor.key ||
      rawEvent.key !== predecessor.key ||
      predecessor.version !== "superseded" ||
      successor.version !== "current" ||
      predecessor.knownToExclusive !== successor.knownFrom ||
      rawEvent.effectiveAt !== successor.knownFrom ||
      predecessorIds.has(predecessor.id) ||
      successorIds.has(successor.id)
    ) {
      return null;
    }
    previousKeyIndex = keyIndex;
    predecessorIds.add(predecessor.id);
    successorIds.add(successor.id);
    events.push(
      Object.freeze({
        effectiveAt: rawEvent.effectiveAt,
        key: rawEvent.key,
        predecessorFactId: rawEvent.predecessorFactId,
        successorFactId: rawEvent.successorFactId,
      }) as PersonalFilingDossierDto["lineage"]["events"][number],
    );
  }
  if (
    [...factsById.values()].some(
      (fact) => fact.version === "superseded" && !predecessorIds.has(fact.id),
    )
  ) {
    return null;
  }
  return Object.freeze({
    events: Object.freeze(events),
    scope: value.scope,
    status: value.status,
  });
}

function parseDossierChart(
  value: unknown,
  factsById: ReadonlyMap<string, PersonalFilingDossierDto["facts"][number]>,
): PersonalFilingDossierDto["chart"] | null {
  if (
    hasExactKeys(value, personalDossierChartUnsupportedKeys) &&
    value.status === "unsupported" &&
    value.reasonCode === "NO_OWNER_APPROVED_CHART_FACTS"
  ) {
    return Object.freeze({
      reasonCode: value.reasonCode,
      status: value.status,
    });
  }
  if (
    !hasExactKeys(value, personalDossierChartReadyKeys) ||
    value.status !== "ready" ||
    !Array.isArray(value.series) ||
    value.series.length < 1 ||
    value.series.length > personalFactKeys.length
  ) {
    return null;
  }
  const series: Extract<
    PersonalFilingDossierDto["chart"],
    { status: "ready" }
  >["series"][number][] = [];
  let previousKeyIndex = -1;
  const usedPointIds = new Set<string>();
  let sharedUnit: "USD" | "shares" | undefined;
  let sharedPeriodKind: "duration" | "instant" | undefined;
  for (const rawSeries of value.series) {
    if (!hasExactKeys(rawSeries, personalDossierSeriesKeys)) return null;
    const keyIndex = personalFactKeys.indexOf(
      rawSeries.key as (typeof personalFactKeys)[number],
    );
    if (keyIndex <= previousKeyIndex) return null;
    const key = personalFactKeys[keyIndex];
    if (
      key === undefined ||
      rawSeries.label !== personalFactLabels[key] ||
      (rawSeries.unit !== "USD" && rawSeries.unit !== "shares") ||
      !Array.isArray(rawSeries.points) ||
      rawSeries.points.length < 1 ||
      rawSeries.points.length > 2
    ) {
      return null;
    }
    const expectedFacts = [...factsById.values()].filter(
      (fact) => fact.key === key,
    );
    const periodKind =
      expectedFacts[0]?.periodStart === null ? "instant" : "duration";
    sharedUnit ??= rawSeries.unit;
    sharedPeriodKind ??= periodKind;
    if (
      rawSeries.unit !== sharedUnit ||
      periodKind !== sharedPeriodKind ||
      rawSeries.points.length !== expectedFacts.length
    ) {
      return null;
    }
    previousKeyIndex = keyIndex;
    const points: { readonly factId: string }[] = [];
    let previousKnownFrom = "";
    for (const [pointIndex, rawPoint] of rawSeries.points.entries()) {
      if (!hasExactKeys(rawPoint, personalDossierPointKeys)) return null;
      const fact =
        typeof rawPoint.factId === "string"
          ? factsById.get(rawPoint.factId)
          : undefined;
      if (
        fact === undefined ||
        fact.id !== expectedFacts[pointIndex]?.id ||
        fact.key !== rawSeries.key ||
        fact.unit !== rawSeries.unit ||
        fact.knownFrom <= previousKnownFrom ||
        usedPointIds.has(fact.id)
      ) {
        return null;
      }
      previousKnownFrom = fact.knownFrom;
      usedPointIds.add(fact.id);
      points.push(Object.freeze({ factId: fact.id }));
    }
    series.push(
      Object.freeze({
        key: rawSeries.key,
        label: rawSeries.label,
        points: Object.freeze(points),
        unit: rawSeries.unit,
      }) as (typeof series)[number],
    );
  }
  return Object.freeze({
    series: Object.freeze(series),
    status: "ready",
  });
}

function parseDossierValuation(
  value: unknown,
  factsById: ReadonlyMap<string, PersonalFilingDossierDto["facts"][number]>,
): PersonalFilingDossierDto["valuationInputs"] | null {
  const currentByKey = new Map(
    [...factsById.values()]
      .filter((fact) => fact.version === "current")
      .map((fact) => [fact.key, fact]),
  );
  const revenue = currentByKey.get("revenue");
  const cash = currentByKey.get("cash");
  const debt = currentByKey.get("debt");
  const dilutedShares = currentByKey.get("diluted_shares");
  const expectedUnsupportedReason =
    revenue === undefined ||
    cash === undefined ||
    debt === undefined ||
    dilutedShares === undefined
      ? "REQUIRED_FACTS_NOT_RELEASED"
      : !isPositiveDecimal(revenue.value) ||
          !isNonnegativeDecimal(cash.value) ||
          !isNonnegativeDecimal(debt.value) ||
          !isPositiveDecimal(dilutedShares.value)
        ? "INPUT_OUT_OF_DOMAIN"
        : null;
  if (
    expectedUnsupportedReason !== null &&
    hasExactKeys(value, personalDossierValuationUnsupportedKeys) &&
    value.status === "unsupported" &&
    value.reasonCode === expectedUnsupportedReason
  ) {
    return Object.freeze({
      reasonCode: expectedUnsupportedReason,
      status: value.status,
    });
  }
  if (
    !hasExactKeys(value, personalDossierValuationReadyKeys) ||
    value.status !== "ready" ||
    value.modelVersion !== "exit-multiple-v1" ||
    expectedUnsupportedReason !== null ||
    revenue === undefined ||
    cash === undefined ||
    debt === undefined ||
    dilutedShares === undefined
  ) {
    return null;
  }
  const references = [
    [value.baseRevenueFactId, revenue],
    [value.cashFactId, cash],
    [value.debtFactId, debt],
    [value.dilutedSharesFactId, dilutedShares],
  ] as const;
  const ids = new Set<string>();
  for (const [id, expectedFact] of references) {
    const fact = typeof id === "string" ? factsById.get(id) : undefined;
    if (
      fact === undefined ||
      fact.id !== expectedFact.id ||
      fact.version !== "current" ||
      ids.has(fact.id)
    ) {
      return null;
    }
    ids.add(fact.id);
  }
  return Object.freeze({
    baseRevenueFactId: value.baseRevenueFactId,
    cashFactId: value.cashFactId,
    debtFactId: value.debtFactId,
    dilutedSharesFactId: value.dilutedSharesFactId,
    modelVersion: value.modelVersion,
    status: value.status,
  }) as PersonalFilingDossierDto["valuationInputs"];
}

function parseDossierOmissions(
  value: unknown,
  facts: readonly PersonalFilingDossierDto["facts"][number][],
): PersonalFilingDossierDto["omissions"] | null {
  const hasOmissions =
    new Set(facts.map((fact) => fact.key)).size < personalFactKeys.length;
  const explanation = hasOmissions
    ? partialOmissionExplanation
    : completeOmissionExplanation;
  if (
    !hasExactKeys(value, personalDossierOmissionKeys) ||
    value.hasOmissions !== hasOmissions ||
    value.count !== null ||
    value.reasonCode !== "OWNER_FIXED_SCOPE" ||
    value.explanation !== explanation
  ) {
    return null;
  }
  return Object.freeze({
    count: null,
    explanation,
    hasOmissions,
    reasonCode: value.reasonCode,
  });
}

function isValidDerivation(
  evidence: Record<string, unknown>,
  fact: PersonalFilingDossierDto["facts"][number],
): boolean {
  if (!Array.isArray(evidence.derivationOperands)) return false;
  if (fact.key === "free_cash_flow") {
    return (
      evidence.sourceConcept === null &&
      evidence.derivationFormula ===
        "operating_cash_flow_minus_capital_expenditures" &&
      evidence.derivationOperands.length === 2 &&
      evidence.derivationOperands.every((operand, index) => {
        if (!hasExactKeys(operand, personalDossierDerivationOperandKeys)) {
          return false;
        }
        return (
          operand.role === (index === 0 ? "minuend" : "subtrahend") &&
          typeof operand.concept === "string" &&
          qname.test(operand.concept) &&
          typeof operand.value === "string" &&
          canonicalDecimal.test(operand.value) &&
          operand.unit === "USD" &&
          operand.periodStart === fact.periodStart &&
          operand.periodEnd === fact.periodEnd
        );
      }) &&
      subtractCanonicalDecimals(
        (evidence.derivationOperands[0] as Record<string, unknown>)
          .value as string,
        (evidence.derivationOperands[1] as Record<string, unknown>)
          .value as string,
      ) === fact.value
    );
  }
  return (
    evidence.sourceConcept !== null &&
    evidence.derivationFormula === null &&
    evidence.derivationOperands.length === 0
  );
}

function subtractCanonicalDecimals(
  minuend: string,
  subtrahend: string,
): string {
  const result = toScaledDecimal(minuend) - toScaledDecimal(subtrahend);
  const negative = result < 0n;
  const digits = (negative ? -result : result)
    .toString()
    .padStart(decimalScale + 1, "0");
  const integer = digits.slice(0, -decimalScale);
  const fraction = digits.slice(-decimalScale).replace(/0+$/u, "");
  return `${negative ? "-" : ""}${integer}${fraction.length === 0 ? "" : `.${fraction}`}`;
}

function toScaledDecimal(value: string): bigint {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer, fraction = ""] = unsigned.split(".");
  const scaled = BigInt(`${integer}${fraction.padEnd(decimalScale, "0")}`);
  return negative ? -scaled : scaled;
}

function isPositiveDecimal(value: string): boolean {
  return !value.startsWith("-") && /[1-9]/u.test(value);
}

function isNonnegativeDecimal(value: string): boolean {
  return !value.startsWith("-");
}

function isPersonalFactId(value: unknown): value is `fact-${string}` {
  return typeof value === "string" && personalFactId.test(value);
}

function isPersonalEvidenceId(value: unknown): value is `evidence-${string}` {
  return typeof value === "string" && personalEvidenceId.test(value);
}

function isRealIsoInstant(value: unknown): value is string {
  if (typeof value !== "string" || !isoInstant.test(value)) return false;
  const instant = new Date(value);
  return !Number.isNaN(instant.getTime()) && instant.toISOString() === value;
}

function isRealIsoDateValue(value: unknown): value is string {
  return typeof value === "string" && isRealIsoDate(value);
}

function isValidFactContract(
  fact: Record<string, unknown>,
  keyIndex: number,
): boolean {
  if (keyIndex < 0) return false;
  const key = personalFactKeys[keyIndex];
  const instant = key === "assets" || key === "cash" || key === "debt";
  const expectedUnit = key === "diluted_shares" ? "shares" : "USD";
  if (fact.unit !== expectedUnit) return false;
  if (instant) return fact.periodStart === null;
  return (
    typeof fact.periodStart === "string" &&
    isRealIsoDate(fact.periodStart) &&
    fact.periodStart < (fact.periodEnd as string)
  );
}

function isRealIsoDate(value: string): boolean {
  if (!isoDate.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(instant.getTime()) &&
    instant.toISOString() === `${value}T00:00:00.000Z`
  );
}

function hasExactKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length &&
    actual.every((key, index) => key === keys[index])
  );
}
