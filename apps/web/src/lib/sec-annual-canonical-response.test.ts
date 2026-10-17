import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  type PersonalSecAnnualCanonicalRequestDto,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { assertPersonalSecAnnualCanonicalEvidence } from "@research-cockpit/personal-financial-analytics";
import {
  canonicalAnnualPacket,
  canonicalAnnualRequest,
  withCanonicalAnnualGeneration,
} from "../features/research/sec-annual-canonical-fixture";
import {
  parseSecAnnualCanonicalResponse,
  isOwnedSecAnnualCanonicalResponse,
} from "./sec-annual-canonical-response";

type Packet = PersonalSecAnnualCanonicalResponseDto;
type Mutable<T> = { -readonly [Key in keyof T]: Mutable<T[Key]> };
let admitted: Packet;
beforeAll(async () => {
  admitted = await canonicalAnnualPacket();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function copy(): Mutable<Packet> {
  return structuredClone(admitted) as Mutable<Packet>;
}
function parse(
  value: unknown,
  requested = canonicalAnnualRequest,
  signal = new AbortController().signal,
) {
  return parseSecAnnualCanonicalResponse(value, requested, signal);
}

describe("canonical Annual v6 browser decoder", () => {
  it("marks only this decoder's immutable result without reading caller fields", async () => {
    const raw = copy();
    const result = await parse(raw);
    expect(result).not.toBeNull();
    expect(isOwnedSecAnnualCanonicalResponse(result)).toBe(true);
    expect(isOwnedSecAnnualCanonicalResponse(raw)).toBe(false);
    expect(isOwnedSecAnnualCanonicalResponse(structuredClone(result))).toBe(
      false,
    );
    expect(
      isOwnedSecAnnualCanonicalResponse(Object.freeze({ ...result })),
    ).toBe(false);
    const read = vi.fn();
    const unknown = new Proxy<object>(
      {},
      {
        get: () => {
          read();
          throw new Error("Ownership must not read fields");
        },
        ownKeys: () => {
          read();
          throw new Error("Ownership must not enumerate fields");
        },
      },
    );
    for (const value of [null, undefined, 6, "6.0.0", unknown])
      expect(isOwnedSecAnnualCanonicalResponse(value)).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });
  it("admits real WebCrypto hashes and exact signed unsafe values into an owned deeply frozen graph", async () => {
    const original = copy();
    const before = JSON.stringify(original);
    const result = await parse(original);
    expect(result).toEqual(original);
    expect(result).not.toBe(original);
    expect(result!.evidence.facts.observations).not.toBe(
      original.evidence.facts.observations,
    );
    expect(
      result!.evidence.facts.observations.find(
        (row) => row.concept === "Revenues",
      )!.value,
    ).toBe("9007199254740993.000000000000000001");
    expect(
      result!.evidence.facts.observations.find(
        (row) => row.concept === "StockholdersEquity",
      )!.value,
    ).toBe("-9007199254740993.000000000000000001");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result!.security)).toBe(true);
    expect(Object.isFrozen(result!.evidence.facts.scans[0]!.scan)).toBe(true);
    expect(
      Object.isFrozen(result!.evidence.facts.observations[0]!.filing),
    ).toBe(true);
    expect(JSON.stringify(original)).toBe(before);
    expect(Object.isFrozen(original)).toBe(false);
    original.evidence.facts.observations[0]!.value = "1";
    expect(result!.evidence.facts.observations[0]!.value).not.toBe("1");
  });

  it.each(["id", "value"] as const)(
    "independently rejects a tampered observation %s even with a correctly rebound generation",
    async (field) => {
      const packet = copy();
      if (field === "id")
        packet.evidence.facts.observations[0]!.id = `sec-fact:${"f".repeat(64)}`;
      else packet.evidence.facts.observations[0]!.value = "1";
      const rebound = await withCanonicalAnnualGeneration(packet);
      await expect(parse(rebound)).resolves.toBeNull();
    },
  );
  it("rejects changed generation and captured source metadata without renewing original provenance", async () => {
    const generation = copy();
    generation.evidence.generation.sha256 = `sha256:${"f".repeat(64)}`;
    await expect(parse(generation)).resolves.toBeNull();
    const source = copy();
    source.evidence.generation.sources.companyFacts.sha256 = `sha256:${"b".repeat(64)}`;
    await expect(parse(source)).resolves.toBeNull();
    const rebound = await withCanonicalAnnualGeneration(source);
    const accepted = await parse(rebound);
    expect(accepted!.evidence.generation.sources).toEqual(
      rebound.evidence.generation.sources,
    );
    // The decoder binds claimed source metadata; it has no provider body to authenticate.
    expect(accepted!.evidence.generation.sources.companyFacts.sha256).toBe(
      source.evidence.generation.sources.companyFacts.sha256,
    );
  });

  it.each([
    "catalog",
    "listing",
    "symbol",
    "security CIK",
    "evidence CIK",
  ] as const)("rejects a response with mismatched %s", async (field) => {
    const packet = copy();
    if (field === "catalog")
      packet.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
    if (field === "listing") packet.security.listingId = "listing-other";
    if (field === "symbol") packet.security.symbol = "OTHER";
    if (field === "security CIK") packet.security.cik = "0000000043";
    if (field === "evidence CIK") packet.evidence.cik = "0000000043";
    await expect(parse(packet)).resolves.toBeNull();
  });

  it.each(["5.0.0", "7.0.0", null])(
    "accepts no old or unknown response version %j",
    async (schemaVersion) => {
      await expect(parse({ ...copy(), schemaVersion })).resolves.toBeNull();
    },
  );
  it("accepts no enriched financial DTO or extra outer field", async () => {
    await expect(parse({ ...copy(), statements: [] })).resolves.toBeNull();
    const packet = copy();
    await expect(
      parse({ ...packet, evidence: { ...packet.evidence, resolution: {} } }),
    ).resolves.toBeNull();
  });

  it.each(["response", "security", "evidence", "request"] as const)(
    "rejects a %s accessor before invoking it or structuredClone",
    async (level) => {
      const packet = copy();
      const requested = { ...canonicalAnnualRequest };
      const getter = vi.fn(() => "INVENTED");
      if (level === "response")
        Object.defineProperty(packet, "schemaVersion", {
          enumerable: true,
          get: getter,
        });
      if (level === "security")
        Object.defineProperty(packet.security, "symbol", {
          enumerable: true,
          get: getter,
        });
      if (level === "evidence")
        Object.defineProperty(
          packet.evidence.generation.sources.companyFacts,
          "sourceUrl",
          { enumerable: true, get: getter },
        );
      if (level === "request")
        Object.defineProperty(requested, "symbol", {
          enumerable: true,
          get: getter,
        });
      const clone = vi.fn(structuredClone);
      vi.stubGlobal("structuredClone", clone);
      await expect(parse(packet, requested)).resolves.toBeNull();
      expect(getter).not.toHaveBeenCalled();
      expect(clone).not.toHaveBeenCalled();
    },
  );

  it.each(["response", "security", "request"] as const)(
    "rejects inherited, symbolic, nonenumerable and extra fields on %s",
    async (level) => {
      for (const kind of [
        "inherited",
        "symbol",
        "nonenumerable",
        "extra",
      ] as const) {
        const packet = copy();
        let requested: unknown = { ...canonicalAnnualRequest };
        const current: object =
          level === "response"
            ? packet
            : level === "security"
              ? packet.security
              : (requested as object);
        let modified: object = current;
        if (kind === "inherited") modified = Object.create(current) as object;
        if (kind === "symbol")
          Object.defineProperty(current, Symbol("extra"), {
            enumerable: true,
            value: "extra",
          });
        if (kind === "nonenumerable")
          Object.defineProperty(
            current,
            level === "response" ? "schemaVersion" : "symbol",
            {
              enumerable: false,
              value: level === "response" ? "6.0.0" : "INVENTED",
            },
          );
        if (kind === "extra")
          Object.defineProperty(current, "extra", {
            enumerable: true,
            value: true,
          });
        if (level === "response")
          await expect(
            parse(modified, requested as PersonalSecAnnualCanonicalRequestDto),
          ).resolves.toBeNull();
        else {
          if (level === "security")
            packet.security = modified as Mutable<Packet>["security"];
          else requested = modified;
          await expect(
            parse(packet, requested as PersonalSecAnnualCanonicalRequestDto),
          ).resolves.toBeNull();
        }
      }
    },
  );

  it.each([
    "scans sparse",
    "observations sparse",
    "row inherited",
    "array symbol",
    "array accessor",
  ] as const)("rejects closed nested graph corruption: %s", async (kind) => {
    const packet = copy();
    const getter = vi.fn(() => packet.evidence.facts.scans[1]);
    if (kind === "scans sparse")
      Reflect.deleteProperty(packet.evidence.facts.scans, "0");
    if (kind === "observations sparse")
      Reflect.deleteProperty(packet.evidence.facts.observations, "0");
    if (kind === "row inherited")
      packet.evidence.facts.observations[0] = Object.create(
        packet.evidence.facts.observations[0]!,
      ) as Mutable<Packet>["evidence"]["facts"]["observations"][number];
    if (kind === "array symbol")
      Object.defineProperty(
        packet.evidence.facts.observations,
        Symbol("extra"),
        { enumerable: true, value: true },
      );
    if (kind === "array accessor")
      Object.defineProperty(packet.evidence.facts.scans, "0", {
        enumerable: true,
        get: getter,
      });
    await expect(parse(packet)).resolves.toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });

  it.each([
    " leading",
    "Cafe\u0301",
    "bad\nname",
    "bad\u200bname",
    "bad\ud800name",
    "😀".repeat(513),
  ])("rejects noncanonical or over-bound display text %j", async (name) => {
    const packet = copy();
    packet.security.issuerName = name;
    await expect(parse(packet)).resolves.toBeNull();
  });
  it("accepts 512 Unicode code points and validates both display fields and ASCII identity bounds", async () => {
    const packet = copy();
    packet.security.issuerName = "😀".repeat(512);
    packet.security.securityName = "é".repeat(512);
    expect(await parse(packet)).not.toBeNull();
    for (const name of ["bad\nname", " name", "x".repeat(513)]) {
      packet.security.securityName = name;
      await expect(parse(packet)).resolves.toBeNull();
    }
    for (const id of ["x", "UPPER", "bad space", ":bad"]) {
      const invalid = copy();
      invalid.security.issuerId = id;
      await expect(parse(invalid)).resolves.toBeNull();
      await expect(
        parse(admitted, { ...canonicalAnnualRequest, listingId: id }),
      ).resolves.toBeNull();
    }
  });

  it.each(["version", "catalog", "symbol", "listing"] as const)(
    "requires an exact valid captured request %s",
    async (field) => {
      const request = { ...canonicalAnnualRequest };
      if (field === "version")
        Object.assign(request, { schemaVersion: "5.0.0" });
      if (field === "catalog") request.catalogSnapshotSha256 = "sha256:bad";
      if (field === "symbol") request.symbol = "invalid symbol";
      if (field === "listing") request.listingId = "bad listing";
      await expect(parse(admitted, request)).resolves.toBeNull();
    },
  );

  it.each([
    "source URL",
    "filing context",
    "accession",
    "pointer",
    "scan count",
    "scan order",
    "observation order",
  ] as const)("rejects inconsistent source/fact context: %s", async (kind) => {
    const packet = copy();
    if (kind === "source URL")
      packet.evidence.generation.sources.companyFacts.sourceUrl =
        "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000043.json";
    if (kind === "filing context")
      packet.evidence.facts.observations[0]!.filing.reportDate = "2024-12-31";
    if (kind === "accession")
      packet.evidence.facts.observations[0]!.accessionNumber =
        "0000999999-25-000001";
    if (kind === "pointer")
      packet.evidence.facts.observations[0]!.sourceLocator += "1";
    if (
      kind === "scan count" &&
      packet.evidence.facts.scans[0]!.scan.status === "available"
    )
      packet.evidence.facts.scans[0]!.scan.coverage.returned = 0;
    if (kind === "scan order") packet.evidence.facts.scans.reverse();
    if (kind === "observation order")
      packet.evidence.facts.observations.reverse();
    await expect(parse(packet)).resolves.toBeNull();
  });

  it.each([
    "completion before cutoff",
    "source before cutoff",
    "source after completion",
    "report after filed",
    "filed after cutoff",
    "accepted after cutoff",
    "accepted before report",
    "same day unknown acceptance",
  ] as const)("rejects a shaped but invalid wire clock: %s", async (kind) => {
    const packet = (await canonicalAnnualPacket({
      rowsPerConcept: 0,
    })) as Mutable<Packet>;
    if (kind === "completion before cutoff")
      packet.evidence.generation.completedAt = "2026-09-19T23:59:59.000Z";
    if (kind === "source before cutoff")
      packet.evidence.generation.sources.companyFacts.fetchedAt =
        "2026-09-19T23:59:59.000Z";
    if (kind === "source after completion")
      packet.evidence.generation.sources.submissions.fetchedAt =
        "2026-09-20T00:00:04.000Z";
    if (packet.evidence.target.status !== "target")
      throw new Error("Expected invented selected filing");
    if (kind === "report after filed")
      packet.evidence.target.reportDate = "2026-02-02";
    if (kind === "filed after cutoff")
      packet.evidence.target.filedDate = "2026-09-21";
    if (kind === "accepted after cutoff")
      packet.evidence.target.acceptedAt = "2026-09-20T00:00:01.000Z";
    if (kind === "accepted before report")
      packet.evidence.target.acceptedAt = "2025-12-30T00:00:00.000Z";
    if (kind === "same day unknown acceptance") {
      packet.evidence.target.filedDate = "2026-09-20";
      packet.evidence.target.acceptedAt = null;
    }
    // The pure domain may retain invalid clocks for explicit diagnostics. Wire admission rejects them.
    await expect(
      parse(await withCanonicalAnnualGeneration(packet)),
    ).resolves.toBeNull();
  });

  it("checks captured failed-source clocks and accepts earlier-day unknown target acceptance without altering dates", async () => {
    const packet = (await canonicalAnnualPacket({
      rowsPerConcept: 0,
    })) as Mutable<Packet>;
    packet.evidence.generation.sources.companyFacts.status = "invalid_response";
    packet.evidence.facts.scans = packet.evidence.facts.scans.map((item) => ({
      concept: item.concept,
      scan: { status: "source_unavailable", absence: null, coverage: null },
    }));
    if (packet.evidence.target.status !== "target")
      throw new Error("Expected target");
    packet.evidence.target.acceptedAt = null;
    expect(
      await parse(await withCanonicalAnnualGeneration(packet)),
    ).not.toBeNull();
    packet.evidence.generation.sources.companyFacts.fetchedAt =
      "2026-09-19T23:59:59.000Z";
    await expect(
      parse(await withCanonicalAnnualGeneration(packet)),
    ).resolves.toBeNull();
  });

  it("refuses the whole maximum escaped packet above the unchanged 2 MiB limit before hashing", async () => {
    const packet = await canonicalAnnualPacket({
      rowsPerConcept: 100,
      escapedMetadata: true,
    });
    assertPersonalSecAnnualCanonicalEvidence(packet.evidence);
    expect(packet.evidence.facts.observations).toHaveLength(3200);
    expect(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes).toBe(2_097_152);
    expect(
      new TextEncoder().encode(JSON.stringify(packet)).byteLength,
    ).toBeGreaterThan(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes);
    const digest = vi.spyOn(crypto.subtle, "digest");
    await expect(parse(packet)).resolves.toBeNull();
    expect(digest).not.toHaveBeenCalled();
    expect(packet.evidence.facts.observations).toHaveLength(3200);
  });

  it("bounds digest work to batches of 32 and hashes the generation separately", async () => {
    const packet = await canonicalAnnualPacket({ rowsPerConcept: 4 });
    const real = crypto.subtle.digest.bind(crypto.subtle);
    let active = 0,
      maximum = 0;
    const spy = vi
      .spyOn(crypto.subtle, "digest")
      .mockImplementation(async (algorithm, data) => {
        active++;
        maximum = Math.max(maximum, active);
        try {
          return await real(algorithm, data);
        } finally {
          active--;
        }
      });
    expect(await parse(packet)).toEqual(packet);
    expect(maximum).toBe(32);
    expect(spy).toHaveBeenCalledTimes(129);
  });
  it("owns the admitted input before awaited hashing so caller edits cannot retarget it", async () => {
    const packet = copy();
    const real = crypto.subtle.digest.bind(crypto.subtle);
    let mutated = false;
    vi.spyOn(crypto.subtle, "digest").mockImplementation(
      async (algorithm, data) => {
        if (!mutated) {
          mutated = true;
          packet.security.symbol = "OTHER";
          packet.evidence.facts.observations[0]!.value = "1";
        }
        return real(algorithm, data);
      },
    );
    expect(await parse(packet)).toEqual(admitted);
  });
  it("aborts before hashing without cloning an input", async () => {
    const controller = new AbortController();
    controller.abort();
    const clone = vi.fn(structuredClone);
    vi.stubGlobal("structuredClone", clone);
    const digest = vi.spyOn(crypto.subtle, "digest");
    await expect(
      parse(admitted, canonicalAnnualRequest, controller.signal),
    ).rejects.toThrow();
    expect(clone).not.toHaveBeenCalled();
    expect(digest).not.toHaveBeenCalled();
  });
  it.each(["observation batch", "generation"] as const)(
    "refuses late completion after abort during %s hashing",
    async (stage) => {
      const packet =
        stage === "generation"
          ? await canonicalAnnualPacket({ rowsPerConcept: 0 })
          : admitted;
      const real = crypto.subtle.digest.bind(crypto.subtle);
      let release: (() => void) | undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let first = true;
      vi.spyOn(crypto.subtle, "digest").mockImplementation(
        async (algorithm, data) => {
          if (first) {
            first = false;
            await held;
          }
          return real(algorithm, data);
        },
      );
      const controller = new AbortController();
      const pending = parse(packet, canonicalAnnualRequest, controller.signal);
      controller.abort();
      release!();
      await expect(pending).rejects.toThrow();
    },
  );
});
