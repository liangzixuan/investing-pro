import { useLayoutEffect, useRef, type RefObject } from "react";

const sections = {
  board: "Company board",
  review: "Research checks due",
  cpi: "Published CPI headlines",
  day: "Markets day view",
  calendar: "Economic calendar",
  bls: "BLS release calendar",
  announcements: "Fed announcements",
} as const;

type Section = keyof typeof sections;
export type ManagedMarketsNavigationTargets = Readonly<
  Record<
    Section,
    { readonly id: string; readonly ref: RefObject<HTMLHeadingElement | null> }
  >
>;

export interface ManagedMarketsNavigationProps {
  readonly targets: ManagedMarketsNavigationTargets;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly isCurrent: () => boolean;
}

/** One mounted Markets surface owns every section target and its container. */
export function useManagedMarketsSections(isCurrent: () => boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const board = useRef<HTMLHeadingElement | null>(null);
  const review = useRef<HTMLHeadingElement | null>(null);
  const cpi = useRef<HTMLHeadingElement | null>(null);
  const day = useRef<HTMLHeadingElement | null>(null);
  const calendar = useRef<HTMLHeadingElement | null>(null);
  const bls = useRef<HTMLHeadingElement | null>(null);
  const announcements = useRef<HTMLHeadingElement | null>(null);
  return {
    containerRef,
    isCurrent,
    targets: {
      board: { id: "managed-markets-heading", ref: board },
      review: { id: "managed-daily-research-heading", ref: review },
      cpi: { id: "managed-cpi-heading", ref: cpi },
      day: { id: "managed-markets-day-heading", ref: day },
      calendar: { id: "bea-agenda-title", ref: calendar },
      bls: { id: "bls-calendar-title", ref: bls },
      announcements: { id: "fed-announcements-title", ref: announcements },
    },
  };
}

function rendered(element: HTMLElement): boolean {
  return (
    element.isConnected &&
    !element.closest("[hidden], [inert]") &&
    element.getClientRects().length > 0 &&
    element.ownerDocument.defaultView?.getComputedStyle(element).visibility ===
      "visible"
  );
}

export function useManagedMarketsJump(props: ManagedMarketsNavigationProps) {
  const committed = useRef<ManagedMarketsNavigationProps | null>(null);
  useLayoutEffect(() => {
    committed.current = props;
    return () => {
      committed.current = null;
    };
  }, [props]);

  return function jump(section: Section) {
    const entry = props.targets[section];
    const target = entry.ref.current;
    const container = props.containerRef.current;
    if (!target || !container) return;
    const current = () =>
      committed.current === props &&
      props.isCurrent() &&
      props.containerRef.current === container &&
      props.targets[section] === entry &&
      entry.ref.current === target &&
      target.id === entry.id &&
      container.contains(target) &&
      rendered(container) &&
      rendered(target);
    if (!current()) return;
    target.focus({ preventScroll: true });
    if (current() && target.ownerDocument.activeElement === target)
      target.scrollIntoView({ block: "start", behavior: "instant" });
  };
}

export function ManagedMarketsNavigation(props: ManagedMarketsNavigationProps) {
  const jump = useManagedMarketsJump(props);
  return (
    <nav className="managed-markets-navigation" aria-label="On Markets">
      <p>On Markets</p>
      {(Object.keys(sections) as Section[]).map((section) => (
        <a
          key={section}
          href={`#${props.targets[section].id}`}
          data-markets-jump={section}
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
