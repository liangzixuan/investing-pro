"""One bounded iXBRL projection. Standard library only; no document/network access.

This is a deliberately narrow correspondence inspector, not a DTS validator.
Transform definitions: XBRL transformation registries REC-2015-02-26,
REC-2020-02-12 and REC-2022-02-16. Unsupported constructs never yield a match.
"""
from __future__ import annotations

import base64
import datetime
import hashlib
import json
import re
import sys
from html.parser import HTMLParser

DOCUMENT_BYTES = 32 * 1024 * 1024
INPUT_BYTES = 45 * 1024 * 1024
OUTPUT_BYTES = 1024 * 1024
SCHEMA_VERSION = "2.0.0"
METADATA_OUTPUT_BYTES = 128 * 1024
DEI_CONCEPTS = ("DocumentType", "DocumentPeriodEndDate", "DocumentFiscalYearFocus", "DocumentFiscalPeriodFocus")
# Exact targetNamespace identifiers verified against the SEC 2024/2025/2026 schemas.
DEI_NAMESPACES = {"http://xbrl.sec.gov/dei/2024", "http://xbrl.sec.gov/dei/2025", "http://xbrl.sec.gov/dei/2026"}
REPORTING_DATE_NAMESPACE = "http://www.xbrl.org/inlineXBRL/transformation/2020-02-12"
REPORTING_DATE_FORMAT = "date-monthname-day-year-en"
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
MONTH_SPELLINGS = MONTHS + tuple(month[:3] for month in MONTHS) + tuple(month.upper() for month in MONTHS) + tuple(month[:3].upper() for month in MONTHS)
# TRR4 4.1/4.58: retain the first enumerated month and broad nonnumeric separators.
REPORTING_DATE = re.compile(r"(" + "|".join(MONTH_SPELLINGS) + r")[^0-9]+([0-9]{1,2})[^0-9]+([0-9]{1,2}|[0-9]{4})\Z")
IX = {"http://www.xbrl.org/2008/inlineXBRL", "http://www.xbrl.org/2013/inlineXBRL"}
XBRLI = "http://www.xbrl.org/2003/instance"
XBRLDI = "http://xbrl.org/2006/xbrldi"
ISO4217 = "http://www.xbrl.org/2003/iso4217"
XML = "http://www.w3.org/XML/1998/namespace"
XSI = "http://www.w3.org/2001/XMLSchema-instance"
XHTML = "http://www.w3.org/1999/xhtml"
GAAP = re.compile(r"http://fasb\.org/us-gaap/(20[0-9]{2})(?:-([0-9]{2})-([0-9]{2}))?\Z")
ID = re.compile(r"[A-Za-z_][A-Za-z0-9_.-]{0,255}\Z")
QNAME = re.compile(r"(?:[A-Za-z_][A-Za-z0-9_.-]*:)?[A-Za-z_][A-Za-z0-9_.-]*\Z")
CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")
XML_DECLARATION = re.compile(
    r"""xml[ \t\r\n]+version[ \t\r\n]*=[ \t\r\n]*(?P<version_quote>['"])1\.0(?P=version_quote)"""
    r"""(?:[ \t\r\n]+encoding[ \t\r\n]*=[ \t\r\n]*(?P<encoding_quote>['"])(?P<encoding>(?ai:UTF-8|ASCII|US-ASCII))(?P=encoding_quote))?[ \t\r\n]*\?"""
)
VOID = frozenset("area base br col embed hr img input link meta param source track wbr".split())
CONCEPTS = {"RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "NetIncomeLoss"}
SPACES = " \t\r\n\u00a0"
SEMANTIC_NAMES = {
    XBRLI: {"startdate": "startDate", "enddate": "endDate", "unitnumerator": "unitNumerator", "unitdenominator": "unitDenominator"},
    XBRLDI: {"explicitmember": "explicitMember", "typedmember": "typedMember"},
    **{namespace: {"nonfraction": "nonFraction", "nonnumeric": "nonNumeric"} for namespace in IX},
}
SEMANTIC_ATTRIBUTES = {"contextref": "contextRef", "unitref": "unitRef", "continuedat": "continuedAt", "tupleref": "tupleRef", "tupleid": "tupleID", "footnoterefs": "footnoteRefs"}
# Canonical linking-attribute names from the Inline XBRL 1.0/1.1 schemas.
# These nodes are traversed, not resolved into relationships or fact evidence.
IX_LINKING_ATTRIBUTES = {
    ("http://www.xbrl.org/2013/inlineXBRL", "relationship"): {"fromrefs": "fromRefs", "torefs": "toRefs", "linkrole": "linkRole"},
    ("http://www.xbrl.org/2013/inlineXBRL", "footnote"): {"footnoterole": "footnoteRole"},
    ("http://www.xbrl.org/2008/inlineXBRL", "footnote"): {"footnoteid": "footnoteID", "footnotelinkrole": "footnoteLinkRole", "footnoterole": "footnoteRole"},
}


class Unsupported(Exception):
    def __init__(self, reason):
        self.reason = reason


def fail(reason="invalid_document"):
    raise Unsupported(reason)


def bounded(value, limit=256):
    if not isinstance(value, str) or utf16_length(value) > limit or CONTROL.search(value):
        fail()
    return value


def utf16_length(value):
    # Match JavaScript/browser string bounds, including astral Unicode text.
    return len(value) + sum(ord(character) > 65535 for character in value)


def valid_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        return False
    try:
        return datetime.date.fromisoformat(value).year >= 1000
    except ValueError:
        return False


def canonical(value):
    return isinstance(value, str) and len(value) <= 64 and re.fullmatch(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?", value) is not None and value != "-0"


def qname(raw, namespaces):
    bounded(raw)
    if not QNAME.fullmatch(raw):
        return {"raw": raw, "namespace": None, "localName": None}
    prefix, separator, local = raw.partition(":")
    return {"raw": raw, "namespace": namespaces.get(prefix if separator else ""), "localName": local if separator else prefix}


def gaap_namespace(value):
    match = GAAP.fullmatch(value or "")
    if match is None or int(match[1]) < 2009:
        return False
    return match[2] is None or valid_date(value.rsplit("/", 1)[1])


def raw_attributes(raw, tag_end):
    # Preserve names that HTMLParser lowercases. This scanner only tokenizes a
    # bounded start tag; values are still decoded by HTMLParser, never evaluated.
    body = raw[tag_end:]
    position, names, unquoted = 0, [], set()
    token = re.compile(r'''\s+([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?''')
    while position < len(body):
        if re.fullmatch(r"\s*/?>", body[position:]):
            return names, unquoted
        match = token.match(body, position)
        if match is None:
            fail()
        names.append(match[1])
        if match[2] is None or match[2][0] not in ("'", '"'):
            unquoted.add(match[1])
        position = match.end()
    fail()


def semantic_case(raw_tag, namespace, local):
    if namespace in SEMANTIC_NAMES and raw_tag.split(":")[-1] != SEMANTIC_NAMES[namespace].get(local, local):
        fail()


class Node:
    __slots__ = ("tag", "raw_tag", "namespace", "local", "attrs", "namespaces", "ordinal", "children", "parts", "text_length", "metadata", "unsupported_metadata_ancestor")

    def __init__(self, tag, namespace, local, attrs, namespaces, ordinal, metadata=False, raw_tag=None):
        self.tag, self.namespace, self.local = tag, namespace, local
        self.raw_tag = raw_tag or tag
        self.attrs, self.namespaces, self.ordinal = attrs, namespaces, ordinal
        self.children, self.parts, self.text_length = [], [], 0
        self.metadata = metadata
        self.unsupported_metadata_ancestor = False

    def text(self):
        return "".join(self.parts)


class Document(HTMLParser):
    def __init__(self, concept):
        super().__init__(convert_charrefs=True)
        self.concept, self.stack, self.contexts, self.units, self.facts = concept, [], {}, {}, []
        self.nodes, self.ids, self.doctype = 0, set(), False
        self.closed_void = False
        self.metadata, self.metadata_count, self.metadata_limit = [], 0, None
        # The additive accession mode keeps one compact source tree. Legacy
        # selected-value inspection retains its original capture behavior.
        self.accession = concept is None
        self.source, self.source_stack = [], []
        self.fact_counts = {name: 0 for name in CONCEPTS}
        self.processing_instructions = []

    def handle_decl(self, declaration):
        if self.doctype or declaration.strip().lower() != "doctype html":
            fail()
        self.doctype = True

    def unknown_decl(self, _data):
        fail()

    def handle_pi(self, data):
        # XML 1.0/UTF-8 or byte-verified ASCII only; no other PI is consumed.
        if self.accession and not (self.getpos() == (1, 0) and not self.nodes and not self.stack and XML_DECLARATION.fullmatch(data)):
            target = re.split(r"[ \t\r\n?]", data, maxsplit=1)[0]
            if not ID.fullmatch(target) or target.lower() == "xml":
                fail()
            self.processing_instructions.append({"locator": f"/processing-instructions/{len(self.processing_instructions) + 1}", "target": target})
            if len(self.processing_instructions) > 4096:
                fail("structural_limit")
            return
        if self.getpos() != (1, 0) or self.nodes or self.stack or not XML_DECLARATION.fullmatch(data):
            fail()

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if not self.closed_void:
            self.handle_endtag(tag)

    def handle_starttag(self, tag, attributes):
        self.closed_void = False
        self.nodes += 1
        if self.nodes > 1_000_000:
            fail("node_limit")
        if len(self.stack) >= 256:
            fail("depth_limit")
        if len(attributes) > 64:
            fail("attribute_limit")
        raw_start = self.get_starttag_text() or ""
        raw_tag = re.match(r"<([^\s/>]+)", raw_start)
        if raw_tag is None:
            fail()
        attribute_names, unquoted_attributes = raw_attributes(raw_start, raw_tag.end())
        if len(attribute_names) != len(attributes):
            fail()
        attrs, declarations = {}, []
        for (key, value), raw_key in zip(attributes, attribute_names):
            if key in attrs:
                fail()
            if raw_key.lower() != key:
                fail()
            attrs[key] = "" if value is None else value
            if key == "xmlns" or key.startswith("xmlns:"):
                # HTMLParser normalizes attribute names; QName values do not.
                # Recover only the quoted declaration's exact raw prefix while
                # keeping the normalized duplicate/collision guard above.
                if raw_key in unquoted_attributes or (raw_key != "xmlns" and not raw_key.startswith("xmlns:")):
                    fail("invalid_namespace")
                prefix = raw_key.partition(":")[2]
                if raw_key != "xmlns" and not ID.fullmatch(prefix):
                    fail("invalid_namespace")
                declarations.append((prefix, attrs[key]))
        inherited = self.stack[-1][1] if self.stack else {"xml": XML}
        namespaces = inherited
        if declarations:
            namespaces = dict(inherited)
            for prefix, value in declarations:
                bounded(value)
                if (prefix.lower() == "xml" and (prefix != "xml" or value != XML)) or prefix.lower() == "xmlns" or value == "http://www.w3.org/2000/xmlns/" or (value == XML and prefix != "xml") or (prefix and not value):
                    fail("invalid_namespace")
                namespaces[prefix] = value
            if len(namespaces) > 256:
                fail("invalid_namespace")
        if raw_tag and ":" in raw_tag[1] and raw_tag[1].split(":")[0] != raw_tag[1].split(":")[0].lower():
            fail("invalid_namespace")
        expanded = qname(tag, namespaces)
        namespace, local = expanded["namespace"], expanded["localName"]
        if local is None or (":" in tag and not namespace):
            fail("invalid_namespace")
        semantic_case(raw_tag[1], namespace, local)
        if namespace in SEMANTIC_NAMES:
            if unquoted_attributes:
                fail()
            linking_attributes = IX_LINKING_ATTRIBUTES.get((namespace, local), {})
            for raw_key in attribute_names:
                key = raw_key.lower()
                if ":" not in key and raw_key != linking_attributes.get(key, SEMANTIC_ATTRIBUTES.get(key, key)):
                    fail()
        identifier = attrs.get("id")
        if identifier is not None:
            bounded(identifier)
            if identifier in self.ids:
                fail("duplicate_id")
            self.ids.add(identifier)
        parent = self.stack[-1][2] if self.stack else None
        is_context = namespace == XBRLI and local == "context"
        is_unit = namespace == XBRLI and local == "unit"
        name = qname(attrs.get("name", ""), namespaces)
        if self.accession and local in ("nonfraction", "fraction", "nonnumeric") and (name["localName"] is None or name["namespace"] is None):
            fail("invalid_namespace")
        chosen_concepts = CONCEPTS if self.accession else {self.concept}
        fact_concept = next((item for item in chosen_concepts if (local in ("nonfraction", "fraction", "nonnumeric") and name["localName"] == item) or (expanded["localName"] == item.lower() and gaap_namespace(namespace))), None)
        is_fact = fact_concept is not None
        is_metadata = (local in ("nonfraction", "fraction", "nonnumeric") and metadata_concept(name["localName"]) is not None) or (namespace not in (None, "", XHTML) and metadata_concept(local) is not None)
        is_registrant = self.accession and local in ("nonfraction", "fraction", "nonnumeric") and name["localName"] == "EntityRegistrantName"
        if is_metadata or is_registrant:
            self.metadata_count += 1
            if self.metadata_count > 40:
                if self.accession:
                    fail("metadata_limit")
                self.metadata_limit = "candidate_limit"
                self.metadata.clear()
        capture = parent is not None or is_context or is_unit or is_fact or (is_metadata and self.metadata_limit is None)
        metadata_node = not is_fact and (is_metadata or (parent is not None and parent.metadata))
        node = Node(tag, namespace, local, attrs, namespaces, self.nodes, metadata_node, raw_tag[1]) if capture else None
        if is_metadata and node is not None:
            for ancestor_tag, ancestor_namespaces, _ancestor_node in self.stack:
                ancestor = qname(ancestor_tag, ancestor_namespaces)
                if (ancestor["namespace"] in IX and ancestor["localName"] not in ("header", "hidden")) or ancestor["namespace"] in (XBRLI, XBRLDI):
                    node.unsupported_metadata_ancestor = True
        if parent is not None:
            parent.children.append(node)
        if is_context or is_unit:
            if parent is not None or not identifier or not ID.fullmatch(identifier):
                fail("invalid_identifier")
            collection = self.contexts if is_context else self.units
            if len(collection) >= (20_000 if is_context else 5_000):
                fail("context_limit" if is_context else "unit_limit")
            collection[identifier] = node
        if is_fact:
            if (self.fact_counts[fact_concept] if self.accession else len(self.facts)) >= 512:
                fail("candidate_limit")
            self.fact_counts[fact_concept] += 1
            if self.accession and len(self.facts) >= 2048:
                fail("aggregate_candidate_limit")
            self.facts.append(node)
        if is_metadata and self.metadata_limit is None:
            self.metadata.append(node)
        if self.accession:
            source_start(self, raw_tag[1], attributes, attribute_names, namespaces)
        self.stack.append((tag, namespaces, node))
        if namespace in (None, "", XHTML) and local in VOID and ":" not in tag:
            self.handle_endtag(tag)
            self.closed_void = True

    def handle_endtag(self, tag):
        if not self.stack or self.stack[-1][0] != tag:
            fail()
        _tag, namespaces, node = self.stack.pop()
        if self.accession:
            source_end(self, namespaces)
        if node is not None:
            # Retain only bindings needed by this node's QName-valued fields.
            # Full namespace maps otherwise multiply across a hostile captured tree.
            values = [node.attrs.get(key, "") for key in ("name", "format", "dimension")]
            values.append(node.tag)
            if node.local in ("measure", "explicitmember"):
                values.append(node.text().strip())
            prefixes = {value.split(":", 1)[0] if ":" in value else "" for value in values}
            node.namespaces = {prefix: namespaces[prefix] for prefix in prefixes if prefix in namespaces}

    def parse_endtag(self, position):
        end = self.rawdata.find(">", position)
        if end >= 0:
            raw = re.fullmatch(r"</\s*([^\s/>]+)\s*>", self.rawdata[position:end + 1])
            if raw is None:
                fail()
            namespaces = self.stack[-1][1] if self.stack else {}
            expanded = qname(raw[1].lower(), namespaces)
            semantic_case(raw[1], expanded["namespace"], expanded["localName"])
            if ":" in raw[1] and raw[1].split(":")[0] != raw[1].split(":")[0].lower():
                fail("invalid_namespace")
        return super().parse_endtag(position)

    def handle_data(self, data):
        bounded(data, DOCUMENT_BYTES)
        if self.accession and not self.source_stack and data.strip():
            fail()
        if self.accession and self.source_stack:
            source_data(self.source_stack[-1], data)
        # Only retain bounded context/unit/fact content, never unrelated filing HTML.
        for _tag, _ns, node in self.stack:
            if node is not None:
                if node.metadata and self.metadata_limit is not None:
                    continue
                node.text_length += utf16_length(data)
                if node.text_length > 4096:
                    if node.metadata:
                        if self.accession:
                            fail("metadata_limit")
                        self.metadata_limit = "output_limit"
                        self.metadata.clear()
                        node.parts.clear()
                        continue
                    fail()
                node.parts.append(data)

    def finish(self):
        self.close()
        if self.stack or not self.nodes:
            fail()


def children(node, namespace, local):
    return [child for child in node.children if child.namespace == namespace and child.local == local]


def descendants(node):
    stack = list(reversed(node.children))
    result = []
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(reversed(current.children))
    return result


def numeric(node, candidate, issues):
    attrs = node.attrs
    raw = candidate["rawText"].strip(SPACES)
    formatting = candidate["format"]
    allowed_attributes = {"id", "name", "contextref", "unitref", "decimals", "precision", "format", "sign", "scale", "footnoterefs", "xmlns"}
    if node.namespace not in IX or node.local != "nonfraction" or node.children or any(key in attrs for key in ("continuedat", "target", "tupleref", "tupleid")) or any(key.endswith(":nil") for key in attrs) or any(":" not in key and key not in allowed_attributes for key in attrs):
        issues.append("unsupported_inline")
        return None
    if ("decimals" in attrs) == ("precision" in attrs):
        issues.append("unsupported_inline")
        return None
    for key in ("decimals", "precision"):
        if key in attrs and not re.fullmatch(r"INF|[+-]?[0-9]{1,4}", attrs[key]):
            issues.append("unsupported_inline")
            return None
    if attrs.get("precision") not in (None, "INF") and int(attrs["precision"]) <= 0:
        issues.append("unsupported_inline")
        return None
    if attrs.get("sign") not in (None, "-") or not re.fullmatch(r"[+-]?[0-9]{1,3}", attrs.get("scale", "0")):
        issues.append("invalid_numeric")
        return None
    scale = int(attrs.get("scale", "0"))
    if abs(scale) > 100:
        issues.append("decimal_limit")
        return None
    cleaned = raw
    if formatting is not None:
        namespace, name = formatting["namespace"], formatting["localName"]
        registry = (namespace or "").removeprefix("http://www.xbrl.org/inlineXBRL/transformation/")
        legacy = registry == "2015-02-26"
        modern = registry in ("2020-02-12", "2022-02-16")
        if namespace != "http://www.xbrl.org/inlineXBRL/transformation/" + registry:
            legacy = modern = False
        if modern and name == "fixed-zero":
            cleaned = "0"
        elif legacy and name == "zerodash":
            if raw not in ("-", "\u2012", "\u2013", "\u2014", "\u2212"):
                issues.append("invalid_numeric")
                return None
            cleaned = "0"
        elif (legacy and name in ("numdotdecimal", "numcommadecimal")) or (modern and name in ("num-dot-decimal", "num-comma-decimal")):
            comma = name in ("numcommadecimal", "num-comma-decimal")
            mark, grouping = (",", ".") if comma else (".", ",")
            # Supported lexical subset: correctly grouped integers and an optional
            # digit-only fraction. Registry4/5 additional separator forms are rejected.
            normalized = raw.replace("\u00a0", " ")
            pattern = r"(?:[0-9]+|[0-9]{1,3}(?:[" + re.escape(grouping) + r" ][0-9]{3})+)(?:" + re.escape(mark) + r"[0-9]+)?"
            if not re.fullmatch(pattern, normalized):
                issues.append("invalid_numeric")
                return None
            cleaned = normalized.replace(grouping, "").replace(" ", "").replace(mark, ".")
        else:
            issues.append("unsupported_transform")
            return None
    if not re.fullmatch(r"(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)", cleaned):
        issues.append("invalid_numeric")
        return None
    integer, _separator, fraction = cleaned.partition(".")
    digits = (integer + fraction).lstrip("0") or "0"
    if len(digits) > 256:
        issues.append("decimal_limit")
        return None
    places = len(fraction) - scale
    if digits == "0":
        return "0"
    if places <= 0:
        value = digits + "0" * -places
    else:
        digits = digits.rjust(places + 1, "0")
        value = (digits[:-places] + "." + digits[-places:]).rstrip("0").rstrip(".")
    if attrs.get("sign") == "-":
        value = "-" + value
    if not canonical(value):
        issues.append("decimal_limit")
        return None
    return value


def project_context(candidate, document, cik, selected=None):
    issues = candidate["issues"]
    context = document.contexts.get(candidate["contextId"])
    if context is None:
        issues.append("unresolved_context")
    else:
        entities, periods = children(context, XBRLI, "entity"), children(context, XBRLI, "period")
        all_nodes = descendants(context)
        identifiers = [child for child in all_nodes if child.namespace == XBRLI and child.local == "identifier"]
        if len(entities) != 1 or len(periods) != 1 or len(identifiers) != 1 or identifiers[0] not in entities[0].children or identifiers[0].children:
            issues.append("malformed_context")
        if any(child.namespace != XBRLI or child.local not in ("entity", "period", "scenario") for child in context.children) or (len(entities) == 1 and any(child.namespace != XBRLI or child.local not in ("identifier", "segment") for child in entities[0].children)):
            issues.append("malformed_context")
        if len(identifiers) == 1:
            identifier = identifiers[0]
            candidate["entityIdentifier"] = bounded(identifier.text().strip())
            candidate["entityScheme"] = bounded(identifier.attrs.get("scheme", ""))
            if candidate["entityScheme"] != "http://www.sec.gov/CIK" or not re.fullmatch(r"[0-9]{1,10}", candidate["entityIdentifier"]) or int(candidate["entityIdentifier"]) == 0:
                issues.append("unsupported_entity")
            else:
                candidate["entityCik"] = candidate["entityIdentifier"].zfill(10)
                if candidate["entityCik"] != cik:
                    issues.append("entity_mismatch")
        for child in all_nodes:
            if child.namespace == XBRLDI and child.local in ("explicitmember", "typedmember"):
                if len(candidate["dimensions"]) >= 32:
                    fail("unsupported_dimensions")
                candidate["dimensions"].append({"kind": "explicit" if child.local == "explicitmember" else "typed", "dimension": qname(child.attrs.get("dimension", ""), child.namespaces), "member": qname(child.text().strip(), child.namespaces) if child.local == "explicitmember" else None, "typedText": child.text() if child.local == "typedmember" else None})
        allowed = {(XBRLI, name) for name in ("entity", "identifier", "period", "startdate", "enddate", "instant")}
        if any((child.namespace, child.local) not in allowed for child in all_nodes):
            issues.append("unsupported_dimensions")
        if len(periods) == 1:
            period = periods[0]
            starts, ends, instants = children(period, XBRLI, "startdate"), children(period, XBRLI, "enddate"), children(period, XBRLI, "instant")
            if len(starts) == len(ends) == 1 and not instants and len(period.children) == 2 and not starts[0].children and not ends[0].children and valid_date(starts[0].text().strip()) and valid_date(ends[0].text().strip()) and starts[0].text().strip() <= ends[0].text().strip():
                candidate.update(periodKind="duration", startDate=starts[0].text().strip(), endDate=ends[0].text().strip())
                if selected is not None and (candidate["startDate"] != selected["startDate"] or candidate["endDate"] != selected["endDate"]):
                    issues.append("period_mismatch")
            elif len(instants) == 1 and len(period.children) == 1 and not instants[0].children and valid_date(instants[0].text().strip()):
                candidate.update(periodKind="instant", endDate=instants[0].text().strip())
                issues.append("period_mismatch" if selected is not None else "unsupported_period")
            else:
                issues.append("unsupported_period")
        else:
            issues.append("unsupported_period")


def project_candidate(node, document, selected, cik):
    a = node.attrs
    for key in ("id", "contextref", "unitref", "name", "format", "sign", "scale", "decimals", "precision"):
        if key in a:
            bounded(a[key])
    candidate = {
        "locator": f"/elements/{node.ordinal}", "factId": a.get("id"), "contextId": a.get("contextref"), "unitId": a.get("unitref"),
        "concept": qname(a.get("name", node.tag), node.namespaces),
        "entityIdentifier": None, "entityScheme": None, "entityCik": None, "dimensions": [],
        "periodKind": "unsupported", "startDate": None, "endDate": None, "unit": None, "unitMeasures": [],
        "rawText": node.text(), "format": qname(a["format"], node.namespaces) if "format" in a else None,
        "sign": a.get("sign"), "scale": a.get("scale"), "decimals": a.get("decimals"), "precision": a.get("precision"), "value": None, "issues": [],
    }
    issues = candidate["issues"]
    if candidate["concept"]["localName"] != selected["concept"] or not gaap_namespace(candidate["concept"]["namespace"]):
        issues.append("invalid_namespace")
    if any(value is not None and not ID.fullmatch(value) for value in (candidate["factId"], candidate["contextId"], candidate["unitId"])):
        issues.append("invalid_identifier")
    project_context(candidate, document, cik, selected)
    unit = document.units.get(candidate["unitId"])
    if unit is None:
        issues.append("unresolved_unit")
    else:
        measures = [child for child in descendants(unit) if child.namespace == XBRLI and child.local == "measure"]
        if len(measures) > 32:
            fail("unsupported_unit")
        candidate["unitMeasures"] = [qname(bounded(child.text().strip()), child.namespaces) for child in measures]
        if len(measures) == 1 and len(unit.children) == 1 and measures[0] is unit.children[0] and not measures[0].children and candidate["unitMeasures"][0]["namespace"] == ISO4217 and candidate["unitMeasures"][0]["localName"] == "USD":
            candidate["unit"] = "USD"
        else:
            issues.append("unsupported_unit")
    candidate["value"] = numeric(node, candidate, issues)
    candidate["issues"] = list(dict.fromkeys(issues))
    return candidate


def analyze(document, selected, cik):
    candidates = [project_candidate(node, document, selected, cik) for node in document.facts]
    corresponding = [row for row in candidates if not row["issues"]]
    # A known different entity/period is outside this selection. Unresolved context,
    # transforms or scope cannot silently disappear behind an otherwise good fact.
    uncertain = [row for row in candidates if row["issues"] and not any(issue in row["issues"] for issue in ("entity_mismatch", "period_mismatch"))]
    reason = None
    if uncertain:
        status, reason = "unsupported", uncertain[0]["issues"][0]
    elif not corresponding:
        status = "no_corresponding_fact"
    elif len({row["value"] for row in corresponding}) > 1:
        status = "ambiguous"
    else:
        status = "matched" if corresponding[0]["value"] == selected["value"] else "value_differs"
    return {"schemaVersion": SCHEMA_VERSION, "status": status, "reason": reason, "candidates": candidates, "correspondingCandidateLocators": [row["locator"] for row in corresponding], "reportingMetadata": reporting_metadata(document, cik)}


def empty_metadata(status="assessed", reason=None):
    return {"status": status, "reason": reason, "fields": [{"concept": concept, "status": "missing" if status == "assessed" else "unsupported", "value": None, "observationLocators": []} for concept in DEI_CONCEPTS], "observations": []}


def metadata_format_supported(concept, format):
    if concept not in DEI_CONCEPTS:
        return False
    if format is None:
        return True
    return (concept == "DocumentPeriodEndDate" and format["namespace"] == REPORTING_DATE_NAMESPACE
            and format["localName"] == REPORTING_DATE_FORMAT and QNAME.fullmatch(format["raw"]) is not None
            and format["raw"].split(":")[-1] == format["localName"])


def metadata_value(concept, raw, format=None):
    if not metadata_format_supported(concept, format) or utf16_length(raw) > 4096 or CONTROL.search(raw):
        return None
    # XML whitespace only. Date normalization requires the exact declared format.
    value = re.sub(r"[ \t\r\n]+", " ", raw).strip(" ")
    if format is not None:
        parts = REPORTING_DATE.fullmatch(value)
        if parts is None:
            return None
        month = next(index + 1 for index, name in enumerate(MONTHS) if name[:3].upper() == parts[1][:3].upper())
        year = int(parts[3]) + (2000 if len(parts[3]) <= 2 else 0)
        date = f"{year:04d}-{month:02d}-{int(parts[2]):02d}"
        return date if valid_date(date) else None
    if concept == "DocumentType":
        return value if value in ("10-Q", "10-Q/A", "10-K", "10-K/A") else None
    if concept == "DocumentPeriodEndDate":
        return value if valid_date(value) else None
    if concept == "DocumentFiscalYearFocus":
        return value if re.fullmatch(r"[1-9][0-9]{3}", value) else None
    if concept == "DocumentFiscalPeriodFocus":
        # The SEC DEI fiscalPeriodItemType enumerates FY/Q1/Q2/Q3, not Q4.
        return value if value in ("FY", "Q1", "Q2", "Q3") else None
    return None


def metadata_concept(local):
    return next((concept for concept in DEI_CONCEPTS if local is not None and concept.lower() == local.lower()), None)


def project_metadata(node, document, cik):
    a = node.attrs
    for key in ("id", "contextref", "name", "format"):
        if key in a:
            bounded(a[key])
    source_name = a.get("name", "") if node.local in ("nonfraction", "fraction", "nonnumeric") else node.raw_tag
    candidate = {"locator": f"/elements/{node.ordinal}", "factId": a.get("id"), "contextId": a.get("contextref"), "concept": qname(source_name, node.namespaces), "entityIdentifier": None, "entityScheme": None, "entityCik": None, "dimensions": [], "periodKind": "unsupported", "startDate": None, "endDate": None, "rawText": node.text(), "format": qname(a["format"], node.namespaces) if "format" in a else None, "value": None, "issues": []}
    issues = candidate["issues"]
    if candidate["concept"]["namespace"] not in DEI_NAMESPACES or candidate["concept"]["localName"] not in DEI_CONCEPTS:
        issues.append("invalid_namespace")
    if any(value is not None and not ID.fullmatch(value) for value in (candidate["factId"], candidate["contextId"])):
        issues.append("invalid_identifier")
    project_context(candidate, document, cik)
    allowed = {"id", "name", "contextref", "format", "footnoterefs", "xmlns"}
    if node.namespace not in IX or node.local != "nonnumeric" or node.children or node.unsupported_metadata_ancestor or any(key.endswith(":nil") for key in a) or any(":" not in key and key not in allowed for key in a):
        issues.append("unsupported_inline")
    if candidate["format"] is not None and not metadata_format_supported(candidate["concept"]["localName"], candidate["format"]):
        issues.append("unsupported_transform")
    if "unsupported_inline" not in issues and "unsupported_transform" not in issues:
        candidate["value"] = metadata_value(candidate["concept"]["localName"], candidate["rawText"], candidate["format"])
        if candidate["value"] is None:
            issues.append("invalid_metadata_value")
    candidate["issues"] = list(dict.fromkeys(issues))
    return candidate


def reporting_metadata(document, cik):
    if document.metadata_limit is not None:
        return empty_metadata("limited", document.metadata_limit)
    try:
        observations = [project_metadata(node, document, cik) for node in document.metadata]
    except Unsupported:
        # Metadata projection bounds must not erase an independent numeric result.
        return empty_metadata("limited", "output_limit")
    fields = []
    for concept in DEI_CONCEPTS:
        rows = [row for row in observations if metadata_concept(row["concept"]["localName"]) == concept]
        eligible = [row for row in rows if not row["issues"]]
        uncertain = [row for row in rows if row["issues"] and row["issues"] != ["entity_mismatch"]]
        values = {row["value"] for row in eligible}
        status = "unsupported" if uncertain else "missing" if not values else "conflicting" if len(values) > 1 else "observed"
        fields.append({"concept": concept, "status": status, "value": eligible[0]["value"] if status == "observed" else None, "observationLocators": [row["locator"] for row in rows]})
    metadata = {"status": "assessed", "reason": None, "fields": fields, "observations": observations}
    if len(json.dumps(metadata, ensure_ascii=True, separators=(",", ":")).encode("utf-8")) > METADATA_OUTPUT_BYTES:
        return empty_metadata("limited", "output_limit")
    return metadata


def global_failure(reason):
    return {"schemaVersion": SCHEMA_VERSION, "status": "unsupported", "reason": reason, "candidates": [], "correspondingCandidateLocators": [], "reportingMetadata": empty_metadata("unavailable", reason)}


# Raw source observations for the separate accession-evidence protocol. These
# records never assert statement, calendar, attribution or visibility support.
QUARTER_CONCEPTS = ("RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "NetIncomeLoss")
ANCHOR = re.compile(r"financial statements|statements? of (?:income|operations|earnings|cash flows)|income statements?|balance sheets?|notes to|basis of (?:presentation|preparation)|consolidat|subsidiar|intercompany|wholly[ -]owned|non[ -]?controlling|minority|preferred|participating|common (?:stock|share)|earnings per share|\bEPS\b|numerator|denominator|fiscal (?:year|quarter)|year (?:ended|ending|beginning)|(?:first|second|third) quarter|quarterly (?:period|report)|transition (?:period|report)|\b(?:52|53|13)[ -]weeks?\b|week[ -]based|\binterim\b|\bSEC\b|Securities and Exchange Commission|generally accepted accounting principles|beginning of (?:the )?(?:fiscal )?(?:year|period)|end of (?:the )?(?:period|year)", re.I)
BLOCKS = {"p", "div", "td", "th", "tr", "caption", "h1", "h2", "h3", "h4", "h5", "h6"}
XMLNS = "http://www.w3.org/2000/xmlns/"


def json_bytes(value):
    return json.dumps(value, ensure_ascii=True, allow_nan=False, separators=(",", ":")).encode("utf-8")


def source_start(document, raw_tag, attributes, names, namespaces):
    parent = document.source_stack[-1] if document.source_stack else None
    if parent is None and document.source:
        fail()
    raw_attrs = []
    qnames = []
    for (_key, value), name in zip(attributes, names):
        value = "" if value is None else value
        if name == "xmlns" or name.startswith("xmlns:"):
            expanded = {"namespace": XMLNS, "localName": "xmlns" if name == "xmlns" else name.partition(":")[2]}
        elif ":" in name:
            expanded = qname(name, namespaces)
            if expanded["namespace"] is None:
                fail("invalid_namespace")
        else:
            expanded = {"namespace": None, "localName": name}
        raw_attrs.append({"name": name, "namespace": expanded["namespace"], "localName": expanded["localName"], "value": value})
        if name in ("name", "format", "dimension"):
            qnames.append({"name": name, "value": qname(value, namespaces)})
    item = {"ordinal": document.nodes, "end": document.nodes, "name": qname(raw_tag, namespaces), "attributes": raw_attrs,
            "qnames": qnames, "textQName": None, "parent": parent, "childIndex": len(parent["children"]) if parent else 0,
            "children": [], "runs": [], "textLength": 0, "flat": "", "tables": [], "table": None, "row": None, "cell": None}
    if parent is not None:
        parent["children"].append(item)
    document.source.append(item)
    document.source_stack.append(item)


def source_data(item, data):
    index = len(item["children"])
    if item["runs"] and item["runs"][-1]["beforeChildIndex"] == index:
        item["runs"][-1]["text"] += data
    else:
        item["runs"].append({"beforeChildIndex": index, "text": data})


def source_end(document, namespaces):
    item = document.source_stack.pop()
    item["end"] = document.nodes
    # Each text fragment is stored once; ancestor text is a bounded projection,
    # never an unbounded duplicated copy of the filing.
    runs = {run["beforeChildIndex"]: run["text"] for run in item["runs"]}
    length = sum(utf16_length(value) for value in runs.values()) + sum(child["textLength"] for child in item["children"])
    item["textLength"] = length
    if length <= 4096:
        item["flat"] = "".join(runs.get(index, "") + (item["children"][index]["flat"] if index < len(item["children"]) else "") for index in range(len(item["children"]) + 1))
    if (item["name"]["namespace"], item["name"]["localName"]) in ((XBRLI, "measure"), (XBRLDI, "explicitMember")):
        item["textQName"] = qname(item["flat"].strip(), namespaces)


def source_local(item, local):
    return item["name"]["namespace"] in (None, "", XHTML) and (item["name"]["localName"] or "").lower() == local


def source_descendants(item):
    pending = list(reversed(item["children"]))
    while pending:
        current = pending.pop()
        yield current
        pending.extend(reversed(current["children"]))


def anchor_residual(item):
    runs = {run["beforeChildIndex"]: run["text"] for run in item["runs"]}
    parts = []
    for index in range(len(item["children"]) + 1):
        parts.append(runs.get(index, ""))
        if index < len(item["children"]):
            child = item["children"][index]
            if not ((child["name"]["localName"] or "").lower() in BLOCKS and ANCHOR.search(child["flat"])):
                parts.append(anchor_residual(child))
    return "".join(parts)


def source_xml(item):
    if item["textLength"] > 4096:
        fail("structural_limit")
    for attr in item["attributes"]:
        bounded(attr["name"])
        bounded(attr["value"], 4096)
    return {"elementOrdinal": item["ordinal"], "name": item["name"], "attributes": item["attributes"],
            "qnameAttributes": item["qnames"], "textQName": item["textQName"], "textRuns": item["runs"],
            "children": [source_xml(child) for child in item["children"]]}


def primary_failure(request, reason):
    return {"schemaVersion": "1.0.0", "mode": "accession_evidence", "documentSha256": request["documentSha256"],
            "documentBytes": request["documentBytes"], "cik": request["cik"], "selection": request["selection"],
            "status": "unavailable", "reason": reason, "concepts": [], "contexts": [], "units": [], "reportingMetadata": None, "structure": None}


def occurrence(node, document, concept):
    attrs = node.attrs
    for key in ("id", "contextref", "unitref", "name", "format", "sign", "scale", "decimals", "precision"):
        if key in attrs:
            bounded(attrs[key])
    name = qname(attrs.get("name", node.raw_tag), node.namespaces)
    issues = []
    if name["localName"] != concept or not gaap_namespace(name["namespace"]):
        issues.append("invalid_namespace")
    if any(value is not None and not ID.fullmatch(value) for value in (attrs.get("id"), attrs.get("contextref"), attrs.get("unitref"))):
        issues.append("invalid_identifier")
    context = document.contexts.get(attrs.get("contextref"))
    unit = document.units.get(attrs.get("unitref"))
    if context is None:
        issues.append("unresolved_context")
    if unit is None:
        issues.append("unresolved_unit")
    row = {"id": f"f:{node.ordinal}", "elementOrdinal": node.ordinal, "locator": f"/elements/{node.ordinal}", "factId": attrs.get("id"),
           "concept": name, "rawContextRef": attrs.get("contextref"), "contextRecordId": f"c:{context.ordinal}" if context else None,
           "rawUnitRef": attrs.get("unitref"), "unitRecordId": f"u:{unit.ordinal}" if unit else None,
           "rawText": node.text(), "format": qname(attrs["format"], node.namespaces) if "format" in attrs else None,
           "sign": attrs.get("sign"), "scale": attrs.get("scale"), "decimals": attrs.get("decimals"), "precision": attrs.get("precision"),
           "value": None, "issues": issues, "elementRecordId": None, "actualTableOrdinal": None, "actualRowOrdinal": None, "actualCellOrdinal": None}
    row["value"] = numeric(node, row, issues)
    row["issues"] = list(dict.fromkeys(issues))
    return row


def accession_metadata(document):
    observations = []
    for node in document.metadata:
        attrs = node.attrs
        for key in ("id", "contextref", "name", "format"):
            if key in attrs:
                bounded(attrs[key])
        name = qname(attrs.get("name", node.raw_tag), node.namespaces)
        context = document.contexts.get(attrs.get("contextref"))
        formatting = qname(attrs["format"], node.namespaces) if "format" in attrs else None
        issues = []
        if name["namespace"] not in DEI_NAMESPACES or name["localName"] not in DEI_CONCEPTS:
            issues.append("invalid_namespace")
        if context is None:
            issues.append("unresolved_context")
        if any(value is not None and not ID.fullmatch(value) for value in (attrs.get("id"), attrs.get("contextref"))):
            issues.append("invalid_identifier")
        allowed = {"id", "name", "contextref", "format", "footnoterefs", "xmlns"}
        if node.namespace not in IX or node.local != "nonnumeric" or node.children or node.unsupported_metadata_ancestor or any(key.endswith(":nil") for key in attrs) or any(":" not in key and key not in allowed for key in attrs):
            issues.append("unsupported_inline")
        if not metadata_format_supported(name["localName"], formatting):
            issues.append("unsupported_transform")
        value = metadata_value(name["localName"], node.text(), formatting) if not issues else None
        if value is None and not issues:
            issues.append("invalid_metadata_value")
        observations.append({"id": f"d:{node.ordinal}", "elementOrdinal": node.ordinal, "locator": f"/elements/{node.ordinal}", "factId": attrs.get("id"),
                             "concept": name, "rawContextRef": attrs.get("contextref"), "contextRecordId": f"c:{context.ordinal}" if context else None,
                             "rawText": node.text(), "format": formatting, "value": value, "issues": issues, "elementRecordId": None})
    fields = []
    for concept in DEI_CONCEPTS:
        rows = [row for row in observations if metadata_concept(row["concept"]["localName"]) == concept]
        values = {row["value"] for row in rows if not row["issues"]}
        status = "unsupported" if any(row["issues"] for row in rows) else "missing" if not values else "conflicting" if len(values) > 1 else "observed"
        fields.append({"concept": concept, "status": status, "value": next(iter(values)) if status == "observed" else None, "observationIds": [row["id"] for row in rows]})
    result = {"fields": fields, "observations": observations}
    if len(json_bytes(result)) > METADATA_OUTPUT_BYTES:
        fail("metadata_limit")
    return result


def table_geometry(table):
    rows = [item for item in source_descendants(table) if source_local(item, "tr") and item["table"] == table["table"]]
    reasons, projected, occupied = [], [], {}
    if table["tables"]:
        reasons.append("nested_table")
    if len(rows) > 256:
        fail("structural_limit")
    for index, row in enumerate(rows):
        cells = [item for item in source_descendants(row) if item["row"] == row["row"] and item["table"] == table["table"] and (source_local(item, "td") or source_local(item, "th"))]
        if any(cell["parent"] is not row for cell in cells):
            if "unsupported_source_structure" not in reasons:
                reasons.append("unsupported_source_structure")
        projected_cells, column = [], 0
        for cell in cells:
            attrs = {attr["name"].lower(): attr["value"] for attr in cell["attributes"]}
            spans = [attrs.get("colspan", "1"), attrs.get("rowspan", "1")]
            if any(not re.fullmatch(r"[1-9][0-9]?", span) or int(span) > 64 for span in spans):
                if "unsupported_geometry" not in reasons:
                    reasons.append("unsupported_geometry")
                continue
            colspan, rowspan = map(int, spans)
            while (index, column) in occupied:
                column += 1
            if column + colspan > 64 or index + rowspan > len(rows):
                if "unsupported_geometry" not in reasons:
                    reasons.append("unsupported_geometry")
                continue
            positions = [(r, c) for r in range(index, index + rowspan) for c in range(column, column + colspan)]
            if any(position in occupied for position in positions):
                if "unsupported_geometry" not in reasons:
                    reasons.append("unsupported_geometry")
                continue
            for position in positions:
                occupied[position] = cell["ordinal"]
            projected_cells.append({"cellRecordId": f"e:{cell['ordinal']}", "columnStart": column, "columnSpan": colspan, "rowSpan": rowspan})
            column += colspan
        projected.append({"rowRecordId": f"e:{row['ordinal']}", "cells": projected_cells})
    return {"tableRecordId": f"e:{table['ordinal']}", "status": "unsupported" if reasons else "complete", "reasons": reasons,
            "rowRecordIds": [f"e:{row['ordinal']}" for row in rows], "rows": [] if reasons else projected}


def accession_structure(document, populations, metadata):
    source = document.source
    by_ordinal = {item["ordinal"]: item for item in source}
    tables, table_rows, row_cells = [], {}, {}
    for item in source:
        parent = item["parent"]
        if parent:
            item["table"], item["row"], item["cell"] = parent["table"], parent["row"], parent["cell"]
        if source_local(item, "table"):
            tables.append(item)
            item["table"], item["row"], item["cell"] = len(tables), None, None
        elif source_local(item, "tr") and item["table"]:
            table_rows[item["table"]] = table_rows.get(item["table"], 0) + 1
            item["row"], item["cell"] = table_rows[item["table"]], None
        elif (source_local(item, "td") or source_local(item, "th")) and item["table"] and item["row"]:
            key = (item["table"], item["row"])
            row_cells[key] = row_cells.get(key, 0) + 1
            item["cell"] = row_cells[key]
    for item in reversed(source):
        parent = item["parent"]
        if parent:
            parent["tables"].extend(([item["table"]] if source_local(item, "table") else []) + item["tables"])
    # Prefer the smallest complete semantic block. A larger over-budget matching
    # block is a refusal, never a silently clipped narrative prefix.
    anchors = []
    for item in source:
        local = (item["name"]["localName"] or "").lower()
        if item["name"]["namespace"] not in (None, "", XHTML) or local not in BLOCKS:
            continue
        if item["textLength"] <= 4096 and ANCHOR.search(item["flat"]):
            if not any((child["name"]["localName"] or "").lower() in BLOCKS and child["textLength"] <= 4096 and ANCHOR.search(child["flat"]) for child in source_descendants(item)) or ANCHOR.search(anchor_residual(item)):
                anchors.append(item)
        elif item["textLength"] > 4096 and any(ANCHOR.search(run["text"]) for run in item["runs"]):
            fail("structural_limit")
    relevant = {by_ordinal[row["elementOrdinal"]]["table"] for population in populations for row in population["occurrences"]}
    relevant.discard(None)
    for anchor in anchors:
        if anchor["table"]:
            relevant.add(anchor["table"])
    balance_tables, caption_ranges = set(), []
    for anchor in anchors:
        if anchor["table"] or not re.search(r"statements? of (?:income|operations|earnings|cash flows)|income statements?|balance sheets?", anchor["flat"], re.I):
            continue
        current = anchor
        while current["parent"]:
            parent = current["parent"]
            following = parent["children"][current["childIndex"] + 1:]
            found = False
            for sibling in following:
                candidates = ([sibling["table"]] if source_local(sibling, "table") else []) + sibling["tables"]
                if candidates:
                    (balance_tables if re.search(r"balance sheets?", anchor["flat"], re.I) else relevant).update(candidates)
                    # The heading-to-table range owns potential unit captions
                    # and competing qualifications, even at the body root.
                    caption_ranges.append(parent["children"][current["childIndex"]:sibling["childIndex"]])
                    found = True
                    break
            if found:
                break
            current = parent
    if len(relevant | balance_tables) > 64:
        fail("structural_limit")
    selected, text_selected, windows = set(), set(), []

    def retain(item, full=False):
        pending = [item]
        if full:
            pending.extend(source_descendants(item))
        for current in pending:
            selected.add(current["ordinal"])
            if full:
                if current["textLength"] > 4096 and not current["children"]:
                    fail("structural_limit")
                text_selected.add(current["ordinal"])
            parent = current["parent"]
            while parent:
                selected.add(parent["ordinal"])
                parent = parent["parent"]
            if len(selected) > 4096:
                fail("structural_limit")

    for anchor in anchors:
        retain(anchor, True)
        # Cover controls need their actual complete local container, including
        # unmatched siblings and direct text. Never join controls across parents
        # or retain the whole document merely because a control is a root child.
        parent = anchor["parent"]
        if re.search(r"\b(?:quarterly|transition) report\b", anchor["flat"], re.I) and parent and parent["name"]["namespace"] in (None, "", XHTML) and (parent["name"]["localName"] or "").lower() in BLOCKS:
            retain(parent, True)
    for siblings in caption_ranges:
        for sibling in siblings:
            retain(sibling, True)
    for number in sorted(relevant | balance_tables):
        table = tables[number - 1]
        retain(table, number in relevant)
        # Preserve the entire sibling list at each wrapper level. The finite
        # graph budget, not a guessed proximity radius, bounds caption evidence.
        current = table
        while current["parent"]:
            parent = current["parent"]
            if source_local(parent, "body") or source_local(parent, "html"):
                # Root siblings may be unrelated large sections. Their complete
                # node records still preserve order; text is retained only for
                # selected anchors and the relevant table/caption wrapper.
                for sibling in parent["children"]:
                    retain(sibling)
            else:
                for sibling in parent["children"]:
                    retain(sibling, sibling["textLength"] <= 4096)
            windows.append({"parentRecordId": f"e:{parent['ordinal']}", "firstChildIndex": 0, "childRecordIds": [f"e:{child['ordinal']}" for child in parent["children"]]})
            current = parent
    for population in populations:
        for row in population["occurrences"]:
            item = by_ordinal[row["elementOrdinal"]]
            # Off-table occurrences remain in the full numeric inventory. They
            # need no redundant structural record merely to block a conflict.
            row.update(elementRecordId=f"e:{item['ordinal']}" if item["ordinal"] in selected else None,
                       actualTableOrdinal=item["table"], actualRowOrdinal=item["row"], actualCellOrdinal=item["cell"])
    for row in metadata["observations"]:
        item = by_ordinal[row["elementOrdinal"]]
        retain(item, True)
        row["elementRecordId"] = f"e:{item['ordinal']}"
    supplementary = []
    for item in source:
        names = {entry["name"]: entry["value"] for entry in item["qnames"]}
        name = names.get("name")
        if name is None or item["name"]["namespace"] not in IX:
            continue
        registrant = name["namespace"] in DEI_NAMESPACES and name["localName"] == "EntityRegistrantName"
        cash = item["table"] in relevant and name["localName"] and "Cash" in name["localName"]
        if not (registrant or cash):
            continue
        retain(item, True)
        if item["textLength"] > 4096:
            fail("structural_limit")
        attrs = {attr["name"].lower(): attr["value"] for attr in item["attributes"]}
        for key in ("id", "contextref", "unitref", "name", "format", "sign", "scale", "decimals", "precision"):
            if key in attrs:
                bounded(attrs[key])
        context = document.contexts.get(attrs.get("contextref"))
        unit = document.units.get(attrs.get("unitref"))
        supplementary.append({"id": f"s:{item['ordinal']}", "elementOrdinal": item["ordinal"], "elementRecordId": f"e:{item['ordinal']}", "concept": name,
                              "rawContextRef": attrs.get("contextref"), "contextRecordId": f"c:{context.ordinal}" if context else None,
                              "rawUnitRef": attrs.get("unitref"), "unitRecordId": f"u:{unit.ordinal}" if unit else None,
                              "format": names.get("format"), "rawText": item["flat"], "sign": attrs.get("sign"), "scale": attrs.get("scale"),
                              "decimals": attrs.get("decimals"), "precision": attrs.get("precision"), "issues": ["unresolved_context"] if context is None else []})
    records = []
    for ordinal in sorted(selected):
        item = by_ordinal[ordinal]
        attrs = item["attributes"]
        for attr in attrs:
            bounded(attr["name"])
            bounded(attr["value"], 4096)
        runs = item["runs"] if ordinal in text_selected else None
        if runs is not None and sum(utf16_length(run["text"]) for run in runs) > 4096:
            fail("structural_limit")
        child_ids = [f"e:{child['ordinal']}" for child in item["children"] if child["ordinal"] in selected]
        records.append({"id": f"e:{ordinal}", "elementOrdinal": ordinal, "endElementOrdinal": item["end"], "name": item["name"], "attributes": attrs,
                        "parentRecordId": f"e:{item['parent']['ordinal']}" if item["parent"] else None,
                        "parentElementOrdinal": item["parent"]["ordinal"] if item["parent"] else None,
                        "childIndex": item["childIndex"], "elementChildCount": len(item["children"]), "descendantTableCount": len(item["tables"]),
                        "descendantTableOrdinals": sorted(item["tables"]) if len(item["tables"]) <= 64 else None,
                        "textRuns": runs, "childRecordIds": child_ids, "childrenComplete": len(child_ids) == len(item["children"]),
                        "actualTableOrdinal": item["table"], "actualRowOrdinal": item["row"], "actualCellOrdinal": item["cell"]})
    geometry = [table_geometry(tables[number - 1]) for number in sorted(relevant)]
    reasons = list(dict.fromkeys(reason for table in geometry for reason in table["reasons"]))
    scripts = [{"elementOrdinal": item["ordinal"], "name": item["name"], "attributes": item["attributes"], "inlineTextCharacters": item["textLength"], "lastDocumentElementOrdinal": document.nodes} for item in source if (item["name"]["localName"] or "").lower() == "script"]
    for script in scripts:
        for attr in script["attributes"]:
            bounded(attr["name"])
            bounded(attr["value"], 4096)
    observed = {"elementCount": document.nodes, "styleElements": sum((item["name"]["localName"] or "").lower() == "style" for item in source),
                "stylesheetLinks": sum((item["name"]["localName"] or "").lower() == "link" and any((attr["localName"] or attr["name"]).lower() == "rel" and "stylesheet" in attr["value"].lower().split() for attr in item["attributes"]) for item in source),
                "processingInstructions": document.processing_instructions, "scripts": scripts,
                "eventAttributeCount": sum((attr["localName"] or attr["name"]).lower().startswith("on") for item in source for attr in item["attributes"])}
    unique_windows = {window["parentRecordId"]: window for window in windows}
    result = {"profileVersion": "sparse-source-1.0.0", "status": "unsupported" if reasons else "complete", "reasons": reasons,
              "document": observed, "records": records, "siblingWindows": list(unique_windows.values()), "tables": geometry,
              "supplementaryFacts": supplementary, "anchorRecordIds": [f"e:{item['ordinal']}" for item in anchors]}
    if len(json_bytes([metadata, [row for row in supplementary if row["concept"]["localName"] == "EntityRegistrantName"]])) > METADATA_OUTPUT_BYTES:
        fail("metadata_limit")
    if len(json_bytes(result)) > 256 * 1024:
        fail("structural_limit")
    return result


def accession_evidence(document, request):
    populations = [{"concept": concept, "occurrences": []} for concept in QUARTER_CONCEPTS]
    for node in document.facts:
        name = qname(node.attrs.get("name", node.raw_tag), node.namespaces)
        concept = next((concept for concept in QUARTER_CONCEPTS if concept.lower() == (name["localName"] or "").lower()), None)
        if concept is None:
            fail("invalid_namespace")
        populations[QUARTER_CONCEPTS.index(concept)]["occurrences"].append(occurrence(node, document, concept))
    metadata = accession_metadata(document)
    structure = accession_structure(document, populations, metadata)
    all_rows = [row for group in populations for row in group["occurrences"]] + metadata["observations"] + structure["supplementaryFacts"]
    contexts, units = [], []
    for key, collection, output, prefix in (("rawContextRef", document.contexts, contexts, "c"), ("rawUnitRef", document.units, units, "u")):
        refs = {row.get(key) for row in all_rows}
        for xml_id, node in collection.items():
            if xml_id not in refs:
                continue
            semantic_nodes = descendants(node)
            if prefix == "c" and sum(child.namespace == XBRLDI and child.local in ("explicitmember", "typedmember") for child in semantic_nodes) > 32:
                fail("unsupported_dimensions")
            if prefix == "u" and sum(child.namespace == XBRLI and child.local == "measure" for child in semantic_nodes) > 32:
                fail("unsupported_unit")
            output.append({"id": f"{prefix}:{node.ordinal}", "xmlId": xml_id, "elementOrdinal": node.ordinal, "root": source_xml(document.source[node.ordinal - 1])})
    result = primary_failure(request, "invalid_document")
    result.update(status="complete", reason=None, concepts=populations, contexts=contexts, units=units, reportingMetadata=metadata, structure=structure)
    return result


def read_request(request_context=None):
    raw = sys.stdin.buffer.read(INPUT_BYTES + 1)
    if len(raw) > INPUT_BYTES:
        fail("document_limit")
    def object_pairs(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                fail()
            value[key] = item
        return value
    request = json.loads(raw.decode("utf-8", "strict"), object_pairs_hook=object_pairs)
    accession = isinstance(request, dict) and request.get("mode") == "accession_evidence"
    expected_keys = {"schemaVersion", "mode", "documentBase64", "documentSha256", "cik", "selection"} if accession else {"schemaVersion", "documentBase64", "cik", "selection"}
    if not isinstance(request, dict) or set(request) != expected_keys or request["schemaVersion"] != ("1.0.0" if accession else SCHEMA_VERSION):
        fail()
    selection = request["selection"]
    if not isinstance(request["cik"], str) or not re.fullmatch(r"[0-9]{10}", request["cik"]) or int(request["cik"]) == 0:
        fail()
    if accession:
        if not isinstance(selection, dict) or set(selection) != {"accessionNumber", "form", "filedDate", "reportDate"} or not isinstance(selection["accessionNumber"], str) or not re.fullmatch(r"[0-9]{10}-[0-9]{2}-[0-9]{6}", selection["accessionNumber"]) or selection["form"] != "10-Q" or not valid_date(selection["filedDate"]) or not valid_date(selection["reportDate"]) or selection["reportDate"] > selection["filedDate"] or not isinstance(request["documentSha256"], str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", request["documentSha256"]):
            fail("invalid_input")
    elif not isinstance(selection, dict) or selection.get("concept") not in CONCEPTS or not canonical(selection.get("value")) or not valid_date(selection.get("startDate")) or not valid_date(selection.get("endDate")) or selection["startDate"] > selection["endDate"]:
        fail()
    encoded = request["documentBase64"]
    if not isinstance(encoded, str):
        fail()
    document = base64.b64decode(encoded, validate=True)
    if not document or len(document) > DOCUMENT_BYTES:
        fail("document_limit")
    if base64.b64encode(document).decode("ascii") != encoded:
        fail()
    if accession:
        request["documentBytes"] = len(document)
        if request_context is not None:
            request_context["request"] = request
        if request["documentSha256"] != "sha256:" + hashlib.sha256(document).hexdigest():
            fail("source_hash_mismatch")
    text = document.decode("utf-8-sig", "strict")
    # ASCII is a UTF-8 subset. A declared ASCII document must contain only ASCII
    # bytes, including the prolog: a UTF-8 BOM or non-ASCII byte contradicts it.
    declaration = XML_DECLARATION.match(text, 2) if text.startswith("<?") else None
    if declaration and (declaration.group("encoding") or "").upper() in {"ASCII", "US-ASCII"} and not document.isascii():
        fail()
    if CONTROL.search(text):
        fail()
    return text, selection, request["cik"]


def main():
    request_context = {}
    try:
        text, selected, cik = read_request(request_context)
        document = Document(None if request_context else selected["concept"])
        document.feed(text)
        document.finish()
        result = accession_evidence(document, request_context["request"]) if request_context else analyze(document, selected, cik)
    except Unsupported as error:
        result = primary_failure(request_context["request"], error.reason) if request_context else global_failure(error.reason)
    except (ValueError, TypeError, KeyError, UnicodeError, RecursionError, OverflowError):
        result = primary_failure(request_context["request"], "invalid_document") if request_context else global_failure("invalid_document")
    output = json.dumps(result, ensure_ascii=True, allow_nan=False, separators=(",", ":")) + "\n"
    if len(output.encode("utf-8")) > OUTPUT_BYTES:
        output = json.dumps(primary_failure(request_context["request"], "output_limit") if request_context else global_failure("output_limit"), separators=(",", ":")) + "\n"
    sys.stdout.buffer.write(output.encode("utf-8"))


if __name__ == "__main__":
    main()
