import { PERSONAL_SEC_QUARTERLY_CONCEPTS as concepts } from "./personal-sec-quarterly-evidence";
import { PERSONAL_SEC_FILING_REPORTING_CONCEPTS as reportingConcepts } from "./personal-sec-filing-context";
import {
  PERSONAL_SEC_QUARTER_ASSESSMENT_LIMITS as limits,
  PERSONAL_SEC_QUARTER_PARSER_VERSION,
  PERSONAL_SEC_QUARTER_PROFILE_VERSION,
  PERSONAL_SEC_QUARTER_PROJECTOR_VERSION,
  type PersonalSecQuarterAssessmentInputDto,
  type PersonalSecQuarterAssessmentRequestDto,
  type PersonalSecQuarterAssessmentResponseDto,
  type PersonalSecQuarterAssessmentSelectionDto,
  type PersonalSecQuarterAssessmentTargetDto,
  type PersonalSecQuarterAnalysisDto,
  type PersonalSecQuarterEvidenceDto,
  type PersonalSecQuarterSourceDto,
} from "./personal-sec-quarter-assessment";
import type { PersonalSecQuarterPrimaryEvidenceDto } from "./personal-sec-quarter-assessment-evidence";
import { assertPersonalSecJsonUniqueKeys } from "./personal-sec-source-json";

type R = Record<string, unknown>;
const primaryIssues = [
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
];
const primaryFailures = [
  ...primaryIssues,
  "invalid_input",
  "source_hash_mismatch",
  "aggregate_candidate_limit",
  "metadata_limit",
  "structural_limit",
];
const tableReasons = [
  "nested_table",
  "unsupported_geometry",
  "unsupported_source_structure",
];
const cfIssues = [
  "row_not_object",
  "missing_accession",
  "invalid_accession",
  "invalid_start_date",
  "invalid_end_date",
  "invalid_period",
  "invalid_form",
  "invalid_filed_date",
  "invalid_fiscal_year",
  "invalid_fiscal_period",
  "invalid_frame",
  "invalid_numeric",
  "decimal_limit",
  "invalid_unit_key",
  "unsupported_row_fields",
];
const reasons = [
  "report_identity_unresolved",
  "report_metadata_conflict",
  "unsupported_amendment",
  "unsupported_transition_period",
  "unsupported_week_calendar",
  "unsupported_stub_period",
  "unsupported_q4",
  "unsupported_ytd_only",
  "fiscal_boundary_unresolved",
  "fiscal_boundary_conflict",
  "fiscal_calendar_unresolved",
  "fiscal_slot_unresolved",
  "fiscal_ytd_role_unresolved",
  "cash_date_join_mismatch",
  "principal_statement_unresolved",
  "consolidation_scope_unresolved",
  "caption_ownership_unresolved",
  "current_column_unresolved",
  "column_ownership_conflict",
  "whole_revenue_scope_unresolved",
  "parent_attribution_unresolved",
  "unsupported_common_share_numerator",
  "unsupported_continuing_income",
  "display_amount_unresolved",
  "display_unit_unresolved",
  "display_amount_mismatch",
  "adjacent_cell_ownership_conflict",
  "static_visibility_unresolved",
  "static_script_unresolved",
  "competing_revenue_concepts",
  "membership_unresolved",
  "current_non_usd",
  "current_value_conflict",
  "concept_absent",
  "no_current_company_facts_row",
  "no_current_primary_row",
  "unwitnessed_company_facts_reference",
  "principal_witness_unresolved",
  "pair_period_mismatch",
  "metric_not_supported",
];
const acquisitionReasons = [
  ...primaryFailures,
  "accession_not_in_current_submissions",
  "submission_metadata_conflict",
  "primary_document_unavailable",
  "not_covered",
  "rate_limited",
  "upstream_unavailable",
  "invalid_response",
  "response_too_large",
  "duplicate_json_key",
  "json_depth_limit",
  "company_facts_structure_invalid",
  "company_facts_field_limit",
  "company_facts_projection_limit",
  "runtime_unavailable",
  "parser_timeout",
  "worker_failed",
  "invalid_output",
  "output_too_large",
  "invalid_evidence_graph",
  "operation_deadline",
];
const profileKinds: Readonly<Record<string, string>> = {
  report_identity_v1: "identity",
  principal_statement_v1: "statement",
  calendar_direct_boundary_v1: "calendar",
  calendar_fiscal_ytd_roles_v1: "calendar",
  standalone_column_v1: "column",
  whole_revenue_v1: "scope",
  parent_income_explicit_v1: "scope",
  parent_income_wholly_owned_v1: "scope",
  signed_usd_display_v1: "display",
  static_source_path_v1: "static",
};

export function isPersonalSecQuarterAssessmentSelection(
  value: unknown,
): value is PersonalSecQuarterAssessmentSelectionDto {
  return (
    keys(value, ["accessionNumber", "form", "filedDate", "reportDate"]) &&
    accession(value.accessionNumber) &&
    member(value.form, ["10-Q", "10-Q/A"]) &&
    date(value.filedDate) &&
    (value.reportDate === null ||
      (date(value.reportDate) && value.reportDate <= value.filedDate))
  );
}
export function isPersonalSecQuarterAssessmentTarget(
  value: unknown,
): value is PersonalSecQuarterAssessmentTargetDto {
  if (
    !keys(value, ["catalogSnapshotSha256", "security"]) ||
    !digest(value.catalogSnapshotSha256)
  )
    return false;
  const s = value.security;
  return (
    keys(s, [
      "country",
      "exchangeMic",
      "issuerName",
      "listingId",
      "securityName",
      "symbol",
      "issuerId",
      "cik",
    ]) &&
    s.country === "US" &&
    pattern(s.exchangeMic, /^[A-Z0-9]{4}$/u) &&
    display(s.issuerName) &&
    display(s.securityName) &&
    identifier(s.listingId) &&
    identifier(s.issuerId) &&
    symbol(s.symbol) &&
    cik(s.cik)
  );
}
export function isPersonalSecQuarterAssessmentRequest(
  value: unknown,
): value is PersonalSecQuarterAssessmentRequestDto {
  return (
    keys(value, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "listingId",
      "symbol",
      "selection",
    ]) &&
    value.schemaVersion === "1.0.0" &&
    digest(value.catalogSnapshotSha256) &&
    identifier(value.listingId) &&
    symbol(value.symbol) &&
    isPersonalSecQuarterAssessmentSelection(value.selection)
  );
}

export function personalSecQuarterBundlePayload(
  target: PersonalSecQuarterAssessmentTargetDto,
  selection: PersonalSecQuarterAssessmentSelectionDto,
  sources: readonly PersonalSecQuarterSourceDto[],
): string {
  if (
    !isPersonalSecQuarterAssessmentTarget(target) ||
    !isPersonalSecQuarterAssessmentSelection(selection) ||
    !sourceList(sources, target.security.cik, selection, true)
  )
    throw new TypeError("invalid_quarter_bundle");
  const s = target.security;
  return JSON.stringify({
    schemaVersion: "1.0.0",
    target: {
      catalogSnapshotSha256: target.catalogSnapshotSha256,
      security: {
        country: s.country,
        exchangeMic: s.exchangeMic,
        issuerName: s.issuerName,
        listingId: s.listingId,
        securityName: s.securityName,
        symbol: s.symbol,
        issuerId: s.issuerId,
        cik: s.cik,
      },
    },
    selection: {
      accessionNumber: selection.accessionNumber,
      form: selection.form,
      filedDate: selection.filedDate,
      reportDate: selection.reportDate,
    },
    versions: {
      projector: PERSONAL_SEC_QUARTER_PROJECTOR_VERSION,
      parser: PERSONAL_SEC_QUARTER_PARSER_VERSION,
      profiles: PERSONAL_SEC_QUARTER_PROFILE_VERSION,
    },
    sources: sources.map((s) => ({
      id: s.id,
      sourceUrl: s.sourceUrl,
      sha256: s.sha256,
      bytes: s.bytes,
      retrievalStartedAt: s.retrievalStartedAt,
      retrievalCompletedAt: s.retrievalCompletedAt,
    })),
  });
}

export function isPersonalSecQuarterPrimaryEvidence(
  value: unknown,
): value is PersonalSecQuarterPrimaryEvidenceDto {
  try {
    return primary(value);
  } catch {
    return false;
  }
}

