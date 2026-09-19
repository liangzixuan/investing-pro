import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PersonalSavedDcfAssumptionsControls,
  type PersonalSavedDcfAssumptionsComparison,
  type PersonalSavedDcfAssumptionsControlsProps,
} from "./PersonalSavedDcfAssumptionsControls";

type Element = React.ReactElement<{
  children?: ReactNode;
  [key: string]: unknown;
}>;
let props: PersonalSavedDcfAssumptionsControlsProps;

beforeEach(() => {
  props = {
    symbol: "SYN001",
    busy: false,
    loaded: false,
    count: 0,
    canSave: true,
    canRestore: true,
    saveUnavailableReason: null,
    message: "Load your saved assumptions when ready.",
    draftIsSaved: false,
    entries: [],
    comparison: null,
    onLoad: vi.fn(),
    onSave: vi.fn(),
    onRestore: vi.fn(),
    onClear: vi.fn(),
  };
});

describe("PersonalSavedDcfAssumptionsControls", () => {
  it("requires an explicit load and makes no callback while rendering", () => {
    const view = PersonalSavedDcfAssumptionsControls(props);
    expect(button(view, "Load saved assumptions").props.disabled).toBe(false);
    expect(button(view, "Save assumptions for SYN001").props.disabled).toBe(
      true,
    );
    expect(button(view, "Restore saved assumptions").props.disabled).toBe(true);
    expect(renderToStaticMarkup(view)).toContain("up to 20 companies");
    expect(renderToStaticMarkup(view)).not.toContain("0 of 20 companies saved");
    expect(elements(view).filter((node) => node.type === "form")).toHaveLength(
      0,
    );
    for (const handler of [
      props.onLoad,
      props.onSave,
      props.onRestore,
      props.onClear,
    ])
      expect(handler).not.toHaveBeenCalled();
    click(button(view, "Load saved assumptions"));
    expect(props.onLoad).toHaveBeenCalledExactlyOnceWith();
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onRestore).not.toHaveBeenCalled();
  });

  it("separates restore, reset and clear semantics and connects accessible descriptions", () => {
    props = { ...props, loaded: true };
    const view = PersonalSavedDcfAssumptionsControls(props);
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain("Restore replaces all seven current inputs.");
    expect(markup).toContain("It does not load provider data.");
    expect(markup).toContain(
      "Reset illustrative assumptions changes only the current inputs",
    );
    expect(markup).toContain(
      "removes a saved set and keeps the current inputs",
    );
    expect(markup).toContain("No DCF assumptions saved yet.");
    for (const name of [
      "Save assumptions for SYN001",
      "Restore saved assumptions",
    ]) {
      const action = button(view, name);
      expect(action.props.type).toBe("button");
      expect(
        elements(view).filter(
          (node) => node.props.id === action.props["aria-describedby"],
        ),
      ).toHaveLength(1);
    }
    click(button(view, "Save assumptions for SYN001"));
    click(button(view, "Restore saved assumptions"));
    expect(props.onSave).toHaveBeenCalledExactlyOnceWith();
    expect(props.onRestore).toHaveBeenCalledExactlyOnceWith();
    expect(props.onClear).not.toHaveBeenCalled();
  });

  it("allows explicit clearing of unsupported and other-company entries by exact listing ID", () => {
    props = {
      ...props,
      loaded: true,
      count: 2,
      entries: [
        {
          listingId: "lst-a",
          symbol: "SYN001",
          issuerName: "Current Company",
          modelSupported: true,
          isCurrentCompany: true,
        },
        {
          listingId: "lst-orphan",
          symbol: "OLD",
          issuerName: "Historical Identity",
          modelSupported: false,
          isCurrentCompany: false,
        },
      ],
    };
    const view = PersonalSavedDcfAssumptionsControls(props);
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain("2 of 20 companies saved");
    expect(markup).toContain("Current company");
    expect(markup).toContain(
      "Unsupported model version. This saved set cannot be restored.",
    );
    const clear = button(view, "Clear saved assumptions for OLD");
    expect(clear.props.disabled).toBe(false);
    expect(clear.props["aria-label"]).toBe(
      "Clear saved assumptions for OLD (Historical Identity)",
    );
    click(clear);
    expect(props.onClear).toHaveBeenCalledExactlyOnceWith("lst-orphan");
    expect(props.onRestore).not.toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("disables every explicit operation while busy without changing supplied feedback", () => {
    props = {
      ...props,
      busy: true,
      loaded: true,
      count: 1,
      message: "Saving the submitted inputs; newer edits remain in the form.",
      entries: [
        {
          listingId: "lst-a",
          symbol: "SYN001",
          issuerName: "Current Company",
          modelSupported: true,
          isCurrentCompany: true,
        },
      ],
    };
    const view = PersonalSavedDcfAssumptionsControls(props);
    expect(
      elements(view)
        .filter((node) => node.type === "button")
        .every((node) => node.props.disabled === true),
    ).toBe(true);
    expect(elements(view)[0]?.props["aria-busy"]).toBe(true);
    const status = elements(view).find((node) => node.props.role === "status")!;
    expect(status.props.children).toBe(props.message);
    expect(status.props["aria-live"]).toBe("polite");
    expect(status.props["aria-atomic"]).toBe("true");
    expect(props.onLoad).not.toHaveBeenCalled();
    expect(props.onClear).not.toHaveBeenCalled();
  });

  it("respects save and restore eligibility independently and explains invalid raw drafts", () => {
    props = {
      ...props,
      loaded: true,
      canSave: false,
      canRestore: true,
      saveUnavailableReason: "Complete the WACC input before saving.",
    };
    const view = PersonalSavedDcfAssumptionsControls(props);
    expect(button(view, "Save assumptions for SYN001").props.disabled).toBe(
      true,
    );
    expect(button(view, "Restore saved assumptions").props.disabled).toBe(
      false,
    );
    expect(renderToStaticMarkup(view)).toContain(props.saveUnavailableReason!);
    props = {
      ...props,
      canSave: true,
      canRestore: false,
      saveUnavailableReason: null,
    };
    const next = PersonalSavedDcfAssumptionsControls(props);
    expect(button(next, "Save assumptions for SYN001").props.disabled).toBe(
      false,
    );
    expect(button(next, "Restore saved assumptions").props.disabled).toBe(true);
  });

  it("keeps replacement possible at capacity and does not silently omit entries", () => {
    props = {
      ...props,
      loaded: true,
      count: 20,
      entries: Array.from({ length: 20 }, (_, index) => ({
        listingId: `lst-${index}`,
        symbol: `SYN${index}`,
        issuerName: `Company ${index}`,
        modelSupported: true,
        isCurrentCompany: index === 0,
      })),
    };
    const view = PersonalSavedDcfAssumptionsControls(props);
    expect(elements(view).filter((node) => node.type === "li")).toHaveLength(
      20,
    );
    expect(renderToStaticMarkup(view)).toContain("20 of 20 companies saved");
    expect(button(view, "Save assumptions for SYN001").props.disabled).toBe(
      false,
    );
    props = {
      ...props,
      canSave: false,
      saveUnavailableReason: "Clear a saved company before adding another set.",
    };
    expect(
      button(
        PersonalSavedDcfAssumptionsControls(props),
        "Save assumptions for SYN001",
      ).props.disabled,
    ).toBe(true);
  });

  it("changes saved-draft feedback from fresh props and hides stale entries until reloaded", () => {
    props = {
      ...props,
      loaded: true,
      draftIsSaved: true,
      count: 1,
      entries: [
        {
          listingId: "lst-a",
          symbol: "SYN001",
          issuerName: "Current Company",
          modelSupported: true,
          isCurrentCompany: true,
        },
      ],
    };
    expect(
      renderToStaticMarkup(PersonalSavedDcfAssumptionsControls(props)),
    ).toContain("current inputs match this company&#x27;s saved assumptions");
    props = { ...props, draftIsSaved: false };
    expect(
      renderToStaticMarkup(PersonalSavedDcfAssumptionsControls(props)),
    ).toContain("current inputs are not saved");
    props = { ...props, loaded: false };
    const view = PersonalSavedDcfAssumptionsControls(props);
    expect(elements(view).filter((node) => node.type === "li")).toHaveLength(0);
    expect(button(view, "Load saved assumptions").props.disabled).toBe(false);
    expect(button(view, "Save assumptions for SYN001").props.disabled).toBe(
      true,
    );
  });

  it("preserves long identity labels as escaped text in the existing wrapping layout", () => {
    const issuerName = `<${"Z".repeat(512)}>`;
    props = {
      ...props,
      loaded: true,
      count: 1,
      entries: [
        {
          listingId: "lst-long",
          symbol: "LONG",
          issuerName,
          modelSupported: true,
          isCurrentCompany: false,
        },
      ],
    };
    const view = PersonalSavedDcfAssumptionsControls(props);
    expect(renderToStaticMarkup(view)).toContain(`&lt;${"Z".repeat(512)}&gt;`);
    expect(
      elements(view).find((node) => node.type === "ul")?.props.className,
    ).toBe("financial-comparison-saved-companies");
    expect(elements(view).every((node) => node.props.style === undefined)).toBe(
      true,
    );
    expect(props.onClear).not.toHaveBeenCalled();
  });

  it("presents all seven supplied raw and saved values with semantic headers and explicit units", () => {
    props = { ...props, loaded: true, comparison: comparison() };
    const view = PersonalSavedDcfAssumptionsControls(props);
    const table = elements(view).find((node) => node.type === "table")!;
    const caption = elements(table).find((node) => node.type === "caption")!;
    expect(text(caption)).toBe(
      "SYN001: current draft and loaded saved DCF inputs. This compares assumptions, not company value.",
    );
    expect(
      elements(table)
        .filter((node) => node.type === "th" && node.props.scope === "col")
        .map(text),
    ).toEqual(["Input", "Current draft", "Loaded saved", "Comparison"]);
    const body = elements(table).find((node) => node.type === "tbody")!;
    const rows = elements(body).filter((node) => node.type === "tr");
    expect(rows).toHaveLength(7);
    expect(
      elements(body).filter(
        (node) => node.type === "th" && node.props.scope === "row",
      ),
    ).toHaveLength(7);
    expect(text(rows[0])).toBe("Forecast horizon7 years7 yearsSame");
    expect(
      elements(rows[2])
        .filter((node) => node.type === "th" || node.type === "td")
        .map(text),
    ).toEqual(["WACC assumption", "12.3 %", "12.3000 %", "Same"]);
    expect(text(rows[3])).toBe("Terminal growth3 %2.0000 %Changed");
    expect(renderToStaticMarkup(view)).toContain(
      "1 of 7 inputs differ from the loaded saved set.",
    );
    for (const handler of [
      props.onLoad,
      props.onSave,
      props.onRestore,
      props.onClear,
    ])
      expect(handler).not.toHaveBeenCalled();
  });

  it("keeps a supplied comparison visible while busy and places it outside the live status", () => {
    props = {
      ...props,
      loaded: true,
      busy: true,
      canSave: false,
      canRestore: false,
      comparison: comparison(),
      message: "Saving the submitted set; newer edits are kept.",
    };
    const view = PersonalSavedDcfAssumptionsControls(props);
    const status = elements(view).find((node) => node.props.role === "status")!;
    expect(text(status)).toBe(props.message);
    expect(elements(status).some((node) => node.type === "table")).toBe(false);
    expect(elements(view).filter((node) => node.type === "table")).toHaveLength(
      1,
    );
    expect(
      elements(view)
        .filter((node) => node.type === "button")
        .every((node) => node.props.disabled === true),
    ).toBe(true);
    const liveRegions = elements(view).filter(
      (node) => node.props["aria-live"],
    );
    expect(liveRegions).toEqual([status]);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("hides unloaded or ineligible comparison data instead of showing retained saved inputs", () => {
    props = { ...props, loaded: true, comparison: comparison() };
    expect(
      elements(PersonalSavedDcfAssumptionsControls(props)).some(
        (node) => node.type === "table",
      ),
    ).toBe(true);
    props = { ...props, loaded: false };
    const unloaded = PersonalSavedDcfAssumptionsControls(props);
    expect(elements(unloaded).some((node) => node.type === "table")).toBe(
      false,
    );
    expect(renderToStaticMarkup(unloaded)).not.toContain("12.3000");
    props = { ...props, loaded: true, comparison: null };
    const ineligible = PersonalSavedDcfAssumptionsControls(props);
    expect(elements(ineligible).some((node) => node.type === "table")).toBe(
      false,
    );
    expect(renderToStaticMarkup(ineligible)).not.toContain("inputs differ");
  });

  it("shows invalid whole-draft states without numeric counts and escapes unbounded raw text", () => {
    const invalid = `<img src=x onerror=alert(1)>${"Z".repeat(1024)}&`;
    const supplied = comparison();
    props = {
      ...props,
      loaded: true,
      comparison: {
        changedCount: null,
        rows: supplied.rows.map((row, index) => ({
          ...row,
          currentValue:
            index === 0 ? "" : index === 2 ? invalid : row.currentValue,
          state: "unavailable",
        })),
      },
    };
    const view = PersonalSavedDcfAssumptionsControls(props);
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain(
      "Enter a valid, complete set of all seven assumptions to compare values.",
    );
    expect(markup).not.toContain("inputs differ from");
    expect(
      elements(view).filter(
        (node) => node.type === "td" && text(node) === "Unavailable",
      ),
    ).toHaveLength(7);
    expect(markup).toContain("Not entered");
    expect(markup).toContain(
      `&lt;img src=x onerror=alert(1)&gt;${"Z".repeat(1024)}&amp;`,
    );
    expect(markup).not.toContain("<img");
    expect(markup).toContain("12.3000");
    expect(
      elements(view).every(
        (node) => node.props.dangerouslySetInnerHTML === undefined,
      ),
    ).toBe(true);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("updates comparison text only from fresh supplied props without changing the action structure", () => {
    props = { ...props, loaded: true, comparison: comparison() };
    const before = PersonalSavedDcfAssumptionsControls(props);
    props = {
      ...props,
      comparison: {
        changedCount: 2,
        rows: props.comparison!.rows.map((row) =>
          row.input === "waccPercent"
            ? { ...row, currentValue: "16", state: "changed" }
            : row,
        ),
      },
    };
    const after = PersonalSavedDcfAssumptionsControls(props);
    expect(renderToStaticMarkup(after)).toContain("2 of 7 inputs differ");
    const updatedWacc = elements(after).find(
      (node) =>
        node.type === "tr" &&
        elements(node).some(
          (cell) => cell.type === "th" && text(cell) === "WACC assumption",
        ),
    )!;
    expect(
      elements(updatedWacc)
        .filter((node) => node.type === "th" || node.type === "td")
        .map(text),
    ).toEqual(["WACC assumption", "16 %", "12.3000 %", "Changed"]);
    expect(
      elements(after)
        .filter((node) => node.type === "button")
        .map((node) => [text(node), node.props.onClick]),
    ).toEqual(
      elements(before)
        .filter((node) => node.type === "button")
        .map((node) => [text(node), node.props.onClick]),
    );
    expect(props.onLoad).not.toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("provides an accessible keyboard scroll region and preserves raw spacing without an inline layout", () => {
    const supplied = comparison();
    props = {
      ...props,
      loaded: true,
      comparison: {
        ...supplied,
        rows: supplied.rows.map((row) =>
          row.input === "waccPercent"
            ? { ...row, currentValue: " 12.3 " }
            : row,
        ),
      },
    };
    const view = PersonalSavedDcfAssumptionsControls(props);
    const region = elements(view).find((node) => node.props.role === "region")!;
    expect(region.props.tabIndex).toBe(0);
    expect(region.props["aria-label"]).toBe(
      "SYN001 saved DCF input comparison",
    );
    expect(
      elements(view).filter(
        (node) => node.props.id === region.props["aria-describedby"],
      ),
    ).toHaveLength(1);
    const raw = elements(region).find(
      (node) => node.type === "span" && node.props.children === " 12.3 ",
    )!;
    expect(raw.props.className).toBe("saved-dcf-input-comparison-value");
    expect(elements(view).every((node) => node.props.style === undefined)).toBe(
      true,
    );
  });
});

function comparison(): PersonalSavedDcfAssumptionsComparison {
  return {
    changedCount: 1,
    rows: [
      {
        input: "forecastYears",
        label: "Forecast horizon",
        currentValue: "7",
        savedValue: "7",
        unit: "years",
        state: "same",
      },
      {
        input: "taxShieldRatePercent",
        label: "Marginal tax-shield rate assumption",
        currentValue: "21",
        savedValue: "21.0000",
        unit: "%",
        state: "same",
      },
      {
        input: "waccPercent",
        label: "WACC assumption",
        currentValue: "12.3",
        savedValue: "12.3000",
        unit: "%",
        state: "same",
      },
      {
        input: "terminalGrowthPercent",
        label: "Terminal growth",
        currentValue: "3",
        savedValue: "2.0000",
        unit: "%",
        state: "changed",
      },
      {
        input: "conservative",
        label: "Conservative annual FCF-proxy growth",
        currentValue: "0",
        savedValue: "0.0000",
        unit: "%",
        state: "same",
      },
      {
        input: "base",
        label: "Base annual FCF-proxy growth",
        currentValue: "5",
        savedValue: "5.0000",
        unit: "%",
        state: "same",
      },
      {
        input: "expansion",
        label: "Expansion annual FCF-proxy growth",
        currentValue: "10",
        savedValue: "10.0000",
        unit: "%",
        state: "same",
      },
    ],
  };
}

function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (
    !React.isValidElement<{ children?: ReactNode; [key: string]: unknown }>(
      node,
    )
  )
    return [];
  return [node, ...elements(node.props.children)];
}

function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement<{ children?: ReactNode }>(node)
    ? text(node.props.children)
    : "";
}

function button(view: ReactNode, name: string): Element {
  const matches = elements(view).filter(
    (node) => node.type === "button" && text(node.props.children) === name,
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function click(element: Element): void {
  (element.props.onClick as () => void)();
}
