import { describe, expect, it, vi } from "vitest";
import { bindAndroidBack, type AndroidBackAdapter } from "./android-back";

function fixture() {
  let callback: ((event: { canGoBack: boolean }) => void) | undefined;
  let finish: ((handle: { remove: () => Promise<void> }) => void) | undefined;
  let fail: ((reason: Error) => void) | undefined;
  const pending = new Promise<{ remove: () => Promise<void> }>(
    (resolve, reject) => {
      finish = resolve;
      fail = reject;
    },
  );
  const remove = vi.fn(async () => {});
  const exitApp = vi.fn(async () => {});
  const app: AndroidBackAdapter = {
    addListener: vi.fn(
      (
        _name: "backButton",
        listener: (event: { canGoBack: boolean }) => void,
      ) => {
        callback = listener;
        return pending;
      },
    ),
    exitApp,
  };
  const goBack = vi.fn();
  const unavailable = vi.fn();
  const dispose = bindAndroidBack(app, goBack, unavailable);
  return {
    app,
    exitApp,
    goBack,
    unavailable,
    dispose,
    remove,
    back: (canGoBack: boolean) => callback?.({ canGoBack }),
    ready: () => finish?.({ remove }),
    fail: () => fail?.(new Error("Native listener unavailable")),
  };
}

describe("Android Back lifetime", () => {
  it("uses router history when the WebView has a previous entry", () => {
    const f = fixture();
    f.back(true);
    expect(f.goBack).toHaveBeenCalledOnce();
    expect(f.exitApp).not.toHaveBeenCalled();
    f.ready();
    f.dispose();
  });
  it("exits at the root instead of inventing another route", () => {
    const f = fixture();
    f.back(false);
    expect(f.exitApp).toHaveBeenCalledOnce();
    expect(f.goBack).not.toHaveBeenCalled();
    f.ready();
    f.dispose();
  });
  it("retires callbacks immediately and removes a late registration exactly once", async () => {
    const f = fixture();
    f.dispose();
    f.dispose();
    f.back(true);
    f.back(false);
    f.ready();
    await Promise.resolve();
    expect(f.remove).toHaveBeenCalledOnce();
    expect(f.goBack).not.toHaveBeenCalled();
    expect(f.exitApp).not.toHaveBeenCalled();
  });
  it("reports failed registration while mounted without an unhandled rejection", async () => {
    const f = fixture();
    f.fail();
    await Promise.resolve();
    expect(f.unavailable).toHaveBeenCalledOnce();
    f.dispose();
  });
  it("does not update an unmounted client after registration failure", async () => {
    const f = fixture();
    f.dispose();
    f.fail();
    await Promise.resolve();
    expect(f.unavailable).not.toHaveBeenCalled();
  });
  it("reports exit failure without changing the route", async () => {
    const f = fixture();
    f.exitApp.mockRejectedValueOnce(new Error("Unavailable"));
    f.back(false);
    await Promise.resolve();
    expect(f.unavailable).toHaveBeenCalledOnce();
    expect(f.goBack).not.toHaveBeenCalled();
    f.ready();
    f.dispose();
  });
});
