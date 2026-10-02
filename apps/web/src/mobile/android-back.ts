import type { PluginListenerHandle } from "@capacitor/core";

export interface AndroidBackAdapter {
  addListener(
    eventName: "backButton",
    callback: (event: { canGoBack: boolean }) => void,
  ): Promise<PluginListenerHandle>;
}

export function bindAndroidBack(
  app: AndroidBackAdapter,
  onBack: (event: { canGoBack: boolean }) => void | Promise<void>,
  onUnavailable: () => void,
): () => void {
  let disposed = false;
  const subscription = app.addListener("backButton", (event) => {
    if (disposed) return;
    try {
      void Promise.resolve(onBack(event)).catch(() => {
        if (!disposed) onUnavailable();
      });
    } catch {
      if (!disposed) onUnavailable();
    }
  });
  void subscription.catch(() => {
    if (!disposed) onUnavailable();
  });
  return () => {
    if (disposed) return;
    disposed = true;
    void subscription.then((handle) => handle.remove()).catch(() => undefined);
  };
}
