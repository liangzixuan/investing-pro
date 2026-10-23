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

/** One fixed invented full-list save, preserving every other field and member. */
export function createReportRevisitNativeFixture(base: SharedNativeFixture) {
  let stored: Awaited<ReturnType<typeof base.api.load>> | null = null;
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
        stored ??= {
          ...original,
          payload: {
            ...original.payload,
            memberships: original.payload.memberships.map((member, index) =>
              index === 0 ? { ...member, note: currentRevisitNote } : member,
            ),
          },
        };
        return structuredClone(stored);
      },
      save: (
        input: Parameters<typeof base.api.save>[0],
        signal: AbortSignal,
      ) => {
        const command = parseManagedWatchlistCommand(input);
        const note = command?.payload.memberships[0]?.note;
        const before = stored?.payload.memberships[0]?.note;
        const observations = base.getSnapshot();
        if (
          signal.aborted ||
          !command ||
          !stored ||
          saves !== 0 ||
          command.expectedVersion !== 1 ||
          observations.annual !== 1 ||
          observations.eod !== 0 ||
          observations.filings !== 0 ||
          observations.resolve !== 1 ||
          typeof note !== "string" ||
          !note.startsWith(`${before} ZERO XNAS report revisit assessed `) ||
          !note.includes(
            `archived report prepared ${archivedPreparedAt}; current report prepared `,
          ) ||
          !note.includes(`Authored assessment: ${revisitAssessment}`) ||
          !note.endsWith(
            "The file is not authenticated; reopening renews no source dates. Imported calculations are unverified and were not used as current evidence.",
          ) ||
          note.split("report revisit assessed ").length !== 2
        )
          throw new Error("Unexpected invented report revisit save");
        const expected = {
          ...stored.payload,
          memberships: stored.payload.memberships.map((member, index) =>
            index === 0 ? { ...member, note } : member,
          ),
        };
        if (
          encodeMainWatchlistPayload(command.payload) !==
          encodeMainWatchlistPayload(expected)
        )
          throw new Error(
            "Report revisit changed another note, identity or order",
          );
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
