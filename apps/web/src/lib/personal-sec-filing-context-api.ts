import {
  PERSONAL_SEC_FILING_CONTEXT_LIMITS as limits,
  PERSONAL_SEC_FILING_DEI_NAMESPACES as deiNamespaces,
  PERSONAL_SEC_FILING_REPORTING_CONCEPTS as reportingConcepts,
  PERSONAL_SEC_QUARTERLY_CONCEPTS,
  type PersonalSecFilingContextCandidateDto,
  type PersonalSecFilingContextRequestDto,
  type PersonalSecFilingContextResponseDto,
  type PersonalSecFilingContextSelectionDto,
  type PersonalSecFilingReportingFieldDto,
  type PersonalSecFilingReportingObservationDto,
  type PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";

import {
  PersonalWorkspaceApiError,
  requestPersonalWorkspace,
} from "./personal-workspace-api";

export const PERSONAL_SEC_FILING_CONTEXT_PATH =
  "/v1/personal-filing/workspace/sec-filing-context";
const selectionKeys = [
  "id",
  "metric",
  "taxonomy",
  "concept",
  "unit",
  "value",
  "startDate",
  "endDate",
  "accessionNumber",
  "form",
  "filedDate",
] as const;
const issues = [
  "invalid_document",
  "document_limit",
  "node_limit",
  "depth_limit",
  "attribute_limit",
  "context_limit",
  "unit_limit",
  "candidate_limit",
  "output_limit",
  "duplicate_id",
  "invalid_namespace",
  "invalid_identifier",
  "malformed_context",
  "unresolved_context",
  "unsupported_entity",
  "entity_mismatch",
  "unsupported_dimensions",
  "unsupported_unit",
  "unresolved_unit",
  "unsupported_period",
  "period_mismatch",
  "unsupported_inline",
  "unsupported_transform",
  "invalid_numeric",
  "decimal_limit",
] as const;
const reportingIssues = [...issues, "invalid_metadata_value"] as const;
const reasons = [
  "selection_changed_or_not_retained",
  "accession_not_in_current_submissions",
  "submission_metadata_conflict",
  "primary_document_unavailable",
  "not_covered",
  "rate_limited",
  "upstream_unavailable",
  "invalid_response",
  "response_too_large",
  "candidate_limit",
  "runtime_unavailable",
  "parser_timeout",
  "worker_failed",
  "invalid_output",
  "output_too_large",
] as const;
const digest = /^sha256:[a-f0-9]{64}$/u;
const identifier = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const cikPattern = /^(?!0000000000)[0-9]{10}$/u;
const symbolPattern = /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;

export function selectPersonalSecFilingContextObservation(
  value: PersonalSecQuarterlyObservationDto,
): PersonalSecFilingContextSelectionDto {
  return Object.fromEntries(
    selectionKeys.map((key) => [key, value[key]]),
  ) as unknown as PersonalSecFilingContextSelectionDto;
}

export async function fetchPersonalSecFilingContext(
  input: PersonalSecFilingContextRequestDto,
  signal: AbortSignal,
): Promise<PersonalSecFilingContextResponseDto> {
  if (
    !keys(input, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "listingId",
      "symbol",
      "selection",
    ]) ||
    input.schemaVersion !== "2.0.0" ||
    !matches(input.catalogSnapshotSha256, digest) ||
    !matches(input.listingId, identifier) ||
    !matches(input.symbol, symbolPattern) ||
    !isSelection(input.selection)
  )
    throw new PersonalWorkspaceApiError("invalid_request");
  signal.throwIfAborted();
  const response = await requestPersonalWorkspace(
    PERSONAL_SEC_FILING_CONTEXT_PATH,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal,
    },
  );
  if (!response.ok) throw await responseError(response, signal);
  const value = await readJson(response, signal);
  if (!isResponse(value, input))
    throw new PersonalWorkspaceApiError("invalid_response");
  return freeze(value);
}

