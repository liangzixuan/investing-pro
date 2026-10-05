import { parseWorkspaceRoute } from "../features/workspace/workspace-route";

export interface ManagedCompanyRoute {
  readonly kind: "company";
  readonly listingId: string;
  readonly section: "annual" | "eod";
}
export type ParsedManagedCompanyRoute =
  | ManagedCompanyRoute
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "invalid" }>;

/** Reuse the existing canonical listing-ID route grammar. */
export function isManagedCompanyListingId(value: string): boolean {
  if (typeof value !== "string" || value.length > 128) return false;
  if (/[\uD800-\uDFFF]/u.test(value)) return false;
  return (
    parseWorkspaceRoute(`/company/${encodeURIComponent(value)}`, null).kind ===
    "company"
  );
}

export function parseManagedCompanyRoute(
  parameters: URLSearchParams,
): ParsedManagedCompanyRoute {
  const companies = parameters.getAll("company");
  const sections = parameters.getAll("section");
  if (!companies.length && !sections.length) return { kind: "none" };
  const listingId = companies[0];
  const section = sections[0];
  if (
    companies.length !== 1 ||
    sections.length !== 1 ||
    listingId === undefined ||
    !isManagedCompanyListingId(listingId) ||
    (section !== "price" && section !== "annual") ||
    [...parameters.keys()].some((key) => key !== "company" && key !== "section")
  )
    return { kind: "invalid" };
  return {
    kind: "company",
    listingId,
    section: section === "price" ? "eod" : "annual",
  };
}

export function managedCompanyHref(
  listingId: string,
  section: ManagedCompanyRoute["section"],
): string {
  if (
    !isManagedCompanyListingId(listingId) ||
    (section !== "annual" && section !== "eod")
  )
    throw new Error("Invalid company destination.");
  return `/?${new URLSearchParams({ company: listingId, section: section === "eod" ? "price" : "annual" })}`;
}
