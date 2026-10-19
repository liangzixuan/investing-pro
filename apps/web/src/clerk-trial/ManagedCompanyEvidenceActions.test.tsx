import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ManagedCompanyEvidenceActions } from "./ManagedCompanyEvidenceActions";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { ManagedSecCooldownError } from "./managed-api";
import { TrialApiError } from "./api";
import { eodSelection, eodResponse } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import { response } from "../features/research/test-canonical-annual-ui-fixture";

vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) =>
      getSnapshot(),
  };
});

type NodeProps = {
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
};
function buttons(node: React.ReactNode): React.ReactElement<NodeProps>[] {
  if (!React.isValidElement<NodeProps>(node)) return [];
  if (typeof node.type === "function") {
    const render = node.type as (props: NodeProps) => React.ReactNode;
    return buttons(render(node.props));
  }
  return [
    ...(node.type === "button" ? [node] : []),
    ...React.Children.toArray(node.props.children).flatMap(buttons),
  ];
}
async function fixture(
  open = false,
  coverage = inventedManagedResearchCoverage,
) {
  const readPrice = vi.fn().mockResolvedValue(eodResponse());
  const readAnnual = vi.fn().mockResolvedValue(await response());
  const readFilings = vi.fn().mockResolvedValue(filingsResponse(2));
  const price = new ManagedEodHistory(readPrice, vi.fn(), undefined, [
    eodSelection.listing,
  ]);
  const annual = new ManagedAnnualReport(readAnnual, vi.fn(), undefined, {
    coverage,
  });
  const filings = new ManagedCompanyFilings(readFilings, vi.fn(), undefined, {
    coverage,
  });
  if (open) {
    price.open(eodSelection);
    annual.open(eodSelection);
    filings.open(eodSelection);
  }
  const props = {
    navigationPending: false,
    selection: eodSelection,
    price,
    annual,
    filings,
    onRequest: vi.fn(),
    onCancel: vi.fn(),
    onOpen: vi.fn(),
  };
  const tree = () => ManagedCompanyEvidenceActions(props);
  const html = () =>
    renderToStaticMarkup(<ManagedCompanyEvidenceActions {...props} />);
  const button = (label: string) => {
    const found = buttons(tree()).find(
      (node) =>
        React.Children.toArray(node.props.children)
          .filter((child): child is string => typeof child === "string")
          .join("") === label,
    );
    if (!found) throw new Error(`Missing source action: ${label}`);
    return found;
  };
  return {
    ...props,
    props,
    tree,
    html,
    button,
    readPrice,
    readAnnual,
    readFilings,
  };
}

