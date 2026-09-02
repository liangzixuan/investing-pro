import { describe, expect, it, vi } from "vitest";

import { scrubLegacyLocalResearchState } from "./legacy-local-state-cleanup";

describe("legacy local research-state cleanup", () => {
  it("removes only the superseded thesis and alert prefixes", () => {
    const values = new Map([
      ["research-cockpit:thesis:SYN1", "private thesis"],
      ["research-cockpit:alert:SYN1", "private alert"],
      ["research-cockpit:session", "unrelated"],
      ["other-app:thesis:SYN1", "unrelated"],
    ]);
    const removeItem = vi.fn((key: string) => values.delete(key));
    const storage = {
      get length() {
        return values.size;
      },
      key(index: number) {
        return [...values.keys()][index] ?? null;
      },
      removeItem,
    };

    expect(scrubLegacyLocalResearchState(storage)).toEqual({
      complete: true,
      removedKeys: 2,
    });
    expect([...values.entries()]).toEqual([
      ["research-cockpit:session", "unrelated"],
      ["other-app:thesis:SYN1", "unrelated"],
    ]);
    expect(removeItem).toHaveBeenCalledTimes(2);
  });

  it("reports a blocked cleanup without reading stored values", () => {
    const storage = {
      length: 1,
      key: vi.fn(() => "research-cockpit:thesis:SYN1"),
      removeItem: vi.fn(() => {
        throw new DOMException("blocked", "SecurityError");
      }),
    };

    expect(scrubLegacyLocalResearchState(storage)).toEqual({
      complete: false,
      removedKeys: 0,
    });
  });
});
