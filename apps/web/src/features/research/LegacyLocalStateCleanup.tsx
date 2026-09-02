"use client";

import { useEffect } from "react";

import { scrubLegacyLocalResearchStateFromWindow } from "@/lib/legacy-local-state-cleanup";

export function LegacyLocalStateCleanup() {
  useEffect(() => {
    scrubLegacyLocalResearchStateFromWindow();
  }, []);
  return null;
}
