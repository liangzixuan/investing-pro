import type {
  AlertEvaluationDto,
  LocalAlertRuleDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";

export function evaluateLocalAlert(
  rule: LocalAlertRuleDto,
  metricValue: string,
  evaluatedAt: string,
): AlertEvaluationDto {
  const value = new Decimal(metricValue);
  const threshold = new Decimal(rule.threshold);
  const triggered =
    rule.operator === "above" ? value.gt(threshold) : value.lt(threshold);
  const dedupeKey = `${rule.id}:${rule.metricKey}:${rule.operator}:${rule.threshold}:${metricValue}`;

  return {
    schemaVersion: "1.0.0",
    eventId: `local-event-${stableHash(dedupeKey)}`,
    dedupeKey,
    ruleId: rule.id,
    metricKey: rule.metricKey,
    metricValue,
    threshold: rule.threshold,
    operator: rule.operator,
    triggered,
    evaluatedAt: new Date(evaluatedAt).toISOString(),
    deliveryMode: "local_demo_only",
  };
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
