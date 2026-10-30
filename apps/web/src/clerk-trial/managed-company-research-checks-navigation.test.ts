import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";
import { useManagedCompanyNavigation } from "./useManagedCompanyNavigation";
import { managedCompanyHref } from "./managed-company-route";

// Exercise the hook's actual transitions against a real workspace. The router
// harness supplies PUSH/REPLACE/POP and preserves the same hook slots per mount.
type Navigate = (
  to: string | number,
  options?: { replace?: boolean; state?: unknown },
) => void;
type Entry = { pathname: string; search: string; key: string; state: unknown };
const mount = vi.hoisted(() => ({
  slots: [] as unknown[],
  index: 0,
  layouts: [] as Array<() => unknown>,
  effects: [] as Array<() => unknown>,
  entries: [{ pathname: "/", search: "", key: "0", state: null }] as Entry[],
  cursor: 0,
  sequence: 0,
  action: "POP",
  navigate: vi.fn<Navigate>(),
}));
vi.mock("react", () => {
  const effect = (
    queue: Array<() => unknown>,
    callback: () => unknown,
    deps: unknown[],
  ) => {
    const index = mount.index++;
    const prior = mount.slots[index] as unknown[] | undefined;
    if (!prior || deps.some((value, i) => value !== prior[i]))
      queue.push(callback);
    mount.slots[index] = deps;
  };
  return {
    useRef: (value: unknown) => {
      const index = mount.index++;
      return (mount.slots[index] ??= { current: value });
    },
    useState: (initial: unknown) => {
      const index = mount.index++;
      if (!(index in mount.slots))
        mount.slots[index] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        mount.slots[index],
        (value: unknown) => {
          mount.slots[index] =
            typeof value === "function"
              ? (value as (previous: unknown) => unknown)(mount.slots[index])
              : value;
        },
      ];
    },
    useCallback: (callback: unknown, deps: unknown[]) => {
      const index = mount.index++;
      const previous = mount.slots[index] as
        { callback: unknown; deps: unknown[] } | undefined;
      if (!previous || deps.some((value, i) => value !== previous.deps[i]))
        mount.slots[index] = { callback, deps };
      return (mount.slots[index] as { callback: unknown }).callback;
    },
    useLayoutEffect: (callback: () => unknown, deps: unknown[]) =>
      effect(mount.layouts, callback, deps),
    useEffect: (callback: () => unknown, deps: unknown[]) =>
      effect(mount.effects, callback, deps),
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) =>
      getSnapshot(),
  };
});
vi.mock("react-router", () => ({
  NavigationType: { Pop: "POP" },
  useLocation: () => mount.entries[mount.cursor],
  useNavigate: () => mount.navigate,
  useNavigationType: () => mount.action,
}));
beforeEach(() => {
  mount.slots = [];
  mount.index = 0;
  mount.layouts = [];
  mount.effects = [];
  mount.entries = [{ pathname: "/", search: "", key: "0", state: null }];
  mount.cursor = 0;
  mount.sequence = 0;
  mount.action = "POP";
  mount.navigate
    .mockReset()
    .mockImplementation(
      (
        to: string | number,
        options?: { replace?: boolean; state?: unknown },
      ) => {
        if (typeof to === "number") {
          mount.cursor += to;
          mount.action = "POP";
          return;
        }
        const url = new URL(to, "https://invented.invalid");
        const entry = {
          pathname: url.pathname,
          search: url.search,
          key: String(++mount.sequence),
          state: options?.state ?? null,
        };
        if (options?.replace) {
          mount.entries[mount.cursor] = entry;
          mount.action = "REPLACE";
        } else {
          mount.entries.splice(mount.cursor + 1);
          mount.entries.push(entry);
          mount.cursor++;
          mount.action = "PUSH";
        }
      },
    );
});
async function settle() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

const fixtures: Awaited<ReturnType<typeof createFollowupsReviewFixture>>[] = [];
afterEach(() => fixtures.splice(0).forEach((f) => f.dispose()));
async function setup(direct: boolean) {
  const f = await createFollowupsReviewFixture();
  fixtures.push(f);
  const workspace = f.workspace;
  workspace.setView(direct ? "discover" : "watchlist");
  if (direct) {
    const url = new URL(
      managedCompanyHref(f.entries[0]!.listing.listingId, "eod"),
      "https://invented.invalid",
    );
    mount.entries[0] = {
      pathname: "/",
      search: url.search,
      key: "0",
      state: null,
    };
  }
  const render = () => {
    mount.index = 0;
    const navigation = useManagedCompanyNavigation(workspace);
    while (mount.layouts.length) mount.layouts.shift()!();
    while (mount.effects.length) mount.effects.shift()!();
    return navigation;
  };
  render();
  await settle();
  return { ...f, render };
}
it("admits an explicitly selected check on the actual settled direct router and selects it after Review settles", async () => {
  const f = await setup(true);
  let navigation = f.render();
  const visit = f.workspace.getSnapshot().research!;
  expect(visit.selection.origin).toBe("route");
  const readout = f.workspace.getCompanyResearchChecks(visit.selection)!;
  expect(readout.canAttach).toBe(true);
  expect(readout.attach(readout.followups.value!)?.isCurrent()).toBe(true);
  const context = f.workspace.researchFollowupContext(visit.selection)!;
  context.editAssessment("Direct route assessment");
  navigation = f.render();
  const review = f.workspace.reviewCompanyResearchCheck(visit.selection, () =>
    navigation.view("followups"),
  );
  expect(review).not.toBeNull();
  expect(review!.isCurrent()).toBe(false);
  f.render();
  await settle();
  navigation = f.render();
  expect(navigation.pending).toBe(false);
  expect(review!.isCurrent()).toBe(true);
  expect(f.workspace.followups.getSnapshot().selectedId).toBe(
    readout.followups.value!.id,
  );
  expect(f.workspace.getSnapshot().view).toBe("followups");
  expect(mount.entries[mount.cursor]!.search).toBe("");
});
it("keeps the original Back history and retires pre-section callbacks while the explicit association crosses sections", async () => {
  const f = await setup(false);
  let navigation = f.render();
  navigation.open(() =>
    f.workspace.openWatchlistEod(
      f.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    ),
  );
  f.render();
  await settle();
  navigation = f.render();
  const visit = f.workspace.getSnapshot().research!;
  const origin = mount.entries[mount.cursor]!.state;
  const context = f.workspace.getCompanyResearchChecks(visit.selection)!;
  expect(context.attach(context.followups.value!)?.isCurrent()).toBe(true);
  const assessment = f.workspace.researchFollowupContext(visit.selection)!;
  navigation.section("filings");
  f.render();
  await settle();
  navigation = f.render();
  expect(f.workspace.getSnapshot().research!.selection).toBe(visit.selection);
  expect(mount.entries[mount.cursor]!.state).toBe(origin);
  expect(assessment.isCurrent()).toBe(false);
  expect(f.workspace.researchFollowupContext(visit.selection)?.editable).toBe(
    true,
  );
  navigation.back();
  f.render();
  await settle();
  navigation = f.render();
  expect(f.workspace.getSnapshot().view).toBe("watchlist");
  expect(f.workspace.getSnapshot().research).toBeNull();
  expect(mount.cursor).toBe(0);
  expect(navigation.returnFocus).toBeGreaterThan(0);
  expect(context.attach(context.followups.value!)).toBeNull();
});
