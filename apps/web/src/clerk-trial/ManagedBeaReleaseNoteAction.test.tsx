import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedBeaReleaseNoteAction } from "./ManagedBeaReleaseNoteAction";
import { annualComparisonMemberships as members } from "./annual-comparison-fixture";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { parseManagedEconomicCalendar } from "@research-cockpit/contracts";

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  stateIndex: 0,
  memos: [] as Array<{ deps: unknown[]; value: unknown }>,
  memoIndex: 0,
  ref: { current: null },
  changed: false,
  effect: undefined as undefined | (() => () => void),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useId: () => "bea-note-help",
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [
      hooks.states[index],
      (next: unknown) => {
        hooks.changed ||= next !== hooks.states[index];
        hooks.states[index] = next;
      },
    ];
  },
  useMemo: (create: () => unknown, deps: unknown[]) => {
    const index = hooks.memoIndex++;
    const previous = hooks.memos[index];
    if (!previous || deps.some((dep, i) => dep !== previous.deps[i]))
      hooks.memos[index] = { deps, value: create() };
    return hooks.memos[index]!.value;
  },
  useRef: () => hooks.ref,
  useLayoutEffect: (effect: () => () => void) => {
    hooks.effect = effect;
  },
}));
afterEach(() => {
  hooks.states = [];
  hooks.memos = [];
  hooks.ref.current = null;
  hooks.effect = undefined;
  vi.unstubAllGlobals();
});
type Props = React.ComponentProps<typeof ManagedBeaReleaseNoteAction>;
type Control = React.ReactElement<
  React.ComponentProps<"select"> & { label?: string; onClick?: () => void }
>;
function controls(node: React.ReactNode): Control[] {
  if (Array.isArray(node)) return node.flatMap(controls);
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
  return [node as Control, ...controls(node.props.children)];
}
function harness(initial: Partial<Props> = {}) {
  const packet = parseManagedEconomicCalendar(economicCalendarFixture())!;
  const getAction = vi.fn<Props["actions"]["getAction"]>(
    (capture, destination) => ({
      canAppend: !!capture && !!destination,
      reason: !capture
        ? "Choose a loaded release."
        : !destination
          ? "Choose a current watchlist note."
          : null,
    }),
  );
  const append = vi.fn<Props["actions"]["append"]>(() => ({
    appended: true,
    message: "Reference added. Review and save in My Watchlist.",
  }));
  const onReview = vi.fn<Props["onReview"]>();
  let props: Props = {
    state: {
      agenda: packet,
      busy: false,
      error: null,
      message: "",
      showingPrevious: false,
    },
    selectedDate: "",
    members: [members.left, members.right],
    active: true,
    editable: true,
    actions: { getAction, append },
    onReview,
    ...initial,
  };
  let cleanup: (() => void) | undefined;
  const render = (changes: Partial<Props> = {}, commit = true) => {
    props = { ...props, ...changes };
    let node: ReturnType<typeof ManagedBeaReleaseNoteAction>;
    for (let i = 0; i < 4; i++) {
      hooks.stateIndex = 0;
      hooks.memoIndex = 0;
      hooks.changed = false;
      node = ManagedBeaReleaseNoteAction(props);
      if (!hooks.changed) break;
    }
    if (commit) {
      cleanup?.();
      cleanup = hooks.effect?.();
    }
    return node!;
  };
  const select = (id: "release" | "destination", node = render()) =>
    controls(node).find((c) => c.props.id === `managed-bea-note-${id}`)!;
  const button = (node = render()) =>
    controls(node).find((c) => c.type === "button")!;
  const review = (node = render()) =>
    controls(node).find(
      (c) =>
        c.type === "button" && c.props.children === "Review in My Watchlist",
    );
  const change = (
    id: "release" | "destination",
    value: string,
    node = render(),
  ) =>
    select(id, node).props.onChange!({
      currentTarget: { value },
    } as React.ChangeEvent<HTMLSelectElement>);
  const choose = () => {
    change("release", "0");
    change("destination", members.right.listingId);
  };
  return {
    render,
    select,
    button,
    review,
    change,
    choose,
    packet,
    getAction,
    append,
    onReview,
    get props() {
      return props;
    },
    unmount: () => cleanup?.(),
    html: (node = render()) => renderToStaticMarkup(node),
  };
}

