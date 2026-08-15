import type {
  LocalAlertRuleDto,
  LocalThesisDto,
} from "@research-cockpit/contracts";

export function loadThesis(instrumentId: string): LocalThesisDto | null {
  return readJson<LocalThesisDto>(`research-cockpit:thesis:${instrumentId}`);
}

export function saveThesis(thesis: LocalThesisDto): void {
  window.localStorage.setItem(
    `research-cockpit:thesis:${thesis.instrumentId}`,
    JSON.stringify(thesis),
  );
}

export function loadAlert(instrumentId: string): LocalAlertRuleDto | null {
  return readJson<LocalAlertRuleDto>(`research-cockpit:alert:${instrumentId}`);
}

export function saveAlert(rule: LocalAlertRuleDto): void {
  window.localStorage.setItem(
    `research-cockpit:alert:${rule.instrumentId}`,
    JSON.stringify(rule),
  );
}

function readJson<T>(key: string): T | null {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}
