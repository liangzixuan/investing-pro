import ts from "typescript";
import {
  sameJsonValue as same,
  chosenDraftSetValuesMatch,
} from "./research-draft-set-native-comparison";
import { readFileSync } from "node:fs";
import { beforeAll, expect, it } from "vitest";
import { createFixture } from "./fixture";
import {
  formatManagedResearchDraftSetFile,
  type ManagedResearchDraftSetFileContent,
} from "../../src/clerk-trial/managed-research-draft-set-file";
const source = readFileSync(
  new URL(
    "../../android/app/src/androidTest/java/local/investment/personal/ManagedResearchDraftSetRecoveryTest.java",
    import.meta.url,
  ),
  "utf8",
);
const helperLiteral =
  /private static final String SAME_JSON = ("(?:\\.|[^"\\])*");/.exec(
    source,
  )![1]!;
const helper = JSON.parse(helperLiteral) as string;
const javaExpression =
  /await\("chosen bytes preserve every nested identity\/raw value\/order and independent metadata",(.+?)\);same\("all"/.exec(
    source,
  )![1]!;
const returnSource = /;return (.*);\}\)\(\)"$/.exec(javaExpression)![1]!;
const staticSource = ts.createSourceFile(
  "static.ts",
  readFileSync(
    new URL("./research-draft-set-native-comparison.ts", import.meta.url),
    "utf8",
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
function requireParsed(parsed: ts.SourceFile) {
  const diagnostics = (
    parsed as ts.SourceFile & {
      readonly parseDiagnostics: readonly ts.Diagnostic[];
    }
  ).parseDiagnostics;
  if (!Array.isArray(diagnostics) || diagnostics.length !== 0)
    throw new Error("Unexpected source parse diagnostics");
}
requireParsed(staticSource);
function declaration(name: string) {
  const found = staticSource.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
  if (!found?.body) throw new Error("Missing static predicate declaration");
  return found;
}
function expression(text: string) {
  const parsed = ts.createSourceFile(
    "native.js",
    `const bound = ${text};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  requireParsed(parsed);
  const statement = parsed.statements[0];
  if (
    parsed.statements.length !== 1 ||
    !statement ||
    !ts.isVariableStatement(statement) ||
    statement.declarationList.declarations.length !== 1
  )
    throw new Error("Expected one bound expression");
  const node = statement.declarationList.declarations[0]?.initializer;
  if (!node) throw new Error("Missing expression");
  return node;
}
function unwrapped(node: ts.Node): ts.Node {
  return ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node)
    ? unwrapped(node.expression)
    : node;
}
function normalized(original: ts.Node): unknown {
  const node = unwrapped(original),
    children: unknown[] = [];
  ts.forEachChild(node, (child) => {
    if (!ts.isTypeNode(child)) children.push(normalized(child));
  });
  return [
    node.kind,
    ts.isIdentifier(node) ||
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node)
      ? node.text
      : null,
    ts.isVariableDeclarationList(node)
      ? node.flags & ts.NodeFlags.BlockScoped
      : null,
    children,
  ];
}
function verifyNativeBinding() {
  expect(() => expression("true; const extra = false")).toThrow(
    "Expected one bound expression",
  );
  expect(() => expression("true, extra = false")).toThrow(
    "Expected one bound expression",
  );
  expect(() => expression("true ???")).toThrow(
    "Unexpected source parse diagnostics",
  );
  expect(javaExpression).toBe(
    '"(()=>{const f=JSON.parse("+P+".text),e="+D+".data.captured,same="+SAME_JSON+";return ' +
      returnSource +
      ';})()"',
  );
  const nativeHelper = unwrapped(expression(helper));
  if (!ts.isFunctionExpression(nativeHelper))
    throw new Error("Expected native comparator");
  const staticHelper = declaration("sameJsonValue");
  expect(nativeHelper.name?.text).toBe(staticHelper.name?.text);
  expect(nativeHelper.parameters.map((p) => normalized(p))).toEqual(
    staticHelper.parameters.map((p) => normalized(p)),
  );
  expect(normalized(nativeHelper.body)).toEqual(normalized(staticHelper.body!));
  const predicate = declaration("chosenDraftSetValuesMatch");
  expect(predicate.parameters.map((p) => p.name.getText(staticSource))).toEqual(
    ["f", "e"],
  );
  expect(predicate.body!.statements).toHaveLength(2);
  const alias = predicate.body!.statements[0]!;
  expect(normalized(alias)).toEqual(
    normalized(
      ts.createSourceFile(
        "alias.js",
        "const same=sameJsonValue;",
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS,
      ).statements[0]!,
    ),
  );
  const result = predicate.body!.statements[1]!;
  if (!ts.isReturnStatement(result) || !result.expression)
    throw new Error("Expected static return");
  expect(normalized(result.expression)).toEqual(
    normalized(expression(returnSource)),
  );
}
const scope = `sha256:${"c".repeat(64)}`,
  capturedAt = "2026-10-30T00:00:00.000Z";
let data: NonNullable<
  Awaited<ReturnType<typeof createFixture>>["researchDraftSet"]
>["data"];
let file: ManagedResearchDraftSetFileContent;
beforeAll(async () => {
  const f = await createFixture("research-draft-set");
  data = f.researchDraftSet!.data;
  const c = data.captured;
  const document = formatManagedResearchDraftSetFile({
    accountScope: scope,
    capturedAt,
    members: {
      watchlist: {
        format: "investment-watchlist-draft",
        version: 1,
        accountScope: scope,
        capturedAt,
        baseVersion: 3,
        draft: c.watchlist,
      },
      portfolio: {
        format: "investment-portfolio-draft",
        version: 1,
        accountScope: scope,
        capturedAt,
        baseVersion: 3,
        draft: c.portfolio,
      },
      followups: {
        format: "investment-followups-draft",
        version: 1,
        accountScope: scope,
        capturedAt,
        baseVersion: 3,
        draft: c.followups,
      },
      valuation: {
        format: "investment-valuation-collection-draft",
        version: 1,
        accountScope: scope,
        capturedAt,
        payload: c.valuation,
      },
    },
  });
  expect(document).not.toBeNull();
  file = JSON.parse(document!.text) as ManagedResearchDraftSetFileContent;
});
function predicate(value: unknown) {
  return chosenDraftSetValuesMatch(
    value as ManagedResearchDraftSetFileContent,
    data.captured,
  );
}
function reorder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorder);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([k, v]) => [k, reorder(v)]),
    );
  return value;
}
it("binds the static tested predicate to exact native expressions despite Watchlist object insertion order", () => {
  verifyNativeBinding();
  expect(JSON.stringify(file.members.watchlist!.draft)).not.toBe(
    JSON.stringify(data.captured.watchlist),
  );
  expect(same(file.members.watchlist!.draft, data.captured.watchlist)).toBe(
    true,
  );
  expect(predicate(file)).toBe(true);
  const reordered = structuredClone(file);
  for (const key of ["watchlist", "portfolio", "followups"]) {
    const path = ["members", key, "draft"];
    set(reordered, path, reorder(at(reordered, path)));
  }
  const path = ["members", "valuation", "payload"];
  set(reordered, path, reorder(at(reordered, path)));
  expect(predicate(reordered)).toBe(true);
});
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object")
    throw new Error("Expected mutation target");
  return value as Record<string, unknown>;
}
function at(value: unknown, path: readonly string[]) {
  let current = value;
  for (const key of path) current = object(current)[key];
  return current;
}
function set(value: unknown, path: readonly string[], replacement: unknown) {
  object(at(value, path.slice(0, -1)))[path.at(-1)!] = replacement;
}
function reverse(value: unknown, path: readonly string[]) {
  const rows = at(value, path);
  if (!Array.isArray(rows)) throw new Error("Expected array target");
  rows.reverse();
}
const mutations: [string, (f: ManagedResearchDraftSetFileContent) => void][] = [
  [
    "missing field",
    (f) => {
      delete object(at(f, ["members", "watchlist", "draft"])).snapshotSha256;
    },
  ],
  [
    "extra field",
    (f) => {
      set(f, ["members", "watchlist", "draft", "unexpected"], true);
    },
  ],
  [
    "changed complete note",
    (f) => {
      set(
        f,
        ["members", "watchlist", "draft", "memberships", "0", "note"],
        "Different complete note",
      );
    },
  ],
  [
    "changed identity",
    (f) => {
      set(
        f,
        ["members", "watchlist", "draft", "memberships", "0", "listingId"],
        "other",
      );
    },
  ],
  [
    "Watchlist order",
    (f) => {
      reverse(f, ["members", "watchlist", "draft", "memberships"]);
    },
  ],
  [
    "transaction order",
    (f) => {
      reverse(f, ["members", "portfolio", "draft", "transactions"]);
    },
  ],
  [
    "registry order",
    (f) => {
      reverse(f, ["members", "portfolio", "draft", "identities"]);
    },
  ],
  [
    "decimal spelling",
    (f) => {
      set(f, ["members", "portfolio", "draft", "opening", "cashUsd"], "1000");
    },
  ],
  [
    "numeric conversion",
    (f) => {
      set(
        f,
        ["members", "portfolio", "draft", "transactions", "0", "shares"],
        2.5,
      );
    },
  ],
  [
    "null change",
    (f) => {
      set(
        f,
        [
          "members",
          "portfolio",
          "draft",
          "opening",
          "holdings",
          "0",
          "confirmedOn",
        ],
        null,
      );
    },
  ],
  [
    "Follow-ups order",
    (f) => {
      reverse(f, ["members", "followups", "draft", "entries"]);
    },
  ],
  [
    "complete result",
    (f) => {
      set(f, ["members", "followups", "draft", "entries", "0", "result"], "");
    },
  ],
  [
    "valuation entry order",
    (f) => {
      reverse(f, ["members", "valuation", "payload", "entries"]);
    },
  ],
  [
    "valuation raw operand",
    (f) => {
      const path = [
        "members",
        "valuation",
        "payload",
        "entries",
        "0",
        "exit",
        "inputs",
        "baseRevenue",
      ];
      set(f, path, String(at(f, path)) + " ");
    },
  ],
  [
    "valuation model",
    (f) => {
      set(
        f,
        [
          "members",
          "valuation",
          "payload",
          "entries",
          "0",
          "dcf",
          "modelVersion",
        ],
        "other",
      );
    },
  ],
  [
    "base version",
    (f) => {
      set(f, ["members", "portfolio", "baseVersion"], 4);
    },
  ],
  [
    "scope",
    (f) => {
      set(
        f,
        ["members", "followups", "accountScope"],
        "sha256:" + "d".repeat(64),
      );
    },
  ],
  [
    "valuation scope",
    (f) => {
      set(
        f,
        ["members", "valuation", "accountScope"],
        "sha256:" + "d".repeat(64),
      );
    },
  ],
  [
    "outer member order",
    (f) => {
      set(
        f,
        ["members"],
        Object.fromEntries(Object.entries(f.members).reverse()),
      );
    },
  ],
];
it.each(mutations)(
  "rejects %s in the exact native predicate",
  (_name, mutate) => {
    const changed = structuredClone(file);
    mutate(changed);
    expect(predicate(changed)).toBe(false);
  },
);
it("keeps scalar types, explicit nulls and every array position exact", () => {
  expect(same({ value: "0" }, { value: 0 })).toBe(false);
  expect(same({ value: null }, {})).toBe(false);
  expect(same(["a", "b"], ["b", "a"])).toBe(false);
  expect(same({ a: null, b: "" }, { b: "", a: null })).toBe(true);
});
