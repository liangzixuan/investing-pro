import { createHash } from "node:crypto";
import {
  PERSONAL_SEC_QUARTERLY_CONCEPTS,
  PERSONAL_SEC_QUARTER_ASSESSMENT_LIMITS as limits,
  type CompanyFactsIssue,
  type PersonalSecQuarterCompanyFactDto,
  type PersonalSecQuarterCompanyFactsDto,
  type PersonalSecQuarterCompanyFactsPopulationDto,
  type PersonalSecQuarterSourceFieldDto,
  type PersonalSecQuarterlyConcept,
} from "@research-cockpit/contracts";
import {
  decodePersonalSecSourceUtf8,
  normalizePersonalSecSourceDecimal,
  personalSecSourceNumberLexeme,
} from "./personal-sec-quarterly-evidence-provider";
import {
  parsePersonalSecSourceJsonStrict,
  PersonalSecQuarterSourceProjectionError,
} from "./personal-sec-source-json";

export { PersonalSecQuarterSourceProjectionError } from "./personal-sec-source-json";

export function projectPersonalSecQuarterCompanyFacts(
  rawBytes: Uint8Array,
  cik: string,
  accessionNumber: string,
): PersonalSecQuarterCompanyFactsDto {
  if (
    !(rawBytes instanceof Uint8Array) ||
    !/^(?!0000000000)[0-9]{10}$/u.test(cik) ||
    !accession(accessionNumber)
  )
    fail("invalid_response");
  if (rawBytes.byteLength > limits.companyFactsBytes)
    fail("response_too_large");
  const bytes = Uint8Array.from(rawBytes);
  let text: string;
  try {
    text = decodePersonalSecSourceUtf8(bytes);
  } catch {
    return fail("invalid_response");
  }
  const document = parsePersonalSecSourceJsonStrict(text);
  if (!record(document) || !record(document.facts))
    fail("company_facts_structure_invalid");
  const sourceCik = personalSecSourceNumberLexeme(document.cik) ?? document.cik;
  if (
    typeof sourceCik !== "string" ||
    !/^\d{1,10}$/u.test(sourceCik) ||
    sourceCik.padStart(10, "0") !== cik
  )
    fail("company_facts_structure_invalid");
  const taxonomy = document.facts["us-gaap"];
  if (taxonomy !== undefined && !record(taxonomy))
    fail("company_facts_structure_invalid");
  const occurrences: PersonalSecQuarterCompanyFactDto[] = [];
  const populations: PersonalSecQuarterCompanyFactsPopulationDto[] = [];
  let inspectedRows = 0;
  let otherAccessionRows = 0;
  for (const [
    conceptIndex,
    concept,
  ] of PERSONAL_SEC_QUARTERLY_CONCEPTS.entries()) {
    const entry: unknown = record(taxonomy) ? taxonomy[concept] : undefined;
    const units: PersonalSecQuarterCompanyFactsPopulationDto["units"][number][] =
      [];
    const retainedIds: string[] = [];
    let conceptInspected = 0;
    let conceptOther = 0;
    if (entry !== undefined) {
      if (!record(entry) || !record(entry.units))
        fail("company_facts_structure_invalid");
      for (const [unitIndex, [unitKey, rows]] of Object.entries(
        entry.units,
      ).entries()) {
        if (!Array.isArray(rows)) fail("company_facts_structure_invalid");
        inspectedRows += rows.length;
        conceptInspected += rows.length;
        if (inspectedRows > limits.companyFactsInspectedRows)
          fail("candidate_limit");
        const unitIds: string[] = [];
        let unitOther = 0;
        for (const [rowIndex, raw] of rows.entries()) {
          if (
            record(raw) &&
            accession(raw.accn) &&
            raw.accn !== accessionNumber
          ) {
            unitOther += 1;
            continue;
          }
          if (
            retainedIds.length >= limits.companyFactsRowsPerConcept ||
            occurrences.length >= limits.companyFactsRowsTotal
          )
            fail("candidate_limit");
          const row = projectRow(
            raw,
            concept,
            conceptIndex,
            unitKey,
            unitIndex,
            rowIndex,
            accessionNumber,
          );
          occurrences.push(row);
          retainedIds.push(row.id);
          unitIds.push(row.id);
        }
        conceptOther += unitOther;
        units.push({
          unitKey,
          inspectedRows: rows.length,
          otherAccessionRows: unitOther,
          retainedIds: unitIds,
        });
      }
    }
    otherAccessionRows += conceptOther;
    populations.push({
      concept,
      present: entry !== undefined,
      units,
      inspectedRows: conceptInspected,
      otherAccessionRows: conceptOther,
      retainedIds,
    });
  }
  const result: PersonalSecQuarterCompanyFactsDto = {
    schemaVersion: "1.0.0",
    sourceSha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    cik,
    accessionNumber,
    inspectedRows,
    otherAccessionRows,
    populations,
    occurrences,
  };
  if (
    Buffer.byteLength(JSON.stringify(result), "utf8") >
    limits.companyFactsProjectionBytes
  )
    fail("company_facts_projection_limit");
  return freeze(result);
}

