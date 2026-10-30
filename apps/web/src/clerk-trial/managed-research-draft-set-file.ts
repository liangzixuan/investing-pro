import { assertPersonalSecJsonUniqueKeys } from "@research-cockpit/contracts";
import {
  parseManagedWatchlistDraftFile,
  MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES,
  type ManagedWatchlistDraftFileContent,
} from "./managed-watchlist-draft-file";
import {
  parseManagedPortfolioDraftFile,
  MANAGED_PORTFOLIO_DRAFT_FILE_MAX_BYTES,
  type ManagedPortfolioDraftFileContent,
} from "./managed-portfolio-draft-file";
import {
  parseManagedFollowupsDraftFile,
  MANAGED_FOLLOWUPS_DRAFT_FILE_MAX_BYTES,
  type ManagedFollowupsDraftFileContent,
} from "./managed-followups-draft-file";
import {
  parseManagedValuationCollectionDraftFile,
  MANAGED_VALUATION_COLLECTION_DRAFT_FILE_MAX_BYTES,
  type ManagedValuationCollectionDraftFileContent,
} from "./managed-valuation-collection-draft-file";
import {
  draftFileEncoder,
  requireDraftFile,
  requiredDraftFileRecord,
  requiredDraftFileArray,
  requiredDraftFileHash,
  requiredDraftFileTime,
  requiredDraftFileText,
} from "./managed-watchlist-draft-file-validation";

export const RESEARCH_DRAFT_RESOURCES = [
  "watchlist",
  "portfolio",
  "followups",
  "valuation",
] as const;
export type ResearchDraftResource = (typeof RESEARCH_DRAFT_RESOURCES)[number];
export interface ResearchDraftMembers {
  readonly watchlist: ManagedWatchlistDraftFileContent | null;
  readonly portfolio: ManagedPortfolioDraftFileContent | null;
  readonly followups: ManagedFollowupsDraftFileContent | null;
  readonly valuation: ManagedValuationCollectionDraftFileContent | null;
}
export type ResearchDraftMember = NonNullable<
  ResearchDraftMembers[ResearchDraftResource]
>;
const FORMAT = "investment-research-draft-set";
const MIME = "application/json";
const CONTENT_KEYS = [
  "format",
  "version",
  "accountScope",
  "capturedAt",
  "members",
  "omitted",
] as const;
const INPUT_KEYS = ["accountScope", "capturedAt", "members"] as const;
const DOCUMENT_KEYS = [
  "filename",
  "mime",
  "text",
  "byteLength",
  "accountScope",
  "capturedAt",
] as const;
export const EMPTY_RESEARCH_DRAFT_MEMBERS: ResearchDraftMembers = Object.freeze(
  { watchlist: null, portfolio: null, followups: null, valuation: null },
);
const emptyOuterBytes = draftFileEncoder.encode(
  JSON.stringify({
    format: FORMAT,
    version: 1,
    accountScope: `sha256:${"0".repeat(64)}`,
    capturedAt: "0000-01-01T00:00:00.000Z",
    members: EMPTY_RESEARCH_DRAFT_MEMBERS,
    omitted: [],
  }) + "\n",
).byteLength;
// Replace four null placeholders with four bounded member objects; their trailing newlines are not nested.
export const MANAGED_RESEARCH_DRAFT_SET_FILE_MAX_BYTES =
  MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES +
  MANAGED_PORTFOLIO_DRAFT_FILE_MAX_BYTES +
  MANAGED_FOLLOWUPS_DRAFT_FILE_MAX_BYTES +
  MANAGED_VALUATION_COLLECTION_DRAFT_FILE_MAX_BYTES +
  emptyOuterBytes -
  4 * (4 + 1);
