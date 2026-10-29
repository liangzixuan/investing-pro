import { describe, expect, it, vi } from "vitest";
import {
  MANAGED_SEC_FILINGS_LIMITS,
  parseManagedSecFilingsResponse,
  type ResearchFollowup,
} from "@research-cockpit/contracts";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";
import { filingReferenceNoteExcerpt } from "./managed-filings-note";
import {
  createFilingsAssessmentPort,
  prepareFilingsAssessment,
  type FilingsAssessmentPreview,
} from "./managed-filings-assessment";

function fixture(
  raw = "  Assessment · Cafe\u0301 東京 😀  ",
  retained = false,
) {
  const response = filingsResponse(2);
  const entry: ResearchFollowup = {
    id: "00000000-0000-4000-8000-000000000001",
    listing: filingsSelection.listing,
    catalogSnapshotSha256: response.catalogSnapshotSha256,
    check: "Does the next filing support the thesis?",
    dueOn: "2026-10-20",
    status: "open",
    completedOn: null,
    result: raw,
  };
  const state = { current: true, form: true };
  const editAssessment = vi.fn<(value: string) => boolean>(() => true);
  const input = {
    entry,
    response,
    showingPrevious: retained,
    isCurrent: () => state.current,
    editAssessment,
  };
  const port = createFilingsAssessmentPort(input)!;
  const filing = response.issuer.filings[0]!;
  const prepare = () =>
    prepareFilingsAssessment(port, filing, () => state.form);
  return {
    entry,
    response,
    input,
    port,
    filing,
    state,
    editAssessment,
    prepare,
  };
}

it("previews the whole raw result and complete qualified source citation without changing clocks or text", () => {
  const f = fixture();
  const before = structuredClone(f.response);
  const preview = f.prepare().preview!;
  const citation = filingReferenceNoteExcerpt(f.response, f.filing, false)!;
  expect(preview.result).toBe(f.entry.result + " " + citation);
  expect(preview.citation).toBe(citation);
  expect(preview.result).toContain("Cafe\u0301 東京 😀  ");
  expect(preview.entry).toBe(f.entry);
  expect(preview.listing).toBe(f.entry.listing);
  expect(preview.catalogSnapshotSha256).toBe(f.response.catalogSnapshotSha256);
  expect(preview.response).toBe(f.response);
  expect(preview.filing).toBe(f.filing);
  expect(Object.isFrozen(preview)).toBe(true);
  for (const value of [
    f.filing.accessionNumber,
    f.filing.sourceUrl,
    f.response.requestStartedAt,
    f.response.completedAt,
    f.response.issuer.fetchedAt,
  ])
    expect(preview.citation).toContain(value);
  expect(preview.citation).toContain("Filing contents were not fetched.");
  expect(preview.citation).toContain(
    "older continuation files were not loaded",
  );
  expect(f.response).toEqual(before);
  expect(f.editAssessment).not.toHaveBeenCalled();
});

it("applies once and consumes before a synchronous editor notification can reenter", () => {
  const f = fixture();
  const preview = f.prepare().preview!;
  f.editAssessment.mockImplementation(() => {
    expect(preview.apply()).toBe(false);
    expect(preview.isCurrent()).toBe(false);
    return true;
  });
  expect(preview.apply()).toBe(true);
  expect(preview.apply()).toBe(false);
  expect(f.editAssessment).toHaveBeenCalledExactlyOnceWith(preview.result);
});

it("cancels without editing and consumes even a refused editor attempt", () => {
  const f = fixture();
  const cancelled = f.prepare().preview!;
  cancelled.cancel();
  expect(cancelled.apply()).toBe(false);
  expect(f.editAssessment).not.toHaveBeenCalled();
  const refused = f.prepare().preview!;
  f.editAssessment.mockReturnValue(false);
  expect(refused.apply()).toBe(false);
  expect(refused.apply()).toBe(false);
  expect(f.editAssessment).toHaveBeenCalledOnce();
});

it("refuses copied ports and copied rows with the same accession", () => {
  const f = fixture();
  expect(
    prepareFilingsAssessment({ ...f.port }, f.filing, () => true).preview,
  ).toBeNull();
  expect(
    prepareFilingsAssessment(f.port, { ...f.filing }, () => true).preview,
  ).toBeNull();
  expect(f.editAssessment).not.toHaveBeenCalled();
});

