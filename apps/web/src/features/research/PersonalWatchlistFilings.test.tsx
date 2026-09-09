import type { PersonalWatchlistFilingsResponseDto } from "@research-cockpit/contracts";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "@/lib/personal-workspace-api";
import {
  PersonalWatchlistFilings,
  type PersonalWatchlistFilingsProps,
} from "./PersonalWatchlistFilings";
const api = vi.hoisted(() => ({ fetchPersonalWatchlistFilings: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => harness.useState(initial),
  useRef: <T,>(initial: T) => harness.useRef(initial),
  useEffect: (
    effect: () => (() => void) | void,
    deps: readonly unknown[] | undefined,
  ) => harness.useEffect(effect, deps),
}));
vi.mock("@/lib/personal-watchlist-filings-api", () => api);
vi.mock(
  "@/lib/personal-workspace-api",
  () => import("../../lib/personal-workspace-api"),
);

let props: PersonalWatchlistFilingsProps;
beforeEach(() => {
  harness.reset();
  api.fetchPersonalWatchlistFilings.mockReset().mockResolvedValue(response());
  props = {
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    watchlistVersion: 1,
    memberships: [membership()],
    enabled: true,
    onOpenResearch: vi.fn(),
    onSessionUnavailable: vi.fn(),
  };
});
afterEach(() => harness.unmount());

