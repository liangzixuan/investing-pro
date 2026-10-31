import { expect, it, vi } from "vitest";
import {
  ManagedCompanyFilings,
  captureManagedCompanyFilingsSeed,
  captureManagedFollowupsReviewFilingsSeed,
} from "./managed-company-filings";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
const selection = { ...filingsSelection, origin: "followups" as const };
const options = { coverage: inventedManagedResearchCoverage };
it("keeps Watchlist admission strict and independently copies a branded exact Follow-ups review seed", () => {
  const response = filingsResponse(2, "available", selection);
  const raw = { response, showingPrevious: true };
  expect(captureManagedCompanyFilingsSeed(selection, raw, options)).toBeNull();
  const seed = captureManagedFollowupsReviewFilingsSeed(
    selection,
    raw,
    () => true,
    options,
  )!;
  const read = vi.fn();
  const model = new ManagedCompanyFilings(read, vi.fn(), undefined, options);
  model.openReview(selection, seed);
  expect(model.getSnapshot()).toMatchObject({
    response,
    responseOrigin: "followups-review",
    showingPrevious: true,
  });
  expect(model.getSnapshot().response).not.toBe(seed.response);
  expect(read).not.toHaveBeenCalled();
  model.open(selection, seed);
  expect(model.getSnapshot().selection).toBeNull();
  model.openReview(selection, { ...seed });
  expect(model.getSnapshot().selection).toBeNull();
});
it("refuses retired ownership, foreign class/CIK and forged raw packet", () => {
  let current = true;
  const raw = {
    response: filingsResponse(1, "available", selection),
    showingPrevious: false,
  };
  const seed = captureManagedFollowupsReviewFilingsSeed(
    selection,
    raw,
    () => current,
    options,
  )!;
  const model = new ManagedCompanyFilings(vi.fn(), vi.fn(), undefined, options);
  model.openReview({ ...selection, cik: "0000000002" }, seed);
  expect(model.getSnapshot().selection).toBeNull();
  model.openReview(
    { ...selection, listing: { ...selection.listing, shareClassId: "other" } },
    seed,
  );
  expect(model.getSnapshot().selection).toBeNull();
  current = false;
  model.openReview(selection, seed);
  expect(model.getSnapshot().selection).toBeNull();
  expect(
    captureManagedFollowupsReviewFilingsSeed(
      selection,
      { ...raw, response: { ...raw.response, completedAt: "invalid" } },
      () => true,
      options,
    ),
  ).toBeNull();
});

it.each([
  "country",
  "exchangeMic",
  "instrumentType",
  "issuerId",
  "issuerName",
  "listingId",
  "securityId",
  "securityName",
  "shareClassId",
  "shareClassName",
  "symbol",
] as const)(
  "refuses copied same-issuer seed after exact listing field %s changes",
  (field) => {
    const seed = captureManagedFollowupsReviewFilingsSeed(
      selection,
      {
        response: filingsResponse(1, "available", selection),
        showingPrevious: false,
      },
      () => true,
      options,
    )!;
    const model = new ManagedCompanyFilings(
      vi.fn(),
      vi.fn(),
      undefined,
      options,
    );
    const changed = {
      ...selection,
      listing: {
        ...selection.listing,
        [field]: selection.listing[field] + " changed",
      },
    };
    model.openReview(changed, seed);
    expect(model.getSnapshot().selection).toBeNull();
  },
);
