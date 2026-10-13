import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThirdPartyNotices } from "./ThirdPartyNotices";
import { loadThirdPartyNotices } from "./load-third-party-notices";

// Controlled hooks verify state and operation lifetime. Browser/native journeys
// separately check actual disclosure focus and offline license rendering.
const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  stateIndex: 0,
  refIndex: 0,
  cleanup: undefined as (() => void) | undefined,
  updates: 0,
}));
vi.mock("./load-third-party-notices", () => ({
  loadThirdPartyNotices: vi.fn(),
}));
vi.mock("react", async (importReact) => ({
  ...(await importReact<typeof React>()),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [
      hooks.states[index],
      (value: unknown) => {
        hooks.states[index] = value;
        hooks.updates++;
      },
    ];
  },
  useRef: (initial: unknown) =>
    (hooks.refs[hooks.refIndex++] ??= { current: initial }),
  useEffect: (effect: () => () => void) => {
    hooks.cleanup ??= effect();
  },
}));

function deferred() {
  let resolve!: (text: string) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<string>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function elements(
  node: React.ReactNode,
): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function render() {
  hooks.stateIndex = 0;
  hooks.refIndex = 0;
  const nodes = elements(ThirdPartyNotices());
  const main = nodes.find((node) => node.type === "button")!;
  const section = nodes.find((node) => node.type === "section")!;
  return {
    click: main.props.onClick as () => void,
    expanded: main.props["aria-expanded"],
    hidden: section.props.hidden,
    sectionId: section.props.id,
    statuses: nodes
      .filter((node) => node.props.role === "status")
      .map((node) => node.props.children),
    text: nodes.find((node) => node.type === "pre")?.props.children,
    retry: nodes.find((node) => node.type === "button" && node !== main)?.props
      .onClick as (() => void) | undefined,
  };
}
beforeEach(() => {
  hooks.states = [];
  hooks.refs = [];
  hooks.cleanup = undefined;
  hooks.updates = 0;
  vi.mocked(loadThirdPartyNotices).mockReset();
});

describe("software license disclosure", () => {
  it("starts closed without decoding and retains the accessible region", () => {
    expect(render()).toMatchObject({
      expanded: false,
      hidden: true,
      sectionId: "trial-license-text",
      text: undefined,
    });
    expect(loadThirdPartyNotices).not.toHaveBeenCalled();
  });

  it("admits one load across rapid clicks and hide/reopen while pending", async () => {
    const pending = deferred();
    vi.mocked(loadThirdPartyNotices).mockReturnValue(pending.promise);
    const initial = render();
    initial.click();
    initial.click();
    expect(render().statuses).toEqual(["Loading software licenses…"]);
    render().click();
    expect(render().hidden).toBe(true);
    render().click();
    expect(loadThirdPartyNotices).toHaveBeenCalledOnce();
    pending.resolve("Complete notices Café 😀");
    await pending.promise;
    expect(render()).toMatchObject({
      text: "Complete notices Café 😀",
      statuses: [],
    });
    render().click();
    render().click();
    expect(loadThirdPartyNotices).toHaveBeenCalledOnce();
  });

  it("keeps a completed hidden load for the next explicit open", async () => {
    const pending = deferred();
    vi.mocked(loadThirdPartyNotices).mockReturnValue(pending.promise);
    render().click();
    render().click();
    pending.resolve("Whole text");
    await pending.promise;
    expect(render()).toMatchObject({ hidden: true, text: "Whole text" });
    render().click();
    expect(render()).toMatchObject({ hidden: false, text: "Whole text" });
    expect(loadThirdPartyNotices).toHaveBeenCalledOnce();
  });

  it("shows a fixed failure with no partial text and allows one explicit retry", async () => {
    const first = deferred();
    const second = deferred();
    vi.mocked(loadThirdPartyNotices)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render().click();
    first.reject(new Error("Private decoder diagnostic"));
    await first.promise.catch(() => {});
    expect(render()).toMatchObject({
      text: undefined,
      statuses: ["The license text could not be loaded."],
    });
    const retry = render().retry!;
    retry();
    retry();
    expect(loadThirdPartyNotices).toHaveBeenCalledTimes(2);
    expect(render().statuses).toEqual(["Loading software licenses…"]);
    second.resolve("Complete recovered text");
    await second.promise;
    expect(render()).toMatchObject({
      text: "Complete recovered text",
      statuses: [],
      retry: undefined,
    });
  });

  it.each(["success", "failure"])(
    "aborts unmounted work and fences late %s",
    async (outcome) => {
      const pending = deferred();
      vi.mocked(loadThirdPartyNotices).mockReturnValue(pending.promise);
      render().click();
      const signal = vi.mocked(loadThirdPartyNotices).mock.calls[0]![0];
      hooks.cleanup!();
      const updates = hooks.updates;
      expect(signal.aborted).toBe(true);
      if (outcome === "success") pending.resolve("Retired text");
      else pending.reject(new Error("Retired failure"));
      await pending.promise.catch(() => {});
      expect(hooks.updates).toBe(updates);
    },
  );
});
