"""Closed synthetic ten-fact parser used only by the Cycle 2j boundary."""

from __future__ import annotations

import hashlib
import json
import re
import stat
import struct
import sys
import zlib
from datetime import date, datetime
from pathlib import PurePosixPath
from typing import Final
from xml.etree import ElementTree


INPUT_PATH: Final = "/input/filing.zip"
TAXONOMY_PATH: Final = "/worker/taxonomy-v1.json"
MANIFEST_NAME: Final = "filing-manifest.json"
DOCUMENT_NAME: Final = "filing.xml"
EXPECTED_NAMES: Final = (MANIFEST_NAME, DOCUMENT_NAME)
SCHEMA_VERSION: Final = "1.0.0"
PARSER_VERSION: Final = "synthetic-ten-fact-producer-v1"
TAXONOMY_FAMILY: Final = "rc-synthetic-ten-fact"
TAXONOMY_VERSION: Final = "1.0.0"
NAMESPACE: Final = (
    "urn:research-cockpit:synthetic:filing-normalization-execution:v1"
)

FACT_CONTRACTS: Final = (
    ("assets", "rc-synthetic:Assets", "instant", "USD"),
    ("cash", "rc-synthetic:CashAndCashEquivalents", "instant", "USD"),
    ("debt", "rc-synthetic:Debt", "instant", "USD"),
    (
        "diluted_shares",
        "rc-synthetic:WeightedAverageDilutedShares",
        "duration",
        "shares",
    ),
    ("free_cash_flow", "rc-synthetic:FreeCashFlow", "duration", "USD"),
    ("gross_profit", "rc-synthetic:GrossProfit", "duration", "USD"),
    ("net_income", "rc-synthetic:NetIncome", "duration", "USD"),
    (
        "operating_cash_flow",
        "rc-synthetic:OperatingCashFlow",
        "duration",
        "USD",
    ),
    ("operating_income", "rc-synthetic:OperatingIncome", "duration", "USD"),
    ("revenue", "rc-synthetic:Revenue", "duration", "USD"),
)

MAX_ARCHIVE_BYTES: Final = 1_048_576
MAX_MANIFEST_BYTES: Final = 16_384
MAX_XML_BYTES: Final = 2_097_152
MAX_AGGREGATE_BYTES: Final = 2_113_536
MAX_COMPRESSION_RATIO: Final = 100
MAX_XML_DEPTH: Final = 64
MAX_XML_NODES: Final = 20_000
MAX_XML_ATTRIBUTES: Final = 16
MAX_XML_TEXT_CODEPOINTS: Final = 1_048_576
MAX_TAXONOMY_BYTES: Final = 16_384

ACCESSION = re.compile(r"SYN-[0-9]{10}-[0-9]{2}-[0-9]{6}\Z", re.ASCII)
ENTITY_ID = re.compile(
    r"entity\.synthetic\.[a-z0-9][a-z0-9._:-]{2,63}\Z", re.ASCII
)
INSTRUMENT_ID = re.compile(
    r"instrument\.synthetic\.[a-z0-9][a-z0-9._:-]{2,63}\Z", re.ASCII
)
ISO_UTC = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z\Z",
    re.ASCII,
)
ISO_DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}\Z", re.ASCII)
DECIMAL = re.compile(
    r"-?(?:0|[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?\Z", re.ASCII
)
XML_DECLARATION: Final = b'<?xml version="1.0" encoding="UTF-8"?>\n'
FORBIDDEN_XML_MARKERS: Final = (
    b"<!doctype",
    b"<!entity",
    b"<![cdata[",
    b"<!--",
)
XINCLUDE_NAMESPACE: Final = "{http://www.w3.org/2001/XInclude}"


class Rejected(Exception):
    """Value-free expected rejection."""


def reject() -> None:
    raise Rejected("synthetic filing rejected")


def canonical_json(value: object) -> str:
    return json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    )


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    output: dict[str, object] = {}
    for key, value in pairs:
        if key in output:
            reject()
        output[key] = value
    return output


def json_object(raw: bytes, *, canonical: bool) -> dict[str, object]:
    try:
        text = raw.decode("ascii", errors="strict")
        value = json.loads(
            text,
            object_pairs_hook=unique_object,
            parse_constant=lambda _value: reject(),
        )
    except Rejected:
        raise
    except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError):
        reject()
    if type(value) is not dict:
        reject()
    if canonical and canonical_json(value) + "\n" != text:
        reject()
    return value


