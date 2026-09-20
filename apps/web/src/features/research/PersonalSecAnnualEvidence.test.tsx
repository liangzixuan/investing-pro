import type {
  PersonalSecAnnualEvidenceRequestDto,
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualResolutionInput,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import {
  resolvePersonalSecAnnualEvidence,
  serializePersonalSecAnnualGeneration,
} from "@research-cockpit/personal-financial-analytics";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import {
  PersonalSecAnnualEvidence,
  type PersonalSecAnnualEvidenceProps,
} from "./PersonalSecAnnualEvidence";
const api = vi.hoisted(() => ({ fetchPersonalSecAnnualEvidence: vi.fn() }));
vi.mock("../../lib/personal-sec-annual-evidence-api", () => api);
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => harness.useState(initial),
  useRef: <T,>(initial: T) => harness.useRef(initial),
  useEffect: (
    effect: () => (() => void) | void,
    deps: readonly unknown[] | undefined,
  ) => harness.useEffect(effect, deps),
}));
let props: PersonalSecAnnualEvidenceProps;
beforeEach(async () => {
  harness.reset();
  api.fetchPersonalSecAnnualEvidence
    .mockReset()
    .mockResolvedValue(await response());
  props = {
    enabled: true,
    catalogSnapshotSha256: request().catalogSnapshotSha256,
    selection: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Company",
      listingId: "listing-zero",
      securityName: "Zero Class A",
      symbol: "ZERO",
    },
    onSessionUnavailable: vi.fn(),
  };
  const body = {};
  vi.stubGlobal("document", { body, activeElement: body });
});
afterEach(() => {
  harness.unmount();
  vi.unstubAllGlobals();
});

