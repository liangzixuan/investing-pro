import { deflateRawSync } from "node:zlib";

import {
  FILING_PARSER_LIMITS,
  type FilingParserQuarantineCode,
} from "./parser-boundary";

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const UTF8_FILE_NAME_FLAG = 0x0800;
const VERSION_NEEDED = 20;
const VERSION_MADE_BY_UNIX = (3 << 8) | VERSION_NEEDED;

export const TEST_ZIP_EXTERNAL_ATTRIBUTES = Object.freeze({
  regularFile: (0o100644 << 16) >>> 0,
  directory: ((0o040755 << 16) | 0x10) >>> 0,
  symbolicLink: (0o120777 << 16) >>> 0,
  fifo: (0o010644 << 16) >>> 0,
  characterDevice: (0o020644 << 16) >>> 0,
  blockDevice: (0o060644 << 16) >>> 0,
  socket: (0o140644 << 16) >>> 0,
});

export interface TestZipEntry {
  readonly name: string | Uint8Array;
  readonly localName?: string | Uint8Array;
  readonly content: string | Uint8Array;
  readonly versionMadeBy?: number;
  readonly compression?: "deflate" | "store";
  readonly compressionMethod?: number;
  readonly generalPurposeBitFlag?: number;
  readonly externalAttributes?: number;
  readonly localCrc32?: number;
  readonly centralCrc32?: number;
  readonly localCompressedSize?: number;
  readonly centralCompressedSize?: number;
  readonly localUncompressedSize?: number;
  readonly centralUncompressedSize?: number;
  readonly centralLocalOffset?: number;
  readonly localExtra?: Uint8Array;
  readonly centralExtra?: Uint8Array;
  readonly localHeaderOnly?: boolean;
  readonly centralDirectoryOnly?: boolean;
}

export interface TestZipOptions {
  readonly comment?: string | Uint8Array;
  readonly prefix?: Uint8Array;
  readonly suffix?: Uint8Array;
  readonly diskNumber?: number;
  readonly centralDirectoryDisk?: number;
  readonly entriesOnDisk?: number;
  readonly totalEntries?: number;
  readonly centralDirectorySize?: number;
  readonly centralDirectoryOffset?: number;
}

interface RenderedEntry {
  readonly localHeader: Buffer;
  readonly centralHeader: (localOffset: number) => Buffer;
  readonly includeLocal: boolean;
  readonly includeCentral: boolean;
}

/** Builds small deterministic ZIP inputs without invoking an archive utility. */
export function buildTestZip(
  entries: readonly TestZipEntry[],
  options: TestZipOptions = {},
): Buffer {
  const prefix = bytes(options.prefix ?? new Uint8Array());
  const suffix = bytes(options.suffix ?? new Uint8Array());
  const comment = bytes(options.comment ?? new Uint8Array());
  const rendered = entries.map(renderEntry);

  const localHeaders: Buffer[] = [];
  const localOffsets: number[] = [];
  let localLength = prefix.length;
  for (const entry of rendered) {
    localOffsets.push(localLength);
    if (!entry.includeLocal) continue;
    localHeaders.push(entry.localHeader);
    localLength += entry.localHeader.length;
  }

  const centralHeaders: Buffer[] = [];
  for (let index = 0; index < rendered.length; index += 1) {
    const entry = rendered[index];
    const localOffset = localOffsets[index];
    if (
      entry === undefined ||
      localOffset === undefined ||
      !entry.includeCentral
    )
      continue;
    centralHeaders.push(entry.centralHeader(localOffset));
  }
  const centralDirectory = Buffer.concat(centralHeaders);
  const includedCentralCount = centralHeaders.length;
  const end = Buffer.alloc(22 + comment.length);
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
  end.writeUInt16LE(uint16(options.diskNumber ?? 0), 4);
  end.writeUInt16LE(uint16(options.centralDirectoryDisk ?? 0), 6);
  end.writeUInt16LE(uint16(options.entriesOnDisk ?? includedCentralCount), 8);
  end.writeUInt16LE(uint16(options.totalEntries ?? includedCentralCount), 10);
  end.writeUInt32LE(
    uint32(options.centralDirectorySize ?? centralDirectory.length),
    12,
  );
  end.writeUInt32LE(uint32(options.centralDirectoryOffset ?? localLength), 16);
  end.writeUInt16LE(uint16(comment.length), 20);
  comment.copy(end, 22);

  return Buffer.concat([
    prefix,
    ...localHeaders,
    centralDirectory,
    end,
    suffix,
  ]);
}

