"""Bounded raw HTML/iXBRL fact extractor for the personal filing boundary.

The worker accepts one canonical JSON request on standard input and emits one
canonical JSON result on standard output. It uses only the Python standard
library, performs no filesystem or network access, and deliberately returns no
input-derived detail when any validation or extraction step fails.
"""

from __future__ import annotations

import base64
import binascii
import json
import re
import sys
from html.parser import HTMLParser
from typing import Any, NoReturn


SCHEMA_VERSION = "1.0.0"
MAX_DOCUMENT_BYTES = 32 * 1024 * 1024
MAX_REQUEST_BYTES = 89_500_000
MAX_OUTPUT_BYTES = 1_048_576
MAX_DEPTH = 512
MAX_NODES = 1_000_000
MAX_ATTRIBUTES = 64
MAX_TEXT_CODEPOINTS = 32 * 1024 * 1024
MAX_CONTEXTS = 20_000
MAX_UNITS = 5_000
MAX_TARGET_FACTS = 1_024
MAX_IDENTIFIER_LENGTH = 256
MAX_FACT_TEXT = 4_096
MAX_SAFE_INTEGER = 9_007_199_254_740_991

REQUEST_KEYS = frozenset(("rawFilingDocuments", "targetConcepts"))
QNAME_RE = re.compile(
    r"[A-Za-z_][A-Za-z0-9_.-]{0,63}:[A-Za-z_][A-Za-z0-9_.-]{0,127}\Z",
    re.ASCII,
)
IDENTIFIER_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_.:-]{0,255}\Z", re.ASCII)
DATE_RE = re.compile(r"([0-9]{4})-([0-9]{2})-([0-9]{2})\Z", re.ASCII)
INTEGER_RE = re.compile(r"[+-]?(?:0|[1-9][0-9]{0,3})\Z", re.ASCII)
TRANSFORMATION_NAMESPACE_RE = re.compile(
    r"https?://www\.xbrl\.org/inlineXBRL/transformation/[0-9]{4}-[0-9]{2}-[0-9]{2}\Z",
    re.ASCII,
)
CANONICAL_DECIMAL_RE = re.compile(
    r"-?(?:0|[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?\Z", re.ASCII
)

IX_NAMESPACES = frozenset(
    (
        "http://www.xbrl.org/2008/inlineXBRL",
        "http://www.xbrl.org/2013/inlineXBRL",
    )
)
XBRLI_NAMESPACE = "http://www.xbrl.org/2003/instance"
XBRLDI_NAMESPACE = "http://xbrl.org/2006/xbrldi"
ISO4217_NAMESPACE = "http://www.xbrl.org/2003/iso4217"
XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace"
XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/"
XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance"
XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml"

DOT_FORMATS = frozenset(
    (
        "num-dot-decimal",
        "num-dot-decimal-in",
        "num-dot-decimal-apostrophe",
        "numdotdecimal",
        "numdotdecimalin",
    )
)
COMMA_FORMATS = frozenset(
    (
        "num-comma-decimal",
        "num-comma-decimal-in",
        "num-comma-decimal-apostrophe",
        "numcommadecimal",
        "numcommadecimalin",
    )
)
ZERO_FORMATS = frozenset(("zero-dash", "zerodash"))
GROUPING_SPACES = " \t\r\n\f\v\u00a0\u2007\u202f"
ZERO_DASHES = frozenset(("-", "\u2012", "\u2013", "\u2014", "\u2212"))
HTML_VOID_ELEMENTS = frozenset(
    ("area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr")
)


class Invalid(Exception):
    """A deliberately detail-free boundary failure."""


def fail() -> NoReturn:
    raise Invalid()


def quarantine_result() -> dict[str, Any]:
    return {
        "documents": [],
        "schemaVersion": SCHEMA_VERSION,
        "status": "quarantined",
    }


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
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


