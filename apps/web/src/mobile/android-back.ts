import type { PluginListenerHandle } from "@capacitor/core";

export interface AndroidBackAdapter {
  addListener(
    eventName: "backButton",
    callback: (event: { canGoBack: boolean }) => void,
  ): Promise<PluginListenerHandle>;
  exitApp(): Promise<void>;
}

export function bindAndroidBack(
  app: AndroidBackAdapter,
  goBack: () => void,
  onUnavailable: () => void,
): () => void {
  let disposed = false;
  const subscription = app.addListener("backButton", ({ canGoBack }) => {
    if (disposed) return;
    if (canGoBack) goBack();
    else
      void app.exitApp().catch(() => {
        if (!disposed) onUnavailable();
      });
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