/** Returns a copied buffer with one little-endian uint32 field changed. */
export function patchTestZipUint32(
  archive: Uint8Array,
  offset: number,
  value: number,
): Buffer {
  const output = bytes(archive);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + 4 > output.length)
    throw new RangeError("ZIP patch offset is outside the archive.");
  output.writeUInt32LE(uint32(value), offset);
  return output;
}

/** Locates every exact ZIP signature so tests can corrupt a reviewed field. */
export function findTestZipSignatures(
  archive: Uint8Array,
  signature: number,
): readonly number[] {
  const input = bytes(archive);
  const expected = uint32(signature);
  const offsets: number[] = [];
  for (let offset = 0; offset + 4 <= input.length; offset += 1) {
    if (input.readUInt32LE(offset) === expected) offsets.push(offset);
  }
  return Object.freeze(offsets);
}

export const TEST_ZIP_SIGNATURES = Object.freeze({
  localFileHeader: LOCAL_FILE_HEADER_SIGNATURE,
  centralDirectoryHeader: CENTRAL_DIRECTORY_HEADER_SIGNATURE,
  endOfCentralDirectory: END_OF_CENTRAL_DIRECTORY_SIGNATURE,
});

export const TEST_FILING_MANIFEST_CANONICAL =
  '{"acceptedAt":"2026-08-20T12:00:00.000Z","accession":"SYN-0000000000-26-000001","availableAt":"2026-08-20T12:01:00.000Z","document":"filing.xml","schemaVersion":"1.0.0","synthetic":true,"taxonomyVersion":"rc-synthetic-taxonomy-1.0.0"}' as const;

const TEST_XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n';
const TEST_XML_ROOT_OPEN =
  '<filing xmlns="urn:research-cockpit:synthetic:filing:v1" taxonomyVersion="rc-synthetic-taxonomy-1.0.0">';
const TEST_XML_NET_INCOME =
  '<fact concept="net_income" dimensions="none" periodEnd="2025-12-31" periodStart="2025-01-01" unit="USD">12.34</fact>';
const TEST_XML_REVENUE =
  '<fact concept="revenue" dimensions="none" periodEnd="2025-12-31" periodStart="2025-01-01" unit="USD">123.45</fact>';
const TEST_XML_ROOT_CLOSE = "</filing>\n";

export const TEST_FILING_XML_CANONICAL =
  `${TEST_XML_DECLARATION}${TEST_XML_ROOT_OPEN}${TEST_XML_NET_INCOME}${TEST_XML_REVENUE}${TEST_XML_ROOT_CLOSE}` as const;

export type ParserSecurityCaseExpected =
  | { readonly status: "accepted" }
  | {
      readonly status: "quarantined";
      readonly code: FilingParserQuarantineCode;
    };

export interface ParserSecurityCase {
  readonly id: string;
  /** A fresh test-only snapshot; callers must not mutate it during a parse. */
  readonly archive: Uint8Array;
  readonly expected: ParserSecurityCaseExpected;
}

/**
 * Builds the complete ordered Cycle 2a adversarial corpus. Every call returns
 * fresh archive bytes so one mutation test cannot contaminate another case.
 */
