import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  request,
  response,
  row,
} from "../features/research/sec-annual-evidence-fixture";
import {
  getPersonalSecAnnualRefusalReason,
  resolvePersonalSecAnnualEvidence,
  serializePersonalSecAnnualGeneration,
} from "@research-cockpit/personal-financial-analytics";
import type { PersonalSecAnnualResolutionInput } from "@research-cockpit/contracts";
import { parseSecAnnualEvidenceResponse } from "../lib/sec-annual-evidence-response";
import { ManagedAnnualReport as Panel } from "./ManagedAnnualReport";
import {
  ManagedAnnualReport,
  type AnnualReportSelection,
} from "./managed-annual-report";
import {
  ManagedAnnualCooldownError,
  ManagedAnnualReportError,
  ManagedCatalogChangedError,
  type ManagedApi,
} from "./managed-api";
import { TrialApiError } from "./api";
import { SecAnnualEvidenceResult } from "../features/research/SecAnnualEvidenceResult";
import {
  ManagedAnnualNoteAction,
  type ManagedAnnualNoteActions,
} from "./ManagedAnnualNoteAction";

const panelHooks = vi.hoisted(() => ({
  enabled: false,
  refs: [] as Array<{ current: unknown }>,
  index: 0,
  effects: [] as Array<() => void>,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useRef: (value: unknown) => {
      if (!panelHooks.enabled) return actual.useRef(value);
      const index = panelHooks.index++;
      return (panelHooks.refs[index] ??= { current: value });
    },
    useLayoutEffect: (
      effect: () => void,
      dependencies: React.DependencyList,
    ) => {
      if (panelHooks.enabled) panelHooks.effects.push(effect);
      else actual.useLayoutEffect(effect, dependencies);
    },
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      getSnapshot: () => unknown,
      getServerSnapshot: () => unknown,
    ) =>
      panelHooks.enabled
        ? getSnapshot()
        : actual.useSyncExternalStore(
            subscribe,
            getSnapshot,
            getServerSnapshot,
          ),
  };
});
interface ControlProps {
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}
function buttons(node: React.ReactNode): React.ReactElement<ControlProps>[] {
  if (!React.isValidElement<ControlProps>(node)) return [];
  return [
    ...(node.type === "button" ? [node] : []),
    ...React.Children.toArray(node.props.children).flatMap(buttons),
  ];
}

const selection: AnnualReportSelection = {
  catalogSnapshotSha256: request().catalogSnapshotSha256,
  origin: "discover",
  cik: "0000000001",
  listing: {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: "issuer-zero",
    issuerName: "Zero Company",
    listingId: "listing-zero",
    securityId: "security-zero",
    securityName: "Zero Class A",
    shareClassId: "class-zero",
    shareClassName: "Class A",
    symbol: "ZERO",
  },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const load = vi.fn<ManagedApi["annualReport"]>();
  const readError = vi.fn();
  const model = new ManagedAnnualReport(load, readError);
  return {
    model,
    load,
    readError,
    html: () => renderToStaticMarkup(<Panel model={model} />),
  };
}
afterEach(() => {
  vi.useRealTimers();
  panelHooks.enabled = false;
  panelHooks.refs = [];
  panelHooks.index = 0;
  panelHooks.effects = [];
});

const laterResponse = () =>
  response(
    [row("Revenues", "2000"), row("NetIncomeLoss", "300")],
    "2026-09-21T00:00:00.000Z",
  );

