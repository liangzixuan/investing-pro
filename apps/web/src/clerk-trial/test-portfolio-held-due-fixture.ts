import { ManagedWorkspace } from "./managed-workspace";
import { vi } from "vitest";
import type { ResearchFollowupsPayload } from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import {
  portfolioScreenFixture,
  portfolioScreenLedger,
  portfolioScreenCatalog,
} from "./test-portfolio-screen-selection-fixture";
export async function heldDueFixture(
  portfolioLoaded = true,
  followupsLoaded = true,
) {
  const f = await portfolioScreenFixture(portfolioLoaded, false);
  let stored: { version: number; payload: ResearchFollowupsPayload } = {
    version: 3,
    payload: {
      schemaVersion: 1,
      entries: portfolioScreenLedger.identities.map((listing, index) => ({
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        listing,
        catalogSnapshotSha256: portfolioScreenCatalog.snapshotSha256,
        check: `Full original question ${index} · 東京 <script>escaped</script>`,
        result: `Full original result ${index} · Café`,
        dueOn: index === 2 ? "2026-11-30" : "2026-10-29",
        status: "open",
        completedOn: null,
      })),
    },
  };
  const api: ManagedApi = f.api;
  api.loadFollowups = vi.fn<ManagedApi["loadFollowups"]>(() =>
    Promise.resolve(structuredClone(stored)),
  );
  api.saveFollowups = vi.fn<ManagedApi["saveFollowups"]>((command) => {
    stored = { version: command.expectedVersion + 1, payload: command.payload };
    return Promise.resolve({ ...structuredClone(stored), replayed: false });
  });
  f.workspace.setView("followups");
  if (followupsLoaded) await f.workspace.followups.coordinator.load();
  if (followupsLoaded && !f.workspace.followups.getReviewContext())
    throw new Error(
      JSON.stringify({
        saved: f.workspace.followups.coordinator.getSnapshot(),
        model: f.workspace.followups.getSnapshot(),
      }),
    );
  const fresh: ManagedWorkspace[] = [];
  const makeFresh = () => {
    const workspace = new ManagedWorkspace(api, {
      userId: "invented-held-owner",
      sessionId: "invented-held-fresh-session",
      getToken: vi.fn(),
      signOut: () => Promise.resolve(),
    });
    fresh.push(workspace);
    return workspace;
  };
  return {
    ...f,
    makeFresh,
    dispose: () => {
      f.dispose();
      fresh.forEach((workspace) => workspace.sessionOwner.dispose());
    },
    api,
    intake: f.workspace.portfolioHeldDueChecks,
    review: f.workspace.followupsReview,
    stored: () => stored,
  };
}
