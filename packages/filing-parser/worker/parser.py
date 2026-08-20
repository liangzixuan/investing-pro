"""Closed synthetic filing-parser boundary worker.

The production entry point reads one fixed read-only archive and writes one
canonical, ASCII JSON result. Expected document failures are quarantined; raw
archive or XML values are never written to stdout or stderr.
"""

from __future__ import annotations

import hashlib
import json
import re
import stat
import struct
import sys
import zipfile
import zlib
from datetime import date, datetime
from pathlib import PurePosixPath
from typing import Final
from xml.etree import ElementTree


SCHEMA_VERSION: Final = "1.0.0"
PARSER_VERSION: Final = "filing-parser-boundary-v1"
TAXONOMY_VERSION: Final = "rc-synthetic-taxonomy-1.0.0"
NAMESPACE: Final = "urn:research-cockpit:synthetic:filing:v1"
INPUT_PATH: Final = "/input/filing.zip"
TAXONOMY_PATH: Final = "/worker/taxonomy-v1.json"
MANIFEST_NAME: Final = "filing-manifest.json"
DOCUMENT_NAME: Final = "filing.xml"
EXPECTED_NAMES: Final = (MANIFEST_NAME, DOCUMENT_NAME)
EXPECTED_CONCEPTS: Final = ("net_income", "revenue")
EXPECTED_UNIT: Final = "USD"

MAX_ARCHIVE_BYTES: Final = 1_048_576
MAX_MANIFEST_BYTES: Final = 16_384
MAX_XML_BYTES: Final = 2_097_152
MAX_AGGREGATE_BYTES: Final = 2_113_536
MAX_COMPRESSION_RATIO: Final = 100
MAX_XML_DEPTH: Final = 64
MAX_XML_NODES: Final = 20_000
MAX_XML_ATTRIBUTES: Final = 16
MAX_XML_TEXT_CODEPOINTS: Final = 1_048_576

ACCESSION = re.compile(r"SYN-[0-9]{10}-[0-9]{2}-[0-9]{6}\Z", re.ASCII)
ISO_UTC = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z\Z",
    re.ASCII,
)
ISO_DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}\Z", re.ASCII)
DECIMAL = re.compile(
    r"-?(?:0|[1-9][0-9]{0,25})(?:\.[0-9]{1,12})?\Z", re.ASCII
)
XML_DECLARATION: Final = b'<?xml version="1.0" encoding="UTF-8"?>\n'
FORBIDDEN_XML_MARKERS: Final = (
    b"<!doctype",
    b"<!entity",
    b"<![cdata[",
    b"<!--",
)
XINCLUDE_NAMESPACE: Final = "{http://www.w3.org/2001/XInclude}"

QUARANTINE_CODES: Final = frozenset(
    {
        "archive_invalid",
        "archive_entry_invalid",
        "archive_encrypted",
        "archive_limit_exceeded",
        "archive_nested",
        "manifest_invalid",
        "xml_forbidden_construct",
        "xml_limit_exceeded",
        "xml_invalid",
        "taxonomy_not_allowed",
        "fact_invalid",
        "fact_ambiguous",
        "worker_failure",
    }
)


class Quarantine(Exception):
    """Expected, value-free rejection of one archive."""

    def __init__(self, code: str) -> None:
        if code not in QUARANTINE_CODES:
            code = "worker_failure"
        self.code = code
        super().__init__("filing archive quarantined")


