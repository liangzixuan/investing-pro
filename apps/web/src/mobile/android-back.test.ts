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
  const app: AndroidBackAdapter & { exitApp: () => Promise<void> } = {
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
  const onBack =
    vi.fn<(event: { canGoBack: boolean }) => void | Promise<void>>();
  const unavailable = vi.fn();
  const dispose = bindAndroidBack(app, onBack, unavailable);
  return {
    app,
    exitApp,
    onBack,
    unavailable,
    dispose,
    remove,
    back: (canGoBack: boolean) => callback?.({ canGoBack }),
    ready: () => finish?.({ remove }),
    fail: () => fail?.(new Error("Native listener unavailable")),
  };
}

describe("Android Back lifetime", () => {
  it("delegates each native event without choosing history or root behavior", () => {
    const f = fixture();
    f.back(true);
    f.back(false);
    expect(f.onBack.mock.calls).toEqual([
      [{ canGoBack: true }],
      [{ canGoBack: false }],
    ]);
    expect(f.exitApp).not.toHaveBeenCalled();
    f.ready();
    f.dispose();
  });
  it("reports a synchronous policy failure", () => {
    const f = fixture();
    f.onBack.mockImplementation(() => {
      throw new Error("Unavailable");
    });
    f.back(false);
    expect(f.unavailable).toHaveBeenCalledOnce();
    expect(f.exitApp).not.toHaveBeenCalled();
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
    expect(f.onBack).not.toHaveBeenCalled();
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
  it("reports asynchronous policy failure while mounted", async () => {
    const f = fixture();
    f.onBack.mockRejectedValueOnce(new Error("Unavailable"));
    f.back(false);
    await Promise.resolve();
    expect(f.unavailable).toHaveBeenCalledOnce();
    expect(f.exitApp).not.toHaveBeenCalled();
    f.ready();
    f.dispose();
  });
  it("ignores a policy rejection after disposal", async () => {
    const f = fixture();
    f.onBack.mockRejectedValueOnce(new Error("Unavailable"));
    f.back(true);
    f.dispose();
    await Promise.resolve();
    expect(f.unavailable).not.toHaveBeenCalled();
    f.ready();
  });
});