function primary(
  value: unknown,
): value is PersonalSecQuarterPrimaryEvidenceDto {
  if (
    !keys(value, [
      "schemaVersion",
      "mode",
      "documentSha256",
      "documentBytes",
      "cik",
      "selection",
      "status",
      "reason",
      "concepts",
      "contexts",
      "units",
      "reportingMetadata",
      "structure",
    ]) ||
    value.schemaVersion !== "1.0.0" ||
    value.mode !== "accession_evidence" ||
    !digest(value.documentSha256) ||
    !integer(value.documentBytes, 1, limits.primaryBytes) ||
    !cik(value.cik) ||
    !isPersonalSecQuarterAssessmentSelection(value.selection) ||
    value.selection.form !== "10-Q" ||
    value.selection.reportDate === null ||
    !fits(value, limits.workerOutputBytes)
  )
    return false;
  if (value.status === "unavailable")
    return (
      member(value.reason, primaryFailures) &&
      empty(value.concepts) &&
      empty(value.contexts) &&
      empty(value.units) &&
      value.reportingMetadata === null &&
      value.structure === null
    );
  if (
    value.status !== "complete" ||
    value.reason !== null ||
    !list(value.concepts, 4) ||
    value.concepts.length !== 4 ||
    !list(value.contexts, 20_000) ||
    !list(value.units, 5000)
  )
    return false;
  const contexts = new Map<string, R>();
  const units = new Map<string, R>();
  const xmlIds = new Set<string>();
  const xmlOrdinals = new Set<number>();
  for (const [rows, map, prefix] of [
    [value.contexts, contexts, "c"],
    [value.units, units, "u"],
  ] as const) {
    let previous = 0;
    for (const row of rows) {
      if (
        !keys(row, ["id", "xmlId", "elementOrdinal", "root"]) ||
        !integer(row.elementOrdinal, previous + 1, 1_000_000) ||
        row.id !== `${prefix}:${row.elementOrdinal}` ||
        !text(row.xmlId, 256, true) ||
        xmlIds.has(row.xmlId) ||
        !xml(row.root, 0, xmlOrdinals) ||
        row.root.elementOrdinal !== row.elementOrdinal
      )
        return false;
      previous = row.elementOrdinal;
      xmlIds.add(row.xmlId);
      map.set(String(row.id), row);
    }
  }
  if (!structure(value.structure, contexts, units)) return false;
  const elementCount = (value.structure.document as R).elementCount as number;
  if ([...xmlOrdinals].some((ordinal) => ordinal > elementCount)) return false;
  const structureRows = value.structure.records as R[];
  const elements = new Map(structureRows.map((row) => [row.id as string, row]));
  const seen = new Set<string>();
  let total = 0;
  for (const [index, population] of value.concepts.entries()) {
    if (
      !keys(population, ["concept", "occurrences"]) ||
      population.concept !== concepts[index] ||
      !list(population.occurrences, limits.primaryCandidatesPerConcept)
    )
      return false;
    let previous = 0;
    total += population.occurrences.length;
    for (const row of population.occurrences) {
      if (
        !occurrence(row, contexts, units, elements) ||
        row.elementOrdinal > elementCount ||
        row.elementOrdinal <= previous ||
        seen.has(row.id as string) ||
        !conceptName(row.concept, String(population.concept), row.issues)
      )
        return false;
      previous = row.elementOrdinal;
      seen.add(row.id as string);
    }
  }
  if (
    total > limits.primaryCandidatesTotal ||
    !metadata(value.reportingMetadata, contexts, elements, seen)
  )
    return false;
  if (
    ((value.reportingMetadata as R).observations as R[]).some(
      (row) => (row.elementOrdinal as number) > elementCount,
    )
  )
    return false;
  const registrant = (value.structure.supplementaryFacts as R[]).filter(
    (r) => (r.concept as R).localName === "EntityRegistrantName",
  );
  if (
    ((value.reportingMetadata as R).observations instanceof Array &&
      ((value.reportingMetadata as R).observations as unknown[]).length +
        registrant.length >
        limits.metadataCandidates) ||
    !fits([value.reportingMetadata, registrant], limits.metadataBytes)
  )
    return false;
  return true;
}

function xml(
  value: unknown,
  depth: number,
  ordinals: Set<number>,
): value is R & { elementOrdinal: number } {
  if (
    depth > 256 ||
    !keys(value, [
      "elementOrdinal",
      "name",
      "attributes",
      "qnameAttributes",
      "textQName",
      "textRuns",
      "children",
    ]) ||
    !integer(value.elementOrdinal, 1, 1_000_000) ||
    ordinals.has(value.elementOrdinal) ||
    !qname(value.name) ||
    !attributes(value.attributes) ||
    !list(value.qnameAttributes, 64) ||
    !nullable(value.textQName, qname) ||
    !list(value.children, 1_000_000) ||
    !runs(value.textRuns, value.children.length)
  )
    return false;
  ordinals.add(value.elementOrdinal);
  const attrNames = new Set<string>();
  for (const a of value.qnameAttributes) {
    if (
      !keys(a, ["name", "value"]) ||
      !text(a.name, 256, true) ||
      attrNames.has(a.name) ||
      !qname(a.value) ||
      !value.attributes.some(
        (raw) => raw.name === a.name && raw.value === (a.value as R).raw,
      )
    )
      return false;
    attrNames.add(a.name);
  }
  let previous = value.elementOrdinal;
  for (const child of value.children) {
    if (!xml(child, depth + 1, ordinals) || child.elementOrdinal <= previous)
      return false;
    previous = lastXmlOrdinal(child);
  }
  return true;
}

function occurrence(
  row: unknown,
  contexts: Map<string, R>,
  units: Map<string, R>,
  elements: Map<string, R>,
): row is R & {
  elementOrdinal: number;
  concept: { raw: string; localName: string | null };
} {
  if (
    !keys(row, [
      "id",
      "elementOrdinal",
      "locator",
      "factId",
      "concept",
      "rawContextRef",
      "contextRecordId",
      "rawUnitRef",
      "unitRecordId",
      "rawText",
      "format",
      "sign",
      "scale",
      "decimals",
      "precision",
      "value",
      "issues",
      "elementRecordId",
      "actualTableOrdinal",
      "actualRowOrdinal",
      "actualCellOrdinal",
    ]) ||
    !integer(row.elementOrdinal, 1, 1_000_000) ||
    row.id !== `f:${row.elementOrdinal}` ||
    row.locator !== `/elements/${row.elementOrdinal}` ||
    !qname(row.concept) ||
    !nullable(row.factId, small) ||
    !contextJoin(row.rawContextRef, row.contextRecordId, contexts) ||
    !contextJoin(row.rawUnitRef, row.unitRecordId, units) ||
    !text(row.rawText) ||
    !nullable(row.format, qname) ||
    ![row.sign, row.scale, row.decimals, row.precision].every((v) =>
      nullable(v, small),
    ) ||
    !nullable(row.value, decimal) ||
    !enumList(row.issues, primaryIssues) ||
    !coordinates(row) ||
    !elementJoin(row, elements)
  )
    return false;
  if (
    (row.contextRecordId === null || row.unitRecordId === null) &&
    (row.issues as unknown[]).length === 0
  )
    return false;
  return true;
}

