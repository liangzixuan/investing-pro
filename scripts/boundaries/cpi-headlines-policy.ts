import ts from "typescript";

const compact = (text: string) =>
  text.replace(/\s+/gu, "").replace(/,(?=[\]})])/gu, "");
const message =
  "CPI headlines must retain one fixed credential-free metadata request and isolated XML parsing";

function source(text: string) {
  return ts.createSourceFile(
    "cpi.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}
function imports(file: ts.SourceFile) {
  const values = new Set<string>();
  for (const node of file.statements) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      values.add(node.moduleSpecifier.text);
  }
  return [...values].sort();
}
function collect<T extends ts.Node>(
  file: ts.SourceFile,
  predicate: (node: ts.Node) => node is T,
): T[] {
  const result: T[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) result.push(node);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return result;
}
function requestOptions(node: ts.Node | undefined, file: ts.SourceFile) {
  if (!node || !ts.isObjectLiteralExpression(node)) return false;
  const expected = new Map([
    ["method", '"GET"'],
    ["credentials", '"omit"'],
    ["redirect", '"error"'],
    ["referrerPolicy", '"no-referrer"'],
    ["cache", '"no-store"'],
    ["signal", "signal"],
    [
      "headers",
      '{Accept:"application/atom+xml,application/rss+xml;q=0.9,application/xml;q=0.8"}',
    ],
  ]);
  if (node.properties.length !== expected.size) return false;
  for (const property of node.properties) {
    if (
      ts.isShorthandPropertyAssignment(property) &&
      property.name.text === "signal" &&
      expected.has("signal")
    ) {
      expected.delete("signal");
      continue;
    }
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name))
      return false;
    if (
      expected.get(property.name.text) !==
      compact(property.initializer.getText(file))
    )
      return false;
    expected.delete(property.name.text);
  }
  return expected.size === 0;
}
function transport(file: ts.SourceFile) {
  const calls = collect(file, ts.isCallExpression);
  const reads = calls.filter(
    (node) =>
      ts.isIdentifier(node.expression) && node.expression.text === "fetch",
  );
  const read = reads[0];
  if (reads.length !== 1 || !read || read.arguments.length !== 2) return false;
  if (
    read.arguments[0]?.getText(file) !== "SOURCE_URL" ||
    !requestOptions(read.arguments[1], file)
  )
    return false;
  const helper = collect(file, ts.isFunctionDeclaration).filter(
    (node) => node.name?.text === "fetchFeed",
  );
  if (
    helper.length !== 1 ||
    helper[0]?.parameters.map((node) => node.name.getText(file)).join(",") !==
      "fetch,signal"
  )
    return false;
  let owner: ts.Node | undefined = read.parent;
  while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
  if (owner !== helper[0]) return false;
  const delegation = calls.filter(
    (node) =>
      ts.isIdentifier(node.expression) && node.expression.text === "fetchFeed",
  );
  if (
    delegation.length !== 1 ||
    compact(delegation[0]!.getText(file)) !==
      "fetchFeed(this.#fetch,controller.signal)"
  )
    return false;
  const globals = collect(file, ts.isPropertyAccessExpression).filter(
    (node) => node.getText(file) === "globalThis.fetch",
  );
  if (globals.length !== 1) return false;
  return !calls.some(
    (node) =>
      (ts.isIdentifier(node.expression) &&
        ["require", "eval", "Function"].includes(node.expression.text)) ||
      node.expression.kind === ts.SyntaxKind.ImportKeyword,
  );
}
function parserBoundary(file: ts.SourceFile) {
  const forbidden = new Set([
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "process",
    "console",
    "setInterval",
    "require",
    "eval",
    "Function",
  ]);
  return (
    !collect(file, ts.isIdentifier).some((node) => forbidden.has(node.text)) &&
    !collect(file, ts.isCallExpression).some(
      (node) => node.expression.kind === ts.SyntaxKind.ImportKeyword,
    )
  );
}
function providerStateBoundary(file: ts.SourceFile) {
  const forbidden = new Set([
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "process",
    "console",
    "setInterval",
  ]);
  return !collect(file, ts.isIdentifier).some((node) =>
    forbidden.has(node.text),
  );
}

