import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import { annualReportPacket } from "./test-annual-report-fixture";
import { TrialApiError } from "./api";
import {
  ManagedSecCooldownError,
  ManagedAnnualReportError,
  ManagedCatalogChangedError,
  type ManagedApi,
} from "./managed-api";
import * as analytics from "@research-cockpit/personal-financial-analytics";
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
      const packet = await annualReportPacket();
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
        view: null,
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
      expect(accepted.view?.canonical).toBe(accepted.response?.evidence);
      expect(Object.isFrozen(accepted.response?.evidence.facts)).toBe(true);
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
      const response = await annualReportPacket("left", { mode });
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
    "injected-cash-calculation",
    "forged-canonical-value",
    "other-issuer",
    "catalog",
    "identity",
    "previous-flag",
  ] as const)("refuses %s without a fallback request", async (kind) => {
    const response = structuredClone(
      await annualReportPacket(kind === "other-issuer" ? "right" : "left"),
    ) as Mutable<PersonalSecAnnualCanonicalResponseDto>;
    if (kind === "generation-hash")
      response.evidence.generation.sha256 = `sha256:${"f".repeat(64)}`;
    if (kind === "injected-cash-calculation")
      Object.assign(response.evidence, {
        cashGeneration: {
          resolution: {
            operatingCashFlowLessPpePurchases: {
              status: "available",
              value: "999",
            },
          },
        },
      });
    if (kind === "forged-canonical-value")
      response.evidence.facts.observations[0]!.value = "999";
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
      view: null,
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
      const response = await annualReportPacket();
      const { model, read } = fixture();
      model.open(selected, { response, showingPrevious: false });
      await settled(model);
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        view: null,
        error: true,
      });
      expect(read).not.toHaveBeenCalled();
    },
  );
  it.each(["cancel", "close", "retire", "replace"] as const)(
    "fences delayed local hash completion after %s",
    async (action) => {
      const response = await annualReportPacket();
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
      expect(after.view).toBeNull();
      expect(after.responseOrigin).toBeNull();
      expect(read).not.toHaveBeenCalled();
    },
  );
  it("keeps a later explicit request when cancelled seed hashing finishes", async () => {
    const response = await annualReportPacket();
    const fresh = await annualReportPacket("left", {
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
    const response = await annualReportPacket();
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
      view: null,
      checkingSeed: false,
      running: false,
    });
    expect(hash).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
  it.each(["replace", "close", "retire"] as const)(
    "does not overwrite a synchronous %s during the internal close notification",
    async (action) => {
      const response = await annualReportPacket();
      const newer = await annualReportPacket("left", {
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
    const response = await annualReportPacket();
    const newer = await annualReportPacket("left", {
      mode: "exact-decimal",
    });
    const { model, read } = fixture();
    let finish!: (value: PersonalSecAnnualCanonicalResponseDto) => void;
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
    const response = await annualReportPacket();
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
      const response = await annualReportPacket();
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
    const response = await annualReportPacket();
    let finish!: (value: PersonalSecAnnualCanonicalResponseDto) => void;
    const pending = new Promise<PersonalSecAnnualCanonicalResponseDto>(
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
    finish(await annualReportPacket("left", { mode: "exact-decimal" }));
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

function expectPair(model: ManagedAnnualReport) {
  const state = model.getSnapshot();
  if (state.response === null) expect(state.view).toBeNull();
  else expect(state.view?.canonical).toBe(state.response.evidence);
}

describe("atomic canonical Annual request admission", () => {
  it("reuses owned transport without hashing and derives one stable view before publication", async () => {
    const response = await annualReportPacket();
    const hash = vi.spyOn(crypto.subtle, "digest");
    const derive = vi.spyOn(analytics, "derivePersonalSecAnnualCanonicalView");
    const { model, read } = fixture();
    read.mockResolvedValue(response);
    model.subscribe(() => expectPair(model));
    model.open(selection);
    await model.load();
    const accepted = model.getSnapshot();
    expect(read.mock.calls[0]![0]).toEqual({
      schemaVersion: "6.0.0",
      catalogSnapshotSha256: selection.catalogSnapshotSha256,
      listingId: selection.listing.listingId,
      symbol: selection.listing.symbol,
    });
    expect(accepted.response).toBe(response);
    expect(accepted.view?.statements.statements).toHaveLength(3);
    expect(derive).toHaveBeenCalledExactlyOnceWith(response.evidence);
    expect(hash).not.toHaveBeenCalled();
    for (let index = 0; index < 4; index++)
      expect(model.getSnapshot()).toBe(accepted);
    expect(derive).toHaveBeenCalledTimes(1);
  });
  it("owns and validates an unmarked adapter packet before deriving", async () => {
    const response = await annualReportPacket();
    const mutable = structuredClone(response) as Mutable<typeof response>;
    const { model, read } = fixture();
    read.mockResolvedValue(mutable);
    model.open(selection);
    await model.load();
    const accepted = model.getSnapshot();
    expect(accepted.response).toEqual(response);
    expect(accepted.response).not.toBe(mutable);
    expect(
      Object.isFrozen(accepted.response?.evidence.facts.observations),
    ).toBe(true);
    mutable.evidence.facts.observations[0]!.value = "999";
    expect(accepted.response).toEqual(response);
    expectPair(model);
  });
  it("derives a seed exactly once and never recomputes for a retained failure", async () => {
    const response = await annualReportPacket();
    const derive = vi.spyOn(analytics, "derivePersonalSecAnnualCanonicalView");
    const { model, read } = fixture();
    model.open(selection, { response, showingPrevious: false });
    await settled(model);
    const pair = model.getSnapshot();
    expect(derive).toHaveBeenCalledExactlyOnceWith(pair.response!.evidence);
    read.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await model.load();
    expect(model.getSnapshot().response).toBe(pair.response);
    expect(model.getSnapshot().view).toBe(pair.view);
    expect(derive).toHaveBeenCalledTimes(1);
  });
  it.each([
    new TrialApiError("unavailable"),
    new ManagedAnnualReportError("request_timeout"),
  ])("retains the exact admitted pair after %s", async (error) => {
    const response = await annualReportPacket();
    const { model, read } = fixture();
    read.mockResolvedValueOnce(response).mockRejectedValueOnce(error);
    model.subscribe(() => expectPair(model));
    model.open(selection);
    await model.load();
    const accepted = model.getSnapshot();
    await model.load();
    expect(model.getSnapshot()).toMatchObject({
      showingPrevious: true,
      error: true,
    });
    expect(model.getSnapshot().response).toBe(accepted.response);
    expect(model.getSnapshot().view).toBe(accepted.view);
  });
  it.each([
    new TrialApiError("invalid_response"),
    new ManagedCatalogChangedError(),
    new ManagedSecCooldownError("not-a-date"),
  ])(
    "clears both packet and view on a non-retainable failure: %s",
    async (error) => {
      const { model, read } = fixture();
      read
        .mockResolvedValueOnce(await annualReportPacket())
        .mockRejectedValueOnce(error);
      model.open(selection);
      await model.load();
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        view: null,
        responseOrigin: null,
        error: true,
      });
    },
  );
  it("retains the exact pair through cooldown and blocks another read", async () => {
    const response = await annualReportPacket();
    const { model, read } = fixture();
    const deadline = new Date(Date.now() + 60_000).toISOString();
    read
      .mockResolvedValueOnce(response)
      .mockRejectedValueOnce(new ManagedSecCooldownError(deadline));
    model.open(selection);
    await model.load();
    const accepted = model.getSnapshot();
    await model.load();
    await model.load();
    expect(model.getSnapshot().response).toBe(accepted.response);
    expect(model.getSnapshot().view).toBe(accepted.view);
    expect(model.getSnapshot().message).toContain(deadline);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
    "retires both packet and view after %s",
    async (code) => {
      const { model, read, readError } = fixture();
      read
        .mockResolvedValueOnce(await annualReportPacket())
        .mockRejectedValueOnce(new TrialApiError(code));
      model.open(selection);
      await model.load();
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        selection: null,
        response: null,
        view: null,
      });
      expect(readError).toHaveBeenCalledOnce();
      model.open(selection);
      await model.load();
      expect(read).toHaveBeenCalledTimes(2);
    },
  );
  it.each([
    "derived-injection",
    "value-forgery",
    "generation-forgery",
    "identity",
    "version5",
  ] as const)(
    "rejects %s from an unowned adapter and clears the old pair",
    async (kind) => {
      const response = await annualReportPacket();
      const bad = structuredClone(response) as Mutable<typeof response>;
      if (kind === "derived-injection")
        Object.assign(bad.evidence, {
          cashGeneration: { resolution: { value: "999" } },
        });
      if (kind === "value-forgery")
        bad.evidence.facts.observations[0]!.value = "999";
      if (kind === "generation-forgery")
        bad.evidence.generation.sha256 = `sha256:${"f".repeat(64)}`;
      if (kind === "identity") bad.security.issuerName = "Changed issuer";
      if (kind === "version5") Object.assign(bad, { schemaVersion: "5.0.0" });
      const { model, read } = fixture();
      read.mockResolvedValueOnce(response).mockResolvedValueOnce(bad);
      model.open(selection);
      await model.load();
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        view: null,
        error: true,
        showingPrevious: false,
      });
    },
  );
  it.each(["cancel", "close", "retire", "replace"] as const)(
    "does not derive or publish after delayed adapter hashing and %s",
    async (action) => {
      const response = structuredClone(await annualReportPacket());
      const derive = vi.spyOn(
        analytics,
        "derivePersonalSecAnnualCanonicalView",
      );
      const { model, read } = fixture();
      read.mockResolvedValueOnce(response);
      model.open(selection);
      const held = holdHash();
      const loading = model.load();
      await vi.waitFor(() => expect(held.spy).toHaveBeenCalled());
      if (action === "replace")
        model.open({
          ...selection,
          listing: { ...selection.listing, listingId: "listing-other" },
        });
      else model[action]();
      const after = model.getSnapshot();
      held.release();
      await loading;
      expect(model.getSnapshot()).toBe(after);
      expect(after.response).toBeNull();
      expect(after.view).toBeNull();
      expect(derive).not.toHaveBeenCalled();
    },
  );
  it.each(["seed", "request"] as const)(
    "does not publish a view after synchronous retirement inside %s derivation",
    async (kind) => {
      const response = await annualReportPacket();
      const { model, read } = fixture();
      const derive = analytics.derivePersonalSecAnnualCanonicalView;
      vi.spyOn(
        analytics,
        "derivePersonalSecAnnualCanonicalView",
      ).mockImplementationOnce((evidence) => {
        model.retire();
        return derive(evidence);
      });
      if (kind === "seed") {
        model.open(selection, { response, showingPrevious: false });
        await settled(model);
      } else {
        read.mockResolvedValueOnce(response);
        model.open(selection);
        await model.load();
      }
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        view: null,
        selection: null,
      });
    },
  );
  it("refuses failed view derivation without retaining an old pair or publishing a new packet", async () => {
    const response = await annualReportPacket();
    const { model, read } = fixture();
    read.mockResolvedValue(response);
    model.open(selection);
    await model.load();
    // A new source admission needs a new projection; the old packet's view is cached.
    read.mockResolvedValueOnce(
      await annualReportPacket("left", { mode: "exact-decimal" }),
    );
    vi.spyOn(
      analytics,
      "derivePersonalSecAnnualCanonicalView",
    ).mockImplementationOnce(() => {
      throw new TypeError("Invalid projection");
    });
    await model.load();
    expect(model.getSnapshot()).toMatchObject({
      response: null,
      view: null,
      error: true,
    });
  });
  it("does not call an adapter after synchronous retirement during load publication", async () => {
    const { model, read } = fixture();
    model.open(selection);
    model.subscribe(() => {
      if (model.getSnapshot().running) model.retire();
    });
    await model.load();
    expect(read).not.toHaveBeenCalled();
    expect(model.getSnapshot()).toMatchObject({
      response: null,
      view: null,
      selection: null,
    });
  });
});

