import { afterEach, describe, expect, it, vi } from "vitest";
import {
  comparisonFollowupFixture,
  disposeComparisonFollowupFixture,
  held,
} from "./managed-screen-comparison-followup-fixture";
import { ManagedScreenComparisonFollowupContext } from "./managed-screen-comparison-followup-context";

const fixtures: Awaited<ReturnType<typeof comparisonFollowupFixture>>[] = [];
async function fixture(load = true) {
  const f = await comparisonFollowupFixture(load);
  fixtures.push(f);
  return f;
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
type RetirementCase = readonly [string, (f: Fixture) => void, string];
const cases: readonly RetirementCase[] = [
  [
    "financial screen publication",
    (f) => f.screen.choose("left", null),
    "The screening context changed.",
  ],
  [
    "Watchlist publication",
    (f) => {
      const draft = f.watchlist.getSnapshot().draft!;
      f.watchlist.replaceDraft({
        ...draft,
        memberships: [...draft.memberships],
      });
    },
    "My Watchlist changed.",
  ],
  [
    "navigation revision",
    (f) => {
      f.state.navigation++;
      f.updates.emit();
    },
    "Navigation or the catalog context changed.",
  ],
  [
    "catalog revision",
    (f) => {
      f.state.catalog = { ...f.state.catalog };
      f.updates.emit();
    },
    "Navigation or the catalog context changed.",
  ],
  [
    "Follow-ups file activity",
    (f) => {
      const activity = {};
      f.followups.beginDraftFileActivity(activity);
      f.followups.endDraftFileActivity(activity);
    },
    "A Follow-ups file operation started or ended.",
  ],
  [
    "workspace access",
    (f) => {
      f.state.available = false;
      f.updates.emit();
    },
    "The current workspace or session is no longer available.",
  ],
  [
    "session access",
    (f) => {
      f.state.sessionPhase = "expired";
      f.sessions.emit();
    },
    "The current workspace or session is no longer available.",
  ],
  [
    "UI selection",
    (f) => {
      f.form.source = false;
    },
    "The comparison form or selection is no longer current.",
  ],
  [
    "context closure",
    (f) => f.context.retire(),
    "This comparison workspace was closed.",
  ],
];
afterEach(() => {
  for (const f of fixtures.splice(0)) disposeComparisonFollowupFixture(f);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("owned comparison retirement reasons", () => {
  it.each(cases)(
    "records the first observed %s reason",
    async (_name, mutate, reason) => {
      const f = await fixture();
      expect(f.context.retirementReason(f.source)).toBeNull();
      mutate(f);
      expect(f.source.isCurrent()).toBe(false);
      expect(f.context.retirementReason(f.source)).toBe(reason);
      f.state.navigation++;
      f.updates.emit();
      expect(f.source.isCurrent()).toBe(false);
      expect(f.context.retirementReason(f.source)).toBe(reason);
    },
  );
  it("does not evaluate guards or publish when looking up an owned, copied or foreign reason", async () => {
    const f = await fixture();
    const other = new ManagedScreenComparisonFollowupContext(f.host);
    const available = vi.spyOn(f.host, "available");
    const revision = vi.spyOn(f.host, "revision");
    f.form.source = false;
    expect(f.context.retirementReason(f.source)).toBeNull();
    expect(f.context.retirementReason({ ...f.source })).toBeNull();
    expect(other.retirementReason(f.source)).toBeNull();
    expect(available).not.toHaveBeenCalled();
    expect(revision).not.toHaveBeenCalled();
    other.retire();
    expect(f.source.isCurrent()).toBe(false);
    expect(f.context.retirementReason(f.source)).toBe(
      "The comparison form or selection is no longer current.",
    );
    expect(f.context.retirementReason({ ...f.source })).toBeNull();
  });
  it("keeps the first epoch cause across later publications and permanent ABA", async () => {
    const f = await fixture();
    f.screen.choose("left", null);
    f.screen.choose("left", f.screen.rows[0]!);
    const draft = f.watchlist.getSnapshot().draft!;
    f.watchlist.replaceDraft({ ...draft, memberships: [...draft.memberships] });
    expect(f.source.isCurrent()).toBe(false);
    expect(f.context.retirementReason(f.source)).toBe(
      "The screening context changed.",
    );
    expect(f.capture().isCurrent()).toBe(true);
    expect(f.source.isCurrent()).toBe(false);
  });
  it("retains the source without a reason through an explicit initial load and later draft edit", async () => {
    const f = await fixture(false);
    const pending = held<ReturnType<typeof f.stored>>();
    f.api.loadFollowups.mockImplementationOnce(() => pending.promise);
    const loading = f.context.load(f.source, "left", () => true);
    expect(f.followups.coordinator.getSnapshot().phase).toBe("loading");
    expect(f.source.isCurrent()).toBe(true);
    expect(f.context.retirementReason(f.source)).toBeNull();
    pending.resolve(f.stored());
    await loading;
    const port = f.port();
    const draft = f.followups.coordinator.getSnapshot().draft!;
    f.followups.coordinator.replaceDraft({
      ...draft,
      entries: [...draft.entries],
    });
    expect(port.isCurrent()).toBe(false);
    expect(f.source.isCurrent()).toBe(true);
    expect(f.context.retirementReason(f.source)).toBeNull();
    expect(f.api.loadFollowups).toHaveBeenCalledOnce();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  });
  it("records a thrown currentness check once and never rechecks it from the reason readout", async () => {
    const f = await fixture();
    const revision = vi.spyOn(f.host, "revision").mockImplementation(() => {
      throw new Error("invented currentness failure");
    });
    expect(f.source.isCurrent()).toBe(false);
    expect(f.context.retirementReason(f.source)).toBe(
      "The comparison context could not be checked.",
    );
    expect(revision).toHaveBeenCalledOnce();
    expect(f.source.isCurrent()).toBe(false);
    expect(revision).toHaveBeenCalledOnce();
    revision.mockRestore();
  });
});
