"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

import type { PersonalMarketSelection } from "./PersonalMarketOverview";

export type PersonalCompanyResearchSection =
  "price" | "financials" | "valuation" | "peers" | "sec";

export interface PersonalCompanyResearchWorkspaceProps {
  readonly selection: PersonalMarketSelection | null;
  readonly activeSection: PersonalCompanyResearchSection;
  readonly onSectionChange: (section: PersonalCompanyResearchSection) => void;
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly onClear: () => void;
  readonly researchNote?: ReactNode;
  readonly sections: Readonly<
    Record<PersonalCompanyResearchSection, ReactNode>
  >;
}

const sections = [
  ["price", "Price"],
  ["financials", "Financials"],
  ["valuation", "Valuation"],
  ["peers", "Peers"],
  ["sec", "SEC evidence"],
] as const;

const sourceTargets: Readonly<Record<string, PersonalCompanyResearchSection>> =
  {
    "personal-market-overview": "price",
    "personal-annual-financials-title": "financials",
    "personal-valuation-history-title": "valuation",
  };

export function PersonalCompanyResearchWorkspace({
  selection,
  activeSection,
  onSectionChange,
  backLabel,
  onBack,
  onClear,
  researchNote,
  sections: content,
}: PersonalCompanyResearchWorkspaceProps) {
  const identity = JSON.stringify(selection);
  const pendingSource = useRef<{
    readonly identity: string;
    readonly section: PersonalCompanyResearchSection;
    readonly target: string;
  } | null>(null);
  const current = useRef({ identity, activeSection });
  current.current = { identity, activeSection };

  useEffect(() => {
    const pending = pendingSource.current;
    if (pending === null) return;
    pendingSource.current = null;
    if (
      selection !== null &&
      pending.identity === identity &&
      pending.section === activeSection
    ) {
      focusSource(pending.target);
    }
  }, [identity, activeSection, selection]);

  function changeSection(next: PersonalCompanyResearchSection) {
    pendingSource.current = null;
    if (selection !== null && current.current.identity === identity)
      onSectionChange(next);
  }

  function navigateTabs(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const nextIndex =
      event.key === "ArrowRight"
        ? (index + 1) % sections.length
        : event.key === "ArrowLeft"
          ? (index + sections.length - 1) % sections.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? sections.length - 1
              : null;
    if (nextIndex === null || current.current.identity !== identity) return;
    event.preventDefault();
    const next = sections[nextIndex]?.[0];
    if (next === undefined) return;
    changeSection(next);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#company-research-tab-${next}`)
      ?.focus();
  }

  return (
    <section
      aria-labelledby="personal-company-research-title"
      className="company-research-workspace"
      id="personal-company-research"
      tabIndex={-1}
      onClickCapture={(event) => {
        if (
          selection === null ||
          current.current.identity !== identity ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          !(event.target instanceof Element)
        )
          return;
        const link = event.target.closest<HTMLAnchorElement>("a[href]");
        const target = link?.getAttribute("href")?.slice(1);
        if (
          !link?.getAttribute("href")?.startsWith("#") ||
          !target ||
          !Object.hasOwn(sourceTargets, target) ||
          !event.currentTarget.contains(link)
        )
          return;
        event.preventDefault();
        const section = sourceTargets[target];
        if (section === undefined) return;
        if (section === activeSection) {
          focusSource(target);
        } else {
          pendingSource.current = { identity, section, target };
          onSectionChange(section);
        }
      }}
    >
      <div className="company-research-heading">
        <div>
          <p className="eyebrow">Company research</p>
          <h2 id="personal-company-research-title" tabIndex={-1}>
            {selection === null ? "Explore a company" : selection.symbol}
          </h2>
          {selection !== null && (
            <>
              <p className="company-research-name">{selection.issuerName}</p>
              <p className="company-research-identity">
                {selection.exchangeMic} · {selection.securityName}
              </p>
            </>
          )}
        </div>
        {selection !== null && (
          <div className="company-research-actions">
            <button
              className="secondary-action compact-action"
              onClick={onBack}
              type="button"
            >
              {backLabel}
            </button>
            <button
              className="secondary-action compact-action"
              onClick={onClear}
              type="button"
            >
              Clear company
            </button>
          </div>
        )}
      </div>
      {selection === null ? (
        <p className="company-research-guidance">
          Open a company from search, screening results or My Watchlist to
          explore its prices, financials and SEC evidence.
        </p>
      ) : (
        <>
          {researchNote}
          <p className="company-research-guidance">
            Move between sections without losing loaded data. Each section loads
            new data only when you request it.
          </p>
          <div
            aria-label="Company research sections"
            className="company-research-tabs"
            role="tablist"
          >
            {sections.map(([section, label], index) => (
              <button
                aria-controls={`company-research-panel-${section}`}
                aria-selected={activeSection === section}
                id={`company-research-tab-${section}`}
                key={section}
                onClick={() => changeSection(section)}
                onKeyDown={(event) => navigateTabs(event, index)}
                role="tab"
                tabIndex={activeSection === section ? 0 : -1}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      {sections.map(([section]) => (
        <div
          aria-labelledby={
            selection === null ? undefined : `company-research-tab-${section}`
          }
          className="company-research-panel"
          hidden={selection === null || activeSection !== section}
          id={`company-research-panel-${section}`}
          key={section}
          role="tabpanel"
          tabIndex={0}
        >
          {content[section]}
        </div>
      ))}
    </section>
  );
}

function focusSource(targetId: string) {
  const target = document.getElementById(targetId);
  if (target === null || target.closest("[hidden]")) return;
  target.tabIndex = -1;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start", behavior: "instant" });
}