function isSelection(
  value: unknown,
): value is PersonalSecFilingContextSelectionDto {
  return (
    keys(value, selectionKeys) &&
    matches(value.id, /^sec-fact:[0-9a-f]{64}$/u) &&
    member(PERSONAL_SEC_QUARTERLY_CONCEPTS, value.concept) &&
    value.metric ===
      (value.concept === "NetIncomeLoss" ? "net_income" : "revenue") &&
    value.taxonomy === "us-gaap" &&
    value.unit === "USD" &&
    decimal(value.value) &&
    date(value.startDate) &&
    date(value.endDate) &&
    value.startDate <= value.endDate &&
    matches(value.accessionNumber, /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u) &&
    member(["10-Q", "10-Q/A"], value.form) &&
    date(value.filedDate)
  );
}

function isResponse(
  value: unknown,
  input: PersonalSecFilingContextRequestDto,
): value is PersonalSecFilingContextResponseDto {
  if (
    !keys(value, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "security",
      "inspection",
    ]) ||
    value.schemaVersion !== "2.0.0" ||
    value.catalogSnapshotSha256 !== input.catalogSnapshotSha256 ||
    !keys(value.security, [
      "country",
      "exchangeMic",
      "issuerId",
      "issuerName",
      "listingId",
      "securityName",
      "symbol",
      "cik",
    ]) ||
    value.security.country !== "US" ||
    !matches(value.security.exchangeMic, /^[A-Z0-9]{4}$/u) ||
    !matches(value.security.issuerId, identifier) ||
    !safeText(value.security.issuerName, 512) ||
    !safeText(value.security.securityName, 512) ||
    value.security.listingId !== input.listingId ||
    value.security.symbol !== input.symbol ||
    !matches(value.security.cik, cikPattern) ||
    !record(value.inspection)
  )
    return false;
  const inspection = value.inspection;
  if (inspection.status === "unavailable")
    return (
      keys(inspection, ["status", "cik", "stage", "reason"]) &&
      inspection.cik === value.security.cik &&
      member(
        ["company_facts", "submissions", "document", "parser"],
        inspection.stage,
      ) &&
      member(reasons, inspection.reason) &&
      unavailableStage(inspection.stage, inspection.reason)
    );
  const cik = value.security.cik;
  if (
    !keys(inspection, [
      "status",
      "cik",
      "observation",
      "companyFacts",
      "submissions",
      "document",
      "analysis",
    ]) ||
    inspection.status !== "available" ||
    inspection.cik !== cik ||
    !isObservation(inspection.observation, input.selection, cik) ||
    !source(
      inspection.companyFacts,
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
    ) ||
    !source(
      inspection.submissions,
      `https://data.sec.gov/submissions/CIK${cik}.json`,
    ) ||
    !keys(inspection.document, ["sourceUrl", "fetchedAt", "sha256", "bytes"]) ||
    !instant(inspection.document.fetchedAt) ||
    !matches(inspection.document.sha256, digest) ||
    !integer(inspection.document.bytes, 1, limits.documentBytes) ||
    typeof inspection.document.sourceUrl !== "string"
  )
    return false;
  const prefix = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${input.selection.accessionNumber.replaceAll("-", "")}/`;
  const basename = inspection.document.sourceUrl.slice(prefix.length);
  if (
    !inspection.document.sourceUrl.startsWith(prefix) ||
    basename.length > 255 ||
    basename.includes("..") ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:htm|html|xhtml|xml)$/iu.test(basename)
  )
    return false;
  return analysis(inspection.analysis, input.selection, cik);
}

function isObservation(
  value: unknown,
  selected: PersonalSecFilingContextSelectionDto,
  cik: string,
): boolean {
  if (
    !keys(value, [
      ...selectionKeys,
      "durationDays",
      "periodBasis",
      "filingFocusYear",
      "filingFocusPeriod",
      "frame",
      "sourceLocator",
      "filing",
    ]) ||
    !selectionKeys.every((key) => value[key] === selected[key]) ||
    value.periodBasis !== "unresolved" ||
    !integer(value.durationDays, 1, 4_000_000) ||
    value.durationDays !==
      (Date.parse(`${selected.endDate}T00:00:00Z`) -
        Date.parse(`${selected.startDate}T00:00:00Z`)) /
        86_400_000 +
        1 ||
    !(
      value.filingFocusYear === null ||
      integer(value.filingFocusYear, 1000, 9999)
    ) ||
    !nullableText(value.filingFocusPeriod, 32) ||
    !nullableText(value.frame, 128) ||
    !matches(
      value.sourceLocator,
      new RegExp(
        `^/facts/us-gaap/${selected.concept}/units/USD/(?:0|[1-9][0-9]*)$`,
        "u",
      ),
    ) ||
    !keys(value.filing, [
      "status",
      "form",
      "filedDate",
      "reportDate",
      "acceptedAt",
      "sourceUrl",
    ])
  )
    return false;
  return (
    value.filing.status === "matched" &&
    value.filing.form === selected.form &&
    value.filing.filedDate === selected.filedDate &&
    (value.filing.reportDate === null || date(value.filing.reportDate)) &&
    (value.filing.acceptedAt === null ||
      sourceInstant(value.filing.acceptedAt)) &&
    value.filing.sourceUrl ===
      `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${selected.accessionNumber}-index.htm`
  );
}

function analysis(
  value: unknown,
  selected: PersonalSecFilingContextSelectionDto,
  cik: string,
): boolean {
  if (
    !keys(value, [
      "schemaVersion",
      "status",
      "reason",
      "candidates",
      "correspondingCandidateLocators",
      "reportingMetadata",
    ]) ||
    value.schemaVersion !== "2.0.0" ||
    !member(
      [
        "matched",
        "value_differs",
        "ambiguous",
        "no_corresponding_fact",
        "unsupported",
      ],
      value.status,
    ) ||
    !(value.reason === null || member(issues, value.reason)) ||
    !Array.isArray(value.candidates) ||
    value.candidates.length > limits.candidates ||
    !value.candidates.every(candidate) ||
    !Array.isArray(value.correspondingCandidateLocators) ||
    value.correspondingCandidateLocators.length > limits.candidates
  )
    return false;
  const rows = value.candidates;
  if (
    !reportingMetadata(
      value.reportingMetadata,
      cik,
      value.reason !== null && rows.length === 0 ? value.reason : null,
      new Set(rows.map((row) => row.locator)),
    )
  )
    return false;
  if (
    rows.some(
      (row, index) =>
        index > 0 &&
        Number(row.locator.slice(10)) <=
          Number(rows[index - 1]!.locator.slice(10)),
    )
  )
    return false;
  const locators = new Set(rows.map((row) => row.locator));
  if (
    locators.size !== rows.length ||
    !value.correspondingCandidateLocators.every(
      (locator) => typeof locator === "string" && locators.has(locator),
    ) ||
    new Set(value.correspondingCandidateLocators).size !==
      value.correspondingCandidateLocators.length
  )
    return false;
  if (value.reason !== null && rows.length === 0)
    return (
      value.status === "unsupported" &&
      value.correspondingCandidateLocators.length === 0
    );
  const correspondingLocators =
    value.correspondingCandidateLocators as string[];
  if (
    JSON.stringify(correspondingLocators) !==
    JSON.stringify(
      rows.filter((row) => row.issues.length === 0).map((row) => row.locator),
    )
  )
    return false;
  const corresponding = rows.filter((row) =>
    correspondingLocators.includes(row.locator),
  );
  if (
    !corresponding.every(
      (row) =>
        matches(row.contextId, /^[A-Za-z_][A-Za-z0-9_.-]{0,255}$/u) &&
        matches(row.unitId, /^[A-Za-z_][A-Za-z0-9_.-]{0,255}$/u) &&
        (row.factId === null ||
          matches(row.factId, /^[A-Za-z_][A-Za-z0-9_.-]{0,255}$/u)) &&
        row.entityCik === cik &&
        row.entityScheme === "http://www.sec.gov/CIK" &&
        matches(row.entityIdentifier, /^[0-9]{1,10}$/u) &&
        row.entityIdentifier.padStart(10, "0") === cik &&
        gaapNamespace(row.concept.namespace) &&
        row.concept.localName === selected.concept &&
        row.unit === "USD" &&
        row.unitMeasures.length === 1 &&
        row.unitMeasures[0]?.namespace === "http://www.xbrl.org/2003/iso4217" &&
        row.unitMeasures[0]?.localName === "USD" &&
        row.periodKind === "duration" &&
        row.startDate === selected.startDate &&
        row.endDate === selected.endDate &&
        row.dimensions.length === 0 &&
        row.issues.length === 0 &&
        row.value !== null,
    )
  )
    return false;
  const uncertain = rows.find(
    (row) =>
      row.issues.length > 0 &&
      !row.issues.includes("entity_mismatch") &&
      !row.issues.includes("period_mismatch"),
  );
  if (uncertain !== undefined)
    return (
      value.status === "unsupported" && value.reason === uncertain.issues[0]
    );
  if (value.reason !== null) return false;
  const values = new Set(corresponding.map((row) => row.value));
  if (value.status === "matched")
    return (
      corresponding.length > 0 &&
      values.size === 1 &&
      values.has(selected.value)
    );
  if (value.status === "value_differs")
    return (
      corresponding.length > 0 &&
      values.size === 1 &&
      !values.has(selected.value)
    );
  if (value.status === "ambiguous") return values.size > 1;
  return value.status === "no_corresponding_fact" && corresponding.length === 0;
}

function reportingMetadata(
  value: unknown,
  cik: string,
  globalReason: unknown,
  numericLocators: ReadonlySet<string>,
): boolean {
  if (
    !keys(value, ["status", "reason", "fields", "observations"]) ||
    !member(["assessed", "limited", "unavailable"], value.status) ||
    !(value.reason === null || member(issues, value.reason)) ||
    !Array.isArray(value.fields) ||
    value.fields.length !== reportingConcepts.length ||
    !value.fields.every(reportingField) ||
    value.fields.some(
      (field, index) => field.concept !== reportingConcepts[index],
    ) ||
    !Array.isArray(value.observations) ||
    value.observations.length > limits.metadataCandidates ||
    !value.observations.every(reportingObservation) ||
    new TextEncoder().encode(JSON.stringify(value)).byteLength >
      limits.metadataOutputBytes
  )
    return false;
  const rows = value.observations;
  if (
    rows.some(
      (row, index) =>
        numericLocators.has(row.locator) ||
        (index > 0 &&
          Number(row.locator.slice(10)) <=
            Number(rows[index - 1]!.locator.slice(10))),
    )
  )
    return false;
  if (value.status !== "assessed")
    return (
      rows.length === 0 &&
      value.fields.every(
        (field) =>
          field.status === "unsupported" &&
          field.value === null &&
          field.observationLocators.length === 0,
      ) &&
      (value.status === "unavailable"
        ? globalReason !== null && value.reason === globalReason
        : globalReason === null &&
          member(["candidate_limit", "output_limit"], value.reason))
    );
  if (value.reason !== null || globalReason !== null) return false;
  for (const row of rows) {
    const excluded =
      row.issues.length === 1 && row.issues[0] === "entity_mismatch";
    if (
      (row.issues.length === 0 || excluded) &&
      (!matches(row.contextId, /^[A-Za-z_][A-Za-z0-9_.-]{0,255}$/u) ||
        !(
          row.factId === null ||
          matches(row.factId, /^[A-Za-z_][A-Za-z0-9_.-]{0,255}$/u)
        ) ||
        !(excluded
          ? row.entityCik !== null && row.entityCik !== cik
          : row.entityCik === cik) ||
        row.entityScheme !== "http://www.sec.gov/CIK" ||
        !matches(row.entityIdentifier, /^[0-9]{1,10}$/u) ||
        row.entityIdentifier.padStart(10, "0") !== row.entityCik ||
        !member(deiNamespaces, row.concept.namespace) ||
        !member(reportingConcepts, row.concept.localName) ||
        !matches(
          row.concept.raw,
          /^(?:[A-Za-z_][A-Za-z0-9_.-]*:)?[A-Za-z_][A-Za-z0-9_.-]*$/u,
        ) ||
        row.concept.raw.split(":").at(-1) !== row.concept.localName ||
        row.periodKind !== "duration" ||
        row.startDate === null ||
        row.endDate === null ||
        row.startDate > row.endDate ||
        row.dimensions.length !== 0 ||
        row.format !== null ||
        row.value === null ||
        row.rawText.replace(/[\t\n\r ]+/gu, " ").replace(/^ | $/gu, "") !==
          row.value)
    )
      return false;
  }
  return value.fields.every((field) => {
    const references = rows.filter(
      (row) => reportingConcept(row.concept.localName) === field.concept,
    );
    if (
      JSON.stringify(field.observationLocators) !==
      JSON.stringify(references.map((row) => row.locator))
    )
      return false;
    const uncertain = references.some(
      (row) =>
        row.issues.length > 0 &&
        !(row.issues.length === 1 && row.issues[0] === "entity_mismatch"),
    );
    const eligibleValues = new Set(
      references
        .filter((row) => row.issues.length === 0)
        .map((row) => row.value),
    );
    const status = uncertain
      ? "unsupported"
      : eligibleValues.size === 0
        ? "missing"
        : eligibleValues.size > 1
          ? "conflicting"
          : "observed";
    return (
      field.status === status &&
      (status === "observed"
        ? eligibleValues.has(field.value)
        : field.value === null)
    );
  });
}

function reportingField(
  value: unknown,
): value is PersonalSecFilingReportingFieldDto {
  return (
    keys(value, ["concept", "status", "value", "observationLocators"]) &&
    member(reportingConcepts, value.concept) &&
    member(
      ["observed", "missing", "conflicting", "unsupported"],
      value.status,
    ) &&
    (value.value === null || reportingValue(value.concept, value.value)) &&
    Array.isArray(value.observationLocators) &&
    value.observationLocators.length <= limits.metadataCandidates &&
    value.observationLocators.every((locator) => typeof locator === "string")
  );
}

function reportingObservation(
  value: unknown,
): value is PersonalSecFilingReportingObservationDto {
  return (
    keys(value, [
      "locator",
      "factId",
      "contextId",
      "concept",
      "entityIdentifier",
      "entityScheme",
      "entityCik",
      "dimensions",
      "periodKind",
      "startDate",
      "endDate",
      "rawText",
      "format",
      "value",
      "issues",
    ]) &&
    matches(value.locator, /^\/elements\/[1-9][0-9]{0,6}$/u) &&
    Number(value.locator.slice(10)) <= limits.nodes &&
    nullableSourceText(value.factId, limits.identifierCharacters) &&
    nullableSourceText(value.contextId, limits.identifierCharacters) &&
    qname(value.concept) &&
    record(value.concept) &&
    reportingConcept(value.concept.localName) !== null &&
    nullableSourceText(value.entityIdentifier, limits.identifierCharacters) &&
    nullableSourceText(value.entityScheme, limits.namespaceCharacters) &&
    (value.entityCik === null || matches(value.entityCik, cikPattern)) &&
    Array.isArray(value.dimensions) &&
    value.dimensions.length <= limits.dimensionsPerContext &&
    value.dimensions.every(
      (dimension) =>
        keys(dimension, ["kind", "dimension", "member", "typedText"]) &&
        qname(dimension.dimension) &&
        ((dimension.kind === "explicit" &&
          qname(dimension.member) &&
          dimension.typedText === null) ||
          (dimension.kind === "typed" &&
            dimension.member === null &&
            rawText(dimension.typedText))),
    ) &&
    member(["duration", "instant", "unsupported"], value.periodKind) &&
    (value.startDate === null || date(value.startDate)) &&
    (value.endDate === null || date(value.endDate)) &&
    rawText(value.rawText) &&
    (value.format === null || qname(value.format)) &&
    (value.value === null ||
      reportingValue(
        reportingConcept(value.concept.localName)!,
        value.value,
      )) &&
    Array.isArray(value.issues) &&
    value.issues.length <= reportingIssues.length &&
    value.issues.every((issue) => member(reportingIssues, issue)) &&
    new Set(value.issues).size === value.issues.length
  );
}

function reportingConcept(
  value: unknown,
): (typeof reportingConcepts)[number] | null {
  return typeof value === "string"
    ? (reportingConcepts.find(
        (concept) => concept.toLowerCase() === value.toLowerCase(),
      ) ?? null)
    : null;
}

function reportingValue(concept: string, value: unknown): value is string {
  if (concept === "DocumentType")
    return member(["10-Q", "10-Q/A", "10-K", "10-K/A"], value);
  if (concept === "DocumentPeriodEndDate") return date(value);
  if (concept === "DocumentFiscalYearFocus")
    return matches(value, /^[1-9][0-9]{3}$/u);
  return (
    concept === "DocumentFiscalPeriodFocus" &&
    member(["FY", "Q1", "Q2", "Q3"], value)
  );
}

function candidate(
  value: unknown,
): value is PersonalSecFilingContextCandidateDto {
  if (
    !keys(value, [
      "locator",
      "factId",
      "contextId",
      "unitId",
      "concept",
      "entityIdentifier",
      "entityScheme",
      "entityCik",
      "dimensions",
      "periodKind",
      "startDate",
      "endDate",
      "unit",
      "unitMeasures",
      "rawText",
      "format",
      "sign",
      "scale",
      "decimals",
      "precision",
      "value",
      "issues",
    ]) ||
    !matches(value.locator, /^\/elements\/[1-9][0-9]{0,6}$/u) ||
    Number(value.locator.slice(10)) > limits.nodes ||
    !nullableSourceText(value.factId, limits.identifierCharacters) ||
    !nullableSourceText(value.contextId, limits.identifierCharacters) ||
    !nullableSourceText(value.unitId, limits.identifierCharacters) ||
    !qname(value.concept) ||
    !nullableSourceText(value.entityIdentifier, limits.identifierCharacters) ||
    !nullableSourceText(value.entityScheme, limits.namespaceCharacters) ||
    !(value.entityCik === null || matches(value.entityCik, cikPattern)) ||
    !Array.isArray(value.dimensions) ||
    value.dimensions.length > limits.dimensionsPerContext ||
    !value.dimensions.every(
      (dimension) =>
        keys(dimension, ["kind", "dimension", "member", "typedText"]) &&
        qname(dimension.dimension) &&
        ((dimension.kind === "explicit" &&
          qname(dimension.member) &&
          dimension.typedText === null) ||
          (dimension.kind === "typed" &&
            dimension.member === null &&
            rawText(dimension.typedText))),
    ) ||
    !member(["duration", "instant", "unsupported"], value.periodKind) ||
    !(value.startDate === null || date(value.startDate)) ||
    !(value.endDate === null || date(value.endDate)) ||
    !(value.unit === null || value.unit === "USD") ||
    !Array.isArray(value.unitMeasures) ||
    value.unitMeasures.length > limits.unitMeasures ||
    !value.unitMeasures.every(qname) ||
    !rawText(value.rawText) ||
    !(value.format === null || qname(value.format)) ||
    ![value.sign, value.scale, value.decimals, value.precision].every((part) =>
      nullableSourceText(part, limits.identifierCharacters),
    ) ||
    !(value.value === null || decimal(value.value)) ||
    !Array.isArray(value.issues) ||
    value.issues.length > issues.length ||
    !value.issues.every((issue) => member(issues, issue)) ||
    new Set(value.issues).size !== value.issues.length
  )
    return false;
  return true;
}

function qname(value: unknown): boolean {
  return (
    keys(value, ["raw", "namespace", "localName"]) &&
    sourceText(value.raw, limits.identifierCharacters) &&
    nullableSourceText(value.namespace, limits.namespaceCharacters) &&
    nullableSourceText(value.localName, limits.identifierCharacters)
  );
}
function gaapNamespace(value: string | null): boolean {
  const match =
    /^http:\/\/fasb\.org\/us-gaap\/(20[0-9]{2})(-[0-9]{2}-[0-9]{2})?$/u.exec(
      value ?? "",
    );
  return (
    match !== null &&
    Number(match[1]) >= 2009 &&
    (match[2] === undefined || date(`${match[1]}${match[2]}`))
  );
}
function source(value: unknown, url: string): boolean {
  return (
    keys(value, ["sourceUrl", "fetchedAt"]) &&
    value.sourceUrl === url &&
    instant(value.fetchedAt)
  );
}
function unavailableStage(stage: string, reason: string): boolean {
  if (reason === "selection_changed_or_not_retained")
    return stage === "company_facts";
  if (
    [
      "accession_not_in_current_submissions",
      "submission_metadata_conflict",
      "primary_document_unavailable",
    ].includes(reason)
  )
    return stage === "submissions";
  if (
    [
      "runtime_unavailable",
      "parser_timeout",
      "worker_failed",
      "invalid_output",
      "output_too_large",
    ].includes(reason)
  )
    return stage === "parser";
  return stage !== "parser";
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(
  value: unknown,
  expected: readonly string[],
): value is Record<string, unknown> {
  return (
    record(value) &&
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}
function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}
function member(values: readonly string[], value: unknown): value is string {
  return typeof value === "string" && values.includes(value);
}
function safeText(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)
  );
}
function nullableText(value: unknown, max: number): boolean {
  return value === null || safeText(value, max);
}
function sourceText(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    !/[\p{Cc}\p{Cs}]/u.test(value.replace(/[\t\n\r]/gu, ""))
  );
}
function nullableSourceText(value: unknown, max: number): boolean {
  return value === null || sourceText(value, max);
}
function rawText(value: unknown): value is string {
  return sourceText(value, limits.rawTextCharacters);
}
function integer(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  );
}
function decimal(value: unknown): value is string {
  return (
    matches(
      value,
      /^(?:0|-?[1-9][0-9]*|-?0\.[0-9]*[1-9]|-?[1-9][0-9]*\.[0-9]*[1-9])$/u,
    ) && value.length <= limits.decimalCharacters
  );
}
function date(value: unknown): value is string {
  return (
    matches(value, /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}
function sourceInstant(value: unknown): value is string {
  return (
    matches(
      value,
      /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{3})?Z$/u,
    ) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() ===
      (value.length === 20 ? value.replace("Z", ".000Z") : value)
  );
}
function instant(value: unknown): value is string {
  return sourceInstant(value) && value.length === 24;
}
function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

async function readJson(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new PersonalWorkspaceApiError("invalid_response");
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    const chunks: string[] = [];
    while (true) {
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 2 * 1024 * 1024) throw new Error();
      chunks.push(decoder.decode(chunk.value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return JSON.parse(chunks.join("")) as unknown;
  } catch {
    abort();
    signal.throwIfAborted();
    throw new PersonalWorkspaceApiError("invalid_response");
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
async function responseError(
  response: Response,
  signal: AbortSignal,
): Promise<PersonalWorkspaceApiError> {
  if (response.status === 401 || response.status === 403)
    return new PersonalWorkspaceApiError("session_unavailable");
  if (response.status === 400)
    return new PersonalWorkspaceApiError("invalid_request");
  if (response.status === 409) return new PersonalWorkspaceApiError("conflict");
  if (response.status === 404)
    return new PersonalWorkspaceApiError("not_covered");
  if (response.status === 429)
    return new PersonalWorkspaceApiError("rate_limited");
  if (response.status === 502)
    return new PersonalWorkspaceApiError("provider_unavailable");
  if (response.status === 503) {
    try {
      const value = await readJson(response, signal);
      if (record(value) && value.code === "not_configured")
        return new PersonalWorkspaceApiError("not_configured");
    } catch {
      signal.throwIfAborted();
    }
  }
  return new PersonalWorkspaceApiError("unavailable");
}
