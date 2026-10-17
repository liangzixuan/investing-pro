import {
  normalizeWatchlistNote,
  PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  type PersonalSecAnnualCanonicalResponseDto,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecAnnualStatementId,
  type PersonalSecAnnualStatementLineId,
  type PersonalSecAnnualStatementPeriodType,
} from "@research-cockpit/contracts";
import {
  resolvePersonalSecAnnualStatements,
  serializePersonalSecAnnualCanonicalGeneration,
} from "@research-cockpit/personal-financial-analytics";

export interface ManagedAnnualStatementCellSelection {
  readonly concept: PersonalSecAnnualStatementConcept;
  readonly endDate: string;
}
export interface ManagedAnnualStatementNoteCell extends ManagedAnnualStatementCellSelection {
  readonly statement: PersonalSecAnnualStatementId;
  readonly lineId: PersonalSecAnnualStatementLineId;
  readonly periodType: PersonalSecAnnualStatementPeriodType;
  readonly label: string;
  readonly qualification: string;
  readonly value: string;
  readonly startDate: string | null;
  readonly currentUseEligible: boolean;
  readonly observationIds: readonly `sec-fact:${string}`[];
}
export interface PreparedManagedAnnualStatementsNote {
  readonly note: string;
  readonly excerpt: string;
  readonly selection: readonly ManagedAnnualStatementNoteCell[];
  readonly generationSha256: `sha256:${string}`;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listingId: string;
  readonly showingPrevious: boolean;
}
export interface ManagedAnnualStatementsNoteCapture {
  /** Already admitted by the canonical v6 decoder, including SHA verification. */
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly selection: readonly ManagedAnnualStatementCellSelection[];
  readonly note: string;
  readonly showingPrevious: boolean;
  /**
   * Close over the exact response/generation, company/listing/catalog, visit,
   * session lifetime, retained-response status and opaque workspace/note/selection
   * revision captured by the caller. Every edit, including edit then restore,
   * must change that revision.
   * A text-equality check cannot establish currentness. This callback must not
   * refresh sources, save, or retarget another workspace.
   */
  readonly isCurrent: () => boolean;
  /** Apply the whole note to the captured draft only. Saving remains explicit. */
  readonly apply: (note: string) => void;
}
export interface ManagedAnnualStatementsNotePreparation {
  readonly preview: PreparedManagedAnnualStatementsNote | null;
  readonly reason: string | null;
}
const previews = new WeakMap<
  PreparedManagedAnnualStatementsNote,
  { current: () => boolean; apply: (note: string) => void }
>();
const stale =
  "The annual report, selected cells, note or company visit changed. Prepare the statement note again.";
const invalidSelection =
  "Select available statement cells, with no duplicate or unknown cells.";
const bound =
  "The complete note must fit the existing single-line, 2,000-character limit. Shorten the note or select fewer cells before adding it.";

