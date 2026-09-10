import { createEmptyPersonalSecFilingReportingMetadata } from "@research-cockpit/contracts";
import type {
  PersonalSecFilingContextCandidateDto,
  PersonalSecFilingContextQNameDto,
  PersonalSecFilingContextRequestDto,
  PersonalSecFilingContextResponseDto,
  PersonalSecQuarterlyObservationDto,
  PersonalSecFilingReportingMetadataDto,
  PersonalSecFilingReportingObservationDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPersonalSecFilingContext,
  selectPersonalSecFilingContextObservation,
} from "./personal-sec-filing-context-api";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const reportDateFormat: PersonalSecFilingContextQNameDto = {
  raw: "ixt:date-monthname-day-year-en",
  namespace: "http://www.xbrl.org/inlineXBRL/transformation/2020-02-12",
  localName: "date-monthname-day-year-en",
};

describe("transformed reporting-date browser validation", () => {
  it.each(["June 30, 2026", "\tJun. 30th, 26\r\n"])(
    "recomputes %s while retaining source format and selected numeric period",
    async (rawText) => {
      const metadata = transformedDateMetadata({ rawText });
      fetchMock.mockResolvedValue(json(withMetadata(metadata)));
      const value = await fetchPersonalSecFilingContext(request(), signal());
      expect(value).toMatchObject({
        inspection: {
          observation: {
            startDate: "2026-04-01",
            endDate: "2026-06-30",
            periodBasis: "unresolved",
          },
          analysis: { status: "matched", reportingMetadata: metadata },
        },
      });
      if (value.inspection.status !== "available") throw new Error();
      expect(value.inspection.analysis.candidates).toEqual([candidate()]);
      expect(
        Object.isFrozen(
          value.inspection.analysis.reportingMetadata.observations[1]?.format,
        ),
      ).toBe(true);
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );
  it.each(["same value", "different value", "wrong issuer"])(
    "assesses a transformed sibling with %s without choosing a preferred reference",
    async (kind) => {
      const base = transformedDateMetadata();
      const original = base.observations[1]!;
      const sibling: PersonalSecFilingReportingObservationDto = {
        ...original,
        locator: "/elements/204",
        rawText: kind === "different value" ? "July 1, 2026" : "Jun 30, 26",
        value: kind === "different value" ? "2026-07-01" : "2026-06-30",
        ...(kind === "wrong issuer"
          ? {
              entityIdentifier: "2",
              entityCik: "0000000002",
              issues: ["entity_mismatch"] as const,
            }
          : {}),
      };
      const metadata = {
        ...base,
        observations: [...base.observations, sibling],
        fields: base.fields.map((field, index) =>
          index === 1
            ? {
                ...field,
                status: kind === "different value" ? "conflicting" : "observed",
                value: kind === "different value" ? null : field.value,
                observationLocators: [
                  ...field.observationLocators,
                  sibling.locator,
                ],
              }
            : field,
        ),
      };
      fetchMock.mockResolvedValue(json(withMetadata(metadata)));
      await expect(
        fetchPersonalSecFilingContext(request(), signal()),
      ).resolves.toMatchObject({
        inspection: {
          analysis: { status: "matched", reportingMetadata: metadata },
        },
      });
    },
  );
  it.each([
    ["malformed context", ["malformed_context"]],
    ["mixed wrong issuer", ["entity_mismatch", "malformed_context"]],
    ["invalid transformed date", ["invalid_metadata_value"]],
    ["unsupported transform", ["unsupported_transform"]],
  ] as const)(
    "keeps %s uncertainty ahead of a valid transformed sibling",
    async (kind, issues) => {
      const base = transformedDateMetadata();
      const original = base.observations[1]!;
      const sibling: PersonalSecFilingReportingObservationDto = {
        ...original,
        locator: "/elements/204",
        rawText:
          kind === "invalid transformed date"
            ? "June 31, 2026"
            : original.rawText,
        value: null,
        issues,
        ...(kind === "mixed wrong issuer"
          ? { entityIdentifier: "2", entityCik: "0000000002" }
          : {}),
        ...(kind === "unsupported transform"
          ? {
              format: {
                ...reportDateFormat,
                namespace:
                  "https://www.xbrl.org/inlineXBRL/transformation/2020-02-12",
              },
            }
          : {}),
      };
      const metadata = {
        ...base,
        observations: [...base.observations, sibling],
        fields: base.fields.map((field, index) =>
          index === 1
            ? {
                ...field,
                status: "unsupported",
                value: null,
                observationLocators: [
                  ...field.observationLocators,
                  sibling.locator,
                ],
              }
            : field,
        ),
      };
      fetchMock.mockResolvedValueOnce(json(withMetadata(metadata)));
      await expect(
        fetchPersonalSecFilingContext(request(), signal()),
      ).resolves.toMatchObject({
        inspection: {
          analysis: { status: "matched", reportingMetadata: metadata },
        },
      });
      fetchMock.mockResolvedValueOnce(
        json(
          withMetadata({
            ...metadata,
            fields: metadata.fields.map((field, index) =>
              index === 1
                ? { ...field, status: "observed", value: "2026-06-30" }
                : field,
            ),
          }),
        ),
      );
      await expect(
        fetchPersonalSecFilingContext(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );
  it.each([
    ["forged canonical date", { value: "2026-07-01" }],
    [
      "wrong registry namespace",
      {
        format: {
          ...reportDateFormat,
          namespace: "http://www.xbrl.org/inlineXBRL/transformation/2022-02-16",
        },
      },
    ],
    [
      "wrong transform name",
      {
        format: {
          ...reportDateFormat,
          raw: "ixt:date-day-monthname-year-en",
          localName: "date-day-monthname-year-en",
        },
      },
    ],
    [
      "spoofed raw QName",
      { format: { ...reportDateFormat, raw: "ixt:fixed-zero" } },
    ],
    [
      "malformed raw QName",
      {
        format: {
          ...reportDateFormat,
          raw: "ixt:extra:date-monthname-day-year-en",
        },
      },
    ],
    ["unknown month case", { rawText: "JuNe 30, 2026" }],
    ["impossible calendar date", { rawText: "June 31, 2026" }],
    ["three-digit year", { rawText: "June 30, 026" }],
    ["non-ASCII digits", { rawText: "June ３０, 2026" }],
  ] satisfies readonly (readonly [
    string,
    Partial<PersonalSecFilingReportingObservationDto>,
  ])[])("rejects transformed-date assertion with %s", async (_, patch) => {
    fetchMock.mockResolvedValue(
      json(withMetadata(transformedDateMetadata(patch))),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([false, true])(
    "rejects a date transform on the wrong concept, excluded=%s",
    async (excluded) => {
      const base = reportingMetadata();
      const metadata = patchMetadataRow(base, {
        format: reportDateFormat,
        ...(excluded
          ? {
              entityIdentifier: "2",
              entityCik: "0000000002",
              issues: ["entity_mismatch"],
            }
          : {}),
      });
      if (excluded)
        metadata.fields = metadata.fields.map((field, index) =>
          index === 0 ? { ...field, status: "missing", value: null } : field,
        );
      fetchMock.mockResolvedValue(json(withMetadata(metadata)));
      await expect(
        fetchPersonalSecFilingContext(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );
});

describe("filing-declared metadata browser validation", () => {
  it("retains four declared fields, their differing duration context and frozen references", async () => {
    fetchMock.mockResolvedValue(json(response()));
    const value = await fetchPersonalSecFilingContext(request(), signal());
    if (value.inspection.status !== "available") throw new Error();
    const metadata = value.inspection.analysis.reportingMetadata;
    expect(metadata).toEqual(reportingMetadata());
    expect(metadata.observations[0]?.startDate).toBe("2026-01-01");
    expect(value.inspection.observation.startDate).toBe("2026-04-01");
    expect(Object.isFrozen(metadata.fields[0]?.observationLocators)).toBe(true);
    expect(Object.isFrozen(metadata.observations[0]?.concept)).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it.each([
    "missing",
    "same references",
    "conflicting",
    "unsupported",
    "wrong issuer",
  ])(
    "accepts an honest %s metadata assessment without changing numeric correspondence",
    async (kind) => {
      const base = reportingMetadata();
      const first = base.observations[0]!;
      const row: PersonalSecFilingReportingObservationDto = {
        ...first,
        locator: "/elements/204",
        concept: {
          ...first.concept,
          raw: "report:DocumentType",
          namespace: "http://xbrl.sec.gov/dei/2024",
        },
        ...(kind === "conflicting"
          ? { rawText: "10-Q/A", value: "10-Q/A" }
          : {}),
        ...(kind === "unsupported"
          ? {
              rawText: "<b>10-Q</b>",
              value: null,
              issues: ["unsupported_inline"] as const,
            }
          : {}),
        ...(kind === "wrong issuer"
          ? {
              entityIdentifier: "2",
              entityCik: "0000000002",
              issues: ["entity_mismatch"] as const,
            }
          : {}),
      };
      const metadata =
        kind === "missing"
          ? createEmptyPersonalSecFilingReportingMetadata()
          : {
              ...base,
              observations: [...base.observations, row],
              fields: base.fields.map((field, index) =>
                index === 0
                  ? {
                      ...field,
                      status:
                        kind === "conflicting"
                          ? "conflicting"
                          : kind === "unsupported"
                            ? "unsupported"
                            : "observed",
                      value:
                        kind === "conflicting" || kind === "unsupported"
                          ? null
                          : field.value,
                      observationLocators: [
                        ...field.observationLocators,
                        row.locator,
                      ],
                    }
                  : field,
              ),
            };
      fetchMock.mockResolvedValue(json(withMetadata(metadata)));
      await expect(
        fetchPersonalSecFilingContext(request(), signal()),
      ).resolves.toMatchObject({
        inspection: {
          analysis: { status: "matched", reportingMetadata: metadata },
        },
      });
    },
  );
  it.each(["candidate_limit", "output_limit"] as const)(
    "preserves numeric evidence when metadata alone reaches %s",
    async (reason) => {
      const metadata = { ...unavailableMetadata(), status: "limited", reason };
      fetchMock.mockResolvedValue(json(withMetadata(metadata)));
      await expect(
        fetchPersonalSecFilingContext(request(), signal()),
      ).resolves.toMatchObject({
        inspection: {
          analysis: {
            status: "matched",
            candidates: [candidate()],
            reportingMetadata: metadata,
          },
        },
      });
    },
  );
  it.each(["documenttype", "DocumentType"])(
    "preserves unsupported DEI form %s without treating it as absent",
    async (localName) => {
      const base = reportingMetadata();
      const first = base.observations[0]!;
      const row: PersonalSecFilingReportingObservationDto = {
        ...first,
        locator: "/elements/204",
        concept: { ...first.concept, raw: `dei:${localName}`, localName },
        rawText: "10-Q/A",
        value: "10-Q/A",
        issues: ["unsupported_inline"],
      };
      const metadata = {
        ...base,
        observations: [...base.observations, row],
        fields: base.fields.map((field, index) =>
          index === 0
            ? {
                ...field,
                status: "unsupported",
                value: null,
                observationLocators: [
                  ...field.observationLocators,
                  row.locator,
                ],
              }
            : field,
        ),
      };
      fetchMock.mockResolvedValue(json(withMetadata(metadata)));
      await expect(
        fetchPersonalSecFilingContext(request(), signal()),
      ).resolves.toMatchObject({
        inspection: { analysis: { reportingMetadata: metadata } },
      });
    },
  );
  it.each([
    ["missing projection", () => null],
    ["missing field", (value) => ({ ...value, fields: value.fields.slice(1) })],
    [
      "wrong field order",
      (value) => ({ ...value, fields: [...value.fields].reverse() }),
    ],
    [
      "unreferenced observation",
      (value) => ({
        ...value,
        fields: value.fields.map((field) => ({
          ...field,
          observationLocators: [],
        })),
      }),
    ],
    [
      "false conflict",
      (value) => ({
        ...value,
        fields: value.fields.map((field) => ({
          ...field,
          status: "conflicting",
          value: null,
        })),
      }),
    ],
    [
      "unsupported namespace marked observed",
      (value) =>
        patchMetadataRow(value, {
          concept: {
            ...value.observations[0]!.concept,
            namespace: "https://xbrl.sec.gov/dei/2026",
          },
        }),
    ],
    [
      "unadmitted namespace year",
      (value) =>
        patchMetadataRow(value, {
          concept: {
            ...value.observations[0]!.concept,
            namespace: "http://xbrl.sec.gov/dei/2023",
          },
        }),
    ],
    [
      "raw concept spoof",
      (value) =>
        patchMetadataRow(value, {
          concept: {
            ...value.observations[0]!.concept,
            raw: "dei:DifferentName",
          },
        }),
    ],
    [
      "mis-cased concept claimed supported",
      (value) =>
        patchMetadataRow(value, {
          concept: {
            ...value.observations[0]!.concept,
            raw: "dei:documenttype",
            localName: "documenttype",
          },
        }),
    ],
    [
      "invalid raw QName",
      (value) =>
        patchMetadataRow(value, {
          concept: {
            ...value.observations[0]!.concept,
            raw: "dei:extra:DocumentType",
          },
        }),
    ],
    [
      "same issuer called mismatch",
      (value) =>
        patchMetadataRow(value, {
          rawText: "10-Q/A",
          value: "10-Q/A",
          issues: ["entity_mismatch"],
        }),
    ],
    [
      "unresolved issuer called mismatch",
      (value) =>
        patchMetadataRow(value, {
          entityIdentifier: null,
          entityCik: null,
          issues: ["entity_mismatch"],
        }),
    ],
    [
      "mismatch with uncertain scope",
      (value) =>
        patchMetadataRow(value, {
          entityIdentifier: "2",
          entityCik: "0000000002",
          issues: ["entity_mismatch", "malformed_context"],
        }),
    ],
    [
      "instant metadata treated as duration",
      (value) =>
        patchMetadataRow(value, { periodKind: "instant", startDate: null }),
    ],
    [
      "reversed metadata duration",
      (value) => patchMetadataRow(value, { startDate: "2026-07-01" }),
    ],
    [
      "missing context ID",
      (value) => patchMetadataRow(value, { contextId: null }),
    ],
    [
      "claimed supported transform",
      (value) =>
        patchMetadataRow(value, {
          format: {
            raw: "ixt:date",
            namespace: "transform",
            localName: "date",
          },
        }),
    ],
    [
      "non-XML whitespace normalization",
      (value) => patchMetadataRow(value, { rawText: "\u00a010-Q\u00a0" }),
    ],
    [
      "unsupported fiscal token",
      (value) => ({
        ...value,
        fields: value.fields.map((field, i) =>
          i === 3 ? { ...field, value: "Q4" } : field,
        ),
        observations: value.observations.map((row, i) =>
          i === 3 ? { ...row, value: "Q4", rawText: "Q4" } : row,
        ),
      }),
    ],
    [
      "invalid declared date",
      (value) => ({
        ...value,
        fields: value.fields.map((field, i) =>
          i === 1 ? { ...field, value: "2026-02-30" } : field,
        ),
        observations: value.observations.map((row, i) =>
          i === 1
            ? { ...row, value: "2026-02-30", rawText: "2026-02-30" }
            : row,
        ),
      }),
    ],
    [
      "numeric locator reused",
      (value) => patchMetadataRow(value, { locator: "/elements/1" }),
    ],
    [
      "duplicate metadata locator",
      (value) => ({
        ...value,
        observations: [...value.observations, value.observations[0]!],
      }),
    ],
    [
      "metadata prefix after limit",
      (value) => ({ ...value, status: "limited", reason: "candidate_limit" }),
    ],
    ["unrelated metadata unavailability", () => unavailableMetadata()],
    [
      "too many references",
      (value) => ({
        ...value,
        observations: Array.from({ length: 41 }, (_, i) => ({
          ...value.observations[0]!,
          locator: `/elements/${200 + i}`,
        })),
      }),
    ],
    [
      "metadata byte budget exceeded",
      (value) => ({
        ...value,
        observations: Array.from({ length: 40 }, (_, i) => ({
          ...value.observations[0]!,
          locator: `/elements/${200 + i}`,
          rawText: "a".repeat(4096),
          value: null,
          issues: ["invalid_metadata_value"],
        })),
      }),
    ],
  ] satisfies readonly (readonly [
    string,
    (value: PersonalSecFilingReportingMetadataDto) => unknown,
  ])[])("rejects forged or unbounded metadata: %s", async (_, mutate) => {
    fetchMock.mockResolvedValue(
      json(withMetadata(mutate(reportingMetadata()))),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("rejects old request, response and parser versions", async () => {
    await expect(
      fetchPersonalSecFilingContext(
        {
          ...request(),
          schemaVersion: "1.0.0",
        } as unknown as PersonalSecFilingContextRequestDto,
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(
      json({ ...response(), schemaVersion: "1.0.0" }),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
    const value = response();
    if (value.inspection.status !== "available") throw new Error();
    fetchMock.mockResolvedValueOnce(
      json({
        ...value,
        inspection: {
          ...value.inspection,
          analysis: { ...value.inspection.analysis, schemaVersion: "1.0.0" },
        },
      }),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
});

function withMetadata(metadata: unknown) {
  const value = response();
  if (value.inspection.status !== "available") throw new Error();
  return {
    ...value,
    inspection: {
      ...value.inspection,
      analysis: { ...value.inspection.analysis, reportingMetadata: metadata },
    },
  };
}
function patchMetadataRow(
  value: PersonalSecFilingReportingMetadataDto,
  patch: Partial<PersonalSecFilingReportingObservationDto>,
) {
  return {
    ...value,
    observations: value.observations.map((row, index) =>
      index === 0 ? { ...row, ...patch } : row,
    ),
  };
}

describe("filing-context browser decoder", () => {
  it("sends only the URL-free selection through authenticated POST and freezes exact evidence", async () => {
    fetchMock.mockResolvedValue(json(response()));
    const controller = new AbortController();
    const result = await fetchPersonalSecFilingContext(
      request(),
      controller.signal,
    );
    expect(result).toEqual(response());
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL(
        "http://127.0.0.1:3100/v1/personal-filing/workspace/sec-filing-context",
      ),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request()),
        signal: controller.signal,
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
      }),
    );
    expect(request().selection).not.toHaveProperty("filing");
    expect(request().selection).not.toHaveProperty("sourceLocator");
    if (result.inspection.status !== "available") throw new Error();
    expect(result.inspection.analysis.candidates[0]?.value).toBe(
      "12345678901234567890.12",
    );
    expect(
      Object.isFrozen(result.inspection.analysis.candidates[0]?.concept),
    ).toBe(true);
    expect(Object.isFrozen(result.inspection.observation.filing)).toBe(true);
  });
  it.each([
    "value_differs",
    "ambiguous",
    "unsupported",
    "no_corresponding_fact",
  ] as const)("accepts honest %s outcomes", async (status) => {
    const base = response();
    if (base.inspection.status !== "available") throw new Error();
    let candidates: PersonalSecFilingContextCandidateDto[] = [candidate()];
    let locators = ["/elements/1"];
    if (status === "value_differs")
      candidates = [{ ...candidate(), value: "12345678901234567890.13" }];
    if (status === "ambiguous") {
      candidates.push({
        ...candidate(),
        locator: "/elements/2",
        value: "-12.5",
      });
      locators.push("/elements/2");
    }
    if (status === "unsupported") {
      candidates = [
        { ...candidate(), unit: null, issues: ["unsupported_unit"] },
      ];
      locators = [];
    }
    if (status === "no_corresponding_fact") {
      candidates = [
        {
          ...candidate(),
          entityCik: "0000000002",
          issues: ["entity_mismatch"],
        },
      ];
      locators = [];
    }
    const value = {
      ...base,
      inspection: {
        ...base.inspection,
        analysis: {
          schemaVersion: "2.0.0",
          reportingMetadata: reportingMetadata(),
          status,
          reason: status === "unsupported" ? "unsupported_unit" : null,
          candidates,
          correspondingCandidateLocators: locators,
        },
      },
    };
    fetchMock.mockResolvedValue(json(value));
    expect(await fetchPersonalSecFilingContext(request(), signal())).toEqual(
      value,
    );
  });
  it("preserves bounded unsupported raw provenance and gives no partial prefix for a global failure", async () => {
    const base = response();
    if (base.inspection.status !== "available") throw new Error();
    const unsupported = {
      ...candidate(),
      concept: { raw: "", namespace: null, localName: null },
      value: null,
      rawText: "\n  \t12.5\r\n",
      issues: ["invalid_namespace"],
    };
    fetchMock.mockResolvedValueOnce(
      json({
        ...base,
        inspection: {
          ...base.inspection,
          analysis: {
            schemaVersion: "2.0.0",
            reportingMetadata: reportingMetadata(),
            status: "unsupported",
            reason: "invalid_namespace",
            candidates: [unsupported],
            correspondingCandidateLocators: [],
          },
        },
      }),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).resolves.toMatchObject({
      inspection: { analysis: { candidates: [unsupported] } },
    });
    fetchMock.mockResolvedValueOnce(
      json({
        ...base,
        inspection: {
          ...base.inspection,
          analysis: {
            schemaVersion: "2.0.0",
            reportingMetadata: unavailableMetadata(),
            status: "unsupported",
            reason: "candidate_limit",
            candidates: [],
            correspondingCandidateLocators: [],
          },
        },
      }),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).resolves.toMatchObject({
      inspection: { analysis: { reason: "candidate_limit", candidates: [] } },
    });
  });
  it.each([
    "selection_changed_or_not_retained",
    "submission_metadata_conflict",
    "parser_timeout",
    "runtime_unavailable",
  ] as const)("retains the %s unavailable explanation", async (reason) => {
    const value = {
      ...response(),
      inspection: {
        status: "unavailable",
        cik: "0000000001",
        stage:
          reason === "selection_changed_or_not_retained"
            ? "company_facts"
            : reason === "submission_metadata_conflict"
              ? "submissions"
              : "parser",
        reason,
      },
    };
    fetchMock.mockResolvedValue(json(value));
    expect(await fetchPersonalSecFilingContext(request(), signal())).toEqual(
      value,
    );
  });
  it.each([
    { ...request(), sourceUrl: "https://evil.invalid" },
    { ...request(), schemaVersion: "2" },
    { ...request(), selection: { ...request().selection, filing: {} } },
    { ...request(), selection: { ...request().selection, startDate: null } },
    { ...request(), selection: { ...request().selection, form: "10-K" } },
    { ...request(), selection: { ...request().selection, value: "1.0" } },
    { ...request(), selection: { ...request().selection, value: "-0" } },
    {
      ...request(),
      selection: { ...request().selection, metric: "net_income" },
    },
  ])(
    "rejects malformed or broadened request %# before network",
    async (input) => {
      await expect(
        fetchPersonalSecFilingContext(
          input as PersonalSecFilingContextRequestDto,
          signal(),
        ),
      ).rejects.toMatchObject({ code: "invalid_request" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it.each([
    [
      "catalog",
      (value: Record<string, unknown>) => {
        value.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
      },
    ],
    [
      "issuer binding",
      (value: Record<string, unknown>) => {
        (value.inspection as Record<string, unknown>).cik = "0000000002";
      },
    ],
    [
      "extra wrapper fields",
      (value: Record<string, unknown>) => {
        value.token = "private";
      },
    ],
    [
      "selected value",
      (value: Record<string, unknown>) => {
        (
          (value.inspection as Record<string, unknown>).observation as Record<
            string,
            unknown
          >
        ).value = "1";
      },
    ],
    [
      "document host",
      (value: Record<string, unknown>) => {
        (
          (value.inspection as Record<string, unknown>).document as Record<
            string,
            unknown
          >
        ).sourceUrl = "https://evil.invalid/file.htm";
      },
    ],
    [
      "document traversal",
      (value: Record<string, unknown>) => {
        (
          (value.inspection as Record<string, unknown>).document as Record<
            string,
            unknown
          >
        ).sourceUrl =
          "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/../file.htm";
      },
    ],
    [
      "document bytes",
      (value: Record<string, unknown>) => {
        (
          (value.inspection as Record<string, unknown>).document as Record<
            string,
            unknown
          >
        ).bytes = 33_554_433;
      },
    ],
    [
      "invalid date",
      (value: Record<string, unknown>) => {
        (
          (value.inspection as Record<string, unknown>).document as Record<
            string,
            unknown
          >
        ).fetchedAt = "2026-02-30T10:00:00.000Z";
      },
    ],
  ] as const)("rejects invalid %s", async (_name, mutate) => {
    const value = structuredClone(response()) as unknown as Record<
      string,
      unknown
    >;
    mutate(value);
    fetchMock.mockResolvedValue(json(value));
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([
    { locator: "/elements/0" },
    { locator: "/elements/1000001" },
    { contextId: null },
    { contextId: "bad:id" },
    { unitId: "" },
    { factId: "bad id" },
    { value: "12345678901234567890.13" },
    { value: "1.00" },
    { entityCik: "0000000002" },
    { entityScheme: "https://evil.invalid" },
    {
      concept: {
        raw: "us-gaap:Revenues",
        namespace: "https://evil.invalid",
        localName: "Revenues",
      },
    },
    {
      concept: {
        ...candidate().concept,
        namespace: "http://fasb.org/us-gaap/3000",
      },
    },
    {
      concept: {
        ...candidate().concept,
        namespace: "http://fasb.org/us-gaap/2026-02-30",
      },
    },
    { rawText: "\u0000" },
    { rawText: "x".repeat(4097) },
    { issues: ["made_up"] },
    {
      unitMeasures: Array.from(
        { length: 33 },
        () => candidate().unitMeasures[0],
      ),
    },
  ])("rejects invalid or falsely matching candidate %#", async (patch) => {
    const value = response();
    if (value.inspection.status !== "available") throw new Error();
    fetchMock.mockResolvedValue(
      json({
        ...value,
        inspection: {
          ...value.inspection,
          analysis: {
            ...value.inspection.analysis,
            candidates: [{ ...candidate(), ...patch }],
          },
        },
      }),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([
    {
      status: "matched",
      reason: null,
      candidates: [],
      correspondingCandidateLocators: [],
    },
    {
      status: "matched",
      reason: "node_limit",
      candidates: [candidate()],
      correspondingCandidateLocators: ["/elements/1"],
    },
    {
      status: "matched",
      reason: null,
      candidates: [candidate()],
      correspondingCandidateLocators: [],
    },
    {
      status: "matched",
      reason: null,
      candidates: [candidate(), candidate()],
      correspondingCandidateLocators: ["/elements/1"],
    },
    {
      status: "matched",
      reason: null,
      candidates: [{ ...candidate(), locator: "/elements/2" }, candidate()],
      correspondingCandidateLocators: ["/elements/2", "/elements/1"],
    },
    {
      status: "matched",
      reason: null,
      candidates: Array.from({ length: 101 }, (_, index) => ({
        ...candidate(),
        locator: `/elements/${index + 1}`,
      })),
      correspondingCandidateLocators: [],
    },
  ])("rejects inconsistent analysis %#", async (analysis) => {
    const base = response();
    fetchMock.mockResolvedValue(
      json({ ...base, inspection: { ...base.inspection, analysis } }),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([
    [403, "session_unavailable"],
    [409, "conflict"],
    [429, "rate_limited"],
    [502, "provider_unavailable"],
    [503, "not_configured"],
  ] as const)(
    "maps HTTP %s without leaking response text",
    async (status, code) => {
      fetchMock.mockResolvedValue(
        json({ code: "not_configured", private: "sensitive" }, status),
      );
      await expect(
        fetchPersonalSecFilingContext(request(), signal()),
      ).rejects.toMatchObject({ code });
    },
  );
  it("rejects oversized and invalid UTF-8 responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(" ".repeat(2 * 1024 * 1024 + 1)),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([0xc3, 0x28])));
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("does not request after abort and cancels an in-flight response reader", async () => {
    const first = new AbortController();
    first.abort();
    await expect(
      fetchPersonalSecFilingContext(request(), first.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ cancel })));
    const second = new AbortController();
    const pending = fetchPersonalSecFilingContext(request(), second.signal);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    second.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalled();
  });
});

function signal() {
  return new AbortController().signal;
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function request(): PersonalSecFilingContextRequestDto {
  return {
    schemaVersion: "2.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    listingId: "lst-zero",
    symbol: "ZERO",
    selection: selectPersonalSecFilingContextObservation(observation()),
  };
}
function observation(): PersonalSecQuarterlyObservationDto {
  return {
    id: `sec-fact:${"1".repeat(64)}`,
    metric: "revenue",
    taxonomy: "us-gaap",
    concept: "Revenues",
    unit: "USD",
    value: "12345678901234567890.12",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    durationDays: 91,
    periodBasis: "unresolved",
    filingFocusYear: 2026,
    filingFocusPeriod: "Q2",
    frame: "CY2026Q2",
    accessionNumber: "0000000001-26-000001",
    form: "10-Q",
    filedDate: "2026-08-01",
    sourceLocator: "/facts/us-gaap/Revenues/units/USD/0",
    filing: {
      status: "matched",
      form: "10-Q",
      filedDate: "2026-08-01",
      reportDate: "2026-06-30",
      acceptedAt: "2026-08-01T20:00:00Z",
      sourceUrl:
        "https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm",
    },
  };
}
function candidate(): PersonalSecFilingContextCandidateDto {
  return {
    locator: "/elements/1",
    factId: "revenue",
    contextId: "duration",
    unitId: "USD",
    concept: {
      raw: "us-gaap:Revenues",
      namespace: "http://fasb.org/us-gaap/2026",
      localName: "Revenues",
    },
    entityIdentifier: "0000000001",
    entityScheme: "http://www.sec.gov/CIK",
    entityCik: "0000000001",
    dimensions: [],
    periodKind: "duration",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    unit: "USD",
    unitMeasures: [
      {
        raw: "iso4217:USD",
        namespace: "http://www.xbrl.org/2003/iso4217",
        localName: "USD",
      },
    ],
    rawText: "12345678901234567890.12",
    format: null,
    sign: null,
    scale: null,
    decimals: "2",
    precision: null,
    value: "12345678901234567890.12",
    issues: [],
  };
}
function response(): PersonalSecFilingContextResponseDto {
  return {
    schemaVersion: "2.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "Zero Alpha Common Stock",
      symbol: "ZERO",
      cik: "0000000001",
    },
    inspection: {
      status: "available",
      cik: "0000000001",
      observation: observation(),
      companyFacts: {
        sourceUrl:
          "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
        fetchedAt: "2026-09-10T10:00:00.000Z",
      },
      submissions: {
        sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
        fetchedAt: "2026-09-10T10:00:00.000Z",
      },
      document: {
        sourceUrl:
          "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/filing.htm",
        fetchedAt: "2026-09-10T10:00:00.000Z",
        sha256: `sha256:${"d".repeat(64)}`,
        bytes: 1000,
      },
      analysis: {
        schemaVersion: "2.0.0",
        reportingMetadata: reportingMetadata(),
        status: "matched",
        reason: null,
        candidates: [candidate()],
        correspondingCandidateLocators: ["/elements/1"],
      },
    },
  };
}

function reportingMetadata(): PersonalSecFilingReportingMetadataDto {
  const empty = createEmptyPersonalSecFilingReportingMetadata();
  const values = ["10-Q", "2026-06-30", "2026", "Q2"];
  const observations: PersonalSecFilingReportingObservationDto[] =
    empty.fields.map((field, index) => ({
      locator: `/elements/${200 + index}`,
      factId: `dei-${index}`,
      contextId: "reporting-duration",
      concept: {
        raw: `dei:${field.concept}`,
        namespace: "http://xbrl.sec.gov/dei/2026",
        localName: field.concept,
      },
      entityIdentifier: "0000000001",
      entityScheme: "http://www.sec.gov/CIK",
      entityCik: "0000000001",
      dimensions: [],
      periodKind: "duration",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      rawText: values[index]!,
      format: null,
      value: values[index]!,
      issues: [],
    }));
  return {
    ...empty,
    fields: empty.fields.map((field, index) => ({
      ...field,
      status: "observed",
      value: values[index]!,
      observationLocators: [observations[index]!.locator],
    })),
    observations,
  };
}
function transformedDateMetadata(
  patch: Partial<PersonalSecFilingReportingObservationDto> = {},
): PersonalSecFilingReportingMetadataDto {
  const base = reportingMetadata();
  const row = {
    ...base.observations[1]!,
    rawText: "June 30, 2026",
    format: reportDateFormat,
    ...patch,
  };
  return {
    ...base,
    observations: base.observations.map((original, index) =>
      index === 1 ? row : original,
    ),
    fields: base.fields.map((field, index) =>
      index === 1 ? { ...field, value: row.value } : field,
    ),
  };
}
function unavailableMetadata(): PersonalSecFilingReportingMetadataDto {
  const empty = createEmptyPersonalSecFilingReportingMetadata();
  return {
    ...empty,
    status: "unavailable",
    reason: "candidate_limit",
    fields: empty.fields.map((field) => ({ ...field, status: "unsupported" })),
  };
}