export function buildParserSecurityCases(): readonly ParserSecurityCase[] {
  const cases: ParserSecurityCase[] = [];
  const accepted = (id: string, archive: Uint8Array) => {
    cases.push(parserCase(id, archive, { status: "accepted" }));
  };
  const quarantined = (
    id: string,
    archive: Uint8Array,
    code: FilingParserQuarantineCode,
  ) => {
    cases.push(parserCase(id, archive, { status: "quarantined", code }));
  };

  const canonical = buildProtocolZip();
  accepted("accepted_canonical", canonical);
  accepted("accepted_exact_replay", canonical);
  accepted(
    "accepted_decimal_boundaries",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        ">12.34</fact>",
        ">-99999999999999999999999999.123456789012</fact>",
      ).replace(">123.45</fact>", ">0</fact>"),
    }),
  );
  quarantined(
    "archive_one_byte_mutation",
    mutateFirstLocalEntry(canonical),
    "archive_invalid",
  );
  quarantined("archive_empty", new Uint8Array(), "archive_invalid");
  quarantined(
    "archive_host_size_limit",
    new Uint8Array(FILING_PARSER_LIMITS.archiveBytes + 1),
    "archive_limit_exceeded",
  );
  quarantined("archive_bad_magic", utf8Bytes("not-a-zip"), "archive_invalid");
  quarantined(
    "archive_truncated_eocd",
    canonical.subarray(0, canonical.length - 1),
    "archive_invalid",
  );
  quarantined(
    "archive_prepended_polyglot",
    buildProtocolZip({ zipOptions: { prefix: utf8Bytes("MZ") } }),
    "archive_invalid",
  );
  quarantined(
    "archive_trailing_polyglot",
    buildProtocolZip({ zipOptions: { suffix: utf8Bytes("trailing") } }),
    "archive_invalid",
  );
  quarantined(
    "archive_eocd_comment",
    buildProtocolZip({ zipOptions: { comment: "comment" } }),
    "archive_invalid",
  );
  quarantined(
    "archive_multidisk_number",
    buildProtocolZip({ zipOptions: { diskNumber: 1 } }),
    "archive_invalid",
  );
  quarantined(
    "archive_multidisk_central_directory",
    buildProtocolZip({ zipOptions: { centralDirectoryDisk: 1 } }),
    "archive_invalid",
  );
  quarantined(
    "archive_entry_count_ambiguity",
    buildProtocolZip({ zipOptions: { totalEntries: 3 } }),
    "archive_invalid",
  );
  quarantined(
    "archive_zip64_signature",
    buildProtocolZip({ manifest: concatBytes(utf8Bytes("PK"), [6, 6]) }),
    "archive_invalid",
  );
  quarantined(
    "archive_central_extra_field",
    buildProtocolZip({
      manifestEntry: { centralExtra: Uint8Array.from([1, 0, 0, 0]) },
    }),
    "archive_invalid",
  );
  quarantined(
    "archive_local_extra_field",
    buildProtocolZip({
      xmlEntry: { localExtra: Uint8Array.from([1, 0, 0, 0]) },
    }),
    "archive_invalid",
  );
  quarantined(
    "archive_data_descriptor_flag",
    buildProtocolZip({ manifestEntry: { generalPurposeBitFlag: 0x0808 } }),
    "archive_invalid",
  );
  quarantined(
    "archive_local_central_filename_mismatch",
    buildProtocolZip({
      xmlEntry: { localName: "filing-manifest.json" },
    }),
    "archive_invalid",
  );
  quarantined(
    "archive_local_central_crc_mismatch",
    buildProtocolZip({ manifestEntry: { localCrc32: 0 } }),
    "archive_invalid",
  );
  quarantined(
    "archive_local_central_compressed_size_mismatch",
    buildProtocolZip({ xmlEntry: { localCompressedSize: 1 } }),
    "archive_invalid",
  );
  quarantined(
    "archive_local_central_uncompressed_size_mismatch",
    buildProtocolZip({ xmlEntry: { localUncompressedSize: 1 } }),
    "archive_invalid",
  );
  const declaredManifestPrefix = utf8Bytes(TEST_FILING_MANIFEST_CANONICAL);
  const hiddenManifestTail = Buffer.concat([
    declaredManifestPrefix,
    utf8Bytes("hidden-deflate-tail"),
  ]);
  const declaredManifestCrc32 = crc32(declaredManifestPrefix);
  quarantined(
    "archive_deflate_hidden_tail",
    buildProtocolZip({
      manifest: hiddenManifestTail,
      manifestEntry: {
        compression: "deflate",
        localCrc32: declaredManifestCrc32,
        centralCrc32: declaredManifestCrc32,
        localUncompressedSize: declaredManifestPrefix.byteLength,
        centralUncompressedSize: declaredManifestPrefix.byteLength,
      },
    }),
    "archive_invalid",
  );
  quarantined(
    "archive_central_local_offset_mismatch",
    buildProtocolZip({ xmlEntry: { centralLocalOffset: 1 } }),
    "archive_invalid",
  );
  quarantined(
    "archive_local_only_entry",
    buildProtocolZip({ xmlEntry: { localHeaderOnly: true } }),
    "archive_entry_invalid",
  );
  quarantined(
    "archive_central_only_entry",
    buildProtocolZip({ xmlEntry: { centralDirectoryOnly: true } }),
    "archive_invalid",
  );
  quarantined(
    "archive_orphan_local_entry",
    buildProtocolZip({
      extraEntries: [
        { name: "orphan", content: "orphan", localHeaderOnly: true },
      ],
    }),
    "archive_invalid",
  );
  quarantined(
    "archive_orphan_central_entry",
    buildProtocolZip({
      extraEntries: [
        {
          name: "orphan",
          content: "orphan",
          centralDirectoryOnly: true,
        },
      ],
    }),
    "archive_entry_invalid",
  );
  quarantined(
    "archive_missing_entry",
    buildTestZip([protocolManifestEntry()]),
    "archive_entry_invalid",
  );
  quarantined(
    "archive_extra_entry",
    buildProtocolZip({
      extraEntries: [{ name: "extra.txt", content: "extra" }],
    }),
    "archive_entry_invalid",
  );
  quarantined(
    "archive_duplicate_entry",
    buildTestZip([
      protocolManifestEntry(),
      protocolManifestEntry(),
      protocolXmlEntry(),
    ]),
    "archive_entry_invalid",
  );
  quarantined(
    "archive_case_colliding_entry",
    buildTestZip([
      protocolManifestEntry(),
      protocolXmlEntry(),
      { name: "FILING.XML", content: TEST_FILING_XML_CANONICAL },
    ]),
    "archive_entry_invalid",
  );
  for (const [id, name] of [
    ["archive_entry_parent_traversal", "../filing.xml"],
    ["archive_entry_absolute_path", "/filing.xml"],
    ["archive_entry_windows_drive", "C:/filing.xml"],
    ["archive_entry_backslash", "folder\\filing.xml"],
    ["archive_entry_nul", "filing.xml\u0000suffix"],
    ["archive_entry_non_ascii", "filing-é.xml"],
  ] as const) {
    quarantined(
      id,
      buildTestZip([
        protocolManifestEntry(),
        { name, content: TEST_FILING_XML_CANONICAL },
      ]),
      "archive_entry_invalid",
    );
  }
  for (const [id, externalAttributes] of [
    ["archive_entry_unspecified_mode", 0],
    ["archive_entry_permissions_only_mode", (0o644 << 16) >>> 0],
    [
      "archive_entry_hybrid_directory_mode",
      (TEST_ZIP_EXTERNAL_ATTRIBUTES.regularFile | 0x10) >>> 0,
    ],
    ["archive_entry_directory_mode", TEST_ZIP_EXTERNAL_ATTRIBUTES.directory],
    ["archive_entry_symlink_mode", TEST_ZIP_EXTERNAL_ATTRIBUTES.symbolicLink],
    ["archive_entry_fifo_mode", TEST_ZIP_EXTERNAL_ATTRIBUTES.fifo],
    ["archive_entry_socket_mode", TEST_ZIP_EXTERNAL_ATTRIBUTES.socket],
    [
      "archive_entry_block_device_mode",
      TEST_ZIP_EXTERNAL_ATTRIBUTES.blockDevice,
    ],
    [
      "archive_entry_character_device_mode",
      TEST_ZIP_EXTERNAL_ATTRIBUTES.characterDevice,
    ],
  ] as const) {
    quarantined(
      id,
      buildProtocolZip({ xmlEntry: { externalAttributes } }),
      "archive_entry_invalid",
    );
  }
  quarantined(
    "archive_entry_non_unix_origin",
    buildProtocolZip({ xmlEntry: { versionMadeBy: VERSION_NEEDED } }),
    "archive_entry_invalid",
  );
  quarantined(
    "archive_encrypted_entry",
    buildProtocolZip({ manifestEntry: { generalPurposeBitFlag: 0x0801 } }),
    "archive_encrypted",
  );
  quarantined(
    "archive_unsupported_compression",
    buildProtocolZip({ xmlEntry: { compressionMethod: 12 } }),
    "archive_invalid",
  );
  quarantined(
    "archive_compression_ratio_limit",
    buildProtocolZip({
      xml: "A".repeat(100_000),
      xmlEntry: { compression: "deflate" },
    }),
    "archive_limit_exceeded",
  );
  for (const [id, entry, content] of [
    [
      "archive_nested_zip_manifest",
      "manifest",
      buildTestZip([{ name: "nested", content: "nested" }]),
    ],
    [
      "archive_nested_zip_xml",
      "xml",
      buildTestZip([{ name: "nested", content: "nested" }]),
    ],
    [
      "archive_nested_gzip_manifest",
      "manifest",
      Uint8Array.from([0x1f, 0x8b, 0x08, 0]),
    ],
    ["archive_nested_gzip_xml", "xml", Uint8Array.from([0x1f, 0x8b, 0x08, 0])],
    ["archive_nested_tar_manifest", "manifest", tarPayload()],
    ["archive_nested_tar_xml", "xml", tarPayload()],
  ] as const) {
    quarantined(
      id,
      buildProtocolZip(
        entry === "manifest" ? { manifest: content } : { xml: content },
      ),
      "archive_nested",
    );
  }

  quarantined(
    "manifest_duplicate_key",
    buildProtocolZip({
      manifest: TEST_FILING_MANIFEST_CANONICAL.replace(
        '"synthetic":true',
        '"synthetic":true,"synthetic":true',
      ),
    }),
    "manifest_invalid",
  );
  quarantined(
    "manifest_noncanonical_whitespace",
    buildProtocolZip({ manifest: `${TEST_FILING_MANIFEST_CANONICAL}\n` }),
    "manifest_invalid",
  );
  quarantined(
    "manifest_noncanonical_key_order",
    buildProtocolZip({
      manifest:
        '{"accession":"SYN-0000000000-26-000001","acceptedAt":"2026-08-20T12:00:00.000Z","availableAt":"2026-08-20T12:01:00.000Z","document":"filing.xml","schemaVersion":"1.0.0","synthetic":true,"taxonomyVersion":"rc-synthetic-taxonomy-1.0.0"}',
    }),
    "manifest_invalid",
  );
  quarantined(
    "manifest_non_ascii",
    buildProtocolZip({
      manifest: TEST_FILING_MANIFEST_CANONICAL.replace(
        "filing.xml",
        "filing-é.xml",
      ),
    }),
    "manifest_invalid",
  );
  quarantined(
    "manifest_unknown_key",
    buildProtocolZip({
      manifest: TEST_FILING_MANIFEST_CANONICAL.replace(
        '"taxonomyVersion"',
        '"extra":true,"taxonomyVersion"',
      ),
    }),
    "manifest_invalid",
  );
  quarantined(
    "manifest_url_document",
    buildProtocolZip({
      manifest: TEST_FILING_MANIFEST_CANONICAL.replace(
        '"document":"filing.xml"',
        '"document":"https://example.invalid/filing.xml"',
      ),
    }),
    "manifest_invalid",
  );
  quarantined(
    "manifest_invalid_accession",
    buildProtocolZip({
      manifest: TEST_FILING_MANIFEST_CANONICAL.replace(
        "SYN-0000000000-26-000001",
        "../../secret",
      ),
    }),
    "manifest_invalid",
  );
  quarantined(
    "manifest_invalid_timestamp",
    buildProtocolZip({
      manifest: TEST_FILING_MANIFEST_CANONICAL.replace(
        "2026-08-20T12:00:00.000Z",
        "2026-02-30T12:00:00.000Z",
      ),
    }),
    "manifest_invalid",
  );
  quarantined(
    "manifest_available_before_accepted",
    buildProtocolZip({
      manifest: TEST_FILING_MANIFEST_CANONICAL.replace(
        "2026-08-20T12:01:00.000Z",
        "2026-08-20T11:59:59.999Z",
      ),
    }),
    "manifest_invalid",
  );
  quarantined(
    "manifest_taxonomy_not_allowed",
    buildProtocolZip({
      manifest: TEST_FILING_MANIFEST_CANONICAL.replace(
        "rc-synthetic-taxonomy-1.0.0",
        "rc-synthetic-taxonomy-9.9.9",
      ),
    }),
    "taxonomy_not_allowed",
  );
  quarantined(
    "manifest_size_limit",
    buildProtocolZip({
      manifest: pseudoRandomAscii(
        FILING_PARSER_LIMITS.manifestBytes + 1,
        "abcd",
      ),
    }),
    "archive_limit_exceeded",
  );

  quarantined(
    "xml_doctype",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        TEST_XML_ROOT_OPEN,
        `<!DOCTYPE filing>${TEST_XML_ROOT_OPEN}`,
      ),
    }),
    "xml_forbidden_construct",
  );
  quarantined(
    "xml_entity",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        TEST_XML_ROOT_OPEN,
        `<!DOCTYPE filing [<!ENTITY xxe SYSTEM "https://example.invalid/xxe">]>${TEST_XML_ROOT_OPEN}`,
      ),
    }),
    "xml_forbidden_construct",
  );
  quarantined(
    "xml_xinclude",
    buildProtocolZip({
      xml: `${TEST_XML_DECLARATION}${TEST_XML_ROOT_OPEN}<fact xmlns="http://www.w3.org/2001/XInclude"/>${TEST_XML_REVENUE}${TEST_XML_ROOT_CLOSE}`,
    }),
    "xml_forbidden_construct",
  );
  quarantined(
    "xml_processing_instruction_url",
    buildProtocolZip({
      xml: `${TEST_XML_DECLARATION}${TEST_XML_ROOT_OPEN}<?remote href="https://example.invalid/value"?>${TEST_XML_NET_INCOME}${TEST_XML_REVENUE}${TEST_XML_ROOT_CLOSE}`,
    }),
    "xml_forbidden_construct",
  );
  quarantined(
    "xml_comment",
    buildProtocolZip({
      xml: `${TEST_XML_DECLARATION}${TEST_XML_ROOT_OPEN}<!-- hidden -->${TEST_XML_NET_INCOME}${TEST_XML_REVENUE}${TEST_XML_ROOT_CLOSE}`,
    }),
    "xml_forbidden_construct",
  );
  quarantined(
    "xml_cdata",
    buildProtocolZip({
      xml: `${TEST_XML_DECLARATION}${TEST_XML_ROOT_OPEN}<![CDATA[hidden]]>${TEST_XML_NET_INCOME}${TEST_XML_REVENUE}${TEST_XML_ROOT_CLOSE}`,
    }),
    "xml_forbidden_construct",
  );
  quarantined(
    "xml_depth_limit",
    buildProtocolZip({
      xml: `${TEST_XML_DECLARATION}${TEST_XML_ROOT_OPEN}${"<n>".repeat(FILING_PARSER_LIMITS.xmlDepth)}${"</n>".repeat(FILING_PARSER_LIMITS.xmlDepth)}${TEST_XML_ROOT_CLOSE}`,
    }),
    "xml_limit_exceeded",
  );
  quarantined(
    "xml_node_limit",
    buildProtocolZip({
      xml: `${TEST_XML_DECLARATION}${TEST_XML_ROOT_OPEN}${"<n/>".repeat(FILING_PARSER_LIMITS.xmlNodes)}${TEST_XML_ROOT_CLOSE}`,
    }),
    "xml_limit_exceeded",
  );
  quarantined(
    "xml_attribute_limit",
    buildProtocolZip({
      xml: `${TEST_XML_DECLARATION}${TEST_XML_ROOT_OPEN}<n ${Array.from(
        { length: FILING_PARSER_LIMITS.xmlAttributesPerElement + 1 },
        (_value, index) => `a${index}="x"`,
      ).join(" ")}/>${TEST_XML_ROOT_CLOSE}`,
    }),
    "xml_limit_exceeded",
  );
  quarantined(
    "xml_text_codepoint_limit",
    buildProtocolZip({
      xml: rootTextXml(FILING_PARSER_LIMITS.xmlTextCodePoints + 1, "abcd"),
      xmlEntry: { compression: "deflate" },
    }),
    "xml_limit_exceeded",
  );
  quarantined(
    "xml_declared_size_limit",
    buildProtocolZip({
      xml: rootTextXml(FILING_PARSER_LIMITS.xmlBytes + 1, "abcd"),
      xmlEntry: { compression: "deflate" },
    }),
    "archive_limit_exceeded",
  );
  quarantined("xml_empty", buildProtocolZip({ xml: "" }), "xml_limit_exceeded");
  quarantined(
    "xml_invalid_utf8",
    buildProtocolZip({ xml: Uint8Array.from([0xff, 0xfe, 0xfd]) }),
    "xml_invalid",
  );
  quarantined(
    "xml_utf16_encoding",
    buildProtocolZip({
      xml: Uint8Array.from(Buffer.from(TEST_FILING_XML_CANONICAL, "utf16le")),
    }),
    "xml_invalid",
  );
  quarantined(
    "xml_non_utf8_declaration",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace("UTF-8", "ISO-8859-1"),
    }),
    "xml_invalid",
  );
  quarantined(
    "xml_extra_namespace_declaration",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        " taxonomyVersion=",
        ' xmlns:evil="urn:example:hostile" taxonomyVersion=',
      ),
    }),
    "xml_invalid",
  );
  quarantined(
    "xml_prefixed_namespace",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        '<filing xmlns="',
        '<rc:filing xmlns:rc="',
      )
        .replaceAll("<fact ", "<rc:fact ")
        .replaceAll("</fact>", "</rc:fact>")
        .replace("</filing>", "</rc:filing>"),
    }),
    "xml_invalid",
  );
  quarantined(
    "xml_namespace_not_allowed",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        "urn:research-cockpit:synthetic:filing:v1",
        "urn:example:hostile",
      ),
    }),
    "taxonomy_not_allowed",
  );
  quarantined(
    "xml_taxonomy_not_allowed",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        "rc-synthetic-taxonomy-1.0.0",
        "rc-synthetic-taxonomy-9.9.9",
      ),
    }),
    "taxonomy_not_allowed",
  );
  quarantined(
    "xml_concept_not_allowed",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        'concept="revenue"',
        'concept="assets"',
      ),
    }),
    "taxonomy_not_allowed",
  );
  quarantined(
    "xml_duplicate_concept",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        'concept="revenue"',
        'concept="net_income"',
      ),
    }),
    "fact_ambiguous",
  );
  quarantined(
    "xml_reversed_concept_order",
    buildProtocolZip({
      xml: `${TEST_XML_DECLARATION}${TEST_XML_ROOT_OPEN}${TEST_XML_REVENUE}${TEST_XML_NET_INCOME}${TEST_XML_ROOT_CLOSE}`,
    }),
    "fact_invalid",
  );
  for (const [id, value] of [
    ["fact_decimal_exponent", "1e3"],
    ["fact_decimal_plus_sign", "+1"],
    ["fact_decimal_leading_zero", "01"],
    ["fact_decimal_integer_precision", "1".repeat(27)],
    ["fact_decimal_scale", `0.${"1".repeat(13)}`],
  ] as const) {
    quarantined(
      id,
      buildProtocolZip({
        xml: TEST_FILING_XML_CANONICAL.replace(
          ">12.34</fact>",
          `>${value}</fact>`,
        ),
      }),
      "fact_invalid",
    );
  }
  quarantined(
    "fact_invalid_date",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        'periodEnd="2025-12-31"',
        'periodEnd="2025-02-30"',
      ),
    }),
    "fact_invalid",
  );
  quarantined(
    "fact_period_reversed",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        'periodStart="2025-01-01"',
        'periodStart="2026-01-01"',
      ),
    }),
    "fact_invalid",
  );
  quarantined(
    "fact_unit_not_allowed",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace('unit="USD"', 'unit="EUR"'),
    }),
    "fact_invalid",
  );
  quarantined(
    "fact_dimensions_not_empty",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        'dimensions="none"',
        'dimensions="segment:retail"',
      ),
    }),
    "fact_invalid",
  );
  quarantined(
    "fact_missing",
    buildProtocolZip({
      xml: `${TEST_XML_DECLARATION}${TEST_XML_ROOT_OPEN}${TEST_XML_NET_INCOME}${TEST_XML_ROOT_CLOSE}`,
    }),
    "fact_invalid",
  );
  quarantined(
    "fact_extra",
    buildProtocolZip({
      xml: `${TEST_XML_DECLARATION}${TEST_XML_ROOT_OPEN}${TEST_XML_NET_INCOME}${TEST_XML_REVENUE}${TEST_XML_REVENUE}${TEST_XML_ROOT_CLOSE}`,
    }),
    "fact_invalid",
  );
  quarantined(
    "fact_child_element",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        ">12.34</fact>",
        "><n/>12.34</fact>",
      ),
    }),
    "fact_invalid",
  );
  quarantined(
    "fact_extra_attribute",
    buildProtocolZip({
      xml: TEST_FILING_XML_CANONICAL.replace(
        'unit="USD">12.34',
        'unit="USD" secret="canary">12.34',
      ),
    }),
    "fact_invalid",
  );

  const ids = new Set(cases.map((value) => value.id));
  if (ids.size !== cases.length) {
    throw new Error("Parser security case identifiers must be unique.");
  }
  return Object.freeze(cases);
}