/** Recompute selected reported cells from an admitted response; prepare without saving. */
export function prepareManagedAnnualStatementsNote(
  input: ManagedAnnualStatementsNoteCapture,
): ManagedAnnualStatementsNotePreparation {
  const refuse = (reason: string): ManagedAnnualStatementsNotePreparation => ({
    preview: null,
    reason,
  });
  if (
    !input ||
    typeof input !== "object" ||
    typeof input.note !== "string" ||
    typeof input.showingPrevious !== "boolean" ||
    typeof input.isCurrent !== "function" ||
    typeof input.apply !== "function"
  )
    return refuse(stale);
  // Copy callbacks and primitive options before a caller callback can mutate its options.
  const { response, note, showingPrevious, isCurrent, apply } = input;
  const selection = copySelection(input.selection);
  if (selection === null) return refuse(invalidSelection);
  if (!safelyCurrent(isCurrent)) return refuse(stale);
  if (!validNote(note))
    return refuse("Correct the current note before adding statement cells.");
  try {
    const binding = responseBinding(response);
    const statements = resolvePersonalSecAnnualStatements(response.evidence);
    const selected: ManagedAnnualStatementNoteCell[] = [];
    for (const key of selection) {
      const entry = registry.find((entry) => entry.concept === key.concept);
      const row = statements.statements
        .flatMap((statement) => statement.rows)
        .find((row) => row.concept === key.concept);
      const cell = row?.cells.find((cell) => cell.endDate === key.endDate);
      if (!entry || cell?.status !== "available")
        return refuse(invalidSelection);
      selected.push(
        Object.freeze({
          concept: entry.concept,
          statement: entry.statement,
          lineId: entry.lineId,
          periodType: entry.periodType,
          label: entry.label,
          qualification: entry.qualification,
          value: cell.value,
          startDate: cell.startDate,
          endDate: cell.endDate,
          currentUseEligible: cell.currentUseEligible,
          observationIds: Object.freeze([...cell.observationIds]),
        }),
      );
    }
    const ownedSelection = Object.freeze(selected);
    const excerpt = describeExcerpt(response, ownedSelection, showingPrevious);
    if (normalizeWatchlistNote(note)!.endsWith(excerpt))
      return refuse(
        "These statement cells are already at the end of the note draft.",
      );
    const complete = note ? `${note} ${excerpt}` : excerpt;
    if (!validNote(complete)) return refuse(bound);
    let live = true;
    const current = (): boolean => {
      if (!live) return false;
      try {
        live = Boolean(isCurrent() && responseBinding(response) === binding);
      } catch {
        live = false;
      }
      return live;
    };
    if (!current()) return refuse(stale);
    const preview = Object.freeze({
      note: complete,
      excerpt,
      selection: ownedSelection,
      generationSha256: response.evidence.generation.sha256,
      catalogSnapshotSha256: response.catalogSnapshotSha256,
      listingId: response.security.listingId,
      showingPrevious,
    });
    previews.set(preview, { current, apply });
    return { preview, reason: null };
  } catch {
    return refuse(
      "The admitted annual statement response is no longer valid. Load and review the report before preparing a note.",
    );
  }
}