def parse_archive_bytes(archive: bytes) -> dict[str, object]:
    """Parse one bounded archive without reading paths or external resources."""

    source_sha256 = "sha256:" + hashlib.sha256(archive).hexdigest()
    try:
        if not archive:
            raise Quarantine("archive_invalid")
        if len(archive) > MAX_ARCHIVE_BYTES:
            raise Quarantine("archive_limit_exceeded")
        taxonomy = _load_taxonomy()
        entries = _read_archive(archive)
        manifest = _parse_manifest(entries[MANIFEST_NAME])
        facts = _parse_xml(entries[DOCUMENT_NAME], taxonomy)
        return {
            "accession": manifest["accession"],
            "acceptedAt": manifest["acceptedAt"],
            "availableAt": manifest["availableAt"],
            "facts": facts,
            "parserVersion": PARSER_VERSION,
            "schemaVersion": SCHEMA_VERSION,
            "sourceSha256": source_sha256,
            "status": "accepted",
            "synthetic": True,
            "taxonomyVersion": TAXONOMY_VERSION,
        }
    except Quarantine as error:
        return _quarantined(source_sha256, error.code)
    except Exception:
        return _quarantined(source_sha256, "worker_failure")


def _load_taxonomy() -> dict[str, object]:
    try:
        with open(TAXONOMY_PATH, "rb") as taxonomy_file:
            raw = taxonomy_file.read(16_385)
        if len(raw) > 16_384:
            raise Quarantine("worker_failure")
        taxonomy = _json_object(raw, "worker_failure", canonical=False)
    except Quarantine:
        raise
    except Exception as error:
        raise Quarantine("worker_failure") from error

    expected = {
        "concepts": list(EXPECTED_CONCEPTS),
        "namespace": NAMESPACE,
        "schemaVersion": SCHEMA_VERSION,
        "taxonomyVersion": TAXONOMY_VERSION,
        "units": [EXPECTED_UNIT],
    }
    if taxonomy != expected:
        raise Quarantine("worker_failure")
    return taxonomy


def _read_archive(archive: bytes) -> dict[str, bytes]:
    try:
        output = _validate_zip_envelope(archive)
        if any(_is_nested_archive(value) for value in output.values()):
            raise Quarantine("archive_nested")
        return output
    except Quarantine:
        raise
    except (zipfile.BadZipFile, zipfile.LargeZipFile, EOFError, OSError) as error:
        raise Quarantine("archive_invalid") from error


