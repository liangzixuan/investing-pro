/** Pure, append-only preparation of the existing release-classification adapters. */
export interface ReleaseClassificationChange {
  readonly path: string;
  readonly status: "A" | "M";
}

export interface ReleaseClassificationRenderDescriptor {
  readonly version: 1;
  readonly caseNumber: number;
  readonly baselineRevision: string;
  readonly predecessorRevision: string;
  readonly featureRevision: string;
  readonly featureCount: number;
  readonly closureCount: number;
  readonly featureChanges: readonly ReleaseClassificationChange[];
  readonly closureChanges: readonly ReleaseClassificationChange[];
  readonly presentation: {
    readonly featureDescription: string;
    readonly closureDescription: string;
    readonly inventoryDescription: string;
    readonly testBinding: string;
    readonly routingDescription: string;
    readonly summaryDescription: string;
  };
}

export const RELEASE_CLASSIFICATION_ADAPTER_PATHS = [
  ".github/workflows/filing-parser-acceptance.yml",
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  ".github/workflows/filing-payload-custody-acceptance.yml",
  "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  "scripts/classify-filing-parser-cross-engine-source.sh",
] as const;

const CROSS_WORKFLOW = RELEASE_CLASSIFICATION_ADAPTER_PATHS[1];
const CROSS_SCRIPT = RELEASE_CLASSIFICATION_ADAPTER_PATHS[7];
const CROSS_CALLER = `        run: bash --noprofile --norc -e -o pipefail ${CROSS_SCRIPT}`;

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function once(source: string, before: string, after: string): string {
  if (before.length === 0 || source.split(before).length !== 2)
    throw new Error(
      `Expected one release-classification anchor: ${before.slice(0, 100)}`,
    );
  return source.replace(before, () => after);
}

function block(source: string, pattern: RegExp): string {
  const matches = [
    ...source.matchAll(
      new RegExp(pattern.source, pattern.flags.includes("m") ? "gmu" : "gu"),
    ),
  ];
  if (matches.length !== 1 || matches[0] === undefined)
    throw new Error(
      `Expected one release-classification block: ${pattern.source}`,
    );
  return matches[0][0];
}

/** Simultaneous replacement prevents a previous identifier being advanced twice. */
function mapped(
  source: string,
  values: Readonly<Record<string, string>>,
): string {
  const keys = Object.keys(values).sort(
    (left, right) => right.length - left.length,
  );
  const pattern = new RegExp(keys.map(escapePattern).join("|"), "gu");
  return source.replace(pattern, (value) => values[value] ?? value);
}

function arrayBlock(source: string, name: string): string {
  return block(
    source,
    new RegExp(
      `const ${name} = (?:Object\\.freeze\\()?\\[[\\s\\S]*?\\n\\](?:\\))?;`,
      "u",
    ),
  );
}

function functionBlock(source: string, name: string): string {
  return block(
    source,
    new RegExp(`export function ${name}\\([\\s\\S]*?\\n\\}`, "u"),
  );
}

function tsInventory(
  name: string,
  entries: readonly ReleaseClassificationChange[],
  frozen: boolean,
): string {
  return `const ${name} = ${frozen ? "Object.freeze(" : ""}[\n${entries.map((entry) => `  { path: ${JSON.stringify(entry.path)}, status: ${JSON.stringify(entry.status)} },`).join("\n")}\n]${frozen ? ")" : ""};`;
}

function bashQuoted(value: string): string {
  return `"${value.replace(/[\\"$`]/gu, (character) => `\\${character}`)}"`;
}

function bashInventory(
  name: string,
  entries: readonly ReleaseClassificationChange[],
): string {
  return `          ${name}=(\n${entries.map((entry) => `            ${bashQuoted(entry.status)} ${bashQuoted(entry.path)}`).join("\n")}\n          )`;
}

