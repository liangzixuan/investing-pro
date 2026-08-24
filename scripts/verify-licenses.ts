import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

interface LicenseRecord {
  name: string;
  versions: string[];
}

interface NoticeGroup {
  label: string;
  packages: readonly string[];
  use: string;
}

interface NoticeRow {
  label: string;
  license: string;
  use: string;
  version: string;
}

interface WorkspaceProject {
  name: string;
  path: string;
}

interface GraphDependency {
  name: string;
  node: Record<string, unknown>;
}

const allowedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MIT",
]);
const exactExceptions = new Map<string, string>([
  ["caniuse-lite@1.0.30001809", "CC-BY-4.0"],
]);
const exactVersion =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const noticeGroups: readonly NoticeGroup[] = Object.freeze([
  Object.freeze({
    label: "Next.js",
    packages: Object.freeze(["next"]),
    use: "Web framework",
  }),
  Object.freeze({
    label: "React / React DOM",
    packages: Object.freeze(["react", "react-dom"]),
    use: "UI runtime",
  }),
  Object.freeze({
    label: "Apache ECharts",
    packages: Object.freeze(["echarts"]),
    use: "Analytical chart rendering",
  }),
  Object.freeze({
    label: "Fastify",
    packages: Object.freeze(["fastify"]),
    use: "Demo REST API",
  }),
  Object.freeze({
    label: "@fastify/cors",
    packages: Object.freeze(["@fastify/cors"]),
    use: "Local web/API boundary",
  }),
  Object.freeze({
    label: "@fastify/helmet",
    packages: Object.freeze(["@fastify/helmet"]),
    use: "HTTP security headers",
  }),
  Object.freeze({
    label: "decimal.js",
    packages: Object.freeze(["decimal.js"]),
    use: "Deterministic decimal calculations",
  }),
  Object.freeze({
    label: "node-postgres",
    packages: Object.freeze(["pg"]),
    use: "Single-client PostgreSQL reads",
  }),
]);

function main(): void {
  const pnpmCli = process.env.npm_execpath;
  if (!pnpmCli) {
    throw new Error(
      "Run the license gate through pnpm so npm_execpath is available",
    );
  }
  const workspaceRoot = realpathSync(resolve(process.cwd()));
  const inventory = parseInventory(
    runPnpmJson(
      pnpmCli,
      ["licenses", "list", "--prod", "--json"],
      "pnpm license inventory",
    ),
  );
  const rejected: string[] = [];
  const inventoryLicenses = new Map<string, string>();
  for (const [license, packages] of inventory) {
    for (const packageRecord of packages) {
      for (const version of packageRecord.versions) {
        const identity = `${packageRecord.name}@${version}`;
        const recordedLicense = inventoryLicenses.get(identity);
        assert(
          recordedLicense === undefined,
          recordedLicense === license
            ? `Production package ${identity} is duplicated in the license inventory`
            : `Production package ${identity} has conflicting license records`,
        );
        inventoryLicenses.set(identity, license);
        if (
          !allowedLicenses.has(license) &&
          exactExceptions.get(identity) !== license
        ) {
          rejected.push(`${identity} (${license})`);
        }
      }
    }
  }
  const packageCount = inventoryLicenses.size;

  const productionGraph = runPnpmJson(
    pnpmCli,
    ["list", "--recursive", "--prod", "--depth", "Infinity", "--json"],
    "pnpm installed production graph",
  );
  const workspaceProjects = parseWorkspaceProjects(
    productionGraph,
    workspaceRoot,
  );
  const installedProductionIdentities = parseInstalledProductionIdentities(
    productionGraph,
    workspaceProjects,
    workspaceRoot,
  );
  assertExactProductionIdentitySets(
    installedProductionIdentities,
    new Set(inventoryLicenses.keys()),
  );

  if (rejected.length > 0) {
    throw new Error(
      `Unapproved production licenses:\n- ${rejected.join("\n- ")}`,
    );
  }
  console.log(
    `License policy and installed inventory verified: ${packageCount} production package versions.`,
  );

  const directRuntimeDependencies =
    readDirectRuntimeDependencies(workspaceProjects);
  const noticeRows = parseNoticeRows(
    readFileSync(join(workspaceRoot, "THIRD_PARTY_NOTICES.md"), "utf8"),
  );
  verifyDirectRuntimeNotices(
    directRuntimeDependencies,
    inventoryLicenses,
    noticeRows,
  );
  console.log(
    `Direct runtime notices verified: ${directRuntimeDependencies.size} packages across ${noticeRows.size} rows.`,
  );
}

