import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { ManagedCompanyReportRevisit } from "./ManagedCompanyReportRevisit";
import { CompanyReportDocumentView } from "./CompanyReportDocument";
import type {
  CompanyReportRevisitOptions,
  CompanyReportRevisitState,
} from "./company-report-revisit";
import type {
  CompanyReportArchive,
  CompanyReportRevisitSnapshot,
} from "./managed-company-report-archive";
import type { PreparedCompanyReport } from "./managed-company-report";
import { eodSelection } from "./eod-history-fixture";

// Invoke the real component with commit-aware hooks and a mocked controller/projection.
// These checks cover markup and callback ownership, not archive admission, DOM layout
// or React scheduling. Dependency slots persist across commits and abandoned renders.
type Effect = {
  index: number;
  run: () => (() => void) | void;
  deps: readonly unknown[] | undefined;
};
type Slot = {
  deps: readonly unknown[] | undefined;
  cleanup: (() => void) | void;
};
const hooks = vi.hoisted(() => ({
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  pending: [] as Effect[],
  slots: [] as Slot[],
}));
const model = vi.hoisted<{
  create: Mock<(options: unknown) => void>;
  instance: unknown;
  project: Mock<
    (report: PreparedCompanyReport) => CompanyReportRevisitSnapshot
  >;
}>(() => ({
  create: vi.fn<(options: unknown) => void>(),
  instance: null,
  project:
    vi.fn<(report: PreparedCompanyReport) => CompanyReportRevisitSnapshot>(),
}));
vi.mock("./company-report-revisit", () => ({
  CompanyReportRevisit: vi.fn(function (options: unknown) {
    model.create(options);
    return model.instance;
  }),
}));
vi.mock("./managed-company-report-archive", () => ({
  projectCurrentCompanyReport: model.project,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useRef: (initial: unknown) =>
      (hooks.refs[hooks.refIndex++] ??= { current: initial }),
    useState: (initial: unknown) => {
      const index = hooks.stateIndex++;
      if (!(index in hooks.states)) hooks.states[index] = initial;
      return [
        hooks.states[index],
        (value: unknown) => {
          hooks.states[index] = value;
        },
      ];
    },
    useLayoutEffect: (run: Effect["run"], deps?: readonly unknown[]) => {
      hooks.pending.push({ index: hooks.effectIndex++, run, deps });
    },
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      read: () => unknown,
    ) => {
      hooks.pending.push({
        index: hooks.effectIndex++,
        run: () => subscribe(() => undefined),
        deps: [subscribe],
      });
      return read();
    },
  };
});
function changed(effect: Effect) {
  const old = hooks.slots[effect.index];
  if (!old) return true;
  if (!effect.deps) return true;
  if (!old.deps) return true;
  if (old.deps.length !== effect.deps.length) return true;
  return effect.deps.some(
    (value, index) => !Object.is(value, old.deps?.[index]),
  );
}
function commit(effects: Effect[]) {
  const updates = effects.filter(changed);
  for (const effect of updates) hooks.slots[effect.index]?.cleanup?.();
  for (const effect of updates)
    hooks.slots[effect.index] = { deps: effect.deps, cleanup: effect.run() };
}
function unmount() {
  for (const slot of hooks.slots) slot?.cleanup?.();
  hooks.slots = [];
}
beforeEach(() => {
  hooks.stateIndex = 0;
  hooks.refIndex = 0;
  hooks.effectIndex = 0;
  hooks.states = [];
  hooks.refs = [];
  hooks.pending = [];
  hooks.slots = [];
  model.create.mockReset();
  model.project.mockReset();
  vi.stubGlobal("document", { activeElement: null });
});
afterEach(() => {
  unmount();
  vi.unstubAllGlobals();
});

const ARCHIVED_NOTE =
  'Archived complete note <img src=x onerror="alert(1)"> & 原文';
const CURRENT_NOTE =
  'Current complete note <script>alert("current")</script> & 🧭';