describe("PersonalSecAnnualEvidence", () => {
  it("waits for explicit Load and renders exact three-basis results, dates and evidence separately", async () => {
    api.fetchPersonalSecAnnualEvidence.mockResolvedValue(
      await response([
        row("Revenues", "1000"),
        row("SalesRevenueNet", "900"),
        row("RevenueFromContractWithCustomerExcludingAssessedTax", "950"),
        row("NetIncomeLoss", "-25"),
      ]),
    );
    await mount();
    expect(api.fetchPersonalSecAnnualEvidence).not.toHaveBeenCalled();
    const first = render();
    click(first, "Load observed annual report");
    click(first, "Load observed annual report");
    await flush();
    const view = render();
    expect(api.fetchPersonalSecAnnualEvidence).toHaveBeenCalledExactlyOnceWith(
      request(),
      expect.any(AbortSignal),
    );
    expect(text(view)).toContain(
      "Complete for the four requested USD concepts",
    );
    expect(text(view)).toContain(
      "At least one same-report annual pair is valid",
    );
    expect(text(view)).toContain("2025-01-01 to 2025-12-31");
    expect(text(view)).toContain("Net income · USD -25");
    expect(text(view)).toContain("Net margin · % -2.5");
    expect(
      elements(view).filter((e) =>
        String(e.props["aria-label"]).startsWith("Annual revenue basis "),
      ),
    ).toHaveLength(3);
    expect(text(view)).toMatch(
      /Inspect selected-report evidence \(\s*4 observations\)/u,
    );
    expect(text(view)).toContain("Filing focus, not observation year");
    expect(
      elements(view).filter((e) => e.type === "a")[0]?.props,
    ).toMatchObject({ target: "_blank", rel: "noopener noreferrer" });
  });

  it.each(["disabled", "no selection"])(
    "does not load when %s",
    async (kind) => {
      props = {
        ...props,
        enabled: kind !== "disabled",
        selection: kind === "no selection" ? null : props.selection,
      };
      const view = await mount();
      expect(elements(view).filter((e) => e.type === "button")).toHaveLength(0);
      expect(api.fetchPersonalSecAnnualEvidence).not.toHaveBeenCalled();
    },
  );

  it("does not mistake complete evidence with missing income for a valid or current pair", async () => {
    api.fetchPersonalSecAnnualEvidence.mockResolvedValue(
      await response([row()]),
    );
    await load();
    const content = text(render());
    expect(content).toContain("Complete for the four requested USD concepts");
    expect(content).toContain("No valid annual pair");
    expect(content).toContain(
      "NetIncomeLoss is missing for this filing and exact period",
    );
    expect(content).toContain("Unavailable under the current-use policy");
    expect(content).not.toContain("Net margin · % 0");
  });

  it("identifies each asymmetric source status when annual evidence is refused", async () => {
    const wire = await response();
    const evidence: PersonalSecAnnualResolutionInput = {
      ...wire.evidence,
      generation: {
        ...wire.evidence.generation,
        sources: {
          ...wire.evidence.generation.sources,
          companyFacts: {
            ...wire.evidence.generation.sources.companyFacts,
            status: "rate_limited",
            fetchedAt: null,
            bytes: null,
            sha256: null,
          },
        },
      },
      completeness: { status: "refused", reason: "source_unavailable" },
      coverage: null,
      observations: [],
    };
    api.fetchPersonalSecAnnualEvidence.mockResolvedValue({
      ...wire,
      evidence: {
        ...evidence,
        resolution: resolvePersonalSecAnnualEvidence(evidence),
      },
    });
    await load();
    const view = render();
    const sourceGroups = elements(view).filter(
      (element) =>
        element.type === "div" &&
        element.props.className === "sec-quarterly-message" &&
        text(element).includes("Source status"),
    );
    expect(sourceGroups).toHaveLength(2);
    expect(text(sourceGroups[0])).toContain(
      "Company Facts Source status SEC request rate limited",
    );
    expect(text(sourceGroups[1])).toContain(
      "Current submissions Source status Available",
    );
    expect(text(view)).toContain("A required SEC source is unavailable");
    expect(text(view)).not.toContain("Net margin · %");
  });

  it("exposes conflicted signed inputs without presenting an admitted numeric margin", async () => {
    api.fetchPersonalSecAnnualEvidence.mockResolvedValue(
      await response([
        row(),
        row("Revenues", "1001", { frame: null }),
        row("NetIncomeLoss", "0"),
      ]),
    );
    await load();
    const view = render();
    expect(text(view)).toContain(
      "Revenue has conflicting values or annual start dates",
    );
    expect(text(view)).toContain("1001 USD");
    expect(text(view)).toContain("0 USD");
    expect(text(view)).not.toContain("Net margin · %");
  });

  it("keeps all comparative evidence, exact long values and escaped issuer text inspectable", async () => {
    const selection = {
      ...props.selection!,
      issuerName: "<script>alert(1)</script>",
    };
    props = { ...props, selection };
    const wire = await response([
      row("Revenues", "12345678901234567890.12"),
      row("NetIncomeLoss", "100"),
      row("Revenues", "9", {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        durationDays: 366,
      }),
    ]);
    api.fetchPersonalSecAnnualEvidence.mockResolvedValue({
      ...wire,
      security: { ...wire.security, issuerName: selection.issuerName },
    });
    await load();
    const view = render();
    expect(text(view)).toContain("2024-01-01 to 2024-12-31");
    expect(text(view)).toContain("12345678901234567890.12 USD");
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).not.toContain("<script>");
    expect(
      elements(view)
        .filter((e) => e.type === "details")
        .every((e) => !Object.hasOwn(e.props, "open")),
    ).toBe(true);
  });

  it("retires prior values/disclosures immediately on refresh and rejects cancelled late completion", async () => {
    await load();
    const previous = render();
    const held = deferred<Wire>();
    api.fetchPersonalSecAnnualEvidence.mockReturnValueOnce(held.promise);
    click(previous, "Refresh annual report");
    const pending = render();
    expect(text(pending)).not.toContain("Inspect selected-report evidence");
    expect(text(pending)).not.toContain("Net margin · %");
    const abort = api.fetchPersonalSecAnnualEvidence.mock
      .calls[1]?.[1] as AbortSignal;
    cancel(pending);
    expect(abort.aborted).toBe(true);
    held.resolve(await response());
    await flush();
    expect(text(render())).toContain("Annual report load cancelled");
    expect(text(render())).not.toContain("Inspect selected-report evidence");
  });

  it("restores focus after an intentional Cancel only when the same visible control remains current", async () => {
    const held = deferred<Wire>();
    api.fetchPersonalSecAnnualEvidence.mockReturnValueOnce(held.promise);
    await mount();
    click(render(), "Load observed annual report");
    const pending = render();
    const main = button(
      pending,
      "Loading annual report…",
    ) as React.ReactElement<Record<string, unknown>>;
    const focus = vi.fn();
    (main.props.ref as { current: unknown }).current = {
      isConnected: true,
      closest: () => null,
      focus,
    };
    cancel(pending, true);
    render();
    expect(focus).toHaveBeenCalledOnce();
    held.resolve(await response());
    await flush();
    expect(focus).toHaveBeenCalledOnce();
  });

  it("does not steal focus from another control or a hidden section after Cancel", async () => {
    const held = deferred<Wire>();
    api.fetchPersonalSecAnnualEvidence.mockReturnValueOnce(held.promise);
    await mount();
    click(render(), "Load observed annual report");
    const pending = render();
    const main = button(
      pending,
      "Loading annual report…",
    ) as React.ReactElement<Record<string, unknown>>;
    const focus = vi.fn();
    (main.props.ref as { current: unknown }).current = {
      isConnected: true,
      closest: () => ({}),
      focus,
    };
    cancel(pending, true);
    render();
    expect(focus).not.toHaveBeenCalled();
  });

  it.each([
    "catalog",
    "enabled",
    "issuerName",
    "securityName",
    "issuerId",
    "exchangeMic",
    "listingId",
    "symbol",
  ])(
    "retires responses and retained handlers on changed %s even before effects",
    async (field) => {
      const held = deferred<Wire>();
      api.fetchPersonalSecAnnualEvidence.mockReturnValueOnce(held.promise);
      await mount();
      const old = render();
      click(old, "Load observed annual report");
      if (field === "catalog")
        props = { ...props, catalogSnapshotSha256: `sha256:${"d".repeat(64)}` };
      else if (field === "enabled") props = { ...props, enabled: false };
      else
        props = {
          ...props,
          selection: { ...props.selection!, [field]: "DIFFERENT" },
        };
      render(false);
      click(old, "Load observed annual report");
      held.resolve(await response());
      await flush();
      expect(text(render(false))).not.toContain(
        "Inspect selected-report evidence",
      );
      expect(api.fetchPersonalSecAnnualEvidence).toHaveBeenCalledOnce();
      harness.effects();
      expect(
        (api.fetchPersonalSecAnnualEvidence.mock.calls[0]?.[1] as AbortSignal)
          .aborted,
      ).toBe(true);
    },
  );

  it("rejects an A-to-B-to-A late response and an old Cancel from an earlier operation", async () => {
    const original = props;
    const held = deferred<Wire>();
    api.fetchPersonalSecAnnualEvidence.mockReturnValueOnce(held.promise);
    await mount();
    click(render(), "Load observed annual report");
    const staleCancel = render();
    props = { ...props, enabled: false };
    render(false);
    props = original;
    render();
    render();
    held.resolve(await response());
    await flush();
    expect(text(render())).not.toContain("Inspect selected-report evidence");
    const next = deferred<Wire>();
    api.fetchPersonalSecAnnualEvidence.mockReturnValueOnce(next.promise);
    click(render(), "Load observed annual report");
    cancel(staleCancel);
    expect(
      (api.fetchPersonalSecAnnualEvidence.mock.calls[1]?.[1] as AbortSignal)
        .aborted,
    ).toBe(false);
  });

  it("retains native disclosure keys on equal-content renders without another load", async () => {
    await load();
    const first = elements(render()).find((e) => typeof e.type === "function");
    props = { ...props, selection: { ...props.selection! } };
    const second = elements(render()).find((e) => typeof e.type === "function");
    expect(second?.key).toBe(first?.key);
    expect(api.fetchPersonalSecAnnualEvidence).toHaveBeenCalledOnce();
  });

  it("aborts on unmount, rejects late results and permits explicit load after StrictMode effect replay", async () => {
    await mount();
    harness.replay();
    render();
    click(render(), "Load observed annual report");
    await flush();
    expect(text(render())).toContain("Inspect selected-report evidence");
    const held = deferred<Wire>();
    api.fetchPersonalSecAnnualEvidence.mockReturnValueOnce(held.promise);
    click(render(), "Refresh annual report");
    harness.unmount();
    held.resolve(await response());
    await flush();
    expect(
      (api.fetchPersonalSecAnnualEvidence.mock.calls[1]?.[1] as AbortSignal)
        .aborted,
    ).toBe(true);
    expect(text(render(false))).not.toContain(
      "Inspect selected-report evidence",
    );
  });

  it.each([
    "issuerName",
    "securityName",
    "issuerId",
    "country",
    "exchangeMic",
    "listingId",
    "symbol",
  ])("rejects a mismatched response identity: %s", async (field) => {
    const wire = await response();
    api.fetchPersonalSecAnnualEvidence.mockResolvedValue({
      ...wire,
      security: { ...wire.security, [field]: "OTHER" },
    });
    await load();
    expect(text(render())).toContain("could not be validated");
    expect(text(render())).not.toContain("Inspect selected-report evidence");
  });

  it("reports session loss once and does not retry", async () => {
    api.fetchPersonalSecAnnualEvidence.mockRejectedValue(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    await load();
    expect(props.onSessionUnavailable).toHaveBeenCalledOnce();
    expect(text(render())).toContain("owner session expired");
    expect(api.fetchPersonalSecAnnualEvidence).toHaveBeenCalledOnce();
  });
});

