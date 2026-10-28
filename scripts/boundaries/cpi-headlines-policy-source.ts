import ts from "typescript";

export const cpiPolicyMessage =
  "CPI headlines must retain one fixed credential-free metadata request and isolated XML parsing";
export const cpiProviderImports = [
  "./cpi-headlines-parser",
  "@research-cockpit/contracts",
] as const;
export const cpiParserImports = [
  "@research-cockpit/contracts",
  "@rgrove/parse-xml",
] as const;

export function compactCpiSource(text: string) {
  return text.replace(/\s+/gu, "").replace(/,(?=[\]})])/gu, "");
}
export function parseCpiSource(text: string) {
  return ts.createSourceFile(
    "cpi.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}
export function cpiNodes<T extends ts.Node>(
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
function literalModule(specifier: ts.Expression | undefined) {
  if (!specifier) return undefined;
  if (!ts.isStringLiteral(specifier)) return undefined;
  return specifier.text;
}
function statementModule(node: ts.Statement) {
  if (ts.isImportDeclaration(node)) return literalModule(node.moduleSpecifier);
  if (ts.isExportDeclaration(node)) return literalModule(node.moduleSpecifier);
  return undefined;
}
export function hasCpiImports(
  file: ts.SourceFile,
  expected: readonly string[],
) {
  const modules = new Set<string>();
  for (const node of file.statements) {
    const name = statementModule(node);
    if (name !== undefined) modules.add(name);
  }
  const actual = [...modules].sort();
  if (actual.length !== expected.length) return false;
  return actual.every((name, index) => name === expected[index]);
}
const dynamicFunctions = new Set(["require", "eval", "Function"]);
function dynamicCall(node: ts.CallExpression) {
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
  if (!ts.isIdentifier(node.expression)) return false;
  return dynamicFunctions.has(node.expression.text);
}
export function hasCpiDynamicCode(file: ts.SourceFile) {
  return cpiNodes(file, ts.isCallExpression).some(dynamicCall);
}
const providerForbidden = new Set([
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "process",
  "console",
  "setInterval",
]);
const parserForbidden = new Set([
  "fetch",
  ...providerForbidden,
  "require",
  "eval",
  "Function",
]);
function permittedIdentifiers(
  file: ts.SourceFile,
  forbidden: ReadonlySet<string>,
) {
  return !cpiNodes(file, ts.isIdentifier).some((node) =>
    forbidden.has(node.text),
  );
}
export function hasCpiProviderStateBoundary(file: ts.SourceFile) {
  return permittedIdentifiers(file, providerForbidden);
}
export function hasCpiParserBoundary(file: ts.SourceFile) {
  if (!permittedIdentifiers(file, parserForbidden)) return false;
  return !hasCpiDynamicCode(file);
}