def _validate_zip_envelope(archive: bytes) -> dict[str, bytes]:
    """Require one exact, non-ZIP64, two-entry ZIP envelope.

    ``zipfile`` deliberately accepts prepended/trailing bytes and resolves many
    local/central discrepancies. This boundary instead requires the two local
    records, their compressed data, the two central records, and the zero-
    comment EOCD to cover every archive byte exactly.
    """

    if len(archive) < 22 or archive[-22:-18] != b"PK\x05\x06":
        raise Quarantine("archive_invalid")
    try:
        (
            disk_number,
            central_disk,
            disk_entries,
            total_entries,
            central_size,
            central_offset,
            comment_length,
        ) = struct.unpack_from("<HHHHIIH", archive, len(archive) - 18)
    except struct.error as error:
        raise Quarantine("archive_invalid") from error
    if (
        disk_number != 0
        or central_disk != 0
        or disk_entries != total_entries
        or total_entries < 1
        or total_entries > 16
        or comment_length != 0
        or central_size in (0, 0xFFFFFFFF)
        or central_offset == 0xFFFFFFFF
        or central_offset + central_size != len(archive) - 22
    ):
        raise Quarantine("archive_invalid")
    if b"PK\x06\x06" in archive or b"PK\x06\x07" in archive:
        raise Quarantine("archive_invalid")

    central_records: list[dict[str, object]] = []
    cursor = central_offset
    for _index in range(total_entries):
        if cursor + 46 > len(archive) or archive[cursor : cursor + 4] != b"PK\x01\x02":
            raise Quarantine("archive_invalid")
        try:
            fields = struct.unpack_from("<6H3I5H2I", archive, cursor + 4)
        except struct.error as error:
            raise Quarantine("archive_invalid") from error
        (
            version_made,
            version_needed,
            flags,
            compression,
            modified_time,
            modified_date,
            crc,
            compressed_size,
            uncompressed_size,
            name_length,
            extra_length,
            entry_comment_length,
            disk_start,
            _internal_attributes,
            external_attributes,
            local_offset,
        ) = fields
        end = cursor + 46 + name_length + extra_length + entry_comment_length
        if (
            end > central_offset + central_size
            or version_needed not in (10, 20)
            or flags & ~(0x800 | 0x1)
            or flags & 0x8
            or compression not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
            or compressed_size == 0xFFFFFFFF
            or uncompressed_size == 0xFFFFFFFF
            or local_offset == 0xFFFFFFFF
            or extra_length != 0
            or entry_comment_length != 0
            or disk_start != 0
            or name_length == 0
        ):
            raise Quarantine("archive_invalid")
        name_bytes = archive[cursor + 46 : cursor + 46 + name_length]
        name = _ascii_zip_name(name_bytes)
        central_records.append(
            {
                "name": name,
                "nameBytes": name_bytes,
                "versionMade": version_made,
                "versionNeeded": version_needed,
                "flags": flags,
                "compression": compression,
                "modifiedTime": modified_time,
                "modifiedDate": modified_date,
                "crc": crc,
                "compressedSize": compressed_size,
                "uncompressedSize": uncompressed_size,
                "externalAttributes": external_attributes,
                "localOffset": local_offset,
            }
        )
        cursor = end
    if cursor != central_offset + central_size:
        raise Quarantine("archive_invalid")

    names = [str(record["name"]) for record in central_records]
    if len(names) != len(set(names)) or len(names) != len(
        {name.casefold() for name in names}
    ):
        raise Quarantine("archive_entry_invalid")
    if len(names) != 2 or tuple(sorted(names)) != tuple(sorted(EXPECTED_NAMES)):
        if any(
            name.lower().endswith((".zip", ".gz", ".tgz", ".tar"))
            for name in names
        ):
            raise Quarantine("archive_nested")
        raise Quarantine("archive_entry_invalid")
    for record in central_records:
        _validate_closed_entry(record)

    local_cursor = 0
    output: dict[str, bytes] = {}
    aggregate_uncompressed = 0
    for record in sorted(central_records, key=lambda item: int(item["localOffset"])):
        local_offset = int(record["localOffset"])
        if local_offset != local_cursor or archive[local_offset : local_offset + 4] != b"PK\x03\x04":
            raise Quarantine("archive_invalid")
        try:
            (
                version_needed,
                flags,
                compression,
                modified_time,
                modified_date,
                crc,
                compressed_size,
                uncompressed_size,
                name_length,
                extra_length,
            ) = struct.unpack_from("<5H3I2H", archive, local_offset + 4)
        except struct.error as error:
            raise Quarantine("archive_invalid") from error
        name_start = local_offset + 30
        name_end = name_start + name_length
        data_start = name_end + extra_length
        data_end = data_start + compressed_size
        if (
            data_end > central_offset
            or version_needed != record["versionNeeded"]
            or flags != record["flags"]
            or compression != record["compression"]
            or modified_time != record["modifiedTime"]
            or modified_date != record["modifiedDate"]
            or crc != record["crc"]
            or compressed_size != record["compressedSize"]
            or uncompressed_size != record["uncompressedSize"]
            or extra_length != 0
            or archive[name_start:name_end] != record["nameBytes"]
            or _ascii_zip_name(archive[name_start:name_end]) != record["name"]
        ):
            raise Quarantine("archive_invalid")
        name = str(record["name"])
        entry_limit = MAX_MANIFEST_BYTES if name == MANIFEST_NAME else MAX_XML_BYTES
        aggregate_uncompressed += uncompressed_size
        if (
            uncompressed_size > entry_limit
            or aggregate_uncompressed > MAX_AGGREGATE_BYTES
            or _compression_ratio(uncompressed_size, compressed_size)
            > MAX_COMPRESSION_RATIO
        ):
            raise Quarantine("archive_limit_exceeded")
        compressed_payload = archive[data_start:data_end]
        output[name] = _decompress_exact(
            compressed_payload,
            compression,
            uncompressed_size,
            crc,
        )
        local_cursor = data_end
    if local_cursor != central_offset:
        raise Quarantine("archive_invalid")
    if len(output) != 2:
        raise Quarantine("archive_invalid")
    if sum(len(value) for value in output.values()) > MAX_AGGREGATE_BYTES:
        raise Quarantine("archive_limit_exceeded")
    return output


