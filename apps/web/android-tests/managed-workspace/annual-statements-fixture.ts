import {
  encodeMainWatchlistPayload,
  parseManagedWatchlistCommand,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  type MainWatchlistPayload,
  type ManagedWatchlistDto,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "../../src/clerk-trial/api";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import {
  prepareManagedAnnualStatementsNote,
  type ManagedAnnualStatementCellSelection,
} from "../../src/clerk-trial/managed-annual-statements-note";
import { annualReportPacket } from "../../src/clerk-trial/test-annual-report-fixture";
import {
  bindAnnualPacket,
  replaceConceptRows,
  type TestAnnualPacket,
} from "../../src/lib/test-personal-sec-annual-api-fixture";
import { parseSecAnnualCanonicalResponse } from "../../src/lib/sec-annual-canonical-response";
import type { SharedNativeFixture } from "./fixture";

const prefix = "Statement thesis · Café 東京 📈";
const dates = Object.freeze([
  "2025-12-31",
  "2024-12-31",
  "2023-12-31",
] as const);
const selectedCells = Object.freeze([
  Object.freeze({ concept: "NetIncomeLoss", endDate: dates[0] }),
  Object.freeze({ concept: "Assets", endDate: dates[1] }),
] as const satisfies readonly ManagedAnnualStatementCellSelection[]);
const pins = Object.freeze({
  dates,
  parentNetIncome: "-9007199254740993.123456789012345678",
  comparativeAssets: "900.5",
  operatingCashFlow: "120.125",
  comparativeOperatingCashFlow: "-80.0625",
  missingTaxDate: dates[1],
});

/** Invented source fields, real canonical32 hashes and the real owning decoder. */
export async function annualStatementsPacket(): Promise<PersonalSecAnnualCanonicalResponseDto> {
  const packet = structuredClone(
    await annualReportPacket(),
  ) as TestAnnualPacket;
  const accession = "0000000001-26-000001";
  if (packet.evidence.target.status !== "target")
    throw new Error("Expected invented annual target");
  packet.evidence.target.accessionNumber = accession;
  for (const row of packet.evidence.facts.observations) {
    row.accessionNumber = accession;
    row.filing.sourceUrl = `https://www.sec.gov/Archives/edgar/data/1/${accession}-index.htm`;
  }
  for (const [index, entry] of registry.entries()) {
    const values =
      entry.concept === "NetIncomeLoss"
        ? [pins.parentNetIncome, "80.0625", "32.03125"]
        : entry.concept === "Assets"
          ? ["1000.125", pins.comparativeAssets, "800.875"]
          : entry.concept === "NetCashProvidedByUsedInOperatingActivities"
            ? [
                pins.operatingCashFlow,
                pins.comparativeOperatingCashFlow,
                "64.03125",
              ]
            : entry.concept === "StockholdersEquity"
              ? ["-200.125", "0", "-98.625"]
              : entry.concept === "NetCashProvidedByUsedInInvestingActivities"
                ? ["-75.025", "-50.0125", "-40.00625"]
                : [
                    `${index + 100}.125`,
                    `${index + 80}.0625`,
                    `${index + 64}.03125`,
                  ];
    replaceConceptRows(
      packet,
      entry.concept,
      dates.flatMap((endDate, at) =>
        entry.concept === "IncomeTaxExpenseBenefit" && at === 1
          ? []
          : [
              {
                value: values[at]!,
                startDate:
                  entry.periodType === "instant"
                    ? null
                    : `${endDate.slice(0, 4)}-01-01`,
                endDate,
                durationDays:
                  entry.periodType === "instant" ? null : at === 1 ? 366 : 365,
                frame: `CY${endDate.slice(0, 4)}${entry.periodType === "instant" ? "Q4I" : ""}`,
              },
            ],
      ),
    );
  }
  const bound = await bindAnnualPacket(packet);
  const admitted = await parseSecAnnualCanonicalResponse(
    bound,
    {
      schemaVersion: "6.0.0",
      catalogSnapshotSha256: bound.catalogSnapshotSha256,
      listingId: bound.security.listingId,
      symbol: bound.security.symbol,
    },
    new AbortController().signal,
  );
  if (!admitted) throw new Error("Invented statement packet was refused");
  return admitted;
}

export interface NativeAnnualStatementsMetadata {
  readonly prefix: string;
  readonly expectedNote: string;
  readonly selectedCells: readonly ManagedAnnualStatementCellSelection[];
  readonly pins: typeof pins;
  readonly generation: PersonalSecAnnualCanonicalResponseDto["evidence"]["generation"];
}
export type AnnualStatementsNativeFixture = SharedNativeFixture & {
  readonly financialReview: null;
  readonly annualStatements: NativeAnnualStatementsMetadata;
};
type State = ReturnType<SharedNativeFixture["getSnapshot"]>;
type Counter =
  | "load"
  | "status"
  | "save"
  | "annual"
  | "eod"
  | "filings"
  | "search"
  | "calendar"
  | "fed";

/** One explicit source read and exact whole-draft Save; no provider or persistent store. */
export async function createAnnualStatementsNativeFixture(
  base: SharedNativeFixture,
): Promise<AnnualStatementsNativeFixture> {
  const packet = await annualStatementsPacket();
  const proposal = prepareManagedAnnualStatementsNote({
    response: packet,
    selection: selectedCells,
    note: prefix,
    showingPrevious: false,
    isCurrent: () => true,
    apply: () => {
      throw new Error("Expected-note construction cannot append");
    },
  });
  if (!proposal.preview)
    throw new Error(`Invalid invented statement note: ${proposal.reason}`);
  const expectedNote = proposal.preview.note;
  const overrides: Partial<Record<Counter, number>> = {};
  let snapshot: State = base.getSnapshot();
  const listeners = new Set<() => void>();
  const publish = () => {
    snapshot = { ...base.getSnapshot(), ...overrides };
    for (const listener of listeners) listener();
  };
  base.subscribe(publish);
  const count = (key: Counter) => {
    overrides[key] = snapshot[key] + 1;
    publish();
  };
  const unexpected = (operation: string): Promise<never> =>
    Promise.reject(
      new Error(`Unexpected annual statements operation: ${operation}`),
    );
  const unrelated = () =>
    snapshot.eod +
      snapshot.filings +
      snapshot.search +
      snapshot.resolve +
      snapshot.marketsEod +
      snapshot.calendar +
      snapshot.fed +
      snapshot.token +
      snapshot.signOut !==
    0;
  let saved: ManagedWatchlistDto | null = null;
  let original: MainWatchlistPayload | null = null;
  const api: ManagedApi = {
    ...base.api,
    load: async (signal) => {
      if (
        signal.aborted ||
        snapshot.load >= 2 ||
        (snapshot.load === 1 && snapshot.save !== 1)
      )
        throw new Error("Unexpected annual statements watchlist read");
      count("load");
      if (snapshot.load === 1) {
        saved = structuredClone(await base.api.load(signal));
        original = structuredClone(saved.payload);
      }
      if (!saved) throw new Error("Load the invented watchlist first");
      return structuredClone(saved);
    },
    status: (signal) => {
      if (
        signal.aborted ||
        snapshot.status >= 2 ||
        (snapshot.status === 1 && snapshot.annual !== 1)
      )
        throw new Error("Unexpected annual statements catalog read");
      count("status");
      if (snapshot.status === 1) return base.api.status(signal);
      // Explicit second catalog refresh retires the actual workspace/session.
      return Promise.reject(new TrialApiError("unauthenticated"));
    },
    annualReport: (request, signal) => {
      if (
        signal.aborted ||
        snapshot.annual !== 0 ||
        snapshot.load !== 1 ||
        snapshot.status !== 1 ||
        request.schemaVersion !== "6.0.0" ||
        request.catalogSnapshotSha256 !== original?.snapshotSha256 ||
        request.listingId !== "listing-zero" ||
        request.symbol !== "ZERO"
      )
        throw new Error("Unexpected annual statements Annual request or order");
      count("annual");
      return Promise.resolve(packet);
    },
    save: (command, signal) => {
      const captured = parseManagedWatchlistCommand(command);
      const expected: MainWatchlistPayload | null = original
        ? {
            ...original,
            memberships: [
              original.memberships[1]!,
              { ...original.memberships[0]!, note: expectedNote },
            ],
          }
        : null;
      if (
        signal.aborted ||
        !expected ||
        snapshot.save !== 0 ||
        snapshot.load !== 1 ||
        snapshot.status !== 1 ||
        snapshot.annual !== 1 ||
        unrelated() ||
        saved?.version !== 1 ||
        captured?.expectedVersion !== 1 ||
        encodeMainWatchlistPayload(captured.payload) !==
          encodeMainWatchlistPayload(expected)
      )
        return unexpected("save");
      count("save");
      saved = { version: 2, payload: structuredClone(captured.payload) };
      return Promise.resolve({ ...structuredClone(saved), replayed: false });
    },
    eodHistory: () => {
      count("eod");
      return unexpected("eod");
    },
    recentFilings: () => {
      count("filings");
      return unexpected("filings");
    },
    search: () => {
      count("search");
      return unexpected("search");
    },
    economicCalendar: () => {
      count("calendar");
      return unexpected("calendar");
    },
    monetaryAnnouncements: () => {
      count("fed");
      return unexpected("fed");
    },
    loadPortfolio: () => unexpected("loadPortfolio"),
    savePortfolio: () => unexpected("savePortfolio"),
    loadFollowups: () => unexpected("loadFollowups"),
    saveFollowups: () => unexpected("saveFollowups"),
  };
  return {
    ...base,
    api,
    financialReview: null,
    annualStatements: Object.freeze({
      prefix,
      expectedNote,
      selectedCells,
      pins,
      generation: packet.evidence.generation,
    }),
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    settleCancelledRead: () => {
      throw new Error("The statement journey has no held Annual read");
    },
    enableRefreshScenario: () => {
      throw new Error("The statement journey allows one explicit Annual read");
    },
    failRefresh: () => {
      throw new Error("The statement journey allows one explicit Annual read");
    },
  };
}