describe("company research source actions", () => {
  it.each(["Annual", "Filings"] as const)(
    "keeps %s eligibility independent and Inspect source-free",
    async (source) => {
      const coverage =
        source === "Annual"
          ? { ...inventedManagedResearchCoverage, annualIssuers: [] }
          : { ...inventedManagedResearchCoverage, filingsIssuers: [] };
      const f = await fixture(false, coverage);
      expect(f.html()).not.toContain(`Load ${source}`);
      expect(f.html()).toContain(
        source === "Annual" ? "Load Filings" : "Load Annual",
      );
      f.button(`Inspect ${source}`).props.onClick?.();
      expect(f.onOpen).toHaveBeenCalledExactlyOnceWith(
        source === "Annual" ? "annual" : "filings",
      );
      expect(f.onRequest).not.toHaveBeenCalled();
      expect(f.readAnnual).not.toHaveBeenCalled();
      expect(f.readFilings).not.toHaveBeenCalled();
      expect(f.readPrice).not.toHaveBeenCalled();
    },
  );
  it("disables section-changing requests and inspection while preserving loaded evidence and Cancel", async () => {
    const f = await fixture(true);
    await f.price.load();
    const loaded = f.price.getSnapshot().response;
    let finish!: (value: ReturnType<typeof eodResponse>) => void;
    f.readPrice.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const reading = f.price.load();
    f.props.navigationPending = true;
    for (const label of [
      "Loading Price…",
      "Load Annual",
      "Load Filings",
      "Inspect Price",
      "Inspect Annual",
      "Inspect Filings",
    ])
      expect(f.button(label).props.disabled).toBe(true);
    expect(f.price.getSnapshot().response).toBe(loaded);
    expect(f.button("Cancel Price").props.disabled).not.toBe(true);
    f.button("Cancel Price").props.onClick!();
    expect(f.onCancel).toHaveBeenCalledExactlyOnceWith("eod");
    expect(f.onRequest).not.toHaveBeenCalled();
    expect(f.onOpen).not.toHaveBeenCalled();
    f.price.cancel();
    finish(eodResponse());
    await reading;
    f.props.navigationPending = false;
    expect(f.button("Inspect Annual").props.disabled).toBe(false);
    expect(f.button("Load Annual").props.disabled).toBe(false);
    expect(f.readAnnual).not.toHaveBeenCalled();
    expect(f.readFilings).not.toHaveBeenCalled();
  });
  it.each([
    ["eod", "Price · One month"],
    ["annual", "Annual"],
    ["filings", "Filings"],
  ] as const)(
    "only invokes the explicit %s callback; render and inspection read nothing",
    async (section, label) => {
      const f = await fixture();
      const before = [
        f.price.getSnapshot(),
        f.annual.getSnapshot(),
        f.filings.getSnapshot(),
      ];
      const html = f.html();
      expect(html).toContain('aria-label="Company research sources"');
      expect(html.match(/Not loaded\./gu)).toHaveLength(3);
      expect(html).not.toContain("<details");
      expect(html).not.toContain("<time");
      expect(f.onRequest).not.toHaveBeenCalled();
      expect(f.onOpen).not.toHaveBeenCalled();
      f.button(`Load ${label}`).props.onClick!();
      expect(f.onRequest).toHaveBeenCalledExactlyOnceWith(section);
      f.button(`Inspect ${section === "eod" ? "Price" : label}`).props
        .onClick!();
      expect(f.onOpen).toHaveBeenCalledExactlyOnceWith(section);
      expect(f.readPrice).not.toHaveBeenCalled();
      expect(f.readAnnual).not.toHaveBeenCalled();
      expect(f.readFilings).not.toHaveBeenCalled();
      expect([
        f.price.getSnapshot(),
        f.annual.getSnapshot(),
        f.filings.getSnapshot(),
      ]).toEqual(before);
    },
  );

  it("uses the actual injected exact-listing coverage before a model is opened", async () => {
    const f = await fixture();
    expect(f.button("Load Price · One month").props.disabled).toBe(false);
    const wrongClass = {
      ...eodSelection,
      listing: { ...eodSelection.listing, shareClassId: "other-class" },
    };
    const html = renderToStaticMarkup(
      <ManagedCompanyEvidenceActions {...f.props} selection={wrongClass} />,
    );
    expect(html).toContain("Unsupported listing.");
    expect(html).toContain("Price history is not available for this listing");
    expect(html).not.toContain("Load Price");
    expect(html).toContain("Inspect Price");
    expect(html).not.toContain("Load Annual");
    expect(html).not.toContain("Load Filings");
    expect(html).toContain("Inspect Annual");
    expect(html).toContain("Inspect Filings");
    expect(f.readPrice).not.toHaveBeenCalled();
    expect(f.price.getSnapshot().selection).toBeNull();
  });

  it("keeps loaded source clocks and actual loaded range when another range is staged", async () => {
    const f = await fixture(true);
    await Promise.all([f.price.load(), f.annual.load(), f.filings.load()]);
    f.price.selectRange("1y");
    const html = f.html();
    expect(html.match(/Source response loaded\./gu)).toHaveLength(3);
    for (const date of [
      "2026-09-20T00:00:01.000Z",
      "2026-09-20T00:00:02.000Z",
      "2026-10-12T00:00:01.000Z",
    ])
      expect(html).toContain(`<time dateTime="${date}">${date}</time>`);
    expect(html).toContain("Requested range: One year.");
    expect(html).toContain("Loaded range: One month.");
    expect(html).toContain(
      "Financial values keep their own availability and refusal reasons in Annual.",
    );
    expect(html).toContain("2 observed filings.");
    expect(f.button("Load Price · One year").props.disabled).toBe(false);
    expect(f.button("Refresh Annual").props.disabled).toBe(false);
    expect(f.button("Refresh Filings").props.disabled).toBe(false);
    expect(f.readPrice).toHaveBeenCalledOnce();
    expect(f.readAnnual).toHaveBeenCalledOnce();
    expect(f.readFilings).toHaveBeenCalledOnce();
  });

  it("keeps an Annual financial refusal separate from a failed or unloaded response", async () => {
    const f = await fixture(true);
    f.readAnnual.mockResolvedValueOnce(await response([]));
    await f.annual.load();
    expect(
      f.annual.getSnapshot().view?.income.resolution.currentTargetEligible,
    ).toBe(false);
    const html = f.html();
    expect(html).toContain("Source response loaded.");
    expect(html).toContain(
      "Financial values keep their own availability and refusal reasons in Annual.",
    );
    expect(html).toContain("2026-09-20T00:00:02.000Z");
    expect(html).not.toContain("Source load failed.");
    expect(f.button("Refresh Annual").props.disabled).toBe(false);
    expect(f.readAnnual).toHaveBeenCalledOnce();
  });

  it.each([
    ["eod", "Price"],
    ["annual", "Annual"],
    ["filings", "Filings"],
  ] as const)(
    "offers Cancel for an initial pending %s request and invokes only its callback",
    async (section, title) => {
      const f = await fixture(true);
      const model =
        section === "eod"
          ? f.price
          : section === "annual"
            ? f.annual
            : f.filings;
      const read =
        section === "eod"
          ? f.readPrice
          : section === "annual"
            ? f.readAnnual
            : f.readFilings;
      const packet =
        section === "eod"
          ? eodResponse()
          : section === "annual"
            ? await response()
            : filingsResponse();
      let settle!: () => void;
      read.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            settle = () => resolve(packet);
          }),
      );
      const pending = model.load();
      expect(f.html()).toContain("Loading source…");
      expect(f.html()).not.toContain("Original load completed");
      expect(f.button(`Loading ${title}…`).props.disabled).toBe(true);
      f.button(`Cancel ${title}`).props.onClick!();
      expect(f.onCancel).toHaveBeenCalledExactlyOnceWith(section);
      expect(model.getSnapshot().running).toBe(true);
      expect(f.onRequest).not.toHaveBeenCalled();
      model.cancel();
      settle();
      await pending;
      expect(f.html()).not.toContain(`Cancel ${title}`);
      expect(model.getSnapshot().response).toBeNull();
      expect(read).toHaveBeenCalledOnce();
    },
  );

  it("shows pending state and Cancel while retaining the exact prior clock", async () => {
    const f = await fixture(true);
    await f.price.load();
    let settle!: (value: ReturnType<typeof eodResponse>) => void;
    f.readPrice.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    const pending = f.price.load();
    expect(f.html()).toContain(
      "Loading source. Previous response remains visible.",
    );
    expect(f.html()).toContain('aria-label="Price source" aria-busy="true"');
    expect(f.html()).toContain("2026-09-20T00:00:01.000Z");
    expect(f.button("Loading Price…").props.disabled).toBe(true);
    f.button("Cancel Price").props.onClick!();
    expect(f.onCancel).toHaveBeenCalledExactlyOnceWith("eod");
    expect(f.price.getSnapshot().running).toBe(true);
    f.price.cancel();
    settle(eodResponse("1y"));
    await pending;
    expect(f.html()).toContain("Previous response retained.");
    expect(f.html()).toContain(
      "Close history refresh cancelled. Try again when ready.",
    );
    expect(f.html()).toContain("Loaded range: One month.");
    expect(f.html()).not.toContain("Cancel Price");
    expect(f.readAnnual).not.toHaveBeenCalled();
    expect(f.readFilings).not.toHaveBeenCalled();
  });

  it("separates a retained transient failure from malformed clearing and preserves exact model errors", async () => {
    const f = await fixture(true);
    await f.annual.load();
    f.readAnnual.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.annual.load();
    expect(f.html()).toContain("Previous response retained.");
    expect(f.html()).toContain(f.annual.getSnapshot().message);
    expect(f.html()).toContain('role="alert" aria-live="polite"');
    expect(f.html()).toContain("2026-09-20T00:00:02.000Z");
    f.readAnnual.mockRejectedValueOnce(new TrialApiError("invalid_response"));
    await f.annual.load();
    const html = f.html();
    expect(html).toContain("Source load failed.");
    expect(html).toContain(f.annual.getSnapshot().message);
    expect(html).not.toContain("2026-09-20T00:00:02.000Z");
    expect(f.button("Load Annual").props.disabled).toBe(false);
    expect(f.readAnnual).toHaveBeenCalledTimes(3);
  });

  it.each([
    "available",
    "not_covered",
    "rate_limited",
    "upstream_unavailable",
    "invalid_response",
  ] as const)(
    "keeps an admitted %s Filings response distinct from unloaded or failed transport",
    async (status) => {
      const f = await fixture(true);
      f.readFilings.mockResolvedValueOnce(filingsResponse(0, status));
      await f.filings.load();
      const html = f.html();
      expect(html).toContain("Source response loaded.");
      expect(html).toContain("2026-10-12T00:00:01.000Z");
      expect(html).not.toContain("Source load failed.");
      if (status === "available")
        expect(html).toContain(
          "No matching filings in the checked source object.",
        );
      else expect(html).toContain(f.filings.getSnapshot().message);
      expect(f.button("Refresh Filings").props.disabled).toBe(false);
      expect(f.readFilings).toHaveBeenCalledOnce();
    },
  );

  it("preserves returned cooldown guidance without a countdown, retry or extra read", async () => {
    const f = await fixture(true);
    f.readAnnual.mockRejectedValueOnce(
      new ManagedSecCooldownError("2099-10-15T01:00:20.000Z"),
    );
    await f.annual.load();
    const message = f.annual.getSnapshot().message;
    const html = f.html();
    expect(html).toContain(message);
    expect(html).not.toMatch(
      /countdown|seconds remaining|ready to load|complete research/iu,
    );
    expect(f.readAnnual).toHaveBeenCalledOnce();
    expect(f.onRequest).not.toHaveBeenCalled();
    expect(f.readPrice).not.toHaveBeenCalled();
    expect(f.readFilings).not.toHaveBeenCalled();
  });

  it("does not expose another visit's loaded response, staged range or messages", async () => {
    const f = await fixture(true);
    await f.price.load();
    f.price.selectRange("1y");
    const html = renderToStaticMarkup(
      <ManagedCompanyEvidenceActions
        {...f.props}
        selection={{ ...eodSelection, origin: "route" }}
      />,
    );
    expect(html).not.toContain("2026-09-20T00:00:01.000Z");
    expect(html).toContain("Requested range: One month.");
    expect(html).not.toContain("Loaded range:");
    expect(html.match(/Not loaded\./gu)).toHaveLength(3);
    expect(f.readPrice).toHaveBeenCalledOnce();
  });
});
