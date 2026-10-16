import { useLayoutEffect, useRef, type RefObject } from "react";

const sections = {
  board: "Company board",
  review: "Research checks due",
  day: "Markets day view",
  calendar: "Economic calendar",
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
