interface CpiSources {
  readonly provider: string;
  readonly parser: string;
}
type SourceViolation = (provider: string, parser: string) => string | null;
type Mutation = readonly [keyof CpiSources, string, string];

const mutations: readonly Mutation[] = [
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
  ["provider", 'referrerPolicy: "no-referrer"', 'referrerPolicy: "unsafe-url"'],
  ["provider", 'cache: "no-store"', 'cache: "default"'],
  ["provider", "      signal,\n    }),", "      signal: otherSignal,\n    }),"],
  ["provider", "MANAGED_CPI_HEADLINES_LIMITS.sourceBytes", "1_048_576"],
  ["provider", "MANAGED_CPI_HEADLINES_LIMITS.operationMs", "100_000"],
  [
    "provider",
    'new TextDecoder("utf-8", { fatal: true })',
    'new TextDecoder("utf-8", { fatal: false })',
  ],
  ["parser", "preserveDocumentType: true", "preserveDocumentType: false"],
  ["parser", "MANAGED_CPI_HEADLINES_LIMITS.inputEntries", "100_000"],
  ["provider", '    if (this.size > MAX_BYTES) fail("invalid_response");', ""],
  ["provider", "if (this.size > MAX_BYTES)", "if (this.size > MAX_BYTES * 2)"],
];
const extraCapabilities = [
  "\nvoid globalThis.fetch(callerUrl);",
  '\nimport "node:https";',
  "\nvoid process.env;",
  '\nconsole.log("source");',
  "\nsetInterval(()=>{},1000);",
];
function mutationFailure(
  sources: CpiSources,
  mutation: Mutation,
  index: number,
  violation: SourceViolation,
) {
  const [kind, before, after] = mutation;
  const original = sources[kind];
  const text = original.replace(before, after);
  const failure = `CPI source boundary mutation ${index + 1} did not refuse`;
  if (text === original) return failure;
  const changed = { ...sources, [kind]: text };
  if (violation(changed.provider, changed.parser) === null) return failure;
  return null;
}
function capabilityFailure(
  sources: CpiSources,
  kind: keyof CpiSources,
  extra: string,
  violation: SourceViolation,
) {
  const changed = { ...sources, [kind]: sources[kind] + extra };
  if (violation(changed.provider, changed.parser) !== null) return [];
  return [`CPI ${kind} extra transport did not refuse`];
}
function extraCapabilityFailures(
  sources: CpiSources,
  violation: SourceViolation,
) {
  return extraCapabilities.flatMap((extra) => [
    ...capabilityFailure(sources, "provider", extra, violation),
    ...capabilityFailure(sources, "parser", extra, violation),
  ]);
}
/** Missing mutation anchors fail the check as well as mutations that survive admission. */
export function cpiSourceProbeFailures(
  provider: string,
  parser: string,
  violation: SourceViolation,
) {
  const sources = { provider, parser };
  const changed = mutations
    .map((mutation, index) =>
      mutationFailure(sources, mutation, index, violation),
    )
    .filter((failure): failure is string => failure !== null);
  return [...changed, ...extraCapabilityFailures(sources, violation)];
}
