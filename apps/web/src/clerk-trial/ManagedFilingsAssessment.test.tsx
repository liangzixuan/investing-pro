import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import {
  ManagedFilingsAssessment,
  type ManagedFilingsAssessmentActions,
} from "./ManagedFilingsAssessment";
import {
  prepareFilingsAssessment,
  type FilingsAssessmentPreview,
  type FilingsAssessmentPort,
} from "./managed-filings-assessment";
import { ManagedResearchFollowups } from "./managed-research-followups";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";
const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  return { ...actual, ...createValuationDraftTestHooks(hooks) };
});
vi.mock("./managed-filings-assessment", () => ({
  prepareFilingsAssessment: vi.fn(),
}));
interface ElementProps {
  id?: string;
  children?: React.ReactNode;
  value?: string;
  disabled?: boolean;
  onApply?: () => void;
  onClick?: (event: { preventDefault: () => void }) => void;
  onChange?: (event: { currentTarget: { value: string } }) => void;
}
function elements(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  return React.isValidElement<ElementProps>(node)
    ? [node, ...React.Children.toArray(node.props.children).flatMap(elements)]
    : [];
}
function hasCleanup(slot: unknown): slot is { cleanup: () => void } {
  return Boolean(
    slot &&
    typeof slot === "object" &&
    "cleanup" in slot &&
    typeof slot.cleanup === "function",
  );
}
function unmount() {
  for (const slot of hooks.slots) if (hasCleanup(slot)) slot.cleanup();
}
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  vi.mocked(prepareFilingsAssessment).mockReset();
});
afterEach(unmount);
function fixture(options: { raw?: string; previous?: boolean } = {}) {
  const response = filingsResponse(27);
  const entry: ResearchFollowup = {
    id: "00000000-0000-4000-8000-000000000001",
    listing: filingsSelection.listing,
    catalogSnapshotSha256: filingsSelection.catalogSnapshotSha256,
    check: "Review margins Café 東京 📈",
    dueOn: "2026-12-31",
    result: options.raw ?? "My independent assessment",
    status: "open",
    completedOn: null,
  };
  const api = {
    loadFollowups: vi.fn(),
    saveFollowups: vi.fn(),
    resolve: vi.fn(),
  };
  const model = new ManagedResearchFollowups(
    api,
    {
      userId: "invented",
      sessionId: "invented",
      getToken: vi.fn(),
      signOut: vi.fn(),
    },
    {
      getCreationContext: () => ({ draft: null, catalogSnapshotSha256: null }),
      onRetire: vi.fn(),
    },
  );
  let live = true;
  let hostActive = true;
  const edit = vi.fn<(raw: string) => boolean>().mockReturnValue(true);
  const port: FilingsAssessmentPort = {
    entry,
    response,
    showingPrevious: options.previous ?? false,
    isCurrent: () => live,
    editAssessment: edit,
  };
  const actions: ManagedFilingsAssessmentActions = {
    model,
    owner: {},
    isCurrent: () => hostActive,
    getContext: vi.fn(() => ({
      port: live ? port : null,
      reason: live ? null : "This visit is no longer current.",
    })),
  };
  const previews: FilingsAssessmentPreview[] = [];
  vi.mocked(prepareFilingsAssessment).mockImplementation(
    (captured, filing, current) => {
      let active = true;
      const isCurrent = () => active && live && current();
      const preview: FilingsAssessmentPreview = {
        entry,
        listing: entry.listing,
        catalogSnapshotSha256: entry.catalogSnapshotSha256,
        response: captured.response,
        filing,
        showingPrevious: captured.showingPrevious,
        result: entry.result + " Complete qualified citation Café 東京 📈",
        citation: "Complete qualified citation Café 東京 📈",
        isCurrent,
        cancel: vi.fn(() => {
          active = false;
        }),
        apply: vi.fn(() => {
          if (!isCurrent()) return false;
          active = false;
          return edit(preview.result);
        }),
      };
      previews.push(preview);
      return { preview, reason: null };
    },
  );
  const props = { response, actions };
  const render = (override: Partial<typeof props> = {}, commit = true) => {
    hooks.index = 0;
    hooks.effects = [];
    const tree = ManagedFilingsAssessment({ ...props, ...override });
    const html = load(renderToStaticMarkup(tree));
    if (commit) for (const effect of hooks.effects) effect();
    return {
      tree,
      html,
      apply: () =>
        elements(tree)
          .find((node) => node.props.onApply)
          ?.props.onApply?.(),
      byId: (id: string) =>
        elements(tree).find(
          (node) => node.props.id === `filings-assessment-${id}`,
        )!,
    };
  };
  const click = (id: string) =>
    render().byId(id).props.onClick!({ preventDefault: vi.fn() });
  const choose = (accession = response.issuer.filings[0]!.accessionNumber) => {
    render().byId("filing").props.onChange!({
      currentTarget: { value: accession },
    });
  };
  const open = () => {
    click("toggle");
    return render();
  };
  const prepared = () => {
    open();
    choose();
    click("preview");
    return render();
  };
  return {
    response,
    entry,
    port,
    actions,
    props,
    model,
    api,
    edit,
    previews,
    render,
    click,
    choose,
    open,
    prepared,
    hostActive: (value: boolean) => {
      hostActive = value;
    },
    live: (value: boolean) => {
      live = value;
    },
  };
}
it("starts closed, performs no source or draft action, and requires an empty explicit original-row choice", () => {
  const f = fixture();
  let view = f.render();
  expect(view.html("details").attr("open")).toBeUndefined();
  expect(view.html("summary").text()).toBe("Cite a filing in this assessment");
  expect(prepareFilingsAssessment).not.toHaveBeenCalled();
  view = f.open();
  expect(view.byId("filing").props.value).toBe("");
  expect(view.html("option")).toHaveLength(28);
  expect(view.byId("preview").props.disabled).toBe(true);
  expect(view.html("textarea")).toHaveLength(0);
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.edit).not.toHaveBeenCalled();
});
it("prepares the exact original row and displays full result, independent identity/date and complete source metadata", () => {
  const f = fixture({ previous: true });
  const view = f.prepared();
  const value = f.previews[0]!;
  expect(prepareFilingsAssessment).toHaveBeenCalledWith(
    f.port,
    f.response.issuer.filings[0],
    expect.anything(),
  );
  expect(typeof vi.mocked(prepareFilingsAssessment).mock.lastCall?.[2]).toBe(
    "function",
  );
  expect(view.html("#filings-assessment-result").val()).toBe(value.result);
  expect(
    view.html("#filings-assessment-result").attr("maxlength"),
  ).toBeUndefined();
  const text = view.html.root().text();
  for (const exact of [
    value.citation,
    f.entry.check,
    f.entry.dueOn,
    "listing-zero",
    "security-zero",
    "class-zero",
    "XNAS",
    f.entry.catalogSnapshotSha256,
    f.response.requestStartedAt,
    f.response.completedAt,
    f.response.issuer.fetchedAt,
    "retained previous response",
    "filing contents were not fetched",
    "Older continuation files were not loaded",
  ])
    expect(text).toContain(exact);
  expect(
    view.html("#filings-assessment-preview-heading").attr("tabindex"),
  ).toBe("-1");
});
it("passes raw oversized or invalid assessment through domain refusal without clipping or adding an editor", () => {
  const raw = "  Café\n" + "📈".repeat(2001);
  const f = fixture({ raw });
  vi.mocked(prepareFilingsAssessment).mockReturnValue({
    preview: null,
    reason:
      "The complete result must fit 2,000 Unicode characters on one line.",
  });
  const view = f.prepared();
  expect(
    vi.mocked(prepareFilingsAssessment).mock.lastCall?.[0].entry.result,
  ).toBe(raw);
  expect(view.html("#filings-assessment-result")).toHaveLength(0);
  expect(view.html("#filings-assessment-status").text()).toContain("2,000");
  expect(f.edit).not.toHaveBeenCalled();
});
it("retires preview and escaped callbacks on selection ABA, cancel and disclosure close/reopen", () => {
  const f = fixture();
  f.prepared();
  const first = f.previews[0]!;
  f.choose(f.response.issuer.filings[1]!.accessionNumber);
  f.choose();
  expect(first.isCurrent()).toBe(false);
  expect(first.apply()).toBe(false);
  f.click("preview");
  const second = f.previews[1]!;
  f.click("cancel");
  expect(second.apply()).toBe(false);
  f.click("preview");
  const third = f.previews[2]!;
  f.click("toggle");
  f.click("toggle");
  expect(third.apply()).toBe(false);
  expect(f.render().byId("filing").props.value).toBe("");
  expect(f.edit).not.toHaveBeenCalled();
});
it("rejects callbacks from an uncommitted render and retires source/host/unmount ABA", () => {
  const f = fixture();
  f.open();
  f.choose();
  const abandoned = f.render({}, false);
  abandoned.byId("preview").props.onClick!({ preventDefault: vi.fn() });
  expect(prepareFilingsAssessment).not.toHaveBeenCalled();
  f.click("preview");
  const first = f.previews[0]!;
  f.render({ response: filingsResponse(1) });
  f.render();
  expect(first.apply()).toBe(false);
  f.open();
  f.choose();
  f.click("preview");
  const second = f.previews[1]!;
  f.render({ actions: { ...f.actions, owner: {} } });
  f.render();
  expect(second.apply()).toBe(false);
  f.open();
  f.choose();
  f.click("preview");
  const third = f.previews[2]!;
  unmount();
  expect(third.apply()).toBe(false);
});
it("permanently retires a stale source/draft preview and lets the form recover without accepting old callbacks", () => {
  const f = fixture();
  f.prepared();
  const old = f.previews[0]!;
  f.live(false);
  expect(f.render().html("#filings-assessment-status").text()).toContain(
    "no longer matches",
  );
  f.live(true);
  f.choose();
  f.click("preview");
  expect(f.previews).toHaveLength(2);
  expect(old.apply()).toBe(false);
});

