# Research from the filing inbox

This outcome is in progress and unreleased. Accepted a87 release
`4a033698634ab217af21de9f0332c95b07941abc` is the baseline. Workspace
[CURRENT.md](../../../CURRENT.md) records ownership, actual verification and
release status. The [plan](./plan.md) and [tasks](./tasks.md) track delivery.

From a loaded Daily SEC filing monitor entry, open the exact saved listing in
company Research's SEC section. Return to the same inbox with its page, entry
order, unsaved settings and read status intact. An event covering several
listings offers each eligible listing separately. The original filing link and
explicit acknowledgement remain separate actions.

## Identity and lifetime

An action requires a current monitor binding and a policy-selected listing.
Match the entry's listing ID, symbol and issuer name to the current saved
membership. Use that admitted membership's full identity: country, exchange MIC,
instrument type, issuer ID/name, listing ID, security ID/name, share-class ID/name
and symbol. Do not select the first listing or reconstruct identity from a ticker.
Do not pass a watchlist note into company identity.

A paused monitor with a current binding remains researchable. Unconfigured or
obsolete bindings and missing or conflicting memberships cannot authorize
Research. Their retained history remains readable. Replacing the catalog,
watchlist, identity or session retires old actions under existing rules.

Keep monitor visibility separate from its existing enabled lifetime. The monitor
stays mounted during Research. A new click must come from the current visible
monitor, current response/page and operation lifetime, with no pending operation.
Paging, hide/return, response replacement, cancellation and unmount retire old
click handlers. A stale handler cannot become current merely by returning to the
same view.

After an accepted click, the origin is intentionally hidden. Its durable handoff
and return guard keeps the response, page, entry, membership and operation checks
without requiring origin visibility. Unsubmitted settings edits alone do not
retire the loaded policy's identity authority. Starting a monitor operation does.

## Navigation and retained state

Reuse the existing company route and Updates route. Add a monitor origin with
the label **Back to filing inbox** and the monitor heading as its fallback focus
target. In-app Back and browser Back restore the mounted monitor subview; this
does not promise inbox restoration after a full page reload.

Opening the same full company identity selects SEC while retaining loaded data
and company drafts. A different identity retains the existing reset behavior.
Back focuses the originating connected, visible Research button if its durable
authority survives. Otherwise it uses the monitor heading. Later navigation or
context retirement must cancel queued focus instead of stealing it.

Research and Back do not load the monitor, acknowledge a filing, change settings
or request company data. Existing explicit loads and the separately scheduled
monitor worker retain their behavior. This feature adds no API, route, schema,
dependency, provider, cache or persisted selection.

## Acceptance

- Both choices on a multi-listing event open their exact companies. Paused current
  policies work; obsolete, mismatched or unselected identities do not.
- Old callbacks lose authority on page/view, operation, full-identity, catalog,
  watchlist and session changes, including changes before effects settle.
- A page-two round trip retains the settings draft, accepted inbox, order and
  unread status through both Back paths, with correct guarded focus.
- Same-company SEC entry preserves loaded company state. Navigation adds no
  monitor or provider loads and no owner-record writes.
- Real components pass source-bound synthetic desktop and 390px keyboard/layout
  checks. Invented records cover populated and adverse cases.
- The unchanged release gates, exact-revision hosted jobs, guarded activation
  and bounded live check must pass before release acceptance. A real empty or
  obsolete inbox is an honest live limit; never create owner data for QA.
