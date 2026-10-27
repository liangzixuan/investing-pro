import { ManagedInterimReport } from "./managed-interim-report";
/** An explicit unloaded model for pre-existing source-only test scenarios. */
export function unloadedInterim() {
  return new ManagedInterimReport(
    () => Promise.reject(new Error("Unexpected interim read")),
    () => {},
  );
}
