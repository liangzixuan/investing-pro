import { afterEach, describe, expect, it, vi } from "vitest";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { AndroidBackAdapter } from "../../src/mobile/android-back";
import { observePortfolioDatedBack } from "./portfolio-dated-back-observation";

function fixture() {
  vi.stubGlobal("location", { href: "https://localhost/?company=invented" });
  const remove = vi.fn(() => Promise.resolve());
  const subscription = Promise.resolve({ remove });
  let listener: (event: { canGoBack: boolean }) => unknown = () => undefined;
  const addListener = vi.fn<AndroidBackAdapter["addListener"]>(
    (_name, next) => {
      listener = next;
      return subscription;
    },
  );
  const app: AndroidBackAdapter = { addListener };
  const canNavigate = vi.fn(() => true);
  // Explicit synthetic read surface; this test does not claim model navigation.
  const workspace = {
    getSnapshot: () => ({ view: "followups", research: {}, companyRoute: {} }),
    canNavigate,
    coordinator: { getSnapshot: () => ({ phase: "idle" }) },
  } as unknown as ManagedWorkspace;
  return {
    app,
    addListener,
    workspace,
    canNavigate,
    remove,
    subscription,
    send: (event: { canGoBack: boolean }) => listener(event),
  };
}
afterEach(() => vi.unstubAllGlobals());
describe("invented Portfolio Back observation", () => {
  it("preserves one subscription, exact event, return and removal", async () => {
    const f = fixture(),
      observed = observePortfolioDatedBack(f.app, f.workspace);
    const token = {},
      callback = vi.fn(() => token),
      event = { canGoBack: true };
    const result = observed.adapter.addListener("backButton", callback);
    expect(result).toBe(f.subscription);
    expect(f.addListener).toHaveBeenCalledTimes(1);
    expect(f.send(event)).toBe(token);
    expect(callback).toHaveBeenCalledExactlyOnceWith(event);
    expect(observed.events.map((row) => row.stage)).toEqual([
      "callback-entry",
      "callback-exit",
    ]);
    expect((await result).remove).toBe(f.remove);
    await (await result).remove();
    expect(f.remove).toHaveBeenCalledTimes(1);
  });
  it("returns the exact promise without adding a rejection observer", () => {
    const f = fixture(),
      observed = observePortfolioDatedBack(f.app, f.workspace);
    const promise = Promise.resolve(1),
      then = vi.spyOn(promise, "then");
    const callback: () => unknown = () => promise;
    void observed.adapter.addListener("backButton", callback);
    expect(f.send({ canGoBack: false })).toBe(promise);
    expect(then).not.toHaveBeenCalled();
  });
  it("propagates the exact callback throw while retaining both observations", () => {
    const f = fixture(),
      observed = observePortfolioDatedBack(f.app, f.workspace);
    const error = new Error("invented callback failure");
    void observed.adapter.addListener("backButton", () => {
      throw error;
    });
    expect(() => f.send({ canGoBack: false })).toThrow(error);
    expect(observed.events).toHaveLength(2);
  });
  it("cannot block forwarding when observation getters fail", () => {
    const f = fixture(),
      observed = observePortfolioDatedBack(f.app, f.workspace);
    f.canNavigate.mockImplementation(() => {
      throw new Error("invented unavailable diagnostic");
    });
    const callback = vi.fn(() => 17);
    void observed.adapter.addListener("backButton", callback);
    expect(f.send({ canGoBack: true })).toBe(17);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(observed.events).toHaveLength(0);
  });
  it("bounds metadata and keeps separate sessions isolated", () => {
    const f = fixture(),
      a = observePortfolioDatedBack(f.app, f.workspace);
    const b = observePortfolioDatedBack(f.app, f.workspace);
    void a.adapter.addListener("backButton", () => undefined);
    for (let i = 0; i < 20; i++) f.send({ canGoBack: true });
    expect(a.events).toHaveLength(24);
    expect(a.events[0]!.sequence).toBe(17);
    expect(a.events[23]!.sequence).toBe(40);
    expect(b.events).toEqual([]);
    expect(Object.keys(a.events[0]!)).toEqual([
      "sequence",
      "stage",
      "time",
      "url",
      "canGoBack",
      "canNavigate",
      "phase",
      "view",
      "researchPresent",
      "companyRoutePresent",
    ]);
  });
});
