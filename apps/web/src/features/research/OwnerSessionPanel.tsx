"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import {
  bootstrapOwnerSession,
  fetchOwnerSession,
  logoutOwnerSession,
  revokeOwnerSession,
  rotateOwnerSession,
} from "@/lib/api";

import { OwnerSessionLifecycle } from "./owner-session-lifecycle";

type OwnerSessionState = "active" | "checking" | "inactive";
type SessionAction = "bootstrap" | "logout" | "revoke" | "rotate";

export const OWNER_SESSION_BROADCAST_CHANNEL =
  "research-cockpit-owner-session-v1";
export const OWNER_SESSION_INVALIDATE_MESSAGE = "owner-session-invalidate-v1";
export const OWNER_SESSION_REFRESH_MESSAGE = "owner-session-refresh-v1";

interface SessionRequest {
  readonly controller: AbortController;
  readonly epoch: number;
}

interface InvalidationOptions {
  readonly broadcast: boolean;
  readonly disableTransport?: boolean;
  readonly keepPending?: boolean;
  readonly message?: string;
  readonly preserveLifecycle?: boolean;
}

type BroadcastTransportState = "available" | "checking" | "unavailable";
type PrivateDataLoadResult = "accepted" | "deferred" | "rejected";

export interface OwnerSessionPanelProps {
  readonly onSessionChange: (
    active: boolean,
    signal: AbortSignal,
  ) => Promise<boolean> | boolean;
}

