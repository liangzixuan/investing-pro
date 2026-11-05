import { createManagedDueCheckEvidenceReportSource } from "../../src/clerk-trial/managed-due-check-evidence-report-source";
import { DueCheckEvidenceReportSnapshot } from "../../src/clerk-trial/DueCheckEvidenceReportSnapshot";
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
  "executes the native fixture's finished report with partial/full readings, uncaptured row and separate Save/Load contract (%s)",
  async (navigation) => {
    const f = await createFixture("due-check-evidence-report"),
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
    for (let i = 0; i < 2; i++) {
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
      let partialReading = null;
      if (i === 0) {
        const partial = retain();
        partialReading = partial;
        // The failed Filings request's final state change retires pass authority.
        // Capture keeps that exact state; the explicit continuation is separate.
        expect(partial.sourcePass.phase).toBe("invalidated");
        expect(partial.sourcePass.rows.map((x) => x.disposition)).toEqual([
          "loaded",
          "loaded",
          "failed",
          "not_attempted",
        ]);
        const capturedPass = structuredClone(partial.sourcePass);
        await run();
        expect(w.reviewEvidence.getSnapshot().selected!.reading).toBe(partial);
        expect(partial.sourcePass).toEqual(capturedPass);
        expect(w.companySourcePass.getSnapshot().phase).toBe("finished");
      }
      const reading = partialReading ?? retain();
      captured.push(reading);
      if (i < 2) {
        expect(reading.evidence.price!.response).toEqual(data.price[i]);
        expect(reading.evidence.annual!.response).toEqual(data.annual[i]);
        if (i === 1) {
          expect(reading.evidence.filings!.response).toEqual(data.filings[i]);
          expect(reading.evidence.interim!.response).toEqual(data.interim[i]);
        } else expect(reading.evidence.filings!.response).toBeNull();
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
    expect(w.reviewEvidence.getSnapshot().rows.map((x) => x.reading)).toEqual([
      ...captured,
      null,
    ]);
    expect(w.coordinator.getSnapshot().draft).toBeNull();
    expect(f.followups!.getSnapshot().commits).toBe(0);
    const source = createManagedDueCheckEvidenceReportSource(
      w,
      () => !w.getSnapshot().research && !w.getSnapshot().companyRoute,
    );
    const capture = source.capture()!;
    expect(capture).not.toBeNull();
    expect(capture.report.rows.map((row) => row.reading)).toEqual([
      ...captured,
      null,
    ]);
    expect(capture.report.rows.map((row) => row.entry)).toEqual(
      r.getSnapshot().chosen.map((row) => row.entry),
    );
    expect(capture.report.rows[0]!.entry.result).toBe(evidenceAssessments[0]);
    expect(capture.report.rows[0]!.reading!.check.result).toBe("");
    expect(capture.report.rows[0]!.reading!.sourcePass).toEqual(
      captured[0]!.sourcePass,
    );
    expect(capture.report.rows[0]!.reading!.sourcePass.phase).toBe(
      "invalidated",
    );
    expect(capture.report.rows[1]!.reading!.sourcePass.phase).toBe("finished");
    expect(capture.report.resource).toMatchObject({
      savedVersion: 7,
      baseVersion: 7,
      dirty: true,
    });
    const counts = data.getSnapshot();
    const $ = load(
      renderToStaticMarkup(
        createElement(DueCheckEvidenceReportSnapshot, {
          report: capture.report,
        }),
      ),
    );
    expect($("button,input,select,textarea,pre")).toHaveLength(0);
    expect($("[data-due-check-report-entry]")).toHaveLength(3);
    expect($.text()).not.toContain(data.original.entries[3]!.id);
    expect(data.getSnapshot()).toBe(counts);
    expect(f.followups!.getSnapshot().commits).toBe(0);
    await w.followups.coordinator.save();
    expect(capture.current()).toBe(false);
    source.dispose();
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
