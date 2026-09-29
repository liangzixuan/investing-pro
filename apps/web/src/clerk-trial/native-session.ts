import type { PluginListenerHandle } from "@capacitor/core";
import { TrialApiError } from "./api";
import type { TrialSession } from "./session";

export interface NativeAuthState {
  status: "loading" | "signedOut" | "signedIn" | "error";
  userId: string | null;
  sessionId: string | null;
  generation: number;
}
export interface InvestmentAuthPlugin {
  getState: () => Promise<NativeAuthState>;
  signIn: () => Promise<NativeAuthState>;
  getToken: () => Promise<{
    token: string;
    generation: number;
    sessionId: string;
  }>;
  signOut: () => Promise<
    NativeAuthState & { serverRevocationConfirmed: boolean }
  >;
  addListener: (
    event: "stateChanged",
    listener: (state: NativeAuthState) => void,
  ) => Promise<PluginListenerHandle>;
}
export interface NativeTrialState {
  auth: NativeAuthState;
  busy: boolean;
  message: string;
  signOutUnconfirmed: boolean;
}

export class NativeTrialSessionStore {
  private state: NativeTrialState = {
    auth: { status: "loading", userId: null, sessionId: null, generation: -1 },
    busy: false,
    message: "Checking the installed session…",
    signOutUnconfirmed: false,
  };
  private readonly listeners = new Set<() => void>();
  private handle: PluginListenerHandle | null = null;
  private disposed = false;
  private revision = 0;
  constructor(private readonly plugin: InvestmentAuthPlugin) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(value: Partial<NativeTrialState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...value };
    for (const listener of this.listeners) listener();
  }
  private accept = (auth: NativeAuthState) => {
    if (this.disposed) return;
    if (auth && auth.generation < this.state.auth.generation) return;
    this.revision += 1;
    const previous = this.state.auth;
    const consistent =
      auth &&
      (auth.generation !== previous.generation ||
        (auth.status === previous.status &&
          auth.userId === previous.userId &&
          auth.sessionId === previous.sessionId));
    const valid =
      auth &&
      consistent &&
      Number.isSafeInteger(auth.generation) &&
      auth.generation >= 0 &&
      ["loading", "signedOut", "signedIn", "error"].includes(auth.status) &&
      (auth.status === "signedIn"
        ? typeof auth.userId === "string" &&
          /^[A-Za-z0-9_-]{1,256}$/u.test(auth.userId) &&
          typeof auth.sessionId === "string" &&
          /^[A-Za-z0-9_-]{1,256}$/u.test(auth.sessionId)
        : auth.userId === null && auth.sessionId === null);
    if (!valid) {
      this.update({
        auth: {
          status: "error",
          userId: null,
          sessionId: null,
          generation: this.state.auth.generation,
        },
        message: "The installed session could not be verified.",
      });
      return;
    }
    this.update({
      auth: {
        status: auth.status,
        userId: auth.userId,
        sessionId: auth.sessionId,
        generation: auth.generation,
      },
    });
  };
  async start() {
    const revision = this.revision;
    try {
      const handle = await this.plugin.addListener("stateChanged", this.accept);
      if (this.disposed) {
        await handle.remove();
        return;
      }
      this.handle = handle;
      this.accept(await this.plugin.getState());
      this.update({ message: "" });
    } catch {
      if (this.revision !== revision) return;
      this.update({
        auth: {
          status: "error",
          userId: null,
          sessionId: null,
          generation: this.state.auth.generation,
        },
        message: "The installed sign-in service is unavailable.",
      });
    }
  }
  dispose() {
    this.disposed = true;
    this.listeners.clear();
    void this.handle?.remove().catch(() => {});
    this.handle = null;
  }
  async signIn() {
    if (this.disposed || this.state.busy) return;
    const recovering = this.state.signOutUnconfirmed;
    const previousGeneration = this.state.auth.generation;
    this.update({ busy: true, message: "Opening secure sign-in…" });
    try {
      this.accept(await this.plugin.signIn());
      if (
        recovering &&
        (this.state.auth.status !== "signedIn" ||
          this.state.auth.generation <= previousGeneration)
      ) {
        this.update({
          message:
            "No new session was confirmed. The earlier server sign-out remains unconfirmed.",
        });
      } else {
        this.update({
          signOutUnconfirmed: false,
          message: recovering
            ? "A new session is active. The earlier server sign-out remains unconfirmed."
            : "",
        });
      }
    } catch {
      this.update({ message: "Sign-in did not complete. You can try again." });
    } finally {
      this.update({ busy: false });
    }
  }
  async signOut() {
    if (this.disposed || this.state.busy)
      throw new TrialApiError("unauthenticated");
    this.update({
      busy: true,
      signOutUnconfirmed: true,
      message: "Signing out this installed session…",
    });
    try {
      const state = await this.plugin.signOut();
      this.accept(state);
      if (
        !state.serverRevocationConfirmed ||
        this.state.auth.status !== "signedOut"
      )
        throw new TrialApiError("unauthenticated");
      this.update({
        signOutUnconfirmed: false,
        message: "Signed out of this installed session.",
      });
    } catch {
      this.update({
        message:
          "Signed out on this phone; server sign-out could not be confirmed. You can start a new sign-in. This will not confirm that the earlier session ended.",
      });
      throw new TrialApiError("unauthenticated");
    } finally {
      this.update({ busy: false });
    }
  }
  session(): TrialSession | null {
    const captured = this.state.auth;
    if (
      this.disposed ||
      this.state.signOutUnconfirmed ||
      captured.status !== "signedIn" ||
      !captured.userId ||
      !captured.sessionId
    )
      return null;
    return {
      userId: captured.userId,
      sessionId: captured.sessionId,
      signOut: () => this.signOut(),
      getToken: async () => {
        const current = () =>
          !this.disposed &&
          !this.state.signOutUnconfirmed &&
          this.state.auth.status === "signedIn" &&
          this.state.auth.generation === captured.generation &&
          this.state.auth.userId === captured.userId &&
          this.state.auth.sessionId === captured.sessionId;
        if (!current()) throw new TrialApiError("unauthenticated");
        const result = await this.plugin.getToken();
        if (
          !current() ||
          result.generation !== captured.generation ||
          result.sessionId !== captured.sessionId ||
          typeof result.token !== "string" ||
          result.token.length === 0
        )
          throw new TrialApiError("unauthenticated");
        return result.token;
      },
    };
  }
}