async function load() {
  await mount();
  click(render(), "Load observed annual report");
  await flush();
}
function cancel(view: unknown, focused = false) {
  const origin = { isConnected: true };
  if (focused) Object.assign(document, { activeElement: origin });
  const found = elements(view).find(
    (e) => e.type === "button" && text(e) === "Cancel annual report",
  );
  if (!found) throw new Error("Missing Cancel");
  (found.props.onClick as (event: { currentTarget: unknown }) => void)({
    currentTarget: origin,
  });
}

type Wire = PersonalSecAnnualEvidenceResponseDto;
function request(): PersonalSecAnnualEvidenceRequestDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    listingId: "listing-zero",
    symbol: "ZERO",
  };
}
function row(
  concept: PersonalSecQuarterlyObservationDto["concept"] = "Revenues",
  value = "1000",
  changes: Partial<PersonalSecQuarterlyObservationDto> = {},
): PersonalSecQuarterlyObservationDto {
  return {
    id: `sec-fact:${"0".repeat(64)}`,
    metric: concept === "NetIncomeLoss" ? "net_income" : "revenue",
    taxonomy: "us-gaap",
    concept,
    unit: "USD",
    value,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    durationDays: 365,
    periodBasis: "unresolved",
    filingFocusYear: 2025,
    filingFocusPeriod: "FY",
    frame: "CY2025",
    accessionNumber: "0000000001-26-000001",
    form: "10-K",
    filedDate: "2026-02-01",
    sourceLocator: `/facts/us-gaap/${concept}/units/USD/0`,
    filing: {
      status: "matched",
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-12-31",
      acceptedAt: "2026-02-01T00:00:00.000Z",
      sourceUrl:
        "https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm",
    },
    ...changes,
  };
}
async function hash(value: string): Promise<`sha256:${string}`> {
  return `sha256:${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
async function response(
  rows = [row(), row("NetIncomeLoss", "100")],
): Promise<Wire> {
  const observations = await Promise.all(
    rows.map(async (item) => {
      const fields = Object.fromEntries(
        Object.entries(item).filter(
          ([key]) => !["id", "sourceLocator", "filing"].includes(key),
        ),
      );
      return {
        ...item,
        id: `sec-fact:${(await hash(JSON.stringify(fields))).slice(7)}` as const,
      };
    }),
  );
  observations.sort(
    (a, b) =>
      b.endDate.localeCompare(a.endDate) ||
      (b.startDate ?? "").localeCompare(a.startDate ?? "") ||
      b.filedDate.localeCompare(a.filedDate) ||
      a.accessionNumber.localeCompare(b.accessionNumber) ||
      a.concept.localeCompare(b.concept) ||
      a.id.localeCompare(b.id),
  );
  const counts = {
    observations: observations.length,
    revenue: observations.filter((o) => o.metric === "revenue").length,
    netIncome: observations.filter((o) => o.metric === "net_income").length,
  };
  const zero = { observations: 0, revenue: 0, netIncome: 0 };
  const input: PersonalSecAnnualResolutionInput = {
    cik: "0000000001",
    generation: {
      definitionVersion: "1.0.0",
      cutoffAt: "2026-09-20T00:00:00.000Z",
      completedAt: "2026-09-20T00:00:02.000Z",
      sha256: `sha256:${"0".repeat(64)}`,
      sources: {
        companyFacts: {
          status: "available",
          sourceUrl:
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
          fetchedAt: "2026-09-20T00:00:01.000Z",
          bytes: 1000,
          sha256: `sha256:${"b".repeat(64)}`,
        },
        submissions: {
          status: "available",
          sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
          fetchedAt: "2026-09-20T00:00:02.000Z",
          bytes: 500,
          sha256: `sha256:${"c".repeat(64)}`,
        },
      },
    },
    target: {
      status: "target",
      accessionNumber: "0000000001-26-000001",
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-12-31",
      acceptedAt: "2026-02-01T00:00:00.000Z",
    },
    targetScan: {
      currentFilings: 1,
      annualFilings: 1,
      olderHistoryAvailable: false,
    },
    completeness: { status: "complete", reason: null },
    coverage: {
      full: {
        ...counts,
        inspectedRows: observations.length,
        invalidRows: 0,
        duplicateRows: 0,
        uniqueObservations: observations.length,
        conceptsWithoutUsd: [],
      },
      selected: counts,
      otherAccessions: zero,
      returned: counts,
      omittedSelected: zero,
      history: { returned: counts, truncated: false },
    },
    observations,
  };
  const generation = {
    ...input.generation,
    sha256: await hash(serializePersonalSecAnnualGeneration(input)),
  };
  const evidence = { ...input, generation };
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: request().catalogSnapshotSha256,
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Company",
      listingId: "listing-zero",
      securityName: "Zero Class A",
      symbol: "ZERO",
      cik: "0000000001",
    },
    evidence: {
      ...evidence,
      resolution: resolvePersonalSecAnnualEvidence(evidence),
    },
  };
}

const harness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const dependencies: Array<readonly unknown[] | undefined> = [];
  const cleanup = new Map<number, () => void>();
  const setups = new Map<number, () => (() => void) | void>();
  let pending: Array<() => void> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  return {
    reset() {
      states.splice(0);
      refs.splice(0);
      dependencies.splice(0);
      cleanup.clear();
      setups.clear();
      pending = [];
    },
    begin() {
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    effects() {
      const effects = pending;
      pending = [];
      effects.forEach((effect) => effect());
    },
    replay() {
      cleanup.forEach((fn) => fn());
      cleanup.clear();
      setups.forEach((fn, index) => {
        const returned = fn();
        if (returned) cleanup.set(index, returned);
      });
    },
    unmount() {
      cleanup.forEach((fn) => fn());
      cleanup.clear();
    },
    useEffect(
      effect: () => (() => void) | void,
      next: readonly unknown[] | undefined,
    ) {
      const index = effectIndex++;
      const previous = dependencies[index];
      if (
        previous !== undefined &&
        next !== undefined &&
        previous.length === next.length &&
        next.every((item, i) => Object.is(item, previous[i]))
      )
        return;
      dependencies[index] = next;
      setups.set(index, effect);
      pending.push(() => {
        cleanup.get(index)?.();
        const returned = effect();
        if (returned) cleanup.set(index, returned);
      });
    },
    useRef<T>(initial: T) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (next: unknown) => {
          states[index] =
            typeof next === "function"
              ? (next as (previous: unknown) => unknown)(states[index])
              : next;
        },
      ];
    },
  };
});
function render(runEffects = true) {
  harness.begin();
  const view = PersonalSecAnnualEvidence(props);
  if (runEffects) harness.effects();
  return view;
}
async function mount() {
  render();
  await flush();
  return render();
}
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value))
    return value.map(text).join(" ").replace(/\s+/gu, " ");
  if (!React.isValidElement(value)) return "";
  const element = value as React.ReactElement<Record<string, unknown>>;
  return typeof element.type === "function"
    ? text(Reflect.apply(element.type, undefined, [element.props]) as unknown)
    : text(element.props.children);
}
function elements(
  value: unknown,
): Array<React.ReactElement<Record<string, unknown>>> {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement(value)) return [];
  const element = value as React.ReactElement<Record<string, unknown>>;
  return [
    element,
    ...elements(
      typeof element.type === "function"
        ? (Reflect.apply(element.type, undefined, [element.props]) as unknown)
        : element.props.children,
    ),
  ];
}
function button(value: unknown, label: string) {
  const found = elements(value).find(
    (element) => element.type === "button" && text(element) === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found as React.ReactElement<{
    disabled?: boolean;
    onClick?: () => void;
  }>;
}
function click(value: unknown, label: string) {
  button(value, label).props.onClick?.();
}
