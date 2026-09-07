import type {
  PersonalSecurityMasterSearchResponseDto,
  PersonalSecurityMasterSearchResultDto,
  PersonalSecurityMasterSnapshotReceiptDto,
} from "@research-cockpit/contracts";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PersonalWorkspaceApiError,
  type PersonalWatchlistPayload,
  type PersonalWatchlistRecord,
  type SavedPersonalWatchlist,
} from "@/lib/personal-workspace-api";

const hookHarness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  let stateIndex = 0;
  let refIndex = 0;
  return {
    beginRender() {
      stateIndex = 0;
      refIndex = 0;
    },
    reset() {
      states.splice(0);
      refs.splice(0);
      stateIndex = 0;
      refIndex = 0;
    },
    useCallback: <T,>(callback: T): T => callback,
    useRef: <T,>(initial: T) => {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useState: (initial: unknown) => {
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

const apiMocks = vi.hoisted(() => ({
  fetchMainPersonalWatchlist:
    vi.fn<(signal: AbortSignal) => Promise<PersonalWatchlistRecord | null>>(),
  fetchPersonalSecurityMasterStatus: vi.fn<
    (signal: AbortSignal) => Promise<{
      snapshot: PersonalSecurityMasterSnapshotReceiptDto;
    }>
  >(),
  saveMainPersonalWatchlist:
    vi.fn<
      (
        version: number,
        payload: PersonalWatchlistPayload,
        signal: AbortSignal,
      ) => Promise<SavedPersonalWatchlist>
    >(),
  searchPersonalSecurities:
    vi.fn<
      (
        query: string,
        signal: AbortSignal,
        limit: number,
      ) => Promise<PersonalSecurityMasterSearchResponseDto>
    >(),
}));
const componentMocks = vi.hoisted(() => ({
  OwnerSession: () => null,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal()),
  useCallback: hookHarness.useCallback,
  useRef: hookHarness.useRef,
  useState: hookHarness.useState,
}));
vi.mock("@/lib/personal-workspace-api", () => ({
  ...apiMocks,
  PersonalWorkspaceApiError: class PersonalWorkspaceApiError extends Error {
    constructor(readonly code: string) {
      super("Personal workspace request failed.");
    }
  },
  createEmptyPersonalWatchlist: (snapshotSha256: string) => ({
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256,
    memberships: [],
  }),
  membershipFromSearchResult: (
    result: PersonalSecurityMasterSearchResultDto,
  ) => ({
    country: result.country,
    exchangeMic: result.exchangeMic,
    instrumentType: result.instrumentType,
    issuerId: result.issuerId,
    issuerName: result.issuerName,
    listingId: result.listingId,
    note: "",
    securityId: result.securityId,
    securityName: result.securityName,
    shareClassId: result.shareClassId,
    shareClassName: result.shareClassName,
    symbol: result.symbol,
  }),
  normalizeWatchlistNote: (value: string) => value.trim(),
}));
vi.mock("./OwnerSessionPanel", () => ({
  OwnerSessionPanel: componentMocks.OwnerSession,
}));

import { SecurityDiscoveryWorkspace } from "./SecurityDiscoveryWorkspace";

beforeEach(() => {
  hookHarness.reset();
  for (const mock of Object.values(apiMocks)) mock.mockReset();
  apiMocks.fetchPersonalSecurityMasterStatus.mockResolvedValue({
    snapshot: snapshot(),
  });
  apiMocks.fetchMainPersonalWatchlist.mockResolvedValue(null);
  apiMocks.searchPersonalSecurities.mockResolvedValue({
    limitApplied: 15,
    normalizedQuery: "ZERO",
    results: [searchResult("ZERO", "lst-zero")],
    snapshot: snapshot(),
    totalMatches: 1,
  });
  apiMocks.saveMainPersonalWatchlist.mockImplementation(
    (version: number, payload: PersonalWatchlistPayload) =>
      Promise.resolve({ version: version + 1, payload }),
  );
});

describe("SecurityDiscoveryWorkspace", () => {
  it("starts locked and makes no private request before owner confirmation", () => {
    const rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Security discovery locked");
    expect(textContent(rendered)).toContain("No browser storage");
    expect(apiMocks.fetchPersonalSecurityMasterStatus).not.toHaveBeenCalled();
    expect(apiMocks.fetchMainPersonalWatchlist).not.toHaveBeenCalled();
    expect(findOwnerSession(rendered)).toBeDefined();
  });

  it("loads the real local universe and an empty durable watchlist after authentication", async () => {
    let rendered = renderWorkspace();
    const owner = requireOwnerSession(rendered);

    await expect(
      owner.props.onSessionChange(true, new AbortController().signal),
    ).resolves.toBe(true);
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("3,001");
    expect(textContent(rendered)).toContain("My Watchlist");
    expect(textContent(rendered)).toContain("Your watchlist is empty");
    expect(apiMocks.fetchPersonalSecurityMasterStatus).toHaveBeenCalledOnce();
    expect(apiMocks.fetchMainPersonalWatchlist).toHaveBeenCalledOnce();
  });

  it("keeps discovery available when the saved watchlist cannot be loaded", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockRejectedValueOnce(
      new Error("malformed main watchlist"),
    );
    let rendered = renderWorkspace();
    const owner = requireOwnerSession(rendered);

    await expect(
      owner.props.onSessionChange(true, new AbortController().signal),
    ).resolves.toBe(true);
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Find a company");
    expect(textContent(rendered)).toContain(
      "Security search is still available, but watchlist changes are disabled",
    );
    expect(textContent(rendered)).toContain("My Watchlist is unavailable");
    expect(textContent(rendered)).not.toContain("Your watchlist is empty");

    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "security-query" }).props.onChange({
      target: { value: "ZERO" },
    });
    rendered = renderWorkspace();
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, { className: "security-search-form" }).props.onSubmit({
      preventDefault: vi.fn(),
    });
    await flushPromises();
    rendered = renderWorkspace();

    expect(apiMocks.searchPersonalSecurities).toHaveBeenCalledOnce();
    expect(requireButton(rendered, "Add").props.disabled).toBe(true);
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
  });

  it("keeps the initial workspace locked when the parallel watchlist read loses authorization", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    const owner = requireOwnerSession(renderWorkspace());

    await expect(
      owner.props.onSessionChange(true, new AbortController().signal),
    ).resolves.toBe(false);
    const rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Security discovery locked");
    expect(textContent(rendered)).toContain("Revalidate the session");
    expect(textContent(rendered)).not.toContain("3,001");
    expect(textContent(rendered)).not.toContain("Your watchlist is empty");
  });

  it("searches, adds a stable-ID result, and renders the saved membership", async () => {
    await activateWorkspace();
    let rendered = renderWorkspace();
    const searchInput = requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, {
      id: "security-query",
    });
    searchInput.props.onChange({ target: { value: " zero " } });
    rendered = renderWorkspace();
    const form = requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, {
      className: "security-search-form",
    });
    form.props.onSubmit({ preventDefault: vi.fn() });
    await flushPromises();
    rendered = renderWorkspace();

    expect(apiMocks.searchPersonalSecurities).toHaveBeenCalledWith(
      "zero",
      expect.any(AbortSignal),
      15,
    );
    const add = requireButton(rendered, "Add");
    add.props.onClick();
    await flushPromises();
    rendered = renderWorkspace();

    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        schemaVersion: 1,
        snapshotSha256: snapshot().snapshotSha256,
        memberships: [
          expect.objectContaining({
            issuerId: "iss-zero",
            listingId: "lst-zero",
            securityId: "sec-zero",
            shareClassId: "shr-zero",
            symbol: "ZERO",
          }),
        ],
      }),
      expect.any(AbortSignal),
    );
    expect(textContent(rendered)).toContain("ZERO was added");
  });

  it("persists reordering, inline notes, and removal", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce({
      id: "main",
      version: 4,
      createdAt: "2030-01-15T01:00:00.000Z",
      updatedAt: "2030-01-15T02:00:00.000Z",
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: snapshot().snapshotSha256,
        memberships: [
          membership("ONE", "lst-one"),
          membership("TWO", "lst-two"),
        ],
      },
    });
    await activateWorkspace();
    let rendered = renderWorkspace();

    requireElementByProps<{ onClick: () => void }>(rendered, {
      "aria-label": "Move TWO up",
    }).props.onClick();
    await flushPromises();
    expect(
      apiMocks.saveMainPersonalWatchlist.mock.calls[0]?.[1].memberships.map(
        (entry: { symbol: string }) => entry.symbol,
      ),
    ).toEqual(["TWO", "ONE"]);

    rendered = renderWorkspace();
    const note = requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "note-lst-two" });
    note.props.onChange({ target: { value: "  Watch margins  " } });
    rendered = renderWorkspace();
    requireButton(rendered, "Save note").props.onClick();
    await flushPromises();
    const notePayload = apiMocks.saveMainPersonalWatchlist.mock.calls[1]?.[1];
    expect(notePayload?.memberships[0]).toMatchObject({
      symbol: "TWO",
      note: "Watch margins",
    });

    rendered = renderWorkspace();
    requireButton(rendered, "Remove").props.onClick();
    await flushPromises();
    const removePayload = apiMocks.saveMainPersonalWatchlist.mock.calls[2]?.[1];
    expect(removePayload?.memberships).toHaveLength(1);
  });

  it("previews heuristic misses without saving and removes them only after separate confirmation", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce({
      id: "main",
      version: 7,
      createdAt: "2030-01-15T01:00:00.000Z",
      updatedAt: "2030-01-15T02:00:00.000Z",
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: `sha256:${"d".repeat(64)}`,
        memberships: [
          { ...membership("OLD", "lst-retained"), note: "Keep this note" },
          membership("DROP", "lst-unmatched"),
        ],
      },
    });
    apiMocks.searchPersonalSecurities.mockImplementation(
      (query: string, _signal: AbortSignal, limit: number) =>
        Promise.resolve({
          limitApplied: limit,
          normalizedQuery: query,
          results:
            query === "OLD" ? [searchResult("CURRENT", "lst-retained")] : [],
          snapshot: snapshot(),
          totalMatches: query === "OLD" ? 1 : 0,
        }),
    );
    await activateWorkspace();
    let rendered = renderWorkspace();

    expect(requireButton(rendered, "Remove").props.disabled).toBe(true);
    expect(
      requireElementByProps<{ disabled?: boolean }>(rendered, {
        id: "note-lst-retained",
      }).props.disabled,
    ).toBe(true);
    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();

    requireButton(rendered, "Reconcile watchlist").props.onClick();
    await flushPromises(16);
    rendered = renderWorkspace();

    expect(apiMocks.saveMainPersonalWatchlist).not.toHaveBeenCalled();
    expect(textContent(rendered)).toContain(
      "Preview only — no changes were saved",
    );
    expect(textContent(rendered)).toContain("DROP");

    requireButton(
      rendered,
      "Remove 1 unmatched and finish reconciliation",
    ).props.onClick();
    await flushPromises();
    rendered = renderWorkspace();

    expect(apiMocks.saveMainPersonalWatchlist).toHaveBeenCalledOnce();
    const saved = apiMocks.saveMainPersonalWatchlist.mock.calls[0]?.[1];
    expect(saved?.snapshotSha256).toBe(snapshot().snapshotSha256);
    expect(saved?.memberships).toEqual([
      expect.objectContaining({
        listingId: "lst-retained",
        note: "Keep this note",
        symbol: "CURRENT",
      }),
    ]);
    expect(textContent(rendered)).toContain(
      "1 unmatched entry was removed (DROP)",
    );
  });

  it("retains an edited note through a conflicted save and reload", async () => {
    const storedRecord: PersonalWatchlistRecord = {
      id: "main",
      version: 2,
      createdAt: "2030-01-15T01:00:00.000Z",
      updatedAt: "2030-01-15T02:00:00.000Z",
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: snapshot().snapshotSha256,
        memberships: [membership("ONE", "lst-one")],
      },
    };
    apiMocks.fetchMainPersonalWatchlist
      .mockResolvedValueOnce(storedRecord)
      .mockResolvedValueOnce({ ...storedRecord, version: 3 });
    apiMocks.saveMainPersonalWatchlist.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("conflict"),
    );
    await activateWorkspace();
    let rendered = renderWorkspace();
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "note-lst-one" }).props.onChange({
      target: { value: "  Unsaved margin note  " },
    });
    rendered = renderWorkspace();

    requireButton(rendered, "Save note").props.onClick();
    await flushPromises();
    rendered = renderWorkspace();

    expect(
      requireElementByProps<{ value: string }>(rendered, {
        id: "note-lst-one",
      }).props.value,
    ).toBe("  Unsaved margin note  ");
    expect(textContent(rendered)).toContain(
      "The watchlist changed in another tab",
    );
  });

  it("prevents note edits while a save is in flight", async () => {
    const storedRecord: PersonalWatchlistRecord = {
      id: "main",
      version: 2,
      createdAt: "2030-01-15T01:00:00.000Z",
      updatedAt: "2030-01-15T02:00:00.000Z",
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: snapshot().snapshotSha256,
        memberships: [membership("ONE", "lst-one")],
      },
    };
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce(storedRecord);
    let finishSave: ((saved: SavedPersonalWatchlist) => void) | undefined;
    apiMocks.saveMainPersonalWatchlist.mockImplementationOnce(
      (_version: number, payload: PersonalWatchlistPayload) =>
        new Promise((resolve) => {
          finishSave = resolve;
          void payload;
        }),
    );
    await activateWorkspace();
    let rendered = renderWorkspace();

    requireButton(rendered, "Save note").props.onClick();
    rendered = renderWorkspace();

    expect(
      requireElementByProps<{ disabled?: boolean }>(rendered, {
        id: "note-lst-one",
      }).props.disabled,
    ).toBe(true);
    const pendingPayload =
      apiMocks.saveMainPersonalWatchlist.mock.calls[0]?.[1];
    if (pendingPayload === undefined || finishSave === undefined) {
      throw new Error("Expected pending watchlist save.");
    }
    finishSave({ version: 3, payload: pendingPayload });
    await flushPromises();
  });

  it("clears rendered private data when an operation loses the owner session", async () => {
    apiMocks.fetchMainPersonalWatchlist.mockResolvedValueOnce({
      id: "main",
      version: 2,
      createdAt: "2030-01-15T01:00:00.000Z",
      updatedAt: "2030-01-15T02:00:00.000Z",
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: snapshot().snapshotSha256,
        memberships: [membership("PRIVATE", "lst-private")],
      },
    });
    apiMocks.searchPersonalSecurities.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    await activateWorkspace();
    let rendered = renderWorkspace();
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "security-query" }).props.onChange({
      target: { value: "PRIVATE" },
    });
    rendered = renderWorkspace();
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, { className: "security-search-form" }).props.onSubmit({
      preventDefault: vi.fn(),
    });
    await flushPromises();
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Security discovery locked");
    expect(textContent(rendered)).toContain("Revalidate the session");
    expect(textContent(rendered)).not.toContain("PRIVATE");
    expect(textContent(rendered)).not.toContain("3,001");

    await expect(
      requireOwnerSession(rendered).props.onSessionChange(
        true,
        new AbortController().signal,
      ),
    ).resolves.toBe(true);
    rendered = renderWorkspace();
    expect(
      requireElementByProps<{ value: string }>(rendered, {
        id: "security-query",
      }).props.value,
    ).toBe("");
  });

  it("does not present transport failures as valid empty search results", async () => {
    apiMocks.searchPersonalSecurities.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("unavailable"),
    );
    await activateWorkspace();
    let rendered = renderWorkspace();
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "security-query" }).props.onChange({
      target: { value: "MISSING" },
    });
    rendered = renderWorkspace();
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, { className: "security-search-form" }).props.onSubmit({
      preventDefault: vi.fn(),
    });
    await flushPromises();
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain(
      "Search is temporarily unavailable",
    );
    expect(textContent(rendered)).not.toContain("No results to show");
  });

  it("clears private results synchronously when the owner session ends", async () => {
    await activateWorkspace();
    let rendered = renderWorkspace();
    expect(textContent(rendered)).toContain("Find a company");
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { id: "security-query" }).props.onChange({
      target: { value: "SHOULD CLEAR" },
    });
    rendered = renderWorkspace();

    const clearing = requireOwnerSession(rendered).props.onSessionChange(
      false,
      new AbortController().signal,
    );
    rendered = renderWorkspace();

    expect(textContent(rendered)).toContain("Security discovery locked");
    expect(textContent(rendered)).not.toContain("3,001");
    await expect(clearing).resolves.toBe(false);

    await expect(
      requireOwnerSession(rendered).props.onSessionChange(
        true,
        new AbortController().signal,
      ),
    ).resolves.toBe(true);
    rendered = renderWorkspace();
    expect(
      requireElementByProps<{ value: string }>(rendered, {
        id: "security-query",
      }).props.value,
    ).toBe("");
  });
});