const ASSESSMENT = "Raw invalid\nassessment \ud800 Ω";
const WHOLE_NOTE = `${CURRENT_NOTE} Complete dated comparison excerpt and authored assessment.`;
const APPENDIX = '{"unverified":"</textarea><script>alert(3)</script>"}';
const CAPTURE = "Capture current report for comparison";
const PREVIEW = "Preview comparison note";
const APPEND = "Append comparison to note draft";
const CLEAR = "Clear reopened report";
function snapshot(
  note: string,
  preparedAt: string,
): CompanyReportRevisitSnapshot {
  return {
    listing: eodSelection.listing,
    catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
    selectionCik: eodSelection.cik,
    preparedAt,
    note,
    sources: [
      {
        source: "price",
        status: "loaded",
        retainedPrevious: true,
        lastAttemptFailed: true,
        responseOrigin: "Original invented response",
        fields: [
          { label: "Fetched at", value: "2026-09-01T10:11:12.000Z" },
          { label: "Window", value: "2026-08-01 through 2026-08-31" },
        ],
        references: [
          { label: "Reported link", url: "javascript:alert('untrusted')" },
        ],
      },
      {
        source: "annual",
        status: "loaded",
        retainedPrevious: false,
        lastAttemptFailed: false,
        responseOrigin: null,
        fields: [{ label: "Filing accession", value: "0000000001-26-000001" }],
        references: [
          {
            label: "Original filing",
            url: "https://example.test/filing?x=<img>",
          },
        ],
      },
      {
        source: "filings",
        status: "not_loaded",
        retainedPrevious: false,
        lastAttemptFailed: false,
        responseOrigin: null,
        fields: [],
        references: [],
      },
    ],
  };
}
function fixture() {
  const archived: CompanyReportArchive = {
    ...snapshot(ARCHIVED_NOTE, "2026-09-01T12:00:00.000Z"),
    kind: "company_report_archive",
    schemaVersion: "5.0.0",
    byteLength: 200,
    unverifiedAppendix: APPENDIX,
  };
  const current = snapshot(CURRENT_NOTE, "2026-10-23T16:00:00.000Z");
  // Projection is mocked: this deliberately does not claim an admitted live report.
  const prepared = { note: CURRENT_NOTE } as PreparedCompanyReport;
  let state: CompanyReportRevisitState = {
    phase: "review",
    archive: archived,
    current: prepared,
    assessment: "Authored assessment",
    preview: { note: WHOLE_NOTE, excerpt: "Whole excerpt" },
    message: "",
  };
  const listeners = new Set<() => void>();
  const controller = {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reconcile: vi.fn(),
    dispose: vi.fn(),
    clear: vi.fn(),
    readFile: vi.fn(),
    captureCurrent: vi.fn(),
    prepareNote: vi.fn(),
    append: vi.fn(),
    setAssessment: vi.fn(),
    comparisonIsCurrent: () => true,
  };
  model.instance = controller;
  model.project.mockReturnValue(current);
  type Props = Parameters<typeof ManagedCompanyReportRevisit>[0];
  const target = { isCurrent: () => true, append: vi.fn() };
  const defaults = {
    selection: eodSelection,
    target: () => target,
    readWatchlist: vi.fn(),
    price: {},
    annual: {},
    filings: {},
  } as unknown as Props;
  const render = (patch: Partial<Props> = {}, committed = true) => {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    hooks.effectIndex = 0;
    const node = ManagedCompanyReportRevisit({ ...defaults, ...patch });
    const effects = hooks.pending.splice(0);
    if (committed) commit(effects);
    return view(node);
  };
  const mount = () => {
    render();
    return render();
  };
  const options = () =>
    model.create.mock.calls.at(-1)?.[0] as CompanyReportRevisitOptions;
  return {
    controller,
    archived,
    current,
    render,
    mount,
    options,
    observe: (listener: () => void) => {
      listeners.add(listener);
    },
    publish: () => {
      for (const listener of listeners) listener();
    },
    replace: (patch: Partial<CompanyReportRevisitState>) => {
      state = { ...state, ...patch };
    },
  };
}
type Element = React.ReactElement<Record<string, unknown>>;
function elements(node: React.ReactNode): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function text(node: React.ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (React.isValidElement<Record<string, unknown>>(node))
    return text(node.props.children as React.ReactNode);
  return typeof node === "string" || typeof node === "number"
    ? String(node)
    : "";
}
function view(node: React.ReactNode) {
  const all = elements(node);
  const find = (predicate: (element: Element) => boolean) => {
    const found = all.find(predicate);
    if (!found) throw new Error("Expected revisit control");
    return found;
  };
  return {
    node,
    all,
    html: () => renderToStaticMarkup(node),
    button: (label: string) =>
      find(
        (element) =>
          element.type === "button" &&
          text(element.props.children as React.ReactNode) === label,
      ),
    assessment: () =>
      find(
        (element) =>
          element.type === "textarea" &&
          typeof element.props.onChange === "function",
      ),
    file: () =>
      find(
        (element) => element.type === "input" && element.props.type === "file",
      ),
  };
}
function click(element: Element) {
  (element.props.onClick as () => void)();
}
function assess(v: ReturnType<typeof view>) {
  (v.assessment().props.onChange as (event: unknown) => void)({
    currentTarget: { value: ASSESSMENT },
  });
}
function retained(v: ReturnType<typeof view>) {
  for (const label of [CAPTURE, PREVIEW, APPEND]) click(v.button(label));
  assess(v);
}
function expectNoActions(f: ReturnType<typeof fixture>) {
  for (const method of [
    f.controller.captureCurrent,
    f.controller.prepareNote,
    f.controller.append,
    f.controller.setAssessment,
    f.controller.readFile,
    f.controller.clear,
  ])
    expect(method).not.toHaveBeenCalled();
}

