# Daily SEC filing monitor

The personal workspace can check recent SEC filings for up to 20 saved listings
while the local API is running. The monitor is off by default. Its inbox and
operational state use the existing encrypted local vault. Desktop notifications
are a separate opt-in and contain only a generic prompt to open the app.

## Use

Load the monitor beside My Watchlist's manual filings view. Select saved listings,
a daily local time and an IANA time zone, then explicitly enable the monitor.
The suggested time is 09:00; quiet hours run from 22:00 through 07:59 when enabled.
Quiet hours defer desktop notices but allow filing checks and inbox updates.

The first complete observation for each issuer establishes a baseline without
announcing old filings. Subsequent new CIK/accession pairs enter the inbox.
Share classes of one issuer share one event; amendments have their own accession.
Filing dates are SEC calendar dates. First-observed and check timestamps record
when this app saw the data, not the filing's publication time.

The saved opt-in continues after the browser closes or signs out while the API
is running. Viewing the inbox and changing settings still require the existing
local workspace authorization and request boundaries. Pause stops new work and
preserves history. A changed watchlist or catalog requires explicit rebinding.
Rebinding a watchlist version within the same catalog preserves history when
the resolved identities are unchanged. Changing the catalog or selected identities
requires an empty retained inbox, or an explicit reset
while paused. Reset clears this monitor's history and leaves it disabled; the
next enable establishes a new baseline.

## Scheduling and coverage

Enable schedules an immediate baseline check. Later checks follow the saved daily
time and zone, with a one-minute worker interval and one batch at a time. A
missing time during the spring daylight-saving change uses the first existing
local minute at or after that time. A repeated autumn time runs once. Restart
performs one overdue check, rather than one batch for every missed day.

Checks reuse the current SEC Submissions provider's 30-day inclusive UTC
filing-date window. They preserve its fixed source URLs, declared contact,
sequential pacing, deadlines, response limits and accession validation. Older
continuation files and filing documents are not acquired. The existing manual
7/30/90-day filing view remains available and does not depend on this monitor.

Failures, truncation and overflow remain visible and do not establish an empty
or complete result. An issuer needs a complete first observation before new-filing
detection begins. A gap longer than 30 days cannot be fully recovered from this
window. Backdated additions outside it can also be missed. Coverage gaps remain
visible after later success until history is explicitly reset.

A busy shared provider permits at most two retries, five minutes apart. Other
failures wait for the next daily check. Sleeping or shutting down Windows, or
closing the API, stops checks. This feature installs no service, scheduled task,
autostart entry or wake-up setting.

## Desktop delivery

Windows receives a fixed generic notice through the packaged Windows Forms
helper. No company name, filing, watchlist note, account value or credential is
included. The helper owns its temporary icon and child process. It does not
change notification permissions, register a borrowed application identity or
open a browser link when clicked. Open the app to read the inbox.

Delivery state is separate from reading:

| State         | Meaning                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| Disabled      | Desktop delivery was not selected for this event.                       |
| Pending       | The encrypted event is waiting for an eligible delivery time.           |
| Reserved      | Its one permitted attempt was recorded before calling Windows.          |
| Not submitted | The adapter has evidence that submission never started.                 |
| Unconfirmed   | The native call returned, but no shown callback was observed.           |
| Shown         | Windows Forms reported its shown callback. This does not prove reading. |
| Uncertain     | An interrupted or invalid observation cannot establish delivery.        |

Pending events can share one notice. The attempt is reserved durably before OS
work. Restart treats an unfinished reservation as uncertain and does not send
it again. There is no automatic retry of a desktop attempt, including a proved
failure before submission. The inbox remains available regardless of delivery.
Only the owner's explicit acknowledgement marks an inbox item read. Neither a
shown callback, a close callback nor a click does that automatically. No durable
Windows Notification Center history or exactly-once display is promised.

A shown callback remains recorded if a later helper failure makes the overall
attempt uncertain. Acknowledging an event before its attempt is reserved cancels
its pending desktop delivery.

## Retention and safety bounds

Each issuer retains at most 1,000 seen accessions, 50 inbox entries and 192 KiB
of monitor state. Seen keys outside the current overlap may retire only when
retained inbox items no longer need them. Acknowledged entries with a settled
delivery outcome may retire 30 days after first observation. Unread, pending, reserved and uncertain
entries are preserved until an explicit reset or their permitted transition.
If an observation exceeds a cap, the previous state is held, overflow and a
coverage gap are shown, and the held observation produces no partial notice.

Normalized metadata and operational receipts are encrypted locally. Raw SEC
bodies, filing documents, contact values and watchlist notes are excluded.
Provider results and delivery completions are checked against the current policy
and saved identities before use. Pause, reconfiguration or shutdown cancels
pending work; an already-started native notice can still have appeared.

## Verification

Behavioral acceptance uses synthetic SEC responses, injected clocks and native
outcomes, temporary encrypted vaults, restart/crash boundaries and an accelerated
seven-day scenario. Packaged native delivery is tested separately under the
desktop user. Source review, full applicable local and hosted gates, and Brave
workflow checks precede release acceptance. Actual results and limitations are
recorded in the release handoff. Tests do not enable the owner's monitor or
measure live SEC coverage.

This delivery covers filed SEC records only. Other alert types, news and upcoming
earnings calendars, email, installation, notification-click navigation and an
always-on service remain separate work.
