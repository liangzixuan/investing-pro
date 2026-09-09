import type {
  PersonalScreenerSavedViewsRecordDto,
  PersonalSecurityMasterScreenResponseDto,
  PersonalSecurityMasterSnapshotReceiptDto,
} from "@research-cockpit/contracts";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookHarness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effects: Array<() => (() => void) | void> = [];
  return {
    beginRender() {
      stateIndex = 0;
      refIndex = 0;
      effects = [];
    },
    reset() {
      states.splice(0);
      refs.splice(0);
      stateIndex = 0;
      refIndex = 0;
      effects = [];
    },
    runEffects() {
      return effects.map((effect) => effect());
    },
    useEffect(effect: () => (() => void) | void) {
      effects.push(effect);
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

const apiMocks = vi.hoisted(() => ({
  fetchPersonalScreenerSavedViews: vi.fn(),
  savePersonalScreenerSavedViews: vi.fn(),
  screenPersonalSecurities: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal()),
  useEffect: (effect: () => (() => void) | void) =>
    hookHarness.useEffect(effect),
  useRef: <T,>(initial: T) => hookHarness.useRef(initial),
  useState: (initial: unknown) => hookHarness.useState(initial),
}));

vi.mock("@/lib/personal-workspace-api", () => ({
  ...apiMocks,
  createEmptyPersonalScreenerSavedViews: () => ({
    schemaVersion: 1,
    views: [],
  }),
  normalizePersonalScreenerSavedViewName: (value: unknown) => {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized.length > 0 && normalized.length <= 80 ? normalized : null;
  },
  PersonalWorkspaceApiError: class PersonalWorkspaceApiError extends Error {
    constructor(readonly code: string) {
      super("Personal workspace request failed.");
    }
  },
}));

import {
  buildPersonalStockScreenQuery,
  PersonalStockScreener,
  PERSONAL_STOCK_SCREENER_PAGE_SIZE,
  type PersonalStockScreenerProps,
} from "./PersonalStockScreener";

beforeEach(() => {
  hookHarness.reset();
  for (const mock of Object.values(apiMocks)) mock.mockReset();
  apiMocks.fetchPersonalScreenerSavedViews.mockResolvedValue(null);
  apiMocks.screenPersonalSecurities.mockResolvedValue(screenResponse());
  apiMocks.savePersonalScreenerSavedViews.mockResolvedValue({
    payload: { schemaVersion: 1, views: [] },
    version: 1,
  });
  vi.stubGlobal("crypto", {
    randomUUID: () => "11111111-2222-4333-8444-555555555555",
  });
});

describe("PersonalStockScreener", () => {
  it("starts as an explicit identity-only screen with accessible controls and no screen request", () => {
    const rendered = renderScreener();
    const text = textContent(rendered);

    expect(text).toContain("Screen listed companies");
    expect(text).toContain("local catalog identity fields only");
    expect(text).toContain("No screen has run in this owner session");
    expect(text).toContain("Reset criteria");
    expect(text).toContain("Saved screens retain definitions only");
    expect(apiMocks.screenPersonalSecurities).not.toHaveBeenCalled();
    expect(
      findElementByProps(rendered, {
        "aria-labelledby": "personal-stock-screener-title",
        "aria-busy": true,
      }),
    ).toBeDefined();
  });

  it("builds the four exact typed identity clauses and rejects malformed values", () => {
    expect(
      buildPersonalStockScreenQuery({
        cik: "0000320193",
        exchangeMics: " xnas, XNYS, xnas ",
        identityText: "  Apple  ",
        instrumentType: "common_stock",
      }),
    ).toEqual({
      clauses: [
        { field: "identity_text", operator: "matches", value: "Apple" },
        {
          field: "exchange_mic",
          operator: "in",
          values: ["XNAS", "XNYS"],
        },
        {
          field: "instrument_type",
          operator: "in",
          values: ["common_stock"],
        },
        { field: "cik", operator: "equals", value: "0000320193" },
      ],
      operator: "and",
    });
    expect(
      buildPersonalStockScreenQuery({
        cik: "123",
        exchangeMics: "XNAS",
        identityText: "",
        instrumentType: "all",
      }),
    ).toBeNull();
    expect(
      buildPersonalStockScreenQuery({
        cik: "",
        exchangeMics: "",
        identityText: "\uFDFA".repeat(128),
        instrumentType: "all",
      }),
    ).toBeNull();
    expect(
      buildPersonalStockScreenQuery({
        cik: "",
        exchangeMics: "",
        identityText: "--- 🎯",
        instrumentType: "all",
      }),
    ).toBeNull();
    expect(
      buildPersonalStockScreenQuery({
        cik: "",
        exchangeMics: "NASDAQ",
        identityText: "",
        instrumentType: "all",
      }),
    ).toBeNull();
  });

  it("runs only after explicit submission and renders sortable, paginated row actions", async () => {
    await loadSavedDefinitions();
    let rendered = renderScreener();
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { placeholder: "Example: Apple or AAPL" }).props.onChange({
      target: { value: "Apple" },
    });
    rendered = renderScreener();
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, { className: "personal-stock-screener-form" }).props.onSubmit({
      preventDefault: vi.fn(),
    });
    await flushPromises();
    rendered = renderScreener();

    expect(apiMocks.screenPersonalSecurities).toHaveBeenCalledWith(
      {
        page: { limit: PERSONAL_STOCK_SCREENER_PAGE_SIZE, offset: 0 },
        query: {
          clauses: [
            {
              field: "identity_text",
              operator: "matches",
              value: "Apple",
            },
          ],
          operator: "and",
        },
        schemaVersion: "1.0.0",
        snapshotSha256: snapshot().snapshotSha256,
        sort: { direction: "asc", field: "symbol" },
      },
      expect.any(AbortSignal),
    );
    expect(textContent(rendered)).toMatch(
      /Rows\s+1\s*–\s*1\s+of\s+30\s+exact listed-identity matches/u,
    );
    expect(
      requireElementByProps(rendered, { "aria-sort": "ascending" }),
    ).toBeDefined();
    expect(requireButton(rendered, "Open research").props.disabled).toBe(false);
    expect(requireButton(rendered, "Add").props.disabled).toBe(false);
    expect(requireButton(rendered, "Next").props.disabled).toBe(false);
  });

  it("aborts and ignores an in-flight response when criteria change", async () => {
    const pending = deferred<PersonalSecurityMasterScreenResponseDto>();
    apiMocks.screenPersonalSecurities.mockReturnValueOnce(pending.promise);
    await loadSavedDefinitions();
    let rendered = renderScreener();
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { placeholder: "Example: Apple or AAPL" }).props.onChange({
      target: { value: "Apple" },
    });
    rendered = renderScreener();
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, { className: "personal-stock-screener-form" }).props.onSubmit({
      preventDefault: vi.fn(),
    });
    const signal = apiMocks.screenPersonalSecurities.mock.calls[0]?.[1] as
      AbortSignal | undefined;
    rendered = renderScreener();
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { placeholder: "Example: Apple or AAPL" }).props.onChange({
      target: { value: "Microsoft" },
    });

    expect(signal?.aborted).toBe(true);
    pending.resolve(screenResponse());
    await flushPromises();
    rendered = renderScreener();
    expect(textContent(rendered)).toContain(
      "No screen has run in this owner session",
    );
    expect(findElementByType(rendered, "table")).toBeUndefined();
  });

  it("changes visible columns without staling results or disabling actions and pagination", async () => {
    await loadSavedDefinitions();
    let rendered = renderScreener();
    requireElementByProps<{
      onSubmit: (event: { preventDefault: () => void }) => void;
    }>(rendered, { className: "personal-stock-screener-form" }).props.onSubmit({
      preventDefault: vi.fn(),
    });
    await flushPromises();
    rendered = renderScreener();
    const checkboxes = findElementsByProps<{ onChange: () => void }>(rendered, {
      type: "checkbox",
    });
    checkboxes[1]?.props.onChange();
    rendered = renderScreener();

    expect(textContent(rendered)).not.toContain("Previous results are stale");
    expect(requireButton(rendered, "Open research").props.disabled).toBe(false);
    expect(requireButton(rendered, "Next").props.disabled).toBe(false);
    expect(apiMocks.screenPersonalSecurities).toHaveBeenCalledOnce();
  });

  it("warns before loading a definition saved against an older snapshot", async () => {
    apiMocks.fetchPersonalScreenerSavedViews.mockResolvedValueOnce(
      savedViewsRecord(),
    );
    await loadSavedDefinitions();
    let rendered = renderScreener();
    requireElementByProps<{
      onChange: (event: { target: { value: string } }) => void;
    }>(rendered, { "aria-label": "Saved screen definition" }).props.onChange({
      target: { value: "screen-old" },
    });
    rendered = renderScreener();

    expect(textContent(rendered)).toContain(
      "saved against an older security snapshot",
    );
    expect(findElementByProps(rendered, { role: "alert" })).toBeDefined();
    requireButton(rendered, "Load").props.onClick?.();
    rendered = renderScreener();
    expect(
      requireElementByProps<{ value: string }>(rendered, {
        "aria-label": "Instrument type",
      }).props.value,
    ).toBe("all");
  });
});

