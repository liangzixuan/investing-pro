import { parseManagedSecFilingsError } from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedSecCooldownError } from "./managed-api";

/** Checked SEC admission deadlines belong to the mounted workspace, not a tab. */
export class ManagedSecAccess {
  private nextAllowedAt: string | null = null;
  private retired = false;

  getNextAllowedAt(): string | null {
    return this.nextAllowedAt && Date.now() < Date.parse(this.nextAllowedAt)
      ? this.nextAllowedAt
      : null;
  }
  recordCooldown(error: ManagedSecCooldownError, signal: AbortSignal): string {
    signal.throwIfAborted();
    if (this.retired) throw new TrialApiError("aborted");
    const checked = parseManagedSecFilingsError({
      error: "rate_limited",
      nextAllowedAt: error.nextAllowedAt,
    });
    if (checked?.error !== "rate_limited")
      throw new TrialApiError("invalid_response");
    if (!this.nextAllowedAt || checked.nextAllowedAt > this.nextAllowedAt)
      this.nextAllowedAt = checked.nextAllowedAt;
    return this.nextAllowedAt;
  }
  retire() {
    this.retired = true;
    this.nextAllowedAt = null;
  }
}

export function managedSecCooldownMessage(deadline: string, previous: boolean) {
  return `${previous ? "Refresh deferred. " : ""}SEC requests are shared across Annual, Filings and your devices. Try again after ${deadline}.`;
}
