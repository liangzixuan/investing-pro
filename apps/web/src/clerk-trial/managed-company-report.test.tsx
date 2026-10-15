import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { eodSelection, eodResponse } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import {
  response,
  row,
} from "../features/research/sec-annual-evidence-fixture";
import {
  cashGeneration,
  cashRow,
} from "../features/research/sec-annual-cash-fixture";
import {
  liquidity,
  liquidityRow,
} from "../features/research/sec-annual-liquidity-fixture";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import {
  companyReportBlock,
  companyReportIsCurrent,
  prepareCompanyReport,
} from "./managed-company-report";
import {
  CompanyReportView,
  ManagedCompanyReport,
} from "./ManagedCompanyReport";
import { TrialApiError } from "./api";

import type { WatchlistMembership } from "@research-cockpit/contracts";
import type { ResearchWatchlistState } from "./managed-workspace";
function draft(member: WatchlistMembership | null): ResearchWatchlistState {
  return {
    member,
    canEdit: member !== null,
    canAdd: member === null,
    reason: null,
  };
}

const note =
  "My café 東京 📈 assessment\n<unverified-link> & exact whitespace  ";
const now = () => new Date("2026-10-14T23:00:00.000Z");
async function fixture() {
  const base = await response([
    row(),
    row("SalesRevenueNet", "900"),
    row("NetIncomeLoss", "100"),
  ]);
  const packet = {
    ...base,
    evidence: {
      ...base.evidence,
      cashGeneration: await cashGeneration(base.evidence, [
        cashRow("operating_cash_flow", "250"),
        cashRow("ppe_purchases", "75"),
      ]),
      liquidity: await liquidity(base.evidence, [
        liquidityRow("current_assets", "800"),
        liquidityRow("current_liabilities", "400"),
      ]),
    },
  };
  const readPrice = vi.fn().mockResolvedValue(eodResponse());
  const readAnnual = vi.fn().mockResolvedValue(packet);
  const readFilings = vi
    .fn()
    .mockResolvedValue(filingsResponse(2, "available", eodSelection));
  const price = new ManagedEodHistory(readPrice, vi.fn(), undefined, [
    eodSelection.listing,
  ]);
  const annual = new ManagedAnnualReport(readAnnual, vi.fn());
  const filings = new ManagedCompanyFilings(readFilings, vi.fn());
  for (const model of [price, annual, filings]) model.open(eodSelection);
  const member = { ...eodSelection.listing, note };
  const evidence = () =>
    companySnapshotEvidence(
      eodSelection,
      price.getSnapshot(),
      annual.getSnapshot(),
      filings.getSnapshot(),
    );
  const prepare = () =>
    prepareCompanyReport(eodSelection, evidence(), draft(member), now);
  const all = async () => {
    await price.load();
    await annual.load();
    await filings.load();
  };
  return {
    price,
    annual,
    filings,
    readPrice,
    readAnnual,
    readFilings,
    member,
    watchlist: draft(member),
    evidence,
    prepare,
    all,
  };
}

