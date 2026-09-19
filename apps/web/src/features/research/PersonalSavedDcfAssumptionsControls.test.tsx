import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PersonalSavedDcfAssumptionsControls,
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
});

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
