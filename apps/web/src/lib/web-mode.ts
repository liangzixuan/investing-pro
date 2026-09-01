export function isPersonalWebMode(value: string | undefined): boolean {
  return value === "personal_single_user_local";
}

export function isPersonalDossierWebMode(value: string | undefined): boolean {
  return value === "personal_dossier";
}
