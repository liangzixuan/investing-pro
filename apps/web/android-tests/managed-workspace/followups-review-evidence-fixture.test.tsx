import { OfflineResearchReading } from "../../src/clerk-trial/ManagedScreenResearchReading";
import { afterEach, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { createFixture } from "./fixture";
import { evidenceAssessments } from "./followups-review-evidence-fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { FollowupEvidenceReading } from "../../src/clerk-trial/ManagedFollowupsReviewEvidence";
const live: ManagedWorkspace[] = [];
afterEach(() => {
  live.splice(0).forEach((w) => w.sessionOwner.dispose());
});
it.each(["direct", "routed"])(
  "executes the native fixture's exact partial, retained, two-class, unsupported and separate Save/Load contract (%s)",
  async (navigation) => {
    const f = await createFixture("followups-review-evidence"),
      data = f.followupsEvidence!;
    const make = () => {
      const w = new ManagedWorkspace(
        f.api,
        live.length ? f.followups!.nextSession() : f.session,
        undefined,
        {
          researchCoverage: f.researchCoverage,
          priceCoverage: f.priceCoverage,
          interimIssuers: ["0000000001"],
          marketsCohort: f.marketsCohort,
        },
      );
      live.push(w);
      return w;
    };
    const w = make();
    w.setView("followups");
    await w.refreshCatalog();
    await w.followups.coordinator.load();
    const r = w.followupsReview;
    expect(r.enter()).toBe(true);
    expect(r.getSnapshot().rows).toHaveLength(3);
    r.getSnapshot().rows.forEach((row) =>
      r.choose(r.getSnapshot(), row.handle),
    );
    r.start(r.getSnapshot());
    const captured = [];
    for (let i = 0; i < 3; i++) {
      const prepared = await w.prepareFollowupResearch(
        r.captureCurrent(r.getSnapshot())!,
      );
      expect(prepared).not.toBeNull();
      w.openFollowupResearch(prepared!);
      if (navigation === "routed") {
        const opened = w.getSnapshot().research!;
        w.setNavigationBlocked(true);
        expect(w.reviewEvidence.getSnapshot().canCapture).toBe(false);
        await w.setCompanyRoute({
          kind: "company",
          listingId: opened.selection.listing.listingId,
          section: opened.section,
        });
      }
      const visit = w.getSnapshot().research!;
      const run = async () => {
        const p = w.prepareCompanySourcePass(visit, [
          "eod",
          "annual",
          "filings",
          "interim",
        ]);
        expect(p).not.toBeNull();
        await w.runCompanySourcePass(visit, p!);
      };
      await run();
      const retain = () => {
        const next = w.captureFollowupEvidence(w.reviewEvidence.getSnapshot());
        expect(
          next,
          w.reviewEvidence.getSnapshot().reason ?? "",
        ).not.toBeNull();
        return next!.selected!.reading!;
      };
      if (i === 0) {
        const partial = retain();
        expect(partial.sourcePass.rows.map((x) => x.disposition)).toEqual([
          "loaded",
          "loaded",
          "failed",
          "not_attempted",
        ]);
        await run();
        expect(w.reviewEvidence.getSnapshot().selected!.reading).toBe(partial);
      }
      const reading = retain();
      captured.push(reading);
      if (i < 2) {
        expect(reading.evidence.price!.response).toEqual(data.price[i]);
        expect(reading.evidence.annual!.response).toEqual(data.annual[i]);
        expect(reading.evidence.filings!.response).toEqual(data.filings[i]);
        expect(reading.evidence.interim!.response).toEqual(data.interim[i]);
        const $ = load(
          renderToStaticMarkup(
            createElement(
              OfflineResearchReading.Provider,
              { value: true },
              createElement(FollowupEvidenceReading, { reading }),
            ),
          ),
        );
        const raw = $("pre")
          .toArray()
          .map((el) => {
            try {
              return JSON.parse($(el).text()) as unknown;
            } catch {
              return null;
            }
          });
        expect(raw).toContainEqual(reading);
        expect($("button,input,select,textarea")).toHaveLength(0);
        expect($("article").text()).toContain(
          reading.evidence.price!.response!.completedAt,
        );
        w.followups.edit(
          r.getSnapshot().selected!.entry,
          "result",
          evidenceAssessments[i]!,
        );
      } else
        expect(
          reading.sourcePass.rows.every(
            (row) => row.disposition === "unsupported",
          ),
        ).toBe(true);
      w.returnFromResearch();
      if (navigation === "routed") {
        w.setNavigationBlocked(false);
        await w.setCompanyRoute(null);
      }
      expect(w.reviewEvidence.getSnapshot().rows[i]!.reading).toBe(reading);
      if (i === 0)
        w.followups.complete(r.getSnapshot().selected!.entry, new Date());
      if (i < 2) r.continue(r.getSnapshot());
    }
    r.finish(r.getSnapshot());
    expect(w.reviewEvidence.getSnapshot().rows.map((x) => x.reading)).toEqual(
      captured,
    );
    expect(w.coordinator.getSnapshot().draft).toBeNull();
    expect(f.followups!.getSnapshot().commits).toBe(0);
    await w.followups.coordinator.save();
    expect(f.followups!.getSnapshot().commits).toBe(1);
    expect(data.saved().entries[3]).toEqual(data.original.entries[3]);
    const saved = data.saved(),
      requests = data.getSnapshot().requests;
    w.sessionOwner.dispose();
    const fresh = make();
    fresh.setView("followups");
    await fresh.refreshCatalog();
    await fresh.followups.coordinator.load();
    expect(fresh.followups.coordinator.getSnapshot().draft).toEqual(saved);
    expect(fresh.reviewEvidence.getSnapshot().rows).toEqual([]);
    expect(data.getSnapshot().requests).toEqual(requests);
    expect(data.getSnapshot().rejected).toBe(0);
  },
);
it("refuses unrelated reads, early Save and wrong source identity without committing", async () => {
  for (const kind of ["watchlist", "save", "source"]) {
    const f = await createFixture("followups-review-evidence"),
      s = new AbortController().signal;
    const request =
      kind === "watchlist"
        ? f.api.load(s)
        : kind === "save"
          ? f.api.saveFollowups(
              {
                expectedVersion: 7,
                idempotencyKey: "early",
                payload: f.followupsEvidence!.original,
              },
              s,
            )
          : f.api.eodHistory(
              {
                catalogSnapshotSha256: f.followupsEvidence!.digest,
                listingId: "wrong",
                range: "1y",
              },
              s,
            );
    await expect(request).rejects.toThrow();
    expect(f.followups!.getSnapshot().commits).toBe(0);
    expect(f.followupsEvidence!.getSnapshot().rejected).toBe(1);
  }
});
