import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";

import {
  PERSONAL_SEC_FILING_CONTEXT_LIMITS as LIMITS,
  type PersonalSecFilingContextSelectionDto,
} from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPersonalSecFilingContextParser,
  type PersonalSecFilingContextParser,
} from "./personal-sec-filing-context-parser";

const selection: PersonalSecFilingContextSelectionDto = Object.freeze({
  id: `sec-fact:${"a".repeat(64)}`,
  metric: "revenue",
  taxonomy: "us-gaap",
  concept: "Revenues",
  unit: "USD",
  value: "100",
  startDate: "2025-01-01",
  endDate: "2025-03-31",
  accessionNumber: "0000000042-25-000001",
  form: "10-Q",
  filedDate: "2025-05-01",
});
const parsers: PersonalSecFilingContextParser[] = [];
function parser(): PersonalSecFilingContextParser {
  const value = createPersonalSecFilingContextParser();
  parsers.push(value);
  return value;
}
afterEach(() => {
  for (const value of parsers.splice(0)) value.close();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function context(
  id = "c",
  start = "2025-01-01",
  end = "2025-03-31",
  entity = "0000000042",
  extra = "",
): string {
  return `<xbrli:context id="${id}"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">${entity}</xbrli:identifier>${extra}</xbrli:entity><xbrli:period><xbrli:startDate>${start}</xbrli:startDate><xbrli:endDate>${end}</xbrli:endDate></xbrli:period></xbrli:context>`;
}
function fact(value = "100", attributes = "", contextId = "c"): string {
  return `<ix:nonFraction name="us-gaap:Revenues" contextRef="${contextId}" unitRef="u" decimals="0" ${attributes}>${value}</ix:nonFraction>`;
}
function document(
  facts = fact(),
  contexts = context(),
  unit = '<xbrli:unit id="u"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>',
): string {
  return `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL" xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:us-gaap="http://fasb.org/us-gaap/2025" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" xmlns:ixt="http://www.xbrl.org/inlineXBRL/transformation/2020-02-12"><head><meta charset="utf-8"/></head><body><ix:header><ix:resources>${contexts}${unit}</ix:resources></ix:header>${facts}</body></html>`;
}
function parse(
  html = document(),
  override: Partial<PersonalSecFilingContextSelectionDto> = {},
) {
  return parser().parse({
    document: new TextEncoder().encode(html),
    cik: "0000000042",
    selection: { ...selection, ...override },
  });
}

describe("selected SEC filing context real isolated worker", () => {
  it("preserves exact fact/context/entity/unit and locator provenance", async () => {
    const result = await parse(document(fact("100", 'id="revenue-fact"')));
    expect(result.status).toBe("matched");
    expect(result.reason).toBeNull();
    expect(result.candidates).toHaveLength(1);
    expect(result.correspondingCandidateLocators).toEqual([
      result.candidates[0]?.locator,
    ]);
    expect(result.candidates[0]).toMatchObject({
      factId: "revenue-fact",
      contextId: "c",
      unitId: "u",
      concept: {
        raw: "us-gaap:Revenues",
        namespace: "http://fasb.org/us-gaap/2025",
        localName: "Revenues",
      },
      entityIdentifier: "0000000042",
      entityScheme: "http://www.sec.gov/CIK",
      entityCik: "0000000042",
      dimensions: [],
      periodKind: "duration",
      startDate: "2025-01-01",
      endDate: "2025-03-31",
      unit: "USD",
      unitMeasures: [
        {
          raw: "iso4217:USD",
          namespace: "http://www.xbrl.org/2003/iso4217",
          localName: "USD",
        },
      ],
      rawText: "100",
      format: null,
      scale: null,
      sign: null,
      decimals: "0",
      precision: null,
      value: "100",
      issues: [],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.candidates[0]?.concept)).toBe(true);
    expect(Object.isFrozen(result.candidates[0]?.unitMeasures)).toBe(true);
  });

  it.each([
    ["9007199254740993.123456789", "", "9007199254740993.123456789"],
    ["1".repeat(64), "", "1".repeat(64)],
    ["0.0001", 'scale="-6"', "0.0000000001"],
    ["1,234.50", 'format="ixt:num-dot-decimal" scale="3" sign="-"', "-1234500"],
    ["1.234,50", 'format="ixt:num-comma-decimal"', "1234.5"],
    ["(not reported)", 'format="ixt:fixed-zero" sign="-"', "0"],
    ["000.000", 'sign="-"', "0"],
  ])("normalizes %s losslessly", async (raw, attrs, expected) => {
    const result = await parse(document(fact(raw, attrs)), { value: expected });
    expect(result.status).toBe("matched");
    expect(result.candidates[0]?.rawText).toBe(raw);
    expect(result.candidates[0]?.value).toBe(expected);
  });

  it("supports the exact legacy transform namespace while preserving source format", async () => {
    const html = document(fact("1,000", 'format="ixt:numdotdecimal"')).replace(
      "transformation/2020-02-12",
      "transformation/2015-02-26",
    );
    const result = await parse(html, { value: "1000" });
    expect(result.status).toBe("matched");
    expect(result.candidates[0]?.format).toEqual({
      raw: "ixt:numdotdecimal",
      namespace: "http://www.xbrl.org/inlineXBRL/transformation/2015-02-26",
      localName: "numdotdecimal",
    });
  });

  it("does not select a preferred duplicate or round conflicting values", async () => {
    const result = await parse(
      document(
        fact("100", 'id="a"') +
          fact("100", 'id="b"') +
          fact("100.0000000000000000001", 'id="d"'),
      ),
    );
    expect(result.status).toBe("ambiguous");
    expect(result.candidates.map((row) => row.factId)).toEqual(["a", "b", "d"]);
    expect(result.correspondingCandidateLocators).toHaveLength(3);
  });

  it("keeps equivalent duplicate references and signals one different exact value", async () => {
    const equal = await parse(
      document(fact("100", 'id="a"') + fact("100.0", 'id="b"')),
    );
    expect(equal.status).toBe("matched");
    expect(equal.correspondingCandidateLocators).toHaveLength(2);
    const different = await parse(document(fact("101")));
    expect(different.status).toBe("value_differs");
    expect(different.candidates[0]?.value).toBe("101");
  });

  it("compares exact period/entity coordinates while retaining other durations", async () => {
    const contexts =
      context() +
      context("six", "2024-10-01") +
      context("nine", "2024-07-01") +
      context("other", "2025-01-01", "2025-03-31", "7");
    const result = await parse(
      document(
        fact() +
          fact("600", "", "six") +
          fact("900", "", "nine") +
          fact("400", "", "other"),
        contexts,
      ),
    );
    expect(result.status).toBe("matched");
    expect(result.candidates.map((row) => row.issues)).toEqual([
      [],
      ["period_mismatch"],
      ["period_mismatch"],
      ["entity_mismatch"],
    ]);
    expect(result.correspondingCandidateLocators).toHaveLength(1);
  });

  it("does not infer quarter labels or corresponding facts from similar aliases", async () => {
    const result = await parse(
      document(fact().replace("Revenues", "SalesRevenueNet")),
    );
    expect(result).toEqual({
      status: "no_corresponding_fact",
      reason: null,
      candidates: [],
      correspondingCandidateLocators: [],
    });
    expect(
      (
        await parse(
          document(
            fact("100", "", "different"),
            context("different", "2024-10-01"),
          ),
        )
      ).status,
    ).toBe("no_corresponding_fact");
  });

  it("preserves dimensions and withholds a clean candidate when matching scope is unresolved", async () => {
    const dimensional = context(
      "segment",
      "2025-01-01",
      "2025-03-31",
      "42",
      '<xbrli:segment><xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">us-gaap:SegmentsMember</xbrldi:explicitMember></xbrli:segment>',
    );
    const result = await parse(
      document(fact() + fact("50", "", "segment"), context() + dimensional),
    );
    expect(result.status).toBe("unsupported");
    expect(result.reason).toBe("unsupported_dimensions");
    expect(result.correspondingCandidateLocators).toHaveLength(1);
    expect(result.candidates[1]?.dimensions).toEqual([
      {
        kind: "explicit",
        dimension: {
          raw: "us-gaap:StatementBusinessSegmentsAxis",
          namespace: "http://fasb.org/us-gaap/2025",
          localName: "StatementBusinessSegmentsAxis",
        },
        member: {
          raw: "us-gaap:SegmentsMember",
          namespace: "http://fasb.org/us-gaap/2025",
          localName: "SegmentsMember",
        },
        typedText: null,
      },
    ]);
  });

  it("preserves typed dimension text without XML/HTML markup", async () => {
    const ctx = context(
      "c",
      "2025-01-01",
      "2025-03-31",
      "42",
      '<xbrli:segment><xbrldi:typedMember dimension="us-gaap:SomeAxis"><span>&lt;script&gt;never execute&lt;/script&gt;</span></xbrldi:typedMember></xbrli:segment>',
    );
    const result = await parse(document(fact(), ctx));
    expect(result.status).toBe("unsupported");
    expect(result.candidates[0]?.dimensions[0]?.typedText).toBe(
      "<script>never execute</script>",
    );
  });

  it.each([
    [
      "spoofed taxonomy",
      (html: string) =>
        html.replace(
          "http://fasb.org/us-gaap/2025",
          "https://attacker.example/us-gaap/2025",
        ),
      "invalid_namespace",
    ],
    [
      "spoofed entity scheme",
      (html: string) =>
        html.replace("http://www.sec.gov/CIK", "https://attacker.example/CIK"),
      "unsupported_entity",
    ],
    [
      "missing context",
      (html: string) => html.replace('contextRef="c"', 'contextRef="missing"'),
      "unresolved_context",
    ],
    [
      "missing unit",
      (html: string) => html.replace('unitRef="u"', 'unitRef="missing"'),
      "unresolved_unit",
    ],
    [
      "duplicate context",
      (html: string) =>
        html.replace("</ix:resources>", `${context()}</ix:resources>`),
      "duplicate_id",
    ],
    [
      "hostile reference",
      (html: string) => html.replace('contextRef="c"', 'contextRef="../../c"'),
      "invalid_identifier",
    ],
    [
      "malformed tree",
      (html: string) => html.replace("</xbrli:entity>", "</span>"),
      "invalid_document",
    ],
    [
      "DTD entity",
      (html: string) =>
        html.replace(
          "<!DOCTYPE html>",
          '<!DOCTYPE html [<!ENTITY secret SYSTEM "file:///private">]>',
        ),
      "invalid_document",
    ],
    [
      "duplicate namespace attribute",
      (html: string) => html.replace("<html ", '<html xmlns:ix="bad" '),
      "invalid_document",
    ],
    [
      "case-sensitive prefix conflation",
      (html: string) => html.replace("xmlns:us-gaap", "xmlns:US-GAAP"),
      "invalid_namespace",
    ],
    [
      "case-sensitive namespace declaration keyword",
      (html: string) => html.replace("xmlns:us-gaap", "XMLNS:us-gaap"),
      "invalid_namespace",
    ],
    [
      "case-sensitive inline local name",
      (html: string) => html.replaceAll("ix:nonFraction", "ix:NonFraction"),
      "invalid_document",
    ],
    [
      "case-sensitive inline reference attribute",
      (html: string) => html.replace("contextRef", "contextref"),
      "invalid_document",
    ],
    [
      "case-sensitive period local name",
      (html: string) => html.replaceAll("xbrli:startDate", "xbrli:startdate"),
      "invalid_document",
    ],
    [
      "case-sensitive semantic closing tag",
      (html: string) => html.replace("</ix:nonFraction>", "</ix:nonfraction>"),
      "invalid_document",
    ],
    [
      "unquoted semantic XML attributes",
      (html: string) => html.replace('contextRef="c"', "contextRef=c"),
      "invalid_document",
    ],
    [
      "unknown transform",
      (html: string) =>
        html.replace('decimals="0"', 'decimals="0" format="ixt:made-up"'),
      "unsupported_transform",
    ],
    [
      "spoofed transform",
      (html: string) =>
        html
          .replace('decimals="0"', 'decimals="0" format="ixt:fixed-zero"')
          .replace(
            "http://www.xbrl.org/inlineXBRL/transformation/2020-02-12",
            "https://evil.test/transformation/2020-02-12",
          ),
      "unsupported_transform",
    ],
    [
      "continuation",
      (html: string) =>
        html.replace('decimals="0"', 'decimals="0" continuedAt="x"'),
      "unsupported_inline",
    ],
    [
      "alternate target",
      (html: string) =>
        html.replace('decimals="0"', 'decimals="0" target="other"'),
      "unsupported_inline",
    ],
    [
      "markup numeric",
      (html: string) =>
        html.replace(
          ">100</ix:nonFraction>",
          "><span>100</span></ix:nonFraction>",
        ),
      "unsupported_inline",
    ],
    [
      "inline nil",
      (html: string) =>
        html.replace(
          'decimals="0"',
          'decimals="0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"',
        ),
      "unsupported_inline",
    ],
    [
      "negative text",
      (html: string) =>
        html.replace(">100</ix:nonFraction>", ">-100</ix:nonFraction>"),
      "invalid_numeric",
    ],
    [
      "exponent text",
      (html: string) =>
        html.replace(">100</ix:nonFraction>", ">1e2</ix:nonFraction>"),
      "invalid_numeric",
    ],
    [
      "excessive exact decimal",
      (html: string) =>
        html.replace(
          ">100</ix:nonFraction>",
          `>${"1".repeat(65)}</ix:nonFraction>`,
        ),
      "decimal_limit",
    ],
  ])(
    "reports %s without a successful partial prefix",
    async (_label, mutate, reason) => {
      const result = await parse(mutate(document()));
      expect(result.status).toBe("unsupported");
      expect(result.reason).toBe(reason);
      expect(result.correspondingCandidateLocators).toEqual([]);
    },
  );

  it("preserves complex unit measures but never treats a ratio as dollars", async () => {
    const unit =
      '<xbrli:unit id="u"><xbrli:divide><xbrli:unitNumerator><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unitNumerator><xbrli:unitDenominator><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unitDenominator></xbrli:divide></xbrli:unit>';
    const result = await parse(document(fact(), context(), unit));
    expect(result.reason).toBe("unsupported_unit");
    expect(result.candidates[0]?.unitMeasures).toHaveLength(2);
    expect(result.candidates[0]?.unit).toBeNull();
  });

  it("resolves lexical prefix scope instead of trusting conventional prefix names", async () => {
    const renamed = document()
      .replaceAll("us-gaap:", "gaap:")
      .replace("xmlns:us-gaap", "xmlns:gaap");
    expect((await parse(renamed)).status).toBe("matched");
    const shadowed = document(
      fact("100", 'xmlns:us-gaap="https://attacker.example/gaap"'),
    );
    expect((await parse(shadowed)).reason).toBe("invalid_namespace");
  });

  it("does not accept misplaced period or entity components", async () => {
    const misplaced = context().replace(
      "</xbrli:context>",
      "<xbrli:startDate>2024-01-01</xbrli:startDate></xbrli:context>",
    );
    expect((await parse(document(fact(), misplaced))).reason).toBe(
      "malformed_context",
    );
    const duplicate = context().replace(
      "</xbrli:entity>",
      '<xbrli:identifier scheme="http://www.sec.gov/CIK">42</xbrli:identifier></xbrli:entity>',
    );
    expect((await parse(document(fact(), duplicate))).reason).toBe(
      "malformed_context",
    );
    const zero = context("c", "2025-01-01", "2025-03-31", "0");
    expect((await parse(document(fact(), zero))).reason).toBe(
      "unsupported_entity",
    );
    const nestedPeriod = context().replace(
      "</xbrli:entity>",
      "<xbrli:period><xbrli:instant>2025-01-01</xbrli:instant></xbrli:period></xbrli:entity>",
    );
    expect((await parse(document(fact(), nestedPeriod))).reason).toBe(
      "malformed_context",
    );
  });

  it("preserves an instant as a known different period rather than inventing a duration", async () => {
    const instant = context().replace(
      "<xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-03-31</xbrli:endDate>",
      "<xbrli:instant>2025-03-31</xbrli:instant>",
    );
    const result = await parse(document(fact(), instant));
    expect(result.status).toBe("no_corresponding_fact");
    expect(result.candidates[0]).toMatchObject({
      periodKind: "instant",
      startDate: null,
      endDate: "2025-03-31",
      issues: ["period_mismatch"],
    });
  });

  it("retains a clean reference while an unresolved matching fact prevents success", async () => {
    const result = await parse(
      document(fact() + fact("100", 'continuedAt="continuation"')),
    );
    expect(result.status).toBe("unsupported");
    expect(result.reason).toBe("unsupported_inline");
    expect(result.candidates).toHaveLength(2);
    expect(result.correspondingCandidateLocators).toHaveLength(1);
  });

  it("returns no partial candidate output when structured output reaches its cap", async () => {
    const html = document(
      fact("€".repeat(4096), 'format="ixt:fixed-zero"').repeat(100),
    );
    expect(await parse(html)).toEqual({
      status: "unsupported",
      reason: "output_limit",
      candidates: [],
      correspondingCandidateLocators: [],
    });
  });

  it("uses the same UTF16 text bound as its consumers and rejects invalid UTF8", async () => {
    const result = await parse(
      document(fact("😀".repeat(2048), 'format="ixt:fixed-zero"')),
      { value: "0" },
    );
    expect(result.status).toBe("matched");
    expect(result.candidates[0]?.rawText).toHaveLength(4096);
    expect(
      (
        await parse(
          document(fact("😀".repeat(2049), 'format="ixt:fixed-zero"')),
        )
      ).reason,
    ).toBe("invalid_document");
    expect(
      await parser().parse({
        document: new Uint8Array([255]),
        cik: "0000000042",
        selection,
      }),
    ).toEqual({
      status: "unsupported",
      reason: "invalid_document",
      candidates: [],
      correspondingCandidateLocators: [],
    });
  });

  it("supports each selected concept and dates through an amended quarterly form", async () => {
    for (const concept of [
      "Revenues",
      "SalesRevenueNet",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "NetIncomeLoss",
    ] as const) {
      const result = await parse(
        document(fact().replace("Revenues", concept)),
        {
          concept,
          metric: concept === "NetIncomeLoss" ? "net_income" : "revenue",
          form: "10-Q/A",
        },
      );
      expect(result.status).toBe("matched");
    }
  });

  it("accepts the candidate cap and rejects the next row without any prefix", async () => {
    expect(
      (await parse(document(fact().repeat(LIMITS.candidates)))).candidates,
    ).toHaveLength(LIMITS.candidates);
    expect(await parse(document(fact().repeat(LIMITS.candidates + 1)))).toEqual(
      {
        status: "unsupported",
        reason: "candidate_limit",
        candidates: [],
        correspondingCandidateLocators: [],
      },
    );
  });

  it("rejects excessive tree depth and attributes independently", async () => {
    expect(
      (
        await parse(
          document("<div>".repeat(260) + fact() + "</div>".repeat(260)),
        )
      ).reason,
    ).toBe("depth_limit");
    expect(
      (
        await parse(
          document(
            fact(
              "100",
              Array.from(
                { length: 65 },
                (_, index) => `data-k${index}="a"`,
              ).join(" "),
            ),
          ),
        )
      ).reason,
    ).toBe("attribute_limit");
  });

  it.each([new Uint8Array(), new Uint8Array(LIMITS.documentBytes + 1)])(
    "rejects empty/oversized input before process launch",
    async (bytes) => {
      await expect(
        parser().parse({ document: bytes, cik: "0000000042", selection }),
      ).rejects.toMatchObject({ code: "invalid_request" });
    },
  );

  it("requires selected duration, supported form and canonical exact source value", async () => {
    for (const changes of [
      { startDate: null },
      { form: "10-K" },
      { value: "1e2" },
      { value: "-0" },
      { metric: "net_income" as const },
    ]) {
      await expect(parse(document(), changes)).rejects.toMatchObject({
        code: "invalid_request",
      });
    }
  });
});

function alternateWorker(script: string) {
  let child: ChildProcessWithoutNullStreams | undefined;
  const launched = vi.fn((...args: unknown[]) => {
    void args;
    child = spawn(process.execPath, ["-e", script], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return child;
  });
  const value = createPersonalSecFilingContextParser({
    spawn: launched as unknown as typeof spawn,
  });
  parsers.push(value);
  return { value, launched, child: () => child };
}

describe("asynchronous filing worker boundary", () => {
  const input = {
    document: new TextEncoder().encode(document()),
    cik: "0000000042",
    selection,
  };

  it("fixes executable/isolated arguments, hides Windows child and excludes inherited secrets", async () => {
    vi.stubEnv("SEC_SECRET_CANARY", "must-not-reach-worker");
    vi.stubEnv("PYTHONPATH", "untrusted-modules");
    const worker = alternateWorker(
      'process.stdin.resume(); process.stdin.on("end",()=>process.stdout.write(JSON.stringify({status:"no_corresponding_fact",reason:null,candidates:[],correspondingCandidateLocators:[]})))',
    );
    expect((await worker.value.parse(input)).status).toBe(
      "no_corresponding_fact",
    );
    const call = worker.launched.mock.calls[0];
    expect(call?.[0]).toBe(process.platform === "win32" ? "python" : "python3");
    expect(call?.[1]).toEqual([
      "-I",
      "-S",
      "-B",
      expect.stringMatching(/personal_sec_filing_context\.py$/u),
    ]);
    expect(call?.[2]).toMatchObject({
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const environment = (call?.[2] as { env: NodeJS.ProcessEnv }).env;
    expect(Object.keys(environment).sort()).toEqual(
      expect.arrayContaining(["LANG", "PATH"]),
    );
    expect(environment.SEC_SECRET_CANARY).toBeUndefined();
    expect(environment.PYTHONPATH).toBeUndefined();
    expect(
      Object.keys(environment).every((key) =>
        ["LANG", "PATH", "SystemRoot", "WINDIR"].includes(key),
      ),
    ).toBe(true);
  });

  it.each([
    ['process.stdout.write("not-json")', "invalid_output"],
    ["process.stdout.write(Buffer.from([255,255]))", "invalid_output"],
    [
      'process.stdout.write(JSON.stringify({status:"matched",reason:null,candidates:[],correspondingCandidateLocators:[]}))',
      "invalid_output",
    ],
    [
      'process.stdout.write(JSON.stringify({status:"no_corresponding_fact",reason:null,candidates:[],correspondingCandidateLocators:[],extra:true}))',
      "invalid_output",
    ],
    [
      'process.stderr.write("private-canary");process.exitCode=2',
      "worker_failed",
    ],
    [
      `process.stdout.write("x".repeat(${LIMITS.workerOutputBytes + 1}))`,
      "output_too_large",
    ],
    [
      `process.stderr.write("x".repeat(${LIMITS.workerStderrBytes + 1}))`,
      "output_too_large",
    ],
  ])("rejects malformed or excessive worker output", async (script, code) => {
    const worker = alternateWorker(
      `process.stdin.resume();process.stdin.on("end",()=>{${script}})`,
    );
    await expect(worker.value.parse(input)).rejects.toMatchObject({
      code,
      message: "Personal SEC filing context parsing is unavailable.",
    });
  });

  it("reports missing runtime without falling back to another executable", async () => {
    const launch = vi.fn(() => {
      throw Error("private executable path");
    });
    const value = createPersonalSecFilingContextParser({
      spawn: launch as unknown as typeof spawn,
    });
    await expect(value.parse(input)).rejects.toMatchObject({
      code: "runtime_unavailable",
    });
    expect(launch).toHaveBeenCalledTimes(1);
  });

  it("cancels an active process, retains the busy guard until exit and ignores late output", async () => {
    const worker = alternateWorker(
      "process.stdin.resume();setInterval(()=>{},1000)",
    );
    const controller = new AbortController();
    const pending = worker.value.parse(input, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: "aborted" });
    await expect(worker.value.parse(input)).rejects.toMatchObject({
      code: "busy",
    });
    const child = worker.child();
    expect(child).toBeDefined();
    const closed = once(child!, "close");
    controller.abort();
    await rejected;
    await closed;
    expect(child?.killed).toBe(true);
  });

  it("enforces its deadline and terminates the worker", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const worker = alternateWorker(
      "process.stdin.resume();setInterval(()=>{},1000)",
    );
    const pending = worker.value.parse(input);
    const rejected = expect(pending).rejects.toMatchObject({ code: "timeout" });
    const closed = once(worker.child()!, "close");
    await vi.advanceTimersByTimeAsync(LIMITS.workerTimeoutMs);
    await rejected;
    await closed;
    expect(worker.child()?.killed).toBe(true);
  });

  it("aborts on shutdown and never launches after shutdown or pre-cancellation", async () => {
    const worker = alternateWorker(
      "process.stdin.resume();setInterval(()=>{},1000)",
    );
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      worker.value.parse(input, aborted.signal),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(worker.launched).not.toHaveBeenCalled();
    const pending = worker.value.parse(input);
    const rejected = expect(pending).rejects.toMatchObject({ code: "aborted" });
    const closed = once(worker.child()!, "close");
    worker.value.close();
    await rejected;
    await closed;
    await expect(worker.value.parse(input)).rejects.toMatchObject({
      code: "aborted",
    });
    expect(worker.launched).toHaveBeenCalledTimes(1);
  });
});
