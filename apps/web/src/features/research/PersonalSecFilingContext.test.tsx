import { createEmptyPersonalSecFilingReportingMetadata } from "@research-cockpit/contracts";
import type {
  PersonalSecFilingContextCandidateDto,
  PersonalSecFilingContextIssue,
  PersonalSecFilingContextResponseDto,
  PersonalSecQuarterlyObservationDto,
  PersonalSecFilingReportingMetadataDto,
  PersonalSecFilingReportingObservationDto,
} from "@research-cockpit/contracts";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import {
  PersonalSecFilingContext,
  type PersonalSecFilingContextProps,
} from "./PersonalSecFilingContext";

const api = vi.hoisted(() => ({ fetchPersonalSecFilingContext: vi.fn() }));
vi.mock("../../lib/personal-sec-filing-context-api", async (original) => ({
  ...(await original()),
  ...api,
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => harness.useState(initial),
  useRef: <T,>(initial: T) => harness.useRef(initial),
  useEffect: (
    effect: () => (() => void) | void,
    deps: readonly unknown[] | undefined,
  ) => harness.useEffect(effect, deps),
}));
let props: PersonalSecFilingContextProps;
beforeEach(() => {
  harness.reset();
  api.fetchPersonalSecFilingContext.mockReset().mockResolvedValue(response());
  props = {
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    selection: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "Zero Alpha Common Stock",
      symbol: "ZERO",
    },
    observation: observation(),
    responseGeneration: 1,
    requestToken: 1,
    enabled: true,
    onSessionUnavailable: vi.fn(),
    onClose: vi.fn(),
  };
});
afterEach(() => harness.unmount());