function structure(
  value: unknown,
  contexts: Map<string, R>,
  units: Map<string, R>,
): value is R {
  if (
    !keys(value, [
      "profileVersion",
      "status",
      "reasons",
      "document",
      "records",
      "siblingWindows",
      "tables",
      "supplementaryFacts",
      "anchorRecordIds",
    ]) ||
    value.profileVersion !== "sparse-source-1.0.0" ||
    !member(value.status, ["complete", "unsupported"]) ||
    !enumList(value.reasons, tableReasons) ||
    (value.status === "complete") !== empty(value.reasons) ||
    !list(value.records, limits.structuralRecords) ||
    !list(value.siblingWindows, limits.structuralRecords) ||
    !list(value.tables, limits.tables) ||
    !list(value.supplementaryFacts, limits.structuralRecords) ||
    !fits(value, limits.structuralBytes) ||
    !documentObservations(value.document)
  )
    return false;
  const records = new Map<string, R>();
  let previous = 0;
  for (const row of value.records) {
    if (
      !keys(row, [
        "id",
        "elementOrdinal",
        "endElementOrdinal",
        "name",
        "attributes",
        "parentRecordId",
        "parentElementOrdinal",
        "childIndex",
        "elementChildCount",
        "descendantTableCount",
        "descendantTableOrdinals",
        "textRuns",
        "childRecordIds",
        "childrenComplete",
        "actualTableOrdinal",
        "actualRowOrdinal",
        "actualCellOrdinal",
      ]) ||
      !integer(row.elementOrdinal, previous + 1, value.document.elementCount) ||
      row.id !== `e:${row.elementOrdinal}` ||
      !integer(
        row.endElementOrdinal,
        row.elementOrdinal,
        value.document.elementCount,
      ) ||
      !qname(row.name) ||
      !attributes(row.attributes) ||
      !integer(row.childIndex, 0, 1_000_000) ||
      !integer(row.elementChildCount, 0, 1_000_000) ||
      !integer(row.descendantTableCount, 0, 1_000_000) ||
      !(
        row.descendantTableOrdinals === null ||
        (numberList(
          row.descendantTableOrdinals,
          row.descendantTableCount,
          1_000_000,
        ) &&
          row.descendantTableOrdinals.length === row.descendantTableCount)
      ) ||
      !(row.textRuns === null || runs(row.textRuns, row.elementChildCount)) ||
      !stringList(row.childRecordIds, limits.structuralRecords) ||
      typeof row.childrenComplete !== "boolean" ||
      !coordinates(row)
    )
      return false;
    if (
      row.parentElementOrdinal === null
        ? row.parentRecordId !== null || row.elementOrdinal !== 1
        : !integer(row.parentElementOrdinal, 1, row.elementOrdinal - 1) ||
          row.parentRecordId !== `e:${row.parentElementOrdinal}`
    )
      return false;
    previous = row.elementOrdinal;
    records.set(String(row.id), row);
  }
  for (const row of records.values()) {
    if (row.parentRecordId !== null) {
      if (typeof row.parentRecordId !== "string") return false;
      const parent = records.get(row.parentRecordId);
      if (
        !parent ||
        (row.endElementOrdinal as number) >
          (parent.endElementOrdinal as number) ||
        (row.childIndex as number) >= (parent.elementChildCount as number)
      )
        return false;
    }
    let childIndex = -1;
    for (const id of row.childRecordIds as string[]) {
      const child = records.get(id);
      if (
        !child ||
        child.parentRecordId !== row.id ||
        (child.childIndex as number) <= childIndex
      )
        return false;
      childIndex = child.childIndex as number;
    }
    if (
      row.childrenComplete &&
      ((row.childRecordIds as string[]).length !== row.elementChildCount ||
        (row.childRecordIds as string[]).some(
          (id, index) => records.get(id)!.childIndex !== index,
        ))
    )
      return false;
  }
  for (const window of value.siblingWindows) {
    if (
      !keys(window, ["parentRecordId", "firstChildIndex", "childRecordIds"]) ||
      !integer(window.firstChildIndex, 0, 1_000_000) ||
      !refs(window.childRecordIds, records, limits.structuralRecords) ||
      !records.has(String(window.parentRecordId))
    )
      return false;
    for (const [index, id] of window.childRecordIds.entries()) {
      const child = records.get(id)!;
      if (
        child.parentRecordId !== window.parentRecordId ||
        child.childIndex !== window.firstChildIndex + index
      )
        return false;
    }
  }
  const tableIds = new Set<string>();
  for (const table of value.tables) {
    if (
      !keys(table, [
        "tableRecordId",
        "status",
        "reasons",
        "rowRecordIds",
        "rows",
      ]) ||
      !member(table.status, ["complete", "unsupported"]) ||
      !enumList(table.reasons, tableReasons) ||
      (table.status === "complete") !== empty(table.reasons) ||
      !refs(table.rowRecordIds, records, limits.rowsPerTable) ||
      !list(table.rows, limits.rowsPerTable) ||
      tableIds.has(String(table.tableRecordId))
    )
      return false;
    tableIds.add(String(table.tableRecordId));
    const tableRecord = records.get(String(table.tableRecordId));
    if (
      !tableRecord ||
      !named(tableRecord, "table") ||
      tableRecord.actualTableOrdinal === null
    )
      return false;
    if (table.status === "unsupported") {
      if (!empty(table.rows)) return false;
      continue;
    }
    const descendants: R[] = [];
    const pending = [tableRecord];
    const visited = new Set<string>();
    while (pending.length) {
      const record = pending.pop()!;
      if (visited.has(record.id as string) || !record.childrenComplete)
        return false;
      visited.add(record.id as string);
      descendants.push(record);
      for (const id of record.childRecordIds as string[])
        pending.push(records.get(id)!);
    }
    descendants.sort(
      (a, b) => (a.elementOrdinal as number) - (b.elementOrdinal as number),
    );
    if (
      descendants.some((r) => r !== tableRecord && named(r, "table")) ||
      !equalStrings(
        table.rowRecordIds,
        descendants.filter((r) => named(r, "tr")).map((r) => r.id as string),
      )
    )
      return false;
    if (table.rows.length !== table.rowRecordIds.length) return false;
    const occupied = new Set<string>();
    for (const [rowIndex, row] of table.rows.entries()) {
      if (
        !keys(row, ["rowRecordId", "cells"]) ||
        row.rowRecordId !== table.rowRecordIds[rowIndex] ||
        !list(row.cells, limits.logicalColumns)
      )
        return false;
      const source = records.get(String(row.rowRecordId))!;
      if (
        !named(source, "tr") ||
        source.actualTableOrdinal !== tableRecord.actualTableOrdinal ||
        source.actualRowOrdinal !== rowIndex + 1
      )
        return false;
      const sourceCells = descendants.filter(
        (r) =>
          (named(r, "td") || named(r, "th")) &&
          r.actualRowOrdinal === rowIndex + 1,
      );
      if (
        sourceCells.some((r) => r.parentRecordId !== source.id) ||
        !equalStrings(
          row.cells.map((c) => (c as R).cellRecordId),
          sourceCells.map((r) => r.id as string),
        )
      )
        return false;
      let last = -1;
      let nextColumn = 0;
      for (const [cellIndex, cell] of row.cells.entries()) {
        if (
          !keys(cell, [
            "cellRecordId",
            "columnStart",
            "columnSpan",
            "rowSpan",
          ]) ||
          !integer(cell.columnStart, 0, limits.logicalColumns - 1) ||
          !integer(cell.columnSpan, 1, limits.span) ||
          !integer(cell.rowSpan, 1, limits.span) ||
          cell.columnStart <= last ||
          cell.columnStart + cell.columnSpan > limits.logicalColumns ||
          rowIndex + cell.rowSpan > table.rows.length
        )
          return false;
        while (occupied.has(`${rowIndex}:${nextColumn}`)) nextColumn += 1;
        if (cell.columnStart !== nextColumn) return false;
        last = cell.columnStart;
        const sourceCell = records.get(String(cell.cellRecordId));
        if (
          !sourceCell ||
          !(named(sourceCell, "td") || named(sourceCell, "th")) ||
          sourceCell.actualTableOrdinal !== tableRecord.actualTableOrdinal ||
          sourceCell.actualRowOrdinal !== rowIndex + 1 ||
          sourceCell.actualCellOrdinal !== cellIndex + 1
        )
          return false;
        for (const [rawName, projected] of [
          ["colspan", "columnSpan"],
          ["rowspan", "rowSpan"],
        ] as const) {
          const attrs = (sourceCell.attributes as R[]).filter(
            (a) => String(a.name).toLowerCase() === rawName,
          );
          const raw = attrs.length === 0 ? "1" : attrs[0]!.value;
          if (
            attrs.length > 1 ||
            typeof raw !== "string" ||
            !/^[1-9][0-9]?$/u.test(raw) ||
            Number(raw) !== cell[projected]
          )
            return false;
        }
        for (let r = rowIndex; r < rowIndex + cell.rowSpan; r += 1)
          for (
            let c = cell.columnStart;
            c < cell.columnStart + cell.columnSpan;
            c += 1
          ) {
            const id = `${r}:${c}`;
            if (occupied.has(id)) return false;
            occupied.add(id);
          }
        nextColumn = cell.columnStart + cell.columnSpan;
      }
    }
  }
  const supplementIds = new Set<string>();
  for (const fact of value.supplementaryFacts) {
    if (
      !keys(fact, [
        "id",
        "elementOrdinal",
        "elementRecordId",
        "concept",
        "rawContextRef",
        "contextRecordId",
        "rawUnitRef",
        "unitRecordId",
        "format",
        "rawText",
        "sign",
        "scale",
        "decimals",
        "precision",
        "issues",
      ]) ||
      !integer(fact.elementOrdinal, 1, value.document.elementCount) ||
      fact.id !== `s:${fact.elementOrdinal}` ||
      supplementIds.has(String(fact.id)) ||
      fact.elementRecordId !== `e:${fact.elementOrdinal}` ||
      !records.has(String(fact.elementRecordId)) ||
      !qname(fact.concept) ||
      !contextJoin(fact.rawContextRef, fact.contextRecordId, contexts) ||
      !contextJoin(fact.rawUnitRef, fact.unitRecordId, units) ||
      !nullable(fact.format, qname) ||
      !text(fact.rawText) ||
      ![fact.sign, fact.scale, fact.decimals, fact.precision].every((v) =>
        nullable(v, small),
      ) ||
      !enumList(fact.issues, primaryIssues)
    )
      return false;
    if (!elementJoin(fact, records)) return false;
    supplementIds.add(String(fact.id));
  }
  return refs(value.anchorRecordIds, records, limits.structuralRecords);
}

function metadata(
  value: unknown,
  contexts: Map<string, R>,
  elements: Map<string, R>,
  financialIds: Set<string>,
): boolean {
  if (
    !keys(value, ["fields", "observations"]) ||
    !list(value.fields, 4) ||
    value.fields.length !== 4 ||
    !list(value.observations, limits.metadataCandidates) ||
    !fits(value, limits.metadataBytes)
  )
    return false;
  const observations = new Map<string, R>();
  let previous = 0;
  for (const row of value.observations) {
    if (
      !keys(row, [
        "id",
        "elementOrdinal",
        "locator",
        "factId",
        "concept",
        "rawContextRef",
        "contextRecordId",
        "rawText",
        "format",
        "value",
        "issues",
        "elementRecordId",
      ]) ||
      !integer(row.elementOrdinal, previous + 1, 1_000_000) ||
      row.id !== `d:${row.elementOrdinal}` ||
      row.locator !== `/elements/${row.elementOrdinal}` ||
      !nullable(row.factId, small) ||
      !qname(row.concept) ||
      !contextJoin(row.rawContextRef, row.contextRecordId, contexts) ||
      !text(row.rawText) ||
      !nullable(row.format, qname) ||
      !nullable(row.value, small) ||
      !enumList(row.issues, [...primaryIssues, "invalid_metadata_value"]) ||
      !elementJoin(row, elements) ||
      financialIds.has(`f:${row.elementOrdinal}`)
    )
      return false;
    previous = row.elementOrdinal;
    observations.set(String(row.id), row);
  }
  const used = new Set<string>();
  for (const [index, field] of value.fields.entries()) {
    if (
      !keys(field, ["concept", "status", "value", "observationIds"]) ||
      field.concept !== reportingConcepts[index] ||
      !member(field.status, [
        "observed",
        "missing",
        "conflicting",
        "unsupported",
      ]) ||
      !nullable(field.value, small) ||
      !refs(field.observationIds, observations, limits.metadataCandidates)
    )
      return false;
    if (
      field.status === "missing"
        ? field.value !== null || !empty(field.observationIds)
        : empty(field.observationIds)
    )
      return false;
    if ((field.status === "observed") !== (field.value !== null)) return false;
    for (const id of field.observationIds) {
      const row = observations.get(id)!;
      if (
        used.has(id) ||
        !conceptName(
          row.concept as { raw: string; localName: string | null },
          String(field.concept),
          row.issues,
        )
      )
        return false;
      used.add(id);
    }
  }
  return used.size === observations.size;
}

function documentObservations(
  value: unknown,
): value is R & { elementCount: number } {
  if (
    !keys(value, [
      "elementCount",
      "styleElements",
      "stylesheetLinks",
      "processingInstructions",
      "scripts",
      "eventAttributeCount",
    ]) ||
    !integer(value.elementCount, 1, 1_000_000) ||
    !integer(value.styleElements, 0, value.elementCount) ||
    !integer(value.stylesheetLinks, 0, value.elementCount) ||
    !integer(value.eventAttributeCount, 0, value.elementCount * 64) ||
    !list(value.processingInstructions, limits.structuralRecords) ||
    !list(value.scripts, limits.structuralRecords)
  )
    return false;
  for (const pi of value.processingInstructions)
    if (
      !keys(pi, ["locator", "target"]) ||
      !text(pi.locator, 256, true) ||
      !small(pi.target)
    )
      return false;
  for (const script of value.scripts)
    if (
      !keys(script, [
        "elementOrdinal",
        "name",
        "attributes",
        "inlineTextCharacters",
        "lastDocumentElementOrdinal",
      ]) ||
      !integer(script.elementOrdinal, 1, value.elementCount) ||
      !qname(script.name) ||
      !attributes(script.attributes) ||
      !integer(script.inlineTextCharacters, 0, limits.primaryBytes) ||
      script.lastDocumentElementOrdinal !== value.elementCount
    )
      return false;
  return true;
}

