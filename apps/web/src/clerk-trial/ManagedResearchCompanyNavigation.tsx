import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  membershipMatchesResult,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type {
  ManagedResearchVisit,
  ResearchCompanyNavigationState,
} from "./managed-workspace";

interface Props {
  research: ManagedResearchVisit;
  state: ResearchCompanyNavigationState;
  canOpen: (
    visit: ManagedResearchVisit,
    member: WatchlistMembership,
  ) => boolean;
  onOpen: (visit: ManagedResearchVisit, member: WatchlistMembership) => void;
}

export function ManagedResearchCompanyNavigation(props: Props) {
  const helpId = useId();
  const identityId = `${helpId}-identity`;
  const { research, state } = props;
  const selection = research.selection;
  const currentMember = () =>
    state.members.find((member) =>
      membershipMatchesResult(member, selection.listing),
    ) ?? null;
  const [stored, setChoice] = useState({
    selection,
    member: currentMember(),
  });
  const member =
    stored.selection !== selection
      ? currentMember()
      : stored.member
        ? (state.members.find((entry) =>
            membershipMatchesResult(entry, stored.member!),
          ) ?? null)
        : null;
  if (stored.selection !== selection || stored.member !== member)
    setChoice({ selection, member });
  const context = useMemo(
    () => ({ research, member, members: state.members, reason: state.reason }),
    [research, member, state.members, state.reason],
  );
  const latest = useRef<{ props: Props; context: typeof context } | null>(null);
  useLayoutEffect(() => {
    latest.current = { props, context };
    return () => {
      latest.current = null;
    };
  }, [props, context]);
  const sameCompany =
    member !== null && membershipMatchesResult(member, selection.listing);
  const canOpen =
    !state.reason &&
    member !== null &&
    !sameCompany &&
    props.canOpen(research, member);
  const reason =
    state.reason ||
    (!member
      ? "Choose a company from the current watchlist draft."
      : sameCompany
        ? "This company is already open."
        : canOpen
          ? "Open this company in the current section, then choose Load to read its sources."
          : "This company cannot be opened from the current visit.");
  return (
    <div className="managed-research-company-navigation">
      <label htmlFor="managed-research-company-select">
        Company in My Watchlist
      </label>
      <div className="managed-research-company-controls">
        <select
          id="managed-research-company-select"
          value={member?.listingId ?? ""}
          aria-describedby={`${identityId} ${helpId}`}
          aria-disabled={!!state.reason || state.members.length === 0}
          onChange={(event) => {
            const current = latest.current;
            if (current?.context !== context || context.reason) return;
            const value = event.currentTarget.value;
            const next = context.members.find(
              (entry) => entry.listingId === value,
            );
            if (next || value === "")
              setChoice({ selection, member: next ?? null });
          }}
        >
          <option value="">Choose company</option>
          {state.members.map((entry) => (
            <option key={entry.listingId} value={entry.listingId}>
              {entry.symbol} · {entry.issuerName} · {entry.shareClassName} ·{" "}
              {entry.exchangeMic}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="trial-secondary"
          aria-disabled={!canOpen}
          aria-describedby={helpId}
          onClick={() => {
            const current = latest.current;
            if (
              current?.context !== context ||
              context.reason ||
              !member ||
              sameCompany ||
              !current.props.canOpen(research, member) ||
              latest.current !== current
            )
              return;
            current.props.onOpen(research, member);
          }}
        >
          Open company
        </button>
      </div>
      <p id={identityId} className="managed-research-company-choice">
        {member
          ? `${member.symbol} · ${member.issuerName} · ${member.securityName} · ${member.shareClassName} · ${member.exchangeMic}`
          : "No company chosen."}
      </p>
      <p id={helpId} className="managed-research-company-help">
        {reason}
      </p>
    </div>
  );
}
