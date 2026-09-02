export const LOCAL_RESEARCH_VAULT_PROFILE =
  "personal_single_user_local_vault" as const;

export const LOCAL_RESEARCH_RECORD_KINDS = [
  "thesis",
  "settings",
  "watchlist",
  "alert_definition",
  "job_state",
  "portfolio",
] as const;

export type LocalResearchRecordKind =
  (typeof LOCAL_RESEARCH_RECORD_KINDS)[number];

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface LocalResearchRecord {
  readonly profile: typeof LOCAL_RESEARCH_VAULT_PROFILE;
  readonly kind: LocalResearchRecordKind;
  readonly id: string;
  readonly version: number;
  readonly payload: JsonValue;
  readonly payloadSha256: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LocalResearchRecordSummary {
  readonly profile: typeof LOCAL_RESEARCH_VAULT_PROFILE;
  readonly kind: LocalResearchRecordKind;
  readonly id: string;
  readonly version: number;
  readonly payloadSha256: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PutLocalResearchRecordCommand {
  readonly kind: LocalResearchRecordKind;
  readonly id: string;
  /** Zero creates an unused identifier; a positive value is a strong CAS. */
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly payload: JsonValue;
}

export interface DeleteLocalResearchRecordCommand {
  readonly kind: LocalResearchRecordKind;
  readonly id: string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
}

export interface PutLocalResearchAttachmentCommand {
  readonly attachmentId: string;
  readonly recordKind: LocalResearchRecordKind;
  readonly recordId: string;
  readonly expectedRecordVersion: number;
  readonly idempotencyKey: string;
  readonly mediaType: string;
  readonly bytes: Uint8Array;
}

export interface LocalResearchAttachment {
  readonly profile: typeof LOCAL_RESEARCH_VAULT_PROFILE;
  readonly attachmentId: string;
  readonly recordKind: LocalResearchRecordKind;
  readonly recordId: string;
  readonly recordVersion: number;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly contentSha256: string;
  readonly createdAt: string;
  readonly bytes: Uint8Array;
}

export interface LocalResearchMutationReceipt {
  readonly profile: typeof LOCAL_RESEARCH_VAULT_PROFILE;
  readonly operation: "delete" | "put" | "put_attachment";
  readonly kind: LocalResearchRecordKind;
  readonly id: string;
  readonly version: number;
  readonly digestSha256: string;
  readonly committedAt: string;
  readonly replayed: boolean;
  readonly attachmentId?: string;
}

export interface LocalResearchVaultInventory {
  readonly profile: typeof LOCAL_RESEARCH_VAULT_PROFILE;
  readonly schemaVersion: number;
  readonly records: readonly LocalResearchRecordSummary[];
  readonly attachments: readonly Readonly<{
    attachmentId: string;
    recordKind: LocalResearchRecordKind;
    recordId: string;
    recordVersion: number;
    mediaType: string;
    byteLength: number;
    contentSha256: string;
    createdAt: string;
  }>[];
}
