import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  MainWatchlistPayload,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import { ManagedWatchlistReview } from "./ManagedWatchlistReview";
import { reviewWatchlistVersions } from "./managed-watchlist-review";

function member(id: string, note = ""): WatchlistMembership {
  return {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: "invented-issuer",
    issuerName: "Invented issuer",
    listingId: `invented-listing-${id}`,
    securityId: `invented-security-${id}`,
    securityName: "Common stock",
    shareClassId: `invented-class-${id}`,
    shareClassName: `Class ${id}`,
    symbol: "SAME",
    note,
  };
}
function payload(memberships: WatchlistMembership[]): MainWatchlistPayload {
  return {
    name: "My Watchlist",
    schemaVersion: 1,
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    memberships,
  };
}
function html(saved: MainWatchlistPayload, draft: MainWatchlistPayload) {
  return renderToStaticMarkup(
    <ManagedWatchlistReview saved={saved} draft={draft} version={7} />,
  );
}

describe("watchlist version review", () => {
  it("counts unchanged entries and distinguishes a catalog-only difference", () => {
    const saved = payload([member("a"), member("b", "Same note")]);
    const draft: MainWatchlistPayload = {
      ...structuredClone(saved),
      snapshotSha256: `sha256:${"b".repeat(64)}`,
    };
    expect(reviewWatchlistVersions(saved, draft)).toEqual({
      entries: [],
      unchanged: 2,
      catalogChanged: true,
    });
    const output = html(saved, draft);
    expect(output).toContain("0 changed listings");
    expect(output).toContain("2 unchanged");
    expect(output).toContain("different catalogs");
    expect(output).toContain("The listings, notes and order are the same.");
    expect(reviewWatchlistVersions(payload([]), payload([]))).toEqual({
      entries: [],
      unchanged: 0,
      catalogChanged: false,
    });
  });

  it("pairs exact listing IDs despite equal symbols and compares raw notes and order", () => {
    const saved = payload([member("a", "Saved A"), member("b", "Saved B")]);
    const draft = payload([member("b", "Saved B"), member("a", " Draft A\n ")]);
    const before = JSON.stringify({ saved, draft });
    const review = reviewWatchlistVersions(saved, draft);
    expect(review.entries).toMatchObject([
      {
        listingId: "invented-listing-b",
        savedPosition: 2,
        draftPosition: 1,
        noteChanged: false,
        identityChanged: false,
      },
      {
        listingId: "invented-listing-a",
        savedPosition: 1,
        draftPosition: 2,
        noteChanged: true,
        identityChanged: false,
        saved: { note: "Saved A" },
        draft: { note: " Draft A\n " },
      },
    ]);
    expect(review.unchanged).toBe(0);
    expect(JSON.stringify({ saved, draft })).toBe(before);
    const output = html(saved, draft);
    expect(output).toContain("Position 2");
    expect(output).toContain("Position 1");
    expect(output).toContain("Order differs");
    expect(output).toContain(" Draft A\n ");
    expect(output).toContain("Saved A");
    expect(output).toContain("Saved B");
  });

  it("distinguishes absent membership from an empty note without ticker matching", () => {
    const saved = payload([member("removed")]);
    const draft = payload([member("added")]);
    expect(reviewWatchlistVersions(saved, draft).entries).toMatchObject([
      { listingId: "invented-listing-added", saved: null, draftPosition: 1 },
      { listingId: "invented-listing-removed", draft: null, savedPosition: 1 },
    ]);
    const output = html(saved, draft);
    expect(output).toContain("Only in my draft");
    expect(output).toContain("Only in the saved version");
    expect(output.match(/Not in this version/g)).toHaveLength(2);
    expect(output.match(/No note/g)).toHaveLength(2);
  });

  it("exposes complete changed identity metadata while retaining both notes", () => {
    const original = member("a", "Saved note");
    const updated: WatchlistMembership = {
      ...original,
      exchangeMic: "XNYS",
      instrumentType: "adr",
      issuerId: "invented-next-issuer",
      issuerName: "Next invented issuer",
      securityId: "invented-next-security",
      securityName: "Depositary receipt",
      shareClassId: "invented-next-class",
      shareClassName: "Next class",
      symbol: "NEXT",
      note: "Draft note",
    };
    const saved = payload([original]);
    const draft = payload([updated]);
    expect(reviewWatchlistVersions(saved, draft).entries[0]).toMatchObject({
      identityChanged: true,
      noteChanged: true,
    });
    const output = html(saved, draft);
    expect(output).toContain("Review changed listing identity");
    for (const key of Object.keys(original) as (keyof WatchlistMembership)[]) {
      if (original[key] !== updated[key]) {
        expect(output).toContain(original[key]);
        expect(output).toContain(updated[key]);
      }
    }
  });

  it("renders invalid, long and markup-like draft text as complete escaped text", () => {
    const raw = `  <script>invented()</script>\n${"x".repeat(2_001)}\u0001  `;
    const saved = payload([member("a", "Saved note")]);
    const draft = payload([member("a", raw)]);
    const output = html(saved, draft);
    expect(output).toContain("&lt;script&gt;invented()&lt;/script&gt;");
    expect(output).not.toContain("<script>");
    expect(output).toContain(`${"x".repeat(2_001)}\u0001  `);
    expect(draft.memberships[0]!.note).toBe(raw);
    expect(saved.memberships[0]!.note).toBe("Saved note");
  });
});
