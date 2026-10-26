import { describe, expect, it } from "vitest";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { createFixture } from "./fixture";
import {
  authorInventedFollowupsReviewReport,
  inventedFollowupsReportPayload,
} from "./native-followups-review-report-fixture";

describe("invented native Follow-ups report journey", () => {
  it("requires explicit load and setup, keeps all mixed entries and separately saves and freshly loads the complete resource", async () => {
    const fixture = await createFixture("followups-review-report");
    const workspace = new ManagedWorkspace(
      fixture.api,
      fixture.session,
      undefined,
      {
        priceCoverage: fixture.priceCoverage,
        researchCoverage: fixture.researchCoverage,
        marketsCohort: fixture.marketsCohort,
      },
    );
    try {
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.setView("followups");
      expect(authorInventedFollowupsReviewReport(workspace, fixture)).toBe(
        false,
      );
      await workspace.followups.coordinator.load();
      expect(authorInventedFollowupsReviewReport(workspace, fixture)).toBe(
        true,
      );
      expect(authorInventedFollowupsReviewReport(workspace, fixture)).toBe(
        false,
      );
      const expected = inventedFollowupsReportPayload(fixture);
      expect(workspace.followups.coordinator.getSnapshot().draft).toEqual(
        expected,
      );
      expect(expected.entries.map((entry) => entry.status)).toEqual([
        "open",
        "completed",
        "open",
      ]);
      expect(expected.entries[2]?.dueOn).toBe("2099-12-31");
      expect(
        workspace.coordinator
          .getSnapshot()
          .draft?.memberships.some(
            (member) =>
              member.listingId === expected.entries[2]?.listing.listingId,
          ),
      ).toBe(false);
      expect(fixture.followups?.getSnapshot()).toMatchObject({
        load: 1,
        save: 0,
        commits: 0,
      });
      await workspace.followups.coordinator.save();
      expect(fixture.followups?.getSnapshot()).toMatchObject({
        save: 1,
        commits: 1,
      });
      await workspace.followups.coordinator.load();
      expect(workspace.followups.coordinator.getSnapshot()).toMatchObject({
        baseVersion: 1,
        dirty: false,
        draft: expected,
        saved: { version: 1, payload: expected },
      });
      expect(fixture.getSnapshot()).toMatchObject({
        save: 0,
        eod: 0,
        annual: 0,
        filings: 0,
      });
    } finally {
      workspace.sessionOwner.dispose();
    }
  });
});
