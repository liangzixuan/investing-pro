import { useEffect, useRef, useState } from "react";
import { loadThirdPartyNotices } from "./load-third-party-notices";

export function ThirdPartyNotices() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
  const load = async () => {
    if (text !== null || pending.current !== null) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setFailed(false);
    try {
      const value = await loadThirdPartyNotices(controller.signal);
      if (pending.current === controller) setText(value);
    } catch {
      if (pending.current === controller) setFailed(true);
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setLoading(false);
      }
    }
  };
  return (
    <footer className="trial-notices">
      <button
        type="button"
        className="trial-secondary"
        aria-expanded={open}
        aria-controls="trial-license-text"
        onClick={() => {
          setOpen(!open);
          if (!open) void load();
        }}
      >
        {open ? "Hide software licenses" : "Software licenses"}
      </button>
      <section
        id="trial-license-text"
        aria-label="Third-party software licenses"
        hidden={!open}
      >
        {loading && <p role="status">Loading software licenses…</p>}
        {failed && (
          <>
            <p role="status">The license text could not be loaded.</p>
            <button
              type="button"
              onClick={() => {
                void load();
              }}
            >
              Retry loading licenses
            </button>
          </>
        )}
        {text !== null && <pre tabIndex={0}>{text}</pre>}
      </section>
    </footer>
  );
}