interface ProtocolZipOptions {
  readonly manifest?: string | Uint8Array;
  readonly xml?: string | Uint8Array;
  readonly manifestEntry?: Partial<TestZipEntry>;
  readonly xmlEntry?: Partial<TestZipEntry>;
  readonly extraEntries?: readonly TestZipEntry[];
  readonly zipOptions?: TestZipOptions;
}

function buildProtocolZip(options: ProtocolZipOptions = {}): Buffer {
  return buildTestZip(
    [
      protocolManifestEntry(options.manifest, options.manifestEntry),
      protocolXmlEntry(options.xml, options.xmlEntry),
      ...(options.extraEntries ?? []),
    ],
    options.zipOptions,
  );
}

function protocolManifestEntry(
  content: string | Uint8Array = TEST_FILING_MANIFEST_CANONICAL,
  overrides: Partial<TestZipEntry> = {},
): TestZipEntry {
  return {
    name: "filing-manifest.json",
    content,
    ...overrides,
  };
}

function protocolXmlEntry(
  content: string | Uint8Array = TEST_FILING_XML_CANONICAL,
  overrides: Partial<TestZipEntry> = {},
): TestZipEntry {
  return { name: "filing.xml", content, ...overrides };
}

function parserCase(
  id: string,
  archive: Uint8Array,
  expected: ParserSecurityCaseExpected,
): ParserSecurityCase {
  if (!/^[a-z][a-z0-9_]{2,79}$/u.test(id)) {
    throw new Error("Parser security case identifier is invalid.");
  }
  return Object.freeze({
    id,
    archive: Uint8Array.from(archive),
    expected: Object.freeze({ ...expected }),
  });
}