function runPnpmJson(
  pnpmCli: string,
  arguments_: readonly string[],
  label: string,
): unknown {
  const result = spawnSync(process.execPath, [pnpmCli, ...arguments_], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${result.stderr || result.stdout}`);
  }
  try {
    return JSON.parse(result.stdout) as unknown;
  } catch {
    throw new Error(`${label} did not return valid JSON`);
  }
}

function parseInventory(value: unknown): ReadonlyMap<string, LicenseRecord[]> {
  assert(isRecord(value), "License inventory must be an object");
  const inventory = new Map<string, LicenseRecord[]>();
  for (const [license, packages] of Object.entries(value)) {
    assert(license.length > 0, "License inventory contains an empty license");
    assert(
      Array.isArray(packages) && packages.length > 0,
      `License group ${license} must be a non-empty array`,
    );
    inventory.set(
      license,
      packages.map((entry, index) => {
        assert(
          isRecord(entry),
          `License record ${license}[${index}] must be an object`,
        );
        assert(
          typeof entry.name === "string" && entry.name.length > 0,
          `License record ${license}[${index}] needs a package name`,
        );
        assert(
          Array.isArray(entry.versions) &&
            entry.versions.length > 0 &&
            entry.versions.every(
              (version) =>
                typeof version === "string" && exactVersion.test(version),
            ),
          `License record ${entry.name} needs exact semantic versions`,
        );
        return { name: entry.name, versions: entry.versions };
      }),
    );
  }
  return inventory;
}

function parseWorkspaceProjects(
  value: unknown,
  workspaceRoot: string,
): readonly WorkspaceProject[] {
  assert(
    Array.isArray(value) && value.length > 0,
    "Workspace inventory must be a non-empty array",
  );
  const names = new Set<string>();
  const realPaths = new Set<string>();
  const nodeModulesRoot = resolve(workspaceRoot, "node_modules");
  return value.map((entry, index) => {
    assert(isRecord(entry), `Workspace project ${index} must be an object`);
    assert(
      typeof entry.name === "string" && entry.name.length > 0,
      `Workspace project ${index} needs a name`,
    );
    assert(
      typeof entry.path === "string" && entry.path.length > 0,
      `Workspace project ${entry.name} needs a path`,
    );
    const projectPath = resolve(entry.path);
    assert(
      isWithinPath(workspaceRoot, projectPath),
      `Workspace project ${entry.name} is outside the workspace root`,
    );
    let realProjectPath: string;
    try {
      realProjectPath = realpathSync(projectPath);
    } catch {
      throw new Error(`Workspace project ${entry.name} has an unreadable path`);
    }
    assert(
      isWithinPath(workspaceRoot, realProjectPath),
      `Workspace project ${entry.name} resolves outside the workspace root`,
    );
    assert(
      !isWithinPath(nodeModulesRoot, realProjectPath),
      `Workspace project ${entry.name} resolves inside workspace node_modules`,
    );
    assert(
      !names.has(entry.name),
      `Workspace project name is duplicated: ${entry.name}`,
    );
    assert(
      !realPaths.has(realProjectPath),
      `Workspace project path is duplicated: ${realProjectPath}`,
    );
    names.add(entry.name);
    realPaths.add(realProjectPath);
    return { name: entry.name, path: realProjectPath };
  });
}

function parseInstalledProductionIdentities(
  value: unknown,
  projects: readonly WorkspaceProject[],
  workspaceRoot: string,
): ReadonlySet<string> {
  assert(Array.isArray(value), "Production dependency graph must be an array");
  assert(
    value.length === projects.length,
    "Production dependency graph does not match the workspace inventory",
  );

  const workspaceByName = new Map(
    projects.map((project) => [project.name, project] as const),
  );
  const nodeModulesRoot = resolve(workspaceRoot, "node_modules");
  assert(
    existsSync(nodeModulesRoot),
    "Workspace node_modules is missing; install dependencies before checking licenses",
  );
  const realNodeModulesRoot = realpathSync(nodeModulesRoot);
  assert(
    isWithinPath(workspaceRoot, realNodeModulesRoot),
    "Workspace node_modules resolves outside the workspace root",
  );

  const identities = new Set<string>();
  const identitiesByGraphPath = new Map<string, string>();
  const identitiesByRealPath = new Map<string, string>();
  const manifestCache = new Map<string, Record<string, unknown>>();

  const readInstalledManifest = (
    packagePath: string,
    expectedName: string,
    expectedVersion?: string,
  ): Record<string, unknown> => {
    const cached = manifestCache.get(packagePath);
    if (cached !== undefined) return cached;
    const manifestPath = join(packagePath, "package.json");
    let value_: unknown;
    try {
      value_ = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
    } catch {
      throw new Error(
        `Installed production package ${expectedName} has an unreadable manifest`,
      );
    }
    assert(
      isRecord(value_),
      `Installed production package ${expectedName} manifest must be an object`,
    );
    assert(
      value_.name === expectedName,
      `Installed production package path for ${expectedName} contains ${String(value_.name)}`,
    );
    if (expectedVersion !== undefined) {
      assert(
        value_.version === expectedVersion,
        `Installed production package ${expectedName} has graph version ${expectedVersion} but manifest version ${String(value_.version)}`,
      );
    }
    manifestCache.set(packagePath, value_);
    return value_;
  };

  const visitDependencies = (
    parent: Record<string, unknown>,
    parentManifest: Record<string, unknown>,
    parentLabel: string,
    ancestorPaths: ReadonlySet<string>,
  ): void => {
    for (const { name, node } of parseGraphDependencies(parent, parentLabel)) {
      assert(
        node.from === name,
        `${parentLabel} dependency ${name} has a conflicting graph name`,
      );
      assert(
        typeof node.version === "string" && node.version.length > 0,
        `${parentLabel} dependency ${name} needs a graph version`,
      );
      assert(
        typeof node.path === "string" &&
          node.path.length > 0 &&
          isAbsolute(node.path),
        `${parentLabel} dependency ${name} needs an absolute graph path`,
      );
      const packagePath = resolve(node.path);
      assert(
        isWithinPath(workspaceRoot, packagePath),
        `${parentLabel} dependency ${name} is outside the workspace root`,
      );

      const workspaceProject = workspaceByName.get(name);
      const disposition = dependencyDisposition(parentManifest, name);
      assert(
        disposition !== undefined,
        `${parentLabel} graph contains undeclared dependency ${name}`,
      );
      if (node.version.startsWith("link:")) {
        let realPackagePath: string;
        try {
          realPackagePath = realpathSync(packagePath);
        } catch {
          throw new Error(
            `${parentLabel} workspace dependency ${name} has an unreadable path`,
          );
        }
        assert(
          workspaceProject !== undefined &&
            realPackagePath === workspaceProject.path,
          `${parentLabel} dependency ${name} is an unknown or conflicting workspace link`,
        );
        continue;
      }
      assert(
        workspaceProject === undefined,
        `${parentLabel} dependency ${name} shadows a workspace package`,
      );
      assert(
        exactVersion.test(node.version),
        `${parentLabel} dependency ${name} needs an exact semantic graph version`,
      );
      assert(
        typeof node.resolved === "string" && node.resolved.length > 0,
        `${parentLabel} dependency ${name}@${node.version} needs a resolved source`,
      );
      assert(
        isWithinPath(nodeModulesRoot, packagePath) &&
          packagePath !== nodeModulesRoot,
        `${parentLabel} dependency ${name}@${node.version} is outside workspace node_modules`,
      );

      const identity = `${name}@${node.version}`;
      const graphPathIdentity = identitiesByGraphPath.get(packagePath);
      assert(
        graphPathIdentity === undefined || graphPathIdentity === identity,
        `Production graph path ${packagePath} has conflicting identities ${String(graphPathIdentity)} and ${identity}`,
      );
      identitiesByGraphPath.set(packagePath, identity);

      if (!existsSync(packagePath)) {
        assert(
          disposition === "optional",
          `Required production package ${identity} is missing from ${packagePath}`,
        );
        assert(
          parseGraphDependencies(node, identity).length === 0,
          `Missing optional production package ${identity} has a nested graph`,
        );
        continue;
      }

      const realPackagePath = realpathSync(packagePath);
      assert(
        isWithinPath(realNodeModulesRoot, realPackagePath) &&
          realPackagePath !== realNodeModulesRoot,
        `Installed production package ${identity} resolves outside workspace node_modules`,
      );
      const realPathIdentity = identitiesByRealPath.get(realPackagePath);
      assert(
        realPathIdentity === undefined || realPathIdentity === identity,
        `Installed package path ${realPackagePath} has conflicting identities ${String(realPathIdentity)} and ${identity}`,
      );
      identitiesByRealPath.set(realPackagePath, identity);

      const packageManifest = readInstalledManifest(
        packagePath,
        name,
        node.version,
      );
      identities.add(identity);
      if (ancestorPaths.has(packagePath)) {
        assert(
          parseGraphDependencies(node, identity).length === 0,
          `Production dependency cycle at ${identity} must be a truncated back-edge`,
        );
        continue;
      }
      const descendants = new Set(ancestorPaths);
      descendants.add(packagePath);
      visitDependencies(node, packageManifest, identity, descendants);
    }
  };

  for (let index = 0; index < value.length; index += 1) {
    const root: unknown = value[index];
    const project = projects[index];
    assert(
      isRecord(root) && project !== undefined,
      `Production dependency graph root ${index} must be an object`,
    );
    let realRootPath: string;
    try {
      realRootPath = realpathSync(resolve(String(root.path)));
    } catch {
      throw new Error(
        `Production dependency graph root ${index} has an unreadable path`,
      );
    }
    assert(
      root.name === project.name && realRootPath === project.path,
      `Production dependency graph root ${index} conflicts with the workspace inventory`,
    );
    const manifest = readInstalledManifest(project.path, project.name);
    visitDependencies(root, manifest, project.name, new Set([project.path]));
  }
  return identities;
}

function parseGraphDependencies(
  parent: Record<string, unknown>,
  parentLabel: string,
): readonly GraphDependency[] {
  const result: GraphDependency[] = [];
  const names = new Set<string>();
  for (const section of ["dependencies", "optionalDependencies"] as const) {
    const dependencies = parent[section];
    if (dependencies === undefined) continue;
    assert(
      isRecord(dependencies),
      `${parentLabel} graph ${section} must be an object`,
    );
    for (const [name, node] of Object.entries(dependencies)) {
      assert(name.length > 0, `${parentLabel} graph has an empty package name`);
      assert(
        !names.has(name),
        `${parentLabel} graph duplicates dependency ${name}`,
      );
      assert(
        isRecord(node),
        `${parentLabel} graph dependency ${name} must be an object`,
      );
      names.add(name);
      result.push({ name, node });
    }
  }
  return result;
}

function dependencyDisposition(
  manifest: Record<string, unknown>,
  name: string,
): "required" | "optional" | undefined {
  const label =
    typeof manifest.name === "string" ? manifest.name : "Package manifest";
  const optionalDependencies = parseDependencySection(
    manifest.optionalDependencies,
    `${label} optionalDependencies`,
  );
  if (Object.hasOwn(optionalDependencies, name)) return "optional";
  const dependencies = parseDependencySection(
    manifest.dependencies,
    `${label} dependencies`,
  );
  if (Object.hasOwn(dependencies, name)) return "required";
  const peerDependencies = parseDependencySection(
    manifest.peerDependencies,
    `${label} peerDependencies`,
  );
  if (!Object.hasOwn(peerDependencies, name)) return undefined;
  const peerMetadata = manifest.peerDependenciesMeta;
  if (peerMetadata === undefined) return "required";
  assert(
    isRecord(peerMetadata),
    `${label} peerDependenciesMeta must be an object`,
  );
  const metadata = peerMetadata[name];
  if (metadata === undefined) return "required";
  assert(
    isRecord(metadata),
    `${label} peer dependency metadata for ${name} must be an object`,
  );
  return metadata.optional === true ? "optional" : "required";
}

export function assertExactProductionIdentitySets(
  installed: ReadonlySet<string>,
  licensed: ReadonlySet<string>,
): void {
  const missing = [...installed]
    .filter((identity) => !licensed.has(identity))
    .sort();
  const extra = [...licensed]
    .filter((identity) => !installed.has(identity))
    .sort();
  const problems: string[] = [];
  if (missing.length > 0) {
    problems.push(
      `License inventory is missing installed production packages:\n- ${missing.join("\n- ")}`,
    );
  }
  if (extra.length > 0) {
    problems.push(
      `License inventory contains packages absent from the installed production graph:\n- ${extra.join("\n- ")}`,
    );
  }
  assert(problems.length === 0, problems.join("\n"));
}

function isWithinPath(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  );
}

function readDirectRuntimeDependencies(
  projects: readonly WorkspaceProject[],
): ReadonlyMap<string, string> {
  const workspaceNames = new Set(projects.map((project) => project.name));
  const externalDependencies = new Map<string, string>();
  for (const project of projects) {
    const manifest = parseManifest(
      JSON.parse(
        readFileSync(join(project.path, "package.json"), "utf8"),
      ) as unknown,
      project,
    );
    const seenInManifest = new Set<string>();
    for (const section of ["dependencies", "optionalDependencies"] as const) {
      const dependencies = parseDependencySection(
        manifest[section],
        `${project.name} ${section}`,
      );
      for (const [name, version] of Object.entries(dependencies)) {
        assert(
          !seenInManifest.has(name),
          `${project.name} declares ${name} in multiple runtime dependency sections`,
        );
        seenInManifest.add(name);
        if (workspaceNames.has(name)) {
          assert(
            version.startsWith("workspace:"),
            `${project.name} must reference workspace dependency ${name} with the workspace protocol`,
          );
          continue;
        }
        assert(
          !version.startsWith("workspace:"),
          `${project.name} references unknown workspace dependency ${name}`,
        );
        assert(
          exactVersion.test(version),
          `${project.name} direct runtime dependency ${name} must use one exact version`,
        );
        const recorded = externalDependencies.get(name);
        assert(
          recorded === undefined || recorded === version,
          `Direct runtime dependency ${name} has conflicting versions`,
        );
        externalDependencies.set(name, version);
      }
    }
  }
  return externalDependencies;
}

function parseManifest(
  value: unknown,
  project: WorkspaceProject,
): Record<string, unknown> {
  assert(isRecord(value), `${project.name} package manifest must be an object`);
  assert(
    value.name === project.name,
    `${project.name} workspace inventory does not match its package manifest`,
  );
  return value;
}

function parseDependencySection(
  value: unknown,
  label: string,
): Record<string, string> {
  if (value === undefined) return {};
  assert(isRecord(value), `${label} must be an object`);
  const dependencies: Record<string, string> = {};
  for (const [name, version] of Object.entries(value)) {
    assert(name.length > 0, `${label} contains an empty package name`);
    assert(
      typeof version === "string" && version.length > 0,
      `${label} dependency ${name} needs a version`,
    );
    dependencies[name] = version;
  }
  return dependencies;
}

function parseNoticeRows(source: string): ReadonlyMap<string, NoticeRow> {
  const lines = source.split(/\r?\n/u);
  const headerIndexes = lines.flatMap((line, index) => {
    const cells = markdownRow(line);
    return cells !== undefined &&
      cells.length === 4 &&
      cells[0] === "Package" &&
      cells[1] === "Version" &&
      cells[2] === "License" &&
      cells[3] === "Use"
      ? [index]
      : [];
  });
  assert(
    headerIndexes.length === 1,
    "THIRD_PARTY_NOTICES must contain exactly one direct-runtime table",
  );
  const headerIndex = headerIndexes[0];
  assert(headerIndex !== undefined, "Direct-runtime notice table is missing");
  const separator = markdownRow(lines[headerIndex + 1] ?? "");
  assert(
    separator !== undefined &&
      separator.length === 4 &&
      separator.every((cell) => /^:?-{3,}:?$/u.test(cell)),
    "Direct-runtime notice table separator is invalid",
  );

  const rows = new Map<string, NoticeRow>();
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const line = lines[index];
    assert(line !== undefined, "Direct-runtime notice row is missing");
    if (line.trim() === "") break;
    const cells = markdownRow(line);
    assert(
      cells !== undefined && cells.length === 4,
      "Direct-runtime notice table contains an invalid row",
    );
    const [label, version, license, use] = cells;
    assert(
      label !== undefined && label.length > 0,
      "Direct-runtime notice row needs a package label",
    );
    assert(
      version !== undefined && exactVersion.test(version),
      `Direct-runtime notice ${label} needs one exact version`,
    );
    assert(
      license !== undefined && license.length > 0,
      `Direct-runtime notice ${label} needs a license`,
    );
    assert(
      use !== undefined && use.length > 0,
      `Direct-runtime notice ${label} needs a use`,
    );
    assert(
      !rows.has(label),
      `Direct-runtime notice row is duplicated: ${label}`,
    );
    rows.set(label, { label, license, use, version });
  }
  assert(rows.size > 0, "Direct-runtime notice table has no package rows");
  return rows;
}

function markdownRow(line: string): readonly string[] | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return undefined;
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function verifyDirectRuntimeNotices(
  dependencies: ReadonlyMap<string, string>,
  inventoryLicenses: ReadonlyMap<string, string>,
  noticeRows: ReadonlyMap<string, NoticeRow>,
): void {
  const groupLabels = new Set<string>();
  const packageToGroup = new Map<string, NoticeGroup>();
  for (const group of noticeGroups) {
    assert(
      !groupLabels.has(group.label),
      `Direct-runtime notice mapping label is duplicated: ${group.label}`,
    );
    groupLabels.add(group.label);
    assert(
      group.packages.length > 0,
      `Direct-runtime notice mapping ${group.label} has no packages`,
    );
    for (const packageName of group.packages) {
      assert(
        !packageToGroup.has(packageName),
        `Direct-runtime notice package mapping is duplicated: ${packageName}`,
      );
      packageToGroup.set(packageName, group);
    }
  }

  const unmappedDependencies = [...dependencies.keys()].filter(
    (name) => !packageToGroup.has(name),
  );
  assert(
    unmappedDependencies.length === 0,
    `Direct runtime dependencies need notice mappings:\n- ${unmappedDependencies.join("\n- ")}`,
  );
  const extraMappings = [...packageToGroup.keys()].filter(
    (name) => !dependencies.has(name),
  );
  assert(
    extraMappings.length === 0,
    `Direct-runtime notice mappings have no dependency:\n- ${extraMappings.join("\n- ")}`,
  );
  const extraRows = [...noticeRows.keys()].filter(
    (label) => !groupLabels.has(label),
  );
  assert(
    extraRows.length === 0,
    `THIRD_PARTY_NOTICES has unmapped direct-runtime rows:\n- ${extraRows.join("\n- ")}`,
  );
  const missingRows = [...groupLabels].filter(
    (label) => !noticeRows.has(label),
  );
  assert(
    missingRows.length === 0,
    `THIRD_PARTY_NOTICES is missing direct-runtime rows:\n- ${missingRows.join("\n- ")}`,
  );

  for (const group of noticeGroups) {
    const versions = new Set(
      group.packages.map((packageName) => dependencies.get(packageName)),
    );
    assert(
      !versions.has(undefined) && versions.size === 1,
      `Direct-runtime notice ${group.label} cannot represent differing package versions`,
    );
    const expectedVersion = [...versions][0];
    const row = noticeRows.get(group.label);
    assert(
      expectedVersion !== undefined && row?.version === expectedVersion,
      `THIRD_PARTY_NOTICES version for ${group.label} is stale: expected ${expectedVersion ?? "<missing>"}, found ${row?.version ?? "<missing>"}`,
    );
    const licenses = new Set(
      group.packages.map((packageName) =>
        expectedVersion === undefined
          ? undefined
          : inventoryLicenses.get(`${packageName}@${expectedVersion}`),
      ),
    );
    assert(
      !licenses.has(undefined) && licenses.size === 1,
      `Direct-runtime notice ${group.label} cannot represent missing or differing package licenses`,
    );
    const expectedLicense = [...licenses][0];
    assert(
      expectedLicense !== undefined && row?.license === expectedLicense,
      `THIRD_PARTY_NOTICES license for ${group.label} is stale: expected ${expectedLicense ?? "<missing>"}, found ${row?.license ?? "<missing>"}`,
    );
    assert(
      row?.use === group.use,
      `THIRD_PARTY_NOTICES use for ${group.label} is stale: expected ${group.use}, found ${row?.use ?? "<missing>"}`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const entryPath = process.argv[1];
if (
  entryPath !== undefined &&
  import.meta.url === pathToFileURL(resolve(entryPath)).href
) {
  main();
}
