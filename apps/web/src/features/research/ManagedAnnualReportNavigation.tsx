import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import { useLayoutEffect, useRef, type RefObject } from "react";

const sections = {
  income: "Revenue and net income",
  operating: "Operating results",
  cash: "Cash generation",
  liquidity: "Liquidity",
  balanceSheet: "Balance sheet totals",
  sources: "Report source details",
} as const;

type Section = keyof typeof sections;
export type AnnualReportTargets = Readonly<
  Record<Section, { id: string; ref: RefObject<HTMLElement | null> }>
>;

export function ManagedAnnualReportNavigation({
  response,
  targets,
  sourceDetails,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
  readonly targets: AnnualReportTargets;
  readonly sourceDetails: RefObject<HTMLDetailsElement | null>;
}) {
  const committedResponse = useRef<PersonalSecAnnualEvidenceResponseDto | null>(
    null,
  );
  useLayoutEffect(() => {
    committedResponse.current = response;
    return () => {
      committedResponse.current = null;
    };
  }, [response]);

  function jump(section: Section) {
    const target = targets[section].ref.current;
    const current = () =>
      committedResponse.current === response &&
      target !== null &&
      targets[section].ref.current === target &&
      target.isConnected &&
      target.getClientRects().length > 0;
    if (!current() || !target) return;
    if (section === "sources") {
      const details = sourceDetails.current;
      if (!details?.isConnected || !details.contains(target)) return;
      details.open = true;
    }
    target.focus({ preventScroll: true });
    if (current())
      target.scrollIntoView({ block: "start", behavior: "instant" });
  }

  return (
    <nav
      className="managed-annual-report-navigation"
      aria-label="On this report"
    >
      <p>On this report</p>
      {(Object.keys(sections) as Section[]).map((section) => (
        <a
          key={section}
          href={`#${targets[section].id}`}
          data-annual-report-jump={section}
          onClick={(event) => {
            event.preventDefault();
            jump(section);
          }}
        >
          {sections[section]}
        </a>
      ))}
    </nav>
  );
}
