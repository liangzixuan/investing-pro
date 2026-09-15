export function isPersonalWebMode(value: string | undefined): boolean {
  return value === "personal_single_user_local";
}

export function isPersonalDossierWebMode(value: string | undefined): boolean {
  return value === "personal_dossier";
}

export function isPersonalWorkspaceWebMode(value: string | undefined): boolean {
  return value === "personal_workspace";
}

export function resolveOwnerAuthMode(
  value: string | undefined,
): "account" | "bootstrap" | "local" {
  if (value === "local") return "local";
  if (value === "account") return "account";
  if (value === undefined || value === "bootstrap") return "bootstrap";
  throw new Error("The owner sign-in configuration is invalid.");
}
