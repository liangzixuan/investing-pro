type CompressedNotices = {
  readonly base64: string;
  readonly byteLength: number;
};

async function readNoticeBytes(
  stream: ReadableStream<Uint8Array>,
  expectedBytes: number,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    signal.throwIfAborted();
    for (;;) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > expectedBytes) throw new Error("Unexpected notice length.");
      chunks.push(value);
    }
    if (size !== expectedBytes) throw new Error("Incomplete notice text.");
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    signal.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function decodeThirdPartyNotices(
  payload: CompressedNotices,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  if (
    typeof DecompressionStream !== "function" ||
    !Number.isSafeInteger(payload.byteLength) ||
    payload.byteLength <= 0
  ) {
    throw new Error("Software license decoding is unavailable.");
  }
  const bytes = Uint8Array.from(atob(payload.base64), (value) =>
    value.charCodeAt(0),
  );
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const decoded = await readNoticeBytes(stream, payload.byteLength, signal);
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
    decoded,
  );
}

export async function loadThirdPartyNotices(
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  const [notices, icons, font] = await Promise.all([
    import("virtual:investment-third-party-notices"),
    import("./icons/LICENSE.txt?raw"),
    import("./fonts/OFL.txt?raw"),
  ]);
  const text = await decodeThirdPartyNotices(notices.default, signal);
  signal.throwIfAborted();
  return `${text}\n\nTabler Icons\n\n${icons.default}\n\nInter\n\n${font.default}`;
}
