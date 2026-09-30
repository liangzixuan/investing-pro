export const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

export const exactDependencySections = new Set<DependencySection>([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
]);

const plainExactSemver =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-(?:(?:0|[1-9][0-9]*)|(?:[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))(?:\.(?:(?:0|[1-9][0-9]*)|(?:[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export const expectedPnpmSettings = Object.freeze({
  autoInstallPeers: false,
  saveExact: true,
  sharedWorkspaceLockfile: true,
  strictPeerDependencies: true,
});

export const expectedPnpmVersion = "11.19.0" as const;

export const expectedPackageManager = `pnpm@${expectedPnpmVersion}` as const;

const legacyNpmrcPolicyKeys = new Map([
  ["autoinstallpeers", "autoInstallPeers"],
  ["saveexact", "saveExact"],
  ["sharedworkspacelockfile", "sharedWorkspaceLockfile"],
  ["strictpeerdependencies", "strictPeerDependencies"],
]);

type DependencySection = (typeof dependencySections)[number];

export function dependencyPolicyViolations(
  manifest: Record<string, unknown>,
  workspaceNames: ReadonlySet<string>,
): string[] {
  const policyViolations: string[] = [];
  const seen = new Map<string, DependencySection>();
  for (const section of dependencySections) {
    const value = manifest[section];
    if (value === undefined) continue;
    if (!isRecord(value)) {
      policyViolations.push(`${section} must be an object`);
      continue;
    }
    for (const [name, specifier] of Object.entries(value).sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      const previous = seen.get(name);
      if (previous === undefined) seen.set(name, section);
      else
        policyViolations.push(
          `dependency ${JSON.stringify(name)} is duplicated in ${previous} and ${section}`,
        );
      if (name.length === 0) {
        policyViolations.push(`${section} contains an empty dependency name`);
        continue;
      }
      if (typeof specifier !== "string") {
        policyViolations.push(
          `${section} dependency ${JSON.stringify(name)} must have a string specifier`,
        );
        continue;
      }
      if (workspaceNames.has(name)) {
        if (specifier !== "workspace:*")
          policyViolations.push(
            `workspace dependency ${JSON.stringify(name)} in ${section} must use workspace:*`,
          );
        continue;
      }
      if (name.startsWith("@research-cockpit/")) {
        policyViolations.push(
          `${section} dependency ${JSON.stringify(name)} uses the reserved internal scope without a matching workspace package`,
        );
        continue;
      }
      if (specifier.startsWith("workspace:")) {
        policyViolations.push(
          `${section} dependency ${JSON.stringify(name)} references an unknown workspace package`,
        );
        continue;
      }
      if (
        exactDependencySections.has(section) &&
        !plainExactSemver.test(specifier)
      )
        policyViolations.push(
          `external dependency ${JSON.stringify(name)} in ${section} must use one plain exact semantic version`,
        );
      else if (section === "peerDependencies" && specifier.length === 0)
        policyViolations.push(
          `peer dependency ${JSON.stringify(name)} must have a non-empty specifier`,
        );
    }
  }
  return policyViolations;
}

export function legacyNpmrcPolicyViolation(content: string): string | null {
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#") || line.startsWith(";"))
      continue;
    const equalsIndex = line.indexOf("=");
    const key = (equalsIndex === -1 ? line : line.slice(0, equalsIndex)).trim();
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const policyKey = legacyNpmrcPolicyKeys.get(normalizedKey);
    if (policyKey !== undefined)
      return `legacy non-auth setting ${policyKey} is forbidden; configure it in pnpm-workspace.yaml`;
  }
  return null;
}

export function npmrcGitignoreViolation(content: string): string | null {
  const rules = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  if (rules.filter((line) => line === ".npmrc").length !== 1)
    return ".npmrc must have exactly one explicit ignore rule";
  if (rules.some((line) => line === "!.npmrc" || line === "!/.npmrc"))
    return ".npmrc must not be re-included after it is ignored";
  return null;
}

export function pnpmLockfileHeaderViolation(content: string): string | null {
  const lines = content.split(/\r?\n/u);
  const meaningful = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#");
  });
  if (meaningful[0] !== "lockfileVersion: '9.0'")
    return "lockfileVersion must remain the pinned canonical 9.0 header";
  const canonicalTopLevelLines = [
    "lockfileVersion: '9.0'",
    "settings:",
    "importers:",
    "packages:",
    "ignoredOptionalDependencies:",
    "snapshots:",
  ] as const;
  const requiredTopLevelLines = new Set<
    (typeof canonicalTopLevelLines)[number]
  >(["lockfileVersion: '9.0'", "settings:"]);
  const topLevelCounts = new Map<
    (typeof canonicalTopLevelLines)[number],
    number
  >(canonicalTopLevelLines.map((line) => [line, 0] as const));
  const settingsLines: string[] = [];
  let insideSettings = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    if (!/^\s/u.test(line)) {
      insideSettings = line === "settings:";
      const canonicalLine = line as (typeof canonicalTopLevelLines)[number];
      const count = topLevelCounts.get(canonicalLine);
      if (count === undefined)
        return "top-level mappings must use only the canonical generated keys";
      topLevelCounts.set(canonicalLine, count + 1);
      continue;
    }
    if (insideSettings) settingsLines.push(line);
  }
  for (const [line, count] of topLevelCounts) {
    if (
      (requiredTopLevelLines.has(line) && count !== 1) ||
      (!requiredTopLevelLines.has(line) && count > 1)
    )
      return "required top-level keys must occur once and optional keys at most once";
  }
  if (
    JSON.stringify(settingsLines) !==
    JSON.stringify([
      "  autoInstallPeers: false",
      "  excludeLinksFromLockfile: false",
    ] as const)
  )
    return "settings must contain only the exact canonical generated values";
  return null;
}

export function effectivePnpmSettingsViolation(config: unknown): string | null {
  if (!isRecord(config))
    return "effective settings must be available as bounded JSON from the active pnpm CLI";
  for (const [key, expected] of Object.entries(expectedPnpmSettings)) {
    if (config[key] !== expected)
      return `effective ${key} must be ${String(expected)}`;
  }
  if (
    typeof config.userAgent !== "string" ||
    !config.userAgent.startsWith(`pnpm/${expectedPnpmVersion} `)
  )
    return `active pnpm must remain exactly ${expectedPnpmVersion}`;
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
