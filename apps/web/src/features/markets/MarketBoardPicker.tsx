import { WorkspaceLink } from "../workspace/WorkspaceNavigation";
import { workspaceTaskHref } from "../workspace/workspace-route";
import {
  marketBoardIdentityKey,
  type MarketBoardDefinition,
  type MarketBoardWatchlist,
} from "./market-board-loader";

export interface MarketBoardPickerProps {
  readonly draft: MarketBoardDefinition;
  readonly watchlist: MarketBoardWatchlist;
  readonly disabled: boolean;
  readonly onModeChange: (kind: "default" | "watchlist") => void;
  readonly onToggleWatchlist: (listingId: string, selected: boolean) => void;
}

export function MarketBoardPicker(props: MarketBoardPickerProps) {
  const selected = props.draft.kind === "watchlist" ? props.draft.members : [];
  const selectedKeys = new Set(selected.map(marketBoardIdentityKey));
  return (
    <fieldset className="markets-picker" disabled={props.disabled}>
      <legend>Choose your board</legend>
      <div
        className="markets-board-modes"
        role="group"
        aria-label="Board source"
      >
        {(
          [
            ["default", "Default suggestions"],
            ["watchlist", "My Watchlist"],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            aria-pressed={props.draft.kind === kind}
            onClick={() => props.onModeChange(kind)}
          >
            {label}
          </button>
        ))}
      </div>
      {props.draft.kind === "default" ? (
        <p>AAPL, MSFT and WMT. Prices load only when you choose Load board.</p>
      ) : (
        <>
          <p id="markets-picker-guidance">
            Choose up to six U.S. common stocks in your saved order. Checking a
            company does not load prices or change My Watchlist.
          </p>
          {props.watchlist.status === "available" &&
          props.watchlist.members.length > 0 ? (
            <>
              <div className="markets-picker-count" role="status">
                {selected.length} of 6 selected
                {selected.length === 6
                  ? ". Uncheck a company to choose another."
                  : selected.length === 0
                    ? ". Choose at least one company to load."
                    : ". Choose Load board when ready."}
              </div>
              <ul className="markets-picker-members">
                {props.watchlist.members.map((member) => {
                  const checked = selectedKeys.has(
                    marketBoardIdentityKey(member),
                  );
                  const supported =
                    member.country === "US" &&
                    member.instrumentType === "common_stock";
                  return (
                    <li key={member.listingId}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={
                            !supported || (!checked && selected.length >= 6)
                          }
                          aria-describedby="markets-picker-guidance"
                          onChange={(event) =>
                            props.onToggleWatchlist(
                              member.listingId,
                              event.currentTarget.checked,
                            )
                          }
                        />
                        <span>
                          <strong>{member.symbol}</strong>{" "}
                          <span className="markets-picker-venue">
                            {member.exchangeMic}
                          </span>
                          <span className="markets-picker-name">
                            {member.issuerName}
                          </span>
                          {!supported ? (
                            <small>
                              Common stocks only; this listing is unavailable
                              for the board.
                            </small>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="markets-picker-empty" role="status">
              {props.watchlist.status === "stale"
                ? "Your watchlist uses an older catalog. Reconcile it in My Watchlist before loading these companies."
                : props.watchlist.status === "reconciling"
                  ? "Watchlist reconciliation is in progress. Load after it finishes."
                  : props.watchlist.status === "unavailable"
                    ? "Your saved watchlist is unavailable. Open My Watchlist to check its status, or use the default suggestions."
                    : "Your watchlist is empty. Find a company in Discover and add it to My Watchlist."}
            </p>
          )}
          <div className="markets-picker-links">
            <WorkspaceLink href={workspaceTaskHref("watchlist")}>
              Open My Watchlist
            </WorkspaceLink>
            <WorkspaceLink href={workspaceTaskHref("discover")}>
              Find companies in Discover
            </WorkspaceLink>
          </div>
        </>
      )}
    </fieldset>
  );
}
