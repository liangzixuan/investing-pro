import { readFileSync } from "node:fs";
import { load, type CheerioAPI } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { ManagedEodHistory } from "../../src/clerk-trial/ManagedEodHistory";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { createFixture } from "./fixture";

const nativeSource = readFileSync(
  new URL(
    "../../android/app/src/androidTest/java/local/investment/personal/ManagedWorkspaceInstrumentedTest.java",
    import.meta.url,
  ),
  "utf8",
);
const nativeSelectors = [
  ...nativeSource.matchAll(
    /(['"])(\.managed-eod-history[^'"]*\btbody[^'"]*)\1/gu,
  ),
].map((match) => match[2]!);
const table = ".managed-eod-history .managed-eod-table-scroll > table";
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.sessionOwner.dispose();
});

async function panel(range: "1m" | "1y") {
  const fixture = await createFixture(
    range === "1y" ? "company-price-ranges" : "default",
  );
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      priceCoverage: fixture.priceCoverage,
      marketsCohort: fixture.marketsCohort,
    },
  );
  owners.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.openWatchlistEod(
    workspace.coordinator.getSnapshot().draft!.memberships[0]!,
  );
  workspace.eod.selectRange(range);
  const selection = workspace.getSnapshot().research!.selection;
  const html = () =>
    load(
      renderToStaticMarkup(
        createElement(ManagedEodHistory, {
          model: workspace.eod,
          studiesActions: {
            prepare: (response, keys, isCurrent) =>
              workspace.preparePriceStudiesNote(
                selection,
                response,
                keys,
                isCurrent,
              ),
            isCurrent: (preview) =>
              workspace.priceStudiesNoteIsCurrent(preview),
            append: (preview) => workspace.appendPriceStudiesNote(preview),
          },
        }),
      ),
    );
  return { fixture, workspace, html };
}

function exactRows($: CheerioAPI, selector: string) {
  return $(selector)
    .toArray()
    .map((row) =>
      $(row)
        .find("th,td")
        .toArray()
        .map((cell) => $(cell).text().trim())
        .join("|"),
    )
    .join(";");
}

describe("native exact-close selectors alongside derived Price study tables", () => {
  it.each([
    { range: "1m", count: 2, rows: "2026-09-18|100.25;2026-09-19|101.5" },
    {
      range: "1y",
      count: 3,
      rows: "2025-09-22|80.125;2026-03-20|90.25;2026-09-19|101.5",
    },
  ] as const)(
    "keeps the original $range date/value/count predicates independent of all seven study rows",
    async ({ range, count, rows }) => {
      const f = await panel(range);
      const unloaded = f.html();
      expect(nativeSelectors).toHaveLength(10);
      expect(new Set(nativeSelectors)).toEqual(
        new Set([`${table} > tbody`, `${table} > tbody tr`]),
      );
      for (const selector of nativeSelectors)
        expect(unloaded(selector).length).toBe(0);
      await f.workspace.requestResearchSource(
        f.workspace.getSnapshot().research!,
        "eod",
      );
      const $ = f.html();
      expect(
        $(".managed-eod-history .managed-price-studies tbody tr").length,
      ).toBe(7);
      expect($(".managed-eod-history tbody tr").length).toBe(count + 7);
      expect(exactRows($, ".managed-eod-history tbody tr")).not.toBe(rows);
      expect($(`${table} > caption`).text()).toBe("Raw closing prices in USD");
      for (const selector of nativeSelectors) {
        expect($(selector).length).toBe(selector.endsWith(" tr") ? count : 1);
        if (selector.endsWith(" tr")) expect(exactRows($, selector)).toBe(rows);
      }
      expect(f.fixture.getSnapshot()).toMatchObject({
        eod: 1,
        save: 0,
        annual: 0,
        filings: 0,
      });
    },
  );
});