describe("PersonalWatchlistFilings", () => {
  it("waits for an explicit check and routes exact saved identities and SEC links", async () => {
    let view = await mount();
    expect(api.fetchPersonalWatchlistFilings).not.toHaveBeenCalled();
    expect(text(view)).toContain("1 of 1 saved listings selected");
    click(view, "Load recent filings");
    await flush();
    expect(api.fetchPersonalWatchlistFilings).toHaveBeenCalledWith(
      {
        schemaVersion: "1.0.0",
        catalogSnapshotSha256: props.catalogSnapshotSha256,
        watchlistVersion: 1,
        listingIds: ["listing-one"],
        lookbackDays: 30,
      },
      expect.any(AbortSignal),
    );
    view = render();
    expect(text(view)).toContain("Check started 2026-09-09 10:00:00.000 UTC");
    click(view, "Open ONE");
    expect(props.onOpenResearch).toHaveBeenCalledWith(membership());
    expect(
      elements(view)
        .filter((element) => element.type === "a")
        .every(
          (link) =>
            link.props.rel === "noopener noreferrer" &&
            link.props.target === "_blank",
        ),
    ).toBe(true);
  });

  it("requires explicit selection above twenty and never silently requests the full watchlist", async () => {
    props = {
      ...props,
      memberships: Array.from({ length: 21 }, (_, index) => membership(index)),
    };
    let view = await mount();
    expect(text(view)).toContain("0 of 21 saved listings selected");
    expect(button(view, "Load recent filings").props.disabled).toBe(true);
    click(view, "Select first 20 saved listings");
    view = render();
    expect(text(view)).toContain("20 of 21 saved listings selected");
    const unchecked = elements(view).find(
      (element) => element.props["aria-label"] === "Check filings for ONE20",
    );
    expect(unchecked?.props.disabled).toBe(true);
    click(view, "Load recent filings");
    expect(api.fetchPersonalWatchlistFilings.mock.calls[0]?.[0]).toMatchObject({
      listingIds: props.memberships
        .slice(0, 20)
        .map((member) => member.listingId),
    });
    await flush();
  });

  it("bounds a large watchlist selection to fifty rendered choices with search and pagination", async () => {
    props = {
      ...props,
      memberships: Array.from({ length: 1_000 }, (_, index) =>
        membership(index),
      ),
    };
    let view = await mount();
    const checkboxCount = (value: unknown) =>
      elements(value).filter(
        (element) =>
          element.type === "input" && element.props.type === "checkbox",
      ).length;
    expect(checkboxCount(view)).toBe(50);
    expect(text(view)).toContain("1 – 50 of 1000 matching saved listings");
    click(view, "Next saved listings");
    view = render();
    expect(checkboxCount(view)).toBe(50);
    expect(text(view)).toContain("51 – 100 of 1000 matching saved listings");
    change(view, "Find a saved filing listing", "ONE999");
    view = render();
    expect(checkboxCount(view)).toBe(1);
    expect(text(view)).toContain("ONE999");
    expect(api.fetchPersonalWatchlistFilings).not.toHaveBeenCalled();
  });

  it("paginates loaded results without source requests and filters periodic versus current reports", async () => {
    api.fetchPersonalWatchlistFilings.mockResolvedValue(response(26));
    await mount();
    click(render(), "Load recent filings");
    await flush();
    expect(text(render())).toContain("1 – 25 of 26 loaded filings");
    click(render(), "Next filing page");
    expect(text(render())).toContain("26 – 26 of 26 loaded filings");
    expect(api.fetchPersonalWatchlistFilings).toHaveBeenCalledTimes(1);
    change(render(), "Filing form filter", "periodic");
    expect(text(render())).toContain("1 – 1 of 1 loaded filings");
    change(render(), "Filing form filter", "current");
    expect(text(render())).toContain("1 – 25 of 25 loaded filings");
  });

  it.each([
    "date",
    "selection",
    "cancel",
    "version",
    "catalog",
    "membership",
    "session",
    "unmount",
  ])("clears and aborts old results after %s changes", async (changeKind) => {
    await mount();
    click(render(), "Load recent filings");
    await flush();
    const pending = deferred<PersonalWatchlistFilingsResponseDto>();
    api.fetchPersonalWatchlistFilings.mockReturnValueOnce(pending.promise);
    click(render(), "Reload recent filings");
    const signal = api.fetchPersonalWatchlistFilings.mock.calls.at(
      -1,
    )?.[1] as AbortSignal;
    if (changeKind === "date") change(render(), "Filing date range", "7");
    if (changeKind === "selection") click(render(), "Clear filing selection");
    if (changeKind === "cancel") click(render(), "Cancel filing check");
    if (changeKind === "version") props = { ...props, watchlistVersion: 2 };
    if (changeKind === "catalog")
      props = { ...props, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` };
    if (changeKind === "membership")
      props = {
        ...props,
        memberships: [{ ...membership(), issuerName: "Changed" }],
      };
    if (changeKind === "session") props = { ...props, enabled: false };
    if (changeKind === "unmount") harness.unmount();
    else render();
    expect(signal.aborted).toBe(true);
    pending.resolve(response());
    await flush();
    if (changeKind !== "unmount")
      expect(text(render())).not.toContain("View SEC filing");
  });

  it.each([true, false])(
    "distinguishes verified empty results from unavailable source history (%s)",
    async (available) => {
      const value = response(0);
      api.fetchPersonalWatchlistFilings.mockResolvedValue({
        ...value,
        issuers: value.issuers.map((issuer) => ({
          ...issuer,
          status: available ? "available" : "upstream_unavailable",
        })),
      });
      await mount();
      click(render(), "Load recent filings");
      await flush();
      expect(text(render())).toContain(
        available
          ? "No matching filings in the checked recent issuer histories"
          : "No issuer history could be checked",
      );
      expect(text(render())).toContain(
        available ? "Listings unavailable 0" : "Listings unavailable 1",
      );
    },
  );

  it("shows partial and truncated coverage without treating unavailable histories as empty", async () => {
    props = { ...props, memberships: [membership(), membership(1)] };
    const value = response();
    api.fetchPersonalWatchlistFilings.mockResolvedValue({
      ...value,
      totalWatchlistListings: 2,
      matchingFilings: 1001,
      truncated: true,
      issuers: [
        ...value.issuers,
        {
          ...value.issuers[0],
          cik: "0000000002",
          status: "upstream_unavailable",
          matchingFilings: 0,
          listings: [
            { listingId: "listing-1", symbol: "ONE1", issuerName: "Example 1" },
          ],
        },
      ],
    });
    await mount();
    click(render(), "Load recent filings");
    await flush();
    expect(text(render())).toContain("Coverage is partial");
    expect(text(render())).toContain("This result is truncated");
  });

  it.each(["conflict", "not_configured", "session_unavailable"] as const)(
    "handles %s without displaying raw errors",
    async (code) => {
      api.fetchPersonalWatchlistFilings.mockRejectedValue(
        new PersonalWorkspaceApiError(code),
      );
      await mount();
      click(render(), "Load recent filings");
      await flush();
      expect(text(render())).toContain(
        code === "conflict"
          ? "saved watchlist or catalog changed"
          : code === "not_configured"
            ? "SEC contact setup is required"
            : "owner session expired",
      );
      expect(props.onSessionUnavailable).toHaveBeenCalledTimes(
        code === "session_unavailable" ? 1 : 0,
      );
    },
  );

  it("rejects a response that changes a saved symbol or watchlist size", async () => {
    const value = response();
    api.fetchPersonalWatchlistFilings.mockResolvedValue({
      ...value,
      totalWatchlistListings: 3,
    });
    await mount();
    click(render(), "Load recent filings");
    await flush();
    expect(text(render())).not.toContain("View SEC filing");
    expect(text(render())).toContain("Recent filings could not be loaded");
  });
});

function membership(
  index = 0,
): PersonalWatchlistFilingsProps["memberships"][number] {
  return {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: "issuer-one",
    issuerName: index === 0 ? "Example One" : `Example ${String(index)}`,
    listingId: index === 0 ? "listing-one" : `listing-${String(index)}`,
    note: "",
    securityId: "security-one",
    securityName: "Example common stock",
    shareClassId: "class-one",
    shareClassName: "Common",
    symbol: index === 0 ? "ONE" : `ONE${String(index)}`,
  };
}
function response(count = 1): PersonalWatchlistFilingsResponseDto {
  const listings = [
    { listingId: "listing-one", symbol: "ONE", issuerName: "Example One" },
  ];
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    watchlistVersion: 1,
    lookbackDays: 30,
    fromDate: "2026-08-11",
    throughDate: "2026-09-09",
    fetchedAt: "2026-09-09T10:00:00.000Z",
    totalWatchlistListings: 1,
    selectedListingIds: ["listing-one"],
    issuers: [
      {
        cik: "0000000001",
        status: "available",
        fetchedAt: "2026-09-09T10:00:01.000Z",
        sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
        olderHistoryAvailable: false,
        matchingFilings: count,
        truncated: false,
        listings,
      },
    ],
    matchingFilings: count,
    truncated: false,
    filings: Array.from({ length: count }, (_, index) => ({
      cik: "0000000001",
      accessionNumber: `0000000001-26-${String(index + 1).padStart(6, "0")}`,
      form: index === 0 ? "10-Q/A" : "8-K",
      filingDate: "2026-09-08",
      reportDate: "2026-06-30",
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/0000000001-26-${String(index + 1).padStart(6, "0")}-index.htm`,
      listings,
    })),
  };
}
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
  const view = PersonalWatchlistFilings(props);
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
