import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ManagedAnnualReportNavigation,
  type AnnualReportTargets,
} from "./ManagedAnnualReportNavigation";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";
import { SecAnnualCashGeneration } from "./SecAnnualCashGeneration";
import { SecAnnualLiquidity } from "./SecAnnualLiquidity";
import { annualComparisonResponse } from "../../clerk-trial/annual-comparison-fixture";
import { annualHistoryRows } from "./sec-annual-evidence-fixture";

const hooks = vi.hoisted(() => ({
  direct: false,
  ref: { current: null },
  pending: undefined as (() => void | (() => void)) | undefined,
  cleanup: undefined as (() => void) | undefined,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useRef: (value: unknown) =>
      hooks.direct ? hooks.ref : actual.useRef(value),
    useLayoutEffect: (
      effect: () => void | (() => void),
      deps: React.DependencyList,
    ) => {
      if (hooks.direct) hooks.pending = effect;
      else actual.useLayoutEffect(effect, deps);
    },
  };
});
afterEach(() => {
  hooks.cleanup?.();
  hooks.direct = false;
  hooks.ref.current = null;
  hooks.pending = undefined;
  hooks.cleanup = undefined;
});

const sections = [
  "income",
  "operating",
  "cash",
  "liquidity",
  "sources",
] as const;
type Section = (typeof sections)[number];
type Link = React.ReactElement<
  React.ComponentProps<"a"> & { "data-annual-report-jump": Section }
>;
function links(node: React.ReactNode): Link[] {
  if (Array.isArray(node)) return node.flatMap(links);
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
  return [
    ...(node.type === "a" ? [node as Link] : []),
    ...links(node.props.children),
  ];
}
function target() {
  return {
    isConnected: true,
    getClientRects: vi.fn(() => [{}]),
    focus: vi.fn(),
    scrollIntoView: vi.fn(),
  };
}
async function harness() {
  const nodes = {
    income: target(),
    operating: target(),
    cash: target(),
    liquidity: target(),
    sources: target(),
  };
  const targets = Object.fromEntries(
    sections.map((section) => [
      section,
      {
        id: `owned-${section}`,
        ref: { current: nodes[section] as unknown as HTMLElement },
      },
    ]),
  ) as AnnualReportTargets;
  const details = {
    isConnected: true,
    open: false,
    contains: vi.fn((node: unknown) => node === nodes.sources),
  };
  const sourceDetails = {
    current: details as unknown as HTMLDetailsElement,
  };
  const response = await annualComparisonResponse();
  function commit() {
    hooks.cleanup?.();
    hooks.cleanup = hooks.pending?.() ?? undefined;
    hooks.pending = undefined;
  }
  function render(next = response, committed = true) {
    hooks.direct = true;
    const rendered = ManagedAnnualReportNavigation({
      response: next,
      targets,
      sourceDetails,
    });
    hooks.direct = false;
    if (committed) commit();
    return links(rendered);
  }
  function activate(controls: Link[], section: Section) {
    const preventDefault = vi.fn();
    controls.find((link) => link.props["data-annual-report-jump"] === section)!
      .props.onClick!({
      preventDefault,
    } as unknown as React.MouseEvent<HTMLAnchorElement>);
    expect(preventDefault).toHaveBeenCalledOnce();
  }
  return {
    nodes,
    targets,
    details,
    sourceDetails,
    response,
    render,
    commit,
    activate,
  };
}

