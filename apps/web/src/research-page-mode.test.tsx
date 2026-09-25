import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const components = vi.hoisted(() => ({
  Discovery: () => null,
  Personal: () => null,
  Synthetic: () => null,
}));
const moduleLoads = vi.hoisted(() => ({
  discovery: 0,
  personal: 0,
  researchCore: 0,
  synthetic: 0,
}));
const navigation = vi.hoisted(() => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/features/research/PersonalResearchWorkspace", () => {
  moduleLoads.personal += 1;
  return { PersonalResearchWorkspace: components.Personal };
});
vi.mock("@/features/research/SecurityDiscoveryWorkspace", () => {
  moduleLoads.discovery += 1;
  return { SecurityDiscoveryWorkspace: components.Discovery };
});
vi.mock("@/features/research/ResearchWorkspace", () => {
  moduleLoads.synthetic += 1;
  return { ResearchWorkspace: components.Synthetic };
});
vi.mock("@research-cockpit/research-core", () => {
  moduleLoads.researchCore += 1;
  return { DEFAULT_KNOWN_AT: "2025-03-01T12:00:00.000Z" };
});
vi.mock("next/navigation", () => navigation);
vi.mock("@/features/workspace/PersonalWorkspaceRoutes", () => ({
  PersonalWorkspaceRoutes: components.Discovery,
}));
vi.mock("@/features/research/LegacyLocalStateCleanup", () => ({
  LegacyLocalStateCleanup: () => null,
}));
vi.mock("@/features/workspace/workspace.css", () => ({}));
vi.mock("@/features/research/company-overview.css", () => ({}));
vi.mock("@/features/research/personal-portfolio.css", () => ({}));
vi.mock("@/features/research/personal-portfolio-ledger.css", () => ({}));
vi.mock("@/features/research/personal-portfolio-history.css", () => ({}));
vi.mock(
  "@/features/research/personal-portfolio-valuation-history.css",
  () => ({}),
);
vi.mock("@/lib/web-mode", () => import("./lib/web-mode"));

afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.resetModules();
  moduleLoads.personal = 0;
  moduleLoads.discovery = 0;
  moduleLoads.researchCore = 0;
  moduleLoads.synthetic = 0;
  navigation.notFound.mockClear();
  navigation.redirect.mockClear();
});

