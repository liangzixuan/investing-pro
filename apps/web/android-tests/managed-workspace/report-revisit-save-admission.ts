import {
  encodeMainWatchlistPayload,
  parseManagedWatchlistCommand,
} from "@research-cockpit/contracts";
import type { SharedNativeFixture } from "./fixture";

export type StoredReportRevisitWatchlist = Awaited<
  ReturnType<SharedNativeFixture["api"]["load"]>
>;
type SaveCommand = NonNullable<ReturnType<typeof parseManagedWatchlistCommand>>;
export interface ReportRevisitSaveContext {
  readonly input: Parameters<SharedNativeFixture["api"]["save"]>[0];
  readonly signal: AbortSignal;
  readonly stored: StoredReportRevisitWatchlist | null;
  readonly saves: number;
  readonly observations: ReturnType<SharedNativeFixture["getSnapshot"]>;
  readonly archivedPreparedAt: string;
  readonly assessment: string;
}
interface AuthoredNote {
  readonly note: string;
  readonly before: string | undefined;
  readonly archiveTime: string;
  readonly assessment: string;
}
function refuseSave(): never {
  throw new Error("Unexpected invented report revisit save");
}
function captureCommand(context: ReportRevisitSaveContext) {
  if (context.signal.aborted) refuseSave();
  const command = parseManagedWatchlistCommand(context.input);
  if (!command) return refuseSave();
  return command;
}
function requireStoredRead(context: ReportRevisitSaveContext) {
  if (!context.stored) return refuseSave();
  if (context.saves !== 0) refuseSave();
  return context.stored;
}
function requireSourceObservations(
  observed: ReportRevisitSaveContext["observations"],
) {
  if (observed.annual !== 1) refuseSave();
  if (observed.eod !== 0) refuseSave();
  if (observed.filings !== 0) refuseSave();
  if (observed.resolve !== 0) refuseSave();
  if (observed.marketsResolve !== 1) refuseSave();
  if (observed.marketsEod !== 0) refuseSave();
}
function requireCurrentNotePrefix(proposal: AuthoredNote) {
  if (
    !proposal.note.startsWith(
      `${proposal.before} ZERO XNAS report revisit assessed `,
    )
  )
    refuseSave();
}
function requireArchivedAssessment(proposal: AuthoredNote) {
  if (
    !proposal.note.includes(
      `archived report prepared ${proposal.archiveTime}; current report prepared `,
    )
  )
    refuseSave();
  if (!proposal.note.includes(`Authored assessment: ${proposal.assessment}`))
    refuseSave();
}
function requireFileScopeCaution(proposal: AuthoredNote) {
  if (
    !proposal.note.endsWith(
      "The file is not authenticated; reopening renews no source dates. Imported calculations are unverified and were not used as current evidence.",
    )
  )
    refuseSave();
}
function requireSingleAppend(proposal: AuthoredNote) {
  if (proposal.note.split("report revisit assessed ").length !== 2)
    refuseSave();
}
function requireAuthoredNote(input: {
  readonly note: unknown;
  readonly before: string | undefined;
  readonly context: ReportRevisitSaveContext;
}) {
  if (typeof input.note !== "string") return refuseSave();
  const proposal = {
    note: input.note,
    before: input.before,
    archiveTime: input.context.archivedPreparedAt,
    assessment: input.context.assessment,
  };
  requireCurrentNotePrefix(proposal);
  requireArchivedAssessment(proposal);
  requireFileScopeCaution(proposal);
  requireSingleAppend(proposal);
  return proposal.note;
}
function requireWholeList({
  command,
  before,
  note,
}: {
  readonly command: SaveCommand;
  readonly before: StoredReportRevisitWatchlist;
  readonly note: string;
}) {
  const expected = {
    ...before.payload,
    memberships: before.payload.memberships.map((member, index) =>
      index === 0 ? { ...member, note } : member,
    ),
  };
  if (
    encodeMainWatchlistPayload(command.payload) !==
    encodeMainWatchlistPayload(expected)
  )
    throw new Error("Report revisit changed another note, identity or order");
}
/** Admit the single declared fixture command without changing any record or observation. */
export function captureReportRevisitSave(context: ReportRevisitSaveContext) {
  const command = captureCommand(context);
  const before = requireStoredRead(context);
  if (command.expectedVersion !== 1) refuseSave();
  requireSourceObservations(context.observations);
  const note = requireAuthoredNote({
    note: command.payload.memberships[0]?.note,
    before: before.payload.memberships[0]?.note,
    context,
  });
  requireWholeList({ command, before, note });
  return command;
}
