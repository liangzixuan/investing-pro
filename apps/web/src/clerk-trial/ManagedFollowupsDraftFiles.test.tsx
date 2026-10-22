import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { ResearchFollowupsPayload } from "@research-cockpit/contracts";
import type { FollowupsDraftRecoveryState } from "./managed-followups-draft-recovery";
import type { ManagedWorkspace } from "./managed-workspace";
import { ManagedFollowupsDraftFiles } from "./ManagedFollowupsDraftFiles";

// Command/render checks only; actual browser focus and native IO remain separate.
const harness = vi.hoisted(() => ({
  state: null as FollowupsDraftRecoveryState | null,
  controller: {
    subscribe: vi.fn(() => () => {}),
    getSnapshot: vi.fn<() => FollowupsDraftRecoveryState>(),
    reconcile: vi.fn(),
    dispose: vi.fn(),
    exportDraft: vi.fn(async () => {}),
    readFile: vi
      .fn<(file: File) => Promise<void>>()
      .mockResolvedValue(undefined),
    restoreDraft: vi.fn(() => true),
    cancel: vi.fn(),
  },
}));
vi.mock("./managed-followups-draft-recovery", () => ({
  ManagedFollowupsDraftRecovery: vi.fn(() => harness.controller),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: () => [harness.controller, vi.fn()],
  useRef: (current: unknown) => ({ current }),
  useLayoutEffect: () => {},
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
}));
const draft: ResearchFollowupsPayload = {
  schemaVersion: 1,
  entries: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
      listing: {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "invented-issuer",
        issuerName: "Invented issuer",
        listingId: "invented-listing",
        securityId: "invented-security",
        securityName: "Common stock",
        shareClassId: "invented-class",
        shareClassName: "Class A",
        symbol: "DEMO",
      },
      check: "Full file check 😀",
      dueOn: "2026-10-23",
      status: "completed",
      completedOn: "2026-10-21",
      result: "Full file result",
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  harness.controller.restoreDraft.mockReturnValue(true);
  harness.state = {
    phase: "idle",
    preview: null,
    currentDraft: null,
    currentSavedVersion: null,
    canExport: true,
    canImport: true,
    message: "",
  };
  harness.controller.getSnapshot.mockImplementation(() => harness.state!);
});
function fixture() {
  const restored = vi.fn();
  const tree = ManagedFollowupsDraftFiles({
    workspace: {} as ManagedWorkspace,
    accountScope: Promise.resolve(`sha256:${"b".repeat(64)}`),
    delivery: undefined,
    routeActive: () => true,
    onRestored: restored,
  });
  return { tree, restored };
}
type Element = React.ReactElement<Record<string, unknown>>;
function elements(node: React.ReactNode): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === "function")
    return elements(
      (node.type as (props: unknown) => React.ReactNode)(node.props),
    );
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function content(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(content).join("");
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return "";
  return content(node.props.children);
}
function button(tree: React.ReactNode, label: string) {
  return elements(tree).find(
    (n) => n.type === "button" && content(n) === label,
  )!;
}
it("only reads the selected file, clears its input for a later explicit selection and binds export", () => {
  const { tree, restored } = fixture();
  const input = elements(tree).find((n) => n.type === "input")!;
  const file = {} as File;
  const currentTarget = { files: [file], value: "selected" };
  (input.props.onChange as (event: unknown) => void)({ currentTarget });
  expect(currentTarget.value).toBe("");
  expect(harness.controller.readFile).toHaveBeenCalledWith(file);
  expect(harness.controller.restoreDraft).not.toHaveBeenCalled();
  expect(restored).not.toHaveBeenCalled();
  (button(tree, "Save draft file").props.onClick as () => void)();
  expect(harness.controller.exportDraft).toHaveBeenCalledOnce();
});
it("renders every file and current check and result before explicit restoration", () => {
  harness.state = {
    ...harness.state!,
    phase: "review",
    canExport: false,
    currentDraft: {
      schemaVersion: 1,
      entries: [
        {
          ...draft.entries[0]!,
          check: "Current unsaved check",
          result: "Current unsaved result",
        },
      ],
    },
    currentSavedVersion: 9,
    preview: {
      format: "investment-followups-draft",
      version: 1,
      accountScope: `sha256:${"b".repeat(64)}`,
      capturedAt: "2026-10-21T10:00:00.000Z",
      baseVersion: 2,
      draft,
    },
  };
  const { tree, restored } = fixture();
  const markup = renderToStaticMarkup(tree);
  for (const text of [
    "Loaded saved version 9",
    "base version 2",
    "Full file check 😀",
    "Full file result",
    "Current unsaved check",
    "Current unsaved result",
    "invented-security",
    "Completed 2026-10-21 UTC.",
    "Review identities",
  ])
    expect(markup).toContain(text);
  expect(harness.controller.restoreDraft).not.toHaveBeenCalled();
  (button(tree, "Restore file to current draft").props.onClick as () => void)();
  expect(restored).toHaveBeenCalledOnce();
  harness.controller.restoreDraft.mockReturnValue(false);
  (button(tree, "Restore file to current draft").props.onClick as () => void)();
  expect(restored).toHaveBeenCalledOnce();
  (button(tree, "Keep current draft").props.onClick as () => void)();
  expect(harness.controller.cancel).toHaveBeenCalledOnce();
});
it("disables file controls until the controller admits the current session and draft", () => {
  harness.state = { ...harness.state!, canExport: false, canImport: false };
  const { tree } = fixture();
  expect(button(tree, "Save draft file").props.disabled).toBe(true);
  expect(elements(tree).find((n) => n.type === "input")!.props.disabled).toBe(
    true,
  );
});
