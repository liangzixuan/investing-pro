import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import ts from "typescript";
import {
  RELEASE_CLASSIFICATION_ADAPTER_PATHS,
  renderReleaseClassification,
} from "./release-classification-render.js";
import type {
  ReleaseClassificationChange,
  ReleaseClassificationRenderDescriptor,
} from "./release-classification-render.js";

export const CLASSIFICATION_BASELINE =
  "62c01dafe305ddd43c75688e0225163b3abdf6df";
export const BOOTSTRAP_PREDECESSOR = "9edb8cbe47b9847ff1264a1e04507738dfaf3d3c";
export const RELEASE_DIRECTORY = "scripts/release-classification/releases";
const MAX_DESCRIPTOR_BYTES = 64_000;
const MAX_GIT_BYTES = 8_000_000;
export const GENERATOR_WATCHES = [
  "scripts/release-classification*.ts",
  "scripts/release-classification/**",
] as const;

export interface ReleaseDescriptor extends ReleaseClassificationRenderDescriptor {
  readonly descriptorPath: string;
}

function requireCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

function exactKeys(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  requireCondition(
    typeof value === "object" && value !== null && !Array.isArray(value),
    `Invalid ${label} object`,
  );
  requireCondition(
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...keys].sort()),
    `Unexpected ${label} keys`,
  );
  return value as Record<string, unknown>;
}

function revision(value: unknown): string {
  requireCondition(
    typeof value === "string" &&
      /^[0-9a-f]{40}$/u.test(value) &&
      !/^0+$/u.test(value),
    "Expected full lowercase revision",
  );
  return value;
}

function safePath(value: unknown): string {
  requireCondition(
    typeof value === "string" &&
      value.length <= 240 &&
      /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/u.test(value),
    "Invalid repository path",
  );
  for (const part of value.split("/")) {
    requireCondition(
      ![".", "..", ".git"].includes(part.toLowerCase()) &&
        !/[. ]$/u.test(part) &&
        !/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/iu.test(part),
      "Unsafe repository path",
    );
  }
  return value;
}

function changes(value: unknown): ReleaseClassificationChange[] {
  requireCondition(
    Array.isArray(value) && value.length > 0 && value.length <= 256,
    "Invalid inventory size",
  );
  const seen = new Set<string>();
  let previous = "";
  return value.map((entry: unknown) => {
    const object = exactKeys(entry, ["path", "status"], "inventory entry");
    const path = safePath(object.path);
    requireCondition(
      path > previous && !seen.has(path.toLowerCase()),
      "Inventory paths must be unique and ordered",
    );
    requireCondition(
      object.status === "A" || object.status === "M",
      "Only explicit A/M inventory statuses are supported",
    );
    previous = path;
    seen.add(path.toLowerCase());
    return { path, status: object.status };
  });
}

function same(actual: unknown, expected: unknown, label: string): void {
  requireCondition(
    JSON.stringify(actual) === JSON.stringify(expected),
    `Unexpected ${label}`,
  );
}

