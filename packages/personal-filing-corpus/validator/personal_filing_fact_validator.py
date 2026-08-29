"""Independent validator for the personal filing fact normalization boundary.

The process accepts one canonical JSON request on stdin and writes one canonical
JSON result on stdout.  It deliberately uses only the Python standard library
and never reports input-derived details on failure.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import re
import sys
from typing import Any, NoReturn


SCHEMA_VERSION = "1.0.0"
PROFILE = "personal_single_user_local"
CLAIM = (
    "bounded_private_ten_fact_normalization_and_manifest_linked_lineage_"
    "for_personal_single_user_local_use"
)
FORMULA = "operating_cash_flow_minus_capital_expenditures"
FACT_ID_DOMAIN = b"research-cockpit:personal-normalized-filing-fact:v1\0"

REQUEST_BYTES = 1_200_000
OUTPUT_BYTES = 1_048_576
DECLARATION_BYTES = 8_192
MANIFEST_BYTES = 524_288
PLAN_BYTES = 32_768
SOURCE_DOCUMENT_BYTES = 131_072
MAX_SAFE_INTEGER = 9_007_199_254_740_991

FACT_CONTRACTS = (
    ("assets", "instant", "USD"),
    ("cash", "instant", "USD"),
    ("debt", "instant", "USD"),
    ("diluted_shares", "duration", "shares"),
    ("free_cash_flow", "duration", "USD"),
    ("gross_profit", "duration", "USD"),
    ("net_income", "duration", "USD"),
    ("operating_cash_flow", "duration", "USD"),
    ("operating_income", "duration", "USD"),
    ("revenue", "duration", "USD"),
)

REQUEST_KEYS = frozenset(
    ("declaration", "manifest", "normalizationPlan", "sourceDocuments")
)
DECLARATION_KEYS = frozenset(
    (
        "commercialUse",
        "corpusId",
        "corpusVersion",
        "deleteOnRequest",
        "deletionMode",
        "localOnly",
        "manifestSha256",
        "profile",
        "purpose",
        "redistribution",
        "retentionDays",
        "schemaVersion",
        "singleUser",
    )
)
MANIFEST_KEYS = frozenset(
    ("corpusId", "corpusVersion", "entries", "frozenAt", "profile", "schemaVersion")
)
MANIFEST_ENTRY_KEYS = frozenset(
    (
        "acceptedAt",
        "accession",
        "amendmentOf",
        "availableAt",
        "cik",
        "contentBytes",
        "contentSha256",
        "form",
        "mediaType",
        "source",
        "sourceLocator",
        "taxonomy",
    )
)
PLAN_KEYS = frozenset(
    (
        "corpusId",
        "corpusVersion",
        "declarationSha256",
        "manifestSha256",
        "mappings",
        "parserVersion",
        "profile",
        "schemaVersion",
        "taxonomy",
    )
)
DIRECT_MAPPING_KEYS = frozenset(
    ("key", "kind", "periodKind", "sourceConcept", "unit")
)
DERIVED_MAPPING_KEYS = frozenset(
    (
        "formula",
        "key",
        "kind",
        "minuendConcept",
        "periodKind",
        "subtrahendConcept",
        "unit",
    )
)
SOURCE_DOCUMENT_KEYS = frozenset(
    (
        "accession",
        "acceptedAt",
        "amendmentOf",
        "availableAt",
        "cik",
        "contentSha256",
        "facts",
        "form",
        "normalizationPlanSha256",
        "parserVersion",
        "schemaVersion",
        "synthetic",
        "taxonomy",
    )
)
SOURCE_FACT_KEYS = frozenset(
    ("concept", "derivation", "dimensions", "key", "periodEnd", "periodStart", "unit", "value")
)
DERIVATION_KEYS = frozenset(("formula", "minuend", "subtrahend"))
OPERAND_KEYS = frozenset(
    ("concept", "dimensions", "periodEnd", "periodStart", "unit", "value")
)

HASH_RE = re.compile(r"sha256:[0-9a-f]{64}\Z", re.ASCII)
ACCESSION_RE = re.compile(r"[0-9]{10}-[0-9]{2}-[0-9]{6}\Z", re.ASCII)
CIK_RE = re.compile(r"[0-9]{10}\Z", re.ASCII)
INSTANT_RE = re.compile(
    r"([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})\.([0-9]{3})Z\Z",
    re.ASCII,
)
DATE_RE = re.compile(r"([0-9]{4})-([0-9]{2})-([0-9]{2})\Z", re.ASCII)
SAFE_ID_RE = re.compile(r"[a-z][a-z0-9._:-]{2,127}\Z", re.ASCII)
TAXONOMY_RE = re.compile(r"[a-z][a-z0-9.-]{2,63}\Z", re.ASCII)
PARSER_RE = re.compile(r"[a-z][a-z0-9._-]{2,63}\Z", re.ASCII)
QNAME_RE = re.compile(
    r"[A-Za-z_][A-Za-z0-9_.-]{0,63}:[A-Za-z_][A-Za-z0-9_.-]{0,127}\Z",
    re.ASCII,
)
DECIMAL_RE = re.compile(
    r"-?(?:0|[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?\Z", re.ASCII
)


class Invalid(Exception):
    """A deliberately detail-free boundary failure."""


def fail() -> NoReturn:
    raise Invalid()


def quarantine_record() -> dict[str, Any]:
    return {
        "audit": {
            "factVersionCount": 0,
            "lineageCount": 0,
            "outcome": "quarantined",
            "sourceDocumentCount": 0,
        },
        "claim": CLAIM,
        "code": "normalization_failure",
        "factVersions": [],
        "lineage": [],
        "schemaVersion": SCHEMA_VERSION,
        "status": "quarantined",
        "synthetic": False,
    }


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def duplicate_safe_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            fail()
        result[key] = value
    return result


def reject_number(_value: str) -> NoReturn:
    fail()


def load_json(raw: bytes) -> tuple[str, Any]:
    try:
        text = raw.decode("utf-8", errors="strict")
        value = json.loads(
            text,
            object_pairs_hook=duplicate_safe_object,
            parse_float=reject_number,
            parse_constant=reject_number,
        )
    except (UnicodeError, json.JSONDecodeError, Invalid, ValueError, TypeError):
        fail()
    return text, value


def validate_tree(
    root: Any,
    *,
    max_depth: int,
    max_nodes: int,
    max_strings: int,
    utf16_strings: bool = False,
) -> None:
    stack: list[tuple[int, Any]] = [(0, root)]
    nodes = 0
    strings = 0
    while stack:
        depth, value = stack.pop()
        nodes += 1
        if nodes > max_nodes or depth > max_depth:
            fail()
        if isinstance(value, str):
            strings += string_length(value, utf16_strings)
        elif value is None or type(value) is bool:
            pass
        elif type(value) is int:
            if value < -MAX_SAFE_INTEGER or value > MAX_SAFE_INTEGER:
                fail()
        elif type(value) is list:
            stack.extend((depth + 1, item) for item in value)
        elif type(value) is dict:
            for key, item in value.items():
                if type(key) is not str:
                    fail()
                strings += string_length(key, utf16_strings)
                stack.append((depth + 1, item))
        else:
            fail()
        if strings > max_strings:
            fail()


def string_length(value: str, utf16: bool) -> int:
    if not utf16:
        return len(value)
    return len(value.encode("utf-16-le", errors="surrogatepass")) // 2


def parse_canonical_document(
    raw: bytes,
    maximum_bytes: int,
    *,
    max_depth: int,
    max_nodes: int,
    max_strings: int,
    utf16_strings: bool = False,
) -> Any:
    if len(raw) < 3 or len(raw) > maximum_bytes:
        fail()
    text, value = load_json(raw)
    validate_tree(
        value,
        max_depth=max_depth,
        max_nodes=max_nodes,
        max_strings=max_strings,
        utf16_strings=utf16_strings,
    )
    if canonical_json(value) + "\n" != text:
        fail()
    return value


def exact_record(value: Any, keys: frozenset[str]) -> dict[str, Any]:
    if type(value) is not dict or len(value) != len(keys) or set(value) != keys:
        fail()
    return value


def exact_empty_record(value: Any) -> bool:
    return type(value) is dict and not value


def strict_base64(value: Any, maximum_bytes: int) -> bytes:
    if type(value) is not str or len(value) > ((maximum_bytes + 2) // 3) * 4:
        fail()
    try:
        encoded = value.encode("ascii", errors="strict")
        decoded = bytes(base64.b64decode(encoded, validate=True))
    except (UnicodeError, binascii.Error, ValueError):
        fail()
    if len(decoded) < 3 or len(decoded) > maximum_bytes:
        fail()
    if base64.b64encode(decoded) != encoded:
        fail()
    return decoded


def sha256(raw: bytes) -> str:
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def is_int(value: Any) -> bool:
    return type(value) is int and -MAX_SAFE_INTEGER <= value <= MAX_SAFE_INTEGER


def valid_date_parts(year: int, month: int, day: int) -> bool:
    if month < 1 or month > 12 or day < 1:
        return False
    leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
    month_days = (31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    return day <= month_days[month - 1]


def is_iso_date(value: Any) -> bool:
    if type(value) is not str:
        return False
    match = DATE_RE.fullmatch(value)
    return bool(match) and valid_date_parts(*(int(part) for part in match.groups()))


def is_iso_instant(value: Any) -> bool:
    if type(value) is not str:
        return False
    match = INSTANT_RE.fullmatch(value)
    if not match:
        return False
    year, month, day, hour, minute, second, _millisecond = (
        int(part) for part in match.groups()
    )
    return (
        valid_date_parts(year, month, day)
        and 0 <= hour <= 23
        and 0 <= minute <= 59
        and 0 <= second <= 59
    )


def is_canonical_decimal(value: Any) -> bool:
    if type(value) is not str or value == "-0" or not DECIMAL_RE.fullmatch(value):
        return False
    unsigned = value[1:] if value.startswith("-") else value
    integer, separator, fraction = unsigned.partition(".")
    return len(integer) <= 26 and len(fraction if separator else "") <= 12 and len(integer) + len(fraction) <= 38


def decimal_parts(value: str) -> tuple[int, int]:
    negative = value.startswith("-")
    unsigned = value[1:] if negative else value
    integer, separator, fraction = unsigned.partition(".")
    coefficient = int(integer + (fraction if separator else ""))
    return (-coefficient if negative else coefficient, len(fraction) if separator else 0)


def format_decimal(coefficient: int, scale: int) -> str:
    if coefficient == 0:
        return "0"
    negative = coefficient < 0
    digits = str(abs(coefficient)).rjust(scale + 1, "0")
    if scale == 0:
        return ("-" if negative else "") + digits
    integer = digits[:-scale]
    fraction = digits[-scale:].rstrip("0")
    return ("-" if negative else "") + integer + (("." + fraction) if fraction else "")


def subtract_decimals(minuend: str, subtrahend: str) -> str:
    left, left_scale = decimal_parts(minuend)
    right, right_scale = decimal_parts(subtrahend)
    scale = max(left_scale, right_scale)
    result = left * (10 ** (scale - left_scale)) - right * (10 ** (scale - right_scale))
    formatted = format_decimal(result, scale)
    if not is_canonical_decimal(formatted):
        fail()
    return formatted


def validate_declaration(value: Any, manifest_digest: str) -> dict[str, Any]:
    record = exact_record(value, DECLARATION_KEYS)
    if not (
        record["schemaVersion"] == SCHEMA_VERSION
        and record["profile"] == PROFILE
        and record["purpose"] == "personal_offline_filing_research_only"
        and record["singleUser"] is True
        and record["localOnly"] is True
        and record["commercialUse"] == "prohibited"
        and record["redistribution"] == "prohibited"
        and record["deleteOnRequest"] is True
        and record["deletionMode"] == "user_managed_local_delete"
        and type(record["corpusId"]) is str
        and SAFE_ID_RE.fullmatch(record["corpusId"])
        and record["corpusVersion"] == SCHEMA_VERSION
        and type(record["manifestSha256"]) is str
        and HASH_RE.fullmatch(record["manifestSha256"])
        and record["manifestSha256"] == manifest_digest
        and is_int(record["retentionDays"])
        and 1 <= record["retentionDays"] <= 3_650
    ):
        fail()
    return record


def validate_manifest(value: Any) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    record = exact_record(value, MANIFEST_KEYS)
    entries = record["entries"]
    if not (
        record["schemaVersion"] == SCHEMA_VERSION
        and record["profile"] == PROFILE
        and type(record["corpusId"]) is str
        and SAFE_ID_RE.fullmatch(record["corpusId"])
        and record["corpusVersion"] == SCHEMA_VERSION
        and is_iso_instant(record["frozenAt"])
        and type(entries) is list
        and 1 <= len(entries) <= 100
    ):
        fail()

    prior_by_accession: dict[str, dict[str, Any]] = {}
    content_hashes: set[str] = set()
    previous_accession = ""
    total_bytes = 0
    validated: list[dict[str, Any]] = []
    for raw_entry in entries:
        entry = exact_record(raw_entry, MANIFEST_ENTRY_KEYS)
        accession = entry["accession"]
        cik = entry["cik"]
        form = entry["form"]
        content_digest = entry["contentSha256"]
        amendment_of = entry["amendmentOf"]
        if not (
            type(accession) is str
            and ACCESSION_RE.fullmatch(accession)
            and accession > previous_accession
            and type(cik) is str
            and CIK_RE.fullmatch(cik)
            and accession[:10] == cik
            and form in ("10-K", "10-K/A", "10-Q", "10-Q/A")
            and is_iso_instant(entry["acceptedAt"])
            and is_iso_instant(entry["availableAt"])
            and type(content_digest) is str
            and HASH_RE.fullmatch(content_digest)
            and content_digest not in content_hashes
            and is_int(entry["contentBytes"])
            and 1 <= entry["contentBytes"] <= 67_108_864
            and entry["mediaType"] in ("application/xml", "application/zip", "text/html", "text/plain")
            and entry["source"] == "sec_edgar"
            and entry["sourceLocator"] == "sec-edgar:" + accession
            and type(entry["taxonomy"]) is str
            and TAXONOMY_RE.fullmatch(entry["taxonomy"])
            and (amendment_of is None or (type(amendment_of) is str and ACCESSION_RE.fullmatch(amendment_of)))
            and entry["acceptedAt"] <= entry["availableAt"] <= record["frozenAt"]
            and form.endswith("/A") == (amendment_of is not None)
        ):
            fail()
        if amendment_of is not None:
            predecessor = prior_by_accession.get(amendment_of)
            if not (
                predecessor is not None
                and predecessor["cik"] == cik
                and predecessor["form"] == form[:-2]
                and predecessor["acceptedAt"] < entry["acceptedAt"]
                and predecessor["availableAt"] <= entry["availableAt"]
            ):
                fail()
        total_bytes += entry["contentBytes"]
        if total_bytes > 1_073_741_824:
            fail()
        prior_by_accession[accession] = entry
        content_hashes.add(content_digest)
        previous_accession = accession
        validated.append(entry)
    return record, validated


def validate_plan(
    value: Any,
    plan_bytes: bytes,
    declaration_digest: str,
    manifest_digest: str,
    corpus_id: str,
    manifest_entries: list[dict[str, Any]],
) -> dict[str, Any]:
    record = exact_record(value, PLAN_KEYS)
    taxonomy = manifest_entries[0]["taxonomy"] if manifest_entries else None
    mappings = record["mappings"]
    if not (
        record["schemaVersion"] == SCHEMA_VERSION
        and record["profile"] == PROFILE
        and record["corpusId"] == corpus_id
        and record["corpusVersion"] == SCHEMA_VERSION
        and record["declarationSha256"] == declaration_digest
        and record["manifestSha256"] == manifest_digest
        and type(record["parserVersion"]) is str
        and PARSER_RE.fullmatch(record["parserVersion"])
        and type(record["taxonomy"]) is str
        and TAXONOMY_RE.fullmatch(record["taxonomy"])
        and record["taxonomy"] == taxonomy
        and all(entry["taxonomy"] == record["taxonomy"] for entry in manifest_entries)
        and type(mappings) is list
        and len(mappings) == len(FACT_CONTRACTS)
    ):
        fail()

    validated_mappings: list[dict[str, Any]] = []
    direct_concepts: list[str] = []
    for index, raw_mapping in enumerate(mappings):
        key, period_kind, unit = FACT_CONTRACTS[index]
        if key == "free_cash_flow":
            mapping = exact_record(raw_mapping, DERIVED_MAPPING_KEYS)
            if not (
                mapping["key"] == key
                and mapping["kind"] == "subtraction"
                and mapping["formula"] == FORMULA
                and mapping["periodKind"] == period_kind
                and mapping["unit"] == unit
                and type(mapping["minuendConcept"]) is str
                and QNAME_RE.fullmatch(mapping["minuendConcept"])
                and type(mapping["subtrahendConcept"]) is str
                and QNAME_RE.fullmatch(mapping["subtrahendConcept"])
            ):
                fail()
        else:
            mapping = exact_record(raw_mapping, DIRECT_MAPPING_KEYS)
            if not (
                mapping["key"] == key
                and mapping["kind"] == "direct"
                and mapping["periodKind"] == period_kind
                and mapping["unit"] == unit
                and type(mapping["sourceConcept"]) is str
                and QNAME_RE.fullmatch(mapping["sourceConcept"])
            ):
                fail()
            direct_concepts.append(mapping["sourceConcept"])
        validated_mappings.append(mapping)

    free_cash_flow = validated_mappings[4]
    operating_cash_flow = validated_mappings[7]
    if not (
        operating_cash_flow["kind"] == "direct"
        and free_cash_flow["kind"] == "subtraction"
        and free_cash_flow["minuendConcept"] == operating_cash_flow["sourceConcept"]
        and free_cash_flow["subtrahendConcept"] != free_cash_flow["minuendConcept"]
        and len(set(direct_concepts)) == len(direct_concepts)
        and free_cash_flow["subtrahendConcept"] not in direct_concepts
    ):
        fail()
    return {
        "mappings": validated_mappings,
        "parserVersion": record["parserVersion"],
        "planSha256": sha256(plan_bytes),
        "taxonomy": record["taxonomy"],
    }


def validate_operand(
    value: Any, concept: str, period_end: str, period_start: str | None
) -> dict[str, Any]:
    record = exact_record(value, OPERAND_KEYS)
    if not (
        period_start is not None
        and record["concept"] == concept
        and exact_empty_record(record["dimensions"])
        and record["periodEnd"] == period_end
        and record["periodStart"] == period_start
        and record["unit"] == "USD"
        and is_canonical_decimal(record["value"])
    ):
        fail()
    return {
        "concept": concept,
        "periodEnd": period_end,
        "periodStart": period_start,
        "unit": "USD",
        "value": record["value"],
    }


def validate_fact(value: Any, index: int, plan: dict[str, Any]) -> dict[str, Any]:
    record = exact_record(value, SOURCE_FACT_KEYS)
    key, period_kind, unit = FACT_CONTRACTS[index]
    mapping = plan["mappings"][index]
    if not (
        record["key"] == key
        and record["unit"] == unit
        and exact_empty_record(record["dimensions"])
        and is_iso_date(record["periodEnd"])
        and is_canonical_decimal(record["value"])
    ):
        fail()
    if period_kind == "instant":
        if record["periodStart"] is not None:
            fail()
        period_start = None
    else:
        if not is_iso_date(record["periodStart"]) or record["periodStart"] >= record["periodEnd"]:
            fail()
        period_start = record["periodStart"]

    if mapping["kind"] == "direct":
        if record["concept"] != mapping["sourceConcept"] or record["derivation"] is not None:
            fail()
        return {
            "derivation": None,
            "key": key,
            "periodEnd": record["periodEnd"],
            "periodStart": period_start,
            "sourceConcept": mapping["sourceConcept"],
            "unit": unit,
            "value": record["value"],
        }

    if record["concept"] is not None:
        fail()
    derivation = exact_record(record["derivation"], DERIVATION_KEYS)
    if derivation["formula"] != FORMULA:
        fail()
    minuend = validate_operand(
        derivation["minuend"], mapping["minuendConcept"], record["periodEnd"], period_start
    )
    subtrahend = validate_operand(
        derivation["subtrahend"], mapping["subtrahendConcept"], record["periodEnd"], period_start
    )
    if subtract_decimals(minuend["value"], subtrahend["value"]) != record["value"]:
        fail()
    return {
        "derivation": {"minuend": minuend, "subtrahend": subtrahend},
        "key": key,
        "periodEnd": record["periodEnd"],
        "periodStart": period_start,
        "sourceConcept": None,
        "unit": unit,
        "value": record["value"],
    }


def validate_source_document(
    value: Any,
    source_bytes: bytes,
    manifest_entry: dict[str, Any],
    plan: dict[str, Any],
) -> dict[str, Any]:
    record = exact_record(value, SOURCE_DOCUMENT_KEYS)
    if not (
        record["schemaVersion"] == SCHEMA_VERSION
        and record["synthetic"] is False
        and record["accession"] == manifest_entry["accession"]
        and record["cik"] == manifest_entry["cik"]
        and record["form"] == manifest_entry["form"]
        and record["amendmentOf"] == manifest_entry["amendmentOf"]
        and record["acceptedAt"] == manifest_entry["acceptedAt"]
        and record["availableAt"] == manifest_entry["availableAt"]
        and record["contentSha256"] == manifest_entry["contentSha256"]
        and record["parserVersion"] == plan["parserVersion"]
        and record["taxonomy"] == plan["taxonomy"]
        and record["normalizationPlanSha256"] == plan["planSha256"]
        and type(record["facts"]) is list
        and len(record["facts"]) == len(FACT_CONTRACTS)
    ):
        fail()
    facts = [validate_fact(fact, index, plan) for index, fact in enumerate(record["facts"])]
    instant = facts[0]
    duration = facts[3]
    free_cash_flow = facts[4]
    operating_cash_flow = facts[7]
    if not (
        instant["periodStart"] is None
        and duration["periodStart"] is not None
        and instant["periodEnd"] == duration["periodEnd"]
        and instant["periodEnd"] < manifest_entry["acceptedAt"][:10]
        and free_cash_flow["derivation"] is not None
        and free_cash_flow["derivation"]["minuend"]["value"] == operating_cash_flow["value"]
        and free_cash_flow["derivation"]["minuend"]["concept"] == operating_cash_flow["sourceConcept"]
    ):
        fail()
    for index, fact in enumerate(facts):
        _key, period_kind, _unit = FACT_CONTRACTS[index]
        if fact["periodEnd"] != instant["periodEnd"]:
            fail()
        expected_start = None if period_kind == "instant" else duration["periodStart"]
        if fact["periodStart"] != expected_start:
            fail()
    return {
        "accession": manifest_entry["accession"],
        "acceptedAt": manifest_entry["acceptedAt"],
        "amendmentOf": manifest_entry["amendmentOf"],
        "availableAt": manifest_entry["availableAt"],
        "cik": manifest_entry["cik"],
        "contentSha256": manifest_entry["contentSha256"],
        "documentSha256": sha256(source_bytes),
        "facts": facts,
        "form": manifest_entry["form"],
    }


def validate_source_set(documents: list[dict[str, Any]]) -> None:
    original = documents[0]
    if original["form"] != "10-K" or original["amendmentOf"] is not None:
        fail()
    if len(documents) == 1:
        return
    amendment = documents[1]
    if not (
        amendment["form"] == "10-K/A"
        and amendment["amendmentOf"] == original["accession"]
        and amendment["cik"] == original["cik"]
        and original["availableAt"] < amendment["availableAt"]
        and original["contentSha256"] != amendment["contentSha256"]
    ):
        fail()
    for predecessor, successor in zip(original["facts"], amendment["facts"], strict=True):
        if not (
            predecessor["key"] == successor["key"]
            and predecessor["periodStart"] == successor["periodStart"]
            and predecessor["periodEnd"] == successor["periodEnd"]
        ):
            fail()


def fact_id(plan: dict[str, Any], document: dict[str, Any], fact: dict[str, Any]) -> str:
    payload = canonical_json(
        {
            "accession": document["accession"],
            "acceptedAt": document["acceptedAt"],
            "amendmentOf": document["amendmentOf"],
            "availableAt": document["availableAt"],
            "contentSha256": document["contentSha256"],
            "derivation": fact["derivation"],
            "documentSha256": document["documentSha256"],
            "key": fact["key"],
            "normalizationPlanSha256": plan["planSha256"],
            "periodEnd": fact["periodEnd"],
            "periodStart": fact["periodStart"],
            "sourceConcept": fact["sourceConcept"],
            "taxonomy": plan["taxonomy"],
            "unit": fact["unit"],
            "value": fact["value"],
        }
    ).encode("utf-8")
    return "fact:sha256:" + hashlib.sha256(FACT_ID_DOMAIN + payload).hexdigest()


def normalized_operand(operand: dict[str, Any]) -> dict[str, Any]:
    return {
        "concept": operand["concept"],
        "dimensions": {},
        "periodEnd": operand["periodEnd"],
        "periodStart": operand["periodStart"],
        "unit": "USD",
        "value": operand["value"],
    }


def normalized_fact_version(
    plan: dict[str, Any],
    document: dict[str, Any],
    fact: dict[str, Any],
    identifier: str,
    predecessor_identifier: str | None,
    successor_identifier: str | None,
    known_to_exclusive: str | None,
) -> dict[str, Any]:
    derivation = fact["derivation"]
    normalized_derivation = None
    if derivation is not None:
        normalized_derivation = {
            "formula": FORMULA,
            "minuend": normalized_operand(derivation["minuend"]),
            "subtrahend": normalized_operand(derivation["subtrahend"]),
        }
    return {
        "derivation": normalized_derivation,
        "dimensions": {},
        "factId": identifier,
        "key": fact["key"],
        "knownFrom": document["availableAt"],
        "knownToExclusive": known_to_exclusive,
        "parserVersion": plan["parserVersion"],
        "periodEnd": fact["periodEnd"],
        "periodStart": fact["periodStart"],
        "predecessorFactId": predecessor_identifier,
        "sourceAcceptedAt": document["acceptedAt"],
        "sourceAccession": document["accession"],
        "sourceAvailableAt": document["availableAt"],
        "sourceConcept": fact["sourceConcept"],
        "sourceContentSha256": document["contentSha256"],
        "sourceDocumentSha256": document["documentSha256"],
        "successorFactId": successor_identifier,
        "synthetic": False,
        "taxonomy": plan["taxonomy"],
        "unit": fact["unit"],
        "value": fact["value"],
    }


def normalized_result(
    declaration: dict[str, Any],
    declaration_digest: str,
    manifest_digest: str,
    plan: dict[str, Any],
    documents: list[dict[str, Any]],
) -> dict[str, Any]:
    original = documents[0]
    amendment = documents[1] if len(documents) == 2 else None
    predecessor_ids = [fact_id(plan, original, fact) for fact in original["facts"]]
    successor_ids = (
        [fact_id(plan, amendment, fact) for fact in amendment["facts"]]
        if amendment is not None
        else None
    )
    fact_versions = [
        normalized_fact_version(
            plan,
            original,
            fact,
            predecessor_ids[index],
            None,
            successor_ids[index] if successor_ids is not None else None,
            amendment["availableAt"] if amendment is not None else None,
        )
        for index, fact in enumerate(original["facts"])
    ]
    if amendment is not None and successor_ids is not None:
        fact_versions.extend(
            normalized_fact_version(
                plan,
                amendment,
                fact,
                successor_ids[index],
                predecessor_ids[index],
                None,
                None,
            )
            for index, fact in enumerate(amendment["facts"])
        )
        lineage = [
            {
                "effectiveAt": amendment["availableAt"],
                "key": key,
                "predecessorFactId": predecessor_ids[index],
                "successorFactId": successor_ids[index],
            }
            for index, (key, _period_kind, _unit) in enumerate(FACT_CONTRACTS)
        ]
    else:
        lineage = []
    return {
        "audit": {
            "factVersionCount": len(fact_versions),
            "lineageCount": len(lineage),
            "outcome": "normalized",
            "sourceDocumentCount": len(documents),
        },
        "claim": CLAIM,
        "corpusId": declaration["corpusId"],
        "corpusVersion": declaration["corpusVersion"],
        "declarationSha256": declaration_digest,
        "factVersions": fact_versions,
        "lineage": lineage,
        "lineageScope": "issuer_filing_versions_within_exact_frozen_manifest_only",
        "lineageStatus": (
            "amendment_supersession_observed"
            if amendment is not None
            else "root_only_no_in_corpus_amendment"
        ),
        "manifestSha256": manifest_digest,
        "normalizationPlanSha256": plan["planSha256"],
        "nullKnownToScope": "no_later_version_within_exact_frozen_manifest_only",
        "ownerCorrectionStatus": "not_modeled",
        "schemaVersion": SCHEMA_VERSION,
        "sourceDocumentSha256s": [document["documentSha256"] for document in documents],
        "status": "normalized_for_personal_use",
        "synthetic": False,
    }


def process(raw_request: bytes) -> dict[str, Any]:
    if len(raw_request) < 3 or len(raw_request) > REQUEST_BYTES:
        fail()
    request_text, request = load_json(raw_request)
    validate_tree(request, max_depth=3, max_nodes=16, max_strings=REQUEST_BYTES)
    if canonical_json(request) + "\n" != request_text:
        fail()
    request = exact_record(request, REQUEST_KEYS)
    declaration_bytes = strict_base64(request["declaration"], DECLARATION_BYTES)
    manifest_bytes = strict_base64(request["manifest"], MANIFEST_BYTES)
    plan_bytes = strict_base64(request["normalizationPlan"], PLAN_BYTES)
    encoded_sources = request["sourceDocuments"]
    if type(encoded_sources) is not list or not 1 <= len(encoded_sources) <= 2:
        fail()
    source_bytes = [
        strict_base64(encoded_source, SOURCE_DOCUMENT_BYTES)
        for encoded_source in encoded_sources
    ]

    declaration_digest = sha256(declaration_bytes)
    manifest_digest = sha256(manifest_bytes)
    declaration_value = parse_canonical_document(
        declaration_bytes,
        DECLARATION_BYTES,
        max_depth=8,
        max_nodes=4_096,
        max_strings=262_144,
        utf16_strings=True,
    )
    manifest_value = parse_canonical_document(
        manifest_bytes,
        MANIFEST_BYTES,
        max_depth=8,
        max_nodes=4_096,
        max_strings=262_144,
        utf16_strings=True,
    )
    declaration = validate_declaration(declaration_value, manifest_digest)
    manifest, manifest_entries = validate_manifest(manifest_value)
    if (
        declaration["corpusId"] != manifest["corpusId"]
        or declaration["corpusVersion"] != manifest["corpusVersion"]
    ):
        fail()
    if not 1 <= len(manifest_entries) <= 2 or len(source_bytes) != len(manifest_entries):
        fail()
    root = manifest_entries[0]
    amendment = manifest_entries[1] if len(manifest_entries) == 2 else None
    if not (
        root["form"] == "10-K"
        and root["amendmentOf"] is None
        and (
            amendment is None
            or (
                amendment["form"] == "10-K/A"
                and amendment["amendmentOf"] == root["accession"]
                and amendment["cik"] == root["cik"]
            )
        )
    ):
        fail()

    plan_value = parse_canonical_document(
        plan_bytes,
        PLAN_BYTES,
        max_depth=9,
        max_nodes=768,
        max_strings=65_536,
    )
    plan = validate_plan(
        plan_value,
        plan_bytes,
        declaration_digest,
        manifest_digest,
        declaration["corpusId"],
        manifest_entries,
    )
    documents = []
    for raw_source, manifest_entry in zip(source_bytes, manifest_entries, strict=True):
        source_value = parse_canonical_document(
            raw_source,
            SOURCE_DOCUMENT_BYTES,
            max_depth=9,
            max_nodes=768,
            max_strings=65_536,
        )
        documents.append(validate_source_document(source_value, raw_source, manifest_entry, plan))
    validate_source_set(documents)
    return normalized_result(
        declaration, declaration_digest, manifest_digest, plan, documents
    )


def main() -> None:
    result: dict[str, Any] = quarantine_record()
    try:
        if len(sys.argv) != 1:
            fail()
        raw_request = bytes(sys.stdin.buffer.read(REQUEST_BYTES + 1))
        result = process(raw_request)
        output = (canonical_json(result) + "\n").encode("utf-8")
        if len(output) > OUTPUT_BYTES:
            fail()
    except BaseException:
        result = quarantine_record()
        output = (canonical_json(result) + "\n").encode("utf-8")
    try:
        sys.stdout.buffer.write(output)
        sys.stdout.buffer.flush()
    except BaseException:
        pass


if __name__ == "__main__":
    main()