def _ascii_zip_name(value: bytes) -> str:
    try:
        return value.decode("ascii", errors="strict")
    except UnicodeDecodeError as error:
        raise Quarantine("archive_entry_invalid") from error


def _validate_closed_entry(record: dict[str, object]) -> None:
    name = str(record["name"])
    try:
        name.encode("ascii", errors="strict")
    except UnicodeEncodeError as error:
        raise Quarantine("archive_entry_invalid") from error
    path = PurePosixPath(name)
    if (
        not name
        or "\\" in name
        or "\x00" in name
        or path.is_absolute()
        or any(part in ("", ".", "..") for part in path.parts)
        or len(path.parts) != 1
        or name.endswith("/")
    ):
        raise Quarantine("archive_entry_invalid")
    if int(record["versionMade"]) != 0x0314:
        raise Quarantine("archive_entry_invalid")
    external_attributes = int(record["externalAttributes"])
    unix_mode = external_attributes >> 16
    if external_attributes & 0xFFFF or not stat.S_ISREG(unix_mode):
        raise Quarantine("archive_entry_invalid")
    flags = int(record["flags"])
    if flags & 0x1:
        raise Quarantine("archive_encrypted")


def _decompress_exact(
    payload: bytes, compression: int, expected_size: int, expected_crc: int
) -> bytes:
    if compression == zipfile.ZIP_STORED:
        if len(payload) != expected_size:
            raise Quarantine("archive_invalid")
        output = payload
    elif compression == zipfile.ZIP_DEFLATED:
        try:
            inflater = zlib.decompressobj(-zlib.MAX_WBITS)
            output = inflater.decompress(payload, expected_size + 1)
            if len(output) > expected_size or inflater.unconsumed_tail:
                raise Quarantine("archive_invalid")
            remaining = expected_size + 1 - len(output)
            if remaining > 0:
                output += inflater.flush(remaining)
            if (
                len(output) != expected_size
                or not inflater.eof
                or inflater.unused_data
                or inflater.unconsumed_tail
            ):
                raise Quarantine("archive_invalid")
        except Quarantine:
            raise
        except zlib.error as error:
            raise Quarantine("archive_invalid") from error
    else:
        raise Quarantine("archive_invalid")
    if zlib.crc32(output) & 0xFFFFFFFF != expected_crc:
        raise Quarantine("archive_invalid")
    return output


def _is_nested_archive(value: bytes) -> bool:
    return (
        value.startswith(b"PK\x03\x04")
        or value.startswith(b"\x1f\x8b\x08")
        or (len(value) >= 262 and value[257:262] == b"ustar")
    )


def _compression_ratio(uncompressed: int, compressed: int) -> int:
    if uncompressed == 0:
        return 0
    if compressed == 0:
        return MAX_COMPRESSION_RATIO + 1
    return (uncompressed + compressed - 1) // compressed


def _parse_manifest(raw: bytes) -> dict[str, object]:
    if not raw or len(raw) > MAX_MANIFEST_BYTES:
        raise Quarantine("manifest_invalid")
    manifest = _json_object(raw, "manifest_invalid", canonical=True)
    if set(manifest) != {
        "acceptedAt",
        "accession",
        "availableAt",
        "document",
        "schemaVersion",
        "synthetic",
        "taxonomyVersion",
    }:
        raise Quarantine("manifest_invalid")
    if (
        not isinstance(manifest["accession"], str)
        or ACCESSION.fullmatch(manifest["accession"]) is None
        or manifest["document"] != DOCUMENT_NAME
        or manifest["schemaVersion"] != SCHEMA_VERSION
        or manifest["synthetic"] is not True
    ):
        raise Quarantine("manifest_invalid")
    if manifest["taxonomyVersion"] != TAXONOMY_VERSION:
        raise Quarantine("taxonomy_not_allowed")
    accepted = _parse_utc(manifest["acceptedAt"])
    available = _parse_utc(manifest["availableAt"])
    if available < accepted:
        raise Quarantine("manifest_invalid")
    return manifest