function advance(
  source: string,
  descriptor: ReleaseClassificationRenderDescriptor,
): string {
  const { caseNumber: current, featureCount } = descriptor;
  const previous = current - 1;
  return mapped(source, {
    [`CYCLE_3K_A${previous - 1}_ROUTING_CLOSURE_REVISION`]: `CYCLE_3K_A${previous}_ROUTING_CLOSURE_REVISION`,
    [`CYCLE_3K_A${previous - 1}_FEATURE_REVISION`]: `CYCLE_3K_A${previous}_FEATURE_REVISION`,
    [`CYCLE_3K_A${previous}_FEATURE_REVISION`]: `CYCLE_3K_A${current}_FEATURE_REVISION`,
    [`isCycle3ka${previous - 1}RoutingClosure`]: `isCycle3ka${previous}RoutingClosure`,
    [`isCycle3ka${previous}`]: `isCycle3ka${current}`,
    [`"${featureCount - 3}"`]: `"${featureCount - 1}"`,
    [`"${featureCount - 2}"`]: `"${featureCount}"`,
    [`"${featureCount - 1}"`]: `"${descriptor.closureCount}"`,
    [`"${featureCount}"`]: `"${descriptor.closureCount + 1}"`,
  });
}

function advanceCase(
  source: string,
  previous: number,
  current: number,
): string {
  return mapped(source, {
    [`3ka${previous}`]: `3ka${current}`,
    [`3K_A${previous}`]: `3K_A${current}`,
  });
}

function appendTopologyTests(
  source: string,
  descriptor: ReleaseClassificationRenderDescriptor,
): string {
  const previous = descriptor.caseNumber - 1;
  const pinned = block(
    source,
    new RegExp(
      `    const [A-Za-z][A-Za-z0-9]* = \\[\\n      "${descriptor.featureCount - 3}",\\n      "${descriptor.featureCount - 3}",\\n      CYCLE_3K_A${previous - 1}_ROUTING_CLOSURE_REVISION,[\\s\\S]*?\\n    \\] as const;`,
      "u",
    ),
  );
  const start = source.indexOf(pinned);
  const end = source.indexOf("\n  });", start);
  if (end < 0) throw new Error("Missing bounded release topology test");
  let tests = source.slice(start, end);
  const pinnedName = /^ {4}const ([A-Za-z][A-Za-z0-9]*) =/u.exec(pinned)?.[1];
  const priorFeatureName =
    /\n {6}([A-Za-z][A-Za-z0-9]*Feature),\n {4}\] as const;$/u.exec(
      pinned,
    )?.[1];
  const featureTuple = block(
    tests,
    new RegExp(
      `    const [A-Za-z][A-Za-z0-9]*Feature = \\[\\n      "${descriptor.featureCount - 2}",\\n      "${descriptor.featureCount - 2}",\\n      CYCLE_3K_A${previous}_FEATURE_REVISION,[\\s\\S]*?\\n    \\] as const;`,
      "u",
    ),
  );
  const featureName = /^ {4}const ([A-Za-z][A-Za-z0-9]*) =/u.exec(
    featureTuple,
  )?.[1];
  if (
    pinnedName === undefined ||
    priorFeatureName === undefined ||
    featureName === undefined
  )
    throw new Error("Missing predecessor release test bindings");
  const prefix = featureName.slice(0, -"Feature".length);
  const capitalize = (value: string) =>
    value.charAt(0).toUpperCase() + value.slice(1);
  const nextPinnedName = `pinned${capitalize(prefix)}Closure`;
  const nextFeatureName = `${descriptor.presentation.testBinding}Feature`;
  tests = mapped(tests, {
    [pinnedName]: nextPinnedName,
    [priorFeatureName]: featureName,
    [featureName]: nextFeatureName,
    [`tampered${capitalize(pinnedName)}`]: `tampered${capitalize(nextPinnedName)}`,
    [`tampered${capitalize(priorFeatureName)}`]: `tampered${capitalize(featureName)}`,
    [`tampered${capitalize(featureName)}`]: `tampered${capitalize(nextFeatureName)}`,
    [`${prefix}Closure`]: `${descriptor.presentation.testBinding}Closure`,
  });
  return (
    source.slice(0, end) +
    "\n\n" +
    advance(tests, descriptor) +
    source.slice(end)
  );
}