describe("canonical Annual identity and cancellation ownership", () => {
  it.each([
    "listingId",
    "symbol",
    "issuerId",
    "issuerName",
    "securityName",
    "country",
    "exchangeMic",
    "catalog",
    "cik",
  ] as const)(
    "checks %s against the full selection even for an already-owned response",
    async (field) => {
      const response = await annualReportPacket();
      const selected = {
        ...selection,
        listing: { ...selection.listing },
      };
      if (field === "catalog")
        selected.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
      else if (field === "cik") selected.cik = "0000000002";
      else Object.assign(selected.listing, { [field]: "DIFFERENT" });
      const derive = vi.spyOn(
        analytics,
        "derivePersonalSecAnnualCanonicalView",
      );
      const { model, read } = fixture();
      read.mockResolvedValueOnce(response);
      model.open(selected);
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        view: null,
        error: true,
      });
      expect(derive).not.toHaveBeenCalled();
    },
  );
  it("preserves a replacement visit opened synchronously by a cancelled request's abort listener", async () => {
    const response = await annualReportPacket();
    const { model, read } = fixture();
    let finish!: (value: PersonalSecAnnualCanonicalResponseDto) => void;
    read.mockImplementationOnce(
      (_request, signal) =>
        new Promise((resolve) => {
          finish = resolve;
          signal.addEventListener("abort", () =>
            model.open(selection, { response, showingPrevious: true }),
          );
        }),
    );
    model.open(selection);
    const loading = model.load();
    model.cancel();
    await settled(model);
    const accepted = model.getSnapshot();
    expect(accepted).toMatchObject({
      response,
      responseOrigin: "watchlist-comparison",
      showingPrevious: true,
    });
    expectPair(model);
    finish(response);
    await loading;
    expect(model.getSnapshot()).toBe(accepted);
  });
});
