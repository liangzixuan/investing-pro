"""Executable adversarial tests for the closed Cycle 2j Python worker."""

from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path
from types import ModuleType


def load_worker() -> ModuleType:
    path = Path(__file__).with_name("parser.py")
    spec = importlib.util.spec_from_file_location("cycle2j_worker", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("worker module unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


WORKER = load_worker()


def taxonomy() -> dict[str, object]:
    return {
        "facts": [
            {
                "concept": concept,
                "key": key,
                "periodKind": period_kind,
                "unit": unit,
            }
            for key, concept, period_kind, unit in WORKER.FACT_CONTRACTS
        ],
        "namespace": WORKER.NAMESPACE,
        "schemaVersion": WORKER.SCHEMA_VERSION,
        "taxonomyFamily": WORKER.TAXONOMY_FAMILY,
        "taxonomyVersion": WORKER.TAXONOMY_VERSION,
    }


def manifest(**changes: object) -> bytes:
    value: dict[str, object] = {
        "accession": "SYN-0000000001-25-000001",
        "acceptedAt": "2026-01-02T03:04:05.000Z",
        "amendmentOf": None,
        "availableAt": "2026-01-02T03:04:05.000Z",
        "document": WORKER.DOCUMENT_NAME,
        "entityId": "entity.synthetic.acme",
        "form": "10-K",
        "instrumentId": "instrument.synthetic.acme-common",
        "schemaVersion": WORKER.SCHEMA_VERSION,
        "synthetic": True,
        "taxonomyFamily": WORKER.TAXONOMY_FAMILY,
        "taxonomyVersion": WORKER.TAXONOMY_VERSION,
    }
    value.update(changes)
    return (WORKER.canonical_json(value) + "\n").encode("ascii")


def fact_elements() -> list[str]:
    output: list[str] = []
    for index, (key, concept, period_kind, unit) in enumerate(
        WORKER.FACT_CONTRACTS, start=1
    ):
        period_start = "none" if period_kind == "instant" else "2025-01-01"
        output.append(
            '<fact concept="{}" dimensions="none" key="{}" '
            'periodEnd="2025-12-31" periodStart="{}" unit="{}">{}</fact>'.format(
                concept, key, period_start, unit, index
            )
        )
    return output


def filing_xml(elements: list[str] | None = None) -> bytes:
    facts = fact_elements() if elements is None else elements
    text = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<filing xmlns="{}" taxonomyFamily="{}" taxonomyVersion="{}">'
        "{}"
        "</filing>"
    ).format(
        WORKER.NAMESPACE,
        WORKER.TAXONOMY_FAMILY,
        WORKER.TAXONOMY_VERSION,
        "".join(facts),
    )
    return text.encode("ascii")


class WorkerSecurityTests(unittest.TestCase):
    def assert_rejected(self, action: object) -> None:
        with self.assertRaises(WORKER.Rejected):
            action()  # type: ignore[operator]

    def test_accepts_only_the_complete_canonical_baseline(self) -> None:
        parsed_manifest = WORKER.parse_manifest(manifest())
        facts = WORKER.parse_xml(filing_xml(), taxonomy())

        self.assertEqual(parsed_manifest["form"], "10-K")
        self.assertEqual(len(facts), 10)

    def test_rejects_malformed_zip_and_unsafe_archive_name(self) -> None:
        self.assert_rejected(lambda: WORKER.read_zip(b"not-a-zip"))
        self.assert_rejected(
            lambda: WORKER.validate_name(
                "../filing.xml", 0x0314, 0o100644 << 16
            )
        )

    def test_rejects_duplicate_manifest_key_and_invalid_entity(self) -> None:
        duplicate = (
            b'{"accession":"SYN-0000000001-25-000001",'
            b'"accession":"SYN-0000000001-25-000002"}\n'
        )
        self.assert_rejected(lambda: WORKER.parse_manifest(duplicate))
        self.assert_rejected(
            lambda: WORKER.parse_manifest(manifest(entityId="issuer-acme"))
        )

    def test_rejects_entity_declaration_and_other_xml_directives(self) -> None:
        with_entity = filing_xml().replace(
            b"<filing ",
            b'<!DOCTYPE filing [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><filing ',
            1,
        )
        processing_instruction = filing_xml().replace(
            b"<filing ", b"<?worker bypass?><filing ", 1
        )

        self.assert_rejected(lambda: WORKER.parse_xml(with_entity, taxonomy()))
        self.assert_rejected(
            lambda: WORKER.parse_xml(processing_instruction, taxonomy())
        )

    def test_rejects_partial_and_duplicate_fact_sets(self) -> None:
        partial = fact_elements()[:-1]
        duplicate = fact_elements()
        duplicate[-1] = duplicate[-2]

        self.assert_rejected(
            lambda: WORKER.parse_xml(filing_xml(partial), taxonomy())
        )
        self.assert_rejected(
            lambda: WORKER.parse_xml(filing_xml(duplicate), taxonomy())
        )

    def test_rejects_unit_period_decimal_and_taxonomy_mutations(self) -> None:
        wrong_unit = fact_elements()
        wrong_unit[0] = wrong_unit[0].replace('unit="USD"', 'unit="shares"')
        mixed_period = fact_elements()
        mixed_period[-1] = mixed_period[-1].replace(
            'periodEnd="2025-12-31"', 'periodEnd="2025-11-30"'
        )
        negative_zero = fact_elements()
        negative_zero[0] = negative_zero[0].replace(">1</fact>", ">-0</fact>")
        wrong_taxonomy = taxonomy()
        wrong_taxonomy["namespace"] = "urn:synthetic:unreviewed"

        for elements in (wrong_unit, mixed_period, negative_zero):
            self.assert_rejected(
                lambda elements=elements: WORKER.parse_xml(
                    filing_xml(elements), taxonomy()
                )
            )
        self.assert_rejected(
            lambda: WORKER.parse_xml(filing_xml(), wrong_taxonomy)
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
