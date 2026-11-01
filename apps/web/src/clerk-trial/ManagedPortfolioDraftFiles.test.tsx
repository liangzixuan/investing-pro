import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { ManagedPortfolioPayload } from "@research-cockpit/contracts";
import type { PortfolioDraftRecoveryState } from "./managed-portfolio-draft-recovery";
import type { ManagedWorkspace } from "./managed-workspace";
import { ManagedPortfolioDraftFiles } from "./ManagedPortfolioDraftFiles";
import { ManagedPortfolioEntry } from "./ManagedPortfolioEntry";
import { ManagedPortfolio } from "./ManagedPortfolio";

// Command/render checks only; actual browser focus and native IO remain separate.
const harness = vi.hoisted(() => ({
  state: null as PortfolioDraftRecoveryState | null,
  controller: {
    subscribe: vi.fn(() => () => {}),
    getSnapshot: vi.fn<() => PortfolioDraftRecoveryState>(),
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
vi.mock("./managed-portfolio-draft-recovery", () => ({
  ManagedPortfolioDraftRecovery: vi.fn(() => harness.controller),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: () => [harness.controller, vi.fn()],
  useRef: (current: unknown) => ({ current }),
  useLayoutEffect: () => {},
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
}));
const ledger: ManagedPortfolioPayload = {
  schemaVersion: 3,
  name: "My Portfolio",
  currency: "USD",
  basisMethod: "fifo_with_opening_pool",
  snapshotSha256: `sha256:${"a".repeat(64)}`,
  identities: [],
  opening: { asOfDate: "2026-10-01", cashUsd: null, holdings: [] },
  transactions: [
    {
      id: "first-cash",
      date: "2026-10-02",
      type: "deposit",
      listingId: null,
      shares: null,
      grossUsd: "7.00",
      feeUsd: "0.00",
    },
    {
      id: "second-cash",
      date: "2026-10-02",
      type: "withdrawal",
      listingId: null,
      shares: null,
      grossUsd: "2.00",
      feeUsd: "0.00",
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
  const tree = ManagedPortfolioDraftFiles({
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
it("renders both complete ledgers, keeps claimed file base separate and restores only on its explicit button", () => {
  harness.state = {
    ...harness.state!,
    phase: "review",
    canExport: false,
    currentDraft: {
      ledger: { ...ledger, opening: { ...ledger.opening, cashUsd: "350.00" } },
    },
    currentSavedVersion: 9,
    preview: {
      format: "investment-portfolio-draft",
      version: 1,
      accountScope: `sha256:${"b".repeat(64)}`,
      capturedAt: "2026-10-21T10:00:00.000Z",
      baseVersion: 2,
      draft: ledger,
    },
  };
  const { tree, restored } = fixture();
  const markup = renderToStaticMarkup(tree);
  expect(markup).toContain("Loaded saved version 9");
  expect(markup).toContain("base version 2");
  expect(markup).toContain("350.00");
  expect(markup).toContain("Unknown");
  expect(markup).toContain("7.00");
  expect(markup).toContain("2.00");
  expect(markup.indexOf("first-cash")).toBeLessThan(
    markup.indexOf("second-cash"),
  );
  expect(markup).toContain("Review catalog identities");
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

it("keeps the Portfolio entry hidden on invalid roots and passes the same live route check to file tools", () => {
  let valid = false;
  const routeActive = () => valid;
  const props = {
    workspace: {} as ManagedWorkspace,
    discovery: {
      view: "portfolio" as const,
      research: null,
      companyRoute: null,
    },
    navigationPending: false,
    onResearch: vi.fn(),
    navigation: { active: routeActive, view: vi.fn(() => true) },
    datedReviewNavigation: { navigate: () => false, transferred: vi.fn() },
  };
  type EntryElement = React.ReactElement<{
    hidden: boolean;
    children: React.ReactNode;
  }>;
  const hidden = ManagedPortfolioEntry(props)! as EntryElement;
  expect(hidden.props.hidden).toBe(true);
  const panel = hidden.props.children as React.ReactElement<
    React.ComponentProps<typeof ManagedPortfolio>
  >;
  expect(panel.type).toBe(ManagedPortfolio);
  expect(panel.props.draftFileRouteActive).toBe(routeActive);
  panel.props.onReviewWatchlist();
  expect(props.navigation.view).toHaveBeenCalledExactlyOnceWith("watchlist");
  valid = true;
  expect(panel.props.draftFileRouteActive!()).toBe(true);
  expect((ManagedPortfolioEntry(props) as EntryElement).props.hidden).toBe(
    false,
  );
  expect(
    ManagedPortfolioEntry({
      ...props,
      discovery: { view: "markets", research: null, companyRoute: null },
    }),
  ).toBeNull();
});