async function activateWorkspace() {
  const owner = requireOwnerSession(renderWorkspace());
  await owner.props.onSessionChange(true, new AbortController().signal);
}

function renderWorkspace(): React.ReactNode {
  hookHarness.beginRender();
  return SecurityDiscoveryWorkspace();
}

function findOwnerSession(value: unknown) {
  return findElement<{
    onSessionChange: (active: boolean, signal: AbortSignal) => Promise<boolean>;
  }>(value, componentMocks.OwnerSession);
}

function requireOwnerSession(value: unknown) {
  const owner = findOwnerSession(value);
  if (owner === undefined) throw new Error("Expected owner-session panel.");
  return owner;
}

function requireButton(value: unknown, text: string) {
  const button = findAllElements(value, "button").find(
    (candidate) => textContent(candidate) === text,
  );
  if (button === undefined) throw new Error(`Expected button ${text}.`);
  return button as React.ReactElement<{
    disabled?: boolean;
    onClick: () => void;
  }>;
}

function requireElementByProps<Props extends object>(
  value: unknown,
  expected: Record<string, unknown>,
): React.ReactElement<Props> {
  const element = findAllElements(value).find((candidate) =>
    Object.entries(expected).every(
      ([key, expectedValue]) => candidate.props[key] === expectedValue,
    ),
  );
  if (element === undefined) throw new Error("Expected matching element.");
  return element as unknown as React.ReactElement<Props>;
}

