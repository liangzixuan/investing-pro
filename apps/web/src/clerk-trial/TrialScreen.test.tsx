import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TrialController } from "./controller";
import { TrialScreen } from "./TrialScreen";

function fixture() {
  const controller = new TrialController(
    { load: vi.fn(), save: vi.fn() },
    {
      userId: "user_demo",
      sessionId: "session_demo",
      getToken: vi.fn(),
      signOut: vi.fn(),
    },
  );
  return { controller, state: controller.getSnapshot() };
}
describe("shared trial screen", () => {
  it("labels both invented entries, note and session-local sign-out with a live status", () => {
    const { controller, state } = fixture();
    const html = renderToStaticMarkup(
      <TrialScreen controller={controller} state={state} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('for="trial-note"');
    expect(html).toContain("DEMO_A");
    expect(html).toContain("DEMO_B");
    expect(html).toContain("Sign out this session");
    expect(html).toContain("Other signed-in devices keep their own sessions");
    expect(html).toMatch(/<fieldset disabled=""/u);
  });
  it("explains that reconciliation may complete the original save and locks its draft", () => {
    const { controller, state } = fixture();
    const html = renderToStaticMarkup(
      <TrialScreen
        controller={controller}
        state={{ ...state, baseVersion: 0, uncertain: true, dirty: true }}
      />,
    );
    expect(html).toContain("Reconcile pending save");
    expect(html).toContain(
      "If it never reached the server, this action can complete it",
    );
    expect(html).toMatch(/<fieldset disabled=""/u);
  });
  it("removes watchlist controls and note after retirement", () => {
    const { controller } = fixture();
    controller.retire();
    const html = renderToStaticMarkup(
      <TrialScreen controller={controller} state={controller.getSnapshot()} />,
    );
    expect(html).not.toContain("textarea");
    expect(html).not.toContain("Save watchlist");
    expect(html).toContain("local trial data has been cleared");
  });
});
