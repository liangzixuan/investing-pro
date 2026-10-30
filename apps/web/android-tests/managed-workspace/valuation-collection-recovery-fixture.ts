import {
  parseManagedCatalogResolveResponse,
  parseManagedValuationAssumptionsCommand,
  parseManagedValuationAssumptionsReceipt,
  parseValuationAssumptionsPayload,
  type ValuationAssumptionsPayload,
  type ManagedValuationAssumptionsDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import type { TrialSession } from "../../src/clerk-trial/session";
import {
  savedValuationInputs,
  type SharedNativeFixture,
  type ManagedNativeFixture,
} from "./fixture";

const OLD = `sha256:${"b".repeat(64)}`;
export function collectionPayload(
  base: SharedNativeFixture,
  current = false,
): ValuationAssumptionsPayload {
  const entries = base.researchCoverage.listings
    .slice(0, 2)
    .map(({ listing }, index) => {
      const entry = structuredClone(savedValuationInputs!);
      return {
        ...entry,
        listing,
        cik: null,
        catalogSnapshotSha256: current
          ? base.researchCoverage.catalogSnapshotSha256
          : OLD,
        dcf: {
          ...entry.dcf,
          inputs: {
            ...entry.dcf.inputs,
            startingUnleveredCashFlowUsd:
              index === 0 ? "  1.. Café 東京 📈  " : "",
            enterpriseToEquityBridgeUsd: index === 0 ? "-000.50" : "+12.300",
            scenarios: {
              ...entry.dcf.inputs.scenarios,
              base: {
                annualCashFlowGrowthPercent:
                  index === 0 ? " incomplete " : "3.1400",
              },
            },
          },
        },
        exit: {
          ...entry.exit,
          inputs: {
            ...entry.exit.inputs,
            cash: index === 0 ? "  003.00  " : "not a number 零",
            scenarios: {
              ...entry.exit.inputs.scenarios,
              expansion: {
                ...entry.exit.inputs.scenarios.expansion,
                exitMultiple: index === 0 ? "" : "7..",
              },
            },
          },
        },
      };
    });
  const payload = parseValuationAssumptionsPayload({
    schemaVersion: 1,
    entries,
  });
  if (!payload || payload.entries.length !== 2)
    throw new Error("Invalid invented collection recovery payload");
  return payload;
}
export function createValuationCollectionRecoveryFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const captured = collectionPayload(base),
    reviewed = collectionPayload(base, true);
  const newer: ValuationAssumptionsPayload = {
    schemaVersion: 1,
    entries: [structuredClone(savedValuationInputs!)],
  };
  let saved: ManagedValuationAssumptionsDto = {
    version: 3,
    payload: { schemaVersion: 1, entries: [] },
  };
  let state: ReturnType<ValuationCollectionRecoveryControls["getSnapshot"]> =
    Object.freeze({
      session: 0,
      load: 0,
      save: 0,
      review: 0,
      company: 0,
      rejected: 0,
    });
  const listeners = new Set<() => void>();
  const publish = (change: Partial<typeof state>) => {
    state = Object.freeze({ ...state, ...change });
    for (const listener of [...listeners]) listener();
  };
  function refuse(): never {
    publish({ rejected: state.rejected + 1 });
    throw new Error(
      "Unexpected invented valuation-collection-recovery operation",
    );
  }
  function admit(condition: unknown): asserts condition {
    if (!condition) refuse();
  }
  const load: ManagedApi["loadValuationAssumptions"] = async (signal) => {
    admit(
      !signal.aborted &&
        ((state.session === 0 && state.load === 0) ||
          (state.session === 1 && state.load === 1) ||
          (state.session === 2 && state.load === 2 && state.save === 1)),
    );
    publish({ load: state.load + 1 });
    return await Promise.resolve(structuredClone(saved));
  };
  const save: ManagedApi["saveValuationAssumptions"] = async (
    input,
    signal,
  ) => {
    const command = parseManagedValuationAssumptionsCommand(input);
    admit(
      !signal.aborted &&
        command &&
        state.session === 1 &&
        state.load === 2 &&
        state.review === 1 &&
        state.save === 0 &&
        command.expectedVersion === 7,
    );
    admit(JSON.stringify(command.payload) === JSON.stringify(reviewed));
    const receipt = parseManagedValuationAssumptionsReceipt(
      { version: 8, payload: command.payload, replayed: false },
      command,
    );
    admit(receipt);
    saved = { version: receipt.version, payload: receipt.payload };
    publish({ save: 1 });
    return await Promise.resolve(structuredClone(receipt));
  };
  const resolve: ManagedApi["resolve"] = async (request, signal) => {
    admit(
      !signal.aborted &&
        request.snapshotSha256 === base.researchCoverage.catalogSnapshotSha256,
    );
    const listings = base.researchCoverage.listings
      .slice(0, 2)
      .map((row) => row.listing);
    const ids = request.listingIds.join("|");
    if (ids === base.marketsCohort.map((row) => row.listingId).join("|")) {
      admit(base.getSnapshot().marketsResolve === state.session);
      return base.api.resolve(request, signal);
    }
    if (ids === listings.map((row) => row.listingId).join("|")) {
      admit(
        state.session === 1 &&
          state.load === 2 &&
          state.review === 0 &&
          state.save === 0,
      );
      publish({ review: 1 });
    } else return refuse();
    const result = parseManagedCatalogResolveResponse(
      {
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: listings.find((row) => row.listingId === listingId),
        })),
      },
      request,
    );
    admit(result);
    return result;
  };
  const watchlistLoad: ManagedApi["load"] = (signal) => {
    admit(!signal.aborted && base.getSnapshot().load === state.session);
    return base.api.load(signal);
  };
  const status: ManagedApi["status"] = (signal) => {
    admit(!signal.aborted && base.getSnapshot().status === state.session);
    return base.api.status(signal);
  };
  const api = new Proxy(base.api, {
    get(target, key, receiver) {
      if (key === "loadValuationAssumptions") return load;
      if (key === "saveValuationAssumptions") return save;
      if (key === "resolve") return resolve;
      if (key === "load") return watchlistLoad;
      if (key === "status") return status;
      if (typeof key === "string") return refuse;
      return Reflect.get(target, key, receiver) as unknown;
    },
  });
  const controls: ValuationCollectionRecoveryControls = {
    captured,
    reviewed,
    newer,
    getSnapshot: () => state,
    saved: () => structuredClone(saved),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    nextSession() {
      admit(
        (state.session === 0 && state.load === 1 && state.save === 0) ||
          (state.session === 1 && state.save === 1),
      );
      if (state.session === 0)
        saved = { version: 7, payload: structuredClone(newer) };
      publish({ session: state.session + 1 });
      return {
        ...base.session,
        sessionId: `invented-collection-session-${state.session}`,
      };
    },
  };
  return { ...base, api, financialReview: null, collectionRecovery: controls };
}
export interface ValuationCollectionRecoveryControls {
  readonly captured: ValuationAssumptionsPayload;
  readonly reviewed: ValuationAssumptionsPayload;
  readonly newer: ValuationAssumptionsPayload;
  readonly getSnapshot: () => Readonly<{
    session: number;
    load: number;
    save: number;
    review: number;
    company: number;
    rejected: number;
  }>;
  saved(): ManagedValuationAssumptionsDto;
  readonly subscribe: (listener: () => void) => () => void;
  nextSession(): TrialSession;
}
