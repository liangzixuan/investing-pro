import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PersonalCompanyResearchNote,
  type PersonalCompanyResearchNoteProps,
} from "./PersonalCompanyResearchNote";

type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = React.ReactElement<ElementProps>;
let props: PersonalCompanyResearchNoteProps;

beforeEach(() => {
  props = {
    value: "Existing watchlist note",
    disabled: false,
    message: null,
    onChange: vi.fn(),
    onSave: vi.fn(),
  };
});

describe("PersonalCompanyResearchNote", () => {
  it("labels the bounded editor and connects its hint and persistent status", () => {
    const view = PersonalCompanyResearchNote(props);
    const nodes = elements(view);
    const textarea = nodeOfType(view, "textarea");
    const label = nodeOfType(view, "label");
    expect(label.props.children).toBe("My Watchlist research note");
    expect(label.props.htmlFor).toBe("company-watchlist-note");
    expect(textarea.props.id).toBe(label.props.htmlFor);
    expect(textarea.props.maxLength).toBe(2000);
    expect(textarea.props.value).toBe(props.value);
    for (const id of (textarea.props["aria-describedby"] as string).split(
      " ",
    )) {
      expect(nodes.filter((node) => node.props.id === id)).toHaveLength(1);
    }
    const status = nodes.find((node) => node.props.role === "status")!;
    expect(status.props["aria-live"]).toBe("polite");
    expect(status.props["aria-atomic"]).toBe("true");
    expect(status.props.children).toBeNull();
    expect(renderToStaticMarkup(view)).toContain("save changes explicitly.");
    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("forwards raw edits for parent validation without saving or normalizing", () => {
    const textarea = nodeOfType(PersonalCompanyResearchNote(props), "textarea");
    const raw = " \tGrowth thesis\nKeep the raw draft.\u0001  ";
    (textarea.props.onChange as (event: unknown) => void)({
      currentTarget: { value: raw },
    });
    expect(props.onChange).toHaveBeenCalledExactlyOnceWith(raw);
    expect(props.onSave).not.toHaveBeenCalled();
    expect(
      nodeOfType(PersonalCompanyResearchNote(props), "textarea").props.value,
    ).toBe("Existing watchlist note");
    props = { ...props, value: raw };
    expect(
      nodeOfType(PersonalCompanyResearchNote(props), "textarea").props.value,
    ).toBe(raw);
  });

  it("saves only through the explicit non-submit button", () => {
    const button = nodeOfType(PersonalCompanyResearchNote(props), "button");
    expect(button.props.children).toBe("Save research note");
    expect(button.props.type).toBe("button");
    (button.props.onClick as () => void)();
    expect(props.onSave).toHaveBeenCalledExactlyOnceWith();
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("disables editing and saving together while retaining the supplied draft and feedback", () => {
    props = {
      ...props,
      disabled: true,
      value: "Unsaved research",
      message: "Saving research note…",
    };
    const view = PersonalCompanyResearchNote(props);
    expect(nodeOfType(view, "textarea").props.disabled).toBe(true);
    expect(nodeOfType(view, "button").props.disabled).toBe(true);
    expect(nodeOfType(view, "textarea").props.value).toBe(props.value);
    expect(
      elements(view).find((node) => node.props.role === "status")?.props
        .children,
    ).toBe(props.message);
    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("renders supplied feedback as text and clears it without retaining another draft", () => {
    props = { ...props, message: "Review <saved note> before retrying." };
    expect(renderToStaticMarkup(PersonalCompanyResearchNote(props))).toContain(
      "Review &lt;saved note&gt; before retrying.",
    );
    props = { ...props, value: "Another company's note", message: null };
    const view = PersonalCompanyResearchNote(props);
    expect(nodeOfType(view, "textarea").props.value).toBe(props.value);
    expect(
      elements(view).find((node) => node.props.role === "status")?.props
        .children,
    ).toBeNull();
    expect(props.onSave).not.toHaveBeenCalled();
  });
});

function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}

function nodeOfType(view: ReactNode, type: string): Element {
  const matches = elements(view).filter((node) => node.type === type);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}
