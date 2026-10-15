export interface BrowserTextDownloadContext {
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
}
export type BrowserTextDownloadResult = "download_requested" | "cancelled";

function releaseAfterFrame(
  url: string,
  context: BrowserTextDownloadContext,
): Promise<BrowserTextDownloadResult> {
  return new Promise((resolve) => {
    let frame = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.cancelAnimationFrame(frame);
      URL.revokeObjectURL(url);
      context.signal.removeEventListener("abort", finish);
      resolve("download_requested");
    };
    context.signal.addEventListener("abort", finish, { once: true });
    try {
      frame = window.requestAnimationFrame(finish);
    } catch {
      finish();
    }
    if (context.signal.aborted) finish();
  });
}

export function createBrowserTextDownload<
  T extends { readonly text: string; readonly filename: string },
>(
  admitted: (value: unknown) => value is T,
  mediaType: string,
  failureMessage: string,
) {
  return {
    async deliver(value: T, context: BrowserTextDownloadContext) {
      if (context.signal.aborted || !context.isCurrent()) return "cancelled";
      if (!admitted(value)) throw new Error(failureMessage);
      let url: string | null = null;
      let anchor: HTMLAnchorElement | null = null;
      try {
        url = URL.createObjectURL(new Blob([value.text], { type: mediaType }));
        anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = value.filename;
        anchor.hidden = true;
        document.body.append(anchor);
        if (context.signal.aborted || !context.isCurrent()) {
          URL.revokeObjectURL(url);
          return "cancelled";
        }
        anchor.click();
        return releaseAfterFrame(url, context);
      } catch {
        if (url !== null) URL.revokeObjectURL(url);
        throw new Error(failureMessage);
      } finally {
        anchor?.remove();
      }
    },
  };
}