function projectRow(
  raw: unknown,
  concept: PersonalSecQuarterlyConcept,
  conceptIndex: number,
  unitKey: string,
  unitIndex: number,
  rowIndex: number,
  selected: string,
): PersonalSecQuarterCompanyFactDto {
  const fields = record(raw)
    ? Object.entries(raw).map(([name, value]) => ({
        name,
        ...sourceValue(value),
      }))
    : [];
  for (const field of fields)
    if (field.name.length > limits.recordTextCharacters)
      fail("company_facts_field_limit");
  if (unitKey.length > limits.recordTextCharacters)
    fail("company_facts_field_limit");
  const value = record(raw) ? raw : {};
  const issues: CompanyFactsIssue[] = [];
  if (!record(raw)) issues.push("row_not_object");
  if (!Object.hasOwn(value, "accn")) issues.push("missing_accession");
  else if (!accession(value.accn)) issues.push("invalid_accession");
  if (!date(value.start)) issues.push("invalid_start_date");
  if (!date(value.end)) issues.push("invalid_end_date");
  if (date(value.start) && date(value.end) && value.start > value.end)
    issues.push("invalid_period");
  if (!plain(value.form, 40)) issues.push("invalid_form");
  if (!date(value.filed)) issues.push("invalid_filed_date");
  const fiscalYearRaw = personalSecSourceNumberLexeme(value.fy);
  const fiscalYear =
    fiscalYearRaw !== null && /^[1-9][0-9]{3}$/u.test(fiscalYearRaw)
      ? Number(fiscalYearRaw)
      : null;
  if (value.fy !== null && value.fy !== undefined && fiscalYear === null)
    issues.push("invalid_fiscal_year");
  const fiscalPeriod = optionalText(value.fp, 32);
  if (fiscalPeriod === undefined) issues.push("invalid_fiscal_period");
  const frame = optionalText(value.frame, 128);
  if (frame === undefined) issues.push("invalid_frame");
  const normalized = normalizePersonalSecSourceDecimal(value.val);
  if (normalized === null)
    issues.push(
      personalSecSourceNumberLexeme(value.val) === null
        ? "invalid_numeric"
        : "decimal_limit",
    );
  if (!plain(unitKey, 256)) issues.push("invalid_unit_key");
  const allowed = new Set([
    "start",
    "end",
    "val",
    "accn",
    "fy",
    "fp",
    "form",
    "filed",
    "frame",
  ]);
  if (fields.some((field) => !allowed.has(field.name)))
    issues.push("unsupported_row_fields");
  return {
    id: `cf:${conceptIndex}:${unitIndex}:${rowIndex}`,
    concept,
    sourceLocator: `/facts/us-gaap/${concept}/units/${unitKey.replace(/~/gu, "~0").replace(/\//gu, "~1")}/${rowIndex}`,
    unitKey,
    unitIndex,
    rowIndex,
    accessionMembership: value.accn === selected ? "selected" : "potential",
    accessionNumber: accession(value.accn) ? value.accn : null,
    startDate: date(value.start) ? value.start : null,
    endDate: date(value.end) ? value.end : null,
    form: plain(value.form, 40) ? value.form : null,
    filedDate: date(value.filed) ? value.filed : null,
    fiscalYear,
    fiscalPeriod: fiscalPeriod ?? null,
    frame: frame ?? null,
    value: normalized,
    rawFields: fields,
    nonObjectRow: record(raw)
      ? null
      : (sourceValue(raw) as PersonalSecQuarterCompanyFactDto["nonObjectRow"]),
    issues,
  };
}

function sourceValue(
  value: unknown,
): Omit<PersonalSecQuarterSourceFieldDto, "name"> {
  const lexeme = personalSecSourceNumberLexeme(value);
  const kind =
    lexeme !== null
      ? "number"
      : value === null
        ? "null"
        : Array.isArray(value)
          ? "array"
          : typeof value === "string"
            ? "string"
            : typeof value === "boolean"
              ? "boolean"
              : "object";
  const text =
    lexeme ?? (typeof value === "string" ? value : losslessJson(value));
  if (text.length > limits.recordTextCharacters)
    fail("company_facts_field_limit");
  return { kind, text };
}

function losslessJson(value: unknown): string {
  const number = personalSecSourceNumberLexeme(value);
  if (number !== null) return number;
  if (Array.isArray(value)) return `[${value.map(losslessJson).join(",")}]`;
  if (record(value))
    return `{${Object.entries(value)
      .map(([key, child]) => `${JSON.stringify(key)}:${losslessJson(child)}`)
      .join(",")}}`;
  const result = JSON.stringify(value);
  if (result === undefined) return fail("invalid_response");
  return result;
}

function record(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    personalSecSourceNumberLexeme(value) === null
  );
}
function accession(value: unknown): value is string {
  return typeof value === "string" && /^\d{10}-\d{2}-\d{6}$/u.test(value);
}
function date(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-9][0-9]{3}-\d{2}-\d{2}$/u.test(value))
    return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}
function plain(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    value === value.trim() &&
    /^[\x20-\x7e]+$/u.test(value)
  );
}
function optionalText(value: unknown, max: number): string | null | undefined {
  return value === null || value === undefined
    ? null
    : plain(value, max)
      ? value
      : undefined;
}
function fail(
  code: ConstructorParameters<
    typeof PersonalSecQuarterSourceProjectionError
  >[0],
): never {
  throw new PersonalSecQuarterSourceProjectionError(code);
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
