import {
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  type PersonalSecAnnualBalanceSheetAbsence,
  type PersonalSecAnnualBalanceSheetMetricEvidenceDto,
  type PersonalSecAnnualBalanceSheetObservationDto,
  type PersonalSecAnnualBalanceSheetResolutionInput,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import {
  resolvePersonalSecAnnualBalanceSheet as resolve,
  resolvePersonalSecAnnualBalanceSheetHistory as history,
} from "./personal-sec-annual-balance-sheet";

type Row = PersonalSecAnnualBalanceSheetObservationDto;
type Input = PersonalSecAnnualBalanceSheetResolutionInput;
type Key = keyof Input["balanceSheet"];
const accession = "0000999999-26-000001";
const reportDate = "2025-09-30";
const keys: readonly Key[] = [
  "totalAssets",
  "totalLiabilities",
  "shareholdersEquity",
];

function row(key: Key = "totalAssets", id = 1, index = 0): Row {
  const identity = {
    totalAssets: {
      metric: "total_assets",
      concept: "Assets",
      value: "120.125",
    },
    totalLiabilities: {
      metric: "total_liabilities",
      concept: "Liabilities",
      value: "140.25",
    },
    shareholdersEquity: {
      metric: "shareholders_equity",
      concept: "StockholdersEquity",
      value: "-20.025",
    },
  } as const;
  return {
    ...identity[key],
    id: `sec-fact:${id.toString(16).padStart(64, "0")}`,
    taxonomy: "us-gaap",
    unit: "USD",
    startDate: null,
    endDate: reportDate,
    durationDays: null,
    periodBasis: "unresolved",
    filingFocusYear: 2026,
    filingFocusPeriod: "FY",
    frame: null,
    accessionNumber: accession,
    form: "10-K",
    filedDate: "2026-02-01",
    sourceLocator: `/facts/us-gaap/${identity[key].concept}/units/USD/${index}`,
    filing: {
      status: "matched",
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate,
      acceptedAt: "2026-02-01T16:00:00.000Z",
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/42/${accession}-index.htm`,
    },
  };
}

function metric(
  observations: readonly Row[],
  absence: PersonalSecAnnualBalanceSheetAbsence | null = null,
): PersonalSecAnnualBalanceSheetMetricEvidenceDto {
  const count = observations.length;
  return {
    scan: {
      status: "available",
      absence,
      coverage: {
        full: {
          candidateRows: count,
          inspectedRows: count,
          invalidRows: 0,
          duplicateRows: 0,
          uniqueObservations: count,
        },
        selected: count,
        otherAccessions: 0,
        returned: count,
        omittedSelected: 0,
      },
    },
    observations,
  };
}

function input(): Input {
  return {
    cik: "0000000042",
    generation: {
      definitionVersion: PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
      cutoffAt: "2026-09-20T06:00:00.000Z",
      completedAt: "2026-09-20T06:00:03.000Z",
      sha256: `sha256:${"a".repeat(64)}`,
      sources: {
        companyFacts: {
          status: "available",
          sourceUrl:
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000042.json",
          fetchedAt: "2026-09-20T06:00:02.000Z",
          bytes: 1000,
          sha256: `sha256:${"b".repeat(64)}`,
        },
        submissions: {
          status: "available",
          sourceUrl: "https://data.sec.gov/submissions/CIK0000000042.json",
          fetchedAt: "2026-09-20T06:00:01.000Z",
          bytes: 500,
          sha256: `sha256:${"c".repeat(64)}`,
        },
      },
    },
    target: {
      status: "target",
      accessionNumber: accession,
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate,
      acceptedAt: "2026-02-01T16:00:00.000Z",
    },
    balanceSheet: {
      totalAssets: metric([row()]),
      totalLiabilities: metric([row("totalLiabilities", 2)]),
      shareholdersEquity: metric([row("shareholdersEquity", 3)]),
    },
  };
}
function withMetric(
  packet: Input,
  key: Key,
  value: PersonalSecAnnualBalanceSheetMetricEvidenceDto,
): Input {
  return { ...packet, balanceSheet: { ...packet.balanceSheet, [key]: value } };
}
function withRow(change: Partial<Omit<Row, "metric" | "concept">>): Input {
  return withMetric(input(), "totalAssets", metric([{ ...row(), ...change }]));
}
function coverage(packet: Input, key: Key = "totalAssets") {
  const scan = packet.balanceSheet[key].scan;
  if (scan.status !== "available") throw new Error("Scanned fixture required");
  return scan.coverage;
}

describe("Annual reported balance-sheet totals", () => {
  it("resolves all three raw totals independently without income or an accounting equation", () => {
    const result = resolve(input());
    expect(result.totalAssets).toEqual({
      status: "available",
      unit: "USD",
      value: "120.125",
      asOfDate: reportDate,
      accessionNumber: accession,
      observationIds: [row().id],
      currentUseEligible: true,
    });
    expect(result.totalLiabilities).toMatchObject({
      status: "available",
      value: "140.25",
    });
    expect(result.shareholdersEquity).toMatchObject({
      status: "available",
      value: "-20.025",
    });
    expect(Object.keys(result)).toEqual([...keys, "utilityAge"]);
    expect(result.utilityAge).toMatchObject({ withinWindow: true });
    // Values deliberately do not satisfy an inferred balance equation.
    expect(Object.keys(input())).toEqual([
      "cik",
      "generation",
      "target",
      "balanceSheet",
    ]);
  });

  it.each([
    "0",
    "-1",
    "9".repeat(64),
    `-${"9".repeat(63)}`,
    `0.${"0".repeat(61)}1`,
  ])("preserves exact signed USD %s", (value) => {
    const result = resolve(withRow({ value }));
    expect(result.totalAssets).toMatchObject({ status: "available", value });
    expect(result.totalLiabilities.status).toBe("available");
  });

  it.each([
    "",
    "-0",
    "01",
    "+1",
    "1.0",
    "1e3",
    "NaN",
    "9".repeat(65),
    `-${"9".repeat(64)}`,
  ])("rejects a noncanonical or oversized decimal %s", (value) => {
    expect(() => resolve(withRow({ value }))).toThrow(TypeError);
  });

  it("selects only the exact report date without a fiscal calendar or older passing fallback", () => {
    const prior = {
      ...row("totalAssets", 4, 1),
      endDate: "2024-09-30",
      value: "999",
    };
    expect(
      resolve(withMetric(input(), "totalAssets", metric([row(), prior])))
        .totalAssets,
    ).toMatchObject({ value: "120.125", observationIds: [row().id] });
    expect(resolve(withRow({ endDate: "2024-09-30" })).totalAssets).toEqual({
      status: "unavailable",
      unit: "USD",
      reason: "no_report_date",
      observationIds: [],
    });
  });

  it("retains every agreeing reference and refuses conflicting amounts only for that total", () => {
    const second = { ...row("totalAssets", 4, 1), frame: "CY2025Q3I" };
    const result = resolve(
      withMetric(input(), "totalAssets", metric([row(), second])),
    );
    expect(result.totalAssets.observationIds).toEqual([row().id, second.id]);
    const conflict = resolve(
      withMetric(
        input(),
        "totalAssets",
        metric([row(), { ...second, value: "121" }]),
      ),
    );
    expect(conflict.totalAssets).toEqual({
      status: "unavailable",
      unit: "USD",
      reason: "ambiguous_value",
      observationIds: [row().id, second.id],
    });
    expect(conflict.totalLiabilities.status).toBe("available");
    expect(conflict.shareholdersEquity.status).toBe("available");
  });

  it.each(keys)("isolates all three absence kinds for %s", (key) => {
    for (const absence of [
      "concept_missing",
      "usd_missing",
      "empty_usd",
    ] as const) {
      const result = resolve(withMetric(input(), key, metric([], absence)));
      expect(result[key]).toEqual({
        status: "unavailable",
        unit: "USD",
        reason: absence,
        observationIds: [],
      });
      for (const other of keys.filter((name) => name !== key))
        expect(result[other].status).toBe("available");
    }
  });

  it.each(keys)(
    "isolates failed scans, invalid rows and selected overflow for %s",
    (key) => {
      for (const status of ["invalid_response", "candidate_limit"] as const) {
        const result = resolve(
          withMetric(input(), key, {
            scan: { status, absence: null, coverage: null },
            observations: [],
          }),
        );
        expect(result[key]).toMatchObject({
          status: "unavailable",
          reason: status,
        });
        for (const other of keys.filter((name) => name !== key))
          expect(result[other].status).toBe("available");
      }
      const packet = input();
      const counts = coverage(packet, key);
      const bad = {
        ...packet.balanceSheet[key],
        scan: {
          status: "available" as const,
          absence: null,
          coverage: {
            ...counts,
            full: {
              ...counts.full,
              candidateRows: 2,
              inspectedRows: 2,
              invalidRows: 1,
            },
          },
        },
      };
      expect(resolve(withMetric(packet, key, bad))[key]).toMatchObject({
        reason: "invalid_source_rows",
      });
      const overflow = {
        scan: {
          status: "available" as const,
          absence: null,
          coverage: {
            full: {
              candidateRows: 101,
              inspectedRows: 101,
              invalidRows: 0,
              duplicateRows: 0,
              uniqueObservations: 101,
            },
            selected: 101,
            otherAccessions: 0,
            returned: 0,
            omittedSelected: 101,
          },
        },
        observations: [],
      };
      expect(resolve(withMetric(packet, key, overflow))[key]).toMatchObject({
        reason: "selected_report_overflow",
      });
    },
  );

  it("admits 100 selected references out of 10000 inspected rows without clipping", () => {
    const values = Array.from({ length: 100 }, (_, index) =>
      row("totalAssets", index + 4, index + 9900),
    );
    const packet = input();
    const scan = {
      status: "available" as const,
      absence: null,
      coverage: {
        full: {
          candidateRows: 10000,
          inspectedRows: 10000,
          invalidRows: 0,
          duplicateRows: 0,
          uniqueObservations: 10000,
        },
        selected: 100,
        otherAccessions: 9900,
        returned: 100,
        omittedSelected: 0,
      },
    };
    const result = resolve(
      withMetric(packet, "totalAssets", { scan, observations: values }),
    );
    expect(result.totalAssets.observationIds).toEqual(
      values.map((value) => value.id),
    );
    expect(result.totalAssets).toMatchObject({
      status: "available",
      value: "120.125",
    });
    expect(() =>
      resolve(
        withMetric(
          packet,
          "totalAssets",
          metric([...values, row("totalAssets", 104, 100)]),
        ),
      ),
    ).toThrow(TypeError);
  });

  it("keeps truthful duplicate scan counts without duplicating retained references", () => {
    const packet = input();
    const counts = coverage(packet);
    Object.assign(counts.full, {
      candidateRows: 2,
      inspectedRows: 2,
      duplicateRows: 1,
    });
    expect(resolve(packet).totalAssets.observationIds).toEqual([row().id]);
  });

  it.each([
    [{ startDate: "2025-01-01", durationDays: 273 }, "invalid_instant_period"],
    [{ filingFocusPeriod: "Q3" }, "missing_or_non_FY_focus"],
    [{ filingFocusPeriod: null }, "missing_or_non_FY_focus"],
    [{ form: "10-K/A" }, "unsupported_form"],
    [{ form: "10-Q" }, "unsupported_form"],
    [{ filedDate: "2026-02-02" }, "filing_unmatched_or_conflicted"],
  ] satisfies [Partial<Row>, string][])(
    "refuses target-date row metadata %# without losing the siblings",
    (change, reason) => {
      const result = resolve(withRow(change));
      expect(result.totalAssets).toMatchObject({
        status: "unavailable",
        reason,
        observationIds: [row().id],
      });
      expect(result.totalLiabilities.status).toBe("available");
    },
  );

  it.each([
    [{ status: "metadata_conflict" }, "filing_unmatched_or_conflicted"],
    [
      { status: "not_in_current_submissions" },
      "filing_unmatched_or_conflicted",
    ],
    [{ form: "20-F" }, "filing_unmatched_or_conflicted"],
    [{ filedDate: "2026-02-02" }, "filing_unmatched_or_conflicted"],
    [
      { acceptedAt: "2026-02-01T17:00:00.000Z" },
      "filing_unmatched_or_conflicted",
    ],
    [
      {
        sourceUrl: "https://www.sec.gov/Archives/edgar/data/43/other-index.htm",
      },
      "filing_unmatched_or_conflicted",
    ],
    [{ reportDate: "2024-09-30" }, "report_end_mismatch"],
  ] satisfies [Partial<Row["filing"]>, string][])(
    "refuses conflicting joined filing metadata %#",
    (change, reason) => {
      expect(
        resolve(withRow({ filing: { ...row().filing, ...change } }))
          .totalAssets,
      ).toMatchObject({ status: "unavailable", reason });
    },
  );

  it("admits a matching 20-F without changing the fixed US-GAAP concepts", () => {
    const packet = input();
    Object.assign(packet.target, { form: "20-F" });
    for (const key of keys) {
      Object.assign(packet.balanceSheet[key].observations[0]!, {
        form: "20-F",
      });
      Object.assign(packet.balanceSheet[key].observations[0]!.filing, {
        form: "20-F",
      });
    }
    for (const key of keys)
      expect(resolve(packet)[key].status).toBe("available");
  });

  it("admits a real leap-day balance without substituting a calendar year end", () => {
    const packet = input();
    Object.assign(packet.target, { reportDate: "2024-02-29" });
    for (const key of keys) {
      Object.assign(packet.balanceSheet[key].observations[0]!, {
        endDate: "2024-02-29",
      });
      Object.assign(packet.balanceSheet[key].observations[0]!.filing, {
        reportDate: "2024-02-29",
      });
    }
    for (const key of keys)
      expect(resolve(packet)[key]).toMatchObject({
        status: "available",
        asOfDate: "2024-02-29",
        currentUseEligible: false,
      });
  });

  it.each([0, 1])(
    "keeps the inclusive seven-day source boundary at +%d ms",
    (extra) => {
      const packet = input();
      Object.assign(packet.generation, {
        completedAt: new Date(
          Date.parse("2026-09-27T06:00:01.000Z") + extra,
        ).toISOString(),
      });
      for (const key of keys) {
        const value = resolve(packet)[key];
        expect(value.status).toBe(extra === 0 ? "available" : "unavailable");
        if (extra !== 0)
          expect(value).toMatchObject({ reason: "source_stale" });
      }
    },
  );

  it.each([485, 486])(
    "uses captured report age at %d days and retains older reported amounts",
    (days) => {
      const packet = input();
      const time = new Date(
        Date.parse(`${reportDate}T06:00:00.000Z`) + days * 86400000,
      ).toISOString();
      Object.assign(packet.generation, { cutoffAt: time, completedAt: time });
      for (const source of Object.values(packet.generation.sources))
        Object.assign(source, { fetchedAt: time });
      const result = resolve(packet);
      for (const key of keys)
        expect(result[key]).toMatchObject({
          status: "available",
          currentUseEligible: days === 485,
        });
    },
  );

  it.each([
    [{ completedAt: "2026-09-27T06:00:02.001Z" }, "source_stale"],
    [{ cutoffAt: "2026-02-30T06:00:00.000Z" }, "invalid_clock"],
    [{ completedAt: "2026-09-20T05:59:59.000Z" }, "invalid_clock"],
    [{ definitionVersion: "4.0.0" }, "invalid_clock"],
  ])("retains the shared source-clock policy %#", (change, reason) => {
    const packet = input();
    Object.assign(packet.generation, change);
    for (const key of keys)
      expect(resolve(packet)[key]).toMatchObject({
        status: "unavailable",
        reason,
      });
  });

  it.each([
    [{ reportDate: "2027-09-30" }, "future_or_inconsistent_dates"],
    [{ filedDate: "2027-01-01" }, "future_or_inconsistent_dates"],
    [
      { acceptedAt: "2026-09-20T06:00:00.001Z" },
      "future_or_inconsistent_dates",
    ],
    [{ filedDate: "2026-09-20", acceptedAt: null }, "cutoff_time_unresolved"],
    [{ reportDate: null }, "report_date_missing"],
    [{ filedDate: null }, "filed_date_missing"],
    [{ form: "10-K/A" }, "unsupported_form"],
  ])(
    "does not use a different target to recover a refused filing %#",
    (change, reason) => {
      const packet = input();
      Object.assign(packet.target, change);
      for (const key of keys)
        expect(resolve(packet)[key]).toMatchObject({
          status: "unavailable",
          reason,
        });
    },
  );

  it("preserves unavailable sources without fabricated samples", () => {
    const packet = input();
    Object.assign(packet.generation.sources.companyFacts, {
      status: "upstream_unavailable",
      fetchedAt: null,
      bytes: null,
      sha256: null,
    });
    expect(() => resolve(packet)).toThrow(TypeError);
    for (const key of keys)
      Object.assign(packet.balanceSheet, {
        [key]: {
          scan: { status: "source_unavailable", absence: null, coverage: null },
          observations: [],
        },
      });
    const result = resolve(packet);
    for (const key of keys)
      expect(result[key]).toEqual({
        status: "unavailable",
        unit: "USD",
        reason: "source_unavailable",
        observationIds: [],
      });
    expect(result.utilityAge).toBeNull();
  });

  it("does not manufacture selected rows when the target is unresolved", () => {
    const packet: Input = {
      ...input(),
      target: { status: "unresolved", reason: "no_observed_annual_target" },
    };
    for (const key of keys) {
      Object.assign(coverage(packet, key), {
        selected: null,
        otherAccessions: null,
        returned: 0,
        omittedSelected: null,
      });
      Object.assign(packet.balanceSheet[key], { observations: [] });
    }
    for (const key of keys)
      expect(resolve(packet)[key]).toMatchObject({
        status: "unavailable",
        reason: "target_unresolved",
      });
  });

  it.each([
    { accessionNumber: "0000999999-26-000002" },
    { sourceLocator: "/facts/us-gaap/Assets/units/USD/1" },
    { sourceLocator: "/facts/us-gaap/Assets/units/USD/00" },
    { sourceLocator: "/facts/us-gaap/Assets/units/USD/10000" },
    { endDate: "2025-02-29" },
    { endDate: "2025-9-30" },
    { filedDate: "2026-02-30" },
    { durationDays: 0 },
    { periodBasis: "annual" },
    { filingFocusYear: 10000 },
    { frame: "x".repeat(129) },
    { id: `sec-fact:${"A".repeat(64)}` },
    {
      concept:
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    },
    { taxonomy: "ifrs-full" },
    { unit: "EUR" },
  ])(
    "rejects fabricated row identity or invalid protocol fields %#",
    (change) => {
      const packet = input();
      Object.assign(packet.balanceSheet.totalAssets.observations[0]!, change);
      expect(() => resolve(packet)).toThrow(TypeError);
    },
  );

  it("rejects duplicate IDs across metrics and duplicate locators within a metric", () => {
    const packet = input();
    Object.assign(packet.balanceSheet.totalLiabilities.observations[0]!, {
      id: row().id,
    });
    expect(() => resolve(packet)).toThrow(TypeError);
    expect(() =>
      resolve(
        withMetric(
          input(),
          "totalAssets",
          metric([row(), row("totalAssets", 4)]),
        ),
      ),
    ).toThrow(TypeError);
  });

  it.each([
    { candidateRows: 10001, inspectedRows: 10001, uniqueObservations: 10001 },
    { candidateRows: 2 },
    { invalidRows: -1 },
    { duplicateRows: 1 },
    { inspectedRows: 0.5 },
  ])("rejects dishonest full scan accounting %#", (change) => {
    const packet = input();
    Object.assign(coverage(packet).full, change);
    expect(() => resolve(packet)).toThrow(TypeError);
  });

  it.each([
    { selected: 0 },
    { otherAccessions: 1 },
    { returned: 0 },
    { omittedSelected: 1 },
    { selected: null },
  ])("rejects dishonest selected accounting %#", (change) => {
    const packet = input();
    Object.assign(coverage(packet), change);
    expect(() => resolve(packet)).toThrow(TypeError);
  });

  it("owns and deeply freezes all output without freezing or retaining caller data", () => {
    const packet = input();
    const before = structuredClone(packet);
    const result = resolve(packet);
    expect(packet).toEqual(before);
    expect(Object.isFrozen(packet)).toBe(false);
    expect(Object.isFrozen(packet.balanceSheet.totalAssets.observations)).toBe(
      false,
    );
    for (const value of [
      result,
      ...keys.map((key) => result[key]),
      ...keys.map((key) => result[key].observationIds),
      result.utilityAge,
      result.utilityAge?.sourceAgeDays,
    ])
      expect(Object.isFrozen(value)).toBe(true);
    Object.assign(packet.balanceSheet.totalAssets.observations[0]!, {
      value: "999",
      id: `sec-fact:${"f".repeat(64)}`,
    });
    Object.assign(packet.generation, {
      completedAt: "2099-01-01T00:00:00.000Z",
    });
    expect(result.totalAssets).toMatchObject({
      value: "120.125",
      observationIds: [row().id],
    });
    expect(result.utilityAge?.withinWindow).toBe(true);
  });

  it.each([
    "root",
    "graph",
    "metric",
    "scan",
    "coverage",
    "row",
    "filing",
    "generation",
    "source",
  ])("rejects extra keys at %s", (level) => {
    const packet = input();
    const targets = {
      root: packet,
      graph: packet.balanceSheet,
      metric: packet.balanceSheet.totalAssets,
      scan: packet.balanceSheet.totalAssets.scan,
      coverage: coverage(packet),
      row: packet.balanceSheet.totalAssets.observations[0]!,
      filing: packet.balanceSheet.totalAssets.observations[0]!.filing,
      generation: packet.generation,
      source: packet.generation.sources.companyFacts,
    };
    Object.assign(targets[level as keyof typeof targets], { extra: true });
    expect(() => resolve(packet)).toThrow(TypeError);
  });

  it("rejects accessors, sparse arrays, symbol fields and inherited records without evaluating getters", () => {
    const getter = input();
    let reads = 0;
    Object.defineProperty(
      getter.balanceSheet.totalAssets.observations[0],
      "value",
      {
        enumerable: true,
        get() {
          reads++;
          return "120.125";
        },
      },
    );
    expect(() => resolve(getter)).toThrow(TypeError);
    expect(reads).toBe(0);
    const sparse = input();
    Object.assign(sparse.balanceSheet.totalAssets, {
      observations: new Array(1),
    });
    expect(() => resolve(sparse)).toThrow(TypeError);
    const symbol = input();
    Object.assign(symbol.balanceSheet, { [Symbol("hidden")]: true });
    expect(() => resolve(symbol)).toThrow(TypeError);
    const inherited = input();
    Object.setPrototypeOf(inherited.balanceSheet, { fallback: true });
    expect(() => resolve(inherited)).toThrow(TypeError);
  });
});

function historyInput(): Input {
  const packet = input();
  for (const [keyIndex, key] of keys.entries()) {
    Object.assign(packet.balanceSheet, {
      [key]: metric(
        [reportDate, "2024-09-30", "2022-06-30", "2021-06-30"].map(
          (endDate, index) => ({
            ...row(key, keyIndex * 10 + index + 1, index),
            endDate,
          }),
        ),
      ),
    });
  }
  return packet;
}
function availableHistory(packet = historyInput()) {
  const result = history(packet);
  if (result.status !== "available")
    throw new Error("Expected reported history");
  return result;
}

describe("Annual reported balance-sheet history", () => {
  it("retains three actual dates, original filing coordinates and unchanged current totals", () => {
    const packet = historyInput(),
      before = structuredClone(packet),
      current = resolve(packet);
    const result = availableHistory(packet);
    expect(result.accessionNumber).toBe(accession);
    expect(result.balances.map((balance) => balance.asOfDate)).toEqual([
      reportDate,
      "2024-09-30",
      "2022-06-30",
    ]);
    for (const key of keys) {
      expect(result.balances[0]![key]).toEqual(current[key]);
      expect(result.balances[1]![key]).toEqual({
        status: "available",
        unit: "USD",
        value: row(key).value,
        asOfDate: "2024-09-30",
        accessionNumber: accession,
        observationIds: [packet.balanceSheet[key].observations[1]!.id],
        currentUseEligible: false,
      });
    }
    expect(packet).toEqual(before);
    expect(resolve(packet)).toEqual(current);
  });

  it("keeps independent missing cells, including current, without skipping a displayed date", () => {
    let packet = historyInput();
    packet = withMetric(
      packet,
      "totalAssets",
      metric(
        packet.balanceSheet.totalAssets.observations
          .filter((_, index) => index !== 0 && index !== 1)
          .map((row, index) => ({
            ...row,
            sourceLocator: `/facts/us-gaap/Assets/units/USD/${index}`,
          })),
      ),
    );
    const result = availableHistory(packet);
    for (const balance of result.balances.slice(0, 2)) {
      expect(balance.totalAssets).toEqual({
        status: "unavailable",
        unit: "USD",
        reason: "no_report_date",
        observationIds: [],
      });
      expect(balance.totalLiabilities.status).toBe("available");
      expect(balance.shareholdersEquity.status).toBe("available");
    }
    expect(result.balances[2]!.totalAssets.status).toBe("available");
    expect(result.balances.map((balance) => balance.asOfDate)).toEqual([
      reportDate,
      "2024-09-30",
      "2022-06-30",
    ]);
  });

  it.each([
    "0",
    "-1",
    "9".repeat(64),
    `-${"9".repeat(63)}`,
    `0.${"0".repeat(61)}1`,
  ])("preserves signed comparative USD %s without calculations", (value) => {
    const packet = historyInput();
    Object.assign(packet.balanceSheet.shareholdersEquity.observations[1]!, {
      value,
    });
    expect(
      availableHistory(packet).balances[1]!.shareholdersEquity,
    ).toMatchObject({ status: "available", value, currentUseEligible: false });
  });

  it.each([false, true])(
    "keeps all agreeing references or refuses a conflicting comparative cell: %s",
    (conflict) => {
      const packet = historyInput(),
        original = packet.balanceSheet.totalAssets.observations;
      const duplicate = {
        ...original[1]!,
        ...{
          id: row("totalAssets", 50, 4).id,
          sourceLocator: "/facts/us-gaap/Assets/units/USD/4",
        },
        value: conflict ? "1" : original[1]!.value,
      };
      const result = availableHistory(
        withMetric(packet, "totalAssets", metric([...original, duplicate])),
      );
      expect(result.balances[1]!.totalAssets).toMatchObject({
        status: conflict ? "unavailable" : "available",
        observationIds: [original[1]!.id, duplicate.id],
        ...(conflict ? { reason: "ambiguous_value" } : { value: "120.125" }),
      });
      expect(result.balances[1]!.totalLiabilities.status).toBe("available");
      expect(result.balances[2]!.totalAssets.status).toBe("available");
    },
  );

  it.each([
    [{ filingFocusPeriod: "Q3" }, "missing_or_non_FY_focus"],
    [{ startDate: "2024-01-01", durationDays: 274 }, "invalid_instant_period"],
    [{ form: "10-K/A" }, "unsupported_form"],
    [
      { filing: { ...row().filing, reportDate: "2024-09-30" } },
      "report_end_mismatch",
    ],
    [
      { filing: { ...row().filing, status: "metadata_conflict" } },
      "filing_unmatched_or_conflicted",
    ],
  ] satisfies [Partial<Row>, string][])(
    "refuses only the affected comparative cell %#, retaining its original coordinates",
    (change, reason) => {
      const packet = historyInput();
      Object.assign(packet.balanceSheet.totalAssets.observations[1]!, change);
      const result = availableHistory(packet);
      expect(result.balances[1]!.totalAssets).toMatchObject({
        status: "unavailable",
        reason,
        observationIds: [packet.balanceSheet.totalAssets.observations[1]!.id],
      });
      expect(result.balances[1]!.totalLiabilities.status).toBe("available");
      expect(result.balances[2]!.totalAssets.status).toBe("available");
      expect(result.balances).toHaveLength(3);
    },
  );

  it("refuses a metric with a future date without changing its current total or sibling dates", () => {
    const packet = historyInput();
    Object.assign(packet.balanceSheet.totalAssets.observations[1]!, {
      endDate: "2025-10-01",
    });
    expect(resolve(packet).totalAssets.status).toBe("available");
    const result = availableHistory(packet);
    expect(result.balances.map((balance) => balance.asOfDate)).toEqual([
      reportDate,
      "2024-09-30",
      "2022-06-30",
    ]);
    for (const balance of result.balances) {
      expect(balance.totalAssets).toMatchObject({
        status: "unavailable",
        reason: "report_end_mismatch",
        observationIds: packet.balanceSheet.totalAssets.observations.map(
          (row) => row.id,
        ),
      });
      expect(balance.totalLiabilities.status).toBe("available");
    }
  });

  it.each([
    "invalid_response",
    "candidate_limit",
    "invalid_source_rows",
    "selected_report_overflow",
  ])("isolates %s and excludes its dates", (reason) => {
    const packet = historyInput();
    let invalid: PersonalSecAnnualBalanceSheetMetricEvidenceDto;
    if (reason === "invalid_response" || reason === "candidate_limit")
      invalid = {
        scan: { status: reason, absence: null, coverage: null },
        observations: [],
      };
    else {
      invalid = metric(
        reason === "invalid_source_rows"
          ? [{ ...row(), endDate: "2025-08-31" }]
          : [],
      );
      if (invalid.scan.status !== "available") throw new Error("Expected scan");
      if (reason === "invalid_source_rows")
        Object.assign(invalid.scan.coverage.full, {
          candidateRows: 2,
          inspectedRows: 2,
          invalidRows: 1,
        });
      else {
        Object.assign(invalid.scan.coverage.full, {
          candidateRows: 101,
          inspectedRows: 101,
          uniqueObservations: 101,
        });
        Object.assign(invalid.scan.coverage, {
          selected: 101,
          returned: 0,
          omittedSelected: 101,
        });
      }
    }
    const result = availableHistory(withMetric(packet, "totalAssets", invalid));
    expect(result.balances.map((balance) => balance.asOfDate)).toEqual([
      reportDate,
      "2024-09-30",
      "2022-06-30",
    ]);
    for (const balance of result.balances) {
      expect(balance.totalAssets).toMatchObject({
        status: "unavailable",
        reason,
      });
      expect(balance.shareholdersEquity.status).toBe("available");
    }
  });

  it("does not require income, all current totals or a full three-date timeline", () => {
    let packet = input();
    packet = withMetric(packet, "totalAssets", metric([], "concept_missing"));
    packet = withMetric(packet, "totalLiabilities", metric([], "usd_missing"));
    const result = availableHistory(packet);
    expect(result.balances).toHaveLength(1);
    expect(result.balances[0]!.totalAssets).toMatchObject({
      reason: "concept_missing",
    });
    expect(result.balances[0]!.shareholdersEquity).toMatchObject({
      value: "-20.025",
    });
  });

  it.each(["2025-02-29", "2024-2-29", "0000-12-31"])(
    "rejects malformed comparative date %s before ordering",
    (endDate) => {
      const packet = historyInput();
      Object.assign(packet.balanceSheet.totalAssets.observations[1]!, {
        endDate,
      });
      expect(() => history(packet)).toThrow(TypeError);
    },
  );

  it("retains an actual leap date without rewriting the filing report date", () => {
    const packet = historyInput();
    for (const key of keys)
      Object.assign(packet.balanceSheet[key].observations[1]!, {
        endDate: "2024-02-29",
      });
    expect(availableHistory(packet).balances[1]!.asOfDate).toBe("2024-02-29");
    expect(
      packet.balanceSheet.totalAssets.observations[1]!.filing.reportDate,
    ).toBe(reportDate);
  });

  it.each([485, 486])(
    "keeps original current-use boundary %d without discarding current raw totals",
    (days) => {
      const packet = historyInput(),
        time = new Date(
          Date.parse(`${reportDate}T06:00:00.000Z`) + days * 86400000,
        ).toISOString();
      Object.assign(packet.generation, { cutoffAt: time, completedAt: time });
      for (const source of Object.values(packet.generation.sources))
        Object.assign(source, { fetchedAt: time });
      expect(history(packet).status).toBe(
        days === 485 ? "available" : "unavailable",
      );
      if (days === 486)
        expect(history(packet)).toEqual({
          status: "unavailable",
          reason: "current_use_unavailable",
        });
      expect(resolve(packet).totalAssets.status).toBe("available");
    },
  );

  it.each([
    [{ completedAt: "2026-09-27T06:00:02.001Z" }, "source_stale"],
    [{ cutoffAt: "2026-02-30T06:00:00.000Z" }, "invalid_clock"],
  ])("preserves shared source-clock refusal %#", (change, reason) => {
    const packet = historyInput();
    Object.assign(packet.generation, change);
    expect(history(packet)).toEqual({ status: "unavailable", reason });
  });

  it("returns owned deeply frozen balances and reference arrays", () => {
    const packet = historyInput(),
      result = availableHistory(packet);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.balances)).toBe(true);
    for (const balance of result.balances)
      for (const key of keys) {
        expect(Object.isFrozen(balance)).toBe(true);
        expect(Object.isFrozen(balance[key])).toBe(true);
        expect(Object.isFrozen(balance[key].observationIds)).toBe(true);
      }
    Object.assign(packet.balanceSheet.totalAssets.observations[1]!, {
      value: "999",
    });
    expect(result.balances[1]!.totalAssets).toMatchObject({ value: "120.125" });
  });
});

describe("balance-sheet history admission and non-skipping", () => {
  it("retains a refused date even when every metric fails there and older dates are valid", () => {
    const packet = historyInput();
    for (const key of keys)
      Object.assign(packet.balanceSheet[key].observations[1]!, {
        filingFocusPeriod: "Q3",
      });
    const result = availableHistory(packet);
    expect(result.balances.map((balance) => balance.asOfDate)).toEqual([
      reportDate,
      "2024-09-30",
      "2022-06-30",
    ]);
    for (const key of keys) {
      expect(result.balances[1]![key]).toMatchObject({
        status: "unavailable",
        reason: "missing_or_non_FY_focus",
      });
      expect(result.balances[2]![key].status).toBe("available");
    }
  });
  it.each(["duplicate-id", "accession", "accessor", "hole"])(
    "rejects malformed %s rather than returning a semantic refusal",
    (change) => {
      const packet = historyInput(),
        rows = packet.balanceSheet.totalAssets.observations;
      if (change === "duplicate-id")
        Object.assign(rows[1]!, { id: rows[0]!.id });
      if (change === "accession")
        Object.assign(rows[1]!, { accessionNumber: "0000999999-26-000002" });
      if (change === "accessor")
        Object.defineProperty(rows[1], "value", {
          enumerable: true,
          get: () => {
            throw new Error("Accessor must not run");
          },
        });
      if (change === "hole") Reflect.deleteProperty(rows, "1");
      expect(() => history(packet)).toThrow(TypeError);
    },
  );
});
