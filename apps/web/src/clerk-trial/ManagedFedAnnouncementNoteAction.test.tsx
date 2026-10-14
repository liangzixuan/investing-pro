import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedFedAnnouncementNoteAction } from "./ManagedFedAnnouncementNoteAction";
import { annualComparisonMemberships as members } from "./annual-comparison-fixture";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import { parseManagedMonetaryAnnouncements } from "@research-cockpit/contracts";
import { projectFedAnnouncementView } from "../features/markets/fed-announcement-view";

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
  useId: () => "fed-note-help",
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
type Props = React.ComponentProps<typeof ManagedFedAnnouncementNoteAction>;
type Control = React.ReactElement<
  React.ComponentProps<"select"> & { onClick?: () => void }
>;
function controls(node: React.ReactNode): Control[] {
  if (Array.isArray(node)) return node.flatMap(controls);
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
  return [node as Control, ...controls(node.props.children)];
}
function harness(initial: Partial<Props> = {}) {
  const packet = parseManagedMonetaryAnnouncements(fedAnnouncementsFixture())!;
  const getAction = vi.fn<Props["actions"]["getAction"]>(
    (capture, destination) => ({
      canAppend: !!capture && !!destination,
      reason: !capture
        ? "Choose a loaded announcement."
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
      announcements: packet,
      refreshComparison: null,
      busy: false,
      error: null,
      message: "",
      showingPrevious: false,
    },
    members: [members.left, members.right],
    active: true,
    editable: true,
    actions: { getAction, append },
    onReview,
    view: projectFedAnnouncementView(
      initial.state?.announcements ?? packet,
      "",
    ),
    ...initial,
  };
  let cleanup: (() => void) | undefined;
  const render = (changes: Partial<Props> = {}, commit = true) => {
    props = { ...props, ...changes };
    if (changes.state && !changes.view)
      props.view = projectFedAnnouncementView(changes.state.announcements, "");
    let node: ReturnType<typeof ManagedFedAnnouncementNoteAction>;
    for (let i = 0; i < 4; i++) {
      hooks.stateIndex = 0;
      hooks.memoIndex = 0;
      hooks.changed = false;
      node = ManagedFedAnnouncementNoteAction(props);
      if (!hooks.changed) break;
    }
    if (commit) {
      cleanup?.();
      cleanup = hooks.effect?.();
    }
    return node!;
  };
  const select = (id: "announcement" | "destination", node = render()) =>
    controls(node).find((c) => c.props.id === `managed-fed-note-${id}`)!;
  const button = (node = render()) =>
    controls(node).find((c) => c.type === "button")!;
  const review = (node = render()) =>
    controls(node).find(
      (c) =>
        c.type === "button" && c.props.children === "Review in My Watchlist",
    );
  const change = (
    id: "announcement" | "destination",
    value: string,
    node = render(),
  ) =>
    select(id, node).props.onChange!({
      currentTarget: { value },
    } as React.ChangeEvent<HTMLSelectElement>);
  const choose = () => {
    change("announcement", packet.items[0]!.url);
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

describe("Fed announcement note choices", () => {
  it("clears a hidden announcement and success without restoring them on Clear, and keeps its destination", () => {
    const h = harness();
    h.choose();
    h.button().props.onClick!();
    const old = h.render();
    const filtered = h.render({
      view: projectFedAnnouncementView(h.packet, "without"),
    });
    expect(h.select("announcement", filtered).props.value).toBe("");
    expect(h.select("destination", filtered).props.value).toBe(
      members.right.listingId,
    );
    expect(h.html(filtered)).toContain(
      "The chosen announcement is outside this title search.",
    );
    expect(h.html(filtered)).not.toContain("Reference added.");
    expect(h.review(filtered)).toBeUndefined();
    h.button(old).props.onClick!();
    h.review(old)!.props.onClick!();
    h.change("announcement", h.packet.items[0]!.url, filtered);
    expect(h.append).toHaveBeenCalledOnce();
    expect(h.onReview).not.toHaveBeenCalled();
    const cleared = h.render({
      view: projectFedAnnouncementView(h.packet, ""),
    });
    expect(h.select("announcement", cleared).props.value).toBe("");
    expect(h.select("destination", cleared).props.value).toBe(
      members.right.listingId,
    );
    expect(h.review(cleared)).toBeUndefined();
    h.change("announcement", h.packet.items[1]!.url);
    expect(h.html()).not.toContain("outside this title search");
    h.button().props.onClick!();
    expect(h.append.mock.calls[1]![0]!.item).toBe(h.packet.items[1]);
    expect(h.append.mock.calls[1]![1]).toBe(members.right);
  });
  it("keeps a matching choice, exact capture and Review during a reading-only search", () => {
    const h = harness();
    h.choose();
    h.button().props.onClick!();
    const node = h.render({
      editable: false,
      view: projectFedAnnouncementView(h.packet, " MONETARY   POLICY "),
    });
    expect(h.select("announcement", node).props.value).toBe(
      h.packet.items[0]!.url,
    );
    expect(h.html(node)).toContain("Reference added.");
    expect(h.select("announcement", node).props["aria-disabled"]).toBe(true);
    expect(h.review(node)!.props["aria-disabled"]).toBe(false);
    h.review(node)!.props.onClick!();
    expect(h.onReview).toHaveBeenCalledWith(members.right);
    expect(h.append).toHaveBeenCalledOnce();
  });
  it("offers only exact matching URLs in source order and refuses a mismatched view", () => {
    const h = harness();
    const node = h.render({
      view: projectFedAnnouncementView(h.packet, "without"),
    });
    const options = controls(h.select("announcement", node)).filter(
      (entry) => entry.type === "option",
    );
    expect(options.map((entry) => entry.props.value)).toEqual([
      "",
      h.packet.items[1]!.url,
    ]);
    h.change("announcement", h.packet.items[1]!.url, node);
    h.change("destination", members.left.listingId);
    const replacement = parseManagedMonetaryAnnouncements(
      fedAnnouncementsFixture(),
    )!;
    const mismatch = h.render({
      view: projectFedAnnouncementView(replacement, ""),
    });
    expect(h.select("announcement", mismatch).props.value).toBe("");
    h.button(mismatch).props.onClick!();
    expect(h.append).not.toHaveBeenCalled();
  });
  it("starts with two explicit blank native choices and a focusable guarded action", () => {
    const h = harness();
    const node = h.render();
    const html = h.html(node);
    expect(h.select("announcement", node).props.value).toBe("");
    expect(h.select("destination", node).props.value).toBe("");
    expect(html).toContain('for="managed-fed-note-announcement"');
    expect(html).toContain('for="managed-fed-note-destination"');
    expect(h.select("announcement", node).props["aria-describedby"]).toBe(
      "fed-note-help-announcement fed-note-help",
    );
    expect(h.select("destination", node).props["aria-describedby"]).toBe(
      "fed-note-help-member fed-note-help",
    );
    expect(h.button(node).props["aria-disabled"]).toBe(true);
    expect(h.button(node).props.disabled).toBeUndefined();
    expect(html).toContain("Choose a loaded announcement.");
    expect(h.review(node)).toBeUndefined();
    h.button(node).props.onClick!();
    expect(h.append).not.toHaveBeenCalled();
    expect(h.onReview).not.toHaveBeenCalled();
  });

  it("uses exact item URLs and full draft order, with wrapping full title and identity text", () => {
    const h = harness({ members: [members.right, members.left] });
    h.choose();
    const node = h.render();
    const html = h.html(node);
    expect(html.indexOf('value="listing-one"')).toBeLessThan(
      html.indexOf('value="listing-zero"'),
    );
    expect(h.select("announcement", node).props.value).toBe(
      h.packet.items[0]!.url,
    );
    expect(html).toContain(
      `Selected announcement: ${h.packet.items[0]!.title}`,
    );
    expect(html).toContain("ONE · One Company · One Class A · Class A · XNAS");
    expect(h.append).not.toHaveBeenCalled();
    expect(h.onReview).not.toHaveBeenCalled();
    h.button(node).props.onClick!();
    const [capture, destination] = h.append.mock.calls[0]!;
    expect(capture?.response).toBe(h.packet);
    expect(capture?.item).toBe(h.packet.items[0]);
    expect(capture?.showingPrevious).toBe(false);
    expect(destination).toBe(members.right);
  });

  it("keeps exact Unicode and markup-looking title text without interpreting HTML", () => {
    const packet = parseManagedMonetaryAnnouncements({
      ...fedAnnouncementsFixture(),
      items: [
        {
          ...fedAnnouncementsFixture().items[0]!,
          title: "<img> Cafe\u0301 東京 😀 & policy",
        },
      ],
      availableItemCount: 1,
    })!;
    const h = harness({
      state: {
        announcements: packet,
        refreshComparison: null,
        busy: false,
        error: null,
        message: "",
        showingPrevious: false,
      },
    });
    h.change("announcement", packet.items[0]!.url);
    h.change("destination", members.left.listingId);
    const node = h.render();
    expect(h.html(node)).toContain(
      "&lt;img&gt; Cafe\u0301 東京 😀 &amp; policy",
    );
    expect(h.html(node)).not.toContain("<img>");
    h.button(node).props.onClick!();
    expect(h.append.mock.calls[0]![0]?.item.title).toBe(packet.items[0]!.title);
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
    h.change("announcement", "https://example.invalid/");
    expect(h.select("destination").props.value).toBe("");
    expect(h.select("announcement").props.value).toBe(h.packet.items[0]!.url);
    h.change("announcement", "");
    expect(h.select("announcement").props.value).toBe("");
    expect(h.append).not.toHaveBeenCalled();
  });

  it.each(["equal", "empty"] as const)(
    "clears the item on a successful %s packet and fences the old action",
    (kind) => {
      const h = harness();
      h.choose();
      h.button().props.onClick!();
      const old = h.render();
      const replacement =
        kind === "equal"
          ? structuredClone(h.packet)
          : { ...h.packet, availableItemCount: 0, items: [] };
      h.render({ state: { ...h.props.state, announcements: replacement } });
      expect(h.select("announcement").props.value).toBe("");
      expect(h.select("destination").props.value).toBe(members.right.listingId);
      h.button(old).props.onClick!();
      h.review(old)!.props.onClick!();
      expect(h.append).toHaveBeenCalledOnce();
      expect(h.onReview).not.toHaveBeenCalled();
      expect(h.review()).toBeUndefined();
      h.render({ state: { ...h.props.state, announcements: h.packet } });
      expect(h.select("announcement").props.value).toBe("");
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
      h.change("announcement", h.packet.items[1]!.url, pending);
      expect(h.append).not.toHaveBeenCalled();
      expect(h.html()).toContain("Wait for the announcements request");
      const settled = h.render({
        state: { ...h.props.state, busy: false, error },
      });
      expect(h.select("announcement", settled).props.value).toBe(
        h.packet.items[0]!.url,
      );
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
      reason: "This exact announcement reference is already in the note draft.",
    });
    h.button(node).props.onClick!();
    expect(h.append).not.toHaveBeenCalled();
    expect(h.html()).toContain(
      'class="managed-fed-note-status sr-only" role="status" aria-live="polite"',
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
      reason: "This exact announcement reference is already in the note draft.",
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
      'class="managed-fed-note-status" role="status" aria-live="polite">Current destination was removed.',
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
    expect(h.select("announcement", returned).props.value).toBe("");
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
