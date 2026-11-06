import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  projectPersonalPortfolioLedger,
  type ManagedPortfolioPayload,
} from "@research-cockpit/contracts";
import { eodSelection } from "./eod-history-fixture";
import { PortfolioGroupComparison } from "./PortfolioGroupComparison";

it("shows complete before/after holdings, unknown basis, closed holdings and authored order", () => {
  const identity = eodSelection.listing;
  const baseline: ManagedPortfolioPayload = {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: eodSelection.catalogSnapshotSha256,
    basisMethod: "fifo_with_opening_pool",
    identities: [identity],
    opening: {
      asOfDate: "2026-10-01",
      cashUsd: null,
      holdings: [
        {
          listingId: identity.listingId,
          shares: "2.000000",
          totalCostBasisUsd: null,
          confirmedOn: "2026-10-01",
        },
      ],
    },
    transactions: [],
  };
  const candidate: ManagedPortfolioPayload = {
    ...baseline,
    transactions: [
      {
        id: "sell-all",
        date: "2026-10-02",
        type: "sell",
        listingId: identity.listingId,
        shares: "2.000000",
        grossUsd: "250.00",
        feeUsd: "1.00",
      },
      {
        id: "cash-deposit",
        date: "2026-10-02",
        type: "deposit",
        listingId: null,
        shares: null,
        grossUsd: "50.00",
        feeUsd: "0.00",
      },
    ],
  };
  const before = projectPersonalPortfolioLedger(baseline, "2026-11-06");
  const after = projectPersonalPortfolioLedger(candidate, "2026-11-06");
  if (before.status !== "valid" || after.status !== "valid")
    throw Error("Invalid invented fixture");
  const html = renderToStaticMarkup(
    <PortfolioGroupComparison
      baseline={baseline}
      candidate={candidate}
      before={before}
      after={after}
      evaluationDay="2026-11-06"
    />,
  );
  expect(html).toContain("Before this group");
  expect(html).toContain("After this group");
  expect(html).toContain("2.000000");
  expect(html).toContain("Not held");
  expect(html).toContain("Unknown");
  expect(html).toContain(identity.listingId);
  expect(html).toContain(identity.shareClassId);
  expect(html).toContain("2026-11-06");
  expect(html.indexOf("sell-all")).toBeLessThan(html.indexOf("cash-deposit"));
  expect(html).toContain("1 of 1");
  expect(html).toContain("Complete authored activity order");
  expect(html).not.toContain("USD null");
});
