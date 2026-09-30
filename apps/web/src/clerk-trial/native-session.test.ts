import { describe, expect, it, vi } from "vitest";
import { NativeTrialSessionStore } from "./native-session";
import type { InvestmentAuthPlugin, NativeAuthState } from "./native-session";

const signedIn: NativeAuthState = {
  status: "signedIn",
  userId: "user_demo",
  sessionId: "session_demo",
  generation: 1,
};
const signedOut: NativeAuthState = {
  status: "signedOut",
  userId: null,
  sessionId: null,
  generation: 2,
};
function fixture() {
  let emit!: (state: NativeAuthState) => void;
  const remove = vi.fn<() => Promise<void>>().mockResolvedValue();
  const plugin: InvestmentAuthPlugin = {
    getState: vi
      .fn<InvestmentAuthPlugin["getState"]>()
      .mockResolvedValue(signedIn),
    signIn: vi.fn<InvestmentAuthPlugin["signIn"]>().mockResolvedValue(signedIn),
    getToken: vi.fn<InvestmentAuthPlugin["getToken"]>().mockResolvedValue({
      token: "synthetic-native-token",
      generation: 1,
      sessionId: "session_demo",
    }),
    signOut: vi
      .fn<InvestmentAuthPlugin["signOut"]>()
      .mockResolvedValue({ ...signedOut, serverRevocationConfirmed: true }),
    addListener: vi
      .fn<InvestmentAuthPlugin["addListener"]>()
      .mockImplementation((_name, listener) => {
        emit = listener;
        return Promise.resolve({ remove });
      }),
  };
  const store = new NativeTrialSessionStore(plugin);
  return {
    plugin,
    store,
    remove,
    emit: (state: NativeAuthState) => emit(state),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("installed official SDK session adapter", () => {
  it("never returns an old token after the active identity changes", async () => {
    const { store, plugin, emit } = fixture();
    await store.start();
    const session = store.session();
    expect(session).not.toBeNull();
    const token = deferred<{
      token: string;
      generation: number;
      sessionId: string;
    }>();
    vi.mocked(plugin.getToken).mockReturnValueOnce(token.promise);
    const pending = session!.getToken();
    emit({
      ...signedIn,
      generation: 2,
      userId: "user_other",
      sessionId: "session_other",
    });
    token.resolve({
      token: "old-synthetic-token",
      generation: 1,
      sessionId: "session_demo",
    });
    await expect(pending).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(session!.getToken()).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(plugin.getToken).toHaveBeenCalledTimes(1);
    expect(store.session()?.userId).toBe("user_other");
    store.dispose();
  });

  it("ignores a stale getState result after a newer event", async () => {
    const { store, plugin, emit } = fixture();
    const state = deferred<NativeAuthState>();
    vi.mocked(plugin.getState).mockReturnValueOnce(state.promise);
    const starting = store.start();
    await Promise.resolve();
    emit(signedOut);
    state.resolve(signedIn);
    await starting;
    expect(store.getSnapshot().auth).toEqual(signedOut);
    expect(store.session()).toBeNull();
    store.dispose();
  });

  it("does not erase a newer session when initial getState later fails", async () => {
    const { store, plugin, emit } = fixture();
    const state = deferred<NativeAuthState>();
    vi.mocked(plugin.getState).mockReturnValueOnce(state.promise);
    const starting = store.start();
    await Promise.resolve();
    emit(signedIn);
    state.reject(new Error("synthetic bridge failure"));
    await starting;
    expect(store.session()?.sessionId).toBe("session_demo");
    store.dispose();
  });

  it("suppresses local session immediately during sign-out and retains revocation uncertainty", async () => {
    const { store, plugin } = fixture();
    await store.start();
    const session = store.session()!;
    const revocation = deferred<
      NativeAuthState & { serverRevocationConfirmed: boolean }
    >();
    vi.mocked(plugin.signOut).mockReturnValueOnce(revocation.promise);
    const pending = session.signOut();
    expect(store.session()).toBeNull();
    await expect(session.getToken()).rejects.toMatchObject({
      code: "unauthenticated",
    });
    revocation.resolve({ ...signedOut, serverRevocationConfirmed: false });
    await expect(pending).rejects.toMatchObject({ code: "unauthenticated" });
    expect(store.getSnapshot()).toMatchObject({
      signOutUnconfirmed: true,
      busy: false,
      auth: signedOut,
    });
    expect(plugin.signIn).not.toHaveBeenCalled();
    vi.mocked(plugin.signIn).mockResolvedValueOnce({
      ...signedIn,
      sessionId: "session_new",
      generation: 3,
    });
    await store.signIn();
    expect(store.session()?.sessionId).toBe("session_new");
    expect(store.getSnapshot().message).toContain(
      "earlier server sign-out remains unconfirmed",
    );
    await expect(session.getToken()).rejects.toMatchObject({
      code: "unauthenticated",
    });
    store.dispose();
  });

  it("does not admit inconsistent same-generation changes or mismatched token receipts", async () => {
    const { store, plugin, emit } = fixture();
    await store.start();
    vi.mocked(plugin.getToken).mockResolvedValueOnce({
      token: "synthetic-token",
      generation: 1,
      sessionId: "session_other",
    });
    await expect(store.session()!.getToken()).rejects.toMatchObject({
      code: "unauthenticated",
    });
    emit({ ...signedIn, userId: "user_other" });
    expect(store.session()).toBeNull();
    expect(store.getSnapshot().auth.status).toBe("error");
    store.dispose();
  });

  it("releases an asynchronously registered listener after disposal and rejects retired token access", async () => {
    const { store, plugin, remove } = fixture();
    const listener = deferred<{ remove: () => Promise<void> }>();
    vi.mocked(plugin.addListener).mockReturnValueOnce(listener.promise);
    const starting = store.start();
    store.dispose();
    listener.resolve({ remove });
    await starting;
    expect(remove).toHaveBeenCalledTimes(1);
    expect(plugin.getState).not.toHaveBeenCalled();
    expect(store.session()).toBeNull();
  });
});