function contextJoin(
  raw: unknown,
  id: unknown,
  records: Map<string, R>,
): boolean {
  return (
    nullable(raw, small) &&
    (id === null ||
      (typeof id === "string" &&
        records.has(id) &&
        records.get(id)!.xmlId === raw))
  );
}
function elementJoin(row: R, records: Map<string, R>): boolean {
  if (row.elementRecordId === null) return true;
  if (typeof row.elementRecordId !== "string") return false;
  const source = records.get(row.elementRecordId);
  if (!source || source.elementOrdinal !== row.elementOrdinal) return false;
  const attrs = new Map(
    (source.attributes as R[]).map((a) => [
      String(a.name).toLowerCase(),
      a.value,
    ]),
  );
  for (const [field, attr] of [
    ["factId", "id"],
    ["rawContextRef", "contextref"],
    ["rawUnitRef", "unitref"],
    ["sign", "sign"],
    ["scale", "scale"],
    ["decimals", "decimals"],
    ["precision", "precision"],
  ]) {
    if (
      Object.hasOwn(row, field!) &&
      row[field!] !== (attrs.get(attr!) ?? null)
    )
      return false;
  }
  if (
    Object.hasOwn(row, "format") &&
    (row.format === null ? null : (row.format as R).raw) !==
      (attrs.get("format") ?? null)
  )
    return false;
  const concept = row.concept as R;
  const rawName = attrs.get("name");
  if (
    rawName !== undefined
      ? concept.raw !== rawName
      : concept.namespace !== (source.name as R).namespace ||
        concept.localName !== (source.name as R).localName
  )
    return false;
  const originalText = sourceText(source, records);
  if (originalText !== null && row.rawText !== originalText) return false;
  return (
    !Object.hasOwn(row, "actualTableOrdinal") ||
    ["actualTableOrdinal", "actualRowOrdinal", "actualCellOrdinal"].every(
      (key) => row[key] === source[key],
    )
  );
}
function sourceText(
  source: R,
  records: Map<string, R>,
  depth = 0,
): string | null {
  if (
    depth > 256 ||
    source.textRuns === null ||
    source.childrenComplete !== true
  )
    return null;
  const children = source.childRecordIds as string[];
  const runs = source.textRuns as R[];
  let result = "";
  for (let index = 0; index <= children.length; index += 1) {
    for (const run of runs)
      if (run.beforeChildIndex === index) result += String(run.text);
    if (index < children.length) {
      const child = records.get(children[index]!);
      if (!child) return null;
      const content = sourceText(child, records, depth + 1);
      if (content === null) return null;
      result += content;
    }
    if (result.length > limits.recordTextCharacters) return null;
  }
  return result;
}
function coordinates(row: R): boolean {
  return (
    nullable(row.actualTableOrdinal, (v) => integer(v, 1, 1_000_000)) &&
    nullable(row.actualRowOrdinal, (v) => integer(v, 1, 1_000_000)) &&
    nullable(row.actualCellOrdinal, (v) => integer(v, 1, 1_000_000)) &&
    (row.actualTableOrdinal !== null ||
      (row.actualRowOrdinal === null && row.actualCellOrdinal === null)) &&
    (row.actualRowOrdinal !== null || row.actualCellOrdinal === null)
  );
}
function qname(
  value: unknown,
): value is R & { raw: string; localName: string | null } {
  return (
    keys(value, ["raw", "namespace", "localName"]) &&
    text(value.raw, 256) &&
    nullable(value.namespace, small) &&
    nullable(value.localName, small) &&
    (value.namespace === null || value.localName !== null)
  );
}
function attributes(value: unknown): value is R[] {
  if (!list(value, 64)) return false;
  const seen = new Set<string>();
  for (const a of value) {
    if (
      !keys(a, ["name", "namespace", "localName", "value"]) ||
      !small(a.name) ||
      !nullable(a.namespace, small) ||
      !nullable(a.localName, small) ||
      !text(a.value) ||
      seen.has(a.name.toLowerCase())
    )
      return false;
    seen.add(a.name.toLowerCase());
  }
  return true;
}
function runs(value: unknown, childCount: number): boolean {
  if (!list(value, 4096)) return false;
  let previous = -1;
  let length = 0;
  for (const run of value) {
    if (
      !keys(run, ["beforeChildIndex", "text"]) ||
      !integer(run.beforeChildIndex, Math.max(0, previous), childCount) ||
      !text(run.text)
    )
      return false;
    previous = run.beforeChildIndex;
    length += run.text.length;
  }
  return length <= limits.recordTextCharacters;
}