function inventoryTest(
  descriptor: ReleaseClassificationRenderDescriptor,
  kind: "Feature" | "RoutingClosure",
): string {
  const name = `CYCLE_3K_A${descriptor.caseNumber}_${kind === "Feature" ? "FEATURE" : "ROUTING_CLOSURE"}_TRANSITION`;
  const classifier = `isCycle3ka${descriptor.caseNumber}${kind}CommitDiffSetAllowed`;
  const entries =
    kind === "Feature" ? descriptor.featureChanges : descriptor.closureChanges;
  if (entries.length !== 1)
    return `    expectExactTransition(\n      ${classifier},\n      ${name},\n      ${entries.length},\n    );`;
  const entry = entries[0];
  if (entry === undefined) throw new Error("Missing single release path");
  return `    expect(${name}).toHaveLength(1);\n    expect(${classifier}(${name})).toBe(true);\n    for (const entries of [\n      [],\n      [{ path: ${JSON.stringify(entry.path)}, status: ${JSON.stringify(entry.status === "M" ? "A" : "M")} }],\n      [{ path: ${JSON.stringify(entry.path)}, status: "D" }],\n      [{ path: "unreviewed", status: ${JSON.stringify(entry.status)} }],\n      [...${name}, ...${name}],\n      [...${name}, { path: "unreviewed", status: "M" }],\n    ]) {\n      expect(${classifier}(entries)).toBe(false);\n    }`;
}

