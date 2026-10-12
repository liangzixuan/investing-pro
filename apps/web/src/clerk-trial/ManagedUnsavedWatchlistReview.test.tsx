import type {
  MainWatchlistPayload,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactElement,
} from "react";
import { describe, expect, it } from "vitest";
import { ManagedUnsavedWatchlistReview } from "./ManagedUnsavedWatchlistReview";
import { ManagedWatchlistReview } from "./ManagedWatchlistReview";
import type { SaveState } from "./save-coordinator";

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

function state(
  overrides: Partial<SaveState<MainWatchlistPayload>> = {},
): SaveState<MainWatchlistPayload> {
  const saved = payload([member("a", "Saved A"), member("c", "Saved C")]);
  return {
    phase: "idle",
    saved: { version: 7, payload: saved },
    draft: payload([member("a", "Draft A"), member("c", "Saved C")]),
    baseVersion: 7,
    dirty: true,
    conflict: false,
    latestLoaded: true,
    uncertain: false,
    replayPending: false,
    message: "",
    signOutFailed: false,
    ...overrides,
  };
}

function html(snapshot = state()) {
  return renderToStaticMarkup(
    <ManagedUnsavedWatchlistReview state={snapshot} />,
  );
}

describe("ordinary unsaved watchlist review", () => {
  it("starts collapsed and identifies the full-draft scope and confirmed baseline", () => {
    const output = html();
    expect(output).toContain('<details id="managed-unsaved-review">');
    expect(output).toContain('<summary id="managed-unsaved-review-summary">');
    expect(output).toContain(
      "Review unsaved changes · 1 changed listing · 1 unchanged",
    );
    expect(output).toContain("Last confirmed saved version 7");
    expect(output).toContain("Current draft");
    expect(output).toContain("regardless of search or selection");
    expect(output).toContain("Another device may have saved a newer version.");
    expect(output).toContain(
      "checks the complete draft and its notes before saving",
    );
    expect(output.match(/<summary\b/gu)).toHaveLength(1);
    expect(output).not.toMatch(/<(button|input|textarea|a)\b/u);
  });

  it("preserves same-symbol identities, order, removed members and complete invalid text", () => {
    const raw = `  Café 😀 <script>invented()</script>\n${"x".repeat(2001)}\u0001  `;
    const saved = payload([
      member("a", "Saved A"),
      member("c", "Saved C"),
      member("removed"),
    ]);
    const draft = payload([
      member("c", "Saved C"),
      member("a", raw),
      member("added"),
    ]);
    const snapshot = state({ saved: { version: 7, payload: saved }, draft });
    const before = structuredClone(snapshot);
    const output = html(snapshot);
    expect(output).toContain("4 changed listings · 0 unchanged");
    const order = Array.from(
      output.matchAll(/data-managed-review-listing-id="([^"]+)"/gu),
      (match) => match[1],
    );
    expect(order).toEqual([
      "invented-listing-c",
      "invented-listing-a",
      "invented-listing-added",
      "invented-listing-removed",
    ]);
    expect(output).toContain("Class a");
    expect(output).toContain("Class c");
    expect(output).toContain("Position 1");
    expect(output).toContain("Position 2");
    expect(output).toContain("Order differs");
    expect(output).toContain("Only in current draft");
    expect(output).toContain("Only in the saved version");
    expect(output.match(/Not in this version/gu)).toHaveLength(2);
    expect(output.match(/No note/gu)).toHaveLength(2);
    expect(output).toContain(
      `  Café 😀 &lt;script&gt;invented()&lt;/script&gt;\n${"x".repeat(2001)}\u0001  `,
    );
    expect(output).not.toContain("<script>");
    expect(snapshot).toEqual(before);
  });

  it("renders changed identity fields inline while recovery retains its disclosure", () => {
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
      note: "Current note",
    };
    const saved = payload([original]);
    const draft = payload([updated]);
    const output = html(
      state({ saved: { version: 7, payload: saved }, draft }),
    );
    expect(output.match(/<summary\b/gu)).toHaveLength(1);
    expect(output).not.toContain("Review changed listing identity");
    for (const key of Object.keys(original) as (keyof WatchlistMembership)[]) {
      if (original[key] !== updated[key]) {
        expect(output).toContain(original[key]);
        expect(output).toContain(updated[key]);
      }
    }
    const recovery = renderToStaticMarkup(
      <ManagedWatchlistReview saved={saved} draft={draft} version={7} />,
    );
    expect(recovery).toContain(
      "<summary>Review changed listing identity</summary>",
    );
    expect(recovery).toContain("Saved: XNAS. My draft: XNYS.");
  });

  it.each([false, true])(
    "reports actual equality despite dirty=%s and a not-latest loaded copy",
    (dirty) => {
      const same = payload([member("a")]);
      const output = html(
        state({
          saved: { version: 8, payload: same },
          draft: structuredClone(same),
          dirty,
          latestLoaded: false,
        }),
      );
      expect(output).toContain("0 changed listings · 1 unchanged");
      expect(output).toContain(
        "No differences from last confirmed saved version 8.",
      );
      expect(output).not.toContain("data-managed-review-listing-id");
    },
  );

  it("keeps an empty saved/draft review and distinguishes catalog-only differences", () => {
    const empty = payload([]);
    const snapshot = state({
      saved: { version: 9, payload: empty },
      draft: structuredClone(empty),
    });
    expect(html(snapshot)).toContain(
      "No differences from last confirmed saved version 9.",
    );
    const updated = {
      ...empty,
      snapshotSha256: `sha256:${"b".repeat(64)}` as const,
    };
    const output = html({ ...snapshot, draft: updated });
    expect(output).toContain("0 changed listings · 0 unchanged");
    expect(output).toContain("different catalogs");
    expect(output).toContain(empty.snapshotSha256);
    expect(output).toContain(updated.snapshotSha256);
    expect(output).not.toContain("No differences");
  });

  it.each([
    ["loading", "Loading the saved version"],
    ["saving", "Saving the watchlist"],
    ["reconciling", "Finish save recovery above"],
    ["signing_out", "Check the sign-out review"],
  ] as const)(
    "keeps only the stable control and guidance while %s",
    (phase, message) => {
      const output = html(state({ phase }));
      expect(output).toContain('<details id="managed-unsaved-review">');
      expect(output).toContain('<summary id="managed-unsaved-review-summary">');
      expect(output).toContain(message);
      expect(output).not.toContain("Saved A");
      expect(output).not.toContain("Draft A");
      expect(output).not.toContain("changed listing");
    },
  );

  it.each(["conflict", "uncertain", "replayPending"] as const)(
    "defers %s to existing recovery without a duplicate comparison",
    (flag) => {
      const output = html(state({ [flag]: true }));
      expect(output).toContain("Finish save recovery above");
      expect(output).not.toContain("data-managed-review-listing-id");
      expect(output).not.toContain("Use saved version");
      expect(output).not.toContain("Keep my draft");
    },
  );

  it("does not invent an empty saved baseline", () => {
    const output = html(state({ saved: null, baseVersion: null }));
    expect(output).toContain("Load a saved version before reviewing changes.");
    expect(output).not.toContain("Draft A");
  });

  it.each([{ phase: "retired" as const }, { draft: null }])(
    "removes private review content on retirement or draft removal",
    (change) => {
      expect(html(state(change))).toBe("");
    },
  );

  it("leaves native details state uncontrolled across version and result changes", () => {
    const initial = state();
    const saved = { version: 8, payload: initial.draft! };
    for (const snapshot of [
      initial,
      { ...initial, phase: "saving" as const },
      { ...initial, saved, draft: saved.payload },
      { ...initial, conflict: true },
    ]) {
      const tree: ReactElement<ComponentProps<"details">> =
        ManagedUnsavedWatchlistReview({ state: snapshot })!;
      expect(tree.type).toBe("details");
      expect(tree.key).toBeNull();
      expect(tree.props.id).toBe("managed-unsaved-review");
      expect(tree.props).not.toHaveProperty("open");
      const summary = Children.toArray(tree.props.children)[0];
      if (!isValidElement<ComponentProps<"summary">>(summary))
        throw new Error("Expected the persistent summary");
      expect(summary.type).toBe("summary");
      expect(summary.props.id).toBe("managed-unsaved-review-summary");
    }
  });
});
