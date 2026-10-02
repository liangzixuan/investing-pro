import { renderToStaticMarkup } from "react-dom/server";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeMainWatchlistPayload,
  type MainWatchlistPayload,
  type ManagedCatalogSnapshotDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { ManagedWorkspaceScreen } from "./ManagedWorkspaceScreen";
import { TrialApiError } from "./api";
import { TrialFrame } from "./TrialFrame";
import { WorkspaceSearch } from "../features/workspace/WorkspaceSearch";
import type { AndroidBackAdapter } from "../mobile/android-back";
import { response as annualResponse } from "../features/research/sec-annual-evidence-fixture";

// Run the screen's actual listener effect explicitly; model and binder stay real.
const mounted = vi.hoisted(() => ({
  effects: [] as Array<() => (() => void) | void>,
  refs: [] as Array<{ current: unknown }>,
  cleanups: [] as Array<() => void>,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useEffect: (effect: () => (() => void) | void) =>
      mounted.effects.push(effect),
    useRef: (value: unknown) => {
      const ref = actual.useRef(value);
      mounted.refs.push(ref);
      return ref;
    },
  };
});
beforeEach(() => {
  mounted.effects.length = 0;
  mounted.refs.length = 0;
  mounted.cleanups.length = 0;
});
afterEach(() => {
  for (const cleanup of mounted.cleanups) cleanup();
  vi.unstubAllGlobals();
});

function nativeBackFixture() {
  let listener!: (event: { canGoBack: boolean }) => void;
  let registered!: (handle: { remove: () => Promise<void> }) => void;
  const remove = vi.fn<() => Promise<void>>().mockResolvedValue();
  const addListener = vi
    .fn<AndroidBackAdapter["addListener"]>()
    .mockImplementation((_name, callback) => {
      listener = callback;
      return new Promise<{ remove: () => Promise<void> }>((resolve) => {
        registered = resolve;
      });
    });
  const adapter: AndroidBackAdapter & { exitApp: () => Promise<void> } = {
    addListener,
    exitApp: vi.fn<() => Promise<void>>().mockResolvedValue(),
  };
  const historyBack = vi.fn();
  vi.stubGlobal("window", { history: { back: historyBack } });
  return {
    adapter,
    addListener,
    remove,
    historyBack,
    press: (canGoBack: boolean) => listener({ canGoBack }),
    ready: () => registered({ remove }),
  };
}
function mountEffects() {
  for (const effect of mounted.effects) {
    const cleanup = effect();
    if (cleanup) mounted.cleanups.push(cleanup);
  }
}