function renderTs(
  source: string,
  path: string,
  descriptor: ReleaseClassificationRenderDescriptor,
): string {
  const current = descriptor.caseNumber;
  const previous = current - 1;
  const isTest = path.endsWith(".test.ts");
  const constant = block(
    source,
    new RegExp(
      `const CYCLE_3K_A${previous}_FEATURE_REVISION =\\n  "[0-9a-f]{40}" as const;`,
      "u",
    ),
  );
  source = once(
    source,
    constant,
    `${constant}\nconst CYCLE_3K_A${previous}_ROUTING_CLOSURE_REVISION =\n  "${descriptor.predecessorRevision}" as const;\nconst CYCLE_3K_A${current}_FEATURE_REVISION =\n  "${descriptor.featureRevision}" as const;`,
  );
  const inventory = arrayBlock(
    source,
    `CYCLE_3K_A${previous}_ROUTING_CLOSURE_TRANSITION`,
  );
  source = once(
    source,
    inventory,
    `${inventory}\n${tsInventory(`CYCLE_3K_A${current}_FEATURE_TRANSITION`, descriptor.featureChanges, !isTest)}\n${tsInventory(`CYCLE_3K_A${current}_ROUTING_CLOSURE_TRANSITION`, descriptor.closureChanges, !isTest)}`,
  );
  const protectedPattern = new RegExp(
    `^([ \\t]*)\\.\\.\\.CYCLE_3K_A${previous}_ROUTING_CLOSURE_TRANSITION\\.map\\(\\(entry\\) => entry\\.path\\),$`,
    "gmu",
  );
  const protectedMatches = [...source.matchAll(protectedPattern)];
  const expectedProtectedCount =
    isTest && path.includes("filing-payload-custody") ? 2 : 1;
  if (protectedMatches.length !== expectedProtectedCount)
    throw new Error(`Changed protected-path anchors: ${path}`);
  source = source.replace(
    protectedPattern,
    (entry, indentation: string) =>
      `${entry}\n${indentation}...CYCLE_3K_A${current}_FEATURE_TRANSITION.map((entry) => entry.path),\n${indentation}...CYCLE_3K_A${current}_ROUTING_CLOSURE_TRANSITION.map((entry) => entry.path),`,
  );
  if (isTest) {
    const importAnchor = `  isCycle3ka${previous}RoutingClosureTopologyAllowed,`;
    source = once(
      source,
      importAnchor,
      `${importAnchor}\n  isCycle3ka${current}FeatureCommitDiffSetAllowed,\n  isCycle3ka${current}FeatureTopologyAllowed,\n  isCycle3ka${current}RoutingClosureCommitDiffSetAllowed,\n  isCycle3ka${current}RoutingClosureTopologyAllowed,`,
    );
    source = appendTopologyTests(source, descriptor);
    const transition = block(
      source,
      new RegExp(
        `    expectExactTransition\\(\\n      isCycle3ka${previous}RoutingClosureCommitDiffSetAllowed,\\n      CYCLE_3K_A${previous}_ROUTING_CLOSURE_TRANSITION,\\n      [0-9]+,\\n    \\);`,
        "u",
      ),
    );
    return once(
      source,
      transition,
      `${transition}\n${inventoryTest(descriptor, "Feature")}\n${inventoryTest(descriptor, "RoutingClosure")}`,
    );
  }
  const featureFunction = functionBlock(
    source,
    `isCycle3ka${previous}FeatureTopologyAllowed`,
  );
  source = once(
    source,
    featureFunction,
    `${featureFunction}\n\n/** @internal Exact merge-free ${descriptor.presentation.featureDescription} lineage. */\n${advance(featureFunction, descriptor)}`,
  );
  const closureFunction = functionBlock(
    source,
    `isCycle3ka${previous}RoutingClosureTopologyAllowed`,
  );
  source = once(
    source,
    closureFunction,
    `${closureFunction}\n\n/** @internal One exact non-evidence ${descriptor.presentation.closureDescription} routing-closure child. */\n${advanceCase(closureFunction, previous, current).replaceAll(`"${descriptor.featureCount - 1}"`, `"${descriptor.closureCount}"`)}`,
  );
  for (const kind of ["Feature", "RoutingClosure"] as const) {
    const previousFunction = functionBlock(
      source,
      `isCycle3ka${previous}${kind}CommitDiffSetAllowed`,
    );
    source = once(
      source,
      previousFunction,
      `${previousFunction}\n\n/** @internal Exact ${descriptor.presentation.inventoryDescription} ${kind === "Feature" ? "feature" : "routing-closure"} inventory. */\n${advanceCase(previousFunction, previous, current)}`,
    );
  }
  const parentRead = block(
    source,
    new RegExp(
      `  const cycle3ka${previous}FeatureParentLine = [\\s\\S]*?\\n  \\)(?:\\.join\\(" "\\))?;`,
      "u",
    ),
  );
  const pinnedParentRead = mapped(parentRead, {
    [`cycle3ka${previous}Feature`]: `cycle3ka${previous}RoutingClosure`,
    [`CYCLE_3K_A${previous}_FEATURE`]: `CYCLE_3K_A${previous}_ROUTING_CLOSURE`,
  });
  source = once(
    source,
    parentRead,
    `${parentRead}\n${pinnedParentRead}\n${advanceCase(parentRead, previous, current)}`,
  );
  const tuple = block(
    source,
    new RegExp(
      `  const pinnedCycle3ka${previous}FeatureTopology = \\[[\\s\\S]*?\\n  \\] as const;`,
      "u",
    ),
  );
  source = once(
    source,
    tuple,
    `${tuple}\n  const pinnedCycle3ka${previous}RoutingClosureTopology = [\n    "${descriptor.featureCount - 1}",\n    "${descriptor.featureCount - 1}",\n    CYCLE_3K_A${previous}_ROUTING_CLOSURE_REVISION,\n    cycle3ka${previous}RoutingClosureParentLine,\n    pinnedCycle3ka${previous}FeatureTopology,\n  ] as const;\n  const pinnedCycle3ka${current}FeatureTopology = [\n    "${descriptor.featureCount}",\n    "${descriptor.featureCount}",\n    CYCLE_3K_A${current}_FEATURE_REVISION,\n    cycle3ka${current}FeatureParentLine,\n    pinnedCycle3ka${previous}RoutingClosureTopology,\n  ] as const;`,
  );
  const routing = block(
    source,
    new RegExp(
      `  const cycle3ka${previous}Feature = [\\s\\S]*?\\n  const cycle3ka${previous}Routing = cycle3ka${previous}Feature \\|\\| cycle3ka${previous}RoutingClosure;`,
      "u",
    ),
  );
  const nextRouting = mapped(routing, {
    [`cycle3ka${previous}`]: `cycle3ka${current}`,
    [`isCycle3ka${previous}`]: `isCycle3ka${current}`,
    [`pinnedCycle3ka${previous - 1}`]: `pinnedCycle3ka${previous}`,
    [`pinnedCycle3ka${previous}Feature`]: `pinnedCycle3ka${current}Feature`,
  });
  source = once(
    source,
    routing,
    `${routing.slice(0, routing.indexOf(`  const cycle3ka${previous}Routing =`))}${nextRouting}\n  const cycle3ka${previous}Routing = cycle3ka${previous}Feature || cycle3ka${previous}RoutingClosure || cycle3ka${current}Routing;`,
  );
  const closureDiff = block(
    source,
    new RegExp(
      `  if \\(cycle3ka${previous}RoutingClosure\\) \\{[\\s\\S]*?\\n  \\}`,
      "u",
    ),
  );
  const extendedClosureDiff = once(
    once(
      closureDiff,
      `if (cycle3ka${previous}RoutingClosure)`,
      `if (cycle3ka${previous}RoutingClosure || cycle3ka${current}Routing)`,
    ),
    "      revision,",
    `      cycle3ka${previous}RoutingClosure ? revision : CYCLE_3K_A${previous}_ROUTING_CLOSURE_REVISION,`,
  );
  const featureDiff = block(
    source,
    new RegExp(
      `  if \\(cycle3ka${previous}Routing\\) \\{[\\s\\S]*?\\n  \\}`,
      "u",
    ),
  );
  const nextFeatureDiff = mapped(featureDiff, {
    [`cycle3ka${previous}`]: `cycle3ka${current}`,
    [`isCycle3ka${previous}`]: `isCycle3ka${current}`,
    [`CYCLE_3K_A${previous - 1}_ROUTING_CLOSURE`]: `CYCLE_3K_A${previous}_ROUTING_CLOSURE`,
    [`CYCLE_3K_A${previous}_FEATURE`]: `CYCLE_3K_A${current}_FEATURE`,
  });
  return once(
    source,
    closureDiff,
    `${extendedClosureDiff}\n${nextFeatureDiff}\n${advanceCase(closureDiff, previous, current)}`,
  );
}

