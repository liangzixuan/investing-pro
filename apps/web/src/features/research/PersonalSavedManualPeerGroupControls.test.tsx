import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PersonalSavedManualPeerGroupControls,
  type PersonalSavedManualPeerGroupControlsProps,
} from "./PersonalSavedManualPeerGroupControls";

type Element = React.ReactElement<{
  children?: ReactNode;
  [key: string]: unknown;
}>;
let props: PersonalSavedManualPeerGroupControlsProps;
const member = (n: number) => ({
  country: "US" as const,
  exchangeMic: "XNAS",
  instrumentType: "common_stock" as const,
  issuerId: `issuer-${n}`,
  issuerName: `Company ${n}`,
  listingId: `listing-${n}`,
  securityId: `security-${n}`,
  securityName: `Security ${n}`,
  shareClassId: `class-${n}`,
  shareClassName: `Class ${n}`,
  symbol: `SYN${n}`,
});
const savedGroup = () => ({
  createdAgainstCatalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
  primary: member(1),
  peers: [member(3), member(2)],
});
const actionNames = [
  "Load saved peer group",
  "Save this peer group",
  "Restore saved peer group",
  "Clear saved peer group",
];

beforeEach(() => {
  props = {
    enabled: true,
    loaded: false,
    busy: false,
    message: "Load when ready.",
    currentPrimary: member(1),
    currentPeers: [member(2), member(3)],
    savedGroup: null,
    canSave: true,
    canRestore: true,
    canClear: true,
    saveUnavailableReason: null,
    restoreUnavailableReason: null,
    onLoad: vi.fn(),
    onSave: vi.fn(),
    onRestore: vi.fn(),
    onClear: vi.fn(),
  };
});