describe("PersonalSecFilingContext", () => {
  it("shows all four declared fields and references separately from the actual fact period", async () => {
    render();
    await flush();
    const view = render();
    expect(text(view)).toContain("Filing-declared reporting metadata");
    for (const label of [
      "DocumentType",
      "DocumentPeriodEndDate",
      "DocumentFiscalYearFocus",
      "DocumentFiscalPeriodFocus",
    ])
      expect(text(view)).toContain(`Inspect 1 reference for ${label}`);
    expect(text(view)).toContain("91 days, inclusive");
    expect(text(view)).toContain(
      "Metadata context period duration · 2026-01-01 to 2026-06-30",
    );
    expect(text(view)).toContain(
      "Actual source period 2026-04-01 to 2026-06-30",
    );
    expect(text(view)).toContain("http://xbrl.sec.gov/dei/2026");
    expect(text(view)).toContain(
      "They do not assign fiscal labels to the selected fact",
    );
    expect(text(view)).toContain("report date agree: 2026-06-30");
    expect(
      elements(view).filter((element) => element.type === "details").length,
    ).toBeGreaterThanOrEqual(6);
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
  });
  it.each([
    ["2026-06-30", "report date agree: 2026-06-30"],
    [
      "2026-07-01",
      "current Submissions reports 2026-07-01. These dates differ",
    ],
  ])(
    "shows a normalized date and original transformation provenance beside Submissions %s",
    async (reportDate, comparison) => {
      const base = response();
      if (base.inspection.status !== "available") throw new Error();
      const metadata = reportingMetadata();
      const transformed = {
        ...metadata,
        observations: metadata.observations.map((row, index) =>
          index === 1
            ? {
                ...row,
                rawText: "June 30, 2026",
                format: {
                  raw: "ixt:date-monthname-day-year-en",
                  namespace:
                    "http://www.xbrl.org/inlineXBRL/transformation/2020-02-12",
                  localName: "date-monthname-day-year-en",
                },
              }
            : row,
        ),
      };
      api.fetchPersonalSecFilingContext.mockResolvedValue({
        ...base,
        inspection: {
          ...base.inspection,
          observation: {
            ...base.inspection.observation,
            filing: { ...base.inspection.observation.filing, reportDate },
          },
          analysis: {
            ...base.inspection.analysis,
            reportingMetadata: transformed,
          },
        },
      });
      render();
      await flush();
      const view = text(render());
      expect(view).toContain("DocumentPeriodEndDate 2026-06-30 Observed");
      expect(view).toContain("Raw metadata text June 30, 2026");
      expect(view).toContain("Format attribute ixt:date-monthname-day-year-en");
      expect(view).toContain(
        "http://www.xbrl.org/inlineXBRL/transformation/2020-02-12",
      );
      expect(view).toContain("Normalized reference value 2026-06-30");
      expect(view).toContain("/elements/201 / dei-1 / reporting-duration");
      expect(view).toContain(
        "Actual source period 2026-04-01 to 2026-06-30 91 days, inclusive",
      );
      expect(view).toContain(comparison);
      expect(view).toContain("Exact value correspondence found");
      expect(view).toContain("TTM remains unavailable");
      expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
    },
  );
  it.each([
    ["2026-07-01", "2026-09-30", 92],
    ["2026-01-01", "2026-09-30", 273],
    ["2025-07-01", "2025-09-30", 92],
  ] as const)(
    "keeps Q3 filing labels separate from selected period %s through %s",
    async (startDate, endDate, durationDays) => {
      const base = response();
      if (base.inspection.status !== "available") throw new Error();
      const declared = reportingMetadata();
      const metadata = {
        ...declared,
        fields: declared.fields.map((field) =>
          field.concept === "DocumentFiscalPeriodFocus"
            ? { ...field, value: "Q3" }
            : field,
        ),
        observations: declared.observations.map((row) =>
          row.concept.localName === "DocumentFiscalPeriodFocus"
            ? { ...row, value: "Q3", rawText: "Q3" }
            : row,
        ),
      };
      const selected = { ...observation(), startDate, endDate, durationDays };
      props = { ...props, observation: selected };
      api.fetchPersonalSecFilingContext.mockResolvedValue({
        ...base,
        inspection: {
          ...base.inspection,
          observation: selected,
          analysis: {
            ...base.inspection.analysis,
            reportingMetadata: metadata,
          },
        },
      });
      render();
      await flush();
      const view = text(render());
      expect(view).toContain(
        `Actual source period ${startDate} to ${endDate} ${durationDays} days, inclusive`,
      );
      expect(view).toContain("DocumentFiscalPeriodFocus Q3");
      expect(view).toContain(
        "Comparative and longer-duration facts can appear in the same filing",
      );
      expect(view).toContain("TTM remains unavailable");
    },
  );
  it.each([null, "2026-09-30"])(
    "compares the declared end with refreshed Submissions reportDate %s",
    async (reportDate) => {
      const base = response();
      if (base.inspection.status !== "available") throw new Error();
      props = {
        ...props,
        observation: {
          ...observation(),
          filing: { ...observation().filing, reportDate: "2025-01-01" },
        },
      };
      api.fetchPersonalSecFilingContext.mockResolvedValue({
        ...base,
        inspection: {
          ...base.inspection,
          observation: {
            ...base.inspection.observation,
            filing: { ...base.inspection.observation.filing, reportDate },
          },
        },
      });
      render();
      await flush();
      const view = text(render());
      expect(view).toContain(
        reportDate === null
          ? "current Submissions does not supply a report date"
          : "current Submissions reports 2026-09-30. These dates differ",
      );
      expect(view).not.toContain("2025-01-01");
    },
  );
  it.each(["missing", "conflicting", "unsupported"] as const)(
    "shows %s field values without choosing or inferring a report end",
    async (status) => {
      const base = response();
      if (base.inspection.status !== "available") throw new Error();
      const metadata = reportingMetadata();
      const next = {
        ...metadata,
        fields: metadata.fields.map((field) => ({
          ...field,
          status,
          value: null,
        })),
      };
      api.fetchPersonalSecFilingContext.mockResolvedValue({
        ...base,
        inspection: {
          ...base.inspection,
          analysis: { ...base.inspection.analysis, reportingMetadata: next },
        },
      });
      render();
      await flush();
      const view = text(render());
      expect(view).toContain(
        status === "missing"
          ? "No supported same-issuer value"
          : status === "conflicting"
            ? "Conflicting reported values"
            : "Value unresolved",
      );
      expect(view).toContain("The filing-declared period end is unresolved");
      expect(view).toContain("No agreement is established");
      expect(view).toContain("Exact value correspondence found");
    },
  );
  it("keeps metadata uncertainty references as text in native details", async () => {
    const base = response();
    if (base.inspection.status !== "available") throw new Error();
    const metadata = reportingMetadata();
    const original = metadata.observations[0]!;
    const row: PersonalSecFilingReportingObservationDto = {
      ...original,
      locator: "/elements/204",
      rawText: "<script>private()</script>",
      value: null,
      issues: ["unsupported_inline"],
    };
    const next = {
      ...metadata,
      fields: metadata.fields.map((field, index) =>
        index === 0
          ? {
              ...field,
              status: "unsupported",
              value: null,
              observationLocators: [...field.observationLocators, row.locator],
            }
          : field,
      ),
      observations: [...metadata.observations, row],
    };
    api.fetchPersonalSecFilingContext.mockResolvedValue({
      ...base,
      inspection: {
        ...base.inspection,
        analysis: { ...base.inspection.analysis, reportingMetadata: next },
      },
    });
    render();
    await flush();
    const view = render();
    expect(text(view)).toContain("Inspect 2 references for DocumentType");
    expect(text(view)).toContain("<script>private()</script>");
    expect(text(view)).toContain("unsupported inline");
    expect(
      elements(view).some(
        (element) =>
          element.type === "script" ||
          element.props.dangerouslySetInnerHTML !== undefined,
      ),
    ).toBe(false);
  });
  it("retains numeric correspondence when only metadata is limited", async () => {
    const base = response();
    if (base.inspection.status !== "available") throw new Error();
    api.fetchPersonalSecFilingContext.mockResolvedValue({
      ...base,
      inspection: {
        ...base.inspection,
        analysis: {
          ...base.inspection.analysis,
          reportingMetadata: { ...unavailableMetadata(), status: "limited" },
        },
      },
    });
    render();
    await flush();
    const view = text(render());
    expect(view).toContain(
      "Reporting metadata reached a separate extraction limit",
    );
    expect(view).toContain("Exact value correspondence found");
    expect(view).not.toContain("Inspect 1 reference for DocumentType");
  });
  it.each(["observation", "catalog", "session", "source generation"])(
    "clears loaded metadata immediately when %s changes",
    async (kind) => {
      render();
      await flush();
      expect(text(render())).toContain("Filing-declared reporting metadata");
      if (kind === "observation")
        props = { ...props, observation: { ...observation(), value: "50" } };
      if (kind === "catalog")
        props = { ...props, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` };
      if (kind === "session") props = { ...props, enabled: false };
      if (kind === "source generation")
        props = { ...props, responseGeneration: 2 };
      expect(text(render(false))).not.toContain(
        "Filing-declared reporting metadata",
      );
      harness.effects();
      await flush();
      expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
    },
  );
  it("dispatches the deliberate inspection once after StrictMode replay and retains exact provenance", async () => {
    render();
    expect(api.fetchPersonalSecFilingContext).not.toHaveBeenCalled();
    harness.strictReplay();
    await flush();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
    const view = render();
    expect(text(view)).toContain("Exact value correspondence found");
    expect(text(view)).toContain("12345678901234567890.12");
    expect(text(view)).toContain("Revalidated source observation");
    expect(text(view)).toContain("2026-04-01 to 2026-06-30");
    expect(text(view)).toContain("http://www.sec.gov/CIK");
    expect(text(view)).toContain("/elements/1");
    expect(text(view)).toContain("Raw numeric text");
    expect(text(view)).toContain("TTM remains unavailable");
    expect(text(view)).toContain("does not establish standalone-quarter");
    expect(
      elements(view).some(
        (element) => element.props.dangerouslySetInnerHTML !== undefined,
      ),
    ).toBe(false);
    expect(
      elements(view).find((element) => element.type === "a")?.props,
    ).toMatchObject({
      href: "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/filing.htm",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    render();
    await flush();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
  });
  it("focuses the inspector heading and cancels before invoking close", async () => {
    const pending = deferred<PersonalSecFilingContextResponseDto>();
    api.fetchPersonalSecFilingContext.mockReturnValue(pending.promise);
    const view = render(false);
    const focus = vi.fn();
    const title = elements(view).find((element) => element.type === "h3");
    expect(title?.props.tabIndex).toBe(-1);
    (title?.props.ref as { current: unknown }).current = { focus };
    harness.effects();
    await flush();
    expect(focus).toHaveBeenCalledOnce();
    const signal = api.fetchPersonalSecFilingContext.mock
      .calls[0]?.[1] as AbortSignal;
    click(render(), "Close filing inspection");
    expect(signal.aborted).toBe(true);
    expect(props.onClose).toHaveBeenCalledOnce();
    pending.resolve(response());
    await flush();
    expect(text(render())).not.toContain("Exact value correspondence found");
  });
  it.each(["disabled", "unmatched", "unknown start", "annual form"])(
    "does not acquire an ineligible %s selection",
    async (kind) => {
      if (kind === "disabled") props = { ...props, enabled: false };
      if (kind === "unmatched")
        props = {
          ...props,
          observation: {
            ...observation(),
            filing: { ...observation().filing, status: "metadata_conflict" },
          },
        };
      if (kind === "unknown start")
        props = {
          ...props,
          observation: { ...observation(), startDate: null },
        };
      if (kind === "annual form")
        props = { ...props, observation: { ...observation(), form: "10-K" } };
      render();
      await flush();
      expect(api.fetchPersonalSecFilingContext).not.toHaveBeenCalled();
    },
  );
  it("paginates candidates without requests and keeps selected source fields visible", async () => {
    const base = response();
    if (base.inspection.status !== "available") throw new Error();
    const candidates = Array.from({ length: 12 }, (_, index) => ({
      ...candidate(),
      locator: `/elements/${index + 1}`,
    }));
    api.fetchPersonalSecFilingContext.mockResolvedValue({
      ...base,
      inspection: {
        ...base.inspection,
        analysis: {
          ...base.inspection.analysis,
          candidates,
          correspondingCandidateLocators: candidates.map((row) => row.locator),
        },
      },
    });
    render();
    await flush();
    expect(text(render())).toContain("1 – 10 of 12 filing candidates");
    click(render(), "Next filing candidates");
    expect(text(render())).toContain("11 – 12 of 12 filing candidates");
    expect(text(render())).toContain(
      "Selected exact value (USD) 12345678901234567890.12",
    );
    expect(button(render(), "Next filing candidates").props.disabled).toBe(
      true,
    );
    click(render(), "Previous filing candidates");
    expect(text(render())).toContain("1 – 10 of 12 filing candidates");
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
  });
  it.each([
    ["value_differs", "Corresponding filing value differs"],
    ["ambiguous", "Conflicting corresponding values"],
    ["no_corresponding_fact", "No corresponding fact found"],
    ["unsupported", "Correspondence could not be established"],
  ] as const)(
    "explains %s without promoting a usable value",
    async (status, expected) => {
      const base = response();
      if (base.inspection.status !== "available") throw new Error();
      api.fetchPersonalSecFilingContext.mockResolvedValue({
        ...base,
        inspection: {
          ...base.inspection,
          analysis: {
            schemaVersion: "2.0.0",
            reportingMetadata: reportingMetadata(),
            status,
            reason: status === "unsupported" ? "unsupported_dimensions" : null,
            candidates: [
              {
                ...candidate(),
                value: "-12.5",
                dimensions: [
                  {
                    kind: "typed",
                    dimension: {
                      raw: "custom:Scope",
                      namespace: "https://example.invalid",
                      localName: "Scope",
                    },
                    member: null,
                    typedText: "<script>never execute</script>",
                  },
                ],
                issues: ["unsupported_dimensions"],
              },
            ],
            correspondingCandidateLocators: [],
          },
        },
      });
      render();
      await flush();
      const view = render();
      expect(text(view)).toContain(expected);
      expect(text(view)).toContain("-12.5");
      expect(text(view)).toContain("unsupported dimensions");
      expect(text(view)).toContain("<script>never execute</script>");
      expect(elements(view).some((element) => element.type === "script")).toBe(
        false,
      );
      if (status === "unsupported")
        expect(text(view)).toContain(
          "a clean candidate cannot establish a match",
        );
    },
  );
  it("groups complete blocking issue sets and preserves observed scope identifiers", async () => {
    const first = scopeCandidate(
      2,
      ["unsupported_dimensions", "unsupported_unit"],
      "explicit",
    );
    const second = scopeCandidate(
      3,
      ["unsupported_unit", "unsupported_dimensions"],
      "explicit",
    );
    const third = scopeCandidate(4, ["unsupported_dimensions"], "typed");
    api.fetchPersonalSecFilingContext.mockResolvedValue(
      scopeResponse([first, second, third]),
    );
    render();
    await flush();
    const view = render();
    expect(text(view)).toContain("Why this value remains unresolved");
    expect(
      text(view).indexOf("Correspondence could not be established"),
    ).toBeLessThan(text(view).indexOf("Why this value remains unresolved"));
    expect(
      text(view).indexOf("Why this value remains unresolved"),
    ).toBeLessThan(text(view).indexOf("Filing-declared reporting metadata"));
    expect(text(view)).toContain(
      "3 retained references prevent a supported comparison",
    );
    expect(text(view)).toContain("1 corresponding reference is also retained");
    expect(text(view)).toContain(
      "Context scope is outside the supported comparison; Unit is outside the supported USD form · Explicit dimensions retained: custom:ScopeAxis → custom:Member · 2 references",
    );
    expect(text(view)).toContain(
      "custom:ScopeAxis · urn:scope:test · ScopeAxis",
    );
    expect(text(view)).toContain("custom:Member · urn:scope:test · Member");
    expect(text(view)).toContain(
      "Typed member interpretation remains unsupported",
    );
    for (const number of [2, 3, 4])
      expect(
        button(view, `Inspect reference /elements/${number}`),
      ).toBeDefined();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
  });
  it("keeps different retained dimension members in separate reason groups", async () => {
    const first = scopeCandidate(2, ["unsupported_dimensions"], "explicit");
    const second = scopeCandidate(3, ["unsupported_dimensions"], "explicit");
    const third = scopeCandidate(4, ["unsupported_dimensions"], "explicit");
    const dimension = second.dimensions[0];
    if (dimension === undefined || dimension.member === null) throw new Error();
    api.fetchPersonalSecFilingContext.mockResolvedValue(
      scopeResponse([
        first,
        {
          ...second,
          dimensions: [{ ...dimension, member: null }],
        },
        {
          ...third,
          dimensions: [
            {
              ...dimension,
              member: { ...dimension.member, namespace: "urn:scope:other" },
            },
          ],
        },
      ]),
    );
    render();
    await flush();
    const view = render();
    const groups = elements(view).filter(
      (element) =>
        element.type === "summary" &&
        text(element).includes("Explicit dimensions retained"),
    );
    expect(groups).toHaveLength(3);
    expect(new Set(groups.map(text)).size).toBe(3);
    expect(text(groups[0])).toContain("custom:ScopeAxis → custom:Member");
    expect(text(groups[1])).toContain("custom:ScopeAxis → Unresolved member");
    expect(text(groups[0])).toContain("First reference /elements/2");
    expect(text(groups[2])).toContain("First reference /elements/4");
    expect(groups.every((group) => text(group).endsWith("1 reference"))).toBe(
      true,
    );
    expect(text(view)).toContain("Member: unresolved");
  });
  it("does not turn empty projected dimensions into known dimension-free scope", async () => {
    api.fetchPersonalSecFilingContext.mockResolvedValue(
      scopeResponse([scopeCandidate(2, ["unsupported_dimensions"])]),
    );
    render();
    await flush();
    const view = text(render());
    expect(view).toContain("Scope details unavailable");
    expect(view).toContain(
      "Specific scope details are unavailable in this response",
    );
    expect(view).not.toContain("dimension-free");
    expect(view).toContain("a clean candidate cannot establish a match");
    expect(view).toContain("DocumentPeriodEndDate 2026-06-30 Observed");
  });
  it("keeps mixed mismatch issues visible without changing the blocking set", async () => {
    const blocker = scopeCandidate(2, ["unsupported_dimensions"]);
    const mixed = {
      ...scopeCandidate(3, [
        "entity_mismatch",
        "malformed_context",
        "unsupported_dimensions",
      ]),
      entityIdentifier: "2",
      entityCik: "0000000002",
    };
    const outside = {
      ...scopeCandidate(4, ["period_mismatch"]),
      startDate: "2025-04-01",
      endDate: "2025-06-30",
    };
    api.fetchPersonalSecFilingContext.mockResolvedValue(
      scopeResponse([blocker, mixed, outside]),
    );
    render();
    await flush();
    const view = text(render());
    expect(view).toContain(
      "1 retained reference prevents a supported comparison",
    );
    expect(view).toContain("References excluded by the current comparison · 2");
    expect(view).toContain(
      "Issuer mismatch reported; Context structure could not be verified; Context scope is outside the supported comparison",
    );
    expect(view).toContain("exclusion does not verify their context scope");
    expect(view).toContain("Correspondence could not be established");
  });
  it.each([
    "matched",
    "value_differs",
    "ambiguous",
    "no_corresponding_fact",
  ] as const)(
    "preserves an honest %s outcome without an unresolved-scope heading",
    async (status) => {
      const base = response();
      if (base.inspection.status !== "available") throw new Error();
      const first = candidate();
      const rows =
        status === "matched"
          ? [first]
          : status === "value_differs"
            ? [{ ...first, rawText: "12", value: "12" }]
            : status === "ambiguous"
              ? [
                  first,
                  {
                    ...first,
                    locator: "/elements/2",
                    factId: "conflicting-fact",
                    rawText: "12",
                    value: "12",
                  },
                ]
              : [
                  {
                    ...first,
                    entityIdentifier: "2",
                    entityCik: "0000000002",
                    issues: ["entity_mismatch"] as const,
                  },
                ];
      api.fetchPersonalSecFilingContext.mockResolvedValue({
        ...base,
        inspection: {
          ...base.inspection,
          analysis: {
            ...base.inspection.analysis,
            status,
            reason: null,
            candidates: rows,
            correspondingCandidateLocators: rows
              .filter((row) => row.issues.length === 0)
              .map((row) => row.locator),
          },
        },
      });
      render();
      await flush();
      const view = text(render());
      expect(view).not.toContain("Why this value remains unresolved");
      expect(view).toContain("DocumentPeriodEndDate 2026-06-30 Observed");
      expect(view).toContain(
        status === "matched"
          ? "Exact value correspondence found"
          : status === "value_differs"
            ? "Corresponding filing value differs"
            : status === "ambiguous"
              ? "Conflicting corresponding values"
              : "No corresponding fact found",
      );
    },
  );
  it("navigates to an exact later-page context once and permits a repeated jump", async () => {
    api.fetchPersonalSecFilingContext.mockResolvedValue(
      scopeResponse(
        Array.from({ length: 11 }, (_, index) =>
          scopeCandidate(index + 2, ["unsupported_dimensions"]),
        ),
      ),
    );
    render();
    await flush();
    click(render(), "Inspect reference /elements/12");
    const later = render(false);
    expect(text(later)).toContain("11 – 12 of 12 filing candidates");
    const details = elements(later).find(
      (element) =>
        element.type === "details" &&
        typeof element.props.ref === "function" &&
        text(element).includes("Document element /elements/12"),
    );
    expect(details).toBeDefined();
    const summary = { focus: vi.fn(), scrollIntoView: vi.fn() };
    const target = { open: false, querySelector: vi.fn(() => summary) };
    (details!.props.ref as (value: unknown) => void)(target);
    harness.effects();
    expect(target.open).toBe(true);
    expect(summary.focus).toHaveBeenCalledOnce();
    expect(summary.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    target.open = false;
    click(render(), "Inspect reference /elements/12");
    render();
    expect(target.open).toBe(true);
    expect(summary.focus).toHaveBeenCalledTimes(2);
    target.open = false;
    click(render(), "Previous filing candidates");
    render();
    click(render(), "Next filing candidates");
    render();
    expect(target.open).toBe(false);
    expect(summary.focus).toHaveBeenCalledTimes(2);
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
  });
  it("clears a pending jump on refresh and cancellation without reopening a later result", async () => {
    const result = scopeResponse([
      scopeCandidate(2, ["unsupported_dimensions"]),
    ]);
    api.fetchPersonalSecFilingContext.mockResolvedValueOnce(result);
    render();
    await flush();
    const old = render();
    click(old, "Inspect reference /elements/2");
    const pending = deferred<PersonalSecFilingContextResponseDto>();
    api.fetchPersonalSecFilingContext.mockReturnValueOnce(pending.promise);
    click(old, "Refresh filing inspection");
    expect(text(render())).not.toContain("Why this value remains unresolved");
    click(old, "Inspect reference /elements/2");
    click(render(), "Cancel filing inspection");
    pending.resolve(result);
    await flush();
    expect(text(render())).not.toContain("Why this value remains unresolved");
    api.fetchPersonalSecFilingContext.mockResolvedValueOnce(result);
    click(render(), "Refresh filing inspection");
    await flush();
    const current = render(false);
    const details = elements(current).find(
      (element) =>
        element.type === "details" &&
        typeof element.props.ref === "function" &&
        text(element).includes("Document element /elements/2"),
    );
    const summary = { focus: vi.fn(), scrollIntoView: vi.fn() };
    const target = { open: false, querySelector: vi.fn(() => summary) };
    (details!.props.ref as (value: unknown) => void)(target);
    harness.effects();
    expect(target.open).toBe(false);
    expect(summary.focus).not.toHaveBeenCalled();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledTimes(3);
  });
  it.each(["observation", "catalog", "session", "source generation"])(
    "clears the scope explanation and ignores stale jumps after %s changes",
    async (kind) => {
      api.fetchPersonalSecFilingContext.mockResolvedValue(
        scopeResponse([scopeCandidate(2, ["unsupported_dimensions"])]),
      );
      render();
      await flush();
      const old = render();
      expect(text(old)).toContain("Why this value remains unresolved");
      if (kind === "observation")
        props = { ...props, observation: { ...observation(), value: "50" } };
      if (kind === "catalog")
        props = { ...props, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` };
      if (kind === "session") props = { ...props, enabled: false };
      if (kind === "source generation")
        props = { ...props, responseGeneration: 2 };
      expect(text(render(false))).not.toContain(
        "Why this value remains unresolved",
      );
      click(old, "Inspect reference /elements/2");
      harness.effects();
      await flush();
      expect(text(render())).not.toContain("Why this value remains unresolved");
      expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
    },
  );
  it("shows a global limit without candidate values or zero-valued inference", async () => {
    const base = response();
    if (base.inspection.status !== "available") throw new Error();
    api.fetchPersonalSecFilingContext.mockResolvedValue({
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
    });
    render();
    await flush();
    expect(text(render())).toContain(
      "No partial-prefix candidates are presented",
    );
    expect(text(render())).toContain("Absence is not a zero-valued fact");
    expect(elements(render()).some((element) => element.type === "table")).toBe(
      false,
    );
  });
  it.each([
    "selection_changed_or_not_retained",
    "submission_metadata_conflict",
    "runtime_unavailable",
    "parser_timeout",
  ] as const)(
    "explains source outcome %s and retains requested observation",
    async (reason) => {
      api.fetchPersonalSecFilingContext.mockResolvedValue({
        ...response(),
        inspection: {
          status: "unavailable",
          cik: "0000000001",
          stage: "parser",
          reason,
        },
      });
      render();
      await flush();
      expect(text(render())).toContain("Inspection unavailable");
      expect(text(render())).toContain("Requested source observation");
      expect(text(render())).toContain("12345678901234567890.12");
      expect(text(render())).not.toContain("Revalidated source observation");
    },
  );
  it("clears on refresh, cancels and rejects a late response without automatic retry", async () => {
    render();
    await flush();
    const pending = deferred<PersonalSecFilingContextResponseDto>();
    api.fetchPersonalSecFilingContext.mockReturnValueOnce(pending.promise);
    click(render(), "Refresh filing inspection");
    expect(text(render())).not.toContain("Exact value correspondence found");
    expect(text(render())).not.toContain("Filing-declared reporting metadata");
    const signal = api.fetchPersonalSecFilingContext.mock.calls.at(
      -1,
    )?.[1] as AbortSignal;
    click(render(), "Cancel filing inspection");
    expect(signal.aborted).toBe(true);
    pending.resolve(response());
    await flush();
    expect(text(render())).toContain("Filing inspection cancelled");
    expect(text(render())).not.toContain("Exact value correspondence found");
    expect(text(render())).not.toContain("Filing-declared reporting metadata");
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledTimes(2);
  });
  it.each([
    "observation",
    "company",
    "catalog",
    "response generation",
    "session",
    "unmount",
  ])("invalidates pending inspection after %s changes", async (kind) => {
    const pending = deferred<PersonalSecFilingContextResponseDto>();
    api.fetchPersonalSecFilingContext.mockReturnValue(pending.promise);
    render();
    await flush();
    const oldView = render();
    const signal = api.fetchPersonalSecFilingContext.mock
      .calls[0]?.[1] as AbortSignal;
    if (kind === "unmount") harness.unmount();
    else {
      if (kind === "observation")
        props = { ...props, observation: { ...observation(), value: "50" } };
      if (kind === "company")
        props = {
          ...props,
          selection: { ...props.selection, listingId: "lst-other" },
        };
      if (kind === "catalog")
        props = { ...props, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` };
      if (kind === "response generation")
        props = { ...props, responseGeneration: 2 };
      if (kind === "session") props = { ...props, enabled: false };
      expect(text(render(false))).not.toContain(
        "Revalidated source observation",
      );
      harness.effects();
    }
    click(oldView, "Refresh filing inspection");
    expect(signal.aborted).toBe(true);
    pending.reject(new PersonalWorkspaceApiError("session_unavailable"));
    await flush();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
    expect(props.onSessionUnavailable).not.toHaveBeenCalled();
  });
  it("accepts a new deliberate request token after a source generation changes", async () => {
    render();
    await flush();
    props = { ...props, responseGeneration: 2 };
    render();
    await flush();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
    props = { ...props, requestToken: 2 };
    render();
    await flush();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledTimes(2);
    expect(text(render())).toContain("Exact value correspondence found");
  });
  it("rejects an old result immediately when a newer deliberate token renders", async () => {
    const pending = deferred<PersonalSecFilingContextResponseDto>();
    api.fetchPersonalSecFilingContext.mockReturnValueOnce(pending.promise);
    render();
    await flush();
    props = { ...props, requestToken: 2 };
    render(false);
    pending.resolve(response());
    await flush();
    expect(text(render(false))).not.toContain(
      "Exact value correspondence found",
    );
    harness.effects();
    await flush();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledTimes(2);
    expect(text(render())).toContain("Exact value correspondence found");
  });
  it("clears and notifies the latest callback after actual session expiry", async () => {
    const pending = deferred<PersonalSecFilingContextResponseDto>();
    api.fetchPersonalSecFilingContext.mockReturnValue(pending.promise);
    render();
    await flush();
    const latest = vi.fn();
    props = { ...props, onSessionUnavailable: latest };
    render();
    pending.reject(new PersonalWorkspaceApiError("session_unavailable"));
    await flush();
    expect(latest).toHaveBeenCalledOnce();
    expect(text(render())).toContain("owner session expired");
    expect(text(render())).not.toContain("Revalidated source observation");
    expect(text(render())).not.toContain("12345678901234567890.12");
    expect(button(render(), "Refresh filing inspection").props.disabled).toBe(
      true,
    );
  });
  it.each([
    ["not_configured", "SEC contact setup"],
    ["conflict", "selected source observation changed"],
    ["invalid_response", "could not be validated"],
    ["rate_limited", "rate limited"],
  ] as const)(
    "preserves observations on %s inspection failure",
    async (code, expected) => {
      api.fetchPersonalSecFilingContext.mockRejectedValue(
        new PersonalWorkspaceApiError(code),
      );
      render();
      await flush();
      expect(text(render())).toContain(expected);
      expect(props.onSessionUnavailable).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    },
  );
  it("rejects a response with different selected issuer metadata", async () => {
    const base = response();
    api.fetchPersonalSecFilingContext.mockResolvedValue({
      ...base,
      security: { ...base.security, issuerId: "issuer-other" },
    });
    render();
    await flush();
    expect(text(render())).toContain("could not be validated");
    expect(text(render())).not.toContain("Exact value correspondence found");
  });
});
const harness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const dependencies: Array<readonly unknown[] | undefined> = [];
  const cleanup = new Map<number, () => void>();
  const setups = new Map<number, () => (() => void) | void>();
  let pending: Array<() => void> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  return {
    reset() {
      states.splice(0);
      refs.splice(0);
      dependencies.splice(0);
      cleanup.clear();
      setups.clear();
      pending = [];
    },
    strictReplay() {
      cleanup.forEach((fn) => fn());
      cleanup.clear();
      setups.forEach((setup, index) => {
        const next = setup();
        if (next) cleanup.set(index, next);
      });
    },
    begin() {
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    effects() {
      const effects = pending;
      pending = [];
      effects.forEach((effect) => effect());
    },
    unmount() {
      cleanup.forEach((fn) => fn());
      cleanup.clear();
      setups.clear();
    },
    useEffect(
      effect: () => (() => void) | void,
      next: readonly unknown[] | undefined,
    ) {
      const index = effectIndex++;
      const previous = dependencies[index];
      if (
        previous !== undefined &&
        next !== undefined &&
        previous.length === next.length &&
        next.every((item, i) => Object.is(item, previous[i]))
      )
        return;
      dependencies[index] = next;
      setups.set(index, effect);
      pending.push(() => {
        cleanup.get(index)?.();
        const returned = effect();
        if (returned) cleanup.set(index, returned);
      });
    },
    useRef<T>(initial: T) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (next: unknown) => {
          states[index] =
            typeof next === "function"
              ? (next as (previous: unknown) => unknown)(states[index])
              : next;
        },
      ];
    },
  };
});

function render(runEffects = true) {
  harness.begin();
  const view = PersonalSecFilingContext(props);
  if (runEffects) harness.effects();
  return view;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value))
    return value.map(text).join(" ").replace(/\s+/gu, " ");
  if (!React.isValidElement(value)) return "";
  const element = value as React.ReactElement<Record<string, unknown>>;
  return typeof element.type === "function"
    ? text(Reflect.apply(element.type, undefined, [element.props]) as unknown)
    : text(element.props.children);
}
function elements(
  value: unknown,
): Array<React.ReactElement<Record<string, unknown>>> {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement(value)) return [];
  const element = value as React.ReactElement<Record<string, unknown>>;
  return [
    element,
    ...elements(
      typeof element.type === "function"
        ? (Reflect.apply(element.type, undefined, [element.props]) as unknown)
        : element.props.children,
    ),
  ];
}
function button(value: unknown, label: string) {
  const found = elements(value).find(
    (element) => element.type === "button" && text(element) === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found as React.ReactElement<{
    disabled?: boolean;
    onClick?: () => void;
  }>;
}
function click(value: unknown, label: string) {
  button(value, label).props.onClick?.();
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

function scopeCandidate(
  element: number,
  issues: readonly PersonalSecFilingContextIssue[],
  dimensionKind?: "explicit" | "typed",
): PersonalSecFilingContextCandidateDto {
  return {
    ...candidate(),
    locator: `/elements/${element}`,
    factId: `scope-fact-${element}`,
    contextId: `scope-context-${element}`,
    issues,
    dimensions:
      dimensionKind === undefined
        ? []
        : [
            {
              kind: dimensionKind,
              dimension: {
                raw: "custom:ScopeAxis",
                namespace: "urn:scope:test",
                localName: "ScopeAxis",
              },
              member:
                dimensionKind === "explicit"
                  ? {
                      raw: "custom:Member",
                      namespace: "urn:scope:test",
                      localName: "Member",
                    }
                  : null,
              typedText:
                dimensionKind === "typed" ? "Uninterpreted member" : null,
            },
          ],
  };
}
function scopeResponse(
  rows: readonly PersonalSecFilingContextCandidateDto[],
): PersonalSecFilingContextResponseDto {
  const base = response();
  if (base.inspection.status !== "available") throw new Error();
  const blocker = rows.find(
    (row) =>
      row.issues.length > 0 &&
      !row.issues.includes("entity_mismatch") &&
      !row.issues.includes("period_mismatch"),
  );
  return {
    ...base,
    inspection: {
      ...base.inspection,
      analysis: {
        ...base.inspection.analysis,
        status: "unsupported",
        reason: blocker?.issues[0] ?? "unsupported_dimensions",
        candidates: [candidate(), ...rows],
        correspondingCandidateLocators: [candidate().locator],
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
function unavailableMetadata(): PersonalSecFilingReportingMetadataDto {
  const empty = createEmptyPersonalSecFilingReportingMetadata();
  return {
    ...empty,
    status: "unavailable",
    reason: "candidate_limit",
    fields: empty.fields.map((field) => ({ ...field, status: "unsupported" })),
  };
}