describe("managed Annual in-report navigation", () => {
  it.each(sections)(
    "focuses and instantly scrolls only the %s target after explicit activation",
    async (section) => {
      const h = await harness();
      const controls = h.render();
      expect(controls.map((link) => link.props.children)).toEqual([
        "Revenue and net income",
        "Operating results",
        "Cash generation",
        "Liquidity",
        "Report source details",
      ]);
      expect(controls.map((link) => link.props.href)).toEqual(
        sections.map((key) => `#owned-${key}`),
      );
      for (const node of Object.values(h.nodes))
        expect(node.focus).not.toHaveBeenCalled();
      expect(h.details.open).toBe(false);
      h.activate(controls, section);
      expect(h.nodes[section].focus).toHaveBeenCalledExactlyOnceWith({
        preventScroll: true,
      });
      expect(h.nodes[section].scrollIntoView).toHaveBeenCalledExactlyOnceWith({
        block: "start",
        behavior: "instant",
      });
      expect(h.nodes[section].focus.mock.invocationCallOrder[0]).toBeLessThan(
        h.nodes[section].scrollIntoView.mock.invocationCallOrder[0]!,
      );
      for (const other of sections.filter((key) => key !== section)) {
        expect(h.nodes[other].focus).not.toHaveBeenCalled();
        expect(h.nodes[other].scrollIntoView).not.toHaveBeenCalled();
      }
      expect(h.details.open).toBe(section === "sources");
    },
  );

  it("uses committed responses and refuses an old handler after equal-value response replacement", async () => {
    const h = await harness();
    const old = h.render(h.response, false);
    h.activate(old, "cash");
    expect(h.nodes.cash.focus).not.toHaveBeenCalled();
    h.commit();
    const replacement = await annualComparisonResponse();
    expect(replacement).toEqual(h.response);
    expect(replacement).not.toBe(h.response);
    const next = h.render(replacement, false);
    h.activate(next, "cash");
    expect(h.nodes.cash.focus).not.toHaveBeenCalled();
    h.commit();
    h.activate(old, "sources");
    expect(h.details.open).toBe(false);
    expect(h.nodes.sources.focus).not.toHaveBeenCalled();
    h.activate(next, "cash");
    expect(h.nodes.cash.focus).toHaveBeenCalledOnce();
  });

  it("does not focus, scroll or open disclosures when a report is replaced", async () => {
    const h = await harness();
    h.render();
    h.render(await annualComparisonResponse("right"));
    for (const node of Object.values(h.nodes)) {
      expect(node.focus).not.toHaveBeenCalled();
      expect(node.scrollIntoView).not.toHaveBeenCalled();
    }
    expect(h.details.open).toBe(false);
  });

  it("retires all captured actions on unmount even if an old target still reports connected", async () => {
    const h = await harness();
    const controls = h.render();
    hooks.cleanup?.();
    for (const section of sections) h.activate(controls, section);
    expect(h.details.open).toBe(false);
    for (const node of Object.values(h.nodes))
      expect(node.focus).not.toHaveBeenCalled();
  });

  it.each(["missing", "disconnected", "hidden"] as const)(
    "refuses a %s destination",
    async (state) => {
      const h = await harness();
      const controls = h.render();
      if (state === "missing") h.targets.cash.ref.current = null;
      if (state === "disconnected") h.nodes.cash.isConnected = false;
      if (state === "hidden") h.nodes.cash.getClientRects.mockReturnValue([]);
      h.activate(controls, "cash");
      expect(h.nodes.cash.focus).not.toHaveBeenCalled();
      expect(h.nodes.cash.scrollIntoView).not.toHaveBeenCalled();
    },
  );

  it.each(["missing", "disconnected", "foreign"] as const)(
    "does not open a %s source disclosure",
    async (state) => {
      const h = await harness();
      const controls = h.render();
      if (state === "missing")
        h.sourceDetails.current = null as unknown as HTMLDetailsElement;
      if (state === "disconnected") h.details.isConnected = false;
      if (state === "foreign") h.details.contains.mockReturnValue(false);
      h.activate(controls, "sources");
      expect(h.details.open).toBe(false);
      expect(h.nodes.sources.focus).not.toHaveBeenCalled();
    },
  );

  it.each(["unmount", "removed", "replaced target"] as const)(
    "does not scroll after focus triggers %s",
    async (change) => {
      const h = await harness();
      const controls = h.render();
      h.nodes.cash.focus.mockImplementation(() => {
        if (change === "unmount") hooks.cleanup?.();
        if (change === "removed") h.nodes.cash.isConnected = false;
        if (change === "replaced target")
          h.targets.cash.ref.current = target() as unknown as HTMLElement;
      });
      h.activate(controls, "cash");
      expect(h.nodes.cash.focus).toHaveBeenCalledOnce();
      expect(h.nodes.cash.scrollIntoView).not.toHaveBeenCalled();
    },
  );
});