async function loadSavedDefinitions() {
  void renderScreener();
  void hookHarness.runEffects();
  await flushPromises();
}

function renderScreener(
  overrides: Partial<PersonalStockScreenerProps> = {},
): React.ReactNode {
  hookHarness.beginRender();
  return PersonalStockScreener({
    canAddToWatchlist: true,
    onAddToWatchlist: vi.fn(),
    onOpenResearch: vi.fn(),
    onSessionUnavailable: vi.fn(),
    savedListingIds: new Set(),
    snapshot: snapshot(),
    ...overrides,
  });
}

function screenResponse(): PersonalSecurityMasterScreenResponseDto {
  return {
    hasMore: true,
    limitApplied: 25,
    offset: 0,
    rows: [
      {
        cik: "0000320193",
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "iss-apple",
        issuerName: "Apple Inc.",
        listingId: "lst-apple",
        securityId: "sec-apple",
        securityName: "Apple Common Stock",
        shareClassId: "shr-apple",
        shareClassName: "Common",
        symbol: "AAPL",
      },
    ],
    schemaVersion: "1.0.0",
    snapshot: snapshot(),
    snapshotSha256: snapshot().snapshotSha256,
    totalMatches: 30,
    totalUniverse: 3_001,
  };
}

function savedViewsRecord(): PersonalScreenerSavedViewsRecordDto {
  return {
    createdAt: "2030-01-01T00:00:00.000Z",
    id: "stock-screener-saved-views",
    kind: "settings",
    payload: {
      schemaVersion: 1,
      views: [
        {
          columns: ["symbol", "issuer_name"],
          createdAgainstSnapshotSha256: `sha256:${"b".repeat(64)}`,
          id: "screen-old",
          name: "Older screen",
          query: {
            clauses: [
              {
                field: "instrument_type",
                operator: "in",
                values: ["adr", "common_stock"],
              },
            ],
            operator: "and",
          },
          sort: { direction: "asc", field: "symbol" },
        },
      ],
    },
    payloadSha256: "a".repeat(64),
    profile: "personal_single_user_local_vault",
    updatedAt: "2030-01-01T00:00:00.000Z",
    version: 1,
  };
}

