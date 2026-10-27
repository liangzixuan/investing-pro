import {
  normalizeWatchlistNote,
  PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY as registry,
  type PersonalSecInterimCanonicalResponseDto,
  type PersonalSecInterimStatementConcept,
  type PersonalSecInterimStatementCellDto,
} from "@research-cockpit/contracts";
import { resolvePersonalSecInterimStatements } from "@research-cockpit/personal-financial-analytics";
import { isOwnedSecInterimCanonicalResponse } from "../lib/sec-interim-canonical-response";
export interface ManagedInterimCellSelection {
  readonly concept: PersonalSecInterimStatementConcept;
  readonly periodKey: string;
}
export interface ManagedInterimNoteCell extends ManagedInterimCellSelection {
  readonly value: string;
  readonly period: PersonalSecInterimStatementCellDto["period"];
  readonly observationIds: readonly `sec-interim-fact:${string}`[];
  readonly qualification: string;
}
export interface PreparedManagedInterimStatementsNote {
  readonly note: string;
  readonly excerpt: string;
  readonly selection: readonly ManagedInterimNoteCell[];
  readonly generationSha256: `sha256:${string}`;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listingId: string;
  readonly showingPrevious: boolean;
}
export interface ManagedInterimNoteCapture {
  readonly response: PersonalSecInterimCanonicalResponseDto;
  readonly selection: readonly ManagedInterimCellSelection[];
  readonly note: string;
  readonly showingPrevious: boolean;
  readonly isCurrent: () => boolean;
  readonly apply: (note: string) => void;
}
export interface ManagedInterimNotePreparation {
  readonly preview: PreparedManagedInterimStatementsNote | null;
  readonly reason: string | null;
}
interface Capability {
  readonly current: () => boolean;
  readonly apply: (note: string) => void;
}
const previews = new WeakMap<
  PreparedManagedInterimStatementsNote,
  Capability
>();
const stale =
  "The interim report, selected periods, note or company visit changed. Preview the whole note again.";
const invalid =
  "Choose available exact reported cells, with no duplicate or unknown periods.";
