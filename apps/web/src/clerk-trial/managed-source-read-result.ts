/** Completion of one explicitly requested, owned source read. */
export type ManagedSourceReadResult =
  "accepted" | "not_started" | "cancelled" | "retired" | "failed";
