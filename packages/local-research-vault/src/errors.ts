export type LocalResearchVaultErrorCode =
  | "VAULT_ALREADY_EXISTS"
  | "VAULT_CLOSED"
  | "VAULT_CONFLICT"
  | "VAULT_CORRUPT"
  | "VAULT_DELETED"
  | "VAULT_IDEMPOTENCY_CONFLICT"
  | "VAULT_INVALID_INPUT"
  | "VAULT_NOT_FOUND"
  | "VAULT_PATH_REJECTED"
  | "VAULT_RESTORE_TARGET_NOT_EMPTY"
  | "VAULT_SECURITY_BOUNDARY_REJECTED";

export class LocalResearchVaultError extends Error {
  constructor(
    readonly code: LocalResearchVaultErrorCode,
    message = "The local research vault operation was rejected.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LocalResearchVaultError";
  }
}

export function vaultError(
  code: LocalResearchVaultErrorCode,
  cause?: unknown,
): LocalResearchVaultError {
  return new LocalResearchVaultError(
    code,
    "The local research vault operation was rejected.",
    cause === undefined ? undefined : { cause },
  );
}