function safelyCurrent(current: () => boolean) {
  try {
    return current();
  } catch {
    return false;
  }
}
function validNote(note: string) {
  return (
    [...note].length <= 2000 &&
    !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(note) &&
    normalizeWatchlistNote(note) !== null
  );
}
function plainSelection(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
function dataProperty(value: object, key: string) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
    return null;
  return { value: descriptor.value as unknown };
}
function registeredConcept(
  value: unknown,
): value is PersonalSecInterimStatementConcept {
  return (
    typeof value === "string" && registry.some((row) => row.concept === value)
  );
}
function selectionCount(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return false;
  return value >= 1 && value <= 3200;
}
function selectionItem(value: unknown): ManagedInterimCellSelection | null {
  if (!plainSelection(value)) return null;
  if (Reflect.ownKeys(value).length !== 2) return null;
  const concept = dataProperty(value, "concept")?.value,
    key = dataProperty(value, "periodKey")?.value;
  if (!registeredConcept(concept)) return null;
  if (typeof key !== "string" || key.length > 4096) return null;
  return Object.freeze({
    concept,
    periodKey: key,
  });
}
function selectionLength(value: unknown) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
    return null;
  const count = Object.getOwnPropertyDescriptor(value, "length")
    ?.value as unknown;
  if (!selectionCount(count)) return null;
  return Reflect.ownKeys(value).length === count + 1 ? count : null;
}
function copySelection(
  value: unknown,
): readonly ManagedInterimCellSelection[] | null {
  const count = selectionLength(value);
  if (count === null) return null;
  const rows: ManagedInterimCellSelection[] = [],
    seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const row = selectionItem(dataProperty(value as object, String(i))?.value);
    if (!row) return null;
    const key = JSON.stringify([row.concept, row.periodKey]);
    if (seen.has(key)) return null;
    seen.add(key);
    rows.push(row);
  }
  return Object.freeze(rows);
}
function selectedCells(
  response: PersonalSecInterimCanonicalResponseDto,
  keys: readonly ManagedInterimCellSelection[],
) {
  const rows = resolvePersonalSecInterimStatements(
    response.evidence,
  ).statements.flatMap((statement) => statement.rows);
  return Object.freeze(
    keys.map((key) => {
      const entry = registry.find((row) => row.concept === key.concept);
      const cell = rows
        .find((row) => row.concept === key.concept)
        ?.cells.find((cell) => cell.period.key === key.periodKey);
      if (!entry || cell?.status !== "available") throw new Error(invalid);
      return Object.freeze({
        ...key,
        value: cell.value,
        period: cell.period,
        observationIds: Object.freeze([...cell.observationIds]),
        qualification: entry.qualification,
      });
    }),
  );
}
export function interimPeriodText(
  period: PersonalSecInterimStatementCellDto["period"],
) {
  return period.periodType === "instant"
    ? `As of ${period.endDate}`
    : `Reported duration: ${period.startDate} to ${period.endDate} (${period.durationDays} days)`;
}
function excerpt(
  response: PersonalSecInterimCanonicalResponseDto,
  cells: readonly ManagedInterimNoteCell[],
  previous: boolean,
) {
  const s = response.security,
    e = response.evidence,
    g = e.generation,
    t = e.target;
  if (t.status !== "target") throw new Error(invalid);
  const selected = cells
    .map(
      (cell) =>
        `${cell.concept}: USD ${cell.value}; ${interimPeriodText(cell.period)}; ${cell.period.kind === "comparative" ? "comparative/historical; " : ""}${cell.period.periodType === "duration" ? "Quarter/YTD classification not established; " : ""}observations [${cell.observationIds.join(",")}]; ${cell.qualification}`,
    )
    .join(" ");
  const source = (name: string, value: typeof g.sources.companyFacts) =>
    `${name}[${value.status};${value.sourceUrl};retrieved ${value.fetchedAt ?? "unavailable"};${value.sha256 ?? "unavailable"};${value.bytes ?? "unavailable"} bytes]`;
  return `Interim CompanyFacts-only: ${s.symbol}; ${s.issuerName}; ${s.securityName}; ${s.exchangeMic}; listing ${s.listingId}; issuer ${s.issuerId}; CIK ${s.cik}; catalog ${response.catalogSnapshotSha256}. 10-Q accession ${t.accessionNumber}; report ${t.reportDate}; filed ${t.filedDate}; accepted ${t.acceptedAt ?? "unavailable"}. ${selected} ${source("CompanyFacts", g.sources.companyFacts)} ${source("Submissions", g.sources.submissions)} Load cutoff ${g.cutoffAt}; completed ${g.completedAt}; generation ${g.sha256}.${previous ? " Retained previous report; a newer report was not confirmed." : ""} No source refresh or quarter/YTD inference.`;
}
function lifetime(current: () => boolean) {
  let live = true,
    evaluating = false;
  return () => {
    if (!live || evaluating) {
      live = false;
      return false;
    }
    evaluating = true;
    try {
      const accepted = safelyCurrent(current);
      live = live && accepted;
    } finally {
      evaluating = false;
    }
    return live;
  };
}
function captureShape(input: ManagedInterimNoteCapture) {
  if (!input || typeof input.note !== "string") return false;
  if (typeof input.showingPrevious !== "boolean") return false;
  return (
    typeof input.isCurrent === "function" && typeof input.apply === "function"
  );
}
const refuse = (reason: string): ManagedInterimNotePreparation => ({
  preview: null,
  reason,
});
function prepareCompleteNote(
  input: ManagedInterimNoteCapture,
  keys: readonly ManagedInterimCellSelection[],
  current: () => boolean,
): ManagedInterimNotePreparation {
  const { response, note, showingPrevious, apply } = input;
  const cells = selectedCells(response, keys),
    addition = excerpt(response, cells, showingPrevious);
  const complete = note ? `${note} ${addition}` : addition;
  if (!validNote(complete))
    return refuse(
      "The complete note exceeds the existing 2,000-code-point single-line limit. Keep the input and select fewer cells or shorten the current note.",
    );
  if (normalizeWatchlistNote(note)!.endsWith(addition))
    return refuse(
      "These exact reported cells are already at the end of the note draft.",
    );
  if (!current()) return refuse(stale);
  const preview = Object.freeze({
    note: complete,
    excerpt: addition,
    selection: cells,
    generationSha256: response.evidence.generation.sha256,
    catalogSnapshotSha256: response.catalogSnapshotSha256,
    listingId: response.security.listingId,
    showingPrevious,
  });
  previews.set(preview, { current, apply });
  return { preview, reason: null };
}
export function prepareManagedInterimStatementsNote(
  input: ManagedInterimNoteCapture,
): ManagedInterimNotePreparation {
  if (!captureShape(input)) return refuse(stale);
  const keys = copySelection(input.selection);
  if (!keys) return refuse(invalid);
  const current = lifetime(input.isCurrent);
  if (!current()) return refuse(stale);
  if (!isOwnedSecInterimCanonicalResponse(input.response))
    return refuse(
      "Load and validate the interim report before preparing a note.",
    );
  if (!validNote(input.note))
    return refuse("Correct the current note before adding reported cells.");
  try {
    return prepareCompleteNote(input, keys, current);
  } catch {
    return refuse(invalid);
  }
}
export function isManagedInterimStatementsNoteCurrent(
  preview: PreparedManagedInterimStatementsNote,
) {
  const cap = previews.get(preview);
  if (!cap) return false;
  if (safelyCurrent(cap.current) && previews.get(preview) === cap) return true;
  previews.delete(preview);
  return false;
}
export function retireManagedInterimStatementsNote(
  preview: PreparedManagedInterimStatementsNote,
) {
  previews.delete(preview);
}
export function appendManagedInterimStatementsNote(
  preview: PreparedManagedInterimStatementsNote,
) {
  const cap = previews.get(preview);
  previews.delete(preview);
  if (!cap || !safelyCurrent(cap.current))
    return { appended: false, message: stale };
  try {
    cap.apply(preview.note);
    return {
      appended: true,
      message:
        "Reported cells added to the note draft. Review and Save My Watchlist separately.",
    };
  } catch {
    return {
      appended: false,
      message:
        "The note could not be applied. Review the current draft and prepare a new preview.",
    };
  }
}