describe("prepared loaded company research report", () => {
  it("starts closed and requires explicit loaded evidence without causing a read", async () => {
    const f = await fixture();
    const html = renderToStaticMarkup(
      <ManagedCompanyReport
        selection={eodSelection}
        {...f}
        onSection={vi.fn()}
      />,
    );
    expect(html).not.toContain("<details open");
    expect(html).toContain("Load at least one company source");
    expect(html).toContain("disabled");
    expect(f.prepare()).toBeNull();
    expect(f.readPrice).not.toHaveBeenCalled();
    expect(f.readAnnual).not.toHaveBeenCalled();
    expect(f.readFilings).not.toHaveBeenCalled();
  });

  it.each(["price", "annual", "filings"] as const)(
    "can prepare from only %s without silently loading the other sources",
    async (source) => {
      const f = await fixture();
      await f[source].load();
      const prepared = f.prepare()!;
      expect(prepared.kind).toBe("loaded_company_research");
      expect(prepared.preparedAt).toBe("2026-10-14T23:00:00.000Z");
      expect(prepared.note).toBe(note);
      expect(prepared.evidence[source]?.response).not.toBeNull();
      expect(
        companyReportIsCurrent(
          prepared,
          eodSelection,
          f.evidence(),
          draft(f.member),
        ),
      ).toBe(true);
      expect(
        [f.readPrice, f.readAnnual, f.readFilings].map(
          (read) => read.mock.calls.length,
        ),
      ).toEqual(
        ["price", "annual", "filings"].map((key) => (key === source ? 1 : 0)),
      );
    },
  );

  it("keeps each original source date and basis separate from preparation time and escapes the entire authored note", async () => {
    const f = await fixture();
    await f.all();
    const prepared = f.prepare()!;
    const html = renderToStaticMarkup(
      <CompanyReportView
        report={prepared}
        current
        block={null}
        invalidated={false}
        onPrepare={vi.fn()}
        onClear={vi.fn()}
        onSection={vi.fn()}
      />,
    );
    for (const text of [
      "Research report · ZERO",
      "Your watchlist draft at preparation",
      "My café 東京 📈 assessment\n&lt;unverified-link&gt; &amp; exact whitespace  ",
      "Claims and links in this note are not checked",
      "does not establish that the draft is saved",
      "2026-10-14T23:00:00.000Z",
      "Preparation does not renew",
      "101.5",
      "2026-09-19",
      "2026-09-20T00:00:01.000Z",
      "2026-09-20T00:00:02.000Z",
      "2025-01-01",
      "2025-12-31",
      "1000",
      "900",
      "10%",
      "11.11%",
      "250",
      "175",
      "400",
      "2.00×",
      "2026-07-15 to 2026-10-12",
      "2026-10-12T00:00:00.500Z",
      "does not establish complete coverage",
    ])
      expect(html).toContain(text);
    expect(prepared.evidence.price?.response).toBe(
      f.price.getSnapshot().response,
    );
    expect(prepared.evidence.annual?.response).toBe(
      f.annual.getSnapshot().response,
    );
    expect(prepared.evidence.filings?.response).toBe(
      f.filings.getSnapshot().response,
    );
    expect(f.member.note).toBe(note);
  });

  it.each([null, ""])(
    "distinguishes a missing membership from an empty note: %j",
    async (value) => {
      const f = await fixture();
      await f.price.load();
      const prepared = prepareCompanyReport(
        eodSelection,
        f.evidence(),
        draft(value === null ? null : { ...f.member, note: value }),
        now,
      )!;
      expect(prepared.note).toBe(value);
      const html = renderToStaticMarkup(
        <CompanyReportView
          report={prepared}
          current
          block={null}
          invalidated={false}
          onPrepare={vi.fn()}
          onClear={vi.fn()}
          onSection={vi.fn()}
        />,
      );
      expect(html).toContain(
        value === null
          ? "This company has no note in your watchlist draft."
          : "The watchlist note is empty.",
      );
    },
  );

  it.each(["price", "annual", "filings"] as const)(
    "a pending %s load refuses preparation and invalidates the old report",
    async (source) => {
      const f = await fixture();
      await f.all();
      const prepared = f.prepare()!;
      let finish!: (value: unknown) => void;
      const reader =
        source === "price"
          ? f.readPrice
          : source === "annual"
            ? f.readAnnual
            : f.readFilings;
      const previous = f[source].getSnapshot().response;
      reader.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const pending = f[source].load();
      expect(f.prepare()).toBeNull();
      expect(
        companyReportBlock(eodSelection, f.evidence(), draft(f.member)),
      ).toContain("Wait for source loads");
      expect(
        companyReportIsCurrent(
          prepared,
          eodSelection,
          f.evidence(),
          draft(f.member),
        ),
      ).toBe(false);
      finish(previous);
      await pending;
      expect(
        companyReportIsCurrent(
          prepared,
          eodSelection,
          f.evidence(),
          draft(f.member),
        ),
      ).toBe(false);
      expect(f.prepare()).not.toBeNull();
    },
  );

  it("a failed refresh retains original dates with a warning, while an invalid replacement removes those facts", async () => {
    const f = await fixture();
    await f.all();
    const prepared = f.prepare()!;
    f.readFilings.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.filings.load();
    expect(
      companyReportIsCurrent(
        prepared,
        eodSelection,
        f.evidence(),
        draft(f.member),
      ),
    ).toBe(false);
    const retained = f.prepare()!;
    expect(retained.evidence.filings?.showingPrevious).toBe(true);
    expect(retained.evidence.filings?.response?.completedAt).toBe(
      "2026-10-12T00:00:01.000Z",
    );
    f.readFilings.mockResolvedValueOnce({
      ...filingsResponse(2, "available", eodSelection),
      schemaVersion: "bad",
    });
    await f.filings.load();
    const replaced = f.prepare()!;
    expect(replaced.evidence.filings?.response).toBeNull();
    expect(replaced.evidence.price?.response).not.toBeNull();
    expect(
      companyReportIsCurrent(
        retained,
        eodSelection,
        f.evidence(),
        draft(f.member),
      ),
    ).toBe(false);
  });

  it.each(["close", "retire"] as const)(
    "%s invalidates the preview and leaves no preparable evidence",
    async (action) => {
      const f = await fixture();
      await f.all();
      const prepared = f.prepare()!;
      for (const model of [f.price, f.annual, f.filings]) model[action]();
      expect(
        companyReportIsCurrent(
          prepared,
          eodSelection,
          f.evidence(),
          draft(f.member),
        ),
      ).toBe(false);
      expect(f.prepare()).toBeNull();
    },
  );

  it("note edits, removal and intervening source-state replacement invalidate the captured preview", async () => {
    const f = await fixture();
    await f.price.load();
    const prepared = f.prepare()!;
    expect(
      companyReportIsCurrent(
        prepared,
        eodSelection,
        f.evidence(),
        draft({
          ...f.member,
          note: note + " changed",
        }),
      ),
    ).toBe(false);
    expect(
      companyReportIsCurrent(prepared, eodSelection, f.evidence(), draft(null)),
    ).toBe(false);
    expect(
      companyReportIsCurrent(
        prepared,
        { ...eodSelection },
        f.evidence(),
        draft(f.member),
      ),
    ).toBe(false);
    const same = f.evidence();
    expect(
      companyReportIsCurrent(
        prepared,
        eodSelection,
        { ...same, price: { ...same.price! } },
        draft(f.member),
      ),
    ).toBe(false);
    same.price = null;
    expect(prepared.evidence.price?.response).not.toBeNull();
  });

  it.each([
    "issuerId",
    "securityId",
    "shareClassId",
    "listingId",
    "symbol",
    "issuerName",
    "securityName",
    "shareClassName",
    "exchangeMic",
    "country",
  ] as const)(
    "refuses a different note %s before preparation or rendering",
    async (field) => {
      const f = await fixture();
      await f.price.load();
      const prepared = f.prepare()!;
      const changed = { ...f.member, [field]: "different" };
      expect(
        prepareCompanyReport(eodSelection, f.evidence(), draft(changed), now),
      ).toBeNull();
      expect(
        companyReportIsCurrent(
          prepared,
          eodSelection,
          f.evidence(),
          draft(changed),
        ),
      ).toBe(false);
    },
  );

  it.each(["catalog", "origin", "cik", "listing"] as const)(
    "refuses mismatched %s source state even if it bypasses the normal filtered view",
    async (field) => {
      const f = await fixture();
      await f.price.load();
      const selection =
        field === "catalog"
          ? {
              ...eodSelection,
              catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const,
            }
          : field === "origin"
            ? { ...eodSelection, origin: "route" as const }
            : field === "cik"
              ? { ...eodSelection, cik: "0000000002" }
              : {
                  ...eodSelection,
                  listing: { ...eodSelection.listing, shareClassId: "other" },
                };
      expect(
        prepareCompanyReport(
          eodSelection,
          { ...f.evidence(), price: { ...f.price.getSnapshot(), selection } },
          draft(f.member),
          now,
        ),
      ).toBeNull();
    },
  );

  it.each(["unloaded", "pending_save", "catalog_changed"])(
    "refuses an unavailable %s draft instead of claiming that its note is absent",
    async (reason) => {
      const f = await fixture();
      await f.price.load();
      const prepared = f.prepare()!;
      const unavailable: ResearchWatchlistState = {
        member: reason === "pending_save" ? f.member : null,
        canEdit: false,
        canAdd: false,
        reason: "Review the current watchlist operation first.",
      };
      expect(
        prepareCompanyReport(eodSelection, f.evidence(), unavailable, now),
      ).toBeNull();
      expect(companyReportBlock(eodSelection, f.evidence(), unavailable)).toBe(
        "Review the current watchlist operation first.",
      );
      expect(
        companyReportIsCurrent(
          prepared,
          eodSelection,
          f.evidence(),
          unavailable,
        ),
      ).toBe(false);
    },
  );

  it("an invalidated preview hides the old note and amounts immediately, before effect cleanup", async () => {
    const f = await fixture();
    await f.all();
    const prepared = f.prepare()!;
    const html = renderToStaticMarkup(
      <CompanyReportView
        report={prepared}
        current={false}
        block={null}
        invalidated={false}
        onPrepare={vi.fn()}
        onClear={vi.fn()}
        onSection={vi.fn()}
      />,
    );
    expect(html).toContain("Prepare a new report");
    expect(html).not.toContain("managed-prepared-report-heading");
    expect(html).not.toContain("Inspect report document");
    expect(html).not.toContain("My café");
    expect(html).not.toContain("101.5");
  });
});
