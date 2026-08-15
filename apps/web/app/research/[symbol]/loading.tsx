export default function LoadingResearchPage() {
  return (
    <main className="workspace-shell" aria-busy="true">
      <div className="loading-panel">
        <span className="loading-mark" aria-hidden="true" />
        <p>Assembling the synthetic evidence trail…</p>
      </div>
    </main>
  );
}