function renderClosureWorkflow(
  source: string,
  descriptor: ReleaseClassificationRenderDescriptor,
): string {
  const previous = descriptor.caseNumber - 1;
  const current = descriptor.caseNumber;
  const route = block(
    source,
    new RegExp(
      `      - name: Classify exact partial Cycle 3k-a${previous} non-evidence routing closure[\\s\\S]*?          echo "exact=\\$exact" >> "\\$GITHUB_OUTPUT"`,
      "u",
    ),
  );
  let next = mapped(route, {
    [`3k-a${previous}`]: `3k-a${current}`,
    [`3ka${previous}`]: `3ka${current}`,
    [`== "${descriptor.featureCount - 2}"`]: `== "${descriptor.featureCount}"`,
    [`== "${descriptor.featureCount - 1}"`]: `== "${descriptor.closureCount}"`,
  });
  for (const [name, revision] of [
    ["cycle2z_baseline", descriptor.baselineRevision],
    ["prior_closure", descriptor.predecessorRevision],
    ["feature", descriptor.featureRevision],
  ]) {
    const pin = block(
      next,
      new RegExp(`          ${name}="[0-9a-f]{40}"`, "u"),
    );
    next = once(next, pin, `          ${name}="${revision}"`);
  }
  next = once(
    next,
    block(next, / {10}expected_feature=\([\s\S]*?\n {10}\)/u),
    bashInventory("expected_feature", descriptor.featureChanges),
  );
  next = once(
    next,
    block(next, / {10}expected=\([\s\S]*?\n {10}\)/u),
    bashInventory("expected", descriptor.closureChanges),
  );
  source = once(source, route, `${route}\n\n${next}`);
  const guard = `steps.cycle3ka${previous}_route.outputs.exact != 'true'`;
  if (!source.includes(guard))
    throw new Error("Missing existing evidence route guards");
  return source.replaceAll(
    guard,
    `${guard} && steps.cycle3ka${current}_route.outputs.exact != 'true'`,
  );
}

