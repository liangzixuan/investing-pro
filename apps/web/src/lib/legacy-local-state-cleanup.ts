const LEGACY_RESEARCH_STATE_PREFIXES = [
  "research-cockpit:alert:",
  "research-cockpit:thesis:",
] as const;

export interface LegacyLocalStateCleanupResult {
  readonly complete: boolean;
  readonly removedKeys: number;
}

/** Removes only the two superseded durable browser-state namespaces. */
export function scrubLegacyLocalResearchState(
  storage: Pick<Storage, "key" | "length" | "removeItem">,
): LegacyLocalStateCleanupResult {
  let removedKeys = 0;
  try {
    const matchingKeys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (
        key !== null &&
        LEGACY_RESEARCH_STATE_PREFIXES.some((prefix) => key.startsWith(prefix))
      ) {
        matchingKeys.push(key);
      }
    }
    for (const key of matchingKeys) {
      storage.removeItem(key);
      removedKeys += 1;
    }
    return { complete: true, removedKeys };
  } catch {
    return { complete: false, removedKeys };
  }
}

export function scrubLegacyLocalResearchStateFromWindow(): LegacyLocalStateCleanupResult {
  try {
    return scrubLegacyLocalResearchState(window.localStorage);
  } catch {
    return { complete: false, removedKeys: 0 };
  }
}
