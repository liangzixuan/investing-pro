import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY as registry,
  type PersonalSecInterimCanonicalResponseDto as Response,
  type PersonalSecInterimCanonicalRequestDto as Request,
} from "@research-cockpit/contracts";
import {
  buildInterimFixture,
  sealFixture,
} from "./personal-sec-interim-test-fixture";
import { assertPersonalSecInterimCanonicalEvidence as assertEvidence } from "./personal-sec-interim-evidence";
import {
  parsePersonalSecInterimCanonicalResponse as parse,
  isOwnedPersonalSecInterimCanonicalResponse as owned,
} from "./personal-sec-interim-response";
import { serializePersonalSecInterimCanonicalGeneration as serialize } from "./personal-sec-interim-serialization";
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
let fixture: Response;
beforeAll(async () => {
  fixture = await buildInterimFixture();
});
const copy = () => structuredClone(fixture) as Mutable<Response>;
const request = (): Request => ({
  schemaVersion: "1.0.0",
  catalogSnapshotSha256: fixture.catalogSnapshotSha256,
  listingId: fixture.security.listingId,
  symbol: fixture.security.symbol,
});
const signal = () => new AbortController().signal;
const malformed: readonly [string, (value: Mutable<Response>) => void][] = [
  ["extra evidence key", (v) => Object.assign(v.evidence, { extra: true })],
  [
    "missing concept scan",
    (v) => {
      v.evidence.facts.scans.pop();
    },
  ],
  [
    "reordered scans",
    (v) => {
      v.evidence.facts.scans.reverse();
    },
  ],
  [
    "duplicate row",
    (v) => {
      v.evidence.facts.observations[1] = v.evidence.facts.observations[0]!;
    },
  ],
  [
    "sparse rows",
    (v) => {
      Reflect.deleteProperty(v.evidence.facts.observations, "0");
    },
  ],
  [
    "row array extra key",
    (v) => {
      Object.assign(v.evidence.facts.observations, { extra: 1 });
    },
  ],
  [
    "old fact ID domain",
    (v) => {
      v.evidence.facts.observations[0]!.id =
        `sec-fact:${"a".repeat(64)}` as never;
    },
  ],
  [
    "wrong concept",
    (v) => {
      v.evidence.facts.observations[0]!.concept = "CustomRevenue" as never;
    },
  ],
  [
    "wrong unit",
    (v) => {
      v.evidence.facts.observations[0]!.unit = "EUR" as never;
    },
  ],
  [
    "custom taxonomy",
    (v) => {
      v.evidence.facts.observations[0]!.taxonomy = "company" as never;
    },
  ],
  [
    "numeric precision loss",
    (v) => {
      v.evidence.facts.observations[0]!.value = 40 as never;
    },
  ],
  [
    "decimal exponent",
    (v) => {
      v.evidence.facts.observations[0]!.value = "4e1";
    },
  ],
  [
    "too many decimal characters",
    (v) => {
      v.evidence.facts.observations[0]!.value = "1".repeat(65);
    },
  ],
  [
    "negative zero",
    (v) => {
      v.evidence.facts.observations[0]!.value = "-0";
    },
  ],
  [
    "bad duration",
    (v) => {
      v.evidence.facts.observations[0]!.durationDays = 90;
    },
  ],
  [
    "unreal date",
    (v) => {
      v.evidence.facts.observations[0]!.endDate = "2026-02-30";
    },
  ],
  [
    "inferred period basis",
    (v) => {
      v.evidence.facts.observations[0]!.periodBasis = "quarter" as never;
    },
  ],
  [
    "other accession",
    (v) => {
      v.evidence.facts.observations[0]!.accessionNumber =
        "0000000001-26-000003";
    },
  ],
  [
    "locator outside candidate set",
    (v) => {
      v.evidence.facts.observations[0]!.sourceLocator = `/facts/us-gaap/${registry[0]!.concept}/units/USD/9`;
    },
  ],
  [
    "wrong filing URL",
    (v) => {
      v.evidence.facts.observations[0]!.filing.sourceUrl =
        "https://example.test/source";
    },
  ],
  [
    "joined date differs",
    (v) => {
      v.evidence.facts.observations[0]!.filing.filedDate = "2026-07-29";
    },
  ],
  [
    "wrong source CIK",
    (v) => {
      v.evidence.generation.sources.companyFacts.sourceUrl =
        "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000002.json";
    },
  ],
  [
    "available source without byte identity",
    (v) => {
      v.evidence.generation.sources.companyFacts.sha256 = null;
    },
  ],
  [
    "source above byte bound",
    (v) => {
      v.evidence.generation.sources.companyFacts.bytes = 8388609;
    },
  ],
  [
    "bad source timestamp",
    (v) => {
      v.evidence.generation.sources.submissions.fetchedAt =
        "2026-02-30T00:00:00.000Z";
    },
  ],
  [
    "partial candidate scan",
    (v) => {
      const s = v.evidence.facts.scans[0]!.scan;
      if (s.status === "available") s.coverage.full.inspectedRows = 1;
    },
  ],
  [
    "partial selected set",
    (v) => {
      const s = v.evidence.facts.scans[0]!.scan;
      if (s.status === "available") s.coverage.returned = 1;
    },
  ],
  [
    "overreported returned rows",
    (v) => {
      const s = v.evidence.facts.scans[0]!.scan;
      if (s.status === "available") s.coverage.returned = 3;
    },
  ],
  [
    "wrong total partition",
    (v) => {
      const s = v.evidence.facts.scans[0]!.scan;
      if (s.status === "available") s.coverage.otherAccessions = 1;
    },
  ],
  [
    "target outside interim form",
    (v) => {
      if (v.evidence.target.status === "target")
        v.evidence.target.form = "10-K" as never;
    },
  ],
  [
    "missing target scan",
    (v) => {
      v.evidence.targetScan = null;
    },
  ],
];
describe("canonical interim admission", () => {
  it("owns the complete verified packet and keeps caller mutation outside its lifetime", async () => {
    const input = copy();
    const admitted = await parse(input, request(), signal());
    expect(admitted).toEqual(fixture);
    expect(admitted).not.toBe(input);
    expect(owned(input)).toBe(false);
    expect(owned(admitted)).toBe(true);
    expect(Object.isFrozen(admitted!.evidence.facts.observations[0])).toBe(
      true,
    );
    input.evidence.facts.observations[0]!.value = "999";
    expect(admitted!.evidence.facts.observations[0]!.value).toBe("40");
  });
  it.each(malformed)("refuses %s", async (_name, mutate) => {
    const input = copy();
    mutate(input);
    expect(() => assertEvidence(input.evidence)).toThrow();
    expect(await parse(input, request(), signal())).toBeNull();
  });
  it("refuses getters and toJSON before reads or byte measurement", async () => {
    const input = copy();
    let reads = 0;
    Object.defineProperty(input.evidence.facts.observations[0], "value", {
      enumerable: true,
      get() {
        reads++;
        return "40";
      },
    });
    expect(await parse(input, request(), signal())).toBeNull();
    expect(reads).toBe(0);
    const injected = copy();
    Object.assign(injected.evidence, {
      toJSON() {
        reads++;
        return {};
      },
    });
    expect(await parse(injected, request(), signal())).toBeNull();
    expect(reads).toBe(0);
  });
  it("binds exact listing/catalog/CIK and refuses malformed identity text", async () => {
    const wrong = copy();
    wrong.security.cik = "0000000002";
    expect(await parse(wrong, request(), signal())).toBeNull();
    expect(
      await parse(
        fixture,
        { ...request(), listingId: "listing:example:a" },
        signal(),
      ),
    ).toBeNull();
    expect(
      await parse(
        fixture,
        { ...request(), catalogSnapshotSha256: `sha256:${"b".repeat(64)}` },
        signal(),
      ),
    ).toBeNull();
    const lone = copy();
    lone.security.issuerName = "Company\ud800";
    expect(await parse(lone, request(), signal())).toBeNull();
  });
  it("verifies row and generation hashes independently, including locator and complete scan metadata", async () => {
    const changedValue = copy();
    changedValue.evidence.facts.observations[0]!.value = "41";
    expect(() => assertEvidence(changedValue.evidence)).not.toThrow();
    expect(await parse(changedValue, request(), signal())).toBeNull();
    const changedClock = copy();
    changedClock.evidence.generation.completedAt = "2026-08-01T12:00:04.000Z";
    expect(await parse(changedClock, request(), signal())).toBeNull();
    const changedWindow = copy();
    changedWindow.evidence.targetScan!.olderHistoryAvailable = false;
    expect(await parse(changedWindow, request(), signal())).toBeNull();
    const sourceChange = copy();
    sourceChange.evidence.generation.sources.companyFacts.sha256 = `sha256:${"b".repeat(64)}`;
    expect(await parse(sourceChange, request(), signal())).toBeNull();
    const resealed = {
      ...changedValue,
      evidence: await sealFixture(changedValue.evidence),
    };
    expect(await parse(resealed, request(), signal())).toEqual(resealed);
  });
  it("canonical serialization ignores object insertion order but binds every period", () => {
    const input = copy();
    input.evidence.generation.sources = {
      submissions: input.evidence.generation.sources.submissions,
      companyFacts: input.evidence.generation.sources.companyFacts,
    };
    expect(serialize(input.evidence)).toBe(serialize(fixture.evidence));
    input.evidence.facts.observations[0]!.startDate = "2026-04-02";
    input.evidence.facts.observations[0]!.durationDays = 90;
    expect(serialize(input.evidence)).not.toBe(serialize(fixture.evidence));
  });
  it("refuses a valid-shape whole response above2MiB before hashing", async () => {
    const input = copy(),
      example = input.evidence.facts.observations[0]!;
    input.evidence.facts.observations = registry.flatMap(
      (entry, conceptIndex) =>
        Array.from({ length: 100 }, (_, rowIndex) => ({
          ...example,
          concept: entry.concept,
          id: `sec-interim-fact:${(conceptIndex * 100 + rowIndex).toString(16).padStart(64, "0")}` as const,
          value: "1".repeat(64),
          frame: "x".repeat(128),
          sourceLocator: `/facts/us-gaap/${entry.concept}/units/USD/${rowIndex}`,
        })),
    );
    input.evidence.facts.scans = registry.map(({ concept }) => ({
      concept,
      scan: {
        status: "available",
        absence: null,
        coverage: {
          full: {
            candidateRows: 100,
            inspectedRows: 100,
            invalidRows: 0,
            duplicateRows: 0,
            uniqueObservations: 100,
          },
          selected: 100,
          otherAccessions: 0,
          returned: 100,
          omittedSelected: 0,
        },
      },
    }));
    expect(() => assertEvidence(input.evidence)).not.toThrow();
    expect(
      new TextEncoder().encode(JSON.stringify(input)).byteLength,
    ).toBeGreaterThan(2097152);
    const hashing = vi.spyOn(crypto.subtle, "digest");
    try {
      expect(await parse(input, request(), signal())).toBeNull();
      expect(hashing).not.toHaveBeenCalled();
    } finally {
      hashing.mockRestore();
    }
  });
  it("refuses late capture and same-day unknown acceptance time", async () => {
    const input = copy();
    input.evidence.generation.sources.companyFacts.fetchedAt =
      "2026-08-01T12:00:04.000Z";
    expect(await parse(input, request(), signal())).toBeNull();
    const time = copy();
    time.evidence.generation.cutoffAt = "2026-07-30T16:00:00.000Z";
    if (time.evidence.target.status === "target")
      time.evidence.target.acceptedAt = null;
    expect(await parse(time, request(), signal())).toBeNull();
  });
  it("preserves caller abort refusal before and during asynchronous hashing", async () => {
    const aborted = new AbortController();
    aborted.abort(new Error("retired"));
    await expect(parse(fixture, request(), aborted.signal)).rejects.toThrow(
      "retired",
    );
    const active = new AbortController(),
      pending = parse(fixture, request(), active.signal);
    active.abort(new Error("replaced"));
    await expect(pending).rejects.toThrow("replaced");
  });
});