describe("managed Annual destination markup", () => {
  it.each(["default", "income-invalid"] as const)(
    "keeps five linked destinations and original independent evidence for %s income",
    async (mode) => {
      const response = await annualComparisonResponse("left", { mode });
      const before = JSON.stringify(response);
      const html = renderToStaticMarkup(
        <SecAnnualEvidenceResult
          response={response}
          appearance="financial"
          cashAction={<button>Existing cash action</button>}
          liquidityAction={<button>Existing liquidity action</button>}
        />,
      );
      expect(html).toContain(
        'aria-label="On this report"><p>On this report</p>',
      );
      for (const section of sections) {
        const id = html.match(
          new RegExp(`href="#([^"]+)" data-annual-report-jump="${section}"`),
        )?.[1];
        expect(id).toBeTruthy();
        const tag = html.match(
          new RegExp(
            `<[^>]+id="${id}"[^>]*data-annual-report-target="${section}"[^>]*>`,
          ),
        )?.[0];
        expect(tag).toBeTruthy();
        if (
          section === "cash" ||
          section === "liquidity" ||
          section === "operating"
        )
          expect(tag).toContain('tabindex="-1"');
        if (section === "income") expect(tag).toContain('tabindex="0"');
      }
      expect(html).toContain(
        '<details class="managed-annual-provenance"><summary',
      );
      expect(html).not.toContain(
        '<details class="managed-annual-provenance" open',
      );
      expect(html).toContain('class="sec-annual-liquidity-amount">2.50×');
      expect(html).toContain("Existing cash action");
      expect(html).toContain("Existing liquidity action");
      expect(html.indexOf('data-annual-report-target="cash"')).toBeLessThan(
        html.indexOf("Existing cash action"),
      );
      expect(
        html.indexOf('data-annual-report-target="liquidity"'),
      ).toBeLessThan(html.indexOf("Existing liquidity action"));
      expect(html).toContain("2026-09-20T00:00:02.000Z");
      expect(JSON.stringify(response)).toBe(before);
    },
  );

  it("keeps the income destination ahead of the full three-period table and unique per rendered report", async () => {
    const response = await annualComparisonResponse("left", {
      rows: annualHistoryRows(),
    });
    const html = renderToStaticMarkup(
      <>
        <SecAnnualEvidenceResult response={response} appearance="financial" />
        <SecAnnualEvidenceResult response={response} appearance="financial" />
      </>,
    );
    expect(html).toContain("Reported annual amounts · 3 periods");
    expect(html.indexOf('data-annual-report-target="income"')).toBeLessThan(
      html.indexOf("Reported annual amounts · 3 periods"),
    );
    const ids = [
      ...html.matchAll(/href="#([^"]+)" data-annual-report-jump=/gu),
    ].map((match) => match[1]);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });

  it("leaves the evidence profile and standalone shared headings outside managed navigation", async () => {
    const response = await annualComparisonResponse();
    const html = renderToStaticMarkup(
      <>
        <SecAnnualEvidenceResult response={response} />
        <SecAnnualCashGeneration response={response} />
        <SecAnnualLiquidity response={response} />
      </>,
    );
    expect(html).not.toContain("managed-annual-report-navigation");
    expect(html).not.toContain("data-annual-report-target");
    expect(html).toContain("<h4>Cash generation</h4>");
    expect(html).toContain("<h4>Liquidity at fiscal year-end</h4>");
  });
});