describe("research page data-mode isolation", () => {
  it.each([
    [
      "personal_workspace",
      "Research Desk",
      "Markets, company research and personal watchlists.",
    ],
    [
      "",
      "Research Cockpit — Synthetic Demo",
      "Evidence-first synthetic investment research workflow.",
    ],
  ])(
    "uses accurate layout metadata in %s mode",
    async (mode, title, description) => {
      vi.stubEnv("RESEARCH_COCKPIT_WEB_MODE", mode);
      const { metadata } = await import("../app/layout");
      expect(metadata).toMatchObject({
        title,
        description,
        robots: { index: false, follow: false },
      });
    },
  );
  it("redirects the root before rendering the synthetic landing in dossier mode", async () => {
    vi.stubEnv("RESEARCH_COCKPIT_WEB_MODE", "personal_dossier");
    const { default: HomePage } = await import("../app/page");

    expect(() => HomePage()).toThrow("NEXT_REDIRECT:/personal");

    expect(navigation.redirect).toHaveBeenCalledExactlyOnceWith("/personal");
    expect(moduleLoads).toEqual({
      discovery: 0,
      personal: 0,
      researchCore: 0,
      synthetic: 0,
    });
  });

  it("redirects before importing any workspace in dossier mode", async () => {
    vi.stubEnv("RESEARCH_COCKPIT_WEB_MODE", "personal_dossier");
    const ResearchPage = await loadResearchPage();

    await expect(
      ResearchPage({
        params: Promise.resolve({ symbol: "SYN1" }),
        searchParams: Promise.resolve({ knownAt: "PRIVATE_QUERY_CANARY" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/personal");

    expect(navigation.redirect).toHaveBeenCalledExactlyOnceWith("/personal");
    expect(moduleLoads).toEqual({
      discovery: 0,
      personal: 0,
      researchCore: 0,
      synthetic: 0,
    });
  });

  it("loads only the parameter-free personal workspace on the isolated route", async () => {
    vi.stubEnv("RESEARCH_COCKPIT_WEB_MODE", "personal_dossier");
    const { default: PersonalResearchPage } =
      await import("../app/personal/page");

    const rendered = PersonalResearchPage();

    expect(React.isValidElement(rendered)).toBe(true);
    expect(rendered.type).toBe(components.Personal);
    expect(rendered.props).toEqual({});
    expect(navigation.notFound).not.toHaveBeenCalled();
    expect(moduleLoads).toEqual({
      discovery: 0,
      personal: 1,
      researchCore: 0,
      synthetic: 0,
    });
  });

  it("redirects the root to Markets in personal workspace mode", async () => {
    vi.stubEnv("RESEARCH_COCKPIT_WEB_MODE", "personal_workspace");
    const { default: HomePage } = await import("../app/page");

    expect(() => HomePage()).toThrow("NEXT_REDIRECT:/markets");
    expect(navigation.redirect).toHaveBeenCalledExactlyOnceWith("/markets");
    expect(moduleLoads).toEqual({
      discovery: 0,
      personal: 0,
      researchCore: 0,
      synthetic: 0,
    });
  });

  it("redirects symbol routes to discovery before loading synthetic code", async () => {
    vi.stubEnv("RESEARCH_COCKPIT_WEB_MODE", "personal_workspace");
    const ResearchPage = await loadResearchPage();

    await expect(
      ResearchPage({
        params: Promise.resolve({ symbol: "SYN1" }),
        searchParams: Promise.resolve({ knownAt: "PRIVATE_QUERY_CANARY" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/discover");

    expect(navigation.redirect).toHaveBeenCalledExactlyOnceWith("/discover");
    expect(moduleLoads).toEqual({
      discovery: 0,
      personal: 0,
      researchCore: 0,
      synthetic: 0,
    });
  });

  it("keeps workspace route leaves free of duplicate session controllers", async () => {
    vi.stubEnv("RESEARCH_COCKPIT_WEB_MODE", "personal_workspace");
    const { default: DiscoveryPage } = await import("../app/discover/page");
    const { default: MarketsPage } = await import("../app/markets/page");
    const { default: CompanyPage } =
      await import("../app/company/[listingId]/page");
    expect(DiscoveryPage()).toBeNull();
    expect(MarketsPage()).toBeNull();
    expect(CompanyPage()).toBeNull();
    expect(moduleLoads.discovery).toBe(0);
    expect(navigation.notFound).not.toHaveBeenCalled();
  });
  it.each(["markets", "company"])(
    "does not expose %s outside workspace mode",
    async (route) => {
      vi.stubEnv("RESEARCH_COCKPIT_WEB_MODE", "");
      const page =
        route === "markets"
          ? (await import("../app/markets/page")).default
          : (await import("../app/company/[listingId]/page")).default;
      expect(() => page()).toThrow("NEXT_NOT_FOUND");
    },
  );

  it("does not expose discovery outside personal workspace mode", async () => {
    vi.stubEnv("RESEARCH_COCKPIT_WEB_MODE", "");
    const { default: DiscoveryPage } = await import("../app/discover/page");

    expect(() => DiscoveryPage()).toThrow("NEXT_NOT_FOUND");
    expect(navigation.notFound).toHaveBeenCalledOnce();
    expect(moduleLoads.discovery).toBe(0);
  });

  it("does not expose the isolated personal route outside dossier mode", async () => {
    vi.stubEnv("RESEARCH_COCKPIT_WEB_MODE", "");
    const { default: PersonalResearchPage } =
      await import("../app/personal/page");

    expect(() => PersonalResearchPage()).toThrow("NEXT_NOT_FOUND");
    expect(navigation.notFound).toHaveBeenCalledOnce();
    expect(moduleLoads.researchCore).toBe(0);
    expect(moduleLoads.synthetic).toBe(0);
  });

  it("retains the older personal profile on its legacy workspace branch", async () => {
    vi.stubEnv("RESEARCH_COCKPIT_WEB_MODE", "personal_single_user_local");
    const ResearchPage = await loadResearchPage();

    const rendered = await ResearchPage({
      params: Promise.resolve({ symbol: "syn1" }),
      searchParams: Promise.resolve({}),
    });

    expect(rendered.type).toBe(components.Synthetic);
    expect(rendered.props).toMatchObject({
      personalMode: true,
      symbol: "SYN1",
    });
  });

  it("preserves the synthetic workspace outside explicit personal modes", async () => {
    vi.stubEnv("RESEARCH_COCKPIT_WEB_MODE", "");
    const ResearchPage = await loadResearchPage();

    const rendered = await ResearchPage({
      params: Promise.resolve({ symbol: "syn1" }),
      searchParams: Promise.resolve({}),
    });

    expect(rendered.type).toBe(components.Synthetic);
    expect(rendered.props).toMatchObject({
      personalMode: false,
      symbol: "SYN1",
    });
  });

  it("preserves the synthetic landing outside dossier mode", async () => {
    vi.stubEnv("RESEARCH_COCKPIT_WEB_MODE", "");
    const { default: HomePage } = await import("../app/page");

    const rendered = HomePage();

    expect(React.isValidElement(rendered)).toBe(true);
    expect(navigation.redirect).not.toHaveBeenCalled();
  });
});

async function loadResearchPage() {
  const loadedPage = await import("../app/research/[symbol]/page");
  return loadedPage.default;
}
