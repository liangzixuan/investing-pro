/** Resolve a basename only from the selected current Submissions accession. */
export function selectedPersonalSecPrimaryDocument(
  value: unknown,
  accession: string,
): string | null {
  if (!record(value) || !record(value.filings) || !record(value.filings.recent))
    return null;
  const { accessionNumber, primaryDocument } = value.filings.recent;
  if (
    !Array.isArray(accessionNumber) ||
    !Array.isArray(primaryDocument) ||
    accessionNumber.length !== primaryDocument.length
  )
    return null;
  let selected: string | null = null;
  for (let index = 0; index < accessionNumber.length; index++) {
    if (accessionNumber[index] !== accession) continue;
    const basename: unknown = primaryDocument[index];
    if (
      typeof basename !== "string" ||
      basename.length > 255 ||
      basename.includes("..") ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:htm|html|xhtml|xml)$/iu.test(basename)
    )
      return null;
    if (selected !== null && selected !== basename) return null;
    selected = basename;
  }
  return selected;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
