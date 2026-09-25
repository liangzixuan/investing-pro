import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isPersonalWorkspaceWebMode } from "@/lib/web-mode";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Research Cockpit — Markets" };
export default function MarketsPage() {
  if (!isPersonalWorkspaceWebMode(process.env.RESEARCH_COCKPIT_WEB_MODE))
    notFound();
  return null;
}