def _json_object(raw: bytes, code: str, *, canonical: bool) -> dict[str, object]:
    try:
        text = raw.decode("ascii", errors="strict")
        value = json.loads(
            text,
            object_pairs_hook=lambda pairs: _unique_object(pairs, code),
            parse_constant=lambda _value: _raise(code),
        )
    except Quarantine:
        raise
    except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError) as error:
        raise Quarantine(code) from error
    if type(value) is not dict:
        raise Quarantine(code)
    if canonical and _canonical_json(value) != text:
        raise Quarantine(code)
    return value


def _unique_object(pairs: list[tuple[str, object]], code: str) -> dict[str, object]:
    output: dict[str, object] = {}
    for key, value in pairs:
        if key in output:
            raise Quarantine(code)
        output[key] = value
    return output


def _parse_xml(raw: bytes, taxonomy: dict[str, object]) -> list[dict[str, object]]:
    if not raw or len(raw) > MAX_XML_BYTES:
        raise Quarantine("xml_limit_exceeded")
    try:
        raw.decode("ascii", errors="strict")
    except UnicodeDecodeError as error:
        raise Quarantine("xml_invalid") from error
    lowered = raw.lower()
    if any(marker in lowered for marker in FORBIDDEN_XML_MARKERS):
        raise Quarantine("xml_forbidden_construct")
    if not raw.startswith(XML_DECLARATION):
        raise Quarantine("xml_invalid")
    if b"<?" in raw[len(XML_DECLARATION) :]:
        raise Quarantine("xml_forbidden_construct")

    parser = ElementTree.XMLPullParser(events=("start", "end", "start-ns"))
    depth = 0
    nodes = 0
    namespace_count = 0
    text_codepoints = 0
    root: ElementTree.Element | None = None
    try:
        for offset in range(0, len(raw), 8_192):
            parser.feed(raw[offset : offset + 8_192])
            for event, element in parser.read_events():
                if event == "start-ns":
                    namespace_count += 1
                    prefix, namespace = element
                    if namespace == XINCLUDE_NAMESPACE[1:-1]:
                        raise Quarantine("xml_forbidden_construct")
                    if namespace_count == 1 and prefix == "":
                        if namespace != NAMESPACE:
                            raise Quarantine("taxonomy_not_allowed")
                    else:
                        raise Quarantine("xml_invalid")
                elif event == "start":
                    depth += 1
                    nodes += 1
                    if root is None:
                        root = element
                    if element.tag.startswith(XINCLUDE_NAMESPACE):
                        raise Quarantine("xml_forbidden_construct")
                    if (
                        depth > MAX_XML_DEPTH
                        or nodes > MAX_XML_NODES
                        or len(element.attrib) > MAX_XML_ATTRIBUTES
                    ):
                        raise Quarantine("xml_limit_exceeded")
                else:
                    text_codepoints += len(element.text or "") + len(element.tail or "")
                    if text_codepoints > MAX_XML_TEXT_CODEPOINTS:
                        raise Quarantine("xml_limit_exceeded")
                    depth -= 1
        parser.close()
    except Quarantine:
        raise
    except ElementTree.ParseError as error:
        raise Quarantine("xml_invalid") from error
    if root is None or depth != 0:
        raise Quarantine("xml_invalid")

    root_tag = f"{{{taxonomy['namespace']}}}filing"
    fact_tag = f"{{{taxonomy['namespace']}}}fact"
    if root.tag != root_tag:
        if root.tag == "filing" or root.tag.endswith("}filing"):
            raise Quarantine("taxonomy_not_allowed")
        raise Quarantine("xml_invalid")
    if namespace_count != 1:
        raise Quarantine("xml_invalid")
    if root.attrib != {"taxonomyVersion": TAXONOMY_VERSION}:
        if root.attrib.get("taxonomyVersion") != TAXONOMY_VERSION:
            raise Quarantine("taxonomy_not_allowed")
        raise Quarantine("xml_invalid")
    if (root.text or "").strip():
        raise Quarantine("xml_invalid")

    elements = list(root)
    if len(elements) != len(EXPECTED_CONCEPTS):
        raise Quarantine("fact_invalid")
    concepts = [element.attrib.get("concept") for element in elements]
    if len(set(concepts)) != len(concepts):
        raise Quarantine("fact_ambiguous")
    if any(concept not in EXPECTED_CONCEPTS for concept in concepts):
        raise Quarantine("taxonomy_not_allowed")
    if tuple(concepts) != EXPECTED_CONCEPTS:
        raise Quarantine("fact_invalid")

    facts: list[dict[str, object]] = []
    for element in elements:
        facts.append(_parse_fact(element, fact_tag))
    return facts


