import type { PersonalFilingMonitorDto } from "@research-cockpit/contracts";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import {
  PersonalFilingMonitor,
  type PersonalFilingMonitorProps,
} from "./PersonalFilingMonitor";
const api = vi.hoisted(() => ({
  fetchPersonalFilingMonitor: vi.fn(),
  configurePersonalFilingMonitor: vi.fn(),
  pausePersonalFilingMonitor: vi.fn(),
  resetPersonalFilingMonitor: vi.fn(),
  acknowledgePersonalFilingMonitor: vi.fn(),
  validatePersonalFilingMonitorBinding: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => harness.useState(initial),
  useRef: <T,>(initial: T) => harness.useRef(initial),
  useEffect: (
    effect: () => (() => void) | void,
    deps: readonly unknown[] | undefined,
  ) => harness.useEffect(effect, deps),
}));
vi.mock("../../lib/personal-filing-monitor-api", () => api);
let props: PersonalFilingMonitorProps;
beforeEach(() => {
  harness.reset();
  for (const mock of Object.values(api)) mock.mockReset();
  api.fetchPersonalFilingMonitor.mockResolvedValue(response());
  api.configurePersonalFilingMonitor.mockResolvedValue(response(true));
  api.pausePersonalFilingMonitor.mockResolvedValue(response(false));
  api.resetPersonalFilingMonitor.mockResolvedValue(response(false));
  api.acknowledgePersonalFilingMonitor.mockResolvedValue(response());
  props = {
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    watchlistVersion: 1,
    memberships: [membership()],
    enabled: true,
    onSessionUnavailable: vi.fn(),
  };
});
afterEach(() => {
  harness.unmount();
  vi.unstubAllGlobals();
});
function membership(index = 0) {
  return {
    country: "US" as const,
    exchangeMic: "XNAS",
    instrumentType: "common_stock" as const,
    issuerId: `issuer-${index}`,
    issuerName: `Example ${index}`,
    listingId: `listing-${index}`,
    note: "private",
    securityId: `security-${index}`,
    securityName: "Common stock",
    shareClassId: `class-${index}`,
    shareClassName: "Common",
    symbol: `EX${index}`,
  };
}
function response(enabled = false): PersonalFilingMonitorDto {
  return {
    schemaVersion: "1.0.0",
    version: 1,
    policy: {
      enabled,
      catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
      watchlistVersion: 1,
      listingIds: ["listing-0"],
      dailyTime: "09:00",
      timeZone: "America/Chicago",
      quietHours: true,
      desktopNotifications: false,
    },
    bindingStatus: "current",
    running: false,
    nextCheckAt: enabled ? "2026-09-23T14:00:00.000Z" : null,
    lastCheckAt: null,
    lastOutcome: null,
    coverageGap: false,
    issuers: [
      {
        cik: "0000000001",
        listings: [
          { listingId: "listing-0", symbol: "EX0", issuerName: "Example 0" },
        ],
        seeded: false,
        lastCompleteAt: null,
        status: "unseeded",
        coverageGap: false,
      },
    ],
    inbox: [],
    unreadCount: 0,
  };
}
function populated(
  status: PersonalFilingMonitorDto["inbox"][number]["delivery"]["status"] = "observed_shown",
  count = 1,
): PersonalFilingMonitorDto {
  const data = response(true);
  return {
    ...data,
    unreadCount: count,
    inbox: Array.from({ length: count }, (_, index) => {
      const accessionNumber = `0000000001-26-${String(index + 1).padStart(6, "0")}`;
      return {
        id: `0000000001:${accessionNumber}`,
        filing: {
          cik: "0000000001",
          accessionNumber,
          form: "8-K",
          filingDate: "2026-09-22",
          reportDate: "2026-09-21",
          sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${accessionNumber}-index.htm`,
        },
        listings: data.issuers[0]!.listings,
        firstSeenAt: "2026-09-22T14:00:00.000Z",
        readAt: null,
        delivery: {
          status,
          shownObserved: status === "observed_shown",
          attemptedAt: "2026-09-22T14:00:01.000Z",
          completedAt: "2026-09-22T14:00:02.000Z",
        },
      };
    }),
  };
}
async function load() {
  const view = await mount();
  click(view, "Load monitor");
  await flush();
  return render();
}
function toggle(view: unknown, label: string, checked: boolean) {
  const element = elements(view).find(
    (item) => item.props["aria-label"] === label,
  );
  if (!element) throw new Error(label);
  (element.props.onChange as (event: { target: { checked: boolean } }) => void)(
    { target: { checked } },
  );
}

describe("PersonalFilingMonitor", () => {
  it("retains shown evidence beside an uncertain final delivery without acknowledgement", async () => {
    const data = populated("delivery_uncertain");
    Object.assign(data.inbox[0]!.delivery, { shownObserved: true });
    api.fetchPersonalFilingMonitor.mockResolvedValue(data);
    const view = await load();
    expect(text(view)).toContain(
      "Windows also reported a shown callback; final delivery remains uncertain",
    );
    expect(text(view)).toContain("Read state: Unacknowledged");
    expect(api.acknowledgePersonalFilingMonitor).not.toHaveBeenCalled();
  });
  it("waits for explicit load and leaves monitoring and desktop notices off", async () => {
    const view = await mount();
    expect(api.fetchPersonalFilingMonitor).not.toHaveBeenCalled();
    expect(text(view)).toContain("Loading does not enable checks");
    expect(elements(view).some((e) => e.type === "fieldset")).toBe(false);
    expect(api.configurePersonalFilingMonitor).not.toHaveBeenCalled();
  });
  it("loads settings without enabling or acquiring filings", async () => {
    const view = await load();
    expect(api.fetchPersonalFilingMonitor).toHaveBeenCalledTimes(1);
    expect(api.configurePersonalFilingMonitor).not.toHaveBeenCalled();
    expect(text(view)).toContain("Paused / off");
    expect(input(view, "Monitor daily local time").props.value).toBe("09:00");
    expect(input(view, "Monitor IANA time zone").props.value).toBe(
      "America/Chicago",
    );
  });
  it("requires a separate explicit desktop opt-in and submits exact saved binding", async () => {
    let view = await load();
    toggle(view, "Allow generic desktop notices", true);
    view = render();
    click(view, "Enable daily monitor");
    await flush();
    expect(api.configurePersonalFilingMonitor).toHaveBeenCalledWith(
      {
        schemaVersion: "1.0.0",
        expectedVersion: 1,
        policy: {
          ...response().policy,
          enabled: true,
          desktopNotifications: true,
        },
      },
      expect.any(AbortSignal),
    );
    expect(text(render())).toContain("Monitor change saved");
  });
  it("blocks invalid time zones and local times before submission", async () => {
    let view = await load();
    change(view, "Monitor IANA time zone", "No/SuchZone");
    view = render();
    expect(button(view, "Enable daily monitor").props.disabled).toBe(true);
    click(view, "Enable daily monitor");
    expect(api.configurePersonalFilingMonitor).not.toHaveBeenCalled();
    change(view, "Monitor IANA time zone", "UTC");
    view = render();
    change(view, "Monitor daily local time", "24:00");
    expect(button(render(), "Enable daily monitor").props.disabled).toBe(true);
  });
  it("bounds selection to20 and renders only50 from a large watchlist", async () => {
    props = {
      ...props,
      memberships: Array.from({ length: 1000 }, (_, i) => membership(i)),
    };
    api.fetchPersonalFilingMonitor.mockResolvedValue({
      ...response(),
      version: 0,
      policy: null,
      bindingStatus: "unconfigured",
      issuers: [],
    });
    let view = await load();
    expect(text(view)).toContain("0 of 20 slots");
    expect(
      elements(view).filter((e) =>
        String(e.props["aria-label"]).startsWith("Monitor EX"),
      ),
    ).toHaveLength(50);
    for (let i = 0; i < 20; i++) {
      toggle(view, `Monitor EX${i} (listing-${i})`, true);
      view = render();
    }
    expect(text(view)).toContain("20 of 20 slots");
    expect(
      elements(view).find(
        (e) => e.props["aria-label"] === "Monitor EX20 (listing-20)",
      )?.props.disabled,
    ).toBe(true);
    toggle(view, "Monitor EX20 (listing-20)", true);
    expect(text(render())).toContain("20 of 20 slots");
    click(render(), "Next monitor listings");
    expect(text(render())).toContain("Page 2 of 20");
    expect(api.fetchPersonalFilingMonitor).toHaveBeenCalledTimes(1);
  });
  it("searches saved identities locally without loading", async () => {
    props = { ...props, memberships: [membership(), membership(1)] };
    let view = await load();
    change(view, "Find monitor listings", "EX1");
    view = render();
    expect(
      elements(view).filter((e) =>
        String(e.props["aria-label"]).startsWith("Monitor EX"),
      ),
    ).toHaveLength(1);
    expect(api.fetchPersonalFilingMonitor).toHaveBeenCalledTimes(1);
  });
  it("rebinds only after explicit review and never silently updates saved identities", async () => {
    api.fetchPersonalFilingMonitor.mockResolvedValue({
      ...response(true),
      bindingStatus: "needs_rebind",
    });
    const view = await load();
    expect(text(view)).toContain("no longer matches");
    expect(api.configurePersonalFilingMonitor).not.toHaveBeenCalled();
    click(view, "Rebind and enable monitor");
    await flush();
    expect(api.configurePersonalFilingMonitor).toHaveBeenCalledTimes(1);
  });
  it("requires replacement of removed saved selections before rebind", async () => {
    api.fetchPersonalFilingMonitor.mockResolvedValue({
      ...response(),
      bindingStatus: "needs_rebind",
      policy: { ...response().policy!, listingIds: ["removed"] },
    });
    let view = await load();
    expect(button(view, "Rebind and enable monitor").props.disabled).toBe(true);
    click(view, "Clear monitor selection");
    view = render();
    toggle(view, "Monitor EX0 (listing-0)", true);
    expect(button(render(), "Rebind and enable monitor").props.disabled).toBe(
      false,
    );
  });
  it("pauses explicitly and exposes reset only when paused", async () => {
    api.fetchPersonalFilingMonitor.mockResolvedValue(response(true));
    let view = await load();
    expect(text(view)).not.toContain("Reset monitor history");
    click(view, "Pause monitor");
    await flush();
    view = render();
    expect(api.pausePersonalFilingMonitor).toHaveBeenCalledWith(
      { schemaVersion: "1.0.0", expectedVersion: 1 },
      expect.any(AbortSignal),
    );
    expect(button(view, "Reset monitor history").props.disabled).toBe(true);
  });
  it("requires a deliberate reset confirmation and keeps its consequence visible", async () => {
    let view = await load();
    click(view, "Reset monitor history");
    expect(api.resetPersonalFilingMonitor).not.toHaveBeenCalled();
    toggle(view, "Confirm monitor history reset", true);
    view = render();
    click(view, "Reset monitor history");
    await flush();
    expect(api.resetPersonalFilingMonitor).toHaveBeenCalledTimes(1);
    expect(text(render())).toContain("remains paused");
  });
  it("renders source calendar dates separately from UTC observations", async () => {
    api.fetchPersonalFilingMonitor.mockResolvedValue(populated());
    const view = await load();
    expect(text(view)).toContain("SEC filed: 2026-09-22");
    expect(text(view)).toContain(
      "First observed (UTC): 2026-09-22T14:00:00.000Z",
    );
    const link = elements(view).find((e) => e.type === "a");
    expect(link?.props.href).toBe(populated().inbox[0]!.filing.sourceUrl);
    expect(link?.props.rel).toBe("noopener noreferrer");
    expect(link?.props.target).toBe("_blank");
  });
  it.each([
    ["observed_shown", "Windows reported the notice shown"],
    ["submission_unconfirmed", "display unconfirmed"],
    ["delivery_uncertain", "no automatic retry"],
    ["not_submitted", "not submitted"],
  ] as const)("explains %s without marking read", async (status, label) => {
    api.fetchPersonalFilingMonitor.mockResolvedValue(populated(status));
    const view = await load();
    expect(text(view)).toContain(label);
    expect(text(view)).toContain("Read state: Unacknowledged");
    expect(api.acknowledgePersonalFilingMonitor).not.toHaveBeenCalled();
  });
  it("acknowledges exact retained IDs only on explicit action", async () => {
    api.fetchPersonalFilingMonitor.mockResolvedValue(populated());
    const view = await load();
    click(view, "Acknowledge 0000000001-26-000001");
    await flush();
    expect(api.acknowledgePersonalFilingMonitor).toHaveBeenCalledWith(
      {
        schemaVersion: "1.0.0",
        expectedVersion: 1,
        eventIds: ["0000000001:0000000001-26-000001"],
      },
      expect.any(AbortSignal),
    );
  });
  it("paginates an inbox locally and labels partial/overflow coverage", async () => {
    const data = populated("pending", 21);
    api.fetchPersonalFilingMonitor.mockResolvedValue({
      ...data,
      coverageGap: true,
      lastOutcome: "partial",
      issuers: [{ ...data.issuers[0]!, status: "overflow", coverageGap: true }],
    });
    let view = await load();
    expect(text(view)).toContain("Coverage gap recorded");
    expect(text(view)).toContain("Retention limit reached");
    expect(elements(view).filter((e) => e.type === "a")).toHaveLength(20);
    click(view, "Next inbox entries");
    view = render();
    expect(elements(view).filter((e) => e.type === "a")).toHaveLength(1);
    expect(api.fetchPersonalFilingMonitor).toHaveBeenCalledTimes(1);
  });
  it("retires disclosures immediately on refresh and rejects duplicate stale handlers", async () => {
    let view = await load();
    const pending = deferred<PersonalFilingMonitorDto>();
    api.fetchPersonalFilingMonitor.mockReturnValueOnce(pending.promise);
    const stale = view;
    click(view, "Reload monitor");
    click(stale, "Reload monitor");
    view = render();
    expect(text(view)).not.toContain("Monitor settings");
    expect(api.fetchPersonalFilingMonitor).toHaveBeenCalledTimes(2);
    pending.resolve(response());
    await flush();
  });
  it.each(["catalog", "watchlist", "identity", "disabled"])(
    "aborts and hides results on %s change before a late completion",
    async (kind) => {
      const pending = deferred<PersonalFilingMonitorDto>();
      api.fetchPersonalFilingMonitor.mockReturnValueOnce(pending.promise);
      let view = await mount();
      click(view, "Load monitor");
      const abort = api.fetchPersonalFilingMonitor.mock
        .calls[0]![0] as AbortSignal;
      props =
        kind === "catalog"
          ? { ...props, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` }
          : kind === "watchlist"
            ? { ...props, watchlistVersion: 2 }
            : kind === "identity"
              ? {
                  ...props,
                  memberships: [{ ...membership(), shareClassId: "changed" }],
                }
              : { ...props, enabled: false };
      view = render();
      expect(abort.aborted).toBe(true);
      expect(text(view)).not.toContain("Monitor settings");
      pending.resolve(populated());
      await flush();
      expect(text(render())).not.toContain("Windows reported");
    },
  );
  it("rejects loaded results when context-specific identity binding fails", async () => {
    api.validatePersonalFilingMonitorBinding.mockImplementationOnce(() => {
      throw new PersonalWorkspaceApiError("invalid_response");
    });
    const view = await load();
    expect(text(view)).toContain("Could not load a valid monitor snapshot");
    expect(text(view)).not.toContain("Monitor settings");
  });
  it("clears response and reports owner session loss once", async () => {
    api.fetchPersonalFilingMonitor.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    const view = await load();
    expect(props.onSessionUnavailable).toHaveBeenCalledTimes(1);
    expect(text(view)).toContain("Session unavailable");
  });
  it("aborts on unmount and ignores late session errors", async () => {
    let reject!: (error: Error) => void;
    api.fetchPersonalFilingMonitor.mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    const view = await mount();
    click(view, "Load monitor");
    const abort = api.fetchPersonalFilingMonitor.mock
      .calls[0]![0] as AbortSignal;
    harness.unmount();
    expect(abort.aborted).toBe(true);
    reject(new PersonalWorkspaceApiError("session_unavailable"));
    await flush();
    expect(props.onSessionUnavailable).not.toHaveBeenCalled();
  });
  it("cancels waiting for mutation without falsely claiming rollback", async () => {
    let view = await load();
    const pending = deferred<PersonalFilingMonitorDto>();
    api.configurePersonalFilingMonitor.mockReturnValueOnce(pending.promise);
    click(view, "Enable daily monitor");
    view = render();
    const origin = {} as HTMLButtonElement;
    vi.stubGlobal("document", { activeElement: origin, body: {} });
    const cancel = elements(view).find(
      (e) => e.type === "button" && text(e) === "Cancel waiting",
    )!;
    (cancel.props.onClick as (e: { currentTarget: HTMLButtonElement }) => void)(
      { currentTarget: origin },
    );
    expect(
      (api.configurePersonalFilingMonitor.mock.calls[0]![1] as AbortSignal)
        .aborted,
    ).toBe(true);
    expect(text(render())).toContain("may already have committed");
    pending.resolve(response(true));
    await flush();
    expect(text(render())).not.toContain("Monitor change saved");
  });
  it("restores cancel keyboard focus only to the connected current load button", async () => {
    let view = await mount();
    const pending = deferred<PersonalFilingMonitorDto>();
    api.fetchPersonalFilingMonitor.mockReturnValueOnce(pending.promise);
    const loadElement = elements(view).find(
      (e) => e.type === "button" && text(e) === "Load monitor",
    )!;
    const focus = vi.fn();
    (loadElement.props.ref as { current: unknown }).current = {
      isConnected: true,
      closest: () => null,
      focus,
    };
    click(view, "Load monitor");
    view = render();
    const origin = {} as HTMLButtonElement;
    vi.stubGlobal("document", { activeElement: origin, body: {} });
    const cancel = elements(view).find(
      (e) => e.type === "button" && text(e) === "Cancel waiting",
    )!;
    (cancel.props.onClick as (e: { currentTarget: HTMLButtonElement }) => void)(
      { currentTarget: origin },
    );
    render();
    expect(focus).toHaveBeenCalledOnce();
    pending.resolve(response());
    await flush();
  });
  it("does not steal focus after the user moves away from cancel", async () => {
    let view = await mount();
    const pending = deferred<PersonalFilingMonitorDto>();
    api.fetchPersonalFilingMonitor.mockReturnValueOnce(pending.promise);
    const focus = vi.fn();
    (
      elements(view).find(
        (e) => e.type === "button" && text(e) === "Load monitor",
      )!.props.ref as { current: unknown }
    ).current = { isConnected: true, closest: () => null, focus };
    click(view, "Load monitor");
    view = render();
    const origin = {} as HTMLButtonElement;
    const doc = { activeElement: origin as unknown, body: {} };
    vi.stubGlobal("document", doc);
    (
      elements(view).find(
        (e) => e.type === "button" && text(e) === "Cancel waiting",
      )!.props.onClick as (e: { currentTarget: HTMLButtonElement }) => void
    )({ currentTarget: origin });
    doc.activeElement = {};
    render();
    expect(focus).not.toHaveBeenCalled();
    pending.resolve(response());
    await flush();
  });
  it("rejects captured enable handlers after an identity change", async () => {
    const view = await load();
    props = {
      ...props,
      memberships: [{ ...membership(), issuerId: "different" }],
    };
    render();
    click(view, "Enable daily monitor");
    expect(api.configurePersonalFilingMonitor).not.toHaveBeenCalled();
  });
});
const harness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const dependencies: Array<readonly unknown[] | undefined> = [];
  const cleanup = new Map<number, () => void>();
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

function render() {
  harness.begin();
  const view = PersonalFilingMonitor(props);
  harness.effects();
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
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
function input(value: unknown, label: string) {
  const found = elements(value).find(
    (element) => element.props["aria-label"] === label,
  );
  if (!found) throw new Error(`Missing input: ${label}`);
  return found as React.ReactElement<{
    value: unknown;
    onChange: (event: { target: { value: string } }) => void;
  }>;
}
function change(value: unknown, label: string, next: string) {
  input(value, label).props.onChange({ target: { value: next } });
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
