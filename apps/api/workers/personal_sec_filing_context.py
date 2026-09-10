"""One bounded iXBRL projection. Standard library only; no document/network access.

This is a deliberately narrow correspondence inspector, not a DTS validator.
Transform definitions: XBRL transformation registries REC-2015-02-26,
REC-2020-02-12 and REC-2022-02-16. Unsupported constructs never yield a match.
"""
from __future__ import annotations

import base64
import datetime
import json
import re
import sys
from html.parser import HTMLParser

DOCUMENT_BYTES = 32 * 1024 * 1024
INPUT_BYTES = 45 * 1024 * 1024
OUTPUT_BYTES = 1024 * 1024
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
VOID = frozenset("area base br col embed hr img input link meta param source track wbr".split())
CONCEPTS = {"RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "NetIncomeLoss"}
SPACES = " \t\r\n\u00a0"
SEMANTIC_NAMES = {
    XBRLI: {"startdate": "startDate", "enddate": "endDate", "unitnumerator": "unitNumerator", "unitdenominator": "unitDenominator"},
    XBRLDI: {"explicitmember": "explicitMember", "typedmember": "typedMember"},
    **{namespace: {"nonfraction": "nonFraction", "nonnumeric": "nonNumeric"} for namespace in IX},
}
SEMANTIC_ATTRIBUTES = {"contextref": "contextRef", "unitref": "unitRef", "continuedat": "continuedAt", "tupleref": "tupleRef", "tupleid": "tupleID", "footnoterefs": "footnoteRefs"}


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
    __slots__ = ("tag", "namespace", "local", "attrs", "namespaces", "ordinal", "children", "parts", "text_length")

    def __init__(self, tag, namespace, local, attrs, namespaces, ordinal):
        self.tag, self.namespace, self.local = tag, namespace, local
        self.attrs, self.namespaces, self.ordinal = attrs, namespaces, ordinal
        self.children, self.parts, self.text_length = [], [], 0

    def text(self):
        return "".join(self.parts)


class Document(HTMLParser):
    def __init__(self, concept):
        super().__init__(convert_charrefs=True)
        self.concept, self.stack, self.contexts, self.units, self.facts = concept, [], {}, {}, []
        self.nodes, self.ids, self.doctype = 0, set(), False
        self.closed_void = False

    def handle_decl(self, declaration):
        if self.doctype or declaration.strip().lower() != "doctype html":
            fail()
        self.doctype = True

    def unknown_decl(self, _data):
        fail()

    def handle_pi(self, data):
        # A leading XML declaration is common in XHTML; no other PI is consumed.
        if self.nodes or self.stack or not re.fullmatch(r'xml\s+version=[\"\']1\.0[\"\'](?:\s+encoding=[\"\']UTF-8[\"\'])?\s*\?', data, re.I):
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
        attrs = {}
        for (key, value), raw_key in zip(attributes, attribute_names):
            if key in attrs:
                fail()
            if raw_key.lower() != key:
                fail()
            if (key == "xmlns" or key.startswith("xmlns:")) and (raw_key != key or raw_key in unquoted_attributes):
                fail("invalid_namespace")
            attrs[key] = "" if value is None else value
        inherited = self.stack[-1][1] if self.stack else {"xml": XML}
        namespaces = inherited
        declarations = [(key, value) for key, value in attrs.items() if key == "xmlns" or key.startswith("xmlns:")]
        if declarations:
            namespaces = dict(inherited)
            # HTMLParser lowercases names. Reject case-sensitive namespace declarations
            # it cannot preserve, instead of silently conflating XML prefixes.
            for prefix in re.findall(r"\bxmlns:([^\s=]+)\s*=", self.get_starttag_text() or ""):
                if prefix != prefix.lower():
                    fail("invalid_namespace")
            for key, value in declarations:
                prefix = key.partition(":")[2]
                bounded(value)
                if (prefix == "xml" and value != XML) or prefix == "xmlns" or value == "http://www.w3.org/2000/xmlns/" or (value == XML and prefix != "xml"):
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
            for raw_key in attribute_names:
                key = raw_key.lower()
                if ":" not in key and raw_key != SEMANTIC_ATTRIBUTES.get(key, key):
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
        is_fact = (local in ("nonfraction", "fraction", "nonnumeric") and name["localName"] == self.concept) or (expanded["localName"] == self.concept.lower() and gaap_namespace(namespace))
        capture = parent is not None or is_context or is_unit or is_fact
        node = Node(tag, namespace, local, attrs, namespaces, self.nodes) if capture else None
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
            if len(self.facts) >= 100:
                fail("candidate_limit")
            self.facts.append(node)
        self.stack.append((tag, namespaces, node))
        if namespace in (None, "", XHTML) and local in VOID and ":" not in tag:
            self.handle_endtag(tag)
            self.closed_void = True

    def handle_endtag(self, tag):
        if not self.stack or self.stack[-1][0] != tag:
            fail()
        _tag, namespaces, node = self.stack.pop()
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
        # Only retain bounded context/unit/fact content, never unrelated filing HTML.
        for _tag, _ns, node in self.stack:
            if node is not None:
                node.text_length += utf16_length(data)
                if node.text_length > 4096:
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
                if candidate["startDate"] != selected["startDate"] or candidate["endDate"] != selected["endDate"]:
                    issues.append("period_mismatch")
            elif len(instants) == 1 and len(period.children) == 1 and not instants[0].children and valid_date(instants[0].text().strip()):
                candidate.update(periodKind="instant", endDate=instants[0].text().strip())
                issues.append("period_mismatch")
            else:
                issues.append("unsupported_period")
        else:
            issues.append("unsupported_period")
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
    return {"status": status, "reason": reason, "candidates": candidates, "correspondingCandidateLocators": [row["locator"] for row in corresponding]}


def read_request():
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
    if not isinstance(request, dict) or set(request) != {"documentBase64", "cik", "selection"}:
        fail()
    selection = request["selection"]
    if not isinstance(selection, dict) or selection.get("concept") not in CONCEPTS or not canonical(selection.get("value")) or not valid_date(selection.get("startDate")) or not valid_date(selection.get("endDate")) or selection["startDate"] > selection["endDate"] or not re.fullmatch(r"[0-9]{10}", request["cik"]) or int(request["cik"]) == 0:
        fail()
    encoded = request["documentBase64"]
    if not isinstance(encoded, str):
        fail()
    document = base64.b64decode(encoded, validate=True)
    if not document or len(document) > DOCUMENT_BYTES:
        fail("document_limit")
    if base64.b64encode(document).decode("ascii") != encoded:
        fail()
    text = document.decode("utf-8-sig", "strict")
    if CONTROL.search(text):
        fail()
    return text, selection, request["cik"]


def main():
    try:
        text, selected, cik = read_request()
        document = Document(selected["concept"])
        document.feed(text)
        document.finish()
        result = analyze(document, selected, cik)
    except Unsupported as error:
        result = {"status": "unsupported", "reason": error.reason, "candidates": [], "correspondingCandidateLocators": []}
    except (ValueError, TypeError, KeyError, UnicodeError, RecursionError, OverflowError):
        result = {"status": "unsupported", "reason": "invalid_document", "candidates": [], "correspondingCandidateLocators": []}
    output = json.dumps(result, ensure_ascii=True, allow_nan=False, separators=(",", ":")) + "\n"
    if len(output.encode("utf-8")) > OUTPUT_BYTES:
        output = '{"status":"unsupported","reason":"output_limit","candidates":[],"correspondingCandidateLocators":[]}\n'
    sys.stdout.write(output)


if __name__ == "__main__":
    main()
