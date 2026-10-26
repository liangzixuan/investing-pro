import type { ManagedEodIdentity } from "@research-cockpit/contracts";
import type { ManagedSourceReadResult } from "./managed-source-read-result";

export type MarketsSourceOutcome =
  | "not_attempted"
  | "retained"
  | "running"
  | "checked"
  | "checked_empty"
  | "failed"
  | "cancelled";
export interface MarketsSourceView {
  readonly token: unknown;
  readonly label: string;
  readonly identity: ManagedEodIdentity | null;
  readonly eligible: boolean;
  readonly busy: boolean;
  readonly loaded: boolean;
  readonly empty: boolean;
  readonly evidence: string;
}
export interface MarketsSourceReviewPort {
  readonly id: string;
  read(): MarketsSourceView;
  load(): Promise<ManagedSourceReadResult>;
  cancel(): void;
  subscribe(listener: () => void): () => void;
}
export interface MarketsSourceReviewRow extends Omit<
  MarketsSourceView,
  "token" | "empty"
> {
  readonly id: string;
  readonly selected: boolean;
  readonly mode: "load" | "refresh";
  readonly outcome: MarketsSourceOutcome;
}
export interface ManagedMarketsSourceReviewState {
  readonly phase:
    | "draft"
    | "preview"
    | "running"
    | "complete"
    | "stopped"
    | "cancelled"
    | "retired";
  readonly rows: readonly MarketsSourceReviewRow[];
  readonly plan: readonly MarketsSourceReviewRow[];
  readonly message: string;
  readonly canPreview: boolean;
  readonly canStart: boolean;
}
