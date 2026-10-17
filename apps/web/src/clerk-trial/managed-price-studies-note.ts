import {
  normalizeWatchlistNote,
  type ManagedEodHistoryResponseDto,
} from "@research-cockpit/contracts";
import {
  MANAGED_PRICE_STUDY_KEYS,
  ownPriceStudiesResponse,
  resolveManagedPriceStudies,
  type ManagedPriceStudyKey,
} from "./managed-price-studies";

export interface PreparedPriceStudiesNote {
  readonly note: string;
  readonly excerpt: string;
  readonly keys: readonly ManagedPriceStudyKey[];
}
export interface PriceStudiesNotePreparation {
  readonly preview: PreparedPriceStudiesNote | null;
  readonly reason: string | null;
}
export interface PriceStudiesNoteCapture {
  readonly response: ManagedEodHistoryResponseDto;
  readonly keys: readonly ManagedPriceStudyKey[];
  readonly note: string;
  readonly showingPrevious: boolean;
  readonly isCurrent: () => boolean;
  readonly apply: (note: string) => void;
}
export interface ManagedPriceStudiesActions {
  prepare: (
    response: ManagedEodHistoryResponseDto,
    keys: readonly ManagedPriceStudyKey[],
    selectionIsCurrent: () => boolean,
  ) => PriceStudiesNotePreparation;
  isCurrent: (preview: PreparedPriceStudiesNote) => boolean;
  append: (preview: PreparedPriceStudiesNote) => {
    readonly appended: boolean;
    readonly message: string;
  };
}
const stale =
  "The price history, study choices, note or visit changed. Preview the complete note again.";

/** Each instance belongs to one workspace; handles are consumed before applying. */
export class ManagedPriceStudiesNote {
  private readonly captures = new WeakMap<
    PreparedPriceStudiesNote,
    { current: () => boolean; apply: (note: string) => void }
  >();

  prepare(input: PriceStudiesNoteCapture): PriceStudiesNotePreparation {
    const refuse = (reason: string): PriceStudiesNotePreparation => ({
      preview: null,
      reason,
    });
    const { response, note, showingPrevious, isCurrent, apply } = input;
    const keys = copyKeys(input.keys);
    if (!keys)
      return refuse(
        "Select available study results without duplicate or unknown choices.",
      );
    if (!safelyCurrent(isCurrent)) return refuse(stale);
    if (!validNote(note))
      return refuse("Correct the current note before adding study results.");
    const studies = resolveManagedPriceStudies(response);
    if (!studies)
      return refuse(
        "Studies are unavailable for this price packet. The original history and note are unchanged.",
      );
    const selected = keys.map((key) =>
      studies.rows.find((row) => row.key === key),
    );
    if (selected.some((row) => !row?.available))
      return refuse("Select only available study results.");
    const source = studies.response;
    const excerpt = `${source.security.symbol} ${source.security.exchangeMic} raw close studies: ${selected.map((row) => `${row!.label}: ${row!.value} (${row!.sample}; ${row!.detail})`).join("; ")}. Tiingo raw USD closes, unadjusted for splits/dividends; observed gaps are not filled. Loaded ${source.range} window ${source.window.startDate} through ${source.window.endDate}; requested ${source.requestStartedAt}; completed ${source.completedAt}. Formula set ${studies.calculation.formulaSetVersion}; derived percentages rounded half-up to 4 decimal places. ${showingPrevious ? "Retained previous history; the latest attempt has not confirmed it. " : ""}Descriptive observations, not a recommendation or forecast.`;
    if (normalizeWatchlistNote(note)!.endsWith(excerpt))
      return refuse(
        "These study results are already at the end of the note draft.",
      );
    const complete = note ? `${note} ${excerpt}` : excerpt;
    if (!validNote(complete))
      return refuse(
        "The complete note exceeds the single-line, 2,000-character limit. Shorten the note or select fewer results. Nothing was clipped or saved.",
      );
    const fingerprint = JSON.stringify(source);
    let live = true;
    const current = () => {
      if (!live) return false;
      try {
        live =
          isCurrent() &&
          JSON.stringify(ownPriceStudiesResponse(response)) === fingerprint;
      } catch {
        live = false;
      }
      return live;
    };
    if (!current()) return refuse(stale);
    const preview = Object.freeze({ note: complete, excerpt, keys });
    this.captures.set(preview, { current, apply });
    return { preview, reason: null };
  }
  isCurrent(preview: PreparedPriceStudiesNote) {
    const capture = this.captures.get(preview);
    if (!capture) return false;
    if (capture.current()) return true;
    this.captures.delete(preview);
    return false;
  }
  append(preview: PreparedPriceStudiesNote) {
    if (!this.isCurrent(preview)) return { appended: false, message: stale };
    const capture = this.captures.get(preview)!;
    this.captures.delete(preview);
    try {
      capture.apply(preview.note);
    } catch {
      return {
        appended: false,
        message:
          "The study note could not be applied. Review the current draft and prepare a new preview.",
      };
    }
    return {
      appended: true,
      message:
        "Study results added to the note draft. Review and save all changes in My Watchlist.",
    };
  }
}
function copyKeys(value: unknown): readonly ManagedPriceStudyKey[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
    return null;
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (
    !length ||
    !("value" in length) ||
    !Number.isSafeInteger(length.value) ||
    length.value < 1 ||
    length.value > MANAGED_PRICE_STUDY_KEYS.length ||
    Reflect.ownKeys(value).length !== length.value + 1
  )
    return null;
  const result: ManagedPriceStudyKey[] = [];
  for (let index = 0; index < length.value; index++) {
    const item = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      !item?.enumerable ||
      !("value" in item) ||
      !MANAGED_PRICE_STUDY_KEYS.includes(item.value as ManagedPriceStudyKey) ||
      result.includes(item.value as ManagedPriceStudyKey)
    )
      return null;
    result.push(item.value as ManagedPriceStudyKey);
  }
  return Object.freeze(result);
}
function validNote(value: string) {
  return (
    typeof value === "string" &&
    [...value].length <= 2000 &&
    !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value) &&
    normalizeWatchlistNote(value) !== null
  );
}
function safelyCurrent(current: () => boolean) {
  try {
    return current() === true;
  } catch {
    return false;
  }
}