def load_request(raw: bytes) -> dict[str, Any]:
    if len(raw) < 3 or len(raw) > MAX_REQUEST_BYTES:
        fail()
    try:
        text = raw.decode("utf-8", errors="strict")
        value = json.loads(
            text,
            object_pairs_hook=duplicate_safe_object,
            parse_float=reject_number,
            parse_constant=reject_number,
        )
    except (UnicodeError, json.JSONDecodeError, Invalid, TypeError, ValueError):
        fail()
    validate_json_tree(value)
    if canonical_json(value) + "\n" != text:
        fail()
    return exact_record(value, REQUEST_KEYS)


def validate_json_tree(root: Any) -> None:
    stack: list[tuple[int, Any]] = [(0, root)]
    nodes = 0
    strings = 0
    while stack:
        depth, value = stack.pop()
        nodes += 1
        if nodes > 64 or depth > 3:
            fail()
        if type(value) is str:
            strings += len(value)
        elif value is None or type(value) is bool:
            pass
        elif type(value) is int:
            if value < -MAX_SAFE_INTEGER or value > MAX_SAFE_INTEGER:
                fail()
        elif type(value) is list:
            stack.extend((depth + 1, item) for item in value)
        elif type(value) is dict:
            for key, item in value.items():
                strings += len(key)
                stack.append((depth + 1, item))
        else:
            fail()
        if strings > MAX_REQUEST_BYTES:
            fail()


def exact_record(value: Any, keys: frozenset[str]) -> dict[str, Any]:
    if type(value) is not dict or len(value) != len(keys) or set(value) != keys:
        fail()
    return value


