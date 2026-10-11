import { useId, type ReactNode } from "react";

export function ManagedEntry({
  title,
  message,
  busy = false,
  tone = "neutral",
  children,
}: {
  title: string;
  message?: string;
  busy?: boolean;
  tone?: "neutral" | "warning";
  children?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      className="managed-entry"
      aria-labelledby={headingId}
      data-tone={tone}
      data-busy={busy}
    >
      <div className="managed-entry-heading">
        <span className="managed-entry-indicator" aria-hidden="true" />
        <h2 id={headingId}>{title}</h2>
      </div>
      {message && (
        <p className="managed-entry-message" role="status">
          {message}
        </p>
      )}
      {children && <div className="managed-entry-content">{children}</div>}
    </section>
  );
}

export function ManagedSessionNotice({ children }: { children: ReactNode }) {
  return (
    <div className="managed-session-notice">
      <p role="status">{children}</p>
    </div>
  );
}