function mutateFirstLocalEntry(archive: Uint8Array): Buffer {
  const output = bytes(archive);
  if (output.readUInt32LE(0) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error("Canonical test ZIP lost its first local header.");
  }
  const nameLength = output.readUInt16LE(26);
  const extraLength = output.readUInt16LE(28);
  const dataOffset = 30 + nameLength + extraLength;
  if (dataOffset >= output.length) throw new Error("Test ZIP entry is empty.");
  output[dataOffset] = (output[dataOffset] ?? 0) ^ 1;
  return output;
}

function tarPayload(): Buffer {
  const output = Buffer.alloc(512, 0x61);
  output.write("ustar", 257, "ascii");
  return output;
}

function rootTextXml(length: number, alphabet: string): Buffer {
  return Buffer.concat([
    utf8Bytes(`${TEST_XML_DECLARATION}${TEST_XML_ROOT_OPEN}`),
    pseudoRandomAscii(length, alphabet),
    utf8Bytes(
      `${TEST_XML_NET_INCOME}${TEST_XML_REVENUE}${TEST_XML_ROOT_CLOSE}`,
    ),
  ]);
}

function pseudoRandomAscii(length: number, alphabet: string): Buffer {
  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    alphabet.length < 2 ||
    !/^[\x20-\x7e]+$/u.test(alphabet)
  ) {
    throw new Error("Pseudo-random test text configuration is invalid.");
  }
  const output = Buffer.alloc(length);
  let state = 0x6d2b79f5;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const character = alphabet.charCodeAt((state >>> 0) % alphabet.length);
    output[index] = character;
  }
  return output;
}