/** JSON.parse supplies strict syntax; the AST additionally rejects duplicate keys. */
export function parseReleaseDescriptor(
  text: string,
  installedPath?: string,
): ReleaseDescriptor {
  requireCondition(
    Buffer.byteLength(text) <= MAX_DESCRIPTOR_BYTES,
    "Descriptor exceeds size limit",
  );
  const parsed: unknown = JSON.parse(text);
  const ast = ts.parseJsonText("release.json", text);
  function visit(node: ts.Node, depth: number): void {
    requireCondition(depth < 20, "Descriptor nesting exceeds limit");
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Set<string>();
      for (const property of node.properties) {
        requireCondition(
          ts.isPropertyAssignment(property) &&
            ts.isStringLiteral(property.name),
          "Invalid JSON property",
        );
        requireCondition(
          !seen.has(property.name.text),
          "Duplicate descriptor key",
        );
        seen.add(property.name.text);
      }
    }
    ts.forEachChild(node, (child) => visit(child, depth + 1));
  }
  visit(ast, 0);
  const object = exactKeys(
    parsed,
    [
      "version",
      "caseNumber",
      "baselineRevision",
      "predecessorRevision",
      "featureRevision",
      "featureCount",
      "closureCount",
      "featureChanges",
      "closureChanges",
      "descriptorPath",
      "presentation",
    ],
    "descriptor",
  );
  requireCondition(object.version === 1, "Unsupported descriptor version");
  requireCondition(
    typeof object.caseNumber === "number" &&
      Number.isInteger(object.caseNumber) &&
      object.caseNumber >= 14 &&
      object.caseNumber <= 64,
    "Unsupported release case",
  );
  const caseNumber = object.caseNumber;
  const baselineRevision = revision(object.baselineRevision);
  const predecessorRevision = revision(object.predecessorRevision);
  const featureRevision = revision(object.featureRevision);
  requireCondition(
    baselineRevision === CLASSIFICATION_BASELINE,
    "Unexpected counting baseline",
  );
  requireCondition(
    new Set([baselineRevision, predecessorRevision, featureRevision]).size ===
      3,
    "Release pins must be distinct",
  );
  if (caseNumber === 14)
    requireCondition(
      predecessorRevision === BOOTSTRAP_PREDECESSOR,
      "Unexpected bootstrap predecessor",
    );
  requireCondition(
    object.featureCount === 101 + 2 * caseNumber &&
      object.closureCount === 102 + 2 * caseNumber,
    "Unexpected release counts",
  );
  const descriptorPath = safePath(object.descriptorPath);
  requireCondition(
    descriptorPath === `${RELEASE_DIRECTORY}/cycle3ka${caseNumber}.json`,
    "Unexpected descriptor output path",
  );
  if (installedPath !== undefined)
    requireCondition(
      descriptorPath === installedPath,
      "Installed descriptor filename does not match its declared case",
    );
  const featureChanges = changes(object.featureChanges);
  const closureChanges = changes(object.closureChanges);
  const outputs = [
    ...RELEASE_CLASSIFICATION_ADAPTER_PATHS.map((path) => ({
      path,
      status: "M",
    })),
    { path: descriptorPath, status: "A" },
  ].sort((a, b) => (a.path < b.path ? -1 : 1));
  same(closureChanges, outputs, "closure output allowlist");
  requireCondition(
    featureChanges.every(
      ({ path }) =>
        !RELEASE_CLASSIFICATION_ADAPTER_PATHS.some(
          (adapter) => adapter.toLowerCase() === path.toLowerCase(),
        ) && !path.toLowerCase().startsWith(`${RELEASE_DIRECTORY}/`),
    ),
    "Feature changes a closure surface",
  );
  const presentation = exactKeys(
    object.presentation,
    [
      "featureDescription",
      "closureDescription",
      "inventoryDescription",
      "testBinding",
      "routingDescription",
      "summaryDescription",
    ],
    "presentation",
  );
  for (const [key, value] of Object.entries(presentation)) {
    requireCondition(
      typeof value === "string" &&
        value.length > 0 &&
        value.length <= 240 &&
        value.trim() === value &&
        /^[A-Za-z0-9 &(),./:+_-]+$/u.test(value) &&
        !value.includes("*/"),
      `Invalid presentation ${key}`,
    );
  }
  requireCondition(
    typeof presentation.testBinding === "string" &&
      /^[a-z][A-Za-z0-9]{1,60}$/u.test(presentation.testBinding),
    "Invalid test binding",
  );
  return {
    version: 1,
    caseNumber,
    baselineRevision,
    predecessorRevision,
    featureRevision,
    featureCount: object.featureCount,
    closureCount: object.closureCount,
    featureChanges,
    closureChanges,
    descriptorPath,
    presentation: presentation as unknown as ReleaseDescriptor["presentation"],
  };
}

export async function descriptorText(
  descriptor: ReleaseDescriptor,
): Promise<string> {
  return format(JSON.stringify(descriptor), {
    parser: "json",
    endOfLine: "lf",
  });
}

export interface ReleaseGitReader {
  head(): string;
  parents(revision: string): string[];
  count(baseline: string, revision: string, firstParent: boolean): number;
  changes(
    parent: string,
    revision: string,
  ): readonly ReleaseClassificationChange[];
  blob(revision: string, path: string): string;
  status(): string;
  ancestor(ancestor: string, revision: string): boolean;
}