it("applies once through the UI and leaves completion, source loads and Save separate", () => {
  const f = fixture();
  const view = f.prepared();
  const action = view.apply;
  action();
  action();
  expect(f.edit).toHaveBeenCalledExactlyOnceWith(f.previews[0]!.result);
  expect(f.entry.status).toBe("open");
  expect(f.entry.completedOn).toBeNull();
  expect(f.entry.check).toBe("Review margins Café 東京 📈");
  expect(f.entry.dueOn).toBe("2026-12-31");
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.render().html("#filings-assessment-status").text()).toContain(
    "Citation applied",
  );
});
it("refuses a retired UI Apply callback after form ABA and does not report a successful refused edit", () => {
  const f = fixture();
  const first = f.prepared();
  f.click("cancel");
  f.click("preview");
  first.apply();
  expect(f.edit).not.toHaveBeenCalled();
  vi.mocked(f.previews[1]!.apply).mockReturnValue(false);
  f.render().apply();
  expect(f.render().html("#filings-assessment-status").text()).toContain(
    "no longer current",
  );
  expect(f.edit).not.toHaveBeenCalled();
});
it("does not publish a reentrant prepare result when the disclosure closes during capture", () => {
  const f = fixture();
  f.open();
  f.choose();
  const ready = f.render();
  const close = ready.byId("toggle").props.onClick!;
  vi.mocked(f.actions.getContext).mockImplementation(() => {
    close({ preventDefault: vi.fn() });
    return { port: f.port, reason: null };
  });
  ready.byId("preview").props.onClick!({ preventDefault: vi.fn() });
  expect(f.previews[0]!.cancel).toHaveBeenCalled();
  expect(f.previews[0]!.isCurrent()).toBe(false);
  expect(f.render().html("#filings-assessment-result")).toHaveLength(0);
  expect(f.edit).not.toHaveBeenCalled();
});
it("lets the committed stale form cancel immediately without another render", () => {
  const f = fixture();
  f.prepared();
  f.live(false);
  const stale = f.render();
  stale.byId("cancel").props.onClick!({ preventDefault: vi.fn() });
  f.live(true);
  expect(f.render().html("#filings-assessment-status").text()).toBe("");
  f.choose();
  f.click("preview");
  expect(f.previews).toHaveLength(2);
});

it("retires preview across live router pending ABA before the workspace publishes its navigation revision", () => {
  const f = fixture();
  const view = f.prepared();
  const preview = f.previews[0]!;
  f.hostActive(false);
  const stale = f.render();
  expect(stale.html("#filings-assessment-status").text()).toContain(
    "no longer matches",
  );
  f.hostActive(true);
  view.apply();
  expect(preview.apply()).toBe(false);
  expect(f.edit).not.toHaveBeenCalled();
  f.choose();
  f.click("preview");
  expect(f.previews).toHaveLength(2);
});
