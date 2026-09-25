import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isPersonalWorkspaceWebMode } from "@/lib/web-mode";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Research Cockpit — Company research",
};
export default function CompanyPage() {
  if (!isPersonalWorkspaceWebMode(process.env.RESEARCH_COCKPIT_WEB_MODE))
    notFound();
  return null;
}
