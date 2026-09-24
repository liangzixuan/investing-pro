import {
  PERSONAL_SEC_QUARTER_ASSESSMENT_LIMITS,
  type PersonalSecQuarterAssessmentRequestDto,
  type PersonalSecQuarterAssessmentResponseDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPersonalSecQuarterAssessment } from "./personal-sec-quarter-assessment-api";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("SEC quarter assessment browser boundary", () => {
  it("validates and freezes a complete assessment captured from the actual raw-source pipeline", async () => {
    const complete = completeFixture("supported");
    fetchMock.mockResolvedValue(Response.json(complete));
    const result = await fetchPersonalSecQuarterAssessment(
      completeRequest(),
      new AbortController().signal,
    );
    expect(result).toEqual(complete);
    expect(Object.isFrozen(result.assessment)).toBe(true);
    expect(result.assessment.status).toBe("supported_as_filed");
  });
  it.each(["bundle", "full identity", "source hash"])(
    "rejects a complete response with a changed %s",
    async (field) => {
      const complete = completeFixture("supported");
      if (complete.assessment.stage !== "assessment")
        throw new Error("Missing complete fixture.");
      const changed =
        field === "bundle"
          ? {
              ...complete,
              assessment: {
                ...complete.assessment,
                bundleId: `sha256:${"b".repeat(64)}`,
              },
            }
          : field === "full identity"
            ? {
                ...complete,
                security: {
                  ...complete.security,
                  issuerName: "Another registrant",
                },
              }
            : {
                ...complete,
                assessment: {
                  ...complete.assessment,
                  sources: complete.assessment.sources.map((source, index) =>
                    index === 0
                      ? { ...source, sha256: `sha256:${"b".repeat(64)}` }
                      : source,
                  ),
                },
              };
      fetchMock.mockResolvedValue(Response.json(changed));
      await expect(
        fetchPersonalSecQuarterAssessment(
          completeRequest(),
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );
  it("preserves a supported metric when the complete source graph holds the pair", async () => {
    fetchMock.mockResolvedValue(Response.json(completeFixture("partial")));
    const result = await fetchPersonalSecQuarterAssessment(
      completeRequest(),
      new AbortController().signal,
    );
    if (result.assessment.stage !== "assessment")
      throw new Error("Missing complete fixture.");
    expect(result.assessment.analysis.metrics[0]).toMatchObject({
      status: "supported_as_filed",
      value: "100000000",
    });
    expect(result.assessment.analysis.metrics[1]).toMatchObject({
      status: "held",
      value: null,
    });
    expect(result.assessment.analysis.pair).toMatchObject({
      status: "held",
      revenue: null,
      netIncome: null,
    });
  });
  it("uses the protected local POST with an amount-free selection and freezes the result", async () => {
    fetchMock.mockResolvedValue(Response.json(response()));
    const signal = new AbortController().signal;
    const result = await fetchPersonalSecQuarterAssessment(request(), signal);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL(
        "http://127.0.0.1:3100/v1/personal-filing/workspace/sec-quarter-assessment",
      ),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request()),
        signal,
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
      }),
    );
    expect(Object.isFrozen(result.assessment.selection)).toBe(true);
    expect(result).toEqual(response());
  });

  it.each(["cik", "sourceUrl", "amount", "supported", "witness"])(
    "rejects client-supplied %s before network",
    async (field) => {
      const input = { ...request(), [field]: "untrusted" };
      await expect(
        fetchPersonalSecQuarterAssessment(input, new AbortController().signal),
      ).rejects.toMatchObject({ code: "invalid_request" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "identity",
      () => ({
        ...response(),
        security: { ...response().security, symbol: "OTHER" },
      }),
    ],
    [
      "selection",
      () => ({
        ...response(),
        assessment: {
          ...response().assessment,
          selection: {
            ...request().selection,
            accessionNumber: "0000000001-26-000002",
          },
        },
      }),
    ],
    [
      "supplied result flag",
      () => ({
        ...response(),
        assessment: { ...response().assessment, supported: true },
      }),
    ],
    [
      "failure value",
      () => ({
        ...response(),
        assessment: { ...response().assessment, value: "42" },
      }),
    ],
  ] as const)("rejects a mismatched %s", async (_label, fixture) => {
    fetchMock.mockResolvedValue(Response.json(fixture()));
    await expect(
      fetchPersonalSecQuarterAssessment(
        request(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejects decoded duplicate keys rather than using the final value", async () => {
    const text = JSON.stringify(response()).replace(
      '"status":"unavailable"',
      '"status":"held","sta\\u0074us":"unavailable"',
    );
    fetchMock.mockResolvedValue(new Response(text));
    await expect(
      fetchPersonalSecQuarterAssessment(
        request(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejects invalid UTF-8", async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([0xc3, 0x28])));
    await expect(
      fetchPersonalSecQuarterAssessment(
        request(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("decodes a response whose Unicode character crosses stream chunks", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(response()));
    const offset = bytes.findIndex((byte) => byte === 0xc3) + 1;
    expect(offset).toBeGreaterThan(0);
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.slice(0, offset));
            controller.enqueue(bytes.slice(offset));
            controller.close();
          },
        }),
      ),
    );
    expect(
      await fetchPersonalSecQuarterAssessment(
        request(),
        new AbortController().signal,
      ),
    ).toEqual(response());
  });

  it.each([0, 1])(
    "enforces the exact response byte boundary (extra bytes: %s)",
    async (extra) => {
      const text = JSON.stringify(response());
      const bytes = new TextEncoder().encode(text).byteLength;
      const body =
        " ".repeat(
          PERSONAL_SEC_QUARTER_ASSESSMENT_LIMITS.finalResponseBytes -
            bytes +
            extra,
        ) + text;
      fetchMock.mockResolvedValue(new Response(body));
      const promise = fetchPersonalSecQuarterAssessment(
        request(),
        new AbortController().signal,
      );
      if (extra === 0) expect(await promise).toEqual(response());
      else
        await expect(promise).rejects.toMatchObject({
          code: "invalid_response",
        });
    },
  );

  it("takes a copy of selection before awaiting a source response", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const input = structuredClone(request());
    const pending = fetchPersonalSecQuarterAssessment(
      input,
      new AbortController().signal,
    );
    (input.selection as { reportDate: string }).reportDate = "2026-06-30";
    finish(Response.json(response()));
    expect((await pending).assessment.selection.reportDate).toBe("2026-03-31");
  });

  it("cancels a pending response stream and rejects after cancellation", async () => {
    const cancelled = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(new ReadableStream({ cancel: cancelled })),
    );
    const controller = new AbortController();
    const pending = fetchPersonalSecQuarterAssessment(
      request(),
      controller.signal,
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it.each([
    [401, "session_unavailable"],
    [403, "session_unavailable"],
    [409, "conflict"],
    [429, "rate_limited"],
    [502, "provider_unavailable"],
  ] as const)(
    "maps HTTP %s without exposing the body",
    async (status, code) => {
      fetchMock.mockResolvedValue(new Response("untrusted body", { status }));
      await expect(
        fetchPersonalSecQuarterAssessment(
          request(),
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code });
    },
  );
});

function completeFixture(
  kind: "supported" | "partial",
): PersonalSecQuarterAssessmentResponseDto {
  return JSON.parse(
    readFileSync(
      new URL(
        `../../../../fixtures/synthetic/sec-quarter-assessment/${kind}-response.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ) as PersonalSecQuarterAssessmentResponseDto;
}
function completeRequest(): PersonalSecQuarterAssessmentRequestDto {
  return JSON.parse(
    readFileSync(
      new URL(
        "../../../../fixtures/synthetic/sec-quarter-assessment/request.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as PersonalSecQuarterAssessmentRequestDto;
}

function request(): PersonalSecQuarterAssessmentRequestDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    listingId: "lst-zero",
    symbol: "ZERO",
    selection: {
      accessionNumber: "0000000001-26-000001",
      form: "10-Q",
      filedDate: "2026-05-01",
      reportDate: "2026-03-31",
    },
  };
}
function response(): PersonalSecQuarterAssessmentResponseDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: request().catalogSnapshotSha256,
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zéro Alpha",
      listingId: "lst-zero",
      securityName: "Zero Alpha Common",
      symbol: "ZERO",
      cik: "0000000001",
    },
    assessment: {
      status: "unavailable",
      cik: "0000000001",
      selection: request().selection,
      stage: "submissions",
      reason: "upstream_unavailable",
      sources: [],
    },
  };
}
import { readFileSync } from "node:fs";
