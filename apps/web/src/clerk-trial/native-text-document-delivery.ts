import type { TextDocumentDeliveryContext } from "./document-delivery";
export type NativeDocumentDeliveryResult = "written" | "cancelled";
export interface NativeTextDocumentPlugin<M extends object> {
  readonly choose: (
    options: M & { operationId: string },
  ) => Promise<{ status: "chosen"; handle: string } | { status: "cancelled" }>;
  readonly write: (options: {
    operationId: string;
    handle: string;
    text: string;
  }) => Promise<{ status: "written" }>;
  readonly cancel: (options: { operationId: string }) => Promise<void>;
}
const current = (context: TextDocumentDeliveryContext) =>
  !context.signal.aborted && context.isCurrent();

export function createNativeTextDocumentDelivery<
  T extends { readonly text: string },
  M extends object,
>(
  plugin: NativeTextDocumentPlugin<M>,
  admitted: (document: unknown) => document is T,
  metadata: (document: T) => M,
  failureMessage: string,
) {
  let busy = false;
  return {
    async deliver(document: T, context: TextDocumentDeliveryContext) {
      if (!admitted(document) || busy) throw new Error(failureMessage);
      if (!current(context)) return "cancelled";
      const captured = { ...document };
      const operationId = crypto.randomUUID();
      busy = true;
      let cancelled = false;
      const cancel = () => {
        if (cancelled) return;
        cancelled = true;
        try {
          void plugin.cancel({ operationId }).catch(() => undefined);
        } catch {
          // Cancellation cannot expose a bridge exception or retry the export.
        }
      };
      context.signal.addEventListener("abort", cancel, { once: true });
      try {
        return await chooseAndWrite(
          plugin,
          captured,
          metadata(captured),
          context,
          operationId,
          failureMessage,
        );
      } catch {
        if (!current(context)) return "cancelled";
        throw new Error(failureMessage);
      } finally {
        context.signal.removeEventListener("abort", cancel);
        cancel();
        busy = false;
      }
    },
  };
}

async function chooseAndWrite<
  T extends { readonly text: string },
  M extends object,
>(
  plugin: NativeTextDocumentPlugin<M>,
  document: T,
  metadata: M,
  context: TextDocumentDeliveryContext,
  operationId: string,
  failureMessage: string,
): Promise<NativeDocumentDeliveryResult> {
  if (!current(context)) return "cancelled";
  const choice = await plugin.choose({
    ...metadata,
    operationId,
  });
  if (!current(context)) return "cancelled";
  if (isCancelled(choice)) return "cancelled";
  if (!isChosen(choice)) throw new Error(failureMessage);
  const result = await plugin.write({
    operationId,
    handle: choice.handle,
    text: document.text,
  });
  if (!current(context)) return "cancelled";
  if (
    !result ||
    Object.keys(result).length !== 1 ||
    result.status !== "written"
  )
    throw new Error(failureMessage);
  return "written";
}

function isCancelled(value: unknown): value is { status: "cancelled" } {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.keys(value).length === 1 &&
    "status" in value &&
    value.status === "cancelled"
  );
}

function isChosen(
  value: unknown,
): value is { status: "chosen"; handle: string } {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.keys(value).length === 2 &&
    "status" in value &&
    value.status === "chosen" &&
    "handle" in value &&
    typeof value.handle === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(
      value.handle,
    )
  );
}
