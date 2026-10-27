import { describe, expect, it, vi } from "vitest";
import { lookupPersonalSecurityMasterListing } from "@research-cockpit/personal-security-master";
import { parsePersonalSecInterimCanonicalResponse } from "@research-cockpit/personal-financial-analytics";
import { createSecPersonalInterimEvidenceProvider } from "./personal-sec-interim-evidence-provider";
import { encodePersonalSecInterimCanonicalResponse } from "./personal-sec-interim-canonical-response";
import { getManagedWorkspaceCatalog } from "./managed-workspace-catalog";
import { freezeSecCanonicalGraph } from "./personal-sec-canonical-input";
import {
  INTERIM_ENTRY,
  INTERIM_CONTACT,
  interimCommand,
  interimSourceFetch,
} from "./test-personal-sec-interim-fixtures";
async function fixture() {
  const request = interimCommand();
  const catalog = getManagedWorkspaceCatalog();
  const listing = lookupPersonalSecurityMasterListing(
    catalog,
    request.listingId,
  )!;
  const provider = createSecPersonalInterimEvidenceProvider(INTERIM_CONTACT, {
    fetch: interimSourceFetch(),
    now: () => new Date(INTERIM_ENTRY),
    scheduler: { wait: () => Promise.resolve() },
  });
  const evidence = await provider.loadEvidence(listing.cik);
  return { request, catalog, listing, evidence };
}
describe("interim response ownership and wire boundary", () => {
  it("encodes the entire frozen graph,public8field tuple and exact v1hashes for independent client admission", async () => {
    const f = await fixture();
    const result = encodePersonalSecInterimCanonicalResponse(
      f.request,
      f.catalog.snapshotSha256,
      f.listing,
      f.evidence,
    );
    expect(result.body).toBe(JSON.stringify(result.response));
    expect(result.byteLength).toBe(Buffer.byteLength(result.body));
    expect(Object.keys(result.response)).toEqual([
      "schemaVersion",
      "catalogSnapshotSha256",
      "security",
      "evidence",
    ]);
    expect(Object.keys(result.response.security).sort()).toEqual(
      [
        "country",
        "exchangeMic",
        "issuerId",
        "issuerName",
        "listingId",
        "securityName",
        "symbol",
        "cik",
      ].sort(),
    );
    expect(result.response.evidence).toBe(f.evidence);
    expect(
      await parsePersonalSecInterimCanonicalResponse(
        JSON.parse(result.body) as unknown,
        f.request,
        new AbortController().signal,
      ),
    ).not.toBeNull();
  });
  it("does not read or export unrelated catalog properties", async () => {
    const f = await fixture();
    const privateRead = vi.fn(() => {
      throw new Error("Private field must never be read");
    });
    const listing = { ...f.listing };
    Object.defineProperty(listing, "ownerOnlyField", {
      get: privateRead,
      enumerable: true,
    });
    const result = encodePersonalSecInterimCanonicalResponse(
      f.request,
      f.catalog.snapshotSha256,
      listing,
      f.evidence,
    );
    expect(privateRead).not.toHaveBeenCalled();
    expect(result.body).not.toContain("ownerOnlyField");
  });
  it.each(["issuerName", "securityName", "symbol", "cik"] as const)(
    "refuses public accessor%s without invoking it",
    async (field) => {
      const f = await fixture();
      const getter = vi.fn(() => "forbidden");
      const listing = { ...f.listing };
      Object.defineProperty(listing, field, { get: getter, enumerable: true });
      expect(() =>
        encodePersonalSecInterimCanonicalResponse(
          f.request,
          f.catalog.snapshotSha256,
          listing,
          f.evidence,
        ),
      ).toThrowError(expect.objectContaining({ code: "invalid_identity" }));
      expect(getter).not.toHaveBeenCalled();
    },
  );
  it("refuses stale catalog/selection and unowned or rehashed-looking evidence", async () => {
    const f = await fixture();
    expect(() =>
      encodePersonalSecInterimCanonicalResponse(
        f.request,
        `sha256:${"0".repeat(64)}`,
        f.listing,
        f.evidence,
      ),
    ).toThrowError(expect.objectContaining({ code: "catalog_changed" }));
    expect(() =>
      encodePersonalSecInterimCanonicalResponse(
        { ...f.request, symbol: "GOOG" },
        f.catalog.snapshotSha256,
        f.listing,
        f.evidence,
      ),
    ).toThrowError(expect.objectContaining({ code: "invalid_identity" }));
    const clone = structuredClone(f.evidence);
    expect(() =>
      encodePersonalSecInterimCanonicalResponse(
        f.request,
        f.catalog.snapshotSha256,
        f.listing,
        clone,
      ),
    ).toThrowError(expect.objectContaining({ code: "invalid_evidence" }));
    const tampered = structuredClone(f.evidence);
    Object.assign(tampered.facts.observations[0]!, { value: "1000000" });
    expect(() =>
      encodePersonalSecInterimCanonicalResponse(
        f.request,
        f.catalog.snapshotSha256,
        f.listing,
        freezeSecCanonicalGraph(tampered),
      ),
    ).toThrowError(expect.objectContaining({ code: "invalid_evidence" }));
  });
});
