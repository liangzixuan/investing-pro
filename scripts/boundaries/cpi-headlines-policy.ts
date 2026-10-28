import {
  cpiPolicyMessage,
  cpiProviderImports,
  cpiParserImports,
  hasCpiImports,
  hasCpiProviderStateBoundary,
  hasCpiParserBoundary,
  parseCpiSource,
} from "./cpi-headlines-policy-source";
import { hasFixedCpiRequest } from "./cpi-headlines-policy-request";
import { hasCpiSourceAnchors } from "./cpi-headlines-policy-anchors";
import { cpiSourceProbeFailures } from "./cpi-headlines-policy-probes";

export function cpiHeadlinesSourceViolation(
  provider: string,
  parser: string,
): string | null {
  const providerFile = parseCpiSource(provider),
    parserFile = parseCpiSource(parser);
  const stages = [
    () => hasCpiImports(providerFile, cpiProviderImports),
    () => hasCpiImports(parserFile, cpiParserImports),
    () => hasFixedCpiRequest(providerFile),
    () => hasCpiProviderStateBoundary(providerFile),
    () => hasCpiParserBoundary(parserFile),
    () => hasCpiSourceAnchors(provider, parser),
  ];
  return stages.every((stage) => stage()) ? null : cpiPolicyMessage;
}
/** Actual source admission and refusal probes remain separate obligations. */
export function cpiHeadlinesPolicyChecks(
  provider: string,
  parser: string,
): string[] {
  const initial = cpiHeadlinesSourceViolation(provider, parser);
  const failures = initial === null ? [] : [initial];
  return [
    ...failures,
    ...cpiSourceProbeFailures(provider, parser, cpiHeadlinesSourceViolation),
  ];
}
