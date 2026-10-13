import type { MouseEvent } from "react";
import type * as React from "react";
import type { FedMonetaryAnnouncementsProps } from "../features/markets/FedMonetaryAnnouncements";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagedFedAnnouncements } from "./ManagedFedAnnouncements";
import { ManagedFedAnnouncements as Model } from "./managed-fed-announcements";
import type { ManagedApi } from "./managed-api";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";

const hooks = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  index: 0,
  effects: [] as Array<() => void>,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useRef: (value: unknown) =>
    (hooks.refs[hooks.index++] ??= { current: value }),
  useLayoutEffect: (effect: () => void) => hooks.effects.push(effect),
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) =>
    getSnapshot(),
}));
beforeEach(() => {
  hooks.refs = [];
  hooks.index = 0;
  hooks.effects = [];
});
afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const read = vi
    .fn<ManagedApi["monetaryAnnouncements"]>()
    .mockImplementation(() => new Promise(() => undefined));
  const model = new Model(read, vi.fn());
  const button = {
    isConnected: true,
    disabled: false,
    closest: vi.fn().mockReturnValue(null),
    getClientRects: () => [1],
    focus: vi.fn(),
  };
  const cancel = {};
  const doc = { activeElement: cancel, body: {} };
  vi.stubGlobal("document", doc);
  const render = (headingRef?: React.Ref<HTMLHeadingElement>) => {
    hooks.index = 0;
    const view = ManagedFedAnnouncements({
      model,
      headingRef,
    }) as React.ReactElement<FedMonetaryAnnouncementsProps>;
    hooks.refs[0]!.current = button;
    while (hooks.effects.length) hooks.effects.shift()!();
    return view;
  };
  return { read, model, button, cancel, doc, render };
}

describe("managed announcement controls", () => {
  it("passes the owned heading ref without loading or replacing accepted announcements", async () => {
    const f = fixture();
    const headingRef = { current: null };
    expect(f.render(headingRef).props.headingRef).toBe(headingRef);
    expect(f.read).not.toHaveBeenCalled();
    f.read.mockResolvedValueOnce(fedAnnouncementsFixture());
    await f.model.load();
    const packet = f.model.getSnapshot().announcements;
    const view = f.render(headingRef);
    expect(view.props.headingRef).toBe(headingRef);
    expect(view.props.announcements).toBe(packet);
    expect(f.read).toHaveBeenCalledOnce();
    expect(f.button.focus).not.toHaveBeenCalled();
  });
  it("starts idle, passes the original packet and restores focus after a focused Cancel", async () => {
    const f = fixture();
    expect(f.render().props.announcements).toBeNull();
    expect(f.read).not.toHaveBeenCalled();
    f.read.mockResolvedValueOnce(fedAnnouncementsFixture());
    await f.model.load();
    const packet = f.model.getSnapshot().announcements;
    f.render().props.onLoad();
    expect(f.render().props.busy).toBe(true);
    f.render().props.onCancel!({
      currentTarget: f.cancel,
    } as MouseEvent<HTMLButtonElement>);
    f.doc.activeElement = f.doc.body;
    const view = f.render();
    expect(f.button.focus).toHaveBeenCalledOnce();
    expect(view.props.announcements).toBe(packet);
    expect(view.props.showingPrevious).toBe(true);
    expect(f.read.mock.calls[1]![0].aborted).toBe(true);
  });
  it.each(["unfocused", "moved", "hidden", "detached", "disabled"])(
    "does not move focus when %s",
    (reason) => {
      const f = fixture();
      f.render().props.onLoad();
      const busy = f.render();
      if (reason === "unfocused") f.doc.activeElement = {};
      busy.props.onCancel!({
        currentTarget: f.cancel,
      } as MouseEvent<HTMLButtonElement>);
      if (reason === "moved") f.doc.activeElement = {};
      if (reason === "hidden") f.button.closest.mockReturnValue({});
      if (reason === "detached") f.button.isConnected = false;
      if (reason === "disabled") f.button.disabled = true;
      f.render();
      expect(f.button.focus).not.toHaveBeenCalled();
    },
  );
  it("navigation cancellation clears busy state without requesting focus", () => {
    const f = fixture();
    f.render().props.onLoad();
    f.render();
    f.model.leave();
    expect(f.render().props.busy).toBe(false);
    expect(f.button.focus).not.toHaveBeenCalled();
  });
});