export function OwnerSessionPanel({ onSessionChange }: OwnerSessionPanelProps) {
  const [sessionState, setSessionState] =
    useState<OwnerSessionState>("checking");
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [pendingAction, setPendingAction] = useState<SessionAction | null>(
    null,
  );
  const [message, setMessage] = useState<{
    readonly kind: "error" | "status";
    readonly text: string;
  } | null>(null);
  const [broadcastTransport, setBroadcastTransport] =
    useState<BroadcastTransportState>("checking");
  const lifecycleRef = useRef<OwnerSessionLifecycle | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const broadcastReadyRef = useRef(false);
  const requestRef = useRef<SessionRequest | null>(null);
  const requestEpochRef = useRef(0);
  const mountedRef = useRef(false);
  const pendingActionRef = useRef<SessionAction | null>(null);
  const presentationSuspendedRef = useRef(false);
  const deferredWakeRevalidationRef = useRef(false);
  const revalidateRef = useRef<(clearBeforeRequest: boolean) => void>(() => {
    // Installed by the mount effect before an owner action can settle.
  });
  const invalidateRef = useRef<(options: InvalidationOptions) => void>(() => {
    // Installed below before the mount effect can receive an event.
  });

  function publish(messageType: string): boolean {
    const channel = channelRef.current;
    if (!broadcastReadyRef.current || channel === null) {
      invalidateRef.current({
        broadcast: false,
        disableTransport: true,
        message:
          "Cross-tab session coordination is unavailable; private data was cleared.",
      });
      return false;
    }
    try {
      channel.postMessage(messageType);
      return true;
    } catch {
      broadcastReadyRef.current = false;
      channelRef.current = null;
      try {
        channel.close();
      } catch {
        // The transport has already failed and is no longer trusted.
      }
      invalidateRef.current({
        broadcast: false,
        disableTransport: true,
        message:
          "Cross-tab session coordination failed; private data was cleared.",
      });
      const revokeController = new AbortController();
      void revokeOwnerSession(revokeController.signal).catch(() => false);
      return false;
    }
  }

  function setPending(action: SessionAction | null) {
    pendingActionRef.current = action;
    setPendingAction(action);
  }

  function beginRequest(): SessionRequest {
    requestRef.current?.controller.abort();
    const request = {
      controller: new AbortController(),
      epoch: ++requestEpochRef.current,
    };
    requestRef.current = request;
    return request;
  }

  function isCurrentRequest(request: SessionRequest): boolean {
    return (
      mountedRef.current &&
      !request.controller.signal.aborted &&
      request.epoch === requestEpochRef.current
    );
  }

  function finishRequest(request: SessionRequest) {
    if (requestRef.current === request) requestRef.current = null;
  }

  function clearRenderedPrivateData() {
    const controller = new AbortController();
    void Promise.resolve(onSessionChange(false, controller.signal)).catch(
      () => {
        // Clearing is synchronous in the owner workspace; never retain a
        // rejected callback as an unhandled promise.
      },
    );
  }

  function invalidateLocal(options: InvalidationOptions) {
    deferredWakeRevalidationRef.current = false;
    requestEpochRef.current += 1;
    requestRef.current?.controller.abort();
    requestRef.current = null;
    if (!options.preserveLifecycle) lifecycleRef.current?.deactivate();
    setSessionState("inactive");
    if (options.disableTransport) {
      broadcastReadyRef.current = false;
      setBroadcastTransport("unavailable");
    }
    if (!options.keepPending) setPending(null);
    clearRenderedPrivateData();
    if (options.message !== undefined) {
      setMessage({ kind: "error", text: options.message });
    }
    if (options.broadcast) publish(OWNER_SESSION_INVALIDATE_MESSAGE);
  }

  invalidateRef.current = invalidateLocal;

  async function loadPrivateData(
    request: SessionRequest,
  ): Promise<PrivateDataLoadResult> {
    if (lifecycleRef.current?.recordAuthorizedActivity() !== true) {
      return "rejected";
    }
    const authorizedRead = await Promise.resolve(
      onSessionChange(true, request.controller.signal),
    ).catch(() => false);
    if (!isCurrentRequest(request)) return "rejected";
    if (deferredWakeRevalidationRef.current) {
      clearRenderedPrivateData();
      return "deferred";
    }
    if (authorizedRead !== true) {
      invalidateRef.current({
        broadcast: true,
        message:
          "Private owner-session reads were not confirmed; private data was cleared.",
      });
      return "rejected";
    }
    return "accepted";
  }

  function settleAction(
    request: SessionRequest,
    revalidateIfDeferred: boolean,
  ) {
    finishRequest(request);
    setPending(null);
    const revalidate = deferredWakeRevalidationRef.current;
    deferredWakeRevalidationRef.current = false;
    if (revalidate && revalidateIfDeferred) {
      revalidateRef.current(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    const lifecycle = new OwnerSessionLifecycle(() => {
      invalidateRef.current({
        broadcast: true,
        message: "The local owner session expired; private data was cleared.",
      });
    });
    lifecycleRef.current = lifecycle;

    const browserWindow = typeof window === "undefined" ? undefined : window;
    const browserDocument =
      typeof document === "undefined" ? undefined : document;
    presentationSuspendedRef.current =
      browserDocument?.visibilityState === "hidden";

    async function revalidate(clearBeforeRequest: boolean) {
      if (
        !mountedRef.current ||
        !broadcastReadyRef.current ||
        presentationSuspendedRef.current
      ) {
        return;
      }
      if (clearBeforeRequest) clearRenderedPrivateData();
      if (pendingActionRef.current !== null) {
        deferredWakeRevalidationRef.current = true;
        return;
      }
      if (lifecycle.active && !lifecycle.check()) return;

      setSessionState("checking");
      const request = beginRequest();
      const leaseAccepted = lifecycle.active
        ? lifecycle.recordAuthorizedActivity()
        : lifecycle.beginObserved();
      if (!leaseAccepted || !isCurrentRequest(request)) return;
      const active = await fetchOwnerSession(request.controller.signal).catch(
        () => false,
      );
      if (!isCurrentRequest(request)) return;
      if (!active) {
        invalidateRef.current({
          broadcast: true,
          message:
            "The owner session could not be revalidated; private data was cleared.",
        });
        return;
      }

      setSessionState("active");
      setMessage(null);
      if (
        (await loadPrivateData(request)) !== "accepted" ||
        !isCurrentRequest(request)
      ) {
        return;
      }
      finishRequest(request);
    }

    revalidateRef.current = (clearBeforeRequest) => {
      void revalidate(clearBeforeRequest);
    };

    const handleWake = () => {
      if (browserDocument?.visibilityState === "hidden") {
        presentationSuspendedRef.current = true;
        invalidateRef.current({ broadcast: false, preserveLifecycle: true });
        return;
      }
      presentationSuspendedRef.current = false;
      void revalidate(true);
    };
    const handlePageHide = () => {
      presentationSuspendedRef.current = true;
      invalidateRef.current({ broadcast: false, preserveLifecycle: true });
    };
    const handleVisibilityChange = () => {
      if (browserDocument?.visibilityState === "hidden") {
        presentationSuspendedRef.current = true;
        invalidateRef.current({ broadcast: false, preserveLifecycle: true });
        return;
      }
      if (browserDocument?.visibilityState === "visible") {
        presentationSuspendedRef.current = false;
        void revalidate(true);
      }
    };
    const handleBroadcast = (event: MessageEvent<unknown>) => {
      if (event.data === OWNER_SESSION_INVALIDATE_MESSAGE) {
        invalidateRef.current({
          broadcast: false,
          message:
            "The owner session changed in another tab; private data was cleared.",
        });
        return;
      }
      if (event.data !== OWNER_SESSION_REFRESH_MESSAGE) return;

      invalidateRef.current({
        broadcast: false,
        preserveLifecycle: presentationSuspendedRef.current,
      });
      void revalidate(false);
    };

    let channelReady = false;
    if (
      browserWindow !== undefined &&
      typeof browserWindow.BroadcastChannel === "function"
    ) {
      try {
        const channel = new browserWindow.BroadcastChannel(
          OWNER_SESSION_BROADCAST_CHANNEL,
        );
        channel.onmessage = handleBroadcast;
        channelRef.current = channel;
        broadcastReadyRef.current = true;
        setBroadcastTransport("available");
        channelReady = true;
      } catch {
        channelRef.current = null;
      }
    }
    if (!channelReady) {
      invalidateRef.current({
        broadcast: false,
        disableTransport: true,
        message:
          "This browser cannot safely coordinate owner sessions across tabs, so personal access is disabled.",
      });
    }
    browserWindow?.addEventListener("focus", handleWake);
    browserWindow?.addEventListener("pagehide", handlePageHide);
    browserWindow?.addEventListener("pageshow", handleWake);
    browserDocument?.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
    if (channelReady) {
      if (browserDocument?.visibilityState === "hidden") {
        presentationSuspendedRef.current = true;
        invalidateRef.current({ broadcast: false, preserveLifecycle: true });
      } else {
        void revalidate(false);
      }
    }

    return () => {
      mountedRef.current = false;
      requestEpochRef.current += 1;
      requestRef.current?.controller.abort();
      requestRef.current = null;
      lifecycle.deactivate();
      lifecycleRef.current = null;
      broadcastReadyRef.current = false;
      presentationSuspendedRef.current = true;
      deferredWakeRevalidationRef.current = false;
      revalidateRef.current = () => {
        // The component is no longer mounted.
      };
      clearRenderedPrivateData();
      browserWindow?.removeEventListener("focus", handleWake);
      browserWindow?.removeEventListener("pagehide", handlePageHide);
      browserWindow?.removeEventListener("pageshow", handleWake);
      browserDocument?.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      if (channelRef.current !== null) {
        channelRef.current.onmessage = null;
        channelRef.current.close();
        channelRef.current = null;
      }
    };
  }, [onSessionChange]);

  async function handleBootstrap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!broadcastReadyRef.current) {
      invalidateLocal({
        broadcast: false,
        disableTransport: true,
        message:
          "Cross-tab session coordination is unavailable; personal access remains disabled.",
      });
      return;
    }
    const secret = bootstrapSecret;
    setBootstrapSecret("");
    setMessage(null);
    if (secret.length === 0) {
      setMessage({
        kind: "error",
        text: "Enter the one-time bootstrap secret.",
      });
      return;
    }

    setPending("bootstrap");
    const request = beginRequest();
    const lifecycle = lifecycleRef.current;
    if (lifecycle?.beginFresh() !== true || !isCurrentRequest(request)) {
      return;
    }
    const active = await bootstrapOwnerSession(
      secret,
      request.controller.signal,
    ).catch(() => false);
    if (!isCurrentRequest(request)) return;
    if (!active) {
      lifecycle.deactivate();
      setSessionState("inactive");
      clearRenderedPrivateData();
      setMessage({
        kind: "error",
        text: "The one-time bootstrap was not accepted.",
      });
      settleAction(request, false);
      return;
    }

    setSessionState("active");
    if (!publish(OWNER_SESSION_REFRESH_MESSAGE)) return;
    if (deferredWakeRevalidationRef.current) {
      settleAction(request, true);
      return;
    }
    const loadResult = await loadPrivateData(request);
    if (loadResult === "deferred") {
      settleAction(request, true);
      return;
    }
    if (loadResult !== "accepted" || !isCurrentRequest(request)) {
      return;
    }
    setMessage({
      kind: "status",
      text: "Local owner session established.",
    });
    settleAction(request, false);
  }

  async function handleLogout() {
    if (!broadcastReadyRef.current) return;
    setPending("logout");
    setMessage(null);
    invalidateLocal({ broadcast: true, keepPending: true });
    const request = beginRequest();
    const accepted = await logoutOwnerSession(request.controller.signal).catch(
      () => false,
    );
    if (!isCurrentRequest(request)) return;
    setMessage(
      accepted
        ? { kind: "status", text: "Local owner session ended." }
        : {
            kind: "error",
            text: "The session was cleared locally, but logout was not confirmed.",
          },
    );
    settleAction(request, false);
  }

  async function handleRotate() {
    if (!broadcastReadyRef.current) return;
    setPending("rotate");
    setMessage(null);
    const request = beginRequest();
    const lifecycle = lifecycleRef.current;
    const leaseAccepted =
      lifecycle === null
        ? false
        : lifecycle.active
          ? lifecycle.recordAuthorizedActivity()
          : lifecycle.beginObserved();
    if (!leaseAccepted || !isCurrentRequest(request)) return;
    const active = await rotateOwnerSession(request.controller.signal).catch(
      () => false,
    );
    if (!isCurrentRequest(request)) return;
    if (!active) {
      invalidateLocal({
        broadcast: true,
        message: "Rotation was not confirmed; private data was cleared.",
      });
      return;
    }

    setSessionState("active");
    if (!publish(OWNER_SESSION_REFRESH_MESSAGE)) return;
    if (deferredWakeRevalidationRef.current) {
      settleAction(request, true);
      return;
    }
    const loadResult = await loadPrivateData(request);
    if (loadResult === "deferred") {
      settleAction(request, true);
      return;
    }
    if (loadResult !== "accepted" || !isCurrentRequest(request)) {
      return;
    }
    setMessage({ kind: "status", text: "Local owner session rotated." });
    settleAction(request, false);
  }

  async function handleRevoke() {
    if (!broadcastReadyRef.current) return;
    setPending("revoke");
    setMessage(null);
    invalidateLocal({ broadcast: true, keepPending: true });
    const request = beginRequest();
    const accepted = await revokeOwnerSession(request.controller.signal).catch(
      () => false,
    );
    if (!isCurrentRequest(request)) return;
    setMessage(
      accepted
        ? { kind: "status", text: "Local owner authority revoked." }
        : {
            kind: "error",
            text: "Private data was cleared, but revocation was not confirmed.",
          },
    );
    settleAction(request, false);
  }

  const pending = pendingAction !== null;
  const browserSessionAvailable = broadcastTransport === "available";

  return (
    <section
      className="owner-session-panel"
      aria-labelledby="owner-session-title"
    >
      <div className="owner-session-heading">
        <div>
          <p className="eyebrow">Personal local mode</p>
          <h2 id="owner-session-title">Owner session</h2>
        </div>
        <span
          className={`owner-session-state ${browserSessionAvailable ? sessionState : "inactive"}`}
        >
          {broadcastTransport === "unavailable"
            ? "Unavailable"
            : sessionState === "checking"
              ? "Checking"
              : sessionState === "active"
                ? "Active"
                : "Locked"}
        </span>
      </div>

      {broadcastTransport === "checking" || sessionState === "checking" ? (
        <p role="status" aria-live="polite">
          Checking for an existing local owner session…
        </p>
      ) : !browserSessionAvailable ? (
        <p role="alert">
          Personal access requires working cross-tab session coordination in
          this browser.
        </p>
      ) : sessionState === "active" ? (
        <div className="owner-session-actions">
          <p>Private personal routes are available to this browser session.</p>
          <div>
            <button
              className="secondary-action compact-action"
              type="button"
              disabled={pending}
              onClick={() => void handleRotate()}
            >
              {pendingAction === "rotate" ? "Rotating…" : "Rotate session"}
            </button>
            <button
              className="secondary-action compact-action"
              type="button"
              disabled={pending}
              onClick={() => void handleLogout()}
            >
              {pendingAction === "logout" ? "Logging out…" : "Log out"}
            </button>
            <button
              className="secondary-action compact-action danger-action"
              type="button"
              disabled={pending}
              onClick={() => void handleRevoke()}
            >
              {pendingAction === "revoke" ? "Revoking…" : "Revoke authority"}
            </button>
          </div>
        </div>
      ) : (
        <form
          className="owner-session-form"
          onSubmit={(event) => void handleBootstrap(event)}
        >
          <label htmlFor="owner-bootstrap-secret">
            One-time bootstrap secret
          </label>
          <div>
            <input
              id="owner-bootstrap-secret"
              name="owner-bootstrap-secret"
              type="password"
              value={bootstrapSecret}
              autoCapitalize="none"
              autoComplete="off"
              disabled={pending}
              spellCheck={false}
              onChange={(event) => setBootstrapSecret(event.target.value)}
            />
            <button
              className="primary-action compact-action"
              type="submit"
              disabled={pending}
            >
              {pendingAction === "bootstrap" ? "Unlocking…" : "Start session"}
            </button>
          </div>
          <p>
            The secret stays in this field only until submission and is then
            cleared immediately.
          </p>
        </form>
      )}

      {message === null ? null : (
        <p
          className={`owner-session-message ${message.kind}`}
          role={message.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
