import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { resolvePersonalSecInterimStatements } from "@research-cockpit/personal-financial-analytics";
import { createSecPersonalInterimEvidenceProvider } from "./personal-sec-interim-evidence-provider";
import {
  INTERIM_CONTACT,
  INTERIM_ENTRY,
  interimPackets,
  interimSourceFetch,
} from "./test-personal-sec-interim-fixtures";
function fixture(packets: readonly unknown[] = interimPackets()) {
  const fetch = vi.fn(interimSourceFetch(packets));
  const provider = createSecPersonalInterimEvidenceProvider(INTERIM_CONTACT, {
    fetch,
    now: () => new Date(INTERIM_ENTRY),
    scheduler: { wait: () => Promise.resolve() },
  });
  return { provider, fetch };
}
describe("CompanyFacts-only interim provider", () => {
  it("captures complete source fingerprints and a separate interim generation/observation domain", async () => {
    const packets = interimPackets();
    const f = fixture(packets);
    const evidence = await f.provider.loadEvidence("0000320193");
    expect(evidence.generation.definitionVersion).toBe("1.0.0");
    expect(evidence.generation.sources.submissions).toMatchObject({
      status: "available",
      fetchedAt: INTERIM_ENTRY,
      bytes: Buffer.byteLength(JSON.stringify(packets[0])),
      sha256: `sha256:${createHash("sha256").update(JSON.stringify(packets[0])).digest("hex")}`,
    });
    expect(evidence.generation.sources.companyFacts.status).toBe("available");
    expect(
      evidence.facts.observations.every((row) =>
        row.id.startsWith("sec-interim-fact:"),
      ),
    ).toBe(true);
    expect(Object.isFrozen(evidence.facts.observations)).toBe(true);
    expect(f.fetch).toHaveBeenCalledTimes(2);
    f.provider.close();
    expect(f.provider.status()).toEqual({ configured: false });
  });
  it.each(["amendment", "tie", "incomplete"] as const)(
    "refuses %s metadata before selecting facts, never an older-accession fallback",
    async (kind) => {
      const [submissions, facts] = interimPackets();
      const recent = submissions.filings.recent;
      if (kind === "amendment") {
        recent.accessionNumber.push("0000320193-26-000043");
        recent.form.push("10-Q/A");
        recent.filingDate.push("2026-08-02");
        recent.reportDate.push("2026-06-30");
        recent.acceptanceDateTime.push("2026-08-02T12:00:00.000Z");
      }
      if (kind === "tie") {
        recent.accessionNumber.push("0000320193-26-000043");
        recent.form.push("10-Q");
        recent.filingDate.push("2026-08-01");
        recent.reportDate.push("2026-06-30");
        recent.acceptanceDateTime.push("2026-08-01T12:00:00.000Z");
      }
      if (kind === "incomplete") recent.reportDate[0] = "";
      const f = fixture([submissions, facts]);
      const evidence = await f.provider.loadEvidence("0000320193");
      expect(evidence.target).toEqual({
        status: "unresolved",
        reason:
          kind === "amendment"
            ? "amendment_not_supported"
            : kind === "tie"
              ? "target_ambiguous"
              : "target_missing_report_date",
      });
      expect(evidence.facts.observations).toEqual([]);
      expect(
        evidence.facts.scans.every(
          (row) =>
            row.scan.status === "available" &&
            row.scan.coverage?.selected === null,
        ),
      ).toBe(true);
      expect(f.fetch).toHaveBeenCalledTimes(2);
    },
  );
  it("retains a malformed complete submissions packet as unavailable rather than discarding its bad row", async () => {
    const [submissions, facts] = interimPackets();
    submissions.filings.recent.filingDate[0] = "not-a-date";
    const f = fixture([submissions, facts]);
    const evidence = await f.provider.loadEvidence("0000320193");
    expect(evidence.generation.sources.submissions.status).toBe(
      "invalid_response",
    );
    expect(evidence.target).toEqual({
      status: "unresolved",
      reason: "submissions_unavailable",
    });
    expect(evidence.targetScan).toBeNull();
    expect(evidence.facts.observations).toEqual([]);
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });
  it("withholds the whole selected concept above100 rows while retaining fullscan counts and other concepts", async () => {
    const [submissions, facts] = interimPackets();
    const original = facts.facts["us-gaap"].Revenues!.units.USD[0]!;
    facts.facts["us-gaap"].Revenues!.units.USD = Array.from(
      { length: 101 },
      (_, index) => ({ ...original, frame: String(index) }),
    );
    const f = fixture([submissions, facts]);
    const evidence = await f.provider.loadEvidence("0000320193");
    const scan = evidence.facts.scans.find(
      (row) => row.concept === "Revenues",
    )!.scan;
    expect(scan).toMatchObject({
      status: "available",
      coverage: {
        full: {
          candidateRows: 101,
          inspectedRows: 101,
          uniqueObservations: 101,
        },
        selected: 101,
        otherAccessions: 0,
        returned: 0,
        omittedSelected: 101,
      },
    });
    expect(
      evidence.facts.observations.some((row) => row.concept === "Revenues"),
    ).toBe(false);
    const view = resolvePersonalSecInterimStatements(evidence);
    expect(
      view.statements[0]!.rows.find((row) => row.concept === "Revenues"),
    ).toMatchObject({ reason: "selected_report_overflow", cells: [] });
    expect(
      evidence.facts.observations.some((row) => row.concept === "Assets"),
    ).toBe(true);
  });
  it("keeps a complete candidate-limit refusal rather than sampling10001rows", async () => {
    const [submissions, facts] = interimPackets();
    const original = facts.facts["us-gaap"].Revenues!.units.USD[0]!;
    facts.facts["us-gaap"].Revenues!.units.USD = Array.from(
      { length: 10001 },
      () => original,
    );
    const f = fixture([submissions, facts]);
    const evidence = await f.provider.loadEvidence("0000320193");
    expect(
      evidence.facts.scans.find((row) => row.concept === "Revenues")!.scan,
    ).toEqual({ status: "candidate_limit", absence: null, coverage: null });
    expect(
      evidence.facts.observations.some((row) => row.concept === "Revenues"),
    ).toBe(false);
  });
  it("retains exact duplicate, invalid and other-accession coverage rather than accepting incomplete values", async () => {
    const [submissions, facts] = interimPackets();
    const rows = facts.facts["us-gaap"].Revenues!.units.USD;
    rows.push(rows[0]!, { ...rows[0]!, val: Number.NaN });
    const f = fixture([submissions, facts]);
    const evidence = await f.provider.loadEvidence("0000320193");
    expect(
      evidence.facts.scans.find((row) => row.concept === "Revenues")!.scan,
    ).toMatchObject({
      coverage: {
        full: {
          candidateRows: 6,
          inspectedRows: 6,
          invalidRows: 1,
          duplicateRows: 1,
          uniqueObservations: 4,
        },
        selected: 3,
        otherAccessions: 1,
        returned: 3,
        omittedSelected: 0,
      },
    });
    expect(
      resolvePersonalSecInterimStatements(evidence).statements[0]!.rows.find(
        (row) => row.concept === "Revenues",
      )!.reason,
    ).toBe("invalid_source_rows");
  });
  it("fails closed on an identity mismatch and never requests source-provided history/primaryURLs", async () => {
    const [submissions, facts] = interimPackets();
    const f = fixture([submissions, { ...facts, cik: 1 }]);
    const evidence = await f.provider.loadEvidence("0000320193");
    expect(evidence.generation.sources.companyFacts.status).toBe(
      "invalid_response",
    );
    expect(f.fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://data.sec.gov/submissions/CIK0000320193.json",
      "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
    ]);
  });
  it("rejects unconfigured, malformed CIK, preabort, busy and closed calls without extraHTTP", async () => {
    const empty = createSecPersonalInterimEvidenceProvider(undefined);
    await expect(empty.loadEvidence("0000320193")).rejects.toMatchObject({
      code: "not_configured",
    });
    const f = fixture();
    await expect(f.provider.loadEvidence("1")).rejects.toMatchObject({
      code: "invalid_request",
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      f.provider.loadEvidence("0000320193", controller.signal),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(f.fetch).not.toHaveBeenCalled();
    let release: (response: Response) => void = () => undefined;
    f.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = f.provider.loadEvidence("0000320193");
    await expect(f.provider.loadEvidence("0000320193")).rejects.toMatchObject({
      code: "busy",
    });
    f.provider.close();
    release(Response.json(interimPackets()[0]));
    await expect(pending).rejects.toMatchObject({ code: "aborted" });
    await expect(f.provider.loadEvidence("0000320193")).rejects.toMatchObject({
      code: "aborted",
    });
    expect(f.fetch).toHaveBeenCalledOnce();
  });
});