function virtualWorkflow(workflow: string, script: string): string {
  const step = `        id: cycle3e_source\n        if: \${{ success() }}\n        shell: bash\n${CROSS_CALLER}`;
  // Keep workflow expressions literal; only this exact caller is reconstructed.
  if (!workflow.includes(step))
    throw new Error("Changed cross-engine caller or guard");
  if (!script.endsWith("\n"))
    throw new Error("Cross-engine script must end in LF");
  const indented = script
    .slice(0, -1)
    .split("\n")
    .map((line) => `          ${line}`)
    .join("\n");
  return once(workflow, CROSS_CALLER, `        run: |\n${indented}`);
}

function renderCrossEngine(
  source: string,
  descriptor: ReleaseClassificationRenderDescriptor,
): string {
  const current = descriptor.caseNumber;
  const previous = current - 1;
  // Preserve historical bytes; a78 first admits literal Next dynamic segments.
  const protectedDiff =
    '            git diff --name-only --no-renames -z "$public_promotion" HEAD -- "${protected[@]}"\n';
  const literalProtectedDiff = protectedDiff.replace(
    "git diff",
    "git --literal-pathspecs diff",
  );
  if (current === 78)
    source = once(source, protectedDiff, literalProtectedDiff);
  if (
    current >= 78 &&
    (source.split(literalProtectedDiff).length !== 2 ||
      source.split(literalProtectedDiff.trim()).length !== 2 ||
      source.includes(protectedDiff.trim()))
  )
    throw new Error("Changed literal protected-inventory command");
  const next = (value: string) =>
    mapped(value, {
      [`cycle3ka${previous - 1}`]: `cycle3ka${previous}`,
      [`cycle3ka${previous}`]: `cycle3ka${current}`,
      [`"${descriptor.featureCount - 3}"`]: `"${descriptor.featureCount - 1}"`,
      [`"${descriptor.featureCount - 2}"`]: `"${descriptor.featureCount}"`,
      [`"${descriptor.featureCount - 1}"`]: `"${descriptor.closureCount}"`,
    });
  source = once(
    source,
    `Classify exact Cycle 3e-a chain through partial Cycle 3k-a${previous}`,
    `Classify exact Cycle 3e-a chain through partial Cycle 3k-a${current}`,
  );
  const anchor = block(
    source,
    new RegExp(`          cycle3ka${previous}_feature="[0-9a-f]{40}"`, "u"),
  );
  source = once(
    source,
    anchor,
    `${anchor}\n          cycle3ka${previous}_routing_closure="${descriptor.predecessorRevision}"\n          cycle3ka${current}_feature="${descriptor.featureRevision}"`,
  );
  const inventory = block(
    source,
    new RegExp(
      `          expected_cycle3ka${previous}_routing_closure=\\([\\s\\S]*?\\n          \\)`,
      "u",
    ),
  );
  source = once(
    source,
    inventory,
    `${inventory}\n${bashInventory(`expected_cycle3ka${current}_feature`, descriptor.featureChanges)}\n${bashInventory(`expected_cycle3ka${current}_routing_closure`, descriptor.closureChanges)}`,
  );
  const protect = block(
    source,
    new RegExp(
      `          for \\(\\(index = 1; index < \\$\\{#expected_cycle3ka${previous}_feature\\[@\\]\\};[\\s\\S]*?expected_cycle3ka${previous}_routing_closure\\[\\$index\\][\\s\\S]*?\\n          done`,
      "u",
    ),
  );
  source = once(
    source,
    protect,
    `${protect}\n${protect.replaceAll(`cycle3ka${previous}`, `cycle3ka${current}`)}`,
  );
  const exists = `                 git cat-file -e "$cycle3ka${previous}_feature^{commit}"; then`;
  source = once(
    source,
    exists,
    `                 git cat-file -e "$cycle3ka${previous}_feature^{commit}" && \\\n                 git cat-file -e "$cycle3ka${previous}_routing_closure^{commit}" && \\\n                 git cat-file -e "$cycle3ka${current}_feature^{commit}"; then`,
  );
  const parentRead = block(
    source,
    new RegExp(
      `                read -r -a cycle3ka${previous}_feature_topology[^\\n]*`,
      "u",
    ),
  );
  source = once(
    source,
    parentRead,
    `${parentRead}\n${parentRead.replaceAll(`cycle3ka${previous}_feature`, `cycle3ka${previous}_routing_closure`)}\n${parentRead.replaceAll(`cycle3ka${previous}`, `cycle3ka${current}`)}`,
  );
  const counts = block(
    source,
    new RegExp(
      `                cycle3ka${previous}_feature_successor_count[^\\n]*\\n                cycle3ka${previous}_feature_first_parent_count[^\\n]*`,
      "u",
    ),
  );
  source = once(
    source,
    counts,
    `${counts}\n${counts.replaceAll(`cycle3ka${previous}_feature`, `cycle3ka${previous}_routing_closure`)}\n${counts.replaceAll(`cycle3ka${previous}`, `cycle3ka${current}`)}`,
  );
  const diff = block(
    source,
    new RegExp(
      `                mapfile -d '' -t cycle3ka${previous}_routing_closure_actual < <\\([\\s\\S]*?\\n                \\)`,
      "u",
    ),
  );
  const featureDiff = block(
    source,
    new RegExp(
      `                mapfile -d '' -t cycle3ka${previous}_feature_actual < <\\([\\s\\S]*?\\n                \\)`,
      "u",
    ),
  );
  source = once(
    source,
    diff,
    `${diff}\n${diff.replace(`cycle3ka${previous}_routing_closure_actual`, `pinned_cycle3ka${previous}_routing_closure_actual`).replace(" HEAD --", ` "$cycle3ka${previous}_routing_closure" --`)}\n${next(featureDiff)}\n${diff.replaceAll(`cycle3ka${previous}`, `cycle3ka${current}`)}`,
  );
  const featureHistory = block(
    source,
    new RegExp(
      `                cycle3ka${previous}_feature_history_exact=false[\\s\\S]*?\\n                fi`,
      "u",
    ),
  );
  const closureHistory = block(
    source,
    new RegExp(
      `                cycle3ka${previous - 1}_routing_closure_history_exact=false[\\s\\S]*?\\n                fi`,
      "u",
    ),
  );
  source = once(
    source,
    featureHistory,
    `${featureHistory}\n${next(closureHistory)}\n${next(featureHistory)}`,
  );
  const branches = block(
    source,
    new RegExp(
      `                elif \\[\\[ "\\$cycle3ka${previous - 1}_routing_closure_history_exact" == "true" \\]\\] && \\\\\\n[\\s\\S]*?matches_exactly expected_cycle3ka${previous}_routing_closure cycle3ka${previous}_routing_closure_actual; then\\n                   exact=true`,
      "u",
    ),
  );
  source = once(source, branches, `${branches}\n${next(branches)}`);
  const routingDescription = block(
    source,
    new RegExp(
      `or (?:bounded|partial) Cycle 3k-a${previous} [^;\\n]+ and routing closure;`,
      "u",
    ),
  );
  source = once(
    source,
    routingDescription,
    `${routingDescription.slice(3, -1)}, or partial Cycle 3k-a${current} ${descriptor.presentation.routingDescription} and routing closure;`,
  );
  const summary = block(
    source,
    new RegExp(
      `and (?:bounded|partial) Cycle 3k-a${previous} [^"\\n]+?\\.(?= No third-party page is crawled\\.)`,
      "u",
    ),
  );
  return once(
    source,
    summary,
    `${summary.slice(4, -1)}, and partial Cycle 3k-a${current} ${descriptor.presentation.summaryDescription}.`,
  );
}

