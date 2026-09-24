"use client";

import { useEffect, useRef, useState } from "react";

import { fetchLocalWorkspaceAccess } from "@/lib/personal-api";

import type { OwnerSessionPanelProps } from "./OwnerSessionPanel";
import type { OwnerSessionActivityStart } from "./owner-session-lifecycle";

type LocalAccessState = "checking" | "ready" | "unavailable" | "paused";
export type LocalWorkspaceAccessPanelProps = Pick<
  OwnerSessionPanelProps,
  "onSessionChange" | "onActivityHandlerChange"
> & { readonly invalidationKey?: number; readonly compact?: boolean };

export function LocalWorkspaceAccessPanel({
  onSessionChange,
  onActivityHandlerChange,
  invalidationKey = 0,
  compact = false,
}: LocalWorkspaceAccessPanelProps) {
  const [state, setState] = useState<LocalAccessState>("checking");
  const retry = useRef<() => void>(() => undefined);

  useEffect(() => {
    let mounted = true;
    let generation = 0;
    let request: AbortController | null = null;
    let ready = false;
    const visible = () => document.visibilityState === "visible";
    const clear = (next: LocalAccessState) => {
      generation += 1;
      request?.abort();
      request = null;
      ready = false;
      onActivityHandlerChange?.(null);
      try {
        void Promise.resolve(
          onSessionChange(false, new AbortController().signal),
        ).catch(() => undefined);
      } catch {
        // A failed clearing callback must not restore access or expose its error.
      }
      if (mounted) setState(next);
    };
    const revalidate = async () => {
      if (!mounted) return;
      if (!visible()) {
        clear("paused");
        return;
      }
      if (request !== null) return;
      clear("checking");
      const controller = new AbortController();
      request = controller;
      const operation = generation;
      const current = () =>
        mounted &&
        operation === generation &&
        !controller.signal.aborted &&
        visible();
      try {
        const admitted = await fetchLocalWorkspaceAccess(controller.signal);
        if (!current()) return;
        if (!admitted) {
          clear("unavailable");
          return;
        }
        const loaded = await onSessionChange(true, controller.signal);
        if (!current()) return;
        if (!loaded) {
          clear("unavailable");
          return;
        }
        ready = true;
        const start: OwnerSessionActivityStart = () => {
          if (!ready || !current()) return undefined;
          let completed = false;
          return () => {
            if (completed) return false;
            completed = true;
            return ready && current();
          };
        };
        // Existing consumers need a stale-result guard, not an expiring lease.
        onActivityHandlerChange?.(start);
        setState("ready");
      } catch {
        if (current()) clear("unavailable");
      } finally {
        if (request === controller) request = null;
      }
    };
    const wake = () => void revalidate();
    const hide = () => clear("paused");
    const visibility = () => (visible() ? wake() : hide());
    retry.current = wake;
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", visibility);
    wake();
    return () => {
      mounted = false;
      clear("paused");
      retry.current = () => undefined;
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [onSessionChange, onActivityHandlerChange, invalidationKey]);

  return (
    <section
      className={`owner-session-panel local-access-panel${compact ? " is-compact" : ""}`}
      data-access-state={state}
      aria-labelledby="local-access-title"
    >
      <div className="owner-session-heading">
        <div>
          <p className="eyebrow">Personal local mode</p>
          <h2 id="local-access-title">{compact ? "Local" : "Local access"}</h2>
        </div>
        <span
          className={`owner-session-state ${state === "ready" ? "active" : "inactive"}`}
        >
          {state === "ready"
            ? "Ready"
            : state === "checking"
              ? "Checking"
              : state === "paused"
                ? "Paused"
                : "Unavailable"}
        </span>
      </div>
      <p className="local-access-mode-note">Login disabled on this computer.</p>
      <p
        className="local-access-message"
        role={state === "unavailable" ? "alert" : "status"}
        aria-live="polite"
      >
        {state === "ready"
          ? "The local workspace is available."
          : state === "checking"
            ? "Checking local access and loading the workspace…"
            : state === "paused"
              ? "Workspace data is cleared while this page is hidden. Return to reconnect."
              : "Local access could not be verified or the workspace could not load. Check the local app connection, then retry."}
      </p>
      {state === "unavailable" && (
        <button
          className="secondary-action compact-action"
          type="button"
          onClick={() => retry.current()}
        >
          Retry connection
        </button>
      )}
    </section>
  );
}
