export const normalizeWatchlistSearch = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/gu, " ");

export interface WatchlistNoteContext {
  text: string;
  omittedBefore: boolean;
  omittedAfter: boolean;
}

const contextBudget = 180;
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Map collapsed whitespace back to the complete, contextually lowercased text. */
function matchOffsets(lower: string, start: number, length: number) {
  const offsets: Array<{ start: number; end: number }> = [];
  let previousEnd = 0;
  for (const token of lower.matchAll(/\S+/gu)) {
    if (offsets.length) offsets.push({ start: previousEnd, end: token.index });
    const end = token.index + token[0].length;
    for (let index = token.index; index < end; index++)
      offsets.push({ start: index, end: index + 1 });
    previousEnd = end;
  }
  return {
    start: offsets[start]!.start,
    end: offsets[start + length - 1]!.end,
  };
}

function noteBoundaries(note: string) {
  const boundaries = [{ raw: 0, lower: 0, points: 0 }];
  let lower = 0;
  let points = 0;
  for (const { segment, index } of graphemes.segment(note)) {
    // Default lowercase context changes sigma's spelling, not its width. Use
    // only widths here; matching always uses the whole-string lowercase above.
    lower += segment.toLowerCase().length;
    points += Array.from(segment).length;
    boundaries.push({ raw: index + segment.length, lower, points });
  }
  return boundaries;
}

/** Exact raw substring; no rewriting, highlighting, saved state or source read. */
export function getWatchlistNoteContext(
  note: string,
  query: string,
): WatchlistNoteContext | null {
  const normalizedQuery = normalizeWatchlistSearch(query);
  if (!normalizedQuery) return null;
  const lower = note.toLowerCase();
  const match = normalizeWatchlistSearch(note).indexOf(normalizedQuery);
  if (match < 0) return null;
  const offsets = matchOffsets(lower, match, normalizedQuery.length);
  const boundaries = noteBoundaries(note);
  const first =
    boundaries.findIndex((boundary) => boundary.lower > offsets.start) - 1;
  const last = boundaries.findIndex(
    (boundary) => boundary.lower >= offsets.end,
  );
  const matchPoints = boundaries[last]!.points - boundaries[first]!.points;
  const contextBefore = Math.floor(
    (contextBudget - Math.min(contextBudget, matchPoints)) / 2,
  );
  const desiredStart = Math.min(
    Math.max(0, boundaries[first]!.points - contextBefore),
    Math.max(0, boundaries.at(-1)!.points - contextBudget),
  );
  const from = boundaries.findIndex(
    (boundary) => boundary.points >= desiredStart,
  );
  let to = from;
  while (
    to + 1 < boundaries.length &&
    boundaries[to + 1]!.points - boundaries[from]!.points <= contextBudget
  )
    to++;
  const start = boundaries[from]!.raw;
  const end = boundaries[to]!.raw;
  return {
    text: note.slice(start, end),
    omittedBefore: start > 0,
    omittedAfter: end < note.length,
  };
}
