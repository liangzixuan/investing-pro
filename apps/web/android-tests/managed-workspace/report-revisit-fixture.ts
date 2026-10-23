import {
  encodeMainWatchlistPayload,
  parseManagedWatchlistCommand,
} from "@research-cockpit/contracts";
import type { SharedNativeFixture } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import { prepareCompanyReport } from "../../src/clerk-trial/managed-company-report";
import { formatCompanyReportDocument } from "../../src/clerk-trial/managed-company-report-document";

export const archivedRevisitNote =
  "Archived authored note: café 東京 📈. Original liquidity question remains open.";
export const currentRevisitNote = "Current authored note remains independent.";
export const revisitAssessment = "Archived liquidity needs a new review";
export const archivedPreparedAt = "2026-10-15T00:00:00.000Z";

/** Build a real format5 envelope; only its unverified Annual appendix is padded. */
export async function reportRevisitDocument(base: SharedNativeFixture) {
  const workspace = new ManagedWorkspace(base.api, base.session, undefined, {
    researchCoverage: base.researchCoverage,
    priceCoverage: base.priceCoverage,
  });
  try {
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("watchlist");
    workspace.note("listing-zero", archivedRevisitNote);
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    await workspace.annual.load();
    const selection = workspace.getSnapshot().research!.selection;
    const report = prepareCompanyReport(
      selection,
      companySnapshotEvidence(
        selection,
        workspace.eod.getSnapshot(),
        workspace.annual.getSnapshot(),
        workspace.filings.getSnapshot(),
      ),
      workspace.getResearchWatchlist(selection),
      () => new Date(archivedPreparedAt),
    );
    if (!report) throw new Error("Invented archive report preparation failed");
    const document = formatCompanyReportDocument(report);
    if (!document) throw new Error("Invented archive report formatting failed");
    const envelope = JSON.parse(document.text) as {
      sources: { annual: { statements: Record<string, unknown> } };
    };
    envelope.sources.annual.statements.opaqueInventedPadding = "x".repeat(
      300_000,
    );
    const text = JSON.stringify(envelope);
    const byteLength = new TextEncoder().encode(text).byteLength;
    if (byteLength <= 266_240 || byteLength >= 2_850_816)
      throw new Error(
        "Invented report must exercise the larger archive ceiling",
      );
    return { ...document, text, byteLength };
  } finally {
    workspace.sessionOwner.dispose();
  }
}

type StoredWatchlist = Awaited<ReturnType<SharedNativeFixture["api"]["load"]>>;
type SaveCommand = NonNullable<ReturnType<typeof parseManagedWatchlistCommand>>;
interface SaveContext {
  readonly input: Parameters<SharedNativeFixture["api"]["save"]>[0];
  readonly signal: AbortSignal;
  readonly stored: StoredWatchlist | null;
  readonly saves: number;
  readonly observations: ReturnType<SharedNativeFixture["getSnapshot"]>;
}
function refuseSave(): never {
  throw new Error("Unexpected invented report revisit save");
}
function requireSourceObservations(observed: SaveContext["observations"]) {
  if (observed.annual !== 1) refuseSave();
  if (observed.eod !== 0) refuseSave();
  if (observed.filings !== 0) refuseSave();
  if (observed.resolve !== 1) refuseSave();
}
function requireAuthoredNote(
  note: unknown,
  before: string | undefined,
): string {
  if (typeof note !== "string") return refuseSave();
  if (!note.startsWith(`${before} ZERO XNAS report revisit assessed `))
    refuseSave();
  if (
    !note.includes(
      `archived report prepared ${archivedPreparedAt}; current report prepared `,
    )
  )
    refuseSave();
  if (!note.includes(`Authored assessment: ${revisitAssessment}`)) refuseSave();
  if (
    !note.endsWith(
      "The file is not authenticated; reopening renews no source dates. Imported calculations are unverified and were not used as current evidence.",
    )
  )
    refuseSave();
  if (note.split("report revisit assessed ").length !== 2) refuseSave();
  return note;
}
function captureSave(context: SaveContext) {
  if (context.signal.aborted) refuseSave();
  const command = parseManagedWatchlistCommand(context.input);
  if (!command) return refuseSave();
  if (!context.stored) return refuseSave();
  if (context.saves !== 0) refuseSave();
  if (command.expectedVersion !== 1) refuseSave();
  requireSourceObservations(context.observations);
  const before = context.stored;
  const note = requireAuthoredNote(
    command.payload.memberships[0]?.note,
    before.payload.memberships[0]?.note,
  );
  requireWholeList({ command, before, note });
  return command;
}
function requireWholeList({
  command,
  before,
  note,
}: {
  readonly command: SaveCommand;
  readonly before: StoredWatchlist;
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
function initialWatchlist(original: StoredWatchlist): StoredWatchlist {
  return {
    ...original,
    payload: {
      ...original.payload,
      memberships: original.payload.memberships.map((member, index) =>
        index === 0 ? { ...member, note: currentRevisitNote } : member,
      ),
    },
  };
}

/** One fixed invented full-list save, preserving every other field and member. */
export function createReportRevisitNativeFixture(base: SharedNativeFixture) {
  let stored: StoredWatchlist | null = null;
  let saves = 0;
  let state = { ...base.getSnapshot(), save: saves };
  const listeners = new Set<() => void>();
  const publish = () => {
    state = { ...base.getSnapshot(), save: saves };
    for (const listener of listeners) listener();
  };
  base.subscribe(publish);
  return {
    ...base,
    financialReview: null,
    api: {
      ...base.api,
      async load(signal: AbortSignal) {
        const original = await base.api.load(signal);
        stored ??= initialWatchlist(original);
        return structuredClone(stored);
      },
      save(input: SaveContext["input"], signal: AbortSignal) {
        const command = captureSave({
          input,
          signal,
          stored,
          saves,
          observations: base.getSnapshot(),
        });
        stored = { version: 2, payload: structuredClone(command.payload) };
        saves++;
        publish();
        return Promise.resolve({ ...structuredClone(stored), replayed: false });
      },
    },
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