export function cpiHeadlinesSourceViolation(
  provider: string,
  parser: string,
): string | null {
  const providerFile = source(provider),
    parserFile = source(parser);
  if (
    JSON.stringify(imports(providerFile)) !==
    JSON.stringify(["./cpi-headlines-parser", "@research-cockpit/contracts"])
  )
    return message;
  if (
    JSON.stringify(imports(parserFile)) !==
    JSON.stringify(["@research-cockpit/contracts", "@rgrove/parse-xml"])
  )
    return message;
  if (
    !transport(providerFile) ||
    !providerStateBoundary(providerFile) ||
    !parserBoundary(parserFile)
  )
    return message;
  const providerAnchors = [
    "constSOURCE_URL=MANAGED_CPI_HEADLINE_SOURCE.feedUrl;",
    "constMAX_BYTES=MANAGED_CPI_HEADLINES_LIMITS.sourceBytes;",
    "constDEADLINE_MILLISECONDS=MANAGED_CPI_HEADLINES_LIMITS.operationMs;",
    "this.#fetch=dependencies.fetch??globalThis.fetch;",
    'newTextDecoder("utf-8",{fatal:true}).decode(bytes)',
    "if(size>MAX_BYTES)",
    "clearTimeout(timer)",
    "parseCpiHeadlinesAtom(text,fetchedAt)",
  ];
  const parserAnchors = [
    "if(newTextEncoder().encode(text).byteLength>MANAGED_CPI_HEADLINES_LIMITS.sourceBytes)",
    "if(/<!DOCTYPE|<!ENTITY/iu.test(text))",
    "ignoreUndefinedEntities:false",
    "preserveDocumentType:true",
    "preserveXmlDeclaration:true",
    "entries.length>MANAGED_CPI_HEADLINES_LIMITS.inputEntries",
    "parseManagedCpiHeadline(item)",
    "parseManagedCpiHeadlines({",
  ];
  return providerAnchors.every((anchor) =>
    compact(provider).includes(anchor),
  ) && parserAnchors.every((anchor) => compact(parser).includes(anchor))
    ? null
    : message;
}

/** Run against the actual source and refuse missing or surviving mutations. */
export function cpiHeadlinesPolicyChecks(
  provider: string,
  parser: string,
): string[] {
  const failures: string[] = [];
  if (cpiHeadlinesSourceViolation(provider, parser) !== null)
    failures.push(message);
  const mutations: readonly (readonly [
    "provider" | "parser",
    string,
    string,
  ])[] = [
    ["provider", "MANAGED_CPI_HEADLINE_SOURCE.feedUrl", "callerUrl"],
    ["provider", "fetch(SOURCE_URL,", "fetch(callerUrl,"],
    [
      "provider",
      "fetchFeed(this.#fetch, controller.signal)",
      "fetchFeed(otherFetch, controller.signal)",
    ],
    ["provider", "fetchFeed(fetch:", "fetchFeed(otherFetch:"],
    ["provider", 'credentials: "omit"', 'credentials: "include"'],
    ["provider", 'redirect: "error"', 'redirect: "follow"'],
    ["provider", 'method: "GET"', 'method: "POST"'],
    ["provider", 'method: "GET",', 'method: "GET", body: callerBody,'],
    [
      "provider",
      'referrerPolicy: "no-referrer"',
      'referrerPolicy: "unsafe-url"',
    ],
    ["provider", 'cache: "no-store"', 'cache: "default"'],
    [
      "provider",
      "      signal,\n    }),",
      "      signal: otherSignal,\n    }),",
    ],
    ["provider", "MANAGED_CPI_HEADLINES_LIMITS.sourceBytes", "1_048_576"],
    ["provider", "MANAGED_CPI_HEADLINES_LIMITS.operationMs", "100_000"],
    [
      "provider",
      'new TextDecoder("utf-8", { fatal: true })',
      'new TextDecoder("utf-8", { fatal: false })',
    ],
    ["parser", "preserveDocumentType: true", "preserveDocumentType: false"],
    ["parser", "MANAGED_CPI_HEADLINES_LIMITS.inputEntries", "100_000"],
  ];
  for (const [index, [kind, before, after]] of mutations.entries()) {
    const original = kind === "provider" ? provider : parser;
    const changed = original.replace(before, after);
    const rejected =
      kind === "provider"
        ? cpiHeadlinesSourceViolation(changed, parser)
        : cpiHeadlinesSourceViolation(provider, changed);
    if (changed === original || rejected === null)
      failures.push(`CPI source boundary mutation ${index + 1} did not refuse`);
  }
  for (const extra of [
    "\nvoid globalThis.fetch(callerUrl);",
    '\nimport "node:https";',
    "\nvoid process.env;",
    '\nconsole.log("source");',
    "\nsetInterval(()=>{},1000);",
  ]) {
    if (cpiHeadlinesSourceViolation(provider + extra, parser) === null)
      failures.push("CPI provider extra transport did not refuse");
    if (cpiHeadlinesSourceViolation(provider, parser + extra) === null)
      failures.push("CPI parser transport did not refuse");
  }
  return failures;
}
