import { registerPlugin } from "@capacitor/core";
import {
  encodeResearchFollowupsPayload,
  parseManagedResearchFollowupsCommand,
  parseResearchFollowupsPayload,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import {
  createNativeFollowupsReviewReportAdapter,
  type InvestmentFollowupsReviewReportPlugin,
} from "../../src/clerk-trial/followups-review-report-delivery";

export const followupsReportQuestions = Object.freeze([
  "Does ZERO keep its exact Class A identity? Read <script>alert(1)</script> & Café 東京 📈 as authored text, with the full original question and no source refresh.",
  "Completed ONE question remains in the full report although the open filter hides it. Preserve its independent assessment and authored completion date.",
  "Later ALFA question remains in the full report although its listing is outside My Watchlist and the chosen daily review set.",
]);
export const followupsReportResults = Object.freeze([
  "Authored ZERO assessment <img src=x onerror=alert(1)> & Café 東京 📈; original source dates remain unchanged.",
  "Completed ONE assessment: the original evidence is an authored observation, not a verified fact.",
  "Unchosen ALFA assessment stays in resource order without a watchlist membership.",
]);

/** Handwritten complete resource expectation, independent of the report formatter. */
export function inventedFollowupsReportPayload(
  fixture: Pick<SharedNativeFixture, "researchCoverage" | "marketsCohort">,
): ResearchFollowupsPayload {
  const listings = [
    fixture.researchCoverage.listings[0]!.listing,
    fixture.researchCoverage.listings[1]!.listing,
    fixture.marketsCohort[0],
  ];
  const payload = parseResearchFollowupsPayload({
    schemaVersion: 1,
    entries: listings.map((listing, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      catalogSnapshotSha256:
        index === 0
          ? fixture.researchCoverage.catalogSnapshotSha256
          : `sha256:${String(index + 1).repeat(64)}`,
      listing,
      check: followupsReportQuestions[index],
      result: followupsReportResults[index],
      dueOn: index === 2 ? "2099-12-31" : "2000-01-01",
      status: index === 1 ? "completed" : "open",
      completedOn: index === 1 ? "2026-10-01" : null,
    })),
  });
  if (!payload) throw new Error("Invalid invented Follow-ups report resource");
  return payload;
}
function refuse(): never {
  throw new Error("Unexpected invented Follow-ups report action");
}

/** Explicit setup replaces only the local draft through the real coordinator. */
export function authorInventedFollowupsReviewReport(
  workspace: ManagedWorkspace,
  fixture: SharedNativeFixture,
): boolean {
  const state = workspace.followups.coordinator.getSnapshot();
  if (state.phase !== "idle") return false;
  if (state.baseVersion !== 0) return false;
  if (state.dirty) return false;
  if (state.draft?.entries.length !== 0) return false;
  if (!state.latestLoaded) return false;
  workspace.followups.coordinator.replaceDraft(
    inventedFollowupsReportPayload(fixture),
  );
  return workspace.followups.coordinator.getSnapshot().dirty;
}

/** One independent RAM Save and fresh Load; no provider or watchlist write is admitted. */
export function createFollowupsReviewReportNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const expected = inventedFollowupsReportPayload(base);
  let saves = 0;
  const sources = { eod: 0, annual: 0, filings: 0 };
  const listeners = new Set<() => void>();
  let state = base.getSnapshot();
  const publish = () => {
    state = { ...base.getSnapshot(), ...sources };
    for (const listener of listeners) listener();
  };
  base.subscribe(publish);
  const source = (kind: keyof typeof sources): never => {
    sources[kind]++;
    publish();
    return refuse();
  };
  return {
    ...base,
    financialReview: null,
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    api: {
      ...base.api,
      save: () => refuse(),
      loadFollowups: (signal) => {
        const count = base.followups!.getSnapshot().load;
        if (count >= 2) return refuse();
        if (count === 1) {
          if (saves !== 1) return refuse();
        }
        return base.api.loadFollowups(signal);
      },
      saveFollowups: (input, signal) => {
        const command = parseManagedResearchFollowupsCommand(input);
        if (signal.aborted) return refuse();
        if (!command) return refuse();
        if (saves !== 0) return refuse();
        if (command.expectedVersion !== 0) return refuse();
        if (Object.values(sources).some((count) => count !== 0))
          return refuse();
        if (
          encodeResearchFollowupsPayload(command.payload) !==
          encodeResearchFollowupsPayload(expected)
        )
          return refuse();
        saves++;
        return base.api.saveFollowups(command, signal);
      },
      eodHistory: () => source("eod"),
      annualReport: () => source("annual"),
      recentFilings: () => source("filings"),
    },
  };
}

/** Real registered bridge and adapter; diagnostics retain only bounded transport metadata. */
export function createNativeFollowupsReviewReportFixture() {
  const plugin = registerPlugin<InvestmentFollowupsReviewReportPlugin>(
    "InvestmentFollowupsReviewReport",
  );
  const listeners = new Set<() => void>();
  let state = {
    choices: 0,
    writes: 0,
    cancels: 0,
    filename: "",
    byteLength: 0,
  };
  const update = (patch: Partial<typeof state>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const delivery = createNativeFollowupsReviewReportAdapter({
    choose: async (options) => {
      update({ choices: state.choices + 1, filename: options.filename });
      return plugin.choose(options);
    },
    write: async (options) => {
      const result = await plugin.write(options);
      update({
        writes: state.writes + 1,
        byteLength: new TextEncoder().encode(options.text).byteLength,
      });
      return result;
    },
    cancel: async (options) => {
      await plugin.cancel(options);
      update({ cancels: state.cancels + 1 });
    },
  });
  return {
    delivery,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
