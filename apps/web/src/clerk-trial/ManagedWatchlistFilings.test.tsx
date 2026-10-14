import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedSecFilingsResponseDto,
} from "@research-cockpit/contracts";
import {
  ManagedWatchlistFilings as Panel,
  type ManagedWatchlistFilingsProps,
} from "./ManagedWatchlistFilings";
import { ManagedWatchlistFilings as Model } from "./managed-watchlist-filings";
import {
  ManagedCatalogChangedError,
  ManagedSecFilingsError,
  type ManagedApi,
} from "./managed-api";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";
import { TrialApiError } from "./api";

const hooks = vi.hoisted(() => ({
  direct: false,
  index: 0,
  refs: [] as Array<{ current: unknown }>,
  effects: [] as Array<() => void | (() => void)>,
  cleanups: [] as Array<() => void>,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useRef: (initial: unknown) =>
      hooks.direct
        ? (hooks.refs[hooks.index++] ??= { current: initial })
        : actual.useRef(initial),
    useLayoutEffect: (
      effect: () => void | (() => void),
      dependencies?: React.DependencyList,
    ) => {
      if (hooks.direct) hooks.effects.push(effect);
      else actual.useLayoutEffect(effect, dependencies);
    },
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      get: () => unknown,
      server: () => unknown,
    ) =>
      hooks.direct
        ? get()
        : actual.useSyncExternalStore(subscribe, get, server),
  };
});
afterEach(() => {
  hooks.direct = false;
  hooks.refs = [];
  hooks.effects = [];
  hooks.cleanups = [];
  vi.unstubAllGlobals();
});