/** Returns only the eight adapters. The caller validates descriptors and owns I/O. */
export function renderReleaseClassification(
  sources: ReadonlyMap<string, string>,
  descriptor: ReleaseClassificationRenderDescriptor,
): Map<string, string> {
  if (sources.size !== RELEASE_CLASSIFICATION_ADAPTER_PATHS.length)
    throw new Error("Expected exactly eight predecessor adapters");
  for (const path of RELEASE_CLASSIFICATION_ADAPTER_PATHS) {
    const source = sources.get(path);
    if (source === undefined || source.includes("\r"))
      throw new Error(`Expected LF predecessor adapter: ${path}`);
  }
  if (
    descriptor.version !== 1 ||
    !Number.isSafeInteger(descriptor.caseNumber) ||
    descriptor.caseNumber < 10 ||
    descriptor.closureCount !== descriptor.featureCount + 1
  )
    throw new Error("Unsupported sequential release-classification descriptor");
  const outputs = new Map<string, string>();
  for (const path of RELEASE_CLASSIFICATION_ADAPTER_PATHS) {
    const source = sources.get(path);
    if (source === undefined) throw new Error(`Missing adapter: ${path}`);
    if (path.endsWith(".ts"))
      outputs.set(path, renderTs(source, path, descriptor));
    else if (path !== CROSS_WORKFLOW && path !== CROSS_SCRIPT)
      outputs.set(path, renderClosureWorkflow(source, descriptor));
  }
  const crossWorkflow = sources.get(CROSS_WORKFLOW);
  const crossScript = sources.get(CROSS_SCRIPT);
  if (crossWorkflow === undefined || crossScript === undefined)
    throw new Error("Missing cross-engine adapter pair");
  const virtual = renderCrossEngine(
    virtualWorkflow(crossWorkflow, crossScript),
    descriptor,
  );
  const start = virtual.indexOf(
    "      - name: Classify exact Cycle 3e-a chain",
  );
  const end = virtual.indexOf("\n      - name:", start + 1);
  const step = virtual.slice(start, end);
  const marker = "\n        run: |\n";
  const parts = step.split(marker);
  if (
    start < 0 ||
    end < 0 ||
    parts.length !== 2 ||
    parts[1] === undefined ||
    parts[1].includes("${{")
  )
    throw new Error("Missing bounded pure Bash classifier body");
  const raw = parts[1];
  const body =
    raw
      .split("\n")
      .map((line) => {
        if (!line.startsWith("          "))
          throw new Error("Changed classifier indentation");
        return line.slice(10);
      })
      .join("\n") + "\n";
  outputs.set(CROSS_SCRIPT, body);
  outputs.set(
    CROSS_WORKFLOW,
    once(virtual, `        run: |\n${raw}`, CROSS_CALLER),
  );
  return new Map(
    RELEASE_CLASSIFICATION_ADAPTER_PATHS.map((path) => {
      const output = outputs.get(path);
      if (output === undefined)
        throw new Error(`Missing rendered adapter: ${path}`);
      return [path, output];
    }),
  );
}
