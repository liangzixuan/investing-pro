import ts from "typescript";
import {
  compactCpiSource,
  cpiNodes,
  hasCpiDynamicCode,
} from "./cpi-headlines-policy-source";

const expectedOptions: readonly (readonly [string, string])[] = [
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
];
function shorthandOption(property: ts.ShorthandPropertyAssignment) {
  if (property.name.text !== "signal") return undefined;
  return ["signal", "signal"] as const;
}
function optionValue(
  property: ts.ObjectLiteralElementLike,
  file: ts.SourceFile,
) {
  if (ts.isShorthandPropertyAssignment(property))
    return shorthandOption(property);
  if (!ts.isPropertyAssignment(property)) return undefined;
  if (!ts.isIdentifier(property.name)) return undefined;
  return [
    property.name.text,
    compactCpiSource(property.initializer.getText(file)),
  ] as const;
}
function consumeOption(
  expected: Map<string, string>,
  value: readonly [string, string],
) {
  const [name, initializer] = value;
  if (expected.get(name) !== initializer) return false;
  expected.delete(name);
  return true;
}
function requestOptions(node: ts.Node | undefined, file: ts.SourceFile) {
  if (!node) return false;
  if (!ts.isObjectLiteralExpression(node)) return false;
  const expected = new Map(expectedOptions);
  if (node.properties.length !== expected.size) return false;
  for (const property of node.properties) {
    const value = optionValue(property, file);
    if (!value) return false;
    if (!consumeOption(expected, value)) return false;
  }
  return expected.size === 0;
}
function namedCall(node: ts.CallExpression, name: string) {
  if (!ts.isIdentifier(node.expression)) return false;
  return node.expression.text === name;
}
function singleCall(file: ts.SourceFile, name: string) {
  const calls = cpiNodes(file, ts.isCallExpression).filter((node) =>
    namedCall(node, name),
  );
  if (calls.length !== 1) return undefined;
  return calls[0];
}
function fixedRead(file: ts.SourceFile) {
  const read = singleCall(file, "fetch");
  if (!read) return undefined;
  if (read.arguments.length !== 2) return undefined;
  if (read.arguments[0]?.getText(file) !== "SOURCE_URL") return undefined;
  if (!requestOptions(read.arguments[1], file)) return undefined;
  return read;
}
function lexicalFetchFeed(file: ts.SourceFile) {
  const helpers = cpiNodes(file, ts.isFunctionDeclaration).filter(
    (node) => node.name?.text === "fetchFeed",
  );
  if (helpers.length !== 1) return undefined;
  const helper = helpers[0];
  if (
    helper?.parameters.map((node) => node.name.getText(file)).join(",") !==
    "fetch,signal"
  )
    return undefined;
  return helper;
}
function enclosingFunction(node: ts.Node) {
  let owner = node.parent;
  while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
  return owner;
}
function ownsFixedRead(file: ts.SourceFile) {
  const read = fixedRead(file);
  if (!read) return false;
  const helper = lexicalFetchFeed(file);
  if (!helper) return false;
  return enclosingFunction(read) === helper;
}
function delegatesFixedFetch(file: ts.SourceFile) {
  const delegation = singleCall(file, "fetchFeed");
  if (!delegation) return false;
  return (
    compactCpiSource(delegation.getText(file)) ===
    "fetchFeed(this.#fetch,controller.signal)"
  );
}
function singleGlobalFetch(file: ts.SourceFile) {
  const globals = cpiNodes(file, ts.isPropertyAccessExpression).filter(
    (node) => node.getText(file) === "globalThis.fetch",
  );
  return globals.length === 1;
}
/** Each stage owns one lexical transport invariant; none executes provider code. */
export function hasFixedCpiRequest(file: ts.SourceFile) {
  const stages = [ownsFixedRead, delegatesFixedFetch, singleGlobalFetch];
  if (!stages.every((stage) => stage(file))) return false;
  return !hasCpiDynamicCode(file);
}