export interface ManagedResearchDraftSetFileContent {
  readonly format: typeof FORMAT;
  readonly version: 1;
  readonly accountScope: string;
  readonly capturedAt: string;
  readonly members: ResearchDraftMembers;
  readonly omitted: readonly ResearchDraftResource[];
}
export interface ManagedResearchDraftSetFileDocument {
  readonly filename: string;
  readonly mime: typeof MIME;
  readonly text: string;
  readonly byteLength: number;
  readonly accountScope: string;
  readonly capturedAt: string;
}
export function researchDraftResourceLabel(resource: ResearchDraftResource) {
  return {
    watchlist: "Watchlist",
    portfolio: "Portfolio",
    followups: "Follow-ups",
    valuation: "Staged valuation",
  }[resource];
}
function memberRecord(value: unknown, valuation = false) {
  return valuation
    ? requiredDraftFileRecord(value, [
        "format",
        "version",
        "accountScope",
        "capturedAt",
        "payload",
      ] as const)
    : requiredDraftFileRecord(value, [
        "format",
        "version",
        "accountScope",
        "capturedAt",
        "baseVersion",
        "draft",
      ] as const);
}
function admittedMembers(value: unknown, scope: string): ResearchDraftMembers {
  const m = requiredDraftFileRecord(value, RESEARCH_DRAFT_RESOURCES);
  const watchlist =
    m.watchlist === null
      ? null
      : parseManagedWatchlistDraftFile(
          JSON.stringify(memberRecord(m.watchlist)),
          scope,
        );
  const portfolio =
    m.portfolio === null
      ? null
      : parseManagedPortfolioDraftFile(
          JSON.stringify(memberRecord(m.portfolio)),
          scope,
        );
  const followups =
    m.followups === null
      ? null
      : parseManagedFollowupsDraftFile(
          JSON.stringify(memberRecord(m.followups)),
          scope,
        );
  const valuation =
    m.valuation === null
      ? null
      : parseManagedValuationCollectionDraftFile(
          JSON.stringify(memberRecord(m.valuation, true)),
          scope,
        );
  for (const [key, v] of Object.entries({
    watchlist,
    portfolio,
    followups,
    valuation,
  }))
    requireDraftFile(m[key as ResearchDraftResource] === null || v !== null);
  requireDraftFile(
    watchlist !== null ||
      portfolio !== null ||
      followups !== null ||
      valuation !== null,
  );
  return Object.freeze({ watchlist, portfolio, followups, valuation });
}
function admittedContent(
  value: unknown,
  scope: string,
): ManagedResearchDraftSetFileContent {
  const f = requiredDraftFileRecord(value, CONTENT_KEYS);
  requireDraftFile(
    f.format === FORMAT &&
      f.version === 1 &&
      requiredDraftFileHash(f.accountScope) === scope,
  );
  const members = admittedMembers(f.members, scope),
    omitted = RESEARCH_DRAFT_RESOURCES.filter((k) => members[k] === null);
  requireDraftFile(
    JSON.stringify(requiredDraftFileArray(f.omitted, 4)) ===
      JSON.stringify(omitted),
  );
  return Object.freeze({
    format: FORMAT,
    version: 1,
    accountScope: scope,
    capturedAt: requiredDraftFileTime(f.capturedAt),
    members,
    omitted: Object.freeze(omitted),
  });
}
function documentFor(
  content: ManagedResearchDraftSetFileContent,
): ManagedResearchDraftSetFileDocument {
  const text = JSON.stringify(content) + "\n",
    byteLength = draftFileEncoder.encode(text).byteLength;
  requireDraftFile(byteLength <= MANAGED_RESEARCH_DRAFT_SET_FILE_MAX_BYTES);
  return Object.freeze({
    filename: `Investment-research-draft-set-${content.capturedAt.replace(/[:.]/gu, "-")}.json`,
    mime: MIME,
    text,
    byteLength,
    accountScope: content.accountScope,
    capturedAt: content.capturedAt,
  });
}
export function formatManagedResearchDraftSetFile(input: {
  accountScope: string;
  capturedAt: string;
  members: ResearchDraftMembers;
}): ManagedResearchDraftSetFileDocument | null {
  try {
    const f = requiredDraftFileRecord(input, INPUT_KEYS),
      scope = requiredDraftFileHash(f.accountScope),
      members = admittedMembers(f.members, scope);
    return documentFor(
      admittedContent(
        {
          format: FORMAT,
          version: 1,
          ...f,
          members,
          omitted: RESEARCH_DRAFT_RESOURCES.filter((k) => members[k] === null),
        },
        scope,
      ),
    );
  } catch {
    return null;
  }
}
export function parseManagedResearchDraftSetFile(
  text: string,
  scope: string,
): ManagedResearchDraftSetFileContent | null {
  try {
    const admitted = requiredDraftFileText(
      text,
      MANAGED_RESEARCH_DRAFT_SET_FILE_MAX_BYTES,
    );
    assertPersonalSecJsonUniqueKeys(admitted);
    return admittedContent(
      JSON.parse(admitted) as unknown,
      requiredDraftFileHash(scope),
    );
  } catch {
    return null;
  }
}
export function isManagedResearchDraftSetFileDocument(
  value: unknown,
): value is ManagedResearchDraftSetFileDocument {
  try {
    const f = requiredDraftFileRecord(value, DOCUMENT_KEYS),
      scope = requiredDraftFileHash(f.accountScope),
      text = requiredDraftFileText(
        f.text,
        MANAGED_RESEARCH_DRAFT_SET_FILE_MAX_BYTES,
      ),
      content = parseManagedResearchDraftSetFile(text, scope);
    requireDraftFile(content);
    const expected = documentFor(content);
    return DOCUMENT_KEYS.every((k) => f[k] === expected[k]);
  } catch {
    return false;
  }
}
export function assertResearchDraftSetFileSize(size: number) {
  requireDraftFile(
    Number.isSafeInteger(size) &&
      size > 0 &&
      size <= MANAGED_RESEARCH_DRAFT_SET_FILE_MAX_BYTES,
  );
}
export function decodeResearchDraftSetFile(
  bytes: ArrayBuffer,
  size: number,
  scope: string,
) {
  try {
    assertResearchDraftSetFileSize(size);
    requireDraftFile(bytes instanceof ArrayBuffer && bytes.byteLength === size);
    return parseManagedResearchDraftSetFile(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
      scope,
    );
  } catch {
    return null;
  }
}