const payload: MainWatchlistPayload = {
  name: "My Watchlist",
  schemaVersion: 1,
  snapshotSha256: `sha256:${"a".repeat(64)}`,
  memberships: [
    {
      country: "US",
      exchangeMic: "XNAS",
      instrumentType: "common_stock",
      issuerId: "issuer-one",
      issuerName: "Invented issuer",
      listingId: "listing-one",
      securityId: "security-one",
      securityName: "Common stock",
      shareClassId: "class-one",
      shareClassName: "Class A",
      symbol: "DEMO",
      note: "Private research note",
    },
  ],
};
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: `sha256:${"a".repeat(64)}`,
  catalogId: "synthetic-catalog",
  catalogVersion: "synthetic-version",
  acquiredAt: "2026-09-29T00:00:00.000Z",
  generatedAt: "2026-09-30T00:00:00.000Z",
  asOf: "2026-09-30T12:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented engineering catalog",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 2,
    activeListings: 2,
    admittedSourceRecords: 2,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 1,
    providerMappings: 2,
    quarantinedSourceRecords: 0,
    sourceRecords: 2,
    staleSourceRecords: 0,
    shareClasses: 2,
    totalSecurities: 2,
    unsupportedSourceRecords: 0,
  },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function fixture(initial = payload) {
  const api: ManagedApi = {
    annualReport: vi.fn(),
    load: vi
      .fn<ManagedApi["load"]>()
      .mockResolvedValue({ version: 1, payload: initial }),
    save: vi.fn(),
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue({ snapshot }),
    search: vi.fn(),
    resolve: vi.fn(),
  };
  const workspace = new ManagedWorkspace(api, {
    userId: "synthetic-user",
    sessionId: "synthetic-session",
    getToken: vi.fn(),
    signOut: vi.fn(),
  });
  return {
    workspace,
    api,
    html: (androidBack?: AndroidBackAdapter) =>
      renderToStaticMarkup(
        <ManagedWorkspaceScreen
          workspace={workspace}
          {...(androidBack ? { androidBack } : {})}
        />,
      ),
  };
}
describe("managed workspace screen", () => {
  it("keeps the shared Search pending label and editable query by default", () => {
    const output = renderToStaticMarkup(
      <WorkspaceSearch
        query="DEMO"
        busy
        disabled={false}
        onChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    );
    expect(output).toContain(
      '<button type="submit" disabled="">Searching…</button>',
    );
    const input = output.match(/<input\b[^>]*>/u)?.[0];
    expect(input).toBeDefined();
    expect(input).toContain('value="DEMO"');
    expect(input).not.toContain('disabled=""');
  });
  it.each([false, true])(
    "labels a pending catalog status read without calling it Search (existing receipt: %s)",
    async (hasSnapshot) => {
      const { workspace, api, html } = fixture();
      await workspace.coordinator.load();
      if (hasSnapshot) await workspace.refreshCatalog();
      workspace.setQuery("DEMO");
      workspace.note("listing-one", "Draft during catalog read");
      const status = deferred<Awaited<ReturnType<ManagedApi["status"]>>>();
      vi.mocked(api.status).mockReturnValueOnce(status.promise);
      const pending = workspace.refreshCatalog();
      const output = html();
      const label = hasSnapshot ? "Refreshing catalog…" : "Loading catalog…";
      expect(output).toContain(`disabled="">${label}</button>`);
      expect(output).toContain(
        '<button type="submit" disabled="">Search</button>',
      );
      expect(output).not.toContain("Searching…");
      const input = output.match(
        /<input\b[^>]*id="workspace-company-query"[^>]*>/u,
      )?.[0];
      expect(input).toBeDefined();
      expect(input).toContain('value="DEMO"');
      expect(input).not.toContain('disabled=""');
      expect(output).toContain("Draft during catalog read");
      expect(output).toContain("Unsaved changes");
      if (hasSnapshot) expect(output).toContain(snapshot.asOf);
      else expect(output).not.toContain("Catalog as of");
      status.resolve({ snapshot });
      await pending;
      expect(html()).toContain('<button type="submit">Search</button>');
      expect(html()).not.toContain(label);
    },
  );
  it("shows explicit startup catalog recovery with the same visible query and draft", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    vi.mocked(api.status).mockRejectedValueOnce(
      new TrialApiError("unavailable"),
    );
    await workspace.refreshCatalog();
    const failure =
      "The catalog could not be loaded. Select Refresh catalog to try again.";
    const failed = html();
    expect(failed).toContain(failure);
    expect(failed).toContain("Private research note");
    expect(failed).not.toContain("Catalog as of");
    expect(failed).toMatch(
      /<button(?![^>]*disabled=)[^>]*>Refresh catalog<\/button>/u,
    );
    workspace.setQuery("DEMO");
    workspace.note("listing-one", "Draft survives catalog recovery");
    const status = deferred<Awaited<ReturnType<ManagedApi["status"]>>>();
    vi.mocked(api.status).mockReturnValueOnce(status.promise);
    const pending = workspace.refreshCatalog();
    const recovering = html();
    expect(recovering).toContain("Loading catalog…");
    expect(recovering).toContain('value="DEMO"');
    expect(recovering).toContain("Draft survives catalog recovery");
    expect(recovering).toContain("Unsaved changes");
    expect(recovering).not.toContain("Catalog as of");
    status.resolve({ snapshot });
    await pending;
    const recovered = html();
    expect(recovered).not.toContain(failure);
    expect(recovered).toContain('value="DEMO"');
    expect(recovered).toContain("Draft survives catalog recovery");
    expect(recovered).toContain("Unsaved changes");
    expect(recovered).toContain(
      `2 available listings · Catalog as of ${snapshot.asOf}`,
    );
    expect(api.load).toHaveBeenCalledTimes(1);
    expect(api.status).toHaveBeenCalledTimes(2);
    expect(api.search).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });
  it("keeps Search pending and recovery feedback distinct from the dated catalog", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setQuery("DEMO");
    workspace.note("listing-one", "Draft survives search failure");
    const search = deferred<Awaited<ReturnType<ManagedApi["search"]>>>();
    vi.mocked(api.search).mockReturnValueOnce(search.promise);
    const pending = workspace.search();
    const searching = html();
    expect(searching).toContain(
      '<button type="submit" disabled="">Searching…</button>',
    );
    expect(searching).toContain('disabled="">Refresh catalog</button>');
    expect(searching).not.toContain("Refreshing catalog…");
    const input = searching.match(
      /<input\b[^>]*id="workspace-company-query"[^>]*>/u,
    )?.[0];
    expect(input).toBeDefined();
    expect(input).not.toContain('disabled=""');
    search.reject(new TrialApiError("unavailable"));
    await pending;
    const failure =
      "The search could not be completed. Select Search to try again.";
    const failed = html();
    expect(failed).toContain(failure);
    expect(failed).not.toContain("The catalog could not be loaded.");
    expect(failed).toContain('<button type="submit">Search</button>');
    expect(failed).toContain('value="DEMO"');
    expect(failed).toContain("Draft survives search failure");
    expect(failed).toContain(snapshot.asOf);
    vi.mocked(api.search).mockResolvedValueOnce({
      snapshot,
      results: [],
      totalMatches: 0,
      limitApplied: 25,
      normalizedQuery: "DEMO",
    });
    await workspace.search();
    const recovered = html();
    expect(recovered).not.toContain(failure);
    expect(recovered).toContain("No matching listings in this catalog.");
    expect(recovered).toContain("Draft survives search failure");
    expect(recovered).toContain('value="DEMO"');
    expect(recovered).toContain(snapshot.asOf);
    expect(api.search).toHaveBeenCalledTimes(2);
    expect(api.status).toHaveBeenCalledTimes(1);
    expect(api.load).toHaveBeenCalledTimes(1);
    expect(api.save).not.toHaveBeenCalled();
  });
  it("directs a failed catalog review to its own existing action", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    vi.mocked(api.resolve).mockRejectedValueOnce(
      new TrialApiError("unavailable"),
    );
    await workspace.reviewCatalog();
    const output = html();
    expect(output).toContain(
      "The catalog review could not be completed. Select Review catalog changes to try again.",
    );
    expect(output).toMatch(
      /<button(?![^>]*disabled=)[^>]*>Review catalog changes<\/button>/u,
    );
    expect(output).toContain(snapshot.asOf);
    expect(output).toContain("Private research note");
    expect(api.save).not.toHaveBeenCalled();
  });
  it("does not install native navigation for the browser screen", () => {
    const native = nativeBackFixture();
    fixture().html();
    mountEffects();
    expect(native.addListener).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "consumes Annual Back before native history (%s), restores focus and preserves the draft",
    async (canGoBack) => {
      const native = nativeBackFixture();
      const initial = {
        ...payload,
        memberships: [
          payload.memberships[0]!,
          {
            ...payload.memberships[0]!,
            listingId: "listing-two",
            symbol: "OTHER",
          },
        ],
      };
      const { workspace, html } = fixture(initial);
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.note("listing-one", "Unsaved native note");
      workspace.move("listing-two", -1);
      html(native.adapter);
      mountEffects();
      native.ready();
      const focus = vi.fn();
      mounted.refs[0]!.current = { isConnected: true, focus };
      workspace.openWatchlistAnnual(
        workspace.coordinator.getSnapshot().draft!.memberships[1]!,
      );
      const before = structuredClone(workspace.coordinator.getSnapshot().draft);
      native.press(canGoBack);
      expect(workspace.annual.getSnapshot().selection).toBeNull();
      expect(workspace.coordinator.getSnapshot().draft).toEqual(before);
      expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
      expect(focus).toHaveBeenCalledOnce();
      expect(native.historyBack).not.toHaveBeenCalled();
      expect(native.adapter.exitApp).not.toHaveBeenCalled();
      native.press(false);
      expect(native.historyBack).not.toHaveBeenCalled();
      native.press(true);
      expect(native.historyBack).toHaveBeenCalledOnce();
      expect(native.adapter.exitApp).not.toHaveBeenCalled();
    },
  );
  it("native Back aborts a pending read and fences its late result while restoring fallback focus", async () => {
    const native = nativeBackFixture();
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    html(native.adapter);
    mountEffects();
    native.ready();
    const focus = vi.fn();
    mounted.refs[0]!.current = { isConnected: false, focus: vi.fn() };
    mounted.refs[1]!.current = { focus };
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    let complete!: (
      value: Awaited<ReturnType<ManagedApi["annualReport"]>>,
    ) => void;
    vi.mocked(api.annualReport).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const pending = workspace.annual.load();
    const signal = vi.mocked(api.annualReport).mock.calls[0]![1];
    native.press(false);
    expect(signal.aborted).toBe(true);
    expect(focus).toHaveBeenCalledOnce();
    complete(await annualResponse());
    await pending;
    expect(workspace.annual.getSnapshot().response).toBeNull();
    expect(workspace.annual.getSnapshot().selection).toBeNull();
    expect(native.historyBack).not.toHaveBeenCalled();
  });
  it.each(["retire", "unmount"] as const)(
    "fences %s immediately and removes late registration once",
    async (reason) => {
      const native = nativeBackFixture();
      const { workspace, html } = fixture();
      await workspace.coordinator.load();
      html(native.adapter);
      mountEffects();
      if (reason === "retire") workspace.coordinator.retire();
      else mounted.cleanups[0]!();
      native.press(true);
      native.press(false);
      native.ready();
      await Promise.resolve();
      expect(native.historyBack).not.toHaveBeenCalled();
      expect(native.adapter.exitApp).not.toHaveBeenCalled();
      expect(native.remove).toHaveBeenCalledOnce();
      mounted.cleanups[0]!();
      expect(native.remove).toHaveBeenCalledOnce();
    },
  );
  it("keeps the watchlist mounted beside an explicit annual panel and gates old catalog entries", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note("listing-one", "Draft survives Back");
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistAnnual(member);
    const output = html();
    expect(output).toContain("Annual report · DEMO");
    expect(output).toContain("Load annual report");
    expect(output).toContain("Back to workspace");
    expect(output).toContain("My Watchlist");
    expect(output).toContain("Draft survives Back");
    expect(output).toContain("Unsaved changes");
    expect(api.annualReport).not.toHaveBeenCalled();
    workspace.annual.close();
    expect(html()).not.toContain("Load annual report");
    expect(html()).toContain("Draft survives Back");
    vi.mocked(api.status).mockResolvedValue({
      snapshot: { ...snapshot, snapshotSha256: `sha256:${"b".repeat(64)}` },
    });
    await workspace.refreshCatalog();
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="Annual report for saved DEMO"/u,
    );
    expect(html()).toContain(
      "before adding, saving or opening an annual report",
    );
  });
  it("renders the reused accessible search and full exact-listing editing controls", async () => {
    const { workspace, html } = fixture();
    await workspace.coordinator.load();
    const output = html();
    expect(output).toContain('aria-label="Find a company"');
    expect(output).toContain('maxLength="128"');
    expect(output).toContain("Discover");
    expect(output).toContain("My Watchlist");
    expect(output).toContain("Invented issuer");
    expect(output).toContain("Class A");
    expect(output).toContain("XNAS");
    expect(output).toContain("Listing ID: listing-one");
    expect(output).toContain('for="managed-note-0"');
    expect(output).toContain("Private research note");
    expect(output).toContain('aria-label="Move DEMO up"');
    expect(output).toContain('aria-label="Remove DEMO"');
    expect(output).toContain("Save watchlist");
    expect(output).toContain("Review catalog changes");
    expect(output).toContain("Sign out this session");
    expect(output).toContain('aria-live="polite"');
  });

  it("clears private notes, query and controls immediately on retirement", async () => {
    const { workspace, html } = fixture();
    await workspace.coordinator.load();
    workspace.setQuery("Private search");
    workspace.coordinator.retire();
    const output = html();
    expect(output).not.toContain("Private research note");
    expect(output).not.toContain("Private search");
    expect(output).not.toContain("textarea");
    expect(output).not.toContain("Find a company");
    expect(output).not.toContain("Save watchlist");
    expect(output).toContain("local watchlist data has been cleared");
  });

  it("presents the latest saved notes before the explicit conflict choices", async () => {
    const { workspace, html } = fixture();
    await workspace.coordinator.load();
    workspace.note("listing-one", "My changed draft");
    await workspace.coordinator.load();
    const output = html();
    expect(output).toContain("My changed draft");
    expect(output).toContain("Private research note");
    expect(output).toContain("Saved version 1");
    expect(output).toContain("Use saved version");
    expect(output).toContain("Keep my draft");
    expect(output).toContain("the next save replaces this saved version");
  });

  it("uses product copy for managed mode while preserving the default DEMO frame", () => {
    const managed = renderToStaticMarkup(
      <TrialFrame managed>
        <p>Managed workspace</p>
      </TrialFrame>,
    );
    const demo = renderToStaticMarkup(
      <TrialFrame>
        <p>Demo workspace</p>
      </TrialFrame>,
    );
    expect(managed).toContain("Discover companies");
    expect(managed).not.toContain("Synthetic data only");
    expect(managed).toContain("Software licenses");
    expect(demo).toContain("Synthetic data only");
    expect(demo).toContain("isolated trial");
  });

  it("shows finite access failure without rendering saved data", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    vi.mocked(api.load).mockRejectedValueOnce(
      new TrialApiError("access_denied"),
    );
    await workspace.coordinator.load();
    expect(html()).toContain("cannot access the shared watchlist");
    expect(html()).not.toContain("Private research note");
  });

  it("labels catalog identity changes for people and keeps confirmation accurate after saving", async () => {
    const { workspace, api, html } = fixture();
    const updatedSnapshot: ManagedCatalogSnapshotDto = {
      ...snapshot,
      snapshotSha256: `sha256:${"b".repeat(64)}`,
    };
    vi.mocked(api.status).mockResolvedValue({ snapshot: updatedSnapshot });
    vi.mocked(api.resolve).mockResolvedValue({
      snapshotSha256: updatedSnapshot.snapshotSha256,
      results: [
        {
          listingId: "listing-one",
          listing: {
            country: "US",
            exchangeMic: "XNYS",
            instrumentType: "adr",
            issuerId: "issuer-updated",
            issuerName: "Updated invented issuer",
            listingId: "listing-one",
            securityId: "security-updated",
            securityName: "Updated security",
            shareClassId: "class-updated",
            shareClassName: "Updated share class",
            symbol: "NEXT",
          },
        },
      ],
    });
    vi.mocked(api.save).mockImplementation((command) =>
      Promise.resolve({
        version: command.expectedVersion + 1,
        payload: command.payload,
        replayed: false,
      }),
    );
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    await workspace.reviewCatalog();
    const review = html();
    for (const [key, label] of [
      ["exchangeMic", "Exchange MIC"],
      ["instrumentType", "Instrument type"],
      ["issuerId", "Issuer ID"],
      ["issuerName", "Company name"],
      ["securityId", "Security ID"],
      ["securityName", "Security name"],
      ["shareClassId", "Share class ID"],
      ["shareClassName", "Share class name"],
      ["symbol", "Ticker"],
    ]) {
      expect(review).toContain(`<dt>${label}</dt>`);
      expect(review).not.toContain(`<dt>${key}</dt>`);
    }
    workspace.applyReview();
    expect(html()).toContain("Catalog changes applied.");
    expect(html()).toContain("Unsaved changes");
    await workspace.coordinator.save();
    expect(html()).toContain("Version 2 · Saved");
    expect(html()).toContain("Catalog changes applied.");
    expect(html()).not.toContain("Save the watchlist to share them");
    expect(html()).toContain("Private research note");
  });

  it("disables Save with an explanation for invalid notes, then enables it after correction", async () => {
    const { workspace, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note("listing-one", "x".repeat(2001));
    expect(workspace.canSavePayload()).toBe(false);
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*>Save watchlist<\/button>/u,
    );
    expect(html()).toContain(
      "Use at most 2,000 characters per note, without control characters.",
    );
    workspace.note("listing-one", "Corrected note");
    expect(workspace.canSavePayload()).toBe(true);
    expect(html()).toContain("<button>Save watchlist</button>");
    expect(html()).not.toContain('id="managed-save-issue"');
  });

  it("enables Save at the exact canonical byte limit and explains one extra byte before dispatch", async () => {
    const memberships = Array.from({ length: 32 }, (_, index) => ({
      ...payload.memberships[0]!,
      listingId: `listing-${index}`,
      issuerName: "😀".repeat(128),
      securityName: "😀".repeat(128),
      shareClassName: "😀".repeat(128),
      note: "",
    }));
    const maximum = { ...payload, memberships };
    const bytes = () =>
      new TextEncoder().encode(encodeMainWatchlistPayload(maximum)).byteLength;
    let remaining = 262144 - bytes();
    for (const member of memberships) {
      const astral = Math.min(2000, Math.floor(remaining / 4));
      const ascii = Math.min(2000 - astral, remaining - astral * 4);
      member.note = "😀".repeat(astral) + "x".repeat(ascii);
      remaining -= astral * 4 + ascii;
    }
    expect(remaining).toBe(0);
    expect(bytes()).toBe(262144);
    const { workspace, api, html } = fixture(maximum);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const last = memberships.at(-1)!;
    workspace.note(last.listingId, last.note);
    expect(workspace.canSavePayload()).toBe(true);
    expect(html()).toContain("<button>Save watchlist</button>");
    workspace.note(last.listingId, `${last.note}x`);
    expect(workspace.canSavePayload()).toBe(false);
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*>Save watchlist<\/button>/u,
    );
    expect(html()).toContain(
      "This watchlist is too large to save. Shorten notes or remove entries.",
    );
    await workspace.coordinator.save();
    expect(api.save).not.toHaveBeenCalled();
    workspace.note(last.listingId, last.note);
    expect(workspace.canSavePayload()).toBe(true);
    expect(html()).toContain("<button>Save watchlist</button>");
  });
});