describe("BEA release note choices", () => {
  it("offers all 512 admitted events in Eastern groups without shortening labels or renumbering a date view", () => {
    const events = Array.from({ length: 512 }, (_, index) => ({
      series: `Invented ${String(index).padStart(3, "0")} ${"東".repeat(240)}`,
      scheduledAt:
        index < 256 ? "2026-10-30T12:30:00.000Z" : "2026-11-02T13:30:00.000Z",
    }));
    const agenda = parseManagedEconomicCalendar({
      ...economicCalendarFixture(),
      events,
    });
    expect(agenda).not.toBeNull();
    const h = harness();
    const all = h.render({ state: { ...h.props.state, agenda } });
    const options = controls(h.select("release", all)).filter(
      (node) => node.type === "option",
    );
    expect(options.map((node) => node.props.value)).toEqual([
      "",
      ...events.map((_, index) => String(index)),
    ]);
    expect(
      controls(all)
        .filter((node) => node.type === "optgroup")
        .map((node) => node.props.label),
    ).toEqual(["Fri, Oct 30, 2026", "Mon, Nov 2, 2026"]);
    expect(h.html(all)).toContain(`8:30 AM EDT · ${events[0]!.series}`);
    expect(h.html(all)).toContain(`8:30 AM EST · ${events[511]!.series}`);
    const narrowed = h.render({ selectedDate: "2026-11-02" });
    expect(
      controls(h.select("release", narrowed))
        .filter((node) => node.type === "option")
        .map((node) => node.props.value),
    ).toEqual([
      "",
      ...events.slice(256).map((_, index) => String(index + 256)),
    ]);
    h.change("release", "511", narrowed);
    h.change("destination", members.right.listingId);
    h.button().props.onClick!();
    expect(h.append.mock.calls[0]![0]?.event).toBe(agenda!.events[511]);
    expect(h.html()).toContain(
      `Selected release: Mon, Nov 2, 2026, 8:30 AM EST · ${events[511]!.series}`,
    );
  });

  it("keeps simultaneous series distinct and groups a UTC-midnight release on its Eastern day", () => {
    const agenda = parseManagedEconomicCalendar({
      ...economicCalendarFixture(),
      events: [
        {
          series: "After UTC midnight",
          scheduledAt: "2026-10-30T00:30:00.000Z",
        },
        {
          series: "First simultaneous series",
          scheduledAt: "2026-10-30T12:30:00.000Z",
        },
        {
          series: "Second simultaneous series",
          scheduledAt: "2026-10-30T12:30:00.000Z",
        },
      ],
    });
    expect(agenda).not.toBeNull();
    const h = harness();
    const all = h.render({ state: { ...h.props.state, agenda } });
    expect(
      controls(all)
        .filter((node) => node.type === "optgroup")
        .map((node) => node.props.label),
    ).toEqual(["Thu, Oct 29, 2026", "Fri, Oct 30, 2026"]);
    const narrowed = h.render({ selectedDate: "2026-10-30" });
    expect(
      controls(h.select("release", narrowed))
        .filter((node) => node.type === "option")
        .map((node) => node.props.value),
    ).toEqual(["", "1", "2"]);
    h.change("release", "2", narrowed);
    h.change("destination", members.left.listingId);
    h.button().props.onClick!();
    expect(h.append.mock.calls[0]![0]?.event).toBe(agenda!.events[2]);
  });

  it("keeps a visible choice across date changes but clears an excluded event and Review without a fallback", () => {
    const h = harness();
    h.choose();
    h.button().props.onClick!();
    const old = h.render();
    const same = h.render({ selectedDate: "2026-10-30" });
    expect(h.select("release", same).props.value).toBe("0");
    expect(h.review(same)).toBeDefined();
    const excluded = h.render({ selectedDate: "2026-11-02" });
    expect(h.select("release", excluded).props.value).toBe("");
    expect(h.select("destination", excluded).props.value).toBe(
      members.right.listingId,
    );
    expect(h.review(excluded)).toBeUndefined();
    expect(h.html(excluded)).toContain(
      "The date view changed, so the release choice was cleared.",
    );
    h.button(old).props.onClick!();
    h.review(old)!.props.onClick!();
    for (const value of ["0", "01", "-1", "1.0", " 1", "512", "NaN"])
      h.change("release", value);
    expect(h.select("release").props.value).toBe("");
    expect(h.append).toHaveBeenCalledOnce();
    expect(h.onReview).not.toHaveBeenCalled();
    h.render({ selectedDate: "" });
    expect(h.select("release").props.value).toBe("");
    expect(h.html()).toContain(
      "The date view changed, so the release choice was cleared. Choose a release from the displayed dates.",
    );
    h.change("release", "1");
    expect(h.select("release").props.value).toBe("1");
    expect(h.html()).not.toContain("release choice was cleared");
  });

  it("invalidates successful Review when the retained qualifier changes, even if it later returns", () => {
    const h = harness();
    h.choose();
    h.button().props.onClick!();
    const old = h.render();
    h.render({ state: { ...h.props.state, showingPrevious: true } });
    expect(h.review()).toBeUndefined();
    h.render({ state: { ...h.props.state, showingPrevious: false } });
    expect(h.review()).toBeUndefined();
    h.review(old)!.props.onClick!();
    expect(h.onReview).not.toHaveBeenCalled();
    expect(h.select("release").props.value).toBe("0");
  });

  it("blocks successful Review while editing is paused, then uses the current member when available", () => {
    const h = harness();
    h.choose();
    h.button().props.onClick!();
    const paused = h.render({ editable: false });
    expect(h.review(paused)?.props["aria-disabled"]).toBe(true);
    h.review(paused)!.props.onClick!();
    expect(h.onReview).not.toHaveBeenCalled();
    const ready = h.render({ editable: true });
    h.review(ready)!.props.onClick!();
    expect(h.onReview).toHaveBeenCalledExactlyOnceWith(members.right);
  });

  it("starts with two explicit blank native choices and a focusable guarded action", () => {
    const h = harness();
    const node = h.render();
    const html = h.html(node);
    expect(h.select("release", node).props.value).toBe("");
    expect(h.select("destination", node).props.value).toBe("");
    expect(html).toContain('for="managed-bea-note-release"');
    expect(html).toContain('for="managed-bea-note-destination"');
    expect(h.select("release", node).props["aria-describedby"]).toBe(
      "bea-note-help-release bea-note-help",
    );
    expect(h.select("destination", node).props["aria-describedby"]).toBe(
      "bea-note-help-member bea-note-help",
    );
    expect(h.button(node).props["aria-disabled"]).toBe(true);
    expect(h.button(node).props.disabled).toBeUndefined();
    expect(html).toContain("Choose a loaded release.");
    expect(h.review(node)).toBeUndefined();
    h.button(node).props.onClick!();
    expect(h.append).not.toHaveBeenCalled();
    expect(h.onReview).not.toHaveBeenCalled();
  });

  it("uses original event indexes and full draft order, with wrapping full series and identity text", () => {
    const h = harness({ members: [members.right, members.left] });
    h.choose();
    const node = h.render();
    const html = h.html(node);
    expect(html.indexOf('value="listing-one"')).toBeLessThan(
      html.indexOf('value="listing-zero"'),
    );
    expect(h.select("release", node).props.value).toBe("0");
    expect(html).toContain(
      `Selected release: Fri, Oct 30, 2026, 8:30 AM EDT · ${h.packet.events[0]!.series}`,
    );
    expect(html).toContain("ONE · One Company · One Class A · Class A · XNAS");
    expect(h.append).not.toHaveBeenCalled();
    expect(h.onReview).not.toHaveBeenCalled();
    h.button(node).props.onClick!();
    const [capture, destination] = h.append.mock.calls[0]!;
    expect(capture?.response).toBe(h.packet);
    expect(capture?.event).toBe(h.packet.events[0]);
    expect(capture?.showingPrevious).toBe(false);
    expect(destination).toBe(members.right);
  });

  it("keeps exact Unicode and markup-looking series text without interpreting HTML", () => {
    const packet = parseManagedEconomicCalendar({
      ...economicCalendarFixture(),
      events: [
        {
          ...economicCalendarFixture().events[0]!,
          series: "<img> Cafe\u0301 東京 😀 & policy",
        },
      ],
    })!;
    const h = harness({
      state: {
        agenda: packet,
        busy: false,
        error: null,
        message: "",
        showingPrevious: false,
      },
    });
    h.change("release", "0");
    h.change("destination", members.left.listingId);
    const node = h.render();
    expect(h.html(node)).toContain(
      "&lt;img&gt; Cafe\u0301 東京 😀 &amp; policy",
    );
    expect(h.html(node)).not.toContain("<img>");
    h.button(node).props.onClick!();
    expect(h.append.mock.calls[0]![0]?.event.series).toBe(
      packet.events[0]!.series,
    );
  });

  it("refreshes only an identity-preserving destination handle after note edits and reorder", () => {
    const h = harness();
    h.choose();
    const old = h.render();
    const latest = { ...members.right, note: "Latest raw Café 😀 prefix" };
    const node = h.render({
      members: [latest, { ...members.left, note: "Other draft" }],
    });
    h.button(old).props.onClick!();
    expect(h.append).not.toHaveBeenCalled();
    expect(h.select("destination", node).props.value).toBe(latest.listingId);
    h.button(node).props.onClick!();
    expect(h.append.mock.calls[0]![1]).toBe(latest);
  });

  it.each([
    "country",
    "exchangeMic",
    "instrumentType",
    "issuerId",
    "issuerName",
    "listingId",
    "securityId",
    "securityName",
    "shareClassId",
    "shareClassName",
    "symbol",
  ] as const)(
    "clears a destination when %s changes, without later resurrection",
    (field) => {
      const h = harness();
      h.choose();
      const old = h.render();
      h.render({
        members: [members.left, { ...members.right, [field]: "changed" }],
      });
      expect(h.select("destination").props.value).toBe("");
      h.render({ members: [members.left, members.right] });
      expect(h.select("destination").props.value).toBe("");
      h.button(old).props.onClick!();
      expect(h.append).not.toHaveBeenCalled();
    },
  );

  it("clears removal, leaves a later Add unselected and refuses unknown option values", () => {
    const h = harness();
    h.choose();
    h.render({ members: [] });
    h.render({ members: [members.right] });
    h.change("destination", "forged");
    h.change("release", "https://example.invalid/");
    expect(h.select("destination").props.value).toBe("");
    expect(h.select("release").props.value).toBe("0");
    h.change("release", "");
    expect(h.select("release").props.value).toBe("");
    expect(h.append).not.toHaveBeenCalled();
  });

  it.each(["equal", "empty"] as const)(
    "clears the item on a successful %s packet and fences the old action",
    (kind) => {
      const h = harness();
      h.choose();
      h.button().props.onClick!();
      const old = h.render();
      const replacement = parseManagedEconomicCalendar(
        kind === "equal"
          ? structuredClone(h.packet)
          : { ...h.packet, events: [] },
      )!;
      h.render({ state: { ...h.props.state, agenda: replacement } });
      expect(h.select("release").props.value).toBe("");
      expect(h.select("destination").props.value).toBe(members.right.listingId);
      h.button(old).props.onClick!();
      h.review(old)!.props.onClick!();
      expect(h.append).toHaveBeenCalledOnce();
      expect(h.onReview).not.toHaveBeenCalled();
      expect(h.review()).toBeUndefined();
      h.render({ state: { ...h.props.state, agenda: h.packet } });
      expect(h.select("release").props.value).toBe("");
    },
  );

  it.each([null, "unavailable", "invalid_response"] as const)(
    "retains choices after pending/Cancel or %s failure and captures the fresh previous qualifier",
    (error) => {
      const h = harness();
      h.choose();
      const old = h.render();
      const pending = h.render({
        state: { ...h.props.state, busy: true, showingPrevious: true },
      });
      h.button(old).props.onClick!();
      h.button(pending).props.onClick!();
      h.change("release", "1", pending);
      expect(h.append).not.toHaveBeenCalled();
      expect(h.html()).toContain("Wait for the agenda request");
      const settled = h.render({
        state: { ...h.props.state, busy: false, error },
      });
      expect(h.select("release", settled).props.value).toBe("0");
      h.button(settled).props.onClick!();
      expect(h.append.mock.calls[0]![0]?.showingPrevious).toBe(true);
    },
  );

  it("retains a success and Review after the append's note replacement without moving focus", () => {
    const h = harness();
    const focused = { focus: vi.fn(), scrollIntoView: vi.fn() };
    vi.stubGlobal("document", { activeElement: focused });
    h.choose();
    h.button().props.onClick!();
    const updated = { ...members.right, note: "Reference was appended" };
    const node = h.render({ members: [updated, members.left] });
    expect(h.html(node)).toContain("Reference added.");
    expect(h.review(node)).toBeDefined();
    h.review(node)!.props.onClick!();
    expect(h.onReview).toHaveBeenCalledOnce();
    expect(h.onReview).toHaveBeenCalledWith(updated);
    expect(h.append).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(focused);
    expect(focused.focus).not.toHaveBeenCalled();
    expect(focused.scrollIntoView).not.toHaveBeenCalled();
  });

  it("reviews the exact latest member after another prefix edit and reorder, refusing the old callback", () => {
    const h = harness();
    h.choose();
    h.button().props.onClick!();
    const appended = { ...members.right, note: "Appended reference" };
    const old = h.render({ members: [members.left, appended] });
    const latest = {
      ...appended,
      note: "  Latest cafe\u0301 東京 😀 prefix and reference  ",
    };
    const other = { ...members.left, note: "Other current draft" };
    const current = h.render({ members: [latest, other] });
    h.review(old)!.props.onClick!();
    expect(h.onReview).not.toHaveBeenCalled();
    h.review(current)!.props.onClick!();
    expect(h.onReview).toHaveBeenCalledExactlyOnceWith(latest);
    expect(h.onReview.mock.calls[0]![0]).toBe(latest);
    expect(h.append).toHaveBeenCalledOnce();
    expect(latest.note).toBe(
      "  Latest cafe\u0301 東京 😀 prefix and reference  ",
    );
    expect(other.note).toBe("Other current draft");
  });

  it.each(["removed", "replaced"] as const)(
    "clears successful Review when its destination is %s instead of selecting another note",
    (kind) => {
      const h = harness();
      h.choose();
      h.button().props.onClick!();
      const old = h.render();
      const current = h.render({
        members:
          kind === "removed"
            ? [members.left]
            : [members.left, { ...members.right, securityId: "replacement" }],
      });
      h.review(old)!.props.onClick!();
      expect(h.onReview).not.toHaveBeenCalled();
      expect(h.review(current)).toBeUndefined();
      expect(h.select("destination", current).props.value).toBe("");
      expect(h.append).toHaveBeenCalledOnce();
      h.render({ members: [members.left, members.right] });
      expect(h.review()).toBeUndefined();
    },
  );

  it("checks a live refusal again, announces it without duplicate visible copy and clears obsolete refusal", () => {
    const h = harness();
    h.choose();
    const node = h.render();
    h.getAction.mockReturnValue({
      canAppend: false,
      reason: "This exact release reference is already in the note draft.",
    });
    h.button(node).props.onClick!();
    expect(h.append).not.toHaveBeenCalled();
    expect(h.html()).toContain(
      'class="managed-bea-note-status sr-only" role="status" aria-live="polite"',
    );
    h.getAction.mockReturnValue({ canAppend: true, reason: null });
    expect(h.html()).not.toContain("already in the note draft");
  });

  it("keeps Review after a duplicate refusal for the successful choice and blocks it while pending", () => {
    const h = harness();
    h.choose();
    h.button().props.onClick!();
    h.render({
      members: [members.left, { ...members.right, note: "Appended reference" }],
    });
    h.getAction.mockReturnValue({
      canAppend: false,
      reason: "This exact release reference is already in the note draft.",
    });
    h.button().props.onClick!();
    const duplicate = h.render();
    expect(h.html(duplicate)).toContain("already in the note draft");
    expect(h.review(duplicate)).toBeDefined();
    expect(h.append).toHaveBeenCalledOnce();
    const pending = h.render({ state: { ...h.props.state, busy: true } });
    expect(h.review(pending)?.props["aria-disabled"]).toBe(true);
    h.review(duplicate)!.props.onClick!();
    h.review(pending)!.props.onClick!();
    expect(h.onReview).not.toHaveBeenCalled();
    const settled = h.render({ state: { ...h.props.state, busy: false } });
    h.review(settled)!.props.onClick!();
    expect(h.onReview).toHaveBeenCalledOnce();
    h.change("destination", members.left.listingId);
    expect(h.review()).toBeUndefined();
    h.change("destination", members.right.listingId);
    expect(h.review()).toBeUndefined();
  });

  it("shows a distinct append refusal visibly and does not offer Review", () => {
    const h = harness();
    h.choose();
    h.append.mockReturnValue({
      appended: false,
      message: "Current destination was removed.",
    });
    h.button().props.onClick!();
    const node = h.render();
    expect(h.html(node)).toContain(
      'class="managed-bea-note-status" role="status" aria-live="polite">Current destination was removed.',
    );
    expect(h.review(node)).toBeUndefined();
  });

  it("clears hidden mounted choices and success, fences old callbacks and requires fresh choices on return", () => {
    const h = harness();
    h.choose();
    h.button().props.onClick!();
    const old = h.render();
    h.render({ active: false });
    const returned = h.render({ active: true });
    h.review(old)!.props.onClick!();
    h.button(old).props.onClick!();
    h.change("destination", members.left.listingId, old);
    expect(h.select("release", returned).props.value).toBe("");
    expect(h.select("destination", returned).props.value).toBe("");
    expect(h.review(returned)).toBeUndefined();
    expect(h.html(returned)).not.toContain("Reference added.");
    expect(h.append).toHaveBeenCalledOnce();
    expect(h.onReview).not.toHaveBeenCalled();
  });

  it("blocks Review while pending and blocks both actions after unmount", () => {
    const h = harness();
    h.choose();
    h.button().props.onClick!();
    const old = h.render();
    h.render({ state: { ...h.props.state, busy: true } });
    h.review(old)!.props.onClick!();
    expect(h.onReview).not.toHaveBeenCalled();
    h.render({ state: { ...h.props.state, busy: false } });
    const current = h.render();
    h.unmount();
    h.review(current)!.props.onClick!();
    h.button(current).props.onClick!();
    expect(h.onReview).not.toHaveBeenCalled();
    expect(h.append).toHaveBeenCalledOnce();
  });

  it("refuses readonly choices and never uses an abandoned render's actions", () => {
    const h = harness();
    h.choose();
    const committed = h.render();
    const append = vi.fn<Props["actions"]["append"]>();
    const abandoned = h.render(
      { actions: { getAction: h.getAction, append } },
      false,
    );
    h.button(abandoned).props.onClick!();
    expect(append).not.toHaveBeenCalled();
    h.render({ editable: false });
    h.button(committed).props.onClick!();
    h.button().props.onClick!();
    h.change("destination", members.left.listingId);
    expect(h.select("destination").props.value).toBe(members.right.listingId);
    expect(h.append).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it("rechecks committed lifetime if admission itself unmounts the component", () => {
    const h = harness();
    h.choose();
    const node = h.render();
    h.getAction.mockImplementation(() => {
      h.unmount();
      return { canAppend: true, reason: null };
    });
    h.button(node).props.onClick!();
    expect(h.append).not.toHaveBeenCalled();
  });
});