function findAllElements(
  value: unknown,
  type?: React.ElementType,
): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) {
    return value.flatMap((child) => findAllElements(child, type));
  }
  if (!React.isValidElement(value)) return [];
  const own =
    type === undefined || value.type === type
      ? [value as React.ReactElement<Record<string, unknown>>]
      : [];
  return [
    ...own,
    ...findAllElements((value.props as { children?: unknown }).children, type),
  ];
}

function findElement<Props>(
  value: unknown,
  type: React.ElementType,
): React.ReactElement<Props> | undefined {
  return findAllElements(value, type)[0] as
    React.ReactElement<Props> | undefined;
}

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(textContent).join(" ");
  if (!React.isValidElement(value)) return "";
  return textContent((value.props as { children?: unknown }).children);
}

function snapshot(): PersonalSecurityMasterSnapshotReceiptDto {
  return {
    asOf: "2030-01-15T00:00:00.000Z",
    catalogId: "synthetic-browser-catalog",
    catalogVersion: "1.0.0",
    claim: "bounded_exact_owner_local_security_master_snapshot_admitted",
    coverage: {
      activeEligibleSecurities: 3_001,
      activeListings: 3_001,
      admittedSourceRecords: 3_001,
      basis: "owner_declared_snapshot_only",
      eligibleSecurityBand: "at_least_3000",
      formerTickerEntries: 0,
      ineligibleSourceRecords: 0,
      inactiveSecurities: 0,
      issuers: 2_990,
      providerMappings: 6_002,
      quarantinedSourceRecords: 0,
      sourceRecords: 3_001,
      staleSourceRecords: 0,
      shareClasses: 3_001,
      totalSecurities: 3_001,
      unsupportedSourceRecords: 0,
    },
    generatedAt: "2030-01-14T23:30:00.000Z",
    profile: "personal_single_user_local_security_master",
    provenance: {
      acquiredAt: "2030-01-14T23:00:00.000Z",
      artifacts: [],
      attribution: "Owner-local",
      contentKind: "owner_local_source",
      sourceId: "source-one",
      sourceRevision: `sha256:${"b".repeat(64)}`,
    },
    schemaVersion: "1.0.0",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    sourcePolicyCompatibility: {
      attribution: "required",
      cache: "permitted_owner_local",
      decision: "compatible",
      deleteOnRequest: true,
      display: "permitted_owner_local",
      effectiveAt: "2029-01-01T00:00:00.000Z",
      expiresAt: "2031-01-01T00:00:00.000Z",
      export: "prohibited",
      intendedUse: "personal_security_research",
      localOnly: true,
      operation: "fetch_snapshot",
      policyDocumentSha256: `sha256:${"c".repeat(64)}`,
      policyId: "policy-one",
      policyProfile: "personal_single_user_local_connected",
      policySchemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      redistribution: "prohibited",
      retention: "permitted_owner_local",
      reviewedAt: "2029-12-01T00:00:00.000Z",
      revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation",
      revokedAt: null,
      rightsBasis: "owner_reviewed_rights_compatible",
      search: "permitted_owner_local",
      sourceId: "source-one",
    },
    status: "admitted_for_personal_local_search",
  };
}

function searchResult(
  symbol: string,
  listingId: string,
): PersonalSecurityMasterSearchResultDto {
  const suffix = symbol.toLowerCase();
  return {
    cik: "0000000001",
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `iss-${suffix}`,
    issuerName: "Zero Alpha, Inc.",
    listingId,
    matchKind: "current_symbol_exact",
    matchedValue: symbol,
    securityId: `sec-${suffix}`,
    securityName: `${symbol} Common Stock`,
    shareClassId: `shr-${suffix}`,
    shareClassName: "Common",
    symbol,
  };
}

function membership(symbol: string, listingId: string) {
  const result = searchResult(symbol, listingId);
  return {
    country: result.country,
    exchangeMic: result.exchangeMic,
    instrumentType: result.instrumentType,
    issuerId: result.issuerId,
    issuerName: result.issuerName,
    listingId: result.listingId,
    note: "",
    securityId: result.securityId,
    securityName: result.securityName,
    shareClassId: result.shareClassId,
    shareClassName: result.shareClassName,
    symbol: result.symbol,
  };
}

async function flushPromises(iterations = 3) {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}
