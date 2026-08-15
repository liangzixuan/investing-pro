"use client";

export default function ResearchError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="workspace-shell">
      <section className="error-panel" role="alert">
        <p className="eyebrow">Demo interrupted</p>
        <h1>The research workspace could not load.</h1>
        <p>Confirm the local API is running on port 3100, then try again.</p>
        <button className="primary-action" type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
