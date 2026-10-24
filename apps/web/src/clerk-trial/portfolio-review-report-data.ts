function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}
export function samePortfolioReportData(left: unknown, right: unknown) {
  return canonical(left) === canonical(right);
}
function validUnicode(value: unknown): boolean {
  if (typeof value === "string") return !/\p{Cs}/u.test(value);
  if (value === null) return true;
  if (typeof value !== "object") return true;
  return Object.values(value).every(validUnicode);
}
export function freezePortfolioReportData<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezePortfolioReportData(child);
    Object.freeze(value);
  }
  return value;
}

export function portfolioReportWithinBounds(value: unknown): boolean {
  const json = JSON.stringify(value);
  if (!validUnicode(value)) return false;
  return new TextEncoder().encode(json).byteLength <= 8 * 1024 * 1024;
}
