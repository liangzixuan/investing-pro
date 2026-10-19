import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { TrialSession } from "../../src/clerk-trial/session";
import { createNativeDraftFileFixture } from "./native-draft-file-fixture";
import { createNativeDraftFileSession } from "./native-draft-file-session";

const account: TrialSession = {
  userId: "invented-account",
  sessionId: "invented-first-session",
  getToken: vi.fn(),
  signOut: vi.fn(),
};
function nativeFixture() {
  return createNativeDraftFileFixture({
    choose: vi.fn(),
    write: vi.fn(),
    cancel: vi.fn(),
  });
}

describe("native draft fixture session wiring", () => {
  it("adds no router props or controls when this scenario has no draft fixture", () => {
    const session = createNativeDraftFileSession(null, account);
    expect(session.routerProps).toEqual({});
    expect(
      session.Controls({ workspace: null, onFreshSession: vi.fn() }),
    ).toBeNull();
  });
  it("retains one scope per factory, joins the native delivery and fences controls until workspace exists", async () => {
    const native = nativeFixture();
    const session = createNativeDraftFileSession(native, account);
    expect(session.routerProps.draftFileDelivery).toBe(native.delivery);
    const scope = session.routerProps.draftFileScope;
    expect(session.routerProps.draftFileScope).toBe(scope);
    await expect(scope).resolves.toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(
      session.Controls({ workspace: null, onFreshSession: vi.fn() }),
    ).toBeNull();
    // Element composition only. The separate real-workspace journey verifies model behavior.
    const workspace = {} as ManagedWorkspace;
    const onFreshSession = vi.fn();
    const element = session.Controls({ workspace, onFreshSession });
    expect(isValidElement(element)).toBe(true);
    expect(element?.type).toBe(native.Controls);
    expect(element?.props).toEqual({
      workspace,
      session: account,
      onFreshSession,
    });
  });
  it("recomputes scope for a keyed session and changes it only when the account changes", async () => {
    const native = nativeFixture();
    const first = createNativeDraftFileSession(native, account);
    const fresh = createNativeDraftFileSession(native, {
      ...account,
      sessionId: "invented-second-session",
    });
    const other = createNativeDraftFileSession(native, {
      ...account,
      userId: "invented-other-account",
      sessionId: "invented-third-session",
    });
    expect(fresh.routerProps.draftFileScope).not.toBe(
      first.routerProps.draftFileScope,
    );
    expect(await fresh.routerProps.draftFileScope).toBe(
      await first.routerProps.draftFileScope,
    );
    expect(await other.routerProps.draftFileScope).not.toBe(
      await first.routerProps.draftFileScope,
    );
  });
});
