import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  serializePersonalSecAnnualStatementObservation,
  type PersonalSecAnnualCanonicalResponseDto,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecAnnualStatementObservationDto,
} from "@research-cockpit/contracts";
import {
  canonicalAnnualPacket,
  canonicalFixtureHash,
  withCanonicalAnnualGeneration,
} from "../features/research/sec-annual-canonical-fixture";

export type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
export type TestAnnualPacket = Mutable<PersonalSecAnnualCanonicalResponseDto>;
export async function testAnnualPacket() {
  return structuredClone(await canonicalAnnualPacket()) as TestAnnualPacket;
}

/** Change invented rows and their real per-concept counts before binding hashes. */
export function replaceConceptRows(
  packet: TestAnnualPacket,
  concept: PersonalSecAnnualStatementConcept,
  changes: readonly Partial<PersonalSecAnnualStatementObservationDto>[],
) {
  const original = packet.evidence.facts.observations.find(
    (row) => row.concept === concept,
  );
  if (!original) throw new Error("Expected fixture concept");
  const rows = changes.map((change, index) => ({
    ...structuredClone(original),
    ...change,
    sourceLocator: `/facts/us-gaap/${concept}/units/USD/${index}`,
  }));
  packet.evidence.facts.observations =
    packet.evidence.facts.observations.filter((row) => row.concept !== concept);
  packet.evidence.facts.observations.push(...rows);
  const item = packet.evidence.facts.scans.find(
    (item) => item.concept === concept,
  )!;
  item.scan = {
    status: "available",
    absence: rows.length === 0 ? "concept_missing" : null,
    coverage: {
      full: {
        candidateRows: rows.length,
        inspectedRows: rows.length,
        invalidRows: 0,
        duplicateRows: 0,
        uniqueObservations: rows.length,
      },
      selected: rows.length,
      otherAccessions: 0,
      returned: rows.length,
      omittedSelected: 0,
    },
  };
}

/** Fixture construction only; the real decoder owns all admission and validation. */
export async function bindAnnualPacket(packet: TestAnnualPacket) {
  const order = new Map(registry.map((entry, index) => [entry.concept, index]));
  for (const row of packet.evidence.facts.observations)
    row.id = `sec-fact:${await canonicalFixtureHash(serializePersonalSecAnnualStatementObservation(row))}`;
  const lexical = (left: string, right: string) =>
    left < right ? -1 : left > right ? 1 : 0;
  packet.evidence.facts.observations.sort(
    (a, b) =>
      order.get(a.concept)! - order.get(b.concept)! ||
      lexical(b.endDate, a.endDate) ||
      lexical(b.startDate ?? "", a.startDate ?? "") ||
      lexical(b.filedDate, a.filedDate) ||
      lexical(a.accessionNumber, b.accessionNumber) ||
      lexical(a.id, b.id),
  );
  return withCanonicalAnnualGeneration(packet);
}