export function parseGitChanges(output: string): ReleaseClassificationChange[] {
  if (output === "") return [];
  requireCondition(output.endsWith("\0"), "Truncated Git inventory");
  const fields = output.slice(0, -1).split("\0");
  requireCondition(fields.length % 2 === 0, "Malformed Git inventory");
  const entries = [];
  for (let index = 0; index < fields.length; index += 2)
    entries.push({ status: fields[index], path: fields[index + 1] });
  return changes(entries);
}

export function createReleaseGitReader(repository: string): ReleaseGitReader {
  const root = realpathSync(repository).replaceAll("\\", "/");
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(?:GIT_|NODE_OPTIONS$)/iu.test(key),
    ),
  );
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_NO_LAZY_FETCH: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_OPTIONAL_LOCKS: "0",
    LC_ALL: "C",
  });
  function git(args: string[]): string {
    return execFileSync(
      "git",
      [
        "--no-replace-objects",
        "-c",
        `safe.directory=${root}`,
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.quotePath=false",
        "-C",
        root,
        ...args,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: MAX_GIT_BYTES,
        timeout: 30_000,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  }
  requireCondition(
    git(["rev-parse", "--is-shallow-repository"]).trim() === "false",
    "Release checks require full Git history",
  );
  return {
    head: () => revision(git(["rev-parse", "HEAD"]).trim()),
    parents: (pin) =>
      git(["rev-list", "--parents", "-n", "1", revision(pin)])
        .trim()
        .split(" ")
        .slice(1)
        .map(revision),
    count: (base, pin, firstParent) =>
      Number(
        git([
          "rev-list",
          ...(firstParent ? ["--first-parent"] : []),
          "--count",
          `${revision(base)}..${revision(pin)}`,
        ]).trim(),
      ),
    changes: (parent, pin) =>
      parseGitChanges(
        git([
          "diff",
          "--name-status",
          "-z",
          "--no-renames",
          "--no-ext-diff",
          "--no-textconv",
          revision(parent),
          revision(pin),
          "--",
        ]),
      ),
    blob: (pin, path) =>
      git(["show", `${revision(pin)}:${safePath(path)}`]).replaceAll(
        "\r\n",
        "\n",
      ),
    status: () => {
      const flags = git(["ls-files", "-v", "-z"]).split("\0").filter(Boolean);
      requireCondition(
        !flags.some((entry) => /^[a-zS]/u.test(entry)),
        "Suppressed Git index entries must be restored before release checking",
      );
      return git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    },
    ancestor: (ancestor, pin) =>
      git(["merge-base", revision(ancestor), revision(pin)]).trim() ===
      ancestor,
  };
}

function assertCount(
  git: ReleaseGitReader,
  descriptor: ReleaseDescriptor,
  pin: string,
  count: number,
): void {
  for (const firstParent of [false, true])
    same(
      git.count(descriptor.baselineRevision, pin, firstParent),
      count,
      "total/first-parent count",
    );
  requireCondition(
    git.ancestor(descriptor.baselineRevision, pin),
    "Counting baseline is not an ancestor",
  );
}

/** Validate declared history independently of the renderer and current working tree. */
export function inspectRelease(
  descriptor: ReleaseDescriptor,
  git: ReleaseGitReader,
): Map<string, string> {
  assertCount(
    git,
    descriptor,
    descriptor.predecessorRevision,
    descriptor.featureCount - 1,
  );
  assertCount(
    git,
    descriptor,
    descriptor.featureRevision,
    descriptor.featureCount,
  );
  same(
    git.parents(descriptor.featureRevision),
    [descriptor.predecessorRevision],
    "feature parent (merges are not allowed)",
  );
  same(
    git.changes(descriptor.predecessorRevision, descriptor.featureRevision),
    descriptor.featureChanges,
    "feature inventory",
  );
  const sources = new Map<string, string>();
  for (const path of RELEASE_CLASSIFICATION_ADAPTER_PATHS) {
    const source = git.blob(descriptor.predecessorRevision, path);
    same(
      git.blob(descriptor.featureRevision, path),
      source,
      `unchanged feature adapter ${path}`,
    );
    sources.set(path, source);
  }
  let child = descriptor;
  while (child.caseNumber > 14) {
    const parentPath = `${RELEASE_DIRECTORY}/cycle3ka${child.caseNumber - 1}.json`;
    const parent = parseReleaseDescriptor(
      git.blob(child.predecessorRevision, parentPath),
    );
    requireCondition(
      parent.caseNumber === child.caseNumber - 1,
      "Unexpected prior descriptor case",
    );
    assertClosure(parent, child.predecessorRevision, git);
    same(
      git.blob(child.featureRevision, parentPath),
      git.blob(child.predecessorRevision, parentPath),
      "unchanged prior descriptor",
    );
    assertCount(
      git,
      parent,
      parent.predecessorRevision,
      parent.featureCount - 1,
    );
    assertCount(git, parent, parent.featureRevision, parent.featureCount);
    same(
      git.parents(parent.featureRevision),
      [parent.predecessorRevision],
      "nested feature parent",
    );
    same(
      git.changes(parent.predecessorRevision, parent.featureRevision),
      parent.featureChanges,
      "nested feature inventory",
    );
    child = parent;
  }
  return sources;
}

export function assertClosure(
  descriptor: ReleaseDescriptor,
  closure: string,
  git: ReleaseGitReader,
): void {
  revision(closure);
  requireCondition(
    closure !== descriptor.featureRevision,
    "Closure must differ from feature",
  );
  same(
    git.parents(closure),
    [descriptor.featureRevision],
    "closure parent (merges are not allowed)",
  );
  assertCount(git, descriptor, closure, descriptor.closureCount);
  same(
    git.changes(descriptor.featureRevision, closure),
    descriptor.closureChanges,
    "closure inventory",
  );
}

export function assertWritePreflight(
  descriptor: ReleaseDescriptor,
  git: ReleaseGitReader,
): void {
  requireCondition(
    descriptor.caseNumber > 14,
    "The generator cannot write its own bootstrap migration; use the independently reviewed manual process",
  );
  requireCondition(
    !descriptor.featureChanges.some(({ path }) =>
      /^scripts\/release-classification/u.test(path),
    ),
    "Generator changes require independent manual release preparation",
  );
  same(git.head(), descriptor.featureRevision, "clean feature HEAD");
  requireCondition(
    git.status() === "",
    "Write requires an entirely clean committed feature",
  );
  inspectRelease(descriptor, git);
}

/** Bootstrap watches are checked here, but were installed by the manual migration. */
export async function generateReleaseOutputs(
  sources: ReadonlyMap<string, string>,
  descriptor: ReleaseDescriptor,
): Promise<Map<string, string>> {
  const existingBinding = new RegExp(
    `\\bconst\\s+${descriptor.presentation.testBinding}(?:Feature|Closure)\\b`,
    "u",
  );
  for (const [path, source] of sources)
    if (path.endsWith(".test.ts"))
      requireCondition(
        !existingBinding.test(source),
        "Test binding is already used by a prior release",
      );
  const generated = renderReleaseClassification(sources, descriptor);
  same(
    [...generated.keys()].sort(),
    [...RELEASE_CLASSIFICATION_ADAPTER_PATHS].sort(),
    "renderer output allowlist",
  );
  const result = new Map<string, string>();
  for (const [path, raw] of generated) {
    let source = raw;
    if (path.endsWith(".yml") && descriptor.caseNumber === 14) {
      const watch =
        "      - scripts/classify-filing-parser-cross-engine-source.sh";
      source = source.replaceAll(
        watch,
        `${watch}\n${GENERATOR_WATCHES.map((input) => `      - ${input}`).join("\n")}`,
      );
    }
    if (path.endsWith(".ts") || path.endsWith(".yml"))
      source = await format(source, { filepath: path, endOfLine: "lf" });
    requireCondition(
      Buffer.byteLength(source) < (path.endsWith(".yml") ? 500_000 : 2_000_000),
      `Generated file exceeds byte bound: ${path}`,
    );
    if (path.endsWith(".yml")) {
      const expected = path.includes("cross-engine") ? 1 : 2;
      for (const watch of [
        "scripts/classify-filing-parser-cross-engine-source.sh",
        ...GENERATOR_WATCHES,
      ])
        requireCondition(
          source.split(`      - ${watch}\n`).length - 1 === expected,
          `Unexpected workflow watch count: ${path} ${watch}`,
        );
    }
    result.set(path, source);
  }
  result.set(descriptor.descriptorPath, await descriptorText(descriptor));
  return result;
}

/** A path-only closure check cannot prove that inherited classifier logic survived. */
export async function verifyGeneratedHistory(
  descriptor: ReleaseDescriptor,
  git: ReleaseGitReader,
): Promise<void> {
  inspectRelease(descriptor, git);
  let child = descriptor;
  while (child.caseNumber > 14) {
    const parent = parseReleaseDescriptor(
      git.blob(
        child.predecessorRevision,
        `${RELEASE_DIRECTORY}/cycle3ka${child.caseNumber - 1}.json`,
      ),
    );
    const sources = new Map<string, string>();
    for (const path of RELEASE_CLASSIFICATION_ADAPTER_PATHS) {
      const before = git.blob(parent.predecessorRevision, path);
      same(
        git.blob(parent.featureRevision, path),
        before,
        `nested unchanged feature adapter ${path}`,
      );
      sources.set(path, before);
    }
    const expected = await generateReleaseOutputs(sources, parent);
    for (const [path, text] of expected)
      same(
        git.blob(child.predecessorRevision, path),
        text,
        `generated historical closure ${path}`,
      );
    child = parent;
  }
}

function outputPath(repository: string, path: string): string {
  const root = realpathSync(repository);
  const target = resolve(root, safePath(path));
  const local = relative(root, target);
  requireCondition(
    local !== "" &&
      !isAbsolute(local) &&
      local !== ".." &&
      !local.startsWith(`..${sep}`),
    "Output escapes repository",
  );
  let current = root;
  for (const part of local.split(sep)) {
    current = resolve(current, part);
    const info = lstatSync(current, { throwIfNoEntry: false });
    if (info !== undefined) {
      requireCondition(
        !info.isSymbolicLink() &&
          (info.isDirectory() || (info.isFile() && info.nlink === 1)),
        "Output path contains a link or special file",
      );
    }
  }
  return target;
}

export function staleOutputs(
  repository: string,
  outputs: ReadonlyMap<string, string>,
): string[] {
  return [...outputs]
    .filter(([path, text]) => {
      const target = outputPath(repository, path);
      return (
        !existsSync(target) ||
        readFileSync(target, "utf8").replaceAll("\r\n", "\n") !== text
      );
    })
    .map(([path]) => path);
}

/** All paths and originals are checked before the first write; IO failures restore originals. */
export async function writeReleaseOutputs(
  repository: string,
  descriptor: ReleaseDescriptor,
  outputs: ReadonlyMap<string, string>,
  git: ReleaseGitReader,
): Promise<void> {
  same(
    [...outputs.keys()].sort(),
    descriptor.closureChanges.map(({ path }) => path),
    "write output allowlist",
  );
  assertWritePreflight(descriptor, git);
  await verifyGeneratedHistory(descriptor, git);
  const expected = await generateReleaseOutputs(
    inspectRelease(descriptor, git),
    descriptor,
  );
  same([...outputs], [...expected], "generated write contents");
  assertWritePreflight(descriptor, git);
  const pending = [...outputs].map(([path, text]) => {
    const target = outputPath(repository, path);
    const original = existsSync(target) ? readFileSync(target) : undefined;
    requireCondition(
      path === descriptor.descriptorPath
        ? original === undefined
        : original !== undefined,
      "Unexpected output existence",
    );
    if (original !== undefined)
      same(
        original.toString("utf8").replaceAll("\r\n", "\n"),
        git.blob(descriptor.featureRevision, path),
        `unchanged working adapter ${path}`,
      );
    return { target, text, original };
  });
  const written: typeof pending = [];
  try {
    for (const item of pending) {
      mkdirSync(dirname(item.target), { recursive: true });
      const handle = openSync(
        item.target,
        item.original === undefined ? "wx" : "w",
      );
      written.push(item);
      try {
        writeFileSync(handle, item.text, "utf8");
      } finally {
        closeSync(handle);
      }
    }
  } catch (error) {
    for (const item of written.reverse()) {
      if (item.original === undefined) {
        if (existsSync(item.target)) unlinkSync(item.target);
      } else writeFileSync(item.target, item.original);
    }
    throw error;
  }
}

export async function runReleaseClassification(
  args: readonly string[],
  repository: string,
): Promise<string> {
  requireCondition(
    args.length === 0 ||
      ((args.length === 2 || args.length === 3) &&
        args[0] === "--descriptor" &&
        typeof args[1] === "string" &&
        (args.length === 2 || args[2] === "--write")),
    "Usage: release:classify [--descriptor <reviewed-external.json> [--write]]",
  );
  const git = createReleaseGitReader(repository);
  let text: string;
  let installedPath: string | undefined;
  if (args.length === 0) {
    const directory = outputPath(repository, RELEASE_DIRECTORY);
    const names = existsSync(directory) ? readdirSync(directory) : [];
    if (names.length === 0) {
      requireCondition(
        git.head() === BOOTSTRAP_PREDECESSOR ||
          JSON.stringify(git.parents(git.head())) ===
            JSON.stringify([BOOTSTRAP_PREDECESSOR]),
        "Missing installed release descriptor",
      );
      return "Release classification: manual bootstrap feature; no installed descriptor yet.";
    }
    requireCondition(
      names.every((name) =>
        /^cycle3ka(?:1[4-9]|[2-5][0-9]|6[0-4])\.json$/u.test(name),
      ),
      "Unexpected release registry entry",
    );
    names.sort(
      (left, right) =>
        Number(left.match(/\d+(?=\.json$)/u)?.[0]) -
        Number(right.match(/\d+(?=\.json$)/u)?.[0]),
    );
    same(
      names,
      Array.from(
        { length: names.length },
        (_, index) => `cycle3ka${14 + index}.json`,
      ),
      "contiguous descriptor registry",
    );
    installedPath = `${RELEASE_DIRECTORY}/${names.at(-1) ?? ""}`;
    const input = outputPath(repository, installedPath);
    requireCondition(
      lstatSync(input).size <= MAX_DESCRIPTOR_BYTES,
      "Descriptor exceeds size limit",
    );
    text = readFileSync(input, "utf8");
  } else {
    const input = realpathSync(resolve(args[1] ?? ""));
    if (args[2] === "--write") {
      const local = relative(realpathSync(repository), input);
      requireCondition(
        isAbsolute(local) || local === ".." || local.startsWith(`..${sep}`),
        "Write descriptor must be supplied outside the clean repository",
      );
    }
    requireCondition(
      lstatSync(input).size <= MAX_DESCRIPTOR_BYTES,
      "Descriptor exceeds size limit",
    );
    text = readFileSync(input, "utf8");
  }
  const descriptor = parseReleaseDescriptor(text, installedPath);
  const sources = inspectRelease(descriptor, git);
  await verifyGeneratedHistory(descriptor, git);
  if (args.length === 0)
    for (
      let caseNumber = 14;
      caseNumber < descriptor.caseNumber;
      caseNumber++
    ) {
      const path = `${RELEASE_DIRECTORY}/cycle3ka${caseNumber}.json`;
      same(
        readFileSync(outputPath(repository, path), "utf8").replaceAll(
          "\r\n",
          "\n",
        ),
        git.blob(descriptor.featureRevision, path),
        `installed historical descriptor ${path}`,
      );
    }
  const outputs = await generateReleaseOutputs(sources, descriptor);
  if (args[2] === "--write") {
    await writeReleaseOutputs(repository, descriptor, outputs, git);
    return `Prepared cycle3ka${descriptor.caseNumber}: ${descriptor.featureChanges.length} declared feature changes; exactly ${outputs.size} closure outputs. Review git diff before committing.`;
  }
  const stale = staleOutputs(repository, outputs);
  requireCondition(
    stale.length === 0,
    `Stale release classification (check wrote nothing):\n${stale.join("\n")}`,
  );
  if (
    git.head() !== descriptor.featureRevision &&
    git.parents(git.head()).includes(descriptor.featureRevision)
  )
    assertClosure(descriptor, git.head(), git);
  requireCondition(
    git.ancestor(descriptor.featureRevision, git.head()),
    "Installed feature is not an ancestor of HEAD",
  );
  return `Release classification cycle3ka${descriptor.caseNumber}: all ${outputs.size} declared outputs match; check wrote nothing.`;
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runReleaseClassification(
    process.argv.slice(2),
    resolve(import.meta.dirname, ".."),
  )
    .then(console.log)
    .catch((error: unknown) => {
      console.error(
        error instanceof Error
          ? error.message
          : "Release classification failed",
      );
      process.exitCode = 1;
    });
}