function keys(value: unknown, expected: readonly string[]): value is R {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}
function list(value: unknown, max: number): value is unknown[] {
  return Array.isArray(value) && value.length <= max;
}
function empty(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}
function text(value: unknown, max = 4096, nonempty = false): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (!nonempty || value.length > 0)
  );
}
function small(value: unknown): value is string {
  return text(value, 256, true);
}
function display(value: unknown): value is string {
  return (
    text(value, 1024, true) &&
    [...value].length <= 512 &&
    [...value].every(
      (character) =>
        character.codePointAt(0)! >= 32 && character.codePointAt(0) !== 127,
    ) &&
    value === value.trim()
  );
}
function integer(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  );
}
function pattern(value: unknown, rule: RegExp): value is string {
  return typeof value === "string" && rule.test(value);
}
function digest(value: unknown): value is string {
  return pattern(value, /^sha256:[0-9a-f]{64}$/u);
}
function identifier(value: unknown): value is string {
  return pattern(value, /^[a-z0-9][a-z0-9._:-]{2,127}$/u);
}
function symbol(value: unknown): value is string {
  return pattern(value, /^[A-Z0-9][A-Z0-9.-]{0,14}$/u);
}
function cik(value: unknown): value is string {
  return pattern(value, /^(?!0000000000)[0-9]{10}$/u);
}
function accession(value: unknown): value is string {
  return pattern(value, /^\d{10}-\d{2}-\d{6}$/u);
}
function member(value: unknown, values: readonly string[]): value is string {
  return typeof value === "string" && values.includes(value);
}
function nullable(value: unknown, check: (v: unknown) => boolean): boolean {
  return value === null || check(value);
}
function enumList(
  value: unknown,
  values: readonly string[],
): value is string[] {
  return (
    list(value, values.length) &&
    value.every((v) => member(v, values)) &&
    new Set(value).size === value.length
  );
}
function stringList(value: unknown, max: number): value is string[] {
  return (
    list(value, max) &&
    value.every((v) => text(v, 256, true)) &&
    new Set(value).size === value.length
  );
}
function numberList(
  value: unknown,
  max: number,
  high: number,
): value is number[] {
  return (
    list(value, max) &&
    value.every((v) => integer(v, 1, high)) &&
    new Set(value).size === value.length
  );
}
function refs(
  value: unknown,
  map: Map<string, unknown>,
  max: number,
): value is string[] {
  return stringList(value, max) && value.every((v) => map.has(v));
}
function fits(value: unknown, max: number): boolean {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= max;
  } catch {
    return false;
  }
}
function date(value: unknown): value is string {
  if (!pattern(value, /^[1-9][0-9]{3}-\d{2}-\d{2}$/u)) return false;
  const n = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value;
}
function clock(value: unknown): value is string {
  if (!pattern(value, /^[1-9][0-9]{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u))
    return false;
  const n = Date.parse(value);
  return Number.isFinite(n) && new Date(n).toISOString() === value;
}
function decimal(value: unknown): value is string {
  return (
    text(value, 64, true) &&
    /^(?:0|-?(?:[1-9]\d*(?:\.\d*[1-9])?|0\.\d*[1-9]))$/u.test(value)
  );
}
function named(row: R, name: string): boolean {
  return (row.name as R).localName === name;
}
function conceptName(
  name: { raw: string; localName: string | null },
  expected: string,
  issues: unknown,
): boolean {
  const local = name.localName ?? name.raw.split(":").at(-1) ?? "";
  return (
    local === expected ||
    (local.toLowerCase() === expected.toLowerCase() &&
      Array.isArray(issues) &&
      issues.includes("invalid_namespace"))
  );
}

function lastXmlOrdinal(row: R): number {
  let current = row;
  while ((current.children as R[]).length > 0)
    current = (current.children as R[]).at(-1)!;
  return current.elementOrdinal as number;
}

export function isPersonalSecQuarterEvidence(
  value: unknown,
): value is PersonalSecQuarterEvidenceDto {
  try {
    return evidence(value);
  } catch {
    return false;
  }
}
function evidence(value: unknown): value is PersonalSecQuarterEvidenceDto {
  if (
    !keys(value, ["schemaVersion", "submission", "companyFacts", "primary"]) ||
    value.schemaVersion !== "1.0.0" ||
    !companyFacts(value.companyFacts) ||
    !primary(value.primary) ||
    value.primary.status !== "complete" ||
    !fits(value, limits.finalResponseBytes)
  )
    return false;
  const s = value.submission;
  if (
    !keys(s, [
      "id",
      "sourceId",
      "rowIndex",
      "matchingRowIndices",
      "accessionNumber",
      "form",
      "filedDate",
      "reportDate",
      "acceptedAt",
      "primaryDocument",
    ]) ||
    s.id !== "submissions:selected" ||
    s.sourceId !== "submissions" ||
    !integer(s.rowIndex, 0, 9999) ||
    !list(s.matchingRowIndices, 10_000) ||
    s.matchingRowIndices.length === 0 ||
    !s.matchingRowIndices.every(
      (v, i, a) => integer(v, 0, 9999) && (i === 0 || v > (a[i - 1] as number)),
    ) ||
    s.matchingRowIndices[0] !== s.rowIndex ||
    s.form !== "10-Q" ||
    !accession(s.accessionNumber) ||
    !date(s.filedDate) ||
    !date(s.reportDate) ||
    !nullable(s.acceptedAt, sourceClock) ||
    !basename(s.primaryDocument)
  )
    return false;
  const p = value.primary;
  const cf = value.companyFacts;
  return (
    cf.cik === p.cik &&
    cf.accessionNumber === s.accessionNumber &&
    s.accessionNumber === p.selection.accessionNumber &&
    s.form === p.selection.form &&
    s.filedDate === p.selection.filedDate &&
    s.reportDate === p.selection.reportDate
  );
}

function companyFacts(value: unknown): value is R & {
  cik: string;
  accessionNumber: string;
  sourceSha256: string;
  occurrences: R[];
} {
  if (
    !keys(value, [
      "schemaVersion",
      "sourceSha256",
      "cik",
      "accessionNumber",
      "inspectedRows",
      "otherAccessionRows",
      "populations",
      "occurrences",
    ]) ||
    value.schemaVersion !== "1.0.0" ||
    !digest(value.sourceSha256) ||
    !cik(value.cik) ||
    !accession(value.accessionNumber) ||
    !integer(value.inspectedRows, 0, limits.companyFactsInspectedRows) ||
    !integer(value.otherAccessionRows, 0, value.inspectedRows) ||
    !list(value.populations, 4) ||
    value.populations.length !== 4 ||
    !list(value.occurrences, limits.companyFactsRowsTotal) ||
    !fits(value, limits.companyFactsProjectionBytes)
  )
    return false;
  const records = new Map<string, R>();
  for (const row of value.occurrences) {
    if (
      !keys(row, [
        "id",
        "concept",
        "sourceLocator",
        "unitKey",
        "unitIndex",
        "rowIndex",
        "accessionMembership",
        "accessionNumber",
        "startDate",
        "endDate",
        "form",
        "filedDate",
        "fiscalYear",
        "fiscalPeriod",
        "frame",
        "value",
        "rawFields",
        "nonObjectRow",
        "issues",
      ]) ||
      !member(row.concept, concepts) ||
      !text(row.unitKey) ||
      !integer(row.unitIndex, 0, limits.companyFactsInspectedRows) ||
      !integer(row.rowIndex, 0, limits.companyFactsInspectedRows - 1) ||
      row.id !==
        `cf:${concepts.indexOf(row.concept as (typeof concepts)[number])}:${row.unitIndex}:${row.rowIndex}` ||
      records.has(String(row.id)) ||
      row.sourceLocator !==
        `/facts/us-gaap/${row.concept}/units/${row.unitKey.replace(/~/gu, "~0").replace(/\//gu, "~1")}/${row.rowIndex}` ||
      !member(row.accessionMembership, ["selected", "potential"]) ||
      !nullable(row.accessionNumber, accession) ||
      !nullable(row.startDate, date) ||
      !nullable(row.endDate, date) ||
      !nullable(row.form, (v) => plain(v, 40)) ||
      !nullable(row.filedDate, date) ||
      !nullable(row.fiscalYear, (v) => integer(v, 1000, 9999)) ||
      !nullable(row.fiscalPeriod, (v) => plain(v, 32)) ||
      !nullable(row.frame, (v) => plain(v, 128)) ||
      !nullable(row.value, decimal) ||
      !list(row.rawFields, limits.companyFactsInspectedRows) ||
      !enumList(row.issues, cfIssues)
    )
      return false;
    const fields = new Map<string, R>();
    for (const field of row.rawFields) {
      if (
        !keys(field, ["name", "kind", "text"]) ||
        !text(field.name) ||
        fields.has(field.name) ||
        !sourceAtom(field)
      )
        return false;
      fields.set(field.name, field);
    }
    if (!(
      row.nonObjectRow === null ||
      (keys(row.nonObjectRow, ["kind", "text"]) &&
        sourceAtom(row.nonObjectRow) &&
        row.nonObjectRow.kind !== "object" &&
        fields.size === 0)
    ))
      return false;
    if (!cfNormalization(row, fields, value.accessionNumber)) return false;
    records.set(String(row.id), row);
  }
  const seen: string[] = [];
  let allInspected = 0;
  let allOther = 0;
  for (const [conceptIndex, population] of value.populations.entries()) {
    if (
      !keys(population, [
        "concept",
        "present",
        "units",
        "inspectedRows",
        "otherAccessionRows",
        "retainedIds",
      ]) ||
      population.concept !== concepts[conceptIndex] ||
      typeof population.present !== "boolean" ||
      !list(population.units, limits.companyFactsInspectedRows) ||
      !integer(population.inspectedRows, 0, limits.companyFactsInspectedRows) ||
      !integer(population.otherAccessionRows, 0, population.inspectedRows) ||
      !refs(population.retainedIds, records, limits.companyFactsRowsPerConcept)
    )
      return false;
    let inspected = 0;
    let other = 0;
    const unitNames = new Set<string>();
    const retained: string[] = [];
    for (const [unitIndex, unit] of population.units.entries()) {
      if (
        !keys(unit, [
          "unitKey",
          "inspectedRows",
          "otherAccessionRows",
          "retainedIds",
        ]) ||
        !text(unit.unitKey) ||
        unitNames.has(unit.unitKey) ||
        !integer(unit.inspectedRows, 0, limits.companyFactsInspectedRows) ||
        !integer(unit.otherAccessionRows, 0, unit.inspectedRows) ||
        !refs(unit.retainedIds, records, limits.companyFactsRowsPerConcept) ||
        unit.retainedIds.length + unit.otherAccessionRows !== unit.inspectedRows
      )
        return false;
      unitNames.add(unit.unitKey);
      let previous = -1;
      for (const id of unit.retainedIds) {
        const row = records.get(id)!;
        if (
          row.concept !== population.concept ||
          row.unitIndex !== unitIndex ||
          row.unitKey !== unit.unitKey ||
          (row.rowIndex as number) <= previous ||
          (row.rowIndex as number) >= unit.inspectedRows
        )
          return false;
        previous = row.rowIndex as number;
      }
      inspected += unit.inspectedRows;
      other += unit.otherAccessionRows;
      retained.push(...unit.retainedIds);
    }
    if (
      inspected !== population.inspectedRows ||
      other !== population.otherAccessionRows ||
      !equalStrings(retained, population.retainedIds) ||
      (!population.present &&
        (inspected !== 0 || population.units.length !== 0))
    )
      return false;
    allInspected += inspected;
    allOther += other;
    seen.push(...retained);
  }
  return (
    allInspected === value.inspectedRows &&
    allOther === value.otherAccessionRows &&
    seen.length === records.size &&
    new Set(seen).size === seen.length &&
    equalStrings(seen, [...records.keys()])
  );
}

function cfNormalization(
  row: R,
  fields: Map<string, R>,
  selected: string,
): boolean {
  const stringValue = (name: string) => {
    const f = fields.get(name);
    return f?.kind === "string" ? f.text : null;
  };
  const optional = (name: string, max: number) => {
    const f = fields.get(name);
    return f === undefined || f.kind === "null"
      ? null
      : f.kind === "string" && plain(f.text, max)
        ? f.text
        : undefined;
  };
  const rawAccession = stringValue("accn");
  const start = stringValue("start"),
    end = stringValue("end"),
    form = stringValue("form"),
    filed = stringValue("filed");
  const fy = fields.get("fy");
  const year =
    fy?.kind === "number" && pattern(fy.text, /^[1-9][0-9]{3}$/u)
      ? Number(fy.text)
      : null;
  const fp = optional("fp", 32),
    frame = optional("frame", 128);
  const val = fields.get("val");
  const normalized =
    val?.kind === "number" ? normalizedNumber(String(val.text)) : null;
  const expected: string[] = [];
  if (row.nonObjectRow !== null) expected.push("row_not_object");
  if (!fields.has("accn")) expected.push("missing_accession");
  else if (!accession(rawAccession)) expected.push("invalid_accession");
  if (!date(start)) expected.push("invalid_start_date");
  if (!date(end)) expected.push("invalid_end_date");
  if (date(start) && date(end) && start > end) expected.push("invalid_period");
  if (!plain(form, 40)) expected.push("invalid_form");
  if (!date(filed)) expected.push("invalid_filed_date");
  if (fy !== undefined && fy.kind !== "null" && year === null)
    expected.push("invalid_fiscal_year");
  if (fp === undefined) expected.push("invalid_fiscal_period");
  if (frame === undefined) expected.push("invalid_frame");
  if (normalized === null)
    expected.push(val?.kind === "number" ? "decimal_limit" : "invalid_numeric");
  if (!plain(row.unitKey, 256)) expected.push("invalid_unit_key");
  if (
    [...fields.keys()].some(
      (name) =>
        ![
          "start",
          "end",
          "val",
          "accn",
          "fy",
          "fp",
          "form",
          "filed",
          "frame",
        ].includes(name),
    )
  )
    expected.push("unsupported_row_fields");
  return (
    (rawAccession === null ||
      !accession(rawAccession) ||
      rawAccession === selected) &&
    row.accessionNumber === (accession(rawAccession) ? rawAccession : null) &&
    row.accessionMembership ===
      (rawAccession === selected ? "selected" : "potential") &&
    row.startDate === (date(start) ? start : null) &&
    row.endDate === (date(end) ? end : null) &&
    row.form === (plain(form, 40) ? form : null) &&
    row.filedDate === (date(filed) ? filed : null) &&
    row.fiscalYear === year &&
    row.fiscalPeriod === (fp ?? null) &&
    row.frame === (frame ?? null) &&
    row.value === normalized &&
    equalStrings(row.issues, expected)
  );
}
function sourceAtom(value: R): boolean {
  if (
    !member(value.kind, [
      "null",
      "boolean",
      "number",
      "string",
      "array",
      "object",
    ]) ||
    !text(value.text)
  )
    return false;
  if (value.kind === "string") return true;
  if (value.kind === "null") return value.text === "null";
  if (value.kind === "boolean")
    return value.text === "true" || value.text === "false";
  if (value.kind === "number")
    return /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u.test(value.text);
  try {
    assertPersonalSecJsonUniqueKeys(value.text);
    const decoded: unknown = JSON.parse(value.text);
    return value.kind === "array"
      ? Array.isArray(decoded)
      : decoded !== null &&
          typeof decoded === "object" &&
          !Array.isArray(decoded);
  } catch {
    return false;
  }
}
function normalizedNumber(value: string): string | null {
  if (value.length > 256) return null;
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/u.exec(value);
  if (!match) return null;
  const exponent = Number(match[4] ?? "0");
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10_000)
    return null;
  const raw = match[2]! + (match[3] ?? "");
  const leading = /^0*/u.exec(raw)![0].length;
  const digits = raw.slice(leading).replace(/0+$/u, "");
  if (!digits) return "0";
  const point = match[2]!.length + exponent - leading;
  const sign = match[1]!;
  const length =
    sign.length +
    (point <= 0
      ? 2 - point + digits.length
      : point >= digits.length
        ? point
        : digits.length + 1);
  if (length > 64) return null;
  return (
    sign +
    (point <= 0
      ? `0.${"0".repeat(-point)}${digits}`
      : point >= digits.length
        ? digits + "0".repeat(point - digits.length)
        : `${digits.slice(0, point)}.${digits.slice(point)}`)
  );
}