describe("exact entry and source identity", () => {
  it.each([
    "listingId",
    "issuerId",
    "securityId",
    "shareClassId",
    "shareClassName",
    "symbol",
    "exchangeMic",
    "issuerName",
    "securityName",
    "country",
    "instrumentType",
  ] as const)("refuses a changed %s", (field) => {
    const f = fixture();
    const entry = {
      ...f.entry,
      listing: { ...f.entry.listing, [field]: "other" },
    };
    expect(createFilingsAssessmentPort({ ...f.input, entry })).toBeNull();
  });
  it("refuses a different catalog and an unavailable packet", () => {
    const f = fixture();
    expect(
      createFilingsAssessmentPort({
        ...f.input,
        entry: {
          ...f.entry,
          catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
        },
      }),
    ).toBeNull();
    expect(
      createFilingsAssessmentPort({
        ...f.input,
        response: filingsResponse(0, "upstream_unavailable"),
      }),
    ).toBeNull();
  });
});

it.each(["", "   ", "\t", "\n", "\u200b", "\ud800", "a".repeat(2001)])(
  "refuses empty or invalid authored text %j without changing it",
  (raw) => {
    const f = fixture(raw);
    expect(f.prepare().preview).toBeNull();
    expect(f.entry.result).toBe(raw);
    expect(f.editAssessment).not.toHaveBeenCalled();
  },
);

it("admits exactly 2000 Unicode code points and refuses 2001 without clipping", () => {
  const f = fixture("x");
  const citation = filingReferenceNoteExcerpt(f.response, f.filing, false)!;
  const available = 2000 - [...citation].length - 1;
  const raw = "😀".repeat(available);
  const exact = fixture(raw).prepare().preview!;
  expect([...exact.result]).toHaveLength(2000);
  expect(exact.result.startsWith(raw + " ")).toBe(true);
  const oversized = fixture(raw + "😀");
  expect(oversized.prepare().preview).toBeNull();
  expect(oversized.entry.result).toBe(raw + "😀");
});

it("refuses the exact complete citation already in the result", () => {
  const f = fixture();
  const citation = filingReferenceNoteExcerpt(f.response, f.filing, false)!;
  const duplicate = fixture("Assessment " + citation);
  expect(duplicate.prepare().reason).toContain("already");
  expect(duplicate.editAssessment).not.toHaveBeenCalled();
});

it("retains previous-response, truncation, history and missing report-date qualifications", () => {
  const f = fixture("Assessment", true);
  const count = MANAGED_SEC_FILINGS_LIMITS.filings;
  const retained = filingsResponse(count);
  const response = parseManagedSecFilingsResponse(
    {
      ...retained,
      issuer: {
        ...retained.issuer,
        truncated: true,
        matchingFilings: count + 1,
      },
    },
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: retained.catalogSnapshotSha256,
      listingId: retained.security.listingId,
      symbol: retained.security.symbol,
    },
  );
  expect(response).not.toBeNull();
  const port = createFilingsAssessmentPort({
    ...f.input,
    response: response!,
    showingPrevious: true,
  })!;
  const preview = prepareFilingsAssessment(
    port,
    response!.issuer.filings[1]!,
    () => true,
  ).preview!;
  expect(preview.citation).toContain("report date unavailable");
  expect(preview.citation).toContain(`truncated to ${count} of ${count + 1}`);
  expect(preview.citation).toContain("Retained previous filings response");
  expect(preview.citation).toContain(
    "The source lists older continuation files.",
  );
  expect(preview.showingPrevious).toBe(true);
});

it.each(["source", "form"] as const)(
  "permanently retires a preview on %s out and back",
  (kind) => {
    const f = fixture();
    const preview = f.prepare().preview!;
    if (kind === "source") f.state.current = false;
    else f.state.form = false;
    expect(preview.isCurrent()).toBe(false);
    f.state.current = f.state.form = true;
    expect(preview.isCurrent()).toBe(false);
    expect(preview.apply()).toBe(false);
    expect(f.editAssessment).not.toHaveBeenCalled();
  },
);

it("checks source authority again after a form callback changes it", () => {
  const f = fixture();
  const prepare = () =>
    prepareFilingsAssessment(f.port, f.filing, () => {
      f.state.current = false;
      return true;
    });
  expect(prepare().preview).toBeNull();
  expect(f.editAssessment).not.toHaveBeenCalled();
});

it("keeps the preview consumed if an editor observer throws", () => {
  const f = fixture();
  const prepared: FilingsAssessmentPreview = f.prepare().preview!;
  f.editAssessment.mockImplementation(() => {
    throw Error("observer failed");
  });
  expect(() => prepared.apply()).toThrow("observer failed");
  expect(prepared.apply()).toBe(false);
  expect(f.editAssessment).toHaveBeenCalledOnce();
});