function fixture() {
  const read = vi
    .fn<ManagedApi["recentFilings"]>()
    .mockResolvedValue(filingsResponse());
  const model = new Model(read, vi.fn());
  const digest = filingsSelection.catalogSnapshotSha256;
  const draft: MainWatchlistPayload = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: filingsSelection.catalogSnapshotSha256,
    memberships: [{ ...filingsSelection.listing, note: "Keep Café 😀" }],
  };
  model.reconcile(draft, digest, true, true);
  const member = model.getSnapshot().memberships[0]!;
  model.select(model.getSnapshot(), member);
  const props: ManagedWatchlistFilingsProps = {
    model,
    active: true,
    selected: draft.memberships[0]!,
    onViewFilings: vi.fn(),
  };
  return {
    model,
    read,
    draft,
    digest,
    member,
    props,
    html: () => renderToStaticMarkup(<Panel {...props} />),
    load: () => model.load(member),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
interface ButtonProps {
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: (event: { currentTarget: HTMLButtonElement }) => void;
}
function buttons(node: React.ReactNode): React.ReactElement<ButtonProps>[] {
  if (!React.isValidElement<ButtonProps>(node)) return [];
  return [
    ...(node.type === "button" ? [node] : []),
    ...React.Children.toArray(node.props.children).flatMap(buttons),
  ];
}
function label(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(label).join("");
  return React.isValidElement<ButtonProps>(node)
    ? label(node.props.children)
    : "";
}
function rendered(f: ReturnType<typeof fixture>) {
  let props = f.props;
  const body = {};
  const documentMock = { body, activeElement: body };
  vi.stubGlobal("document", documentMock);
  const focus = vi.fn();
  const load = {
    isConnected: true,
    disabled: false,
    getClientRects: () => [{}],
    focus,
  };
  const render = (changes: Partial<ManagedWatchlistFilingsProps> = {}) => {
    props = { ...props, ...changes };
    hooks.direct = true;
    hooks.index = 0;
    hooks.effects = [];
    const node = Panel(props);
    hooks.direct = false;
    hooks.refs[1]!.current = load;
    const controls = buttons(node);
    load.disabled = Boolean(controls[0]?.props.disabled);
    return {
      node,
      html: renderToStaticMarkup(node),
      button: (text: string) => {
        const button = controls.find(
          (entry) => label(entry.props.children) === text,
        );
        expect(button).toBeDefined();
        return button!;
      },
    };
  };
  const commit = () => {
    hooks.cleanups.forEach((cleanup) => cleanup());
    hooks.cleanups = hooks.effects.flatMap((effect) => {
      const cleanup = effect();
      return cleanup ? [cleanup] : [];
    });
  };
  const click = (
    button: React.ReactElement<ButtonProps>,
    control = {} as HTMLButtonElement,
  ) => button.props.onClick?.({ currentTarget: control });
  return {
    render,
    commit,
    click,
    focus,
    load,
    documentMock,
    unmount: () => hooks.cleanups.forEach((cleanup) => cleanup()),
  };
}

describe("selected watchlist filings", () => {
  it("selects and renders unloaded without reading, moving focus or viewing", () => {
    const f = fixture();
    const ui = rendered(f);
    const page = ui.render();
    ui.commit();
    expect(page.html).toContain("Recent filings");
    expect(page.button("Load filings").props.disabled).toBe(false);
    expect(page.button("View filings").props.disabled).toBe(true);
    expect(f.read).not.toHaveBeenCalled();
    expect(f.props.onViewFilings).not.toHaveBeenCalled();
    expect(ui.focus).not.toHaveBeenCalled();
  });

  it("shows the first strictly admitted observed row and full original source dates, then views without another read", async () => {
    const f = fixture();
    const ui = rendered(f);
    let page = ui.render();
    ui.commit();
    ui.click(page.button("Load filings"));
    await vi.waitFor(() => expect(f.model.getSnapshot().pending).toBeNull());
    page = ui.render();
    ui.commit();
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(page.html).toContain("Newest observed filing");
    expect(page.html).toContain("Form 10-Q");
    expect(page.html).toContain("26 loaded filings");
    expect(page.html).toContain("0000000001-26-000001-index.htm");
    expect(page.html).not.toContain("0000000001-26-000002-index.htm");
    const response = f.model.getSnapshot().filings.response!;
    for (const value of [
      response.window.fromDate,
      response.window.throughDate,
      response.requestStartedAt,
      response.completedAt,
      response.issuer.fetchedAt,
      response.issuer.sourceUrl,
    ])
      expect(page.html).toContain(value);
    expect(page.html).toContain(
      "Older continuation files and filing bodies were not loaded",
    );
    expect(page.html).toContain("The source lists older continuation files.");
    expect(page.html).toContain(
      "View filings for ZERO (Zero Company; Class A; XNAS)",
    );
    const opener = {} as HTMLButtonElement;
    ui.click(page.button("View filings"), opener);
    expect(f.props.onViewFilings).toHaveBeenCalledWith(
      { member: f.member, response },
      opener,
    );
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(ui.focus).not.toHaveBeenCalled();
  });

  it("distinguishes a valid empty packet from unavailable evidence", async () => {
    const f = fixture();
    f.read.mockResolvedValueOnce(filingsResponse(0));
    await f.load();
    expect(f.html()).toContain(
      "No matching filings were observed in the checked source object.",
    );
    expect(f.html()).toContain("0 loaded filings");
    expect(f.html()).not.toContain("Newest observed filing");
    f.read.mockResolvedValueOnce(filingsResponse(0, "not_covered"));
    await f.load();
    expect(f.html()).toContain("not covered for this issuer");
    expect(f.html()).not.toContain("0 loaded filings");
    expect(f.html()).not.toContain("No matching filings");
    expect(f.html()).toContain("Source checked");
  });

  it("keeps source truncation visible beside its loaded count", async () => {
    const f = fixture();
    const raw = filingsResponse(1000);
    f.read.mockResolvedValueOnce({
      ...raw,
      issuer: { ...raw.issuer, matchingFilings: 1001, truncated: true },
    });
    await f.load();
    expect(f.model.getSnapshot().filings.response).not.toBeNull();
    expect(f.html()).toContain(
      "Showing 1000 of 1001 matching entries; the response limit truncated this list.",
    );
  });

  it("keeps retained original dates visible through held load, Cancel and late completion", async () => {
    const f = fixture();
    await f.load();
    const original = f.model.getSnapshot().filings.response;
    const pending = deferred<ManagedSecFilingsResponseDto>();
    f.read.mockReturnValueOnce(pending.promise);
    const task = f.load();
    const ui = rendered(f);
    let page = ui.render();
    ui.commit();
    expect(page.html).toContain("Showing the previous filings response");
    expect(page.button("View filings").props.disabled).toBe(true);
    ui.click(page.button("Cancel filings"));
    page = ui.render();
    ui.commit();
    expect(page.html).toContain("Filings request cancelled");
    expect(page.button("View filings").props.disabled).toBe(false);
    pending.resolve(filingsResponse(0));
    await task;
    expect(f.model.getSnapshot().filings.response).toBe(original);
    expect(ui.render().html).toContain("26 loaded filings");
    expect(f.read).toHaveBeenCalledTimes(2);
  });

  it("retains the original packet after transient failure and allows viewing while reads are locked", async () => {
    const f = fixture();
    await f.load();
    const original = f.model.getSnapshot().filings.response;
    f.read.mockRejectedValueOnce(new ManagedSecFilingsError("unavailable"));
    await f.load();
    f.model.reconcile(f.draft, f.digest, true, false);
    const ui = rendered(f);
    const page = ui.render();
    ui.commit();
    expect(page.html).toContain("Showing the previous filings response");
    expect(page.button("Refresh filings").props.disabled).toBe(true);
    expect(page.button("View filings").props.disabled).toBe(false);
    ui.click(page.button("View filings"));
    expect(f.props.onViewFilings).toHaveBeenCalledWith(
      { member: f.member, response: original },
      expect.anything(),
    );
  });

  it.each([
    new TrialApiError("invalid_response"),
    new ManagedCatalogChangedError(),
  ])(
    "clears old evidence after %s without offering stale View",
    async (error) => {
      const f = fixture();
      await f.load();
      f.read.mockRejectedValueOnce(error);
      await f.load();
      const ui = rendered(f);
      const page = ui.render();
      ui.commit();
      expect(page.html).not.toContain("Newest observed filing");
      expect(page.html).not.toContain("Filings source and coverage");
      expect(page.button("View filings").props.disabled).toBe(true);
      ui.click(page.button("View filings"));
      expect(f.props.onViewFilings).not.toHaveBeenCalled();
    },
  );

  it("hides a prior selected packet before the new detail selection is committed", async () => {
    const f = fixture();
    await f.load();
    const ui = rendered(f);
    const page = ui.render({
      selected: {
        ...f.props.selected,
        shareClassId: "other",
        shareClassName: "Class C",
      },
    });
    ui.commit();
    expect(page.html).not.toContain("Newest observed filing");
    expect(page.html).not.toContain("0000000001-26-000001-index.htm");
    expect(page.button("Load filings").props.disabled).toBe(true);
    expect(page.button("View filings").props.disabled).toBe(true);
  });

  it("fences captured View and Load after replacement, without relying on disabled DOM", async () => {
    const f = fixture();
    await f.load();
    const ui = rendered(f);
    const before = ui.render();
    ui.commit();
    await f.load();
    ui.click(before.button("View filings"));
    expect(f.props.onViewFilings).not.toHaveBeenCalled();
    ui.render({ active: false });
    ui.commit();
    ui.click(before.button("Refresh filings"));
    expect(f.read).toHaveBeenCalledTimes(2);
    ui.click(before.button("View filings"));
    expect(f.props.onViewFilings).not.toHaveBeenCalled();
  });

  it("uses only committed presentation state and rejects callbacks after unmount", async () => {
    const f = fixture();
    await f.load();
    const ui = rendered(f);
    const current = ui.render();
    ui.commit();
    ui.render({ active: false }); // Abandoned render must not replace the committed action.
    ui.click(current.button("View filings"));
    expect(f.props.onViewFilings).toHaveBeenCalledTimes(1);
    ui.unmount();
    ui.click(current.button("View filings"));
    ui.click(current.button("Refresh filings"));
    expect(f.props.onViewFilings).toHaveBeenCalledTimes(1);
    expect(f.read).toHaveBeenCalledTimes(1);
  });

  it.each(["retire", "member removed", "different catalog"])(
    "rejects captured controls after %s before rerender",
    async (change) => {
      const f = fixture();
      await f.load();
      const ui = rendered(f);
      const page = ui.render();
      ui.commit();
      if (change === "retire") f.model.retire();
      else if (change === "member removed")
        f.model.reconcile(
          { ...f.draft, memberships: [] },
          f.digest,
          true,
          true,
        );
      else f.model.reconcile(f.draft, `sha256:${"b".repeat(64)}`, true, true);
      ui.click(page.button("View filings"));
      ui.click(page.button("Refresh filings"));
      expect(f.props.onViewFilings).not.toHaveBeenCalled();
      expect(f.read).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["focused", "moved", "hidden", "detached", "inactive"])(
    "restores cancelled load focus only for its visible current owner: %s",
    async (mode) => {
      const f = fixture();
      const pending = deferred<ManagedSecFilingsResponseDto>();
      f.read.mockReturnValueOnce(pending.promise);
      const task = f.load();
      const ui = rendered(f);
      const page = ui.render();
      ui.commit();
      const cancel = {} as HTMLButtonElement;
      ui.documentMock.activeElement = cancel;
      ui.click(page.button("Cancel filings"), cancel);
      if (mode === "moved") ui.documentMock.activeElement = {};
      if (mode === "hidden") ui.load.getClientRects = () => [];
      if (mode === "detached") ui.load.isConnected = false;
      ui.render({ active: mode !== "inactive" });
      ui.commit();
      expect(ui.focus).toHaveBeenCalledTimes(mode === "focused" ? 1 : 0);
      pending.resolve(filingsResponse());
      await task;
      expect(f.model.getSnapshot().filings.response).toBeNull();
    },
  );

  it("does not cancel a replacement operation through an old Cancel handler", async () => {
    const f = fixture();
    const first = deferred<ManagedSecFilingsResponseDto>();
    const second = deferred<ManagedSecFilingsResponseDto>();
    f.read
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const task1 = f.load();
    const ui = rendered(f);
    const page = ui.render();
    ui.commit();
    f.model.cancel();
    const task2 = f.load();
    const pending = f.model.getSnapshot().pending;
    ui.click(page.button("Cancel filings"));
    expect(f.model.getSnapshot().pending).toBe(pending);
    f.model.cancel();
    first.resolve(filingsResponse());
    second.resolve(filingsResponse());
    await Promise.all([task1, task2]);
  });
});