def load_taxonomy() -> dict[str, object]:
    try:
        with open(TAXONOMY_PATH, "rb") as source:
            raw = source.read(MAX_TAXONOMY_BYTES + 1)
    except OSError:
        reject()
    if not raw or len(raw) > MAX_TAXONOMY_BYTES:
        reject()
    taxonomy = json_object(raw, canonical=False)
    expected = {
        "facts": [
            {
                "concept": concept,
                "key": key,
                "periodKind": period_kind,
                "unit": unit,
            }
            for key, concept, period_kind, unit in FACT_CONTRACTS
        ],
        "namespace": NAMESPACE,
        "schemaVersion": SCHEMA_VERSION,
        "taxonomyFamily": TAXONOMY_FAMILY,
        "taxonomyVersion": TAXONOMY_VERSION,
    }
    if taxonomy != expected:
        reject()
    return taxonomy


def read_archive() -> bytes:
    try:
        with open(INPUT_PATH, "rb") as source:
            archive = source.read(MAX_ARCHIVE_BYTES + 1)
    except OSError:
        reject()
    if not archive or len(archive) > MAX_ARCHIVE_BYTES:
        reject()
    return archive


def ascii_name(value: bytes) -> str:
    try:
        return value.decode("ascii", errors="strict")
    except UnicodeDecodeError:
        reject()


def compression_ratio(uncompressed: int, compressed: int) -> int:
    if uncompressed == 0:
        return 0
    if compressed == 0:
        return MAX_COMPRESSION_RATIO + 1
    return (uncompressed + compressed - 1) // compressed


def validate_name(name: str, version_made: int, external_attributes: int) -> None:
    path = PurePosixPath(name)
    unix_mode = external_attributes >> 16
    if (
        not name
        or "\\" in name
        or "\x00" in name
        or path.is_absolute()
        or any(part in ("", ".", "..") for part in path.parts)
        or len(path.parts) != 1
        or name.endswith("/")
        or version_made != 0x0314
        or external_attributes & 0xFFFF
        or not stat.S_ISREG(unix_mode)
    ):
        reject()


def decompress_exact(
    payload: bytes,
    compression: int,
    expected_size: int,
    expected_crc: int,
) -> bytes:
    if compression == 0:
        if len(payload) != expected_size:
            reject()
        output = payload
    elif compression == 8:
        try:
            inflater = zlib.decompressobj(-zlib.MAX_WBITS)
            output = inflater.decompress(payload, expected_size + 1)
            if len(output) > expected_size or inflater.unconsumed_tail:
                reject()
            output += inflater.flush(expected_size + 1 - len(output))
            if (
                len(output) != expected_size
                or not inflater.eof
                or inflater.unused_data
                or inflater.unconsumed_tail
            ):
                reject()
        except Rejected:
            raise
        except zlib.error:
            reject()
    else:
        reject()
    if zlib.crc32(output) & 0xFFFFFFFF != expected_crc:
        reject()
    return output


def read_zip(archive: bytes) -> dict[str, bytes]:
    if (
        len(archive) < 22
        or archive[-22:-18] != b"PK\x05\x06"
        or b"PK\x06\x06" in archive
        or b"PK\x06\x07" in archive
    ):
        reject()
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
    except struct.error:
        reject()
    if (
        disk_number != 0
        or central_disk != 0
        or disk_entries != 2
        or total_entries != 2
        or comment_length != 0
        or central_size == 0
        or central_offset + central_size != len(archive) - 22
    ):
        reject()

    records: list[dict[str, object]] = []
    cursor = central_offset
    for _index in range(total_entries):
        if cursor + 46 > len(archive) or archive[cursor : cursor + 4] != b"PK\x01\x02":
            reject()
        try:
            fields = struct.unpack_from("<6H3I5H2I", archive, cursor + 4)
        except struct.error:
            reject()
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
            or flags != 0x0800
            or compression not in (0, 8)
            or compressed_size == 0xFFFFFFFF
            or uncompressed_size == 0xFFFFFFFF
            or local_offset == 0xFFFFFFFF
            or extra_length != 0
            or entry_comment_length != 0
            or disk_start != 0
            or name_length == 0
        ):
            reject()
        name_bytes = archive[cursor + 46 : cursor + 46 + name_length]
        name = ascii_name(name_bytes)
        validate_name(name, version_made, external_attributes)
        records.append(
            {
                "name": name,
                "name_bytes": name_bytes,
                "version_needed": version_needed,
                "flags": flags,
                "compression": compression,
                "modified_time": modified_time,
                "modified_date": modified_date,
                "crc": crc,
                "compressed_size": compressed_size,
                "uncompressed_size": uncompressed_size,
                "local_offset": local_offset,
            }
        )
        cursor = end
    if cursor != central_offset + central_size:
        reject()
    names = [str(record["name"]) for record in records]
    if tuple(sorted(names)) != tuple(sorted(EXPECTED_NAMES)) or len(set(names)) != 2:
        reject()

    output: dict[str, bytes] = {}
    local_cursor = 0
    aggregate = 0
    for record in sorted(records, key=lambda value: int(value["local_offset"])):
        local_offset = int(record["local_offset"])
        if local_offset != local_cursor or archive[local_offset : local_offset + 4] != b"PK\x03\x04":
            reject()
        try:
            local = struct.unpack_from("<5H3I2H", archive, local_offset + 4)
        except struct.error:
            reject()
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
        ) = local
        name_start = local_offset + 30
        name_end = name_start + name_length
        data_start = name_end + extra_length
        data_end = data_start + compressed_size
        if (
            data_end > central_offset
            or version_needed != record["version_needed"]
            or flags != record["flags"]
            or compression != record["compression"]
            or modified_time != record["modified_time"]
            or modified_date != record["modified_date"]
            or crc != record["crc"]
            or compressed_size != record["compressed_size"]
            or uncompressed_size != record["uncompressed_size"]
            or extra_length != 0
            or archive[name_start:name_end] != record["name_bytes"]
        ):
            reject()
        name = str(record["name"])
        maximum = MAX_MANIFEST_BYTES if name == MANIFEST_NAME else MAX_XML_BYTES
        aggregate += uncompressed_size
        if (
            uncompressed_size > maximum
            or aggregate > MAX_AGGREGATE_BYTES
            or compression_ratio(uncompressed_size, compressed_size)
            > MAX_COMPRESSION_RATIO
        ):
            reject()
        output[name] = decompress_exact(
            archive[data_start:data_end], compression, uncompressed_size, crc
        )
        local_cursor = data_end
    if local_cursor != central_offset or set(output) != set(EXPECTED_NAMES):
        reject()
    if any(
        value.startswith((b"PK\x03\x04", b"\x1f\x8b\x08"))
        or (len(value) >= 262 and value[257:262] == b"ustar")
        for value in output.values()
    ):
        reject()
    return output


