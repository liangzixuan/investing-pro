import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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
function fixture(initial = payload) {
  const api: ManagedApi = {
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
    html: () =>
      renderToStaticMarkup(<ManagedWorkspaceScreen workspace={workspace} />),
  };
}
describe("managed workspace screen", () => {
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