export function isManagedAnnualStatementsNoteCurrent(
  preview: PreparedManagedAnnualStatementsNote,
): boolean {
  const capability = previews.get(preview);
  if (!capability) return false;
  if (safelyCurrent(capability.current)) return true;
  previews.delete(preview);
  return false;
}
export function appendManagedAnnualStatementsNote(
  preview: PreparedManagedAnnualStatementsNote,
): { readonly appended: boolean; readonly message: string } {
  if (!isManagedAnnualStatementsNoteCurrent(preview))
    return { appended: false, message: stale };
  const capability = previews.get(preview)!;
  previews.delete(preview);
  try {
    capability.apply(preview.note);
  } catch {
    return {
      appended: false,
      message:
        "The statement note could not be applied. Review the current draft and prepare a new preview.",
    };
  }
  return {
    appended: true,
    message:
      "Statement cells added to the note draft. Review and save all changes in My Watchlist.",
  };
}
function copySelection(
  value: unknown,
): readonly ManagedAnnualStatementCellSelection[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
    return null;
  const size = Object.getOwnPropertyDescriptor(value, "length");
  if (
    !size ||
    !("value" in size) ||
    !Number.isSafeInteger(size.value) ||
    size.value < 1 ||
    size.value > registry.length * 3 ||
    Reflect.ownKeys(value).length !== size.value + 1
  )
    return null;
  const result: ManagedAnnualStatementCellSelection[] = [],
    seen = new Set<string>();
  for (let index = 0; index < size.value; index++) {
    const item = Object.getOwnPropertyDescriptor(value, String(index));
    if (!item?.enumerable || !("value" in item)) return null;
    const candidate: unknown = item.value;
    if (
      candidate === null ||
      typeof candidate !== "object" ||
      Object.getPrototypeOf(candidate) !== Object.prototype ||
      Reflect.ownKeys(candidate).length !== 2
    )
      return null;
    const concept = Object.getOwnPropertyDescriptor(candidate, "concept"),
      endDate = Object.getOwnPropertyDescriptor(candidate, "endDate");
    if (
      !concept?.enumerable ||
      !("value" in concept) ||
      !endDate?.enumerable ||
      !("value" in endDate) ||
      typeof concept.value !== "string" ||
      !registry.some((entry) => entry.concept === concept.value) ||
      typeof endDate.value !== "string" ||
      !/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u.test(endDate.value)
    )
      return null;
    const key = `${concept.value}:${endDate.value}`;
    if (seen.has(key)) return null;
    seen.add(key);
    result.push(
      Object.freeze({
        concept: concept.value as PersonalSecAnnualStatementConcept,
        endDate: endDate.value,
      }),
    );
  }
  return Object.freeze(result);
}
function responseBinding(
  response: PersonalSecAnnualCanonicalResponseDto,
): string {
  if (
    response.schemaVersion !== PERSONAL_SEC_ANNUAL_CANONICAL_VERSION ||
    response.security.cik !== response.evidence.cik
  )
    throw new TypeError("Invalid canonical statement response.");
  const s = response.security;
  return JSON.stringify([
    response.schemaVersion,
    response.catalogSnapshotSha256,
    [
      s.country,
      s.exchangeMic,
      s.issuerId,
      s.issuerName,
      s.listingId,
      s.securityName,
      s.symbol,
      s.cik,
    ],
    response.evidence.generation.sha256,
    serializePersonalSecAnnualCanonicalGeneration(response.evidence),
  ]);
}
function describeExcerpt(
  response: PersonalSecAnnualCanonicalResponseDto,
  selection: readonly ManagedAnnualStatementNoteCell[],
  showingPrevious: boolean,
): string {
  const { security, catalogSnapshotSha256, evidence } = response;
  const { target, generation, cik } = evidence;
  if (target.status !== "target")
    throw new TypeError("Unresolved annual target.");
  const cells = selection
    .map(
      (cell) =>
        `${cell.label} (${cell.concept}; ${cell.periodType}): USD ${cell.value}; ${cell.startDate === null ? `as of ${cell.endDate}` : `period ${cell.startDate} to ${cell.endDate}`}; observations [${cell.observationIds.join(", ")}]; ${cell.currentUseEligible ? "current use eligible" : "historical; current use ineligible"} at original load. ${cell.qualification}`,
    )
    .join(" ");
  const source = (
    name: string,
    value: typeof generation.sources.companyFacts,
  ) =>
    `${name} ${value.status}, captured ${value.fetchedAt ?? "unavailable"}, ${value.sourceUrl}, ${value.sha256 ?? "unavailable"}, bytes ${value.bytes ?? "unavailable"}`;
  return `Observed annual statement cells: ${security.symbol} (${security.exchangeMic}); listing ${security.listingId}; issuer ${security.issuerId}; CIK ${cik}; catalog ${catalogSnapshotSha256}. ${cells} Target ${target.form}, report ${target.reportDate}, filed ${target.filedDate}, accepted ${target.acceptedAt ?? "unavailable"}; accession ${target.accessionNumber}; filing https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm. Original load cutoff ${generation.cutoffAt}; completed ${generation.completedAt}; ${source("Company Facts", generation.sources.companyFacts)}; ${source("Submissions", generation.sources.submissions)}; generation ${generation.sha256}; canonical ${generation.definitionVersion}, registry ${evidence.facts.registryVersion}.${showingPrevious ? " Retained previous report; a newer report was not confirmed." : ""} Evidence dates are unchanged; this action does not refresh sources.`;
}
function validNote(value: string): boolean {
  return (
    [...value].length <= 2000 &&
    !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value) &&
    normalizeWatchlistNote(value) !== null
  );
}
function safelyCurrent(current: () => boolean): boolean {
  try {
    return current();
  } catch {
    return false;
  }
}
