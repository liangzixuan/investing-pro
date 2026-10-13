import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import { annualComparisonResponse } from "./annual-comparison-fixture";
import { TrialApiError } from "./api";
import { ManagedSecCooldownError, type ManagedApi } from "./managed-api";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedSecAccess } from "./managed-sec-access";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { eodSelection } from "./eod-history-fixture";

const selection: ManagedResearchSelection = {
  ...eodSelection,
  origin: "watchlist",
  cik: null,
};
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
function fixture() {
  const read = vi.fn<ManagedApi["annualReport"]>();
  const readError = vi.fn();
  const access = new ManagedSecAccess();
  return {
    read,
    readError,
    access,
    model: new ManagedAnnualReport(read, readError, access),
  };
}
async function settled(model: ManagedAnnualReport) {
  await vi.waitFor(() => expect(model.getSnapshot().running).toBe(false));
}
function holdHash() {
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  const spy = vi
    .spyOn(crypto.subtle, "digest")
    .mockImplementationOnce(async (algorithm, input) => {
      await gate;
      return digest(algorithm, input);
    });
  return { release, spy };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("checked Annual comparison report seed", () => {
  it.each([false, true])(
    "owns the exact packet and original qualification %s without a request",
    async (showingPrevious) => {
      const packet = await annualComparisonResponse();
      const mutable = structuredClone(packet) as Mutable<typeof packet>;
      const { model, read, readError } = fixture();
      expect(
        model.open(selection, { response: mutable, showingPrevious }),
      ).toBeUndefined();
      const initial = model.getSnapshot();
      expect(initial.selection).toEqual(selection);
      expect(initial.selection).not.toBe(selection);
      expect(Object.isFrozen(initial.selection?.listing)).toBe(true);
      expect(initial).toMatchObject({
        response: null,
        responseOrigin: null,
        running: true,
        checkingSeed: true,
      });
      mutable.security.issuerName = "Caller changed after opening";
      await model.load();
      await settled(model);
      const accepted = model.getSnapshot();
      expect(accepted.response).toEqual(packet);
      expect(accepted.response).not.toBe(packet);
      expect(Object.isFrozen(accepted.response?.evidence.cashGeneration)).toBe(
        true,
      );
      expect(accepted).toMatchObject({
        responseOrigin: "watchlist-comparison",
        showingPrevious,
        checkingSeed: false,
        error: false,
      });
      expect(read).not.toHaveBeenCalled();
      expect(readError).not.toHaveBeenCalled();
    },
  );
  it.each([
    "income-invalid",
    "current-use-unavailable",
    "source-unavailable",
  ] as const)(
    "preserves the admitted %s report without inventing eligibility",
    async (mode) => {
      const response = await annualComparisonResponse("left", { mode });
      const { model, read } = fixture();
      model.open(selection, { response, showingPrevious: true });
      await settled(model);
      expect(model.getSnapshot().response).toEqual(response);
      expect(model.getSnapshot().showingPrevious).toBe(true);
      expect(read).not.toHaveBeenCalled();
    },
  );
  it.each([
    "generation-hash",
    "cash-calculation",
    "other-issuer",
    "catalog",
    "identity",
    "previous-flag",
  ] as const)("refuses %s without a fallback request", async (kind) => {
    const response = structuredClone(
      await annualComparisonResponse(
        kind === "other-issuer" ? "right" : "left",
      ),
    ) as Mutable<PersonalSecAnnualEvidenceResponseDto>;
    if (kind === "generation-hash")
      response.evidence.generation.sha256 = `sha256:${"f".repeat(64)}`;
    if (kind === "cash-calculation") {
      const value =
        response.evidence.cashGeneration.resolution
          .operatingCashFlowLessPpePurchases;
      if (value.status !== "available")
        throw new Error("Expected available fixture");
      value.value = "999";
    }
    if (kind === "catalog")
      response.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
    if (kind === "identity")
      response.security.issuerName = "Different issuer name";
    const { model, read, readError } = fixture();
    model.open(selection, {
      response,
      showingPrevious:
        kind === "previous-flag" ? ("yes" as unknown as boolean) : false,
    });
    await settled(model);
    expect(model.getSnapshot()).toMatchObject({
      selection,
      response: null,
      responseOrigin: null,
      checkingSeed: false,
      error: true,
    });
    expect(model.getSnapshot().message).toContain("could not be validated");
    expect(read).not.toHaveBeenCalled();
    expect(readError).not.toHaveBeenCalled();
  });
  it.each([eodSelection, { ...selection, cik: "0000000001" }] as const)(
    "refuses a non-handoff selection %#",
    async (selected) => {
      const response = await annualComparisonResponse();
      const { model, read } = fixture();
      model.open(selected, { response, showingPrevious: false });
      await settled(model);
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        error: true,
      });
      expect(read).not.toHaveBeenCalled();
    },
  );
  it.each(["cancel", "close", "retire", "replace"] as const)(
    "fences delayed local hash completion after %s",
    async (action) => {
      const response = await annualComparisonResponse();
      const { model, read } = fixture();
      const held = holdHash();
      model.open(selection, { response, showingPrevious: true });
      expect(held.spy).toHaveBeenCalled();
      if (action === "replace")
        model.open({
          ...selection,
          listing: { ...selection.listing, listingId: "another-listing" },
        });
      else model[action]();
      const after = model.getSnapshot();
      expect(after.running).toBe(false);
      expect(after.checkingSeed).toBe(false);
      held.release();
      await held.spy.mock.results[0]!.value;
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(model.getSnapshot()).toBe(after);
      expect(after.response).toBeNull();
      expect(after.responseOrigin).toBeNull();
      expect(read).not.toHaveBeenCalled();
    },
  );
  it("keeps a later explicit request when cancelled seed hashing finishes", async () => {
    const response = await annualComparisonResponse();
    const fresh = await annualComparisonResponse("left", {
      mode: "exact-decimal",
    });
    const { model, read } = fixture();
    const held = holdHash();
    model.open(selection, { response, showingPrevious: true });
    model.cancel();
    read.mockResolvedValueOnce(fresh);
    await model.load();
    const accepted = model.getSnapshot();
    held.release();
    await held.spy.mock.results[0]!.value;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(model.getSnapshot()).toBe(accepted);
    expect(accepted).toMatchObject({
      response: fresh,
      responseOrigin: "request",
      showingPrevious: false,
      checkingSeed: false,
    });
    expect(read).toHaveBeenCalledOnce();
  });
  it("does not begin seed validation after synchronous selection publication closes the visit", async () => {
    const response = await annualComparisonResponse();
    const { model, read } = fixture();
    const hash = vi.spyOn(crypto.subtle, "digest");
    const unsubscribe = model.subscribe(() => {
      if (model.getSnapshot().selection) {
        unsubscribe();
        model.close();
      }
    });
    model.open(selection, { response, showingPrevious: false });
    expect(model.getSnapshot()).toMatchObject({
      selection: null,
      response: null,
      checkingSeed: false,
      running: false,
    });
    expect(hash).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
  it.each(["replace", "close", "retire"] as const)(
    "does not overwrite a synchronous %s during the internal close notification",
    async (action) => {
      const response = await annualComparisonResponse();
      const newer = await annualComparisonResponse("left", {
        mode: "exact-decimal",
      });
      const { model, read } = fixture();
      model.open(selection);
      const hash = vi.spyOn(crypto.subtle, "digest");
      let replacement = model.getSnapshot();
      const unsubscribe = model.subscribe(() => {
        if (model.getSnapshot().selection !== null) return;
        unsubscribe();
        if (action === "replace")
          model.open(selection, { response: newer, showingPrevious: true });
        else model[action]();
        replacement = model.getSnapshot();
      });
      model.open(selection, { response, showingPrevious: false });
      expect(model.getSnapshot()).toBe(replacement);
      await settled(model);
      expect(model.getSnapshot()).toMatchObject({
        selection: action === "replace" ? selection : null,
        response: action === "replace" ? newer : null,
        responseOrigin: action === "replace" ? "watchlist-comparison" : null,
        showingPrevious: action === "replace",
        running: false,
        checkingSeed: false,
      });
      if (action !== "replace") expect(hash).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
    },
  );
  it("keeps a newer visit opened by the previous request's abort listener", async () => {
    const response = await annualComparisonResponse();
    const newer = await annualComparisonResponse("left", {
      mode: "exact-decimal",
    });
    const { model, read } = fixture();
    let finish!: (value: PersonalSecAnnualEvidenceResponseDto) => void;
    read.mockImplementationOnce(
      (_request, signal) =>
        new Promise((resolve) => {
          finish = resolve;
          signal.addEventListener("abort", () => {
            model.open(selection, { response: newer, showingPrevious: true });
          });
        }),
    );
    model.open(selection);
    const pending = model.load();
    model.open(selection, { response, showingPrevious: false });
    await settled(model);
    const accepted = model.getSnapshot();
    expect(accepted).toMatchObject({
      response: newer,
      responseOrigin: "watchlist-comparison",
      showingPrevious: true,
    });
    finish(response);
    await pending;
    expect(model.getSnapshot()).toBe(accepted);
    expect(read).toHaveBeenCalledOnce();
  });
  it("does not spend or reset an existing SEC cooldown while validating the seed", async () => {
    const response = await annualComparisonResponse();
    const { model, read, access } = fixture();
    const deadline = new Date(Date.now() + 60_000).toISOString();
    access.recordCooldown(
      new ManagedSecCooldownError(deadline),
      new AbortController().signal,
    );
    model.open(selection, { response, showingPrevious: false });
    await settled(model);
    expect(access.getNextAllowedAt()).toBe(deadline);
    await model.load();
    expect(read).not.toHaveBeenCalled();
    expect(model.getSnapshot()).toMatchObject({
      responseOrigin: "watchlist-comparison",
      showingPrevious: true,
    });
    expect(model.getSnapshot().message).toContain(deadline);
  });
  it.each([
    new TrialApiError("unavailable"),
    new TrialApiError("invalid_response"),
  ])(
    "keeps or clears seeded provenance with the existing refresh policy: %s",
    async (error) => {
      const response = await annualComparisonResponse();
      const { model, read } = fixture();
      model.open(selection, { response, showingPrevious: false });
      await settled(model);
      read.mockRejectedValueOnce(error);
      await model.load();
      const retained = error.code === "unavailable";
      expect(model.getSnapshot().response).toEqual(retained ? response : null);
      expect(model.getSnapshot().responseOrigin).toBe(
        retained ? "watchlist-comparison" : null,
      );
      expect(model.getSnapshot().showingPrevious).toBe(retained);
    },
  );
  it("cancels a visit refresh without changing the original source packet", async () => {
    const response = await annualComparisonResponse();
    let finish!: (value: PersonalSecAnnualEvidenceResponseDto) => void;
    const pending = new Promise<PersonalSecAnnualEvidenceResponseDto>(
      (resolve) => {
        finish = resolve;
      },
    );
    const { model, read } = fixture();
    model.open(selection, { response, showingPrevious: false });
    await settled(model);
    read.mockReturnValueOnce(pending);
    const loading = model.load();
    model.cancel();
    const state = model.getSnapshot();
    finish(await annualComparisonResponse("left", { mode: "exact-decimal" }));
    await loading;
    expect(model.getSnapshot()).toBe(state);
    expect(state).toMatchObject({
      response,
      responseOrigin: "watchlist-comparison",
      showingPrevious: true,
    });
    expect(read.mock.calls[0]![1].aborted).toBe(true);
  });
});
