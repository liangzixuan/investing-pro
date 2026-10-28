import { compactCpiSource } from "./cpi-headlines-policy-source";

const providerAnchors = [
  "constSOURCE_URL=MANAGED_CPI_HEADLINE_SOURCE.feedUrl;",
  "constMAX_BYTES=MANAGED_CPI_HEADLINES_LIMITS.sourceBytes;",
  "constDEADLINE_MILLISECONDS=MANAGED_CPI_HEADLINES_LIMITS.operationMs;",
  "this.#fetch=dependencies.fetch??globalThis.fetch;",
  'newTextDecoder("utf-8",{fatal:true}).decode(bytes)',
  "if(this.size>MAX_BYTES)",
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
function containsAnchors(text: string, anchors: readonly string[]) {
  const compact = compactCpiSource(text);
  return anchors.every((anchor) => compact.includes(anchor));
}
export function hasCpiSourceAnchors(provider: string, parser: string) {
  if (!containsAnchors(provider, providerAnchors)) return false;
  return containsAnchors(parser, parserAnchors);
}