function concatBytes(left: Uint8Array, right: readonly number[]): Buffer {
  return Buffer.concat([bytes(left), Buffer.from(right)]);
}

function utf8Bytes(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

function renderEntry(entry: TestZipEntry): RenderedEntry {
  const name = bytes(entry.name);
  const localName = bytes(entry.localName ?? entry.name);
  const content = bytes(entry.content);
  const compressionMethod = uint16(
    entry.compressionMethod ?? (entry.compression === "deflate" ? 8 : 0),
  );
  const compressed =
    compressionMethod === 8
      ? deflateRawSync(content, { level: 9 })
      : Buffer.from(content);
  const flags = uint16(entry.generalPurposeBitFlag ?? UTF8_FILE_NAME_FLAG);
  const checksum = crc32(content);
  const localExtra = bytes(entry.localExtra ?? new Uint8Array());
  const centralExtra = bytes(entry.centralExtra ?? new Uint8Array());
  const externalAttributes = uint32(
    entry.externalAttributes ?? TEST_ZIP_EXTERNAL_ATTRIBUTES.regularFile,
  );

  const local = Buffer.alloc(30 + localName.length + localExtra.length);
  local.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0);
  local.writeUInt16LE(VERSION_NEEDED, 4);
  local.writeUInt16LE(flags, 6);
  local.writeUInt16LE(compressionMethod, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0, 12);
  local.writeUInt32LE(uint32(entry.localCrc32 ?? checksum), 14);
  local.writeUInt32LE(
    uint32(entry.localCompressedSize ?? compressed.length),
    18,
  );
  local.writeUInt32LE(
    uint32(entry.localUncompressedSize ?? content.length),
    22,
  );
  local.writeUInt16LE(uint16(localName.length), 26);
  local.writeUInt16LE(uint16(localExtra.length), 28);
  localName.copy(local, 30);
  localExtra.copy(local, 30 + localName.length);
  const localHeader = Buffer.concat([local, compressed]);

  const centralHeader = (localOffset: number): Buffer => {
    const central = Buffer.alloc(46 + name.length + centralExtra.length);
    central.writeUInt32LE(CENTRAL_DIRECTORY_HEADER_SIGNATURE, 0);
    central.writeUInt16LE(
      uint16(entry.versionMadeBy ?? VERSION_MADE_BY_UNIX),
      4,
    );
    central.writeUInt16LE(VERSION_NEEDED, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(compressionMethod, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(uint32(entry.centralCrc32 ?? checksum), 16);
    central.writeUInt32LE(
      uint32(entry.centralCompressedSize ?? compressed.length),
      20,
    );
    central.writeUInt32LE(
      uint32(entry.centralUncompressedSize ?? content.length),
      24,
    );
    central.writeUInt16LE(uint16(name.length), 28);
    central.writeUInt16LE(uint16(centralExtra.length), 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(externalAttributes, 38);
    central.writeUInt32LE(uint32(entry.centralLocalOffset ?? localOffset), 42);
    name.copy(central, 46);
    centralExtra.copy(central, 46 + name.length);
    return central;
  };

  return {
    localHeader,
    centralHeader,
    includeLocal: entry.centralDirectoryOnly !== true,
    includeCentral: entry.localHeaderOnly !== true,
  };
}

function crc32(value: Uint8Array): number {
  let checksum = 0xffffffff;
  for (const byte of value) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(checksum & 1);
      checksum = (checksum >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function bytes(value: string | Uint8Array): Buffer {
  return typeof value === "string"
    ? Buffer.from(value, "utf8")
    : Buffer.from(value);
}

function uint16(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff)
    throw new RangeError("ZIP uint16 field is outside its range.");
  return value;
}

function uint32(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff)
    throw new RangeError("ZIP uint32 field is outside its range.");
  return value;
}