describe("managed annual refresh", () => {
  it("binds each note action to the displayed response and pair, including a captured older control", async () => {
    const { model, load } = fixture();
    const old = await response();
    const next = await laterResponse();
    load.mockResolvedValueOnce(old).mockResolvedValueOnce(next);
    model.open(selection);
    await model.load();
    const getAction = vi.fn<ManagedAnnualNoteActions["getAction"]>(() => ({
      canAppend: true,
      reason: null,
    }));
    const append = vi.fn<ManagedAnnualNoteActions["append"]>(() => ({
      appended: false,
      message: "Recheck the current report.",
    }));
    panelHooks.enabled = true;
    const actionFor = (report: typeof old) => {
      panelHooks.index = 0;
      const panel = Panel({
        model,
        noteActions: { getAction, append },
      }) as React.ReactElement<{ children?: React.ReactNode }>;
      const children = React.Children.toArray(panel?.props.children);
      const result = children.find(
        (node) =>
          React.isValidElement(node) && node.type === SecAnnualEvidenceResult,
      ) as React.ReactElement<
        React.ComponentProps<typeof SecAnnualEvidenceResult>
      >;
      expect(result.props.response).toBe(report);
      expect(result.key).toContain(report.evidence.generation.sha256.slice(7));
      const pair = report.evidence.resolution.bases.flatMap(
        (basis) => basis.pairs,
      )[0]!;
      const action = result.props.renderPairAction!(pair) as React.ReactElement<
        React.ComponentProps<typeof ManagedAnnualNoteAction>
      >;
      expect(action.type).toBe(ManagedAnnualNoteAction);
      expect(action.props.pair).toBe(pair);
      expect(getAction).toHaveBeenLastCalledWith(report, pair);
      return { action, pair, key: result.key };
    };
    const captured = actionFor(old);
    await model.load();
    const current = actionFor(next);
    expect(current.key).not.toBe(captured.key);
    captured.action.props.onAppend();
    expect(append).toHaveBeenLastCalledWith(old, captured.pair);
    current.action.props.onAppend();
    expect(append).toHaveBeenLastCalledWith(next, current.pair);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("focuses the heading on initial mount and loaded return without an implicit read", async () => {
    panelHooks.enabled = true;
    const { model, load } = fixture();
    const report = await response();
    load.mockResolvedValueOnce(report);
    const render = () => {
      panelHooks.index = 0;
      panelHooks.effects = [];
      return buttons(Panel({ model }));
    };
    model.open(selection);
    expect(render()[0]!.props.children).toBe("Load annual report");
    const initialFocus = vi.fn();
    panelHooks.refs[0]!.current = { focus: initialFocus };
    for (const effect of panelHooks.effects) effect();
    expect(initialFocus).toHaveBeenCalledOnce();
    expect(load).not.toHaveBeenCalled();
    await model.load();
    const retained = model.getSnapshot().response;
    // A section return mounts fresh refs around the existing model response.
    panelHooks.refs = [];
    expect(render()[0]!.props.children).toBe("Refresh annual report");
    const returnFocus = vi.fn();
    panelHooks.refs[0]!.current = { focus: returnFocus };
    for (const effect of panelHooks.effects) effect();
    expect(returnFocus).toHaveBeenCalledOnce();
    expect(model.getSnapshot().response).toBe(retained);
    expect(load).toHaveBeenCalledOnce();
  });
  it.each([
    new TrialApiError("unavailable"),
    new ManagedAnnualReportError("request_timeout"),
  ])(
    "keeps a first-load failure empty without claiming previous evidence %#",
    async (error) => {
      const { model, load, html } = fixture();
      load.mockRejectedValueOnce(error);
      model.open(selection);
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        showingPrevious: false,
        running: false,
        error: true,
      });
      expect(html()).toContain("Load annual report");
      expect(html()).not.toContain("Showing the previous report");
      expect(html()).not.toContain("Observed annual report</h3>");
      expect(load).toHaveBeenCalledOnce();
    },
  );
  it.each([
    ["unavailable", new TrialApiError("unavailable"), "refresh failed"],
    [
      "timeout",
      new ManagedAnnualReportError("request_timeout"),
      "refresh timed out",
    ],
  ] as const)(
    "retains exact previous evidence through a pending refresh and %s, then explicitly replaces it",
    async (_name, error, message) => {
      const { model, load, html } = fixture();
      const old = await response();
      const oldBytes = JSON.stringify(old);
      const next = await laterResponse();
      const held = deferred<typeof old>();
      load
        .mockResolvedValueOnce(old)
        .mockReturnValueOnce(held.promise)
        .mockResolvedValueOnce(next);
      model.open(selection);
      await model.load();
      const pending = model.load();
      await model.load();
      expect(load).toHaveBeenCalledTimes(2);
      expect(model.getSnapshot()).toMatchObject({
        response: old,
        running: true,
        showingPrevious: true,
      });
      expect(model.getSnapshot().response).toBe(old);
      expect(html()).toContain("Refreshing annual report");
      expect(html()).toContain(
        "Showing the previous report, completed 2026-09-20T00:00:02.000Z",
      );
      expect(html()).toContain(old.evidence.generation.sha256);
      expect(html()).toContain(">1000</dd>");
      held.reject(error);
      await pending;
      expect(model.getSnapshot()).toMatchObject({
        response: old,
        running: false,
        showingPrevious: true,
        error: true,
      });
      expect(JSON.stringify(model.getSnapshot().response)).toBe(oldBytes);
      expect(html()).toContain(message);
      expect(html()).toContain("This refresh has not confirmed newer evidence");
      expect(load).toHaveBeenCalledTimes(2);
      await model.load();
      expect(load).toHaveBeenCalledTimes(3);
      expect(model.getSnapshot()).toMatchObject({
        response: next,
        showingPrevious: false,
        error: false,
      });
      expect(html()).toContain(next.evidence.generation.sha256);
      expect(html()).toContain("2026-09-21T00:00:02.000Z");
      expect(html()).toContain(">2000</dd>");
      expect(html()).not.toContain(old.evidence.generation.sha256);
      expect(html()).not.toContain("Showing the previous report");
    },
  );

  it("retains previous evidence through shared cooldown without an automatic retry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00.000Z"));
    const { model, load, html } = fixture();
    const old = await response();
    load
      .mockResolvedValueOnce(old)
      .mockRejectedValueOnce(
        new ManagedAnnualCooldownError("2026-10-01T00:00:20.000Z"),
      )
      .mockResolvedValueOnce(await laterResponse());
    model.open(selection);
    await model.load();
    await model.load();
    expect(model.getSnapshot().response).toBe(old);
    expect(html()).toContain("Refresh deferred.");
    expect(html()).toContain(old.evidence.generation.sha256);
    await model.load();
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(load).toHaveBeenCalledTimes(2);
    await model.load();
    expect(load).toHaveBeenCalledTimes(3);
    expect(model.getSnapshot().showingPrevious).toBe(false);
  });

  it.each(["success", "authentication", "catalog"] as const)(
    "keeps the old report on Cancel and discards late %s after a newer load",
    async (late) => {
      const { model, load, readError, html } = fixture();
      const old = await response();
      const next = await laterResponse();
      const held = deferred<typeof old>();
      load
        .mockResolvedValueOnce(old)
        .mockReturnValueOnce(held.promise)
        .mockResolvedValueOnce(next);
      model.open(selection);
      await model.load();
      const pending = model.load();
      model.cancel();
      expect(load.mock.calls[1]![1].aborted).toBe(true);
      expect(model.getSnapshot().response).toBe(old);
      expect(model.getSnapshot().showingPrevious).toBe(true);
      expect(html()).toContain("refresh cancelled");
      expect(html()).toContain(old.evidence.generation.sha256);
      await model.load();
      if (late === "success") held.resolve(old);
      else
        held.reject(
          late === "authentication"
            ? new TrialApiError("unauthenticated")
            : new ManagedCatalogChangedError(),
        );
      await pending;
      expect(model.getSnapshot()).toMatchObject({
        response: next,
        showingPrevious: false,
        running: false,
        catalogChanged: false,
      });
      expect(readError).not.toHaveBeenCalled();
      expect(load).toHaveBeenCalledTimes(3);
    },
  );

  it.each([
    ["invalid response", new TrialApiError("invalid_response")],
    ["not configured", new ManagedAnnualReportError("not_configured")],
    ["unknown error", new Error("unavailable")],
    ["unknown object", { code: "unavailable" }],
    ["unexpected abort", new TrialApiError("aborted")],
    ["catalog changed", new ManagedCatalogChangedError()],
    ["authentication", new TrialApiError("unauthenticated")],
    ["access denial", new TrialApiError("access_denied")],
    ["origin denial", new TrialApiError("origin_denied")],
  ] as const)("clears previous evidence for %s", async (_name, error) => {
    const { model, load, html } = fixture();
    const old = await response();
    load.mockResolvedValueOnce(old).mockRejectedValueOnce(error);
    model.open(selection);
    await model.load();
    await model.load();
    expect(model.getSnapshot()).toMatchObject({
      response: null,
      showingPrevious: false,
      running: false,
    });
    expect(html()).not.toContain(old.evidence.generation.sha256);
    expect(html()).not.toContain("Showing the previous report");
  });

  it("clears previous evidence when a newer response has the wrong identity", async () => {
    const { model, load, html } = fixture();
    const old = await response();
    const next = await laterResponse();
    load.mockResolvedValueOnce(old).mockResolvedValueOnce({
      ...next,
      security: { ...next.security, listingId: "other" },
    });
    model.open(selection);
    await model.load();
    await model.load();
    expect(model.getSnapshot()).toMatchObject({
      response: null,
      showingPrevious: false,
    });
    expect(html()).toContain("could not be validated");
  });

  it.each(["close", "retire", "selection"] as const)(
    "clears retained refresh evidence on %s and ignores its late result",
    async (action) => {
      const { model, load } = fixture();
      const held = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
      load
        .mockResolvedValueOnce(await response())
        .mockReturnValueOnce(held.promise);
      model.open(selection);
      await model.load();
      const pending = model.load();
      if (action === "selection")
        model.open({
          ...selection,
          listing: { ...selection.listing, symbol: "OTHER" },
        });
      else model[action]();
      expect(load.mock.calls[1]![1].aborted).toBe(true);
      held.resolve(await laterResponse());
      await pending;
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        showingPrevious: false,
        running: false,
      });
      expect(load).toHaveBeenCalledTimes(2);
    },
  );

  it("replaces previous good metrics with a validated newer source-unavailable response", async () => {
    const { model, load, html } = fixture();
    const old = await response();
    const next = await laterResponse();
    let input: PersonalSecAnnualResolutionInput = {
      ...next.evidence,
      observations: [],
      coverage: null,
      generation: {
        ...next.evidence.generation,
        sources: {
          ...next.evidence.generation.sources,
          companyFacts: {
            ...next.evidence.generation.sources.companyFacts,
            status: "upstream_unavailable",
            fetchedAt: null,
            bytes: null,
            sha256: null,
          },
        },
      },
    };
    const reason = getPersonalSecAnnualRefusalReason(input);
    if (reason === null) throw new Error("Expected unavailable evidence");
    input = { ...input, completeness: { status: "refused", reason } };
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(serializePersonalSecAnnualGeneration(input)),
    );
    input = {
      ...input,
      generation: {
        ...input.generation,
        sha256: `sha256:${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
      },
    };
    const wire = {
      ...next,
      evidence: {
        ...input,
        resolution: resolvePersonalSecAnnualEvidence(input),
      },
    };
    const admitted = await parseSecAnnualEvidenceResponse(
      wire,
      request(),
      new AbortController().signal,
    );
    expect(admitted).not.toBeNull();
    if (!admitted) throw new Error("Expected admitted unavailable evidence");
    load.mockResolvedValueOnce(old).mockResolvedValueOnce(admitted);
    model.open(selection);
    await model.load();
    await model.load();
    expect(model.getSnapshot()).toMatchObject({
      response: admitted,
      showingPrevious: false,
    });
    expect(html()).toContain("SEC source temporarily unavailable");
    expect(html()).not.toContain("Net margin · %</dt>");
    expect(html()).not.toContain(old.evidence.generation.sha256);
    expect(html()).not.toContain("Showing the previous report");
  });
});

describe("managed annual read", () => {
  it("opens without loading, captures its selection and renders the shared report after explicit Load", async () => {
    const { model, load, html } = fixture();
    const input = structuredClone(selection);
    model.open(input);
    expect(load).not.toHaveBeenCalled();
    expect(html()).toContain("Load annual report");
    expect(html()).toContain("Annual report");
    Object.assign(input.listing, { symbol: "MUTATED" });
    load.mockResolvedValue(await response());
    await model.load();
    expect(load).toHaveBeenCalledExactlyOnceWith(
      request(),
      expect.any(AbortSignal),
    );
    expect(html()).toContain("Refresh annual report");
    expect(html()).toContain("Inspect selected-report evidence");
  });

  it("coalesces duplicate loads, aborts on Cancel and fences an uncooperative late result", async () => {
    const { model, load, html } = fixture();
    const held = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
    load.mockReturnValue(held.promise);
    model.open(selection);
    const pending = model.load();
    await model.load();
    expect(load).toHaveBeenCalledOnce();
    expect(html()).toContain("Cancel annual report");
    model.cancel();
    expect(load.mock.calls[0]![1].aborted).toBe(true);
    held.resolve(await response());
    await pending;
    expect(model.getSnapshot().response).toBeNull();
    expect(html()).toContain("cancelled");
  });

  it("fences A-to-B-to-A responses and Back discards the report", async () => {
    const { model, load } = fixture();
    const held = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
    load.mockReturnValueOnce(held.promise);
    model.open(selection);
    const pending = model.load();
    model.open({
      ...selection,
      listing: { ...selection.listing, symbol: "OTHER" },
    });
    model.open(selection);
    held.resolve(await response());
    await pending;
    expect(model.getSnapshot().response).toBeNull();
    load.mockResolvedValue(await response());
    await model.load();
    model.close();
    expect(model.getSnapshot().selection).toBeNull();
    expect(model.getSnapshot().response).toBeNull();
  });

  it.each([
    "issuerId",
    "issuerName",
    "securityName",
    "country",
    "exchangeMic",
    "listingId",
    "symbol",
    "cik",
  ] as const)("rejects changed selected identity %s", async (field) => {
    const { model, load } = fixture();
    const wire = await response();
    load.mockResolvedValue({
      ...wire,
      security: { ...wire.security, [field]: "OTHER" },
    });
    model.open(selection);
    await model.load();
    expect(model.getSnapshot().response).toBeNull();
    expect(model.getSnapshot().message).toContain("could not be validated");
  });

  it("keeps shared cooldown across selection changes, and only an explicit later Load retries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00.000Z"));
    const { model, load } = fixture();
    load.mockRejectedValueOnce(
      new ManagedAnnualCooldownError("2026-10-01T00:00:20.000Z"),
    );
    model.open(selection);
    await model.load();
    expect(model.getSnapshot().message).toContain("2026-10-01T00:00:20.000Z");
    model.close();
    model.open(selection);
    await model.load();
    expect(load).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(load).toHaveBeenCalledOnce();
    load.mockResolvedValue(await response());
    await model.load();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("requires a new selection after catalog_changed", async () => {
    const { model, load, html } = fixture();
    load.mockRejectedValue(new ManagedCatalogChangedError());
    model.open(selection);
    await model.load();
    await model.load();
    expect(load).toHaveBeenCalledOnce();
    expect(html()).toContain("Refresh the catalog");
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*>Load annual report<\/button>/u,
    );
    expect(html()).toContain(
      "Refresh the catalog and choose the company again.",
    );
  });

  it.each(["unauthenticated", "access_denied"] as const)(
    "retires synchronously for %s",
    async (code) => {
      const { model, load, readError } = fixture();
      load.mockRejectedValue(new TrialApiError(code));
      model.open(selection);
      await model.load();
      expect(readError).toHaveBeenCalledExactlyOnceWith(
        new TrialApiError(code),
      );
      expect(model.getSnapshot().selection).toBeNull();
      model.open(selection);
      await model.load();
      expect(load).toHaveBeenCalledOnce();
    },
  );

  it("retirement clears immediately and a late auth failure does not retire another session", async () => {
    const { model, load, readError } = fixture();
    const held = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
    load.mockReturnValue(held.promise);
    model.open(selection);
    const pending = model.load();
    model.retire();
    expect(load.mock.calls[0]![1].aborted).toBe(true);
    expect(model.getSnapshot().selection).toBeNull();
    held.reject(new TrialApiError("unauthenticated"));
    await pending;
    expect(readError).not.toHaveBeenCalled();
  });
});