function snapshot(): PersonalSecurityMasterSnapshotReceiptDto {
  return {
    asOf: "2030-01-15T00:00:00.000Z",
    catalogId: "catalog-personal",
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
      issuers: 3_000,
      providerMappings: 3_001,
      quarantinedSourceRecords: 0,
      sourceRecords: 3_001,
      staleSourceRecords: 0,
      shareClasses: 3_001,
      totalSecurities: 3_001,
      unsupportedSourceRecords: 0,
    },
    generatedAt: "2030-01-15T00:00:00.000Z",
    profile: "personal_single_user_local_security_master",
    provenance: {
      acquiredAt: "2030-01-14T00:00:00.000Z",
      artifacts: [
        {
          acquiredAt: "2030-01-14T00:00:00.000Z",
          artifactId: "source-artifact",
          contentSha256: `sha256:${"c".repeat(64)}`,
          mediaType: "application/json",
          sourceUri: "https://example.invalid/source.json",
          sourceVersion: "v1",
        },
      ],
      attribution: "Owner-local research sources.",
      contentKind: "owner_local_source",
      sourceId: "owner-source",
      sourceRevision: `sha256:${"d".repeat(64)}`,
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
      policyDocumentSha256: `sha256:${"e".repeat(64)}`,
      policyId: "owner-policy",
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
      sourceId: "owner-source",
    },
    status: "admitted_for_personal_local_search",
  };
}

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(textContent).join(" ");
  if (!React.isValidElement(value)) return "";
  const element = value as React.ReactElement<Record<string, unknown>>;
  if (typeof element.type === "function") {
    return textContent(
      Reflect.apply(element.type, undefined, [element.props]) as unknown,
    );
  }
  return textContent(element.props.children);
}

function findElementByType(
  value: unknown,
  type: React.ElementType,
): React.ReactElement | undefined {
  return findElements(value).find((element) => element.type === type);
}

function findElementByProps<Props>(
  value: unknown,
  expected: Readonly<Record<string, unknown>>,
): React.ReactElement<Props> | undefined {
  return findElementsByProps<Props>(value, expected)[0];
}

function requireElementByProps<Props>(
  value: unknown,
  expected: Readonly<Record<string, unknown>>,
): React.ReactElement<Props> {
  const match = findElementByProps<Props>(value, expected);
  if (match === undefined) throw new Error("Expected matching element.");
  return match;
}

function findElementsByProps<Props>(
  value: unknown,
  expected: Readonly<Record<string, unknown>>,
): React.ReactElement<Props>[] {
  return findElements(value).filter((element) =>
    Object.entries(expected).every(([key, expectedValue]) =>
      Object.is((element.props as Record<string, unknown>)[key], expectedValue),
    ),
  ) as React.ReactElement<Props>[];
}

function findElements(value: unknown): React.ReactElement[] {
  if (Array.isArray(value)) return value.flatMap(findElements);
  if (!React.isValidElement(value)) return [];
  const element = value as React.ReactElement<Record<string, unknown>>;
  if (typeof element.type === "function") {
    return [
      element,
      ...findElements(
        Reflect.apply(element.type, undefined, [element.props]) as unknown,
      ),
    ];
  }
  return [element, ...findElements(element.props.children)];
}

function requireButton(
  value: unknown,
  label: string,
): React.ReactElement<{ disabled?: boolean; onClick?: () => void }> {
  const button = findElements(value).find(
    (element) => element.type === "button" && textContent(element) === label,
  );
  if (button === undefined) throw new Error(`Expected ${label} button.`);
  return button as React.ReactElement<{
    disabled?: boolean;
    onClick?: () => void;
  }>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