def _parse_fact(element: ElementTree.Element, expected_tag: str) -> dict[str, object]:
    if element.tag != expected_tag or list(element):
        if element.tag.startswith("{") and element.tag != expected_tag:
            raise Quarantine("taxonomy_not_allowed")
        raise Quarantine("fact_invalid")
    attributes = element.attrib
    if set(attributes) != {
        "concept",
        "dimensions",
        "periodEnd",
        "periodStart",
        "unit",
    }:
        raise Quarantine("fact_invalid")
    if attributes["dimensions"] != "none" or attributes["unit"] != EXPECTED_UNIT:
        raise Quarantine("fact_invalid")
    period_start = _parse_date(attributes["periodStart"])
    period_end = _parse_date(attributes["periodEnd"])
    if period_end < period_start:
        raise Quarantine("fact_invalid")
    value = element.text or ""
    if value != value.strip() or DECIMAL.fullmatch(value) is None:
        raise Quarantine("fact_invalid")
    if (element.tail or "").strip():
        raise Quarantine("xml_invalid")
    return {
        "concept": attributes["concept"],
        "dimensions": {},
        "periodEnd": attributes["periodEnd"],
        "periodStart": attributes["periodStart"],
        "unit": EXPECTED_UNIT,
        "value": value,
    }


def _parse_utc(value: object) -> datetime:
    if type(value) is not str or ISO_UTC.fullmatch(value) is None:
        raise Quarantine("manifest_invalid")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise Quarantine("manifest_invalid") from error
    if parsed.isoformat(timespec="milliseconds").replace("+00:00", "Z") != value:
        raise Quarantine("manifest_invalid")
    return parsed


def _parse_date(value: str) -> date:
    if ISO_DATE.fullmatch(value) is None:
        raise Quarantine("fact_invalid")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise Quarantine("fact_invalid") from error
    if parsed.isoformat() != value:
        raise Quarantine("fact_invalid")
    return parsed


def _canonical_json(value: object) -> str:
    return json.dumps(
        value,
        ensure_ascii=True,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _quarantined(source_sha256: str, code: str) -> dict[str, object]:
    if code not in QUARANTINE_CODES:
        code = "worker_failure"
    return {
        "code": code,
        "facts": [],
        "parserVersion": PARSER_VERSION,
        "schemaVersion": SCHEMA_VERSION,
        "sourceSha256": source_sha256,
        "status": "quarantined",
        "synthetic": True,
        "taxonomyVersion": TAXONOMY_VERSION,
    }


def _raise(code: str) -> None:
    raise Quarantine(code)


def main() -> int:
    try:
        with open(INPUT_PATH, "rb") as archive_file:
            archive = archive_file.read(MAX_ARCHIVE_BYTES + 1)
    except Exception:
        archive = b""
    result = parse_archive_bytes(archive)
    try:
        sys.stdout.write(_canonical_json(result) + "\n")
        sys.stdout.flush()
    except Exception:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