def strict_base64(value: Any) -> bytes:
    maximum_encoded = ((MAX_DOCUMENT_BYTES + 2) // 3) * 4
    if type(value) is not str or not value or len(value) > maximum_encoded:
        fail()
    try:
        encoded = value.encode("ascii", errors="strict")
        decoded = bytes(base64.b64decode(encoded, validate=True))
    except (UnicodeError, binascii.Error, ValueError):
        fail()
    if not decoded or len(decoded) > MAX_DOCUMENT_BYTES:
        fail()
    if base64.b64encode(decoded) != encoded:
        fail()
    return decoded


def validate_targets(value: Any) -> tuple[str, ...]:
    if type(value) is not list or len(value) != 10:
        fail()
    targets: list[str] = []
    for item in value:
        if type(item) is not str or QNAME_RE.fullmatch(item) is None:
            fail()
        targets.append(item)
    if targets != sorted(targets) or len(set(targets)) != len(targets):
        fail()
    return tuple(targets)


def valid_date(value: str) -> bool:
    match = DATE_RE.fullmatch(value)
    if match is None:
        return False
    year, month, day = (int(part) for part in match.groups())
    if month < 1 or month > 12 or day < 1:
        return False
    leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
    month_days = (31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    return day <= month_days[month - 1]


def canonical_decimal(coefficient: int, scale: int) -> str:
    if coefficient == 0:
        result = "0"
    else:
        negative = coefficient < 0
        digits = str(abs(coefficient)).rjust(scale + 1, "0")
        if scale == 0:
            result = ("-" if negative else "") + digits
        else:
            integer = digits[:-scale]
            fraction = digits[-scale:].rstrip("0")
            result = ("-" if negative else "") + integer
            if fraction:
                result += "." + fraction
    if CANONICAL_DECIMAL_RE.fullmatch(result) is None or result == "-0":
        fail()
    unsigned = result[1:] if result.startswith("-") else result
    integer, separator, fraction = unsigned.partition(".")
    if (
        len(integer) > 26
        or len(fraction if separator else "") > 12
        or len(integer) + len(fraction) > 38
    ):
        fail()
    return result


def parse_grouped_number(
    value: str,
    decimal_mark: str,
    grouping_mark: str | None = None,
    indian_grouping: bool = False,
) -> tuple[int, int]:
    cleaned = value.strip(GROUPING_SPACES)
    if not cleaned:
        fail()
    for space in GROUPING_SPACES:
        cleaned = cleaned.replace(space, "")
    if grouping_mark is None:
        grouping_mark = "," if decimal_mark == "." else "."
    if grouping_mark == "'":
        cleaned = cleaned.replace("\u2019", "'")
    if cleaned.count(decimal_mark) > 1:
        fail()
    integer, separator, fraction = cleaned.partition(decimal_mark)
    if not integer or (separator and (not fraction or not fraction.isascii() or not fraction.isdigit())):
        fail()
    if grouping_mark in integer:
        groups = integer.split(grouping_mark)
        valid_digits = all(group.isascii() and group.isdigit() for group in groups)
        if indian_grouping and len(groups) > 2:
            valid_shape = (
                1 <= len(groups[0]) <= 2
                and all(len(group) == 2 for group in groups[1:-1])
                and len(groups[-1]) == 3
            )
        else:
            valid_shape = 1 <= len(groups[0]) <= 3 and all(
                len(group) == 3 for group in groups[1:]
            )
        if not valid_digits or not valid_shape:
            fail()
        integer = "".join(groups)
    if grouping_mark in fraction or not integer.isascii() or not integer.isdigit():
        fail()
    digits = integer + (fraction if separator else "")
    return int(digits), len(fraction if separator else "")


def transform_numeric(text: str, attributes: dict[str, str]) -> str:
    format_value = attributes.get("format")
    local_format: str | None = None
    if format_value is not None:
        if QNAME_RE.fullmatch(format_value) is None:
            fail()
        local_format = format_value.split(":", 1)[1].lower()

    stripped = text.strip(GROUPING_SPACES)
    if local_format in ZERO_FORMATS:
        if stripped not in ZERO_DASHES:
            fail()
        coefficient, value_scale = 0, 0
    elif local_format in COMMA_FORMATS:
        coefficient, value_scale = parse_grouped_number(
            stripped,
            ",",
            "'" if local_format.endswith("apostrophe") else None,
            local_format.endswith("-in") or local_format.endswith("decimalin"),
        )
    elif local_format is None or local_format in DOT_FORMATS:
        negative_text = stripped.startswith("-")
        positive_text = stripped.startswith("+")
        if negative_text or positive_text:
            if local_format is not None:
                fail()
            stripped = stripped[1:]
        coefficient, value_scale = parse_grouped_number(
            stripped,
            ".",
            "'" if local_format and local_format.endswith("apostrophe") else None,
            bool(local_format)
            and (local_format.endswith("-in") or local_format.endswith("decimalin")),
        )
        if negative_text:
            coefficient = -coefficient
    else:
        fail()

    scale_text = attributes.get("scale", "0")
    if INTEGER_RE.fullmatch(scale_text) is None:
        fail()
    scale_adjustment = int(scale_text)
    if scale_adjustment < -128 or scale_adjustment > 128:
        fail()
    if scale_adjustment >= 0:
        coefficient *= 10**scale_adjustment
    else:
        value_scale += -scale_adjustment

    sign = attributes.get("sign")
    if sign is not None:
        if sign not in ("+", "-") or coefficient < 0:
            fail()
        if sign == "-":
            coefficient = -coefficient
    return canonical_decimal(coefficient, value_scale)


class RawIxbrlParser(HTMLParser):
    """Strict bounded structural reader for the supported inline subset."""

    def __init__(
        self,
        targets: tuple[str, ...],
        target_namespaces: dict[str, str],
    ) -> None:
        super().__init__(convert_charrefs=True)
        self.targets = frozenset(targets)
        self.target_namespaces = target_namespaces
        self.stack: list[tuple[str, dict[str, str]]] = []
        self.contexts: dict[str, dict[str, Any]] = {}
        self.units: dict[str, dict[str, Any]] = {}
        self.pending_facts: list[dict[str, Any]] = []
        self.active_context: dict[str, Any] | None = None
        self.active_context_depth = 0
        self.active_unit: dict[str, Any] | None = None
        self.active_unit_depth = 0
        self.capture: dict[str, Any] | None = None
        self.active_fact: dict[str, Any] | None = None
        self.active_fact_depth = 0
        self.exclude_depth: int | None = None
        self.nodes = 0
        self.text_codepoints = 0
        self.doctype_seen = False
        self.handling_startend = False

    def error(self, _message: str) -> NoReturn:
        fail()

    def handle_decl(self, declaration: str) -> None:
        if self.doctype_seen or declaration.strip().lower() != "doctype html":
            fail()
        self.doctype_seen = True

    def unknown_decl(self, _data: str) -> None:
        fail()

    def handle_pi(self, _data: str) -> None:
        fail()

    def handle_comment(self, _data: str) -> None:
        # Comments carry no fact text and are ignored within the bounded tree.
        return

    def handle_entityref(self, _name: str) -> None:
        fail()

    def handle_charref(self, _name: str) -> None:
        fail()

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        self.handling_startend = True
        try:
            self.handle_starttag(tag, attrs)
            self.handle_endtag(tag)
        finally:
            self.handling_startend = False

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        self.nodes += 1
        if self.nodes > MAX_NODES or len(self.stack) + 1 > MAX_DEPTH:
            fail()
        if len(attrs) > MAX_ATTRIBUTES:
            fail()
        attributes: dict[str, str] = {}
        for key, value in attrs:
            if key in attributes:
                fail()
            attributes[key] = "" if value is None else value

        namespaces = dict(self.stack[-1][1]) if self.stack else {}
        for key, value in attributes.items():
            if key == "xmlns":
                namespaces[""] = value
            elif key.startswith("xmlns:"):
                prefix = key.split(":", 1)[1]
                if not prefix or prefix in ("xml", "xmlns"):
                    fail()
                namespaces[prefix] = value
        namespaces.setdefault("xml", XML_NAMESPACE)
        namespaces.setdefault("xmlns", XMLNS_NAMESPACE)
        self.stack.append((tag, namespaces))

        namespace, local = self.expanded_tag(tag, namespaces)
        depth = len(self.stack)

        if self.active_fact is not None:
            if namespace in IX_NAMESPACES and local == "exclude":
                if self.exclude_depth is not None:
                    fail()
                self.exclude_depth = depth
            elif namespace in IX_NAMESPACES and local in (
                "nonfraction",
                "nonnumeric",
                "continuation",
            ):
                fail()

        if namespace == XBRLI_NAMESPACE and local == "context":
            if self.active_context is not None or self.active_unit is not None:
                fail()
            identifier = attributes.get("id")
            if identifier is None or IDENTIFIER_RE.fullmatch(identifier) is None:
                fail()
            if identifier in self.contexts or len(self.contexts) >= MAX_CONTEXTS:
                fail()
            self.active_context = {
                "dimensionScope": "empty",
                "enddate": None,
                "id": identifier,
                "instant": None,
                "periodDepth": None,
                "periodSeen": False,
                "startdate": None,
            }
            self.active_context_depth = depth
        elif self.active_context is not None:
            if namespace == XBRLI_NAMESPACE and local == "period":
                if (
                    depth != self.active_context_depth + 1
                    or self.active_context["periodDepth"] is not None
                    or self.active_context["periodSeen"]
                ):
                    fail()
                self.active_context["periodDepth"] = depth
            if namespace == XBRLDI_NAMESPACE and local in (
                "explicitmember",
                "typedmember",
            ):
                self.active_context["dimensionScope"] = "nonempty"
            if namespace == XBRLI_NAMESPACE and local in ("segment", "scenario"):
                self.active_context["dimensionScope"] = "nonempty"
            if namespace == XBRLI_NAMESPACE and local in (
                "instant",
                "startdate",
                "enddate",
            ):
                period_depth = self.active_context["periodDepth"]
                if period_depth is None or depth != period_depth + 1:
                    fail()
                self.begin_capture("context", local, depth)

        if namespace == XBRLI_NAMESPACE and local == "unit":
            if self.active_unit is not None or self.active_context is not None:
                fail()
            identifier = attributes.get("id")
            if identifier is None or IDENTIFIER_RE.fullmatch(identifier) is None:
                fail()
            if identifier in self.units or len(self.units) >= MAX_UNITS:
                fail()
            self.active_unit = {"id": identifier, "measures": [], "simple": True}
            self.active_unit_depth = depth
        elif self.active_unit is not None and namespace == XBRLI_NAMESPACE:
            if local == "measure":
                if depth != self.active_unit_depth + 1:
                    self.active_unit["simple"] = False
                self.begin_capture("unit", "measure", depth)
            elif local in ("divide", "unitnumerator", "unitdenominator"):
                self.active_unit["simple"] = False

        if namespace in IX_NAMESPACES and local == "nonfraction":
            concept = attributes.get("name")
            if concept in self.targets:
                if self.active_fact is not None:
                    fail()
                self.validate_target_namespace(concept, namespaces)
                self.validate_target_transform(attributes, namespaces)
                if any(
                    self.attribute_local_name(key) == "nil"
                    and value.strip().lower() in ("1", "true")
                    for key, value in attributes.items()
                ):
                    fail()
                if "continuedat" in attributes:
                    fail()
                context_ref = attributes.get("contextref")
                unit_ref = attributes.get("unitref")
                if (
                    context_ref is None
                    or IDENTIFIER_RE.fullmatch(context_ref) is None
                    or unit_ref is None
                    or IDENTIFIER_RE.fullmatch(unit_ref) is None
                ):
                    fail()
                self.active_fact = {
                    "attributes": attributes,
                    "concept": concept,
                    "contextRef": context_ref,
                    "text": [],
                    "unitRef": unit_ref,
                }
                self.active_fact_depth = depth
                if len(self.pending_facts) >= MAX_TARGET_FACTS:
                    fail()

        if (
            not self.handling_startend
            and ":" not in tag
            and local in HTML_VOID_ELEMENTS
            and namespace in ("", XHTML_NAMESPACE)
        ):
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        if not self.stack or self.stack[-1][0] != tag:
            fail()
        namespaces = self.stack[-1][1]
        namespace, local = self.expanded_tag(tag, namespaces)
        depth = len(self.stack)

        if self.capture is not None and self.capture["depth"] == depth:
            self.finish_capture()

        if self.active_fact is not None and self.active_fact_depth == depth:
            if namespace not in IX_NAMESPACES or local != "nonfraction":
                fail()
            if self.exclude_depth is not None:
                fail()
            self.pending_facts.append(self.active_fact)
            self.active_fact = None
            self.active_fact_depth = 0
        elif self.exclude_depth == depth:
            if namespace not in IX_NAMESPACES or local != "exclude":
                fail()
            self.exclude_depth = None

        if (
            self.active_context is not None
            and namespace == XBRLI_NAMESPACE
            and local == "period"
            and self.active_context["periodDepth"] == depth
        ):
            if self.capture is not None:
                fail()
            self.active_context["periodDepth"] = None
            self.active_context["periodSeen"] = True

        if self.active_context is not None and self.active_context_depth == depth:
            if namespace != XBRLI_NAMESPACE or local != "context":
                fail()
            identifier = self.active_context["id"]
            self.contexts[identifier] = self.active_context
            self.active_context = None
            self.active_context_depth = 0

        if self.active_unit is not None and self.active_unit_depth == depth:
            if namespace != XBRLI_NAMESPACE or local != "unit":
                fail()
            identifier = self.active_unit["id"]
            self.units[identifier] = self.active_unit
            self.active_unit = None
            self.active_unit_depth = 0

        self.stack.pop()

    def handle_data(self, data: str) -> None:
        self.text_codepoints += len(data)
        if self.text_codepoints > MAX_TEXT_CODEPOINTS:
            fail()
        if self.capture is not None:
            self.capture["text"].append(data)
            if sum(len(part) for part in self.capture["text"]) > MAX_IDENTIFIER_LENGTH:
                fail()
        if self.active_fact is not None and self.exclude_depth is None:
            self.active_fact["text"].append(data)
            if sum(len(part) for part in self.active_fact["text"]) > MAX_FACT_TEXT:
                fail()

    @staticmethod
    def attribute_local_name(value: str) -> str:
        return value.split(":", 1)[-1].lower()

    @staticmethod
    def expanded_tag(tag: str, namespaces: dict[str, str]) -> tuple[str, str]:
        if ":" in tag:
            prefix, local = tag.split(":", 1)
            namespace = namespaces.get(prefix.lower())
            if namespace is None or not namespace:
                fail()
            return namespace, local.lower()
        return namespaces.get("", ""), tag.lower()

    def validate_target_namespace(
        self, concept: str, namespaces: dict[str, str]
    ) -> None:
        prefix = concept.split(":", 1)[0]
        namespace = namespaces.get(prefix.lower())
        if (
            namespace is None
            or not namespace
            or namespace in IX_NAMESPACES
            or namespace in (
                XBRLI_NAMESPACE,
                XBRLDI_NAMESPACE,
                ISO4217_NAMESPACE,
                XML_NAMESPACE,
                XMLNS_NAMESPACE,
                XSI_NAMESPACE,
            )
        ):
            fail()
        prior = self.target_namespaces.get(concept)
        if prior is None:
            self.target_namespaces[concept] = namespace
        elif prior != namespace:
            fail()

    @staticmethod
    def validate_target_transform(
        attributes: dict[str, str], namespaces: dict[str, str]
    ) -> None:
        lexical = attributes.get("format")
        if lexical is None:
            return
        if QNAME_RE.fullmatch(lexical) is None:
            fail()
        prefix = lexical.split(":", 1)[0]
        namespace = namespaces.get(prefix.lower())
        if namespace is None or TRANSFORMATION_NAMESPACE_RE.fullmatch(namespace) is None:
            fail()

    def begin_capture(self, owner: str, kind: str, depth: int) -> None:
        if self.capture is not None:
            fail()
        self.capture = {"depth": depth, "kind": kind, "owner": owner, "text": []}

    def finish_capture(self) -> None:
        if self.capture is None:
            fail()
        value = "".join(self.capture["text"]).strip()
        owner = self.capture["owner"]
        kind = self.capture["kind"]
        if owner == "context":
            if self.active_context is None or self.active_context[kind] is not None:
                fail()
            self.active_context[kind] = value
        else:
            if self.active_unit is None:
                fail()
            self.active_unit["measures"].append((value, dict(self.stack[-1][1])))
        self.capture = None

    def close_and_extract(self) -> list[dict[str, Any]]:
        self.close()
        if (
            self.stack
            or self.active_context is not None
            or self.active_unit is not None
            or self.active_fact is not None
            or self.capture is not None
            or self.exclude_depth is not None
        ):
            fail()
        facts: dict[tuple[Any, ...], dict[str, Any]] = {}
        seen_targets: set[str] = set()
        for pending in self.pending_facts:
            context = self.contexts.get(pending["contextRef"])
            unit_record = self.units.get(pending["unitRef"])
            if context is None or unit_record is None:
                fail()
            period_start, period_end = self.context_period(context)
            # The personal launch contract is deliberately dimensionless. Keep
            # dimensional alternatives out of duplicate reconciliation rather
            # than collapsing distinct members into one coarse coordinate.
            # Their unit/transform/value semantics are outside this projection.
            if context["dimensionScope"] != "empty":
                continue
            unit = self.resolve_unit(unit_record)
            value = transform_numeric(
                "".join(pending["text"]), pending["attributes"]
            )
            fact = {
                "concept": pending["concept"],
                "dimensionScope": context["dimensionScope"],
                "periodEnd": period_end,
                "periodStart": period_start,
                "unit": unit,
                "value": value,
            }
            coordinate = (
                fact["concept"],
                fact["dimensionScope"],
                fact["periodEnd"],
                fact["periodStart"],
                fact["unit"],
            )
            existing = facts.get(coordinate)
            if existing is not None and existing != fact:
                fail()
            facts[coordinate] = fact
            seen_targets.add(pending["concept"])
        if seen_targets != self.targets:
            fail()
        return sorted(
            facts.values(),
            key=lambda fact: (
                fact["concept"],
                fact["periodEnd"],
                fact["periodStart"] or "",
                fact["unit"],
                fact["dimensionScope"],
                fact["value"],
            ),
        )

    @staticmethod
    def context_period(context: dict[str, Any]) -> tuple[str | None, str]:
        if not context["periodSeen"] or context["periodDepth"] is not None:
            fail()
        instant = context["instant"]
        start = context["startdate"]
        end = context["enddate"]
        if instant is not None:
            if start is not None or end is not None or not valid_date(instant):
                fail()
            return None, instant
        if (
            start is None
            or end is None
            or not valid_date(start)
            or not valid_date(end)
            or start >= end
        ):
            fail()
        return start, end

    @staticmethod
    def resolve_unit(unit_record: dict[str, Any]) -> str:
        measures = unit_record["measures"]
        if not unit_record["simple"] or len(measures) != 1:
            fail()
        lexical, namespaces = measures[0]
        if QNAME_RE.fullmatch(lexical) is None:
            fail()
        prefix, local = lexical.split(":", 1)
        namespace = namespaces.get(prefix.lower())
        if namespace == ISO4217_NAMESPACE and local == "USD":
            return "USD"
        if namespace == XBRLI_NAMESPACE and local == "shares":
            return "shares"
        fail()


def extract_document(
    raw: bytes,
    targets: tuple[str, ...],
    target_namespaces: dict[str, str],
) -> dict[str, Any]:
    try:
        text = raw.decode("utf-8", errors="strict")
    except UnicodeError:
        fail()
    parser = RawIxbrlParser(targets, target_namespaces)
    try:
        parser.feed(text)
        facts = parser.close_and_extract()
    except (Invalid, UnicodeError, ValueError, TypeError, OverflowError):
        fail()
    return {"facts": facts}


def process(raw_request: bytes) -> dict[str, Any]:
    request = load_request(raw_request)
    targets = validate_targets(request["targetConcepts"])
    encoded_documents = request["rawFilingDocuments"]
    if type(encoded_documents) is not list or not 1 <= len(encoded_documents) <= 2:
        fail()
    documents = [strict_base64(value) for value in encoded_documents]
    target_namespaces: dict[str, str] = {}
    extracted = [
        extract_document(document, targets, target_namespaces)
        for document in documents
    ]
    return {
        "documents": extracted,
        "schemaVersion": SCHEMA_VERSION,
        "status": "extracted",
    }


def main() -> None:
    output = quarantine_result()
    try:
        raw_request = bytes(sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1))
        output = process(raw_request)
        serialized = (canonical_json(output) + "\n").encode("utf-8")
        if len(serialized) > MAX_OUTPUT_BYTES:
            fail()
    except BaseException:
        output = quarantine_result()
        serialized = (canonical_json(output) + "\n").encode("utf-8")
    try:
        sys.stdout.buffer.write(serialized)
        sys.stdout.buffer.flush()
    except BaseException:
        pass


if __name__ == "__main__":
    main()
