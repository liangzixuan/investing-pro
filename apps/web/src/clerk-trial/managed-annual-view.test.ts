import { describe, expect, it, vi } from "vitest";
import {
  canonicalAnnualPacket,
  canonicalAnnualRequest,
} from "../features/research/sec-annual-canonical-fixture";
import { parseSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";
import { getManagedAnnualView } from "./managed-annual-view";

describe("owned Annual view sharing", () => {
  it("shares one view for the same admitted packet and separates a new admission", async () => {
    const wire = await canonicalAnnualPacket();
    const admit = () =>
      parseSecAnnualCanonicalResponse(
        wire,
        canonicalAnnualRequest,
        new AbortController().signal,
      );
    const first = await admit();
    const second = await admit();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    const view = getManagedAnnualView(first);
    expect(view).not.toBeNull();
    expect(view!.canonical).toBe(first!.evidence);
    expect(getManagedAnnualView(first)).toBe(view);
    expect(getManagedAnnualView(second)).not.toBe(view);
    expect(Object.isFrozen(view)).toBe(true);
  });
  it("refuses raw, copied and forged packets without reading fields", async () => {
    const raw = await canonicalAnnualPacket();
    expect(getManagedAnnualView(raw)).toBeNull();
    const owned = await parseSecAnnualCanonicalResponse(
      raw,
      canonicalAnnualRequest,
      new AbortController().signal,
    );
    expect(getManagedAnnualView(structuredClone(owned))).toBeNull();
    expect(getManagedAnnualView(Object.freeze({ ...owned }))).toBeNull();
    const read = vi.fn();
    expect(
      getManagedAnnualView(new Proxy({}, { get: read, ownKeys: read })),
    ).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});