describe("Company report revisit committed UI", () => {
  it("keeps the legacy JSON document's exact four frame targets separate from the new disclosure", () => {
    const f = fixture();
    f.replace({ phase: "idle", archive: null, current: null, preview: null });
    const revisit = f.mount();
    // Compose the real document view with its existing disclosure and the real
    // revisit node. This checks the selector boundary, not viewport geometry.
    const html = renderToStaticMarkup(
      <section className="managed-company-report">
        <details className="managed-report-document">
          <summary>Inspect report document (JSON)</summary>
          <CompanyReportDocumentView
            document={{
              purpose: "investment.company-research",
              filename: "invented-report.json",
              text: "{}",
              byteLength: 2,
            }}
          />
        </details>
        {revisit.node}
      </section>,
    );
    const $ = load(html);
    const targets = $(
      ".managed-report-document > summary, #managed-report-document-scope, label[for='managed-report-document'], #managed-report-document",
    );
    expect(targets).toHaveLength(4);
    expect($(".managed-report-document > summary").text()).toBe(
      "Inspect report document (JSON)",
    );
    expect($(".managed-report-revisit").attr("class")).toBe(
      "managed-report-revisit",
    );
    expect(
      targets
        .toArray()
        .every(
          (node) => $(node).closest(".managed-report-revisit").length === 0,
        ),
    ).toBe(true);
    expectNoActions(f);
  });
  it("starts closed and preserves the controller creation lifetime across committed and abandoned renders", () => {
    const f = fixture(),
      v = f.mount(),
      $ = load(v.html());
    expect(
      $("details")
        .toArray()
        .every((node) => $(node).attr("open") === undefined),
    ).toBe(true);
    expect($("summary").first().text()).toBe("Revisit a saved report");
    expect(v.file().props.accept).toBe("application/json,.json");
    expect(v.file().props.disabled).toBe(false);
    f.render();
    f.render({}, false);
    f.render();
    expect(model.create).toHaveBeenCalledOnce();
    expect(f.controller.dispose).not.toHaveBeenCalled();
    expectNoActions(f);
  });
  it("renders complete archived/current identities, raw notes, original provenance and an inert unverified appendix", () => {
    const f = fixture(),
      v = f.mount(),
      $ = load(v.html());
    for (const title of ["Archived report", "Current report capture"]) {
      const section = $(`section[aria-label="${title}"]`);
      for (const value of Object.values(eodSelection.listing))
        expect(section.text()).toContain(value);
      expect(section.text()).toContain(eodSelection.catalogSnapshotSha256);
      expect(section.text()).toContain(eodSelection.cik);
      expect(section.text()).toContain("2026-09-01T10:11:12.000Z");
      expect(section.text()).toContain("2026-08-01 through 2026-08-31");
      expect(section.text()).toContain("0000000001-26-000001");
      expect(section.text()).toContain("Loaded in this capture.");
      expect(section.text()).toContain(
        "Original response origin: Original invented response",
      );
      expect(section.text()).toContain("https://example.test/filing?x=<img>");
      expect(section.text()).toContain("Retained previous response.");
      expect(section.text()).toContain("Last attempt failed.");
      expect(section.text()).toContain("Not loaded in this capture.");
      expect(section.text()).toContain("javascript:alert('untrusted')");
    }
    expect($('section[aria-label="Archived report"]').text()).toContain(
      ARCHIVED_NOTE,
    );
    expect($('section[aria-label="Archived report"]').text()).toContain(
      f.archived.preparedAt,
    );
    expect($('section[aria-label="Current report capture"]').text()).toContain(
      CURRENT_NOTE,
    );
    expect($('section[aria-label="Current report capture"]').text()).toContain(
      f.current.preparedAt,
    );
    expect($("textarea[readonly]").text()).toBe(APPENDIX);
    expect(
      $('section[aria-label="Complete comparison note preview"] p').text(),
    ).toBe(WHOLE_NOTE);
    expect($("script,img,a,iframe")).toHaveLength(0);
    expect(v.html()).toContain("&lt;script&gt;");
    expect($.root().text()).toContain(
      "File contents and authored claims remain unverified.",
    );
    expect($.root().text()).toContain("Nothing is clipped.");
  });
  it("keeps old committed and abandoned callbacks inert while a fresh committed frame can act", () => {
    const f = fixture(),
      old = f.mount();
    const abandoned = f.render({}, false);
    retained(abandoned);
    expectNoActions(f);
    const current = f.render();
    retained(old);
    expectNoActions(f);
    click(current.button(CAPTURE));
    expect(f.controller.captureCurrent).toHaveBeenCalledOnce();
    click(f.render().button(PREVIEW));
    expect(f.controller.prepareNote).toHaveBeenCalledOnce();
    assess(f.render());
    expect(f.controller.setAssessment).toHaveBeenCalledExactlyOnceWith(
      ASSESSMENT,
    );
    click(f.render().button(APPEND));
    expect(f.controller.append).toHaveBeenCalledOnce();
  });
  it.each(["capture", "preview", "append", "assessment"] as const)(
    "consumes the frame before synchronous %s notification and permits a new committed action",
    (action) => {
      const f = fixture(),
        v = f.mount();
      const callback = {
        capture: f.controller.captureCurrent,
        preview: f.controller.prepareNote,
        append: f.controller.append,
        assessment: f.controller.setAssessment,
      }[action];
      f.observe(() => retained(v));
      let notified = false;
      callback.mockImplementation(() => {
        if (notified) return;
        notified = true;
        f.publish();
        retained(v);
      });
      if (action === "assessment") assess(v);
      else
        click(
          v.button(
            { capture: CAPTURE, preview: PREVIEW, append: APPEND }[action],
          ),
        );
      expect(callback).toHaveBeenCalledOnce();
      for (const other of [
        f.controller.captureCurrent,
        f.controller.prepareNote,
        f.controller.append,
        f.controller.setAssessment,
      ].filter((method) => method !== callback))
        expect(other).not.toHaveBeenCalled();
      retained(v);
      expect(callback).toHaveBeenCalledOnce();
      click(f.render().button(CAPTURE));
      expect(f.controller.captureCurrent).toHaveBeenCalledTimes(
        action === "capture" ? 2 : 1,
      );
    },
  );
  it("refuses retained data actions after unmount, including clearing a delivered file input value", () => {
    const f = fixture(),
      v = f.mount();
    unmount();
    retained(v);
    click(v.button(CLEAR));
    const control = {
      files: [{ size: 2, arrayBuffer: vi.fn() }],
      value: "selected.json",
    };
    (v.file().props.onChange as (event: unknown) => void)({
      currentTarget: control,
    });
    expect(control.value).toBe("");
    expectNoActions(f);
    expect(f.controller.dispose).toHaveBeenCalledOnce();
  });
  it("uses only committed selection props and retires the old controller when source ownership changes", () => {
    const f = fixture(),
      v = f.mount(),
      options = f.options();
    f.render({ selection: { ...eodSelection } }, false);
    expect(options.active()).toBe(true);
    expect(model.create).toHaveBeenCalledOnce();
    f.render({
      price: {} as Parameters<typeof ManagedCompanyReportRevisit>[0]["price"],
    });
    expect(f.controller.dispose).toHaveBeenCalledOnce();
    expect(model.create).toHaveBeenCalledTimes(2);
    retained(v);
    expectNoActions(f);
  });
  it("resets a selected file immediately and keeps read/cancel explicit", () => {
    const f = fixture(),
      v = f.mount();
    const file = { size: 2, arrayBuffer: vi.fn() },
      control = { files: [file], value: "selected.json" };
    (v.file().props.onChange as (event: unknown) => void)({
      currentTarget: control,
    });
    expect(control.value).toBe("");
    expect(f.controller.readFile).toHaveBeenCalledExactlyOnceWith(file);
    click(v.button(CLEAR));
    expect(f.controller.clear).not.toHaveBeenCalled();
    f.replace({
      phase: "reading",
      archive: null,
      current: null,
      preview: null,
    });
    const reading = f.render();
    expect(reading.file().props.disabled).toBe(true);
    click(reading.button("Cancel report read"));
    expect(f.controller.clear).toHaveBeenCalledOnce();
  });
});
