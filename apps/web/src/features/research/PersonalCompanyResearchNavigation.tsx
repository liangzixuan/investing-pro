"use client";

export interface PersonalCompanyResearchNavigationProps {
  readonly position: number;
  readonly total: number;
  readonly disabled: boolean;
  readonly invalidated: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}

export function PersonalCompanyResearchNavigation({
  position,
  total,
  disabled,
  invalidated,
  onPrevious,
  onNext,
}: PersonalCompanyResearchNavigationProps) {
  return (
    <nav
      aria-label="My Watchlist company navigation"
      className="company-research-navigation"
    >
      <p
        aria-atomic="true"
        aria-live="polite"
        className="company-research-navigation-status"
        id="company-research-navigation-status"
        role="status"
      >
        {invalidated
          ? "This research sequence is no longer current. Open Research from My Watchlist to start again."
          : `Company ${String(position)} of ${String(total)} My Watchlist matches`}
      </p>
      <div className="company-research-navigation-actions">
        <button
          aria-describedby="company-research-navigation-hint"
          className="secondary-action compact-action"
          disabled={disabled || invalidated || position <= 1}
          onClick={onPrevious}
          type="button"
        >
          Previous company
        </button>
        <button
          aria-describedby="company-research-navigation-hint"
          className="secondary-action compact-action"
          disabled={disabled || invalidated || position >= total}
          onClick={onNext}
          type="button"
        >
          Next company
        </button>
      </div>
      <p
        className="company-research-navigation-hint"
        id="company-research-navigation-hint"
      >
        Changing company clears loaded research and valuation assumptions.
        Watchlist note drafts are kept.
      </p>
    </nav>
  );
}