def parse_utc(value: object) -> datetime:
    if type(value) is not str or ISO_UTC.fullmatch(value) is None:
        reject()
    try:
        parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError:
        reject()
    if parsed.isoformat(timespec="milliseconds").replace("+00:00", "Z") != value:
        reject()
    return parsed


def parse_date(value: object) -> date:
    if type(value) is not str or ISO_DATE.fullmatch(value) is None:
        reject()
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        reject()
    if parsed.isoformat() != value:
        reject()
    return parsed


def parse_manifest(raw: bytes) -> dict[str, object]:
    if not raw or len(raw) > MAX_MANIFEST_BYTES:
        reject()
    manifest = json_object(raw, canonical=True)
    if set(manifest) != {
        "accession",
        "acceptedAt",
        "amendmentOf",
        "availableAt",
        "document",
        "entityId",
        "form",
        "instrumentId",
        "schemaVersion",
        "synthetic",
        "taxonomyFamily",
        "taxonomyVersion",
    }:
        reject()
    form = manifest["form"]
    amendment_of = manifest["amendmentOf"]
    if (
        type(manifest["accession"]) is not str
        or ACCESSION.fullmatch(manifest["accession"]) is None
        or manifest["document"] != DOCUMENT_NAME
        or type(manifest["entityId"]) is not str
        or ENTITY_ID.fullmatch(manifest["entityId"]) is None
        or type(manifest["instrumentId"]) is not str
        or INSTRUMENT_ID.fullmatch(manifest["instrumentId"]) is None
        or manifest["schemaVersion"] != SCHEMA_VERSION
        or manifest["synthetic"] is not True
        or manifest["taxonomyFamily"] != TAXONOMY_FAMILY
        or manifest["taxonomyVersion"] != TAXONOMY_VERSION
        or form not in ("10-K", "10-K/A")
        or (
            form == "10-K"
            and amendment_of is not None
            or form == "10-K/A"
            and (
                type(amendment_of) is not str
                or ACCESSION.fullmatch(amendment_of) is None
                or amendment_of == manifest["accession"]
            )
        )
    ):
        reject()
    accepted = parse_utc(manifest["acceptedAt"])
    available = parse_utc(manifest["availableAt"])
    if available < accepted:
        reject()
    return manifest