describe("PersonalSavedManualPeerGroupControls", () => {
  it("shows the current group without implying saved metadata or doing any work", () => {
    const view = PersonalSavedManualPeerGroupControls(props);
    expect(text(namedList(view, "Current peers in order"))).toContain("SYN2");
    expect(listSymbols(namedList(view, "Current peers in order"))).toEqual([
      "SYN2",
      "SYN3",
    ]);
    expect(renderToStaticMarkup(view)).toContain(
      "Primary company: </strong>SYN1",
    );
    expect(renderToStaticMarkup(view)).toContain(
      "Load saved peer group to see the group stored on this machine.",
    );
    expect(elements(view).some((node) => node.type === "form")).toBe(false);
    expect(button(view, actionNames[0]!).props.disabled).toBe(false);
    for (const name of actionNames.slice(1))
      expect(button(view, name).props.disabled).toBe(true);
    for (const callback of [
      props.onLoad,
      props.onSave,
      props.onRestore,
      props.onClear,
    ])
      expect(callback).not.toHaveBeenCalled();
  });

  it("preserves separately labeled current and loaded primary identities and peer order", () => {
    props = {
      ...props,
      loaded: true,
      savedGroup: { ...savedGroup(), primary: member(4) },
    };
    const view = PersonalSavedManualPeerGroupControls(props);
    expect(listSymbols(namedList(view, "Current peers in order"))).toEqual([
      "SYN2",
      "SYN3",
    ]);
    expect(listSymbols(namedList(view, "Loaded saved peers in order"))).toEqual(
      ["SYN3", "SYN2"],
    );
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain("Current peer group");
    expect(markup).toContain("Loaded saved peer group");
    expect(markup).toContain("SYN1");
    expect(markup).toContain("SYN4");
    expect(markup).not.toContain("No saved peer group.");
  });

  it("distinguishes missing current selection, no peers and a loaded empty slot", () => {
    props = {
      ...props,
      loaded: true,
      currentPrimary: null,
      currentPeers: [],
      canSave: false,
      canRestore: false,
      canClear: false,
    };
    const markup = renderToStaticMarkup(
      PersonalSavedManualPeerGroupControls(props),
    );
    expect(markup).toContain("Choose a company to research.");
    expect(markup).toContain("No peers selected.");
    expect(markup).toContain("No saved peer group.");
    expect(markup).not.toContain(
      "Load saved peer group to see the group stored",
    );
  });

  it("does not expose obsolete saved metadata when the controller marks it unloaded", () => {
    props = { ...props, currentPeers: [], savedGroup: savedGroup() };
    const view = PersonalSavedManualPeerGroupControls(props);
    expect(
      elements(view).some(
        (node) => node.props["aria-label"] === "Loaded saved peers in order",
      ),
    ).toBe(false);
    expect(renderToStaticMarkup(view)).not.toContain("SYN3");
  });

  it.each(["busy", "disabled"] as const)(
    "disables actions while %s while keeping loaded metadata visible",
    (state) => {
      props = {
        ...props,
        loaded: true,
        savedGroup: savedGroup(),
        busy: state === "busy",
        enabled: state !== "disabled",
        message: "Checking the current identities.",
      };
      const view = PersonalSavedManualPeerGroupControls(props);
      for (const name of actionNames)
        expect(button(view, name).props.disabled).toBe(true);
      expect(
        listSymbols(namedList(view, "Loaded saved peers in order")),
      ).toEqual(["SYN3", "SYN2"]);
      expect(elements(view)[0]!.props["aria-busy"]).toBe(state === "busy");
      const status = elements(view).find(
        (node) => node.props.role === "status",
      )!;
      expect(status.props.children).toBe(props.message);
    },
  );

  it("keeps a stable polite status separate from the identity lists", () => {
    props = { ...props, loaded: true, savedGroup: savedGroup() };
    const view = PersonalSavedManualPeerGroupControls(props);
    const status = elements(view).find((node) => node.props.role === "status")!;
    expect(status.props.id).toBe("saved-manual-peer-group-status");
    expect(status.props["aria-live"]).toBe("polite");
    expect(status.props["aria-atomic"]).toBe("true");
    expect(elements(status).some((node) => node.type === "ol")).toBe(false);
    expect(
      elements(view).filter((node) => node.props["aria-live"]),
    ).toHaveLength(1);
  });

  it("connects native keyboard buttons to the four independent explicit callbacks", () => {
    props = { ...props, loaded: true, savedGroup: savedGroup() };
    const view = PersonalSavedManualPeerGroupControls(props);
    const callbacks = [
      props.onLoad,
      props.onSave,
      props.onRestore,
      props.onClear,
    ];
    actionNames.forEach((name, index) => {
      const action = button(view, name);
      expect(action.props.type).toBe("button");
      expect(action.props.disabled).toBe(false);
      (action.props.onClick as () => void)();
      expect(callbacks[index]).toHaveBeenCalledExactlyOnceWith();
      callbacks
        .slice(index + 1)
        .forEach((callback) => expect(callback).not.toHaveBeenCalled());
    });
    expect(
      elements(view).filter((node) => node.type === "button"),
    ).toHaveLength(4);
  });

  it("explains independent save and restore constraints and allows orphan clearing", () => {
    props = {
      ...props,
      loaded: true,
      savedGroup: savedGroup(),
      canSave: false,
      canRestore: false,
      saveUnavailableReason: "Save requires current My Watchlist identities.",
      restoreUnavailableReason:
        "This saved primary is not the current company.",
    };
    const view = PersonalSavedManualPeerGroupControls(props);
    expect(button(view, "Save this peer group").props.disabled).toBe(true);
    expect(button(view, "Restore saved peer group").props.disabled).toBe(true);
    expect(button(view, "Clear saved peer group").props.disabled).toBe(false);
    for (const name of actionNames) {
      const describedBy = button(view, name).props["aria-describedby"];
      expect(
        elements(view).filter((node) => node.props.id === describedBy),
      ).toHaveLength(1);
    }
    expect(renderToStaticMarkup(view)).toContain(props.saveUnavailableReason!);
    expect(renderToStaticMarkup(view)).toContain(
      props.restoreUnavailableReason!,
    );
  });

  it("discloses replacement and source-loading semantics without claiming saved results", () => {
    const markup = renderToStaticMarkup(
      PersonalSavedManualPeerGroupControls(props),
    );
    for (const phrase of [
      "one to three ordered peers",
      "stores company identities only",
      "Sources require explicit loads",
      "Load changes only the saved group",
      "Restore replaces all current",
      "clears their loaded sources",
      "Clear removes only the saved group",
      "keeps the current peers and their sources",
    ])
      expect(markup.replace(/\s+/gu, " ")).toContain(phrase);
  });

  it("escapes and retains complete long names in bounded, wrapping roster structures", () => {
    const longName = `<script>bad</script>${"LongCompany".repeat(45)}`;
    props = {
      ...props,
      loaded: true,
      currentPrimary: { symbol: "TEST", issuerName: longName },
      currentPeers: [{ symbol: "PEER", issuerName: longName }],
      savedGroup: {
        ...savedGroup(),
        primary: { ...member(1), issuerName: longName },
      },
    };
    const view = PersonalSavedManualPeerGroupControls(props);
    const markup = renderToStaticMarkup(view);
    expect(markup).not.toContain("<script>");
    expect(markup).toContain("&lt;script&gt;bad&lt;/script&gt;");
    expect(markup).toContain("LongCompany".repeat(45));
    expect(
      elements(view).filter(
        (node) => node.props.className === "saved-manual-peer-group-rosters",
      ),
    ).toHaveLength(1);
    expect(
      elements(view).some((node) => node.props.dangerouslySetInnerHTML),
    ).toBe(false);
    expect(props.onLoad).not.toHaveBeenCalled();
  });
});

function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement(node)
    ? text((node as Element).props.children)
    : "";
}
function button(view: ReactNode, name: string): Element {
  const match = elements(view).find(
    (node) => node.type === "button" && text(node.props.children) === name,
  );
  if (!match) throw new Error(`Missing button ${name}`);
  return match;
}
function namedList(view: ReactNode, name: string): Element {
  const match = elements(view).find(
    (node) => node.type === "ol" && node.props["aria-label"] === name,
  );
  if (!match) throw new Error(`Missing list ${name}`);
  return match;
}
function listSymbols(view: ReactNode): string[] {
  return elements(view)
    .filter((node) => node.type === "strong")
    .map((node) => text(node.props.children));
}