export function isPersonalSecQuarterAssessmentInput(
  value: unknown,
): value is PersonalSecQuarterAssessmentInputDto {
  try {
    if (
      !keys(value, ["cik", "selection", "sources", "evidence"]) ||
      !cik(value.cik) ||
      !isPersonalSecQuarterAssessmentSelection(value.selection) ||
      !evidence(value.evidence) ||
      !sourceList(value.sources, value.cik, value.selection, true)
    )
      return false;
    const e = value.evidence;
    const sources = value.sources;
    const p = e.primary;
    return (
      p.cik === value.cik &&
      sameSelection(p.selection, value.selection) &&
      p.documentSha256 === sources[2]!.sha256 &&
      p.documentBytes === sources[2]!.bytes &&
      e.companyFacts.sourceSha256 === sources[1]!.sha256 &&
      sources[2]!.sourceUrl ===
        primaryUrl(
          value.cik,
          value.selection.accessionNumber,
          e.submission.primaryDocument,
        )
    );
  } catch {
    return false;
  }
}
function sourceList(
  value: unknown,
  issuer: string,
  selection: PersonalSecQuarterAssessmentSelectionDto,
  complete: boolean,
): value is PersonalSecQuarterSourceDto[] {
  if (!list(value, 3) || (complete && value.length !== 3)) return false;
  let previous = "";
  for (const [index, row] of value.entries()) {
    if (
      !keys(row, [
        "id",
        "sourceUrl",
        "sha256",
        "bytes",
        "retrievalStartedAt",
        "retrievalCompletedAt",
      ]) ||
      row.id !== ["submissions", "company_facts", "primary"][index] ||
      !digest(row.sha256) ||
      !integer(
        row.bytes,
        1,
        index === 2 ? limits.primaryBytes : limits.companyFactsBytes,
      ) ||
      !clock(row.retrievalStartedAt) ||
      !clock(row.retrievalCompletedAt) ||
      row.retrievalCompletedAt < row.retrievalStartedAt ||
      row.retrievalStartedAt < previous
    )
      return false;
    previous = row.retrievalCompletedAt;
    if (
      index === 0 &&
      row.sourceUrl !== `https://data.sec.gov/submissions/CIK${issuer}.json`
    )
      return false;
    if (
      index === 1 &&
      row.sourceUrl !==
        `https://data.sec.gov/api/xbrl/companyfacts/CIK${issuer}.json`
    )
      return false;
    if (index === 2) {
      const prefix = primaryUrl(issuer, selection.accessionNumber, "");
      if (
        typeof row.sourceUrl !== "string" ||
        !row.sourceUrl.startsWith(prefix) ||
        !basename(row.sourceUrl.slice(prefix.length))
      )
        return false;
    }
  }
  return true;
}
function primaryUrl(issuer: string, accn: string, document: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${issuer.replace(/^0+/u, "")}/${accn.replace(/-/gu, "")}/${document}`;
}
function basename(value: unknown): value is string {
  return (
    text(value, 255, true) &&
    !value.includes("..") &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:htm|html|xhtml|xml)$/iu.test(value)
  );
}
function sourceClock(value: unknown): value is string {
  return (
    clock(value) ||
    (pattern(value, /^[1-9][0-9]{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u) &&
      clock(value.replace("Z", ".000Z")))
  );
}
function plain(value: unknown, max: number): value is string {
  return (
    text(value, max, true) &&
    /^[\x20-\x7e]+$/u.test(value) &&
    value === value.trim()
  );
}
function equalStrings(left: unknown, right: readonly string[]): boolean {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((v, i) => v === right[i])
  );
}
function sameSelection(
  a: PersonalSecQuarterAssessmentSelectionDto,
  b: PersonalSecQuarterAssessmentSelectionDto,
): boolean {
  return (
    a.accessionNumber === b.accessionNumber &&
    a.form === b.form &&
    a.filedDate === b.filedDate &&
    a.reportDate === b.reportDate
  );
}

export function isPersonalSecQuarterAnalysis(
  value: unknown,
  source: PersonalSecQuarterEvidenceDto,
): value is PersonalSecQuarterAnalysisDto {
  try {
    return evidence(source) && analysis(value, source);
  } catch {
    return false;
  }
}
function analysis(
  value: unknown,
  source: PersonalSecQuarterEvidenceDto,
): value is PersonalSecQuarterAnalysisDto {
  if (
    !keys(value, [
      "schemaVersion",
      "predicates",
      "witnesses",
      "concepts",
      "metrics",
      "pair",
      "ttm",
    ]) ||
    value.schemaVersion !== "1.0.0" ||
    !list(value.predicates, 4096) ||
    !list(value.witnesses, limits.primaryCandidatesTotal) ||
    !list(value.concepts, 4) ||
    value.concepts.length !== 4 ||
    !list(value.metrics, 2) ||
    value.metrics.length !== 2 ||
    !ttm(value.ttm) ||
    !fits(value, limits.finalResponseBytes)
  )
    return false;
  const p = source.primary;
  const elements = new Map(
    p.structure!.records.map((r) => [r.id, r as unknown as R]),
  );
  const facts = new Map(
    p.concepts.flatMap((c) => c.occurrences).map((r) => [r.id, r]),
  );
  const cf = new Map(source.companyFacts.occurrences.map((r) => [r.id, r]));
  const all = new Map<string, unknown>([
    ["submissions:selected", source.submission],
    ["p:document", p.structure!.document],
    ...elements,
    ...facts,
    ...cf,
    ...p.contexts.map((r) => [r.id, r] as const),
    ...p.units.map((r) => [r.id, r] as const),
    ...p.reportingMetadata!.observations.map((r) => [r.id, r] as const),
    ...p.structure!.supplementaryFacts.map((r) => [r.id, r] as const),
  ]);
  const predicates = new Map<string, R>();
  for (const row of value.predicates) {
    if (
      !keys(row, [
        "id",
        "profile",
        "version",
        "state",
        "evidenceIds",
        "reasons",
        "observed",
      ]) ||
      !small(row.id) ||
      predicates.has(row.id) ||
      typeof row.profile !== "string" ||
      !Object.hasOwn(profileKinds, row.profile) ||
      row.version !== "1.0.0" ||
      !member(row.state, ["supported", "unresolved", "contradicted"]) ||
      !refs(row.evidenceIds, all, limits.structuralRecords) ||
      !enumList(row.reasons, reasons)
    )
      return false;
    if (
      row.state === "supported"
        ? !empty(row.reasons) || empty(row.evidenceIds) || row.observed === null
        : empty(row.reasons)
    )
      return false;
    if (
      row.observed !== null &&
      !observed(row.observed, profileKinds[row.profile]!, all)
    )
      return false;
    if (
      row.state === "supported" &&
      row.profile === "static_source_path_v1" &&
      p.structure!.document.scripts.length !== 0
    )
      return false;
    predicates.set(row.id, row);
  }
  const witnesses = new Map<string, R>();
  for (const row of value.witnesses) {
    if (
      !keys(row, [
        "id",
        "primaryRef",
        "companyFactsRefs",
        "concept",
        "contextRef",
        "unitRef",
        "tableRef",
        "rowRef",
        "labelCellRefs",
        "numericCellRef",
        "adjacentCellRefs",
        "yearHeaderRefs",
        "durationHeaderRefs",
        "captionRefs",
        "scopeRefs",
        "visibilityRefs",
        "predicateIds",
        "period",
        "value",
        "display",
      ]) ||
      !small(row.id) ||
      witnesses.has(row.id) ||
      !member(row.concept, concepts) ||
      !period(row.period) ||
      !decimal(row.value) ||
      !refs(row.companyFactsRefs, cf, limits.companyFactsRowsTotal) ||
      empty(row.companyFactsRefs) ||
      !refs(row.predicateIds, predicates, 4096) ||
      empty(row.predicateIds) ||
      !row.predicateIds.every((id) => predicates.get(id)!.state === "supported")
    )
      return false;
    const fact = facts.get(String(row.primaryRef));
    if (
      !fact ||
      fact.concept.localName !== row.concept ||
      fact.value !== row.value ||
      fact.contextRecordId !== row.contextRef ||
      fact.unitRecordId !== row.unitRef ||
      fact.elementRecordId === null
    )
      return false;
    for (const key of ["tableRef", "rowRef", "numericCellRef"])
      if (!elements.has(String(row[key]))) return false;
    for (const key of [
      "labelCellRefs",
      "adjacentCellRefs",
      "yearHeaderRefs",
      "durationHeaderRefs",
      "captionRefs",
      "scopeRefs",
      "visibilityRefs",
    ])
      if (!refs(row[key], elements, limits.structuralRecords)) return false;
    if (
      empty(row.labelCellRefs) ||
      empty(row.yearHeaderRefs) ||
      empty(row.durationHeaderRefs) ||
      empty(row.visibilityRefs)
    )
      return false;
    const table = p.structure!.tables.find(
      (t) => t.tableRecordId === row.tableRef,
    );
    const geometry = table?.rows.find((r) => r.rowRecordId === row.rowRef);
    const cell = elements.get(String(row.numericCellRef))!;
    if (
      !table ||
      table.status !== "complete" ||
      !geometry ||
      !geometry.cells.some((c) => c.cellRecordId === row.numericCellRef) ||
      fact.elementOrdinal < (cell.elementOrdinal as number) ||
      fact.elementOrdinal > (cell.endElementOrdinal as number)
    )
      return false;
    for (const id of row.companyFactsRefs) {
      const f = cf.get(id)!;
      if (
        f.concept !== row.concept ||
        f.unitKey !== "USD" ||
        f.value !== row.value ||
        f.startDate !== row.period.startDate ||
        f.endDate !== row.period.endDate ||
        f.accessionMembership !== "selected" ||
        f.issues.length !== 0
      )
        return false;
    }
    if (
      !keys(row.display, ["text", "scalePower10", "signConvention"]) ||
      !text(row.display.text) ||
      ![0, 3, 6].includes(row.display.scalePower10 as number) ||
      !member(row.display.signConvention, ["unsigned", "minus", "parentheses"])
    )
      return false;
    if (!witnessPredicateJoins(row, predicates, source)) return false;
    witnesses.set(row.id, row);
  }
  const decisions: R[] = [];
  for (const [index, row] of value.concepts.entries()) {
    if (
      !keys(row, [
        "concept",
        "status",
        "reasons",
        "companyFactsRefs",
        "primaryRefs",
        "memberships",
        "predicateIds",
        "witnessIds",
      ]) ||
      row.concept !== concepts[index] ||
      !member(row.status, [
        "absent",
        "held",
        "conflicted",
        "supported_as_filed",
      ]) ||
      !enumList(row.reasons, reasons) ||
      !equalStrings(
        row.companyFactsRefs,
        source.companyFacts.populations[index]!.retainedIds,
      ) ||
      !equalStrings(
        row.primaryRefs,
        p.concepts[index]!.occurrences.map((f) => f.id),
      ) ||
      !refs(row.predicateIds, predicates, 4096) ||
      !refs(row.witnessIds, witnesses, limits.primaryCandidatesTotal) ||
      !list(
        row.memberships,
        limits.primaryCandidatesPerConcept + limits.companyFactsRowsPerConcept,
      )
    )
      return false;
    const expected = new Set([
      ...(row.companyFactsRefs as string[]),
      ...(row.primaryRefs as string[]),
    ]);
    for (const disposition of row.memberships) {
      if (
        !keys(disposition, [
          "reference",
          "source",
          "disposition",
          "reason",
          "evidenceIds",
        ]) ||
        !small(disposition.reference) ||
        !expected.delete(disposition.reference) ||
        disposition.source !==
          (cf.has(disposition.reference) ? "company_facts" : "primary") ||
        !member(disposition.disposition, [
          "possible_current",
          "excluded",
          "unresolved",
        ]) ||
        !member(disposition.reason, [
          "current_period",
          "other_period",
          "other_entity",
          "dimensioned_scope",
          "membership_unresolved",
        ]) ||
        !refs(disposition.evidenceIds, all, limits.structuralRecords)
      )
        return false;
      if (
        (disposition.disposition === "possible_current" &&
          disposition.reason !== "current_period") ||
        (disposition.disposition === "unresolved" &&
          disposition.reason !== "membership_unresolved") ||
        (disposition.disposition === "excluded" &&
          !member(disposition.reason, [
            "other_period",
            "other_entity",
            "dimensioned_scope",
          ]))
      )
        return false;
    }
    if (
      expected.size !== 0 ||
      (row.status === "supported_as_filed"
        ? !empty(row.reasons) || empty(row.witnessIds)
        : empty(row.reasons))
    )
      return false;
    for (const id of row.witnessIds)
      if (witnesses.get(id)!.concept !== row.concept) return false;
    decisions.push(row);
  }
  for (const [index, metric] of value.metrics.entries()) {
    if (
      !keys(metric, [
        "metric",
        "status",
        "reasons",
        "concept",
        "witnessIds",
        "value",
        "unit",
        "period",
      ]) ||
      metric.metric !== ["revenue", "net_income"][index] ||
      !member(metric.status, ["held", "conflicted", "supported_as_filed"]) ||
      !enumList(metric.reasons, reasons) ||
      !refs(metric.witnessIds, witnesses, limits.primaryCandidatesTotal) ||
      !nullable(metric.concept, (v) => member(v, concepts)) ||
      (metric.concept !== null &&
        (index === 1
          ? metric.concept !== "NetIncomeLoss"
          : metric.concept === "NetIncomeLoss"))
    )
      return false;
    if (metric.status !== "supported_as_filed") {
      if (
        metric.value !== null ||
        metric.unit !== null ||
        metric.period !== null ||
        empty(metric.reasons)
      )
        return false;
      continue;
    }
    if (
      !decimal(metric.value) ||
      metric.unit !== "USD" ||
      !period(metric.period) ||
      !empty(metric.reasons) ||
      empty(metric.witnessIds)
    )
      return false;
    const decision = decisions.find((c) => c.concept === metric.concept);
    if (
      !decision ||
      decision.status !== "supported_as_filed" ||
      !equalStrings(metric.witnessIds, decision.witnessIds as string[])
    )
      return false;
    const covered = new Set<string>();
    for (const id of metric.witnessIds) {
      const witness = witnesses.get(id)!;
      if (
        witness.concept !== metric.concept ||
        witness.value !== metric.value ||
        !samePeriod(witness.period, metric.period)
      )
        return false;
      for (const f of witness.companyFactsRefs as string[]) covered.add(f);
    }
    const current = (decision.memberships as R[])
      .filter(
        (m) =>
          m.source === "company_facts" && m.disposition === "possible_current",
      )
      .map((m) => m.reference as string);
    if (current.length === 0 || current.some((ref) => !covered.has(ref)))
      return false;
    if (
      (decision.memberships as R[]).some((m) => m.disposition === "unresolved")
    )
      return false;
  }
  const pair = value.pair;
  if (
    !keys(pair, [
      "status",
      "reasons",
      "revenue",
      "netIncome",
      "unit",
      "period",
    ]) ||
    !member(pair.status, ["held", "conflicted", "supported_as_filed"]) ||
    !enumList(pair.reasons, reasons)
  )
    return false;
  const revenue = value.metrics[0] as R,
    income = value.metrics[1] as R;
  if (pair.status === "supported_as_filed")
    return (
      revenue.status === "supported_as_filed" &&
      income.status === "supported_as_filed" &&
      samePeriod(revenue.period, income.period) &&
      samePeriod(pair.period, revenue.period) &&
      pair.revenue === revenue.value &&
      pair.netIncome === income.value &&
      pair.unit === "USD" &&
      empty(pair.reasons)
    );
  return (
    pair.revenue === null &&
    pair.netIncome === null &&
    pair.unit === null &&
    pair.period === null &&
    !empty(pair.reasons)
  );
}

/** Cross-field proof joins; source grammar remains the semantic engine's job. */
function witnessPredicateJoins(
  witness: R,
  predicates: Map<string, R>,
  source: PersonalSecQuarterEvidenceDto,
): boolean {
  const linked = (witness.predicateIds as string[]).map((id) =>
    predicates.get(id)!,
  );
  const one = (profiles: readonly string[]): R | null => {
    const matches = linked.filter((p) =>
      profiles.includes(p.profile as string),
    );
    return matches.length === 1 ? matches[0]! : null;
  };
  const identity = one(["report_identity_v1"]);
  const calendar = one([
    "calendar_direct_boundary_v1",
    "calendar_fiscal_ytd_roles_v1",
  ]);
  const statement = one(["principal_statement_v1"]);
  const column = one(["standalone_column_v1"]);
  const scope = one(
    witness.concept === "NetIncomeLoss"
      ? ["parent_income_explicit_v1", "parent_income_wholly_owned_v1"]
      : ["whole_revenue_v1"],
  );
  const display = one(["signed_usd_display_v1"]);
  const visibility = one(["static_source_path_v1"]);
  if (
    linked.length !== 7 ||
    !identity ||
    !calendar ||
    !statement ||
    !column ||
    !scope ||
    !display ||
    !visibility
  )
    return false;
  const identityObserved = identity.observed as R;
  const calendarObserved = calendar.observed as R;
  const statementObserved = statement.observed as R;
  const columnObserved = column.observed as R;
  const scopeObserved = scope.observed as R;
  const displayObserved = display.observed as R;
  const visibilityObserved = visibility.observed as R;
  const periodValue = witness.period as R;
  const displayValue = witness.display as R;
  const sameRefs = (value: unknown, key: string): boolean =>
    equalStrings(value, witness[key] as string[]);
  if (
    identityObserved.form !== source.submission.form ||
    identityObserved.reportDate !== source.submission.reportDate ||
    calendarObserved.quarterStart !== periodValue.startDate ||
    calendarObserved.quarterEnd !== periodValue.endDate ||
    calendarObserved.quarterEnd !== identityObserved.reportDate ||
    calendarObserved.slot !== identityObserved.fiscalQuarter ||
    calendarObserved.yearLabel !== identityObserved.fiscalYear ||
    statementObserved.tableRef !== witness.tableRef ||
    empty(statementObserved.headingRefs) ||
    empty(statementObserved.sectionRefs) ||
    columnObserved.numericCellRef !== witness.numericCellRef ||
    !sameRefs(columnObserved.yearHeaderRefs, "yearHeaderRefs") ||
    !sameRefs(columnObserved.durationHeaderRefs, "durationHeaderRefs") ||
    !sameRefs(columnObserved.adjacentCellRefs, "adjacentCellRefs") ||
    scopeObserved.rowRef !== witness.rowRef ||
    !sameRefs(scopeObserved.labelCellRefs, "labelCellRefs") ||
    !sameRefs(scopeObserved.scopeRefs, "scopeRefs") ||
    scopeObserved.attribution !==
      (scope.profile === "whole_revenue_v1"
        ? "whole_revenue"
        : scope.profile === "parent_income_explicit_v1"
          ? "parent_explicit"
          : "wholly_owned") ||
    displayObserved.numericCellRef !== witness.numericCellRef ||
    displayObserved.unitRef !== witness.unitRef ||
    !sameRefs(displayObserved.adjacentCellRefs, "adjacentCellRefs") ||
    !sameRefs(displayObserved.captionRefs, "captionRefs") ||
    displayObserved.text !== displayValue.text ||
    displayObserved.scalePower10 !== displayValue.scalePower10 ||
    displayObserved.value !== witness.value ||
    !sameRefs(visibilityObserved.pathRefs, "visibilityRefs") ||
    !empty(visibilityObserved.uninterpretedScriptRefs)
  )
    return false;
  const contextIds = new Set(source.primary.contexts.map((c) => c.id));
  if (calendar.profile === "calendar_direct_boundary_v1") {
    if (
      calendarObserved.openingCashContextRef !== null ||
      calendarObserved.closingCashContextRef !== null
    )
      return false;
  } else if (
    !contextIds.has(String(calendarObserved.openingCashContextRef)) ||
    !contextIds.has(String(calendarObserved.closingCashContextRef))
  )
    return false;
  const required = [
    [
      statement,
      [
        witness.tableRef,
        ...(statementObserved.headingRefs as string[]),
        ...(statementObserved.consolidationRefs as string[]),
        ...(statementObserved.sectionRefs as string[]),
      ],
    ],
    [
      column,
      [
        witness.numericCellRef,
        ...(witness.yearHeaderRefs as string[]),
        ...(witness.durationHeaderRefs as string[]),
        ...(witness.adjacentCellRefs as string[]),
      ],
    ],
    [
      scope,
      [
        witness.rowRef,
        ...(witness.labelCellRefs as string[]),
        ...(witness.scopeRefs as string[]),
      ],
    ],
    [
      display,
      [
        witness.primaryRef,
        witness.numericCellRef,
        witness.unitRef,
        ...(witness.adjacentCellRefs as string[]),
        ...(witness.captionRefs as string[]),
      ],
    ],
    [
      visibility,
      [
        "p:document",
        witness.numericCellRef,
        witness.rowRef,
        ...(witness.labelCellRefs as string[]),
        ...(witness.yearHeaderRefs as string[]),
        ...(witness.durationHeaderRefs as string[]),
        ...(witness.adjacentCellRefs as string[]),
        ...(witness.captionRefs as string[]),
        ...(witness.scopeRefs as string[]),
      ],
    ],
  ] as const;
  return required.every(([predicate, ids]) =>
    ids.every((id) => (predicate.evidenceIds as unknown[]).includes(id)),
  );
}

function observed(
  value: unknown,
  kind: string,
  all: Map<string, unknown>,
): boolean {
  if (!value || typeof value !== "object" || (value as R).kind !== kind)
    return false;
  const v = value as R;
  const ids = (key: string) => refs(v[key], all, limits.structuralRecords);
  const id = (key: string) => typeof v[key] === "string" && all.has(v[key]);
  switch (kind) {
    case "identity":
      return (
        keys(v, [
          "kind",
          "form",
          "reportDate",
          "fiscalYear",
          "fiscalQuarter",
        ]) &&
        v.form === "10-Q" &&
        date(v.reportDate) &&
        integer(v.fiscalYear, 1000, 9999) &&
        integer(v.fiscalQuarter, 1, 3)
      );
    case "calendar":
      return (
        keys(v, [
          "kind",
          "fiscalYearStart",
          "fiscalYearEnd",
          "quarterStart",
          "quarterEnd",
          "slot",
          "yearLabel",
          "openingCashContextRef",
          "closingCashContextRef",
        ]) &&
        [
          v.fiscalYearStart,
          v.fiscalYearEnd,
          v.quarterStart,
          v.quarterEnd,
        ].every(date) &&
        integer(v.slot, 1, 3) &&
        integer(v.yearLabel, 1000, 9999) &&
        (v.openingCashContextRef === null || id("openingCashContextRef")) &&
        (v.closingCashContextRef === null || id("closingCashContextRef"))
      );
    case "statement":
      return (
        keys(v, [
          "kind",
          "tableRef",
          "headingRefs",
          "consolidationRefs",
          "sectionRefs",
        ]) &&
        id("tableRef") &&
        ids("headingRefs") &&
        ids("consolidationRefs") &&
        ids("sectionRefs")
      );
    case "column":
      return (
        keys(v, [
          "kind",
          "numericCellRef",
          "yearHeaderRefs",
          "durationHeaderRefs",
          "adjacentCellRefs",
        ]) &&
        id("numericCellRef") &&
        ids("yearHeaderRefs") &&
        ids("durationHeaderRefs") &&
        ids("adjacentCellRefs")
      );
    case "scope":
      return (
        keys(v, [
          "kind",
          "rowRef",
          "labelCellRefs",
          "scopeRefs",
          "attribution",
        ]) &&
        id("rowRef") &&
        ids("labelCellRefs") &&
        ids("scopeRefs") &&
        member(v.attribution, [
          "whole_revenue",
          "parent_explicit",
          "wholly_owned",
        ])
      );
    case "display":
      return (
        keys(v, [
          "kind",
          "numericCellRef",
          "adjacentCellRefs",
          "unitRef",
          "captionRefs",
          "text",
          "scalePower10",
          "value",
        ]) &&
        id("numericCellRef") &&
        ids("adjacentCellRefs") &&
        id("unitRef") &&
        ids("captionRefs") &&
        text(v.text) &&
        [0, 3, 6].includes(v.scalePower10 as number) &&
        decimal(v.value)
      );
    case "static":
      return (
        keys(v, [
          "kind",
          "pathRefs",
          "documentProfileRef",
          "uninterpretedScriptRefs",
          "sourceInterpretation",
        ]) &&
        ids("pathRefs") &&
        v.documentProfileRef === "p:document" &&
        ids("uninterpretedScriptRefs") &&
        v.sourceInterpretation === "static_markup_only"
      );
    default:
      return false;
  }
}
function period(
  value: unknown,
): value is R & { startDate: string; endDate: string } {
  return (
    keys(value, ["startDate", "endDate"]) &&
    date(value.startDate) &&
    date(value.endDate) &&
    value.startDate <= value.endDate
  );
}
function samePeriod(a: unknown, b: unknown): boolean {
  return (
    period(a) &&
    period(b) &&
    a.startDate === b.startDate &&
    a.endDate === b.endDate
  );
}
function ttm(value: unknown): boolean {
  return (
    keys(value, ["status", "reason"]) &&
    value.status === "unavailable" &&
    value.reason === "source_not_admitted"
  );
}

export function isPersonalSecQuarterAssessmentResponse(
  value: unknown,
  request: PersonalSecQuarterAssessmentRequestDto,
): value is PersonalSecQuarterAssessmentResponseDto {
  try {
    if (
      !isPersonalSecQuarterAssessmentRequest(request) ||
      !keys(value, [
        "schemaVersion",
        "catalogSnapshotSha256",
        "security",
        "assessment",
      ]) ||
      value.schemaVersion !== "1.0.0" ||
      value.catalogSnapshotSha256 !== request.catalogSnapshotSha256 ||
      !isPersonalSecQuarterAssessmentTarget({
        catalogSnapshotSha256: value.catalogSnapshotSha256,
        security: value.security,
      }) ||
      !fits(value, limits.finalResponseBytes)
    )
      return false;
    const target = {
      catalogSnapshotSha256: value.catalogSnapshotSha256,
      security: value.security,
    } as PersonalSecQuarterAssessmentTargetDto;
    if (
      target.security.listingId !== request.listingId ||
      target.security.symbol !== request.symbol
    )
      return false;
    const a = value.assessment;
    if (a === null || typeof a !== "object" || Array.isArray(a)) return false;
    const row = a as R;
    if (
      row.cik !== target.security.cik ||
      !isPersonalSecQuarterAssessmentSelection(row.selection) ||
      !sameSelection(row.selection, request.selection) ||
      !sourceList(
        row.sources,
        target.security.cik,
        request.selection,
        row.stage === "assessment",
      )
    )
      return false;
    if (row.status === "unavailable")
      return (
        keys(row, [
          "status",
          "cik",
          "selection",
          "stage",
          "reason",
          "sources",
        ]) &&
        member(row.stage, [
          "submissions",
          "company_facts",
          "document",
          "parser",
          "assembly",
        ]) &&
        member(row.reason, acquisitionReasons)
      );
    if (row.stage === "selection")
      return (
        keys(row, [
          "status",
          "cik",
          "selection",
          "stage",
          "reason",
          "sources",
        ]) &&
        row.status === "held" &&
        ((row.reason === "unsupported_amendment" &&
          request.selection.form === "10-Q/A") ||
          (row.reason === "report_date_unresolved" &&
            request.selection.reportDate === null))
      );
    if (
      !keys(row, [
        "status",
        "cik",
        "selection",
        "stage",
        "acceptedAt",
        "bundleId",
        "sources",
        "evidence",
        "analysis",
      ]) ||
      row.stage !== "assessment" ||
      !member(row.status, ["held", "conflicted", "supported_as_filed"]) ||
      !clock(row.acceptedAt) ||
      !digest(row.bundleId) ||
      !isPersonalSecQuarterAssessmentInput({
        cik: row.cik,
        selection: row.selection,
        sources: row.sources,
        evidence: row.evidence,
      }) ||
      !isPersonalSecQuarterAnalysis(
        row.analysis,
        row.evidence as PersonalSecQuarterEvidenceDto,
      )
    )
      return false;
    return (
      row.status === row.analysis.pair.status &&
      row.acceptedAt >= row.sources[2]!.retrievalCompletedAt
    );
  } catch {
    return false;
  }
}