def parse_xml(raw: bytes, taxonomy: dict[str, object]) -> list[dict[str, object]]:
    if not raw or len(raw) > MAX_XML_BYTES:
        reject()
    try:
        raw.decode("ascii", errors="strict")
    except UnicodeDecodeError:
        reject()
    lowered = raw.lower()
    if any(marker in lowered for marker in FORBIDDEN_XML_MARKERS):
        reject()
    if not raw.startswith(XML_DECLARATION) or b"<?" in raw[len(XML_DECLARATION) :]:
        reject()

    parser = ElementTree.XMLPullParser(events=("start", "end", "start-ns"))
    depth = 0
    nodes = 0
    namespace_count = 0
    text_codepoints = 0
    root: ElementTree.Element | None = None
    try:
        for offset in range(0, len(raw), 8192):
            parser.feed(raw[offset : offset + 8192])
            for event, element in parser.read_events():
                if event == "start-ns":
                    namespace_count += 1
                    prefix, namespace = element
                    if namespace == XINCLUDE_NAMESPACE[1:-1]:
                        reject()
                    if namespace_count != 1 or prefix != "" or namespace != NAMESPACE:
                        reject()
                elif event == "start":
                    depth += 1
                    nodes += 1
                    if root is None:
                        root = element
                    if (
                        element.tag.startswith(XINCLUDE_NAMESPACE)
                        or depth > MAX_XML_DEPTH
                        or nodes > MAX_XML_NODES
                        or len(element.attrib) > MAX_XML_ATTRIBUTES
                    ):
                        reject()
                else:
                    text_codepoints += len(element.text or "") + len(element.tail or "")
                    if text_codepoints > MAX_XML_TEXT_CODEPOINTS:
                        reject()
                    depth -= 1
        parser.close()
    except Rejected:
        raise
    except ElementTree.ParseError:
        reject()
    if root is None or depth != 0 or namespace_count != 1:
        reject()
    root_tag = f"{{{taxonomy['namespace']}}}filing"
    fact_tag = f"{{{taxonomy['namespace']}}}fact"
    if (
        root.tag != root_tag
        or root.attrib
        != {
            "taxonomyFamily": TAXONOMY_FAMILY,
            "taxonomyVersion": TAXONOMY_VERSION,
        }
        or (root.text or "").strip()
        or (root.tail or "").strip()
    ):
        reject()
    elements = list(root)
    if len(elements) != len(FACT_CONTRACTS):
        reject()
    facts: list[dict[str, object]] = []
    period_end: str | None = None
    duration_start: str | None = None
    for index, element in enumerate(elements):
        contract = FACT_CONTRACTS[index]
        if element.tag != fact_tag or list(element):
            reject()
        attributes = element.attrib
        if set(attributes) != {
            "concept",
            "dimensions",
            "key",
            "periodEnd",
            "periodStart",
            "unit",
        }:
            reject()
        key, concept, period_kind, unit = contract
        if (
            attributes["key"] != key
            or attributes["concept"] != concept
            or attributes["dimensions"] != "none"
            or attributes["unit"] != unit
        ):
            reject()
        fact_end = parse_date(attributes["periodEnd"])
        if period_end is None:
            period_end = fact_end.isoformat()
        elif fact_end.isoformat() != period_end:
            reject()
        if period_kind == "instant":
            if attributes["periodStart"] != "none":
                reject()
            fact_start: str | None = None
        else:
            parsed_start = parse_date(attributes["periodStart"])
            if parsed_start >= fact_end:
                reject()
            fact_start = parsed_start.isoformat()
            if duration_start is None:
                duration_start = fact_start
            elif fact_start != duration_start:
                reject()
        value = element.text or ""
        if (
            value != value.strip()
            or DECIMAL.fullmatch(value) is None
            or value == "-0"
            or (element.tail or "").strip()
        ):
            reject()
        facts.append(
            {
                "concept": concept,
                "dimensions": {},
                "key": key,
                "periodEnd": fact_end.isoformat(),
                "periodStart": fact_start,
                "unit": unit,
                "value": value,
            }
        )
    if period_end is None or duration_start is None:
        reject()
    return facts


def parse() -> dict[str, object]:
    archive = read_archive()
    taxonomy = load_taxonomy()
    entries = read_zip(archive)
    manifest = parse_manifest(entries[MANIFEST_NAME])
    facts = parse_xml(entries[DOCUMENT_NAME], taxonomy)
    return {
        "accession": manifest["accession"],
        "acceptedAt": manifest["acceptedAt"],
        "amendmentOf": manifest["amendmentOf"],
        "availableAt": manifest["availableAt"],
        "contentSha256": "sha256:" + hashlib.sha256(archive).hexdigest(),
        "entityId": manifest["entityId"],
        "facts": facts,
        "form": manifest["form"],
        "instrumentId": manifest["instrumentId"],
        "parserVersion": PARSER_VERSION,
        "schemaVersion": SCHEMA_VERSION,
        "synthetic": True,
        "taxonomyFamily": TAXONOMY_FAMILY,
        "taxonomyVersion": TAXONOMY_VERSION,
    }


def main() -> int:
    try:
        result = parse()
        serialized = (canonical_json(result) + "\n").encode("ascii")
        if len(serialized) > 131_072:
            reject()
        sys.stdout.buffer.write(serialized)
        sys.stdout.buffer.flush()
        return 0
    except BaseException:
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
